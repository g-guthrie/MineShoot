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
        return net && net.commands ? net.commands : net;
    }

    function committedLoadout() {
        var loadoutState = loadoutStateApi();
        return loadoutState && loadoutState.getCommittedLoadout
            ? loadoutState.getCommittedLoadout()
            : {
                weaponSlots: ['', ''],
                selectedAbilityId: '',
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

        if (runtime.GameHitscan && runtime.GameHitscan.setWeaponOrder && hasCompleteWeaponLoadout) {
            runtime.GameHitscan.setWeaponOrder(validSlots);
        }
        if (runtime.GamePlayer && runtime.GamePlayer.setLoadout && hasCompleteWeaponLoadout) {
            runtime.GamePlayer.setLoadout({ slots: validSlots });
        }
        if (runtime.GameThrowables && runtime.GameThrowables.setSelectedThrowable && committed.selectedThrowableId) {
            runtime.GameThrowables.setSelectedThrowable(committed.selectedThrowableId);
        }
        if (runtime.GameAbilities && runtime.GameAbilities.setLoadout) {
            runtime.GameAbilities.setLoadout(committed.selectedAbilityId || '');
            if (runtime.GameUI && runtime.GameUI.updateAbilityInfo && runtime.GameAbilities.getHudState) {
                runtime.GameUI.updateAbilityInfo(runtime.GameAbilities.getHudState());
            }
        }
        if (multiplayerMode && commands && commands.sendWeaponLoadout && hasCompleteWeaponLoadout) {
            commands.sendWeaponLoadout(weaponSlots[0] || '', weaponSlots[1] || '');
        }
        if (multiplayerMode && commands && commands.sendAbilityLoadout) {
            commands.sendAbilityLoadout(committed.selectedAbilityId || '');
        }

        return committed;
    };

    runtime.GameLoadoutRuntimeSync = GameLoadoutRuntimeSync;
})();
