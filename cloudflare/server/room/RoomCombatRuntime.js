export function tickThrowableRegen(entity, dtSec, deps) {
  deps = deps || {};
  const throwableStats = deps.throwableStats || {};
  if (!entity || !entity.throwables) return;
  const order = throwableStats.order || [];
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const def = throwableStats[id];
    const inv = entity.throwables[id];
    if (!def || !inv) continue;
    if (inv.charges >= inv.maxCharges) continue;
    inv.cooldownRemaining -= dtSec;
    if (inv.cooldownRemaining <= 0) {
      inv.charges++;
      if (inv.charges < inv.maxCharges) inv.cooldownRemaining += def.regen;
      else inv.cooldownRemaining = 0;
    }
  }
}

export function consumeThrowCharge(entity, throwableId, deps) {
  deps = deps || {};
  const throwableStats = deps.throwableStats || {};
  if (!entity || !entity.throwables) return false;
  const inv = entity.throwables[throwableId];
  const def = throwableStats[throwableId];
  if (!inv || !def || inv.charges <= 0) return false;
  inv.charges--;
  if (inv.charges < inv.maxCharges && inv.cooldownRemaining <= 0) {
    inv.cooldownRemaining = def.regen;
  }
  return true;
}

function clampNumber(value, min, max, fallback = 0) {
  let parsed = Number(value);
  if (!Number.isFinite(parsed)) parsed = Number(fallback || 0);
  if (!Number.isFinite(parsed)) parsed = 0;
  return Math.max(min, Math.min(max, parsed));
}

const FORWARD_ROLL_ACTION_DURATION_MS = 360;
const BACKWARD_ROLL_ACTION_DURATION_MS = 520;
const STANDARD_AUTO_RELOAD_DELAY_MS = 3000;

function normalizeRollInputState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    movingForward: !!source.movingForward,
    movingBackward: !!source.movingBackward,
    movingLeft: !!source.movingLeft,
    movingRight: !!source.movingRight
  };
}

function sanitizeThrowableSpawnDef(rawDef, throwableId = '') {
  if (!rawDef || typeof rawDef !== 'object') return null;
  return {
    id: String(rawDef.id || throwableId || ''),
    speed: clampNumber(rawDef.speed, 0, 60, 0),
    upward: clampNumber(rawDef.upward, -10, 20, 0),
    gravity: clampNumber(rawDef.gravity, 0, 40, 0),
    fuse: clampNumber(rawDef.fuse, 0, 10, 0),
    life: clampNumber(rawDef.life, 0, 10, 0),
    maxLife: clampNumber(rawDef.maxLife, 0, 10, 0),
    hitRadius: clampNumber(rawDef.hitRadius, 0, 2, 1.2),
    stickyDelaySec: clampNumber(rawDef.stickExplodeDelay, 0, 10, 0),
    catchRadius: clampNumber(rawDef.catchRadius, 0, 3, 0),
    trackDurationSec: clampNumber(rawDef.trackDuration, 0, 5, 0),
    trackLerp: clampNumber(rawDef.trackLerp, 0, 20, 0)
  };
}

export function entityCorePosition(entity, deps) {
  deps = deps || {};
  return {
    x: entity.x,
    y: (entity.y || Number(deps.playerEyeHeight || 0)) - Number(deps.playerEyeHeight || 0) + Number(deps.throwableSpawnHeight || 0),
    z: entity.z
  };
}

export function entityForward(entity, deps) {
  deps = deps || {};
  const normalize3 = deps.normalize3;
  const yaw = entity && typeof entity.yaw === 'number' ? entity.yaw : 0;
  const pitch = entity && typeof entity.pitch === 'number' ? entity.pitch : 0;
  const x = -Math.sin(yaw) * Math.cos(pitch);
  const y = Math.sin(-pitch);
  const z = -Math.cos(yaw) * Math.cos(pitch);
  return normalize3(x, y, z);
}

export function entityRight(entity, deps) {
  deps = deps || {};
  const normalize3 = deps.normalize3;
  const yaw = entity && typeof entity.yaw === 'number' ? entity.yaw : 0;
  return normalize3(Math.cos(yaw), 0, -Math.sin(yaw));
}

export function buildDefaultThrowOriginAndDirection(room, player, deps) {
  deps = deps || {};
  const addScaled3 = deps.addScaled3;
  const originCore = room.entityCorePosition(player);
  const forward = room.entityForward(player);
  const right = room.entityRight(player);
  let origin = addScaled3(originCore, forward, Number(deps.throwableSpawnForward || 0));
  origin = addScaled3(origin, right, -Number(deps.throwableSpawnLeft || 0));
  return { origin, direction: forward };
}

