import { nowMs, distance3, normalize3, dot3 } from '../transport.js';
import { integrateProjectileMotion } from '../sim/projectiles.js';
import { gameplayTuning } from '../../../shared/gameplay-tuning.js';
import { protocol } from '../../../shared/protocol.js';
import { steerHomingVelocity } from '../../../shared/seek-core.js';
import {
  EYE_HEIGHT,
} from '../../../shared/entity-constants.js';
import {
  buildCombatHitboxesFromEntityPosition
} from '../../../shared/entity-points.js';
import {
  applyDamageFromSource,
  broadcastDamageEvent,
  broadcastDeathRespawn,
  projectileDamageHit,
  explodeProjectile
} from './CombatService.js';

const THROWABLE_STATS = gameplayTuning.throwables;

const MSG_S2C = protocol.msg.s2c;

const PLAYER_EYE_HEIGHT_WU = EYE_HEIGHT;
const KNIFE_HEADSHOT_HEIGHT_DELTA_WU = 0.45;

function feetY(entity) {
  return Number(entity && entity.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU;
}

function hitboxesForEntity(entity, now = Date.now()) {
  if (!entity) return [];
  const hitboxes = buildCombatHitboxesFromEntityPosition(entity, { nowMs: now });
  const out = [];
  if (hitboxes.bodyBox) out.push({ type: 'body', ...hitboxes.bodyBox });
  if (hitboxes.headBox) out.push({ type: 'head', ...hitboxes.headBox });
  return out;
}

function expandBox(box, radius) {
  return {
    min: {
      x: Number(box.min.x || 0) - radius,
      y: Number(box.min.y || 0) - radius,
      z: Number(box.min.z || 0) - radius
    },
    max: {
      x: Number(box.max.x || 0) + radius,
      y: Number(box.max.y || 0) + radius,
      z: Number(box.max.z || 0) + radius
    }
  };
}

function pointAlong(origin, dir, distance) {
  return {
    x: Number(origin.x || 0) + (Number(dir.x || 0) * distance),
    y: Number(origin.y || 0) + (Number(dir.y || 0) * distance),
    z: Number(origin.z || 0) + (Number(dir.z || 0) * distance)
  };
}

function entityTrackPoint(entity) {
  return {
    x: Number(entity && entity.x || 0),
    y: feetY(entity) + 1.0,
    z: Number(entity && entity.z || 0)
  };
}

function molotovInnerRadius(def) {
  const radius = Math.max(0.2, Number(def && def.fireRadius || 0));
  let inner = Number(def && def.fireInnerRadius);
  if (!Number.isFinite(inner) || inner <= 0) inner = radius * 0.55;
  return Math.max(0.2, Math.min(radius, inner));
}

function molotovOuterDamageScale(def) {
  let scale = Number(def && def.fireOuterDamageScale);
  if (!Number.isFinite(scale)) scale = 0.38;
  return Math.max(0.1, Math.min(1, scale));
}

function molotovMaxHeightDelta(def) {
  let value = Number(def && def.fireMaxHeightDelta);
  if (!Number.isFinite(value)) value = 1.5;
  return Math.max(0.1, value);
}

function molotovDamageScale(def, dist, radius) {
  const maxRadius = Math.max(0.2, Number(radius || (def && def.fireRadius) || 0));
  const innerRadius = molotovInnerRadius(def);
  const edgeScale = molotovOuterDamageScale(def);
  const distance = Math.max(0, Number(dist || 0));
  if (distance <= innerRadius) return 1;
  const outerSpan = Math.max(0.001, maxRadius - innerRadius);
  const t = Math.max(0, Math.min(1, (distance - innerRadius) / outerSpan));
  return 1 - ((1 - edgeScale) * t);
}

function molotovLingerDurationMs(def) {
  let value = Number(def && def.fireLingerDuration);
  if (!Number.isFinite(value)) value = 0.9;
  return Math.max(0, Math.round(value * 1000));
}

function molotovLingerTickDamage(def) {
  let value = Number(def && def.fireLingerTickDamage);
  if (!Number.isFinite(value)) value = Math.max(1, Math.round(Number(def && def.fireTickDamage || 18) * 0.45));
  return Math.max(1, Math.round(value));
}

function molotovLingerTickRateMs(def) {
  let value = Number(def && def.fireLingerTickRate);
  if (!Number.isFinite(value)) value = 0.4;
  return Math.max(100, Math.round(value * 1000));
}

function refreshMolotovBurn(entity, ownerId, now, def) {
  if (!entity) return;
  entity.burnUntil = Math.max(Number(entity.burnUntil || 0), now + molotovLingerDurationMs(def));
  if (!entity.burnTickAt || entity.burnTickAt < now) {
    entity.burnTickAt = now + molotovLingerTickRateMs(def);
  }
  entity.burnSourceId = String(ownerId || entity.burnSourceId || '');
}

function firstEntityHit(room, projectile, origin, end, expandRadius, trackedOnlyId = '', now = Date.now()) {
  if (!projectile || !origin || !end) return null;
  const dx = Number(end.x || 0) - Number(origin.x || 0);
  const dy = Number(end.y || 0) - Number(origin.y || 0);
  const dz = Number(end.z || 0) - Number(origin.z || 0);
  const distance = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
  if (!(distance > 0.0001)) return null;
  const dir = normalize3(dx, dy, dz);
  const radius = Math.max(0, Number(expandRadius || 0));

  const entities = [];
  for (const p of room.players.values()) entities.push(p);

  let best = null;
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!room.canTargetEntity(entity, projectile.ownerId)) continue;
    if (trackedOnlyId && entity.id !== trackedOnlyId) continue;
    const boxes = hitboxesForEntity(entity, now);
    for (let b = 0; b < boxes.length; b++) {
      const box = radius > 0 ? expandBox(boxes[b], radius) : boxes[b];
      const hit = intersectProjectileRayAabb(origin, dir, box, distance);
      if (!hit) continue;
      if (best && Number(best.distance || Infinity) <= Number(hit.distance || Infinity)) continue;
      best = {
        entity,
        hitType: boxes[b].type,
        distance: Number(hit.distance || 0),
        point: pointAlong(origin, dir, Number(hit.distance || 0))
      };
    }
  }
  return best;
}

