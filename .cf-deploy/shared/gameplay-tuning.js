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
      { maxDistance: 22, scale: 1.0 },
      { maxDistance: 52, scale: 0.98 },
      { maxDistance: 92, scale: 0.92 },
      { maxDistance: 132, scale: 0.84 }
    ],
    pistol: [
      { maxDistance: 12, scale: 1.0 },
      { maxDistance: 24, scale: 0.9 },
      { maxDistance: 40, scale: 0.7 },
      { maxDistance: 76, scale: 0.46 }
    ],
    machinegun: [
      { maxDistance: 12, scale: 1.0 },
      { maxDistance: 24, scale: 0.88 },
      { maxDistance: 44, scale: 0.72 },
      { maxDistance: 84, scale: 0.56 }
    ],
    shotgun: [
      { maxDistance: 7, scale: 1.0 },
      { maxDistance: 13, scale: 0.7 },
      { maxDistance: 21, scale: 0.4 },
      { maxDistance: 36, scale: 0.14 }
    ],
    sniper: [
      { maxDistance: 60, scale: 1.0 },
      { maxDistance: 120, scale: 1.0 },
      { maxDistance: 180, scale: 0.96 },
      { maxDistance: 230, scale: 0.9 }
    ],
    seekergun: [
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
    rifle:      { name: 'Rifle',          primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 190,  bodyDamage: 35,  headDamage: 94,  maxRange: 132, pellets: 1,  spreadNdc: 0.009 },
    pistol:     { name: 'Pistol',         primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 250,  bodyDamage: 24,  headDamage: 145, maxRange: 76,  pellets: 1,  spreadNdc: 0.017 },
    machinegun: { name: 'Machine Gun',    primitiveType: 'hitscan_single',    automatic: true,  cooldownMs: 80,   bodyDamage: 16,  headDamage: 28,  maxRange: 84,  pellets: 1,  spreadNdc: 0.018 },
    shotgun:    { name: 'Shotgun',        primitiveType: 'hitscan_multi',     automatic: false, cooldownMs: 900,  bodyDamage: 15,  headDamage: 24,  maxRange: 36,  pellets: 12, spreadNdc: 0 },
    sniper:     { name: 'Sniper',         primitiveType: 'hitscan_single',    automatic: false, cooldownMs: 1100, bodyDamage: 185, headDamage: 340, maxRange: 230, pellets: 1,  spreadNdc: 0.085 },
    seekergun:  { name: 'Seeker',         primitiveType: 'projectile_homing', automatic: true,  cooldownMs: 380,  bodyDamage: 72,  headDamage: 72,  maxRange: 28,  pellets: 1,  spreadNdc: 0 }
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
