import test from 'node:test';
import assert from 'node:assert/strict';

import {
  gameplayTuning,
  getSelectableWeaponIds,
  getWeaponFalloffProfile,
  getWeaponPresentation,
  normalizeAbilityLoadout,
  resolveWeaponAdsFovDeg,
  resolveWeaponAimProfile
} from '../shared/gameplay-tuning.js';
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

test('shared weapon helpers expose the selectable loadout order and falloff profiles', () => {
  assert.deepEqual(getSelectableWeaponIds(), ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper']);
  assert.equal(typeof globalThis.__MAYHEM_RUNTIME.GameShared.getSelectableWeaponIds, 'function');
  assert.deepEqual(globalThis.__MAYHEM_RUNTIME.GameShared.getSelectableWeaponIds(), getSelectableWeaponIds());

  const machinegunFalloff = getWeaponFalloffProfile('machinegun');
  assert.deepEqual(machinegunFalloff, gameplayTuning.weaponFalloff.machinegun);
  assert.notEqual(machinegunFalloff, gameplayTuning.weaponFalloff.machinegun);
});

test('weapon presentation tuning exposes shared tracer, recoil, and sample knobs', () => {
  const rifle = getWeaponPresentation('rifle');
  const sniper = getWeaponPresentation('sniper');

  assert.equal(rifle.tracer.speed, 280);
  assert.equal(rifle.recoil.muzzleMs, 60);
  assert.equal(rifle.audioSample.url, '/assets/audio/weapons/rifle.mp3');
  assert.equal(sniper.tracer.segmentLength, 2.6);
  assert.equal(sniper.recoil.pitch, 0.04);
  assert.equal(sniper.audioSample.url, '/assets/audio/weapons/sniper.mp3');
});

test('ADS aim profiles can tighten spread independently from hipfire', () => {
  const rifle = gameplayTuning.weaponStats.rifle;
  const shotgun = gameplayTuning.weaponStats.shotgun;
  const sniper = gameplayTuning.weaponStats.sniper;

  assert.equal(resolveWeaponAimProfile(rifle, false).spread, rifle.hipfireSpread);
  assert.equal(resolveWeaponAimProfile(rifle, true).spread, 0);
  assert.equal(resolveWeaponAimProfile(shotgun, false).spread, shotgun.hipfireSpread);
  assert.equal(resolveWeaponAimProfile(shotgun, true).spread, shotgun.hipfireSpread);
  assert.equal(resolveWeaponAimProfile(sniper, false).spread, sniper.hipfireSpread);
  assert.equal(resolveWeaponAimProfile(sniper, true).spread, 0);
  assert.equal(resolveWeaponAimProfile(sniper, true).maxRange, Infinity);
  assert.equal(resolveWeaponAdsFovDeg(shotgun), 56);
  assert.equal(resolveWeaponAdsFovDeg(sniper), 24);
});

test('Vader choke duration includes the extra half-second hold', () => {
  assert.equal(gameplayTuning.abilityCatalog.choke.duration, 2.0);
});

test('ability loadout normalization repairs invalid and duplicate picks', () => {
  assert.deepEqual(
    normalizeAbilityLoadout('missile', 'missile'),
    { slot1: 'missile', slot2: 'choke' }
  );

  assert.deepEqual(
    normalizeAbilityLoadout('not-real', ''),
    { slot1: 'choke', slot2: 'missile' }
  );
});
