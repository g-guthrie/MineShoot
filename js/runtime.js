/**
 * runtime.js - canonical runtime state authority for boot/auth/menu/gameplay/manual flow
 * Loaded as global: window.GameRuntime
 */
(function () {
    'use strict';

    var GameRuntime = {};

    var state = {
        mode: 'boot', // boot | auth | menu | starting | running | paused | manual | failed
        previousMode: 'menu',
        pointerLocked: false,
        fallbackInput: false,
        bootReady: false,
        failedReason: '',
        authRequired: false
    };

    var listeners = [];

    function cloneState() {
        return {
            mode: state.mode,
            previousMode: state.previousMode,
            pointerLocked: !!state.pointerLocked,
            fallbackInput: !!state.fallbackInput,
            bootReady: !!state.bootReady,
            failedReason: state.failedReason || '',
            authRequired: !!state.authRequired,
            overlayVisible: isOverlayVisible(),
            authVisible: isAuthVisible(),
            manualOpen: state.mode === 'manual'
        };
    }

    function isOverlayVisible() {
        return state.mode === 'menu' ||
            state.mode === 'paused' ||
            state.mode === 'manual' ||
            state.mode === 'failed' ||
            state.mode === 'starting';
    }

    function isAuthVisible() {
        return state.mode === 'auth';
    }

    function textInputFocused() {
        var el = document.activeElement;
        if (!el) return false;
        if (el.isContentEditable) return true;
        var tag = (el.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function emit() {
        var snapshot = cloneState();
        for (var i = 0; i < listeners.length; i++) {
            try {
                listeners[i](snapshot);
            } catch (_err) {
                // no-op
            }
        }
    }

    function setMode(nextMode) {
        if (state.mode === nextMode) return;
        if (state.mode !== 'manual') {
            state.previousMode = state.mode;
        }
        state.mode = nextMode;
    }

    function ensureMode(nextMode) {
        if (state.mode !== nextMode) state.mode = nextMode;
    }

    GameRuntime.init = function (options) {
        options = options || {};
        if (typeof options.mode === 'string') {
            state.mode = options.mode;
        }
        if (typeof options.authRequired === 'boolean') {
            state.authRequired = options.authRequired;
        }
        emit();
        return cloneState();
    };

    GameRuntime.subscribe = function (listener) {
        if (typeof listener !== 'function') return function () {};
        listeners.push(listener);
        try { listener(cloneState()); } catch (_err) {}
        return function unsubscribe() {
            var next = [];
            for (var i = 0; i < listeners.length; i++) {
                if (listeners[i] !== listener) next.push(listeners[i]);
            }
            listeners = next;
        };
    };

    GameRuntime.getState = function () {
        return cloneState();
    };

    GameRuntime.canAcceptGameplayInput = function () {
        return state.mode === 'running' && (state.pointerLocked || state.fallbackInput) && !textInputFocused();
    };

    GameRuntime.dispatch = function (intent, payload) {
        payload = payload || {};

        switch (intent) {
            case 'BOOT_BEGIN': {
                state.bootReady = false;
                state.failedReason = '';
                setMode('boot');
                break;
            }
            case 'BOOT_READY': {
                state.bootReady = true;
                if (state.mode === 'boot') {
                    setMode(state.authRequired ? 'auth' : 'menu');
                }
                break;
            }
            case 'BOOT_FAILED': {
                state.bootReady = false;
                state.failedReason = String(payload.reason || 'unknown_startup_error');
                setMode('failed');
                break;
            }
            case 'AUTH_REQUIRED': {
                state.authRequired = true;
                if (state.mode !== 'failed') setMode('auth');
                break;
            }
            case 'AUTH_OK': {
                state.authRequired = false;
                if (state.mode !== 'failed') setMode('menu');
                break;
            }
            case 'AUTH_SKIP_LOCAL': {
                state.authRequired = false;
                if (state.mode !== 'failed') setMode('menu');
                break;
            }
            case 'START_REQUEST': {
                if (state.mode === 'menu' || state.mode === 'paused' || state.mode === 'manual' || state.mode === 'running') {
                    setMode('starting');
                }
                break;
            }
            case 'START_SUCCESS': {
                if (state.mode !== 'failed' && state.mode !== 'auth') setMode('running');
                break;
            }
            case 'POINTER_LOCK_GAINED': {
                state.pointerLocked = true;
                state.fallbackInput = false;
                if (state.mode !== 'failed' && state.mode !== 'auth') ensureMode('running');
                break;
            }
            case 'POINTER_LOCK_LOST': {
                state.pointerLocked = false;
                if (!state.fallbackInput && state.mode === 'running') setMode('paused');
                break;
            }
            case 'FALLBACK_INPUT_ENABLE': {
                state.fallbackInput = true;
                state.pointerLocked = false;
                if (state.mode !== 'failed' && state.mode !== 'auth') ensureMode('running');
                break;
            }
            case 'FALLBACK_INPUT_DISABLE': {
                state.fallbackInput = false;
                if (!state.pointerLocked && state.mode === 'running') setMode('paused');
                break;
            }
            case 'PAUSE': {
                if (state.mode === 'running') setMode('paused');
                break;
            }
            case 'RESUME': {
                if (state.mode === 'paused' || state.mode === 'manual') setMode('starting');
                break;
            }
            case 'MANUAL_OPEN': {
                if (state.mode === 'manual') break;
                if (state.mode === 'menu' || state.mode === 'paused' || state.mode === 'running' || state.mode === 'starting') {
                    state.previousMode = state.mode;
                    state.mode = 'manual';
                }
                break;
            }
            case 'MANUAL_CLOSE': {
                if (state.mode !== 'manual') break;
                var prev = state.previousMode || 'menu';
                state.mode = (prev === 'running' || prev === 'starting') ? 'paused' : prev;
                break;
            }
            case 'FORCE_MENU': {
                if (state.mode !== 'failed') setMode('menu');
                break;
            }
        }

        emit();
        return cloneState();
    };

    window.GameRuntime = GameRuntime;
})();
