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

    function ensureInit() {
        if (initialized) return;
        initialized = true;
        overlayEl = document.getElementById('overlay');
        authOverlayEl = document.getElementById('auth-overlay');
    }

    function hasCapture() {
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
        return hasCapture() && !GameUIShell.isTextInputFocused();
    };

    GameUIShell.showOverlay = function () {
        ensureInit();
        if (overlayEl) overlayEl.style.display = 'flex';
    };

    GameUIShell.hideOverlay = function () {
        ensureInit();
        if (overlayEl) overlayEl.style.display = 'none';
    };

    GameUIShell.showAuthOverlay = function () {
        ensureInit();
        if (authOverlayEl) authOverlayEl.style.display = 'flex';
    };

    GameUIShell.hideAuthOverlay = function () {
        ensureInit();
        if (authOverlayEl) authOverlayEl.style.display = 'none';
    };

    GameUIShell.isManualOpen = function () {
        return !!(window.GameDocs && window.GameDocs.isOpen && window.GameDocs.isOpen());
    };

    GameUIShell.openManual = function () {
        if (window.GameDocs && window.GameDocs.open) window.GameDocs.open();
    };

    GameUIShell.closeManual = function () {
        if (window.GameDocs && window.GameDocs.close) window.GameDocs.close();
    };

    GameUIShell.toggleManual = function () {
        if (window.GameDocs && window.GameDocs.toggle) window.GameDocs.toggle();
    };

    window.GameUIShell = GameUIShell;
})();
