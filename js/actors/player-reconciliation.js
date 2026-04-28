/**
 * player-reconciliation.js - Shared reconciliation helpers for GamePlayer.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerReconciliation
 */
(function () {
    'use strict';

    function createMotionCorrectionState() {
        return {
            x: 0,
            y: 0,
            z: 0
        };
    }

    function clearMotionCorrection(state) {
        if (!state || typeof state !== 'object') return;
        state.x = 0;
        state.y = 0;
        state.z = 0;
    }

    function hasMotionCorrection(state) {
        if (!state || typeof state !== 'object') return false;
        return Math.abs(Number(state.x || 0)) > 0.0001 ||
            Math.abs(Number(state.y || 0)) > 0.0001 ||
            Math.abs(Number(state.z || 0)) > 0.0001;
    }

    function queueMotionCorrection(state, dx, dz, dy, maxDistance) {
        if (!state || typeof state !== 'object') return;
        state.x += Number(dx || 0);
        state.z += Number(dz || 0);
        state.y += Number(dy || 0);
        var cap = Math.max(0.05, Number(maxDistance || 0.75));
        var horizontalLen = Math.sqrt(
            (state.x * state.x) +
            (state.z * state.z)
        );
        if (horizontalLen > cap) {
            var horizontalScale = cap / horizontalLen;
            state.x *= horizontalScale;
            state.z *= horizontalScale;
        }
        if (Math.abs(state.y) > cap) {
            state.y = state.y > 0 ? cap : -cap;
        }
    }

    function correctionDecayAlpha(dtSec, decayMs) {
        var dtMs = Math.max(0, Number(dtSec || 0) * 1000);
        var durationMs = Math.max(1, Number(decayMs || 100));
        return Math.min(1, dtMs / durationMs);
    }

    function applyMotionCorrection(state, dtSec, options) {
        if (!hasMotionCorrection(state)) return false;
        var opts = options || {};
        var alpha = correctionDecayAlpha(dtSec, opts.decayMs);
        if (!(alpha > 0)) return false;

        var appliedX = state.x * alpha;
        var appliedY = state.y * alpha;
        var appliedZ = state.z * alpha;

        if (typeof opts.applyDelta === 'function') {
            opts.applyDelta(appliedX, appliedY, appliedZ);
        }

        state.x -= appliedX;
        state.y -= appliedY;
        state.z -= appliedZ;

        if (Math.abs(state.x) < 0.0001) state.x = 0;
        if (Math.abs(state.y) < 0.0001) state.y = 0;
        if (Math.abs(state.z) < 0.0001) state.z = 0;
        return true;
    }

    function resolveReconciliationThresholds(opts, reconcileTuning, adaptiveSelfReconciliation, airborne, movingIntent) {
        opts = opts || {};
        reconcileTuning = reconcileTuning || {};
        var hardSnapDistance = Number(opts.hardSnapDistance || (adaptiveSelfReconciliation ? reconcileTuning.hardSnapDistanceWu : 4.25) || 4.25);
        var hardSnapVerticalDistance = Number(opts.hardSnapVerticalDistance || (adaptiveSelfReconciliation ? reconcileTuning.hardSnapVerticalWu : 1.25) || 1.25);
        var idleBlendDistance = Number(opts.idleBlendDistance || 0.45);
        var idleBlendRate = Number(opts.idleBlendRate || 5);
        var movingBlendDistance = Number(opts.movingBlendDistance || (adaptiveSelfReconciliation ? reconcileTuning.movingBlendDistanceWu : 0.5) || 0.5);
        var movingBlendVerticalDistance = Number(opts.movingBlendVerticalDistance || (adaptiveSelfReconciliation ? reconcileTuning.movingBlendVerticalWu : 0.35) || 0.35);
        var movingCorrectionDecayMs = Math.max(1, Number(opts.movingCorrectionDecayMs || (adaptiveSelfReconciliation ? reconcileTuning.movingCorrectionDecayMs : 100) || 100));
        var replayCorrectionDistance = Number(opts.replayCorrectionDistance || (adaptiveSelfReconciliation ? reconcileTuning.idleReplayDistanceWu : 0.95) || 0.95);
        var movingReplayCorrectionDistance = Number(opts.movingReplayCorrectionDistance || (adaptiveSelfReconciliation ? reconcileTuning.movingReplayDistanceWu : 1.35) || 1.35);
        var replayBlendDistance = Number(opts.replayBlendDistance || (adaptiveSelfReconciliation ? reconcileTuning.replayBlendDistanceWu : hardSnapDistance) || hardSnapDistance);
        var replayBlendVerticalDistance = Number(opts.replayBlendVerticalDistance || (adaptiveSelfReconciliation ? reconcileTuning.replayBlendVerticalWu : hardSnapVerticalDistance) || hardSnapVerticalDistance);
        var replayCorrectionDecayMs = Math.max(1, Number(opts.replayCorrectionDecayMs || (adaptiveSelfReconciliation ? reconcileTuning.replayCorrectionDecayMs : 220) || 220));
        var baseReplayGraceMs = Math.max(0, Number(opts.pendingReplayGraceMs || (adaptiveSelfReconciliation ? reconcileTuning.baseGraceMs : 125) || 125));
        var maxExtraGraceMs = Math.max(0, Number(adaptiveSelfReconciliation ? reconcileTuning.maxExtraGraceMs : 0) || 0);
        var rttJitterMs = Math.max(0, Number(opts.rttJitterMs || 0));
        var pendingReplayGraceMs = baseReplayGraceMs + Math.min(maxExtraGraceMs, rttJitterMs);
        var emergencyReplayDistance = Number(opts.emergencyReplayDistance || (adaptiveSelfReconciliation ? reconcileTuning.emergencyReplayDistanceWu : 2.1) || 2.1);
        replayBlendDistance = Math.max(replayBlendDistance, hardSnapDistance);
        var replayDistance = movingIntent
            ? Math.max(replayCorrectionDistance, movingReplayCorrectionDistance)
            : replayCorrectionDistance;
        var movingAckDriftLimit = Math.max(0, Number(adaptiveSelfReconciliation ? reconcileTuning.movingAckDriftLimit : 2) || 2);
        var movingPendingInputLimit = 2;

        if (airborne) {
            hardSnapDistance = Math.max(
                hardSnapDistance,
                Number(adaptiveSelfReconciliation ? reconcileTuning.airborneHardSnapDistanceWu : hardSnapDistance) || hardSnapDistance
            );
            hardSnapVerticalDistance = Math.max(
                hardSnapVerticalDistance,
                Number(adaptiveSelfReconciliation ? reconcileTuning.airborneHardSnapVerticalWu : hardSnapVerticalDistance) || hardSnapVerticalDistance
            );
            replayDistance = Math.max(
                replayDistance,
                Number(adaptiveSelfReconciliation ? reconcileTuning.airborneReplayDistanceWu : replayDistance) || replayDistance
            );
            pendingReplayGraceMs = Math.max(
                pendingReplayGraceMs,
                Math.max(0, Number(adaptiveSelfReconciliation ? reconcileTuning.airborneGraceMs : pendingReplayGraceMs) || pendingReplayGraceMs)
            );
            replayBlendDistance = Math.max(replayBlendDistance, hardSnapDistance);
            replayBlendVerticalDistance = Math.max(replayBlendVerticalDistance, hardSnapVerticalDistance * 0.85);
            movingAckDriftLimit = Math.max(
                movingAckDriftLimit,
                Math.max(0, Number(adaptiveSelfReconciliation ? reconcileTuning.airborneMovingAckDriftLimit : movingAckDriftLimit) || movingAckDriftLimit)
            );
            movingPendingInputLimit = Math.max(2, movingAckDriftLimit);
        }

        return {
            hardSnapDistance: hardSnapDistance,
            hardSnapVerticalDistance: hardSnapVerticalDistance,
            idleBlendDistance: idleBlendDistance,
            idleBlendRate: idleBlendRate,
            movingBlendDistance: movingBlendDistance,
            movingBlendVerticalDistance: movingBlendVerticalDistance,
            movingCorrectionDecayMs: movingCorrectionDecayMs,
            replayDistance: replayDistance,
            replayBlendDistance: replayBlendDistance,
            replayBlendVerticalDistance: replayBlendVerticalDistance,
            replayCorrectionDecayMs: replayCorrectionDecayMs,
            pendingReplayGraceMs: pendingReplayGraceMs,
            emergencyReplayDistance: emergencyReplayDistance,
            movingAckDriftLimit: movingAckDriftLimit,
            movingPendingInputLimit: movingPendingInputLimit
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GamePlayerReconciliation = {
        createMotionCorrectionState: createMotionCorrectionState,
        clearMotionCorrection: clearMotionCorrection,
        hasMotionCorrection: hasMotionCorrection,
        queueMotionCorrection: queueMotionCorrection,
        applyMotionCorrection: applyMotionCorrection,
        resolveReconciliationThresholds: resolveReconciliationThresholds
    };
})();
