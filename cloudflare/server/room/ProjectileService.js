import { nowMs, distance3, normalize3, dot3 } from '../transport.js';
import { integrateProjectileMotion } from '../sim/projectiles.js';
import { gameplayTuning } from '../../../shared/gameplay-tuning.js';
import { protocol } from '../../../shared/protocol.js';
import { steerHomingVelocity } from '../../../shared/seek-core.js';
import { EYE_HEIGHT } from '../../../shared/entity-constants.js';
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
  const now = nowMs();
  const toRemove = [];
  const entities = [];
  for (const p of room.players.values()) entities.push(p);
  for (const b of room.bots.values()) entities.push(b);

  const stickProjectile = (proj, targetEntity, x, y, z) => {
    if (!proj) return false;
    const delaySec = Math.max(0.1, Number(proj.stickyDelaySec || 0.65));
    proj.vx = 0;
    proj.vy = 0;
    proj.vz = 0;
    proj.x = Number(x || proj.x);
    proj.y = Number(y || proj.y);
    proj.z = Number(z || proj.z);
    proj.stickyUntil = now + Math.round(delaySec * 1000);
    proj.stuckToTargetId = targetEntity ? targetEntity.id : '';
    if (targetEntity) {
      proj.stuckOffsetX = proj.x - targetEntity.x;
      proj.stuckOffsetY = proj.y - ((targetEntity.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0);
      proj.stuckOffsetZ = proj.z - targetEntity.z;
    } else {
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
          p.y = ((stuckTarget.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0) + (p.stuckOffsetY || 0);
          p.z = stuckTarget.z + (p.stuckOffsetZ || 0);
        }
      }
      if (now >= p.stickyUntil) {
        explodeProjectile(room, p, p.x, p.y, p.z);
        toRemove.push(p.id);
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

    const isTrackingProjectile = (p.type === 'plasma' || p.type === 'missile' || p.type === 'plasma_stream');
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

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!room.canTargetEntity(e, p.ownerId)) continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const dy = ((e.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0) - p.y;
      const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
      const hitRadius = Math.max(0.1, Number(p.hitRadius || 1.2));
      if (d > hitRadius) continue;
      if (p.type === 'plasma') {
        if (stickProjectile(p, e, p.x, p.y, p.z)) {
          room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, projectileType: p.type, impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: e.id });
          return;
        }
      }
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
  if (room.fireZones.size === 0) return;
  const toRemove = [];
  const entities = [];
  for (const p of room.players.values()) entities.push(p);
  for (const b of room.bots.values()) entities.push(b);

  room.fireZones.forEach((z) => {
    z.life -= dtSec;
    z.tickTimer -= dtSec;
    if (z.tickTimer <= 0) {
      z.tickTimer += THROWABLE_STATS.molotov.fireTickRate;
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (!room.canTargetEntity(e, z.ownerId)) continue;
        const dx = e.x - z.x;
        const dz = e.z - z.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > z.radius) continue;
        const owner = room.getEntityById(z.ownerId);
        const out = applyDamageFromSource(owner, e, THROWABLE_STATS.molotov.fireTickDamage, {
          hitType: 'body',
          weaponId: 'molotov',
          sourceKind: 'throwable',
          applyOutgoing: false
        });
        if (!out) continue;
        broadcastDamageEvent(room, z.ownerId, e, out, 'body');
        if (out.killed) {
          broadcastDeathRespawn(room, e);
        }
      }
    }
    if (z.life <= 0) toRemove.push(z.id);
  });

  for (let i = 0; i < toRemove.length; i++) {
    const id = toRemove[i];
    room.fireZones.delete(id);
    room.broadcast({ t: MSG_S2C.AOE_END, zoneId: id });
  }
}
