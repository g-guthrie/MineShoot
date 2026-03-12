import { gameplayTuning } from '../../../shared/gameplay-tuning.js';
import { GameHitscan } from '../../hitscan.js';

export const GameWeaponBehaviors = {};
var behaviors = {};
var lastFireTimes = {};

behaviors.hitscan_single = {
  type: 'hitscan_single',
  description: 'Single raycast from camera',
  execute: function executeSingle(_config, context) {
    if (!GameHitscan || !GameHitscan.fire) return false;
    return GameHitscan.fire(context.camera, context.onHit || null, context.onMiss || null);
  }
};

behaviors.hitscan_multi = {
  type: 'hitscan_multi',
  description: 'Multiple raycasts (shotgun pattern)',
  execute: function executeMulti(_config, context) {
    if (!GameHitscan || !GameHitscan.fire) return false;
    return GameHitscan.fire(context.camera, context.onHit || null, context.onMiss || null);
  }
};

behaviors.projectile_homing = {
  type: 'projectile_homing',
  description: 'Spawn homing projectile',
  execute: function executeHoming(_config, context) {
    if (!GameHitscan || !GameHitscan.fire) return false;
    return GameHitscan.fire(context.camera, context.onHit || null, context.onMiss || null);
  }
};

GameWeaponBehaviors.register = function register(type, behavior) {
  if (!type || !behavior || typeof behavior.execute !== 'function') return false;
  behaviors[type] = behavior;
  if (!behavior.type) behavior.type = type;
  return true;
};

GameWeaponBehaviors.get = function get(type) {
  return behaviors[type] || null;
};

GameWeaponBehaviors.getAll = function getAll() {
  var out = {};
  for (var key in behaviors) {
    if (Object.prototype.hasOwnProperty.call(behaviors, key)) {
      out[key] = behaviors[key];
    }
  }
  return out;
};

GameWeaponBehaviors.resolve = function resolve(weaponId) {
  var stats = gameplayTuning && gameplayTuning.weaponStats ? gameplayTuning.weaponStats : {};
  var config = stats[weaponId];
  if (!config) return null;
  var primitiveType = config.primitiveType || 'hitscan_single';
  var behavior = behaviors[primitiveType] || null;
  return { config: config, behavior: behavior };
};

GameWeaponBehaviors.fire = function fire(weaponId, context) {
  var resolved = GameWeaponBehaviors.resolve(weaponId);
  if (!resolved || !resolved.behavior) return false;

  var now = performance.now();
  var cooldownMs = Number(resolved.config.cooldownMs || 0);
  var last = lastFireTimes[weaponId] || 0;
  if (now - last < cooldownMs) return false;

  lastFireTimes[weaponId] = now;
  return resolved.behavior.execute(resolved.config, context || {});
};
