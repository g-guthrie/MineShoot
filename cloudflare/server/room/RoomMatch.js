export function syncPrivateRoomMatchState(room, deps) {
  deps = deps || {};
  const isPrivateMatchRoom = deps.isPrivateMatchRoom;
  const emptyMatchState = deps.emptyMatchState;
  const nowMs = deps.nowMs;
  const gameModeFfa = deps.gameModeFfa || 'ffa';
  const gameModeTdm = deps.gameModeTdm || 'tdm';
  const gameModeLms = deps.gameModeLms || 'lms';
  const teamAlpha = deps.teamAlpha || 'alpha';

  if (!isPrivateMatchRoom || !isPrivateMatchRoom(room.roomName)) return;
  const requestedMode = String((room.privateRoomConfig && room.privateRoomConfig.roomMode) || '');
  const nextMode = requestedMode === gameModeTdm
    ? gameModeTdm
    : (requestedMode === gameModeLms ? gameModeLms : gameModeFfa);
  room.gameMode = nextMode;
  room.matchState = emptyMatchState ? emptyMatchState(room.gameMode) : {};
  room.matchState.started = String((room.privateRoomConfig && room.privateRoomConfig.roomPhase) || '') === 'active';
  room.matchState.startedAt = room.matchState.started ? nowMs() : 0;
  const teams = (room.privateRoomConfig && room.privateRoomConfig.teams) || new Map();
  for (const player of room.players.values()) {
    if (!player || player.fixtureType === 'sim_player') continue;
    player.teamId = room.gameMode === gameModeTdm
      ? String(teams.get(player.actorId || player.id) || teamAlpha)
      : '';
    player.progressScore = 0;
  }
}

export function assignPlayerToCurrentTeam(room, player, deps) {
  deps = deps || {};
  const teamAlpha = deps.teamAlpha || 'alpha';
  const teamBravo = deps.teamBravo || 'bravo';
  if (!player) return '';
  const progress = (room.matchState && room.matchState.teamProgress) || {};
  let alphaCount = 0;
  let bravoCount = 0;
  for (const other of room.players.values()) {
    if (!other || other.fixtureType === 'sim_player' || other.id === player.id) continue;
    if (other.teamId === teamAlpha) alphaCount++;
    else if (other.teamId === teamBravo) bravoCount++;
  }
  let teamId = teamAlpha;
  if (alphaCount > bravoCount) {
    teamId = teamBravo;
  } else if (alphaCount === bravoCount) {
    const alphaProgress = Number(progress[teamAlpha] || 0);
    const bravoProgress = Number(progress[teamBravo] || 0);
    teamId = alphaProgress <= bravoProgress ? teamAlpha : teamBravo;
  }
  player.teamId = teamId;
  return teamId;
}

