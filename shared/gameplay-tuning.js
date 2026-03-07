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
      { maxDistance: 20, scale: 1.0 },
      { maxDistance: 45, scale: 0.96 },
      { maxDistance: 80, scale: 0.88 },
      { maxDistance: 120, scale: 0.78 }
    ],
    pistol: [
      { maxDistance: 14, scale: 1.0 },
      { maxDistance: 26, scale: 0.92 },
      { maxDistance: 42, scale: 0.74 },
      { maxDistance: 92, scale: 0.52 }
    ],
    machinegun: [
      { maxDistance: 12, scale: 1.0 },
      { maxDistance: 28, scale: 0.94 },
      { maxDistance: 52, scale: 0.84 },
      { maxDistance: 88, scale: 0.72 }
    ],
    shotgun: [
      { maxDistance: 7, scale: 1.0 },
      { maxDistance: 14, scale: 0.75 },
      { maxDistance: 22, scale: 0.5 },
      { maxDistance: 42, scale: 0.28 }
    ],
    sniper: [
      { maxDistance: 45, scale: 1.0 },
      { maxDistance: 95, scale: 0.96 },
      { maxDistance: 145, scale: 0.9 },
      { maxDistance: 190, scale: 0.85 }
    ],
    seekergun: [
      { maxDistance: 24, scale: 1.0 }
    ],
    plasma: [
      { maxDistance: 24, scale: 1.0 }
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
    rifle:      { name: 'Rifle',          primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 180,  bodyDamage: 34,  headDamage: 86,  maxRange: 120, pellets: 1,  spreadNdc: 0.0018 },
    pistol:     { name: 'Pistol',         primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 230,  bodyDamage: 27,  headDamage: 120, maxRange: 92,  pellets: 1,  spreadNdc: 0.0032 },
    machinegun: { name: 'Machine Gun',    primitiveType: 'hitscan_single',    automatic: true,  cooldownMs: 80,   bodyDamage: 16,  headDamage: 30,  maxRange: 88,  pellets: 1,  spreadNdc: 0.0078 },
    shotgun:    { name: 'Shotgun',        primitiveType: 'hitscan_multi',     automatic: false, cooldownMs: 820,  bodyDamage: 13,  headDamage: 20,  maxRange: 42,  pellets: 12, spreadNdc: 0 },
    sniper:     { name: 'Sniper',         primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 1250, bodyDamage: 120, headDamage: 220, maxRange: 190, pellets: 1,  spreadNdc: 0.00035 },
    seekergun:  { name: 'Seeker',         primitiveType: 'projectile_homing', automatic: true,  cooldownMs: 320,  bodyDamage: 0,   headDamage: 0,   maxRange: 24,  pellets: 1,  spreadNdc: 0 },
    plasma:     { name: 'Plasma Cannon',  primitiveType: 'projectile_homing', automatic: true,  cooldownMs: 100,  bodyDamage: 15,  headDamage: 15,  maxRange: 24,  pellets: 1,  spreadNdc: 0 }
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
      id: 'seekershot', label: 'Seeker Shot', speed: 34, upward: 0.6, gravity: 5, fuse: 1.8, radius: 4.6, damage: 95,
      homingBoost: 4.5, homingLerp: 3.8, lockHalfAngleDeg: 30
    },
    plasma_stream: {
      id: 'plasma_stream', label: 'Plasma Stream', speed: 34, upward: 0.35, gravity: 2, fuse: 0.42, radius: 0.01, damage: 15,
      bodyDamage: 15, headDamage: 15, homingBoost: 4.5, homingLerp: 3.8, lockHalfAngleDeg: 35, acquireRange: 24
    },
    molotov: {
      id: 'molotov', category: 'grenade', label: 'Molotov', speed: 17, upward: 4.8, gravity: 21, fuse: 3.0, fireRadius: 3.2,
      fireDuration: 5.5, fireTickDamage: 18, fireTickRate: 0.35, regen: 14
    },
    knife: {
      id: 'knife', category: 'blade', label: 'Knife', speed: 28, upward: 1.4, gravity: 7, life: 1.8, bodyDamage: 100, headDamage: 250, regen: 8
    }
  },
  abilityCatalog: {
    choke: {
      id: 'choke', slot: 'ability', name: 'Vader Choke',
      description: 'Single-target lift + damage in reticle box.',
      cooldownMs: 8000, range: 24, minDot: 0.05, duration: 1.6,
      liftHeight: 1.0, tickRate: 0.25, dotPerTick: 0, castDamage: 95, lockBoxPx: 190
    },
    deadeye: {
      id: 'deadeye', slot: 'ultimate', name: 'Deadeye',
      description: 'Lock and execute marked targets.',
      cooldownMs: 22000, range: 80, duration: 2.0, maxTargets: 3, minDot: 0.18, damage: 260
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
