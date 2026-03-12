const DEFAULT_CAMERA_FOV_DEG = 75;
const DEFAULT_ADS_FOV_DEG = 56;
const DEFAULT_SNIPER_SCOPE_FOV_DEG = 24;
const DEFAULT_WEAPON_PRESENTATION = {
  tracer: { life: 0.11, speed: 280, segmentLength: 2.1 },
  recoil: { z: -0.05, x: -0.09, pitch: 0.018, yaw: 0.009, roll: 0.006, armR: 0.22, armL: 0.1, muzzleMs: 60 },
  audioSample: null
};

export const gameplayTuning = {
  awareness: {
    segments: 8,
    radarRange: 35,
    coreRange: 10,
    beaconMinRange: 35,
    beaconMaxCount: 2
  },
  enemy: {
    fireRange: 34,
    headshotNearRange: 12,
    headshotMidRange: 22,
    defaultWallhackRadius: 90
  },
  weaponFalloff: {
    rifle: [
      { maxDistance: 32, scale: 1.0 },
      { maxDistance: 58, scale: 0.95 },
      { maxDistance: 90, scale: 0.86 },
      { maxDistance: 120, scale: 0.76 }
    ],
    pistol: [
      { maxDistance: 16, scale: 1.0 },
      { maxDistance: 28, scale: 0.88 },
      { maxDistance: 42, scale: 0.72 },
      { maxDistance: 54, scale: 0.56 }
    ],
    machinegun: [
      { maxDistance: 16, scale: 1.0 },
      { maxDistance: 30, scale: 0.95 },
      { maxDistance: 48, scale: 0.84 },
      { maxDistance: 72, scale: 0.70 }
    ],
    shotgun: [
      { maxDistance: 7, scale: 1.0 },
      { maxDistance: 12, scale: 0.80 },
      { maxDistance: 18, scale: 0.55 },
      { maxDistance: 26, scale: 0.28 }
    ],
    sniper: [
      { maxDistance: 99999, scale: 1.0 }
    ],
    seekergun: [
      { maxDistance: 28, scale: 1.0 }
    ]
  },
  throwableMechanics: {
    aimRayRange: 100,
    fragBounceMaxCount: 2,
    fragBounceVelocityDamping: 0.4,
    fragBounceVerticalDamping: 0.42,
    fragBounceStopSpeedSq: 2.5,
    predictedTtlMs: 5000,
    throwIntentOriginMaxOffset: 1.2,
    throwIntentDirectionMinDot: -0.2
  },
  classPresets: {
    default: { armorMax: 90, wallhackRadius: 90 }
  },
  weaponStats: {
    rifle: {
      name: 'Rifle',
      primitiveType: 'hitscan_single',
      automatic: false,
      cooldownMs: 260,
      reloadMs: 1550,
      magazineSize: 15,
      bodyDamage: 44,
      headDamage: 104,
      maxRange: 110,
      pellets: 1,
      hipfireSpread: 0.024,
      adsSpreadMultiplier: 0.0,
      adsSpread: 0,
      adsFovDeg: 56,
      adsMaxRange: 132,
      adsHitscanRangeMultiplier: 1.2,
      hipfireBloomScale: 2.5,
      adsBloomScale: 1,
      aimProfile: {
        hipfire: { spread: 0.024, maxRange: 110 },
        ads: { spread: 0, maxRange: 132 }
      },
      presentation: {
        tracer: { life: 0.11, speed: 280, segmentLength: 1.25 },
        recoil: { z: -0.05, x: -0.09, pitch: 0.018, yaw: 0.009, roll: 0.006, armR: 0.22, armL: 0.1, muzzleMs: 60 },
        audioSample: { url: '/assets/audio/weapons/rifle.mp3', gain: 0.66, playbackRateMin: 0.97, playbackRateMax: 1.03 }
      }
    },
    pistol: {
      name: 'Pistol',
      primitiveType: 'hitscan_multi',
      automatic: false,
      cooldownMs: 360,
      reloadMs: 1350,
      magazineSize: 10,
      bodyDamage: 46,
      headDamage: 150,
      maxRange: 24,
      pellets: 12,
      hipfireSpread: 0.156,
      adsSpreadMultiplier: 1.0,
      adsSpread: 0.156,
      adsFovDeg: 56,
      adsMaxRange: 28,
      adsHitscanRangeMultiplier: (28 / 24),
      singleHitFromPellets: true,
      aimProfile: {
        hipfire: { spread: 0.156, maxRange: 24 },
        ads: { spread: 0.156, maxRange: 28 }
      },
      presentation: {
        tracer: { life: 0.11, speed: 280, segmentLength: 0.25 },
        recoil: { z: -0.04, x: -0.08, pitch: 0.014, yaw: 0.007, roll: 0.005, armR: 0.2, armL: 0.08, muzzleMs: 60 },
        audioSample: { url: '/assets/audio/weapons/pistol.mp3', gain: 0.72, playbackRateMin: 0.98, playbackRateMax: 1.04 }
      }
    },
    machinegun: {
      name: 'Machine Gun',
      primitiveType: 'hitscan_single',
      automatic: true,
      cooldownMs: 82,
      reloadMs: 1388,
      magazineSize: 45,
      bodyDamage: 15,
      headDamage: 23,
      maxRange: 58,
      pellets: 1,
      hipfireSpread: 0.046,
      adsSpreadMultiplier: 1.0,
      adsSpread: 0.046,
      adsFovDeg: 56,
      adsMaxRange: 72,
      adsHitscanRangeMultiplier: (72 / 58),
      aimProfile: {
        hipfire: { spread: 0.046, maxRange: 58 },
        ads: { spread: 0.046, maxRange: 72 }
      },
      presentation: {
        tracer: { life: 0.075, speed: 260, segmentLength: 1.0 },
        recoil: { z: -0.024, x: -0.045, pitch: 0.009, yaw: 0.006, roll: 0.004, armR: 0.14, armL: 0.06, muzzleMs: 55 },
        audioSample: { url: '/assets/audio/weapons/rifle.mp3', gain: 0.45, playbackRateMin: 1.16, playbackRateMax: 1.26 }
      }
    },
    shotgun: {
      name: 'Shotgun',
      primitiveType: 'hitscan_multi',
      automatic: false,
      cooldownMs: 1000,
      reloadMs: 1850,
      magazineSize: 6,
      bodyDamage: 17,
      headDamage: 25,
      maxRange: 26,
      pellets: 12,
      hipfireSpread: 0.19,
      adsSpreadMultiplier: 1.0,
      adsSpread: 0.19,
      adsFovDeg: 56,
      adsMaxRange: 26,
      adsHitscanRangeMultiplier: 1.0,
      aimProfile: {
        hipfire: { spread: 0.19, maxRange: 26 },
        ads: { spread: 0.19, maxRange: 26 }
      },
      presentation: {
        tracer: { life: 0.10, speed: 230, segmentLength: 1.9 },
        recoil: { z: -0.09, x: -0.16, pitch: 0.03, yaw: 0.012, roll: 0.008, armR: 0.26, armL: 0.12, muzzleMs: 70 },
        audioSample: { url: '/assets/audio/weapons/shotgun.mp3', gain: 0.98, playbackRateMin: 0.97, playbackRateMax: 1.02 }
      }
    },
    sniper: {
      name: 'Sniper',
      primitiveType: 'hitscan_single',
      automatic: false,
      cooldownMs: 1450,
      reloadMs: 2100,
      magazineSize: 5,
      bodyDamage: 230,
      headDamage: 500,
      maxRange: 160,
      pellets: 1,
      hipfireSpread: 0.32,
      adsSpreadMultiplier: 0.0,
      adsSpread: 0,
      adsFovDeg: 24,
      adsMaxRange: 160,
      adsHitscanRangeMultiplier: 1.0,
      infiniteRange: true,
      aimProfile: {
        hipfire: { spread: 0.32, maxRange: 160 },
        ads: { spread: 0, maxRange: 160 }
      },
      presentation: {
        tracer: { life: 0.12, speed: 320, segmentLength: 2.6 },
        recoil: { z: -0.12, x: -0.2, pitch: 0.04, yaw: 0.01, roll: 0.007, armR: 0.3, armL: 0.12, muzzleMs: 90 },
        audioSample: { url: '/assets/audio/weapons/sniper.mp3', gain: 0.82, playbackRateMin: 0.96, playbackRateMax: 1.0 }
      }
    },
    seekergun: {
      name: 'Seeker',
      primitiveType: 'projectile_homing',
      automatic: true,
      cooldownMs: 380,
      bodyDamage: 72,
      headDamage: 72,
      maxRange: 28,
      pellets: 1,
      hipfireSpread: 0,
      adsSpreadMultiplier: 1.0,
      adsHitscanRangeMultiplier: 1.0
    }
  },
  defaultWeaponLoadout: ['machinegun', 'shotgun'],
  selectableWeaponIds: ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'],
  throwableCategories: {
    grenade: { label: 'Grenades', items: ['frag', 'seeker', 'molotov'], previewType: 'trajectory' },
    blade:   { label: 'Blades & Objects', items: ['knife'], previewType: 'none' }
  },
  throwables: {
    order: ['frag', 'seeker', 'molotov', 'knife'],
    frag: {
      id: 'frag',
      category: 'grenade',
      label: 'Frag',
      speed: 22.5,
      upward: 5.2,
      gravity: 19,
      fuse: 2.2,
      radius: 6.8,
      damage: 125,
      regen: 10,
      bounce: true,
      bounceVelocityDamping: 0.4,
      bounceVerticalDamping: 0.42,
      bounceMaxCount: 2,
      bounceStopSpeedSq: 2.5
    },
    seeker: {
      id: 'seeker',
      category: 'grenade',
      label: 'Plasma Grenade',
      speed: 16,
      upward: 4.4,
      gravity: 12,
      fuse: 3.4,
      radius: 5.0,
      damage: 110,
      regen: 10,
      homingBoost: 2.0,
      homingLerp: 4.8,
      acquireRange: 18,
      acquireHalfAngleDeg: 35,
      stickExplodeDelay: 0.65
    },
    seekershot: {
      id: 'seekershot',
      label: 'Seeker Shot',
      speed: 31,
      upward: 0.4,
      gravity: 4.5,
      fuse: 1.8,
      radius: 4.2,
      damage: 72,
      homingBoost: 4.0,
      homingLerp: 4.6,
      lockHalfAngleDeg: 20
    },
    molotov: {
      id: 'molotov',
      category: 'grenade',
      label: 'Molotov',
      speed: 17,
      upward: 4.8,
      gravity: 21,
      fuse: 3.0,
      fireRadius: 3.8,
      fireDuration: 5.5,
      fireTickDamage: 18,
      fireTickRate: 0.35,
      regen: 10
    },
    knife: {
      id: 'knife',
      category: 'blade',
      label: 'Knife',
      speed: 28,
      upward: 1.4,
      gravity: 7,
      life: 1.8,
      hitRadius: 0.55,
      bodyDamage: 100,
      headDamage: 250,
      regen: 8
    }
  }
};