export function validateThrowIntent(room, player, rawIntent, deps) {
  deps = deps || {};
  const normalize3 = deps.normalize3;
  const distance3 = deps.distance3;
  const dot3 = deps.dot3;
  const fallback = room.buildDefaultThrowOriginAndDirection(player);
  if (!rawIntent || typeof rawIntent !== 'object') return fallback;
  if (!rawIntent.origin || !rawIntent.direction) return fallback;

  const origin = {
    x: Number(rawIntent.origin.x || 0),
    y: Number(rawIntent.origin.y || 0),
    z: Number(rawIntent.origin.z || 0)
  };
  const directionRaw = {
    x: Number(rawIntent.direction.x || 0),
    y: Number(rawIntent.direction.y || 0),
    z: Number(rawIntent.direction.z || 0)
  };
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z)) return fallback;
  if (!Number.isFinite(directionRaw.x) || !Number.isFinite(directionRaw.y) || !Number.isFinite(directionRaw.z)) return fallback;

  const direction = normalize3(directionRaw.x, directionRaw.y, directionRaw.z);
  const expectedOrigin = fallback.origin;
  const originDelta = distance3(origin, expectedOrigin);
  if (originDelta > Number(deps.throwIntentOriginMaxOffset || 0)) return fallback;

  const forward = room.entityForward(player);
  if (dot3(direction, forward) < Number(deps.throwIntentDirectionMinDot || 0)) return fallback;

  return { origin, direction };
}

export function spawnProjectile(room, player, throwableId, clientThrowId, throwIntent, options, deps) {
  deps = deps || {};
  const throwableStats = deps.throwableStats || {};
  const nowMs = deps.nowMs;
  const def = sanitizeThrowableSpawnDef(
    options && options.throwableDef ? options.throwableDef : throwableStats[throwableId],
    throwableId
  );
  if (!def) return null;
  const intent = room.validateThrowIntent(player, throwIntent);
  const forward = intent.direction;
  const origin = intent.origin;
  const velocity = {
    x: forward.x * def.speed,
    y: (forward.y * def.speed) + def.upward,
    z: forward.z * def.speed
  };
  const id = `proj_${room.nextProjectileSeq++}`;
  const now = nowMs();
  const projectile = {
    id,
    type: throwableId,
    ownerId: player.id,
    clientThrowId: clientThrowId || '',
    x: origin.x,
    y: origin.y,
    z: origin.z,
    vx: velocity.x,
    vy: velocity.y,
    vz: velocity.z,
    alive: true,
    age: 0,
    bounces: 0,
    fuseSec: throwableId === 'plasma'
      ? 0
      : (typeof def.fuse === 'number' ? def.fuse : (typeof def.life === 'number' ? def.life : 0)),
    lifeSec: throwableId === 'plasma'
      ? (typeof def.maxLife === 'number' ? def.maxLife : 0)
      : (typeof def.life === 'number' ? def.life : 0),
    createdAt: now,
    lockTargetId: options && options.lockTargetId ? String(options.lockTargetId) : '',
    launchDirX: forward.x,
    launchDirY: forward.y,
    launchDirZ: forward.z,
    hitRadius: def.hitRadius,
    stickyDelaySec: def.stickyDelaySec,
    catchRadius: def.catchRadius,
    trackDurationSec: def.trackDurationSec,
    trackLerp: def.trackLerp,
    trackingTargetId: '',
    trackingUntil: 0,
    stickyUntil: 0,
    stuckToTargetId: '',
    stuckOffsetX: 0,
    stuckOffsetY: 0,
    stuckOffsetZ: 0
  };
  room.projectiles.set(projectile.id, projectile);
  return projectile;
}

export function nearestTargetForProjectile(room, projectile, maxRange) {
  if (!projectile) return null;
  let nearest = null;
  let nearestDist = maxRange;
  const entities = [];
  for (const p of room.players.values()) entities.push(p);
  for (const b of room.bots.values()) entities.push(b);
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!room.canTargetEntity(entity, projectile.ownerId)) continue;
    const targetPos = room.entityAimTargetPosition(entity);
    const dx = targetPos.x - projectile.x;
    const dy = targetPos.y - projectile.y;
    const dz = targetPos.z - projectile.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = entity;
    }
  }
  return nearest;
}

export function isEntitySpawnShielded(entity, deps) {
  deps = deps || {};
  const nowMs = deps.nowMs;
  return !!(entity && entity.alive && (entity.spawnShieldUntil || 0) > nowMs());
}

export function canTargetEntity(room, entity, sourceId, deps) {
  if (!entity || !entity.alive) return false;
  if (room && typeof room.isEntityDisconnected === 'function') {
    if (room.isEntityDisconnected(entity)) return false;
  } else if (Number(entity.disconnectedAt || 0) > 0) {
    return false;
  }
  if (room && typeof room.isEntityMatchEntryPending === 'function' && room.isEntityMatchEntryPending(entity)) {
    return false;
  }
  if (sourceId && entity.id === sourceId) return false;
  return !room.isEntitySpawnShielded(entity);
}

export function worldCollidables(room) {
  return room.worldCollision && Array.isArray(room.worldCollision.collidables)
    ? room.worldCollision.collidables
    : [];
}

