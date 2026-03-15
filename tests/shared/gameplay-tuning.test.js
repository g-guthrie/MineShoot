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
} from '../../shared/gameplay-tuning.js';
import { DEFAULT_HP_MAX, DEFAULT_ARMOR_MAX } from '../../shared/entity-constants.js';

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

test('weapon tuning exposes a valid fastest perfect-ttk weapon', () => {
  const shotgun = gameplayTuning.weaponStats.shotgun;
  assert.equal(shotsToKill(shotgun, 'body'), 3);
  assert.equal(shotsToKill(shotgun, 'head'), 2);

  let fastestWeaponId = null;
  let fastestWeaponTtk = Infinity;

  for (const [weaponId, weapon] of Object.entries(gameplayTuning.weaponStats)) {
    const perfectTtk = ttkMs(weapon, 'head');
    if (perfectTtk < fastestWeaponTtk) {
      fastestWeaponTtk = perfectTtk;
      fastestWeaponId = weaponId;
    }
  }

  assert.ok(['shotgun', 'pistol', 'rifle', 'machinegun', 'sniper'].includes(fastestWeaponId));
  assert.equal(Number.isFinite(fastestWeaponTtk), true);
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
      pistol: 10,
      machinegun: 45,
      shotgun: 6,
      sniper: 5
    }
  );

  assert.deepEqual(
    {
      rifle: gameplayTuning.weaponStats.rifle.reloadMs,
      pistol: gameplayTuning.weaponStats.pistol.reloadMs,
      machinegun: gameplayTuning.weaponStats.machinegun.reloadMs,
      shotgun: gameplayTuning.weaponStats.shotgun.reloadMs,
      sniper: gameplayTuning.weaponStats.sniper.reloadMs
    },
    {
      rifle: 1550,
      pistol: 1350,
      machinegun: 1388,
      shotgun: 1850,
      sniper: 2100
    }
  );
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
  const pistol = gameplayTuning.weaponStats.pistol;
  const sniper = gameplayTuning.weaponStats.sniper;
  const machinegun = gameplayTuning.weaponStats.machinegun;

  assert.equal(rifle.hipfireSpread, 0.024);
  assert.equal(rifle.adsSpread, 0);
  assert.equal(resolveWeaponAimProfile(rifle, false).spread, rifle.hipfireSpread);
  assert.equal(resolveWeaponAimProfile(rifle, true).spread, rifle.adsSpread);
  assert.equal(resolveWeaponAimProfile(machinegun, true).spread, machinegun.adsSpread);
  assert.equal(resolveWeaponAimProfile(pistol, true).spread, pistol.adsSpread);
  assert.equal(resolveWeaponAimProfile(shotgun, false).spread, shotgun.hipfireSpread);
  assert.equal(resolveWeaponAimProfile(shotgun, true).spread, shotgun.adsSpread);
  assert.equal(resolveWeaponAimProfile(sniper, false).spread, sniper.hipfireSpread);
  assert.equal(resolveWeaponAimProfile(sniper, true).spread, sniper.adsSpread);
  assert.equal(resolveWeaponAimProfile(sniper, true).maxRange, Infinity);
  for (const weaponId of ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper']) {
    const weapon = gameplayTuning.weaponStats[weaponId];
    assert.equal(typeof weapon.adsFovDeg, 'number');
    assert.equal(typeof weapon.adsSpread, 'number');
  }
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

test('network tuning exposes the canonical ping, reconcile, burst, and feedback defaults', () => {
  assert.deepEqual(gameplayTuning.network.flags, {
    adaptiveSelfReconciliation: true,
    combatBurstSnapshots: true,
    shotTokenDamageAggregation: false
  });
  assert.equal(gameplayTuning.network.ping.cadenceMs, 500);
  assert.equal(gameplayTuning.network.selfReconciliation.movingReplayDistanceWu, 1.75);
  assert.equal(gameplayTuning.network.selfReconciliation.airborneHardSnapVerticalWu, 2.75);
  assert.equal(gameplayTuning.network.selfReconciliation.airborneMovingAckDriftLimit, 4);
  assert.equal(gameplayTuning.network.combatPriority.burstCadenceMs, 16);
  assert.equal(gameplayTuning.network.remoteInterpolation.defaultDelayMs, 78);
  assert.equal(gameplayTuning.network.remoteInterpolation.hitboxLeadMs, 0);
  assert.equal(gameplayTuning.network.remoteInterpolation.serverOffsetSnapDeltaMs, 120);
  assert.equal(gameplayTuning.network.feedback.shotgunAggregateWindowMs, 60);
  assert.equal(typeof globalThis.__MAYHEM_RUNTIME.GameShared.getNetworkTuning, 'function');
});
