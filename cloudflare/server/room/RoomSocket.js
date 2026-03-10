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
  if (!meta || !meta.userId) return;
  if (room.activeSocketByUserId.get(meta.userId) !== ws) return;

  const player = room.players.get(meta.userId);
  if (!player) return;

  const type = String(msg.t || '');
  const privateLobbyLocked = isPrivateMatchRoom && isPrivateMatchRoom(room.roomName) &&
    String((room.privateRoomConfig && room.privateRoomConfig.roomPhase) || roomPhaseActive) !== roomPhaseActive;

  if (type === msgC2s.JOIN_ROOM) {
    room.send(ws, room.buildWelcomePayload(player.id));
    return;
  }
  if (type === msgC2s.INPUT) {
    if (privateLobbyLocked) return;
    room.handleInput(player, msg);
    return;
  }
  if (type === msgC2s.FIRE) {
    if (privateLobbyLocked) return;
    room.handleFire(player, msg);
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
    room.send(ws, { t: msgS2c.PONG, clientTime: msg.clientTime || 0, serverTime: nowMs ? nowMs() : 0 });
  }
}

export function handleRoomSocketClose(room, ws, deps) {
  deps = deps || {};
  const findSocketForUserId = deps.findSocketForUserId;
  const nowMs = deps.nowMs;

  const meta = room.clients.get(ws) || ws.deserializeAttachment();
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
