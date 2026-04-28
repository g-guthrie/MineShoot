export function buildLobbyBroadcastPayload(room, msgType) {
  const config = room && room.privateRoomConfig || {};
  const teams = config.teams instanceof Map ? config.teams : new Map();
  const memberNames = config.memberNames instanceof Map ? config.memberNames : new Map();
  const teamIds = Array.isArray(config.teamIds) ? config.teamIds : ['alpha', 'bravo'];
  const hostActorId = String(config.hostActorId || '');
  const teamBuckets = {};
  for (let i = 0; i < teamIds.length; i++) teamBuckets[teamIds[i]] = [];
  const allMembers = [];
  for (const [actorId, teamId] of teams.entries()) {
    const entry = {
      id: actorId,
      displayName: memberNames.get(actorId) || actorId || 'PLAYER',
      teamId,
      isHost: actorId === hostActorId
    };
    allMembers.push(entry);
    if (teamBuckets[teamId]) teamBuckets[teamId].push(entry);
  }
  return {
    t: msgType,
    room: {
      roomId: room && room.roomName,
      roomCode: String(room && room.roomName || '').replace(/^private-/, '').toUpperCase(),
      roomMode: String(config.roomMode || 'ffa'),
      roomPhase: String(config.roomPhase || 'lobby'),
      teamCount: Number(config.teamCount || 2),
      teamIds,
      hostActorId,
      inviteLocked: false,
      memberCount: allMembers.length,
      teams: teamBuckets,
      members: allMembers
    }
  };
}

export function broadcastLobbyState(room, msgType) {
  if (!room || !room.lobbyObservers || room.lobbyObservers.size === 0) return;
  const payload = JSON.stringify(buildLobbyBroadcastPayload(room, msgType));
  for (const [ws] of room.lobbyObservers.entries()) {
    try {
      ws.send(payload);
    } catch (_err) {
      // no-op
    }
  }
}

export function restoreLobbyObserver(room, ws, meta) {
  if (!room) return;
  if (!room.lobbyObservers) room.lobbyObservers = new Map();
  if (!room.lobbyObservers.has(ws)) {
    room.lobbyObservers.set(ws, { actorId: String(meta && meta.actorId || '') });
  }
}
