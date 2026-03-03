(function () {
    'use strict';

    var GameWeaponRegistry = {};

    function sharedTuning() {
        return (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning) ? globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning : null;
    }

    function buildEntries() {
        var tuning = sharedTuning();
        var stats = tuning && tuning.weaponStats ? tuning.weaponStats : {};
        return {
            rifle: { family: 'hitscan', stats: stats.rifle || null },
            pistol: { family: 'hitscan', stats: stats.pistol || null },
            machinegun: { family: 'hitscan', stats: stats.machinegun || null },
            shotgun: { family: 'hitscan', stats: stats.shotgun || null },
            sniper: { family: 'hitscan', stats: stats.sniper || null },
            plasma: { family: 'plasmaBeam', stats: stats.plasma || null },
            seekergun: { family: 'seekerProjectile', stats: stats.seekergun || null }
        };
    }

    GameWeaponRegistry.get = function (weaponId) {
        var entries = buildEntries();
        return entries[weaponId] || null;
    };

    GameWeaponRegistry.getAll = function () {
        return buildEntries();
    };

    globalThis.__MAYHEM_RUNTIME.GameWeaponRegistry = GameWeaponRegistry;
})();
