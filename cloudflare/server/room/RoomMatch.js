import { MATCH_TEAM_IDS, normalizeMatchTeamIds } from '../../../shared/match-rules.js';

function activeTeamIds(room, deps) {
  const fallback = [deps.teamAlpha || 'alpha', deps.teamBravo || 'bravo'];
  if (room && room.privateRoomConfig) {
    if (Array.isArray(room.privateRoomConfig.teamIds) && room.privateRoomConfig.teamIds.length) {
      return normalizeMatchTeamIds(room.privateRoomConfig.teamIds, fallback);
    }
    const teamCount = Math.max(2, Math.min(4, Math.round(Number(room.privateRoomConfig.teamCount || 2) || 2)));
    return normalizeMatchTeamIds(MATCH_TEAM_IDS.slice(0, teamCount), fallback);
  }
  if (room && room.matchState && Array.isArray(room.matchState.teamIds) && room.matchState.teamIds.length) {
    return normalizeMatchTeamIds(room.matchState.teamIds, fallback);
  }
  return fallback;
}

function buildTeamStatMap(teamIds, source) {
  const out = {};
  const ids = Array.isArray(teamIds) ? teamIds : [];
  for (let i = 0; i < ids.length; i++) {
    const teamId = ids[i];
    out[teamId] = Number(source && source[teamId] || 0);
  }
  return out;
}

function resetPlayerForRound(room, player) {
  const preservedMatchEntryShieldUntil = isPendingEntry(room, player)
    ? Math.max(0, Number(player.spawnShieldUntil || 0))
    : 0;
  if (!player || player.fixtureType === 'sim_player') return;
  player.teamId = '';
  player.progressScore = 0;
  player.kills = 0;
  player.deaths = 0;
  player.stocksRemaining = 3;
  player.maxStocks = 5;
  player.bonusLivesEarned = 0;
  player.extraLifeProgressPct = 0;
  player.eliminated = false;
  player.hp = player.hpMax;
  player.armor = player.armorMax;
  player.alive = true;
  player.respawnAt = 0;
  player.lastDamageAt = 0;
  player.plannedSpawnPoint = null;
  if (room.spawnEntityRandomly) room.spawnEntityRandomly(player);
  if (room.applySpawnShield) room.applySpawnShield(player);
  if (preservedMatchEntryShieldUntil > 0) {
    player.spawnShieldUntil = Math.max(Number(player.spawnShieldUntil || 0), preservedMatchEntryShieldUntil);
  }
}

function isPendingEntry(room, player) {
  return !!(
    room &&
    player &&
    typeof room.isEntityMatchEntryPending === 'function' &&
    room.isEntityMatchEntryPending(player)
  );
}

export function syncPrivateRoomMatchState(room, deps) {
  deps = deps || {};
  const isPrivateMatchRoom = deps.isPrivateMatchRoom;
  const emptyMatchState = deps.emptyMatchState;
  const nowMs = deps.nowMs;
  const gameModeFfa = deps.gameModeFfa || 'ffa';
  const gameModeTdm = deps.gameModeTdm || 'tdm';
  const teamAlpha = deps.teamAlpha || 'alpha';

  if (!isPrivateMatchRoom || !isPrivateMatchRoom(room.roomName)) return;
  const requestedMode = String((room.privateRoomConfig && room.privateRoomConfig.roomMode) || '');
  const nextMode = requestedMode === gameModeTdm
    ? gameModeTdm
    : gameModeFfa;
  room.gameMode = nextMode;
  room.matchState = emptyMatchState ? emptyMatchState(room.gameMode) : {};
  const teamIds = nextMode === gameModeTdm ? activeTeamIds(room, deps) : [];
  room.matchState.teamIds = teamIds.slice();
  if (nextMode === gameModeTdm) {
    room.matchState.teamProgress = buildTeamStatMap(teamIds, room.matchState.teamProgress);
    room.matchState.teamBaselineSize = buildTeamStatMap(teamIds, room.matchState.teamBaselineSize);
  }
  room.matchState.started = String((room.privateRoomConfig && room.privateRoomConfig.roomPhase) || '') === 'active';
  room.matchState.startedAt = room.matchState.started ? nowMs() : 0;
  room.matchState.aliveCount = 0;
  const teams = (room.privateRoomConfig && room.privateRoomConfig.teams) || new Map();
  for (const player of room.players.values()) {
    if (!player || player.fixtureType === 'sim_player') continue;
    player.teamId = room.gameMode === gameModeTdm
      ? String(teams.get(player.actorId || player.id) || teamIds[0] || teamAlpha)
      : '';
    player.progressScore = 0;
    if (room.gameMode === gameModeFfa) {
      resetPlayerForRound(room, player);
      if (!isPendingEntry(room, player)) {
        room.matchState.aliveCount += 1;
      }
    }
  }
  if (room.gameMode === gameModeTdm) {
    for (let i = 0; i < teamIds.length; i++) {
      const teamId = teamIds[i];
      room.matchState.teamBaselineSize[teamId] = 0;
    }
    for (const player of room.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      if (!Object.prototype.hasOwnProperty.call(room.matchState.teamBaselineSize, player.teamId)) continue;
      room.matchState.teamBaselineSize[player.teamId] += 1;
    }
    for (let i = 0; i < teamIds.length; i++) {
      const teamId = teamIds[i];
      room.matchState.teamBaselineSize[teamId] = Math.max(1, Number(room.matchState.teamBaselineSize[teamId] || 0));
    }
  }
}

