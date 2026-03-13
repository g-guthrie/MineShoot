/**
 * runtime-loop.js - Presentation-owned frame rendering for Mayhem.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePresentationRuntimeLoop
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GamePresentationRuntimeLoop = {};

    GamePresentationRuntimeLoop.create = function (opts) {
        opts = opts || {};

        function renderFrame(frame) {
            frame = frame || {};
            var camera = frame.camera || (opts.getCamera ? opts.getCamera() : null);
            var currentWeapon = frame.currentWeapon || null;
            var controlsApi = frame.controlsApi || opts.controlsApi || null;

            if ((!controlsApi || !controlsApi.hasArmedThrowablePreview || !controlsApi.hasArmedThrowablePreview()) &&
                runtime.GameUI && runtime.GameUI.updateTrackingReticle) {
                runtime.GameUI.updateTrackingReticle(false, false);
            }

            var currentAimTargetId = '';
            var centerTarget = runtime.GameHitscan.peekCenterTarget(camera);
            var areaTarget = (currentWeapon && currentWeapon.autoLock && runtime.GameHitscan.peekAutoLockTarget)
                ? runtime.GameHitscan.peekAutoLockTarget(camera)
                : null;
            if (currentWeapon && currentWeapon.autoLock) {
                if (areaTarget && areaTarget.targetId) currentAimTargetId = areaTarget.targetId;
            } else if (centerTarget && centerTarget.targetId) {
                currentAimTargetId = centerTarget.targetId;
            }

            if (runtime.GameUI && runtime.GameUI.setHitscanTargetState) {
                runtime.GameUI.setHitscanTargetState(!!(
                    currentWeapon &&
                    currentWeapon.id !== 'shotgun' &&
                    !currentWeapon.autoLock &&
                    !currentWeapon.singleHitFromPellets &&
                    centerTarget &&
                    centerTarget.hitbox
                ));
            }
            if (runtime.GameUI && runtime.GameUI.setShotgunTargetState) {
                runtime.GameUI.setShotgunTargetState(!!(
                    currentWeapon &&
                    (((currentWeapon.id === 'shotgun' || currentWeapon.singleHitFromPellets) && centerTarget && centerTarget.hitbox) ||
                        (currentWeapon.autoLock && areaTarget && areaTarget.hitbox))
                ));
            }

            runtime.GameOverhead.update(camera, frame.playerPos, currentAimTargetId);
            if (runtime.GameUI.updateCombatRadar || runtime.GameUI.updateCombatBeacons) {
                var awarenessState = runtime.GameAwareness.buildState(frame.playerPos, frame.playerRot ? frame.playerRot.yaw : 0);
                if (runtime.GameUI.updateCombatRadar) {
                    runtime.GameUI.updateCombatRadar(awarenessState);
                }
                if (runtime.GameUI.updateCombatBeacons) {
                    runtime.GameUI.updateCombatBeacons(awarenessState.beacons);
                }
            }

            if (runtime.GameGameplayHudSync && runtime.GameGameplayHudSync.update) {
                runtime.GameGameplayHudSync.update({
                    camera: camera,
                    dt: frame.dt,
                    multiplayerMode: !!frame.multiplayerMode,
                    debugVisualsOn: !!frame.debugVisualsOn
                });
            }
            if (runtime.GameHookVisuals && runtime.GameHookVisuals.render) {
                runtime.GameHookVisuals.render(!!frame.multiplayerMode);
            }

            camera.layers.set(0);
            if (opts.getRenderer && opts.getScene) {
                opts.getRenderer().render(opts.getScene(), camera);
            }
        }

        return {
            renderFrame: renderFrame
        };
    };

    runtime.GamePresentationRuntimeLoop = GamePresentationRuntimeLoop;
})();
