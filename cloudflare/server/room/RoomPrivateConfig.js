import {
  MATCH_GAME_MODE_FFA,
  MATCH_GAME_MODE_TDM,
  normalizeMatchTeamIds
} from '../../../shared/match-rules.js';

function normalizeSyncMode(syncMode) {
  return String(syncMode || 'lobby_update') === 'hydrate' ? 'hydrate' : 'lobby_update';
}

function syncAssignedTeams(room, teams, fallbackTeamId) {
  for (const player of room.players.values()) {
    if (!player || player.fixtureType === 'sim_player') continue;
    player.teamId = String(teams.get(player.actorId || player.id) || fallbackTeamId || '');
  }
}

export function privateConfigEquals(currentConfig, nextConfig) {
  const current = currentConfig || {};
  const next = nextConfig || {};
  const currentTeams = current.teams instanceof Map ? current.teams : new Map();
  const nextTeams = next.teams instanceof Map ? next.teams : new Map();
  const currentTeamIds = Array.isArray(current.teamIds) ? current.teamIds : [];
  const nextTeamIds = Array.isArray(next.teamIds) ? next.teamIds : [];
  if (String(current.roomMode || '') !== String(next.roomMode || '')) return false;
  if (String(current.roomPhase || '') !== String(next.roomPhase || '')) return false;
  if (String(current.hostActorId || '') !== String(next.hostActorId || '')) return false;
  if (Number(current.teamCount || 2) !== Number(next.teamCount || 2)) return false;
  if (currentTeamIds.length !== nextTeamIds.length) return false;
  for (let i = 0; i < nextTeamIds.length; i++) {
    if (String(currentTeamIds[i] || '') !== String(nextTeamIds[i] || '')) return false;
  }
  if (currentTeams.size !== nextTeams.size) return false;
  for (const [actorId, teamId] of nextTeams.entries()) {
    if (String(currentTeams.get(actorId) || '') !== String(teamId || '')) return false;
  }
  return true;
}

export function normalizePrivateRoomConfig(config, deps = {}) {
  const teamOrder = Array.isArray(deps.teamOrder) && deps.teamOrder.length
    ? deps.teamOrder
    : ['alpha', 'bravo', 'charlie', 'delta'];
  const roomPhaseActive = String(deps.roomPhaseActive || 'active');
  const roomPhaseLobby = String(deps.roomPhaseLobby || 'lobby');
  const teamCount = Math.max(2, Math.min(teamOrder.length, Math.round(Number(config && config.teamCount || 2) || 2)));
  const teamIds = normalizeMatchTeamIds(teamOrder.slice(0, teamCount), teamOrder.slice(0, 2));
  const teams = new Map();
  const memberNames = new Map();
  const teamEntries = Array.isArray(config && config.teams) ? config.teams : [];

  for (let i = 0; i < teamEntries.length; i++) {
    const entry = teamEntries[i];
    if (!entry || !entry.actorId) continue;
    const actorId = String(entry.actorId);
    const normalizedTeamId = String(entry.teamId || '').trim().toLowerCase();
    teams.set(actorId, teamIds.indexOf(normalizedTeamId) >= 0 ? normalizedTeamId : teamIds[0]);
    memberNames.set(actorId, String(entry.displayName || actorId || 'PLAYER'));
  }

  return {
    roomMode: String(config && config.roomMode || '') === MATCH_GAME_MODE_TDM
      ? MATCH_GAME_MODE_TDM
      : MATCH_GAME_MODE_FFA,
    roomPhase: String(config && config.roomPhase || roomPhaseLobby) === roomPhaseActive
      ? roomPhaseActive
      : roomPhaseLobby,
    hostActorId: String(config && config.hostActorId || ''),
    teamCount,
    teamIds: teamIds.slice(),
    teams,
    memberNames
  };
}

export function applyPrivateRoomConfig(room, config, deps = {}) {
  if (!room || !config || !deps.isPrivateMatchRoom || !deps.isPrivateMatchRoom(room.roomName)) return false;
  const roomPhaseActive = String(deps.roomPhaseActive || 'active');
  const nextConfig = normalizePrivateRoomConfig(config, deps);
  const changed = !privateConfigEquals(room.privateRoomConfig, nextConfig);
  const syncMode = normalizeSyncMode(config.syncMode);
  room.privateRoomConfig = nextConfig;

  const canHydrateWithoutReset =
    syncMode === 'hydrate' &&
    room.matchState &&
    room.gameMode === nextConfig.roomMode &&
    room.matchState.started === (nextConfig.roomPhase === roomPhaseActive);

  if (!changed || canHydrateWithoutReset) {
    syncAssignedTeams(room, nextConfig.teams, nextConfig.teamIds[0]);
    return changed;
  }

  room.syncPrivateRoomMatchState();
  return changed;
}
