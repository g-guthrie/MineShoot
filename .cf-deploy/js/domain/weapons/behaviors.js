(function () {
    'use strict';

    var GameWeaponBehaviors = {};

    var behaviors = {};

    function sharedTuning() {
        return (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning)
            ? globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning
            : null;
    }

    behaviors.hitscan_single = {
        type: 'hitscan_single',
        description: 'Single raycast from camera',
        execute: function (config, context) {
            var hitscan = globalThis.__MAYHEM_RUNTIME.GameHitscan;
            if (!hitscan || !hitscan.fire) return false;
            return hitscan.fire(context.camera, context.onHit || null, context.onMiss || null);
        }
    };

    behaviors.hitscan_multi = {
        type: 'hitscan_multi',
        description: 'Multiple raycasts (shotgun pattern)',
        execute: function (config, context) {
            var hitscan = globalThis.__MAYHEM_RUNTIME.GameHitscan;
            if (!hitscan || !hitscan.fire) return false;
            return hitscan.fire(context.camera, context.onHit || null, context.onMiss || null);
        }
    };

    behaviors.projectile_homing = {
        type: 'projectile_homing',
        description: 'Spawn homing projectile',
        execute: function (config, context) {
            var hitscan = globalThis.__MAYHEM_RUNTIME.GameHitscan;
            if (!hitscan || !hitscan.fire) return false;
            return hitscan.fire(context.camera, context.onHit || null, context.onMiss || null);
        }
    };

    var lastFireTimes = {};

    GameWeaponBehaviors.register = function (type, behavior) {
        if (!type || !behavior || typeof behavior.execute !== 'function') return false;
        behaviors[type] = behavior;
        if (!behavior.type) behavior.type = type;
        return true;
    };

    GameWeaponBehaviors.get = function (type) {
        return behaviors[type] || null;
    };

    GameWeaponBehaviors.getAll = function () {
        var out = {};
        for (var key in behaviors) {
            if (Object.prototype.hasOwnProperty.call(behaviors, key)) {
                out[key] = behaviors[key];
            }
        }
        return out;
    };

    GameWeaponBehaviors.resolve = function (weaponId) {
        var tuning = sharedTuning();
        var stats = tuning && tuning.weaponStats ? tuning.weaponStats : {};
        var config = stats[weaponId];
        if (!config) return null;
        var primitiveType = config.primitiveType || 'hitscan_single';
        var behavior = behaviors[primitiveType] || null;
        return { config: config, behavior: behavior };
    };

    GameWeaponBehaviors.fire = function (weaponId, context) {
        var resolved = GameWeaponBehaviors.resolve(weaponId);
        if (!resolved || !resolved.behavior) return false;

        var now = performance.now();
        var cooldownMs = Number(resolved.config.cooldownMs || 0);
        var last = lastFireTimes[weaponId] || 0;
        if (now - last < cooldownMs) return false;

        lastFireTimes[weaponId] = now;
        return resolved.behavior.execute(resolved.config, context || {});
    };

    globalThis.__MAYHEM_RUNTIME.GameWeaponBehaviors = GameWeaponBehaviors;
})();
