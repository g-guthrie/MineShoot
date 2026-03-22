/**
 * modal-manager.js - Shared dialog/modal controller.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameModalManager
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var domUtils = runtime.GameDomUtils || null;
    var GameModalManager = {};
    var registry = {};
    var activeId = '';
    var listenersBound = false;

    function doc() {
        return document;
    }

    function normalizeEntry(id, options) {
        var entry = Object.assign({}, options || {});
        entry.id = String(id || '');
        entry.element = entry.element || null;
        entry.initialFocus = entry.initialFocus || null;
        entry.restoreFocus = entry.restoreFocus || null;
        entry.onOpen = typeof entry.onOpen === 'function' ? entry.onOpen : null;
        entry.onClose = typeof entry.onClose === 'function' ? entry.onClose : null;
        entry.isOpen = false;
        entry.lastTrigger = null;
        return entry;
    }

    function resolveElement(target) {
        if (!target) return null;
        if (typeof target === 'string') return doc().getElementById(String(target || ''));
        return target;
    }

    function focusElement(target) {
        var el = resolveElement(target);
        if (!el || typeof el.focus !== 'function') return false;
        try {
            el.focus();
            return true;
        } catch (_err) {
            return false;
        }
    }

    function setHidden(el, hidden) {
        if (!el) return;
        el.hidden = !!hidden;
        el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    }

    function currentEntry() {
        return activeId ? registry[activeId] || null : null;
    }

    function resolveEntryElement(entry) {
        if (!entry) return null;
        entry.element = resolveElement(entry.element);
        return entry.element;
    }

    function trapFocus(event) {
        var entry = currentEntry();
        if (!entry || !entry.element) return;
        if (event.key !== 'Tab') return;
        var focusable = entry.element.querySelectorAll(
            'button:not([hidden]):not([disabled]), [href], input:not([hidden]):not([disabled]), select:not([hidden]):not([disabled]), textarea:not([hidden]):not([disabled]), [tabindex]:not([tabindex="-1"]):not([hidden])'
        );
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey) {
            if (doc().activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        } else {
            if (doc().activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    }

    function bindGlobalListeners() {
        if (listenersBound) return;
        listenersBound = true;

        window.addEventListener('keydown', function (event) {
            if (event.key === 'Tab' && activeId) {
                trapFocus(event);
                return;
            }
            if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(event.target)) return;
            if (event.key !== 'Escape') return;
            if (!activeId) return;
            GameModalManager.close(activeId);
        });
    }

    GameModalManager.register = function (id, options) {
        var entry = normalizeEntry(id, options);
        if (!entry.id || !resolveEntryElement(entry)) return null;
        registry[entry.id] = entry;
        setHidden(entry.element, !entry.isOpen);
        bindGlobalListeners();

        entry.element.addEventListener('click', function (event) {
            if (event.target === entry.element) {
                GameModalManager.close(entry.id);
            }
        });

        return entry;
    };

    GameModalManager.open = function (id, triggerEl) {
        var entry = registry[String(id || '')];
        if (!entry || !resolveEntryElement(entry)) return false;
        if (activeId && activeId !== entry.id) {
            GameModalManager.close(activeId);
        }

        entry.lastTrigger = triggerEl || doc().activeElement || null;
        activeId = entry.id;
        entry.isOpen = true;
        setHidden(entry.element, false);
        if (entry.onOpen) entry.onOpen(entry);

        if (!focusElement(entry.initialFocus)) {
            focusElement(entry.element);
        }
        return true;
    };

    GameModalManager.close = function (id) {
        var targetId = String(id || activeId || '');
        if (!targetId) return false;
        var entry = registry[targetId];
        if (!entry || !resolveEntryElement(entry)) return false;
        entry.isOpen = false;
        setHidden(entry.element, true);
        if (entry.onClose) entry.onClose(entry);
        if (activeId === targetId) activeId = '';

        var restoreTarget = entry.restoreFocus || entry.lastTrigger;
        focusElement(restoreTarget);
        entry.lastTrigger = null;
        return true;
    };

    GameModalManager.isOpen = function (id) {
        if (id) {
            var entry = registry[String(id || '')];
            return !!(entry && entry.isOpen);
        }
        return !!activeId;
    };

    GameModalManager.getActiveId = function () {
        return activeId || '';
    };

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameModalManager = GameModalManager;
})();
