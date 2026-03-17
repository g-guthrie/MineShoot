import { LMS_MODE_ID, lmsRules } from './lms-mode.js';

export const MATCH_GAME_MODE_FFA = 'ffa';
export const MATCH_GAME_MODE_TDM = 'tdm';
export const MATCH_GAME_MODE_LMS = LMS_MODE_ID;
export const MATCH_TEAM_ALPHA = 'alpha';
export const MATCH_TEAM_BRAVO = 'bravo';
export const MATCH_TEAM_CHARLIE = 'charlie';
export const MATCH_TEAM_DELTA = 'delta';
export const MATCH_TEAM_IDS = [MATCH_TEAM_ALPHA, MATCH_TEAM_BRAVO, MATCH_TEAM_CHARLIE, MATCH_TEAM_DELTA];
export const FFA_TARGET_PROGRESS = 10;
export const TDM_TARGET_PROGRESS = 10;
export const MATCH_RESET_DELAY_MS = 5000;

export function normalizeMatchGameMode(rawMode) {
  const mode = String(rawMode || '').trim().toLowerCase();
  if (mode === MATCH_GAME_MODE_TDM) return MATCH_GAME_MODE_TDM;
  if (mode === MATCH_GAME_MODE_LMS) return MATCH_GAME_MODE_LMS;
  return MATCH_GAME_MODE_FFA;
}

export function targetProgressForGameMode(gameMode, options = {}) {
  const mode = normalizeMatchGameMode(gameMode);
  if (mode === MATCH_GAME_MODE_TDM) {
    return Math.max(0, Number(options.tdmTargetProgress != null ? options.tdmTargetProgress : TDM_TARGET_PROGRESS));
  }
  if (mode === MATCH_GAME_MODE_FFA) {
    return Math.max(0, Number(options.ffaTargetProgress != null ? options.ffaTargetProgress : FFA_TARGET_PROGRESS));
  }
  return 0;
}

export function normalizeMatchTeamIds(rawTeamIds, fallbackTeamIds = [MATCH_TEAM_ALPHA, MATCH_TEAM_BRAVO]) {
  const source = Array.isArray(rawTeamIds) && rawTeamIds.length ? rawTeamIds : fallbackTeamIds;
  const fallback = Array.isArray(fallbackTeamIds) && fallbackTeamIds.length ? fallbackTeamIds : [MATCH_TEAM_ALPHA, MATCH_TEAM_BRAVO];
  const out = [];
  for (let i = 0; i < source.length; i++) {
    const teamId = String(source[i] || '').trim().toLowerCase();
    if (MATCH_TEAM_IDS.indexOf(teamId) < 0 || out.indexOf(teamId) >= 0) continue;
    out.push(teamId);
  }
  if (out.length >= 2) return out;
  return fallback.slice(0, 2);
}

function buildTeamStatMap(teamIds, source) {
  const out = {};
  const ids = normalizeMatchTeamIds(teamIds);
  for (let i = 0; i < ids.length; i++) {
    const teamId = ids[i];
    out[teamId] = Number(source && source[teamId] || 0);
  }
  return out;
}

function teamIdsForMatch(matchState) {
  const match = matchState || null;
  if (match && Array.isArray(match.teamIds) && match.teamIds.length) {
    return normalizeMatchTeamIds(match.teamIds);
  }
  return normalizeMatchTeamIds(match && match.teamProgress ? Object.keys(match.teamProgress) : null);
}

export function getLeadingOpposingTeam(matchState, selfTeamId) {
  const match = matchState || null;
  const ownTeamId = String(selfTeamId || '').trim().toLowerCase();
  const teamIds = teamIdsForMatch(match);
  let bestTeamId = '';
  let bestProgress = 0;
  for (let i = 0; i < teamIds.length; i++) {
    const teamId = teamIds[i];
    if (teamId === ownTeamId) continue;
    const progress = Number(match && match.teamProgress && match.teamProgress[teamId] || 0);
    if (!bestTeamId || progress > bestProgress) {
      bestTeamId = teamId;
      bestProgress = progress;
    }
  }
  return {
    teamId: bestTeamId,
    progress: Number(bestProgress || 0)
  };
}

