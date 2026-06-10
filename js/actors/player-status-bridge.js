/**
 * player-status-bridge.js - Runtime-global bridge helpers for GamePlayer status state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerStatusBridge
 */
(function () {
    'use strict';

    var STATUS_KEYS = {
        stunUntil: true,
        spawnShieldUntil: true,
        weaponUntil: true,
        throwableUntil: true,
        slowUntil: true,
        slowMultiplier: true
    };

    function nowMs(opts) {
        return opts && typeof opts.nowMs === 'function' ? Number(opts.nowMs() || 0) : Date.now();
    }

    function resolveState(source) {
        if (!source || typeof source !== 'object') return null;
        if (typeof source.getState === 'function') return source.getState() || null;
        if (source.state && typeof source.state === 'object') return source.state;
        return source;
    }

    function readUntil(state, key) {
        return Number(state && state[key] || 0);
    }

    function isActiveUntil(untilValue, now) {
        return Number(untilValue || 0) > Number(now || 0);
    }

    function isStunned(source, now, opts) {
        var state = resolveState(source);
        return isActiveUntil(readUntil(state, 'stunUntil'), now || nowMs(opts));
    }

    function isSpawnShielded(source, now, opts) {
        var state = resolveState(source);
        return isActiveUntil(readUntil(state, 'spawnShieldUntil'), now || nowMs(opts));
    }

    function isSlowed(source, now, opts) {
        var state = resolveState(source);
        return isActiveUntil(readUntil(state, 'slowUntil'), now || nowMs(opts));
    }

    // Mirrors the server's slowed-movement time scaling for client prediction.
    function slowMovementMultiplier(source, now, opts) {
        if (!isSlowed(source, now, opts)) return 1;
        var state = resolveState(source);
        return Math.max(0.1, Math.min(1, Number(state && state.slowMultiplier || 1)));
    }

    function isActionRestricted(source, actionType, now, opts) {
        var state = resolveState(source);
        var stamp = Number(now || nowMs(opts));
        if (actionType === 'weapon') {
            return isActiveUntil(readUntil(state, 'weaponUntil'), stamp);
        }
        if (actionType === 'throwable') {
            return isActiveUntil(readUntil(state, 'throwableUntil'), stamp);
        }
        return false;
    }

    function isMovementLocked(source, now, opts) {
        return isStunned(source, now, opts);
    }

    function isActionLocked(source, now, opts) {
        return isMovementLocked(source, now, opts) ||
            isActionRestricted(source, 'weapon', now, opts) ||
            isActionRestricted(source, 'throwable', now, opts);
    }

    function clearExpiredStatusState(source, now, opts) {
        var state = resolveState(source);
        if (!state) return null;

        var stamp = Number(now || nowMs(opts));
        if (!isStunned(state, stamp, opts)) state.stunUntil = 0;
        if (!isSpawnShielded(state, stamp, opts)) state.spawnShieldUntil = 0;
        if (!isActionRestricted(state, 'weapon', stamp, opts)) state.weaponUntil = 0;
        if (!isActionRestricted(state, 'throwable', stamp, opts)) state.throwableUntil = 0;
        if (!isSlowed(state, stamp, opts)) {
            state.slowUntil = 0;
            state.slowMultiplier = 1;
        }
        return state;
    }

    function applyStatusState(source, patch, opts) {
        var state = resolveState(source);
        if (!state) return null;

        patch = patch || {};
        if (typeof patch.stunUntil === 'number') state.stunUntil = patch.stunUntil;
        if (typeof patch.spawnShieldUntil === 'number') state.spawnShieldUntil = patch.spawnShieldUntil;
        if (typeof patch.weaponUntil === 'number') state.weaponUntil = patch.weaponUntil;
        if (typeof patch.throwableUntil === 'number') state.throwableUntil = patch.throwableUntil;
        if (typeof patch.slowUntil === 'number') state.slowUntil = patch.slowUntil;
        if (typeof patch.slowMultiplier === 'number') state.slowMultiplier = patch.slowMultiplier;

        clearExpiredStatusState(state, nowMs(opts), opts);

        if (opts && typeof opts.onStatusVisualChange === 'function') {
            opts.onStatusVisualChange({
                spawnShielded: isSpawnShielded(state, undefined, opts)
            });
        }

        return state;
    }

    function movementBlocked(source, now, opts) {
        var stamp = Number(now || nowMs(opts));
        return isMovementLocked(source, stamp, opts);
    }

    function actionRestricted(source, actionType, now, opts) {
        return isActionRestricted(source, actionType, now, opts);
    }

    function deriveMovementBlocked(source, now, opts) {
        return !!movementBlocked(source, now, opts);
    }

    function deriveActionRestricted(source, now, opts) {
        return {
            weapon: !!isActionRestricted(source, 'weapon', now, opts),
            throwable: !!isActionRestricted(source, 'throwable', now, opts),
            locked: !!isActionLocked(source, now, opts)
        };
    }

    function deriveStatusFlags(source, now, opts) {
        var stamp = Number(now || nowMs(opts));
        return {
            stunned: !!isStunned(source, stamp, opts),
            spawnShielded: !!isSpawnShielded(source, stamp, opts),
            movementLocked: !!isMovementLocked(source, stamp, opts),
            actionLocked: !!isActionLocked(source, stamp, opts),
            movementBlocked: !!movementBlocked(source, stamp, opts),
            weaponRestricted: !!isActionRestricted(source, 'weapon', stamp, opts),
            throwableRestricted: !!isActionRestricted(source, 'throwable', stamp, opts),
            actionRestricted: deriveActionRestricted(source, stamp, opts)
        };
    }

    function create(opts) {
        opts = opts || {};
        var statusApi = opts.statusApi || null;
        var stateSource = opts.state || opts.source || statusApi || null;

        return {
            getState: function () {
                return resolveState(stateSource);
            },
            isStunned: function (now) {
                return isStunned(stateSource, now, opts);
            },
            isSpawnShielded: function (now) {
                return isSpawnShielded(stateSource, now, opts);
            },
            isSlowed: function (now) {
                return isSlowed(stateSource, now, opts);
            },
            slowMovementMultiplier: function (now) {
                return slowMovementMultiplier(stateSource, now, opts);
            },
            isActionRestricted: function (actionType, now) {
                return isActionRestricted(stateSource, actionType, now, opts);
            },
            isMovementLocked: function (now) {
                return isMovementLocked(stateSource, now, opts);
            },
            isActionLocked: function (now) {
                return isActionLocked(stateSource, now, opts);
            },
            movementBlocked: function (now) {
                return movementBlocked(stateSource, now, opts);
            },
            actionRestricted: function (actionType, now) {
                return actionRestricted(stateSource, actionType, now, opts);
            },
            clearExpiredStatusState: function (now) {
                return clearExpiredStatusState(stateSource, now, opts);
            },
            applyStatusState: function (patch) {
                return applyStatusState(stateSource, patch, opts);
            },
            deriveMovementBlocked: function (now) {
                return deriveMovementBlocked(stateSource, now, opts);
            },
            deriveActionRestricted: function (now) {
                return deriveActionRestricted(stateSource, now, opts);
            },
            deriveStatusFlags: function (now) {
                return deriveStatusFlags(stateSource, now, opts);
            }
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GamePlayerStatusBridge = {
        create: create,
        isStunned: isStunned,
        isSpawnShielded: isSpawnShielded,
        isSlowed: isSlowed,
        slowMovementMultiplier: slowMovementMultiplier,
        isActionRestricted: isActionRestricted,
        isMovementLocked: isMovementLocked,
        isActionLocked: isActionLocked,
        movementBlocked: movementBlocked,
        actionRestricted: actionRestricted,
        deriveMovementBlocked: deriveMovementBlocked,
        deriveActionRestricted: deriveActionRestricted,
        deriveStatusFlags: deriveStatusFlags,
        clearExpiredStatusState: clearExpiredStatusState,
        applyStatusState: applyStatusState,
        STATUS_KEYS: STATUS_KEYS
    };
})();
