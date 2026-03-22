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

    function runtimeRoot() {
        return globalThis.__MAYHEM_RUNTIME || {};
    }

    function playerDeps() {
        return runtimeRoot().GamePlayerDeps || {};
    }

    function sharedApi() {
        var deps = playerDeps();
        return deps.getSharedApi ? deps.getSharedApi() : (runtimeRoot().GameShared || {});
    }

    function gameplayTuningApi() {
        return sharedApi().gameplayTuning || {};
    }

    function movementTuningApi() {
        var gameplayTuning = gameplayTuningApi();
        return gameplayTuning && gameplayTuning.movement ? gameplayTuning.movement : {};
    }

    function entityConstantsApi() {
        return sharedApi().entityConstants || {};
    }

    function inputLabelsApi() {
        return runtimeRoot().GameInputLabels || null;
    }

    function playerStatusFactory() {
        var deps = playerDeps();
        return deps.getPlayerStatusFactory ? deps.getPlayerStatusFactory() : (runtimeRoot().GamePlayerStatus || null);
    }

    function abilityFxApi() {
        var deps = playerDeps();
        return deps.getAbilityFxApi ? deps.getAbilityFxApi() : (runtimeRoot().GameAbilityFx || null);
    }

    function playerWorldFactory() {
        var deps = playerDeps();
        return deps.getPlayerWorldFactory ? deps.getPlayerWorldFactory() : (runtimeRoot().GamePlayerWorld || null);
    }

    function playerViewFactory() {
        var deps = playerDeps();
        return deps.getPlayerViewFactory ? deps.getPlayerViewFactory() : (runtimeRoot().GamePlayerView || null);
    }

    function playerCombatApi() {
        var deps = playerDeps();
        return deps.getPlayerCombatApi ? deps.getPlayerCombatApi() : (runtimeRoot().GamePlayerCombat || null);
    }

    function hitscanApi() {
        var deps = playerDeps();
        return deps.getHitscanApi ? deps.getHitscanApi() : (runtimeRoot().GameHitscan || null);
    }

    function actorVisualFactory() {
        var deps = playerDeps();
        return deps.getActorVisualFactory ? deps.getActorVisualFactory() : (runtimeRoot().GameActorVisualFactory || null);
    }

    function worldApi() {
        var deps = playerDeps();
        return deps.getWorldApi ? deps.getWorldApi() : (runtimeRoot().GameWorld || null);
    }

    function selectableWeaponIds() {
        var shared = sharedApi();
        var selected = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : null;
        return Array.isArray(selected) && selected.length ? selected : ['rifle'];
    }

    function weaponStatsFor(weaponId) {
        var shared = sharedApi();
        return shared.getWeaponStats ? shared.getWeaponStats(weaponId) : null;
    }

    function adsFovForWeapon(weaponId) {
        var shared = sharedApi();
        var weaponStats = weaponStatsFor(weaponId);
        if (shared.resolveWeaponAdsFovDeg) {
            return Number(shared.resolveWeaponAdsFovDeg(weaponStats || { id: weaponId })) || ADS_FOV;
        }
        return weaponId === 'sniper' ? SNIPER_SCOPE_FOV : ADS_FOV;
    }

    function weaponPresentationFor(weaponId) {
        var shared = sharedApi();
        return shared.getWeaponPresentation ? shared.getWeaponPresentation(weaponId) : null;
    }

    function ensureLoadoutSlots() {
        if (Array.isArray(loadoutSlots) && loadoutSlots.length) return loadoutSlots;
        loadoutSlots = selectableWeaponIds().slice();
        if (!loadoutSlots.length) loadoutSlots = ['rifle'];
        return loadoutSlots;
    }

    function networkTuning() {
        var shared = sharedApi();
        return shared.gameplayTuning && shared.gameplayTuning.network
            ? shared.gameplayTuning.network
            : {};
    }

    function matchesBinding(actionId, event, fallbackCodes) {
        var labelsApi = inputLabelsApi();
        return !!(labelsApi && labelsApi.matchesBinding && labelsApi.matchesBinding(actionId, event, fallbackCodes));
    }

    function eyeHeight() {
        return Number(entityConstantsApi().EYE_HEIGHT || 1.6);
    }

    function runSpeed() {
        return Number(movementTuningApi().runSpeed || 14);
    }

    function playerRadius() {
        return Number(entityConstantsApi().PLAYER_RADIUS || 0.35);
    }

    function playerHeight() {
        return Number(entityConstantsApi().PLAYER_HEIGHT || 1.7);
    }

    var MOUSE_SENSITIVITY = 0.002;
    var PITCH_LIMIT = 89 * (Math.PI / 180);
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
    var posY = eyeHeight();
    var isGrounded = true;
    var jumpHoldTimer = 0;
    var jumpPressedLastFrame = false;
    var scopeHeld = false;

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
    var inputListeners = null;

    var currentWeaponId = 'rifle';

    var avatarGroup = null;
    var avatarRig = null;
    var avatarRigApi = null;
    var actorVisual = null;
    var sceneRef = null;
    var hitboxVisible = false;

    var bobTimer = 0;
    var sprinting = false;
    var lastMoveSpeedNorm = 0;
    var loadoutSlots = [];
    var motionStateScratch = {
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        velocityY: 0,
        isGrounded: true,
        jumpHoldTimer: 0,
        jumpHeldLast: false,
        moveSpeedNorm: 0,
        sprinting: false
    };
    var inputStateScratch = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        adsActive: false
    };
    var avatarTransformScratch = {
        x: 0,
        y: 0,
        z: 0
    };

    var lastReplayAckSeq = 0;
    var lastReconciledMotionKey = '';
    var avatarAliveVisible = true;
    var statusApi = (playerStatusFactory() && playerStatusFactory().create)
        ? playerStatusFactory().create({
            nowMs: nowMs,
            getAbilityFxApi: function () { return abilityFxApi(); },
            onStatusVisualChange: function (snapshot) {
                setSpawnShieldVisual(!!(snapshot && snapshot.spawnShielded));
            }
        })
        : null;
    var statusState = statusApi && statusApi.getState ? statusApi.getState() : {
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

    function clearMovementKeys() {
        keys.forward = false;
        keys.backward = false;
        keys.left = false;
        keys.right = false;
        keys.jump = false;
        keys.sprint = false;
    }

    function movementHelper() {
        var shared = sharedApi();
        return shared.authoritativeMovement || null;
    }

    function reconciliationHelper() {
        var shared = sharedApi();
        return shared.authoritativeReconciliation || null;
    }

    function nowMs() {
        return Date.now();
    }

    function worldHelper() {
        if (playerWorld) return playerWorld;
        var helper = playerWorldFactory();
        if (!helper || !helper.create) return null;
        playerWorld = helper.create({
            playerRadius: playerRadius(),
            playerHeight: playerHeight(),
            epsilon: EPSILON
        });
        return playerWorld;
    }

    function viewHelper() {
        if (playerView) return playerView;
        var helper = playerViewFactory();
        if (!helper || !helper.create) return null;
        playerView = helper.create({
            getCurrentWeaponState: function () {
                var combatApi = playerCombatApi();
                if (combatApi && combatApi.getCurrentWeaponState) {
                    return combatApi.getCurrentWeaponState();
                }
                var hitscan = hitscanApi();
                return hitscan && hitscan.getCurrentWeapon
                    ? hitscan.getCurrentWeapon()
                    : null;
            },
            getWeaponPresentation: function (weaponId) {
                return weaponPresentationFor(weaponId);
            }
        });
        return playerView;
    }

    function isStunned(now) {
        return statusApi ? statusApi.isStunned(now) : false;
    }

    function isHookPulled(now) {
        return statusApi ? statusApi.isHookPulled(now) : false;
    }

    function isChoked(now) {
        return statusApi ? statusApi.isChoked(now) : false;
    }

    function isSpawnShielded(now) {
        return statusApi ? statusApi.isSpawnShielded(now) : false;
    }

    function isActionRestricted(actionType, now) {
        return statusApi ? statusApi.isActionRestricted(actionType, now) : false;
    }

    function isMovementLocked(now) {
        return statusApi ? statusApi.isMovementLocked(now) : false;
    }

    function isActionLocked(now) {
        return statusApi ? statusApi.isActionLocked(now) : false;
    }

    function canUseWeapon(now) {
        return statusApi ? statusApi.canUseWeapon(now) : true;
    }

    function canUseThrowable(now) {
        return statusApi ? statusApi.canUseThrowable(now) : true;
    }

    function canUseAbility(now) {
        return statusApi ? statusApi.canUseAbility(now) : true;
    }

    function clearExpiredStatusState(now) {
        if (statusApi && statusApi.clearExpiredStatusState) {
            statusApi.clearExpiredStatusState(now);
        }
    }

    function applyStatusState(patch) {
        if (statusApi && statusApi.applyStatusState) {
            statusApi.applyStatusState(patch);
        }
    }

    function activeChokeLift() {
        return statusApi && statusApi.activeChokeLift ? statusApi.activeChokeLift() : 0;
    }

    function weaponSupportsAds() {
        var weaponStats = weaponStatsFor(currentWeaponId);
        return !!(weaponStats && Number(weaponStats.adsFovDeg) > 0.0001);
    }

    function isSniperScopeWeapon() {
        return currentWeaponId === 'sniper';
    }

    function canUseAds() {
        var hitscan = hitscanApi();
        if (hitscan && hitscan.isAdsBlocked && hitscan.isAdsBlocked()) {
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

    function syncAvatarVisibility(sniperMode, view) {
        var resolvedView = view || viewHelper();
        var viewApi = resolvedView;
        if (!viewApi || !viewApi.syncAvatarVisibility) return;
        viewApi.syncAvatarVisibility({
            avatarGroup: avatarGroup,
            avatarRigApi: avatarRigApi,
            avatarAliveVisible: avatarAliveVisible,
            sniperMode: !!sniperMode
        });
    }

    function resetRecoilState(view) {
        var viewApi = view || viewHelper();
        if (viewApi && viewApi.resetRecoilState) viewApi.resetRecoilState();
    }

    function applyUnifiedGunOffsets(dt, view) {
        var viewApi = view || viewHelper();
        if (viewApi && viewApi.applyUnifiedGunOffsets) viewApi.applyUnifiedGunOffsets(dt, avatarRigApi);
    }

    function updateAvatarAnimation(dt, speed, view) {
        var viewApi = view || viewHelper();
        if (!viewApi || !viewApi.updateAvatarAnimation) return;
        viewApi.updateAvatarAnimation(dt, speed, {
            actorVisual: actorVisual,
            avatarRigApi: avatarRigApi,
            runSpeed: runSpeed(),
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

    function updateCameraFromPlayer(dt, view, speedNorm) {
        var viewApi = view || viewHelper();
        if (!viewApi || !viewApi.updateCamera) return;
        viewApi.updateCamera(dt, {
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
            speedNorm: typeof speedNorm === 'number' ? speedNorm : lastMoveSpeedNorm,
            choked: isChoked(),
            chokeStartedAt: statusState.chokeStartedAt || 0,
            chokeLift: activeChokeLift(),
            updateAvatarPose: updateAvatarPose,
            getWorldCollidables: function () {
                var world = worldApi();
                return world && world.getCollidables
                    ? world.getCollidables()
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

    function triggerFireAction(view) {
        var viewApi = view || viewHelper();
        if (!viewApi || !viewApi.triggerFireAction) return;
        viewApi.triggerFireAction({
            currentWeaponId: currentWeaponId,
            actorVisual: actorVisual,
            avatarRigApi: avatarRigApi
        });
    }

    function updateAvatarPose() {
        if (!avatarGroup) return;
        var feetY = posY - eyeHeight() + activeChokeLift();
        if (actorVisual && actorVisual.setWorldTransform) {
            avatarTransformScratch.x = playerX;
            avatarTransformScratch.y = feetY;
            avatarTransformScratch.z = playerZ;
            actorVisual.setWorldTransform(avatarTransformScratch, yaw);
            return;
        }
        avatarGroup.position.set(playerX, feetY, playerZ);
        avatarGroup.rotation.y = yaw;
        syncHitboxPositions();
    }

    function syncHitboxPositions() {
        var feetY = posY - eyeHeight() + activeChokeLift();
        if (actorVisual && actorVisual.syncHitboxes) {
            avatarTransformScratch.x = playerX;
            avatarTransformScratch.y = feetY;
            avatarTransformScratch.z = playerZ;
            actorVisual.syncHitboxes(avatarTransformScratch);
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
        var actorFactory = actorVisualFactory();
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

    function teardownInput() {
        if (!inputBound || !inputListeners) {
            inputBound = false;
            inputListeners = null;
            return;
        }
        if (typeof document !== 'undefined' && document && typeof document.removeEventListener === 'function') {
            document.removeEventListener('keydown', inputListeners.keydown);
            document.removeEventListener('keyup', inputListeners.keyup);
            document.removeEventListener('mousemove', inputListeners.mousemove);
            document.removeEventListener('mousedown', inputListeners.mousedown);
            document.removeEventListener('contextmenu', inputListeners.contextmenu);
            document.removeEventListener('pointerlockchange', inputListeners.pointerlockchange);
        }
        if (typeof window !== 'undefined' && window && typeof window.removeEventListener === 'function') {
            window.removeEventListener('resize', inputListeners.resize);
            window.removeEventListener('blur', inputListeners.blur);
        }
        inputBound = false;
        inputListeners = null;
    }

    function setupInput() {
        if (inputBound) return;
        inputListeners = {
            keydown: function (e) {
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
            },
            keyup: function (e) {
            if (matchesBinding('move_forward', e, 'KeyW')) keys.forward = false;
            if (matchesBinding('move_left', e, 'KeyA')) keys.left = false;
            if (matchesBinding('move_backward', e, 'KeyS')) keys.backward = false;
            if (matchesBinding('move_right', e, 'KeyD')) keys.right = false;
            if (matchesBinding('sprint', e, ['ShiftLeft', 'ShiftRight'])) {
                keys.sprint = false;
                sprintCanceledUntilRelease = false;
            }
            if (matchesBinding('jump', e, 'Space')) keys.jump = false;
            },
            mousemove: function (e) {
            if (!hasInputCapture()) return;
            var sensitivityMult = isSniperScopeWeapon() ? SNIPER_SCOPE_SENSITIVITY_MULT : ADS_SENSITIVITY_MULT;
            var view = viewHelper();
            var blend = view && view.getScopeBlend ? view.getScopeBlend() : 0;
            var sensitivity = MOUSE_SENSITIVITY * (1 - (blend * (1 - sensitivityMult)));
            yaw -= (e.movementX || 0) * sensitivity;
            pitch -= (e.movementY || 0) * sensitivity;
            pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
            },
            mousedown: function (e) {
            if (e.button !== 2) return;
            if (!hasInputCapture()) return;
            e.preventDefault();
            toggleAds();
            },
            contextmenu: function (e) {
            if (!hasInputCapture()) return;
            e.preventDefault();
            },
            resize: function () {
            if (camera) {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
            }
            },
            blur: function () {
            scopeHeld = false;
            clearMovementKeys();
        },
            pointerlockchange: function () {
            if (!hasInputCapture()) scopeHeld = false;
            }
        };
        if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
            document.addEventListener('keydown', inputListeners.keydown);
            document.addEventListener('keyup', inputListeners.keyup);
            document.addEventListener('mousemove', inputListeners.mousemove);
            document.addEventListener('mousedown', inputListeners.mousedown);
            document.addEventListener('contextmenu', inputListeners.contextmenu);
            document.addEventListener('pointerlockchange', inputListeners.pointerlockchange);
        }
        if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
            window.addEventListener('resize', inputListeners.resize);
            window.addEventListener('blur', inputListeners.blur);
        }
        inputBound = true;
    }

    function resetVerticalState(feetY) {
        velocityY = 0;
        posY = feetY + eyeHeight();
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
        var view = viewHelper();
        resetRecoilState(view);
        updateAvatarPose();
        updateCameraFromPlayer(1, view, 0);
        return true;
    }

    function buildLocalMotionState() {
        motionStateScratch.x = playerX;
        motionStateScratch.y = posY;
        motionStateScratch.z = playerZ;
        motionStateScratch.yaw = yaw;
        motionStateScratch.pitch = pitch;
        motionStateScratch.velocityY = velocityY;
        motionStateScratch.isGrounded = isGrounded;
        motionStateScratch.jumpHoldTimer = jumpHoldTimer;
        motionStateScratch.jumpHeldLast = !!jumpPressedLastFrame;
        motionStateScratch.moveSpeedNorm = lastMoveSpeedNorm;
        motionStateScratch.sprinting = !!sprinting;
        return motionStateScratch;
    }

    function buildCurrentInputState() {
        inputStateScratch.forward = !!keys.forward;
        inputStateScratch.backward = !!keys.backward;
        inputStateScratch.left = !!keys.left;
        inputStateScratch.right = !!keys.right;
        inputStateScratch.jump = !!keys.jump;
        inputStateScratch.sprint = !!isSprintInputActive();
        inputStateScratch.adsActive = !!isAdsActive();
        return inputStateScratch;
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
            posY = groundHeightAt ? (Number(groundHeightAt(playerX, playerZ) || 0) + eyeHeight()) : eyeHeight();
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

        var view = viewHelper();
        resetRecoilState(view);
        updateAvatarPose();
        updateCameraFromPlayer(1 / 60, view);
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
        updateCameraFromPlayer(Math.max(1 / 240, Number(dt || (1 / 60))), viewHelper());
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
        var motionState = reconcile.replayMotionState(state, Array.isArray(pendingInputs) ? pendingInputs : [], {
            stepMovement: helper.stepAuthoritativeMovement,
            bounds: world.getWorldBounds(),
            collisionBoxes: world.getCollisionBoxes(),
            getGroundHeightAt: world.getGroundHeightAt,
            movementLocked: function () { return isMovementLocked(); },
            eyeHeight: eyeHeight(),
            playerHeight: playerHeight(),
            playerRadius: playerRadius(),
            epsilon: EPSILON,
            fallbackYaw: yaw,
            fallbackPitch: pitch
        });
        return applyMotionState(motionState, opts.dt);
    }

    function buildAuthoritativeMotionKey(state) {
        if (!state || typeof state !== 'object') return '';
        function precision(value) {
            return Math.round(Number(value || 0) * 1000);
        }
        return [
            precision(state.x),
            precision(state.y),
            precision(state.z),
            precision(state.yaw),
            precision(state.pitch),
            precision(state.velocityY),
            state.isGrounded === false ? '0' : '1',
            state.alive === false ? '0' : '1'
        ].join('|');
    }

    function hasMovementIntentInput() {
        return !!(keys.forward || keys.backward || keys.left || keys.right || keys.jump || isSprintInputActive());
    }

    function resolveReconciliationThresholds(opts, reconcileTuning, adaptiveSelfReconciliation, airborne, movingIntent) {
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

        return {
            hardSnapDistance: hardSnapDistance,
            hardSnapVerticalDistance: hardSnapVerticalDistance,
            idleBlendDistance: idleBlendDistance,
            idleBlendRate: idleBlendRate,
            replayDistance: replayDistance,
            pendingReplayGraceMs: pendingReplayGraceMs,
            emergencyReplayDistance: emergencyReplayDistance,
            movingAckDriftLimit: movingAckDriftLimit,
            movingPendingInputLimit: movingPendingInputLimit
        };
    }

    function shouldReplayAuthoritativeMotion(reconcile, opts, pendingInputCount, horizontalDistSq, replayDistance, authoritativeStateChanged, movingIntent, canCorrectWhileMoving, latestPendingAgeMs, pendingReplayGraceMs, allowFreshPendingReplay) {
        return !!(
            opts.allowReplayCorrection !== false &&
            reconcile &&
            reconcile.shouldReplayAuthoritativeCorrection &&
            reconcile.shouldReplayAuthoritativeCorrection({
                pendingInputCount: pendingInputCount,
                lastAckedSeq: Number(opts.lastAckedSeq || 0),
                lastReplayAckSeq: lastReplayAckSeq,
                horizontalDistSq: horizontalDistSq,
                replayCorrectionDistance: replayDistance,
                authoritativeStateChanged: authoritativeStateChanged,
                allowReplayWithoutAckAdvance: authoritativeStateChanged,
                movingIntent: movingIntent,
                canCorrectWhileMoving: canCorrectWhileMoving,
                latestPendingAgeMs: latestPendingAgeMs,
                minPendingAgeMs: movingIntent ? pendingReplayGraceMs : 0,
                allowFreshPendingReplay: allowFreshPendingReplay
            })
        );
    }

    function applyIdleBlendCorrection(dt, x, z, authoritativeY, dx, dz, dy, horizontalDistSq, idleBlendRate) {
        var rate = Math.max(0.1, idleBlendRate);
        var distFactor = Math.min(1, Math.sqrt(horizontalDistSq) * 0.6);
        var blend = Math.min(1, dt * (rate + rate * distFactor));
        playerX += dx * blend;
        playerZ += dz * blend;
        posY += dy * blend;

        if (horizontalDistSq < 0.005) {
            playerX = x;
            playerZ = z;
        }
        if (Math.abs(dy) < 0.05) {
            posY = authoritativeY;
        }

        updateAvatarPose();
        updateCameraFromPlayer(dt, viewHelper());
        return true;
    }

    function reconcileAuthoritativeMotion(state, options) {
        if (!camera || !state) return false;
        var x = Number(state.x);
        var z = Number(state.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

        var opts = options || {};
        var motionKey = buildAuthoritativeMotionKey(state);
        var authoritativeStateChanged = motionKey !== lastReconciledMotionKey;
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
        var pendingInputCount = Math.max(0, Number(opts.pendingInputCount || 0));
        var latestPendingAgeMs = Math.max(0, Number(opts.latestPendingAgeMs || 0));
        var ackDrift = Math.max(0, Number(opts.ackDrift != null ? opts.ackDrift : (Number(opts.lastSentSeq || 0) - Number(opts.lastAckedSeq || 0))));
        var hasUnsentInputTail = !!opts.hasUnsentInputTail;
        var movingIntent = hasMovementIntentInput() && !isMovementLocked();
        var thresholds = resolveReconciliationThresholds(opts, reconcileTuning, adaptiveSelfReconciliation, airborne, movingIntent);
        var canCorrectWhileMoving = !hasUnsentInputTail &&
            pendingInputCount <= thresholds.movingPendingInputLimit &&
            ackDrift <= thresholds.movingAckDriftLimit;
        var allowFreshPendingReplay = movingIntent && horizontalDistSq >= (thresholds.emergencyReplayDistance * thresholds.emergencyReplayDistance);
        var pendingInputs = Array.isArray(opts.pendingInputs) ? opts.pendingInputs : [];
        var reconcile = reconciliationHelper();

        if (
            opts.force ||
            horizontalDistSq >= (thresholds.hardSnapDistance * thresholds.hardSnapDistance) ||
            Math.abs(dy) >= thresholds.hardSnapVerticalDistance
        ) {
            var snapped = applyAuthoritativeMotion(state);
            if (snapped) lastReconciledMotionKey = motionKey;
            return snapped;
        }

        if (shouldReplayAuthoritativeMotion(
            reconcile,
            opts,
            pendingInputCount,
            horizontalDistSq,
            thresholds.replayDistance,
            authoritativeStateChanged,
            movingIntent,
            canCorrectWhileMoving,
            latestPendingAgeMs,
            thresholds.pendingReplayGraceMs,
            allowFreshPendingReplay
        )) {
            var replayed = replayAuthoritativeMotion(state, pendingInputs, opts);
            if (replayed) lastReconciledMotionKey = motionKey;
            return replayed;
        }

        if (movingIntent || horizontalDistSq < (thresholds.idleBlendDistance * thresholds.idleBlendDistance)) {
            return false;
        }

        var blendRate = pendingInputCount > 0
            ? Math.max(0.1, thresholds.idleBlendRate * 0.35)
            : thresholds.idleBlendRate;
        var blended = applyIdleBlendCorrection(
            dt,
            x,
            z,
            authoritativeY,
            dx,
            dz,
            dy,
            horizontalDistSq,
            blendRate
        );
        if (blended) lastReconciledMotionKey = motionKey;
        return blended;
    }

    function resetStatusState() {
        applyStatusState({
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
        });
    }

    function destroyPlayerState() {
        teardownInput();
        clearMovementKeys();
        scopeHeld = false;
        sprintCanceledUntilRelease = false;
        sprinting = false;
        avatarAliveVisible = true;
        lastMoveSpeedNorm = 0;
        lastReplayAckSeq = 0;
        lastReconciledMotionKey = '';
        resetStatusState();
        if (actorVisual && actorVisual.destroy) {
            actorVisual.destroy();
        } else {
            if (avatarGroup && avatarGroup.parent) avatarGroup.parent.remove(avatarGroup);
        }
        actorVisual = null;
        avatarGroup = null;
        avatarRig = null;
        avatarRigApi = null;
        if (camera && camera.parent) camera.parent.remove(camera);
        camera = null;
        sceneRef = null;
        playerView = null;
        playerWorld = null;
    }

    GamePlayer.init = function (scene) {
        destroyPlayerState();
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
        posY = Number(world.getGroundHeightAt(playerX, playerZ) || 0) + eyeHeight();
        ensureLoadoutSlots();
        if (loadoutSlots.indexOf(currentWeaponId) === -1) {
            currentWeaponId = loadoutSlots[0];
        }

        ensureHitboxes();

        var view = viewHelper();
        resetRecoilState(view);
        applyAvatarWeaponPose();
        setupInput();
        updateAvatarPose();
        updateCameraFromPlayer(1, view, 0);

        return camera;
    };

    GamePlayer.update = function (dt) {
        if (!camera) return;
        clearExpiredStatusState(nowMs());
        var helper = movementHelper();
        var world = worldHelper();
        if (!helper || !helper.stepAuthoritativeMovement || !world) return;
        if (!hasInputCapture()) {
            updateAvatarPose();
            updateCameraFromPlayer(Math.max(1 / 240, Number(dt || (1 / 60))), viewHelper(), lastMoveSpeedNorm);
            return;
        }

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
            eyeHeight: eyeHeight(),
            playerHeight: playerHeight(),
            playerRadius: playerRadius(),
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

        var horizontalSpeed = lastMoveSpeedNorm * runSpeed();
        var view = viewHelper();
        updateAvatarPose();
        updateAvatarAnimation(frameDt, horizontalSpeed, view);
        applyUnifiedGunOffsets(frameDt, view);
        updateCameraFromPlayer(frameDt, view, lastMoveSpeedNorm);
    };

    GamePlayer.isExperimentalCameraView = function () {
        return true;
    };

    GamePlayer.setWeaponModel = function (weaponId) {
        currentWeaponId = weaponId || 'rifle';
        scopeHeld = false;
        resetRecoilState(viewHelper());
        applyAvatarWeaponPose();
        return true;
    };

    GamePlayer.getCamera = function () {
        return camera;
    };

    GamePlayer.getPosition = function (outVec3) {
        var out = outVec3 || new THREE.Vector3();
        return out.set(playerX, posY, playerZ);
    };

    GamePlayer.getRotation = function () {
        return { yaw: yaw, pitch: pitch };
    };

    GamePlayer.getMuzzleWorldPosition = function (outVec3) {
        var view = viewHelper();
        return view && view.getMuzzleWorldPosition
            ? view.getMuzzleWorldPosition({ actorVisual: actorVisual, avatarRigApi: avatarRigApi, camera: camera }, outVec3)
            : null;
    };

    GamePlayer.getCoreWorldPosition = function (outVec3) {
        var view = viewHelper();
        return view && view.getCoreWorldPosition
            ? view.getCoreWorldPosition({ actorVisual: actorVisual, camera: camera }, outVec3)
            : null;
    };

    GamePlayer.getEyeWorldPosition = function (outVec3) {
        var view = viewHelper();
        return view && view.getEyeWorldPosition
            ? view.getEyeWorldPosition({ actorVisual: actorVisual, avatarRigApi: avatarRigApi, camera: camera }, outVec3)
            : null;
    };

    GamePlayer.getThrowableOriginWorldPosition = function (outVec3) {
        var view = viewHelper();
        return view && view.getThrowableOriginWorldPosition
            ? view.getThrowableOriginWorldPosition({ actorVisual: actorVisual, camera: camera }, outVec3)
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

    GamePlayer.setLoadout = function (loadoutConfig) {
        ensureLoadoutSlots();
        if (!loadoutConfig || !Array.isArray(loadoutConfig.slots)) {
            return { slots: loadoutSlots.slice() };
        }

        var allowed = {};
        var hasAllowed = false;
        var hitscan = hitscanApi();
        if (hitscan && hitscan.getAllWeaponIds) {
            var ids = hitscan.getAllWeaponIds();
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
                resetRecoilState(viewHelper());
                applyAvatarWeaponPose();
            }
        }
        return { slots: loadoutSlots.slice() };
    };

    GamePlayer.getLoadout = function () {
        ensureLoadoutSlots();
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
            triggerFireAction(viewHelper());
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
        GamePlayer.setWeaponModel(loadoutSlots[idx]);
        return currentWeaponId;
    };

    GamePlayer.destroy = function () {
        destroyPlayerState();
        return true;
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
