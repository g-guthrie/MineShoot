import test from 'node:test';
import assert from 'node:assert/strict';

import {
  gameplayTuning,
  getAwarenessTuning,
  getEnemyTuning,
  getDefaultThrowableId,
  getSelectableWeaponIds,
  getThrowableMechanicsTuning,
  getWeaponFalloffProfile,
  getWeaponPresentation,
  normalizeThrowableId,
  resolveReloadPresentationState,
  resolveWeaponAdsFovDeg,
  resolveWeaponAimProfile
} from '../../shared/gameplay-tuning.js';
import { DEFAULT_HP_MAX, DEFAULT_ARMOR_MAX } from '../../shared/entity-constants.js';
import {
  ARMOR_REGEN_DELAY_MS,
  ARMOR_REGEN_DELAY_SEC,
  ARMOR_REGEN_PER_SEC,
  regenArmorFromLastDamage
} from '../../shared/survivability.js';

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
  assert.equal(FULL_HEALTH_DURABILITY, gameplayTuning.survivability.hpMax + gameplayTuning.survivability.armorMax);
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
  for (const weapon of Object.values(gameplayTuning.weaponStats)) {
    assert.equal(Number.isInteger(Number(weapon.magazineSize || 0)), true);
    assert.equal(Number(weapon.magazineSize || 0) > 0, true);
    assert.equal(Number.isFinite(Number(weapon.reloadMs || 0)), true);
    assert.equal(Number(weapon.reloadMs || 0) > 0, true);
  }
});

test('awareness tuning expands radar coverage before targets are already visually obvious', () => {
  assert.deepEqual(getAwarenessTuning(), {
    segments: 8,
    radarRange: 56,
    coreRange: 10,
    beaconMinRange: 56,
    beaconMaxCount: 2
  });
  assert.equal(typeof globalThis.__MAYHEM_RUNTIME.GameShared.getAwarenessTuning, 'function');
  assert.deepEqual(globalThis.__MAYHEM_RUNTIME.GameShared.getAwarenessTuning(), getAwarenessTuning());
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
  const handCannon = getWeaponPresentation('pistol');
  const sniper = getWeaponPresentation('sniper');

  assert.equal(rifle.tracer.speed, 280);
  assert.equal(rifle.recoil.muzzleMs, 60);
  assert.equal(rifle.recoil.pattern, 'push');
  assert.equal(rifle.recoil.pitchKickScale, 1.25);
  assert.equal(rifle.audioSample.url, '/assets/audio/weapons/rifle.mp3');
  assert.equal(rifle.reload.profileId, 'rifle');
  assert.equal(rifle.reload.raiseEnd, 0.16);
  assert.equal(handCannon.recoil.pattern, 'snap');
  assert.equal(handCannon.recoil.rollKickScale, 1.35);
  assert.equal(sniper.tracer.segmentLength, 2.6);
  assert.equal(sniper.recoil.pitch, 0.04);
  assert.equal(sniper.recoil.pattern, 'u_shape');
  assert.equal(sniper.recoil.patternStrength, 0.6);
  assert.equal(sniper.audioSample.url, '/assets/audio/weapons/sniper.mp3');
  assert.equal(sniper.reload.profileId, 'precision');
  assert.equal(typeof globalThis.__MAYHEM_RUNTIME.GameShared.resolveReloadPresentationState, 'function');
});