export function firstWorldHitDistance(room, origin, dir, maxDistance, deps) {
  deps = deps || {};
  const intersectRayAabb = deps.intersectRayAabb;
  const boxes = room.worldCollidables();
  let nearest = Number(maxDistance);
  for (let i = 0; i < boxes.length; i++) {
    const hitDistance = intersectRayAabb(origin, dir, boxes[i], nearest);
    if (hitDistance != null && hitDistance < nearest) {
      nearest = hitDistance;
    }
  }
  return Number.isFinite(nearest) ? nearest : Number(maxDistance);
}

export function hasWorldLineOfSight(room, origin, targetPos, maxRange, deps) {
  deps = deps || {};
  const normalize3 = deps.normalize3;
  const epsilon = Number(deps.worldRayEpsilon || 0.001);
  if (!origin || !targetPos) return false;
  const dx = Number(targetPos.x || 0) - Number(origin.x || 0);
  const dy = Number(targetPos.y || 0) - Number(origin.y || 0);
  const dz = Number(targetPos.z || 0) - Number(origin.z || 0);
  const distance = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
  if (distance <= epsilon || distance > Number(maxRange || Infinity)) return false;
  const dir = normalize3(dx, dy, dz);
  const worldHitDistance = room.firstWorldHitDistance(origin, dir, distance);
  return worldHitDistance >= (distance - 0.02);
}

export function readClassAimPoint(room, player, rawAimPoint, maxRange, deps) {
  deps = deps || {};
  const distance3 = deps.distance3;
  const normalize3 = deps.normalize3;
  const dot3 = deps.dot3;
  const playerEyeHeight = Number(deps.playerEyeHeight || 0);
  if (!player || !rawAimPoint || typeof rawAimPoint !== 'object') return null;
  const range = Math.max(1, Number(maxRange || 24));
  const point = {
    x: Number(rawAimPoint.x),
    y: Number(rawAimPoint.y),
    z: Number(rawAimPoint.z)
  };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return null;
  if (distance3(player, point) > (range + 1.5)) return null;
  const forward = room.entityForward(player);
  const to = normalize3(point.x - player.x, point.y - player.y, point.z - player.z);
  if (dot3(to, forward) < -0.2) return null;
  return point;
}

export function clampWorldAimPoint(room, origin, desiredPoint, maxRange, deps) {
  deps = deps || {};
  const normalize3 = deps.normalize3;
  const epsilon = Number(deps.worldRayEpsilon || 0.001);
  if (!origin || !desiredPoint) return desiredPoint;
  const dx = Number(desiredPoint.x || 0) - Number(origin.x || 0);
  const dy = Number(desiredPoint.y || 0) - Number(origin.y || 0);
  const dz = Number(desiredPoint.z || 0) - Number(origin.z || 0);
  const distance = Math.min(
    Math.max(0, Math.sqrt((dx * dx) + (dy * dy) + (dz * dz))),
    Math.max(0, Number(maxRange || 0))
  );
  if (distance <= epsilon) return desiredPoint;
  const dir = normalize3(dx, dy, dz);
  const worldHitDistance = room.firstWorldHitDistance(origin, dir, distance);
  const hitBlocked = worldHitDistance < (distance - 0.02);
  const clampedDistance = hitBlocked ? Math.max(0, worldHitDistance - 0.05) : distance;
  return {
    x: origin.x + (dir.x * clampedDistance),
    y: origin.y + (dir.y * clampedDistance),
    z: origin.z + (dir.z * clampedDistance)
  };
}

export function isEntityActionRestricted(entity, actionType, now) {
  if (!entity || !entity.alive) return false;
  if (actionType === 'weapon') return Number(entity.weaponLockUntil || 0) > now;
  if (actionType === 'throwable') return Number(entity.throwableLockUntil || 0) > now;
  return false;
}

export function isEntityMovementLocked(room, entity, now) {
  if (!entity || !entity.alive) return false;
  if (room && typeof room.isEntityMatchEntryPending === 'function' && room.isEntityMatchEntryPending(entity, now)) {
    return true;
  }
  return ((entity.stunUntil || 0) > now);
}

export function isEntityRolling(entity, now = Date.now()) {
  if (!entity || !entity.alive) return false;
  const stamp = Math.max(0, Number(now || 0));
  const startedAt = Math.max(0, Number(entity.rollStartedAt || 0));
  const until = Math.max(0, Number(entity.rollUntil || 0));
  if (!(until > stamp)) return false;
  if (startedAt > 0 && stamp < startedAt) return false;
  return true;
}

export function rollActionDurationMs(rollInputState) {
  const state = normalizeRollInputState(rollInputState);
  if (state.movingBackward && !state.movingForward) {
    return BACKWARD_ROLL_ACTION_DURATION_MS;
  }
  return FORWARD_ROLL_ACTION_DURATION_MS;
}

