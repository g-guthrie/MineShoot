export function emptyPlayerResult(userId = '', username = '') {
  return {
    id: String(userId || ''),
    username: String(username || 'player'),
    kills: 0,
    deaths: 0,
    progressScore: 0,
    stocksRemaining: 3,
    maxStocks: 5,
    bonusLivesEarned: 0,
    extraLifeProgressPct: 0,
    eliminated: false
  };
}

export function getPlayerResult(runtime, userId) {
  const id = String(userId || '');
  if (!id) return null;
  return runtime.playerResults.get(id) || null;
}

export function ensurePlayerResult(runtime, userId, username) {
  const id = String(userId || '');
  if (!id) return null;
  if (!runtime.playerResults.has(id)) {
    runtime.playerResults.set(id, emptyPlayerResult(id, username));
  }
  const result = runtime.playerResults.get(id);
  if (username) result.username = String(username);
  return result;
}

export function applyResultToPlayer(_runtime, player, result) {
  if (!player || !result) return;
  player.username = result.username || player.username;
  player.kills = Math.max(0, Number(result.kills || 0));
  player.deaths = Math.max(0, Number(result.deaths || 0));
  player.progressScore = Math.max(0, Number(result.progressScore || 0));
  player.stocksRemaining = Math.max(0, Number(result.stocksRemaining != null ? result.stocksRemaining : player.stocksRemaining || 0));
  player.maxStocks = Math.max(player.stocksRemaining, Number(result.maxStocks != null ? result.maxStocks : player.maxStocks || 0));
  player.bonusLivesEarned = Math.max(0, Number(result.bonusLivesEarned || 0));
  player.extraLifeProgressPct = Math.max(0, Math.min(100, Number(result.extraLifeProgressPct || 0)));
  player.eliminated = !!result.eliminated;
}

export function syncPlayerResultFromEntity(runtime, player) {
  if (!player || !player.id) return null;
  const result = ensurePlayerResult(runtime, player.id, player.username);
  if (!result) return null;
  result.username = player.username || result.username;
  result.kills = Math.max(0, Number(player.kills || 0));
  result.deaths = Math.max(0, Number(player.deaths || 0));
  result.progressScore = Math.max(0, Number(player.progressScore || result.kills || 0));
  result.stocksRemaining = Math.max(0, Number(player.stocksRemaining || 0));
  result.maxStocks = Math.max(result.stocksRemaining, Number(player.maxStocks || 0));
  result.bonusLivesEarned = Math.max(0, Number(player.bonusLivesEarned || 0));
  result.extraLifeProgressPct = Math.max(0, Math.min(100, Number(player.extraLifeProgressPct || 0)));
  result.eliminated = !!player.eliminated;
  return result;
}

export function connectedHumanIds(runtime, connectedUserIds) {
  const out = [];
  const source = Array.isArray(connectedUserIds) ? connectedUserIds : [];
  for (let i = 0; i < source.length; i++) {
    const player = runtime.players.get(source[i]);
    if (!player) continue;
    out.push(player.id);
  }
  return out;
}

export function humanPlayerCount(runtime) {
  return runtime.players.size;
}

export function connectedHumanCount(runtime, connectedUserIds) {
  return connectedHumanIds(runtime, connectedUserIds).length;
}

export function ensurePlayer(runtime, userId, username) {
  const result = ensurePlayerResult(runtime, userId, username);
  if (runtime.players.has(userId)) {
    const player = runtime.players.get(userId);
    player.username = username || player.username;
    player.weaponId = 'rifle';
    applyResultToPlayer(runtime, player, result);
    runtime.enforceEntityTerrainFloor(player);
    runtime.recordEntityHistory(player, runtime.nowMs());
    return player;
  }

  const player = runtime.buildPlayerEntity(userId, username);
  applyResultToPlayer(runtime, player, result);
  runtime.players.set(userId, player);
  runtime.recordEntityHistory(player, runtime.nowMs());
  return player;
}

export function disconnectPlayer(runtime, userId) {
  const player = runtime.players.get(userId);
  if (!player) return false;
  syncPlayerResultFromEntity(runtime, player);
  runtime.players.delete(userId);
  return true;
}
