/**
 * loadout-runtime-sync.js - Applies the committed loadout to gameplay and networking.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLoadoutRuntimeSync
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameLoadoutRuntimeSync = {};

    function loadoutStateApi() {
        return runtime.GameLoadoutState || null;
    }

    function networkCommandApi() {
        var net = runtime.GameNet || null;
        return net && net.commands ? net.commands : null;
    }

    function committedLoadout() {
        var loadoutState = loadoutStateApi();
        return loadoutState && loadoutState.getCommittedLoadout
            ? loadoutState.getCommittedLoadout()
            : {
                weaponSlots: ['', ''],
                selectedThrowableId: ''
            };
    }

    GameLoadoutRuntimeSync.applyCommittedLoadout = function (multiplayerMode) {
        var committed = committedLoadout();
        var weaponSlots = Array.isArray(committed.weaponSlots)
            ? committed.weaponSlots.slice(0, 2)
            : ['', ''];
        var validSlots = weaponSlots.filter(Boolean);
        var hasCompleteWeaponLoadout = !!(weaponSlots[0] && weaponSlots[1]);
        var commands = networkCommandApi();

        if (multiplayerMode && hasCompleteWeaponLoadout) {
            if (!commands || !commands.sendWeaponLoadout) return committed;
            if (!commands.sendWeaponLoadout(weaponSlots[0] || '', weaponSlots[1] || '')) return committed;
        }

        if (runtime.GameHitscan && runtime.GameHitscan.setWeaponOrder && hasCompleteWeaponLoadout) {
            runtime.GameHitscan.setWeaponOrder(validSlots);
        }
        if (runtime.GamePlayer && runtime.GamePlayer.setLoadout && hasCompleteWeaponLoadout) {
            runtime.GamePlayer.setLoadout({ slots: validSlots });
        }
        if (runtime.GameThrowables && runtime.GameThrowables.setSelectedThrowable && committed.selectedThrowableId) {
            runtime.GameThrowables.setSelectedThrowable(committed.selectedThrowableId);
        }
        return committed;
    };

    runtime.GameLoadoutRuntimeSync = GameLoadoutRuntimeSync;
})();
