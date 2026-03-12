import { gameplayTuning } from '../shared/gameplay-tuning.js';
import { GameWorld } from './world.js';

export const GameCombatTuning = {};

function weaponStats() {
  return gameplayTuning && gameplayTuning.weaponStats ? gameplayTuning.weaponStats : {};
}

function weaponFalloff() {
  return gameplayTuning && gameplayTuning.weaponFalloff ? gameplayTuning.weaponFalloff : {};
}

function classPresets() {
  return gameplayTuning && gameplayTuning.classPresets ? gameplayTuning.classPresets : {};
}

function scaleDistance(meters) {
  if (GameWorld && GameWorld.scaleCombatDistance) {
    return GameWorld.scaleCombatDistance(meters);
  }
  return Number(meters || 0);
}

GameCombatTuning.getAwarenessTuning = function getAwarenessTuning() {
  return {
    segments: 0,
    radarRange: 0,
    coreRange: 0,
    beaconMinRange: 0,
    beaconMaxCount: 0
  };
};

GameCombatTuning.getEnemyTuning = function getEnemyTuning() {
  return {
    fireRange: 0,
    headshotNearRange: 0,
    headshotMidRange: 0,
    defaultWallhackRadius: GameCombatTuning.getClassWallhackRadius('ffa')
  };
};

GameCombatTuning.getWeaponRange = function getWeaponRange(weaponId) {
  const stats = weaponStats();
  const weapon = stats[String(weaponId || '')] || stats.rifle || {};
  return scaleDistance(Number(weapon.maxRange || 0));
};

GameCombatTuning.getWeaponFalloffTuning = function getWeaponFalloffTuning(weaponId) {
  const profiles = weaponFalloff();
  const profile = profiles[String(weaponId || '')] || profiles.rifle || [];
  const out = [];
  for (let i = 0; i < profile.length; i++) {
    const band = profile[i] || {};
    const maxDistance = Number(band.maxDistance);
    const scale = Number(band.scale);
    if (!isFinite(maxDistance) || maxDistance <= 0) continue;
    if (!isFinite(scale)) continue;
    out.push({
      maxDistance: scaleDistance(maxDistance),
      scale: Math.max(0, scale)
    });
  }
  out.sort(function sortDistance(a, b) { return a.maxDistance - b.maxDistance; });
  return out;
};

GameCombatTuning.getThrowableDistanceTuning = function getThrowableDistanceTuning() {
  return {};
};

GameCombatTuning.getThrowableMechanicsTuning = function getThrowableMechanicsTuning() {
  return {};
};

GameCombatTuning.getClassWallhackRadius = function getClassWallhackRadius(classId) {
  const presets = classPresets();
  const preset = presets[String(classId || '')] || presets.ffa || { wallhackRadius: 90 };
  return scaleDistance(Number(preset.wallhackRadius || 90));
};

GameCombatTuning.getClassAbilityTuning = function getClassAbilityTuning() {
  return {};
};

GameCombatTuning.getRawSharedTuning = function getRawSharedTuning() {
  return gameplayTuning ? JSON.parse(JSON.stringify(gameplayTuning)) : null;
};

GameCombatTuning.debugDump = function debugDump() {
  return {
    weaponRanges: {
      rifle: GameCombatTuning.getWeaponRange('rifle')
    },
    weaponFalloff: {
      rifle: GameCombatTuning.getWeaponFalloffTuning('rifle')
    },
    classWallhackRadius: {
      ffa: GameCombatTuning.getClassWallhackRadius('ffa')
    }
  };
};