export function applyJoinBaseline(room, player, deps) {
  deps = deps || {};
  const gameModeLms = deps.gameModeLms || 'lms';
  const gameModeTdm = deps.gameModeTdm || 'tdm';
  if (!player || !room.isPublicMatchRoom()) return;
  if (room.gameMode === deps.gameModeFfa) {
    player.teamId = '';
    player.progressScore = 0;
    return;
  }
  if (room.gameMode === gameModeLms) {
    player.teamId = '';
    player.progressScore = Number(player.lmsLives || 0);
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
  const gameModeLms = deps.gameModeLms || 'lms';
  const teamAlpha = deps.teamAlpha || 'alpha';
  const teamBravo = deps.teamBravo || 'bravo';

  if (!room.isPublicMatchRoom()) return false;
  if (!room.matchState) room.matchState = emptyMatchState ? emptyMatchState(room.gameMode) : {};
  if (room.matchState.started || room.matchState.ended) return false;
  const connectedCount = room.connectedHumanCount();
  if (connectedCount < Number(deps.publicRoomStartThreshold || 2)) return false;
  const now = nowMs();
  room.matchState.started = true;
  room.matchState.ended = false;
  room.matchState.startedAt = now;
  room.matchState.endedAt = 0;
  room.matchState.resetAt = 0;
  room.matchState.winnerId = '';
  room.matchState.winnerTeam = '';
  room.matchState.targetProgress = room.gameMode === gameModeTdm
    ? Number(deps.tdmTargetProgress || 10)
    : (room.gameMode === gameModeFfa ? Number(deps.ffaTargetProgress || 10) : 0);
  room.matchState.matchBaselinePlayerCount = connectedCount;
  room.matchState.teamProgress = {
    [teamAlpha]: 0,
    [teamBravo]: 0
  };
  room.matchState.teamBaselineSize = {
    [teamAlpha]: 0,
    [teamBravo]: 0
  };

  if (room.gameMode === gameModeFfa) {
    for (const player of room.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      player.teamId = '';
      player.progressScore = Math.max(0, Number(player.kills || 0));
    }
  } else if (room.gameMode === gameModeLms) {
    room.initializeLmsMatchState(now);
  } else if (room.gameMode === gameModeTdm) {
    for (const player of room.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      assignPlayerToCurrentTeam(room, player, deps);
    }
    let alphaSize = 0;
    let bravoSize = 0;
    for (const player of room.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      if (player.teamId === teamAlpha) alphaSize++;
      else if (player.teamId === teamBravo) bravoSize++;
    }
    room.matchState.teamBaselineSize[teamAlpha] = Math.max(1, alphaSize);
    room.matchState.teamBaselineSize[teamBravo] = Math.max(1, bravoSize);
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
  const gameModeLms = deps.gameModeLms || 'lms';

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
    player.progressScore = 0;
    player.teamId = '';
    player.kills = 0;
    player.deaths = 0;
    player.plannedSpawnPoint = null;
    player.lmsLives = 0;
    player.lmsCharge = 0;
    player.lmsBankState = null;
  }
  if (shouldAutoStartPrivate) {
    room.syncPrivateRoomMatchState();
    if (room.gameMode === gameModeLms) {
      room.initializeLmsMatchState(room.matchState.startedAt || nowMs());
    }
  } else {
    room.startPublicMatchIfReady();
  }
  return true;
}

export function updateLeaderProgress(room, deps) {
  deps = deps || {};
  const gameModeFfa = deps.gameModeFfa || 'ffa';
  const gameModeLms = deps.gameModeLms || 'lms';
  const teamAlpha = deps.teamAlpha || 'alpha';
  const teamBravo = deps.teamBravo || 'bravo';
  if (!room.matchState) return;

  if (room.gameMode === gameModeFfa) {
    let leaderId = '';
    let leaderProgress = 0;
    for (const player of room.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      const progress = Number(player.progressScore || 0);
      if (progress >= leaderProgress) {
        leaderProgress = progress;
        leaderId = player.id;
      }
    }
    room.matchState.leaderId = leaderId;
    room.matchState.leaderProgress = Number(leaderProgress.toFixed(3));
    return;
  }

  if (room.gameMode === gameModeLms) {
    let leaderId = '';
    let leaderProgress = 0;
    const entities = room.lmsMatchEntities();
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const lives = Math.max(0, Number(entity.lmsLives || 0));
      const charge = Math.max(0, Number(entity.lmsCharge || 0));
      const progress = lives + (charge * 0.01);
      if (progress >= leaderProgress) {
        leaderProgress = progress;
        leaderId = entity.id;
      }
    }
    room.syncLmsPublicState();
    room.matchState.leaderId = leaderId;
    room.matchState.leaderProgress = Number(leaderProgress.toFixed(2));
    return;
  }

  const alpha = Number((room.matchState.teamProgress && room.matchState.teamProgress[teamAlpha]) || 0);
  const bravo = Number((room.matchState.teamProgress && room.matchState.teamProgress[teamBravo]) || 0);
  room.matchState.leaderId = '';
  room.matchState.leaderProgress = Number(Math.max(alpha, bravo).toFixed(3));
}

export function finishPublicMatch(room, deps, winnerId, winnerTeam) {
  deps = deps || {};
  const gameModeFfa = deps.gameModeFfa || 'ffa';
  const gameModeTdm = deps.gameModeTdm || 'tdm';
  const gameModeLms = deps.gameModeLms || 'lms';
  const nowMs = deps.nowMs;
  if (!room.matchState || room.matchState.ended) return false;
  if (room.gameMode !== gameModeFfa && room.gameMode !== gameModeTdm && room.gameMode !== gameModeLms) return false;
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
  const lmsRules = deps.lmsRules || {};
  const gameModeFfa = deps.gameModeFfa || 'ffa';
  const gameModeTdm = deps.gameModeTdm || 'tdm';
  const gameModeLms = deps.gameModeLms || 'lms';

  if (!room.matchState || !room.matchState.started || room.matchState.ended) return;
  if (room.gameMode !== gameModeFfa && room.gameMode !== gameModeTdm && room.gameMode !== gameModeLms) return;
  const source = room.getEntityById(sourceId);
  const target = room.getEntityById(targetId);
  if (!source || !target || source.id === target.id) return;
  if (source.fixtureType === 'sim_player' || target.fixtureType === 'sim_player') return;
  source.kills = Math.max(0, Number(source.kills || 0)) + 1;
  target.deaths = Math.max(0, Number(target.deaths || 0)) + 1;

  if (room.gameMode === gameModeFfa) {
    source.progressScore = Math.max(0, Number(source.kills || 0));
    room.updateLeaderProgress();
    if (Number(source.kills || 0) >= Number(room.matchState.targetProgress || deps.ffaTargetProgress || 10)) {
      room.finishPublicMatch(source.id, '');
    }
    return;
  }

  if (room.gameMode === gameModeLms) {
    target.lmsLives = Math.max(0, Number(target.lmsLives || lmsRules.startingLives) - 1);
    target.lmsCharge = 0;
    target.lmsBankState = null;
    target.progressScore = target.lmsLives;
    source.lmsCharge = Math.min(
      lmsRules.chargePerExtraLife,
      Math.max(0, Number(source.lmsCharge || 0)) + lmsRules.chargePerElimination
    );
    source.progressScore = Math.max(0, Number(source.lmsLives || 0));
    if (target.lmsLives <= 0) {
      target.respawnAt = 0;
      target.outOfRound = true;
    } else {
      target.respawnAt = nowMs() + lmsRules.respawnDelayMs;
      target.outOfRound = false;
    }
    room.syncLmsPublicState();
    room.updateLeaderProgress();
    if (room.lmsRemainingPlayers() <= 1) {
      room.finishPublicMatch(room.lmsWinnerId(), '');
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
