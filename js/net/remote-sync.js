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

    function interpolateBufferedTransform(render, nowMs) {
        if (!render || !Array.isArray(render.snapshotHistory) || render.snapshotHistory.length === 0) return null;
        var history = render.snapshotHistory;
        var latest = history[history.length - 1];
        var intervalMs = clamp(Number(render.snapshotIntervalMs || 50), 16, 140);
        var jitterMs = clamp(Number(render.snapshotJitterMs || 0), 0, 120);
        var interpolationDelayMs = clamp(Number(render.interpolationDelayMs || ((intervalMs * 2.2) + (jitterMs * 1.5))), 95, 240);
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
                pitch: Number(older.pitch || 0) + ((Number(newer.pitch || 0) - Number(older.pitch || 0)) * t)
            };
        }

        var last = history[history.length - 1];
        var prev = history.length > 1 ? history[history.length - 2] : last;
        var latestGapMs = Math.max(0, nowMs - Number(last.receivedAt || nowMs));
        var freezeGapMs = clamp(Number(render.freezeGapMs || ((intervalMs * 1.75) + (jitterMs * 2.2))), 80, 220);
        if (history.length < 2 || latestGapMs > freezeGapMs) {
            return {
                x: Number(last.x || 0),
                footY: Number(last.footY || 0),
                z: Number(last.z || 0),
                yaw: Number(last.yaw || 0),
                pitch: Number(last.pitch || 0)
            };
        }
        var stepMs = Math.max(1, Number(last.serverTime || 0) - Number(prev.serverTime || 0));
        var maxExtrapolationMs = clamp(Number(render.maxExtrapolationMs || ((intervalMs * 0.65) + jitterMs)), 24, 90);
        var extrapolationMs = clamp(renderServerTime - Number(last.serverTime || 0), 0, Math.min(maxExtrapolationMs, intervalMs + jitterMs));
        var extrapolationScale = extrapolationMs / stepMs;
        return {
            x: Number(last.x || 0) + ((Number(last.x || 0) - Number(prev.x || 0)) * extrapolationScale),
            footY: Number(last.footY || 0) + ((Number(last.footY || 0) - Number(prev.footY || 0)) * extrapolationScale),
            z: Number(last.z || 0) + ((Number(last.z || 0) - Number(prev.z || 0)) * extrapolationScale),
            yaw: Number(last.yaw || 0) + (normalizeAngle(Number(last.yaw || 0) - Number(prev.yaw || 0)) * extrapolationScale),
            pitch: Number(last.pitch || 0) + ((Number(last.pitch || 0) - Number(prev.pitch || 0)) * extrapolationScale)
        };
    }

    function updateRemoteEntities(dt, renderMap, getChokeVictimStateForEntity) {
        if (!renderMap || !renderMap.forEach) return;
        var nowMs = Date.now();
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
                var hookedNow = Number(r.hookedUntil || 0) > Date.now();
                var animationApi = (r.actorVisual && r.actorVisual.updateAnimation) ? r.actorVisual : r.rigApi;
                if (animationApi && animationApi.updateAnimation) {
                    animationApi.updateAnimation(dt, {
                        speedNorm: r.moveSpeedNorm || 0,
                        sprinting: !!r.sprinting,
                        airborne: r.isGrounded === false,
                        aimPitch: renderPitch,
                        hooked: hookedNow,
                        hookStartedAt: Number(r.hookedStartedAt || 0),
                        choked: chokeVictimState.lift > 0,
                        startedAt: chokeVictimState.startedAt || 0,
                        worldSpeed: (r.moveSpeedNorm || 0) * 14,
                        movingForward: !!r.movingForward,
                        movingBackward: !!r.movingBackward
                    });
                }
                var triggerApi = (r.actorVisual && r.actorVisual.triggerAction) ? r.actorVisual : r.rigApi;
                if (triggerApi && triggerApi.triggerAction) {
                    var jumpStarted = r._prevIsGrounded !== false && r.isGrounded === false && Number(r.velocityY || 0) > 0.1;
                    if (jumpStarted) {
                        triggerApi.triggerAction('jump', {
                            reverseLegTilt: !!r.movingBackward && !r.movingForward
                        });
                    }
                }
                if (r.actorVisual && r.actorVisual.setMuzzleVisible) {
                    r.actorVisual.setMuzzleVisible((r.muzzleFlashUntil || 0) > Date.now());
                }
                if (triggerApi && triggerApi.triggerAction) {
                    if (r.chokeState && r.chokeState.endsAt > Date.now()) {
                        if (!r._chokeGripTriggered) {
                            r._chokeGripTriggered = true;
                            triggerApi.triggerAction('choke_grip', {
                                duration: (r.chokeState.endsAt - Date.now()) / 1000
                            });
                        }
                    } else {
                        r._chokeGripTriggered = false;
                    }
                }
                r._prevIsGrounded = r.isGrounded !== false;
            }

            if (r.actorVisual && r.actorVisual.setHealFlash) {
                r.actorVisual.setHealFlash(!!(r.healState && r.healState.endsAt > Date.now()));
            }
            if (r.actorVisual && r.actorVisual.setSpawnShield) {
                r.actorVisual.setSpawnShield(!!(r.spawnShieldUntil && r.spawnShieldUntil > Date.now()));
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
                r.actorVisual.syncHitboxes(r.group.position);
            }
        });
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetRemoteSync = {
        updateRemoteEntities: updateRemoteEntities
    };
})();
