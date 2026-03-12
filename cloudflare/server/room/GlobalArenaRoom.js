import { DurableObject } from 'cloudflare:workers';
import { safeJsonParse, sanitizeRoomId, json } from '../transport.js';
import { GlobalArenaRuntime } from './runtime/GlobalArenaRuntime.mjs';

export class GlobalArenaRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.clients = new Map();
    this.tickHandle = null;
    this.runtime = new GlobalArenaRuntime({
      roomName: env.ROOM_NAME || 'global',
      broadcast: (payload) => this.broadcast(payload)
    });
  }

  connectedUserIds() {
    const out = [];
    for (const meta of this.clients.values()) {
      if (!meta || !meta.userId) continue;
      out.push(meta.userId);
    }
    return out;
  }

  ensureTick() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => {
      try {
        const payload = this.runtime.tick(this.connectedUserIds());
        if (payload) {
          this.broadcast(payload);
        }
        this.stopTickIfEmpty();
      } catch (err) {
        console.error('tick error', err);
      }
    }, 33);
  }

  stopTickIfEmpty() {
    if (!this.runtime.canStopTick(this.clients.size)) return;
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  send(ws, obj) {
    if (!ws) return;
    try {
      ws.send(JSON.stringify(obj));
    } catch (_err) {
      // no-op
    }
  }

  broadcast(obj) {
    const sockets = this.ctx.getWebSockets();
    const payload = JSON.stringify(obj);
    for (let i = 0; i < sockets.length; i++) {
      try {
        sockets[i].send(payload);
      } catch (_err) {
        // no-op
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    this.runtime.refreshWorldMeta(
      sanitizeRoomId(url.searchParams.get('roomId') || this.runtime.roomName || this.env.ROOM_NAME || 'global')
    );

    if (request.headers.get('Upgrade') !== 'websocket') {
      if (url.pathname === '/state') {
        return json(this.runtime.buildRoomState(this.connectedUserIds()));
      }
      return new Response('Expected websocket upgrade', { status: 426 });
    }

    const userId = url.searchParams.get('userId');
    const username = url.searchParams.get('username') || 'player';
    if (!userId) {
      return new Response('Missing userId', { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, username, classId: 'ffa' });

    this.runtime.ensurePlayer(userId, username);
    this.clients.set(server, { userId });
    this.runtime.startPublicMatchIfReady(this.connectedUserIds());
    this.ensureTick();

    this.send(server, this.runtime.buildWelcomePayload(userId));
    this.broadcast(this.runtime.buildSnapshot(true));

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    const msg = safeJsonParse(text);
    if (!msg || typeof msg !== 'object') return;

    const meta = this.clients.get(ws) || ws.deserializeAttachment();
    if (!meta || !meta.userId) return;

    const response = this.runtime.handleClientMessage(meta.userId, msg);
    if (response) {
      this.send(ws, response);
    }
  }

  webSocketClose(ws) {
    const meta = this.clients.get(ws) || ws.deserializeAttachment();
    this.clients.delete(ws);
    if (meta && meta.userId) {
      this.runtime.disconnectPlayer(meta.userId);
    }
    this.stopTickIfEmpty();
  }
}
