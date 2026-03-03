export function applyShotgunFalloffDamage(baseDamage, distance, fullDamageEnd, minDamageStart) {
  if (distance <= fullDamageEnd) return baseDamage;
  if (distance >= minDamageStart) return Math.max(1, Math.round(baseDamage * 0.4));

  const ratio = (distance - fullDamageEnd) / Math.max(0.001, (minDamageStart - fullDamageEnd));
  const scalar = 1 - (0.6 * ratio);
  return Math.max(1, Math.round(baseDamage * scalar));
}
