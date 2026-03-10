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
      { maxDistance: 30, scale: 0.92 },
      { maxDistance: 48, scale: 0.78 },
      { maxDistance: 72, scale: 0.64 }
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
    rifle:      { name: 'Rifle',          primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 260,  reloadMs: 1550, magazineSize: 15, bodyDamage: 44,  headDamage: 104, maxRange: 110, pellets: 1,  hipfireSpread: 0.016, adsSpread: 0.0,   adsMaxRange: 132, aimProfile: { hipfire: { spread: 0.016, maxRange: 110 }, ads: { spread: 0.0,   maxRange: 132 } } },
    pistol:     { name: 'Pistol',         primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 360,  reloadMs: 1350, magazineSize: 12, bodyDamage: 46,  headDamage: 132, maxRange: 54,  pellets: 1,  hipfireSpread: 0.024, adsSpread: 0.018, adsMaxRange: 60,  aimProfile: { hipfire: { spread: 0.024, maxRange: 54 },  ads: { spread: 0.018, maxRange: 60 } } },
    machinegun: { name: 'Machine Gun',    primitiveType: 'hitscan_single',    automatic: true,  cooldownMs: 82,   reloadMs: 2200, magazineSize: 40, bodyDamage: 15,  headDamage: 23,  maxRange: 58,  pellets: 1,  hipfireSpread: 0.046, adsSpread: 0.03,  adsMaxRange: 72,  aimProfile: { hipfire: { spread: 0.046, maxRange: 58 },  ads: { spread: 0.03,  maxRange: 72 } } },
    shotgun:    { name: 'Shotgun',        primitiveType: 'hitscan_multi',     automatic: false, cooldownMs: 1000, reloadMs: 1850, magazineSize: 6,  bodyDamage: 17,  headDamage: 25,  maxRange: 26,  pellets: 12, hipfireSpread: 0.19,  adsSpread: 0.16,  adsMaxRange: 26,  aimProfile: { hipfire: { spread: 0.19,  maxRange: 26 },  ads: { spread: 0.16,  maxRange: 26 } } },
    sniper:     { name: 'Sniper',         primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 1450, reloadMs: 2100, magazineSize: 5,  bodyDamage: 230, headDamage: 500, maxRange: 160, pellets: 1,  hipfireSpread: 0.32,  adsSpread: 0.0,   adsMaxRange: 160, aimProfile: { hipfire: { spread: 0.32,  maxRange: 160 }, ads: { spread: 0.0,   maxRange: 160 } }, infiniteRange: true },
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
      id: 'frag', category: 'grenade', label: 'Frag', speed: 18, upward: 5.2, gravity: 19, fuse: 2.2, radius: 6.8, damage: 125, regen: 10, bounce: true,
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

export function resolveWeaponAimProfile(weaponStats, adsActive) {
  const stats = weaponStats || {};
  if (stats.infiniteRange) {
    return {
      spread: adsActive ? Number(stats.adsSpread || 0) : Number(stats.hipfireSpread || 0),
      maxRange: Infinity
    };
  }

  const aimProfile = stats.aimProfile || {};
  const hipfire = aimProfile.hipfire || {};
  const ads = aimProfile.ads || {};
  const hipfireSpread = Math.max(0, Number(hipfire.spread != null ? hipfire.spread : stats.hipfireSpread || 0));
  const hipfireRange = Math.max(0, Number(hipfire.maxRange != null ? hipfire.maxRange : stats.maxRange || 0));
  const adsSpread = Math.max(
    0,
    Number(
      ads.spread != null
        ? ads.spread
        : (stats.adsSpread != null
          ? stats.adsSpread
          : (hipfireSpread * Math.max(0, Number(stats.adsSpreadMultiplier != null ? stats.adsSpreadMultiplier : 1))))
    )
  );
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

  return adsActive
    ? { spread: adsSpread, maxRange: adsRange }
    : { spread: hipfireSpread, maxRange: hipfireRange };
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
  return gameplayTuning.defaultAbilityLoadout || { slot1: 'choke', slot2: 'deadeye' };
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.gameplayTuning = gameplayTuning;
runtime.GameShared.getMovementTuning = getMovementTuning;
runtime.GameShared.getDefaultWeaponLoadout = getDefaultWeaponLoadout;
runtime.GameShared.getSelectableWeaponIds = getSelectableWeaponIds;
runtime.GameShared.resolveWeaponAimProfile = resolveWeaponAimProfile;
