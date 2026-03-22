export function emptyMatchState(gameMode, targetProgress) {
  return {
    gameMode: gameMode || 'ffa',
    started: false,
    ended: false,
    startedAt: 0,
    endedAt: 0,
    resetAt: 0,
    matchBaselinePlayerCount: 0,
    targetProgress: Number(targetProgress || 0),
    leaderProgress: 0,
    leaderId: '',
    winnerId: '',
    winnerTeam: ''
  };
}

export function serializeMatchState(matchState, gameMode, fallbackTargetProgress) {
  const match = matchState || emptyMatchState(gameMode, fallbackTargetProgress);
  return {
    gameMode: gameMode || 'ffa',
    started: !!match.started,
    ended: !!match.ended,
    startedAt: match.startedAt || 0,
    endedAt: match.endedAt || 0,
    resetAt: match.resetAt || 0,
    matchBaselinePlayerCount: match.matchBaselinePlayerCount || 0,
    targetProgress: Number(match.targetProgress || fallbackTargetProgress || 0),
    leaderProgress: Number(match.leaderProgress || 0),
    leaderId: match.leaderId || '',
    winnerId: match.winnerId || '',
    winnerTeam: ''
  };
}

export function updateLeaderProgress(runtime) {
  let leaderId = '';
  let leaderProgress = 0;
  for (const result of runtime.playerResults.values()) {
    if (!result) continue;
    const progress = Number(result.progressScore || 0);
    if (progress >= leaderProgress) {
      leaderProgress = progress;
      leaderId = result.id;
    }
  }
  runtime.matchState.leaderId = leaderId;
  runtime.matchState.leaderProgress = Number(leaderProgress.toFixed(3));
}

export function startPublicMatchIfReady(runtime, connectedUserIds, options = {}) {
  if (runtime.matchState.started || runtime.matchState.ended) return false;
  const connectedCount = runtime.connectedHumanCount(connectedUserIds);
  if (connectedCount < Number(options.startThreshold || 2)) return false;

  const now = runtime.nowMs();
  runtime.matchState.started = true;
  runtime.matchState.ended = false;
  runtime.matchState.startedAt = now;
  runtime.matchState.endedAt = 0;
  runtime.matchState.resetAt = 0;
  runtime.matchState.winnerId = '';
  runtime.matchState.leaderId = '';
  runtime.matchState.leaderProgress = 0;
  runtime.matchState.matchBaselinePlayerCount = connectedCount;
  runtime.matchState.targetProgress = Number(options.targetProgress || runtime.matchState.targetProgress || 0);

  for (const player of runtime.players.values()) {
    if (!player) continue;
    const result = runtime.ensurePlayerResult(player.id, player.username);
    if (!result) continue;
    result.progressScore = Math.max(0, Number(result.kills || 0));
    runtime.applyResultToPlayer(player, result);
  }
  updateLeaderProgress(runtime);
  return true;
}

export function maybeResetPublicMatch(runtime, connectedUserIds, options = {}) {
  if (!runtime.matchState || !runtime.matchState.ended) return false;
  if ((runtime.matchState.resetAt || 0) > runtime.nowMs()) return false;

  runtime.matchState = emptyMatchState(options.gameMode || 'ffa', options.targetProgress || 0);
  runtime.playerResults.clear();
  for (const player of runtime.players.values()) {
    if (!player) continue;
    player.progressScore = 0;
    player.kills = 0;
    player.deaths = 0;
    player.plannedSpawnPoint = null;
    runtime.ensurePlayerResult(player.id, player.username);
    runtime.syncPlayerResultFromEntity(player);
  }
  startPublicMatchIfReady(runtime, connectedUserIds, options);
  return true;
}

export function finishPublicMatch(runtime, winnerId, resetDelayMs) {
  if (!runtime.matchState || runtime.matchState.ended) return false;
  const now = runtime.nowMs();
  runtime.matchState.ended = true;
  runtime.matchState.endedAt = now;
  runtime.matchState.resetAt = now + Math.max(0, Number(resetDelayMs || 0));
  runtime.matchState.winnerId = winnerId || '';
  return true;
}

export function recordElimination(runtime, sourceId, targetId, options = {}) {
  if (!runtime.matchState || !runtime.matchState.started || runtime.matchState.ended) return;
  const source = runtime.getEntityById(sourceId);
  const target = runtime.getEntityById(targetId);
  if (!source || !target || source.id === target.id) return;

  const sourceResult = runtime.ensurePlayerResult(source.id, source.username);
  const targetResult = runtime.ensurePlayerResult(target.id, target.username);
  if (!sourceResult || !targetResult) return;

  sourceResult.kills = Math.max(0, Number(sourceResult.kills || 0)) + 1;
  targetResult.deaths = Math.max(0, Number(targetResult.deaths || 0)) + 1;
  sourceResult.progressScore = Math.max(0, Number(sourceResult.kills || 0));
  runtime.applyResultToPlayer(source, sourceResult);
  runtime.applyResultToPlayer(target, targetResult);
  updateLeaderProgress(runtime);

  if (Number(sourceResult.kills || 0) >= Number(runtime.matchState.targetProgress || options.targetProgress || 0)) {
    finishPublicMatch(runtime, source.id, options.resetDelayMs);
  }
}
