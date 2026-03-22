import { gameplayTuning } from './gameplay-tuning.js';

const SURVIVABILITY = gameplayTuning.survivability || {};

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const ARMOR_REGEN_DELAY_SEC = Math.max(0, finiteNumber(SURVIVABILITY.armorRegenDelaySec, 6.0));
export const ARMOR_REGEN_DELAY_MS = ARMOR_REGEN_DELAY_SEC * 1000;
export const ARMOR_REGEN_PER_SEC = Math.max(0, finiteNumber(SURVIVABILITY.armorRegenPerSec, 12));

export function regenArmorFromLastDamage(entity, dtSec, now, options = {}) {
  const dt = Math.max(0, Number(dtSec || 0));
  const timeNow = Number(now || 0);
  const regenDelayMs = Math.max(0, finiteNumber(options.regenDelayMs, ARMOR_REGEN_DELAY_MS));
  const regenPerSec = Math.max(0, finiteNumber(options.regenPerSec, ARMOR_REGEN_PER_SEC));

  if (!entity || !entity.alive || entity.armor >= entity.armorMax) return false;
  if ((timeNow - Number(entity.lastDamageAt || 0)) < regenDelayMs) return false;
  entity.armor = Math.min(entity.armorMax, entity.armor + (regenPerSec * dt));
  return true;
}

const runtime = (typeof globalThis !== 'undefined') ? globalThis : {};
runtime.__MAYHEM_RUNTIME = runtime.__MAYHEM_RUNTIME || {};
runtime.__MAYHEM_RUNTIME.GameShared = runtime.__MAYHEM_RUNTIME.GameShared || {};
runtime.__MAYHEM_RUNTIME.GameShared.survivability = {
  ARMOR_REGEN_DELAY_SEC,
  ARMOR_REGEN_DELAY_MS,
  ARMOR_REGEN_PER_SEC,
  regenArmorFromLastDamage
};
