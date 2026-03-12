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
        var feel = demonicRuntime.FeelTuning || {
            camera: {
                cameraFov: 75,
                thirdHeight: 0.7,
                cameraDist: 4.4 * 0.85,
                cameraShoulder: 1.35 * 1.3,
                adsDist: 1.72,
                adsShoulder: 2,
                adsHeight: 0.46,
                sniperScopeDist: 0.14,
                sniperScopeShoulder: 0.08,
                sniperScopeHeight: 0.12
            }
        };
        var cameraFeel = feel.camera || {};
        var scopeBlend = 0;
        var sprintBlend = 0;
        var recoilKick = 0;
        var currentFov = Number(cameraFeel.cameraFov || 75);
        var cameraPosition = { x: 0, y: 0, z: 0 };
        var lookTarget = { x: 0, y: 0, z: 0 };
        var THIRD_HEIGHT = Number(cameraFeel.thirdHeight || 0.7);
        var CAMERA_DIST = Number(cameraFeel.cameraDist || (4.4 * 0.85));
        var CAMERA_SHOULDER = Number(cameraFeel.cameraShoulder || (1.35 * 1.3));
        var ADS_DIST = Number(cameraFeel.adsDist || 1.72);
        var ADS_SHOULDER = Number(cameraFeel.adsShoulder || 2);
        var ADS_HEIGHT = Number(cameraFeel.adsHeight || 0.46);
        var SNIPER_SCOPE_DIST = Number(cameraFeel.sniperScopeDist || 0.14);
        var SNIPER_SCOPE_SHOULDER = Number(cameraFeel.sniperScopeShoulder || 0.08);
        var SNIPER_SCOPE_HEIGHT = Number(cameraFeel.sniperScopeHeight || 0.12);

        function playerSnapshot() {
            return options.getPlayerSnapshot ? options.getPlayerSnapshot() : {};
        }

        function combatSnapshot() {
            return options.getCombatSnapshot ? options.getCombatSnapshot() : {};
        }

        function weaponFeedbackSnapshot() {
            return options.getWeaponFeedbackSnapshot ? options.getWeaponFeedbackSnapshot() : {};
        }

        return {
            update: function (dt) {
                var player = playerSnapshot();
                var combat = combatSnapshot();
                var feedback = weaponFeedbackSnapshot();
                var targetScope = player.adsActive ? 1 : 0;
                var targetSprint = (!player.adsActive && player.sprinting) ? 1 : 0;

                scopeBlend += (targetScope - scopeBlend) * Math.min(1, dt * 16);
                sprintBlend += (targetSprint - sprintBlend) * Math.min(1, dt * 10);
                recoilKick += (0 - recoilKick) * Math.min(1, dt * 18);
                recoilKick += Number(feedback.cameraPitchKick || 0);

                var adsFov = adsFovForWeapon(combat.selectedWeaponId || 'rifle');
                var baseFov = Number(cameraFeel.cameraFov || 75);
                currentFov += (((baseFov + (baseFov * 0.04 * sprintBlend)) + ((adsFov - baseFov) * scopeBlend)) - currentFov) * Math.min(1, dt * 16);

                var yaw = Number(player.yaw || 0);
                var pitch = Number(player.pitch || 0);
                var cosPitch = Math.cos(pitch);
                var forwardX = -Math.sin(yaw) * cosPitch;
                var forwardY = Math.sin(pitch);
                var forwardZ = -Math.cos(yaw) * cosPitch;
                var rightX = Math.cos(yaw);
                var rightZ = -Math.sin(yaw);
                var sniperMode = String(combat.selectedWeaponId || '') === 'sniper';

                var baseX = Number(player.x || 0);
                var baseY = Number(player.y || 0);
                var baseZ = Number(player.z || 0);
                var thirdX = baseX + (rightX * CAMERA_SHOULDER) - (forwardX * CAMERA_DIST);
                var thirdY = baseY + THIRD_HEIGHT;
                var thirdZ = baseZ + (rightZ * CAMERA_SHOULDER) - (forwardZ * CAMERA_DIST);
                var adsShoulder = sniperMode ? SNIPER_SCOPE_SHOULDER : ADS_SHOULDER;
                var adsDist = sniperMode ? SNIPER_SCOPE_DIST : ADS_DIST;
                var adsHeight = sniperMode ? SNIPER_SCOPE_HEIGHT : ADS_HEIGHT;
                var adsX = baseX + (rightX * adsShoulder) - (forwardX * adsDist);
                var adsY = baseY + adsHeight;
                var adsZ = baseZ + (rightZ * adsShoulder) - (forwardZ * adsDist);

                cameraPosition.x = thirdX + ((adsX - thirdX) * scopeBlend);
                cameraPosition.y = thirdY + ((adsY - thirdY) * scopeBlend);
                cameraPosition.z = thirdZ + ((adsZ - thirdZ) * scopeBlend);
                lookTarget.x = baseX + forwardX * 20;
                lookTarget.y = baseY + forwardY * 20;
                lookTarget.z = baseZ + forwardZ * 20;
            },
            getSnapshot: function () {
                return {
                    fov: Number(currentFov || 75),
                    scopeBlend: Number(scopeBlend || 0),
                    sprintBlend: Number(sprintBlend || 0),
                    recoilKick: Number(recoilKick || 0),
                    position: {
                        x: Number(cameraPosition.x || 0),
                        y: Number(cameraPosition.y || 0),
                        z: Number(cameraPosition.z || 0)
                    },
                    target: {
                        x: Number(lookTarget.x || 0),
                        y: Number(lookTarget.y || 0),
                        z: Number(lookTarget.z || 0)
                    }
                };
            }
        };
    }

    demonicRuntime.GameCameraRuntime = {
        create: create
    };
})();
