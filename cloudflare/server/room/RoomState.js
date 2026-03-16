import { cloneWorldFlags } from '../../../shared/protocol.js';
import { lmsRules } from '../../../shared/lms-mode.js';

const SNAPSHOT_SELF_CADENCE_MS = 1000 / 60;
const SNAPSHOT_ENGAGED_CADENCE_MS = 1000 / 60;
const SNAPSHOT_NEARBY_CADENCE_MS = 1000 / 30;
const SNAPSHOT_FAR_CADENCE_MS = 1000 / 15;
const SNAPSHOT_NEARBY_DISTANCE = 35;

function defaultDistanceBetween(a, b) {
  if (!a || !b) return Infinity;
  const dx = Number(a.x || 0) - Number(b.x || 0);
  const dy = Number(a.y || 0) - Number(b.y || 0);
  const dz = Number(a.z || 0) - Number(b.z || 0);
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

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

export function snapshotCadenceMsForEntity(viewerEntity, entity, nowMs = 0, deps = {}) {
  const selfCadenceMs = Math.max(1, Number(deps.selfCadenceMs || SNAPSHOT_SELF_CADENCE_MS));
  const engagedCadenceMs = Math.max(1, Number(deps.engagedCadenceMs || SNAPSHOT_ENGAGED_CADENCE_MS));
  const nearbyCadenceMs = Math.max(1, Number(deps.nearbyCadenceMs || SNAPSHOT_NEARBY_CADENCE_MS));
  const farCadenceMs = Math.max(1, Number(deps.farCadenceMs || SNAPSHOT_FAR_CADENCE_MS));
  const nearbyDistance = Math.max(0, Number(deps.nearbyDistance || SNAPSHOT_NEARBY_DISTANCE));
  const isEngaged = typeof deps.isEngaged === 'function' ? deps.isEngaged : (() => false);
  const distanceBetween = typeof deps.distanceBetween === 'function' ? deps.distanceBetween : defaultDistanceBetween;

  if (!entity) return farCadenceMs;
  if (viewerEntity && entity.id === viewerEntity.id) return selfCadenceMs;
  if (viewerEntity && isEngaged(viewerEntity, entity, nowMs)) return engagedCadenceMs;
  if (viewerEntity && distanceBetween(viewerEntity, entity) <= nearbyDistance) return nearbyCadenceMs;
  return farCadenceMs;
}

export function buildViewerEntitySnapshot(entities, viewerEntity, viewerSnapshotState, options = {}) {
  const list = Array.isArray(entities) ? entities : [];
  const forceFull = !!options.forceFull;
  const nowMs = Math.max(0, Number(options.nowMs || 0));
  const priorityEntityIds = options.priorityEntityIds instanceof Set
    ? options.priorityEntityIds
    : new Set(Array.isArray(options.priorityEntityIds) ? options.priorityEntityIds : []);
  const serializeEntity = typeof options.serializeEntity === 'function'
    ? options.serializeEntity
    : ((entity) => JSON.stringify(entity));
  const serializedById = options.serializedById instanceof Map ? options.serializedById : new Map();
  const prevEntityStateById = viewerSnapshotState && viewerSnapshotState.entityStateById instanceof Map
    ? viewerSnapshotState.entityStateById
    : new Map();
  const prevEntityLastSentAtById = viewerSnapshotState && viewerSnapshotState.entityLastSentAtById instanceof Map
    ? viewerSnapshotState.entityLastSentAtById
    : new Map();
  const nextEntityStateById = forceFull ? new Map() : new Map(prevEntityStateById);
  const nextEntityLastSentAtById = forceFull ? new Map() : new Map(prevEntityLastSentAtById);
  const currentIds = new Set();
  const payloadEntities = [];
  const removedEntityIds = [];

  for (let i = 0; i < list.length; i++) {
    const entity = list[i];
    if (!entity) continue;
    const entityId = String(entity.id || '');
    if (!entityId) continue;
    currentIds.add(entityId);
    const serialized = serializedById.has(entityId)
      ? serializedById.get(entityId)
      : serializeEntity(entity);
    if (!serializedById.has(entityId)) serializedById.set(entityId, serialized);

    const previousSerialized = prevEntityStateById.get(entityId);
    const lastSentAt = Math.max(0, Number(prevEntityLastSentAtById.get(entityId) || 0));
    const cadenceMs = snapshotCadenceMsForEntity(viewerEntity, entity, nowMs, options);
    const priorityDue = priorityEntityIds.has(entityId);
    const due = forceFull || priorityDue || !prevEntityStateById.has(entityId) || ((nowMs - lastSentAt) >= cadenceMs);

    if (forceFull || !prevEntityStateById.has(entityId) || (due && previousSerialized !== serialized)) {
      payloadEntities.push(entity);
      nextEntityStateById.set(entityId, serialized);
      nextEntityLastSentAtById.set(entityId, nowMs);
    }
  }

  prevEntityStateById.forEach((_value, entityId) => {
    if (currentIds.has(entityId)) return;
    removedEntityIds.push(entityId);
    nextEntityStateById.delete(entityId);
    nextEntityLastSentAtById.delete(entityId);
  });

  return {
    entities: payloadEntities,
    removedEntityIds,
    snapshotState: {
      entityStateById: nextEntityStateById,
      entityLastSentAtById: nextEntityLastSentAtById
    }
  };
}

export function buildWelcomePayload(room, selfId, deps) {
  deps = deps || {};
  const tickRate = Math.round(1000 / Number(deps.roomSimTickMs || 33));
  const inputSendHz = Math.max(0, Math.round(Number(deps.inputSendHz || 0))) || tickRate;
  return {
    t: deps.msgType,
    selfId,
    roomId: room.roomName,
    gameMode: room.gameMode || '',
    privateRoomPhase: currentPrivateRoomPhase(room, deps),
    matchState: serializeMatchState(room, deps),
    tickRate,
    inputSendHz,
    worldSeed: room.worldSeed,
    worldProfileVersion: room.worldProfileVersion,
    worldFlags: cloneWorldFlags(room.worldFlags)
  };
}

export function buildSnapshotPayload(room, snapshot, deps) {
  deps = deps || {};
  snapshot = snapshot || {};
  const payload = {
    t: deps.msgType,
    serverTime: deps.nowMs ? deps.nowMs() : 0,
    delta: !snapshot.forceFull,
    gameMode: room.gameMode || '',
    privateRoomPhase: currentPrivateRoomPhase(room, deps),
    matchState: serializeMatchState(room, deps),
    entities: snapshot.forceFull ? (snapshot.entities || []) : (snapshot.changedEntities || []),
    removedEntityIds: snapshot.removedEntityIds || []
  };
  if (snapshot.projectiles !== undefined) {
    payload.projectiles = snapshot.projectiles || [];
  }
  if (snapshot.fireZones !== undefined) {
    payload.fireZones = snapshot.fireZones || [];
  }
  return payload;
}
