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

    function gameplayControlsApi() {
        return runtimeRoot().GameGameplayControls || null;
    }

    function reconciliationRuntimeApi() {
        return runtimeRoot().GamePlayerReconciliation || null;
    }

    function loadoutRuntimeApi() {
        return runtimeRoot().GamePlayerLoadout || null;
    }

    function cameraRuntimeApi() {
        return runtimeRoot().GamePlayerCamera || null;
    }

    function inputRuntimeApi() {
        return runtimeRoot().GamePlayerInput || null;
    }

    function sprintRuntimeApi() {
        return runtimeRoot().GamePlayerSprint || null;
    }

    function visualRuntimeApi() {
        return runtimeRoot().GamePlayerVisual || null;
    }

    function motionStateRuntimeApi() {
        return runtimeRoot().GamePlayerMotionState || null;
    }

    function replayRuntimeApi() {
        return runtimeRoot().GamePlayerReplay || null;
    }

    function statusBridgeRuntimeApi() {
        return runtimeRoot().GamePlayerStatusBridge || null;
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
        var shared = sharedApi();
        return shared.getMovementTuning ? (shared.getMovementTuning() || {}) : {};
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
        var helper = loadoutRuntimeApi();
        return helper && helper.getSelectableWeaponIds
            ? helper.getSelectableWeaponIds(sharedApi())
            : ['rifle'];
    }

    function defaultWeaponLoadout() {
        var helper = loadoutRuntimeApi();
        return helper && helper.getDefaultWeaponLoadout
            ? helper.getDefaultWeaponLoadout(sharedApi())
            : selectableWeaponIds().slice(0, 2);
    }

    function weaponStatsFor(weaponId) {
        var helper = loadoutRuntimeApi();
        return helper && helper.getWeaponStats
            ? helper.getWeaponStats(sharedApi(), weaponId)
            : null;
    }

    function adsFovForWeapon(weaponId) {
        var helper = loadoutRuntimeApi();
        return helper && helper.resolveAdsFov
            ? helper.resolveAdsFov(sharedApi(), weaponId, ADS_FOV, SNIPER_SCOPE_FOV)
            : ADS_FOV;
    }

    function weaponPresentationFor(weaponId) {
        var helper = loadoutRuntimeApi();
        return helper && helper.getWeaponPresentation
            ? helper.getWeaponPresentation(sharedApi(), weaponId)
            : null;
    }

    function normalizeSniperLoadoutOrder(slots) {
        var helper = loadoutRuntimeApi();
        return helper && helper.normalizeSniperLoadoutOrder
            ? helper.normalizeSniperLoadoutOrder(slots, sharedApi())
            : (Array.isArray(slots) ? slots.slice(0, 2) : []);
    }

    function ensureLoadoutSlots() {
        if (Array.isArray(loadoutSlots) && loadoutSlots.length) return loadoutSlots;
        var helper = loadoutRuntimeApi();
        loadoutSlots = helper && helper.ensureLoadoutSlots
            ? helper.ensureLoadoutSlots(loadoutSlots, sharedApi())
            : ['rifle'];
        return loadoutSlots;
    }

    function networkTuning() {
        var shared = sharedApi();
        return shared.getNetworkTuning ? (shared.getNetworkTuning() || {}) : {};
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

    function jogSpeed() {
        return Number(movementTuningApi().jogSpeed || 8);
    }

    function weaponMoveSpeedMultiplier(weaponId) {
        var helper = loadoutRuntimeApi();
        return helper && helper.weaponMoveSpeedMultiplier
            ? helper.weaponMoveSpeedMultiplier(sharedApi(), weaponId)
            : 1;
    }

    function weaponAdsMoveMultiplier(weaponId) {
        var helper = loadoutRuntimeApi();
        return helper && helper.weaponAdsMoveMultiplier
            ? helper.weaponAdsMoveMultiplier(sharedApi(), movementTuningApi(), weaponId)
            : 0.4;
    }

    function effectiveRunSpeedForWeapon(weaponId) {
        return runSpeed() * weaponMoveSpeedMultiplier(weaponId);
    }

    function playerRadius() {
        return Number(entityConstantsApi().PLAYER_RADIUS || 0.5);
    }

    function playerHeight() {
        return Number(entityConstantsApi().PLAYER_HEIGHT || 2.8);
    }

    function rollContactCylinderHeightScale() {
        return Math.max(0.05, Number(entityConstantsApi().ROLL_CONTACT_CYLINDER_HEIGHT_SCALE || 0.3));
    }

    function effectivePlayerCollisionHeight() {
        var baseHeight = playerHeight();
        if (!isRolling()) return baseHeight;
        return Math.max(playerRadius(), baseHeight * rollContactCylinderHeightScale());
    }

    var BACKWARD_SPRINT_SPEED_MULT = 1.25;
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
    var FORWARD_ROLL_ACTION_DURATION_MS = 360;
    var BACKWARD_ROLL_ACTION_DURATION_MS = 520;

    var playerX = 25;
    var playerZ = 45;
    var velocityY = 0;
    var posY = eyeHeight();
    var isGrounded = true;
    var jumpHoldTimer = 0;
    var jumpPressedLastFrame = false;

    var keys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false
    };
    var rollInputSuppressedUntilRelease = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false
    };
    var activeRollInputState = null;
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
    var fastBackpedal = false;
    var airborneSprintCarry = false;
    var lastMoveSpeedNorm = 0;
    var sprintTemporarilyCanceledUntil = 0;
    var sprintTemporaryResumeTimer = 0;
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
        airborneSprintCarry: false,
        moveSpeedNorm: 0,
        sprinting: false,
        fastBackpedal: false
    };
    var queuedMotionCorrection = (reconciliationRuntimeApi() && reconciliationRuntimeApi().createMotionCorrectionState)
        ? reconciliationRuntimeApi().createMotionCorrectionState()
        : { x: 0, y: 0, z: 0 };
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
            onStatusVisualChange: function (snapshot) {
                setSpawnShieldVisual(!!(snapshot && snapshot.spawnShielded));
            }
        })
        : null;
    var statusState = statusApi && statusApi.getState ? statusApi.getState() : {
        stunUntil: 0,
        spawnShieldUntil: 0,
        weaponUntil: 0,
        throwableUntil: 0
    };
    var rollUntil = 0;
    function hasInputCapture() {
        var helper = inputRuntimeApi();
        if (helper && helper.hasInputCapture) {
            return !!helper.hasInputCapture(inputHelperState());
        }
        if (!!document.pointerLockElement) return true;
        var controlsApi = gameplayControlsApi();
        return !!(controlsApi && controlsApi.hasVirtualCapture && controlsApi.hasVirtualCapture());
    }

    function clearMovementKeys() {
        var helper = inputRuntimeApi();
        if (helper && helper.clearMovementKeys) {
            helper.clearMovementKeys(inputHelperState());
            activeRollInputState = null;
            return;
        }
    }

    function setMovementInputState(nextState) {
        var helper = inputRuntimeApi();
        if (helper && helper.patchMovementInputState) {
            var next = helper.patchMovementInputState(inputHelperState(), nextState);
            if (!keys.sprint) {
                sprintCanceledUntilRelease = false;
                clearSprintTemporaryResumeTimer();
                sprintTemporarilyCanceledUntil = 0;
            }
            return next;
        }
        return buildCurrentInputState();
    }

    function applyLookDelta(deltaX, deltaY, multiplier) {
        var helper = inputRuntimeApi();
        if (helper && helper.applyLookDelta) {
            var state = inputHelperState();
            var result = helper.applyLookDelta(state, deltaX, deltaY, multiplier);
            yaw = Number(state.lookState.yaw || yaw);
            pitch = Number(state.lookState.pitch || pitch);
            return result;
        }
        return { yaw: yaw, pitch: pitch };
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

    function inputHelperState() {
        return {
            keys: keys,
            rollInputSuppressedUntilRelease: rollInputSuppressedUntilRelease,
            activeRollInputState: activeRollInputState,
            currentInputState: inputStateScratch,
            lookState: { yaw: yaw, pitch: pitch },
            document: typeof document !== 'undefined' ? document : null,
            controlsApi: gameplayControlsApi(),
            hasVirtualCapture: function () {
                var controlsApi = gameplayControlsApi();
                return !!(controlsApi && controlsApi.hasVirtualCapture && controlsApi.hasVirtualCapture());
            },
            getScopeBlend: function () {
                var view = viewHelper();
                return view && view.getScopeBlend ? view.getScopeBlend() : 0;
            },
            isSniperScopeWeapon: function () { return isSniperScopeWeapon(); },
            currentWeaponId: currentWeaponId,
            mouseSensitivity: MOUSE_SENSITIVITY,
            adsSensitivityMult: ADS_SENSITIVITY_MULT,
            sniperScopeSensitivityMult: SNIPER_SCOPE_SENSITIVITY_MULT,
            pitchLimit: PITCH_LIMIT,
            isMovementInputBlocked: movementInputBlocked,
            isRolling: function () { return isRolling(); },
            isSprintInputActive: isSprintInputActive,
            isScopeModeActive: isScopeModeActive,
            sprintCanceledUntilRelease: sprintCanceledUntilRelease,
            sprintTemporarilyCanceledUntil: sprintTemporarilyCanceledUntil,
            sprintTemporaryResumeTimer: sprintTemporaryResumeTimer,
            nowMs: nowMs
        };
    }

    function sprintHelperState() {
        return {
            keys: keys,
            sprinting: sprinting,
            sprintCanceledUntilRelease: sprintCanceledUntilRelease,
            sprintTemporarilyCanceledUntil: sprintTemporarilyCanceledUntil,
            sprintTemporaryResumeTimer: sprintTemporaryResumeTimer
        };
    }

    function syncSprintStateFrom(state) {
        if (!state || typeof state !== 'object') return;
        sprinting = !!state.sprinting;
        sprintCanceledUntilRelease = !!state.sprintCanceledUntilRelease;
        sprintTemporarilyCanceledUntil = Number(state.sprintTemporarilyCanceledUntil || 0);
        sprintTemporaryResumeTimer = state.sprintTemporaryResumeTimer || 0;
    }

    function visualHelperState() {
        return {
            actorVisual: actorVisual,
            avatarRigApi: avatarRigApi,
            avatarGroup: avatarGroup,
            avatarAliveVisible: avatarAliveVisible,
            hitboxVisible: hitboxVisible,
            currentWeaponId: currentWeaponId,
            playerX: playerX,
            playerZ: playerZ,
            posY: posY,
            eyeHeight: eyeHeight(),
            yaw: yaw,
            rolling: isRolling(),
            scopeBlend: (function () {
                var view = viewHelper();
                return view && view.getScopeBlend ? view.getScopeBlend() : 0;
            })(),
            sniperMode: isSniperScopeWeapon()
        };
    }

    function motionStateView() {
        return {
            x: playerX,
            y: posY,
            z: playerZ,
            yaw: yaw,
            pitch: pitch,
            velocityY: velocityY,
            isGrounded: isGrounded,
            jumpHoldTimer: jumpHoldTimer,
            jumpHeldLast: jumpPressedLastFrame,
            airborneSprintCarry: airborneSprintCarry,
            moveSpeedNorm: lastMoveSpeedNorm,
            sprinting: sprinting,
            fastBackpedal: fastBackpedal,
            rollUntil: rollUntil,
            activeRollInputState: activeRollInputState
        };
    }

    function applyMotionStateView(state) {
        if (!state || typeof state !== 'object') return;
        playerX = Number(state.x || 0);
        posY = Number(state.y || 0);
        playerZ = Number(state.z || 0);
        yaw = Number(state.yaw || 0);
        pitch = Number(state.pitch || 0);
        velocityY = Number(state.velocityY || 0);
        isGrounded = !!state.isGrounded;
        jumpHoldTimer = Number(state.jumpHoldTimer || 0);
        jumpPressedLastFrame = !!state.jumpHeldLast;
        airborneSprintCarry = !!state.airborneSprintCarry;
        lastMoveSpeedNorm = Number(state.moveSpeedNorm || 0);
        sprinting = !!state.sprinting;
        fastBackpedal = !!state.fastBackpedal;
        rollUntil = Number(state.rollUntil || 0);
        activeRollInputState = state.activeRollInputState || null;
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
        var helper = statusBridgeRuntimeApi();
        return helper && helper.isStunned
            ? !!helper.isStunned(statusApi, now, { nowMs: nowMs })
            : (statusApi ? statusApi.isStunned(now) : false);
    }

    function isSpawnShielded(now) {
        var helper = statusBridgeRuntimeApi();
        return helper && helper.isSpawnShielded
            ? !!helper.isSpawnShielded(statusApi, now, { nowMs: nowMs })
            : (statusApi ? statusApi.isSpawnShielded(now) : false);
    }

    function isActionRestricted(actionType, now) {
        var helper = statusBridgeRuntimeApi();
        return helper && helper.isActionRestricted
            ? !!helper.isActionRestricted(statusApi, actionType, now, { nowMs: nowMs })
            : (statusApi ? statusApi.isActionRestricted(actionType, now) : false);
    }

    function isMovementAnimationLocked() {
        return !!(avatarRigApi && avatarRigApi.isMovementAnimationLocked && avatarRigApi.isMovementAnimationLocked());
    }

    function isMovementLocked(now) {
        var helper = statusBridgeRuntimeApi();
        return helper && helper.isMovementLocked
            ? !!helper.isMovementLocked(statusApi, now, { nowMs: nowMs })
            : (statusApi ? statusApi.isMovementLocked(now) : false);
    }

    function movementInputBlocked() {
        var helper = statusBridgeRuntimeApi();
        if (helper && helper.deriveMovementBlocked) {
            return !!helper.deriveMovementBlocked(statusApi, undefined, { nowMs: nowMs }) || isMovementAnimationLocked();
        }
        return isMovementLocked() || isMovementAnimationLocked();
    }

    function isActionLocked(now) {
        var helper = statusBridgeRuntimeApi();
        return helper && helper.isActionLocked
            ? !!helper.isActionLocked(statusApi, now, { nowMs: nowMs })
            : (statusApi ? statusApi.isActionLocked(now) : false);
    }

    function canUseWeapon(now) {
        return statusApi ? statusApi.canUseWeapon(now) : true;
    }

    function canUseThrowable(now) {
        return statusApi ? statusApi.canUseThrowable(now) : true;
    }

    function isRolling(now) {
        return Number(rollUntil || 0) > Number(now || nowMs());
    }

    function clearExpiredStatusState(now) {
        var helper = statusBridgeRuntimeApi();
        if (helper && helper.clearExpiredStatusState) {
            helper.clearExpiredStatusState(statusApi, now, { nowMs: nowMs });
            return;
        }
        if (statusApi && statusApi.clearExpiredStatusState) statusApi.clearExpiredStatusState(now);
    }

    function applyStatusState(patch) {
        var helper = statusBridgeRuntimeApi();
        if (helper && helper.applyStatusState) {
            helper.applyStatusState(statusApi, patch, {
                nowMs: nowMs,
                onStatusVisualChange: function (snapshot) {
                    setSpawnShieldVisual(!!(snapshot && snapshot.spawnShielded));
                }
            });
            return;
        }
        if (statusApi && statusApi.applyStatusState) statusApi.applyStatusState(patch);
    }

    function isSniperScopeWeapon() {
        var helper = cameraRuntimeApi();
        return helper && helper.isSniperScopeWeapon
            ? helper.isSniperScopeWeapon(currentWeaponId)
            : currentWeaponId === 'sniper';
    }

    function scopeTargetActive() {
        var helper = cameraRuntimeApi();
        return helper && helper.scopeTargetActive
            ? helper.scopeTargetActive(currentWeaponId, hasInputCapture(), isSprintInputActive())
            : (isSniperScopeWeapon() && hasInputCapture() && !isSprintInputActive());
    }

    function scopeStateSnapshot() {
        var view = viewHelper();
        var helper = cameraRuntimeApi();
        return helper && helper.scopeStateSnapshot
            ? helper.scopeStateSnapshot(view, {
                currentWeaponId: currentWeaponId,
                scopeTargetActive: scopeTargetActive(),
                sniperMode: isSniperScopeWeapon()
            })
            : {
                weaponId: currentWeaponId,
                active: scopeTargetActive(),
                blend: 0,
                sniper: isSniperScopeWeapon(),
                scopeActive: false,
                ready: false,
                phase: 'inactive'
            };
    }

    function isScopeModeActive() {
        var scopeState = scopeStateSnapshot();
        var helper = cameraRuntimeApi();
        return helper && helper.isScopeModeActive
            ? helper.isScopeModeActive(scopeState, currentWeaponId)
            : !!(scopeState && scopeState.active && scopeState.weaponId === currentWeaponId);
    }

    function isSniperScopeReady() {
        var scopeState = scopeStateSnapshot();
        var helper = cameraRuntimeApi();
        return helper && helper.isSniperScopeReady
            ? helper.isSniperScopeReady(scopeState, currentWeaponId)
            : !!(scopeState && scopeState.ready && scopeState.weaponId === currentWeaponId);
    }

    function isSprintInputActive() {
        var helper = sprintRuntimeApi();
        return helper && helper.isSprintActive
            ? !!helper.isSprintActive(sprintHelperState(), nowMs())
            : (!!keys.sprint &&
                !sprintCanceledUntilRelease &&
                Number(sprintTemporarilyCanceledUntil || 0) <= nowMs());
    }

    function clearSprintTemporaryResumeTimer() {
        var helper = sprintRuntimeApi();
        if (helper && helper.clearSprintTimerState) {
            var state = sprintHelperState();
            helper.clearSprintTimerState(state, typeof clearTimeout === 'function' ? clearTimeout : null);
            syncSprintStateFrom(state);
            return;
        }
        sprintTemporaryResumeTimer = 0;
    }

    function cancelSprintUntilRelease() {
        var helper = sprintRuntimeApi();
        if (helper && helper.cancelSprintUntilRelease) {
            var state = sprintHelperState();
            var result = helper.cancelSprintUntilRelease(state, typeof clearTimeout === 'function' ? clearTimeout : null);
            syncSprintStateFrom(state);
            return result;
        }
        return false;
    }

    function cancelSprintTemporarily(durationMs) {
        var helper = sprintRuntimeApi();
        if (helper && helper.cancelSprintTemporarily) {
            var state = sprintHelperState();
            var result = helper.cancelSprintTemporarily(
                state,
                durationMs,
                nowMs(),
                typeof setTimeout === 'function' ? setTimeout : null,
                typeof clearTimeout === 'function' ? clearTimeout : null
            );
            syncSprintStateFrom(state);
            return result;
        }
        return false;
    }

    function cancelScopedView() {
        var view = viewHelper();
        var helper = cameraRuntimeApi();
        if (helper && helper.cancelScopedView) {
            helper.cancelScopedView(view);
            return;
        }
        if (view && view.cancelScope) view.cancelScope();
    }

    function setAdsEnabled(enabled) {
        var helper = cameraRuntimeApi();
        if (helper && helper.setAdsEnabled) {
            return helper.setAdsEnabled(enabled, viewHelper());
        }
        if (!enabled) cancelScopedView();
        return false;
    }

    function applyAvatarWeaponPose() {
        var helper = visualRuntimeApi();
        if (helper && helper.setWeaponPose) {
            helper.setWeaponPose(visualHelperState(), currentWeaponId);
            avatarRig = actorVisual && actorVisual.rig ? actorVisual.rig : avatarRig;
            return;
        }
    }

    function syncAvatarVisibility(sniperMode, view) {
        var resolvedView = view || viewHelper();
        var helper = cameraRuntimeApi();
        var payload = {
            avatarGroup: avatarGroup,
            avatarRigApi: avatarRigApi,
            avatarAliveVisible: avatarAliveVisible,
            sniperMode: !!sniperMode
        };
        if (helper && helper.syncAvatarVisibility) {
            helper.syncAvatarVisibility(resolvedView, payload);
            return;
        }
        return;
    }

    function resetRecoilState(view) {
        var viewApi = view || viewHelper();
        var helper = cameraRuntimeApi();
        if (helper && helper.resetRecoilState) {
            helper.resetRecoilState(viewApi);
            return;
        }
        if (viewApi && viewApi.resetRecoilState) viewApi.resetRecoilState();
    }

    function applyUnifiedGunOffsets(dt, view) {
        var viewApi = view || viewHelper();
        var helper = cameraRuntimeApi();
        if (helper && helper.applyUnifiedGunOffsets) {
            helper.applyUnifiedGunOffsets(viewApi, dt, avatarRigApi);
            return;
        }
        if (viewApi && viewApi.applyUnifiedGunOffsets) viewApi.applyUnifiedGunOffsets(dt, avatarRigApi);
    }

    function updateAvatarAnimation(dt, speed, view) {
        var viewApi = view || viewHelper();
        var payload = {
            actorVisual: actorVisual,
            avatarRigApi: avatarRigApi,
            runSpeed: effectiveRunSpeedForWeapon(currentWeaponId),
            sprinting: sprinting,
            fastBackpedal: fastBackpedal,
            isGrounded: isGrounded,
            footY: posY - eyeHeight(),
            yaw: yaw,
            pitch: pitch,
            adsActive: isScopeModeActive(),
            movingForward: !!keys.forward,
            movingBackward: !!keys.backward,
            movingLeft: !!keys.left,
            movingRight: !!keys.right
        };
        var helper = cameraRuntimeApi();
        if (helper && helper.updateAvatarAnimation) {
            helper.updateAvatarAnimation(viewApi, dt, speed, payload);
            return;
        }
        if (!viewApi || !viewApi.updateAvatarAnimation) return;
        viewApi.updateAvatarAnimation(dt, speed, payload);
    }

    function updateCameraFromPlayer(dt, view, speedNorm) {
        var viewApi = view || viewHelper();
        var cameraProfile = avatarRigApi && avatarRigApi.getCameraProfile
            ? (avatarRigApi.getCameraProfile() || {})
            : {};
        var payload = {
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
            adsActive: isSniperScopeReady(),
            scopeTargetActive: isScopeModeActive(),
            speedNorm: typeof speedNorm === 'number' ? speedNorm : lastMoveSpeedNorm,
            updateAvatarPose: updateAvatarPose,
            getWorldCollidables: function () {
                var world = worldApi();
                return world && world.getCollidables
                    ? world.getCollidables()
                    : [];
            },
            pitchLimit: PITCH_LIMIT,
            cameraShoulder: (typeof cameraProfile.cameraShoulder === 'number') ? cameraProfile.cameraShoulder : CAMERA_SHOULDER,
            cameraDist: (typeof cameraProfile.cameraDist === 'number') ? cameraProfile.cameraDist : CAMERA_DIST,
            thirdHeight: (typeof cameraProfile.thirdHeight === 'number') ? cameraProfile.thirdHeight : THIRD_HEIGHT,
            sniperScopeShoulder: SNIPER_SCOPE_SHOULDER,
            adsShoulder: ADS_SHOULDER,
            sniperScopeDist: SNIPER_SCOPE_DIST,
            adsDist: (typeof cameraProfile.adsDist === 'number') ? cameraProfile.adsDist : ADS_DIST,
            sniperScopeHeight: SNIPER_SCOPE_HEIGHT,
            adsHeight: (typeof cameraProfile.adsHeight === 'number') ? cameraProfile.adsHeight : ADS_HEIGHT,
            sniperScopeBlendSpeed: SNIPER_SCOPE_BLEND_SPEED,
            adsBlendSpeed: ADS_BLEND_SPEED,
            firstPersonSmooth: FIRST_PERSON_SMOOTH,
            thirdSmooth: THIRD_SMOOTH,
            cameraFov: CAMERA_FOV,
            adsFov: ADS_FOV,
            adsFovForWeapon: adsFovForWeapon
        };
        var helper = cameraRuntimeApi();
        if (helper && helper.updateCamera) {
            helper.updateCamera(viewApi, dt, payload);
            return;
        }
        if (!viewApi || !viewApi.updateCamera) return;
        viewApi.updateCamera(dt, payload);
    }

    function triggerFireAction(view) {
        var viewApi = view || viewHelper();
        var payload = {
            currentWeaponId: currentWeaponId,
            adsActive: isScopeModeActive(),
            scopeTargetActive: isScopeModeActive(),
            sniperMode: isSniperScopeWeapon(),
            actorVisual: actorVisual,
            avatarRigApi: avatarRigApi
        };
        var helper = cameraRuntimeApi();
        if (helper && helper.triggerFireAction) {
            helper.triggerFireAction(viewApi, payload);
            return;
        }
        if (!viewApi || !viewApi.triggerFireAction) return;
        viewApi.triggerFireAction(payload);
    }

    function updateAvatarPose() {
        var helper = visualRuntimeApi();
        if (helper && helper.applyAvatarPose) {
            helper.applyAvatarPose(visualHelperState());
            return;
        }
    }

    function syncHitboxPositions() {
        var helper = visualRuntimeApi();
        if (helper && helper.syncHitboxPositions) helper.syncHitboxPositions(visualHelperState());
    }

    function setAliveVisual(active) {
        avatarAliveVisible = !!active;
        var helper = visualRuntimeApi();
        if (helper && helper.setAliveVisual) helper.setAliveVisual(visualHelperState(), active);
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
            hitboxOpacity: hitboxVisible ? 0.3 : 0,
            includeCollisionDebug: true,
            preferBoxman: true
        });
        avatarGroup = actorVisual.root || actorVisual.visual;
        avatarRigApi = actorVisual.rigApi;
        avatarRig = actorVisual.rig || null;
        sceneRef.add(avatarGroup);
        if (actorVisual.bodyHitbox) sceneRef.add(actorVisual.bodyHitbox);
        if (actorVisual.headHitbox) sceneRef.add(actorVisual.headHitbox);
        if (actorVisual.movementCollider) sceneRef.add(actorVisual.movementCollider);
        if (actorVisual.setAlive) actorVisual.setAlive(avatarAliveVisible);
        if (actorVisual.setHitboxVisibility) actorVisual.setHitboxVisibility(hitboxVisible);
        syncHitboxPositions();
    }

    function setHitboxVisibility(visible) {
        hitboxVisible = !!visible;
        var helper = visualRuntimeApi();
        if (helper && helper.setHitboxVisibility) helper.setHitboxVisibility(visualHelperState(), visible);
        return hitboxVisible;
    }

    function setSpawnShieldVisual(active) {
        var helper = visualRuntimeApi();
        if (helper && helper.setSpawnShieldVisual) helper.setSpawnShieldVisual(visualHelperState(), active);
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
        function gateRollingMovementInput(actionKey, event) {
            if (!actionKey) return false;
            if (rollInputSuppressedUntilRelease[actionKey]) return true;
            if (!isRolling() || (event && event.repeat)) return false;
            rollInputSuppressedUntilRelease[actionKey] = true;
            return true;
        }
        inputListeners = {
            keydown: function (e) {
            if (matchesBinding('move_forward', e, 'KeyW') && !gateRollingMovementInput('forward', e)) keys.forward = true;
            if (matchesBinding('move_left', e, 'KeyA') && !gateRollingMovementInput('left', e)) keys.left = true;
            if (matchesBinding('move_backward', e, 'KeyS') && !gateRollingMovementInput('backward', e)) keys.backward = true;
            if (matchesBinding('move_right', e, 'KeyD') && !gateRollingMovementInput('right', e)) keys.right = true;
            if (matchesBinding('sprint', e, ['ShiftLeft', 'ShiftRight']) && !gateRollingMovementInput('sprint', e)) keys.sprint = true;
            if (matchesBinding('jump', e, 'Space')) {
                if (!gateRollingMovementInput('jump', e)) {
                    keys.jump = true;
                }
                e.preventDefault();
            }
            },
            keyup: function (e) {
            if (matchesBinding('move_forward', e, 'KeyW')) {
                keys.forward = false;
                rollInputSuppressedUntilRelease.forward = false;
            }
            if (matchesBinding('move_left', e, 'KeyA')) {
                keys.left = false;
                rollInputSuppressedUntilRelease.left = false;
            }
            if (matchesBinding('move_backward', e, 'KeyS')) {
                keys.backward = false;
                rollInputSuppressedUntilRelease.backward = false;
            }
            if (matchesBinding('move_right', e, 'KeyD')) {
                keys.right = false;
                rollInputSuppressedUntilRelease.right = false;
            }
            if (matchesBinding('sprint', e, ['ShiftLeft', 'ShiftRight'])) {
                keys.sprint = false;
                rollInputSuppressedUntilRelease.sprint = false;
                sprintCanceledUntilRelease = false;
                clearSprintTemporaryResumeTimer();
                sprintTemporarilyCanceledUntil = 0;
            }
            if (matchesBinding('jump', e, 'Space')) {
                keys.jump = false;
                rollInputSuppressedUntilRelease.jump = false;
            }
            },
            mousemove: function (e) {
            if (!hasInputCapture()) return;
            applyLookDelta(e.movementX || 0, e.movementY || 0, 1);
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
            cancelScopedView();
            clearMovementKeys();
        },
            pointerlockchange: function () {
            if (!hasInputCapture()) cancelScopedView();
            }
        };
        if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
            document.addEventListener('keydown', inputListeners.keydown);
            document.addEventListener('keyup', inputListeners.keyup);
            document.addEventListener('mousemove', inputListeners.mousemove);
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
        var helper = motionStateRuntimeApi();
        if (helper && helper.resetVerticalState) {
            var state = motionStateView();
            helper.resetVerticalState(state, feetY, { eyeHeight: eyeHeight() });
            applyMotionStateView(state);
        }
        clearSprintTemporaryResumeTimer();
        sprintTemporarilyCanceledUntil = 0;
    }

    function setSpawnPosition(x, z, feetY) {
        if (!camera) return false;
        clearQueuedMotionCorrection();
        var helper = motionStateRuntimeApi();
        if (helper && helper.setSpawnPosition) {
            var state = motionStateView();
            helper.setSpawnPosition(state, x, z, feetY, { eyeHeight: eyeHeight() });
            applyMotionStateView(state);
        } else {
            feetY = (typeof feetY === 'number') ? feetY : 0;
            playerX = x;
            playerZ = z;
            resetVerticalState(feetY);
        }
        var view = viewHelper();
        resetRecoilState(view);
        updateAvatarPose();
        updateCameraFromPlayer(1, view, 0);
        return true;
    }

    function buildLocalMotionState() {
        var helper = motionStateRuntimeApi();
        return helper && helper.buildLocalMotionState
            ? helper.buildLocalMotionState(motionStateView(), motionStateScratch, { pitchLimit: PITCH_LIMIT })
            : motionStateScratch;
    }

    function buildCurrentInputState() {
        var helper = inputRuntimeApi();
        if (helper && helper.buildCurrentInputState) {
            return helper.buildCurrentInputState(inputHelperState());
        }
        return inputStateScratch;
    }

    function buildRollActionOptions() {
        var helper = inputRuntimeApi();
        if (helper && helper.buildRollActionOptions) {
            return helper.buildRollActionOptions(inputHelperState());
        }
        return null;
    }

    function rollActionDurationMs(rollOptions) {
        if (rollOptions && rollOptions.movingBackward && !rollOptions.movingForward) {
            return BACKWARD_ROLL_ACTION_DURATION_MS;
        }
        return FORWARD_ROLL_ACTION_DURATION_MS;
    }

    function setRollUntil(nextRollUntil) {
        var helper = motionStateRuntimeApi();
        if (helper && helper.setRollUntil) {
            var state = motionStateView();
            helper.setRollUntil(state, nextRollUntil, { nowMs: nowMs });
            applyMotionStateView(state);
        } else {
            rollUntil = Math.max(0, Number(nextRollUntil || 0));
            if (!isRolling()) activeRollInputState = null;
        }
        if (actorVisual && avatarGroup) {
            updateAvatarPose();
        }
        return rollUntil;
    }

    function clearQueuedMotionCorrection() {
        var helper = reconciliationRuntimeApi();
        if (helper && helper.clearMotionCorrection) {
            helper.clearMotionCorrection(queuedMotionCorrection);
            return;
        }
        queuedMotionCorrection.x = 0;
        queuedMotionCorrection.y = 0;
        queuedMotionCorrection.z = 0;
    }

    function hasQueuedMotionCorrection() {
        var helper = reconciliationRuntimeApi();
        if (helper && helper.hasMotionCorrection) {
            return helper.hasMotionCorrection(queuedMotionCorrection);
        }
        return Math.abs(Number(queuedMotionCorrection.x || 0)) > 0.0001 ||
            Math.abs(Number(queuedMotionCorrection.y || 0)) > 0.0001 ||
            Math.abs(Number(queuedMotionCorrection.z || 0)) > 0.0001;
    }

    function queueMotionCorrection(dx, dz, dy, maxDistance) {
        var helper = reconciliationRuntimeApi();
        if (helper && helper.queueMotionCorrection) {
            helper.queueMotionCorrection(queuedMotionCorrection, dx, dz, dy, maxDistance);
            return;
        }
        queuedMotionCorrection.x += Number(dx || 0);
        queuedMotionCorrection.z += Number(dz || 0);
        queuedMotionCorrection.y += Number(dy || 0);
    }

    function applyQueuedMotionCorrection(dtSec, options) {
        var helper = reconciliationRuntimeApi();
        var opts = options || {};
        var applied = helper && helper.applyMotionCorrection
            ? helper.applyMotionCorrection(queuedMotionCorrection, dtSec, {
                decayMs: opts.decayMs,
                applyDelta: function (dx, dy, dz) {
                    playerX += dx;
                    posY += dy;
                    playerZ += dz;
                }
            })
            : false;

        if (!applied) return false;

        if (opts.syncVisual !== false) {
            updateAvatarPose();
            updateCameraFromPlayer(Math.max(1 / 240, Number(dtSec || (1 / 60))), viewHelper());
        }
        return true;
    }

    function copyMotionStateFields(state, options) {
        var helper = motionStateRuntimeApi();
        if (!helper || !helper.copyMotionStateFields || !state) return false;
        var snapshot = motionStateView();
        helper.copyMotionStateFields(snapshot, state, { pitchLimit: PITCH_LIMIT });
        var groundHeightAt = options && typeof options.getGroundHeightAt === 'function'
            ? options.getGroundHeightAt
            : null;
        if (typeof state.y === 'number' && isFinite(state.y)) {
            snapshot.y = Number(state.y);
        } else {
            snapshot.y = groundHeightAt ? (Number(groundHeightAt(snapshot.x, snapshot.z) || 0) + eyeHeight()) : eyeHeight();
        }
        if (groundHeightAt) {
            var floorEyeY = Number(groundHeightAt(snapshot.x, snapshot.z) || 0) + eyeHeight();
            if (!isFinite(snapshot.y) || snapshot.y < floorEyeY) snapshot.y = floorEyeY;
        }
        applyMotionStateView(snapshot);
        return true;
    }

    function applyAuthoritativeMotion(state) {
        if (!camera || !state) return false;
        var x = Number(state.x);
        var z = Number(state.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
        var world = worldHelper();
        clearQueuedMotionCorrection();
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
        clearQueuedMotionCorrection();
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
        var opts = options || {};
        var ackSeq = Math.max(0, Number(opts.lastAckedSeq || 0));
        if (ackSeq > 0) lastReplayAckSeq = ackSeq;
        var motionState = computeReplayMotionState(state, pendingInputs, opts);
        if (!motionState) return applyAuthoritativeMotion(state);
        return applyMotionState(motionState, opts.dt);
    }

    function computeReplayMotionState(state, pendingInputs, options) {
        if (!camera || !state) return null;
        var helper = movementHelper();
        var reconcile = reconciliationHelper();
        var world = worldHelper();
        if (!helper || !helper.stepAuthoritativeMovement || !reconcile || !reconcile.replayMotionState) {
            return cloneMotionState(state);
        }

        var opts = options || {};
        var motionState = reconcile.replayMotionState(state, Array.isArray(pendingInputs) ? pendingInputs : [], {
            stepMovement: helper.stepAuthoritativeMovement,
            bounds: world.getWorldBounds(),
            collisionBoxes: world.getCollisionBoxes(),
            getGroundHeightAt: world.getGroundHeightAt,
            movementLocked: function () { return isMovementLocked(); },
            fallbackWeaponId: currentWeaponId,
            resolveStepMovementOptions: function (step) {
                var weaponId = String(step && step.weaponId || currentWeaponId || 'rifle');
                return {
                    moveSpeedMultiplier: weaponMoveSpeedMultiplier(weaponId),
                    adsMoveMultiplier: weaponAdsMoveMultiplier(weaponId)
                };
            },
            eyeHeight: eyeHeight(),
            playerHeight: effectivePlayerCollisionHeight(),
            playerRadius: playerRadius(),
            epsilon: EPSILON,
            fallbackYaw: yaw,
            fallbackPitch: pitch
        });
        return motionState || null;
    }

    function cloneMotionState(state) {
        var helper = motionStateRuntimeApi();
        return helper && helper.cloneMotionState ? helper.cloneMotionState(state, { pitchLimit: PITCH_LIMIT }) : null;
    }

    function buildAuthoritativeMotionKey(state) {
        var helper = replayRuntimeApi();
        return helper && helper.buildAuthoritativeMotionKey
            ? helper.buildAuthoritativeMotionKey(state)
            : '';
    }

    function hasMovementIntentInput() {
        if (movementInputBlocked()) return false;
        return !!(keys.forward || keys.backward || keys.left || keys.right || keys.jump || isSprintInputActive());
    }

    function topSpeedForInputState(inputState, weaponId, airborne) {
        var weapon = String(weaponId || currentWeaponId || 'rifle');
        var moveMultiplier = weaponMoveSpeedMultiplier(weapon);
        var baseJog = jogSpeed() * moveMultiplier;
        var baseRun = runSpeed() * moveMultiplier;
        var adsSpeed = baseJog * weaponAdsMoveMultiplier(weapon);
        if (inputState && inputState.adsActive) return adsSpeed;
        if (inputState && inputState.sprint && inputState.backward && !inputState.forward) {
            return baseJog * BACKWARD_SPRINT_SPEED_MULT;
        }
        if (inputState && inputState.sprint) return baseRun;
        if (airborne) return Math.max(baseJog, baseRun);
        return baseJog;
    }

    function fallbackReplaySteps(pendingInputs) {
        var helper = replayRuntimeApi();
        var plan = helper && helper.fallbackReplaySteps
            ? helper.fallbackReplaySteps(pendingInputs, { fallbackYaw: yaw, fallbackPitch: pitch })
            : null;
        return plan && Array.isArray(plan.steps) ? plan.steps : [];
    }

    function buildReplayStepPlan(reconcile, pendingInputs) {
        var helper = replayRuntimeApi();
        var plan = helper && helper.buildReplayStepPlan
            ? helper.buildReplayStepPlan(reconcile, pendingInputs, {
                fallbackYaw: yaw,
                fallbackPitch: pitch,
                movementLocked: function () { return isMovementLocked(); }
            })
            : null;
        return plan && Array.isArray(plan.steps) ? plan.steps : fallbackReplaySteps(pendingInputs);
    }

    function believableReplayDistanceWu(reconcile, pendingInputs, opts, airborne) {
        var helper = replayRuntimeApi();
        return helper && helper.believableReplayDistanceWu
            ? helper.believableReplayDistanceWu(reconcile, pendingInputs, Object.assign({}, opts, {
                currentWeaponId: currentWeaponId,
                currentInputState: buildCurrentInputState(),
                getTopSpeedForInputState: topSpeedForInputState
            }), airborne)
            : 0;
    }

    function resolveReconciliationThresholds(opts, reconcileTuning, adaptiveSelfReconciliation, airborne, movingIntent) {
        var helper = reconciliationRuntimeApi();
        if (helper && helper.resolveReconciliationThresholds) {
            return helper.resolveReconciliationThresholds(opts, reconcileTuning, adaptiveSelfReconciliation, airborne, movingIntent);
        }
        return {
            hardSnapDistance: Number(opts.hardSnapDistance || 4.25),
            hardSnapVerticalDistance: Number(opts.hardSnapVerticalDistance || 1.25),
            idleBlendDistance: Number(opts.idleBlendDistance || 0.45),
            idleBlendRate: Number(opts.idleBlendRate || 5),
            movingBlendDistance: Number(opts.movingBlendDistance || 0.5),
            movingBlendVerticalDistance: Number(opts.movingBlendVerticalDistance || 0.35),
            movingCorrectionDecayMs: Math.max(1, Number(opts.movingCorrectionDecayMs || 100)),
            replayDistance: Number(opts.replayCorrectionDistance || 0.95),
            pendingReplayGraceMs: Math.max(0, Number(opts.pendingReplayGraceMs || 125)),
            emergencyReplayDistance: Number(opts.emergencyReplayDistance || 2.1),
            movingAckDriftLimit: 2,
            movingPendingInputLimit: 2
        };
    }

    function shouldReplayAuthoritativeMotion(reconcile, opts, pendingInputCount, horizontalDistSq, replayDistance, replayTriggerChanged, allowReplayWithoutAckAdvance, movingIntent, canCorrectWhileMoving, latestPendingAgeMs, pendingReplayGraceMs, allowFreshPendingReplay) {
        var helper = replayRuntimeApi();
        return helper && helper.shouldReplayAuthoritativeMotion
            ? !!helper.shouldReplayAuthoritativeMotion(reconcile, Object.assign({}, opts, { lastReplayAckSeq: lastReplayAckSeq }), pendingInputCount, horizontalDistSq, replayDistance, replayTriggerChanged, allowReplayWithoutAckAdvance, movingIntent, canCorrectWhileMoving, latestPendingAgeMs, pendingReplayGraceMs, allowFreshPendingReplay)
            : false;
    }

    function applyIdleBlendCorrection(dt, x, z, authoritativeY, dx, dz, dy, horizontalDistSq, idleBlendRate) {
        var helper = replayRuntimeApi();
        if (helper && helper.applyIdleBlendCorrectionState) {
            var state = { x: playerX, y: posY, z: playerZ };
            helper.applyIdleBlendCorrectionState(state, {
                dt: dt,
                authoritativeX: x,
                authoritativeY: authoritativeY,
                authoritativeZ: z,
                dx: dx,
                dy: dy,
                dz: dz,
                horizontalDistSq: horizontalDistSq,
                idleBlendRate: idleBlendRate
            });
            playerX = state.x;
            posY = state.y;
            playerZ = state.z;
            updateAvatarPose();
            updateCameraFromPlayer(dt, viewHelper());
            return true;
        }
        return false;
    }

    function reconcileAuthoritativeMotion(state, options) {
        if (!camera || !state) return false;
        var x = Number(state.x);
        var z = Number(state.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

        var opts = options || {};
        var motionKey = String(opts.authoritativeMotionRevision || buildAuthoritativeMotionKey(state));
        var authoritativeStateChanged = motionKey !== lastReconciledMotionKey;
        var replayTriggerChanged = authoritativeStateChanged || !!opts.ackAdvanced;
        var netTuning = networkTuning();
        var networkFlags = netTuning.flags || {};
        var reconcileTuning = netTuning.selfReconciliation || {};
        var adaptiveSelfReconciliation = networkFlags.adaptiveSelfReconciliation !== false;
        var replayFirstSelfCorrection = networkFlags.replayFirstSelfCorrection !== false;
        var dt = Math.max(1 / 240, Number(opts.dt || (1 / 60)));
        var pendingInputs = Array.isArray(opts.pendingInputs) ? opts.pendingInputs : [];
        var comparisonState = state;
        if (replayFirstSelfCorrection && pendingInputs.length > 0) {
            var replayTargetState = computeReplayMotionState(state, pendingInputs, opts);
            if (replayTargetState) comparisonState = replayTargetState;
        }
        var comparisonX = Number(comparisonState.x);
        var comparisonZ = Number(comparisonState.z);
        var dx = comparisonX - playerX;
        var dz = comparisonZ - playerZ;
        var authoritativeY = (typeof comparisonState.y === 'number' && isFinite(comparisonState.y)) ? Number(comparisonState.y) : posY;
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
        var reconcile = reconciliationHelper();
        var believableDistance = believableReplayDistanceWu(reconcile, pendingInputs, opts, airborne);
        var hardSnapDistance = Math.max(
            thresholds.hardSnapDistance,
            believableDistance + (hasUnsentInputTail ? thresholds.emergencyReplayDistance : 0)
        );

        if (
            opts.force ||
            horizontalDistSq >= (hardSnapDistance * hardSnapDistance) ||
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
            replayTriggerChanged,
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

        if (
            movingIntent &&
            pendingInputCount === 0 &&
            !hasUnsentInputTail &&
            horizontalDistSq > 0.0004 &&
            horizontalDistSq < (thresholds.movingBlendDistance * thresholds.movingBlendDistance) &&
            Math.abs(dy) < thresholds.movingBlendVerticalDistance
        ) {
            queueMotionCorrection(dx, dz, dy, thresholds.movingBlendDistance);
            var movingBlendApplied = applyQueuedMotionCorrection(dt, {
                decayMs: thresholds.movingCorrectionDecayMs
            });
            if (movingBlendApplied) lastReconciledMotionKey = motionKey;
            return movingBlendApplied;
        }

        if (
            pendingInputCount > 0 ||
            hasUnsentInputTail ||
            movingIntent ||
            horizontalDistSq < (thresholds.idleBlendDistance * thresholds.idleBlendDistance)
        ) {
            return false;
        }

        var blended = applyIdleBlendCorrection(
            dt,
            comparisonX,
            comparisonZ,
            authoritativeY,
            dx,
            dz,
            dy,
            horizontalDistSq,
            thresholds.idleBlendRate
        );
        if (blended) lastReconciledMotionKey = motionKey;
        return blended;
    }

    function resetStatusState() {
        applyStatusState({
            stunUntil: 0,
            spawnShieldUntil: 0,
            weaponUntil: 0,
            throwableUntil: 0
        });
    }

    function destroyPlayerState() {
        teardownInput();
        clearMovementKeys();
        clearQueuedMotionCorrection();
        cancelScopedView();
        sprintCanceledUntilRelease = false;
        sprinting = false;
        rollUntil = 0;
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
        var frameDt = Math.max(0, Number(dt || 0));
        applyQueuedMotionCorrection(frameDt, {
            decayMs: Number((networkTuning().selfReconciliation || {}).movingCorrectionDecayMs || 100),
            syncVisual: false
        });
        if (!hasInputCapture()) {
            updateAvatarPose();
            updateCameraFromPlayer(Math.max(1 / 240, Number(dt || (1 / 60))), viewHelper(), lastMoveSpeedNorm);
            return;
        }

        var wasGrounded = !!isGrounded;
        var prevVelocityY = Number(velocityY || 0);
        var motionState = buildLocalMotionState();
        helper.stepAuthoritativeMovement(motionState, buildCurrentInputState(), {
            dtSec: frameDt,
            bounds: world.getWorldBounds(),
            collisionBoxes: world.getCollisionBoxes(),
            getGroundHeightAt: world.getGroundHeightAt,
            movementLocked: isMovementLocked(),
            moveSpeedMultiplier: weaponMoveSpeedMultiplier(currentWeaponId),
            adsMoveMultiplier: weaponAdsMoveMultiplier(currentWeaponId),
            eyeHeight: eyeHeight(),
            playerHeight: effectivePlayerCollisionHeight(),
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

        var horizontalSpeed = lastMoveSpeedNorm * effectiveRunSpeedForWeapon(currentWeaponId);
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
        if (!isSniperScopeWeapon()) cancelScopedView();
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
                scopeTargetActive: scopeTargetActive(),
                sniperMode: isSniperScopeWeapon()
            })
            : {
                weaponId: currentWeaponId,
                active: scopeTargetActive(),
                blend: 0,
                sniper: isSniperScopeWeapon(),
                scopeActive: false,
                ready: false,
                phase: 'inactive'
            };
    };

    GamePlayer.setAdsEnabled = function (enabled) {
        return setAdsEnabled(enabled);
    };

    GamePlayer.cancelSprintUntilRelease = function () {
        return cancelSprintUntilRelease();
    };

    GamePlayer.cancelSprintTemporarily = function (durationMs) {
        return cancelSprintTemporarily(durationMs);
    };

    GamePlayer.isSprintKeyHeld = function () {
        return !!keys.sprint;
    };

    GamePlayer.setMovementInputState = function (nextState) {
        return setMovementInputState(nextState);
    };

    GamePlayer.applyLookDelta = function (deltaX, deltaY, multiplier) {
        return applyLookDelta(deltaX, deltaY, multiplier);
    };

    GamePlayer.clearMovementInputState = function () {
        clearMovementKeys();
        sprintCanceledUntilRelease = false;
        clearSprintTemporaryResumeTimer();
        sprintTemporarilyCanceledUntil = 0;
        return buildCurrentInputState();
    };

    GamePlayer.isSprinting = function () {
        return !!sprinting;
    };

    GamePlayer.isFastBackpedal = function () {
        return !!fastBackpedal;
    };

    GamePlayer.getAnimNetState = function () {
        return {
            moveSpeedNorm: lastMoveSpeedNorm,
            sprinting: !!sprinting,
            fastBackpedal: !!fastBackpedal,
            aimPitch: pitch,
            equippedWeaponId: currentWeaponId
        };
    };

    GamePlayer.getNetworkInputState = function () {
        var inputState = buildCurrentInputState();
        return {
            forward: !!inputState.forward,
            backward: !!inputState.backward,
            left: !!inputState.left,
            right: !!inputState.right,
            jump: !!inputState.jump,
            sprint: !!inputState.sprint,
            adsActive: !!inputState.adsActive
        };
    };

    GamePlayer.setLoadout = function (loadoutConfig) {
        ensureLoadoutSlots();
        var hitscan = hitscanApi();
        var helper = loadoutRuntimeApi();
        if (!helper || !helper.normalizeRequestedLoadout) {
            return { slots: loadoutSlots.slice() };
        }

        var normalized = helper.normalizeRequestedLoadout(
            loadoutConfig,
            sharedApi(),
            currentWeaponId,
            hitscan && hitscan.getAllWeaponIds ? hitscan.getAllWeaponIds() : []
        );
        if (normalized && normalized.changed) {
            loadoutSlots = normalized.slots.slice();
            if (String(normalized.nextWeaponId || '') !== String(currentWeaponId || '')) {
                currentWeaponId = normalized.nextWeaponId;
                cancelScopedView();
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
            spawnShieldUntil: state && state.spawnShieldUntil ? Number(state.spawnShieldUntil || 0) : 0
        });
    };

    GamePlayer.setAliveVisual = function (active) {
        setAliveVisual(active);
    };

    function triggerAvatarAction(action, options) {
        var kind = String(action || '').toLowerCase();
        if (kind === 'fire') {
            triggerFireAction(viewHelper());
            return true;
        }
        if (actorVisual && actorVisual.triggerAction) {
            return actorVisual.triggerAction(kind, options || null) !== false;
        }
        if (!avatarRigApi || !avatarRigApi.triggerAction) return false;
        return avatarRigApi.triggerAction(kind, options || null) !== false;
    }

    GamePlayer.triggerAction = function (action, options) {
        return triggerAvatarAction(action, options);
    };

    GamePlayer.tryRoll = function () {
        if (!hasInputCapture()) return false;
        if (!isGrounded || isMovementLocked()) return false;
        if (isRolling()) return false;
        var rollOptions = buildRollActionOptions();
        if (!rollOptions) return false;
        if (!triggerAvatarAction('roll', rollOptions)) return false;
        activeRollInputState = {
            movingForward: !!rollOptions.movingForward,
            movingBackward: !!rollOptions.movingBackward,
            movingLeft: !!rollOptions.movingLeft,
            movingRight: !!rollOptions.movingRight
        };
        setRollUntil(nowMs() + rollActionDurationMs(rollOptions));
        return true;
    };

    GamePlayer.peekRollActionOptions = function () {
        var rollOptions = buildRollActionOptions();
        if (!rollOptions) return null;
        return {
            movingForward: !!rollOptions.movingForward,
            movingBackward: !!rollOptions.movingBackward,
            movingLeft: !!rollOptions.movingLeft,
            movingRight: !!rollOptions.movingRight
        };
    };

    GamePlayer.setSpawnShield = function (active) {
        applyStatusState({
            spawnShieldUntil: active ? nowMs() + 1000 : 0
        });
    };

    GamePlayer.setActionRestrictions = function (state) {
        applyStatusState({
            weaponUntil: state && state.weaponUntil ? Number(state.weaponUntil || 0) : 0,
            throwableUntil: state && state.throwableUntil ? Number(state.throwableUntil || 0) : 0
        });
    };

    GamePlayer.isStunned = function () {
        return isStunned();
    };

    GamePlayer.isRolling = function () {
        return isRolling();
    };

    GamePlayer.setRollState = function (state) {
        activeRollInputState = state && state.rollInputState && typeof state.rollInputState === 'object'
            ? {
                movingForward: !!state.rollInputState.movingForward,
                movingBackward: !!state.rollInputState.movingBackward,
                movingLeft: !!state.rollInputState.movingLeft,
                movingRight: !!state.rollInputState.movingRight
            }
            : activeRollInputState;
        return setRollUntil(state && state.rollUntil ? Number(state.rollUntil || 0) : 0);
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
