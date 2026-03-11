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
  movement: {
    jogSpeed: 8,
    runSpeed: 14,
    jumpVelocity: 8.8,
    jumpHoldAccel: 16,
    maxJumpHold: 0.2,
    jumpReleaseMult: 0.42,
    gravity: 18,
    adsMoveMult: 0.4
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
      { maxDistance: 72, scale: 0.7 }
    ],
    shotgun: [
      { maxDistance: 7, scale: 1.0 },
      { maxDistance: 12, scale: 0.8 },
      { maxDistance: 18, scale: 0.55 },
      { maxDistance: 26, scale: 0.28 }
    ],
    sniper: [
      { maxDistance: 99999, scale: 1.0 }
    ],
    missile: [
      { maxDistance: 34, scale: 1.0 }
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
    abilities: { armorMax: 90, wallhackRadius: 90 }
  },
  weaponStats: {
    rifle: {
      name: 'Rifle', primitiveType: 'hitscan_single', automatic: false, cooldownMs: 260, reloadMs: 1550, magazineSize: 15,
      bodyDamage: 44, headDamage: 104, maxRange: 110, pellets: 1, hipfireSpread: 0.024, adsSpread: 0, adsFovDeg: 56, adsMaxRange: 132,
      hipfireBloomScale: 2.5, adsBloomScale: 1,
      aimProfile: { hipfire: { spread: 0.024, maxRange: 110 }, ads: { spread: 0, maxRange: 132 } },
      presentation: {
        tracer: { life: 0.11, speed: 280, segmentLength: 0.25 },
        recoil: { z: -0.05, x: -0.09, pitch: 0.018, yaw: 0.009, roll: 0.006, armR: 0.22, armL: 0.1, muzzleMs: 60 },
        audioSample: { url: '/assets/audio/weapons/rifle.mp3', gain: 0.66, playbackRateMin: 0.97, playbackRateMax: 1.03 }
      }
    },
    pistol: {
      name: 'Pistol', primitiveType: 'hitscan_multi', automatic: false, cooldownMs: 360, reloadMs: 1350, magazineSize: 10,
      bodyDamage: 46, headDamage: 150, maxRange: 24, pellets: 12, hipfireSpread: 0.156, adsSpread: 0.156, adsFovDeg: 56, adsMaxRange: 28,
      aimProfile: { hipfire: { spread: 0.156, maxRange: 24 }, ads: { spread: 0.156, maxRange: 28 } },
      singleHitFromPellets: true,
      presentation: {
        tracer: { life: 0.11, speed: 280, segmentLength: 2.1 },
        recoil: { z: -0.04, x: -0.08, pitch: 0.014, yaw: 0.007, roll: 0.005, armR: 0.2, armL: 0.08, muzzleMs: 60 },
        audioSample: { url: '/assets/audio/weapons/pistol.mp3', gain: 0.72, playbackRateMin: 0.98, playbackRateMax: 1.04 }
      }
    },
    machinegun: {
      name: 'Machine Gun', primitiveType: 'hitscan_single', automatic: true, cooldownMs: 82, reloadMs: 1388, magazineSize: 45,
      bodyDamage: 15, headDamage: 23, maxRange: 58, pellets: 1, hipfireSpread: 0.046, adsSpread: 0.046, adsFovDeg: 56, adsMaxRange: 72,
      aimProfile: { hipfire: { spread: 0.046, maxRange: 58 }, ads: { spread: 0.046, maxRange: 72 } },
      presentation: {
        tracer: { life: 0.075, speed: 260, segmentLength: 1.25 },
        recoil: { z: -0.024, x: -0.045, pitch: 0.009, yaw: 0.006, roll: 0.004, armR: 0.14, armL: 0.06, muzzleMs: 55 },
        audioSample: { url: '/assets/audio/weapons/rifle.mp3', gain: 0.45, playbackRateMin: 1.16, playbackRateMax: 1.26 }
      }
    },
    shotgun: {
      name: 'Shotgun', primitiveType: 'hitscan_multi', automatic: false, cooldownMs: 1000, reloadMs: 1850, magazineSize: 6,
      bodyDamage: 17, headDamage: 25, maxRange: 26, pellets: 12, hipfireSpread: 0.19, adsSpread: 0.19, adsFovDeg: 56, adsMaxRange: 26,
      aimProfile: { hipfire: { spread: 0.19, maxRange: 26 }, ads: { spread: 0.19, maxRange: 26 } },
      presentation: {
        tracer: { life: 0.1, speed: 230, segmentLength: 1.9 },
        recoil: { z: -0.09, x: -0.16, pitch: 0.03, yaw: 0.012, roll: 0.008, armR: 0.26, armL: 0.12, muzzleMs: 70 },
        audioSample: { url: '/assets/audio/weapons/shotgun.mp3', gain: 0.98, playbackRateMin: 0.97, playbackRateMax: 1.02 }
      }
    },
    sniper: {
      name: 'Sniper', primitiveType: 'hitscan_single', automatic: false, cooldownMs: 1450, reloadMs: 2100, magazineSize: 5,
      bodyDamage: 230, headDamage: 500, maxRange: 160, pellets: 1, hipfireSpread: 0.32, adsSpread: 0, adsFovDeg: 24, adsMaxRange: 160,
      aimProfile: { hipfire: { spread: 0.32, maxRange: 160 }, ads: { spread: 0, maxRange: 160 } }, infiniteRange: true,
      presentation: {
        tracer: { life: 0.12, speed: 320, segmentLength: 2.6 },
        recoil: { z: -0.12, x: -0.2, pitch: 0.04, yaw: 0.01, roll: 0.007, armR: 0.3, armL: 0.12, muzzleMs: 90 },
        audioSample: { url: '/assets/audio/weapons/sniper.mp3', gain: 0.82, playbackRateMin: 0.96, playbackRateMax: 1.0 }
      }
    },
  },
  defaultWeaponLoadout: ['machinegun', 'shotgun'],
  selectableWeaponIds: ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'],
  throwableCategories: {
    grenade: { label: 'Grenades', items: ['frag', 'plasma', 'molotov'], previewType: 'trajectory' },
    blade:   { label: 'Blades & Objects', items: ['knife'], previewType: 'none' }
  },
  throwables: {
    order: ['frag', 'plasma', 'molotov', 'knife'],
    frag: {
      id: 'frag', category: 'grenade', label: 'Frag', speed: 22.5, upward: 5.2, gravity: 19, fuse: 2.2, radius: 6.8, damage: 125, regen: 10, bounce: true,
      bounceVelocityDamping: 0.4,
      bounceVerticalDamping: 0.42,
      bounceMaxCount: 2,
      bounceStopSpeedSq: 2.5
    },
    plasma: {
      id: 'plasma', category: 'grenade', label: 'Plasma Grenade', speed: 16, upward: 4.4, gravity: 12, fuse: 3.4, radius: 5.0, damage: 110, regen: 10,
      homingBoost: 2.0, homingLerp: 4.8, acquireRange: 18, acquireHalfAngleDeg: 35, stickExplodeDelay: 0.65
    },
    missile: {
      id: 'missile', label: 'Missile', speed: 38, upward: 0.2, gravity: 0.8, fuse: 1.25, radius: 2.4, damage: 90,
      homingBoost: 6.0, homingLerp: 8.4, lockHalfAngleDeg: 12, acquireRange: 7.5, hitRadius: 0.9
    },
    molotov: {
      id: 'molotov', category: 'grenade', label: 'Molotov', speed: 17, upward: 4.8, gravity: 21, fuse: 3.0, fireRadius: 3.8,
      fireDuration: 5.5, fireTickDamage: 18, fireTickRate: 0.35, regen: 10
    },
    knife: {
      id: 'knife', category: 'blade', label: 'Knife', speed: 28, upward: 1.4, gravity: 7, life: 1.8, hitRadius: 0.55, bodyDamage: 100, headDamage: 250, regen: 8
    }
  },
  abilityCatalog: {
    choke: {
      id: 'choke', slot: 'ability', name: 'Vader Choke',
      description: 'Single-target lift and stun in reticle box.',
      debugSummary: 'Square = choke target box.',
      tunableParams: ['lockBoxPx', 'range', 'targetTolerance', 'duration', 'liftHeight', 'tickRate', 'dotPerTick'],
      cooldownMs: 15000, range: 28, minDot: 0.05, duration: 2.0,
      liftHeight: 1.75, tickRate: 0.25, dotPerTick: 0, castDamage: 0, lockBoxPx: 315, targetTolerance: 1.6
    },
    hook: {
      id: 'hook', slot: 'either', name: 'Chain Hook',
      description: 'Latch a target and yank them into close range.',
      debugSummary: 'Circle = hook catch radius debug.',
      tunableParams: ['reticleRadiusPx', 'catchRadius', 'range', 'travelSpeed', 'pullDistance', 'castDamage', 'cooldownMs'],
      cooldownMs: 15000, range: 24, minDot: 0.03, pullDistance: 3.2,
      stunDuration: 1.0, castDamage: 35, lockBoxPx: 170, reticleRadiusPx: 78, catchRadius: 2.4, travelSpeed: 24
    },
    heal: {
      id: 'heal', slot: 'either', name: 'Heal',
      description: 'Brief self-heal with visible windup.',
      debugSummary: 'Visible windup before the heal resolves.',
      tunableParams: ['healAmount', 'cooldownMs'],
      cooldownMs: 15000, duration: 0.85, healAmount: 150
    },
    missile: {
      id: 'missile', slot: 'either', name: 'Missile',
      description: 'Fast guided micro-rocket that bends toward nearby targets.',
      debugSummary: 'Fires from muzzle and gently seeks toward nearby hostile hitboxes.',
      tunableParams: ['range', 'cooldownMs', 'damage', 'radius', 'travelSpeed', 'acquireRange', 'catchRadius', 'lockHalfAngleDeg', 'homingBoost', 'homingLerp'],
      cooldownMs: 900, range: 34, damage: 90, radius: 2.4, travelSpeed: 38, acquireRange: 7.5, catchRadius: 1.25,
      lockHalfAngleDeg: 12, homingBoost: 6.0, homingLerp: 8.4, gravity: 0.8, fuse: 1.25
    },
    deadeye: {
      id: 'deadeye', slot: 'ultimate', name: 'Deadeye',
      description: 'Lock and execute marked targets.',
      debugSummary: 'Rectangle = deadeye acquisition FOV approximation.',
      tunableParams: ['range', 'minDot', 'duration', 'maxTargets', 'damage', 'cooldownMs'],
      cooldownMs: 15000, range: 70, duration: 1.5, maxTargets: 2, minDot: 0.22, damage: 180
    }
  },
  defaultAbilityLoadout: { slot1: 'choke', slot2: 'missile' }
};

