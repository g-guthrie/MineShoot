const DEFAULT_CAMERA_FOV_DEG = 75;
const DEFAULT_ADS_FOV_DEG = 56;
const DEFAULT_SNIPER_SCOPE_FOV_DEG = 24;
const DEFAULT_WEAPON_RELOAD_PRESENTATION = {
  profileId: 'rifle',
  raiseEnd: 0.16,
  manipulateEnd: 0.68,
  audio: {
    start: 'reload_rifle_start',
    manipulate: 'reload_rifle_manipulate',
    complete: 'reload_rifle_complete'
  }
};
const DEFAULT_WEAPON_PRESENTATION = {
  tracer: { life: 0.11, speed: 280, segmentLength: 2.1 },
  recoil: { z: -0.05, x: -0.09, pitch: 0.018, yaw: 0.009, roll: 0.006, armR: 0.22, armL: 0.1, muzzleMs: 60 },
  audioSample: null,
  reload: DEFAULT_WEAPON_RELOAD_PRESENTATION
};

export const gameplayTuning = {
  survivability: {
    hpMax: 360,
    armorMax: 90,
    armorRegenDelaySec: 8.0,
    armorRegenPerSec: 10
  },
  awareness: {
    segments: 8,
    radarRange: 56,
    coreRange: 10,
    beaconMinRange: 56,
    beaconMaxCount: 2
  },
  network: {
    flags: {
      adaptiveSelfReconciliation: true,
      combatBurstSnapshots: true,
      shotTokenDamageAggregation: false
    },
    ping: {
      cadenceMs: 500,
      staleAfterMs: 4000,
      rttAlpha: 0.15,
      jitterAlpha: 0.2
    },
    selfReconciliation: {
      hardSnapDistanceWu: 4.5,
      hardSnapVerticalWu: 1.35,
      idleReplayDistanceWu: 1.1,
      movingReplayDistanceWu: 1.75,
      emergencyReplayDistanceWu: 2.4,
      baseGraceMs: 150,
      maxExtraGraceMs: 120,
      movingAckDriftLimit: 2,
      airborneHardSnapDistanceWu: 6.25,
      airborneHardSnapVerticalWu: 2.75,
      airborneReplayDistanceWu: 2.6,
      airborneGraceMs: 260,
      airborneMovingAckDriftLimit: 4
    },
    combatPriority: {
      burstCadenceMs: 16,
      burstWindowMs: 250,
      engagementTtlMs: 1800,
      maxBurstTargets: 4
    },
    remoteInterpolation: {
      historySize: 20,
      defaultDelayMs: 78,
      minDelayMs: 56,
      maxDelayMs: 160,
      intervalDelayScale: 1.6,
      jitterDelayScale: 1.4,
      freezeGapMinMs: 48,
      freezeGapMaxMs: 160,
      freezeGapIntervalScale: 1.25,
      freezeGapJitterScale: 1.8,
      maxExtrapolationMinMs: 8,
      maxExtrapolationMaxMs: 36,
      maxExtrapolationIntervalScale: 0.28,
      maxExtrapolationJitterScale: 0.45,
      serverOffsetSnapDeltaMs: 120,
      offsetLerpAlpha: 0.12,
      hitboxLeadMs: 0
    },
    feedback: {
      predictedHitTtlMs: 900,
      shotgunAggregateWindowMs: 60
    }
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
      { maxDistance: 12, scale: 1.0 },
      { maxDistance: 20, scale: 0.88 },
      { maxDistance: 26, scale: 0.62 },
      { maxDistance: 28, scale: 0.45 }
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
    abilities: { armorMax: 90, wallhackRadius: 90 },
    ffa: { armorMax: 90, wallhackRadius: 90 }
  },
  weaponStats: {
    rifle: {
      name: 'Rifle', primitiveType: 'hitscan_single', automatic: false, cooldownMs: 260, reloadMs: 1600, magazineSize: 15,
      bodyDamage: 44, headDamage: 90, maxRange: 110, pellets: 1, hipfireSpread: 0.024, adsSpread: 0, adsFovDeg: 56, adsMaxRange: 132,
      hipfireBloomScale: 2.5, adsBloomScale: 1,
      aimProfile: { hipfire: { spread: 0.024, maxRange: 110 }, ads: { spread: 0, maxRange: 132 } },
      armorBufferMode: 'normal',
      presentation: {
        tracer: { life: 0.11, speed: 280, segmentLength: 1.25 },
        recoil: { z: -0.05, x: -0.09, pitch: 0.018, yaw: 0.009, roll: 0.006, armR: 0.22, armL: 0.1, muzzleMs: 60 },
        audioSample: { url: '/assets/audio/weapons/rifle.mp3', gain: 0.66, playbackRateMin: 0.97, playbackRateMax: 1.03 },
        reload: {
          profileId: 'rifle',
          raiseEnd: 0.16,
          manipulateEnd: 0.68,
          audio: {
            start: 'reload_rifle_start',
            manipulate: 'reload_rifle_manipulate',
            complete: 'reload_rifle_complete'
          }
        }
      }
    },
    pistol: {
      name: 'Pistol', primitiveType: 'hitscan_multi', automatic: false, cooldownMs: 360, reloadMs: 1350, magazineSize: 10,
      bodyDamage: 46, headDamage: 96, maxRange: 24, pellets: 12, hipfireSpread: 0.137, adsSpread: 0.225, adsFovDeg: 56, adsMaxRange: 28,
      aimProfile: { hipfire: { spread: 0.137, maxRange: 24 }, ads: { spread: 0.225, maxRange: 28 } },
      hipfireCylinderRadiusWu: 0.80,
      adsCylinderRadiusWu: 1.00,
      singleHitFromPellets: true,
      armorBufferMode: 'normal',
      presentation: {
        tracer: { life: 0.11, speed: 280, segmentLength: 0.25 },
        recoil: { z: -0.04, x: -0.08, pitch: 0.014, yaw: 0.007, roll: 0.005, armR: 0.2, armL: 0.08, muzzleMs: 60 },
        audioSample: { url: '/assets/audio/weapons/pistol.mp3', gain: 0.72, playbackRateMin: 0.98, playbackRateMax: 1.04 },
        reload: {
          profileId: 'sidearm',
          raiseEnd: 0.18,
          manipulateEnd: 0.62,
          audio: {
            start: 'reload_sidearm_start',
            manipulate: 'reload_sidearm_manipulate',
            complete: 'reload_sidearm_complete'
          }
        }
      }
    },
    machinegun: {
      name: 'Machine Gun', primitiveType: 'hitscan_single', automatic: true, cooldownMs: 82, reloadMs: 1450, magazineSize: 50,
      bodyDamage: 15, headDamage: 20, maxRange: 58, pellets: 1, hipfireSpread: 0.046, adsSpread: 0.046, adsFovDeg: 56, adsMaxRange: 72,
      aimProfile: { hipfire: { spread: 0.046, maxRange: 58 }, ads: { spread: 0.046, maxRange: 72 } },
      armorBufferMode: 'normal',
      presentation: {
        tracer: { life: 0.075, speed: 260, segmentLength: 1.0 },
        recoil: { z: -0.024, x: -0.045, pitch: 0.009, yaw: 0.006, roll: 0.004, armR: 0.14, armL: 0.06, muzzleMs: 55 },
        audioSample: { url: '/assets/audio/weapons/rifle.mp3', gain: 0.45, playbackRateMin: 1.16, playbackRateMax: 1.26 },
        reload: {
          profileId: 'lmg',
          raiseEnd: 0.14,
          manipulateEnd: 0.60,
          audio: {
            start: 'reload_lmg_start',
            manipulate: 'reload_lmg_manipulate',
            complete: 'reload_lmg_complete'
          }
        }
      }
    },
    shotgun: {
      name: 'Shotgun', primitiveType: 'hitscan_multi', automatic: false, cooldownMs: 950, reloadMs: 1850, magazineSize: 6,
      bodyDamage: 17, headDamage: 22, maxRange: 24, pellets: 12, hipfireSpread: 0.19, adsSpread: 0.19, adsFovDeg: 56, adsMaxRange: 24,
      aimProfile: { hipfire: { spread: 0.19, maxRange: 24 }, ads: { spread: 0.19, maxRange: 24 } },
      armorBufferMode: 'normal',
      presentation: {
        tracer: { life: 0.1, speed: 230, segmentLength: 1.9 },
        recoil: { z: -0.09, x: -0.16, pitch: 0.03, yaw: 0.012, roll: 0.008, armR: 0.26, armL: 0.12, muzzleMs: 70 },
        audioSample: { url: '/assets/audio/weapons/shotgun.mp3', gain: 0.98, playbackRateMin: 0.97, playbackRateMax: 1.02 },
        reload: {
          profileId: 'shotgun',
          raiseEnd: 0.18,
          manipulateEnd: 0.72,
          audio: {
            start: 'reload_shotgun_start',
            manipulate: 'reload_shotgun_manipulate',
            complete: 'reload_shotgun_complete'
          }
        }
      }
    },
    sniper: {
      name: 'Sniper', primitiveType: 'hitscan_single', automatic: false, cooldownMs: 1800, reloadMs: 2400, magazineSize: 4,
      bodyDamage: 170, headDamage: 360, maxRange: 170, pellets: 1, hipfireSpread: 0.32, adsSpread: 0, adsFovDeg: 24, adsMaxRange: 170,
      aimProfile: { hipfire: { spread: 0.32, maxRange: 170 }, ads: { spread: 0, maxRange: 170 } }, infiniteRange: true,
      armorBufferMode: 'heavy',
      presentation: {
        tracer: { life: 0.12, speed: 320, segmentLength: 2.6 },
        recoil: { z: -0.12, x: -0.2, pitch: 0.04, yaw: 0.01, roll: 0.007, armR: 0.3, armL: 0.12, muzzleMs: 90 },
        audioSample: { url: '/assets/audio/weapons/sniper.mp3', gain: 0.82, playbackRateMin: 0.96, playbackRateMax: 1.0 },
        reload: {
          profileId: 'precision',
          raiseEnd: 0.22,
          manipulateEnd: 0.76,
          audio: {
            start: 'reload_precision_start',
            manipulate: 'reload_precision_manipulate',
            complete: 'reload_precision_complete'
          }
        }
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
      id: 'frag', category: 'grenade', label: 'Frag', speed: 22.5, upward: 5.0, gravity: 19, fuse: 2.0, radius: 6.2, damage: 110, minBlastDamage: 10, regen: 10, bounce: true,
      bounceVelocityDamping: 0.4,
      bounceVerticalDamping: 0.42,
      bounceMaxCount: 2,
      bounceStopSpeedSq: 2.5,
      armorBufferMode: 'heavy'
    },
    plasma: {
      id: 'plasma', category: 'grenade', label: 'Plasma Grenade', speed: 19, upward: 3.0, gravity: 18, fuse: 2.0, maxLife: 6.0, radius: 4.5, damage: 95, minBlastDamage: 10, regen: 10,
      catchRadius: 1.3, trackDuration: 0.15, trackLerp: 8, acquireRange: 16, acquireHalfAngleDeg: 28, stickExplodeDelay: 1.8,
      armorBufferMode: 'heavy'
    },
    missile: {
      id: 'missile', label: 'Missile', speed: 34, upward: 0.2, gravity: 0.7, fuse: 1.1, radius: 2.0, damage: 70, minBlastDamage: 10,
      homingBoost: 4.5, homingLerp: 6.0, lockHalfAngleDeg: 10, acquireRange: 6.0, hitRadius: 0.9,
      armorBufferMode: 'heavy'
    },
    molotov: {
      id: 'molotov', category: 'grenade', label: 'Molotov', speed: 16.5, upward: 4.6, gravity: 21, fuse: 2.8, fireRadius: 4.0,
      fireDuration: 6.5, fireTickDamage: 14, fireTickRate: 0.4, fireInnerRadius: 2.2, fireOuterDamageScale: 0.45,
      fireLingerDuration: 1.2, fireLingerTickDamage: 5, fireLingerTickRate: 0.5, fireMaxHeightDelta: 1.5, regen: 10,
      armorBufferMode: 'normal'
    },
    knife: {
      id: 'knife', category: 'blade', label: 'Knife', speed: 28, upward: 1.2, gravity: 7, life: 1.6, hitRadius: 0.5, bodyDamage: 90, headDamage: 180, regen: 8,
      armorBufferMode: 'normal'
    }
  },
  abilityCatalog: {
    choke: {
      id: 'choke', slot: 'ability', name: 'Vader Choke',
      description: 'Single-target lift and stun in reticle box.',
      debugSummary: 'Square = choke target box.',
      tunableParams: ['lockBoxPx', 'range', 'targetTolerance', 'duration', 'liftHeight', 'tickRate', 'dotPerTick'],
      cooldownMs: 18000, range: 26, minDot: 0.08, duration: 1.25,
      liftHeight: 1.6, tickRate: 0.25, dotPerTick: 0, castDamage: 0, lockBoxPx: 280, targetTolerance: 1.35
    },
    hook: {
      id: 'hook', slot: 'either', name: 'Chain Hook',
      description: 'Latch a target and yank them into close range.',
      debugSummary: 'Circle = hook catch radius debug.',
      tunableParams: ['reticleRadiusPx', 'catchRadius', 'range', 'travelSpeed', 'pullSpeed', 'pullDistance', 'castDamage', 'cooldownMs'],
      cooldownMs: 14000, range: 22, minDot: 0.04, pullDistance: 4.0,
      stunDuration: 0.5, castDamage: 20, lockBoxPx: 150, reticleRadiusPx: 68, catchRadius: 1.8, travelSpeed: 26, pullSpeed: 20
    },
    heal: {
      id: 'heal', slot: 'either', name: 'Heal',
      description: 'Brief self-heal with visible windup.',
      debugSummary: 'Visible windup before the heal resolves.',
      tunableParams: ['healAmount', 'cooldownMs'],
      cooldownMs: 14000, duration: 1.0, healAmount: 90
    },
    missile: {
      id: 'missile', slot: 'either', name: 'Missile',
      description: 'Fast guided micro-rocket that bends toward nearby targets.',
      debugSummary: 'Fires from muzzle and gently seeks toward nearby hostile hitboxes.',
      tunableParams: ['range', 'cooldownMs', 'damage', 'radius', 'travelSpeed', 'acquireRange', 'catchRadius', 'lockHalfAngleDeg', 'homingBoost', 'homingLerp'],
      cooldownMs: 8500, range: 36, damage: 70, radius: 2.0, travelSpeed: 34, acquireRange: 6.0, catchRadius: 1.1,
      lockHalfAngleDeg: 10, homingBoost: 4.5, homingLerp: 6.0, gravity: 0.7, fuse: 1.1
    },
    deadeye: {
      id: 'deadeye', name: 'Deadeye',
      description: 'Lock and execute marked targets.',
      debugSummary: 'Rectangle = deadeye acquisition FOV approximation.',
      tunableParams: ['range', 'minDot', 'duration', 'maxTargets', 'damage', 'cooldownMs'],
      cooldownMs: 20000, range: 60, duration: 1.6, maxTargets: 2, minDot: 0.28, damage: 160
    }
  },
  defaultAbilityLoadout: { slot1: 'choke', slot2: 'missile' }
};

export function getClassPreset(classId) {
  return gameplayTuning.classPresets[classId] || gameplayTuning.classPresets.abilities;
}

export function getSurvivabilityTuning() {
  return gameplayTuning.survivability || {};
}

export function getMovementTuning() {
  return gameplayTuning.movement || {};
}

export function getNetworkTuning() {
  return gameplayTuning.network || {};
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
  const reload = raw.reload || {};
  const reloadAudio = reload.audio || {};
  const resolvedRaiseEnd = Number.isFinite(Number(reload.raiseEnd))
    ? Number(reload.raiseEnd)
    : DEFAULT_WEAPON_PRESENTATION.reload.raiseEnd;
  const normalizedRaiseEnd = Math.max(0.05, Math.min(0.7, resolvedRaiseEnd));
  const resolvedManipulateEnd = Number.isFinite(Number(reload.manipulateEnd))
    ? Number(reload.manipulateEnd)
    : DEFAULT_WEAPON_PRESENTATION.reload.manipulateEnd;
  const normalizedManipulateEnd = Math.max(
    normalizedRaiseEnd + 0.05,
    Math.min(0.95, resolvedManipulateEnd)
  );
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
    } : null,
    reload: {
      profileId: String(reload.profileId || DEFAULT_WEAPON_PRESENTATION.reload.profileId),
      raiseEnd: normalizedRaiseEnd,
      manipulateEnd: normalizedManipulateEnd,
      audio: {
        start: String(reloadAudio.start || DEFAULT_WEAPON_PRESENTATION.reload.audio.start),
        manipulate: String(reloadAudio.manipulate || DEFAULT_WEAPON_PRESENTATION.reload.audio.manipulate),
        complete: String(reloadAudio.complete || DEFAULT_WEAPON_PRESENTATION.reload.audio.complete)
      }
    }
  };
}

