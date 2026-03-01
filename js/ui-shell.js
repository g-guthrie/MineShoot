/**
 * ui-shell.js - Minimal UI shell abstraction for input/menu/manual state
 * Loaded as global: window.GameUIShell
 */
(function () {
    'use strict';

    var GameUIShell = {};

    var overlayEl = null;
    var authOverlayEl = null;
    var initialized = false;
    var unsubRuntime = null;
    var lastOverlayVisible = false;
    var lastMode = '';

    function runtime() {
        return window.GameRuntime || null;
    }

    function ensureInit() {
        if (initialized) return;
        initialized = true;
        overlayEl = document.getElementById('overlay');
        authOverlayEl = document.getElementById('auth-overlay');

        var rt = runtime();
        if (rt && rt.subscribe) {
            unsubRuntime = rt.subscribe(renderFromRuntime);
        } else {
            renderStandalone();
        }
    }

    function renderStandalone() {
        if (overlayEl) overlayEl.style.display = 'flex';
        if (authOverlayEl) authOverlayEl.style.display = 'none';
    }

    function hasCapture() {
        var rt = runtime();
        if (rt && rt.getState) {
            var s = rt.getState();
            return !!(s.pointerLocked || s.fallbackInput);
        }
        return !!document.pointerLockElement || !!window.__gameNoLockInput;
    }

    function isTextInputLike(el) {
        if (!el) return false;
        var tag = (el.tagName || '').toUpperCase();
        if (el.isContentEditable) return true;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    GameUIShell.init = function () {
        ensureInit();
    };

    GameUIShell.hasCapture = function () {
        return hasCapture();
    };

    GameUIShell.isTextInputFocused = function () {
        return isTextInputLike(document.activeElement);
    };

    GameUIShell.canAcceptGameplayInput = function () {
        var rt = runtime();
        if (rt && rt.canAcceptGameplayInput) return rt.canAcceptGameplayInput();
        return hasCapture() && !GameUIShell.isTextInputFocused();
    };

    function renderFromRuntime(snapshot) {
        if (!snapshot || !initialized) return;

        var overlayVisible = !!snapshot.overlayVisible;
        if (overlayEl) {
            overlayEl.style.display = overlayVisible ? 'flex' : 'none';
            if (overlayVisible && (!lastOverlayVisible || snapshot.mode !== lastMode)) {
                overlayEl.classList.remove('menu-entering');
                void overlayEl.offsetWidth;
                overlayEl.classList.add('menu-entering');
            }
        }

        if (authOverlayEl) {
            authOverlayEl.style.display = snapshot.authVisible ? 'flex' : 'none';
        }

        var docs = window.GameDocs;
        if (docs && docs.isOpen && docs.open && docs.close) {
            var docsOpen = docs.isOpen();
            if (snapshot.manualOpen && !docsOpen) docs.open();
            if (!snapshot.manualOpen && docsOpen) docs.close();
        }

        lastOverlayVisible = overlayVisible;
        lastMode = snapshot.mode || '';
    }

    function dispatch(intent, payload) {
        var rt = runtime();
        if (rt && rt.dispatch) return rt.dispatch(intent, payload);
        return null;
    }

    GameUIShell.showOverlay = function () {
        ensureInit();
        var s = runtime() && runtime().getState ? runtime().getState() : null;
        if (s && s.mode === 'running') dispatch('PAUSE');
        else dispatch('FORCE_MENU');
    };

    GameUIShell.hideOverlay = function () {
        ensureInit();
        dispatch('START_SUCCESS');
    };

    GameUIShell.showAuthOverlay = function () {
        ensureInit();
        dispatch('AUTH_REQUIRED');
    };

    GameUIShell.hideAuthOverlay = function () {
        ensureInit();
        dispatch('AUTH_OK');
    };

    GameUIShell.isManualOpen = function () {
        var rt = runtime();
        if (rt && rt.getState) {
            var s = rt.getState();
            return s.mode === 'manual';
        }
        return !!(window.GameDocs && window.GameDocs.isOpen && window.GameDocs.isOpen());
    };

    GameUIShell.openManual = function () {
        dispatch('MANUAL_OPEN');
    };

    GameUIShell.closeManual = function () {
        dispatch('MANUAL_CLOSE');
    };

    GameUIShell.toggleManual = function () {
        var open = GameUIShell.isManualOpen();
        dispatch(open ? 'MANUAL_CLOSE' : 'MANUAL_OPEN');
    };

    window.GameUIShell = GameUIShell;
})();
