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
    if (Number.isFinite(Number(target.stocksRemaining))) {
      const currentStocks = Math.max(0, Number(target.stocksRemaining || 0));
      const remainingStocks = Math.max(0, currentStocks - 1);
      target.stocksRemaining = remainingStocks;
      target.maxStocks = Math.max(remainingStocks, Number(target.maxStocks || currentStocks || 0));
      target.eliminated = remainingStocks <= 0;
      target.respawnAt = target.eliminated ? 0 : (now + RESPAWN_DELAY_MS);
    } else {
      target.respawnAt = now + RESPAWN_DELAY_MS;
    }
  }

  const out = {
    id: target.id,
    hp: target.hp,
    armor: target.armor,
    armorDamage: Math.max(0, armorBefore - target.armor),
    healthDamage: Math.max(0, hpBefore - target.hp),
    damageApplied: Math.max(0, (armorBefore - target.armor) + (hpBefore - target.hp)),
  };
  out.killed = killed;
  if (Number.isFinite(Number(target.stocksRemaining)) || Number.isFinite(Number(target.maxStocks))) {
    out.stocksRemaining = Math.max(0, Number(target.stocksRemaining || 0));
    out.maxStocks = Math.max(0, Number(target.maxStocks || 0));
    out.bonusLivesEarned = Math.max(0, Number(target.bonusLivesEarned || 0));
    out.extraLifeProgressPct = Math.max(0, Math.min(100, Number(target.extraLifeProgressPct || 0)));
    out.eliminated = !!target.eliminated;
  }
  return out;
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

function awardDamageLifeProgress(room, sourceId, targetId, damageApplied) {
  if (!room || !sourceId || !targetId || sourceId === targetId) return null;
  const source = room.getEntityById ? room.getEntityById(sourceId) : null;
  const target = room.getEntityById ? room.getEntityById(targetId) : null;
  if (!source || !target) return null;
  if (!source.alive || source.eliminated) return null;
  if (target.spawnShieldUntil && Number(target.spawnShieldUntil || 0) > nowMs()) return null;
  const applied = Math.max(0, Number(damageApplied || 0));
  if (!(applied > 0)) return null;
  const currentMaxStocks = Math.max(1, Number(source.maxStocks || 5));
  const currentStocks = Math.max(0, Number(source.stocksRemaining || 0));
  const bonusLivesEarned = Math.max(0, Number(source.bonusLivesEarned || 0));
  let progress = Math.max(0, Math.min(100, Number(source.extraLifeProgressPct || 0))) + (applied / 40);
  let stocks = currentStocks;
  let bonusLives = bonusLivesEarned;

  while (progress >= 100 && bonusLives < 2 && stocks < currentMaxStocks) {
    progress -= 100;
    bonusLives += 1;
    stocks = Math.min(currentMaxStocks, stocks + 1);
  }
  if (bonusLives >= 2) {
    progress = Math.min(progress, 100);
  }

  source.stocksRemaining = stocks;
  source.maxStocks = currentMaxStocks;
  source.bonusLivesEarned = bonusLives;
  source.extraLifeProgressPct = Math.max(0, Math.min(100, progress));
  if (typeof room.syncPlayerResultFromEntity === 'function') {
    room.syncPlayerResultFromEntity(source);
  }
  return {
    stocksRemaining: source.stocksRemaining,
    maxStocks: source.maxStocks,
    bonusLivesEarned: source.bonusLivesEarned,
    extraLifeProgressPct: source.extraLifeProgressPct
  };
}

export function broadcastDamageEvent(room, sourceId, target, out, hitType, weaponId = '', shotToken = '', pelletIndex = null) {
  if (!target || !out) return;
  const lifeProgress = awardDamageLifeProgress(room, sourceId, target.id, out.damageApplied || 0);
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
  if (Number.isFinite(Number(out.stocksRemaining)) || Number.isFinite(Number(out.maxStocks))) {
    payload.stocksRemaining = Math.max(0, Number(out.stocksRemaining || 0));
    payload.maxStocks = Math.max(0, Number(out.maxStocks || 0));
    payload.eliminated = !!out.eliminated;
  }
  if (lifeProgress) {
    payload.sourceStocksRemaining = Math.max(0, Number(lifeProgress.stocksRemaining || 0));
    payload.sourceMaxStocks = Math.max(0, Number(lifeProgress.maxStocks || 0));
    payload.sourceBonusLivesEarned = Math.max(0, Number(lifeProgress.bonusLivesEarned || 0));
    payload.sourceExtraLifeProgressPct = Math.max(0, Math.min(100, Number(lifeProgress.extraLifeProgressPct || 0)));
  }
  if (pelletIndex != null && Number.isFinite(Number(pelletIndex))) {
    payload.pelletIndex = Math.max(0, Math.floor(Number(pelletIndex)));
  }
  room.broadcast(payload);
}

export function broadcastDeathRespawn(room, target) {
  const plannedSpawn = (!target.eliminated && room && typeof room.planEntityRespawn === 'function')
    ? room.planEntityRespawn(target)
    : null;
  room.broadcast({
    t: MSG_S2C.DEATH_RESPAWN,
    entityId: target.id,
    respawnAt: target.respawnAt,
    stocksRemaining: Math.max(0, Number(target.stocksRemaining || 0)),
    maxStocks: Math.max(0, Number(target.maxStocks || 0)),
    bonusLivesEarned: Math.max(0, Number(target.bonusLivesEarned || 0)),
    extraLifeProgressPct: Math.max(0, Math.min(100, Number(target.extraLifeProgressPct || 0))),
    eliminated: !!target.eliminated,
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
