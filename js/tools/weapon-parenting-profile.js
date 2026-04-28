export const PARENTING_PROFILE_VERSION = 4;

export const PARENTING_PROFILE_STORAGE_KEY = 'mineshoot.weaponParentingEditor.profile.v4';

export const DEFAULT_HAND_STICKER = Object.freeze({
  position: [0, 0, 0],
  normal: [1, 0, 0]
});

export const DEFAULT_WEAPON_STICKER = Object.freeze({
  position: [0, -0.1, 0.08],
  normal: [0, -1, 0]
});

export const DEFAULT_WEAPON_HANDLE = Object.freeze({
  position: [0, -0.1, 0.08],
  normal: [0, -1, 0],
  size: [0.055, 0.12, 0.055]
});

function finiteNumber(value, fallback) {
  var next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function roundNumber(value, digits = 4) {
  var scale = Math.pow(10, digits);
  return Math.round(finiteNumber(value, 0) * scale) / scale;
}

export function normalizeVec3(value, fallback = [0, 0, 0], digits = 4) {
  var source = Array.isArray(value) ? value : fallback;
  return [
    roundNumber(finiteNumber(source[0], fallback[0] || 0), digits),
    roundNumber(finiteNumber(source[1], fallback[1] || 0), digits),
    roundNumber(finiteNumber(source[2], fallback[2] || 0), digits)
  ];
}

export function normalizeSticker(value, fallback = DEFAULT_WEAPON_STICKER) {
  var source = value && typeof value === 'object' ? value : {};
  return {
    position: normalizeVec3(source.position, fallback.position || [0, 0, 0]),
    normal: normalizeVec3(source.normal, fallback.normal || [0, 0, 1])
  };
}

export function normalizeHandle(value, fallback = DEFAULT_WEAPON_HANDLE) {
  var source = value && typeof value === 'object' ? value : {};
  return {
    position: normalizeVec3(source.position, fallback.position || [0, 0, 0]),
    normal: normalizeVec3(source.normal, fallback.normal || [0, 0, 1]),
    size: normalizeVec3(source.size, fallback.size || [0.055, 0.12, 0.055])
      .map(function (value, index) {
        var fallbackSize = fallback.size && fallback.size[index] != null ? fallback.size[index] : 0.1;
        return roundNumber(Math.max(0.01, finiteNumber(value, fallbackSize)), 4);
      })
  };
}

export function createDefaultWeaponCalibration(weaponId, seed = {}) {
  var handleSeed = seed.handle || seed.sticker || DEFAULT_WEAPON_HANDLE;
  return {
    weaponId: String(weaponId || 'rifle'),
    assetUrl: String(seed.assetUrl || ''),
    scale: roundNumber(seed.scale != null ? seed.scale : 1, 4),
    translation: normalizeVec3(seed.translation, [0, 0, 0], 4),
    rotationDeg: normalizeVec3(seed.rotationDeg, [0, 0, 0], 2),
    handle: normalizeHandle(handleSeed, DEFAULT_WEAPON_HANDLE),
    sticker: normalizeSticker(seed.sticker || handleSeed, DEFAULT_WEAPON_STICKER)
  };
}

export function createDefaultParentingProfile(weaponIds = [], seeds = {}) {
  var weapons = {};
  for (var i = 0; i < weaponIds.length; i++) {
    var weaponId = String(weaponIds[i]);
    weapons[weaponId] = createDefaultWeaponCalibration(weaponId, seeds[weaponId] || {});
  }
  return {
    version: PARENTING_PROFILE_VERSION,
    character: {
      id: 'boxman',
      handSticker: normalizeSticker(DEFAULT_HAND_STICKER, DEFAULT_HAND_STICKER)
    },
    weapons: weapons,
    activeWeaponId: String(weaponIds[0] || 'rifle')
  };
}

export function normalizeWeaponCalibration(weaponId, value, seed = {}) {
  var fallback = createDefaultWeaponCalibration(weaponId, seed);
  var source = value && typeof value === 'object' ? value : {};
  return {
    weaponId: String(source.weaponId || weaponId || fallback.weaponId),
    assetUrl: String(source.assetUrl || fallback.assetUrl || ''),
    scale: roundNumber(Math.max(0.01, finiteNumber(source.scale, fallback.scale)), 4),
    translation: normalizeVec3(source.translation, fallback.translation, 4),
    rotationDeg: normalizeVec3(source.rotationDeg, fallback.rotationDeg, 2),
    handle: normalizeHandle(source.handle || source.sticker, fallback.handle),
    sticker: normalizeSticker(source.sticker, fallback.sticker)
  };
}

export function normalizeParentingProfile(value, weaponIds = [], seeds = {}) {
  var source = value && typeof value === 'object' ? value : {};
  var defaultProfile = createDefaultParentingProfile(weaponIds, seeds);
  var sourceWeapons = source.weapons && typeof source.weapons === 'object' ? source.weapons : {};
  var weapons = {};

  for (var i = 0; i < weaponIds.length; i++) {
    var weaponId = String(weaponIds[i]);
    weapons[weaponId] = normalizeWeaponCalibration(
      weaponId,
      sourceWeapons[weaponId],
      seeds[weaponId] || {}
    );
  }

  var character = source.character && typeof source.character === 'object' ? source.character : {};
  var activeWeaponId = String(source.activeWeaponId || defaultProfile.activeWeaponId);
  if (!Object.prototype.hasOwnProperty.call(weapons, activeWeaponId)) {
    activeWeaponId = defaultProfile.activeWeaponId;
  }

  return {
    version: PARENTING_PROFILE_VERSION,
    character: {
      id: String(character.id || 'boxman'),
      handSticker: normalizeSticker(character.handSticker, DEFAULT_HAND_STICKER)
    },
    weapons: weapons,
    activeWeaponId: activeWeaponId
  };
}

export function serializeParentingProfile(profile, weaponIds = [], seeds = {}) {
  return JSON.stringify(normalizeParentingProfile(profile, weaponIds, seeds), null, 2);
}

export function parseParentingProfile(text, weaponIds = [], seeds = {}) {
  var parsed = JSON.parse(String(text || '{}'));
  return normalizeParentingProfile(parsed, weaponIds, seeds);
}