export function resolveReloadPresentationState(options, previousState) {
  const opts = options || {};
  const reloadMs = Math.max(0, Number(opts.reloadMs || 0));
  const reloadRemaining = Math.max(0, Number(opts.reloadRemaining || 0));
  const reloadedFlashRemaining = Math.max(0, Number(opts.reloadedFlashRemaining || 0));
  const reloadConfig = opts.reload || DEFAULT_WEAPON_PRESENTATION.reload;
  const raiseEnd = Math.max(0.05, Math.min(0.7, Number(reloadConfig.raiseEnd || DEFAULT_WEAPON_PRESENTATION.reload.raiseEnd)));
  const manipulateEnd = Math.max(
    raiseEnd + 0.05,
    Math.min(0.95, Number(reloadConfig.manipulateEnd || DEFAULT_WEAPON_PRESENTATION.reload.manipulateEnd))
  );
  const previous = previousState || null;
  const reloading = reloadMs > 0 && reloadRemaining > 0;
  const reloadPct = reloading ? Math.max(0, Math.min(1, 1 - (reloadRemaining / reloadMs))) : 1;
  let phase = 'ready';
  let phasePct = 1;
  if (reloading) {
    if (reloadPct < raiseEnd) {
      phase = 'raise';
      phasePct = Math.max(0, Math.min(1, reloadPct / Math.max(0.0001, raiseEnd)));
    } else if (reloadPct < manipulateEnd) {
      phase = 'manipulate';
      phasePct = Math.max(0, Math.min(1, (reloadPct - raiseEnd) / Math.max(0.0001, manipulateEnd - raiseEnd)));
    } else {
      phase = 'settle';
      phasePct = Math.max(0, Math.min(1, (reloadPct - manipulateEnd) / Math.max(0.0001, 1 - manipulateEnd)));
    }
  } else if (reloadedFlashRemaining > 0) {
    phase = 'complete';
  }
  const previousPhase = previous ? String(previous.phase || '') : '';
  const previousReloading = !!(previous && previous.reloading);
  return {
    reloading,
    reloadPct,
    phase,
    phasePct,
    justStarted: reloading && !previousReloading,
    justCompleted: !reloading && reloadedFlashRemaining > 0 && (previousReloading || previousPhase !== 'complete'),
    reloadRemaining,
    reloadedFlashRemaining
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
runtime.GameShared.getClassPreset = getClassPreset;
runtime.GameShared.getSurvivabilityTuning = getSurvivabilityTuning;
runtime.GameShared.getMovementTuning = getMovementTuning;
runtime.GameShared.getNetworkTuning = getNetworkTuning;
runtime.GameShared.getWeaponStats = getWeaponStats;
runtime.GameShared.getWeaponPresentation = getWeaponPresentation;
runtime.GameShared.resolveReloadPresentationState = resolveReloadPresentationState;
runtime.GameShared.resolveWeaponAdsFovDeg = resolveWeaponAdsFovDeg;
runtime.GameShared.getWeaponFalloffProfile = getWeaponFalloffProfile;
runtime.GameShared.getDefaultWeaponLoadout = getDefaultWeaponLoadout;
runtime.GameShared.getSelectableWeaponIds = getSelectableWeaponIds;
runtime.GameShared.getDefaultAbilityLoadout = getDefaultAbilityLoadout;
runtime.GameShared.normalizeAbilityLoadout = normalizeAbilityLoadout;
runtime.GameShared.resolveWeaponAimProfile = resolveWeaponAimProfile;
