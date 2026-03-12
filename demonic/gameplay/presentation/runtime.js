(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create(options) {
        options = options || {};
        var reticleApi = demonicRuntime.GameReticleRuntime || null;
        var reticleRuntime = reticleApi && reticleApi.create ? reticleApi.create(options) : null;

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

        function weaponFeedbackSnapshot() {
            return options.getWeaponFeedbackSnapshot ? options.getWeaponFeedbackSnapshot() : {};
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
                var id = String(abilities.activeStates.slot1.abilityId || '');
                if (id === 'heal') return 'ability_heal';
                if (id === 'deadeye') return 'ability_deadeye';
                if (id === 'choke') return 'ability_choke';
                if (id === 'hook') return 'ability_hook';
                if (id === 'missile') return 'ability_missile';
                return 'ability_slot1';
            }
            if (abilities.activeStates && abilities.activeStates.slot2) {
                var slot2Id = String(abilities.activeStates.slot2.abilityId || '');
                if (slot2Id === 'heal') return 'ability_heal';
                if (slot2Id === 'deadeye') return 'ability_deadeye';
                if (slot2Id === 'choke') return 'ability_choke';
                if (slot2Id === 'hook') return 'ability_hook';
                if (slot2Id === 'missile') return 'ability_missile';
                return 'ability_slot2';
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
                var feedback = weaponFeedbackSnapshot();
                var basePose = poseFor(player, combat);
                var overlayPose = abilityPose(abilities);
                var reticle = reticleRuntime && reticleRuntime.resolve
                    ? reticleRuntime.resolve(combat, player, abilities, camera)
                    : { type: 'crosshair', width: 18, height: 18, label: 'STANDARD' };
                return {
                    pose: overlayPose || basePose,
                    basePose: basePose,
                    overlayPose: overlayPose,
                    reticle: reticle,
                    adsState: {
                        weaponId: String(combat.selectedWeaponId || ''),
                        active: !!player.adsActive,
                        scopeBlend: Number(camera.scopeBlend || 0),
                        scopeActive: String(combat.selectedWeaponId || '') === 'sniper' && !!player.adsActive
                    },
                    weaponPresentation: {
                        weaponId: String(combat.selectedWeaponId || ''),
                        recoilKick: Number(camera.recoilKick || 0),
                        ammoInMag: Number(combat.ammoInMag || 0),
                        gunKick: Number(feedback.gunKick || 0),
                        armKick: Number(feedback.armKick || 0),
                        muzzleVisible: !!feedback.muzzleVisible
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
