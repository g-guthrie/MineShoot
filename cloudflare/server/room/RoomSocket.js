const MESSAGE_RATE_LIMITS = {
  enter_match: { ratePerSec: 1, burst: 3 },
  // Normal movement now ships at a 60 Hz floor and may spike above that
  // from immediate sends on state changes, so input throttling needs
  // meaningful headroom above the base cadence.
  input: { ratePerSec: 120, burst: 240 },
  roll: { ratePerSec: 8, burst: 16 },
  fire: { ratePerSec: 20, burst: 40 },
  reload: { ratePerSec: 4, burst: 8 },
  throw: { ratePerSec: 4, burst: 8 },
  equip_weapon: { ratePerSec: 8, burst: 16 },
  weapon_loadout: { ratePerSec: 2, burst: 4 },
  ping: { ratePerSec: 2, burst: 6 },
  lobby_ping: { ratePerSec: 2, burst: 6 }
};
const MAX_GAMEPLAY_MESSAGE_BYTES = 8192;
const MAX_LOBBY_MESSAGE_BYTES = 1024;
const RATE_LIMIT_CLOSE_AFTER = 3;
const MAX_INPUT_BATCH_SAMPLES = 4;
// App-level close code for sockets that survived Durable Object hibernation
// while the in-memory room state did not. Clients treat it as a signal to
// rejoin through the connect path instead of retrying on a dead session.
export const ROOM_STATE_LOST_CLOSE_CODE = 4801;
const ROOM_STATE_LOST_CLOSE_REASON = 'room-state-lost';

function consumeCombatRateLimit(player, key, now) {
  if (!player || !key) return true;
  const limit = MESSAGE_RATE_LIMITS[key];
  if (!limit) return true;
  if (!player.messageRateLimits || typeof player.messageRateLimits !== 'object') {
    player.messageRateLimits = {};
  }
  const state = player.messageRateLimits[key] || {
    tokens: Number(limit.burst || 0),
    updatedAt: Number(now || 0)
  };
  const elapsedMs = Math.max(0, Number(now || 0) - Number(state.updatedAt || 0));
  const refill = (elapsedMs / 1000) * Math.max(0, Number(limit.ratePerSec || 0));
  state.tokens = Math.min(
    Math.max(0, Number(limit.burst || 0)),
    Math.max(0, Number(state.tokens || 0)) + refill
  );
  state.updatedAt = Number(now || 0);
  if (state.tokens < 1) {
    player.messageRateLimits[key] = state;
    return false;
  }
  state.tokens -= 1;
  player.messageRateLimits[key] = state;
  return true;
}

function decodeMessageText(message) {
  return typeof message === 'string' ? message : new TextDecoder().decode(message);
}

function messageByteLength(message) {
  if (typeof message === 'string') return new TextEncoder().encode(message).length;
  if (message && typeof message.byteLength === 'number') return Number(message.byteLength || 0);
  return 0;
}

function registerRateLimitViolation(target, now) {
  if (!target || typeof target !== 'object') return 0;
  const state = target.rateLimitViolationState || {
    count: 0,
    updatedAt: Number(now || 0)
  };
  if ((Number(now || 0) - Number(state.updatedAt || 0)) > 10000) {
    state.count = 0;
  }
  state.updatedAt = Number(now || 0);
  state.count += 1;
  target.rateLimitViolationState = state;
  return state.count;
}

function closeSocket(ws, code, reason) {
  if (!ws || typeof ws.close !== 'function') return;
  try {
    ws.close(code, reason);
  } catch (_err) {
    // no-op
  }
}

function normalizeSnapshotAckSeq(value) {
  const seq = Math.max(0, Math.floor(Number(value || 0)));
  return Number.isFinite(seq) ? seq : 0;
}

function normalizeLinkMetric(value, maxValue) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(Number(maxValue || 0) || parsed, parsed);
}

