(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create() {
        return {
            build: function (weapon) {
                var snapshot = weapon || {};
                var reloadRemaining = Math.max(0, Number(snapshot.reloadRemainingMs || 0));
                var cooldownRemaining = Math.max(0, Number(snapshot.fireCooldownRemainingMs || 0));
                var reloadMs = Math.max(0, Number(snapshot.reloadMs || 0));
                var cooldownMs = Math.max(0, Number(snapshot.cooldownMs || 0));
                if (reloadRemaining > 0) {
                    return {
                        status: 'reloading',
                        ready: false,
                        pct: reloadMs > 0 ? (1 - (reloadRemaining / reloadMs)) : 1
                    };
                }
                if (cooldownRemaining > 0) {
                    return {
                        status: 'cooldown',
                        ready: false,
                        pct: cooldownMs > 0 ? (1 - (cooldownRemaining / cooldownMs)) : 1
                    };
                }
                return {
                    status: 'ready',
                    ready: true,
                    pct: 1
                };
            }
        };
    }

    demonicRuntime.GameCombatHudState = {
        create: create
    };
})();
