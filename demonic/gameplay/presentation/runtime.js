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

        function abilityPose(abilities) {
            if (abilities.activeStates && abilities.activeStates.slot1) {
                return String(abilities.activeStates.slot1.abilityId || '') === 'heal'
                    ? 'ability_heal'
                    : 'ability_slot1';
            }
            if (abilities.activeStates && abilities.activeStates.slot2) {
                return String(abilities.activeStates.slot2.abilityId || '') === 'deadeye'
                    ? 'ability_deadeye'
                    : 'ability_slot2';
            }
            return '';
        }

        return {
            update: function (_dt) {},
            getSnapshot: function () {
                var player = playerSnapshot();
                var combat = combatSnapshot();
                var abilities = abilitySnapshot();
                var camera = cameraSnapshot();
                var basePose = poseFor(player, combat);
                var overlayPose = abilityPose(abilities);
                return {
                    pose: overlayPose || basePose,
                    basePose: basePose,
                    overlayPose: overlayPose,
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
                        slot2Active: !!(abilities.lastCast && abilities.lastCast.slot === 'slot2'),
                        slot1AbilityId: String(abilities.activeStates && abilities.activeStates.slot1 && abilities.activeStates.slot1.abilityId || ''),
                        slot2AbilityId: String(abilities.activeStates && abilities.activeStates.slot2 && abilities.activeStates.slot2.abilityId || '')
                    }
                };
            }
        };
    }

    demonicRuntime.GamePresentationRuntime = {
        create: create
    };
})();