function intersectProjectileRayAabb(origin, dir, box, maxDistance) {
  if (!box || !box.min || !box.max) return null;
  let tmin = -Infinity;
  let tmax = Infinity;
  let enterAxis = '';
  let enterSign = 0;
  let exitAxis = '';
  let exitSign = 0;
  const axes = ['x', 'y', 'z'];
  for (let i = 0; i < axes.length; i++) {
    const axis = axes[i];
    const o = Number(origin && origin[axis] || 0);
    const d = Number(dir && dir[axis] || 0);
    const min = Number(box.min[axis] || 0);
    const max = Number(box.max[axis] || 0);
    if (Math.abs(d) < 0.000001) {
      if (o < min || o > max) return null;
      continue;
    }
    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    let sign1 = d > 0 ? -1 : 1;
    let sign2 = -sign1;
    if (t1 > t2) {
      const swapT = t1;
      t1 = t2;
      t2 = swapT;
      const swapSign = sign1;
      sign1 = sign2;
      sign2 = swapSign;
    }
    if (t1 > tmin) {
      tmin = t1;
      enterAxis = axis;
      enterSign = sign1;
    }
    if (t2 < tmax) {
      tmax = t2;
      exitAxis = axis;
      exitSign = sign2;
    }
    if (tmin > tmax) return null;
  }
  const hitDistance = tmin >= 0 ? tmin : tmax;
  if (hitDistance < 0 || hitDistance > maxDistance) return null;
  const axis = tmin >= 0 ? enterAxis : exitAxis;
  const sign = tmin >= 0 ? enterSign : exitSign;
  return {
    distance: hitDistance,
    normal: axis ? {
      x: axis === 'x' ? sign : 0,
      y: axis === 'y' ? sign : 0,
      z: axis === 'z' ? sign : 0
    } : { x: 0, y: 0, z: 0 }
  };
}

