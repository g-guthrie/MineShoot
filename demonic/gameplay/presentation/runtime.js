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

        function abilitySnapshot() {
            return options.getAbilitySnapshot ? options.getAbilitySnapshot() : {};
        }

        function cameraSnapshot() {
            return options.getCameraSnapshot ? options.getCameraSnapshot() : {};
        }

        function reticleFor(combat, player) {
            var weaponId = String(combat.selectedWeaponId || '');
            if (weaponId === 'shotgun') {
                return {
                    type: 'circle',
                    size: 44,
                    label: 'SHOT SPREAD'
                };
            }
            if (weaponId === 'sniper' && player.adsActive) {
                return {
                    type: 'scope',
                    size: 0,
                    label: 'SNIPER SCOPE'
                };
            }
            return {
                type: 'crosshair',
                size: 18,
                label: 'STANDARD'
            };
        }

        function poseFor(player, combat) {
            if (player.airborne) return 'jump';
            if (player.adsActive) return String(combat.selectedWeaponId || '') === 'sniper' ? 'scope_ads' : 'ads';
            if (player.sprinting) return 'sprint';
            if (player.moving) return 'move';
            return 'idle';
        }

        return {
            update: function (_dt) {},
            getSnapshot: function () {
                var player = playerSnapshot();
                var combat = combatSnapshot();
                var abilities = abilitySnapshot();
                var camera = cameraSnapshot();
                return {
                    pose: poseFor(player, combat),
                    reticle: reticleFor(combat, player),
                    adsState: {
                        weaponId: String(combat.selectedWeaponId || ''),
                        active: !!player.adsActive,
                        scopeBlend: Number(camera.scopeBlend || 0),
                        scopeActive: String(combat.selectedWeaponId || '') === 'sniper' && !!player.adsActive
                    },
                    weaponPresentation: {
                        weaponId: String(combat.selectedWeaponId || ''),
                        recoilKick: Number(camera.recoilKick || 0),
                        ammoInMag: Number(combat.ammoInMag || 0)
                    },
                    abilityPresentation: {
                        slot1Active: !!(abilities.lastCast && abilities.lastCast.slot === 'slot1'),
                        slot2Active: !!(abilities.lastCast && abilities.lastCast.slot === 'slot2')
                    }
                };
            }
        };
    }

    demonicRuntime.GamePresentationRuntime = {
        create: create
    };
})();
