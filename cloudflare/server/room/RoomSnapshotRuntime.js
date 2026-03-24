import { toEntityState, toProjectileState, toFireZoneState } from './EntitySerializer.js';
import {
  buildViewerEntitySnapshot,
  buildSnapshotPayload,
  currentPrivateRoomPhase,
  serializeMatchState
} from './RoomState.js';

export function ensureClientSnapshotState(meta) {
  if (!meta.snapshotState) {
    meta.snapshotState = {
      entityStateById: new Map(),
      entityLastSentAtById: new Map()
    };
  }
  return meta.snapshotState;
}

export function ensureSnapshotBurstState(meta) {
  if (!meta.snapshotBurstState) {
    meta.snapshotBurstState = {
      untilAt: 0,
      lastSentAt: 0,
      entityIds: new Set()
    };
  }
  if (!(meta.snapshotBurstState.entityIds instanceof Set)) {
    meta.snapshotBurstState.entityIds = new Set();
  }
  return meta.snapshotBurstState;
}

export function collectSnapshotFrame(room, now = Date.now()) {
  const entities = [];
  for (const player of room.players.values()) {
    if (!player || room.isEntityDisconnected(player)) continue;
    room.materializeTrackedWeaponAmmo(player, now);
    entities.push(toEntityState(player, now));
  }
  for (const bot of room.bots.values()) {
    if (!bot) continue;
    room.materializeTrackedWeaponAmmo(bot, now);
    entities.push(toEntityState(bot, now));
  }

  const serializedById = new Map();
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!entity || !entity.id) continue;
    serializedById.set(entity.id, JSON.stringify(entity));
  }

  const projectiles = [];
  room.projectiles.forEach((projectile) => {
    if (!projectile || !projectile.alive) return;
    projectiles.push(toProjectileState(projectile));
  });

  const fireZones = [];
  room.fireZones.forEach((fireZone) => {
    fireZones.push(toFireZoneState(fireZone));
  });

  return {
    now,
    entities,
    serializedById,
    projectiles,
    fireZones,
    projectilesSerialized: JSON.stringify(projectiles),
    fireZonesSerialized: JSON.stringify(fireZones)
  };
}

export function isEntityEngagedForViewer(viewerEntity, entityId, now = Date.now()) {
  if (!viewerEntity || !entityId) return false;
  const engagements = viewerEntity.snapshotEngagements;
  if (!(engagements instanceof Map)) return false;
  const until = Number(engagements.get(entityId) || 0);
  if (until <= Math.max(0, Number(now || 0))) {
    if (until > 0) engagements.delete(entityId);
    return false;
  }
  return true;
}

export function markEntityEngaged(room, sourceId, targetId, ttlMs, now = Date.now()) {
  const source = room.getEntityById(sourceId);
  const target = room.getEntityById(targetId);
  const until = Math.max(0, Number(now || 0)) + Math.max(1, Number(ttlMs || 0));
  if (!source || !target || source.id === target.id) return false;
  if (!source.snapshotEngagements) source.snapshotEngagements = new Map();
  if (!target.snapshotEngagements) target.snapshotEngagements = new Map();
  source.snapshotEngagements.set(target.id, until);
  target.snapshotEngagements.set(source.id, until);
  return true;
}

export function sendSnapshotToClient(room, ws, meta, frame, options = {}, deps = {}) {
  if (!meta || !meta.userId) return false;
  if (room.activeSocketByUserId.get(meta.userId) !== ws) return false;
  const viewer = room.players.get(meta.userId) || null;
  ensureClientSnapshotState(meta);
  const selection = buildViewerEntitySnapshot(frame.entities, viewer, meta.snapshotState, {
    forceFull: !!options.forceFull,
    nowMs: frame.now,
    serializedById: frame.serializedById,
    distanceBetween: deps.distanceBetween,
    isEngaged: (_viewer, entity, stamp) => deps.isEntityEngagedForViewer
      ? deps.isEntityEngagedForViewer(viewer, entity && entity.id ? entity.id : '', stamp)
      : false,
    priorityEntityIds: options.priorityEntityIds instanceof Set
      ? options.priorityEntityIds
      : new Set(Array.isArray(options.priorityEntityIds) ? options.priorityEntityIds : [])
  });
  meta.snapshotState = selection.snapshotState;

  const includeProjectiles = options.includeProjectiles !== false;
  const includeFireZones = options.includeFireZones !== false;
  const projectileChanged = includeProjectiles && (!!options.forceFull || meta.lastProjectilesSerialized !== frame.projectilesSerialized);
  const fireZonesChanged = includeFireZones && (!!options.forceFull || meta.lastFireZonesSerialized !== frame.fireZonesSerialized);
  const roomStateSignature = JSON.stringify({
    gameMode: room.gameMode || '',
    privateRoomPhase: currentPrivateRoomPhase(room, deps),
    matchState: serializeMatchState(room, deps)
  });
  const roomStateChanged = !!options.forceFull || meta.lastSnapshotStateSignature !== roomStateSignature;
  if (!options.forceFull && selection.entities.length === 0 && selection.removedEntityIds.length === 0 && !projectileChanged && !fireZonesChanged && !roomStateChanged) {
    return false;
  }

  if (projectileChanged) meta.lastProjectilesSerialized = frame.projectilesSerialized;
  if (fireZonesChanged) meta.lastFireZonesSerialized = frame.fireZonesSerialized;
  meta.lastSnapshotStateSignature = roomStateSignature;

  room.send(ws, buildSnapshotPayload(room, {
    forceFull: !!options.forceFull,
    entities: frame.entities,
    changedEntities: selection.entities,
    removedEntityIds: selection.removedEntityIds,
    projectiles: projectileChanged ? frame.projectiles : undefined,
    fireZones: fireZonesChanged ? frame.fireZones : undefined
  }, {
    msgType: deps.msgType,
    nowMs: () => frame.now,
    isPrivateMatchRoom: deps.isPrivateMatchRoom,
    roomPhaseActive: deps.roomPhaseActive,
    emptyMatchState: deps.emptyMatchState,
    teamAlpha: deps.teamAlpha,
    teamBravo: deps.teamBravo
  }));
  return true;
}