export function resetPublicRoomToIdle(room, deps) {
  deps = deps || {};
  const emptyMatchState = deps.emptyMatchState;
  const isPrivateMatchRoom = deps.isPrivateMatchRoom;
  if (!room || !room.isPublicMatchRoom || !room.isPublicMatchRoom()) return false;
  if (isPrivateMatchRoom && isPrivateMatchRoom(room.roomName)) return false;

  room.matchState = emptyMatchState ? emptyMatchState(room.gameMode) : {};

  for (const player of room.players.values()) {
    if (!player || player.fixtureType === 'sim_player') continue;
    resetPlayerForRound(room, player);
  }
  return true;
}

export function assignPlayerToCurrentTeam(room, player, deps) {
  deps = deps || {};
  const teamIds = activeTeamIds(room, deps);
  if (!player) return '';
  const progress = (room.matchState && room.matchState.teamProgress) || {};
  const counts = {};
  for (let i = 0; i < teamIds.length; i++) counts[teamIds[i]] = 0;
  for (const other of room.players.values()) {
    if (!other || other.fixtureType === 'sim_player' || other.id === player.id) continue;
    if (Object.prototype.hasOwnProperty.call(counts, other.teamId)) counts[other.teamId] += 1;
  }
  let teamId = teamIds[0] || '';
  let bestCount = Number.MAX_SAFE_INTEGER;
  let bestProgress = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < teamIds.length; i++) {
    const nextTeamId = teamIds[i];
    const nextCount = Math.max(0, Number(counts[nextTeamId] || 0));
    const nextProgress = Number(progress[nextTeamId] || 0);
    if (
      nextCount < bestCount ||
      (nextCount === bestCount && nextProgress < bestProgress)
    ) {
      teamId = nextTeamId;
      bestCount = nextCount;
      bestProgress = nextProgress;
    }
  }
  player.teamId = teamId;
  return teamId;
}

export function applyJoinBaseline(room, player, deps) {
  deps = deps || {};
  const gameModeTdm = deps.gameModeTdm || 'tdm';
  if (!player || !room.isPublicMatchRoom()) return;
  if (room.gameMode === deps.gameModeFfa) {
    player.teamId = '';
    player.progressScore = 0;
    return;
  }
  if (room.gameMode === gameModeTdm) {
    const teamId = assignPlayerToCurrentTeam(room, player, deps);
    const teamProgress = (room.matchState && room.matchState.teamProgress)
      ? Number(room.matchState.teamProgress[teamId] || 0)
      : 0;
    player.progressScore = Number(teamProgress.toFixed(3));
  }
}

