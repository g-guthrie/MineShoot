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
      { maxDistance: 50, scale: 0.96 },
      { maxDistance: 86, scale: 0.88 },
      { maxDistance: 118, scale: 0.78 }
    ],
    pistol: [
      { maxDistance: 14, scale: 1.0 },
      { maxDistance: 24, scale: 0.88 },
      { maxDistance: 36, scale: 0.64 },
      { maxDistance: 52, scale: 0.4 }
    ],
    machinegun: [
      { maxDistance: 10, scale: 1.0 },
      { maxDistance: 18, scale: 0.82 },
      { maxDistance: 30, scale: 0.62 },
      { maxDistance: 48, scale: 0.42 }
    ],
    shotgun: [
      { maxDistance: 6, scale: 1.0 },
      { maxDistance: 11, scale: 0.68 },
      { maxDistance: 17, scale: 0.38 },
      { maxDistance: 24, scale: 0.12 }
    ],
    sniper: [
      { maxDistance: 55, scale: 1.0 },
      { maxDistance: 105, scale: 1.0 },
      { maxDistance: 135, scale: 0.94 },
      { maxDistance: 160, scale: 0.86 }
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
    rifle:      { name: 'Rifle',          primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 210,  bodyDamage: 36,  headDamage: 88,  maxRange: 118, pellets: 1,  hipfireSpread: 0.007, adsSpreadMultiplier: 0,    adsHitscanRangeMultiplier: 1.4 },
    pistol:     { name: 'Pistol',         primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 220,  bodyDamage: 22,  headDamage: 170, maxRange: 52,  pellets: 1,  hipfireSpread: 0.012, adsSpreadMultiplier: 0,    adsHitscanRangeMultiplier: 1.35 },
    machinegun: { name: 'Machine Gun',    primitiveType: 'hitscan_single',    automatic: true,  cooldownMs: 72,   bodyDamage: 14,  headDamage: 22,  maxRange: 48,  pellets: 1,  hipfireSpread: 0.028, adsSpreadMultiplier: 0,    adsHitscanRangeMultiplier: 1.3 },
    shotgun:    { name: 'Shotgun',        primitiveType: 'hitscan_multi',     automatic: false, cooldownMs: 980,  bodyDamage: 16,  headDamage: 26,  maxRange: 24,  pellets: 12, hipfireSpread: 0.19,  adsSpreadMultiplier: 1.0,  adsHitscanRangeMultiplier: 1.1 },
    sniper:     { name: 'Sniper',         primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 1250, bodyDamage: 210, headDamage: 360, maxRange: 160, pellets: 1,  hipfireSpread: 0.24,  adsSpreadMultiplier: 0,    adsHitscanRangeMultiplier: 1.0 },
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
      description: 'Single-target lift + damage in reticle box.',
      debugSummary: 'Square = choke target box.',
      tunableParams: ['lockBoxPx', 'range', 'targetTolerance', 'duration', 'castDamage', 'liftHeight', 'tickRate', 'dotPerTick'],
      cooldownMs: 8000, range: 24, minDot: 0.05, duration: 1.6,
      liftHeight: 1.0, tickRate: 0.25, dotPerTick: 0, castDamage: 95, lockBoxPx: 190, targetTolerance: 1.8
    },
    hook: {
      id: 'hook', slot: 'either', name: 'Chain Hook',
      description: 'Latch a target and yank them into close range.',
      debugSummary: 'Circle = hook catch radius debug.',
      tunableParams: ['reticleRadiusPx', 'catchRadius', 'range', 'travelSpeed', 'pullDistance', 'castDamage', 'cooldownMs'],
      cooldownMs: 7000, range: 26, minDot: 0.03, pullDistance: 3.2,
      stunDuration: 0.7, castDamage: 50, lockBoxPx: 170, reticleRadiusPx: 52, catchRadius: 1.8, travelSpeed: 26
    },
    heal: {
      id: 'heal', slot: 'either', name: 'Heal',
      description: 'Brief self-heal with visible windup.',
      debugSummary: 'No geometry; instant heal plus green flash.',
      tunableParams: ['healAmount', 'cooldownMs'],
      cooldownMs: 9000, duration: 0.85, healAmount: 100
    },
    deadeye: {
      id: 'deadeye', slot: 'ultimate', name: 'Deadeye',
      description: 'Lock and execute marked targets.',
      debugSummary: 'Rectangle = deadeye acquisition FOV approximation.',
      tunableParams: ['range', 'minDot', 'duration', 'maxTargets', 'damage', 'cooldownMs'],
      cooldownMs: 22000, range: 80, duration: 3.0, maxTargets: 3, minDot: 0.18, damage: 260
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