function worldProjectileHit(room, start, end) {
  const boxes = room && typeof room.worldCollidables === 'function'
    ? room.worldCollidables()
    : [];
  if (!boxes || !boxes.length || !start || !end) return null;
  const dx = Number(end.x || 0) - Number(start.x || 0);
  const dy = Number(end.y || 0) - Number(start.y || 0);
  const dz = Number(end.z || 0) - Number(start.z || 0);
  const distance = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
  if (!(distance > 0.0001)) return null;
  const dir = normalize3(dx, dy, dz);
  let best = null;
  for (let i = 0; i < boxes.length; i++) {
    const hit = intersectProjectileRayAabb(start, dir, boxes[i], distance);
    if (!hit) continue;
    if (best && Number(best.distance || Infinity) <= Number(hit.distance || Infinity)) continue;
    best = hit;
  }
  if (!best) return null;
  const settleDistance = Math.max(0, Number(best.distance || 0) - 0.02);
  return {
    distance: Number(best.distance || 0),
    point: {
      x: Number(start.x || 0) + (dir.x * Number(best.distance || 0)),
      y: Number(start.y || 0) + (dir.y * Number(best.distance || 0)),
      z: Number(start.z || 0) + (dir.z * Number(best.distance || 0))
    },
    settlePoint: {
      x: Number(start.x || 0) + (dir.x * settleDistance),
      y: Number(start.y || 0) + (dir.y * settleDistance),
      z: Number(start.z || 0) + (dir.z * settleDistance)
    },
    normal: best.normal || { x: 0, y: 0, z: 0 }
  };
}

