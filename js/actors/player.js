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

    function networkTuning() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        return shared.gameplayTuning && shared.gameplayTuning.network
            ? shared.gameplayTuning.network
            : {};
    }

    function inputBindingsApi() {
        return globalThis.__MAYHEM_RUNTIME.GameInputBindings || null;
    }

    function matchesBinding(actionId, event, fallbackCodes) {
        var bindingsApi = inputBindingsApi();
        if (bindingsApi && bindingsApi.matches) {
            return bindingsApi.matches(actionId, event);
        }
        var code = String(event && event.code || '');
        var fallbacks = Array.isArray(fallbackCodes) ? fallbackCodes : [fallbackCodes];
        for (var i = 0; i < fallbacks.length; i++) {
            if (String(fallbacks[i] || '') === code) return true;
        }
        return false;
    }

    var EYE_HEIGHT = Number(entityConstants.EYE_HEIGHT || 1.6);
    var RUN_SPEED = Number(movementTuning.runSpeed || 14);
    var MOUSE_SENSITIVITY_BASE = 0.002;
    var MOUSE_SENSITIVITY_DEFAULT = 65;
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
    var scopeHeld = false;
    var mouseSensitivity = loadMouseSensitivity();

    var keys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false
    };
    var sprintCanceledUntilRelease = false;
    var inputBound = false;

    var currentWeaponId = 'rifle';

    var avatarGroup = null;
    var avatarRig = null;
    var avatarRigApi = null;
    var actorVisual = null;
    var sceneRef = null;

    function localStore() {
        try {
            return window.localStorage || null;
        } catch (_err) {
            return null;
        }
    }

    function normalizeMouseSensitivity(value) {
        var next = Number(value);
        if (!Number.isFinite(next)) return MOUSE_SENSITIVITY_DEFAULT;
        return Math.max(10, Math.min(100, Math.round(next)));
    }

    function loadMouseSensitivity() {
        var store = localStore();
        if (!store || typeof store.getItem !== 'function') return MOUSE_SENSITIVITY_DEFAULT;
        try {
            return normalizeMouseSensitivity(store.getItem('mayhem_mouse_sensitivity'));
        } catch (_err) {
            return MOUSE_SENSITIVITY_DEFAULT;
        }
    }

    function saveMouseSensitivity() {
        var store = localStore();
        if (!store || typeof store.setItem !== 'function') return;
        try {
            store.setItem('mayhem_mouse_sensitivity', String(mouseSensitivity));
        } catch (_err) {
            // no-op
        }
    }

    function currentMouseSensitivity() {
        return MOUSE_SENSITIVITY_BASE * (mouseSensitivity / MOUSE_SENSITIVITY_DEFAULT);
    }
    var hitboxVisible = false;

    var bobTimer = 0;
    var sprinting = false;
    var lastMoveSpeedNorm = 0;
    var loadoutSlots = selectableWeaponIds();

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
                var combatApi = globalThis.__MAYHEM_RUNTIME.GamePlayerCombat || null;
                if (combatApi && combatApi.getCurrentWeaponState) {
                    return combatApi.getCurrentWeaponState();
                }
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

    function isSprintInputActive() {
        return !!keys.sprint && !sprintCanceledUntilRelease;
    }

    function cancelSprintUntilRelease() {
        var hadSprint = !!keys.sprint || !!sprinting || sprintCanceledUntilRelease;
        if (!hadSprint) return false;
        if (keys.sprint) sprintCanceledUntilRelease = true;
        sprinting = false;
        return true;
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
            avatarRigApi: avatarRigApi,
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
    }

    function setupInput() {
        if (inputBound) return;
        inputBound = true;
        document.addEventListener('keydown', function (e) {
            if (matchesBinding('move_forward', e, 'KeyW')) keys.forward = true;
            if (matchesBinding('move_left', e, 'KeyA')) keys.left = true;
            if (matchesBinding('move_backward', e, 'KeyS')) keys.backward = true;
            if (matchesBinding('move_right', e, 'KeyD')) keys.right = true;
            if (matchesBinding('sprint', e, ['ShiftLeft', 'ShiftRight'])) {
                keys.sprint = true;
                if (scopeHeld) setAdsEnabled(false);
            }
            if (matchesBinding('ads_key', e, ['AltLeft', 'AltRight'])) {
                if (!e.repeat && hasInputCapture()) {
                    e.preventDefault();
                    toggleAds();
                }
            }
            if (matchesBinding('jump', e, 'Space')) {
                keys.jump = true;
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', function (e) {
            if (matchesBinding('move_forward', e, 'KeyW')) keys.forward = false;
            if (matchesBinding('move_left', e, 'KeyA')) keys.left = false;
            if (matchesBinding('move_backward', e, 'KeyS')) keys.backward = false;
            if (matchesBinding('move_right', e, 'KeyD')) keys.right = false;
            if (matchesBinding('sprint', e, ['ShiftLeft', 'ShiftRight'])) {
                keys.sprint = false;
                sprintCanceledUntilRelease = false;
            }
            if (matchesBinding('jump', e, 'Space')) keys.jump = false;
        });

        document.addEventListener('mousemove', function (e) {
            if (!hasInputCapture()) return;
            var sensitivityMult = isSniperScopeWeapon() ? SNIPER_SCOPE_SENSITIVITY_MULT : ADS_SENSITIVITY_MULT;
            var blend = viewHelper() && viewHelper().getScopeBlend ? viewHelper().getScopeBlend() : 0;
            var sensitivity = currentMouseSensitivity() * (1 - (blend * (1 - sensitivityMult)));
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
        jumpPressedLastFrame = false;
        lastMoveSpeedNorm = 0;
        sprinting = false;
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

    function buildLocalMotionState() {
        return {
            x: playerX,
            y: posY,
            z: playerZ,
            yaw: yaw,
            pitch: pitch,
            velocityY: velocityY,
            isGrounded: isGrounded,
            jumpHoldTimer: jumpHoldTimer,
            jumpHeldLast: !!jumpPressedLastFrame,
            moveSpeedNorm: lastMoveSpeedNorm,
            sprinting: !!sprinting
        };
    }

    function buildCurrentInputState() {
        return {
            forward: !!keys.forward,
            backward: !!keys.backward,
            left: !!keys.left,
            right: !!keys.right,
            jump: !!keys.jump,
            sprint: !!isSprintInputActive(),
            adsActive: !!isAdsActive()
        };
    }

    function copyMotionStateFields(state, options) {
        if (!state) return false;
        playerX = Number(state.x || 0);
        playerZ = Number(state.z || 0);
        if (typeof state.y === 'number' && isFinite(state.y)) {
            posY = Number(state.y);
        } else {
            var groundHeightAt = options && typeof options.getGroundHeightAt === 'function'
                ? options.getGroundHeightAt
                : null;
            posY = groundHeightAt ? (Number(groundHeightAt(playerX, playerZ) || 0) + EYE_HEIGHT) : EYE_HEIGHT;
        }
        yaw = (typeof state.yaw === 'number' && isFinite(state.yaw)) ? Number(state.yaw) : yaw;
        pitch = (typeof state.pitch === 'number' && isFinite(state.pitch))
            ? Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Number(state.pitch)))
            : pitch;
        velocityY = Number(state.velocityY || 0);
        isGrounded = state.isGrounded !== undefined ? !!state.isGrounded : true;
        jumpHoldTimer = Number(state.jumpHoldTimer || 0);
        jumpPressedLastFrame = !!state.jumpHeldLast;
        lastMoveSpeedNorm = Number(state.moveSpeedNorm || 0);
        sprinting = !!state.sprinting;
        return true;
    }

    function applyAuthoritativeMotion(state) {
        if (!camera || !state) return false;
        var x = Number(state.x);
        var z = Number(state.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
        var world = worldHelper();
        copyMotionStateFields(state, {
            getGroundHeightAt: world && world.getGroundHeightAt
                ? world.getGroundHeightAt
                : null
        });

        resetRecoilState();
        updateAvatarPose();
        updateCameraFromPlayer(1 / 60);
        return true;
    }

    function applyMotionState(state, dt) {
        var world = worldHelper();
        if (!copyMotionStateFields(state, {
            getGroundHeightAt: world && world.getGroundHeightAt
                ? world.getGroundHeightAt
                : null
        })) return false;
        updateAvatarPose();
        updateCameraFromPlayer(Math.max(1 / 240, Number(dt || (1 / 60))));
        return true;
    }

    function replayAuthoritativeMotion(state, pendingInputs, options) {
        if (!camera || !state) return false;
        var helper = movementHelper();
        var reconcile = reconciliationHelper();
        var world = worldHelper();
        if (!helper || !helper.stepAuthoritativeMovement || !reconcile || !reconcile.replayMotionState) {
            return applyAuthoritativeMotion(state);
        }

        var opts = options || {};
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
        return applyMotionState(motionState, opts.dt);
    }

    function hasMovementIntentInput() {
        return !!(keys.forward || keys.backward || keys.left || keys.right || keys.jump || isSprintInputActive());
    }

    function reconcileAuthoritativeMotion(state, options) {
        if (!camera || !state) return false;
        var x = Number(state.x);
        var z = Number(state.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

        var opts = options || {};
        var netTuning = networkTuning();
        var networkFlags = netTuning.flags || {};
        var reconcileTuning = netTuning.selfReconciliation || {};
        var adaptiveSelfReconciliation = networkFlags.adaptiveSelfReconciliation !== false;
        var dt = Math.max(1 / 240, Number(opts.dt || (1 / 60)));
        var dx = x - playerX;
        var dz = z - playerZ;
        var authoritativeY = (typeof state.y === 'number' && isFinite(state.y)) ? Number(state.y) : posY;
        var dy = authoritativeY - posY;
        var horizontalDistSq = (dx * dx) + (dz * dz);
        var airborne = isGrounded === false || state.isGrounded === false;
        var hardSnapDistance = Number(opts.hardSnapDistance || (adaptiveSelfReconciliation ? reconcileTuning.hardSnapDistanceWu : 4.25) || 4.25);
        var hardSnapVerticalDistance = Number(opts.hardSnapVerticalDistance || (adaptiveSelfReconciliation ? reconcileTuning.hardSnapVerticalWu : 1.25) || 1.25);
        var idleBlendDistance = Number(opts.idleBlendDistance || 0.45);
        var idleBlendRate = Number(opts.idleBlendRate || 5);
        var replayCorrectionDistance = Number(opts.replayCorrectionDistance || (adaptiveSelfReconciliation ? reconcileTuning.idleReplayDistanceWu : 0.95) || 0.95);
        var movingReplayCorrectionDistance = Number(opts.movingReplayCorrectionDistance || (adaptiveSelfReconciliation ? reconcileTuning.movingReplayDistanceWu : 1.35) || 1.35);
        var baseReplayGraceMs = Math.max(0, Number(opts.pendingReplayGraceMs || (adaptiveSelfReconciliation ? reconcileTuning.baseGraceMs : 125) || 125));
        var maxExtraGraceMs = Math.max(0, Number(adaptiveSelfReconciliation ? reconcileTuning.maxExtraGraceMs : 0) || 0);
        var rttJitterMs = Math.max(0, Number(opts.rttJitterMs || 0));
        var pendingReplayGraceMs = baseReplayGraceMs + Math.min(maxExtraGraceMs, rttJitterMs);
        var emergencyReplayDistance = Number(opts.emergencyReplayDistance || (adaptiveSelfReconciliation ? reconcileTuning.emergencyReplayDistanceWu : 2.1) || 2.1);
        var pendingInputCount = Math.max(0, Number(opts.pendingInputCount || 0));
        var latestPendingAgeMs = Math.max(0, Number(opts.latestPendingAgeMs || 0));
        var ackDrift = Math.max(0, Number(opts.ackDrift != null ? opts.ackDrift : (Number(opts.lastSentSeq || 0) - Number(opts.lastAckedSeq || 0))));
        var hasUnsentInputTail = !!opts.hasUnsentInputTail;
        var movingIntent = hasMovementIntentInput() && !isMovementLocked();
        var replayDistance = movingIntent
            ? Math.max(replayCorrectionDistance, movingReplayCorrectionDistance)
            : replayCorrectionDistance;
        var movingAckDriftLimit = Math.max(0, Number(adaptiveSelfReconciliation ? reconcileTuning.movingAckDriftLimit : 2) || 2);
        var movingPendingInputLimit = 2;
        if (airborne) {
            hardSnapDistance = Math.max(
                hardSnapDistance,
                Number(adaptiveSelfReconciliation ? reconcileTuning.airborneHardSnapDistanceWu : hardSnapDistance) || hardSnapDistance
            );
            hardSnapVerticalDistance = Math.max(
                hardSnapVerticalDistance,
                Number(adaptiveSelfReconciliation ? reconcileTuning.airborneHardSnapVerticalWu : hardSnapVerticalDistance) || hardSnapVerticalDistance
            );
            replayDistance = Math.max(
                replayDistance,
                Number(adaptiveSelfReconciliation ? reconcileTuning.airborneReplayDistanceWu : replayDistance) || replayDistance
            );
            pendingReplayGraceMs = Math.max(
                pendingReplayGraceMs,
                Math.max(0, Number(adaptiveSelfReconciliation ? reconcileTuning.airborneGraceMs : pendingReplayGraceMs) || pendingReplayGraceMs)
            );
            movingAckDriftLimit = Math.max(
                movingAckDriftLimit,
                Math.max(0, Number(adaptiveSelfReconciliation ? reconcileTuning.airborneMovingAckDriftLimit : movingAckDriftLimit) || movingAckDriftLimit)
            );
            movingPendingInputLimit = Math.max(2, movingAckDriftLimit);
        }
        var canCorrectWhileMoving = !hasUnsentInputTail &&
            pendingInputCount <= movingPendingInputLimit &&
            ackDrift <= movingAckDriftLimit;
        var allowFreshPendingReplay = movingIntent && horizontalDistSq >= (emergencyReplayDistance * emergencyReplayDistance);
        var pendingInputs = Array.isArray(opts.pendingInputs) ? opts.pendingInputs : [];
        var reconcile = reconciliationHelper();
        var allowReplayCorrection = opts.allowReplayCorrection !== false;

        if (
            opts.force ||
            horizontalDistSq >= (hardSnapDistance * hardSnapDistance) ||
            Math.abs(dy) >= hardSnapVerticalDistance
        ) {
            return applyAuthoritativeMotion(state);
        }

        if (allowReplayCorrection && reconcile && reconcile.shouldReplayAuthoritativeCorrection && reconcile.shouldReplayAuthoritativeCorrection({
            pendingInputCount: pendingInputCount,
            lastAckedSeq: Number(opts.lastAckedSeq || 0),
            lastReplayAckSeq: lastReplayAckSeq,
            horizontalDistSq: horizontalDistSq,
            replayCorrectionDistance: replayDistance,
            movingIntent: movingIntent,
            canCorrectWhileMoving: canCorrectWhileMoving,
            latestPendingAgeMs: latestPendingAgeMs,
            minPendingAgeMs: movingIntent ? pendingReplayGraceMs : 0,
            allowFreshPendingReplay: allowFreshPendingReplay
        })) {
            return replayAuthoritativeMotion(state, pendingInputs, opts);
        }

        if (pendingInputCount > 0 || movingIntent || horizontalDistSq < (idleBlendDistance * idleBlendDistance)) {
            return false;
        }

        var blend = Math.min(1, dt * Math.max(0.1, idleBlendRate));
        playerX += dx * blend;
        playerZ += dz * blend;
        posY += dy * blend;

        if (horizontalDistSq < 0.0004) {
            playerX = x;
            playerZ = z;
        }
        if (Math.abs(dy) < 0.02) {
            posY = authoritativeY;
        }

        updateAvatarPose();
        updateCameraFromPlayer(dt);
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
        playerX = spawn.x;
        playerZ = spawn.z;
        posY = EYE_HEIGHT;

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
        var helper = movementHelper();
        var world = worldHelper();
        if (!helper || !helper.stepAuthoritativeMovement || !world) return;

        var frameDt = Math.max(0, Number(dt || 0));
        var wasGrounded = !!isGrounded;
        var prevVelocityY = Number(velocityY || 0);
        var motionState = buildLocalMotionState();
        helper.stepAuthoritativeMovement(motionState, buildCurrentInputState(), {
            dtSec: frameDt,
            bounds: world.getWorldBounds(),
            collisionBoxes: world.getCollisionBoxes(),
            getGroundHeightAt: world.getGroundHeightAt,
            movementLocked: isMovementLocked(),
            eyeHeight: EYE_HEIGHT,
            playerHeight: PLAYER_HEIGHT,
            playerRadius: PLAYER_RADIUS,
            epsilon: EPSILON
        });
        copyMotionStateFields(motionState, {
            getGroundHeightAt: world.getGroundHeightAt
        });

        if (wasGrounded && !isGrounded && prevVelocityY <= 0.1 && velocityY > 0.1) {
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

        var horizontalSpeed = lastMoveSpeedNorm * RUN_SPEED;
        updateAvatarPose();
        updateAvatarAnimation(frameDt, horizontalSpeed);
        applyUnifiedGunOffsets(frameDt);
        updateCameraFromPlayer(frameDt);
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

    GamePlayer.cancelSprintUntilRelease = function () {
        return cancelSprintUntilRelease();
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
            sprint: !!isSprintInputActive(),
            adsActive: !!isAdsActive()
        };
    };

    GamePlayer.getMouseSensitivity = function () {
        return mouseSensitivity;
    };

    GamePlayer.setMouseSensitivity = function (nextValue) {
        mouseSensitivity = normalizeMouseSensitivity(nextValue);
        saveMouseSensitivity();
        return mouseSensitivity;
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

    GamePlayer.applyAuthoritativeMotion = function (state) {
        return applyAuthoritativeMotion(state);
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
