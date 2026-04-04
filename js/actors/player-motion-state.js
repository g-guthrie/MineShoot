/**
 * player-motion-state.js - Shared motion-state helpers for GamePlayer.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerMotionState
 */
(function () {
    'use strict';

    function createMotionState() {
        return {
            x: 0,
            y: 0,
            z: 0,
            yaw: 0,
            pitch: 0,
            velocityY: 0,
            isGrounded: true,
            jumpHoldTimer: 0,
            jumpHeldLast: false,
            airborneSprintCarry: false,
            moveSpeedNorm: 0,
            sprinting: false,
            fastBackpedal: false,
            rollUntil: 0
        };
    }

    function resolveEyeHeight(options) {
        var value = options && options.eyeHeight;
        var parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1.6;
    }

    function resolveNowMs(options) {
        if (!options) return 0;
        if (typeof options.nowMs === 'function') {
            return Number(options.nowMs() || 0);
        }
        return Number(options.nowMs || 0);
    }

    function resolveGroundHeightAt(options) {
        return options && typeof options.getGroundHeightAt === 'function'
            ? options.getGroundHeightAt
            : null;
    }

    function normalizeNumber(value, fallback) {
        var parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : Number(fallback || 0);
    }

    function normalizeBoolean(value, fallback) {
        if (value === undefined || value === null) return !!fallback;
        return !!value;
    }

    function copyMotionStateFields(target, source, options) {
        if (!target || typeof target !== 'object') return false;
        source = source && typeof source === 'object' ? source : {};
        options = options || {};

        target.x = normalizeNumber(source.x, target.x);
        target.y = normalizeNumber(source.y, target.y);
        target.z = normalizeNumber(source.z, target.z);
        target.yaw = normalizeNumber(source.yaw, target.yaw);
        target.pitch = normalizeNumber(source.pitch, target.pitch);
        target.velocityY = normalizeNumber(source.velocityY, target.velocityY);
        target.isGrounded = normalizeBoolean(source.isGrounded, target.isGrounded !== false);
        target.jumpHoldTimer = normalizeNumber(source.jumpHoldTimer, target.jumpHoldTimer);
        target.jumpHeldLast = normalizeBoolean(
            source.jumpHeldLast,
            source.jumpPressedLastFrame !== undefined
                ? source.jumpPressedLastFrame
                : target.jumpHeldLast
        );
        target.airborneSprintCarry = normalizeBoolean(
            source.airborneSprintCarry,
            source.sprinting !== undefined ? source.sprinting && !source.isGrounded : target.airborneSprintCarry
        );
        target.moveSpeedNorm = normalizeNumber(source.moveSpeedNorm, target.moveSpeedNorm);
        target.sprinting = normalizeBoolean(source.sprinting, target.sprinting);
        target.fastBackpedal = normalizeBoolean(source.fastBackpedal, target.fastBackpedal);

        if (Object.prototype.hasOwnProperty.call(source, 'rollUntil')) {
            target.rollUntil = normalizeNumber(source.rollUntil, target.rollUntil);
        } else if (!Object.prototype.hasOwnProperty.call(target, 'rollUntil')) {
            target.rollUntil = 0;
        }

        if (options.clampPitch !== false) {
            var pitchLimit = Number(options.pitchLimit);
            if (!Number.isFinite(pitchLimit) || pitchLimit <= 0) {
                pitchLimit = 89 * (Math.PI / 180);
            }
            if (Number.isFinite(target.pitch)) {
                target.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, target.pitch));
            }
        }
        return true;
    }

    function buildLocalMotionState(source, target, options) {
        var out = target && typeof target === 'object' ? target : createMotionState();
        copyMotionStateFields(out, source, options);
        return out;
    }

    function cloneMotionState(state, options) {
        return buildLocalMotionState(state, createMotionState(), options);
    }

    function resetVerticalState(state, feetY, options) {
        if (!state || typeof state !== 'object') return false;
        options = options || {};
        var eyeHeight = resolveEyeHeight(options);
        var groundFeetY = Number(feetY || 0);
        state.velocityY = 0;
        state.y = groundFeetY + eyeHeight;
        state.isGrounded = true;
        state.jumpHoldTimer = 0;
        state.jumpHeldLast = false;
        state.airborneSprintCarry = false;
        state.moveSpeedNorm = 0;
        state.sprinting = false;
        state.fastBackpedal = false;
        return true;
    }

    function setRollUntil(state, nextRollUntil, options) {
        if (!state || typeof state !== 'object') return 0;
        options = options || {};
        var next = normalizeNumber(nextRollUntil, 0);
        var now = resolveNowMs(options);
        if (!(next > 0) || (now > 0 && next <= now)) {
            next = 0;
        }
        state.rollUntil = next;
        if (!(next > 0) && options.clearRollInputState !== false) {
            if (Object.prototype.hasOwnProperty.call(state, 'activeRollInputState')) {
                state.activeRollInputState = null;
            }
            if (Object.prototype.hasOwnProperty.call(state, 'rollInputState')) {
                state.rollInputState = null;
            }
        }
        return state.rollUntil;
    }

    function resolveSpawnFeetY(x, z, feetY, options) {
        var explicitFeetY = Number(feetY);
        if (Number.isFinite(explicitFeetY)) return explicitFeetY;
        var groundHeightAt = resolveGroundHeightAt(options);
        if (groundHeightAt) {
            return Number(groundHeightAt(Number(x || 0), Number(z || 0)) || 0);
        }
        return 0;
    }

    function setSpawnPosition(state, x, z, feetY, options) {
        if (!state || typeof state !== 'object') return false;
        options = options || {};
        state.x = Number(x || 0);
        state.z = Number(z || 0);
        resetVerticalState(state, resolveSpawnFeetY(state.x, state.z, feetY, options), options);
        if (options.clearRollUntil !== false) {
            setRollUntil(state, 0, options);
        }
        return true;
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GamePlayerMotionState = {
        createMotionState: createMotionState,
        copyMotionStateFields: copyMotionStateFields,
        buildLocalMotionState: buildLocalMotionState,
        cloneMotionState: cloneMotionState,
        resetVerticalState: resetVerticalState,
        setRollUntil: setRollUntil,
        resolveSpawnFeetY: resolveSpawnFeetY,
        setSpawnPosition: setSpawnPosition
    };
})();