export function createMatchState(gameMode, options = {}) {
  const teamAlpha = String(options.teamAlpha || MATCH_TEAM_ALPHA);
  const teamBravo = String(options.teamBravo || MATCH_TEAM_BRAVO);
  const mode = normalizeMatchGameMode(gameMode);
  const teamIds = mode === MATCH_GAME_MODE_TDM
    ? normalizeMatchTeamIds(options.teamIds, [teamAlpha, teamBravo])
    : [teamAlpha, teamBravo];
  return {
    gameMode: mode,
    started: false,
    ended: false,
    startedAt: 0,
    endedAt: 0,
    resetAt: 0,
    matchBaselinePlayerCount: 0,
    targetProgress: targetProgressForGameMode(mode, options),
    leaderProgress: 0,
    leaderId: '',
    winnerId: '',
    winnerTeam: '',
    teamIds: mode === MATCH_GAME_MODE_TDM ? teamIds.slice() : [],
    lms: mode === MATCH_GAME_MODE_LMS ? {
      startingLives: lmsRules.startingLives,
      maxLives: lmsRules.maxLives,
      chargePerExtraLife: lmsRules.chargePerExtraLife,
      remainingPlayers: 0,
      finalBankingCutoffRemaining: lmsRules.finalBankingCutoffRemaining,
      warmupEndsAt: 0,
      nextRotateAt: 0,
      bankingEnabled: false,
      activeBeacon: null
    } : null,
    teamProgress: buildTeamStatMap(teamIds, null),
    teamBaselineSize: buildTeamStatMap(teamIds, null)
  };
}

export function formatMatchProgress(value, digits = 1) {
  const num = Number(value || 0);
  if (Math.abs(num - Math.round(num)) < 0.0005) return String(Math.round(num));
  return num.toFixed(digits);
}

export function formatSecondsRemaining(ms) {
  return (Math.max(0, Number(ms || 0)) / 1000).toFixed(1) + 's';
}

export function formatWinnerLabel(matchState, selfState, options = {}) {
  const match = matchState || null;
  if (!match) return '';
  const mode = normalizeMatchGameMode(match.gameMode || options.gameMode);
  if (mode === MATCH_GAME_MODE_TDM) {
    const winnerTeam = String(match.winnerTeam || '').toUpperCase();
    return winnerTeam ? ('TEAM ' + winnerTeam) : 'TEAM WIN';
  }
  const winnerId = String(match.winnerId || match.leaderId || '');
  if (winnerId && selfState && winnerId === String(selfState.id || '')) return 'YOU';
  if (winnerId && typeof options.resolveEntityName === 'function') {
    const winnerName = String(options.resolveEntityName(winnerId) || '').trim();
    if (winnerName) return winnerName.toUpperCase();
  }
  return 'PLAYER';
}

export function formatMatchHudCounter(matchState, selfState) {
  const match = matchState || null;
  const ownKills = Math.max(0, Number(selfState && selfState.kills || 0));
  if (!match || !match.started) {
    return 'Kills: ' + ownKills;
  }

  const mode = normalizeMatchGameMode(match.gameMode);
  if (mode === MATCH_GAME_MODE_LMS) {
    if (selfState && selfState.outOfRound && !match.ended) {
      const remaining = Math.max(0, Number(match.lms && match.lms.remainingPlayers || 0));
      return 'OUT | Left: ' + remaining;
    }
    const lmsLives = Math.max(0, Number(selfState && selfState.lmsLives || 0));
    const lmsCharge = Math.max(0, Number(selfState && selfState.lmsCharge || 0));
    const chargeGoal = Math.max(1, Number(match.lms && match.lms.chargePerExtraLife || lmsRules.chargePerExtraLife));
    const remaining = Math.max(0, Number(match.lms && match.lms.remainingPlayers || 0));
    return 'Lives: ' + lmsLives + ' | Charge: ' + lmsCharge + '/' + chargeGoal + ' | Left: ' + remaining;
  }

  if (mode === MATCH_GAME_MODE_TDM) {
    const teamId = String(selfState && selfState.teamId || '');
    const teamProgress = Number(match.teamProgress && match.teamProgress[teamId] || 0);
    const opposing = getLeadingOpposingTeam(match, teamId);
    return 'Kills: ' + ownKills +
      ' | Team: ' + formatMatchProgress(teamProgress) + '/' + formatMatchProgress(match.targetProgress) +
      ' | Opp: ' + (opposing.teamId ? opposing.teamId.toUpperCase() : '--') + ' ' + formatMatchProgress(opposing.progress);
  }

  return 'Kills: ' + ownKills +
    ' | Goal: ' + formatMatchProgress(match.targetProgress, 0) +
    ' | Lead: ' + formatMatchProgress(match.leaderProgress, 0);
}