export function getClassPreset(classId) {
  return gameplayTuning.classPresets[classId] || gameplayTuning.classPresets.default;
}

export function getWeaponStats(weaponId) {
  return gameplayTuning.weaponStats[weaponId] || null;
}

export function getWeaponPresentation(weaponId) {
  const stats = gameplayTuning.weaponStats[String(weaponId || '')] || gameplayTuning.weaponStats.rifle || {};
  const raw = stats.presentation || {};
  const tracer = raw.tracer || {};
  const recoil = raw.recoil || {};
  const audioSample = raw.audioSample || null;
  return {
    tracer: {
      life: Number.isFinite(Number(tracer.life)) ? Number(tracer.life) : DEFAULT_WEAPON_PRESENTATION.tracer.life,
      speed: Number.isFinite(Number(tracer.speed)) ? Number(tracer.speed) : DEFAULT_WEAPON_PRESENTATION.tracer.speed,
      segmentLength: Number.isFinite(Number(tracer.segmentLength)) ? Number(tracer.segmentLength) : DEFAULT_WEAPON_PRESENTATION.tracer.segmentLength
    },
    recoil: {
      z: Number.isFinite(Number(recoil.z)) ? Number(recoil.z) : DEFAULT_WEAPON_PRESENTATION.recoil.z,
      x: Number.isFinite(Number(recoil.x)) ? Number(recoil.x) : DEFAULT_WEAPON_PRESENTATION.recoil.x,
      pitch: Number.isFinite(Number(recoil.pitch)) ? Number(recoil.pitch) : DEFAULT_WEAPON_PRESENTATION.recoil.pitch,
      yaw: Number.isFinite(Number(recoil.yaw)) ? Number(recoil.yaw) : DEFAULT_WEAPON_PRESENTATION.recoil.yaw,
      roll: Number.isFinite(Number(recoil.roll)) ? Number(recoil.roll) : DEFAULT_WEAPON_PRESENTATION.recoil.roll,
      armR: Number.isFinite(Number(recoil.armR)) ? Number(recoil.armR) : DEFAULT_WEAPON_PRESENTATION.recoil.armR,
      armL: Number.isFinite(Number(recoil.armL)) ? Number(recoil.armL) : DEFAULT_WEAPON_PRESENTATION.recoil.armL,
      muzzleMs: Number.isFinite(Number(recoil.muzzleMs)) ? Number(recoil.muzzleMs) : DEFAULT_WEAPON_PRESENTATION.recoil.muzzleMs
    },
    audioSample: audioSample && audioSample.url ? {
      url: String(audioSample.url),
      gain: Number.isFinite(Number(audioSample.gain)) ? Number(audioSample.gain) : 1,
      playbackRateMin: Number.isFinite(Number(audioSample.playbackRateMin)) ? Number(audioSample.playbackRateMin) : 1,
      playbackRateMax: Number.isFinite(Number(audioSample.playbackRateMax)) ? Number(audioSample.playbackRateMax) : 1
    } : null
  };
}

