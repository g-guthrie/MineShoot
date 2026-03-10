import test from 'node:test';
import assert from 'node:assert/strict';

import { gameplayTuning } from '../shared/gameplay-tuning.js';
import { DEFAULT_HP_MAX, DEFAULT_ARMOR_MAX } from '../shared/entity-constants.js';

const FULL_HEALTH_DURABILITY = DEFAULT_HP_MAX + DEFAULT_ARMOR_MAX;

function shotsToKill(weapon, hitType) {
  const perProjectileDamage = hitType === 'head'
    ? Number(weapon.headDamage || 0)
    : Number(weapon.bodyDamage || 0);
  const projectiles = Math.max(1, Number(weapon.pellets || 1));
  const perShotDamage = perProjectileDamage * projectiles;
  return Math.ceil(FULL_HEALTH_DURABILITY / perShotDamage);
}

function ttkMs(weapon, hitType) {
  const shots = shotsToKill(weapon, hitType);
  return Math.max(0, shots - 1) * Number(weapon.cooldownMs || 0);
}

test('shotgun sets the minimum weapon ttk floor', () => {
  const shotgun = gameplayTuning.weaponStats.shotgun;
  assert.equal(shotsToKill(shotgun, 'body'), 3);
  assert.equal(shotsToKill(shotgun, 'head'), 2);

  const shotgunHeadTtk = ttkMs(shotgun, 'head');
  let fastestWeaponId = null;
  let fastestWeaponTtk = Infinity;

  for (const [weaponId, weapon] of Object.entries(gameplayTuning.weaponStats)) {
    const perfectTtk = ttkMs(weapon, 'head');
    if (perfectTtk < fastestWeaponTtk) {
      fastestWeaponTtk = perfectTtk;
      fastestWeaponId = weaponId;
    }
  }

  assert.equal(fastestWeaponId, 'shotgun');
  assert.equal(fastestWeaponTtk, shotgunHeadTtk);
});

test('weapon reload tuning exposes magazine sizes and reload timing', () => {
  assert.deepEqual(
    {
      rifle: gameplayTuning.weaponStats.rifle.magazineSize,
      pistol: gameplayTuning.weaponStats.pistol.magazineSize,
      machinegun: gameplayTuning.weaponStats.machinegun.magazineSize,
      shotgun: gameplayTuning.weaponStats.shotgun.magazineSize,
      sniper: gameplayTuning.weaponStats.sniper.magazineSize
    },
    {
      rifle: 15,
      pistol: 12,
      machinegun: 40,
      shotgun: 6,
      sniper: 5
    }
  );

  for (const weaponId of ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper']) {
    assert.ok(Number(gameplayTuning.weaponStats[weaponId].reloadMs) > 0, weaponId + ' should define reload timing');
  }
});
