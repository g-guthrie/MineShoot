/**
 * remote-sync.js - Applies remote entity presentation updates each frame.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetRemoteSync
 */
(function () {
    'use strict';

    var entityPoints = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityPoints) || {};

    function normalizeAngle(rad) {
        while (rad > Math.PI) rad -= Math.PI * 2;
        while (rad < -Math.PI) rad += Math.PI * 2;
        return rad;
    }

    function setRemoteHealFlash(render, active) {
        if (!render || !render.actorVisual || !render.actorVisual.visual) return;
        var visual = render.actorVisual.visual;
        var parts = visual.userData && visual.userData.bodyParts ? visual.userData.bodyParts : null;
        var originalColors = visual.userData && visual.userData.originalPartColors ? visual.userData.originalPartColors : [];
        if (!parts) return;
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (!part || !part.material || !part.material.color) continue;
            if (active) {
                part.material.color.setHex(0x6dff9a);
                if (part.material.emissive) part.material.emissive.setHex(0x163d18);
            } else {
                part.material.color.setHex(typeof originalColors[i] === 'number' ? originalColors[i] : 0xffffff);
                if (part.material.emissive) part.material.emissive.setHex(0x000000);
            }
        }
    }

    function setRemoteSpawnShieldVisual(render, active) {
        if (!render || !render.actorVisual || !render.actorVisual.visual) return;
        render.actorVisual.visual.traverse(function (node) {
            if (!node || !node.isMesh || !node.material) return;
            var mat = node.material;
            if (mat.__spawnShieldBaseOpacity === undefined) {
                mat.__spawnShieldBaseOpacity = (typeof mat.opacity === 'number') ? mat.opacity : 1;
                mat.__spawnShieldBaseTransparent = !!mat.transparent;
            }
            if (active) {
                mat.transparent = true;
                mat.opacity = Math.min(mat.__spawnShieldBaseOpacity, 0.42);
            } else {
                mat.opacity = mat.__spawnShieldBaseOpacity;
                mat.transparent = mat.__spawnShieldBaseTransparent;
            }
            mat.needsUpdate = true;
        });
    }

    function updateRemoteEntities(dt, renderMap, getChokeVictimStateForEntity) {
        if (!renderMap || !renderMap.forEach) return;
        renderMap.forEach(function (r) {
            if (!r || !r.group || !r.group.position || !r.group.rotation) return;
            var lerp = Math.min(1, dt * 10);
            r.group.position.x += (r.targetX - r.group.position.x) * lerp;
            r.group.position.y += ((r.targetFootY || 0) - r.group.position.y) * lerp;
            r.group.position.z += (r.targetZ - r.group.position.z) * lerp;

            var deltaYaw = normalizeAngle(r.targetYaw - r.group.rotation.y);
            r.group.rotation.y += deltaYaw * lerp;

            if (r.rigApi) {
                r.rigApi.setWeapon(r.weaponId || 'rifle');
                r.rigApi.updateAimPitch(r.targetPitch || 0);
                var chokeVictimState = getChokeVictimStateForEntity ? getChokeVictimStateForEntity(r.id) : { lift: 0, startedAt: 0 };
                var hookedNow = !!r.hookPullState || !!(r.justBeenHookedState && r.justBeenHookedState.endsAt > Date.now());
                r.rigApi.updateLocomotion(r.moveSpeedNorm || 0, !!r.sprinting, dt, false, {
                    hooked: hookedNow,
                    choked: chokeVictimState.lift > 0,
                    startedAt: chokeVictimState.startedAt || 0,
                    worldSpeed: (r.moveSpeedNorm || 0) * 14,
                    movingForward: (r.moveSpeedNorm || 0) > 0.05
                });
                if (r.rigApi.setMuzzleVisible) {
                    r.rigApi.setMuzzleVisible((r.muzzleFlashUntil || 0) > Date.now());
                }
                if (r.rigApi.applyThrowPose) r.rigApi.applyThrowPose(dt);
                if (r.rigApi.applyChokeGripPose) {
                    if (r.chokeState && r.chokeState.targetId && r.chokeState.endsAt > Date.now()) {
                        if (!r._chokeGripTriggered) {
                            r._chokeGripTriggered = true;
                            r.rigApi.triggerChokeGripPose((r.chokeState.endsAt - Date.now()) / 1000);
                        }
                    } else {
                        r._chokeGripTriggered = false;
                    }
                    r.rigApi.applyChokeGripPose(dt);
                }
            }

            setRemoteHealFlash(r, !!(r.healState && r.healState.endsAt > Date.now()));
            setRemoteSpawnShieldVisual(r, !!(r.spawnShieldUntil && r.spawnShieldUntil > Date.now()));

            var finalChokeVictimState = getChokeVictimStateForEntity ? getChokeVictimStateForEntity(r.id) : { lift: 0 };
            if (finalChokeVictimState.lift > 0) {
                r.group.position.y += finalChokeVictimState.lift;
            }

            if (r.actorVisual && r.actorVisual.syncHitboxes) {
                r.actorVisual.syncHitboxes(r.group.position);
            } else if (r.bodyHitbox && r.headHitbox) {
                r.bodyHitbox.position.set(
                    r.group.position.x,
                    entityPoints.entityBodyHitboxYFromFeet ? entityPoints.entityBodyHitboxYFromFeet(r.group.position.y) : (r.group.position.y + 0.7625),
                    r.group.position.z
                );
                r.headHitbox.position.set(
                    r.group.position.x,
                    entityPoints.entityHeadHitboxYFromFeet ? entityPoints.entityHeadHitboxYFromFeet(r.group.position.y) : (r.group.position.y + 2.0),
                    r.group.position.z
                );
            }
        });
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetRemoteSync = {
        updateRemoteEntities: updateRemoteEntities
    };
})();
