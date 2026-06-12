/**
 * ZombiesRoom: one Durable Object per room code. Owns the authoritative
 * ZombiesSim, accepts WebSockets, applies client inputs, ticks at 20Hz while
 * anyone is connected, and broadcasts a snapshot every tick.
 *
 * The sim lives in memory only: if every player leaves (or the DO is
 * evicted between games) the room starts fresh, which matches the
 * lobby-reset behavior of the reference build.
 */
import { DurableObject } from 'cloudflare:workers';
import { ZombiesSim } from '../sim/sim';
import { TICK_MS } from '../sim/constants';
import type { MapData } from '../sim/map';
import { buildSnapshot, parseClientMessage, PROTOCOL_VERSION } from '../protocol/index';
import type { ServerMessage } from '../protocol/index';
import terrainJson from '../assets/maps/terrain.json';
import type { Env } from './index';

const CLIENT_ID_RE = /^[a-zA-Z0-9-]{8,40}$/;
const MAX_BAD_MESSAGES = 20;

interface SocketAttachment {
  playerId: string | null;
  /** Optional lobby-countdown override from the connect URL (dev/e2e). */
  countdownS: number | null;
  badMessages: number;
}

export class ZombiesRoom extends DurableObject<Env> {
  private sim: ZombiesSim | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return Response.json({ error: 'expected websocket' }, { status: 426 });
    }

    const url = new URL(request.url);
    const countdownParam = Number(url.searchParams.get('countdown'));
    const countdownS =
      Number.isFinite(countdownParam) && countdownParam >= 1 && countdownParam <= 120
        ? Math.floor(countdownParam)
        : null;

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.ctx.acceptWebSocket(server);
    setAttachment(server, { playerId: null, countdownS, badMessages: 0 });

    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const attachment = getAttachment(ws);
    const msg = parseClientMessage(message);

    if (!msg) {
      attachment.badMessages++;
      setAttachment(ws, attachment);
      if (attachment.badMessages > MAX_BAD_MESSAGES) {
        ws.close(1008, 'too many malformed messages');
      }
      return;
    }

    switch (msg.type) {
      case 'join': {
        if (msg.protocol !== PROTOCOL_VERSION) {
          send(ws, {
            type: 'error',
            code: 'bad-protocol',
            message: `Server speaks protocol v${PROTOCOL_VERSION}; please reload.`,
          });
          ws.close(1002, 'protocol mismatch');
          return;
        }
        if (attachment.playerId) return; // double join

        const sim = this.ensureSim(attachment.countdownS);
        const playerId =
          typeof msg.clientId === 'string' && CLIENT_ID_RE.test(msg.clientId)
            ? msg.clientId
            : crypto.randomUUID();

        const player = sim.addPlayer(playerId, msg.name);
        if (!player) {
          send(ws, { type: 'error', code: 'room-full', message: 'This room is full.' });
          ws.close(1008, 'room full');
          return;
        }

        // A reconnect for an already-present player replaces the old socket.
        for (const other of this.ctx.getWebSockets()) {
          if (other !== ws && getAttachment(other).playerId === playerId) {
            try {
              other.close(4000, 'replaced by a new connection');
            } catch {
              // already closing
            }
          }
        }

        attachment.playerId = playerId;
        setAttachment(ws, attachment);

        send(ws, {
          type: 'welcome',
          protocol: PROTOCOL_VERSION,
          playerId,
          snapshot: buildSnapshot(sim, []),
        });

        this.ensureTicking();
        return;
      }

      case 'input': {
        if (attachment.playerId && this.sim) {
          this.sim.applyInput(attachment.playerId, msg);
        }
        return;
      }

      case 'ping':
        send(ws, { type: 'pong', t: msg.t });
        return;
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.handleDisconnect(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.handleDisconnect(ws);
  }

  private handleDisconnect(ws: WebSocket): void {
    const attachment = getAttachment(ws);
    if (attachment.playerId && this.sim) {
      // Only remove if this socket still owns the player (it may have been
      // replaced by a reconnect).
      const stillOwned = this.ctx
        .getWebSockets()
        .every(other => other === ws || getAttachment(other).playerId !== attachment.playerId);
      if (stillOwned) {
        this.sim.removePlayer(attachment.playerId);
      }
    }

    if (this.joinedSockets().length === 0) {
      this.stopTicking();
      this.sim = null; // empty room resets, like the reference lobby
    }
  }

  private ensureSim(countdownS: number | null): ZombiesSim {
    if (!this.sim) {
      const seed = Math.floor(Math.random() * 2 ** 31);
      this.sim = new ZombiesSim(terrainJson as MapData, {
        seed,
        ...(countdownS !== null ? { countdownS } : {}),
      });
    }
    return this.sim;
  }

  private ensureTicking(): void {
    if (this.tickTimer !== null) return;
    this.tickTimer = setInterval(() => this.tickOnce(), TICK_MS);
  }

  private stopTicking(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private tickOnce(): void {
    const sim = this.sim;
    if (!sim) {
      this.stopTicking();
      return;
    }

    const events = sim.tick();
    const payload = JSON.stringify({
      type: 'snapshot',
      snapshot: buildSnapshot(sim, events),
    } satisfies ServerMessage);

    for (const ws of this.joinedSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Socket died mid-broadcast; close handler will clean up.
      }
    }
  }

  private joinedSockets(): WebSocket[] {
    return this.ctx.getWebSockets().filter(ws => getAttachment(ws).playerId !== null);
  }
}

function getAttachment(ws: WebSocket): SocketAttachment {
  return (ws.deserializeAttachment() ?? {
    playerId: null,
    countdownS: null,
    badMessages: 0,
  }) as SocketAttachment;
}

function setAttachment(ws: WebSocket, attachment: SocketAttachment): void {
  ws.serializeAttachment(attachment);
}

function send(ws: WebSocket, msg: ServerMessage): void {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // closing socket
  }
}
