export function getWeaponRegistry() {
  const runtime = globalThis.__MAYHEM_RUNTIME || {};
  return runtime.GameWeaponRegistry || null;
}

export function getWeaponEntry(weaponId) {
  const registry = getWeaponRegistry();
  if (!registry || typeof registry.get !== 'function') return null;
  return registry.get(weaponId);
}

