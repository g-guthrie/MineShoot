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
        var muzzleFlashTimer = 0;

        var viewOrigin = new THREE.Vector3();
        var viewDesired = new THREE.Vector3();
        var viewTarget = new THREE.Vector3();
        var adsDesired = new THREE.Vector3();
        var viewDir = new THREE.Vector3();
        var eyeWorld = new THREE.Vector3();
        var plasmaForwardDir = new THREE.Vector3();
        var throwableRightDir = new THREE.Vector3();
        var fallbackMuzzleWorld = new THREE.Vector3();
        var fallbackCoreWorld = new THREE.Vector3();
        var fallbackEyeWorld = new THREE.Vector3();
        var fallbackThrowableWorld = new THREE.Vector3();
        var viewRay = new THREE.Raycaster();
        var chokeCameraState = {
            offsetX: 0,
            offsetZ: 0,
            roll: 0
        };

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
            var animationApi = (state.actorVisual && state.actorVisual.updateAnimation)
                ? state.actorVisual
                : ((state.avatarRigApi && state.avatarRigApi.updateAnimation) ? state.avatarRigApi : null);
            if (!animationApi) return;
            var speedNorm = Math.max(0, Math.min(1.4, speed / state.runSpeed));
            var activeWeaponState = options.getCurrentWeaponState ? options.getCurrentWeaponState() : null;
            var reloadPresentation = {
                reloading: false,
                reloadPct: 1,
                phase: 'ready',
                phasePct: 1
            };
            if (activeWeaponState) {
                if (typeof activeWeaponState.reloadPct === 'number' && typeof activeWeaponState.reloadPhase === 'string') {
                    reloadPresentation = {
                        reloading: !!activeWeaponState.reloading,
                        reloadPct: Math.max(0, Math.min(1, Number(activeWeaponState.reloadPct || 0))),
                        phase: String(activeWeaponState.reloadPhase || 'ready'),
                        phasePct: Math.max(0, Math.min(1, Number(activeWeaponState.reloadPhasePct != null ? activeWeaponState.reloadPhasePct : 1)))
                    };
                } else {
                    var shared = runtime.GameShared || {};
                    var presentation = options.getWeaponPresentation && activeWeaponState.id
                        ? options.getWeaponPresentation(activeWeaponState.id)
                        : null;
                    if (shared.resolveReloadPresentationState) {
                        reloadPresentation = shared.resolveReloadPresentationState({
                            reloadMs: Number(activeWeaponState.reloadMs || 0),
                            reloadRemaining: Number(activeWeaponState.reloadRemaining || 0),
                            reloadedFlashRemaining: Number(activeWeaponState.reloadedFlashRemaining || 0),
                            reload: presentation && presentation.reload ? presentation.reload : null
                        }, null);
                    } else {
                        reloadPresentation = {
                            reloading: !!activeWeaponState.reloading,
                            reloadPct: Number(activeWeaponState.reloadRemaining || 0) > 0
                                ? Math.max(0, Math.min(1, 1 - (Math.max(0, Number(activeWeaponState.reloadRemaining || 0)) / Math.max(1, Number(activeWeaponState.reloadMs || 1)))))
                                : 1,
                            phase: Number(activeWeaponState.reloadedFlashRemaining || 0) > 0 ? 'complete' : 'ready',
                            phasePct: 1
                        };
                    }
                }
            }
            animationApi.updateAnimation(dt, {
                speedNorm: speedNorm,
                sprinting: state.sprinting,
                airborne: !state.isGrounded,
                aimPitch: state.pitch + (cameraKickPitch * 0.35),
                hooked: !!state.hooked,
                hookStartedAt: state.hookPullStartedAt || 0,
                choked: !!state.choked,
                startedAt: state.chokeStartedAt || 0,
                adsActive: !!state.adsActive,
                reloading: !!reloadPresentation.reloading,
                reloadPct: reloadPresentation.reloadPct,
                reloadPhase: reloadPresentation.phase,
                reloadPhasePct: reloadPresentation.phasePct,
                worldSpeed: speed,
                movingForward: !!state.movingForward,
                movingBackward: !!state.movingBackward,
                movingLeft: !!state.movingLeft,
                movingRight: !!state.movingRight
            });
        }

        function setMuzzleVisible(state, visible) {
            if (state.actorVisual && state.actorVisual.setMuzzleVisible) {
                state.actorVisual.setMuzzleVisible(visible);
                return true;
            }
            if (state.avatarRigApi && state.avatarRigApi.setMuzzleVisible) {
                state.avatarRigApi.setMuzzleVisible(visible);
                return true;
            }
            return false;
        }

        function updateMuzzleFlash(dt, state) {
            if (!(muzzleFlashTimer > 0)) return;
            muzzleFlashTimer -= Math.max(0, Number(dt || 0));
            if (muzzleFlashTimer > 0) return;
            muzzleFlashTimer = 0;
            setMuzzleVisible(state, false);
        }

        function resolveChokeCameraState(state) {
            chokeCameraState.offsetX = 0;
            chokeCameraState.offsetZ = 0;
            chokeCameraState.roll = 0;
            if (!state.choked) return chokeCameraState;

            var chokeStamp = Date.now();
            var chokePhase = state.chokeStartedAt
                ? ((chokeStamp - state.chokeStartedAt) * 0.012)
                : (chokeStamp * 0.012);
            chokeCameraState.offsetX = Math.sin(chokePhase) * 0.08;
            chokeCameraState.offsetZ = Math.cos(chokePhase * 0.8) * 0.04;
            chokeCameraState.roll = Math.sin(chokePhase * 0.9) * 0.028;
            return chokeCameraState;
        }

        function updateViewBlendState(dt, state) {
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

            return !!(state.sniperMode && scopeBlend > 0.55);
        }

        function resolveViewTargetPosition(state, forwardX, forwardY, forwardZ, rightX, rightZ, chokeState) {
            viewTarget.set(state.playerX + forwardX * 20, state.posY + forwardY * 20, state.playerZ + forwardZ * 20);
            viewTarget.y += state.chokeLift;
            viewTarget.x += rightX * chokeState.offsetX;
            viewTarget.z += rightZ * chokeState.offsetX;
        }

        function applyCameraCollision(state) {
            var worldMeshes = state.getWorldCollidables ? state.getWorldCollidables() : [];
            if (!worldMeshes || worldMeshes.length === 0) return;

            viewDir.copy(viewDesired).sub(viewOrigin);
            var dist = viewDir.length();
            if (dist <= 0.001) return;

            viewDir.divideScalar(dist);
            viewRay.set(viewOrigin, viewDir);
            viewRay.far = dist;
            var hits = viewRay.intersectObjects(worldMeshes, false);
            if (hits.length <= 0) return;

            var safeDist = Math.max(0.8, hits[0].distance - 0.2);
            viewDesired.copy(viewOrigin).addScaledVector(viewDir, safeDist);
        }

        function resolveViewOriginAndDesired(state, scopedEyeMode, forwardX, forwardZ, rightX, rightZ, chokeState) {
            if (scopedEyeMode) {
                if (state.avatarRigApi && state.avatarRigApi.getEyeWorldPosition) {
                    state.avatarRigApi.getEyeWorldPosition(eyeWorld);
                    viewOrigin.copy(eyeWorld);
                } else {
                    viewOrigin.set(state.playerX, state.posY + state.chokeLift, state.playerZ);
                }
                viewDesired.copy(viewOrigin);
                viewDesired.x += rightX * chokeState.offsetX;
                viewDesired.z += rightZ * chokeState.offsetX;
                return;
            }

            viewOrigin.set(state.playerX, state.posY + 0.3 + state.chokeLift, state.playerZ);
            viewDesired.set(
                state.playerX + (rightX * state.cameraShoulder) - (forwardX * state.cameraDist),
                state.posY + state.thirdHeight + state.chokeLift,
                state.playerZ + (rightZ * state.cameraShoulder) - (forwardZ * state.cameraDist)
            );
            viewDesired.x += rightX * chokeState.offsetX;
            viewDesired.z += rightZ * chokeState.offsetX + chokeState.offsetZ;
            adsDesired.set(
                state.playerX + (rightX * (state.sniperMode ? state.sniperScopeShoulder : state.adsShoulder)) - (forwardX * (state.sniperMode ? state.sniperScopeDist : state.adsDist)),
                state.posY + (state.sniperMode ? state.sniperScopeHeight : state.adsHeight) + state.chokeLift,
                state.playerZ + (rightZ * (state.sniperMode ? state.sniperScopeShoulder : state.adsShoulder)) - (forwardZ * (state.sniperMode ? state.sniperScopeDist : state.adsDist))
            );
            adsDesired.x += rightX * chokeState.offsetX;
            adsDesired.z += rightZ * chokeState.offsetX + chokeState.offsetZ;
            viewDesired.lerp(adsDesired, scopeBlend);
            applyCameraCollision(state);
        }

        function applyCameraPose(state, dt, scopedEyeMode, chokeRoll) {
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

        function updateCamera(dt, state) {
            if (!state.camera) return;
            updateMuzzleFlash(dt, state);

            var renderYaw = state.yaw + cameraKickYaw;
            var renderPitch = Math.max(-state.pitchLimit, Math.min(state.pitchLimit, state.pitch + cameraKickPitch));
            var cosPitch = Math.cos(renderPitch);
            var forwardX = -Math.sin(renderYaw) * cosPitch;
            var forwardY = Math.sin(renderPitch);
            var forwardZ = -Math.cos(renderYaw) * cosPitch;
            var rightX = Math.cos(renderYaw);
            var rightZ = -Math.sin(renderYaw);
            var chokeState = resolveChokeCameraState(state);
            var scopedEyeMode = updateViewBlendState(dt, state);
            syncAvatarVisibility(state);
            if (state.updateAvatarPose) state.updateAvatarPose();

            resolveViewTargetPosition(state, forwardX, forwardY, forwardZ, rightX, rightZ, chokeState);
            resolveViewOriginAndDesired(state, scopedEyeMode, forwardX, forwardZ, rightX, rightZ, chokeState);
            applyCameraPose(state, dt, scopedEyeMode, chokeState.roll);
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

            muzzleFlashTimer = Math.max(0, Number(recoil.muzzleMs || 0)) / 1000;
            setMuzzleVisible(state, muzzleFlashTimer > 0);
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

        function getMuzzleWorldPosition(state, outVec3) {
            if (state.actorVisual && state.actorVisual.getMuzzleWorldPosition) {
                return state.actorVisual.getMuzzleWorldPosition(outVec3);
            }
            if (state.avatarRigApi && state.avatarRigApi.getMuzzleWorldPosition) {
                return state.avatarRigApi.getMuzzleWorldPosition(outVec3);
            }
            if (!state.camera) return null;
            var out = outVec3 || fallbackMuzzleWorld;
            state.camera.getWorldDirection(plasmaForwardDir);
            return out.copy(state.camera.position).addScaledVector(plasmaForwardDir, 0.65);
        }

        function getCoreWorldPosition(state, outVec3) {
            if (state.actorVisual && state.actorVisual.getCoreWorldPosition) {
                return state.actorVisual.getCoreWorldPosition(outVec3);
            }
            if (!state.camera) return null;
            var out = outVec3 || fallbackCoreWorld;
            return out.copy(state.camera.position).setY(state.camera.position.y - 0.6);
        }

        function getEyeWorldPosition(state, outVec3) {
            if (state.actorVisual && state.actorVisual.getEyeWorldPosition) {
                return state.actorVisual.getEyeWorldPosition(outVec3);
            }
            if (state.avatarRigApi && state.avatarRigApi.getEyeWorldPosition) {
                return state.avatarRigApi.getEyeWorldPosition(outVec3);
            }
            if (!state.camera) return null;
            var out = outVec3 || fallbackEyeWorld;
            return out.copy(state.camera.position);
        }

        function getThrowableOriginWorldPosition(state, outVec3) {
            if (state.actorVisual && state.actorVisual.getThrowableOriginWorldPosition) {
                return state.actorVisual.getThrowableOriginWorldPosition(outVec3);
            }
            if (!state.camera) return null;
            var out = outVec3 || fallbackThrowableWorld;
            state.camera.getWorldDirection(plasmaForwardDir);
            throwableRightDir.set(1, 0, 0).applyQuaternion(state.camera.quaternion);
            return out.copy(state.camera.position)
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
