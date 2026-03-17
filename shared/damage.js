/**
 * shared/damage.js - Unified damage pipeline used by client and server.
 *
 * Targets must implement: { hp, armor, armorMax }
 * Optionally: { armorRegenDelay }
 */
import { gameplayTuning } from './gameplay-tuning.js';

export function applyFalloff(baseDamage, distance, bands) {
  if (!Array.isArray(bands) || bands.length === 0) return Math.max(1, Math.round(baseDamage));
  for (var i = 0; i < bands.length; i++) {
    var band = bands[i] || {};
    var maxDistance = Number(band.maxDistance);
    var scale = Number(band.scale);
    if (!isFinite(maxDistance) || maxDistance <= 0 || !isFinite(scale)) continue;
    if (distance <= maxDistance) {
      return Math.max(1, Math.round(baseDamage * Math.max(0, scale)));
    }
  }
  var tail = bands[bands.length - 1] || {};
  var tailScale = isFinite(Number(tail.scale)) ? Math.max(0, Number(tail.scale)) : 1;
  return Math.max(1, Math.round(baseDamage * tailScale));
}

var SURVIVABILITY = gameplayTuning.survivability || {};
var DEFAULT_ARMOR_REGEN_DELAY = Number.isFinite(Number(SURVIVABILITY.armorRegenDelaySec)) ? Number(SURVIVABILITY.armorRegenDelaySec) : 6.0;
var DEFAULT_ARMOR_REGEN_PER_SEC = Number.isFinite(Number(SURVIVABILITY.armorRegenPerSec)) ? Number(SURVIVABILITY.armorRegenPerSec) : 12;
export var ARMOR_BUFFER_MODE_NORMAL = 'normal';
export var ARMOR_BUFFER_MODE_HEAVY = 'heavy';

/**
 * Apply damage to a target with armor-first absorption.
 * `heavy` hits are fully consumed by any remaining armor, even if they would break it.
 * Returns { absorbed, hpLost, killed, hp, armor }.
 */
export function applyDamage(target, rawDamage, options) {
  options = options || {};
  var damage = Math.max(1, Math.round(rawDamage));
  var absorbed = 0;
  var armorBufferMode = String(options.armorBufferMode || ARMOR_BUFFER_MODE_NORMAL);

  target.armorRegenDelay = DEFAULT_ARMOR_REGEN_DELAY;

  if (target.armor > 0) {
    if (armorBufferMode === ARMOR_BUFFER_MODE_HEAVY) {
      absorbed = damage;
      target.armor = Math.max(0, target.armor - damage);
      damage = 0;
    } else {
      absorbed = Math.min(target.armor, damage);
      target.armor -= absorbed;
      damage -= absorbed;
    }
  }

  var hpLost = 0;
  if (damage > 0) {
    hpLost = Math.min(target.hp, damage);
    target.hp -= hpLost;
  }

  var killed = target.hp <= 0;
  if (killed) target.hp = 0;

  return { absorbed: absorbed, hpLost: hpLost, killed: killed, hp: target.hp, armor: target.armor };
}

export var ARMOR_REGEN_DELAY = DEFAULT_ARMOR_REGEN_DELAY;
export var ARMOR_REGEN_PER_SEC = DEFAULT_ARMOR_REGEN_PER_SEC;

export function tickArmorRegen(target, dt, regenDelay, regenRate) {
  regenDelay = (typeof regenDelay === 'number') ? regenDelay : DEFAULT_ARMOR_REGEN_DELAY;
  regenRate = (typeof regenRate === 'number') ? regenRate : DEFAULT_ARMOR_REGEN_PER_SEC;

  if (target.armorRegenDelay > 0) {
    target.armorRegenDelay -= dt;
    if (target.armorRegenDelay < 0) target.armorRegenDelay = 0;
    return;
  }
  if (target.armor < target.armorMax) {
    target.armor += regenRate * dt;
    if (target.armor > target.armorMax) target.armor = target.armorMax;
  }
}

var runtime = (typeof globalThis !== 'undefined') ? globalThis : {};
runtime.__MAYHEM_RUNTIME = runtime.__MAYHEM_RUNTIME || {};
runtime.__MAYHEM_RUNTIME.GameShared = runtime.__MAYHEM_RUNTIME.GameShared || {};
runtime.__MAYHEM_RUNTIME.GameShared.damage = {
  applyFalloff: applyFalloff,
  applyDamage: applyDamage,
  tickArmorRegen: tickArmorRegen,
  ARMOR_BUFFER_MODE_NORMAL: ARMOR_BUFFER_MODE_NORMAL,
  ARMOR_BUFFER_MODE_HEAVY: ARMOR_BUFFER_MODE_HEAVY
};
