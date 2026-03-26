/**
 * runtime-loop.js - Presentation-owned frame rendering for PvP.
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

            var reticlePreview = (runtime.GameHitscan && runtime.GameHitscan.getReticleTargetPreview)
                ? runtime.GameHitscan.getReticleTargetPreview(camera)
                : null;
            var currentAimTargetId = reticlePreview && reticlePreview.currentAimTargetId
                ? reticlePreview.currentAimTargetId
                : '';

            if (runtime.GameUI && runtime.GameUI.setReticleTargetState) {
                runtime.GameUI.setReticleTargetState(
                    reticlePreview && reticlePreview.reticleTarget ? reticlePreview.reticleTarget.group : 'crosshair',
                    !!(reticlePreview && reticlePreview.reticleTarget && reticlePreview.reticleTarget.active)
                );
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