export function beginEntityRoll(room, entity, rollInputState, now = Date.now()) {
  if (!entity || !entity.alive) return false;
  const state = normalizeRollInputState(rollInputState);
  if (!state.movingForward && !state.movingBackward && !state.movingLeft && !state.movingRight) return false;
  if (entity.isGrounded === false) return false;
  if (room && room.isEntityMovementLocked && room.isEntityMovementLocked(entity, now)) return false;
  if (isEntityRolling(entity, now)) return false;

  entity.rollStartedAt = Math.max(0, Number(now || 0));
  entity.rollUntil = entity.rollStartedAt + rollActionDurationMs(state);
  entity.rollInputState = state;
  return true;
}

export function canEntityUseWeapon(room, entity, now) {
  return !!(entity && entity.alive) && !room.isEntityMovementLocked(entity, now) && !room.isEntityActionRestricted(entity, 'weapon', now);
}

export function canEntityUseThrowable(room, entity, now) {
  return !!(entity && entity.alive) && !room.isEntityMovementLocked(entity, now) && !room.isEntityActionRestricted(entity, 'throwable', now);
}

export function isEntityActionLocked(room, entity, now) {
  if (!entity || !entity.alive) return false;
  return room.isEntityMovementLocked(entity, now) ||
    room.isEntityActionRestricted(entity, 'weapon', now) ||
    room.isEntityActionRestricted(entity, 'throwable', now);
}

export function entityAimTargetPosition(entity, deps) {
  deps = deps || {};
  const entityAimTargetY = deps.entityAimTargetY;
  return {
    x: entity.x,
    y: entityAimTargetY(entity && entity.y),
    z: entity.z
  };
}

export function hostilesInCone(room, player, range, minDot, deps) {
  deps = deps || {};
  const normalize3 = deps.normalize3;
  const dot3 = deps.dot3;
  const distance3 = deps.distance3;
  const playerEyeHeight = Number(deps.playerEyeHeight || 0);
  if (!player || !player.alive) return [];
  const forward = room.entityForward(player);
  const entities = room.getAliveEntities();
  const out = [];
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!room.canTargetEntity(entity, player.id)) continue;
    const to = normalize3(entity.x - player.x, ((entity.y || playerEyeHeight) - player.y), entity.z - player.z);
    if (dot3(to, forward) < minDot) continue;
    const d = distance3(player, entity);
    if (d > range) continue;
    out.push({ entity, dist: d });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

export function hostilesInRadius(room, center, radius, excludeId, deps) {
  deps = deps || {};
  const distance3 = deps.distance3;
  if (!center) return [];
  const entities = room.getAliveEntities();
  const out = [];
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!room.canTargetEntity(entity, excludeId || '')) continue;
    const d = distance3(entity, center);
    if (d > radius) continue;
    out.push({ entity, dist: d });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

export function applyTimedStun(target, durationSec, deps) {
  deps = deps || {};
  const nowMs = deps.nowMs;
  if (!target || !target.alive) return;
  const until = nowMs() + Math.max(0, Math.round(durationSec * 1000));
  target.stunUntil = Math.max(target.stunUntil || 0, until);
}

export function applyTimedSlow(target, durationSec, multiplier, deps) {
  deps = deps || {};
  const nowMs = deps.nowMs;
  if (!target || !target.alive) return;
  const until = nowMs() + Math.max(0, Math.round(durationSec * 1000));
  target.slowUntil = Math.max(target.slowUntil || 0, until);
  target.slowMultiplier = Math.max(0.1, Math.min(1, Number(multiplier || 1)));
}

export function closestHostileInRange(room, player, range, minDot, deps) {
  const hits = room.hostilesInCone(player, range, minDot);
  return hits.length > 0 ? hits[0].entity : null;
}

export function resolveLockedHostile(room, player, lockTargetId, range, minDot, options, deps) {
  deps = deps || {};
  const distance3 = deps.distance3;
  const normalize3 = deps.normalize3;
  const dot3 = deps.dot3;
  const playerEyeHeight = Number(deps.playerEyeHeight || 0);
  if (!player || !player.alive || !lockTargetId) return null;
  const target = room.getEntityById(String(lockTargetId));
  if (!room.canTargetEntity(target, player.id)) return null;
  if (distance3(player, target) > Math.max(0.5, Number(range || 0))) return null;
  const forward = room.entityForward(player);
  const to = normalize3(target.x - player.x, ((target.y || playerEyeHeight) - player.y), target.z - player.z);
  if (dot3(to, forward) < Number(minDot || -1)) return null;
  const opts = options || {};
  if (opts.requireLos) {
    const origin = room.entityAimTargetPosition(player);
    const targetPos = room.entityAimTargetPosition(target);
    if (!room.hasWorldLineOfSight(origin, targetPos, Number(range || 0))) return null;
  }
  if (opts.aimPoint && Number(opts.targetTolerance || 0) > 0) {
    const aimPoint = room.readClassAimPoint(player, opts.aimPoint, range);
    if (!aimPoint) return null;
    const targetPos = room.entityAimTargetPosition(target);
    if (distance3(targetPos, aimPoint) > Number(opts.targetTolerance || 0)) return null;
  }
  return target;
}

