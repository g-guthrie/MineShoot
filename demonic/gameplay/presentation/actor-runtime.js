(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create(options) {
        options = options || {};

        function playerSnapshot() {
            return options.getPlayerSnapshot ? options.getPlayerSnapshot() : {};
        }

        function combatSnapshot() {
            return options.getCombatSnapshot ? options.getCombatSnapshot() : {};
        }

        function presentationSnapshot() {
            return options.getPresentationSnapshot ? options.getPresentationSnapshot() : {};
        }

        return {
            update: function (_dt) {},
            getSnapshot: function () {
                var player = playerSnapshot();
                var combat = combatSnapshot();
                var presentation = presentationSnapshot();

                return {
                    stance: String(presentation.pose || 'idle'),
                    weaponId: String(combat.selectedWeaponId || ''),
                    ammoInMag: Number(combat.ammoInMag || 0),
                    magazineSize: Number(combat.magazineSize || 0),
                    adsActive: !!(presentation.adsState && presentation.adsState.active),
                    sprinting: !!player.sprinting,
                    airborne: !!player.airborne,
                    moving: !!player.moving
                };
            }
        };
    }

    demonicRuntime.GameActorRuntime = {
        create: create
    };
})();
