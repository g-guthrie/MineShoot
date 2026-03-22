const COMBAT_RATE_LIMITS = {
  fire: { ratePerSec: 20, burst: 40 },
  reload: { ratePerSec: 4, burst: 8 },
  throw: { ratePerSec: 4, burst: 8 }
};

function consumeCombatRateLimit(player, key, now) {
  if (!player || !key) return true;
  const limit = COMBAT_RATE_LIMITS[key];
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

export function handleRoomSocketMessage(room, ws, message, deps) {
  deps = deps || {};
  const safeJsonParse = deps.safeJsonParse;
  const nowMs = deps.nowMs;
  const handleClassCast = deps.handleClassCast;
  const isPrivateMatchRoom = deps.isPrivateMatchRoom;
  const roomPhaseActive = String(deps.roomPhaseActive || 'active');
  const msgC2s = deps.msgC2s || {};
  const msgS2c = deps.msgS2c || {};

  const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
  const msg = safeJsonParse ? safeJsonParse(text) : null;
  if (!msg || typeof msg !== 'object') return;

  const meta = room.clients.get(ws) || ws.deserializeAttachment();

  // Lobby observers only handle keepalive pings
  if (meta && meta.isLobbyObserver) {
    if (room.restoreLobbyObserver) room.restoreLobbyObserver(ws, meta);
    const parsed = safeJsonParse ? safeJsonParse(typeof message === 'string' ? message : new TextDecoder().decode(message)) : null;
    if (parsed && String(parsed.t || '') === (msgC2s.LOBBY_PING || 'lobby_ping')) {
      room.send(ws, { t: msgS2c.PONG || 'pong', serverTime: nowMs ? nowMs() : 0 });
    }
    return;
  }

  if (!meta || !meta.userId) return;
  if (room.activeSocketByUserId.get(meta.userId) !== ws) return;

  const player = room.players.get(meta.userId);
  if (!player) return;
  const now = nowMs ? nowMs() : Date.now();

  const type = String(msg.t || '');
  const privateLobbyLocked = isPrivateMatchRoom && isPrivateMatchRoom(room.roomName) &&
    String((room.privateRoomConfig && room.privateRoomConfig.roomPhase) || roomPhaseActive) !== roomPhaseActive;

  if (type === msgC2s.INPUT) {
    if (privateLobbyLocked) return;
    room.handleInput(player, msg);
    return;
  }
  if (type === msgC2s.FIRE) {
    if (privateLobbyLocked) return;
    if (!consumeCombatRateLimit(player, 'fire', now)) return;
    room.handleFire(player, msg);
    return;
  }
  if (type === msgC2s.RELOAD) {
    if (privateLobbyLocked) return;
    if (!consumeCombatRateLimit(player, 'reload', now)) return;
    room.handleReload(player, msg);
    return;
  }
  if (type === msgC2s.EQUIP_WEAPON) {
    room.handleEquipWeapon(player, msg);
    return;
  }
  if (type === msgC2s.WEAPON_LOADOUT) {
    room.handleWeaponLoadout(player, msg);
    return;
  }
  if (type === msgC2s.THROW) {
    if (privateLobbyLocked) return;
    if (!consumeCombatRateLimit(player, 'throw', now)) return;
    room.handleThrow(player, msg, ws);
    return;
  }
  if (type === msgC2s.CLASS_QUEUE) {
    room.handleClassQueue(player, msg, ws);
    return;
  }
  if (type === msgC2s.CLASS_CAST) {
    if (privateLobbyLocked) return;
    if (handleClassCast) handleClassCast(room, player, msg, ws);
    return;
  }
  if (type === msgC2s.PING) {
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