export function startPublicMatchIfReady(room, deps) {
  deps = deps || {};
  const emptyMatchState = deps.emptyMatchState;
  const nowMs = deps.nowMs;
  const gameModeFfa = deps.gameModeFfa || 'ffa';
  const gameModeTdm = deps.gameModeTdm || 'tdm';
  const publicRoomStartThresholdForMode = deps.publicRoomStartThresholdForMode;
  const teamIds = activeTeamIds(room, deps);

  if (!room.isPublicMatchRoom()) return false;
  if (!room.matchState) room.matchState = emptyMatchState ? emptyMatchState(room.gameMode) : {};
  if (room.matchState.started || room.matchState.ended) return false;
  const connectedCount = room.connectedHumanCount();
  let activeCount = 0;
  for (const player of room.players.values()) {
    if (!player || player.fixtureType === 'sim_player' || isPendingEntry(room, player)) continue;
    activeCount += 1;
  }
  const startThreshold = publicRoomStartThresholdForMode
    ? Number(publicRoomStartThresholdForMode(room.gameMode))
    : Number(deps.publicRoomStartThreshold || 2);
  if (connectedCount < startThreshold) return false;
  const now = nowMs();
  room.matchState.started = true;
  room.matchState.ended = false;
  room.matchState.startedAt = now;
  room.matchState.endedAt = 0;
  room.matchState.resetAt = 0;
  room.matchState.winnerId = '';
  room.matchState.winnerTeam = '';
  room.matchState.aliveCount = activeCount;
  room.matchState.startingStocks = 3;
  room.matchState.maxStocks = 5;
  room.matchState.maxBonusLives = 2;
  room.matchState.targetProgress = room.gameMode === gameModeTdm
    ? Number(deps.tdmTargetProgress || 10)
    : Number(deps.ffaTargetProgress || 10);
  room.matchState.matchBaselinePlayerCount = connectedCount;
  room.matchState.teamIds = room.gameMode === gameModeTdm ? teamIds.slice() : (room.matchState.teamIds || []);
  room.matchState.teamProgress = buildTeamStatMap(teamIds, null);
  room.matchState.teamBaselineSize = buildTeamStatMap(teamIds, null);

  if (room.gameMode === gameModeFfa) {
    for (const player of room.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      resetPlayerForRound(room, player);
    }
  } else if (room.gameMode === gameModeTdm) {
    for (const player of room.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      assignPlayerToCurrentTeam(room, player, deps);
    }
    const teamSizes = buildTeamStatMap(teamIds, null);
    for (const player of room.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      if (Object.prototype.hasOwnProperty.call(teamSizes, player.teamId)) {
        teamSizes[player.teamId] += 1;
      }
    }
    for (let i = 0; i < teamIds.length; i++) {
      const teamId = teamIds[i];
      room.matchState.teamBaselineSize[teamId] = Math.max(1, Number(teamSizes[teamId] || 0));
    }
    for (const player of room.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      player.progressScore = 0;
    }
  }
  return true;
}

export function maybeResetPublicMatch(room, deps) {
  deps = deps || {};
  const emptyMatchState = deps.emptyMatchState;
  const isPrivateMatchRoom = deps.isPrivateMatchRoom;
  const nowMs = deps.nowMs;
  const roomPhaseActive = String(deps.roomPhaseActive || 'active');

  if (!room.matchState || !room.matchState.ended) return false;
  if ((room.matchState.resetAt || 0) > nowMs()) return false;
  const shouldAutoStartPrivate = isPrivateMatchRoom && isPrivateMatchRoom(room.roomName) &&
    String((room.privateRoomConfig && room.privateRoomConfig.roomPhase) || '') === roomPhaseActive;
  room.matchState = emptyMatchState ? emptyMatchState(room.gameMode) : {};
  if (shouldAutoStartPrivate) {
    room.matchState.started = true;
    room.matchState.startedAt = nowMs();
  }
  for (const player of room.players.values()) {
    if (!player || player.fixtureType === 'sim_player') continue;
    resetPlayerForRound(room, player);
  }
  if (shouldAutoStartPrivate) {
    room.syncPrivateRoomMatchState();
  } else {
    room.startPublicMatchIfReady();
  }
  return true;
}

