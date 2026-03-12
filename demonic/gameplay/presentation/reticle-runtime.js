(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function deadeyeLabel(active) {
        var meta = active && active.meta ? active.meta : {};
        return 'DEADEYE ' + Number(meta.lockCount || 0) + '/' + Number(meta.maxLocks || 0);
    }

    function reticleForWeapon(combat, player) {
        var weaponId = String(combat.selectedWeaponId || '');
        if (weaponId === 'shotgun' || (weaponId === 'pistol' && Number(combat.pellets || 0) > 1)) {
            return {
                type: 'circle',
                width: 280,
                height: 280,
                label: 'SHOT SPREAD'
            };
        }
        if (weaponId === 'sniper' && !!player.adsActive) {
            return {
                type: 'scope',
                width: 0,
                height: 0,
                label: 'SNIPER SCOPE'
            };
        }
        return {
            type: 'crosshair',
            width: 18,
            height: 18,
            label: 'STANDARD'
        };
    }

    function create() {
        var previewApi = demonicRuntime.GameAbilityPreviewRuntime || null;
        var previewRuntime = previewApi && previewApi.create ? previewApi.create() : null;
        return {
            resolve: function (combat, player, abilities, camera) {
                var active = abilities && abilities.activeStates
                    ? (abilities.activeStates.slot1 || abilities.activeStates.slot2 || null)
                    : null;
                return (previewRuntime && previewRuntime.resolve ? previewRuntime.resolve(active, camera || {}) : null) ||
                    reticleForWeapon(combat || {}, player || {});
            }
        };
    }

    demonicRuntime.GameReticleRuntime = {
        create: create
    };
})();
