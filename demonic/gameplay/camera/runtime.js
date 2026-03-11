(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var mayhemRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function adsFovForWeapon(weaponId) {
        var shared = mayhemRuntime.GameShared || {};
        var stats = shared.getWeaponStats ? shared.getWeaponStats(weaponId) : null;
        if (shared.resolveWeaponAdsFovDeg) {
            return Number(shared.resolveWeaponAdsFovDeg(stats || { id: weaponId }) || 56);
        }
        return weaponId === 'sniper' ? 24 : 56;
    }

    function create(options) {
        options = options || {};
        var scopeBlend = 0;
        var sprintBlend = 0;
        var recoilKick = 0;
        var currentFov = 75;

        function playerSnapshot() {
            return options.getPlayerSnapshot ? options.getPlayerSnapshot() : {};
        }

        function combatSnapshot() {
            return options.getCombatSnapshot ? options.getCombatSnapshot() : {};
        }

        return {
            update: function (dt) {
                var player = playerSnapshot();
                var combat = combatSnapshot();
                var targetScope = player.adsActive ? 1 : 0;
                var targetSprint = (!player.adsActive && player.sprinting) ? 1 : 0;

                scopeBlend += (targetScope - scopeBlend) * Math.min(1, dt * 16);
                sprintBlend += (targetSprint - sprintBlend) * Math.min(1, dt * 10);
                recoilKick += (0 - recoilKick) * Math.min(1, dt * 18);

                var adsFov = adsFovForWeapon(combat.selectedWeaponId || 'rifle');
                currentFov += (((75 + (75 * 0.04 * sprintBlend)) + ((adsFov - 75) * scopeBlend)) - currentFov) * Math.min(1, dt * 16);
            },
            addFireKick: function (amount) {
                recoilKick += Number(amount || 0);
            },
            getSnapshot: function () {
                return {
                    fov: Number(currentFov || 75),
                    scopeBlend: Number(scopeBlend || 0),
                    sprintBlend: Number(sprintBlend || 0),
                    recoilKick: Number(recoilKick || 0)
                };
            }
        };
    }

    demonicRuntime.GameCameraRuntime = {
        create: create
    };
})();
