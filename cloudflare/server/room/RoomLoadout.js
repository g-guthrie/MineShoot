export function isSelectableWeaponId(weaponId, deps = {}) {
  const id = String(weaponId || '');
  const selectableWeaponIds = Array.isArray(deps.selectableWeaponIds)
    ? deps.selectableWeaponIds
    : [];
  const weaponStats = deps.weaponStats || {};
  return selectableWeaponIds.indexOf(id) !== -1 && !!weaponStats[id];
}

export function normalizeWeaponLoadout(rawSlots, fallbackSlots, deps = {}) {
  const defaultWeaponLoadout = Array.isArray(deps.defaultWeaponLoadout) && deps.defaultWeaponLoadout.length
    ? deps.defaultWeaponLoadout
    : [];
  const fallback = Array.isArray(fallbackSlots) && fallbackSlots.length ? fallbackSlots : defaultWeaponLoadout;
  const next = [];
  const seen = {};
  const combined = Array.isArray(rawSlots) ? rawSlots.slice(0) : [];
  for (let i = 0; i < fallback.length; i++) combined.push(fallback[i]);
  for (let i = 0; i < combined.length && next.length < 2; i++) {
    const id = String(combined[i] || '');
    if (!isSelectableWeaponId(id, deps) || seen[id]) continue;
    seen[id] = true;
    next.push(id);
  }
  return next.length ? next : defaultWeaponLoadout.slice();
}

export function entityWeaponLoadout(entity, deps = {}) {
  const defaultWeaponLoadout = Array.isArray(deps.defaultWeaponLoadout) ? deps.defaultWeaponLoadout : [];
  if (!entity) return defaultWeaponLoadout.slice();
  entity.weaponLoadout = normalizeWeaponLoadout(entity.weaponLoadout, defaultWeaponLoadout, deps);
  return entity.weaponLoadout;
}

export function canEntityEquipWeaponId(entity, weaponId, deps = {}) {
  const id = String(weaponId || '');
  if (!isSelectableWeaponId(id, deps)) return false;
  return entityWeaponLoadout(entity, deps).indexOf(id) >= 0;
}

export function createWeaponAmmoRuntime(loadout, deps = {}) {
  const ammo = {};
  const weaponStats = deps.weaponStats || {};
  const defaultWeaponLoadout = Array.isArray(deps.defaultWeaponLoadout) ? deps.defaultWeaponLoadout : [];
  const ids = Array.isArray(loadout) && loadout.length ? loadout : defaultWeaponLoadout;
  for (let i = 0; i < ids.length; i++) {
    const weaponId = String(ids[i] || '');
    const stats = weaponStats[weaponId];
    if (!stats || !(Number(stats.magazineSize || 0) > 0)) continue;
    ammo[weaponId] = {
      ammoInMag: Math.max(0, Number(stats.magazineSize || 0)),
      reloadUntil: 0,
      reloadedFlashUntil: 0
    };
  }
  return ammo;
}

export function createThrowableRuntime(deps = {}) {
  const out = {};
  const throwableStats = deps.throwableStats || {};
  const order = Array.isArray(throwableStats.order) ? throwableStats.order : [];
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    if (!throwableStats[id]) continue;
    out[id] = {
      charges: 1,
      maxCharges: 1,
      cooldownRemaining: 0
    };
  }
  return out;
}