function updateConnectionQualityState(meta, player, msg, now) {
  if (!meta || !msg || typeof msg !== 'object') return;
  const snapshotAckSeq = normalizeSnapshotAckSeq(msg.snapshotAckSeq);
  if (snapshotAckSeq > 0) {
    meta.snapshotAckSeq = Math.max(normalizeSnapshotAckSeq(meta.snapshotAckSeq), snapshotAckSeq);
  }
  if (Object.prototype.hasOwnProperty.call(msg, 'linkRttMs')) {
    meta.linkRttMs = normalizeLinkMetric(msg.linkRttMs, 4000);
  }
  if (Object.prototype.hasOwnProperty.call(msg, 'linkJitterMs')) {
    meta.linkJitterMs = normalizeLinkMetric(msg.linkJitterMs, 2000);
  }
  meta.lastConnectionQualityAt = Number(now || 0);
  if (player && typeof player === 'object') {
    player.linkRttMs = Math.max(0, Number(meta.linkRttMs || 0));
    player.linkJitterMs = Math.max(0, Number(meta.linkJitterMs || 0));
    player.lastSnapshotAckSeq = Math.max(0, Number(meta.snapshotAckSeq || 0));
  }
}

function inputBatchLength(msg) {
  if (Array.isArray(msg && msg.inputs)) return msg.inputs.length;
  if (msg && (Object.prototype.hasOwnProperty.call(msg, 'seq') || Object.prototype.hasOwnProperty.call(msg, 'inputMode'))) {
    return 1;
  }
  return 0;
}

export function handleRoomSocketMessage(room, ws, message, deps) {
  deps = deps || {};
  const safeJsonParse = deps.safeJsonParse;
  const nowMs = deps.nowMs;
  const isPrivateMatchRoom = deps.isPrivateMatchRoom;
  const roomPhaseActive = String(deps.roomPhaseActive || 'active');
  const msgC2s = deps.msgC2s || {};
  const msgS2c = deps.msgS2c || {};

  const meta = room.clients.get(ws) || ws.deserializeAttachment();
  const rawSize = messageByteLength(message);
  const maxBytes = meta && meta.isLobbyObserver ? MAX_LOBBY_MESSAGE_BYTES : MAX_GAMEPLAY_MESSAGE_BYTES;
  if (rawSize > maxBytes) {
    closeSocket(ws, 1009, meta && meta.isLobbyObserver ? 'Lobby message too large' : 'Message too large');
    if (meta && meta.isLobbyObserver && room.lobbyObservers) room.lobbyObservers.delete(ws);
    return;
  }
  const text = decodeMessageText(message);
  const msg = safeJsonParse ? safeJsonParse(text) : null;
  if (!msg || typeof msg !== 'object') return;

  // Lobby observers only handle keepalive pings
  if (meta && meta.isLobbyObserver) {
    if (room.restoreLobbyObserver) room.restoreLobbyObserver(ws, meta);
    const parsed = msg;
    if (parsed && String(parsed.t || '') === (msgC2s.LOBBY_PING || 'lobby_ping')) {
      if (!consumeCombatRateLimit(meta, 'lobby_ping', nowMs ? nowMs() : Date.now())) {
        const violations = registerRateLimitViolation(meta, nowMs ? nowMs() : Date.now());
        if (violations >= RATE_LIMIT_CLOSE_AFTER) {
          closeSocket(ws, 1008, 'Lobby rate limited');
          if (room.lobbyObservers) room.lobbyObservers.delete(ws);
        }
        return;
      }
      room.send(ws, { t: msgS2c.PONG || 'pong', serverTime: nowMs ? nowMs() : 0 });
    }
    return;
  }

  if (!meta || !meta.userId) return;

  // Hibernating sockets (and their serialized attachments) survive Durable
  // Object eviction, but the in-memory room maps do not. A socket whose user
  // has no player or active-socket entry means the room state was lost —
  // close it with a distinct app-level code so the client's reconnect path
  // rejoins cleanly instead of the message being silently dropped forever.
  const activeSocket = room.activeSocketByUserId.get(meta.userId);
  const player = room.players.get(meta.userId);
  if (!player || !activeSocket) {
    closeSocket(ws, ROOM_STATE_LOST_CLOSE_CODE, ROOM_STATE_LOST_CLOSE_REASON);
    return;
  }
  if (activeSocket !== ws) return;

  // The tick loop is in-memory state too: restart it on the message entry
  // point so a room that woke from hibernation never stays frozen.
  if (typeof room.ensureTick === 'function') room.ensureTick();
  const now = nowMs ? nowMs() : Date.now();

  const type = String(msg.t || '');
  const privateLobbyLocked = isPrivateMatchRoom && isPrivateMatchRoom(room.roomName) &&
    String((room.privateRoomConfig && room.privateRoomConfig.roomPhase) || roomPhaseActive) !== roomPhaseActive;

  function consumeOrClose(key) {
    if (consumeCombatRateLimit(player, key, now)) return true;
    const violations = registerRateLimitViolation(meta, now);
    room.clients.set(ws, meta);
    if (violations >= RATE_LIMIT_CLOSE_AFTER) {
      closeSocket(ws, 1008, 'Rate limited');
    }
    return false;
  }

  if (type === msgC2s.INPUT) {
    if (privateLobbyLocked) return;
    const batchLength = inputBatchLength(msg);
    if (batchLength > MAX_INPUT_BATCH_SAMPLES) {
      closeSocket(ws, 1008, 'Invalid input batch');
      return;
    }
    if (!consumeOrClose('input')) return;
    updateConnectionQualityState(meta, player, msg, now);
    room.clients.set(ws, meta);
    room.handleInput(player, msg);
    return;
  }
  if (type === msgC2s.ENTER_MATCH) {
    if (privateLobbyLocked) return;
    if (!consumeOrClose('enter_match')) return;
    room.handleEnterMatch(player, msg);
    return;
  }
  if (type === msgC2s.ROLL) {
    if (privateLobbyLocked) return;
    if (!consumeOrClose('roll')) return;
    room.handleRoll(player, msg);
    return;
  }
  if (type === msgC2s.FIRE) {
    if (privateLobbyLocked) return;
    if (!consumeOrClose('fire')) return;
    room.handleFire(player, msg);
    return;
  }
  if (type === msgC2s.RELOAD) {
    if (privateLobbyLocked) return;
    if (!consumeOrClose('reload')) return;
    room.handleReload(player, msg);
    return;
  }
  if (type === msgC2s.EQUIP_WEAPON) {
    if (!consumeOrClose('equip_weapon')) return;
    room.handleEquipWeapon(player, msg);
    return;
  }
  if (type === msgC2s.WEAPON_LOADOUT) {
    if (!consumeOrClose('weapon_loadout')) return;
    room.handleWeaponLoadout(player, msg);
    return;
  }
  if (type === msgC2s.THROW) {
    if (privateLobbyLocked) return;
    if (!consumeOrClose('throw')) return;
    room.handleThrow(player, msg, ws);
    return;
  }
  if (type === msgC2s.PING) {
    if (!consumeOrClose('ping')) return;
    updateConnectionQualityState(meta, player, msg, now);
    room.clients.set(ws, meta);
    room.send(ws, { t: msgS2c.PONG, clientTime: msg.clientTime || 0, serverTime: now });
  }
}