export function resolveWeaponAdsFovDeg(weaponStats) {
  const stats = weaponStats || {};
  const raw = Number(stats.adsFovDeg);
  if (Number.isFinite(raw) && raw > 0.0001) {
    return Math.max(1, Math.min(DEFAULT_CAMERA_FOV_DEG, raw));
  }
  return stats.id === 'sniper' ? DEFAULT_SNIPER_SCOPE_FOV_DEG : DEFAULT_ADS_FOV_DEG;
}

export function getWeaponFalloffProfile(weaponId) {
  const profile = gameplayTuning.weaponFalloff[String(weaponId || '')];
  if (!Array.isArray(profile) || profile.length === 0) return [];
  return profile
    .map((band) => ({
      maxDistance: Number(band && band.maxDistance),
      scale: Number(band && band.scale)
    }))
    .filter((band) => Number.isFinite(band.maxDistance) && band.maxDistance > 0 && Number.isFinite(band.scale))
    .sort((a, b) => a.maxDistance - b.maxDistance);
}

export function resolveWeaponAimProfile(weaponStats, adsActive) {
  const stats = weaponStats || {};
  const baseHipfireSpread = Math.max(0, Number(stats.hipfireSpread || 0));
  const baseAdsSpread = Math.max(0, Number(stats.adsSpread != null ? stats.adsSpread : baseHipfireSpread));
  const aimProfile = stats.aimProfile || {};
  const hipfire = aimProfile.hipfire || {};
  const ads = aimProfile.ads || {};
  const hipfireSpread = Math.max(0, Number(hipfire.spread != null ? hipfire.spread : baseHipfireSpread));
  const adsSpread = Math.max(0, Number(ads.spread != null ? ads.spread : baseAdsSpread));
  const hipfireRange = Math.max(0, Number(hipfire.maxRange != null ? hipfire.maxRange : stats.maxRange || 0));
  const adsRange = Math.max(
    hipfireRange,
    Number(
      ads.maxRange != null
        ? ads.maxRange
        : (stats.adsMaxRange != null
          ? stats.adsMaxRange
          : (hipfireRange * Math.max(1, Number(stats.adsHitscanRangeMultiplier || 1))))
    )
  );
  const resolvedHipfireRange = stats.infiniteRange ? Infinity : hipfireRange;
  const resolvedAdsRange = stats.infiniteRange ? Infinity : adsRange;

  return adsActive
    ? { spread: adsSpread, maxRange: resolvedAdsRange }
    : { spread: hipfireSpread, maxRange: resolvedHipfireRange };
}

export function getDefaultWeaponLoadout() {
  return Array.isArray(gameplayTuning.defaultWeaponLoadout) && gameplayTuning.defaultWeaponLoadout.length
    ? gameplayTuning.defaultWeaponLoadout.slice(0, 2)
    : ['machinegun', 'shotgun'];
}

export function getSelectableWeaponIds() {
  return Array.isArray(gameplayTuning.selectableWeaponIds) && gameplayTuning.selectableWeaponIds.length
    ? gameplayTuning.selectableWeaponIds.slice()
    : ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'];
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.gameplayTuning = gameplayTuning;
runtime.GameShared.getClassPreset = getClassPreset;
runtime.GameShared.getWeaponStats = getWeaponStats;
runtime.GameShared.getWeaponPresentation = getWeaponPresentation;
runtime.GameShared.resolveWeaponAdsFovDeg = resolveWeaponAdsFovDeg;
runtime.GameShared.getWeaponFalloffProfile = getWeaponFalloffProfile;
runtime.GameShared.resolveWeaponAimProfile = resolveWeaponAimProfile;
runtime.GameShared.getDefaultWeaponLoadout = getDefaultWeaponLoadout;
runtime.GameShared.getSelectableWeaponIds = getSelectableWeaponIds;
