/**
 * remote-sync.js - Applies remote entity presentation updates each frame.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetRemoteSync
 */
(function () {
    'use strict';

    function interpApi() {
        return (globalThis.__MAYHEM_RUNTIME || {}).GameNetInterpolation || {};
    }
    function normalizeAngle(rad) { return interpApi().normalizeAngle ? interpApi().normalizeAngle(rad) : rad; }
    function clamp(value, min, max) { return interpApi().clamp ? interpApi().clamp(value, min, max) : Math.max(min, Math.min(max, value)); }
    function lerpAngle(a, b, t) {
        return interpApi().lerpAngle
            ? interpApi().lerpAngle(a, b, t)
            : (Number(a || 0) + (normalizeAngle(Number(b || 0) - Number(a || 0)) * t));
    }
    function frameRateIndependentAlpha(dt, remainingPerSecond) {
        return interpApi().frameRateIndependentAlpha
            ? interpApi().frameRateIndependentAlpha(dt, remainingPerSecond)
            : Math.min(1, Math.max(0, Number(dt || 0)) * 10);
    }
    function blendTransforms(from, to, t) {
        return interpApi().blendTransforms ? interpApi().blendTransforms(from, to, t) : to;
    }
    function cloneTransform(value) {
        return interpApi().cloneTransform ? interpApi().cloneTransform(value) : value;
    }
    function easeOutCubic(t) {
        return interpApi().easeOutCubic ? interpApi().easeOutCubic(t) : t;
    }

    function durationBlendAlpha(dtSec, blendMs) {
        var dtMs = Math.max(0, Number(dtSec || 0) * 1000);
        var durationMs = Math.max(1, Number(blendMs || 1));
        return clamp(1 - Math.exp(-dtMs / durationMs), 0, 1);
    }

    function smoothPresentationValue(render, key, targetValue, alpha) {
        var target = Number(targetValue || 0);
        var current = Number(render[key]);
        if (!isFinite(current)) current = target;
        current += (target - current) * clamp(Number(alpha || 0), 0, 1);
        render[key] = current;
        return current;
    }

    function smoothPresentationFlag(render, key, targetValue, alpha) {
        var target = targetValue ? 1 : 0;
        var current = Number(render[key]);
        if (!isFinite(current)) current = target;
        current += (target - current) * clamp(Number(alpha || 0), 0, 1);
        render[key] = current;
        return current >= 0.5;
    }

    function remoteInterpolationTuning() {
        return interpApi().readInterpolationTuning ? interpApi().readInterpolationTuning() : {};
    }

    function authoritativeNowMs() {
        var runtime = globalThis.__MAYHEM_RUNTIME || {};
        var net = runtime.GameNet || null;
        var timingApi = net && net.timing ? net.timing : null;
        var stamp = timingApi && timingApi.getAuthoritativeNow
            ? Number(timingApi.getAuthoritativeNow() || 0)
            : 0;
        return stamp > 0 ? stamp : Date.now();
    }

    function sharedWeaponStatsFor(weaponId) {
        var runtime = globalThis.__MAYHEM_RUNTIME || {};
        var shared = runtime.GameShared || {};
        if (shared.getWeaponStats) {
            var stats = shared.getWeaponStats(weaponId);
            if (stats) return stats;
        }
        var gameplayTuning = shared.gameplayTuning || {};
        var weaponStats = gameplayTuning.weaponStats || {};
        return weaponStats[String(weaponId || '')] || null;
    }

    function sharedMovementTuning() {
        var runtime = globalThis.__MAYHEM_RUNTIME || {};
        var shared = runtime.GameShared || {};
        if (shared.getMovementTuning) {
            return shared.getMovementTuning() || {};
        }
        return (shared.gameplayTuning && shared.gameplayTuning.movement) || {};
    }

    function effectiveRunSpeedForWeapon(weaponId) {
        var movement = sharedMovementTuning();
        var weaponStats = sharedWeaponStatsFor(weaponId);
        var baseRunSpeed = Number(movement.runSpeed || 11);
        var moveSpeedMultiplier = Math.max(0.1, Number(weaponStats && weaponStats.moveSpeedMultiplier || 1));
        return baseRunSpeed * moveSpeedMultiplier;
    }

    function interpolateBufferedTransform(render, nowMs, options) {
        var api = interpApi();
        if (api.interpolateBufferedTransform) {
            return api.interpolateBufferedTransform(render, nowMs, options);
        }
        return null;
    }

    function updateRemoteEntities(dt, renderMap, getChokeVictimStateForEntity) {
        if (!renderMap || !renderMap.forEach) return;
        var nowMs = Date.now();
        var serverNowMs = authoritativeNowMs();
        var interpolationTuning = remoteInterpolationTuning();
        renderMap.forEach(function (r) {
            if (!r || !r.group || !r.group.position || !r.group.rotation) return;
            var bufferedTransform = interpolateBufferedTransform(r, nowMs);
            var presentState = bufferedTransform ? cloneTransform(bufferedTransform) : null;
            if (presentState && r.freezeBlendFrom && Number(r.freezeBlendStartAt || 0) > 0) {
                var freezeBlendDurationMs = Math.max(
                    1,
                    Number(r.freezeBlendDurationMs || interpolationTuning.freezeRecoveryBlendMs || 48)
                );
                var freezeBlendT = clamp((nowMs - Number(r.freezeBlendStartAt || 0)) / freezeBlendDurationMs, 0, 1);
                presentState = blendTransforms(r.freezeBlendFrom, presentState, easeOutCubic(freezeBlendT));
                if (freezeBlendT >= 1) {
                    r.freezeBlendFrom = null;
                    r.freezeBlendStartAt = 0;
                }
            }

            var fallbackAlpha = frameRateIndependentAlpha(
                dt,
                Number(interpolationTuning.fallbackCatchupRemainingPerSecond || 0.001)
            );
            var nextX = presentState
                ? Number(presentState.x || 0)
                : (r.group.position.x + (r.targetX - r.group.position.x) * fallbackAlpha);
            var nextY = presentState
                ? Number(presentState.footY || 0)
                : (r.group.position.y + ((r.targetFootY || 0) - r.group.position.y) * fallbackAlpha);
            var nextZ = presentState
                ? Number(presentState.z || 0)
                : (r.group.position.z + (r.targetZ - r.group.position.z) * fallbackAlpha);
            var renderYaw = presentState ? Number(presentState.yaw || 0) : Number(r.targetYaw || 0);
            var renderPitch = presentState ? Number(presentState.pitch || 0) : Number(r.targetPitch || 0);
            var nextYaw = presentState
                ? renderYaw
                : lerpAngle(r.group.rotation.y, renderYaw, fallbackAlpha);
            if (!presentState) presentState = r;
            var animationBlendMs = Math.max(1, Number(interpolationTuning.animationStateBlendMs || 120));
            var animationAlpha = durationBlendAlpha(dt, animationBlendMs);
            var presentedSpeedNorm = smoothPresentationValue(
                r,
                '_presentedSpeedNorm',
                Number(presentState.moveSpeedNorm || 0),
                animationAlpha
            );
            var presentedSprinting = smoothPresentationFlag(
                r,
                '_presentedSprintBlend',
                !!presentState.sprinting,
                animationAlpha
            );
            var presentedFastBackpedal = smoothPresentationFlag(
                r,
                '_presentedFastBackpedalBlend',
                !!presentState.fastBackpedal,
                animationAlpha
            );
            var presentedMovingForward = smoothPresentationFlag(
                r,
                '_presentedMovingForwardBlend',
                !!presentState.movingForward,
                animationAlpha
            );
            var presentedMovingBackward = smoothPresentationFlag(
                r,
                '_presentedMovingBackwardBlend',
                !!presentState.movingBackward,
                animationAlpha
            );
            var presentedMovingLeft = smoothPresentationFlag(
                r,
                '_presentedMovingLeftBlend',
                !!presentState.movingLeft,
                animationAlpha
            );
            var presentedMovingRight = smoothPresentationFlag(
                r,
                '_presentedMovingRightBlend',
                !!presentState.movingRight,
                animationAlpha
            );
            var remoteTurnRate = 0;
            if (dt > 0 && typeof r._prevAnimationYaw === 'number') {
                remoteTurnRate = normalizeAngle(renderYaw - Number(r._prevAnimationYaw || 0)) / Math.max(0.0001, Number(dt || 0));
            }
            r._prevAnimationYaw = renderYaw;

            if (r.actorVisual && r.actorVisual.setWorldTransform) {
                r.actorVisual.setWorldTransform(
                    { x: nextX, y: nextY, z: nextZ },
                    nextYaw,
                    { rolling: Number(r.rollUntil || 0) > serverNowMs }
                );
            } else {
                r.group.position.x = nextX;
                r.group.position.y = nextY;
                r.group.position.z = nextZ;
                r.group.rotation.y = nextYaw;
            }

            if (r.rigApi) {
                var nextWeaponId = r.weaponId || 'rifle';
                if (r._appliedWeaponId !== nextWeaponId) {
                    if (r.actorVisual && r.actorVisual.setWeapon) {
                        r.actorVisual.setWeapon(nextWeaponId);
                    } else {
                        r.rigApi.setWeapon(nextWeaponId);
                    }
                    r._appliedWeaponId = nextWeaponId;
                }
                var chokeVictimState = getChokeVictimStateForEntity ? getChokeVictimStateForEntity(r.id) : { lift: 0, startedAt: 0 };
                var animationApi = (r.actorVisual && r.actorVisual.updateAnimation) ? r.actorVisual : r.rigApi;
                if (animationApi && animationApi.updateAnimation) {
                    var presentedHorizontalSpeed = presentedSpeedNorm * effectiveRunSpeedForWeapon(r.weaponId || 'rifle');
                    animationApi.updateAnimation(dt, {
                        speedNorm: presentedSpeedNorm,
                        sprinting: presentedSprinting,
                        fastBackpedal: presentedFastBackpedal,
                        airborne: presentState.isGrounded === false,
                        footY: nextY,
                        aimPitch: renderPitch,
                        choked: chokeVictimState.lift > 0,
                        startedAt: chokeVictimState.startedAt || 0,
                        horizontalSpeed: presentedHorizontalSpeed,
                        worldSpeed: presentedHorizontalSpeed,
                        yaw: renderYaw,
                        turnRate: remoteTurnRate,
                        movingForward: presentedMovingForward,
                        movingBackward: presentedMovingBackward,
                        movingLeft: presentedMovingLeft,
                        movingRight: presentedMovingRight
                    });
                }
                var triggerApi = (r.actorVisual && r.actorVisual.triggerAction) ? r.actorVisual : r.rigApi;
                if (triggerApi && triggerApi.triggerAction) {
                    var jumpStarted = r._prevIsGrounded !== false && presentState.isGrounded === false && Number(presentState.velocityY || 0) > 0.1;
                    if (jumpStarted) {
                        triggerApi.triggerAction('jump', {
                            reverseLegTilt: !!presentState.movingBackward && !presentState.movingForward
                        });
                    }
                    var rollStartedAt = Number(r.rollStartedAt || 0);
                    var rollActive = rollStartedAt > 0 && Number(r.rollUntil || 0) > serverNowMs;
                    if (rollActive && rollStartedAt > Number(r._lastTriggeredRollStartedAt || 0)) {
                        triggerApi.triggerAction('roll', r.rollInputState || null);
                        r._lastTriggeredRollStartedAt = rollStartedAt;
                    }
                }
                var presentationServerNowMs = Math.max(
                    0,
                    serverNowMs - Math.max(0, Number(r.interpolationDelayMs || 0))
                );
                var latestMuzzleFlashUntil = Number(r.muzzleFlashUntil || 0);
                if (latestMuzzleFlashUntil > Number(r._lastReceivedMuzzleFlashUntil || 0)) {
                    if (!(latestMuzzleFlashUntil > presentationServerNowMs)) {
                        r._localMuzzleFlashUntilMs = Math.max(
                            Number(r._localMuzzleFlashUntilMs || 0),
                            nowMs + Math.max(16, Number(interpolationTuning.muzzleFlashPresentationMs || 70))
                        );
                    }
                    r._lastReceivedMuzzleFlashUntil = latestMuzzleFlashUntil;
                }
                var muzzleVisible = Number(presentState.muzzleFlashUntil || 0) > presentationServerNowMs;
                muzzleVisible = muzzleVisible || Number(r._localMuzzleFlashUntilMs || 0) > nowMs;
                if (r.actorVisual && r.actorVisual.setMuzzleVisible) {
                    r.actorVisual.setMuzzleVisible(muzzleVisible);
                }
                if (triggerApi && triggerApi.triggerAction) {
                    if (muzzleVisible && !r._muzzleVisible) {
                        triggerApi.triggerAction('fire', { duration: 0.09, strength: 1 });
                    }
                }
                if (triggerApi && triggerApi.triggerAction) {
                    if (r.chokeState && r.chokeState.endsAt > serverNowMs) {
                        if (!r._chokeGripTriggered) {
                            r._chokeGripTriggered = true;
                            triggerApi.triggerAction('choke_grip', {
                                duration: (r.chokeState.endsAt - serverNowMs) / 1000
                            });
                        }
                    } else {
                        r._chokeGripTriggered = false;
                    }
                }
                r._muzzleVisible = muzzleVisible;
                r._prevIsGrounded = presentState.isGrounded !== false;
            }

            r.lastPresentedTransform = cloneTransform({
                x: nextX,
                footY: nextY,
                z: nextZ,
                yaw: nextYaw,
                pitch: renderPitch,
                moveSpeedNorm: Number(presentState.moveSpeedNorm || 0),
                sprinting: !!presentState.sprinting,
                movingForward: !!presentState.movingForward,
                movingBackward: !!presentState.movingBackward,
                movingLeft: !!presentState.movingLeft,
                movingRight: !!presentState.movingRight,
                isGrounded: presentState.isGrounded !== false,
                velocityY: Number(presentState.velocityY || 0),
                muzzleFlashUntil: Number(presentState.muzzleFlashUntil || 0)
            });

            if (r.actorVisual && r.actorVisual.setSpawnShield) {
                r.actorVisual.setSpawnShield(!!(r.spawnShieldUntil && r.spawnShieldUntil > serverNowMs));
            }

            var finalChokeVictimState = getChokeVictimStateForEntity ? getChokeVictimStateForEntity(r.id) : { lift: 0 };
            if (r.actorVisual && r.actorVisual.setRevealGhostState) {
                if (finalChokeVictimState.lift > 0) {
                    r.actorVisual.setRevealGhostState(false);
                } else if (r.deadeyeMark) {
                    var deadeyePulse = 0.05 * Math.sin((Date.now() * 0.016) + String(r.id || '').length);
                    var deadeyeOpacity = r.deadeyeMark.locked
                        ? 0.44
                        : (0.22 + (Math.max(0, Math.min(1, Number(r.deadeyeMark.progress || 0))) * 0.18));
                    r.actorVisual.setRevealGhostState(true, deadeyeOpacity + deadeyePulse, 0xffc46d);
                } else {
                    r.actorVisual.setRevealGhostState(false);
                }
            }
            if (finalChokeVictimState.lift > 0) {
                r.group.position.y += finalChokeVictimState.lift;
            }

            if (r.actorVisual && r.actorVisual.syncHitboxes) {
                var hitboxLeadMs = Math.max(0, Number(interpolationTuning.hitboxLeadMs || 0));
                var hitboxTransform = bufferedTransform;
                if (hitboxLeadMs > 0) {
                    var presentDelayMs = Math.max(0, Number(r.interpolationDelayMs || 0));
                    var combatDelayMs = Math.max(0, presentDelayMs - hitboxLeadMs);
                    hitboxTransform = interpolateBufferedTransform(r, nowMs, {
                        delayMs: combatDelayMs
                    }) || hitboxTransform;
                }
                var hitboxPosition = hitboxTransform
                    ? {
                        x: Number(hitboxTransform.x || 0),
                        y: Number(hitboxTransform.footY || 0),
                        z: Number(hitboxTransform.z || 0)
                    }
                    : {
                        x: Number(r.group.position.x || 0),
                        y: Number(r.group.position.y || 0),
                        z: Number(r.group.position.z || 0)
                    };
                if (finalChokeVictimState.lift > 0) {
                    hitboxPosition.y += finalChokeVictimState.lift;
                }
                r.actorVisual.syncHitboxes(hitboxPosition, {
                    rolling: Number(r.rollUntil || 0) > serverNowMs
                });
            }
        });
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetRemoteSync = {
        updateRemoteEntities: updateRemoteEntities
    };
})();
