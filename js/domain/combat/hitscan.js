export function getHitscanRuntime() {
  const runtime = globalThis.__MAYHEM_RUNTIME || {};
  return runtime.GameHitscan || null;
}

export function getWeaponCatalog() {
  const hitscan = getHitscanRuntime();
  if (!hitscan || typeof hitscan.getWeaponCatalog !== 'function') return null;
  return hitscan.getWeaponCatalog();
}

