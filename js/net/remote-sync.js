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

    function updateRemoteEntities(dt, renderMap, getChokeVictimStateForEntity) {
        if (!renderMap || !renderMap.forEach) return;
        renderMap.forEach(function (r) {
            if (!r || !r.group || !r.group.position || !r.group.rotation) return;
            var lerp = Math.min(1, dt * 10);
            var nextX = r.group.position.x + (r.targetX - r.group.position.x) * lerp;
            var nextY = r.group.position.y + ((r.targetFootY || 0) - r.group.position.y) * lerp;
            var nextZ = r.group.position.z + (r.targetZ - r.group.position.z) * lerp;

            var deltaYaw = normalizeAngle(r.targetYaw - r.group.rotation.y);
            var nextYaw = r.group.rotation.y + (deltaYaw * lerp);

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
                        aimPitch: r.targetPitch || 0,
                        hooked: hookedNow,
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
