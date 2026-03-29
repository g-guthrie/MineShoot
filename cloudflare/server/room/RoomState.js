import { cloneWorldFlags } from '../../../shared/protocol.js';

const SNAPSHOT_SELF_CADENCE_MS = 1000 / 30;
const SNAPSHOT_ENGAGED_CADENCE_MS = 1000 / 60;
const SNAPSHOT_NEARBY_CADENCE_MS = 1000 / 45;
const SNAPSHOT_FAR_CADENCE_MS = 1000 / 30;
const SNAPSHOT_FAST_MOVER_CADENCE_MS = 1000 / 60;
const SNAPSHOT_FAST_MOVER_SPEED_NORM = 0.65;
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
  const teamIds = String(match.gameMode || room.gameMode || '').toLowerCase() === 'tdm'
    ? (Array.isArray(match.teamIds) && match.teamIds.length ? match.teamIds.slice() : [teamAlpha, teamBravo])
    : [];
  const teamProgress = {};
  const teamBaselineSize = {};
  const statTeamIds = teamIds.length ? teamIds : [teamAlpha, teamBravo];
  for (let i = 0; i < statTeamIds.length; i++) {
    const teamId = String(statTeamIds[i] || '');
    if (!teamId) continue;
    teamProgress[teamId] = Number((match.teamProgress && match.teamProgress[teamId]) || 0);
    teamBaselineSize[teamId] = Number((match.teamBaselineSize && match.teamBaselineSize[teamId]) || 0);
  }

  return {
    gameMode: match.gameMode || '',
    stockMode: !!match.stockMode,
    started: !!match.started,
    ended: !!match.ended,
    startedAt: match.startedAt || 0,
    endedAt: match.endedAt || 0,
    resetAt: match.resetAt || 0,
    matchBaselinePlayerCount: match.matchBaselinePlayerCount || 0,
    aliveCount: Number(match.aliveCount || 0),
    startingStocks: Number(match.startingStocks || 0),
    maxStocks: Number(match.maxStocks || 0),
    maxBonusLives: Number(match.maxBonusLives || 0),
    targetProgress: Number(match.targetProgress || 0),
    leaderProgress: Number(match.leaderProgress || 0),
    leaderId: match.leaderId || '',
    winnerId: match.winnerId || '',
    winnerTeam: match.winnerTeam || '',
    teamIds: teamIds,
    teamProgress: teamProgress,
    teamBaselineSize: teamBaselineSize
  };
}