export function updateLeaderProgress(room, deps) {
  deps = deps || {};
  const gameModeFfa = deps.gameModeFfa || 'ffa';
  if (!room.matchState) return;

  if (room.gameMode === gameModeFfa) {
    let leaderId = '';
    let leaderProgress = 0;
    let aliveCount = 0;
    for (const player of room.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      if (isPendingEntry(room, player)) continue;
      const progress = Number(player.progressScore || 0);
      if (progress >= leaderProgress) {
        leaderProgress = progress;
        leaderId = player.id;
      }
      if (!player.eliminated) aliveCount += 1;
    }
    room.matchState.leaderId = leaderId;
    room.matchState.leaderProgress = Number(leaderProgress.toFixed(3));
    room.matchState.aliveCount = aliveCount;
    if (room.matchState.stockMode && room.matchState.started && !room.matchState.ended && aliveCount <= 1) {
      let winnerId = '';
      let winnerKills = 0;
      for (const player of room.players.values()) {
        if (!player || player.fixtureType === 'sim_player' || player.eliminated) continue;
        winnerId = player.id;
        winnerKills = Math.max(0, Number(player.kills || 0));
        break;
      }
      if (winnerId && winnerKills > 0) {
        room.finishPublicMatch(winnerId, '');
      }
    }
    return;
  }

  const teamIds = activeTeamIds(room, deps);
  let leadingProgress = 0;
  for (let i = 0; i < teamIds.length; i++) {
    leadingProgress = Math.max(leadingProgress, Number((room.matchState.teamProgress && room.matchState.teamProgress[teamIds[i]]) || 0));
  }
  room.matchState.leaderId = '';
  room.matchState.leaderProgress = Number(leadingProgress.toFixed(3));
}

export function finishPublicMatch(room, deps, winnerId, winnerTeam) {
  deps = deps || {};
  const gameModeFfa = deps.gameModeFfa || 'ffa';
  const gameModeTdm = deps.gameModeTdm || 'tdm';
  const nowMs = deps.nowMs;
  if (!room.matchState || room.matchState.ended) return false;
  if (room.gameMode !== gameModeFfa && room.gameMode !== gameModeTdm) return false;
  const now = nowMs();
  room.matchState.ended = true;
  room.matchState.endedAt = now;
  room.matchState.resetAt = now + Number(deps.matchResetDelayMs || 5000);
  room.matchState.winnerId = winnerId || '';
  room.matchState.winnerTeam = winnerTeam || '';
  return true;
}

export function recordElimination(room, deps, sourceId, targetId) {
  deps = deps || {};
  const nowMs = deps.nowMs;
  const gameModeFfa = deps.gameModeFfa || 'ffa';
  const gameModeTdm = deps.gameModeTdm || 'tdm';

  if (!room.matchState || !room.matchState.started || room.matchState.ended) return;
  if (room.gameMode !== gameModeFfa && room.gameMode !== gameModeTdm) return;
  const source = room.getEntityById(sourceId);
  const target = room.getEntityById(targetId);
  if (!source || !target || source.id === target.id) return;
  if (source.fixtureType === 'sim_player' || target.fixtureType === 'sim_player') return;
  source.kills = Math.max(0, Number(source.kills || 0)) + 1;
  target.deaths = Math.max(0, Number(target.deaths || 0)) + 1;

  if (room.gameMode === gameModeFfa) {
    source.progressScore = Math.max(0, Number(source.kills || 0));
    target.progressScore = Math.max(0, Number(target.kills || 0));
    room.updateLeaderProgress();
    if (!room.matchState.stockMode && Number(source.kills || 0) >= Number(room.matchState.targetProgress || deps.ffaTargetProgress || 10)) {
      room.finishPublicMatch(source.id, '');
    }
    return;
  }

  if (room.gameMode === gameModeTdm) {
    const teamId = source.teamId || room.assignPlayerToCurrentTeam(source);
    if (!teamId) return;
    const baseline = Math.max(1, Number((room.matchState.teamBaselineSize && room.matchState.teamBaselineSize[teamId]) || 1));
    const nextProgress = Number(((room.matchState.teamProgress && room.matchState.teamProgress[teamId]) || 0) + (1 / baseline));
    room.matchState.teamProgress[teamId] = Number(nextProgress.toFixed(3));
    for (const player of room.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      if (player.teamId === teamId) {
        player.progressScore = room.matchState.teamProgress[teamId];
      }
    }
    room.updateLeaderProgress();
    if (room.matchState.teamProgress[teamId] >= Number(room.matchState.targetProgress || deps.tdmTargetProgress || 10)) {
      room.finishPublicMatch('', teamId);
    }
  }
}
