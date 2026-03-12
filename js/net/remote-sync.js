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

    function updateRemoteEntities(dt, renderMap, getChokeVictimStateForEntity, sampleRemoteEntityPresentation, nowMs) {
        if (!renderMap || !renderMap.forEach) return;
        var now = Number(nowMs || Date.now());
        renderMap.forEach(function (r) {
            if (!r || !r.group || !r.group.position || !r.group.rotation) return;
            var present = sampleRemoteEntityPresentation ? sampleRemoteEntityPresentation(r.id, now) : null;
            var eyeHeight = (typeof r.targetY === 'number' ? (r.targetY - Number(r.targetFootY || 0)) : 1.6);
            var targetFootY = present
                ? ((typeof present.y === 'number' ? present.y : eyeHeight) - eyeHeight)
                : (r.targetFootY || 0);
            var nextX = present ? Number(present.x || 0) : (r.group.position.x + ((r.targetX - r.group.position.x) * Math.min(1, dt * 10)));
            var nextY = present ? targetFootY : (r.group.position.y + (targetFootY - r.group.position.y) * Math.min(1, dt * 10));
            var nextZ = present ? Number(present.z || 0) : (r.group.position.z + ((r.targetZ - r.group.position.z) * Math.min(1, dt * 10)));
            var nextYaw = present
                ? Number(present.yaw || 0)
                : (r.group.rotation.y + (normalizeAngle(r.targetYaw - r.group.rotation.y) * Math.min(1, dt * 10)));
            var nextPitch = present ? Number(present.pitch || 0) : Number(r.targetPitch || 0);
            var moveSpeedNorm = present ? Number(present.moveSpeedNorm || 0) : Number(r.moveSpeedNorm || 0);
            var sprinting = present ? !!present.sprinting : !!r.sprinting;
            var movingForward = present ? !!present.movingForward : !!r.movingForward;
            var movingBackward = present ? !!present.movingBackward : !!r.movingBackward;
            var isGrounded = present ? present.isGrounded !== false : r.isGrounded !== false;
            var velocityY = present ? Number(present.velocityY || 0) : Number(r.velocityY || 0);
            var nextWeaponId = present ? String(present.weaponId || r.weaponId || 'rifle') : (r.weaponId || 'rifle');

            if (r.actorVisual && r.actorVisual.setWorldTransform) {
                r.actorVisual.setWorldTransform({ x: nextX, y: nextY, z: nextZ }, nextYaw);
            } else {
                r.group.position.x = nextX;
                r.group.position.y = nextY;
                r.group.position.z = nextZ;
                r.group.rotation.y = nextYaw;
            }

            if (r.rigApi) {
                if (r._appliedWeaponId !== nextWeaponId) {
                    if (r.actorVisual && r.actorVisual.setWeapon) {
                        r.actorVisual.setWeapon(nextWeaponId);
                    } else {
                        r.rigApi.setWeapon(nextWeaponId);
                    }
                    r._appliedWeaponId = nextWeaponId;
                }
                var chokeVictimState = getChokeVictimStateForEntity ? getChokeVictimStateForEntity(r.id) : { lift: 0, startedAt: 0 };
                var hookedNow = Number(r.hookedUntil || 0) > now;
                var animationApi = (r.actorVisual && r.actorVisual.updateAnimation) ? r.actorVisual : r.rigApi;
                if (animationApi && animationApi.updateAnimation) {
                    animationApi.updateAnimation(dt, {
                        speedNorm: moveSpeedNorm,
                        sprinting: sprinting,
                        airborne: isGrounded === false,
                        aimPitch: nextPitch || 0,
                        hooked: hookedNow,
                        hookStartedAt: Number(r.hookedStartedAt || 0),
                        choked: chokeVictimState.lift > 0,
                        startedAt: chokeVictimState.startedAt || 0,
                        worldSpeed: moveSpeedNorm * 14,
                        movingForward: movingForward,
                        movingBackward: movingBackward
                    });
                }
                var triggerApi = (r.actorVisual && r.actorVisual.triggerAction) ? r.actorVisual : r.rigApi;
                if (triggerApi && triggerApi.triggerAction) {
                    var jumpStarted = r._prevIsGrounded !== false && isGrounded === false && velocityY > 0.1;
                    if (jumpStarted) {
                        triggerApi.triggerAction('jump', {
                            reverseLegTilt: movingBackward && !movingForward
                        });
                    }
                }
                if (r.actorVisual && r.actorVisual.setMuzzleVisible) {
                    r.actorVisual.setMuzzleVisible((r.muzzleFlashUntil || 0) > now);
                }
                if (triggerApi && triggerApi.triggerAction) {
                    if (r.chokeState && r.chokeState.endsAt > now) {
                        if (!r._chokeGripTriggered) {
                            r._chokeGripTriggered = true;
                            triggerApi.triggerAction('choke_grip', {
                                duration: (r.chokeState.endsAt - now) / 1000
                            });
                        }
                    } else {
                        r._chokeGripTriggered = false;
                    }
                }
                r._prevIsGrounded = isGrounded !== false;
            }

            if (r.actorVisual && r.actorVisual.setHealFlash) {
                r.actorVisual.setHealFlash(!!(r.healState && r.healState.endsAt > now));
            }
            if (r.actorVisual && r.actorVisual.setSpawnShield) {
                r.actorVisual.setSpawnShield(!!(r.spawnShieldUntil && r.spawnShieldUntil > now));
            }

            var finalChokeVictimState = getChokeVictimStateForEntity ? getChokeVictimStateForEntity(r.id) : { lift: 0 };
            if (r.actorVisual && r.actorVisual.setRevealGhostState) {
                if (finalChokeVictimState.lift > 0) {
                    r.actorVisual.setRevealGhostState(false);
                } else if (r.deadeyeMark) {
                    var deadeyePulse = 0.05 * Math.sin((now * 0.016) + String(r.id || '').length);
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
