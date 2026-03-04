import { applyFalloff } from '../../../shared/damage.js';

export function applyDistanceFalloffDamage(baseDamage, distance, bands) {
  return applyFalloff(baseDamage, distance, bands);
}
