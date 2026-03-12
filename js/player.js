/**
 * player.js - WASD movement, third-person camera, variable jump, weapon model
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayer
 */
(function () {
    'use strict';

    var GamePlayer = {};

    var camera = null;
    var yaw = 0;
    var pitch = 0;
    var playerWorld = null;
    var playerView = null;

    var sharedGameplay = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning;
    var movementTuning = sharedGameplay && sharedGameplay.movement ? sharedGameplay.movement : {};
    var entityConstants = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityConstants
        ? globalThis.__MAYHEM_RUNTIME.GameShared.entityConstants
        : {};

    function selectableWeaponIds() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var selected = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : null;
        return Array.isArray(selected) && selected.length ? selected : ['rifle'];
    }

    function adsFovForWeapon(weaponId) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var weaponStats = shared.getWeaponStats ? shared.getWeaponStats(weaponId) : null;
        if (shared.resolveWeaponAdsFovDeg) {
            return Number(shared.resolveWeaponAdsFovDeg(weaponStats || { id: weaponId })) || ADS_FOV;
        }
        return weaponId === 'sniper' ? SNIPER_SCOPE_FOV : ADS_FOV;
    }

    function weaponPresentationFor(weaponId) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        return shared.getWeaponPresentation ? shared.getWeaponPresentation(weaponId) : null;
    }

    var EYE_HEIGHT = Number(entityConstants.EYE_HEIGHT || 1.6);
    var JOG_SPEED = Number(movementTuning.jogSpeed || 8);
    var RUN_SPEED = Number(movementTuning.runSpeed || 14);
    var JUMP_VELOCITY = Number(movementTuning.jumpVelocity || 8.8);
    var JUMP_HOLD_ACCEL = Number(movementTuning.jumpHoldAccel || 16);
    var MAX_JUMP_HOLD = Number(movementTuning.maxJumpHold || 0.2);
    var JUMP_RELEASE_MULT = Number(movementTuning.jumpReleaseMult || 0.42);
    var GRAVITY = Number(movementTuning.gravity || 18);
    var MOUSE_SENSITIVITY = 0.002;
    var PITCH_LIMIT = 89 * (Math.PI / 180);

    var PLAYER_RADIUS = Number(entityConstants.PLAYER_RADIUS || 0.35);
    var PLAYER_HEIGHT = Number(entityConstants.PLAYER_HEIGHT || 1.7);
    var EPSILON = 0.001;

    var THIRD_HEIGHT = 0.7;
    var THIRD_SMOOTH = 12;
    var CAMERA_DIST = 4.4 * 0.85;
    var CAMERA_SHOULDER = 1.35 * 1.3;
    var CAMERA_FOV = 75;
    var FIRST_PERSON_SMOOTH = 20;
    var ADS_FOV = 56;
    var ADS_DIST = 1.72;
    var ADS_SHOULDER = 2;
    var ADS_HEIGHT = 0.46;
    var ADS_BLEND_SPEED = 16;
    var ADS_MOVE_MULT = Number(movementTuning.adsMoveMult || 0.4);
    var ADS_SENSITIVITY_MULT = 0.7;
    var SNIPER_SCOPE_FOV = 24;
    var SNIPER_SCOPE_DIST = 0.14;
    var SNIPER_SCOPE_SHOULDER = 0.08;
    var SNIPER_SCOPE_HEIGHT = 0.12;
    var SNIPER_SCOPE_BLEND_SPEED = 18;
    var SNIPER_SCOPE_SENSITIVITY_MULT = 0.42;

    var playerX = 25;
    var playerZ = 45;
    var velocityY = 0;
    var posY = EYE_HEIGHT;
    var isGrounded = true;
    var jumpHoldTimer = 0;
    var jumpPressedLastFrame = false;
    var sprintPressedLastFrame = false;
    var scopeHeld = false;

    var keys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false
    };
    var inputBound = false;

    var currentWeaponId = 'rifle';

    var avatarGroup = null;
    var avatarRig = null;
    var avatarRigApi = null;
    var actorVisual = null;
    var sceneRef = null;
    var hitboxVisible = false;

    var bobTimer = 0;
    var isMoving = false;
    var sprinting = false;
    var lastMoveSpeedNorm = 0;
    var loadoutSlots = selectableWeaponIds();
    var pendingViewSync = false;

    var lastReplayAckSeq = 0;
    var avatarAliveVisible = true;
    var statusState = {
        stunUntil: 0,
        hookPullStartedAt: 0,
        hookPullUntil: 0,
        chokeStartedAt: 0,
        chokeUntil: 0,
        chokeLift: 0,
        spawnShieldUntil: 0,
        weaponUntil: 0,
        throwableUntil: 0,
        abilityUntil: 0
    };

    function hasInputCapture() {
        return !!document.pointerLockElement;
    }

    function movementHelper() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        return shared.authoritativeMovement || null;
    }

    function reconciliationHelper() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        return shared.authoritativeReconciliation || null;
    }

    function nowMs() {
        return Date.now();
    }

    function worldHelper() {
        if (playerWorld) return playerWorld;
        var helper = globalThis.__MAYHEM_RUNTIME.GamePlayerWorld || null;
        if (!helper || !helper.create) return null;
        playerWorld = helper.create({
            playerRadius: PLAYER_RADIUS,
            playerHeight: PLAYER_HEIGHT,
            epsilon: EPSILON
        });
        return playerWorld;
    }

    function viewHelper() {
        if (playerView) return playerView;
        var helper = globalThis.__MAYHEM_RUNTIME.GamePlayerView || null;
        if (!helper || !helper.create) return null;
        playerView = helper.create({
            getCurrentWeaponState: function () {
                return globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon
                    ? globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon()
                    : null;
            },
            getWeaponPresentation: function (weaponId) {
                return weaponPresentationFor(weaponId);
            }
        });
        return playerView;
    }

    function isStunned(now) {
        return Number(statusState.stunUntil || 0) > Number(now || nowMs());
    }

    function isHookPulled(now) {
        return Number(statusState.hookPullUntil || 0) > Number(now || nowMs());
    }

    function isChoked(now) {
        return Number(statusState.chokeUntil || 0) > Number(now || nowMs());
    }

    function isSpawnShielded(now) {
        return Number(statusState.spawnShieldUntil || 0) > Number(now || nowMs());
    }

    function actionRestrictionUntil(actionType) {
        if (actionType === 'weapon') return Number(statusState.weaponUntil || 0);
        if (actionType === 'throwable') return Number(statusState.throwableUntil || 0);
        if (actionType === 'ability') return Number(statusState.abilityUntil || 0);
        return 0;
    }

    function isActionRestricted(actionType, now) {
        return actionRestrictionUntil(actionType) > Number(now || nowMs());
    }

    function isMovementLocked(now) {
        return isStunned(now) || isHookPulled(now) || isChoked(now);
    }

    function isActionLocked(now) {
        return isMovementLocked(now) ||
            isActionRestricted('weapon', now) ||
            isActionRestricted('throwable', now) ||
            isActionRestricted('ability', now);
    }

    function canUseWeapon(now) {
        return !isMovementLocked(now) && !isActionRestricted('weapon', now);
    }

    function canUseThrowable(now) {
        return !isMovementLocked(now) && !isActionRestricted('throwable', now);
    }

    function canUseAbility(now) {
        return !isMovementLocked(now) && !isActionRestricted('ability', now);
    }

    function clearExpiredStatusState(now) {
        var stamp = Number(now || nowMs());
        if (!isStunned(stamp)) statusState.stunUntil = 0;
        if (!isHookPulled(stamp)) statusState.hookPullUntil = 0;
        if (!isHookPulled(stamp)) statusState.hookPullStartedAt = 0;
        if (!isChoked(stamp)) {
            statusState.chokeStartedAt = 0;
            statusState.chokeUntil = 0;
            statusState.chokeLift = 0;
        }
        if (!isSpawnShielded(stamp)) statusState.spawnShieldUntil = 0;
        if (!isActionRestricted('weapon', stamp)) statusState.weaponUntil = 0;
        if (!isActionRestricted('throwable', stamp)) statusState.throwableUntil = 0;
        if (!isActionRestricted('ability', stamp)) statusState.abilityUntil = 0;
    }

    function applyStatusState(patch) {
        patch = patch || {};
        if (typeof patch.stunUntil === 'number') statusState.stunUntil = Number(patch.stunUntil || 0);
        if (typeof patch.hookPullStartedAt === 'number') statusState.hookPullStartedAt = Number(patch.hookPullStartedAt || 0);
        if (typeof patch.hookPullUntil === 'number') statusState.hookPullUntil = Number(patch.hookPullUntil || 0);
        if (typeof patch.chokeStartedAt === 'number') statusState.chokeStartedAt = Number(patch.chokeStartedAt || 0);
        if (typeof patch.chokeUntil === 'number') statusState.chokeUntil = Number(patch.chokeUntil || 0);
        if (typeof patch.chokeLift === 'number') statusState.chokeLift = Number(patch.chokeLift || 0);
        if (typeof patch.spawnShieldUntil === 'number') statusState.spawnShieldUntil = Number(patch.spawnShieldUntil || 0);
        if (typeof patch.weaponUntil === 'number') statusState.weaponUntil = Number(patch.weaponUntil || 0);
        if (typeof patch.throwableUntil === 'number') statusState.throwableUntil = Number(patch.throwableUntil || 0);
        if (typeof patch.abilityUntil === 'number') statusState.abilityUntil = Number(patch.abilityUntil || 0);
        clearExpiredStatusState(nowMs());
        setSpawnShieldVisual(isSpawnShielded());
    }

    function chokeLiftAt(now) {
        var stamp = Number(now || nowMs());
        if (!isChoked(stamp)) return 0;
        var abilityFxView = globalThis.__MAYHEM_RUNTIME.GameAbilityFx || null;
        if (abilityFxView && abilityFxView.chokeLiftAt) {
            return abilityFxView.chokeLiftAt({
                startedAt: statusState.chokeStartedAt || 0,
                endsAt: statusState.chokeUntil || 0,
                chokeLift: statusState.chokeLift || 0
            }, stamp);
        }
        return 0;
    }

    function activeChokeLift() {
        return chokeLiftAt(nowMs());
    }

    function weaponSupportsAds() {
        return currentWeaponId === 'rifle' ||
            currentWeaponId === 'pistol' ||
            currentWeaponId === 'machinegun' ||
            currentWeaponId === 'shotgun' ||
            currentWeaponId === 'sniper';
    }

    function isSniperScopeWeapon() {
        return currentWeaponId === 'sniper';
    }

    function canUseAds() {
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.isAdsBlocked && globalThis.__MAYHEM_RUNTIME.GameHitscan.isAdsBlocked()) {
            return false;
        }
        return weaponSupportsAds() && hasInputCapture();
    }

    function isAdsActive() {
        return canUseAds() && scopeHeld;
    }

    function setAdsEnabled(enabled) {
        scopeHeld = !!enabled && canUseAds();
        return scopeHeld;
    }

    function toggleAds() {
        if (!canUseAds()) {
            scopeHeld = false;
            return false;
        }
        scopeHeld = !scopeHeld;
        return scopeHeld;
    }

    function applyAvatarWeaponPose() {
        if (actorVisual && actorVisual.setWeapon) {
            actorVisual.setWeapon(currentWeaponId);
            avatarRig = actorVisual.rig || avatarRig;
        } else if (avatarRigApi && avatarRigApi.setWeapon) {
            avatarRigApi.setWeapon(currentWeaponId);
            avatarRig = avatarRigApi.rig || avatarRig;
        }
    }

    function syncAvatarVisibility(sniperMode) {
        var view = viewHelper();
        if (!view || !view.syncAvatarVisibility) return;
        view.syncAvatarVisibility({
            avatarGroup: avatarGroup,
            avatarRigApi: avatarRigApi,
            avatarAliveVisible: avatarAliveVisible,
            sniperMode: !!sniperMode
        });
    }

    function resetRecoilState() {
        var view = viewHelper();
        if (view && view.resetRecoilState) view.resetRecoilState();
    }

    function applyUnifiedGunOffsets(dt) {
        var view = viewHelper();
        if (view && view.applyUnifiedGunOffsets) view.applyUnifiedGunOffsets(dt, avatarRigApi);
    }

    function updateAvatarAnimation(dt, speed) {
        var view = viewHelper();
        if (!view || !view.updateAvatarAnimation) return;
        view.updateAvatarAnimation(dt, speed, {
            actorVisual: actorVisual,
            runSpeed: RUN_SPEED,
            sprinting: sprinting,
            isGrounded: isGrounded,
            pitch: pitch,
            hooked: isHookPulled(),
            hookPullStartedAt: statusState.hookPullStartedAt || 0,
            choked: isChoked(),
            chokeStartedAt: statusState.chokeStartedAt || 0,
            adsActive: isAdsActive(),
            movingForward: !!keys.forward,
            movingBackward: !!keys.backward,
            movingLeft: !!keys.left,
            movingRight: !!keys.right
        });
    }

    function updateAvatarPose() {
        if (!avatarGroup) return;
        var feetY = posY - EYE_HEIGHT + activeChokeLift();
        if (actorVisual && actorVisual.setWorldTransform) {
            actorVisual.setWorldTransform({ x: playerX, y: feetY, z: playerZ }, yaw);
            return;
        }
        avatarGroup.position.set(playerX, feetY, playerZ);
        avatarGroup.rotation.y = yaw;
        syncHitboxPositions();
    }

    function syncHitboxPositions() {
        var feetY = posY - EYE_HEIGHT + activeChokeLift();
        if (actorVisual && actorVisual.syncHitboxes) {
            actorVisual.syncHitboxes({ x: playerX, y: feetY, z: playerZ });
        }
    }

    function setAliveVisual(active) {
        avatarAliveVisible = !!active;
        if (actorVisual && actorVisual.setAlive) {
            actorVisual.setAlive(active);
            actorVisual.setHitboxVisibility(hitboxVisible);
        }
        syncAvatarVisibility(isSniperScopeWeapon());
    }

    function ensureHitboxes() {
        if (!sceneRef || actorVisual) return;
        var actorFactory = globalThis.__MAYHEM_RUNTIME.GameActorVisualFactory || null;
        if (!actorFactory || !actorFactory.create) {
            throw new Error('GamePlayer requires GameActorVisualFactory.create.');
        }
        actorVisual = actorFactory.create({
            ownerType: 'player',
            bodyColor: 0x4a7fc1,
            skinColor: 0xd2a77d,
            legColor: 0x2f2f2f,
            weaponId: currentWeaponId,
            targetId: 'self',
            hitboxOpacity: hitboxVisible ? 0.3 : 0
        });
        avatarGroup = actorVisual.root || actorVisual.visual;
        avatarRigApi = actorVisual.rigApi;
        avatarRig = actorVisual.rig || null;
        sceneRef.add(avatarGroup);
        if (actorVisual.bodyHitbox) sceneRef.add(actorVisual.bodyHitbox);
        if (actorVisual.headHitbox) sceneRef.add(actorVisual.headHitbox);
        if (actorVisual.setAlive) actorVisual.setAlive(avatarAliveVisible);
        if (actorVisual.setHitboxVisibility) actorVisual.setHitboxVisibility(hitboxVisible);
        syncHitboxPositions();
    }

    function setHitboxVisibility(visible) {
        hitboxVisible = !!visible;
        if (actorVisual && actorVisual.setHitboxVisibility) {
            actorVisual.setHitboxVisibility(hitboxVisible);
        }
        return hitboxVisible;
    }

    function setHealFlash(active) {
        if (actorVisual && actorVisual.setHealFlash) actorVisual.setHealFlash(active);
    }

    function setSpawnShieldVisual(active) {
        if (actorVisual && actorVisual.setSpawnShield) actorVisual.setSpawnShield(active);
    }

    function updateCameraFromPlayer(dt) {
        var view = viewHelper();
        if (!view || !view.updateCamera) return;
        view.updateCamera(dt, {
            camera: camera,
            playerX: playerX,
            playerZ: playerZ,
            posY: posY,
            yaw: yaw,
            pitch: pitch,
            currentWeaponId: currentWeaponId,
            avatarGroup: avatarGroup,
            avatarRigApi: avatarRigApi,
            avatarAliveVisible: avatarAliveVisible,
            sniperMode: isSniperScopeWeapon(),
            adsActive: isAdsActive(),
            choked: isChoked(),
            chokeStartedAt: statusState.chokeStartedAt || 0,
            chokeLift: activeChokeLift(),
            updateAvatarPose: updateAvatarPose,
            getWorldCollidables: function () {
                return globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables
                    ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables()
                    : [];
            },
            pitchLimit: PITCH_LIMIT,
            cameraShoulder: CAMERA_SHOULDER,
            cameraDist: CAMERA_DIST,
            thirdHeight: THIRD_HEIGHT,
            sniperScopeShoulder: SNIPER_SCOPE_SHOULDER,
            adsShoulder: ADS_SHOULDER,
            sniperScopeDist: SNIPER_SCOPE_DIST,
            adsDist: ADS_DIST,
            sniperScopeHeight: SNIPER_SCOPE_HEIGHT,
            adsHeight: ADS_HEIGHT,
            sniperScopeBlendSpeed: SNIPER_SCOPE_BLEND_SPEED,
            adsBlendSpeed: ADS_BLEND_SPEED,
            firstPersonSmooth: FIRST_PERSON_SMOOTH,
            thirdSmooth: THIRD_SMOOTH,
            cameraFov: CAMERA_FOV,
            adsFov: ADS_FOV,
            adsFovForWeapon: adsFovForWeapon
        });
        pendingViewSync = false;
    }

    function tryStepSharedLocalMovement(dt, world) {
        var helper = movementHelper();
        if (!helper || !helper.stepAuthoritativeMovement || !world) return null;

        var jumpJustPressed = !!keys.jump && !jumpPressedLastFrame;
        if (jumpJustPressed && isAdsActive()) {
            scopeHeld = false;
        }

        var adsActive = isAdsActive();
        var movementLocked = isMovementLocked();
        var startX = playerX;
        var startZ = playerZ;
        var wasGrounded = !!isGrounded;
        var motionState = {
            x: playerX,
            y: posY,
            z: playerZ,
            yaw: yaw,
            pitch: pitch,
            moveSpeedNorm: lastMoveSpeedNorm,
            sprinting: !!sprinting,
            velocityY: velocityY,
            isGrounded: !!isGrounded,
            jumpHoldTimer: jumpHoldTimer,
            jumpHeldLast: !!jumpPressedLastFrame
        };

        helper.stepAuthoritativeMovement(motionState, {
            forward: !!keys.forward,
            backward: !!keys.backward,
            left: !!keys.left,
            right: !!keys.right,
            jump: !!keys.jump,
            sprint: !!keys.sprint,
            adsActive: !!adsActive
        }, {
            dtSec: dt,
            bounds: world.getWorldBounds(),
            collisionBoxes: world.getCollisionBoxes(),
            getGroundHeightAt: world.getGroundHeightAt,
            movementLocked: movementLocked,
            eyeHeight: EYE_HEIGHT,
            playerHeight: PLAYER_HEIGHT,
            playerRadius: PLAYER_RADIUS,
            epsilon: EPSILON
        });

        playerX = Number(motionState.x || 0);
        playerZ = Number(motionState.z || 0);
        posY = Number(motionState.y || EYE_HEIGHT);
        velocityY = Number(motionState.velocityY || 0);
        isGrounded = !!motionState.isGrounded;
        jumpHoldTimer = Number(motionState.jumpHoldTimer || 0);
        jumpPressedLastFrame = !!motionState.jumpHeldLast;
        sprintPressedLastFrame = !!keys.sprint;
        lastMoveSpeedNorm = Number(motionState.moveSpeedNorm || 0);
        sprinting = !!motionState.sprinting;

        var movedX = playerX - startX;
        var movedZ = playerZ - startZ;
        var horizontalSpeed = Math.sqrt(movedX * movedX + movedZ * movedZ) / Math.max(dt, 0.0001);
        isMoving = horizontalSpeed > 0.06;

        if (wasGrounded && !isGrounded && velocityY > 0 && !movementLocked) {
            var reverseJumpLegTilt = !!keys.backward && !keys.forward;
            if (actorVisual && actorVisual.triggerAction) {
                actorVisual.triggerAction('jump', {
                    reverseLegTilt: reverseJumpLegTilt
                });
            } else if (avatarRigApi && avatarRigApi.triggerAction) {
                avatarRigApi.triggerAction('jump', {
                    reverseLegTilt: reverseJumpLegTilt
                });
            }
        }

        return {
            horizontalSpeed: horizontalSpeed
        };
    }

    function setupInput() {
        if (inputBound) return;
        inputBound = true;
        document.addEventListener('keydown', function (e) {
            switch (e.code) {
                case 'KeyW': keys.forward = true; break;
                case 'KeyA': keys.left = true; break;
                case 'KeyS': keys.backward = true; break;
                case 'KeyD': keys.right = true; break;
                case 'KeyE':
                    keys.sprint = true;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    if (!e.repeat) {
                        if (hasInputCapture()) {
                            e.preventDefault();
                            toggleAds();
                        }
                    }
                    break;
                case 'Space':
                    keys.jump = true;
                    e.preventDefault();
                    break;
            }
        });

        document.addEventListener('keyup', function (e) {
            switch (e.code) {
                case 'KeyW': keys.forward = false; break;
                case 'KeyA': keys.left = false; break;
                case 'KeyS': keys.backward = false; break;
                case 'KeyD': keys.right = false; break;
                case 'KeyE':
                    keys.sprint = false;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    break;
                case 'Space': keys.jump = false; break;
            }
        });

        document.addEventListener('mousemove', function (e) {
            if (!hasInputCapture()) return;
            var sensitivityMult = isSniperScopeWeapon() ? SNIPER_SCOPE_SENSITIVITY_MULT : ADS_SENSITIVITY_MULT;
            var blend = viewHelper() && viewHelper().getScopeBlend ? viewHelper().getScopeBlend() : 0;
            var sensitivity = MOUSE_SENSITIVITY * (1 - (blend * (1 - sensitivityMult)));
            yaw -= (e.movementX || 0) * sensitivity;
            pitch -= (e.movementY || 0) * sensitivity;
            pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
        });

        document.addEventListener('mousedown', function (e) {
            if (e.button !== 2) return;
            if (!hasInputCapture()) return;
            e.preventDefault();
            toggleAds();
        });

        document.addEventListener('contextmenu', function (e) {
            if (!hasInputCapture()) return;
            e.preventDefault();
        });

        window.addEventListener('resize', function () {
            if (camera) {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
            }
        });

        window.addEventListener('blur', function () {
            scopeHeld = false;
        });
        document.addEventListener('pointerlockchange', function () {
            if (!hasInputCapture()) scopeHeld = false;
        });
    }

    function resetVerticalState(feetY) {
        velocityY = 0;
        posY = feetY + EYE_HEIGHT;
        isGrounded = true;
        jumpHoldTimer = 0;
    }

    function setSpawnPosition(x, z, feetY) {
        if (!camera) return false;
        feetY = (typeof feetY === 'number') ? feetY : 0;
        playerX = x;
        playerZ = z;
        resetVerticalState(feetY);
        resetRecoilState();
        updateAvatarPose();
        updateCameraFromPlayer(1);
        return true;
    }

    function applyAuthoritativeMotion(state, options) {
        if (!camera || !state) return false;
        var opts = options || {};
        var x = Number(state.x);
        var z = Number(state.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

        playerX = x;
        playerZ = z;

        if (typeof state.y === 'number' && isFinite(state.y)) {
            posY = Number(state.y);
        } else {
            posY = worldHelper().getGroundHeightAt(playerX, playerZ) + EYE_HEIGHT;
        }
        velocityY = 0;
        isGrounded = true;
        jumpHoldTimer = 0;

        if (!opts.preserveViewAngles && typeof state.yaw === 'number' && isFinite(state.yaw)) {
            yaw = Number(state.yaw);
        }
        if (!opts.preserveViewAngles && typeof state.pitch === 'number' && isFinite(state.pitch)) {
            pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Number(state.pitch)));
        }

        resetRecoilState();
        updateAvatarPose();
        if (opts.deferViewSync) {
            pendingViewSync = true;
        } else {
            updateCameraFromPlayer(1 / 60);
        }
        return true;
    }

    function applyMotionState(state, dt, options) {
        if (!state) return false;
        var opts = options || {};
        playerX = Number(state.x || 0);
        playerZ = Number(state.z || 0);
        posY = Number(state.y || EYE_HEIGHT);
        if (!opts.preserveViewAngles) {
            yaw = (typeof state.yaw === 'number' && isFinite(state.yaw)) ? Number(state.yaw) : yaw;
            pitch = (typeof state.pitch === 'number' && isFinite(state.pitch))
                ? Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Number(state.pitch)))
                : pitch;
        }
        velocityY = Number(state.velocityY || 0);
        isGrounded = !!state.isGrounded;
        jumpHoldTimer = Number(state.jumpHoldTimer || 0);
        jumpPressedLastFrame = !!state.jumpHeldLast;
        lastMoveSpeedNorm = Number(state.moveSpeedNorm || 0);
        sprinting = !!state.sprinting;
        updateAvatarPose();
        if (opts.deferViewSync) {
            pendingViewSync = true;
        } else {
            updateCameraFromPlayer(Math.max(1 / 240, Number(dt || (1 / 60))));
        }
        return true;
    }

    function replayAuthoritativeMotion(state, pendingInputs, options) {
        if (!camera || !state) return false;
        var helper = movementHelper();
        var reconcile = reconciliationHelper();
        var world = worldHelper();
        var opts = options || {};
        if (!helper || !helper.stepAuthoritativeMovement || !reconcile || !reconcile.replayMotionState) {
            return applyAuthoritativeMotion(state, {
                preserveViewAngles: true,
                deferViewSync: !!opts.deferViewSync
            });
        }

        var ackSeq = Math.max(0, Number(opts.lastAckedSeq || 0));
        if (ackSeq > 0) lastReplayAckSeq = ackSeq;
        var motionState = reconcile.replayMotionState(state, Array.isArray(pendingInputs) ? pendingInputs.slice() : [], {
            stepMovement: helper.stepAuthoritativeMovement,
            bounds: world.getWorldBounds(),
            collisionBoxes: world.getCollisionBoxes(),
            getGroundHeightAt: world.getGroundHeightAt,
            movementLocked: function () { return isMovementLocked(); },
            eyeHeight: EYE_HEIGHT,
            playerHeight: PLAYER_HEIGHT,
            playerRadius: PLAYER_RADIUS,
            epsilon: EPSILON,
            fallbackYaw: yaw,
            fallbackPitch: pitch
        });
        return applyMotionState(motionState, opts.dt, {
            preserveViewAngles: true,
            deferViewSync: !!opts.deferViewSync
        });
    }

    function hasMovementIntentInput() {
        return !!(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.sprint);
    }

    function reconcileAuthoritativeMotion(state, options) {
        if (!camera || !state) return false;
        var x = Number(state.x);
        var z = Number(state.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

        var opts = options || {};
        var dt = Math.max(1 / 240, Number(opts.dt || (1 / 60)));
        var dx = x - playerX;
        var dz = z - playerZ;
        var horizontalDistSq = (dx * dx) + (dz * dz);
        var hardSnapDistance = Number(opts.hardSnapDistance || 2.25);
        var softCorrectDistance = Number(opts.softCorrectDistance || 0.2);
        var pendingInputCount = Math.max(0, Number(opts.pendingInputCount || 0));
        var ackDrift = Math.max(0, Number(opts.lastSentSeq || 0) - Number(opts.lastAckedSeq || 0));
        var movingIntent = hasMovementIntentInput() && !isMovementLocked();
        var canCorrectWhileMoving = pendingInputCount <= 1 && ackDrift <= 1;
        var pendingInputs = Array.isArray(opts.pendingInputs) ? opts.pendingInputs : [];
        var reconcile = reconciliationHelper();

        if (reconcile && reconcile.shouldReplayAuthoritativeCorrection && reconcile.shouldReplayAuthoritativeCorrection({
            pendingInputCount: pendingInputCount,
            hasUnsentInputTail: !!opts.hasUnsentInputTail,
            lastAckedSeq: Number(opts.lastAckedSeq || 0),
            lastReplayAckSeq: lastReplayAckSeq
        })) {
            return replayAuthoritativeMotion(state, pendingInputs, opts);
        }

        if (opts.force || horizontalDistSq >= (hardSnapDistance * hardSnapDistance)) {
            return applyMotionState(state, dt, {
                preserveViewAngles: true,
                deferViewSync: !!opts.deferViewSync
            });
        }

        if (movingIntent) {
            return false;
        }

        if (!canCorrectWhileMoving || horizontalDistSq < (softCorrectDistance * softCorrectDistance)) {
            return false;
        }

        var blend = Math.min(1, dt * 8);
        playerX += dx * blend;
        playerZ += dz * blend;

        if (horizontalDistSq < 0.0004) {
            playerX = x;
            playerZ = z;
        }

        updateAvatarPose();
        if (opts.deferViewSync) {
            pendingViewSync = true;
        } else {
            updateCameraFromPlayer(dt);
        }
        return true;
    }

    GamePlayer.init = function (scene) {
        sceneRef = scene;
        var world = worldHelper();
        var bounds = world.getWorldBounds();
        var worldSpan = (typeof bounds.size === 'number')
            ? bounds.size
            : Math.max(
                (typeof bounds.maxX === 'number' ? bounds.maxX : bounds.max) - (typeof bounds.minX === 'number' ? bounds.minX : bounds.min),
                (typeof bounds.maxZ === 'number' ? bounds.maxZ : bounds.max) - (typeof bounds.minZ === 'number' ? bounds.minZ : bounds.min)
            );
        var cameraFar = Math.max(120, worldSpan * 2.2);
        camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, 0.1, cameraFar);
        camera.rotation.order = 'YXZ';
        scene.add(camera);

        var spawn = world.getRandomSpawnPoint(world.getSpawnPadding(8)) || world.getDefaultSpawnPoint();
        setSpawnPosition(spawn.x, spawn.z, world.getGroundHeightAt(spawn.x, spawn.z));

        ensureHitboxes();

        resetRecoilState();
        applyAvatarWeaponPose();
        setupInput();
        updateAvatarPose();
        updateCameraFromPlayer(1);

        return camera;
    };

    GamePlayer.update = function (dt) {
        if (!camera) return;
        if (!hasInputCapture()) return;
        clearExpiredStatusState(nowMs());
        var world = worldHelper();
        var sharedMovementStep = tryStepSharedLocalMovement(dt, world);

        if (sharedMovementStep) {
            updateAvatarPose();
            updateAvatarAnimation(dt, sharedMovementStep.horizontalSpeed);
            applyUnifiedGunOffsets(dt);
            updateCameraFromPlayer(dt);
            return;
        }

        var jumpJustPressed = keys.jump && !jumpPressedLastFrame;
        var jumpJustReleased = !keys.jump && jumpPressedLastFrame;
        jumpPressedLastFrame = keys.jump;
        var sprintJustPressed = keys.sprint && !sprintPressedLastFrame;
        var sprintJustReleased = !keys.sprint && sprintPressedLastFrame;
        sprintPressedLastFrame = keys.sprint;

        var forwardX = -Math.sin(yaw);
        var forwardZ = -Math.cos(yaw);
        var rightX = Math.cos(yaw);
        var rightZ = -Math.sin(yaw);
        var movementLocked = isMovementLocked();
        var adsActive = isAdsActive();
        if (movementLocked) keys.sprint = false;
        var sprintAllowed = !movementLocked && !adsActive && keys.sprint;
        var speedCap = adsActive ? (JOG_SPEED * ADS_MOVE_MULT) : (sprintAllowed ? RUN_SPEED : JOG_SPEED);

        var moveX = 0;
        var moveZ = 0;
        if (!movementLocked) {
            if (keys.forward)  { moveX += forwardX; moveZ += forwardZ; }
            if (keys.backward) { moveX -= forwardX; moveZ -= forwardZ; }
            if (keys.left)     { moveX -= rightX;   moveZ -= rightZ; }
            if (keys.right)    { moveX += rightX;   moveZ += rightZ; }
        }

        var length = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (length > 0) {
            moveX = (moveX / length) * speedCap * dt;
            moveZ = (moveZ / length) * speedCap * dt;
        } else {
            moveX = 0;
            moveZ = 0;
        }

        var bounds = world.getWorldBounds();
        var currentFeetY = posY - EYE_HEIGHT;
        var minBoundX = (typeof bounds.minX === 'number' ? bounds.minX : bounds.min) + PLAYER_RADIUS;
        var maxBoundX = (typeof bounds.maxX === 'number' ? bounds.maxX : bounds.max) - PLAYER_RADIUS;
        var minBoundZ = (typeof bounds.minZ === 'number' ? bounds.minZ : bounds.min) + PLAYER_RADIUS;
        var maxBoundZ = (typeof bounds.maxZ === 'number' ? bounds.maxZ : bounds.max) - PLAYER_RADIUS;
        var startX = playerX;
        var startZ = playerZ;

        var nextX = playerX + moveX;
        nextX = Math.max(minBoundX, Math.min(maxBoundX, nextX));
        if (!world.isBlockedAt(nextX, playerZ, currentFeetY)) playerX = nextX;

        var nextZ = playerZ + moveZ;
        nextZ = Math.max(minBoundZ, Math.min(maxBoundZ, nextZ));
        if (!world.isBlockedAt(playerX, nextZ, currentFeetY)) playerZ = nextZ;

        var movedX = playerX - startX;
        var movedZ = playerZ - startZ;
        var horizontalSpeed = Math.sqrt(movedX * movedX + movedZ * movedZ) / Math.max(dt, 0.0001);
        lastMoveSpeedNorm = Math.max(0, Math.min(1.4, horizontalSpeed / RUN_SPEED));
        isMoving = horizontalSpeed > 0.06;
        sprinting = sprintAllowed && isMoving;

        if (jumpJustPressed && adsActive) {
            scopeHeld = false;
            jumpJustPressed = false;
        }

        if (!movementLocked && jumpJustPressed && isGrounded) {
            velocityY = JUMP_VELOCITY;
            isGrounded = false;
            jumpHoldTimer = MAX_JUMP_HOLD;
            var reverseJumpLegTilt = !!keys.backward && !keys.forward;
            if (actorVisual && actorVisual.triggerAction) {
                actorVisual.triggerAction('jump', {
                    reverseLegTilt: reverseJumpLegTilt
                });
            } else if (avatarRigApi && avatarRigApi.triggerAction) {
                avatarRigApi.triggerAction('jump', {
                    reverseLegTilt: reverseJumpLegTilt
                });
            }
        }
        if (!movementLocked && jumpJustReleased && velocityY > 0) {
            velocityY *= JUMP_RELEASE_MULT;
            jumpHoldTimer = 0;
        }
        if (!movementLocked && keys.jump && jumpHoldTimer > 0 && velocityY > 0) {
            velocityY += JUMP_HOLD_ACCEL * dt;
            jumpHoldTimer -= dt;
            if (jumpHoldTimer < 0) jumpHoldTimer = 0;
        }

        velocityY -= GRAVITY * dt;
        var nextFeetY = currentFeetY + (velocityY * dt);

        if (velocityY <= 0) {
            var landingY = world.findLandingSurfaceY(playerX, playerZ, currentFeetY, nextFeetY);
            if (nextFeetY <= landingY + EPSILON) {
                nextFeetY = landingY;
                velocityY = 0;
                isGrounded = true;
                jumpHoldTimer = 0;
            } else {
                isGrounded = false;
            }
        } else {
            var currentHeadY = currentFeetY + PLAYER_HEIGHT;
            var nextHeadY = nextFeetY + PLAYER_HEIGHT;
            var ceilingY = world.findCeilingY(playerX, playerZ, currentHeadY, nextHeadY);
            if (ceilingY !== null && nextHeadY >= ceilingY - EPSILON) {
                nextFeetY = ceilingY - PLAYER_HEIGHT;
                velocityY = 0;
                jumpHoldTimer = 0;
            }
            isGrounded = false;
        }

        var baseGround = world.getGroundHeightAt(playerX, playerZ);
        if (nextFeetY < baseGround) {
            nextFeetY = baseGround;
            velocityY = 0;
            isGrounded = true;
            jumpHoldTimer = 0;
        }

        posY = nextFeetY + EYE_HEIGHT;
        updateAvatarPose();
        updateAvatarAnimation(dt, horizontalSpeed);
        applyUnifiedGunOffsets(dt);
        updateCameraFromPlayer(dt);
    };

    function triggerFireAction() {
        var view = viewHelper();
        if (!view || !view.triggerFireAction) return;
        view.triggerFireAction({
            currentWeaponId: currentWeaponId,
            actorVisual: actorVisual,
            avatarRigApi: avatarRigApi
        });
    }

    GamePlayer.isExperimentalCameraView = function () {
        return true;
    };

    GamePlayer.setWeaponModel = function (weaponId) {
        currentWeaponId = weaponId || 'rifle';
        scopeHeld = false;
        resetRecoilState();
        applyAvatarWeaponPose();
        return true;
    };

    GamePlayer.getCamera = function () {
        return camera;
    };

    GamePlayer.getPosition = function () {
        return new THREE.Vector3(playerX, posY, playerZ);
    };

    GamePlayer.getRotation = function () {
        return { yaw: yaw, pitch: pitch };
    };

    GamePlayer.flushDeferredViewSync = function (dt) {
        if (!pendingViewSync) return false;
        updateCameraFromPlayer(Math.max(1 / 240, Number(dt || (1 / 60))));
        return true;
    };

    GamePlayer.getMuzzleWorldPosition = function () {
        var view = viewHelper();
        return view && view.getMuzzleWorldPosition
            ? view.getMuzzleWorldPosition({ actorVisual: actorVisual, avatarRigApi: avatarRigApi, camera: camera })
            : null;
    };

    GamePlayer.getCoreWorldPosition = function () {
        var view = viewHelper();
        return view && view.getCoreWorldPosition
            ? view.getCoreWorldPosition({ actorVisual: actorVisual, camera: camera })
            : null;
    };

    GamePlayer.getEyeWorldPosition = function () {
        var view = viewHelper();
        return view && view.getEyeWorldPosition
            ? view.getEyeWorldPosition({ actorVisual: actorVisual, avatarRigApi: avatarRigApi, camera: camera })
            : null;
    };

    GamePlayer.getThrowableOriginWorldPosition = function () {
        var view = viewHelper();
        return view && view.getThrowableOriginWorldPosition
            ? view.getThrowableOriginWorldPosition({ actorVisual: actorVisual, camera: camera })
            : null;
    };

    GamePlayer.getEquippedWeaponId = function () {
        return currentWeaponId;
    };

    GamePlayer.getAdsState = function () {
        var view = viewHelper();
        return view && view.getAdsState
            ? view.getAdsState({
                currentWeaponId: currentWeaponId,
                adsActive: isAdsActive(),
                sniperMode: isSniperScopeWeapon()
            })
            : {
                weaponId: currentWeaponId,
                active: isAdsActive(),
                blend: 0,
                sniper: isSniperScopeWeapon(),
                scopeActive: false
            };
    };

    GamePlayer.setAdsEnabled = function (enabled) {
        return setAdsEnabled(enabled);
    };

    GamePlayer.isSprinting = function () {
        return !!sprinting;
    };

    GamePlayer.getAnimNetState = function () {
        return {
            moveSpeedNorm: lastMoveSpeedNorm,
            sprinting: !!sprinting,
            aimPitch: pitch,
            equippedWeaponId: currentWeaponId
        };
    };

    GamePlayer.getNetworkInputState = function () {
        return {
            forward: !!keys.forward,
            backward: !!keys.backward,
            left: !!keys.left,
            right: !!keys.right,
            jump: !!keys.jump,
            sprint: !!keys.sprint,
            adsActive: !!isAdsActive()
        };
    };

    GamePlayer.setLoadout = function (loadoutConfig) {
        if (!loadoutConfig || !Array.isArray(loadoutConfig.slots)) {
            return { slots: loadoutSlots.slice() };
        }

        var allowed = {};
        var hasAllowed = false;
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getAllWeaponIds) {
            var ids = globalThis.__MAYHEM_RUNTIME.GameHitscan.getAllWeaponIds();
            for (var n = 0; n < ids.length; n++) {
                allowed[ids[n]] = true;
                hasAllowed = true;
            }
        }

        var next = [];
        var seen = {};
        for (var i = 0; i < loadoutConfig.slots.length; i++) {
            var id = String(loadoutConfig.slots[i] || '');
            if (!id || seen[id]) continue;
            if (hasAllowed && !allowed[id]) continue;
            seen[id] = true;
            next.push(id);
        }
        if (next.length > 0) {
            loadoutSlots = next;
            if (loadoutSlots.indexOf(currentWeaponId) === -1) {
                currentWeaponId = loadoutSlots[0];
                scopeHeld = false;
                resetRecoilState();
                applyAvatarWeaponPose();
            }
        }
        return { slots: loadoutSlots.slice() };
    };

    GamePlayer.getLoadout = function () {
        return { slots: loadoutSlots.slice() };
    };

    GamePlayer.setHitboxVisibility = function (visible) {
        ensureHitboxes();
        return setHitboxVisibility(visible);
    };

    GamePlayer.setStatusState = function (state) {
        applyStatusState({
            stunUntil: state && state.stunUntil ? Number(state.stunUntil || 0) : 0,
            hookPullStartedAt: state && state.hookPullStartedAt ? Number(state.hookPullStartedAt || 0) : 0,
            hookPullUntil: state && state.hookPullUntil ? Number(state.hookPullUntil || 0) : 0,
            chokeStartedAt: state && state.chokeStartedAt ? Number(state.chokeStartedAt || 0) : 0,
            chokeUntil: state && state.chokeUntil ? Number(state.chokeUntil || 0) : 0,
            chokeLift: state && state.chokeLift ? Number(state.chokeLift || 0) : 0,
            spawnShieldUntil: state && state.spawnShieldUntil ? Number(state.spawnShieldUntil || 0) : 0
        });
    };

    GamePlayer.setChokeVictimState = function (state) {
        applyStatusState({
            chokeStartedAt: state && state.startedAt ? Number(state.startedAt || 0) : 0,
            chokeUntil: state && state.endsAt ? Number(state.endsAt || 0) : 0,
            chokeLift: state && state.lift ? Number(state.lift || 0) : 0
        });
    };

    GamePlayer.setAliveVisual = function (active) {
        setAliveVisual(active);
    };

    GamePlayer.setHealFlash = function (active) {
        setHealFlash(!!active);
    };

    GamePlayer.triggerAction = function (action, options) {
        var kind = String(action || '').toLowerCase();
        if (kind === 'fire') {
            triggerFireAction();
            return true;
        }
        if (actorVisual && actorVisual.triggerAction) {
            return actorVisual.triggerAction(kind, options || null);
        }
        if (!avatarRigApi || !avatarRigApi.triggerAction) return false;
        return !!avatarRigApi.triggerAction(kind, options || null);
    };

    GamePlayer.setSpawnShield = function (active) {
        applyStatusState({
            spawnShieldUntil: active ? nowMs() + 1000 : 0
        });
    };

    GamePlayer.setActionRestrictions = function (state) {
        applyStatusState({
            weaponUntil: state && state.weaponUntil ? Number(state.weaponUntil || 0) : 0,
            throwableUntil: state && state.throwableUntil ? Number(state.throwableUntil || 0) : 0,
            abilityUntil: state && state.abilityUntil ? Number(state.abilityUntil || 0) : 0
        });
    };

    GamePlayer.isStunned = function () {
        return isStunned();
    };

    GamePlayer.isHookPulled = function () {
        return isHookPulled();
    };

    GamePlayer.isChoked = function () {
        return isChoked();
    };

    GamePlayer.isSpawnShielded = function () {
        return isSpawnShielded();
    };

    GamePlayer.isMovementLocked = function () {
        return isMovementLocked();
    };

    GamePlayer.isActionLocked = function () {
        return isActionLocked();
    };

    GamePlayer.canUseWeapon = function () {
        return canUseWeapon();
    };

    GamePlayer.canUseThrowable = function () {
        return canUseThrowable();
    };

    GamePlayer.canUseAbility = function () {
        return canUseAbility();
    };

    GamePlayer.equipSlot = function (slotIndex) {
        var idx = Math.max(0, Math.floor(slotIndex || 0));
        if (idx >= loadoutSlots.length) return null;
        return loadoutSlots[idx];
    };

    GamePlayer.respawn = function (x, z) {
        if (!camera) return false;
        return setSpawnPosition(x, z, worldHelper().getGroundHeightAt(x, z));
    };

    GamePlayer.applyAuthoritativeMotion = function (state, options) {
        return applyAuthoritativeMotion(state, options);
    };

    GamePlayer.reconcileAuthoritativeMotion = function (state, options) {
        return reconcileAuthoritativeMotion(state, options);
    };

    GamePlayer.replayAuthoritativeMotion = function (state, pendingInputs, options) {
        return replayAuthoritativeMotion(state, pendingInputs, options);
    };

    GamePlayer.respawnRandom = function () {
        var world = worldHelper();
        if (!camera) {
            var defaultSpawn = world.getDefaultSpawnPoint();
            return new THREE.Vector2(defaultSpawn.x, defaultSpawn.z);
        }

        var bounds = world.getWorldBounds();
        var spawnPadding = world.getSpawnPadding(4);
        var minX = (typeof bounds.minX === 'number' ? bounds.minX : bounds.min) + spawnPadding;
        var maxX = (typeof bounds.maxX === 'number' ? bounds.maxX : bounds.max) - spawnPadding;
        var minZ = (typeof bounds.minZ === 'number' ? bounds.minZ : bounds.min) + spawnPadding;
        var maxZ = (typeof bounds.maxZ === 'number' ? bounds.maxZ : bounds.max) - spawnPadding;

        for (var i = 0; i < 40; i++) {
            var randomSpawn = world.getRandomSpawnPoint(spawnPadding, {
                avoidPoints: world.getSpawnThreatPoints(),
                minClearance: 14
            });
            var x = randomSpawn ? randomSpawn.x : (minX + Math.random() * (maxX - minX));
            var z = randomSpawn ? randomSpawn.z : (minZ + Math.random() * (maxZ - minZ));
            var groundY = world.getGroundHeightAt(x, z);
            if (!world.isBlockedAt(x, z, groundY)) {
                setSpawnPosition(x, z, groundY);
                return new THREE.Vector2(x, z);
            }
        }

        var spawn = world.getDefaultSpawnPoint();
        setSpawnPosition(spawn.x, spawn.z, world.getGroundHeightAt(spawn.x, spawn.z));
        return new THREE.Vector2(spawn.x, spawn.z);
    };

    globalThis.__MAYHEM_RUNTIME.GamePlayer = GamePlayer;
})();
