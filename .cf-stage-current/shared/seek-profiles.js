import { gameplayTuning } from './gameplay-tuning.js';

function weaponStats(id, fallback) {
  const stats = gameplayTuning && gameplayTuning.weaponStats
    ? gameplayTuning.weaponStats[id]
    : null;
  if (!stats) return fallback;
  return stats;
}

function throwableStats(id, fallback) {
  const stats = gameplayTuning && gameplayTuning.throwables
    ? gameplayTuning.throwables[id]
    : null;
  if (!stats) return fallback;
  return stats;
}

const seekergun = weaponStats('seekergun', { cooldownMs: 320, maxRange: 24 });
const seekershot = throwableStats('seekershot', {
  speed: 34,
  homingBoost: 4.5,
  homingLerp: 3.8,
  lockHalfAngleDeg: 30
});
const seekerThrowable = throwableStats('seeker', {
  speed: 14,
  homingBoost: 2.0,
  homingLerp: 4.8,
  acquireRange: 18,
  acquireHalfAngleDeg: 35,
  stickExplodeDelay: 0.65
});

export const seekProfiles = {
  seekergun_shot: {
    id: 'seekergun_shot',
    weaponId: 'seekergun',
    mode: 'impact',
    cooldownMs: Number(seekergun.cooldownMs || 320),
    maxRange: Number(seekergun.maxRange || 28),
    hipfireMaxRange: 18,
    adsMaxRange: Number(seekergun.maxRange || 28),
    lockBoxPx: 260,
    hipfireLockBoxPx: 220,
    adsLockBoxPx: 320,
    coneHalfAngleDeg: Number(seekershot.lockHalfAngleDeg || 20),
    hipfireConeHalfAngleDeg: Number(seekershot.lockHalfAngleDeg || 20),
    adsConeHalfAngleDeg: 32,
    homing: {
      speed: Number(seekershot.speed || 31),
      boost: Number(seekershot.homingBoost || 4.0),
      lerp: Number(seekershot.homingLerp || 4.6)
    },
    projectileType: 'seekershot'
  },
  seeker_throwable: {
    id: 'seeker_throwable',
    weaponId: 'seeker',
    mode: 'throwable',
    maxRange: Number(seekerThrowable.acquireRange || 18),
    coneHalfAngleDeg: Number(seekerThrowable.acquireHalfAngleDeg || 35),
    homing: {
      speed: Number(seekerThrowable.speed || 14),
      boost: Number(seekerThrowable.homingBoost || 2.0),
      lerp: Number(seekerThrowable.homingLerp || 4.8)
    },
    stickExplodeDelaySec: Number(seekerThrowable.stickExplodeDelay || 0.65)
  }
};

export function getSeekProfile(id) {
  return seekProfiles[id] || null;
}

export function getSeekProfileByWeaponId(weaponId) {
  if (weaponId === 'seekergun') return seekProfiles.seekergun_shot;
  return null;
}

export function resolveSeekAimProfile(profile, adsActive) {
  if (!profile) return null;
  const isAds = !!adsActive;
  return {
    maxRange: Number(isAds ? (profile.adsMaxRange || profile.maxRange) : (profile.hipfireMaxRange || profile.maxRange)),
    lockBoxPx: Number(isAds ? (profile.adsLockBoxPx || profile.lockBoxPx) : (profile.hipfireLockBoxPx || profile.lockBoxPx)),
    coneHalfAngleDeg: Number(isAds ? (profile.adsConeHalfAngleDeg || profile.coneHalfAngleDeg) : (profile.hipfireConeHalfAngleDeg || profile.coneHalfAngleDeg))
  };
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.seekProfiles = seekProfiles;
runtime.GameShared.resolveSeekAimProfile = resolveSeekAimProfile;