export function syncWeaponAmmoState(room, entity, weaponId, now, deps) {
  deps = deps || {};
  const weaponStats = deps.weaponStats || {};
  const createWeaponAmmoRuntime = deps.createWeaponAmmoRuntime;
  const defaultWeaponLoadout = deps.defaultWeaponLoadout || [];
  if (!entity || !weaponId) return null;
  const stats = weaponStats[weaponId];
  if (!stats) return null;
  if (!entity.weaponAmmo || typeof entity.weaponAmmo !== 'object') {
    entity.weaponAmmo = createWeaponAmmoRuntime(entity.weaponLoadout || defaultWeaponLoadout);
  }
  if (!entity.weaponAmmo[weaponId]) {
    entity.weaponAmmo[weaponId] = {
      ammoInMag: Math.max(0, Number(stats.magazineSize || 0)),
      reloadUntil: 0,
      reloadStartedAt: 0,
      reloadSourceAmmo: 0,
      autoReloadAt: 0,
      reloadedFlashUntil: 0
    };
  }
  const entry = entity.weaponAmmo[weaponId];
  const magazineSize = Math.max(0, Number(stats.magazineSize || 0));
  const reloadMs = Math.max(0, Number(stats.reloadMs || 0));
  const autoReloadDelayMs = STANDARD_AUTO_RELOAD_DELAY_MS;
  if (magazineSize <= 0 || reloadMs <= 0) return entry;
  if (entry.reloadUntil > 0) {
    if (now >= entry.reloadUntil) {
      entry.reloadUntil = 0;
      entry.reloadStartedAt = 0;
      entry.reloadSourceAmmo = 0;
      entry.autoReloadAt = 0;
      entry.ammoInMag = magazineSize;
      entry.reloadedFlashUntil = now + Number(deps.reloadedFlashHoldMs || 0);
      return entry;
    }
    const reloadStartedAt = Math.max(0, Number(entry.reloadStartedAt || now));
    const reloadSourceAmmo = Math.max(0, Number(entry.reloadSourceAmmo || 0));
    const progress = Math.max(0, Math.min(1, (now - reloadStartedAt) / Math.max(1, reloadMs)));
    const ammoFloat = reloadSourceAmmo + ((magazineSize - reloadSourceAmmo) * progress);
    entry.ammoInMag = Math.max(reloadSourceAmmo, Math.min(magazineSize, Math.floor(ammoFloat)));
    return entry;
  }
  if (Number(entry.autoReloadAt || 0) > 0 && now >= Number(entry.autoReloadAt || 0) && Number(entry.ammoInMag || 0) < magazineSize) {
    entry.reloadStartedAt = now;
    entry.reloadSourceAmmo = Math.max(0, Number(entry.ammoInMag || 0));
    entry.reloadUntil = now + reloadMs;
    entry.autoReloadAt = 0;
    entry.reloadedFlashUntil = 0;
  }
  return entry;
}

export function reloadRemainingForWeapon(room, entity, weaponId, now, deps) {
  const entry = room.syncWeaponAmmoState(entity, weaponId, now);
  if (!entry) return 0;
  return Math.max(0, Number(entry.reloadUntil || 0) - now);
}

export function beginWeaponReload(room, entity, weaponId, now, deps) {
  deps = deps || {};
  const weaponStats = deps.weaponStats || {};
  const stats = weaponStats[weaponId];
  const entry = room.syncWeaponAmmoState(entity, weaponId, now);
  if (!stats || !entry) return false;
  const magazineSize = Math.max(0, Number(stats.magazineSize || 0));
  const reloadMs = Math.max(0, Number(stats.reloadMs || 0));
  if (magazineSize <= 0 || reloadMs <= 0) return false;
  if (Number(entry.reloadUntil || 0) > now) return false;
  if (Number(entry.ammoInMag || 0) >= magazineSize) return false;
  entry.reloadStartedAt = now;
  entry.reloadSourceAmmo = Math.max(0, Number(entry.ammoInMag || 0));
  entry.reloadUntil = now + reloadMs;
  entry.autoReloadAt = 0;
  entry.reloadedFlashUntil = 0;
  return true;
}

