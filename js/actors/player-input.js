/**
 * player-input.js - Shared input helpers for GamePlayer.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerInput
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    var DEFAULT_KEYS = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false
    };

    var DEFAULT_INPUT_STATE = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        adsActive: false
    };

    var DEFAULT_LOOK_LIMIT_RAD = 89 * (Math.PI / 180);
    var DEFAULT_MOUSE_SENSITIVITY = 0.002;
    var DEFAULT_ADS_SENSITIVITY_MULT = 0.7;
    var DEFAULT_SNIPER_SCOPE_SENSITIVITY_MULT = 0.42;

    function cloneBooleanMap(source, fallback) {
        var result = {};
        var base = fallback || DEFAULT_KEYS;
        var key;
        for (key in base) {
            if (!Object.prototype.hasOwnProperty.call(base, key)) continue;
            result[key] = !!(source && Object.prototype.hasOwnProperty.call(source, key) ? source[key] : base[key]);
        }
        return result;
    }

    function ensureState(state) {
        if (state && typeof state === 'object') return state;
        return {};
    }

    function createState(initialState) {
        var state = ensureState(initialState);
        if (!state.keys) state.keys = cloneBooleanMap(null, DEFAULT_KEYS);
        if (!state.rollInputSuppressedUntilRelease) {
            state.rollInputSuppressedUntilRelease = cloneBooleanMap(null, DEFAULT_KEYS);
        }
        if (!state.currentInputState) {
            state.currentInputState = {
                forward: false,
                backward: false,
                left: false,
                right: false,
                jump: false,
                sprint: false,
                adsActive: false
            };
        }
        if (!state.lookState) {
            state.lookState = { yaw: 0, pitch: 0 };
        }
        return state;
    }

    function createInputState() {
        return {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
            adsActive: false
        };
    }

    function hasInputCapture(state) {
        var current = ensureState(state);
        if (current.inputCaptureOverride === true || current.inputCaptureOverride === false) {
            return current.inputCaptureOverride;
        }

        var doc = current.document || (typeof document !== 'undefined' ? document : null);
        if (doc && doc.pointerLockElement) return true;

        if (typeof current.hasVirtualCapture === 'function') {
            return !!current.hasVirtualCapture();
        }
        if (current.controlsApi && typeof current.controlsApi.hasVirtualCapture === 'function') {
            return !!current.controlsApi.hasVirtualCapture();
        }
        return false;
    }

    function clearMovementKeys(state) {
        var current = createState(state);
        current.keys.forward = false;
        current.keys.backward = false;
        current.keys.left = false;
        current.keys.right = false;
        current.keys.jump = false;
        current.keys.sprint = false;
        current.rollInputSuppressedUntilRelease.forward = false;
        current.rollInputSuppressedUntilRelease.backward = false;
        current.rollInputSuppressedUntilRelease.left = false;
        current.rollInputSuppressedUntilRelease.right = false;
        current.rollInputSuppressedUntilRelease.jump = false;
        current.rollInputSuppressedUntilRelease.sprint = false;
        current.activeRollInputState = null;
        return current.keys;
    }

    function patchMovementInputState(state, nextState) {
        var current = createState(state);
        var patch = nextState && typeof nextState === 'object' ? nextState : null;
        if (!patch) return buildCurrentInputState(current);

        if (Object.prototype.hasOwnProperty.call(patch, 'forward')) current.keys.forward = !!patch.forward;
        if (Object.prototype.hasOwnProperty.call(patch, 'backward')) current.keys.backward = !!patch.backward;
        if (Object.prototype.hasOwnProperty.call(patch, 'left')) current.keys.left = !!patch.left;
        if (Object.prototype.hasOwnProperty.call(patch, 'right')) current.keys.right = !!patch.right;
        if (Object.prototype.hasOwnProperty.call(patch, 'jump')) current.keys.jump = !!patch.jump;
        if (Object.prototype.hasOwnProperty.call(patch, 'sprint')) {
            current.keys.sprint = !!patch.sprint;
            if (!current.keys.sprint) {
                current.sprintCanceledUntilRelease = false;
                current.sprintTemporarilyCanceledUntil = 0;
                current.sprintTemporaryResumeTimer = 0;
            }
        }
        return buildCurrentInputState(current);
    }

    function applyLookDelta(state, deltaX, deltaY, multiplier) {
        var current = createState(state);
        var look = current.lookState;
        if (!hasInputCapture(current)) {
            return {
                yaw: Number(look.yaw || 0),
                pitch: Number(look.pitch || 0)
            };
        }

        var scopeBlend = 0;
        if (typeof current.getScopeBlend === 'function') {
            scopeBlend = Number(current.getScopeBlend() || 0);
        }

        var sensitivityMult = current.isSniperScopeWeapon && current.isSniperScopeWeapon(current.currentWeaponId)
            ? Number(current.sniperScopeSensitivityMult || DEFAULT_SNIPER_SCOPE_SENSITIVITY_MULT)
            : Number(current.adsSensitivityMult || DEFAULT_ADS_SENSITIVITY_MULT);
        var sensitivity = Number(current.mouseSensitivity || DEFAULT_MOUSE_SENSITIVITY) *
            (1 - (scopeBlend * (1 - sensitivityMult))) *
            Math.max(0, Number(multiplier || 1));

        look.yaw -= Number(deltaX || 0) * sensitivity;
        look.pitch -= Number(deltaY || 0) * sensitivity;

        var pitchLimit = Number(current.pitchLimit || DEFAULT_LOOK_LIMIT_RAD);
        look.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, look.pitch));
        return {
            yaw: look.yaw,
            pitch: look.pitch
        };
    }

    function movementInputBlocked(state) {
        var current = ensureState(state);
        return !!(current.isMovementLocked && current.isMovementLocked() ||
            current.isMovementAnimationLocked && current.isMovementAnimationLocked());
    }

    function isRolling(state) {
        var current = ensureState(state);
        if (typeof current.isRolling === 'function') return !!current.isRolling();
        return Number(current.rollUntil || 0) > Number(current.nowMs ? current.nowMs() : Date.now());
    }

    function buildCurrentInputState(state) {
        var current = createState(state);
        var blocked = typeof current.isMovementInputBlocked === 'function'
            ? !!current.isMovementInputBlocked(current)
            : movementInputBlocked(current);
        var rolling = typeof current.isRolling === 'function' ? !!current.isRolling(current) : isRolling(current);
        var frozenRollInput = rolling && current.activeRollInputState ? current.activeRollInputState : null;

        current.currentInputState.forward = !blocked && (frozenRollInput ? !!frozenRollInput.movingForward : !!current.keys.forward);
        current.currentInputState.backward = !blocked && (frozenRollInput ? !!frozenRollInput.movingBackward : !!current.keys.backward);
        current.currentInputState.left = !blocked && (frozenRollInput ? !!frozenRollInput.movingLeft : !!current.keys.left);
        current.currentInputState.right = !blocked && (frozenRollInput ? !!frozenRollInput.movingRight : !!current.keys.right);
        current.currentInputState.jump = !blocked && !rolling && !!current.keys.jump;

        var sprintActive = typeof current.isSprintInputActive === 'function'
            ? !!current.isSprintInputActive(current)
            : !!current.keys.sprint &&
                !current.sprintCanceledUntilRelease &&
                Number(current.sprintTemporarilyCanceledUntil || 0) <= Number(current.nowMs ? current.nowMs() : Date.now());
        current.currentInputState.sprint = !blocked && !rolling && sprintActive;
        current.currentInputState.adsActive = typeof current.isScopeModeActive === 'function'
            ? !!current.isScopeModeActive(current)
            : !!current.scopeModeActive;
        return current.currentInputState;
    }

    function buildRollActionOptions(state) {
        var current = createState(state);
        if (typeof current.isMovementInputBlocked === 'function'
            ? !!current.isMovementInputBlocked(current)
            : movementInputBlocked(current)) {
            return null;
        }

        var movingForward = !!current.keys.forward;
        var movingBackward = !!current.keys.backward;
        var movingLeft = !!current.keys.left;
        var movingRight = !!current.keys.right;
        if (!movingForward && !movingBackward && !movingLeft && !movingRight) return null;

        return {
            movingForward: movingForward,
            movingBackward: movingBackward,
            movingLeft: movingLeft,
            movingRight: movingRight
        };
    }

    function buildInputBindings(state) {
        var current = createState(state);
        return {
            clearMovementKeys: function () {
                return clearMovementKeys(current);
            },
            patchMovementInputState: function (nextState) {
                return patchMovementInputState(current, nextState);
            },
            hasInputCapture: function () {
                return hasInputCapture(current);
            },
            applyLookDelta: function (deltaX, deltaY, multiplier) {
                return applyLookDelta(current, deltaX, deltaY, multiplier);
            },
            buildCurrentInputState: function () {
                return buildCurrentInputState(current);
            },
            buildRollActionOptions: function () {
                return buildRollActionOptions(current);
            }
        };
    }

    function callOption(options, name) {
        var fn = options && options[name];
        if (typeof fn !== 'function') return null;
        return fn;
    }

    function createDomInputListeners(options) {
        var opts = options || {};
        var matches = callOption(opts, 'matchesBinding') || function () { return false; };
        var gateRolling = callOption(opts, 'gateRollingMovementInput') || function () { return false; };
        var setMovementKey = callOption(opts, 'setMovementKey') || function () {};
        var clearRollSuppression = callOption(opts, 'clearRollSuppression') || function () {};
        var releaseSprint = callOption(opts, 'releaseSprint') || function () {};
        var applyLook = callOption(opts, 'applyLookDelta') || function () {};
        var hasCapture = callOption(opts, 'hasInputCapture') || function () { return false; };
        var cancelScope = callOption(opts, 'cancelScopedView') || function () {};
        var clearKeys = callOption(opts, 'clearMovementKeys') || function () {};
        var updateCameraAspect = callOption(opts, 'updateCameraAspect') || function () {};

        return {
            keydown: function (e) {
                if (matches('move_forward', e, 'KeyW') && !gateRolling('forward', e)) setMovementKey('forward', true);
                if (matches('move_left', e, 'KeyA') && !gateRolling('left', e)) setMovementKey('left', true);
                if (matches('move_backward', e, 'KeyS') && !gateRolling('backward', e)) setMovementKey('backward', true);
                if (matches('move_right', e, 'KeyD') && !gateRolling('right', e)) setMovementKey('right', true);
                if (matches('sprint', e, ['ShiftLeft', 'ShiftRight']) && !gateRolling('sprint', e)) setMovementKey('sprint', true);
                if (matches('jump', e, 'Space')) {
                    if (!gateRolling('jump', e)) setMovementKey('jump', true);
                    if (e && e.preventDefault) e.preventDefault();
                }
            },
            keyup: function (e) {
                if (matches('move_forward', e, 'KeyW')) {
                    setMovementKey('forward', false);
                    clearRollSuppression('forward');
                }
                if (matches('move_left', e, 'KeyA')) {
                    setMovementKey('left', false);
                    clearRollSuppression('left');
                }
                if (matches('move_backward', e, 'KeyS')) {
                    setMovementKey('backward', false);
                    clearRollSuppression('backward');
                }
                if (matches('move_right', e, 'KeyD')) {
                    setMovementKey('right', false);
                    clearRollSuppression('right');
                }
                if (matches('sprint', e, ['ShiftLeft', 'ShiftRight'])) {
                    setMovementKey('sprint', false);
                    clearRollSuppression('sprint');
                    releaseSprint();
                }
                if (matches('jump', e, 'Space')) {
                    setMovementKey('jump', false);
                    clearRollSuppression('jump');
                }
            },
            mousemove: function (e) {
                if (!hasCapture()) return;
                applyLook(e && e.movementX || 0, e && e.movementY || 0, 1);
            },
            contextmenu: function (e) {
                if (!hasCapture()) return;
                if (e && e.preventDefault) e.preventDefault();
            },
            resize: function () {
                updateCameraAspect();
            },
            blur: function () {
                cancelScope();
                clearKeys();
            },
            pointerlockchange: function () {
                if (!hasCapture()) cancelScope();
            }
        };
    }

    function bindDomInputListeners(listeners, doc, win) {
        if (!listeners) return;
        if (doc && typeof doc.addEventListener === 'function') {
            doc.addEventListener('keydown', listeners.keydown);
            doc.addEventListener('keyup', listeners.keyup);
            doc.addEventListener('mousemove', listeners.mousemove);
            doc.addEventListener('contextmenu', listeners.contextmenu);
            doc.addEventListener('pointerlockchange', listeners.pointerlockchange);
        }
        if (win && typeof win.addEventListener === 'function') {
            win.addEventListener('resize', listeners.resize);
            win.addEventListener('blur', listeners.blur);
        }
    }

    function unbindDomInputListeners(listeners, doc, win) {
        if (!listeners) return;
        if (doc && typeof doc.removeEventListener === 'function') {
            doc.removeEventListener('keydown', listeners.keydown);
            doc.removeEventListener('keyup', listeners.keyup);
            doc.removeEventListener('mousemove', listeners.mousemove);
            doc.removeEventListener('contextmenu', listeners.contextmenu);
            doc.removeEventListener('pointerlockchange', listeners.pointerlockchange);
        }
        if (win && typeof win.removeEventListener === 'function') {
            win.removeEventListener('resize', listeners.resize);
            win.removeEventListener('blur', listeners.blur);
        }
    }

    runtime.GamePlayerInput = {
        createState: createState,
        createInputState: createInputState,
        clearMovementKeys: clearMovementKeys,
        patchMovementInputState: patchMovementInputState,
        hasInputCapture: hasInputCapture,
        applyLookDelta: applyLookDelta,
        buildCurrentInputState: buildCurrentInputState,
        buildRollActionOptions: buildRollActionOptions,
        createDomInputListeners: createDomInputListeners,
        bindDomInputListeners: bindDomInputListeners,
        unbindDomInputListeners: unbindDomInputListeners,
        create: buildInputBindings
    };
})();
