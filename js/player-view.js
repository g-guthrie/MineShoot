/**
 * player-view.js - Camera, recoil, and avatar presentation for the local player.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerView
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GamePlayerView = {};

    GamePlayerView.create = function (options) {
        options = options || {};

        var scopeBlend = 0;
        var thirdCameraInitialized = false;
        var gunBobX = 0;
        var gunBobY = 0;
        var gunRecoil = 0;
        var palmRecoil = 0;
        var cameraKickPitch = 0;
        var cameraKickYaw = 0;
        var cameraKickRoll = 0;
        var firePoseKick = 0;
        var sprintFovBlend = 0;

        var viewOrigin = new THREE.Vector3();
        var viewDesired = new THREE.Vector3();
        var viewTarget = new THREE.Vector3();
        var adsDesired = new THREE.Vector3();
        var viewDir = new THREE.Vector3();
        var eyeWorld = new THREE.Vector3();
        var plasmaForwardDir = new THREE.Vector3();
        var throwableRightDir = new THREE.Vector3();
        var viewRay = new THREE.Raycaster();

        function syncAvatarVisibility(state) {
            if (!state.avatarGroup) return;

            var avatarVisible = state.avatarAliveVisible && (!state.sniperMode || scopeBlend < 0.55);
            state.avatarGroup.visible = avatarVisible;

            if (!state.avatarRigApi || !state.avatarRigApi.rig) return;
            if (!avatarVisible) return;

            var rig = state.avatarRigApi.rig;
            if (rig.headMesh) rig.headMesh.visible = true;
            if (rig.bodyMesh) rig.bodyMesh.visible = true;
            if (rig.legLMesh) rig.legLMesh.visible = true;
            if (rig.legRMesh) rig.legRMesh.visible = true;
            if (rig.armLMesh) rig.armLMesh.visible = true;
            if (rig.armRMesh) rig.armRMesh.visible = true;
        }

        function resetRecoilState() {
            gunBobX = 0;
            gunBobY = 0;
            gunRecoil = 0;
            palmRecoil = 0;
            cameraKickPitch = 0;
            cameraKickYaw = 0;
            cameraKickRoll = 0;
            firePoseKick = 0;
        }

        function applyUnifiedGunOffsets(dt, avatarRigApi) {
            if (!avatarRigApi || !avatarRigApi.rig) return;
            var rig = avatarRigApi.rig;
            if (!rig.gun) return;

            var bobBlend = Math.min(1, dt * 12);
            gunBobX += (0 - gunBobX) * bobBlend;
            gunBobY += (0 - gunBobY) * bobBlend;

            var recoilBlend = Math.min(1, dt * 18);
            gunRecoil += (0 - gunRecoil) * recoilBlend;
            palmRecoil += (0 - palmRecoil) * recoilBlend;
            firePoseKick += (0 - firePoseKick) * Math.min(1, dt * 20);

            var cameraKickPitchBlend = Math.min(1, dt * 14);
            var cameraKickYawBlend = Math.min(1, dt * 16);
            var cameraKickRollBlend = Math.min(1, dt * 12);
            cameraKickPitch += (0 - cameraKickPitch) * cameraKickPitchBlend;
            cameraKickYaw += (0 - cameraKickYaw) * cameraKickYawBlend;
            cameraKickRoll += (0 - cameraKickRoll) * cameraKickRollBlend;

            if (rig.gunBasePos) {
                rig.gun.position.copy(rig.gunBasePos);
            }
            rig.gun.position.x += gunBobX;
            rig.gun.position.y += gunBobY;
            rig.gun.position.z += gunRecoil;
            if (rig.palmRight) {
                rig.palmRight.rotation.x += palmRecoil;
            } else if (rig.palmLeft) {
                rig.palmLeft.rotation.x += palmRecoil;
            }
            if (rig.armR) rig.armR.rotation.x += firePoseKick * 0.05;
            if (rig.armL) rig.armL.rotation.x += firePoseKick * 0.035;
        }

        function updateAvatarAnimation(dt, speed, state) {
            if (!state.actorVisual || !state.actorVisual.updateAnimation) return;
            var speedNorm = Math.max(0, Math.min(1.4, speed / state.runSpeed));
            var activeWeaponState = options.getCurrentWeaponState ? options.getCurrentWeaponState() : null;
            var reloadPct = 0;
            if (activeWeaponState && activeWeaponState.reloading && activeWeaponState.reloadMs > 0) {
                reloadPct = 1 - (Math.max(0, Number(activeWeaponState.reloadRemaining || 0)) / Math.max(1, Number(activeWeaponState.reloadMs || 1)));
            }
            state.actorVisual.updateAnimation(dt, {
                speedNorm: speedNorm,
                sprinting: state.sprinting,
                airborne: !state.isGrounded,
                aimPitch: state.pitch + (cameraKickPitch * 0.35),
                hooked: !!state.hooked,
                hookStartedAt: state.hookPullStartedAt || 0,
                choked: !!state.choked,
                startedAt: state.chokeStartedAt || 0,
                adsActive: !!state.adsActive,
                reloading: !!(activeWeaponState && activeWeaponState.reloading),
                reloadPct: reloadPct,
                worldSpeed: speed,
                movingForward: !!state.movingForward,
                movingBackward: !!state.movingBackward,
                movingLeft: !!state.movingLeft,
                movingRight: !!state.movingRight
            });
        }

        function updateCamera(dt, state) {
            if (!state.camera) return;

            var renderYaw = state.yaw + cameraKickYaw;
            var renderPitch = Math.max(-state.pitchLimit, Math.min(state.pitchLimit, state.pitch + cameraKickPitch));
            var cosPitch = Math.cos(renderPitch);
            var forwardX = -Math.sin(renderYaw) * cosPitch;
            var forwardY = Math.sin(renderPitch);
            var forwardZ = -Math.cos(renderYaw) * cosPitch;
            var rightX = Math.cos(renderYaw);
            var rightZ = -Math.sin(renderYaw);
            var chokeOffsetX = 0;
            var chokeOffsetZ = 0;
            var chokeRoll = 0;
            if (state.choked) {
                var chokeStamp = Date.now();
                var chokePhase = state.chokeStartedAt
                    ? ((chokeStamp - state.chokeStartedAt) * 0.012)
                    : (chokeStamp * 0.012);
                chokeOffsetX = Math.sin(chokePhase) * 0.08;
                chokeOffsetZ = Math.cos(chokePhase * 0.8) * 0.04;
                chokeRoll = Math.sin(chokePhase * 0.9) * 0.028;
            }

            var targetScopeBlend = state.adsActive ? 1 : 0;
            var blendSpeed = state.sniperMode ? state.sniperScopeBlendSpeed : state.adsBlendSpeed;
            scopeBlend += (targetScopeBlend - scopeBlend) * Math.min(1, dt * blendSpeed);
            if (Math.abs(scopeBlend) < 0.001) scopeBlend = 0;
            if (Math.abs(1 - scopeBlend) < 0.001) scopeBlend = 1;
            var targetSprintFovBlend = (!state.adsActive && !state.sniperMode && state.sprinting)
                ? Math.max(0, Math.min(1, Number(state.speedNorm || 0)))
                : 0;
            sprintFovBlend += (targetSprintFovBlend - sprintFovBlend) * Math.min(1, dt * 10);
            if (Math.abs(sprintFovBlend) < 0.001) sprintFovBlend = 0;

            var scopedEyeMode = state.sniperMode && scopeBlend > 0.55;
            syncAvatarVisibility(state);
            if (state.updateAvatarPose) state.updateAvatarPose();

            viewTarget.set(state.playerX + forwardX * 20, state.posY + forwardY * 20, state.playerZ + forwardZ * 20);
            viewTarget.y += state.chokeLift;
            viewTarget.x += rightX * chokeOffsetX;
            viewTarget.z += rightZ * chokeOffsetX;
            if (scopedEyeMode) {
                if (state.avatarRigApi && state.avatarRigApi.getEyeWorldPosition) {
                    state.avatarRigApi.getEyeWorldPosition(eyeWorld);
                    viewOrigin.copy(eyeWorld);
                } else {
                    viewOrigin.set(state.playerX, state.posY + state.chokeLift, state.playerZ);
                }
                viewDesired.copy(viewOrigin);
                viewDesired.x += rightX * chokeOffsetX;
                viewDesired.z += rightZ * chokeOffsetX;
            } else {
                viewOrigin.set(state.playerX, state.posY + 0.3 + state.chokeLift, state.playerZ);
                viewDesired.set(
                    state.playerX + (rightX * state.cameraShoulder) - (forwardX * state.cameraDist),
                    state.posY + state.thirdHeight + state.chokeLift,
                    state.playerZ + (rightZ * state.cameraShoulder) - (forwardZ * state.cameraDist)
                );
                viewDesired.x += rightX * chokeOffsetX;
                viewDesired.z += rightZ * chokeOffsetX + chokeOffsetZ;
                adsDesired.set(
                    state.playerX + (rightX * (state.sniperMode ? state.sniperScopeShoulder : state.adsShoulder)) - (forwardX * (state.sniperMode ? state.sniperScopeDist : state.adsDist)),
                    state.posY + (state.sniperMode ? state.sniperScopeHeight : state.adsHeight) + state.chokeLift,
                    state.playerZ + (rightZ * (state.sniperMode ? state.sniperScopeShoulder : state.adsShoulder)) - (forwardZ * (state.sniperMode ? state.sniperScopeDist : state.adsDist))
                );
                adsDesired.x += rightX * chokeOffsetX;
                adsDesired.z += rightZ * chokeOffsetX + chokeOffsetZ;
                viewDesired.lerp(adsDesired, scopeBlend);

                var worldMeshes = state.getWorldCollidables ? state.getWorldCollidables() : [];
                if (worldMeshes && worldMeshes.length > 0) {
                    viewDir.copy(viewDesired).sub(viewOrigin);
                    var dist = viewDir.length();
                    if (dist > 0.001) {
                        viewDir.divideScalar(dist);
                        viewRay.set(viewOrigin, viewDir);
                        viewRay.far = dist;
                        var hits = viewRay.intersectObjects(worldMeshes, false);
                        if (hits.length > 0) {
                            var safeDist = Math.max(0.8, hits[0].distance - 0.2);
                            viewDesired.copy(viewOrigin).addScaledVector(viewDir, safeDist);
                        }
                    }
                }
            }

            if (!thirdCameraInitialized) {
                state.camera.position.copy(viewDesired);
                thirdCameraInitialized = true;
            } else {
                state.camera.position.lerp(viewDesired, Math.min(1, dt * (scopedEyeMode ? state.firstPersonSmooth : state.thirdSmooth)));
            }

            var scopedFov = state.adsFovForWeapon ? state.adsFovForWeapon(state.currentWeaponId) : state.adsFov;
            var sprintFovBoost = Number(state.cameraFov || 75) * 0.04;
            var targetFov = state.cameraFov + (sprintFovBoost * sprintFovBlend) + ((scopedFov - state.cameraFov) * scopeBlend);
            state.camera.fov += (targetFov - state.camera.fov) * Math.min(1, dt * 16);
            state.camera.updateProjectionMatrix();
            state.camera.lookAt(viewTarget);
            state.camera.rotation.z += cameraKickRoll + chokeRoll;
        }

        function triggerFireAction(state) {
            if (!state.avatarRigApi || !state.avatarRigApi.rig || !state.avatarRigApi.rig.gun) return;

            var recoilProfile = options.getWeaponPresentation
                ? options.getWeaponPresentation(state.currentWeaponId)
                : null;
            var fallbackProfile = options.getWeaponPresentation
                ? options.getWeaponPresentation('rifle')
                : null;
            var recoil = recoilProfile && recoilProfile.recoil ? recoilProfile.recoil
                : ((fallbackProfile && fallbackProfile.recoil)
                    ? fallbackProfile.recoil
                    : { z: -0.05, x: -0.09, pitch: 0.018, yaw: 0.009, roll: 0.006, armR: 0.22, armL: 0.1, muzzleMs: 60 });
            var scopeMultiplier = 1 - (scopeBlend * 0.2);
            var yawKick = (Math.random() - 0.5) * recoil.yaw * scopeMultiplier;
            var rollKick = -yawKick * (recoil.roll / Math.max(recoil.yaw, 0.0001));

            gunRecoil += recoil.z * scopeMultiplier;
            palmRecoil += recoil.x * scopeMultiplier;
            cameraKickPitch += recoil.pitch * scopeMultiplier;
            cameraKickYaw += yawKick;
            cameraKickRoll += rollKick;
            firePoseKick += 1 * scopeMultiplier;

            if (state.actorVisual && state.actorVisual.setMuzzleVisible) {
                state.actorVisual.setMuzzleVisible(true);
                setTimeout(function () {
                    if (state.actorVisual && state.actorVisual.setMuzzleVisible) state.actorVisual.setMuzzleVisible(false);
                }, recoil.muzzleMs);
            }
            if (state.actorVisual && state.actorVisual.triggerAction) {
                state.actorVisual.triggerAction('fire', {
                    duration: recoil.muzzleMs / 1000,
                    strength: 0.9 + (Math.abs(recoil.z) * 4)
                });
            } else if (state.avatarRigApi && state.avatarRigApi.triggerAction) {
                state.avatarRigApi.triggerAction('fire', {
                    duration: recoil.muzzleMs / 1000,
                    strength: 0.9 + (Math.abs(recoil.z) * 4)
                });
            }
            if (state.avatarRigApi && state.avatarRigApi.rig) {
                if (state.avatarRigApi.rig.armR) state.avatarRigApi.rig.armR.rotation.x += recoil.x * recoil.armR;
                if (state.avatarRigApi.rig.armL) state.avatarRigApi.rig.armL.rotation.x += recoil.x * recoil.armL;
            }
        }

        function getMuzzleWorldPosition(state) {
            if (state.actorVisual && state.actorVisual.getMuzzleWorldPosition) {
                return state.actorVisual.getMuzzleWorldPosition();
            }
            if (state.avatarRigApi && state.avatarRigApi.getMuzzleWorldPosition) {
                return state.avatarRigApi.getMuzzleWorldPosition();
            }
            if (!state.camera) return null;
            state.camera.getWorldDirection(plasmaForwardDir);
            return state.camera.position.clone().addScaledVector(plasmaForwardDir, 0.65);
        }

        function getCoreWorldPosition(state) {
            if (state.actorVisual && state.actorVisual.getCoreWorldPosition) {
                return state.actorVisual.getCoreWorldPosition();
            }
            if (!state.camera) return null;
            return state.camera.position.clone().setY(state.camera.position.y - 0.6);
        }

        function getEyeWorldPosition(state) {
            if (state.actorVisual && state.actorVisual.getEyeWorldPosition) {
                return state.actorVisual.getEyeWorldPosition();
            }
            if (state.avatarRigApi && state.avatarRigApi.getEyeWorldPosition) {
                return state.avatarRigApi.getEyeWorldPosition();
            }
            if (!state.camera) return null;
            return state.camera.position.clone();
        }

        function getThrowableOriginWorldPosition(state) {
            if (state.actorVisual && state.actorVisual.getThrowableOriginWorldPosition) {
                return state.actorVisual.getThrowableOriginWorldPosition();
            }
            if (!state.camera) return null;
            state.camera.getWorldDirection(plasmaForwardDir);
            throwableRightDir.set(1, 0, 0).applyQuaternion(state.camera.quaternion);
            return state.camera.position.clone()
                .addScaledVector(plasmaForwardDir, 0.55)
                .addScaledVector(throwableRightDir, -0.34)
                .setY(state.camera.position.y - 0.58);
        }

        return {
            syncAvatarVisibility: syncAvatarVisibility,
            resetRecoilState: resetRecoilState,
            applyUnifiedGunOffsets: applyUnifiedGunOffsets,
            updateAvatarAnimation: updateAvatarAnimation,
            updateCamera: updateCamera,
            triggerFireAction: triggerFireAction,
            getMuzzleWorldPosition: getMuzzleWorldPosition,
            getCoreWorldPosition: getCoreWorldPosition,
            getEyeWorldPosition: getEyeWorldPosition,
            getThrowableOriginWorldPosition: getThrowableOriginWorldPosition,
            getScopeBlend: function () { return scopeBlend; },
            getAdsState: function (state) {
                return {
                    weaponId: state.currentWeaponId,
                    active: !!state.adsActive,
                    blend: scopeBlend,
                    sniper: !!state.sniperMode,
                    scopeActive: !!state.sniperMode && scopeBlend > 0.02
                };
            }
        };
    };

    runtime.GamePlayerView = GamePlayerView;
})();
