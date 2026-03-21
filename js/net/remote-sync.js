/**
 * remote-sync.js - Applies remote entity presentation updates each frame.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetRemoteSync
 */
(function () {
    'use strict';

    function normalizeAngle(rad) {
        while (rad > Math.PI) rad -= Math.PI * 2;
        while (rad < -Math.PI) rad += Math.PI * 2;
        return rad;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function choosePresentationValue(olderValue, newerValue, t) {
        return t >= 0.5 ? newerValue : olderValue;
    }

    function remoteInterpolationTuning() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var network = shared.gameplayTuning && shared.gameplayTuning.network
            ? shared.gameplayTuning.network
            : null;
        return network && network.remoteInterpolation ? network.remoteInterpolation : {};
    }

    function authoritativeNowMs() {
        var runtime = globalThis.__MAYHEM_RUNTIME || {};
        var net = runtime.GameNet || null;
        var stamp = net && net.getAuthoritativeNow
            ? Number(net.getAuthoritativeNow() || 0)
            : 0;
        return stamp > 0 ? stamp : Date.now();
    }

    function toLocalTime(timestamp) {
        var runtime = globalThis.__MAYHEM_RUNTIME || {};
        var net = runtime.GameNet || null;
        var stamp = Number(timestamp || 0);
        if (!(stamp > 0)) return 0;
        if (net && net.toLocalTime) {
            var localStamp = Number(net.toLocalTime(stamp) || 0);
            if (localStamp > 0) return localStamp;
        }
        return stamp;
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

    function weaponPresentationFor(weaponId) {
        var runtime = globalThis.__MAYHEM_RUNTIME || {};
        var shared = runtime.GameShared || {};
        return shared.getWeaponPresentation ? shared.getWeaponPresentation(weaponId) : null;
    }

    function resolveRemoteReloadState(render, serverNowMs) {
        var runtime = globalThis.__MAYHEM_RUNTIME || {};
        var shared = runtime.GameShared || {};
        var emptyState = { reloading: false, reloadPct: 1, phase: 'ready', phasePct: 1 };
        if (!render || !render.weaponAmmo || typeof render.weaponAmmo !== 'object') return emptyState;
        var weaponId = String(render.weaponId || '');
        if (!weaponId) return emptyState;
        var ammoState = render.weaponAmmo[weaponId];
        if (!ammoState || !ammoState.reloading) return emptyState;
        var weaponStats = sharedWeaponStatsFor(weaponId);
        var reloadMs = Math.max(0, Number(weaponStats && weaponStats.reloadMs || 0));
        if (!(reloadMs > 0)) return emptyState;
        var snapshotServerTimeMs = Number(render.weaponAmmoServerTimeMs || 0);
        var elapsedMs = snapshotServerTimeMs > 0 ? Math.max(0, serverNowMs - snapshotServerTimeMs) : 0;
        var remainingMs = Math.max(0, Number(ammoState.reloadRemainingMs || 0) - elapsedMs);
        if (!(remainingMs > 0)) return emptyState;
        if (shared.resolveReloadPresentationState) {
            var presentation = weaponPresentationFor(weaponId);
            return shared.resolveReloadPresentationState({
                reloadMs: reloadMs,
                reloadRemaining: remainingMs,
                reloadedFlashRemaining: Math.max(0, Number(ammoState.reloadedFlashRemainingMs || 0)),
                reload: presentation ? presentation.reload : null
            }, null);
        }
        return {
            reloading: true,
            reloadPct: clamp(1 - (remainingMs / reloadMs), 0, 1),
            phase: 'manipulate',
            phasePct: 0.5
        };
    }

    function interpolateBufferedTransform(render, nowMs, options) {
        if (!render || !Array.isArray(render.snapshotHistory) || render.snapshotHistory.length === 0) return null;
        var opts = options || {};
        var history = render.snapshotHistory;
        var latest = history[history.length - 1];
        var intervalMs = clamp(Number(render.snapshotIntervalMs || 50), 16, 140);
        var jitterMs = clamp(Number(render.snapshotJitterMs || 0), 0, 120);
        var interpolationTuning = remoteInterpolationTuning();
        var minDelayMs = Math.max(32, Number(interpolationTuning.minDelayMs || 95));
        var maxDelayMs = Math.max(minDelayMs, Number(interpolationTuning.maxDelayMs || 260));
        var explicitDelayMs = Number(render.interpolationDelayMs);
        var interpolationDelayMs = explicitDelayMs > 0
            ? Math.max(minDelayMs, explicitDelayMs)
            : clamp(
                (intervalMs * Number(interpolationTuning.intervalDelayScale || 2.6)) +
                (jitterMs * Number(interpolationTuning.jitterDelayScale || 2.1)),
                minDelayMs,
                maxDelayMs
            );
        var overrideDelayMs = Number(opts.delayMs);
        if (isFinite(overrideDelayMs) && overrideDelayMs >= 0) {
            interpolationDelayMs = overrideDelayMs;
        }
        var serverTimeOffsetMs = Number(render.serverTimeOffsetMs);
        if (!isFinite(serverTimeOffsetMs)) {
            serverTimeOffsetMs = Number(latest.receivedAt || nowMs) - Number(latest.serverTime || nowMs);
        }
        var renderServerTime = nowMs - serverTimeOffsetMs - interpolationDelayMs;
        if (history.length === 1 || renderServerTime <= Number(history[0].serverTime || 0)) {
            return history[0];
        }

        for (var i = history.length - 1; i > 0; i--) {
            var newer = history[i];
            var older = history[i - 1];
            var olderTime = Number(older.serverTime || 0);
            var newerTime = Number(newer.serverTime || 0);
            if (renderServerTime < olderTime || renderServerTime > newerTime) continue;
            var span = Math.max(1, newerTime - olderTime);
            var t = clamp((renderServerTime - olderTime) / span, 0, 1);
            return {
                x: Number(older.x || 0) + ((Number(newer.x || 0) - Number(older.x || 0)) * t),
                footY: Number(older.footY || 0) + ((Number(newer.footY || 0) - Number(older.footY || 0)) * t),
                z: Number(older.z || 0) + ((Number(newer.z || 0) - Number(older.z || 0)) * t),
                yaw: Number(older.yaw || 0) + (normalizeAngle(Number(newer.yaw || 0) - Number(older.yaw || 0)) * t),
                pitch: Number(older.pitch || 0) + ((Number(newer.pitch || 0) - Number(older.pitch || 0)) * t),
                moveSpeedNorm: Number(older.moveSpeedNorm || 0) + ((Number(newer.moveSpeedNorm || 0) - Number(older.moveSpeedNorm || 0)) * t),
                sprinting: !!choosePresentationValue(!!older.sprinting, !!newer.sprinting, t),
                movingForward: !!choosePresentationValue(!!older.movingForward, !!newer.movingForward, t),
                movingBackward: !!choosePresentationValue(!!older.movingBackward, !!newer.movingBackward, t),
                isGrounded: choosePresentationValue(older.isGrounded !== false, newer.isGrounded !== false, t) !== false,
                velocityY: Number(older.velocityY || 0) + ((Number(newer.velocityY || 0) - Number(older.velocityY || 0)) * t),
                muzzleFlashUntil: Number(choosePresentationValue(Number(older.muzzleFlashUntil || 0), Number(newer.muzzleFlashUntil || 0), t) || 0)
            };
        }

        var last = history[history.length - 1];
        var prev = history.length > 1 ? history[history.length - 2] : last;
        var latestGapMs = Math.max(0, nowMs - Number(last.receivedAt || nowMs));
        var explicitFreezeGapMs = Number(render.freezeGapMs);
        var freezeGapMs = explicitFreezeGapMs > 0
            ? explicitFreezeGapMs
            : clamp(
                (intervalMs * Number(interpolationTuning.freezeGapIntervalScale || 1.85)) +
                (jitterMs * Number(interpolationTuning.freezeGapJitterScale || 2.5)),
                Math.max(1, Number(interpolationTuning.freezeGapMinMs || 90)),
                Math.max(1, Number(interpolationTuning.freezeGapMaxMs || 240))
            );
        if (history.length < 2 || latestGapMs > freezeGapMs) {
            return {
                x: Number(last.x || 0),
                footY: Number(last.footY || 0),
                z: Number(last.z || 0),
                yaw: Number(last.yaw || 0),
                pitch: Number(last.pitch || 0),
                moveSpeedNorm: Number(last.moveSpeedNorm || 0),
                sprinting: !!last.sprinting,
                movingForward: !!last.movingForward,
                movingBackward: !!last.movingBackward,
                isGrounded: last.isGrounded !== false,
                velocityY: Number(last.velocityY || 0),
                muzzleFlashUntil: Number(last.muzzleFlashUntil || 0)
            };
        }
        var stepMs = Math.max(1, Number(last.serverTime || 0) - Number(prev.serverTime || 0));
        var explicitMaxExtrapolationMs = Number(render.maxExtrapolationMs);
        var maxExtrapolationMs = explicitMaxExtrapolationMs > 0
            ? explicitMaxExtrapolationMs
            : clamp(
                (intervalMs * Number(interpolationTuning.maxExtrapolationIntervalScale || 0.45)) +
                (jitterMs * Number(interpolationTuning.maxExtrapolationJitterScale || 0.65)),
                Math.max(1, Number(interpolationTuning.maxExtrapolationMinMs || 20)),
                Math.max(1, Number(interpolationTuning.maxExtrapolationMaxMs || 72))
            );
        var extrapolationMs = clamp(renderServerTime - Number(last.serverTime || 0), 0, Math.min(maxExtrapolationMs, intervalMs + jitterMs));
        var extrapolationScale = extrapolationMs / stepMs;
        return {
            x: Number(last.x || 0) + ((Number(last.x || 0) - Number(prev.x || 0)) * extrapolationScale),
            footY: Number(last.footY || 0) + ((Number(last.footY || 0) - Number(prev.footY || 0)) * extrapolationScale),
            z: Number(last.z || 0) + ((Number(last.z || 0) - Number(prev.z || 0)) * extrapolationScale),
            yaw: Number(last.yaw || 0) + (normalizeAngle(Number(last.yaw || 0) - Number(prev.yaw || 0)) * extrapolationScale),
            pitch: Number(last.pitch || 0) + ((Number(last.pitch || 0) - Number(prev.pitch || 0)) * extrapolationScale),
            moveSpeedNorm: Number(last.moveSpeedNorm || 0),
            sprinting: !!last.sprinting,
            movingForward: !!last.movingForward,
            movingBackward: !!last.movingBackward,
            isGrounded: last.isGrounded !== false,
            velocityY: Number(last.velocityY || 0),
            muzzleFlashUntil: Number(last.muzzleFlashUntil || 0)
        };
    }

    function updateRemoteEntities(dt, renderMap, getChokeVictimStateForEntity) {
        if (!renderMap || !renderMap.forEach) return;
        var nowMs = Date.now();
        var serverNowMs = authoritativeNowMs();
        var interpolationTuning = remoteInterpolationTuning();
        renderMap.forEach(function (r) {
            if (!r || !r.group || !r.group.position || !r.group.rotation) return;
            var bufferedTransform = interpolateBufferedTransform(r, nowMs);
            var lerp = Math.min(1, dt * 10);
            var nextX = bufferedTransform
                ? Number(bufferedTransform.x || 0)
                : (r.group.position.x + (r.targetX - r.group.position.x) * lerp);
            var nextY = bufferedTransform
                ? Number(bufferedTransform.footY || 0)
                : (r.group.position.y + ((r.targetFootY || 0) - r.group.position.y) * lerp);
            var nextZ = bufferedTransform
                ? Number(bufferedTransform.z || 0)
                : (r.group.position.z + (r.targetZ - r.group.position.z) * lerp);
            var renderYaw = bufferedTransform ? Number(bufferedTransform.yaw || 0) : Number(r.targetYaw || 0);
            var renderPitch = bufferedTransform ? Number(bufferedTransform.pitch || 0) : Number(r.targetPitch || 0);
            var nextYaw = bufferedTransform
                ? renderYaw
                : (r.group.rotation.y + (normalizeAngle(renderYaw - r.group.rotation.y) * lerp));
            var presentState = bufferedTransform || r;

            if (r.actorVisual && r.actorVisual.setWorldTransform) {
                r.actorVisual.setWorldTransform({ x: nextX, y: nextY, z: nextZ }, nextYaw);
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
                var hookedNow = Number(r.hookedUntil || 0) > serverNowMs;
                var remoteReloadState = resolveRemoteReloadState(
                    r,
                    Math.max(0, serverNowMs - Math.max(0, Number(r.interpolationDelayMs || 0)))
                );
                var animationApi = (r.actorVisual && r.actorVisual.updateAnimation) ? r.actorVisual : r.rigApi;
                if (animationApi && animationApi.updateAnimation) {
                    animationApi.updateAnimation(dt, {
                        speedNorm: presentState.moveSpeedNorm || 0,
                        sprinting: !!presentState.sprinting,
                        airborne: presentState.isGrounded === false,
                        aimPitch: renderPitch,
                        hooked: hookedNow,
                        hookStartedAt: toLocalTime(r.hookedStartedAt),
                        choked: chokeVictimState.lift > 0,
                        startedAt: chokeVictimState.startedAt || 0,
                        reloading: remoteReloadState.reloading,
                        reloadPct: remoteReloadState.reloadPct,
                        reloadPhase: remoteReloadState.phase,
                        reloadPhasePct: remoteReloadState.phasePct,
                        worldSpeed: (presentState.moveSpeedNorm || 0) * 14,
                        movingForward: !!presentState.movingForward,
                        movingBackward: !!presentState.movingBackward
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
                }
                var muzzleVisible = Number(presentState.muzzleFlashUntil || 0) > serverNowMs;
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

            if (r.actorVisual && r.actorVisual.setHealFlash) {
                r.actorVisual.setHealFlash(!!(r.healState && r.healState.endsAt > serverNowMs));
            }
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
                r.actorVisual.syncHitboxes(hitboxPosition);
            }
        });
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetRemoteSync = {
        updateRemoteEntities: updateRemoteEntities
    };
})();
