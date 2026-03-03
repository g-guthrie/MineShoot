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
const plasma = weaponStats('plasma', { cooldownMs: 100, bodyDamage: 15, maxRange: 24 });
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
    maxRange: Number(seekergun.maxRange || 24),
    lockBoxPx: 260,
    coneHalfAngleDeg: Number(seekershot.lockHalfAngleDeg || 30),
    homing: {
      speed: Number(seekershot.speed || 34),
      boost: Number(seekershot.homingBoost || 4.5),
      lerp: Number(seekershot.homingLerp || 3.8)
    },
    projectileType: 'plasma_stream'
  },
  plasma_stream: {
    id: 'plasma_stream',
    weaponId: 'plasma',
    mode: 'stream',
    cooldownMs: Number(plasma.cooldownMs || 100),
    maxRange: Number(plasma.maxRange || 24),
    lockBoxPx: 360,
    coneHalfAngleDeg: 35,
    tickDamage: Number(plasma.bodyDamage || 15),
    tickIntervalMs: Number(plasma.cooldownMs || 100),
    overheatMaxSustainMs: 2500,
    overheatLockoutMs: 1600,
    homing: {
      speed: Number(seekershot.speed || 34),
      boost: Number(seekershot.homingBoost || 4.5),
      lerp: Number(seekershot.homingLerp || 3.8)
    },
    projectileType: 'plasma_stream'
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
  if (weaponId === 'plasma') return seekProfiles.plasma_stream;
  if (weaponId === 'seekergun') return seekProfiles.seekergun_shot;
  return null;
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.seekProfiles = seekProfiles;
