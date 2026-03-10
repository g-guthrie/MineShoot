import { cloneWorldFlags } from '../../../shared/protocol.js';
import { lmsRules } from '../../../shared/lms-mode.js';

export function currentPrivateRoomPhase(room, deps) {
  deps = deps || {};
  const isPrivateMatchRoom = deps.isPrivateMatchRoom;
  const roomPhaseActive = String(deps.roomPhaseActive || 'active');
  return isPrivateMatchRoom && isPrivateMatchRoom(room.roomName)
    ? String((room.privateRoomConfig && room.privateRoomConfig.roomPhase) || roomPhaseActive)
    : '';
}

export function serializeMatchState(room, deps) {
  deps = deps || {};
  const emptyMatchState = deps.emptyMatchState;
  const teamAlpha = deps.teamAlpha || 'alpha';
  const teamBravo = deps.teamBravo || 'bravo';
  const match = room.matchState || (emptyMatchState ? emptyMatchState(room.gameMode) : null) || {};

  return {
    gameMode: match.gameMode || '',
    started: !!match.started,
    ended: !!match.ended,
    startedAt: match.startedAt || 0,
    endedAt: match.endedAt || 0,
    resetAt: match.resetAt || 0,
    matchBaselinePlayerCount: match.matchBaselinePlayerCount || 0,
    targetProgress: Number(match.targetProgress || 0),
    leaderProgress: Number(match.leaderProgress || 0),
    leaderId: match.leaderId || '',
    winnerId: match.winnerId || '',
    winnerTeam: match.winnerTeam || '',
    lms: match.lms ? {
      startingLives: Number(match.lms.startingLives || lmsRules.startingLives),
      maxLives: Number(match.lms.maxLives || lmsRules.maxLives),
      chargePerExtraLife: Number(match.lms.chargePerExtraLife || lmsRules.chargePerExtraLife),
      remainingPlayers: Number(match.lms.remainingPlayers || 0),
      finalBankingCutoffRemaining: Number(match.lms.finalBankingCutoffRemaining || lmsRules.finalBankingCutoffRemaining),
      warmupEndsAt: Number(match.lms.warmupEndsAt || 0),
      nextRotateAt: Number(match.lms.nextRotateAt || 0),
      bankingEnabled: !!match.lms.bankingEnabled,
      activeBeacon: match.lms.activeBeacon ? { ...match.lms.activeBeacon } : null
    } : null,
    teamProgress: {
      [teamAlpha]: Number((match.teamProgress && match.teamProgress[teamAlpha]) || 0),
      [teamBravo]: Number((match.teamProgress && match.teamProgress[teamBravo]) || 0)
    },
    teamBaselineSize: {
      [teamAlpha]: Number((match.teamBaselineSize && match.teamBaselineSize[teamAlpha]) || 0),
      [teamBravo]: Number((match.teamBaselineSize && match.teamBaselineSize[teamBravo]) || 0)
    }
  };
}

export function buildWelcomePayload(room, selfId, deps) {
  deps = deps || {};
  return {
    t: deps.msgType,
    selfId,
    roomId: room.roomName,
    gameMode: room.gameMode || '',
    privateRoomPhase: currentPrivateRoomPhase(room, deps),
    matchState: serializeMatchState(room, deps),
    tickRate: Math.round(1000 / Number(deps.roomSimTickMs || 33)),
    worldSeed: room.worldSeed,
    worldProfileVersion: room.worldProfileVersion,
    worldFlags: cloneWorldFlags(room.worldFlags)
  };
}

export function buildSnapshotPayload(room, snapshot, deps) {
  deps = deps || {};
  snapshot = snapshot || {};
  return {
    t: deps.msgType,
    serverTime: deps.nowMs ? deps.nowMs() : 0,
    delta: !snapshot.forceFull,
    gameMode: room.gameMode || '',
    privateRoomPhase: currentPrivateRoomPhase(room, deps),
    matchState: serializeMatchState(room, deps),
    entities: snapshot.forceFull ? (snapshot.entities || []) : (snapshot.changedEntities || []),
    removedEntityIds: snapshot.removedEntityIds || [],
    projectiles: snapshot.projectiles || [],
    fireZones: snapshot.fireZones || []
  };
}
