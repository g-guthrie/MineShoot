/**
 * player-status.js - Player status and action-lock state.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerStatus
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};

        var state = {
            stunUntil: 0,
            hookPullStartedAt: 0,
            hookPullUntil: 0,
            chokeStartedAt: 0,
            chokeUntil: 0,
            chokeLift: 0,
            spawnShieldUntil: 0,
            weaponUntil: 0,
            throwableUntil: 0,
            abilityUntil: 0
        };

        function nowMs() {
            return opts.nowMs ? Number(opts.nowMs() || 0) : Date.now();
        }

        function abilityFxApi() {
            return opts.getAbilityFxApi ? opts.getAbilityFxApi() : null;
        }

        function isStunned(now) {
            return Number(state.stunUntil || 0) > Number(now || nowMs());
        }

        function isHookPulled(now) {
            return Number(state.hookPullUntil || 0) > Number(now || nowMs());
        }

        function isChoked(now) {
            return Number(state.chokeUntil || 0) > Number(now || nowMs());
        }

        function isSpawnShielded(now) {
            return Number(state.spawnShieldUntil || 0) > Number(now || nowMs());
        }

        function actionRestrictionUntil(actionType) {
            if (actionType === 'weapon') return Number(state.weaponUntil || 0);
            if (actionType === 'throwable') return Number(state.throwableUntil || 0);
            if (actionType === 'ability') return Number(state.abilityUntil || 0);
            return 0;
        }

        function isActionRestricted(actionType, now) {
            return actionRestrictionUntil(actionType) > Number(now || nowMs());
        }

        function isMovementLocked(now) {
            return isStunned(now) || isHookPulled(now) || isChoked(now);
        }

        function isActionLocked(now) {
            return isMovementLocked(now) ||
                isActionRestricted('weapon', now) ||
                isActionRestricted('throwable', now) ||
                isActionRestricted('ability', now);
        }

        function canUseWeapon(now) {
            return !isMovementLocked(now) && !isActionRestricted('weapon', now);
        }

        function canUseThrowable(now) {
            return !isMovementLocked(now) && !isActionRestricted('throwable', now);
        }

        function canUseAbility(now) {
            return !isMovementLocked(now) && !isActionRestricted('ability', now);
        }

        function clearExpiredStatusState(now) {
            var stamp = Number(now || nowMs());
            if (!isStunned(stamp)) state.stunUntil = 0;
            if (!isHookPulled(stamp)) state.hookPullUntil = 0;
            if (!isHookPulled(stamp)) state.hookPullStartedAt = 0;
            if (!isChoked(stamp)) {
                state.chokeStartedAt = 0;
                state.chokeUntil = 0;
                state.chokeLift = 0;
            }
            if (!isSpawnShielded(stamp)) state.spawnShieldUntil = 0;
            if (!isActionRestricted('weapon', stamp)) state.weaponUntil = 0;
            if (!isActionRestricted('throwable', stamp)) state.throwableUntil = 0;
            if (!isActionRestricted('ability', stamp)) state.abilityUntil = 0;
        }

        function applyStatusState(patch) {
            patch = patch || {};
            if (typeof patch.stunUntil === 'number') state.stunUntil = patch.stunUntil;
            if (typeof patch.hookPullStartedAt === 'number') state.hookPullStartedAt = patch.hookPullStartedAt;
            if (typeof patch.hookPullUntil === 'number') state.hookPullUntil = patch.hookPullUntil;
            if (typeof patch.chokeStartedAt === 'number') state.chokeStartedAt = patch.chokeStartedAt;
            if (typeof patch.chokeUntil === 'number') state.chokeUntil = patch.chokeUntil;
            if (typeof patch.chokeLift === 'number') state.chokeLift = patch.chokeLift;
            if (typeof patch.spawnShieldUntil === 'number') state.spawnShieldUntil = patch.spawnShieldUntil;
            if (typeof patch.weaponUntil === 'number') state.weaponUntil = patch.weaponUntil;
            if (typeof patch.throwableUntil === 'number') state.throwableUntil = patch.throwableUntil;
            if (typeof patch.abilityUntil === 'number') state.abilityUntil = patch.abilityUntil;
            clearExpiredStatusState(nowMs());
            if (opts.onStatusVisualChange) {
                opts.onStatusVisualChange({
                    spawnShielded: isSpawnShielded()
                });
            }
        }

        function chokeLiftAt(now) {
            var stamp = Number(now || nowMs());
            if (!isChoked(stamp)) return 0;
            var abilityFxView = abilityFxApi();
            if (abilityFxView && abilityFxView.chokeLiftAt) {
                return abilityFxView.chokeLiftAt({
                    startedAt: state.chokeStartedAt || 0,
                    endsAt: state.chokeUntil || 0,
                    chokeLift: state.chokeLift || 0
                }, stamp);
            }
            return 0;
        }

        function activeChokeLift() {
            return chokeLiftAt(nowMs());
        }

        return {
            getState: function () { return state; },
            isStunned: isStunned,
            isHookPulled: isHookPulled,
            isChoked: isChoked,
            isSpawnShielded: isSpawnShielded,
            isActionRestricted: isActionRestricted,
            isMovementLocked: isMovementLocked,
            isActionLocked: isActionLocked,
            canUseWeapon: canUseWeapon,
            canUseThrowable: canUseThrowable,
            canUseAbility: canUseAbility,
            clearExpiredStatusState: clearExpiredStatusState,
            applyStatusState: applyStatusState,
            chokeLiftAt: chokeLiftAt,
            activeChokeLift: activeChokeLift
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GamePlayerStatus = {
        create: create
    };
})();
