export function emptyMatchState(gameMode, targetProgress) {
  return {
    gameMode: gameMode || 'ffa',
    stockMode: String(gameMode || 'ffa') === 'ffa',
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
    winnerTeam: '',
    aliveCount: 0,
    startingStocks: 3,
    maxStocks: 5,
    maxBonusLives: 2
  };
}

export function serializeMatchState(matchState, gameMode, fallbackTargetProgress) {
  const match = matchState || emptyMatchState(gameMode, fallbackTargetProgress);
  return {
    gameMode: gameMode || 'ffa',
    stockMode: !!match.stockMode,
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
    winnerTeam: '',
    aliveCount: Math.max(0, Number(match.aliveCount || 0)),
    startingStocks: Math.max(1, Number(match.startingStocks || 3)),
    maxStocks: Math.max(1, Number(match.maxStocks || 5)),
    maxBonusLives: Math.max(0, Number(match.maxBonusLives || 2))
  };
}

function resetPlayerForRound(runtime, player, options = {}) {
  if (!player) return;
  player.kills = 0;
  player.deaths = 0;
  player.progressScore = 0;
  player.stocksRemaining = Math.max(1, Number(options.startingStocks || 3));
  player.maxStocks = Math.max(player.stocksRemaining, Number(options.maxStocks || 5));
  player.bonusLivesEarned = 0;
  player.extraLifeProgressPct = 0;
  player.eliminated = false;
  player.hp = player.hpMax;
  player.armor = player.armorMax;
  player.alive = true;
  player.respawnAt = 0;
  player.lastDamageAt = 0;
  player.plannedSpawnPoint = null;
  if (typeof runtime.spawnEntityRandomly === 'function') {
    runtime.spawnEntityRandomly(player);
  }
  if (typeof runtime.applySpawnShield === 'function') {
    runtime.applySpawnShield(player);
  }
  if (typeof runtime.syncPlayerResultFromEntity === 'function') {
    runtime.syncPlayerResultFromEntity(player);
  }
}

export function updateLeaderProgress(runtime) {
  let leaderId = '';
  let leaderProgress = 0;
  let aliveCount = 0;
  for (const result of runtime.playerResults.values()) {
    if (!result) continue;
    const progress = Number(result.progressScore || 0);
    if (progress >= leaderProgress) {
      leaderProgress = progress;
      leaderId = result.id;
    }
    if (!result.eliminated) aliveCount += 1;
  }
  runtime.matchState.leaderId = leaderId;
  runtime.matchState.leaderProgress = Number(leaderProgress.toFixed(3));
  runtime.matchState.aliveCount = aliveCount;

  if (
    runtime.matchState &&
    runtime.matchState.stockMode &&
    runtime.matchState.started &&
    !runtime.matchState.ended &&
    aliveCount <= 1
  ) {
    let winnerId = '';
    for (const result of runtime.playerResults.values()) {
      if (!result || result.eliminated) continue;
      winnerId = result.id;
      break;
    }
    if (winnerId) {
      finishPublicMatch(runtime, winnerId, 5000);
    }
  }
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
  runtime.matchState.aliveCount = connectedCount;
  runtime.matchState.matchBaselinePlayerCount = connectedCount;
  runtime.matchState.targetProgress = Number(options.targetProgress || runtime.matchState.targetProgress || 0);
  runtime.matchState.startingStocks = 3;
  runtime.matchState.maxStocks = 5;
  runtime.matchState.maxBonusLives = 2;

  for (const player of runtime.players.values()) {
    if (!player) continue;
    const result = runtime.ensurePlayerResult(player.id, player.username);
    if (!result) continue;
    result.kills = 0;
    result.deaths = 0;
    result.progressScore = 0;
    result.stocksRemaining = 3;
    result.maxStocks = 5;
    result.bonusLivesEarned = 0;
    result.extraLifeProgressPct = 0;
    result.eliminated = false;
    runtime.applyResultToPlayer(player, result);
    resetPlayerForRound(runtime, player, {
      startingStocks: 3,
      maxStocks: 5
    });
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
    resetPlayerForRound(runtime, player, {
      startingStocks: 3,
      maxStocks: 5
    });
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
  targetResult.stocksRemaining = Math.max(0, Number(target.stocksRemaining || 0));
  targetResult.maxStocks = Math.max(targetResult.stocksRemaining, Number(target.maxStocks || 0));
  targetResult.bonusLivesEarned = Math.max(0, Number(target.bonusLivesEarned || 0));
  targetResult.extraLifeProgressPct = Math.max(0, Math.min(100, Number(target.extraLifeProgressPct || 0)));
  targetResult.eliminated = !!target.eliminated;
  sourceResult.stocksRemaining = Math.max(0, Number(source.stocksRemaining || 0));
  sourceResult.maxStocks = Math.max(sourceResult.stocksRemaining, Number(source.maxStocks || 0));
  sourceResult.bonusLivesEarned = Math.max(0, Number(source.bonusLivesEarned || 0));
  sourceResult.extraLifeProgressPct = Math.max(0, Math.min(100, Number(source.extraLifeProgressPct || 0)));
  sourceResult.eliminated = !!source.eliminated;
  runtime.applyResultToPlayer(source, sourceResult);
  runtime.applyResultToPlayer(target, targetResult);
  updateLeaderProgress(runtime);

  if (
    !runtime.matchState.stockMode &&
    Number(sourceResult.kills || 0) >= Number(runtime.matchState.targetProgress || options.targetProgress || 0)
  ) {
    finishPublicMatch(runtime, source.id, options.resetDelayMs);
  }
}
