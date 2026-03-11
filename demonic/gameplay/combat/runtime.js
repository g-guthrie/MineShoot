(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var mayhemRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create(context) {
        var shared = mayhemRuntime.GameShared || {};
        var selectedWeaponId = shared.getSelectableWeaponIds
            ? String((shared.getSelectableWeaponIds()[0] || 'machinegun'))
            : 'machinegun';
        var gameMode = String(context && context.context && context.context.gameMode || 'ffa');
        var catalog = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'];
        var fireCooldownRemainingMs = 0;
        var lastShotAt = 0;

        function weaponStats() {
            return shared.getWeaponStats ? shared.getWeaponStats(selectedWeaponId) : null;
        }

        return {
            update: function (dt) {
                fireCooldownRemainingMs = Math.max(0, fireCooldownRemainingMs - (dt * 1000));
            },
            fire: function () {
                if (fireCooldownRemainingMs > 0) return false;
                var stats = weaponStats() || {};
                fireCooldownRemainingMs = Math.max(0, Number(stats.cooldownMs || 250));
                lastShotAt = Date.now();
                return true;
            },
            setWeapon: function (weaponId) {
                if (catalog.indexOf(String(weaponId || '')) === -1) return false;
                selectedWeaponId = String(weaponId || selectedWeaponId);
                return true;
            },
            getSnapshot: function () {
                return {
                    gameMode: gameMode,
                    selectedWeaponId: selectedWeaponId,
                    weaponCatalog: catalog.slice(),
                    fireCooldownRemainingMs: Number(fireCooldownRemainingMs || 0),
                    lastShotAt: Number(lastShotAt || 0)
                };
            }
        };
    }

    demonicRuntime.GameCombatRuntime = {
        create: create
    };
})();