export function tickProjectiles(room, dtSec) {
  if (room.projectiles.size === 0) return;
  const now = room && typeof room.currentNowMs === 'function' ? room.currentNowMs() : nowMs();
  const toRemove = [];
  const entities = [];
  for (const p of room.players.values()) entities.push(p);

  const stickProjectile = (proj, targetEntity, x, y, z) => {
    if (!proj) return false;
    const delaySec = Math.max(0.1, Number(proj.stickyDelaySec || 0.65));
    proj.vx = 0;
    proj.vy = 0;
    proj.vz = 0;
    proj.seekingTargetId = '';
    proj.seekingUntil = 0;
    proj.stickyUntil = now + Math.round(delaySec * 1000);
    proj.stuckToTargetId = targetEntity ? targetEntity.id : '';
    if (targetEntity) {
      const stickH = Number((THROWABLE_STATS[proj.type] || {}).stickHeight || 0.9);
      const entityFootY = feetY(targetEntity);
      proj.x = targetEntity.x;
      proj.y = entityFootY + stickH;
      proj.z = targetEntity.z;
      proj.stuckOffsetX = 0;
      proj.stuckOffsetY = stickH;
      proj.stuckOffsetZ = 0;
    } else {
      proj.x = Number(x || proj.x);
      proj.y = Number(y || proj.y);
      proj.z = Number(z || proj.z);
      proj.stuckOffsetX = 0;
      proj.stuckOffsetY = 0;
      proj.stuckOffsetZ = 0;
    }
    return true;
  };

  room.projectiles.forEach((p) => {
    const def = THROWABLE_STATS[p.type];
    if (!def || !p.alive) {
      toRemove.push(p.id);
      return;
    }

    p.age += dtSec;
    if (p.stickyUntil && p.stickyUntil > 0) {
      if (p.stuckToTargetId) {
        const stuckTarget = room.getEntityById(p.stuckToTargetId);
        if (stuckTarget && stuckTarget.alive) {
          p.x = stuckTarget.x + (p.stuckOffsetX || 0);
          p.y = feetY(stuckTarget) + (p.stuckOffsetY || 0);
          p.z = stuckTarget.z + (p.stuckOffsetZ || 0);
        }
      }
      if (now >= p.stickyUntil) {
        explodeProjectile(room, p, p.x, p.y, p.z);
        toRemove.push(p.id);
      }
      return;
    }

    if (p.type === 'plasma' && p.seekingTargetId) {
      const seekTarget = room.getEntityById(p.seekingTargetId);
      if (!seekTarget || !seekTarget.alive || p.age >= (p.seekingUntil || 0)) {
        if (seekTarget && seekTarget.alive) {
          const stickH = Number(def.stickHeight || 0.9);
          const sFootY = feetY(seekTarget);
          if (stickProjectile(p, seekTarget, seekTarget.x, sFootY + stickH, seekTarget.z)) {
            room.broadcast({
              t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type,
              impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: seekTarget.id
            });
          }
        } else {
          stickProjectile(p, null, p.x, p.y, p.z);
          room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type, impactType: 'world', x: p.x, y: p.y, z: p.z });
        }
        return;
      }
      const stickH = Number(def.stickHeight || 0.9);
      const tFootY = feetY(seekTarget);
      const tx = seekTarget.x;
      const ty = tFootY + stickH;
      const tz = seekTarget.z;
      const sdx = tx - p.x;
      const sdy = ty - p.y;
      const sdz = tz - p.z;
      const sDist = Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz);
      if (sDist <= 0.3) {
        if (stickProjectile(p, seekTarget, tx, ty, tz)) {
          room.broadcast({
            t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type,
            impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: seekTarget.id
          });
        }
        return;
      }
      const seekSpd = Number(def.seekSpeed || 32);
      const seekLrp = Number(def.seekLerp || 8);
      const nextVel = steerHomingVelocity({
        projectilePos: { x: p.x, y: p.y, z: p.z },
        targetPos: { x: tx, y: ty, z: tz },
        velocity: { x: p.vx, y: p.vy, z: p.vz },
        speed: seekSpd,
        boost: 0,
        lerp: seekLrp,
        dt: dtSec
      });
      p.vx = Number(nextVel.x || 0);
      p.vy = Number(nextVel.y || 0);
      p.vz = Number(nextVel.z || 0);
      p.gravity = 0;
      const prevSeekPos = { x: p.x, y: p.y, z: p.z };
      integrateProjectileMotion(p, dtSec, false);
      const seekWallHit = worldProjectileHit(room, prevSeekPos, { x: p.x, y: p.y, z: p.z });
      if (seekWallHit) {
        stickProjectile(p, null, seekWallHit.point.x, seekWallHit.point.y, seekWallHit.point.z);
        room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type, impactType: 'world', x: p.x, y: p.y, z: p.z });
      }
      return;
    }

    if ((p.lifeSec > 0 && p.age >= p.lifeSec) || (p.fuseSec > 0 && p.age >= p.fuseSec)) {
      if (p.type === 'knife' || p.type === 'plasma_stream') {
        room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type, impactType: 'despawn', x: p.x, y: p.y, z: p.z });
      } else {
        explodeProjectile(room, p, p.x, p.y, p.z);
      }
      toRemove.push(p.id);
      return;
    }

    const isTrackingProjectile = (p.type === 'missile' || p.type === 'plasma_stream');
    if (isTrackingProjectile) {
      const acquireRange = Number(def.acquireRange || 24);
      let target = null;
      if (p.lockTargetId) {
        const locked = room.getEntityById(p.lockTargetId);
        if (room.canTargetEntity(locked, p.ownerId) && distance3(locked, p) <= acquireRange) {
          target = locked;
        }
      }
      if (!target) {
        target = room.nearestTargetForProjectile(p, acquireRange);
      }
      if (target) {
        const toTarget = normalize3(
          target.x - p.x,
          ((target.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0) - p.y,
          target.z - p.z
        );
        const velSq = (p.vx * p.vx) + (p.vy * p.vy) + (p.vz * p.vz);
        const baseDir = velSq > 0.0001
          ? normalize3(p.vx, p.vy, p.vz)
          : normalize3(p.launchDirX || 0, p.launchDirY || 0, p.launchDirZ || -1);
        const halfAngleDeg = Number(
          (p.type === 'missile' || p.type === 'plasma_stream')
            ? (def.lockHalfAngleDeg || 30)
            : (def.acquireHalfAngleDeg || 35)
        );
        const cosLimit = Math.cos((halfAngleDeg * Math.PI) / 180);
        if (dot3(baseDir, toTarget) >= cosLimit) {
          const nextVel = steerHomingVelocity({
            projectilePos: { x: p.x, y: p.y, z: p.z },
            targetPos: {
              x: target.x,
              y: ((target.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0),
              z: target.z
            },
            velocity: { x: p.vx, y: p.vy, z: p.vz },
            speed: Number(def.speed || 14),
            boost: Number(def.homingBoost || 2),
            lerp: Number(def.homingLerp || 3.2),
            dt: dtSec
          });
          p.vx = Number(nextVel.x || 0);
          p.vy = Number(nextVel.y || 0);
          p.vz = Number(nextVel.z || 0);
        }
      }
    }

    p.gravity = Number(def.gravity || 0);
    const prevPos = { x: p.x, y: p.y, z: p.z };
    integrateProjectileMotion(p, dtSec, true);
    const obstacleHit = worldProjectileHit(room, prevPos, { x: p.x, y: p.y, z: p.z });
    if (obstacleHit) {
      if (p.type === 'knife' || p.type === 'plasma_stream') {
        room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type, impactType: 'world', x: obstacleHit.point.x, y: obstacleHit.point.y, z: obstacleHit.point.z });
        toRemove.push(p.id);
        return;
      }
      if (p.type === 'plasma') {
        p.x = obstacleHit.point.x;
        p.y = obstacleHit.point.y;
        p.z = obstacleHit.point.z;
        if (stickProjectile(p, null, p.x, p.y, p.z)) {
          room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type, impactType: 'world', x: p.x, y: p.y, z: p.z });
          return;
        }
      }
      if (p.type === 'frag') {
        p.x = obstacleHit.settlePoint.x;
        p.y = obstacleHit.settlePoint.y;
        p.z = obstacleHit.settlePoint.z;
        const normal = obstacleHit.normal || { x: 0, y: 0, z: 0 };
        const bounceDamping = Number(def.bounceVelocityDamping || 0.4);
        const verticalBounce = Number(def.bounceVerticalDamping || 0.42);
        if (Math.abs(Number(normal.y || 0)) > 0.5) {
          p.vy = Math.abs(p.vy) * verticalBounce;
          p.vx *= bounceDamping;
          p.vz *= bounceDamping;
        } else if (Math.abs(Number(normal.x || 0)) > 0.5) {
          p.vx = -p.vx * bounceDamping;
          p.vy *= bounceDamping;
          p.vz *= bounceDamping;
        } else if (Math.abs(Number(normal.z || 0)) > 0.5) {
          p.vz = -p.vz * bounceDamping;
          p.vx *= bounceDamping;
          p.vy *= bounceDamping;
        } else {
          p.vx *= bounceDamping;
          p.vy *= bounceDamping;
          p.vz *= bounceDamping;
        }
        p.bounces++;
        if (p.bounces > (def.bounceMaxCount || 2) || ((p.vx * p.vx) + (p.vy * p.vy) + (p.vz * p.vz)) < (def.bounceStopSpeedSq || 2.5)) {
          p.vx = 0;
          p.vy = 0;
          p.vz = 0;
        }
        return;
      }
      explodeProjectile(room, p, obstacleHit.point.x, obstacleHit.point.y, obstacleHit.point.z);
      toRemove.push(p.id);
      return;
    }
    const groundY = room.terrainFeetYAt(p.x, p.z);

    if (p.type === 'frag' && p.y <= (groundY + 0.05)) {
      if (p.bounces < (def.bounceMaxCount || 2) && Math.abs(p.vy) > 1.2) {
        p.y = groundY + 0.05;
        p.vy = Math.abs(p.vy) * (def.bounceVerticalDamping || 0.42);
        p.vx *= (def.bounceVelocityDamping || 0.4);
        p.vz *= (def.bounceVelocityDamping || 0.4);
        p.bounces++;
        if (((p.vx * p.vx) + (p.vy * p.vy) + (p.vz * p.vz)) < (def.bounceStopSpeedSq || 2.5)) {
          p.vx = 0;
          p.vy = 0;
          p.vz = 0;
        }
      } else {
        p.y = groundY + 0.05;
        p.vx *= 0.92;
        p.vz *= 0.92;
      }
    } else if (p.y <= groundY) {
      if (p.type === 'knife' || p.type === 'plasma_stream') {
        room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type, impactType: 'world', x: p.x, y: groundY, z: p.z });
        toRemove.push(p.id);
        return;
      }
      if (p.type === 'plasma') {
        p.y = groundY;
        if (stickProjectile(p, null, p.x, p.y, p.z)) {
          room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type, impactType: 'world', x: p.x, y: p.y, z: p.z });
          return;
        }
      }
      explodeProjectile(room, p, p.x, groundY, p.z);
      toRemove.push(p.id);
      return;
    }

    if (p.type === 'plasma') {
      const contactHit = firstEntityHit(room, p, prevPos, { x: p.x, y: p.y, z: p.z }, 0, '', now);
      if (contactHit) {
        p.seekingTargetId = contactHit.entity.id;
        p.seekingUntil = p.age + 0.3;
        p.x = contactHit.point.x;
        p.y = contactHit.point.y;
        p.z = contactHit.point.z;
        return;
      }

      const catchHit = firstEntityHit(room, p, prevPos, { x: p.x, y: p.y, z: p.z }, Number(def.catchRadius || 0), '', now);
      if (catchHit) {
        p.seekingTargetId = catchHit.entity.id;
        p.seekingUntil = p.age + 0.3;
        p.x = catchHit.point.x;
        p.y = catchHit.point.y;
        p.z = catchHit.point.z;
        return;
      }
    }

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!room.canTargetEntity(e, p.ownerId)) continue;
      if (p.type === 'plasma') continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const dy = ((e.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0) - p.y;
      const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
      const hitRadius = Math.max(0.1, Number(p.hitRadius || 1.2));
      if (d > hitRadius) continue;
      if (p.type === 'plasma_stream') {
        projectileDamageHit(room, p, e, 'body');
        room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type, impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: e.id });
        toRemove.push(p.id);
        return;
      }
      if (p.type === 'knife') {
        const isHead = dy > KNIFE_HEADSHOT_HEIGHT_DELTA_WU;
        projectileDamageHit(room, p, e, isHead ? 'head' : 'body');
        room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type, impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: e.id });
        toRemove.push(p.id);
        return;
      }
      explodeProjectile(room, p, p.x, p.y, p.z);
      toRemove.push(p.id);
      return;
    }

    p.updatedAt = now;
  });

  for (let i = 0; i < toRemove.length; i++) {
    room.projectiles.delete(toRemove[i]);
  }
}

