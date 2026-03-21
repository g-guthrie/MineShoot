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
  const def = throwableStats[throwableId];
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
    hitRadius: Number(def.hitRadius || 1.2),
    stickyDelaySec: (typeof def.stickExplodeDelay === 'number' ? def.stickExplodeDelay : 0),
    catchRadius: Number(def.catchRadius || 0),
    trackDurationSec: Number(def.trackDuration || 0),
    trackLerp: Number(def.trackLerp || 0),
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

export function isEntityChoked(entity, now) {
  return !!(entity && entity.alive && entity.chokeVictimState && (entity.chokeVictimState.endsAt || 0) > now);
}

export function isEntityJustBeenHooked(entity, now) {
  return !!(entity && entity.alive && entity.justBeenHookedState && (entity.justBeenHookedState.endsAt || 0) > now);
}

export function isEntityActionRestricted(entity, actionType, now) {
  if (!entity || !entity.alive) return false;
  if (actionType === 'weapon') return Number(entity.weaponLockUntil || 0) > now;
  if (actionType === 'throwable') return Number(entity.throwableLockUntil || 0) > now;
  if (actionType === 'ability') return Number(entity.abilityLockUntil || 0) > now;
  return false;
}

export function isEntityMovementLocked(room, entity, now) {
  if (!entity || !entity.alive) return false;
  return ((entity.stunUntil || 0) > now) ||
    !!entity.hookPullState ||
    room.isEntityChoked(entity, now) ||
    room.isEntityJustBeenHooked(entity, now);
}

export function canEntityUseWeapon(room, entity, now) {
  return !!(entity && entity.alive) && !room.isEntityMovementLocked(entity, now) && !room.isEntityActionRestricted(entity, 'weapon', now);
}

export function canEntityUseThrowable(room, entity, now) {
  return !!(entity && entity.alive) && !room.isEntityMovementLocked(entity, now) && !room.isEntityActionRestricted(entity, 'throwable', now);
}

export function canEntityUseAbility(room, entity, now) {
  return !!(entity && entity.alive) && !room.isEntityMovementLocked(entity, now) && !room.isEntityActionRestricted(entity, 'ability', now);
}

export function isEntityActionLocked(room, entity, now) {
  if (!entity || !entity.alive) return false;
  return room.isEntityMovementLocked(entity, now) ||
    room.isEntityActionRestricted(entity, 'weapon', now) ||
    room.isEntityActionRestricted(entity, 'throwable', now) ||
    room.isEntityActionRestricted(entity, 'ability', now);
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

export function applyJustBeenHooked(target, durationSec, deps) {
  deps = deps || {};
  const nowMs = deps.nowMs;
  if (!target || !target.alive) return;
  const startedAt = nowMs();
  const endsAt = startedAt + Math.max(0, Math.round(Number(durationSec || 0) * 1000));
  target.justBeenHookedState = { startedAt, endsAt };
  target.stunUntil = Math.max(target.stunUntil || 0, endsAt);
}

export function pullEntityToward(player, target, pullDistance, pullSpeed, stunDuration, deps) {
  deps = deps || {};
  const nowMs = deps.nowMs;
  if (!player || !target || !player.alive || !target.alive) return false;
  const dx = player.x - target.x;
  const dz = player.z - target.z;
  const currentDist = Math.sqrt((dx * dx) + (dz * dz));
  const desiredDist = Math.max(1.5, Number(pullDistance || 3.2));
  const travelDist = Math.max(0, currentDist - desiredDist);
  const speed = Math.max(8, Number(pullSpeed || 26));
  const durationMs = Math.max(120, Math.round((travelDist / speed) * 1000));
  target.hookPullState = {
    sourceId: player.id,
    pullDistance: desiredDist,
    pullSpeed: speed,
    postHookStunDuration: Math.max(0, Number(stunDuration || 0)),
    startedAt: nowMs(),
    endsAt: nowMs() + durationMs,
    facingYaw: Math.atan2(player.x - target.x, player.z - target.z) + Math.PI
  };
  return true;
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

export function deadeyeCandidates(room, player, range, minDot, maxTargets) {
  const hits = room.hostilesInCone(player, range, minDot);
  const origin = room.entityAimTargetPosition(player);
  const forward = room.entityForward(player);
  const out = [];
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    const targetPos = room.entityAimTargetPosition(hit.entity);
    if (!room.hasWorldLineOfSight(origin, targetPos, range)) continue;
    const dx = targetPos.x - origin.x;
    const dy = targetPos.y - origin.y;
    const dz = targetPos.z - origin.z;
    const dist = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz)) || 1;
    out.push({
      id: hit.entity.id,
      dist: hit.dist,
      dot: ((forward.x * dx) + (forward.y * dy) + (forward.z * dz)) / dist
    });
  }
  out.sort((a, b) => {
    if (Math.abs((b.dot || 0) - (a.dot || 0)) > 0.0001) return (b.dot || 0) - (a.dot || 0);
    return a.dist - b.dist;
  });
  return out.slice(0, Math.max(1, maxTargets || 1));
}

export function resolveClassAimPoint(room, player, msg, maxRange, deps) {
  deps = deps || {};
  const addScaled3 = deps.addScaled3;
  const range = Math.max(1, Number(maxRange || 24));
  const forward = room.entityForward(player);
  const eye = room.entityAimTargetPosition(player);
  const fallback = addScaled3(eye, forward, range);
  const point = room.readClassAimPoint(player, msg && msg.aimPoint, range);
  return point || fallback;
}

