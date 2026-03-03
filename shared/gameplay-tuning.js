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
  shotgunFalloff: {
    fullDamageEnd: 8,
    minDamageStart: 24
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
    abilities: { armorMax: 90, wallhackRadius: 90 },
    ninja: { armorMax: 80, wallhackRadius: 90 },
    jedi: { armorMax: 130, wallhackRadius: 85 },
    magician: { armorMax: 100, wallhackRadius: 100 },
    sharpshooter: { armorMax: 90, wallhackRadius: 115 },
    brawler: { armorMax: 150, wallhackRadius: 75 }
  },
  weaponStats: {
    rifle: { cooldownMs: 190, bodyDamage: 36, headDamage: 68, maxRange: 120, pellets: 1 },
    pistol: { cooldownMs: 280, bodyDamage: 30, headDamage: 56, maxRange: 92, pellets: 1 },
    machinegun: { cooldownMs: 80, bodyDamage: 16, headDamage: 30, maxRange: 88, pellets: 1 },
    shotgun: { cooldownMs: 820, bodyDamage: 14, headDamage: 22, maxRange: 42, pellets: 12 },
    sniper: { cooldownMs: 1250, bodyDamage: 120, headDamage: 220, maxRange: 190, pellets: 1 },
    seekergun: { cooldownMs: 320, bodyDamage: 0, headDamage: 0, maxRange: 24, pellets: 1 },
    plasma: { cooldownMs: 100, bodyDamage: 15, headDamage: 15, maxRange: 24, pellets: 1 }
  },
  throwables: {
    order: ['frag', 'seeker', 'molotov', 'knife'],
    frag: {
      id: 'frag', speed: 16, upward: 5.2, gravity: 19, fuse: 2.2, radius: 5.4, damage: 125, regen: 10, bounce: true,
      bounceVelocityDamping: 0.4,
      bounceVerticalDamping: 0.42,
      bounceMaxCount: 2,
      bounceStopSpeedSq: 2.5
    },
    seeker: {
      id: 'seeker', speed: 14, upward: 4.4, gravity: 12, fuse: 3.4, radius: 5.0, damage: 110, regen: 15,
      homingBoost: 2.0, homingLerp: 4.8, acquireRange: 18, acquireHalfAngleDeg: 35, stickExplodeDelay: 0.65
    },
    seekershot: {
      id: 'seekershot', speed: 34, upward: 0.6, gravity: 5, fuse: 1.8, radius: 4.6, damage: 95,
      homingBoost: 4.5, homingLerp: 3.8, lockHalfAngleDeg: 30
    },
    molotov: {
      id: 'molotov', speed: 15, upward: 4.8, gravity: 21, fuse: 3.0, fireRadius: 3.2,
      fireDuration: 5.5, fireTickDamage: 18, fireTickRate: 0.35, regen: 14
    },
    knife: {
      id: 'knife', speed: 28, upward: 1.4, gravity: 7, life: 1.8, bodyDamage: 100, headDamage: 250, regen: 8
    }
  },
  classAbilities: {
    ninja: {
      abilityCooldownMs: 6000,
      ultimateCooldownMs: 20000,
      stars: { count: 3, range: 42, bodyDamage: 120, headDamage: 170, minDot: 0.95 },
      shadowDash: { steps: 4, stepDuration: 0.12 }
    },
    jedi: {
      abilityCooldownMs: 8000,
      ultimateCooldownMs: 18000,
      choke: { range: 24, minDot: 0.05, duration: 1.6, liftHeight: 1.0, tickRate: 0.25, dotPerTick: 0, castDamage: 95, lockBoxPx: 190 },
      saberThrow: {
        range: 22,
        minDot: -0.15,
        bodyDamage: 175,
        headDamage: 240,
        speed: 34,
        maxDistance: 22,
        returnSpeed: 42,
        hitRadius: 1.3
      }
    },
    magician: {
      abilityCooldownMs: 7000,
      ultimateCooldownMs: 20000,
      fireball: { range: 36, radius: 4.8, minDamage: 55, maxDamage: 180 },
      chainLightning: { range: 60, minDot: 0.15, maxTargets: 4, startDamage: 240, falloff: 0.68 }
    },
    sharpshooter: {
      abilityCooldownMs: 8000,
      ultimateCooldownMs: 22000,
      focus: { shots: 1, duration: 8, sniperBoost: 1.8, defaultBoost: 1.55 },
      deadeye: { range: 80, duration: 4.0, maxTargets: 6, minDot: 0.18, damage: 260 }
    },
    brawler: {
      abilityCooldownMs: 5000,
      ultimateCooldownMs: 20000,
      batSwing: { range: 4.2, minDot: -0.2, bodyDamage: 130, maxTargets: 3, stunDuration: 0.35 },
      rage: { duration: 4.8, tickEvery: 0.45, radius: 5.2, tickDamage: 75 }
    }
  }
};

export function getClassPreset(classId) {
  return gameplayTuning.classPresets[classId] || gameplayTuning.classPresets.sharpshooter;
}

export function getWeaponStats(weaponId) {
  return gameplayTuning.weaponStats[weaponId] || null;
}

export function getClassAbility(classId) {
  return gameplayTuning.classAbilities[classId] || null;
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.gameplayTuning = gameplayTuning;
