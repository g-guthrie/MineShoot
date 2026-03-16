/**
 * menu-state.js - Lightweight central menu state store.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameMenuState
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function isObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function clone(value) {
        if (Array.isArray(value)) return value.map(clone);
        if (isObject(value)) {
            var out = {};
            for (var key in value) {
                if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
                out[key] = clone(value[key]);
            }
            return out;
        }
        return value;
    }

    function merge(base, patch) {
        if (!isObject(base) || !isObject(patch)) return clone(patch);
        var out = clone(base);
        for (var key in patch) {
            if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
            if (isObject(out[key]) && isObject(patch[key])) {
                out[key] = merge(out[key], patch[key]);
            } else {
                out[key] = clone(patch[key]);
            }
        }
        return out;
    }

    function createStore(initialState) {
        var state = clone(initialState || {});
        var listeners = [];

        function notify() {
            var snapshot = clone(state);
            for (var i = 0; i < listeners.length; i++) {
                try {
                    listeners[i](snapshot);
                } catch (_err) {
                    // no-op
                }
            }
        }

        function setState(nextState) {
            state = clone(nextState || {});
            notify();
            return clone(state);
        }

        function patchState(patch) {
            state = merge(state, patch || {});
            notify();
            return clone(state);
        }

        function updateState(updater) {
            if (typeof updater !== 'function') return clone(state);
            state = clone(updater(clone(state)) || state);
            notify();
            return clone(state);
        }

        function subscribe(listener) {
            if (typeof listener !== 'function') return function () {};
            listeners.push(listener);
            return function unsubscribe() {
                listeners = listeners.filter(function (entry) {
                    return entry !== listener;
                });
            };
        }

        return {
            getState: function () {
                return clone(state);
            },
            setState: setState,
            patchState: patchState,
            updateState: updateState,
            subscribe: subscribe
        };
    }

    runtime.GameMenuState = {
        createStore: createStore
    };
})();