export function tickFireZones(room, dtSec) {
  const entities = [];
  for (const p of room.players.values()) entities.push(p);
  let hasLingeringBurn = false;
  for (let i = 0; i < entities.length; i++) {
    if ((entities[i].burnUntil || 0) > 0) {
      hasLingeringBurn = true;
      break;
    }
  }
  if (room.fireZones.size === 0 && !hasLingeringBurn) return;

  const toRemove = [];
  const now = room && typeof room.currentNowMs === 'function' ? room.currentNowMs() : nowMs();
  const def = THROWABLE_STATS.molotov;
  const heatedEntityIds = new Set();

  room.fireZones.forEach((z) => {
    z.life -= dtSec;
    z.tickTimer -= dtSec;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!room.canTargetEntity(entity, z.ownerId)) continue;
      const dx = entity.x - z.x;
      const dz = entity.z - z.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > z.radius) continue;
      const heightDelta = Math.abs(entityTrackPoint(entity).y - Number(z.y || 0));
      if (heightDelta > molotovMaxHeightDelta(def)) continue;
      heatedEntityIds.add(entity.id);
    }
    if (z.tickTimer <= 0) {
      z.tickTimer += Math.max(0.1, Number(def.fireTickRate || 0.35));
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (!room.canTargetEntity(e, z.ownerId)) continue;
        const dx = e.x - z.x;
        const dz = e.z - z.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > z.radius) continue;
        const heightDelta = Math.abs(entityTrackPoint(e).y - Number(z.y || 0));
        if (heightDelta > molotovMaxHeightDelta(def)) continue;
        const owner = room.getEntityById(z.ownerId);
        const damage = Math.max(2, Math.round(Number(def.fireTickDamage || 18) * molotovDamageScale(def, d, z.radius)));
        const out = applyDamageFromSource(owner, e, damage, {
          hitType: 'body',
          weaponId: 'molotov',
          sourceKind: 'throwable',
          applyOutgoing: false,
          room
        });
        if (!out) continue;
        refreshMolotovBurn(e, z.ownerId, now, def);
        broadcastDamageEvent(room, z.ownerId, e, out, 'body');
        if (out.killed) {
          broadcastDeathRespawn(room, e);
        }
      }
    }
    if (z.life <= 0) toRemove.push(z.id);
  });

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!entity || !entity.alive) {
      if (entity) {
        entity.burnUntil = 0;
        entity.burnTickAt = 0;
        entity.burnSourceId = '';
      }
      continue;
    }
    if ((entity.burnUntil || 0) <= now) {
      entity.burnUntil = 0;
      entity.burnTickAt = 0;
      entity.burnSourceId = '';
      continue;
    }
    if (heatedEntityIds.has(entity.id)) continue;
    if ((entity.burnTickAt || 0) > now) continue;
    entity.burnTickAt = now + molotovLingerTickRateMs(def);
    const owner = room.getEntityById(entity.burnSourceId || '');
    const out = applyDamageFromSource(owner, entity, molotovLingerTickDamage(def), {
      hitType: 'body',
      weaponId: 'molotov',
      sourceKind: 'throwable',
      applyOutgoing: false,
      room
    });
    if (!out) continue;
    broadcastDamageEvent(room, entity.burnSourceId || '', entity, out, 'body');
    if (out.killed) {
      broadcastDeathRespawn(room, entity);
    }
  }

  for (let i = 0; i < toRemove.length; i++) {
    const id = toRemove[i];
    room.fireZones.delete(id);
    room.broadcast({ t: MSG_S2C.AOE_END, zoneId: id });
  }
}
