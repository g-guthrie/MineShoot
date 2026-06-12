/**
 * WebSocket connection to a room. Buffers snapshots for interpolation and
 * surfaces events exactly once per snapshot.
 */
import { PROTOCOL_VERSION, parseServerMessage } from '../../protocol/index';
import type { Snapshot } from '../../protocol/index';
import type { PlayerInput, SimEvent } from '../../sim/types';

export interface TimedSnapshot {
  receivedAt: number; // performance.now()
  snapshot: Snapshot;
}

export interface NetCallbacks {
  onWelcome: (playerId: string, snapshot: Snapshot) => void;
  onEvents: (events: SimEvent[], snapshot: Snapshot) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

const SNAPSHOT_BUFFER_MS = 1_000;

export class Net {
  playerId: string | null = null;
  latestSnapshot: Snapshot | null = null;
  readonly buffer: TimedSnapshot[] = [];
  pingMs = 0;

  private ws: WebSocket | null = null;
  private pingTimer: number | null = null;

  constructor(private readonly callbacks: NetCallbacks) {}

  connect(roomCode: string, name: string): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = new URL(`${proto}://${location.host}/api/room/${encodeURIComponent(roomCode)}/ws`);
    // Dev/e2e knob: ?countdown=5 on the page shortens the lobby countdown.
    const countdown = new URLSearchParams(location.search).get('countdown');
    if (countdown) url.searchParams.set('countdown', countdown);

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          type: 'join',
          protocol: PROTOCOL_VERSION,
          name,
          clientId: stableClientId(),
        }),
      );
      this.pingTimer = window.setInterval(() => {
        this.send({ type: 'ping', t: performance.now() });
      }, 2_000);
    });

    ws.addEventListener('message', event => {
      const msg = parseServerMessage(event.data);
      if (!msg) return;

      switch (msg.type) {
        case 'welcome':
          this.playerId = msg.playerId;
          this.pushSnapshot(msg.snapshot);
          this.callbacks.onWelcome(msg.playerId, msg.snapshot);
          break;
        case 'snapshot':
          this.pushSnapshot(msg.snapshot);
          if (msg.snapshot.events.length) {
            this.callbacks.onEvents(msg.snapshot.events, msg.snapshot);
          }
          break;
        case 'pong':
          this.pingMs = Math.round(performance.now() - msg.t);
          break;
        case 'error':
          this.callbacks.onError(msg.message);
          break;
      }
    });

    ws.addEventListener('close', () => {
      if (this.pingTimer !== null) clearInterval(this.pingTimer);
      this.callbacks.onClose();
    });
  }

  send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendInput(input: PlayerInput): void {
    this.send({ type: 'input', ...input });
  }

  private pushSnapshot(snapshot: Snapshot): void {
    this.latestSnapshot = snapshot;
    this.buffer.push({ receivedAt: performance.now(), snapshot });
    const cutoff = performance.now() - SNAPSHOT_BUFFER_MS;
    while (this.buffer.length > 2 && this.buffer[0]!.receivedAt < cutoff) {
      this.buffer.shift();
    }
  }

  /**
   * The two snapshots bracketing `renderTime` plus the interpolation factor,
   * for rendering remote entities slightly in the past.
   */
  sampleAt(renderTime: number): { a: Snapshot; b: Snapshot; t: number } | null {
    const buf = this.buffer;
    if (buf.length === 0) return null;
    if (buf.length === 1 || renderTime <= buf[0]!.receivedAt) {
      return { a: buf[0]!.snapshot, b: buf[0]!.snapshot, t: 0 };
    }
    for (let i = buf.length - 1; i >= 0; i--) {
      if (buf[i]!.receivedAt <= renderTime) {
        const a = buf[i]!;
        const b = buf[Math.min(i + 1, buf.length - 1)]!;
        const span = b.receivedAt - a.receivedAt;
        const t = span > 0 ? Math.min(1, (renderTime - a.receivedAt) / span) : 0;
        return { a: a.snapshot, b: b.snapshot, t };
      }
    }
    const last = buf[buf.length - 1]!;
    return { a: last.snapshot, b: last.snapshot, t: 0 };
  }
}

function stableClientId(): string {
  let id = sessionStorage.getItem('clientId');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('clientId', id);
  }
  return id;
}
