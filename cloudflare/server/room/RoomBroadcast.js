const SHOT_EFFECT_MAX_TRACES = 32;

export function sendRoomMessage(ws, obj) {
  if (!ws || typeof ws.send !== 'function') return;
  try {
    ws.send(JSON.stringify(obj));
  } catch (_err) {
    // no-op
  }
}

function sendSerializedRoomMessage(ws, payload) {
  if (!ws || typeof ws.send !== 'function') return;
  try {
    ws.send(payload);
  } catch (_err) {
    // no-op
  }
}

export function broadcastRoomMessage(room, obj) {
  if (!room || !(room.clients instanceof Map)) return;
  const payload = JSON.stringify(obj);
  for (const [ws, meta] of room.clients.entries()) {
    if (!meta || !(room.activeSocketByUserId instanceof Map)) continue;
    if (room.activeSocketByUserId.get(meta.userId) !== ws) continue;
    sendSerializedRoomMessage(ws, payload);
  }
}

export function buildShotEffectPayload(effect, msgType) {
  if (!effect || !effect.origin || !Array.isArray(effect.traces) || effect.traces.length === 0) return null;
  return {
    t: msgType,
    sourceId: String(effect.sourceId || ''),
    weaponId: String(effect.weaponId || ''),
    shotToken: String(effect.shotToken || ''),
    origin: {
      x: Number(effect.origin.x || 0),
      y: Number(effect.origin.y || 0),
      z: Number(effect.origin.z || 0)
    },
    traces: effect.traces.slice(0, SHOT_EFFECT_MAX_TRACES).map((trace) => ({
      x: Number(trace && trace.x || 0),
      y: Number(trace && trace.y || 0),
      z: Number(trace && trace.z || 0),
      pelletIndex: Number.isFinite(Number(trace && trace.pelletIndex)) ? Number(trace.pelletIndex) : 0,
      hitType: trace && trace.hitType === 'head' ? 'head' : (trace && trace.hitType === 'body' ? 'body' : 'miss')
    }))
  };
}

export function broadcastRoomShotEffect(room, effect, msgType) {
  const payload = buildShotEffectPayload(effect, msgType);
  if (!payload) return;
  broadcastRoomMessage(room, payload);
}

export function broadcastRoomShotReject(room, player, rejection, msgType) {
  if (!room || !player || !player.id || !rejection) return;
  if (!(room.activeSocketByUserId instanceof Map)) return;
  const ws = room.activeSocketByUserId.get(player.id);
  if (!ws) return;
  sendRoomMessage(ws, {
    t: msgType,
    shotToken: String(rejection.shotToken || ''),
    weaponId: String(rejection.weaponId || ''),
    reason: String(rejection.reason || 'rejected'),
    serverTime: Math.max(0, Number(rejection.serverTime || 0))
  });
}