export function syncWeaponAmmoState(room, entity, weaponId, now, deps) {
  deps = deps || {};
  const weaponStats = deps.weaponStats || {};
  const createWeaponAmmoRuntime = deps.createWeaponAmmoRuntime;
  const defaultWeaponLoadout = deps.defaultWeaponLoadout || [];
  if (!entity || !weaponId) return null;
  const stats = weaponStats[weaponId];
  if (!stats || !(Number(stats.magazineSize || 0) > 0)) return null;
  if (!entity.weaponAmmo || typeof entity.weaponAmmo !== 'object') {
    entity.weaponAmmo = createWeaponAmmoRuntime(entity.weaponLoadout || defaultWeaponLoadout);
  }
  if (!entity.weaponAmmo[weaponId]) {
    entity.weaponAmmo[weaponId] = {
      ammoInMag: Math.max(0, Number(stats.magazineSize || 0)),
      reloadUntil: 0,
      reloadedFlashUntil: 0
    };
  }
  const entry = entity.weaponAmmo[weaponId];
  if (entry.reloadUntil > 0 && now >= entry.reloadUntil) {
    entry.reloadUntil = 0;
    entry.ammoInMag = Math.max(0, Number(stats.magazineSize || 0));
    entry.reloadedFlashUntil = now + Number(deps.reloadedFlashHoldMs || 0);
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
  const reloadMs = Math.max(0, Number(stats.reloadMs || 0));
  if (reloadMs <= 0 || entry.reloadUntil > now) return false;
  if (Number(entry.ammoInMag || 0) >= Math.max(0, Number(stats.magazineSize || 0))) return false;
  entry.ammoInMag = 0;
  entry.reloadUntil = now + reloadMs;
  entry.reloadedFlashUntil = 0;
  return true;
}

export function consumeWeaponAmmo(room, entity, weaponId, now, deps) {
  deps = deps || {};
  const weaponStats = deps.weaponStats || {};
  const stats = weaponStats[weaponId];
  const entry = room.syncWeaponAmmoState(entity, weaponId, now);
  if (!stats || !entry) return true;
  entry.ammoInMag = Math.max(0, Number(entry.ammoInMag || stats.magazineSize || 0) - 1);
  entry.reloadedFlashUntil = 0;
  if (entry.ammoInMag <= 0) {
    room.beginWeaponReload(entity, weaponId, now);
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
  const nowMs = typeof deps.nowMs === 'function' ? deps.nowMs : () => 0;
  const weaponStats = deps.weaponStats || {};
  const canEquipWeaponId = typeof deps.canEquipWeaponId === 'function'
    ? deps.canEquipWeaponId
    : () => true;
  if (!player || !player.alive) return false;
  if (room && typeof room.canEntityUseWeapon === 'function' && !room.canEntityUseWeapon(player)) return false;
  const weaponId = String(msg && msg.weaponId || player.weaponId || '');
  if (!weaponStats[weaponId]) return false;
  if (!canEquipWeaponId(player, weaponId)) return false;
  player.weaponId = weaponId;
  return !!room.beginWeaponReload(player, weaponId, nowMs());
}

export function handleClassQueue(room, player, msg, ws, deps) {
  deps = deps || {};
  const normalizeAbilityId = deps.normalizeAbilityId;
  if (!player) return;
  player.abilityId = normalizeAbilityId(msg && msg.abilityId);
  room.send(ws, {
    t: deps.msgClassChanged,
    classId: 'abilities',
    weaponId: player.weaponId || 'rifle',
    abilityId: player.abilityId || deps.defaultAbilityId
  });
}

export function handleThrow(room, player, msg, ws, deps) {
  deps = deps || {};
  const normalizeThrowPayload = deps.normalizeThrowPayload;
  const throwableStats = deps.throwableStats || {};
  const nowMs = deps.nowMs;
  if (!player || !player.alive) return;
  if (!room.canEntityUseThrowable(player)) return;
  const throwableId = String(msg.throwableId || '');
  const throwPayload = normalizeThrowPayload(throwableId, msg.clientThrowId || '', msg.throwIntent || null);
  const clientThrowId = throwPayload.clientThrowId;
  const def = throwableStats[throwableId];
  if (!def) return;
  if (!room.consumeThrowCharge(player, throwableId)) {
    room.send(ws, { t: deps.msgThrowReject, throwableId, clientThrowId, reason: 'cooldown_or_empty' });
    return;
  }
  const projectile = room.spawnProjectile(player, throwableId, clientThrowId, throwPayload.throwIntent || null);
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
  const resolveHitscanShot = deps.resolveHitscanShot;
  const applyDamageFromSource = deps.applyDamageFromSource;
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
  if (room.reloadRemainingForWeapon(player, weaponId, now) > 0) return;
  if (ammoEntry && Number(ammoEntry.ammoInMag || 0) <= 0) {
    room.beginWeaponReload(player, weaponId, now);
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
  const shots = resolveHitscanShot({
    aimOrigin,
    aimForward,
    weaponStats: { ...stats, id: weaponId },
    falloffBands: weaponFalloff[weaponId] || [],
    adsActive: !!(msg && msg.adsActive),
    viewFovDeg: Number(msg && msg.viewFovDeg),
    shotToken,
    targets,
    worldBoxes: room.worldCollidables()
  });
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
