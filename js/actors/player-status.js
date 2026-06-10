(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};

        var state = {
            stunUntil: 0,
            spawnShieldUntil: 0,
            weaponUntil: 0,
            throwableUntil: 0,
            slowUntil: 0,
            slowMultiplier: 1
        };

        function nowMs() {
            return opts.nowMs ? Number(opts.nowMs() || 0) : Date.now();
        }

        function isStunned(now) {
            return Number(state.stunUntil || 0) > Number(now || nowMs());
        }

        function isSpawnShielded(now) {
            return Number(state.spawnShieldUntil || 0) > Number(now || nowMs());
        }

        function isSlowed(now) {
            return Number(state.slowUntil || 0) > Number(now || nowMs());
        }

        // The server simulates slowed players by scaling their movement dt;
        // prediction must apply the same multiplier or every slow rubber-bands.
        function slowMovementMultiplier(now) {
            if (!isSlowed(now)) return 1;
            return Math.max(0.1, Math.min(1, Number(state.slowMultiplier || 1)));
        }

        function actionRestrictionUntil(actionType) {
            if (actionType === 'weapon') return Number(state.weaponUntil || 0);
            if (actionType === 'throwable') return Number(state.throwableUntil || 0);
            return 0;
        }

        function isActionRestricted(actionType, now) {
            return actionRestrictionUntil(actionType) > Number(now || nowMs());
        }

        function isMovementLocked(now) {
            return isStunned(now);
        }

        function isActionLocked(now) {
            return isMovementLocked(now) ||
                isActionRestricted('weapon', now) ||
                isActionRestricted('throwable', now);
        }

        function canUseWeapon(now) {
            return !isMovementLocked(now) && !isActionRestricted('weapon', now);
        }

        function canUseThrowable(now) {
            return !isMovementLocked(now) && !isActionRestricted('throwable', now);
        }

        function clearExpiredStatusState(now) {
            var stamp = Number(now || nowMs());
            if (!isStunned(stamp)) state.stunUntil = 0;
            if (!isSpawnShielded(stamp)) state.spawnShieldUntil = 0;
            if (!isActionRestricted('weapon', stamp)) state.weaponUntil = 0;
            if (!isActionRestricted('throwable', stamp)) state.throwableUntil = 0;
            if (!isSlowed(stamp)) {
                state.slowUntil = 0;
                state.slowMultiplier = 1;
            }
        }

        function applyStatusState(patch) {
            patch = patch || {};
            if (typeof patch.stunUntil === 'number') state.stunUntil = patch.stunUntil;
            if (typeof patch.spawnShieldUntil === 'number') state.spawnShieldUntil = patch.spawnShieldUntil;
            if (typeof patch.weaponUntil === 'number') state.weaponUntil = patch.weaponUntil;
            if (typeof patch.throwableUntil === 'number') state.throwableUntil = patch.throwableUntil;
            if (typeof patch.slowUntil === 'number') state.slowUntil = patch.slowUntil;
            if (typeof patch.slowMultiplier === 'number') state.slowMultiplier = patch.slowMultiplier;
            clearExpiredStatusState(nowMs());
            if (opts.onStatusVisualChange) {
                opts.onStatusVisualChange({
                    spawnShielded: isSpawnShielded()
                });
            }
        }

        return {
            getState: function () { return state; },
            isStunned: isStunned,
            isSpawnShielded: isSpawnShielded,
            isSlowed: isSlowed,
            slowMovementMultiplier: slowMovementMultiplier,
            isActionRestricted: isActionRestricted,
            isMovementLocked: isMovementLocked,
            isActionLocked: isActionLocked,
            canUseWeapon: canUseWeapon,
            canUseThrowable: canUseThrowable,
            clearExpiredStatusState: clearExpiredStatusState,
            applyStatusState: applyStatusState
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GamePlayerStatus = {
        create: create
    };
})();
