export function applyDistanceFalloffDamage(baseDamage, distance, bands) {
  if (!Array.isArray(bands) || bands.length === 0) return Math.max(1, Math.round(baseDamage));
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i] || {};
    const maxDistance = Number(band.maxDistance);
    const scale = Number(band.scale);
    if (!Number.isFinite(maxDistance) || maxDistance <= 0 || !Number.isFinite(scale)) continue;
    if (distance <= maxDistance) {
      return Math.max(1, Math.round(baseDamage * Math.max(0, scale)));
    }
  }
  const tail = bands[bands.length - 1] || {};
  const tailScale = Number.isFinite(Number(tail.scale)) ? Math.max(0, Number(tail.scale)) : 1;
  return Math.max(1, Math.round(baseDamage * tailScale));
}

export function applyShotgunFalloffDamage(baseDamage, distance, fullDamageEnd, minDamageStart) {
  return applyDistanceFalloffDamage(baseDamage, distance, [
    { maxDistance: Number(fullDamageEnd || 7), scale: 1.0 },
    { maxDistance: Number(minDamageStart || 22), scale: 0.5 },
    { maxDistance: Number(minDamageStart || 22) + 0.001, scale: 0.28 }
  ]);
}
