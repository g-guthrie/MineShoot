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
      { maxDistance: 24, scale: 1.0 },
      { maxDistance: 42, scale: 0.95 },
      { maxDistance: 68, scale: 0.87 },
      { maxDistance: 100, scale: 0.74 }
    ],
    pistol: [
      { maxDistance: 12, scale: 1.0 },
      { maxDistance: 22, scale: 0.84 },
      { maxDistance: 34, scale: 0.60 },
      { maxDistance: 54, scale: 0.40 }
    ],
    machinegun: [
      { maxDistance: 8, scale: 1.0 },
      { maxDistance: 15, scale: 0.76 },
      { maxDistance: 24, scale: 0.50 },
      { maxDistance: 40, scale: 0.28 }
    ],
    shotgun: [
      { maxDistance: 6, scale: 1.0 },
      { maxDistance: 10, scale: 0.70 },
      { maxDistance: 15, scale: 0.40 },
      { maxDistance: 22, scale: 0.15 }
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
    abilities: { armorMax: 90, wallhackRadius: 90 }
  },
  weaponStats: {
    rifle:      { name: 'Rifle',          primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 240,  bodyDamage: 42,  headDamage: 92,  maxRange: 100, pellets: 1,  hipfireSpread: 0.013, adsSpreadMultiplier: 0.0,  adsHitscanRangeMultiplier: 1.4 },
    pistol:     { name: 'Pistol',         primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 215,  bodyDamage: 28,  headDamage: 96,  maxRange: 54,  pellets: 1,  hipfireSpread: 0.016, adsSpreadMultiplier: 1.0,  adsHitscanRangeMultiplier: 1.0 },
    machinegun: { name: 'Machine Gun',    primitiveType: 'hitscan_single',    automatic: true,  cooldownMs: 82,   bodyDamage: 15,  headDamage: 20,  maxRange: 40,  pellets: 1,  hipfireSpread: 0.046, adsSpreadMultiplier: 1.0,  adsHitscanRangeMultiplier: 1.0 },
    shotgun:    { name: 'Shotgun',        primitiveType: 'hitscan_multi',     automatic: false, cooldownMs: 1100, bodyDamage: 18,  headDamage: 28,  maxRange: 22,  pellets: 12, hipfireSpread: 0.21,  adsSpreadMultiplier: 1.0,  adsHitscanRangeMultiplier: 1.0 },
    sniper:     { name: 'Sniper',         primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 1450, bodyDamage: 230, headDamage: 500, maxRange: 160, pellets: 1,  hipfireSpread: 0.32,  adsSpreadMultiplier: 0.0,  adsHitscanRangeMultiplier: 1.0, infiniteRange: true },
    seekergun:  { name: 'Seeker',         primitiveType: 'projectile_homing', automatic: true,  cooldownMs: 380,  bodyDamage: 72,  headDamage: 72,  maxRange: 28,  pellets: 1,  hipfireSpread: 0,     adsSpreadMultiplier: 1,    adsHitscanRangeMultiplier: 1.0 }
  },
  throwableCategories: {
    grenade: { label: 'Grenades', items: ['frag', 'seeker', 'molotov'], previewType: 'trajectory' },
    blade:   { label: 'Blades & Objects', items: ['knife'], previewType: 'none' }
  },
  throwables: {
    order: ['frag', 'seeker', 'molotov', 'knife'],
    frag: {
      id: 'frag', category: 'grenade', label: 'Frag', speed: 18, upward: 5.2, gravity: 19, fuse: 2.2, radius: 5.4, damage: 125, regen: 10, bounce: true,
      bounceVelocityDamping: 0.4,
      bounceVerticalDamping: 0.42,
      bounceMaxCount: 2,
      bounceStopSpeedSq: 2.5
    },
    seeker: {
      id: 'seeker', category: 'grenade', label: 'Plasma Grenade', speed: 16, upward: 4.4, gravity: 12, fuse: 3.4, radius: 5.0, damage: 110, regen: 15,
      homingBoost: 2.0, homingLerp: 4.8, acquireRange: 18, acquireHalfAngleDeg: 35, stickExplodeDelay: 0.65
    },
    seekershot: {
      id: 'seekershot', label: 'Seeker Shot', speed: 31, upward: 0.4, gravity: 4.5, fuse: 1.8, radius: 4.2, damage: 72,
      homingBoost: 4.0, homingLerp: 4.6, lockHalfAngleDeg: 20
    },
    molotov: {
      id: 'molotov', category: 'grenade', label: 'Molotov', speed: 17, upward: 4.8, gravity: 21, fuse: 3.0, fireRadius: 3.2,
      fireDuration: 5.5, fireTickDamage: 18, fireTickRate: 0.35, regen: 14
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
      cooldownMs: 15000, range: 24, minDot: 0.05, duration: 1.1,
      liftHeight: 1.25, tickRate: 0.25, dotPerTick: 0, castDamage: 0, lockBoxPx: 180, targetTolerance: 1.6
    },
    hook: {
      id: 'hook', slot: 'either', name: 'Chain Hook',
      description: 'Latch a target and yank them into close range.',
      debugSummary: 'Circle = hook catch radius debug.',
      tunableParams: ['reticleRadiusPx', 'catchRadius', 'range', 'travelSpeed', 'pullDistance', 'castDamage', 'cooldownMs'],
      cooldownMs: 15000, range: 24, minDot: 0.03, pullDistance: 3.2,
      stunDuration: 0.5, castDamage: 35, lockBoxPx: 170, reticleRadiusPx: 52, catchRadius: 1.6, travelSpeed: 24
    },
    heal: {
      id: 'heal', slot: 'either', name: 'Heal',
      description: 'Brief self-heal with visible windup.',
      debugSummary: 'Visible windup before the heal resolves.',
      tunableParams: ['healAmount', 'cooldownMs'],
      cooldownMs: 15000, duration: 0.85, healAmount: 150
    },
    deadeye: {
      id: 'deadeye', slot: 'ultimate', name: 'Deadeye',
      description: 'Lock and execute marked targets.',
      debugSummary: 'Rectangle = deadeye acquisition FOV approximation.',
      tunableParams: ['range', 'minDot', 'duration', 'maxTargets', 'damage', 'cooldownMs'],
      cooldownMs: 15000, range: 70, duration: 1.5, maxTargets: 2, minDot: 0.22, damage: 180
    }
  },
  defaultAbilityLoadout: { slot1: 'choke', slot2: 'deadeye' }
};

export function getClassPreset(classId) {
  return gameplayTuning.classPresets[classId] || gameplayTuning.classPresets.abilities;
}

export function getWeaponStats(weaponId) {
  return gameplayTuning.weaponStats[weaponId] || null;
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
