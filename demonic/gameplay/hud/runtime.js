(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create(options) {
        options = options || {};

        function combatSnapshot() {
            return options.getCombatSnapshot ? options.getCombatSnapshot() : {};
        }

        function abilitySnapshot() {
            return options.getAbilitySnapshot ? options.getAbilitySnapshot() : {};
        }

        function playerSnapshot() {
            return options.getPlayerSnapshot ? options.getPlayerSnapshot() : {};
        }

        function cooldownStatus(combat) {
            if (Number(combat.reloadRemainingMs || 0) > 0) {
                return {
                    status: 'reloading',
                    ms: Number(combat.reloadRemainingMs || 0)
                };
            }
            if (Number(combat.fireCooldownRemainingMs || 0) > 0) {
                return {
                    status: 'cooldown',
                    ms: Number(combat.fireCooldownRemainingMs || 0)
                };
            }
            return {
                status: 'ready',
                ms: 0
            };
        }

        return {
            update: function (_dt) {},
            getSnapshot: function () {
                var combat = combatSnapshot();
                var abilities = abilitySnapshot();
                var player = playerSnapshot();
                var cooldown = cooldownStatus(combat);
                var slot1Active = !!(abilities.hud && abilities.hud.slot1Active);
                var slot2Active = !!(abilities.hud && abilities.hud.slot2Active);
                return {
                    weaponInfo: String(combat.selectedWeaponId || '').toUpperCase() +
                        ' :: ' + Number(combat.ammoInMag || 0) + '/' + Number(combat.magazineSize || 0),
                    abilityInfo: String(abilities.hud && abilities.hud.slot1Name || '').toUpperCase() +
                        (slot1Active ? ' [ACTIVE]' : '') +
                        ' / ' + String(abilities.hud && abilities.hud.slot2Name || '').toUpperCase() +
                        (slot2Active ? ' [ACTIVE]' : ''),
                    cooldownStatus: cooldown.status.toUpperCase(),
                    cooldownMs: Number(cooldown.ms || 0),
                    movementInfo: player.sprinting ? 'SPRINT' : (player.adsActive ? 'ADS' : (player.moving ? 'MOVE' : 'IDLE'))
                };
            }
        };
    }

    demonicRuntime.GameHudRuntime = {
        create: create
    };
})();