export function getClassPreset(classId) {
  return gameplayTuning.classPresets[classId] || gameplayTuning.classPresets.abilities;
}

export function getMovementTuning() {
  return gameplayTuning.movement || {};
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

export function getAbilityDef(abilityId) {
  return (gameplayTuning.abilityCatalog && gameplayTuning.abilityCatalog[abilityId]) || null;
}

export function getAbilityCatalog() {
  return gameplayTuning.abilityCatalog || {};
}

export function getDefaultAbilityLoadout() {
  return gameplayTuning.defaultAbilityLoadout || { slot1: 'choke', slot2: 'missile' };
}

function resolveAbilityChoice(requestedId, blockedId, fallbacks, catalogIds, catalog) {
  const choices = [requestedId];
  if (Array.isArray(fallbacks)) {
    for (let i = 0; i < fallbacks.length; i++) {
      choices.push(fallbacks[i]);
    }
  }
  if (Array.isArray(catalogIds)) {
    for (let i = 0; i < catalogIds.length; i++) {
      choices.push(catalogIds[i]);
    }
  }

  const blocked = String(blockedId || '');
  for (let i = 0; i < choices.length; i++) {
    const id = String(choices[i] || '');
    if (!id || id === blocked || !catalog[id]) continue;
    return id;
  }
  return '';
}

export function normalizeAbilityLoadout(slot1, slot2) {
  const catalog = getAbilityCatalog();
  const catalogIds = Object.keys(catalog);
  const defaults = getDefaultAbilityLoadout() || {};
  const normalizedSlot1 = resolveAbilityChoice(
    slot1,
    '',
    [defaults.slot1, defaults.slot2],
    catalogIds,
    catalog
  );
  const normalizedSlot2 = resolveAbilityChoice(
    slot2,
    normalizedSlot1,
    [defaults.slot2, defaults.slot1],
    catalogIds,
    catalog
  );

  return {
    slot1: normalizedSlot1,
    slot2: normalizedSlot2
  };
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.gameplayTuning = gameplayTuning;
runtime.GameShared.getMovementTuning = getMovementTuning;
runtime.GameShared.getWeaponStats = getWeaponStats;
runtime.GameShared.getWeaponPresentation = getWeaponPresentation;
runtime.GameShared.resolveWeaponAdsFovDeg = resolveWeaponAdsFovDeg;
runtime.GameShared.getWeaponFalloffProfile = getWeaponFalloffProfile;
runtime.GameShared.getDefaultWeaponLoadout = getDefaultWeaponLoadout;
runtime.GameShared.getSelectableWeaponIds = getSelectableWeaponIds;
runtime.GameShared.getDefaultAbilityLoadout = getDefaultAbilityLoadout;
runtime.GameShared.normalizeAbilityLoadout = normalizeAbilityLoadout;
runtime.GameShared.resolveWeaponAimProfile = resolveWeaponAimProfile;