export function consumeWeaponAmmo(room, entity, weaponId, now, deps) {
  deps = deps || {};
  const weaponStats = deps.weaponStats || {};
  const stats = weaponStats[weaponId];
  const entry = room.syncWeaponAmmoState(entity, weaponId, now);
  if (!stats || !entry) return true;
  const magazineSize = Math.max(0, Number(stats.magazineSize || 0));
  const autoReloadDelayMs = STANDARD_AUTO_RELOAD_DELAY_MS;
  if (entry.reloadUntil > now) {
    entry.reloadUntil = 0;
    entry.reloadStartedAt = 0;
    entry.reloadSourceAmmo = 0;
  }
  entry.autoReloadAt = 0;
  entry.ammoInMag = Math.max(0, Number(entry.ammoInMag || stats.magazineSize || 0) - 1);
  entry.reloadedFlashUntil = 0;
  if (entry.ammoInMag < magazineSize) {
    entry.autoReloadAt = now + autoReloadDelayMs;
  }
  return true;
}

export function applyPlasmaStreamHeat(player, profile, now, deps) {
  deps = deps || {};
  const clamp = deps.clamp;
  if (!player || !profile) return false;
  const sustainMs = Math.max(500, Number(profile.overheatMaxSustainMs || 2500));
  const tickMs = Math.max(1, Number(profile.tickIntervalMs || profile.cooldownMs || 100));
  player.streamHeat = clamp((player.streamHeat || 0) + (tickMs / sustainMs), 0, 1);
  if (player.streamHeat >= 1) {
    player.streamHeat = 1;
    player.streamOverheatedUntil = now + Math.max(100, Number(profile.overheatLockoutMs || 1600));
    return true;
  }
  return false;
}

export function handleWeaponLoadout(room, player, msg, deps) {
  deps = deps || {};
  const normalizeWeaponLoadout = deps.normalizeWeaponLoadout;
  const entityWeaponLoadout = deps.entityWeaponLoadout;
  const createWeaponAmmoRuntime = deps.createWeaponAmmoRuntime;
  const canEquipWeaponId = deps.canEquipWeaponId;
  if (!player) return;
  const nextLoadout = normalizeWeaponLoadout([msg && msg.slot1, msg && msg.slot2], entityWeaponLoadout(player));
  player.weaponLoadout = nextLoadout;
  player.weaponAmmo = createWeaponAmmoRuntime(nextLoadout);
  if (!canEquipWeaponId(player, player.weaponId)) {
    player.weaponId = nextLoadout[0];
  }
}

export function handleRoll(room, player, msg, deps) {
  deps = deps || {};
  const nowMs = deps.nowMs || Date.now;
  if (!player || !player.alive) return false;
  return beginEntityRoll(room, player, msg, nowMs());
}

export function handleEquipWeapon(room, player, msg, deps) {
  deps = deps || {};
  const weaponStats = deps.weaponStats || {};
  const canEquipWeaponId = deps.canEquipWeaponId;
  if (!player) return;
  const weaponId = String(msg.weaponId || '');
  if (!weaponStats[weaponId]) return;
  if (!canEquipWeaponId(player, weaponId)) return;
  player.weaponId = weaponId;
  player.streamHeat = 0;
  player.streamOverheatedUntil = 0;
}

export function handleReload(room, player, msg, deps) {
  deps = deps || {};
  const nowMs = deps.nowMs || Date.now;
  const weaponStats = deps.weaponStats || {};
  const canEquipWeaponId = deps.canEquipWeaponId;
  if (!player || !player.alive) return false;
  if (!room.canEntityUseWeapon(player)) return false;
  const weaponId = String(msg && msg.weaponId || player.weaponId || '');
  if (!weaponId || !weaponStats[weaponId]) return false;
  if (weaponId !== String(player.weaponId || '')) {
    if (typeof canEquipWeaponId !== 'function' || !canEquipWeaponId(player, weaponId)) return false;
    player.weaponId = weaponId;
  }
  return !!room.beginWeaponReload(player, weaponId, nowMs());
}

export function handleThrow(room, player, msg, ws, deps) {
  deps = deps || {};
  const normalizeThrowPayload = deps.normalizeThrowPayload;
  const throwableStats = deps.throwableStats || {};
  const nowMs = deps.nowMs;
  if (!player || !player.alive) return;
  if (!room.canEntityUseThrowable(player)) return;
  const throwPayload = normalizeThrowPayload(String(msg.throwableId || ''), msg.clientThrowId || '', msg.throwIntent || null);
  const throwableId = String(throwPayload.throwableId || '');
  const clientThrowId = throwPayload.clientThrowId;
  const def = sanitizeThrowableSpawnDef(throwableStats[throwableId], throwableId);
  if (!def) {
    if (ws && room.send) {
      room.send(ws, { t: deps.msgThrowReject, throwableId, clientThrowId, reason: 'invalid_throwable' });
    }
    return;
  }
  if (!room.consumeThrowCharge(player, throwableId)) {
    room.send(ws, { t: deps.msgThrowReject, throwableId, clientThrowId, reason: 'cooldown_or_empty' });
    return;
  }
  const projectile = room.spawnProjectile(player, throwableId, clientThrowId, throwPayload.throwIntent || null, {
    throwableDef: def
  });
  if (!projectile) {
    const inv = player.throwables && player.throwables[throwableId];
    if (inv) inv.charges = Math.min(inv.maxCharges, inv.charges + 1);
    room.send(ws, { t: deps.msgThrowReject, throwableId, clientThrowId, reason: 'spawn_failed' });
    return;
  }
  player.lastThrowAt = nowMs();
  player.muzzleFlashUntil = player.lastThrowAt + Number(deps.remoteMuzzleFlashHoldMs || 0);
  room.broadcast({
    t: deps.msgThrowSpawn,
    projectileId: projectile.id,
    ownerId: projectile.ownerId,
    clientThrowId: projectile.clientThrowId || '',
    throwableId: projectile.type
  });
}

