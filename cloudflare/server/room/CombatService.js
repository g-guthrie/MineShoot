import { getSharedTuningWu } from '../../lib/shared-tuning.js';
import { getSharedProtocol } from '../../lib/shared-protocol.js';
import { nowMs } from '../transport.js';
import { applyDistanceFalloffDamage } from '../sim/combat.js';

const GAMEPLAY_TUNING_WU = getSharedTuningWu();
const WEAPON_FALLOFF = GAMEPLAY_TUNING_WU.weaponFalloff || {};

const SHARED_PROTOCOL = getSharedProtocol();
const MSG_S2C = SHARED_PROTOCOL.msg.s2c;

export function applyWeaponFalloff(weaponId, baseDamage, distance) {
  const id = String(weaponId || '');
  const profile = Array.isArray(WEAPON_FALLOFF[id]) ? WEAPON_FALLOFF[id] : null;
  if (!profile || profile.length === 0) return Math.max(1, Math.round(baseDamage));
  return applyDistanceFalloffDamage(baseDamage, distance, profile);
}

export function applyIncomingDamageModifier(_target, damage) {
  return Math.max(1, Math.round(damage));
}

export function applyOutgoingDamageModifier(source, damage, _hitType, _weaponId, sourceKind) {
  let out = Math.max(1, Math.round(damage));
  if (!source || sourceKind !== 'weapon') return out;
  return out;
}

export function applyDamage(target, damage) {
  if (!target || !target.alive) return null;

  const now = nowMs();
  if ((target.spawnShieldUntil || 0) > now) return null;
  target.lastDamageAt = now;

  const hpBefore = target.hp;
  const armorBefore = target.armor;
  let remaining = Math.max(1, Math.round(damage));
  if (target.armor > 0) {
    const absorbed = Math.min(target.armor, remaining);
    target.armor -= absorbed;
    remaining -= absorbed;
  }

  if (remaining > 0) {
    target.hp = Math.max(0, target.hp - remaining);
  }

  let killed = false;
  if (target.hp <= 0 && target.alive) {
    killed = true;
    target.alive = false;
    target.respawnAt = now + 2200;
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
  const hitType = opts.hitType === 'head' ? 'head' : 'body';
  const weaponId = String(opts.weaponId || '');
  const sourceKind = String(opts.sourceKind || 'weapon');
  let damage = Math.max(1, Math.round(baseDamage));

  if (opts.applyOutgoing !== false) {
    damage = applyOutgoingDamageModifier(source, damage, hitType, weaponId, sourceKind);
  }
  if (opts.applyIncoming !== false) {
    damage = applyIncomingDamageModifier(target, damage);
  }

  return applyDamage(target, damage);
}

export function broadcastDamageEvent(room, sourceId, target, out, hitType, weaponId = '', shotToken = '') {
  if (!target || !out) return;
  if (out.killed && room && typeof room.recordElimination === 'function' && sourceId) {
    room.recordElimination(sourceId, target.id);
  }
  room.broadcast({
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
  });
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
  const THROWABLE_STATS = GAMEPLAY_TUNING_WU.throwables;
  const def = THROWABLE_STATS[projectile.type];
  if (!def || !target) return;
  const owner = room.getEntityById(projectile.ownerId);
  const damage = hitType === 'head'
    ? (def.headDamage || def.damage || 1)
    : (def.bodyDamage || def.damage || 1);
  const out = applyDamageFromSource(owner, target, damage, {
    hitType,
    weaponId: projectile.type || 'knife',
    sourceKind: 'throwable',
    applyOutgoing: false
  });
  if (!out) return;
  broadcastDamageEvent(room, projectile.ownerId, target, out, hitType, projectile.type || 'knife');
  if (out.killed) {
    broadcastDeathRespawn(room, target);
  }
}

export function explodeProjectile(room, projectile, x, y, z) {
  const THROWABLE_STATS = GAMEPLAY_TUNING_WU.throwables;
  const def = THROWABLE_STATS[projectile.type];
  if (!def) return;
  if (projectile.type === 'molotov') {
    const zoneId = `zone_${room.nextFireZoneSeq++}`;
    room.fireZones.set(zoneId, {
      id: zoneId,
      ownerId: projectile.ownerId,
      x,
      y,
      z,
      radius: def.fireRadius,
      life: def.fireDuration,
      tickTimer: 0
    });
    room.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: projectile.id, impactType: 'molotov', x, y, z });
    return;
  }
  const radius = def.radius || 0;
  const damage = def.damage || 0;
  const owner = room.getEntityById(projectile.ownerId);
  const entities = room.getAliveEntities();
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (!room.canTargetEntity(e, projectile.ownerId)) continue;
    const dx = e.x - x;
    const dz = e.z - z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > radius) continue;
    const falloff = 1 - (dist / Math.max(0.001, radius));
    const blastDamage = Math.max(20, Math.round(damage * falloff));
    const out = applyDamageFromSource(owner, e, blastDamage, {
      hitType: 'body',
      weaponId: projectile.type || 'frag',
      sourceKind: 'throwable',
      applyOutgoing: false
    });
    if (!out) continue;
    broadcastDamageEvent(room, projectile.ownerId, e, out, 'body', projectile.type || 'frag');
    if (out.killed) {
      broadcastDeathRespawn(room, e);
    }
  }
  room.broadcast({ t: MSG_S2C.THROW_EXPLODE, projectileId: projectile.id, x, y, z, radius });
}