function normalizeEntityIds(entityIds) {
  const list = Array.isArray(entityIds) ? entityIds : [entityIds];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const entityId = String(list[i] || '');
    if (!entityId) continue;
    out.push(entityId);
  }
  return out;
}

export function markSnapshotBurst(room, viewerIds, entityIds, now = Date.now(), ttlMs, deps = {}) {
  if (deps.combatBurstSnapshots === false) return false;
  const viewerList = Array.isArray(viewerIds) ? viewerIds : [viewerIds];
  const normalizedEntityIds = normalizeEntityIds(entityIds);
  if (normalizedEntityIds.length === 0) return false;

  const frame = collectSnapshotFrame(room, now);
  let sentAny = false;
  for (let i = 0; i < viewerList.length; i++) {
    const viewerId = String(viewerList[i] || '');
    if (!viewerId) continue;
    const ws = room.activeSocketByUserId.get(viewerId);
    if (!ws) continue;
    const meta = room.clients.get(ws);
    if (!meta) continue;
    const burstState = ensureSnapshotBurstState(meta);
    if (Number(burstState.untilAt || 0) <= now) {
      burstState.entityIds.clear();
    }
    burstState.untilAt = Math.max(
      Number(burstState.untilAt || 0),
      now + Math.max(1, Number(ttlMs || deps.snapshotBurstWindowMs || 0))
    );
    burstState.entityIds.add(viewerId);
    for (let r = 0; r < normalizedEntityIds.length; r++) {
      burstState.entityIds.add(normalizedEntityIds[r]);
    }
    if ((now - Number(burstState.lastSentAt || 0)) < Math.max(1, Number(deps.snapshotBurstCadenceMs || 0))) continue;
    if (sendSnapshotToClient(room, ws, meta, frame, {
      priorityEntityIds: burstState.entityIds,
      includeProjectiles: false,
      includeFireZones: false
    }, deps)) {
      burstState.lastSentAt = now;
      sentAny = true;
    }
  }
  return sentAny;
}

export function markFireEngagement(room, player, msg, now = Date.now(), deps = {}) {
  if (!player || !player.alive) return [];
  let aimForward = room.entityForward(player);
  if (msg && msg.aimForward && typeof msg.aimForward === 'object') {
    const rawX = Number(msg.aimForward.x || 0);
    const rawY = Number(msg.aimForward.y || 0);
    const rawZ = Number(msg.aimForward.z || 0);
    const len = Math.sqrt((rawX * rawX) + (rawY * rawY) + (rawZ * rawZ));
    if (Number.isFinite(len) && len > 0.000001) {
      const normalized = { x: rawX / len, y: rawY / len, z: rawZ / len };
      const authoritativeForward = room.entityForward(player);
      if (deps.dot3(normalized, authoritativeForward) >= 0.1) {
        aimForward = normalized;
      }
    }
  }

  const candidates = [];
  const entities = room.getAliveEntities();
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!room.canTargetEntity(entity, player.id)) continue;
    const dist = deps.distance3(player, entity);
    if (!Number.isFinite(dist) || dist > Number(deps.snapshotEngagementRangeWu || 0)) continue;
    const toTarget = deps.normalize3(
      Number(entity.x || 0) - Number(player.x || 0),
      Number((entity.y || deps.playerEyeHeight || 0) - (player.y || deps.playerEyeHeight || 0)),
      Number(entity.z || 0) - Number(player.z || 0)
    );
    const alignment = deps.dot3(aimForward, toTarget);
    if (alignment < Number(deps.snapshotEngagementMinDot || 0)) continue;
    candidates.push({ entity, alignment, dist });
  }

  candidates.sort((a, b) => {
    if (Math.abs(Number(b.alignment || 0) - Number(a.alignment || 0)) > 0.0001) {
      return Number(b.alignment || 0) - Number(a.alignment || 0);
    }
    return Number(a.dist || 0) - Number(b.dist || 0);
  });

  const engagedIds = [];
  for (let i = 0; i < candidates.length && engagedIds.length < Math.max(1, Number(deps.snapshotEngagementMaxTargets || 0)); i++) {
    const target = candidates[i].entity;
    if (!target) continue;
    if (markEntityEngaged(room, player.id, target.id, deps.snapshotEngagementTtlMs, now)) {
      engagedIds.push(target.id);
    }
  }
  return engagedIds;
}

export function broadcastSnapshot(room, forceFull = false, deps = {}) {
  const frame = collectSnapshotFrame(room, deps.nowMs ? deps.nowMs() : Date.now());
  for (const [ws, meta] of room.clients.entries()) {
    if (!meta || !meta.userId) continue;
    sendSnapshotToClient(room, ws, meta, frame, {
      forceFull,
      includeProjectiles: true,
      includeFireZones: true
    }, deps);
  }
}