export function formatMenuMatchStats(matchState, selfState) {
  const match = matchState || null;
  const mode = normalizeMatchGameMode(match && match.gameMode);
  if (mode === MATCH_GAME_MODE_LMS) {
    const lives = Math.max(0, Number(selfState && selfState.lmsLives || 0));
    const charge = Math.max(0, Number(selfState && selfState.lmsCharge || 0));
    return 'LIVES ' + lives + ' | CHARGE ' + charge;
  }
  const kills = Math.max(0, Number(selfState && selfState.kills || 0));
  const deaths = Math.max(0, Number(selfState && selfState.deaths || 0));
  return 'KILLS ' + kills + ' | DEATHS ' + deaths;
}

export function formatMenuMatchStatus(matchState, selfState, options = {}) {
  const match = matchState || null;
  const nowMs = typeof options.nowMs === 'function' ? options.nowMs : Date.now;
  const privateRoomPhase = String(options.privateRoomPhase || '');
  const respawnState = options.respawnState || null;

  if (!match || !match.started) {
    return privateRoomPhase === 'lobby' ? 'PRIVATE ROOM LOBBY' : 'WAITING FOR MATCH START';
  }

  if (match.ended) {
    return formatWinnerLabel(match, selfState, options) +
      ' WON | RESET ' + formatSecondsRemaining(Number(match.resetAt || 0) - nowMs());
  }

  if (respawnState && respawnState.active) {
    return 'RESPAWN IN ' + formatSecondsRemaining(respawnState.remainingMs);
  }

  const mode = normalizeMatchGameMode(match.gameMode);
  if (mode === MATCH_GAME_MODE_TDM) {
    const teamId = String(selfState && selfState.teamId || '');
    const teamProgress = Number(match.teamProgress && match.teamProgress[teamId] || 0);
    const opposing = getLeadingOpposingTeam(match, teamId);
    return 'TDM TEAM ' + formatMatchProgress(teamProgress) +
      ' / ' + formatMatchProgress(match.targetProgress) +
      ' | OPP ' + (opposing.teamId ? opposing.teamId.toUpperCase() : '--') + ' ' + formatMatchProgress(opposing.progress);
  }

  if (mode === MATCH_GAME_MODE_LMS) {
    if (selfState && selfState.outOfRound) {
      const remainingOut = Math.max(0, Number(match.lms && match.lms.remainingPlayers || 0));
      return 'OUT OF ROUND | LEFT ' + remainingOut;
    }
    const lives = Math.max(0, Number(selfState && selfState.lmsLives || 0));
    const charge = Math.max(0, Number(selfState && selfState.lmsCharge || 0));
    const lms = match.lms || null;
    const chargeGoal = Math.max(1, Number(lms && lms.chargePerExtraLife || lmsRules.chargePerExtraLife));
    const remaining = Math.max(0, Number(lms && lms.remainingPlayers || 0));
    const beaconLabel = lms && lms.activeBeacon && lms.activeBeacon.label ? String(lms.activeBeacon.label) : '---';
    const beaconClock = lms && Number(lms.nextRotateAt || 0) > 0
      ? formatSecondsRemaining(Number(lms.nextRotateAt || 0) - nowMs())
      : '0.0s';
    return 'LMS ' + lives + ' ' + (lives === 1 ? 'LIFE' : 'LIVES') +
      ' | CHARGE ' + charge + '/' + chargeGoal +
      ' | LEFT ' + remaining +
      ' | BEACON ' + beaconLabel + ' ' + beaconClock;
  }

  const kills = Math.max(0, Number(selfState && selfState.kills || 0));
  return 'FFA ' + kills +
    ' / ' + formatMatchProgress(match.targetProgress, 0) +
    ' | LEAD ' + formatMatchProgress(match.leaderProgress, 0);
}

export const matchRules = {
  gameModeFfa: MATCH_GAME_MODE_FFA,
  gameModeTdm: MATCH_GAME_MODE_TDM,
  gameModeLms: MATCH_GAME_MODE_LMS,
  teamAlpha: MATCH_TEAM_ALPHA,
  teamBravo: MATCH_TEAM_BRAVO,
  teamCharlie: MATCH_TEAM_CHARLIE,
  teamDelta: MATCH_TEAM_DELTA,
  teamIds: MATCH_TEAM_IDS.slice(),
  ffaTargetProgress: FFA_TARGET_PROGRESS,
  tdmTargetProgress: TDM_TARGET_PROGRESS,
  matchResetDelayMs: MATCH_RESET_DELAY_MS,
  normalizeMatchGameMode,
  normalizeMatchTeamIds,
  targetProgressForGameMode,
  createMatchState,
  formatMatchProgress,
  formatSecondsRemaining,
  getLeadingOpposingTeam,
  formatWinnerLabel,
  formatMatchHudCounter,
  formatMenuMatchStats,
  formatMenuMatchStatus
};

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.matchRules = matchRules;
