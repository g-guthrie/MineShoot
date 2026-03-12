const DEFAULT_CAMERA_FOV_DEG = 75;
const DEFAULT_ADS_FOV_DEG = 56;

const DEFAULT_WEAPON_PRESENTATION = {
  tracer: { life: 0.11, speed: 280, segmentLength: 1.25 },
  recoil: { z: -0.05, x: -0.09, pitch: 0.018, yaw: 0.009, roll: 0.006, armR: 0.22, armL: 0.1, muzzleMs: 60 },
  audioSample: { url: '/assets/audio/weapons/rifle.mp3', gain: 0.66, playbackRateMin: 0.97, playbackRateMax: 1.03 }
};

export const gameplayTuning = {
  classPresets: {
    ffa: {
      armorMax: 90,
      wallhackRadius: 90
    }
  },
  weaponFalloff: {
    rifle: [
      { maxDistance: 32, scale: 1.0 },
      { maxDistance: 58, scale: 0.95 },
      { maxDistance: 90, scale: 0.86 },
      { maxDistance: 120, scale: 0.76 }
    ]
  },
  weaponStats: {
    rifle: {
      id: 'rifle',
      name: 'Rifle',
      primitiveType: 'hitscan_single',
      automatic: false,
      cooldownMs: 260,
      bodyDamage: 44,
      headDamage: 104,
      maxRange: 110,
      pellets: 1,
      hipfireSpread: 0.024,
      adsSpreadMultiplier: 0,
      adsSpread: 0,
      adsFovDeg: 56,
      adsMaxRange: 132,
      adsHitscanRangeMultiplier: 1.2,
      aimProfile: {
        hipfire: { spread: 0.024, maxRange: 110 },
        ads: { spread: 0, maxRange: 132 }
      },
      presentation: DEFAULT_WEAPON_PRESENTATION
    }
  },
  defaultWeaponLoadout: ['rifle'],
  selectableWeaponIds: ['rifle'],
  throwables: {}
};

export function getClassPreset(classId) {
  return gameplayTuning.classPresets[classId] || gameplayTuning.classPresets.ffa;
}

export function getWeaponStats(weaponId) {
  return gameplayTuning.weaponStats[String(weaponId || '')] || gameplayTuning.weaponStats.rifle;
}

export function getWeaponPresentation(weaponId) {
  var stats = getWeaponStats(weaponId) || {};
  var raw = stats.presentation || DEFAULT_WEAPON_PRESENTATION;
  return {
    tracer: {
      life: Number(raw.tracer && raw.tracer.life) || DEFAULT_WEAPON_PRESENTATION.tracer.life,
      speed: Number(raw.tracer && raw.tracer.speed) || DEFAULT_WEAPON_PRESENTATION.tracer.speed,
      segmentLength: Number(raw.tracer && raw.tracer.segmentLength) || DEFAULT_WEAPON_PRESENTATION.tracer.segmentLength
    },
    recoil: {
      z: Number(raw.recoil && raw.recoil.z) || DEFAULT_WEAPON_PRESENTATION.recoil.z,
      x: Number(raw.recoil && raw.recoil.x) || DEFAULT_WEAPON_PRESENTATION.recoil.x,
      pitch: Number(raw.recoil && raw.recoil.pitch) || DEFAULT_WEAPON_PRESENTATION.recoil.pitch,
      yaw: Number(raw.recoil && raw.recoil.yaw) || DEFAULT_WEAPON_PRESENTATION.recoil.yaw,
      roll: Number(raw.recoil && raw.recoil.roll) || DEFAULT_WEAPON_PRESENTATION.recoil.roll,
      armR: Number(raw.recoil && raw.recoil.armR) || DEFAULT_WEAPON_PRESENTATION.recoil.armR,
      armL: Number(raw.recoil && raw.recoil.armL) || DEFAULT_WEAPON_PRESENTATION.recoil.armL,
      muzzleMs: Number(raw.recoil && raw.recoil.muzzleMs) || DEFAULT_WEAPON_PRESENTATION.recoil.muzzleMs
    },
    audioSample: raw.audioSample || DEFAULT_WEAPON_PRESENTATION.audioSample
  };
}

export function resolveWeaponAdsFovDeg(weaponStats) {
  const raw = Number(weaponStats && weaponStats.adsFovDeg);
  if (Number.isFinite(raw) && raw > 0.0001) {
    return Math.max(1, Math.min(DEFAULT_CAMERA_FOV_DEG, raw));
  }
  return DEFAULT_ADS_FOV_DEG;
}

export function getWeaponFalloffProfile(weaponId) {
  const profile = gameplayTuning.weaponFalloff[String(weaponId || '')];
  return Array.isArray(profile) ? profile.slice() : [];
}

export function resolveWeaponAimProfile(weaponStats, adsActive) {
  const stats = weaponStats || getWeaponStats('rifle');
  const aimProfile = stats.aimProfile || {};
  const activeProfile = adsActive ? (aimProfile.ads || {}) : (aimProfile.hipfire || {});
  return {
    spread: Math.max(0, Number(activeProfile.spread != null ? activeProfile.spread : stats.hipfireSpread || 0)),
    maxRange: Math.max(0, Number(activeProfile.maxRange != null ? activeProfile.maxRange : stats.maxRange || 0))
  };
}

export function getDefaultWeaponLoadout() {
  return gameplayTuning.defaultWeaponLoadout.slice();
}

export function getSelectableWeaponIds() {
  return gameplayTuning.selectableWeaponIds.slice();
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
