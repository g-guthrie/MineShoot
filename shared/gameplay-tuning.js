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
  recoil: {
    z: -0.05,
    x: -0.09,
    pitch: 0.018,
    yaw: 0.009,
    roll: 0.006,
    armR: 0.22,
    armL: 0.1,
    muzzleMs: 60,
    pitchKickScale: 1,
    yawKickScale: 1,
    rollKickScale: 1,
    gunKickScale: 1,
    armKickScale: 1,
    pitchRecoverScale: 1,
    yawRecoverScale: 1,
    rollRecoverScale: 1,
    pattern: 'snap',
    patternStrength: 0
  },
  audioSample: null,
  reload: DEFAULT_WEAPON_RELOAD_PRESENTATION
};

export const gameplayTuning = {
  survivability: {
    hpMax: 400,
    armorMax: 100,
    armorRegenDelaySec: 12.0,
    armorRegenPerSec: 25
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
      pessimisticRttAlpha: 0.05,
      pessimisticWindowMs: 2000,
      jitterAlpha: 0.2
    },
    selfReconciliation: {
      hardSnapDistanceWu: 4.5,
      hardSnapVerticalWu: 1.35,
      idleReplayDistanceWu: 0.7,
      movingReplayDistanceWu: 1.25,
      emergencyReplayDistanceWu: 2.0,
      baseGraceMs: 100,
      maxExtraGraceMs: 80,
      movingAckDriftLimit: 3,
      airborneHardSnapDistanceWu: 6.25,
      airborneHardSnapVerticalWu: 2.75,
      airborneReplayDistanceWu: 2.0,
      airborneGraceMs: 200,
      airborneMovingAckDriftLimit: 5
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
      delayIncreaseTargetWeight: 0.7,
      delayDecreaseTargetWeight: 0.2,
      freezeGapMinMs: 48,
      freezeGapMaxMs: 160,
      freezeGapIntervalScale: 1.25,
      freezeGapJitterScale: 1.8,
      freezeRecoveryBlendMs: 48,
      maxExtrapolationMinMs: 8,
      maxExtrapolationMaxMs: 36,
      maxExtrapolationIntervalScale: 0.28,
      maxExtrapolationJitterScale: 0.45,
      extrapolationDecay: 1.2,
      verticalBallisticEnabled: true,
      animationStateBlendMs: 120,
      muzzleFlashPresentationMs: 70,
      serverOffsetSnapDeltaMs: 120,
      offsetLerpAlpha: 0.12,
      fallbackCatchupRemainingPerSecond: 0.001,
      lossBurstThresholdScale: 1.5,
      lossDelayPaddingTriggerCount: 2,
      lossDelayPaddingIntervalScale: 1.0,
      lossDelayPaddingMaxMs: 120,
      lossHistoryBonus: 10,
      teleportBaseThresholdWu: 8,
      teleportSpeedAllowanceScale: 1.5,
      hitboxLeadMs: 24
    },
    feedback: {
      predictedHitTtlMs: 900,
      shotgunAggregateWindowMs: 60
    }
  },
  movement: {
    jogSpeed: 7,
    runSpeed: 11,
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
    rifle: { start: 42, end: 65, minScalar: 0.5 },
    pistol: { start: 32, end: 40, minScalar: 0.333 },
    machinegun: { start: 33, end: 42, minScalar: 0.5 },
    shotgun: { start: 6.8, end: 9.2, minScalar: 0.0 },
    sniper: { start: 9999, end: 10000, minScalar: 1.0 },
    missile: { start: 34, end: 34, minScalar: 1.0 }
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
    abilities: { armorMax: 100, wallhackRadius: 90 },
    ffa: { armorMax: 100, wallhackRadius: 90 }
  },
  weaponStats: {
    rifle: {
      name: 'Scout Rifle', displayName: 'Scout Rifle', primitiveType: 'hitscan_single', automatic: false, cooldownMs: 400, reloadMs: 1850, magazineSize: 14,
      bodyDamage: 50, headDamage: 78, maxRange: 90, pellets: 1, hipfireSpread: 0.024, adsSpread: 0, adsFovDeg: 56, adsMaxRange: 110,
      moveSpeedMultiplier: 0.96, adsMoveMultiplier: 0.75,
      hipfireBloomScale: 2.5, adsBloomScale: 1,
      falloff: { start: 42, end: 65, minScalar: 0.5 },
      aimProfile: { hipfire: { spread: 0.024, maxRange: 90 }, ads: { spread: 0, maxRange: 110 } },
      armorBufferMode: 'normal',
      presentation: {
        tracer: { life: 0.11, speed: 280, segmentLength: 1.25 },
        recoil: {
          z: -0.05,
          x: -0.09,
          pitch: 0.018,
          yaw: 0.009,
          roll: 0.006,
          armR: 0.22,
          armL: 0.1,
          muzzleMs: 60,
          pitchKickScale: 1.25,
          yawKickScale: 1.05,
          rollKickScale: 1.10,
          gunKickScale: 1.20,
          armKickScale: 1.15,
          pitchRecoverScale: 0.95,
          yawRecoverScale: 1.0,
          rollRecoverScale: 0.95,
          pattern: 'push',
          patternStrength: 0.22
        },
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
      name: 'Hand Cannon', displayName: 'Hand Cannon', primitiveType: 'hitscan_single', automatic: false, cooldownMs: 430, reloadMs: 2050, magazineSize: 10,
      bodyDamage: 60, headDamage: 90, maxRange: 52, pellets: 1, hipfireSpread: 0.105, adsSpread: 0.105, adsFovDeg: 56, adsMaxRange: 52,
      moveSpeedMultiplier: 1.1, adsMoveMultiplier: 0.9,
      falloff: { start: 32, end: 40, minScalar: 0.333 },
      aimProfile: { hipfire: { spread: 0.105, maxRange: 52 }, ads: { spread: 0.105, maxRange: 52 } },
      armorBufferMode: 'normal',
      presentation: {
        tracer: { life: 0.11, speed: 280, segmentLength: 0.25 },
        recoil: {
          z: -0.04,
          x: -0.08,
          pitch: 0.014,
          yaw: 0.007,
          roll: 0.005,
          armR: 0.2,
          armL: 0.08,
          muzzleMs: 60,
          pitchKickScale: 1.40,
          yawKickScale: 1.15,
          rollKickScale: 1.35,
          gunKickScale: 1.30,
          armKickScale: 1.25,
          pitchRecoverScale: 1.15,
          yawRecoverScale: 1.15,
          rollRecoverScale: 1.15,
          pattern: 'snap',
          patternStrength: 0.35
        },
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
      name: 'Auto Rifle', displayName: 'Auto Rifle', primitiveType: 'hitscan_single', automatic: true, cooldownMs: 133, reloadMs: 1800, magazineSize: 32,
      bodyDamage: 18, headDamage: 27, maxRange: 70, pellets: 1, hipfireSpread: 0.045, adsSpread: 0.035, adsFovDeg: 56, adsMaxRange: 78,
      moveSpeedMultiplier: 1.04, adsMoveMultiplier: 0.95,
      falloff: { start: 33, end: 42, minScalar: 0.5 },
      aimProfile: { hipfire: { spread: 0.045, maxRange: 70 }, ads: { spread: 0.035, maxRange: 78 } },
      armorBufferMode: 'normal',
      presentation: {
        tracer: { life: 0.075, speed: 260, segmentLength: 1.0 },
        recoil: {
          z: -0.024,
          x: -0.045,
          pitch: 0.009,
          yaw: 0.006,
          roll: 0.004,
          armR: 0.14,
          armL: 0.06,
          muzzleMs: 55,
          pitchKickScale: 1.15,
          yawKickScale: 1.10,
          rollKickScale: 1.10,
          gunKickScale: 1.15,
          armKickScale: 1.10,
          pitchRecoverScale: 1.10,
          yawRecoverScale: 1.10,
          rollRecoverScale: 1.10,
          pattern: 'chatter',
          patternStrength: 0.18
        },
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
      name: 'Shotgun', displayName: 'Shotgun', primitiveType: 'hitscan_multi', automatic: false, cooldownMs: 900, reloadMs: 2100, magazineSize: 5,
      bodyDamage: 20, headDamage: 22, maxRange: 24, pellets: 12, hipfireSpread: 0.185, adsSpread: 0.185, adsFovDeg: 56, adsMaxRange: 24,
      moveSpeedMultiplier: 1.0, adsMoveMultiplier: 0.9,
      falloff: { start: 6.8, end: 9.2, minScalar: 0.0 },
      aimProfile: { hipfire: { spread: 0.185, maxRange: 24 }, ads: { spread: 0.185, maxRange: 24 } },
      armorBufferMode: 'normal',
      presentation: {
        tracer: { life: 0.1, speed: 230, segmentLength: 1.9 },
        recoil: {
          z: -0.09,
          x: -0.16,
          pitch: 0.03,
          yaw: 0.012,
          roll: 0.008,
          armR: 0.26,
          armL: 0.12,
          muzzleMs: 70,
          pitchKickScale: 1.45,
          yawKickScale: 1.20,
          rollKickScale: 1.40,
          gunKickScale: 1.50,
          armKickScale: 1.40,
          pitchRecoverScale: 0.90,
          yawRecoverScale: 0.90,
          rollRecoverScale: 0.90,
          pattern: 'slam',
          patternStrength: 0.40
        },
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
      name: 'Sniper', displayName: 'Sniper', primitiveType: 'hitscan_single', automatic: false, cooldownMs: 1800, reloadMs: 2400, magazineSize: 4,
      bodyDamage: 180, headDamage: 420, maxRange: 170, pellets: 1, hipfireSpread: 0.32, adsSpread: 0, adsFovDeg: 24, adsMaxRange: 170,
      moveSpeedMultiplier: 0.85, adsMoveMultiplier: 0.6,
      falloff: { start: 9999, end: 10000, minScalar: 1.0 },
      aimProfile: { hipfire: { spread: 0.32, maxRange: 170 }, ads: { spread: 0, maxRange: 170 } }, infiniteRange: true,
      armorBufferMode: 'normal',
      presentation: {
        tracer: { life: 0.12, speed: 320, segmentLength: 2.6 },
        recoil: {
          z: -0.12,
          x: -0.2,
          pitch: 0.04,
          yaw: 0.01,
          roll: 0.007,
          armR: 0.3,
          armL: 0.12,
          muzzleMs: 90,
          pitchKickScale: 1.65,
          yawKickScale: 1.05,
          rollKickScale: 1.20,
          gunKickScale: 1.60,
          armKickScale: 1.30,
          pitchRecoverScale: 0.85,
          yawRecoverScale: 0.90,
          rollRecoverScale: 0.85,
          pattern: 'u_shape',
          patternStrength: 0.60
        },
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
  throwables: {
    order: ['frag', 'plasma', 'molotov', 'knife'],
    frag: {
      id: 'frag', label: 'Frag', previewType: 'trajectory', speed: 22.5, upward: 5.0, gravity: 19, fuse: 2.0, radius: 6.2, damage: 110, minBlastDamage: 10, regen: 10, bounce: true,
      bounceVelocityDamping: 0.4,
      bounceVerticalDamping: 0.42,
      bounceMaxCount: 2,
      bounceStopSpeedSq: 2.5,
      armorBufferMode: 'normal'
    },
    plasma: {
      id: 'plasma', label: 'Plasma Grenade', previewType: 'none', speed: 30, upward: 3.0, gravity: 6.0, fuse: 2.0, maxLife: 3.2, radius: 4.5, damage: 95, minBlastDamage: 10, regen: 10,
      catchRadius: 2.5, trackDuration: 0, trackLerp: 0, acquireRange: 0, acquireHalfAngleDeg: 0, stickExplodeDelay: 1.8,
      seekLerp: 8.0, seekSpeed: 32, stickHeight: 0.9,
      armorBufferMode: 'normal'
    },
    missile: {
      id: 'missile', label: 'Missile', speed: 34, upward: 0.2, gravity: 0.7, fuse: 1.1, radius: 2.0, damage: 70, minBlastDamage: 10,
      homingBoost: 4.5, homingLerp: 6.0, lockHalfAngleDeg: 10, acquireRange: 6.0, hitRadius: 0.9,
      armorBufferMode: 'normal'
    },
    molotov: {
      id: 'molotov', label: 'Molotov', previewType: 'trajectory', speed: 16.5, upward: 4.6, gravity: 21, fuse: 2.8, fireRadius: 4.0,
      fireDuration: 6.0, fireTickDamage: 14, fireTickRate: 0.4, fireInnerRadius: 2.2, fireOuterDamageScale: 0.45,
      fireLingerDuration: 1.2, fireLingerTickDamage: 5, fireLingerTickRate: 0.5, fireMaxHeightDelta: 1.5, regen: 10,
      armorBufferMode: 'normal'
    },
    knife: {
      id: 'knife', label: 'Knife', previewType: 'none', speed: 28, upward: 1.2, gravity: 7, life: 1.6, hitRadius: 0.5, bodyDamage: 90, headDamage: 180, regen: 8,
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
    missile: {
      id: 'missile', slot: 'either', name: 'Missile',
      description: 'Fast guided micro-rocket that bends toward nearby targets.',
      debugSummary: 'Fires from muzzle and gently seeks toward nearby hostile hitboxes.',
      tunableParams: ['range', 'cooldownMs', 'damage', 'radius', 'travelSpeed', 'acquireRange', 'catchRadius', 'lockHalfAngleDeg', 'homingBoost', 'homingLerp'],
      cooldownMs: 7500, range: 36, damage: 70, radius: 2.0, travelSpeed: 34, acquireRange: 6.0, catchRadius: 1.1,
      lockHalfAngleDeg: 10, homingBoost: 4.5, homingLerp: 6.0, gravity: 0.7, fuse: 1.1
    },
    deadeye: {
      id: 'deadeye', name: 'Deadeye',
      description: 'Lock and execute marked targets.',
      debugSummary: 'Rectangle = deadeye acquisition FOV approximation.',
      tunableParams: ['range', 'minDot', 'duration', 'maxTargets', 'damage', 'cooldownMs'],
      cooldownMs: 20000, range: 60, duration: 1.6, maxTargets: 2, minDot: 0.28, damage: 160, lockBoxPx: 220
    }
  },
  defaultAbilityId: 'deadeye'
};

export function getClassPreset(classId) {
  return gameplayTuning.classPresets[classId] || gameplayTuning.classPresets.abilities;
}

export function getSurvivabilityTuning() {
  return gameplayTuning.survivability || {};
}

export function getAwarenessTuning() {
  return gameplayTuning.awareness || {};
}

export function getMovementTuning() {
  return gameplayTuning.movement || {};
}

export function getNetworkTuning() {
  return gameplayTuning.network || {};
}

export function getEnemyTuning() {
  return gameplayTuning.enemy || {};
}

export function getThrowableMechanicsTuning() {
  return gameplayTuning.throwableMechanics || {};
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
      muzzleMs: Number.isFinite(Number(recoil.muzzleMs)) ? Number(recoil.muzzleMs) : DEFAULT_WEAPON_PRESENTATION.recoil.muzzleMs,
      pitchKickScale: Number.isFinite(Number(recoil.pitchKickScale)) ? Number(recoil.pitchKickScale) : DEFAULT_WEAPON_PRESENTATION.recoil.pitchKickScale,
      yawKickScale: Number.isFinite(Number(recoil.yawKickScale)) ? Number(recoil.yawKickScale) : DEFAULT_WEAPON_PRESENTATION.recoil.yawKickScale,
      rollKickScale: Number.isFinite(Number(recoil.rollKickScale)) ? Number(recoil.rollKickScale) : DEFAULT_WEAPON_PRESENTATION.recoil.rollKickScale,
      gunKickScale: Number.isFinite(Number(recoil.gunKickScale)) ? Number(recoil.gunKickScale) : DEFAULT_WEAPON_PRESENTATION.recoil.gunKickScale,
      armKickScale: Number.isFinite(Number(recoil.armKickScale)) ? Number(recoil.armKickScale) : DEFAULT_WEAPON_PRESENTATION.recoil.armKickScale,
      pitchRecoverScale: Number.isFinite(Number(recoil.pitchRecoverScale)) ? Number(recoil.pitchRecoverScale) : DEFAULT_WEAPON_PRESENTATION.recoil.pitchRecoverScale,
      yawRecoverScale: Number.isFinite(Number(recoil.yawRecoverScale)) ? Number(recoil.yawRecoverScale) : DEFAULT_WEAPON_PRESENTATION.recoil.yawRecoverScale,
      rollRecoverScale: Number.isFinite(Number(recoil.rollRecoverScale)) ? Number(recoil.rollRecoverScale) : DEFAULT_WEAPON_PRESENTATION.recoil.rollRecoverScale,
      pattern: String(recoil.pattern || DEFAULT_WEAPON_PRESENTATION.recoil.pattern),
      patternStrength: Number.isFinite(Number(recoil.patternStrength)) ? Number(recoil.patternStrength) : DEFAULT_WEAPON_PRESENTATION.recoil.patternStrength
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
  const weapon = gameplayTuning.weaponStats[String(weaponId || '')] || null;
  const profile = (weapon && weapon.falloff) || gameplayTuning.weaponFalloff[String(weaponId || '')] || null;
  if (!profile || typeof profile !== 'object') return null;
  const start = Number(profile.start);
  const end = Number(profile.end);
  const minScalar = Number(profile.minScalar);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(minScalar)) return null;
  return {
    start: Math.max(0, start),
    end: Math.max(Math.max(0, start), end),
    minScalar: Math.max(0, Math.min(1, minScalar))
  };
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

export function isSelectableWeaponId(weaponId, deps = {}) {
  const id = String(weaponId || '');
  const selectableWeaponIds = Array.isArray(deps.selectableWeaponIds) && deps.selectableWeaponIds.length
    ? deps.selectableWeaponIds.map((value) => String(value || ''))
    : getSelectableWeaponIds();
  const weaponStats = deps.weaponStats || gameplayTuning.weaponStats || {};
  return selectableWeaponIds.indexOf(id) >= 0 && !!weaponStats[id];
}

function enforceSniperSecondary(slots, deps = {}) {
  const next = Array.isArray(slots) ? slots.slice(0, 2) : [];
  if (String(next[0] || '') !== 'sniper') return next;
  if (String(next[1] || '') && String(next[1] || '') !== 'sniper') {
    return [String(next[1] || ''), 'sniper'];
  }
  const defaultWeaponLoadout = Array.isArray(deps.defaultWeaponLoadout) && deps.defaultWeaponLoadout.length
    ? deps.defaultWeaponLoadout
    : getDefaultWeaponLoadout();
  const selectableWeaponIds = Array.isArray(deps.selectableWeaponIds) && deps.selectableWeaponIds.length
    ? deps.selectableWeaponIds
    : getSelectableWeaponIds();
  const fallbackIds = defaultWeaponLoadout.concat(selectableWeaponIds);
  for (let i = 0; i < fallbackIds.length; i++) {
    const id = String(fallbackIds[i] || '');
    if (!id || id === 'sniper' || !isSelectableWeaponId(id, deps)) continue;
    return [id, 'sniper'];
  }
  return next;
}

export function normalizeWeaponLoadout(rawSlots, fallbackSlots, deps = {}) {
  const selectableWeaponIds = Array.isArray(deps.selectableWeaponIds) && deps.selectableWeaponIds.length
    ? deps.selectableWeaponIds.map((value) => String(value || ''))
    : getSelectableWeaponIds();
  const fallback = Array.isArray(fallbackSlots) && fallbackSlots.length
    ? fallbackSlots.slice(0, 2)
    : (Array.isArray(deps.defaultWeaponLoadout) && deps.defaultWeaponLoadout.length
      ? deps.defaultWeaponLoadout.slice(0, 2)
      : getDefaultWeaponLoadout());
  const next = [];
  const seen = {};
  const combined = Array.isArray(rawSlots) ? rawSlots.slice(0) : [];
  for (let i = 0; i < fallback.length; i++) combined.push(fallback[i]);
  for (let i = 0; i < selectableWeaponIds.length; i++) combined.push(selectableWeaponIds[i]);
  for (let i = 0; i < combined.length && next.length < 2; i++) {
    const id = String(combined[i] || '');
    if (!isSelectableWeaponId(id, deps) || seen[id]) continue;
    seen[id] = true;
    next.push(id);
  }
  const resolved = next.length
    ? next
    : (Array.isArray(deps.defaultWeaponLoadout) && deps.defaultWeaponLoadout.length
      ? deps.defaultWeaponLoadout.slice(0, 2)
      : getDefaultWeaponLoadout());
  return enforceSniperSecondary(resolved, deps);
}

export function canWeaponLoadoutEquipId(loadout, weaponId, deps = {}) {
  const id = String(weaponId || '');
  const defaultWeaponLoadout = Array.isArray(deps.defaultWeaponLoadout) && deps.defaultWeaponLoadout.length
    ? deps.defaultWeaponLoadout
    : getDefaultWeaponLoadout();
  if (!isSelectableWeaponId(id, deps)) return false;
  return normalizeWeaponLoadout(loadout, defaultWeaponLoadout, deps).indexOf(id) >= 0;
}

export function createWeaponAmmoRuntime(loadout, deps = {}) {
  const ammo = {};
  const weaponStats = deps.weaponStats || gameplayTuning.weaponStats || {};
  const defaultWeaponLoadout = Array.isArray(deps.defaultWeaponLoadout) && deps.defaultWeaponLoadout.length
    ? deps.defaultWeaponLoadout
    : getDefaultWeaponLoadout();
  const ids = Array.isArray(loadout) && loadout.length ? loadout : defaultWeaponLoadout;
  for (let i = 0; i < ids.length; i++) {
    const weaponId = String(ids[i] || '');
    const stats = weaponStats[weaponId] || null;
    if (!stats || !(Number(stats.magazineSize || 0) > 0)) continue;
    ammo[weaponId] = {
      ammoInMag: Math.max(0, Number(stats.magazineSize || 0)),
      reloadUntil: 0,
      reloadedFlashUntil: 0
    };
  }
  return ammo;
}

export function getAbilityDef(abilityId) {
  return (gameplayTuning.abilityCatalog && gameplayTuning.abilityCatalog[abilityId]) || null;
}

export function getAbilityCatalog() {
  return gameplayTuning.abilityCatalog || {};
}

export function getDefaultThrowableId() {
  const throwables = gameplayTuning.throwables || {};
  const order = Array.isArray(throwables.order) ? throwables.order : Object.keys(throwables).filter((key) => key !== 'order');
  return order.length ? String(order[0] || '') : '';
}

export function normalizeThrowableId(requestedId) {
  const throwables = gameplayTuning.throwables || {};
  const order = Array.isArray(throwables.order) ? throwables.order : Object.keys(throwables).filter((key) => key !== 'order');
  const requested = String(requestedId || '');
  if (requested && order.indexOf(requested) >= 0 && throwables[requested]) return requested;
  return getDefaultThrowableId();
}

export function getDefaultAbilityId() {
  const requested = String(gameplayTuning.defaultAbilityId || '');
  const catalog = getAbilityCatalog();
  if (requested && catalog[requested]) return requested;
  const catalogIds = Object.keys(catalog);
  return catalogIds.length ? catalogIds[0] : '';
}

export function normalizeAbilityId(requestedId) {
  const catalog = getAbilityCatalog();
  const requested = String(requestedId || '');
  if (requested && catalog[requested]) return requested;
  return getDefaultAbilityId();
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.gameplayTuning = gameplayTuning;
runtime.GameShared.getClassPreset = getClassPreset;
runtime.GameShared.getSurvivabilityTuning = getSurvivabilityTuning;
runtime.GameShared.getAwarenessTuning = getAwarenessTuning;
runtime.GameShared.getMovementTuning = getMovementTuning;
runtime.GameShared.getNetworkTuning = getNetworkTuning;
runtime.GameShared.getEnemyTuning = getEnemyTuning;
runtime.GameShared.getThrowableMechanicsTuning = getThrowableMechanicsTuning;
runtime.GameShared.getWeaponStats = getWeaponStats;
runtime.GameShared.getWeaponPresentation = getWeaponPresentation;
runtime.GameShared.resolveReloadPresentationState = resolveReloadPresentationState;
runtime.GameShared.resolveWeaponAdsFovDeg = resolveWeaponAdsFovDeg;
runtime.GameShared.getWeaponFalloffProfile = getWeaponFalloffProfile;
runtime.GameShared.getDefaultWeaponLoadout = getDefaultWeaponLoadout;
runtime.GameShared.getSelectableWeaponIds = getSelectableWeaponIds;
runtime.GameShared.isSelectableWeaponId = isSelectableWeaponId;
runtime.GameShared.normalizeWeaponLoadout = normalizeWeaponLoadout;
runtime.GameShared.canWeaponLoadoutEquipId = canWeaponLoadoutEquipId;
runtime.GameShared.createWeaponAmmoRuntime = createWeaponAmmoRuntime;
runtime.GameShared.getAbilityDef = getAbilityDef;
runtime.GameShared.getAbilityCatalog = getAbilityCatalog;
runtime.GameShared.getDefaultThrowableId = getDefaultThrowableId;
runtime.GameShared.normalizeThrowableId = normalizeThrowableId;
runtime.GameShared.getDefaultAbilityId = getDefaultAbilityId;
runtime.GameShared.normalizeAbilityId = normalizeAbilityId;
runtime.GameShared.resolveWeaponAimProfile = resolveWeaponAimProfile;
