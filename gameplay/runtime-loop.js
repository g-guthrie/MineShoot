/**
 * runtime-loop.js - Gameplay-owned frame step for PvP.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameGameplayRuntimeLoop
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameGameplayRuntimeLoop = {};

    GameGameplayRuntimeLoop.create = function (opts) {
        opts = opts || {};

        function step(dt) {
            var net = runtime.GameNet || null;
            var netView = net && net.view ? net.view : null;

            if (runtime.GameWorld && runtime.GameWorld.update) {
                runtime.GameWorld.update(dt);
            }

            runtime.GamePlayer.update(dt);

            var currentWeapon = runtime.GameHitscan.getCurrentWeapon();
            var reticlePreview = (runtime.GameHitscan && runtime.GameHitscan.getReticleTargetPreview)
                ? runtime.GameHitscan.getReticleTargetPreview(opts.getCamera ? opts.getCamera() : null)
                : null;
            if (currentWeapon) {
                if (opts.syncReticleWithWeapon) opts.syncReticleWithWeapon(currentWeapon);
                if (runtime.GameUI && runtime.GameUI.updateWeaponInfo) {
                    runtime.GameUI.updateWeaponInfo(currentWeapon);
                }
            }

            if (runtime.GameUI && runtime.GameUI.updateSprintEffects) {
                var sprintAdsState = runtime.GamePlayer && runtime.GamePlayer.getAdsState
                    ? runtime.GamePlayer.getAdsState()
                    : null;
                var sprintAnimState = runtime.GamePlayer && runtime.GamePlayer.getAnimNetState
                    ? runtime.GamePlayer.getAnimNetState()
                    : null;
                runtime.GameUI.updateSprintEffects({
                    intensity: runtime.GamePlayer && (
                        (runtime.GamePlayer.isSprinting && runtime.GamePlayer.isSprinting()) ||
                        (runtime.GamePlayer.isFastBackpedal && runtime.GamePlayer.isFastBackpedal())
                    )
                        ? Number(sprintAnimState && sprintAnimState.moveSpeedNorm || 0)
                        : 0,
                    adsActive: !!(sprintAdsState && sprintAdsState.active),
                    scopeActive: !!(sprintAdsState && sprintAdsState.scopeActive),
                    sniper: !!(sprintAdsState && sprintAdsState.sniper)
                });
            }

            var shouldAutoFireFromHeldTrigger = !!(
                opts.controlsApi &&
                opts.controlsApi.isTriggerHeld &&
                opts.controlsApi.isTriggerHeld() &&
                opts.hasInputCapture &&
                opts.hasInputCapture() &&
                currentWeapon &&
                currentWeapon.automatic &&
                !runtime.GamePlayer.isSprinting()
            );
            var shouldAutoFireFromReticle = !!(
                opts.hasInputCapture &&
                opts.hasInputCapture() &&
                currentWeapon &&
                reticlePreview &&
                reticlePreview.reticleTarget &&
                reticlePreview.reticleTarget.active &&
                !runtime.GamePlayer.isSprinting() &&
                (!opts.controlsApi || !opts.controlsApi.hasArmedThrowablePreview || !opts.controlsApi.hasArmedThrowablePreview())
            );
            if (shouldAutoFireFromHeldTrigger || shouldAutoFireFromReticle) {
                if (opts.tryPlayerFire) opts.tryPlayerFire();
            }

            if (runtime.GameHitscan.tick) {
                runtime.GameHitscan.tick(dt);
            }
            if (runtime.GameHitscan.updateTracers) {
                runtime.GameHitscan.updateTracers(dt);
            }
            runtime.GamePlayerCombat.tickInvulnTimer(dt);
            runtime.GamePlayerCombat.tickArmorRegen(dt);

            var playerPos = runtime.GamePlayer.getPosition();
            var playerRot = runtime.GamePlayer.getRotation();
            if (opts.controlsApi && opts.controlsApi.updateArmedThrowablePreview) {
                opts.controlsApi.updateArmedThrowablePreview();
            }

            if (net && net.update) {
                net.update(dt, playerPos, playerRot);
            }
            var selfReconciliationState = netView && netView.getSelfReconciliationState
                ? netView.getSelfReconciliationState()
                : null;
            var selfState = netView && netView.getAuthoritativeSelfState
                ? netView.getAuthoritativeSelfState()
                : null;
            var respawnState = netView && netView.getRespawnState
                ? netView.getRespawnState()
                : null;
            if (selfState || respawnState) {
                if (runtime.GameNetSelfSync && runtime.GameNetSelfSync.syncPlayerState) {
                    runtime.GameNetSelfSync.syncPlayerState(selfState, dt, {
                        respawnState: respawnState,
                        reconciliationState: selfReconciliationState
                    });
                }
            }
            var matchContext = opts.readMatchContext ? opts.readMatchContext() : null;
            selfState = matchContext ? matchContext.selfState : selfState;

            if (opts.gameSession && opts.gameSession.syncMatchState) {
                opts.gameSession.syncMatchState(matchContext);
            }

            var notice = netView && netView.consumeNotice ? netView.consumeNotice() : '';
            if (notice && opts.setTransientDebug) opts.setTransientDebug(notice, 900);

            if (runtime.GameNetFeedbackSync && runtime.GameNetFeedbackSync.syncGameplayFeedback) {
                runtime.GameNetFeedbackSync.syncGameplayFeedback({
                    dt: dt,
                    selfState: selfState,
                    camera: opts.getCamera ? opts.getCamera() : null,
                    setTransientDebug: opts.setTransientDebug
                });
            }
            if (opts.syncMatchHud) opts.syncMatchHud(matchContext);

            if (runtime.GamePlayer && runtime.GamePlayer.flushDeferredViewSync) {
                runtime.GamePlayer.flushDeferredViewSync(dt);
            }

            return {
                camera: opts.getCamera ? opts.getCamera() : null,
                dt: dt,
                currentWeapon: currentWeapon,
                playerPos: playerPos,
                playerRot: playerRot,
                multiplayerMode: !!(opts.getMultiplayerMode && opts.getMultiplayerMode()),
                debugVisualsOn: !!(opts.getDebugVisualsOn && opts.getDebugVisualsOn()),
                controlsApi: opts.controlsApi || null
            };
        }

        return {
            step: step
        };
    };

    runtime.GameGameplayRuntimeLoop = GameGameplayRuntimeLoop;
})();
