(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    if (runtime.GameInputBindings) return;

    var STORAGE_KEY = 'mayhem.inputBindings.v1';
    var ACTION_DEFS = [
        { id: 'move_forward', title: 'Move Forward', group: 'Movement', defaultToken: 'KeyW', note: 'Advance into the sightline.' },
        { id: 'move_left', title: 'Move Left', group: 'Movement', defaultToken: 'KeyA', note: 'Left strafe and shoulder change.' },
        { id: 'move_backward', title: 'Move Backward', group: 'Movement', defaultToken: 'KeyS', note: 'Backpedal and disengage.' },
        { id: 'move_right', title: 'Move Right', group: 'Movement', defaultToken: 'KeyD', note: 'Right strafe and shoulder change.' },
        { id: 'sprint', title: 'Sprint', group: 'Movement', defaultToken: 'Shift', note: 'Burst movement until ADS or movement lock interrupts it.' },
        { id: 'jump', title: 'Jump', group: 'Movement', defaultToken: 'Space', note: 'Variable jump height based on hold length.' },
        { id: 'roll', title: 'Roll', group: 'Movement', defaultToken: 'KeyE', note: 'Trigger a movement roll in your current travel direction.' },
        { id: 'ads_key', title: 'ADS Key', group: 'Combat', defaultToken: 'Alt', note: 'Scoped-aim input for supported weapons. In the current build this mainly matters for sniper.' },
        { id: 'reload', title: 'Reload', group: 'Combat', defaultToken: 'KeyR', note: 'Desktop only. Starts reload early before automatic reload begins.' },
        { id: 'weapon_slot_1', title: 'Weapon Slot 1', group: 'Combat', defaultToken: 'Digit1', note: 'Select your first loadout weapon.' },
        { id: 'weapon_slot_2', title: 'Weapon Slot 2', group: 'Combat', defaultToken: 'Digit2', note: 'Select your second loadout weapon.' },
        { id: 'throwable', title: 'Throwable', group: 'Combat', defaultToken: 'KeyQ', note: 'Throw or preview the selected throwable.' },
        { id: 'open_manual', title: 'Open Field Manual', group: 'Session', defaultToken: 'KeyI', note: 'Open or close the field manual.' },
        { id: 'toggle_auto_fire', title: 'Toggle Auto Fire', group: 'Session', defaultToken: 'KeyG', note: 'Toggle desktop red-reticle auto fire on or off.' },
        { id: 'toggle_debug', title: 'Toggle Debug Visuals', group: 'Session', defaultToken: 'KeyH', note: 'Toggle extra combat debug helpers.' }
    ];
    var FIXED_CONTROLS = [
        { group: 'Movement', label: 'Mouse', title: 'Look', note: 'Pointer lock camera control stays fixed.' },
        { group: 'Combat', label: 'LMB', title: 'Fire', note: 'Primary fire stays on left mouse.' },
        { group: 'Combat', label: 'RMB', title: 'ADS Mouse', note: 'Reserved scoped-aim mouse input. Most guns stay in the normal over-shoulder view right now.' },
        { group: 'Combat', label: 'Wheel', title: 'Toggle Weapon', note: 'Mouse wheel weapon toggle stays fixed.' },
        { group: 'Session', label: 'Esc', title: 'Release / Close', note: 'Escape releases pointer lock and closes overlays when not capturing a new bind.' }
    ];
    var RESERVED_TOKENS = {
        Escape: true,
        Tab: true,
        MetaLeft: true,
        MetaRight: true,
        Unidentified: true
    };
    var SPECIAL_TOKEN_LABELS = {
        Space: 'SPACE',
        Shift: 'SHIFT',
        Control: 'CTRL',
        Alt: 'ALT',
        Enter: 'ENTER',
        Backspace: 'BKSP',
        CapsLock: 'CAPS',
        Delete: 'DEL',
        End: 'END',
        Home: 'HOME',
        Insert: 'INS',
        PageDown: 'PGDN',
        PageUp: 'PGUP',
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        Minus: '-',
        Equal: '=',
        BracketLeft: '[',
        BracketRight: ']',
        Backslash: '\\',
        Semicolon: ';',
        Quote: '\'',
        Comma: ',',
        Period: '.',
        Slash: '/',
        Backquote: '`'
    };

    var actionDefById = {};
    var bindings = buildDefaultBindings();
    var subscribers = [];

    for (var i = 0; i < ACTION_DEFS.length; i++) {
        actionDefById[ACTION_DEFS[i].id] = ACTION_DEFS[i];
    }

    function localStore() {
        try {
            return window.localStorage || null;
        } catch (_err) {
            return null;
        }
    }

    function cloneBindings(source) {
        return Object.assign({}, source || {});
    }

    function buildDefaultBindings() {
        var out = {};
        for (var i = 0; i < ACTION_DEFS.length; i++) {
            out[ACTION_DEFS[i].id] = ACTION_DEFS[i].defaultToken;
        }
        return out;
    }

    function normalizeToken(rawToken) {
        var token = String(rawToken || '').trim();
        if (!token) return '';
        if (token === 'ShiftLeft' || token === 'ShiftRight') return 'Shift';
        if (token === 'ControlLeft' || token === 'ControlRight') return 'Control';
        if (token === 'AltLeft' || token === 'AltRight') return 'Alt';
        return token;
    }

    function isSupportedToken(token) {
        var normalized = normalizeToken(token);
        if (!normalized) return false;
        if (RESERVED_TOKENS[normalized]) return false;
        if (normalized === 'Shift' || normalized === 'Control' || normalized === 'Alt') return true;
        if (/^Key[A-Z]$/.test(normalized)) return true;
        if (/^Digit[0-9]$/.test(normalized)) return true;
        if (/^Numpad[0-9]$/.test(normalized)) return true;
        if (/^F([1-9]|1[0-2])$/.test(normalized)) return true;
        if (SPECIAL_TOKEN_LABELS[normalized]) return true;
        return normalized === 'Enter' ||
            normalized === 'Backspace' ||
            normalized === 'CapsLock' ||
            normalized === 'Delete' ||
            normalized === 'End' ||
            normalized === 'Home' ||
            normalized === 'Insert' ||
            normalized === 'PageDown' ||
            normalized === 'PageUp' ||
            normalized === 'ArrowUp' ||
            normalized === 'ArrowDown' ||
            normalized === 'ArrowLeft' ||
            normalized === 'ArrowRight';
    }

    function actionOrderIndex(actionId) {
        for (var i = 0; i < ACTION_DEFS.length; i++) {
            if (ACTION_DEFS[i].id === actionId) return i;
        }
        return -1;
    }

    function displayLabelForToken(token) {
        var normalized = normalizeToken(token);
        if (!normalized) return '--';
        if (SPECIAL_TOKEN_LABELS[normalized]) return SPECIAL_TOKEN_LABELS[normalized];
        if (/^Key[A-Z]$/.test(normalized)) return normalized.slice(3);
        if (/^Digit[0-9]$/.test(normalized)) return normalized.slice(5);
        if (/^Numpad[0-9]$/.test(normalized)) return 'NP ' + normalized.slice(6);
        if (/^F([1-9]|1[0-2])$/.test(normalized)) return normalized.toUpperCase();
        return normalized.toUpperCase();
    }

    function notifySubscribers() {
        var snapshot = cloneBindings(bindings);
        for (var i = 0; i < subscribers.length; i++) {
            try {
                subscribers[i](snapshot);
            } catch (_err) {
                // no-op
            }
        }
    }

    function saveBindings() {
        var store = localStore();
        if (!store || typeof store.setItem !== 'function') return false;
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(bindings));
            return true;
        } catch (_err) {
            return false;
        }
    }

    function migrateLegacyBindings(parsed) {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        if (Object.prototype.hasOwnProperty.call(parsed, 'roll')) return parsed;

        var next = buildDefaultBindings();
        var seenTokens = {};
        for (var i = 0; i < ACTION_DEFS.length; i++) {
            var actionId = ACTION_DEFS[i].id;
            var token = normalizeToken(next[actionId]);
            if (actionId !== 'roll' && Object.prototype.hasOwnProperty.call(parsed, actionId)) {
                var legacyToken = normalizeToken(parsed[actionId]);
                if (!isSupportedToken(legacyToken)) return null;
                token = legacyToken;
            }
            if (!isSupportedToken(token) || seenTokens[token]) return null;
            next[actionId] = token;
            seenTokens[token] = true;
        }

        for (var key in parsed) {
            if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
            if (!actionDefById[key]) continue;
        }

        return next;
    }

    function loadStoredBindings() {
        var store = localStore();
        if (!store || typeof store.getItem !== 'function') return buildDefaultBindings();
        try {
            var raw = store.getItem(STORAGE_KEY);
            if (!raw) return buildDefaultBindings();
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return buildDefaultBindings();
            parsed = migrateLegacyBindings(parsed) || parsed;
            var next = {};
            var seenTokens = {};
            for (var i = 0; i < ACTION_DEFS.length; i++) {
                var actionId = ACTION_DEFS[i].id;
                var token = Object.prototype.hasOwnProperty.call(parsed, actionId)
                    ? normalizeToken(parsed[actionId])
                    : normalizeToken(ACTION_DEFS[i].defaultToken);
                if (!isSupportedToken(token) || seenTokens[token]) return buildDefaultBindings();
                next[actionId] = token;
                seenTokens[token] = true;
            }
            for (var key in parsed) {
                if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
                if (!actionDefById[key]) continue;
            }
            return next;
        } catch (_err) {
            return buildDefaultBindings();
        }
    }

    function tokenFromEvent(event) {
        if (!event) return '';
        return normalizeToken(event.code || event.key || '');
    }

    function findActionForToken(token, exceptActionId) {
        var normalized = normalizeToken(token);
        if (!normalized) return '';
        for (var i = 0; i < ACTION_DEFS.length; i++) {
            var actionId = ACTION_DEFS[i].id;
            if (actionId === exceptActionId) continue;
            if (bindings[actionId] === normalized) return actionId;
        }
        return '';
    }

    function assign(actionId, rawToken) {
        var normalizedActionId = String(actionId || '');
        if (!actionDefById[normalizedActionId]) {
            return { ok: false, reason: 'unknown-action' };
        }
        var token = normalizeToken(rawToken);
        if (!isSupportedToken(token)) {
            return { ok: false, reason: RESERVED_TOKENS[token] ? 'reserved' : 'unsupported' };
        }

        var currentToken = bindings[normalizedActionId];
        if (currentToken === token) {
            return { ok: true, changed: false, swappedActionId: '' };
        }

        var swappedActionId = findActionForToken(token, normalizedActionId);
        bindings[normalizedActionId] = token;
        if (swappedActionId) {
            bindings[swappedActionId] = currentToken;
        }
        saveBindings();
        notifySubscribers();
        return { ok: true, changed: true, swappedActionId: swappedActionId };
    }

    function resetAll() {
        bindings = buildDefaultBindings();
        saveBindings();
        notifySubscribers();
        return cloneBindings(bindings);
    }

    function getDisplayLabel(actionId) {
        var token = bindings[String(actionId || '')];
        return displayLabelForToken(token);
    }

    function matches(actionId, event) {
        var token = bindings[String(actionId || '')];
        if (!token) return false;
        return tokenFromEvent(event) === token;
    }

    function matchesWithFallback(actionId, event, fallbackCodes) {
        if (matches(actionId, event)) return true;
        var code = String(event && event.code || '');
        var fallbacks = Array.isArray(fallbackCodes) ? fallbackCodes : [fallbackCodes];
        for (var i = 0; i < fallbacks.length; i++) {
            if (String(fallbacks[i] || '') === code) return true;
        }
        return false;
    }

    function subscribe(listener) {
        if (typeof listener !== 'function') {
            return function () {};
        }
        subscribers.push(listener);
        return function unsubscribe() {
            subscribers = subscribers.filter(function (entry) {
                return entry !== listener;
            });
        };
    }

    bindings = loadStoredBindings();

    runtime.GameInputBindings = {
        getBindings: function () {
            return cloneBindings(bindings);
        },
        getActionDefs: function () {
            return ACTION_DEFS.map(function (def) {
                return {
                    id: def.id,
                    title: def.title,
                    group: def.group,
                    defaultToken: def.defaultToken,
                    note: def.note,
                    hidden: !!def.hidden,
                    order: actionOrderIndex(def.id)
                };
            });
        },
        getFixedControls: function () {
            return FIXED_CONTROLS.map(function (entry) {
                return {
                    group: entry.group,
                    label: entry.label,
                    title: entry.title,
                    note: entry.note
                };
            });
        },
        getDisplayLabel: getDisplayLabel,
        getBinding: function (actionId) {
            return normalizeToken(bindings[String(actionId || '')] || '');
        },
        formatTokenLabel: function (token) {
            return displayLabelForToken(token);
        },
        tokenFromEvent: tokenFromEvent,
        matches: matches,
        matchesWithFallback: matchesWithFallback,
        assign: assign,
        resetAll: resetAll,
        subscribe: subscribe,
        storageKey: STORAGE_KEY
    };
})();
