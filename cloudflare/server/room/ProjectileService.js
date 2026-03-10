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
        room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'despawn', x: p.x, y: p.y, z: p.z });
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
    integrateProjectileMotion(p, dtSec, true);
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
        room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'world', x: p.x, y: groundY, z: p.z });
        toRemove.push(p.id);
        return;
      }
      if (p.type === 'plasma') {
        p.y = groundY;
        if (stickProjectile(p, null, p.x, p.y, p.z)) {
          room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'world', x: p.x, y: p.y, z: p.z });
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
          room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: e.id });
          return;
        }
      }
      if (p.type === 'plasma_stream') {
        projectileDamageHit(room, p, e, 'body');
        room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: e.id });
        toRemove.push(p.id);
        return;
      }
      if (p.type === 'knife') {
        const isHead = dy > KNIFE_HEADSHOT_HEIGHT_DELTA_WU;
        projectileDamageHit(room, p, e, isHead ? 'head' : 'body');
        room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: e.id });
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
