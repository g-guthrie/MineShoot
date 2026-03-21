import test from 'node:test';
import assert from 'node:assert/strict';

import {
  gameplayTuning,
  getDefaultAbilityId,
  getSelectableWeaponIds,
  getWeaponFalloffProfile,
  getWeaponPresentation,
  normalizeAbilityId,
  resolveReloadPresentationState,
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
  assert.equal(FULL_HEALTH_DURABILITY, 450);
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
      machinegun: 50,
      shotgun: 6,
      sniper: 4
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
      rifle: 1600,
      pistol: 1350,
      machinegun: 1450,
      shotgun: 1850,
      sniper: 2400
    }
  );
});

test('awareness tuning expands radar coverage before targets are already visually obvious', () => {
  assert.deepEqual(gameplayTuning.awareness, {
    segments: 8,
    radarRange: 56,
    coreRange: 10,
    beaconMinRange: 56,
    beaconMaxCount: 2
  });
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
  assert.equal(rifle.reload.profileId, 'rifle');
  assert.equal(rifle.reload.raiseEnd, 0.16);
  assert.equal(sniper.tracer.segmentLength, 2.6);
  assert.equal(sniper.recoil.pitch, 0.04);
  assert.equal(sniper.audioSample.url, '/assets/audio/weapons/sniper.mp3');
  assert.equal(sniper.reload.profileId, 'precision');
  assert.equal(typeof globalThis.__MAYHEM_RUNTIME.GameShared.resolveReloadPresentationState, 'function');
});

test('reload presentation helper resolves phase boundaries and completion flashes from weapon tuning', () => {
  const rifle = getWeaponPresentation('rifle');
  const raising = resolveReloadPresentationState({
    reloadMs: 1600,
    reloadRemaining: 1400,
    reloadedFlashRemaining: 0,
    reload: rifle.reload
  });
  const manipulating = resolveReloadPresentationState({
    reloadMs: 1600,
    reloadRemaining: 620,
    reloadedFlashRemaining: 0,
    reload: rifle.reload
  }, raising);
  const completed = resolveReloadPresentationState({
    reloadMs: 1600,
    reloadRemaining: 0,
    reloadedFlashRemaining: 400,
    reload: rifle.reload
  }, manipulating);

  assert.equal(raising.phase, 'raise');
  assert.equal(raising.justStarted, true);
  assert.equal(manipulating.phase, 'manipulate');
  assert.equal(completed.phase, 'complete');
  assert.equal(completed.justCompleted, true);
});

test('ADS aim profiles can tighten spread independently from hipfire', () => {
  const rifle = gameplayTuning.weaponStats.rifle;
  const shotgun = gameplayTuning.weaponStats.shotgun;
  const pistol = gameplayTuning.weaponStats.pistol;
  const sniper = gameplayTuning.weaponStats.sniper;
  const machinegun = gameplayTuning.weaponStats.machinegun;

  assert.equal(rifle.hipfireSpread, 0.024);
  assert.equal(rifle.adsSpread, 0);
  assert.equal(pistol.hipfireSpread, 0.137);
  assert.equal(pistol.adsSpread, 0.225);
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

test('survivability tuning exposes the tanky baseline and slower armor reset window', () => {
  assert.deepEqual(gameplayTuning.survivability, {
    hpMax: 360,
    armorMax: 90,
    armorRegenDelaySec: 8.0,
    armorRegenPerSec: 10
  });
  assert.equal(gameplayTuning.classPresets.abilities.armorMax, 90);
  assert.equal(gameplayTuning.classPresets.ffa.armorMax, 90);
});

test('ability tuning keeps the latest hook, heal, and deadeye defaults', () => {
  assert.equal(gameplayTuning.abilityCatalog.choke.cooldownMs, 18000);
  assert.equal(gameplayTuning.abilityCatalog.choke.duration, 1.25);
  assert.equal(gameplayTuning.abilityCatalog.hook.stunDuration, 0.5);
  assert.equal(gameplayTuning.abilityCatalog.hook.pullSpeed, 20);
  assert.equal(gameplayTuning.abilityCatalog.heal.healAmount, 90);
  assert.equal(gameplayTuning.abilityCatalog.missile.cooldownMs, 7500);
  assert.equal(gameplayTuning.abilityCatalog.deadeye.damage, 160);
  assert.equal(Object.prototype.hasOwnProperty.call(gameplayTuning.abilityCatalog.deadeye, 'slot'), false);
  assert.equal(gameplayTuning.weaponStats.sniper.armorBufferMode, 'heavy');
  assert.equal(gameplayTuning.throwables.frag.minBlastDamage, 10);
  assert.equal(gameplayTuning.throwables.molotov.armorBufferMode, 'normal');
});

test('ability defaults and normalization resolve to a single equipped ability', () => {
  assert.equal(getDefaultAbilityId(), 'deadeye');
  assert.equal(normalizeAbilityId('missile'), 'missile');
  assert.equal(normalizeAbilityId('not-real'), 'deadeye');
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
