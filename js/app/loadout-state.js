/**
 * loadout-state.js - Shared committed loadout owner with UI-only weapon draft state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLoadoutState
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameLoadoutState = {};

    var STORAGE_KEY = 'mayhem.loadout.v2';
    var LEGACY_STORAGE_KEY = 'mayhem.menu.loadout.v1';

    var state = {
        initialized: false,
        committed: {
            weaponSlots: ['', ''],
            selectedAbilityId: '',
            selectedThrowableId: ''
        },
        draft: {
            weaponSlots: ['', ''],
            awaitingSecondPick: false
        }
    };
    var subscribers = [];

    function sharedApi() {
        return runtime.GameShared || {};
    }

    function tuningApi() {
        return sharedApi().gameplayTuning || {};
    }

    function localStore() {
        try {
            return window.localStorage || null;
        } catch (_err) {
            return null;
        }
    }

    function cloneCommittedLoadout() {
        return {
            weaponSlots: state.committed.weaponSlots.slice(0, 2),
            selectedAbilityId: String(state.committed.selectedAbilityId || ''),
            selectedThrowableId: String(state.committed.selectedThrowableId || '')
        };
    }

    function cloneWeaponDraft() {
        return {
            weaponSlots: state.draft.weaponSlots.slice(0, 2),
            awaitingSecondPick: !!state.draft.awaitingSecondPick
        };
    }

    function selectableWeaponIds() {
        var shared = sharedApi();
        var ids = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : null;
        return Array.isArray(ids) && ids.length ? ids : ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'];
    }

    function defaultWeaponLoadout() {
        var shared = sharedApi();
        var defaults = shared.getDefaultWeaponLoadout ? shared.getDefaultWeaponLoadout() : null;
        if (Array.isArray(defaults) && defaults.length) return defaults.slice(0, 2);
        return selectableWeaponIds().slice(0, 2);
    }

    function normalizeWeaponSlots(rawSlots, fallbackSlots) {
        var shared = sharedApi();
        if (shared.normalizeWeaponLoadout) {
            return shared.normalizeWeaponLoadout(rawSlots, fallbackSlots);
        }
        var selectableIds = selectableWeaponIds();
        var allowed = {};
        var seen = {};
        var next = [];
        var sources = [];

        for (var i = 0; i < selectableIds.length; i++) {
            var selectableId = String(selectableIds[i] || '');
            if (!selectableId) continue;
            allowed[selectableId] = true;
        }

        if (Array.isArray(rawSlots)) {
            for (i = 0; i < rawSlots.length; i++) sources.push(rawSlots[i]);
        }
        if (Array.isArray(fallbackSlots)) {
            for (i = 0; i < fallbackSlots.length; i++) sources.push(fallbackSlots[i]);
        }
        for (i = 0; i < selectableIds.length; i++) sources.push(selectableIds[i]);

        for (i = 0; i < sources.length && next.length < 2; i++) {
            var id = String(sources[i] || '');
            if (!id || !allowed[id] || seen[id]) continue;
            seen[id] = true;
            next.push(id);
        }
        while (next.length < 2) next.push('');
        return next.slice(0, 2);
    }

    function defaultAbilityId() {
        var shared = sharedApi();
        var tuning = tuningApi();
        var defaultId = shared.getDefaultAbilityId ? shared.getDefaultAbilityId() : '';
        return String(defaultId || tuning.defaultAbilityId || '');
    }

    function normalizeAbilityId(abilityId) {
        var shared = sharedApi();
        if (shared.normalizeAbilityId) {
            return String(shared.normalizeAbilityId(abilityId || '') || defaultAbilityId());
        }
        if (shared.normalizeAbilityLoadout) {
            var normalized = shared.normalizeAbilityLoadout(abilityId || '', '');
            return String(normalized && normalized.slot1 || defaultAbilityId());
        }
        return String(abilityId || defaultAbilityId());
    }

    function selectableThrowableIds() {
        var defs = tuningApi().throwables || {};
        return Array.isArray(defs.order) ? defs.order.slice() : Object.keys(defs).filter(function (key) { return key !== 'order'; });
    }

    function defaultThrowableId() {
        var shared = sharedApi();
        if (shared.getDefaultThrowableId) {
            return String(shared.getDefaultThrowableId() || '');
        }
        var ids = selectableThrowableIds();
        return ids[0] ? String(ids[0]) : '';
    }

    function normalizeThrowableId(throwableId) {
        var shared = sharedApi();
        if (shared.normalizeThrowableId) {
            return String(shared.normalizeThrowableId(throwableId || '') || defaultThrowableId());
        }
        var ids = selectableThrowableIds();
        var next = String(throwableId || '');
        return ids.indexOf(next) >= 0 ? next : defaultThrowableId();
    }

    function resetDraft() {
        state.draft.weaponSlots = ['', ''];
        state.draft.awaitingSecondPick = false;
    }

    function normalizeCommittedState() {
        state.committed.weaponSlots = normalizeWeaponSlots(
            state.committed.weaponSlots,
            defaultWeaponLoadout()
        );
        state.committed.selectedAbilityId = normalizeAbilityId(state.committed.selectedAbilityId || defaultAbilityId());
        state.committed.selectedThrowableId = normalizeThrowableId(state.committed.selectedThrowableId);
    }

    function notifySubscribers() {
        var snapshot = {
            committed: cloneCommittedLoadout(),
            draft: cloneWeaponDraft()
        };
        for (var i = 0; i < subscribers.length; i++) {
            try {
                subscribers[i](snapshot);
            } catch (_err) {
                // no-op
            }
        }
    }

    function saveCommittedState() {
        var store = localStore();
        if (!store || typeof store.setItem !== 'function') return false;
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(cloneCommittedLoadout()));
            return true;
        } catch (_err) {
            return false;
        }
    }

    function loadCommittedState() {
        var store = localStore();
        var keys = [STORAGE_KEY, LEGACY_STORAGE_KEY];
        if (!store || typeof store.getItem !== 'function') return false;

        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            try {
                var raw = String(store.getItem(key) || '').trim();
                if (!raw) continue;
                var parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') continue;

                var rawSlots = Array.isArray(parsed.selectedWeaponSlots)
                    ? parsed.selectedWeaponSlots
                    : (Array.isArray(parsed.weaponSlots) ? parsed.weaponSlots : null);
                if (rawSlots) {
                    state.committed.weaponSlots = rawSlots.slice(0, 2).map(function (weaponId) {
                        return String(weaponId || '');
                    });
                }
                if (parsed.selectedAbilityId) {
                    state.committed.selectedAbilityId = String(parsed.selectedAbilityId || '');
                } else if (parsed.abilityId) {
                    state.committed.selectedAbilityId = String(parsed.abilityId || '');
                } else if (parsed.abilityLoadout && typeof parsed.abilityLoadout === 'object') {
                    state.committed.selectedAbilityId = String(parsed.abilityLoadout.slot1 || '');
                }
                if (parsed.selectedThrowableId) {
                    state.committed.selectedThrowableId = String(parsed.selectedThrowableId || '');
                }
                normalizeCommittedState();
                return true;
            } catch (_err) {
                // continue trying legacy keys
            }
        }
        return false;
    }

    function ensureInitialized() {
        if (state.initialized) return;
        if (!loadCommittedState()) {
            normalizeCommittedState();
            saveCommittedState();
        }
        resetDraft();
        state.initialized = true;
    }

    function validateSelections() {
        ensureInitialized();
        var inputLabels = runtime.GameInputLabels || null;
        var missing = [];
        var committed = state.committed;
        if (!committed.weaponSlots[0]) missing.push('weapon slot 1');
        if (!committed.weaponSlots[1]) missing.push('weapon slot 2');
        if (!committed.selectedAbilityId) {
            missing.push('ability ' + (inputLabels && inputLabels.getBindingLabel ? inputLabels.getBindingLabel('ability_1', 'E') : 'E'));
        }
        return missing.length
            ? { ok: false, message: 'Missing ' + missing.join(' and ') }
            : { ok: true, message: '' };
    }

    GameLoadoutState.init = function () {
        ensureInitialized();
        return cloneCommittedLoadout();
    };

    GameLoadoutState.getCommittedLoadout = function () {
        ensureInitialized();
        return cloneCommittedLoadout();
    };

    GameLoadoutState.getWeaponDraft = function () {
        ensureInitialized();
        return cloneWeaponDraft();
    };

    GameLoadoutState.beginWeaponDraft = function (firstWeaponId) {
        ensureInitialized();
        var nextSlots = normalizeWeaponSlots([firstWeaponId], []);
        if (!nextSlots[0]) return cloneWeaponDraft();
        state.draft.weaponSlots = [nextSlots[0], ''];
        state.draft.awaitingSecondPick = true;
        notifySubscribers();
        return cloneWeaponDraft();
    };

    GameLoadoutState.commitWeaponDraft = function (secondWeaponId) {
        ensureInitialized();
        if (!state.draft.awaitingSecondPick) return cloneCommittedLoadout();
        var firstWeaponId = String(state.draft.weaponSlots[0] || '');
        var secondWeapon = String(secondWeaponId || '');
        if (!firstWeaponId || !secondWeapon || firstWeaponId === secondWeapon) {
            return cloneCommittedLoadout();
        }
        state.committed.weaponSlots = normalizeWeaponSlots([firstWeaponId, secondWeapon], defaultWeaponLoadout());
        normalizeCommittedState();
        resetDraft();
        saveCommittedState();
        notifySubscribers();
        return cloneCommittedLoadout();
    };

    GameLoadoutState.cancelWeaponDraft = function () {
        ensureInitialized();
        if (!state.draft.awaitingSecondPick) return false;
        resetDraft();
        notifySubscribers();
        return true;
    };

    GameLoadoutState.setSelectedAbility = function (abilityId) {
        ensureInitialized();
        var next = normalizeAbilityId(abilityId || '');
        if (state.committed.selectedAbilityId === next) return cloneCommittedLoadout();
        state.committed.selectedAbilityId = next;
        saveCommittedState();
        notifySubscribers();
        return cloneCommittedLoadout();
    };

    GameLoadoutState.setSelectedThrowable = function (throwableId) {
        ensureInitialized();
        var next = normalizeThrowableId(throwableId || '');
        if (state.committed.selectedThrowableId === next) return cloneCommittedLoadout();
        state.committed.selectedThrowableId = next;
        saveCommittedState();
        notifySubscribers();
        return cloneCommittedLoadout();
    };

    GameLoadoutState.validateSelections = validateSelections;

    GameLoadoutState.subscribe = function (listener) {
        if (typeof listener !== 'function') {
            return function () {};
        }
        subscribers.push(listener);
        return function unsubscribe() {
            subscribers = subscribers.filter(function (entry) {
                return entry !== listener;
            });
        };
    };

    runtime.GameLoadoutState = GameLoadoutState;
})();