test('reload presentation helper resolves phase boundaries and completion flashes from weapon tuning', () => {
  const rifle = getWeaponPresentation('rifle');
  const rifleReloadMs = Number(gameplayTuning.weaponStats.rifle.reloadMs || 0);
  const raising = resolveReloadPresentationState({
    reloadMs: rifleReloadMs,
    reloadRemaining: rifleReloadMs * 0.9,
    reloadedFlashRemaining: 0,
    reload: rifle.reload
  });
  const manipulating = resolveReloadPresentationState({
    reloadMs: rifleReloadMs,
    reloadRemaining: rifleReloadMs * 0.39,
    reloadedFlashRemaining: 0,
    reload: rifle.reload
  }, raising);
  const completed = resolveReloadPresentationState({
    reloadMs: rifleReloadMs,
    reloadRemaining: 0,
    reloadedFlashRemaining: Math.round(rifleReloadMs * 0.25),
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
  assert.equal(pistol.hipfireSpread, 0.105);
  assert.equal(pistol.adsSpread, 0.105);
  assert.equal(machinegun.adsSpread, 0.035);
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
    assert.equal(typeof weapon.moveSpeedMultiplier, 'number');
    assert.equal(typeof weapon.adsMoveMultiplier, 'number');
  }
  assert.equal(resolveWeaponAdsFovDeg(shotgun), 56);
  assert.equal(resolveWeaponAdsFovDeg(sniper), 24);
});

test('survivability tuning exposes the tanky baseline and slower armor reset window', () => {
  assert.equal(gameplayTuning.survivability.hpMax, DEFAULT_HP_MAX);
  assert.equal(gameplayTuning.survivability.armorMax, DEFAULT_ARMOR_MAX);
  assert.equal(gameplayTuning.classPresets.ffa.armorMax, gameplayTuning.survivability.armorMax);
  assert.equal(ARMOR_REGEN_DELAY_SEC, gameplayTuning.survivability.armorRegenDelaySec);
  assert.equal(ARMOR_REGEN_DELAY_MS, gameplayTuning.survivability.armorRegenDelaySec * 1000);
  assert.equal(ARMOR_REGEN_PER_SEC, gameplayTuning.survivability.armorRegenPerSec);
});

test('shared survivability helper owns the live armor recharge rule', () => {
  const blocked = { alive: true, armor: 0, armorMax: 100, lastDamageAt: 1000 };
  assert.equal(regenArmorFromLastDamage(blocked, 1, 12999), false);
  assert.equal(blocked.armor, 0);

  const ready = { alive: true, armor: 0, armorMax: 100, lastDamageAt: 1000 };
  assert.equal(regenArmorFromLastDamage(ready, 1, 13000), true);
  assert.equal(ready.armor, 25);

  const capped = { alive: true, armor: 100, armorMax: 100, lastDamageAt: 0 };
  assert.equal(regenArmorFromLastDamage(capped, 1, 13000), false);
  assert.equal(capped.armor, 100);
});

test('throwable and combat tuning stay available after the system purge', () => {
  assert.deepEqual(getEnemyTuning(), gameplayTuning.enemy);
  assert.equal(typeof globalThis.__MAYHEM_RUNTIME.GameShared.getEnemyTuning, 'function');
  assert.deepEqual(getThrowableMechanicsTuning(), gameplayTuning.throwableMechanics);
  assert.equal(typeof globalThis.__MAYHEM_RUNTIME.GameShared.getThrowableMechanicsTuning, 'function');
  assert.equal(Object.prototype.hasOwnProperty.call(gameplayTuning, 'abilityCatalog'), false);
  assert.equal(gameplayTuning.weaponStats.sniper.armorBufferMode, 'normal');
  assert.equal(Number(gameplayTuning.throwables.frag.minBlastDamage || 0) > 0, true);
  assert.equal(gameplayTuning.throwables.frag.armorBufferMode, 'normal');
  assert.equal(gameplayTuning.throwables.plasma.armorBufferMode, 'normal');
  assert.equal(gameplayTuning.throwables.missile.armorBufferMode, 'normal');
  assert.equal(gameplayTuning.throwables.molotov.armorBufferMode, 'normal');
});

test('throwable defaults and normalization resolve to a single equipped throwable', () => {
  assert.equal(getDefaultThrowableId(), 'frag');
  assert.equal(normalizeThrowableId('plasma'), 'plasma');
  assert.equal(normalizeThrowableId('not-real'), 'frag');
  assert.equal(typeof globalThis.__MAYHEM_RUNTIME.GameShared.getDefaultThrowableId, 'function');
  assert.equal(typeof globalThis.__MAYHEM_RUNTIME.GameShared.normalizeThrowableId, 'function');
});

test('network tuning exposes the canonical ping, reconcile, burst, and feedback defaults', () => {
  assert.deepEqual(gameplayTuning.network.flags, {
    adaptiveSelfReconciliation: true,
    replayFirstSelfCorrection: true,
    remoteReceiveJitterBuffer: true,
    snapshotDeltaCompression: true,
    adaptiveSnapshotCadence: true,
    combatBurstSnapshots: true,
    shotTokenDamageAggregation: false
  });
  assert.equal(gameplayTuning.network.ping.cadenceMs, 500);
  assert.equal(gameplayTuning.network.selfReconciliation.movingReplayDistanceWu, 1.25);
  assert.equal(gameplayTuning.network.selfReconciliation.airborneHardSnapVerticalWu, 2.75);
  assert.equal(gameplayTuning.network.selfReconciliation.airborneMovingAckDriftLimit, 5);
  assert.equal(gameplayTuning.network.combatPriority.burstCadenceMs, 16);
  assert.equal(gameplayTuning.network.remoteInterpolation.defaultDelayMs, 78);
  assert.equal(gameplayTuning.network.remoteInterpolation.extrapolationDecay, 1.2);
  assert.equal(gameplayTuning.network.remoteInterpolation.verticalBallisticEnabled, true);
  assert.equal(gameplayTuning.network.remoteInterpolation.animationStateBlendMs, 120);
  assert.equal(gameplayTuning.network.remoteInterpolation.muzzleFlashPresentationMs, 70);
  assert.equal(gameplayTuning.network.remoteInterpolation.hitboxLeadMs, 24);
  assert.equal(gameplayTuning.network.remoteInterpolation.serverOffsetSnapDeltaMs, 120);
  assert.equal(gameplayTuning.network.ping.pessimisticRttAlpha, 0.05);
  assert.equal(gameplayTuning.network.ping.pessimisticWindowMs, 2000);
  assert.equal(gameplayTuning.network.feedback.shotgunAggregateWindowMs, 60);
  assert.equal(typeof globalThis.__MAYHEM_RUNTIME.GameShared.getNetworkTuning, 'function');
});
