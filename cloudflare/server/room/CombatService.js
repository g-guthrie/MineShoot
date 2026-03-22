import { nowMs } from '../transport.js';
import { applyDistanceFalloffDamage } from '../sim/combat.js';
import { RESPAWN_DELAY_MS } from '../../../shared/combat-timings.js';
import { gameplayTuning } from '../../../shared/gameplay-tuning.js';
import { protocol } from '../../../shared/protocol.js';
import {
  applyDamage as applySharedDamage,
  sanitizeDamageAmount,
  ARMOR_BUFFER_MODE_NORMAL
} from '../../../shared/damage.js';

const WEAPON_FALLOFF = gameplayTuning.weaponFalloff || {};

const MSG_S2C = protocol.msg.s2c;

function clampNumber(value, min, max, fallback = 0) {
  let parsed = Number(value);
  if (!Number.isFinite(parsed)) parsed = Number(fallback || 0);
  if (!Number.isFinite(parsed)) parsed = 0;
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeThrowableRadius(value) {
  return clampNumber(value, 0, 10, 0);
}

function sanitizeThrowableDamage(value) {
  return clampNumber(value, 0, 500, 0);
}

function sanitizeThrowableDuration(value) {
  return clampNumber(value, 0, 10, 0);
}

export function applyWeaponFalloff(weaponId, baseDamage, distance) {
  const id = String(weaponId || '');
  const profile = Array.isArray(WEAPON_FALLOFF[id]) ? WEAPON_FALLOFF[id] : null;
  if (!profile || profile.length === 0) return Math.max(1, Math.round(baseDamage));
  return applyDistanceFalloffDamage(baseDamage, distance, profile);
}

export function applyDamage(target, damage, options = {}) {
  if (!target || !target.alive) return null;
  const sanitizedDamage = sanitizeDamageAmount(damage);
  if (sanitizedDamage <= 0) return null;

  const now = nowMs();
  if ((target.spawnShieldUntil || 0) > now) return null;
  target.lastDamageAt = now;

  const hpBefore = target.hp;
  const armorBefore = target.armor;
  applySharedDamage(target, sanitizedDamage, {
    armorBufferMode: String(options.armorBufferMode || ARMOR_BUFFER_MODE_NORMAL)
  });

  let killed = false;
  if (target.hp <= 0 && target.alive) {
    killed = true;
    target.alive = false;
    target.respawnAt = now + RESPAWN_DELAY_MS;
  }

  return {
    id: target.id,
    hp: target.hp,
    armor: target.armor,
    armorDamage: Math.max(0, armorBefore - target.armor),
    healthDamage: Math.max(0, hpBefore - target.hp),
    damageApplied: Math.max(0, (armorBefore - target.armor) + (hpBefore - target.hp)),
    killed
  };
}

export function applyDamageFromSource(source, target, baseDamage, opts = {}) {
  if (!target || !target.alive) return null;
  const armorBufferMode = String(opts.armorBufferMode || ARMOR_BUFFER_MODE_NORMAL);
  const damage = sanitizeDamageAmount(baseDamage);
  if (damage <= 0) return null;

  return applyDamage(target, damage, { armorBufferMode });
}

function entitySplashPoint(room, entity) {
  if (!entity) return null;
  if (room && typeof room.entityAimTargetPosition === 'function') {
    return room.entityAimTargetPosition(entity);
  }
  return {
    x: Number(entity && entity.x || 0),
    y: Number(entity && entity.y || 0),
    z: Number(entity && entity.z || 0)
  };
}

function canApplyExplosionDamage(room, projectile, target, center, radius) {
  if (!target || !center) return false;
  const targetPos = entitySplashPoint(room, target);
  const dx = Number(targetPos.x || 0) - Number(center.x || 0);
  const dy = Number(targetPos.y || 0) - Number(center.y || 0);
  const dz = Number(targetPos.z || 0) - Number(center.z || 0);
  const dist = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
  if (dist > radius) return false;
  if (room && typeof room.hasWorldLineOfSight === 'function') {
    if (!room.hasWorldLineOfSight(center, targetPos, radius)) return false;
  }
  return dist;
}

export function broadcastDamageEvent(room, sourceId, target, out, hitType, weaponId = '', shotToken = '', pelletIndex = null) {
  if (!target || !out) return;
  if (out.killed && room && typeof room.recordElimination === 'function' && sourceId) {
    room.recordElimination(sourceId, target.id);
  }
  if (room && typeof room.markEntityEngaged === 'function' && sourceId && target.id) {
    room.markEntityEngaged(sourceId, target.id);
  }
  if (room && typeof room.markSnapshotBurst === 'function') {
    room.markSnapshotBurst([sourceId, target.id], [sourceId, target.id]);
  }
  const payload = {
    t: MSG_S2C.DAMAGE_EVENT,
    targetId: target.id,
    sourceId: sourceId,
    health: out.hp,
    armor: out.armor,
    hitType: hitType === 'head' ? 'head' : 'body',
    weaponId: String(weaponId || ''),
    shotToken: String(shotToken || ''),
    damage: out.damageApplied || 0,
    killed: !!out.killed
  };
  if (pelletIndex != null && Number.isFinite(Number(pelletIndex))) {
    payload.pelletIndex = Math.max(0, Math.floor(Number(pelletIndex)));
  }
  room.broadcast(payload);
}

export function broadcastDeathRespawn(room, target) {
  const plannedSpawn = room && typeof room.planEntityRespawn === 'function'
    ? room.planEntityRespawn(target)
    : null;
  room.broadcast({
    t: MSG_S2C.DEATH_RESPAWN,
    entityId: target.id,
    respawnAt: target.respawnAt,
    classApplied: target.classId,
    x: plannedSpawn ? Number(plannedSpawn.x || 0) : undefined,
    z: plannedSpawn ? Number(plannedSpawn.z || 0) : undefined
  });
}

export function projectileDamageHit(room, projectile, target, hitType) {
  const THROWABLE_STATS = gameplayTuning.throwables;
  const def = THROWABLE_STATS[projectile.type];
  if (!def || !target) return;
  const owner = room.getEntityById(projectile.ownerId);
  const damage = sanitizeThrowableDamage(
    hitType === 'head'
      ? (def.headDamage || def.damage || 0)
      : (def.bodyDamage || def.damage || 0)
  );
  if (damage <= 0) return;
  const out = applyDamageFromSource(owner, target, damage, {
    hitType,
    weaponId: projectile.type || 'knife',
    sourceKind: 'throwable',
    applyOutgoing: false,
    armorBufferMode: String(def.armorBufferMode || ARMOR_BUFFER_MODE_NORMAL)
  });
  if (!out) return;
  broadcastDamageEvent(room, projectile.ownerId, target, out, hitType, projectile.type || 'knife');
  if (out.killed) {
    broadcastDeathRespawn(room, target);
  }
}

export function explodeProjectile(room, projectile, x, y, z) {
  const THROWABLE_STATS = gameplayTuning.throwables;
  const def = THROWABLE_STATS[projectile.type];
  if (!def) return;
  if (projectile.type === 'molotov') {
    const fireRadius = sanitizeThrowableRadius(def.fireRadius);
    const fireDuration = sanitizeThrowableDuration(def.fireDuration);
    const zoneId = `zone_${room.nextFireZoneSeq++}`;
    room.fireZones.set(zoneId, {
      id: zoneId,
      ownerId: projectile.ownerId,
      x,
      y,
      z,
      radius: fireRadius,
      life: fireDuration,
      tickTimer: 0
    });
    room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: projectile.id, impactType: 'molotov', projectileType: projectile.type, x, y, z });
    return;
  }
  const radius = sanitizeThrowableRadius(def.radius || 0);
  const damage = sanitizeThrowableDamage(def.damage || 0);
  const minBlastDamage = sanitizeThrowableDamage(def.minBlastDamage || 0);
  const owner = room.getEntityById(projectile.ownerId);
  const entities = room.getAliveEntities();
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (!room.canTargetEntity(e, projectile.ownerId)) continue;
    const dist = canApplyExplosionDamage(room, projectile, e, { x, y, z }, radius);
    if (dist === false) continue;
    const falloff = 1 - (dist / Math.max(0.001, radius));
    const blastDamage = Math.max(minBlastDamage, Math.round(damage * falloff));
    const out = applyDamageFromSource(owner, e, blastDamage, {
      hitType: 'body',
      weaponId: projectile.type || 'frag',
      sourceKind: 'throwable',
      applyOutgoing: false,
      armorBufferMode: String(def.armorBufferMode || ARMOR_BUFFER_MODE_NORMAL)
    });
    if (!out) continue;
    broadcastDamageEvent(room, projectile.ownerId, e, out, 'body', projectile.type || 'frag');
    if (out.killed) {
      broadcastDeathRespawn(room, e);
    }
  }
  room.broadcast({ t: MSG_S2C.THROW_EXPLODE, projectileId: projectile.id, projectileType: projectile.type, x, y, z, radius });
}