export function handleRoomSocketClose(room, ws, deps) {
  deps = deps || {};
  const findSocketForUserId = deps.findSocketForUserId;
  const nowMs = deps.nowMs;

  const meta = room.clients.get(ws) || ws.deserializeAttachment();

  // Lobby observer cleanup — no player entity involved
  if (meta && meta.isLobbyObserver) {
    if (room.lobbyObservers) room.lobbyObservers.delete(ws);
    return;
  }

  room.clients.delete(ws);

  // Restart the tick loop in case this close is the first event after a
  // hibernation wake; stopTickIfEmpty below clears it again when nothing is
  // left to simulate.
  if (typeof room.ensureTick === 'function') room.ensureTick();

  if (meta && meta.userId && room.activeSocketByUserId.get(meta.userId) === ws) {
    const replacement = findSocketForUserId ? findSocketForUserId(room.clients, meta.userId, ws) : null;
    if (replacement) {
      room.activeSocketByUserId.set(meta.userId, replacement);
      const player = room.players.get(meta.userId);
      if (player) player.disconnectedAt = 0;
    } else {
      room.activeSocketByUserId.delete(meta.userId);
      const player = room.players.get(meta.userId);
      if (player) {
        player.disconnectedAt = nowMs ? nowMs() : 0;
      }
    }
  }

  room.stopTickIfEmpty();
}