export function handleFire(room, player, msg, deps) {
  deps = deps || {};
  const nowMs = deps.nowMs;
  const weaponStats = deps.weaponStats || {};
  const weaponFalloff = deps.weaponFalloff || {};
  const resolveHitscanTrace = deps.resolveHitscanTrace;
  const resolveHitscanShot = deps.resolveHitscanShot;
  const applyDamageFromSource = deps.applyDamageFromSource;
  const broadcastShotEffect = deps.broadcastShotEffect;
  const broadcastDamageEvent = deps.broadcastDamageEvent;
  const broadcastDeathRespawn = deps.broadcastDeathRespawn;
  const canEquipWeaponId = deps.canEquipWeaponId;
  const markFireEngagement = deps.markFireEngagement;
  const markSnapshotBurst = deps.markSnapshotBurst;
  const resolveHitscanShotTime = deps.resolveHitscanShotTime;
  const buildRewoundHitscanTarget = deps.buildRewoundHitscanTarget;
  const authoritativeHitscanOrigin = deps.authoritativeHitscanOrigin;
  const authoritativeHitscanForward = deps.authoritativeHitscanForward;
  const hitscanAimOriginMaxOffset = Number(deps.hitscanAimOriginMaxOffset || 0.9);
  const playerEyeHeight = Number(deps.playerEyeHeight || 0);
  const remoteMuzzleFlashHoldMs = Number(deps.remoteMuzzleFlashHoldMs || 0);

  if (!player || !player.alive) return;
  if (!room.canEntityUseWeapon(player)) return;

  const weaponId = String(msg.weaponId || 'rifle');
  const stats = weaponStats[weaponId];
  if (!stats) return;
  if (!canEquipWeaponId(player, weaponId)) return;
  if (weaponId === 'sniper' && !(msg && msg.adsActive)) return;
  player.weaponId = weaponId;

  const now = nowMs();
  const prev = player.lastShotAt[weaponId] || 0;
  const shotToken = String(msg.shotToken || '');
  const ammoEntry = room.syncWeaponAmmoState(player, weaponId, now);
  if (!player.lastShotTokenByWeapon) player.lastShotTokenByWeapon = {};
  if (shotToken && player.lastShotTokenByWeapon && player.lastShotTokenByWeapon[weaponId] === shotToken) return;
  if ((now - prev) < stats.cooldownMs) return;
  if (room.reloadRemainingForWeapon(player, weaponId, now) > 0 && ammoEntry && Number(ammoEntry.ammoInMag || 0) <= 0) {
    return;
  }
  if (ammoEntry && Number(ammoEntry.ammoInMag || 0) <= 0) {
    return;
  }
  let engagedIds = [];
  if (typeof markFireEngagement === 'function') {
    engagedIds = markFireEngagement(player, msg, now) || [];
  }
  player.lastShotAt[weaponId] = now;
  if (shotToken) player.lastShotTokenByWeapon[weaponId] = shotToken;
  player.muzzleFlashUntil = now + remoteMuzzleFlashHoldMs;
  if (typeof markSnapshotBurst === 'function') {
    markSnapshotBurst([player.id].concat(engagedIds), [player.id].concat(engagedIds), now);
  }
  room.consumeWeaponAmmo(player, weaponId, now);
  const shotServerTime = typeof resolveHitscanShotTime === 'function'
    ? Number(resolveHitscanShotTime(msg, now) || now)
    : now;
  const fallbackAimForward = typeof authoritativeHitscanForward === 'function'
    ? authoritativeHitscanForward(player, shotServerTime, now)
    : room.entityForward(player);
  let aimForward = fallbackAimForward;
  if (msg && msg.aimForward && typeof msg.aimForward === 'object') {
    const rawX = Number(msg.aimForward.x || 0);
    const rawY = Number(msg.aimForward.y || 0);
    const rawZ = Number(msg.aimForward.z || 0);
    const len = Math.sqrt((rawX * rawX) + (rawY * rawY) + (rawZ * rawZ));
    if (Number.isFinite(len) && len > 0.000001) {
      const normalized = { x: rawX / len, y: rawY / len, z: rawZ / len };
      const authoritativeForward = fallbackAimForward;
      const dot = (normalized.x * authoritativeForward.x) + (normalized.y * authoritativeForward.y) + (normalized.z * authoritativeForward.z);
      if (dot >= 0.1) {
        aimForward = normalized;
      }
    }
  }
  const fallbackAimOrigin = typeof authoritativeHitscanOrigin === 'function'
    ? authoritativeHitscanOrigin(player, shotServerTime, now)
    : {
        x: Number(player.x || 0),
        y: Number(player.y || playerEyeHeight),
        z: Number(player.z || 0)
      };
  let aimOrigin = (msg && msg.aimOrigin && typeof msg.aimOrigin === 'object')
    ? {
        x: Number.isFinite(Number(msg.aimOrigin.x)) ? Number(msg.aimOrigin.x) : Number(player.x || 0),
        y: Number.isFinite(Number(msg.aimOrigin.y)) ? Number(msg.aimOrigin.y) : Number(player.y || playerEyeHeight),
        z: Number.isFinite(Number(msg.aimOrigin.z)) ? Number(msg.aimOrigin.z) : Number(player.z || 0)
      }
    : fallbackAimOrigin;
  const aimOriginDx = Number(aimOrigin.x || 0) - Number(fallbackAimOrigin.x || 0);
  const aimOriginDy = Number(aimOrigin.y || 0) - Number(fallbackAimOrigin.y || 0);
  const aimOriginDz = Number(aimOrigin.z || 0) - Number(fallbackAimOrigin.z || 0);
  const aimOriginDelta = Math.sqrt((aimOriginDx * aimOriginDx) + (aimOriginDy * aimOriginDy) + (aimOriginDz * aimOriginDz));
  if (!Number.isFinite(aimOriginDelta) || aimOriginDelta > hitscanAimOriginMaxOffset) {
    aimOrigin = fallbackAimOrigin;
  }
  const targets = room.getAliveEntities()
    .filter((entity) => room.canTargetEntity(entity, player.id))
    .map((entity) => {
      if (typeof buildRewoundHitscanTarget === 'function') {
        return buildRewoundHitscanTarget(entity, shotServerTime, now);
      }
      return entity;
    })
    .filter(Boolean);
  const shotContext = {
    aimOrigin,
    aimForward,
    weaponStats: { ...stats, id: weaponId },
    falloffBands: weaponFalloff[weaponId] || [],
    adsActive: !!(msg && msg.adsActive),
    viewFovDeg: Number(msg && msg.viewFovDeg),
    shotToken,
    targets,
    worldBoxes: room.worldCollidables()
  };
  const shots = resolveHitscanShot(shotContext);
  if (typeof broadcastShotEffect === 'function') {
    const traces = typeof resolveHitscanTrace === 'function'
      ? resolveHitscanTrace({ ...shotContext, includeMisses: true })
      : shots;
    if (Array.isArray(traces) && traces.length > 0) {
      const maxVisualTraces = weaponId === 'shotgun' ? 8 : 1;
      const visualTraces = [];
      for (let i = 0; i < traces.length; i++) {
        const trace = traces[i];
        if (!trace || !trace.point) continue;
        visualTraces.push({
          x: Number(trace.point.x || 0),
          y: Number(trace.point.y || 0),
          z: Number(trace.point.z || 0),
          pelletIndex: Number.isFinite(Number(trace.pelletIndex)) ? Number(trace.pelletIndex) : 0,
          hitType: trace.hitType === 'head' ? 'head' : (trace.hitType === 'body' ? 'body' : 'miss')
        });
        if (visualTraces.length >= maxVisualTraces) break;
      }
      if (visualTraces.length > 0) {
        broadcastShotEffect(room, {
          sourceId: player.id,
          weaponId,
          shotToken,
          origin: {
            x: Number(aimOrigin.x || 0),
            y: Number(aimOrigin.y || 0),
            z: Number(aimOrigin.z || 0)
          },
          traces: visualTraces
        });
      }
    }
  }
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const resolvedShotTarget = shot ? shot.target : null;
    const targetId = resolvedShotTarget && resolvedShotTarget.id ? String(resolvedShotTarget.id) : '';
    const liveTarget = targetId && typeof room.getEntityById === 'function'
      ? room.getEntityById(targetId)
      : resolvedShotTarget;
    if (!room.canTargetEntity(liveTarget, player.id)) continue;
    const out = applyDamageFromSource(player, liveTarget, shot.damage, {
      hitType: shot.hitType === 'head' ? 'head' : 'body',
      weaponId,
      sourceKind: 'weapon',
      armorBufferMode: String(stats.armorBufferMode || 'normal')
    });
    if (!out) continue;
    broadcastDamageEvent(
      room,
      player.id,
      liveTarget,
      out,
      shot.hitType === 'head' ? 'head' : 'body',
      weaponId,
      shotToken,
      Number.isFinite(Number(shot && shot.pelletIndex)) ? Number(shot.pelletIndex) : null
    );
    if (out.killed) {
      broadcastDeathRespawn(room, liveTarget);
    }
  }
}
