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
        var lastAnimationYaw = null;
        var recoilPatternPitch = 0;
        var recoilPatternYaw = 0;
        var recoilPatternRoll = 0;
        var activeRecoilProfile = null;
        var recoilPatternState = {
            type: '',
            strength: 0,
            elapsed: 0,
            duration: 0,
            side: 1
        };

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

        function syncAvatarVisibility(state) {
            if (!state.avatarGroup) return;

            var firstPersonView = !!state.firstPersonView;
            var avatarVisible = state.inspectMode
                ? !!state.avatarAliveVisible
                : state.avatarAliveVisible && !firstPersonView && (!state.sniperMode || scopeBlend < 0.55);
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
            lastAnimationYaw = null;
            cameraKickPitch = 0;
            cameraKickYaw = 0;
            cameraKickRoll = 0;
            firePoseKick = 0;
            recoilPatternPitch = 0;
            recoilPatternYaw = 0;
            recoilPatternRoll = 0;
            activeRecoilProfile = null;
            recoilPatternState.type = '';
            recoilPatternState.strength = 0;
            recoilPatternState.elapsed = 0;
            recoilPatternState.duration = 0;
            recoilPatternState.side = 1;
        }

        function defaultRecoilProfile() {
            return {
                z: -0.05,
                x: -0.09,
                pitch: 0.018,
                yaw: 0.009,
                roll: 0.006,
                armR: 0.22,
                armL: 0.1,
                muzzleMs: 60,
                pitchKickScale: 1,
                yawKickScale: 1,
                rollKickScale: 1,
                gunKickScale: 1,
                armKickScale: 1,
                pitchRecoverScale: 1,
                yawRecoverScale: 1,
                rollRecoverScale: 1,
                pattern: 'snap',
                patternStrength: 0
            };
        }

        function normalizeAngle(rad) {
            var out = Number(rad || 0);
            while (out > Math.PI) out -= Math.PI * 2;
            while (out < -Math.PI) out += Math.PI * 2;
            return out;
        }

        function recoilProfileForWeapon(weaponId) {
            var recoilProfile = options.getWeaponPresentation
                ? options.getWeaponPresentation(weaponId)
                : null;
            var fallbackProfile = options.getWeaponPresentation
                ? options.getWeaponPresentation('rifle')
                : null;
            return (recoilProfile && recoilProfile.recoil)
                ? recoilProfile.recoil
                : ((fallbackProfile && fallbackProfile.recoil) ? fallbackProfile.recoil : defaultRecoilProfile());
        }

        function patternDurationFor(type) {
            if (type === 'chatter') return 0.12;
            if (type === 'snap') return 0.16;
            if (type === 'push') return 0.18;
            if (type === 'slam') return 0.20;
            if (type === 'u_shape') return 0.28;
            return 0;
        }

        function updateRecoilPattern(dt) {
            if (!recoilPatternState.type || recoilPatternState.duration <= 0 || recoilPatternState.strength <= 0) {
                recoilPatternPitch = 0;
                recoilPatternYaw = 0;
                recoilPatternRoll = 0;
                return;
            }

            recoilPatternState.elapsed = Math.min(
                recoilPatternState.duration,
                recoilPatternState.elapsed + Math.max(0, Number(dt || 0))
            );
            var t = Math.max(0, Math.min(1, recoilPatternState.elapsed / Math.max(0.0001, recoilPatternState.duration)));
            var side = recoilPatternState.side || 1;
            var strength = recoilPatternState.strength;
            var arch = 4 * t * (1 - t);
            var sweep = Math.sin(Math.PI * t);

            if (recoilPatternState.type === 'chatter') {
                recoilPatternPitch = Math.sin(t * Math.PI * 4) * 0.0022 * strength * (1 - t);
                recoilPatternYaw = side * Math.sin(t * Math.PI * 3) * 0.0016 * strength * (1 - t);
                recoilPatternRoll = -side * Math.sin(t * Math.PI * 4) * 0.0014 * strength * (1 - t);
            } else if (recoilPatternState.type === 'snap') {
                recoilPatternPitch = sweep * 0.0034 * strength * (1 - (t * 0.35));
                recoilPatternYaw = side * sweep * 0.0014 * strength * (1 - t);
                recoilPatternRoll = -side * sweep * 0.0026 * strength * (1 - (t * 0.15));
            } else if (recoilPatternState.type === 'push') {
                recoilPatternPitch = sweep * 0.003 * strength * (1 - (t * 0.22));
                recoilPatternYaw = side * sweep * 0.0007 * strength * (1 - t);
                recoilPatternRoll = -side * sweep * 0.0012 * strength * (1 - (t * 0.25));
            } else if (recoilPatternState.type === 'slam') {
                recoilPatternPitch = sweep * 0.0046 * strength * (1 - (t * 0.1));
                recoilPatternYaw = side * sweep * 0.0018 * strength * (1 - (t * 0.45));
                recoilPatternRoll = -side * sweep * 0.0036 * strength * (1 - (t * 0.18));
            } else if (recoilPatternState.type === 'u_shape') {
                recoilPatternPitch = arch * 0.0064 * strength;
                recoilPatternYaw = side * sweep * 0.0022 * strength * (1 - (t * 0.2));
                recoilPatternRoll = -side * arch * 0.0031 * strength;
            } else {
                recoilPatternPitch = 0;
                recoilPatternYaw = 0;
                recoilPatternRoll = 0;
            }

            if (t >= 1) {
                recoilPatternState.type = '';
                recoilPatternState.strength = 0;
                recoilPatternState.duration = 0;
                recoilPatternState.elapsed = 0;
            }
        }

        function applyUnifiedGunOffsets(dt, avatarRigApi) {
            if (!avatarRigApi || !avatarRigApi.rig) return;

            var bobBlend = Math.min(1, dt * 12);
            gunBobX += (0 - gunBobX) * bobBlend;
            gunBobY += (0 - gunBobY) * bobBlend;

            var recoil = activeRecoilProfile || defaultRecoilProfile();
            var gunRecoverScale = Math.max(0.2, (Number(recoil.pitchRecoverScale || 1) + Number(recoil.rollRecoverScale || 1)) * 0.5);
            var palmRecoverScale = Math.max(0.2, (Number(recoil.pitchRecoverScale || 1) + Number(recoil.yawRecoverScale || 1)) * 0.5);
            var recoilBlend = Math.min(1, dt * 18 * gunRecoverScale);
            gunRecoil += (0 - gunRecoil) * recoilBlend;
            palmRecoil += (0 - palmRecoil) * Math.min(1, dt * 18 * palmRecoverScale);
            firePoseKick += (0 - firePoseKick) * Math.min(1, dt * 20 * Math.max(0.2, Number(recoil.pitchRecoverScale || 1)));

            var cameraKickPitchBlend = Math.min(1, dt * 14 * Math.max(0.2, Number(recoil.pitchRecoverScale || 1)));
            var cameraKickYawBlend = Math.min(1, dt * 16 * Math.max(0.2, Number(recoil.yawRecoverScale || 1)));
            var cameraKickRollBlend = Math.min(1, dt * 12 * Math.max(0.2, Number(recoil.rollRecoverScale || 1)));
            cameraKickPitch += (0 - cameraKickPitch) * cameraKickPitchBlend;
            cameraKickYaw += (0 - cameraKickYaw) * cameraKickYawBlend;
            cameraKickRoll += (0 - cameraKickRoll) * cameraKickRollBlend;
            updateRecoilPattern(dt);
        }

        function updateAvatarAnimation(dt, speed, state) {
            var animationApi = (state.actorVisual && state.actorVisual.updateAnimation)
                ? state.actorVisual
                : ((state.avatarRigApi && state.avatarRigApi.updateAnimation) ? state.avatarRigApi : null);
            if (!animationApi) return;
            var speedNorm = Math.max(0, Math.min(1.4, speed / state.runSpeed));
            var renderYaw = (typeof state.yaw === 'number') ? Number(state.yaw || 0) : 0;
            var turnRate = 0;
            if (Math.max(0, Number(dt || 0)) > 0 && typeof lastAnimationYaw === 'number') {
                turnRate = normalizeAngle(renderYaw - lastAnimationYaw) / Math.max(0.0001, Number(dt || 0));
            }
            lastAnimationYaw = renderYaw;
            animationApi.updateAnimation(dt, {
                speedNorm: speedNorm,
                sprinting: state.sprinting,
                fastBackpedal: !!state.fastBackpedal,
                airborne: !state.isGrounded,
                footY: typeof state.footY === 'number' ? Number(state.footY) : null,
                aimPitch: state.pitch + (cameraKickPitch * 0.35),
                horizontalSpeed: speed,
                worldSpeed: speed,
                yaw: renderYaw,
                turnRate: turnRate,
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

        function updateViewBlendState(dt, state) {
            var scopeTargetActive = !!(state && (state.scopeTargetActive != null ? state.scopeTargetActive : state.adsActive));
            if (!scopeTargetActive) {
                scopeBlend = 0;
                var sprintBlend = (!state.sniperMode && state.sprinting)
                    ? Math.max(0, Math.min(1, Number(state.speedNorm || 0)))
                    : 0;
                sprintFovBlend += (sprintBlend - sprintFovBlend) * Math.min(1, dt * 10);
                if (Math.abs(sprintFovBlend) < 0.001) sprintFovBlend = 0;
                return false;
            }

            var targetScopeBlend = 1;
            var blendSpeed = state.sniperMode ? state.sniperScopeBlendSpeed : state.adsBlendSpeed;
            scopeBlend += (targetScopeBlend - scopeBlend) * Math.min(1, dt * blendSpeed);
            if (Math.abs(scopeBlend) < 0.001) scopeBlend = 0;
            if (Math.abs(1 - scopeBlend) < 0.001) scopeBlend = 1;

            var targetSprintFovBlend = (!scopeTargetActive && !state.sniperMode && state.sprinting)
                ? Math.max(0, Math.min(1, Number(state.speedNorm || 0)))
                : 0;
            sprintFovBlend += (targetSprintFovBlend - sprintFovBlend) * Math.min(1, dt * 10);
            if (Math.abs(sprintFovBlend) < 0.001) sprintFovBlend = 0;

            return !!(state.sniperMode && scopeBlend > 0.55);
        }

        function resolveViewTargetPosition(state, forwardX, forwardY, forwardZ) {
            viewTarget.set(state.playerX + forwardX * 20, state.posY + forwardY * 20, state.playerZ + forwardZ * 20);
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

        function firstPersonForwardOffset(state) {
            var raw = Number(state.firstPersonForwardOffset);
            if (isFinite(raw)) return raw;
            var shared = runtime.GameShared || {};
            var constants = shared.entityConstants || {};
            var avatarHeadDepth = Number(constants.AVATAR_HEAD_SIZE && constants.AVATAR_HEAD_SIZE.z || 0.55);
            var hitboxHeadDepth = Number(constants.HEAD_HITBOX_SIZE && constants.HEAD_HITBOX_SIZE.z || 0);
            return (Math.max(0.55, avatarHeadDepth, hitboxHeadDepth) * 0.5) + 0.14;
        }

        function resolveEyeViewOrigin(state) {
            if (state.avatarRigApi && state.avatarRigApi.getEyeWorldPosition) {
                state.avatarRigApi.getEyeWorldPosition(eyeWorld);
                viewOrigin.copy(eyeWorld);
            } else {
                viewOrigin.set(state.playerX, state.posY, state.playerZ);
            }
        }

        function resolveViewOriginAndDesired(state, scopedEyeMode, forwardX, forwardY, forwardZ, rightX, rightZ) {
            if (scopedEyeMode || state.firstPersonView) {
                resolveEyeViewOrigin(state);
                var forwardOffset = scopedEyeMode ? 0 : firstPersonForwardOffset(state);
                viewDesired.set(
                    viewOrigin.x + (forwardX * forwardOffset),
                    viewOrigin.y + (forwardY * forwardOffset),
                    viewOrigin.z + (forwardZ * forwardOffset)
                );
                viewTarget.set(
                    viewDesired.x + (forwardX * 20),
                    viewDesired.y + (forwardY * 20),
                    viewDesired.z + (forwardZ * 20)
                );
                return;
            }

            viewOrigin.set(state.playerX, state.posY + 0.3, state.playerZ);
            viewDesired.set(
                state.playerX + (rightX * state.cameraShoulder) - (forwardX * state.cameraDist),
                state.posY + state.thirdHeight,
                state.playerZ + (rightZ * state.cameraShoulder) - (forwardZ * state.cameraDist)
            );
            adsDesired.set(
                state.playerX + (rightX * (state.sniperMode ? state.sniperScopeShoulder : state.adsShoulder)) - (forwardX * (state.sniperMode ? state.sniperScopeDist : state.adsDist)),
                state.posY + (state.sniperMode ? state.sniperScopeHeight : state.adsHeight),
                state.playerZ + (rightZ * (state.sniperMode ? state.sniperScopeShoulder : state.adsShoulder)) - (forwardZ * (state.sniperMode ? state.sniperScopeDist : state.adsDist))
            );
            viewDesired.lerp(adsDesired, scopeBlend);
            applyCameraCollision(state);
        }

        function applyCameraPose(state, dt, scopedEyeMode) {
            var firstPersonPose = scopedEyeMode || !!state.firstPersonView;
            if (!thirdCameraInitialized) {
                state.camera.position.copy(viewDesired);
                thirdCameraInitialized = true;
            } else {
                state.camera.position.lerp(viewDesired, Math.min(1, dt * (firstPersonPose ? state.firstPersonSmooth : state.thirdSmooth)));
            }

            var scopedFov = state.adsFovForWeapon ? state.adsFovForWeapon(state.currentWeaponId) : state.adsFov;
            var sprintFovBoost = Number(state.cameraFov || 75) * 0.04;
            var targetFov = state.cameraFov + (sprintFovBoost * sprintFovBlend) + ((scopedFov - state.cameraFov) * scopeBlend);
            state.camera.fov += (targetFov - state.camera.fov) * Math.min(1, dt * 16);
            state.camera.updateProjectionMatrix();
            state.camera.lookAt(viewTarget);
            state.camera.rotation.z += cameraKickRoll + recoilPatternRoll;
        }

        function updateInspectCamera(dt, state) {
            scopeBlend = 0;
            sprintFovBlend = 0;
            if (state.updateAvatarPose) state.updateAvatarPose();
            syncAvatarVisibility(state);

            var targetY = Number(state.inspectTargetY);
            if (!isFinite(targetY)) targetY = Number(state.posY || 0) - 0.25;
            var orbitYaw = Number(state.inspectOrbitYaw != null ? state.inspectOrbitYaw : 0);
            var orbitPitch = Math.max(-0.7, Math.min(0.85, Number(state.inspectOrbitPitch != null ? state.inspectOrbitPitch : 0.18)));
            var distance = Math.max(1.5, Number(state.inspectOrbitDistance != null ? state.inspectOrbitDistance : 5));
            var horizontal = Math.cos(orbitPitch) * distance;

            viewOrigin.set(state.playerX, targetY, state.playerZ);
            viewTarget.copy(viewOrigin);
            viewDesired.set(
                state.playerX + (Math.sin(orbitYaw) * horizontal),
                targetY + (Math.sin(orbitPitch) * distance),
                state.playerZ + (Math.cos(orbitYaw) * horizontal)
            );
            applyCameraCollision(state);

            if (!thirdCameraInitialized) {
                state.camera.position.copy(viewDesired);
                thirdCameraInitialized = true;
            } else {
                state.camera.position.lerp(viewDesired, Math.min(1, dt * Number(state.inspectSmooth || 18)));
            }

            var targetFov = Number(state.inspectFov || 58);
            state.camera.fov += (targetFov - state.camera.fov) * Math.min(1, dt * 16);
            state.camera.updateProjectionMatrix();
            state.camera.lookAt(viewTarget);
        }

        function updateCamera(dt, state) {
            if (!state.camera) return;
            updateMuzzleFlash(dt, state);
            if (state.inspectMode) {
                updateInspectCamera(dt, state);
                return;
            }

            var renderYaw = state.yaw + cameraKickYaw + recoilPatternYaw;
            var renderPitch = Math.max(-state.pitchLimit, Math.min(state.pitchLimit, state.pitch + cameraKickPitch + recoilPatternPitch));
            var cosPitch = Math.cos(renderPitch);
            var forwardX = -Math.sin(renderYaw) * cosPitch;
            var forwardY = Math.sin(renderPitch);
            var forwardZ = -Math.cos(renderYaw) * cosPitch;
            var rightX = Math.cos(renderYaw);
            var rightZ = -Math.sin(renderYaw);
            var scopedEyeMode = updateViewBlendState(dt, state);
            if (state.updateAvatarPose) state.updateAvatarPose();
            syncAvatarVisibility(state);

            resolveViewTargetPosition(state, forwardX, forwardY, forwardZ);
            resolveViewOriginAndDesired(state, scopedEyeMode, forwardX, forwardY, forwardZ, rightX, rightZ);
            applyCameraPose(state, dt, scopedEyeMode);
        }

        function triggerFireAction(state) {
            var recoil = recoilProfileForWeapon(state.currentWeaponId);
            var scopeMultiplier = 1 - (scopeBlend * 0.2);
            var kickSide = Math.random() < 0.5 ? -1 : 1;
            var armKickScale = Math.max(0, Number(recoil.armKickScale || 1));
            var yawKick = kickSide * (0.5 + (Math.random() * 0.5)) * recoil.yaw * scopeMultiplier * Math.max(0, Number(recoil.yawKickScale || 1));
            var rollKick = (-yawKick * (recoil.roll / Math.max(recoil.yaw, 0.0001)) * Math.max(0, Number(recoil.rollKickScale || 1))) +
                (kickSide * recoil.roll * 0.35 * scopeMultiplier * Math.max(0, Number(recoil.rollKickScale || 1)));

            gunRecoil += recoil.z * scopeMultiplier * Math.max(0, Number(recoil.gunKickScale || 1));
            palmRecoil += recoil.x * scopeMultiplier * armKickScale;
            cameraKickPitch += recoil.pitch * scopeMultiplier * Math.max(0, Number(recoil.pitchKickScale || 1));
            cameraKickYaw += yawKick;
            cameraKickRoll += rollKick;
            firePoseKick += 1 * scopeMultiplier * armKickScale;
            activeRecoilProfile = recoil;

            recoilPatternState.type = String(recoil.pattern || '');
            recoilPatternState.strength = Math.max(0, Number(recoil.patternStrength || 0)) * scopeMultiplier;
            var scopeTargetActive = !!(state && (state.scopeTargetActive != null ? state.scopeTargetActive : state.adsActive));
            if (state.currentWeaponId === 'sniper' && !scopeTargetActive) {
                recoilPatternState.type = '';
                recoilPatternState.strength = 0;
            }
            recoilPatternState.elapsed = 0;
            recoilPatternState.duration = patternDurationFor(recoilPatternState.type);
            recoilPatternState.side = kickSide;
            recoilPatternPitch = 0;
            recoilPatternYaw = 0;
            recoilPatternRoll = 0;

            muzzleFlashTimer = Math.max(0, Number(recoil.muzzleMs || 0)) / 1000;
            setMuzzleVisible(state, muzzleFlashTimer > 0);
            var fireActionOptions = {
                duration: recoil.muzzleMs / 1000,
                strength: 0.9 + (Math.abs(recoil.z) * 4 * Math.max(0, Number(recoil.gunKickScale || 1))),
                weaponKick: recoil.z * scopeMultiplier * Math.max(0, Number(recoil.gunKickScale || 1)) * 1.5625,
                shoulderPitch: 0,
                shoulderYaw: 0,
                shoulderRoll: 0,
                lowerArmPitch: Math.max(0.04, Number(recoil.armR || 0.18) * 0.585) * scopeMultiplier * armKickScale * 6,
                side: kickSide,
                recoverPitchScale: Math.max(0.2, Number(recoil.pitchRecoverScale || 1)),
                recoverYawScale: Math.max(0.2, Number(recoil.yawRecoverScale || 1)),
                recoverRollScale: Math.max(0.2, Number(recoil.rollRecoverScale || 1))
            };
            if (state.actorVisual && state.actorVisual.triggerAction) {
                state.actorVisual.triggerAction('fire', fireActionOptions);
            } else if (state.avatarRigApi && state.avatarRigApi.triggerAction) {
                state.avatarRigApi.triggerAction('fire', fireActionOptions);
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
                var scopeTargetActive = !!(state && (state.scopeTargetActive != null ? state.scopeTargetActive : state.adsActive));
                var sniperMode = !!(state && state.sniperMode);
                var ready = sniperMode && scopeTargetActive && scopeBlend >= 0.995;
                return {
                    weaponId: state.currentWeaponId,
                    active: scopeTargetActive,
                    blend: scopeBlend,
                    sniper: sniperMode,
                    scopeActive: sniperMode && scopeBlend > 0.02,
                    ready: ready,
                    phase: !sniperMode ? 'inactive' : (ready ? 'ready' : (scopeTargetActive ? 'equipping' : 'inactive'))
                };
            },
            cancelScope: function () {
                scopeBlend = 0;
            }
        };
    };

    runtime.GamePlayerView = GamePlayerView;
})();
