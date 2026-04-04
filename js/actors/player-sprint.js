/**
 * player-sprint.js - Shared sprint state helpers for GamePlayer.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerSprint
 */
(function () {
    'use strict';

    function sprintState(state) {
        return state || {};
    }

    function nowMs(now) {
        return Number(now || 0) || 0;
    }

    function isSprintActive(state, now) {
        var sprint = sprintState(state);
        return !!sprint.keys &&
            !!sprint.keys.sprint &&
            !sprint.sprintCanceledUntilRelease &&
            Number(sprint.sprintTemporarilyCanceledUntil || 0) <= nowMs(now);
    }

    function clearSprintTimerState(state, clearTimeoutFn) {
        var sprint = sprintState(state);
        if (sprint.sprintTemporaryResumeTimer && typeof clearTimeoutFn === 'function') {
            clearTimeoutFn(sprint.sprintTemporaryResumeTimer);
        }
        sprint.sprintTemporaryResumeTimer = 0;
        return sprint;
    }

    function cancelSprintUntilRelease(state, clearTimeoutFn) {
        var sprint = sprintState(state);
        var hadSprint = !!sprint.keys && !!sprint.keys.sprint || !!sprint.sprinting || !!sprint.sprintCanceledUntilRelease;
        if (!hadSprint) return false;
        if (sprint.keys && sprint.keys.sprint) sprint.sprintCanceledUntilRelease = true;
        clearSprintTimerState(sprint, clearTimeoutFn);
        sprint.sprintTemporarilyCanceledUntil = 0;
        sprint.sprinting = false;
        return true;
    }

    function cancelSprintTemporarily(state, durationMs, now, setTimeoutFn, clearTimeoutFn) {
        var sprint = sprintState(state);
        var duration = Math.max(0, Number(durationMs || 0));
        var hadSprint = !!sprint.keys && !!sprint.keys.sprint ||
            !!sprint.sprinting ||
            Number(sprint.sprintTemporarilyCanceledUntil || 0) > nowMs(now);
        if (!hadSprint || duration <= 0) return false;
        sprint.sprintCanceledUntilRelease = false;
        sprint.sprintTemporarilyCanceledUntil = nowMs(now) + duration;
        sprint.sprinting = false;
        clearSprintTimerState(sprint, clearTimeoutFn);
        if (typeof setTimeoutFn === 'function') {
            sprint.sprintTemporaryResumeTimer = setTimeoutFn(function () {
                sprint.sprintTemporaryResumeTimer = 0;
                if (!sprint.keys || !sprint.keys.sprint || sprint.sprintCanceledUntilRelease) return;
                sprint.sprintTemporarilyCanceledUntil = 0;
            }, duration);
        }
        return true;
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GamePlayerSprint = {
        isSprintActive: isSprintActive,
        clearSprintTimerState: clearSprintTimerState,
        cancelSprintUntilRelease: cancelSprintUntilRelease,
        cancelSprintTemporarily: cancelSprintTemporarily
    };
})();
