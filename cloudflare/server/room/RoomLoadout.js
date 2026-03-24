import {
  canWeaponLoadoutEquipId as sharedCanWeaponLoadoutEquipId,
  createWeaponAmmoRuntime as sharedCreateWeaponAmmoRuntime,
  isSelectableWeaponId as sharedIsSelectableWeaponId,
  normalizeWeaponLoadout as sharedNormalizeWeaponLoadout
} from '../../../shared/gameplay-tuning.js';

export function isSelectableWeaponId(weaponId, deps = {}) {
  return sharedIsSelectableWeaponId(weaponId, deps);
}

export function normalizeWeaponLoadout(rawSlots, fallbackSlots, deps = {}) {
  return sharedNormalizeWeaponLoadout(rawSlots, fallbackSlots, deps);
}

export function entityWeaponLoadout(entity, deps = {}) {
  if (!entity) return sharedNormalizeWeaponLoadout([], Array.isArray(deps.defaultWeaponLoadout) ? deps.defaultWeaponLoadout : [], deps);
  entity.weaponLoadout = normalizeWeaponLoadout(
    entity.weaponLoadout,
    Array.isArray(deps.defaultWeaponLoadout) ? deps.defaultWeaponLoadout : entity.weaponLoadout,
    deps
  );
  return entity.weaponLoadout;
}

export function canEntityEquipWeaponId(entity, weaponId, deps = {}) {
  return sharedCanWeaponLoadoutEquipId(entity ? entity.weaponLoadout : [], weaponId, deps);
}

export function createWeaponAmmoRuntime(loadout, deps = {}) {
  return sharedCreateWeaponAmmoRuntime(loadout, deps);
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
