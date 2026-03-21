import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canEntityEquipWeaponId,
  createThrowableRuntime,
  createWeaponAmmoRuntime,
  entityWeaponLoadout,
  normalizeWeaponLoadout
} from '../../../cloudflare/server/room/RoomLoadout.js';

const LOADOUT_DEPS = {
  selectableWeaponIds: ['rifle', 'shotgun', 'sniper'],
  defaultWeaponLoadout: ['rifle', 'shotgun'],
  weaponStats: {
    rifle: { magazineSize: 30 },
    shotgun: { magazineSize: 6 },
    sniper: { magazineSize: 4 },
    sword: { magazineSize: 0 }
  }
};

test('room loadout normalization removes duplicates and invalid ids', () => {
  const normalized = normalizeWeaponLoadout(['sniper', 'sniper', 'invalid'], ['rifle', 'shotgun'], LOADOUT_DEPS);

  assert.deepEqual(normalized, ['sniper', 'rifle']);
});

test('room loadout helpers keep entity loadouts valid and expose equip checks', () => {
  const entity = {
    weaponLoadout: ['invalid', 'shotgun', 'shotgun']
  };

  assert.deepEqual(entityWeaponLoadout(entity, LOADOUT_DEPS), ['shotgun', 'rifle']);
  assert.equal(canEntityEquipWeaponId(entity, 'shotgun', LOADOUT_DEPS), true);
  assert.equal(canEntityEquipWeaponId(entity, 'sniper', LOADOUT_DEPS), false);
});

test('room loadout runtime materializes ammo and throwable inventories from the catalog', () => {
  const ammo = createWeaponAmmoRuntime(['shotgun', 'sword'], LOADOUT_DEPS);
  const throwables = createThrowableRuntime({
    throwableStats: {
      order: ['frag', 'smoke'],
      frag: { regen: 5 },
      smoke: { regen: 10 }
    }
  });

  assert.deepEqual(ammo, {
    shotgun: {
      ammoInMag: 6,
      reloadUntil: 0,
      reloadedFlashUntil: 0
    }
  });
  assert.deepEqual(throwables, {
    frag: { charges: 1, maxCharges: 1, cooldownRemaining: 0 },
    smoke: { charges: 1, maxCharges: 1, cooldownRemaining: 0 }
  });
});