export function snapshotCadenceMsForEntity(viewerEntity, entity, nowMs = 0, deps = {}) {
  const selfCadenceMs = Math.max(1, Number(deps.selfCadenceMs || SNAPSHOT_SELF_CADENCE_MS));
  const engagedCadenceMs = Math.max(1, Number(deps.engagedCadenceMs || SNAPSHOT_ENGAGED_CADENCE_MS));
  const nearbyCadenceMs = Math.max(1, Number(deps.nearbyCadenceMs || SNAPSHOT_NEARBY_CADENCE_MS));
  const farCadenceMs = Math.max(1, Number(deps.farCadenceMs || SNAPSHOT_FAR_CADENCE_MS));
  const fastMoverCadenceMs = Math.max(1, Number(deps.fastMoverCadenceMs || SNAPSHOT_FAST_MOVER_CADENCE_MS));
  const fastMoverSpeedNorm = Math.max(0, Number(deps.fastMoverSpeedNorm || SNAPSHOT_FAST_MOVER_SPEED_NORM));
  const nearbyDistance = Math.max(0, Number(deps.nearbyDistance || SNAPSHOT_NEARBY_DISTANCE));
  const isEngaged = typeof deps.isEngaged === 'function' ? deps.isEngaged : (() => false);
  const distanceBetween = typeof deps.distanceBetween === 'function' ? deps.distanceBetween : defaultDistanceBetween;
  const adaptiveCadenceEnabled = deps.adaptiveCadenceEnabled !== false;
  const intervalMultiplier = adaptiveCadenceEnabled
    ? Math.max(1, Number(deps.qualityIntervalMultiplier || 1))
    : 1;

  function applyCadenceMultiplier(baseCadenceMs, maxIntervalMs) {
    if (intervalMultiplier <= 1) return baseCadenceMs;
    return Math.min(maxIntervalMs, baseCadenceMs * intervalMultiplier);
  }

  if (!entity) return farCadenceMs;
  if (viewerEntity && entity.id === viewerEntity.id) return applyCadenceMultiplier(selfCadenceMs, 1000 / 20);
  if (viewerEntity && isEngaged(viewerEntity, entity, nowMs)) return applyCadenceMultiplier(engagedCadenceMs, 1000 / 20);
  if (viewerEntity && distanceBetween(viewerEntity, entity) <= nearbyDistance) {
    if (Number(entity.moveSpeedNorm || 0) >= fastMoverSpeedNorm) return applyCadenceMultiplier(fastMoverCadenceMs, 1000 / 15);
    return applyCadenceMultiplier(nearbyCadenceMs, 1000 / 15);
  }
  return applyCadenceMultiplier(farCadenceMs, 1000 / 10);
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
  const hasCompareEntityState = typeof options.hasCompareEntityState === 'function'
    ? options.hasCompareEntityState
    : ((entityId) => prevEntityStateById.has(entityId));
  const readCompareEntityState = typeof options.readCompareEntityState === 'function'
    ? options.readCompareEntityState
    : ((entityId) => prevEntityStateById.get(entityId));
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

    const hasPreviousSerialized = !!hasCompareEntityState(entityId);
    const previousSerialized = readCompareEntityState(entityId);
    const lastSentAt = Math.max(0, Number(prevEntityLastSentAtById.get(entityId) || 0));
    const lastAuthoritativeChangeAt = Math.max(0, Number(entity.lastAuthoritativeChangeAt || 0));
    const cadenceMs = snapshotCadenceMsForEntity(viewerEntity, entity, nowMs, options);
    const priorityDue = priorityEntityIds.has(entityId);
    const due = forceFull || priorityDue || !hasPreviousSerialized || ((nowMs - lastSentAt) >= cadenceMs);
    const changedSinceLastSend = lastAuthoritativeChangeAt > lastSentAt;

    if (forceFull || !hasPreviousSerialized || (due && (previousSerialized !== serialized || changedSinceLastSend))) {
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
  const forceFull = !!snapshot.forceFull;
  const isDelta = !forceFull;
  const payload = {
    t: deps.msgType,
    serverTime: deps.nowMs ? deps.nowMs() : 0,
    delta: isDelta,
    gameMode: room.gameMode || '',
    privateRoomPhase: currentPrivateRoomPhase(room, deps),
    matchState: serializeMatchState(room, deps),
    removedEntityIds: snapshot.removedEntityIds || []
  };
  if (forceFull || !Array.isArray(snapshot.entityPatches)) {
    payload.entities = forceFull ? (snapshot.entities || []) : (snapshot.changedEntities || []);
  } else {
    payload.entityPatches = snapshot.entityPatches || [];
  }
  const snapshotSeq = Math.max(0, Number(snapshot.snapshotSeq || 0));
  if (snapshotSeq > 0) {
    payload.snapshotSeq = snapshotSeq;
  }
  const baseSnapshotSeq = Math.max(0, Number(snapshot.baseSnapshotSeq || 0));
  if (isDelta && baseSnapshotSeq > 0) {
    payload.baseSnapshotSeq = baseSnapshotSeq;
  }
  if (snapshot.projectiles !== undefined) {
    payload.projectiles = snapshot.projectiles || [];
  }
  if (snapshot.fireZones !== undefined) {
    payload.fireZones = snapshot.fireZones || [];
  }
  return payload;
}
