import { DurableObject } from 'cloudflare:workers';
import { safeJsonParse, nowMs } from './transport.js';
import { buildPrivateRoomLobbyStateForActor } from './private-room-lobby-state.js';

const HUB_MAX_MESSAGE_BYTES = 1024;
const HUB_PING_RATE = { ratePerSec: 2, burst: 6 };
const HUB_RATE_LIMIT_CLOSE_AFTER = 3;

function decodeMessageText(message) {
  if (typeof message === 'string') return message;
  if (message == null) return '';
  return new TextDecoder().decode(message);
}

function messageByteLength(message) {
  if (typeof message === 'string') return new TextEncoder().encode(message).length;
  if (message == null) return 0;
  if (typeof message.byteLength === 'number') return Number(message.byteLength || 0);
  return new TextEncoder().encode(String(message || '')).length;
}

function consumeTokens(state, limit, now) {
  const safeLimit = limit || HUB_PING_RATE;
  const current = state || {
    tokens: Number(safeLimit.burst || 0),
    updatedAt: Number(now || 0)
  };
  const elapsedMs = Math.max(0, Number(now || 0) - Number(current.updatedAt || 0));
  const refill = (elapsedMs / 1000) * Math.max(0, Number(safeLimit.ratePerSec || 0));
  current.tokens = Math.min(
    Math.max(0, Number(safeLimit.burst || 0)),
    Math.max(0, Number(current.tokens || 0)) + refill
  );
  current.updatedAt = Number(now || 0);
  if (current.tokens < 1) {
    return { ok: false, state: current };
  }
  current.tokens -= 1;
  return { ok: true, state: current };
}

function violationState(meta, now) {
  const current = meta && meta.violationState ? meta.violationState : {
    count: 0,
    updatedAt: Number(now || 0)
  };
  if ((Number(now || 0) - Number(current.updatedAt || 0)) > 10000) {
    current.count = 0;
  }
  current.updatedAt = Number(now || 0);
  current.count += 1;
  return current;
}

export class PrivateRoomLobbyHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.roomId = '';
    this.observers = new Map();
    this.pendingSyncTimer = null;
  }

  async sendState(ws, meta) {
    if (!meta || !meta.actorId || !this.roomId) return false;
    const state = await buildPrivateRoomLobbyStateForActor(this.env, {
      id: meta.actorId,
      displayName: meta.displayName || meta.actorId
    }, this.roomId);
    if (!state) {
      try { ws.close(1008, 'Lobby membership expired'); } catch (_err) {}
      this.observers.delete(ws);
      return false;
    }
    ws.send(JSON.stringify({ t: 'lobby_state', room: state.room }));
    return true;
  }

  async broadcastState() {
    const entries = Array.from(this.observers.entries());
    for (let i = 0; i < entries.length; i++) {
      const [ws, meta] = entries[i];
      await this.sendState(ws, meta);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.searchParams.get('roomId')) {
      this.roomId = String(url.searchParams.get('roomId') || '').trim();
    }

    if (String(request.headers.get('Upgrade') || '').trim().toLowerCase() === 'websocket') {
      const actorId = String(url.searchParams.get('actorId') || '').trim();
      const actorName = String(url.searchParams.get('actorName') || '').trim();
      if (!actorId || !this.roomId) {
        return new Response('Missing lobby observer identity.', { status: 400 });
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ actorId, actorName });
      const meta = {
        actorId,
        displayName: actorName || actorId,
        pingLimitState: null,
        violationState: null
      };
      this.observers.set(server, meta);
      await this.sendState(server, meta);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === 'POST' && url.pathname === '/sync') {
      if (this.pendingSyncTimer) clearTimeout(this.pendingSyncTimer);
      this.pendingSyncTimer = setTimeout(() => {
        this.pendingSyncTimer = null;
        this.broadcastState();
      }, 100);
      return new Response(null, { status: 204 });
    }

    return new Response('Not Found', { status: 404 });
  }

  webSocketMessage(ws, message) {
    const meta = this.observers.get(ws) || ws.deserializeAttachment();
    if (!meta) return;
    const now = nowMs();
    const size = messageByteLength(message);
    if (size > HUB_MAX_MESSAGE_BYTES) {
      try { ws.close(1009, 'Lobby message too large'); } catch (_err) {}
      this.observers.delete(ws);
      return;
    }
    const pingCheck = consumeTokens(meta.pingLimitState, HUB_PING_RATE, now);
    meta.pingLimitState = pingCheck.state;
    if (!pingCheck.ok) {
      meta.violationState = violationState(meta, now);
      this.observers.set(ws, meta);
      if (meta.violationState.count >= HUB_RATE_LIMIT_CLOSE_AFTER) {
        try { ws.close(1008, 'Lobby rate limited'); } catch (_err) {}
        this.observers.delete(ws);
      }
      return;
    }
    const payload = safeJsonParse(decodeMessageText(message));
    if (payload && String(payload.t || '') === 'lobby_ping') {
      ws.send(JSON.stringify({ t: 'pong', serverTime: now }));
    }
    this.observers.set(ws, meta);
  }

  webSocketClose(ws) {
    this.observers.delete(ws);
  }
}

