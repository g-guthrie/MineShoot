/**
 * player-replay.js - Shared replay and reconciliation helpers for GamePlayer.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerReplay
 */
(function () {
    'use strict';

    var MIN_REPLAY_SAMPLE_DT_SEC = 1 / 240;
    var MAX_REPLAY_SAMPLE_DT_SEC = 0.075;

    function runtimeRoot() {
        return globalThis.__MAYHEM_RUNTIME || {};
    }

    function sharedReconciliationApi() {
        return runtimeRoot().GameShared && runtimeRoot().GameShared.authoritativeReconciliation
            ? runtimeRoot().GameShared.authoritativeReconciliation
            : null;
    }

    function clampReplaySampleDtSec(dtMs) {
        var parsedMs = Number(dtMs || 0);
        var dtSec = Number.isFinite(parsedMs) ? (parsedMs / 1000) : 0;
        return Math.max(MIN_REPLAY_SAMPLE_DT_SEC, Math.min(MAX_REPLAY_SAMPLE_DT_SEC, dtSec || 0));
    }

    function cloneReplayInputState(inputState, createMovementInputState) {
        var base = typeof createMovementInputState === 'function'
            ? (createMovementInputState() || {})
            : {};
        var source = inputState && typeof inputState === 'object' ? inputState : {};
        base.forward = !!source.forward;
        base.backward = !!source.backward;
        base.left = !!source.left;
        base.right = !!source.right;
        base.jump = !!source.jump;
        base.sprint = !!source.sprint;
        base.adsActive = !!source.adsActive;
        return base;
    }

    function buildAuthoritativeMotionKey(state) {
        var helper = sharedReconciliationApi();
        if (helper && helper.buildAuthoritativeMotionRevision) {
            return helper.buildAuthoritativeMotionRevision(state);
        }
        if (!state || typeof state !== 'object') return '';

        var precision = function (value) {
            return Math.round(Number(value || 0) * 1000);
        };

        return [
            String(state.id || ''),
            precision(state.x),
            precision(state.y),
            precision(state.z),
            precision(state.yaw),
            precision(state.pitch),
            precision(state.velocityY),
            precision(state.jumpHoldTimer),
            precision(state.moveSpeedNorm),
            state.isGrounded === false ? '0' : '1',
            state.jumpHeldLast ? '1' : '0',
            state.sprinting ? '1' : '0',
            state.fastBackpedal ? '1' : '0',
            state.alive === false ? '0' : '1',
            String(state.weaponId || '')
        ].join('|');
    }

    function fallbackReplaySteps(pendingInputs, options) {
        var entries = Array.isArray(pendingInputs) ? pendingInputs : [];
        var opts = options || {};
        var steps = [];
        var processedSeq = 0;
        var totalWeightSec = 0;
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (!entry || !entry.inputState) continue;
            var dtSec = clampReplaySampleDtSec(entry.dtMs);
            processedSeq = Math.max(processedSeq, Math.max(0, Number(entry.seq || 0)));
            totalWeightSec += dtSec;
            steps.push({
                seq: Math.max(0, Number(entry.seq || 0)),
                yaw: (typeof entry.yaw === 'number' && isFinite(entry.yaw))
                    ? Number(entry.yaw)
                    : Number(opts.fallbackYaw || 0),
                pitch: (typeof entry.pitch === 'number' && isFinite(entry.pitch))
                    ? Number(entry.pitch)
                    : Number(opts.fallbackPitch || 0),
                inputState: cloneReplayInputState(entry.inputState, opts.createMovementInputState),
                weaponId: String(entry.weaponId || opts.fallbackWeaponId || ''),
                movementLocked: !!(Object.prototype.hasOwnProperty.call(entry, 'movementLocked')
                    ? entry.movementLocked
                    : !!opts.movementLocked),
                dtSec: dtSec,
                weightSec: dtSec
            });
        }
        return {
            steps: steps,
            totalWeightSec: totalWeightSec,
            processedSeq: processedSeq
        };
    }

    function buildReplayStepPlan(reconcile, pendingInputs, options) {
        var helper = reconcile || sharedReconciliationApi();
        var opts = options || {};
        if (helper && helper.buildReplayStepsFromPendingInputs) {
            var plan = helper.buildReplayStepsFromPendingInputs(pendingInputs, opts);
            if (plan && Array.isArray(plan.steps)) {
                if (!(Number(plan.totalWeightSec || 0) >= 0)) {
                    plan.totalWeightSec = 0;
                }
                if (!(Number(plan.processedSeq || 0) >= 0)) {
                    plan.processedSeq = 0;
                }
                return plan;
            }
        }

        return fallbackReplaySteps(pendingInputs, opts);
    }

    function resolveTopSpeedForInputState(inputState, weaponId, airborne, opts) {
        var options = opts || {};
        if (typeof options.getTopSpeedForInputState === 'function') {
            return Number(options.getTopSpeedForInputState(inputState, weaponId, airborne) || 0);
        }

        if (typeof options.topSpeedForInputState === 'function') {
            return Number(options.topSpeedForInputState(inputState, weaponId, airborne) || 0);
        }

        var baseJogSpeed = Number(options.baseJogSpeed || 8);
        var baseRunSpeed = Number(options.baseRunSpeed || 14);
        var backwardSprintSpeedMult = Number(options.backwardSprintSpeedMult || 1.25);
        var moveSpeedMultiplier = Number(options.moveSpeedMultiplier || 1);
        var adsMoveMultiplier = Number(options.adsMoveMultiplier || 0.4);

        var baseJog = baseJogSpeed * moveSpeedMultiplier;
        var baseRun = baseRunSpeed * moveSpeedMultiplier;
        var adsSpeed = baseJog * adsMoveMultiplier;

        if (inputState && inputState.adsActive) return adsSpeed;
        if (inputState && inputState.sprint && inputState.backward && !inputState.forward) {
            return baseJog * backwardSprintSpeedMult;
        }
        if (inputState && inputState.sprint) return baseRun;
        if (airborne) return Math.max(baseJog, baseRun);
        return baseJog;
    }

    function believableReplayDistanceWu(reconcile, pendingInputs, opts, airborne) {
        var options = opts || {};
        var plan = buildReplayStepPlan(reconcile, pendingInputs, options);
        var steps = Array.isArray(plan && plan.steps) ? plan.steps : [];
        var totalWu = 0;

        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            if (!step || !(Number(step.dtSec || 0) > 0)) continue;
            totalWu += resolveTopSpeedForInputState(
                step.inputState,
                step.weaponId || options.currentWeaponId || '',
                airborne,
                options
            ) * Number(step.dtSec || 0);
        }

        if (options && options.hasUnsentInputTail) {
            totalWu += resolveTopSpeedForInputState(
                options.currentInputState || null,
                options.currentWeaponId || '',
                airborne,
                options
            ) * Math.max(0, Number(options.inputSendIntervalMs || 0)) / 1000;
        }

        return totalWu * Math.max(1, Number(options.speedAwareSafetyMargin || 1.15));
    }

    function shouldReplayAuthoritativeMotion(reconcile, opts, pendingInputCount, horizontalDistSq, replayDistance, replayTriggerChanged, allowReplayWithoutAckAdvance, movingIntent, canCorrectWhileMoving, latestPendingAgeMs, pendingReplayGraceMs, allowFreshPendingReplay) {
        var options = opts || {};
        if (options.allowReplayCorrection === false) return false;
        var helper = reconcile || sharedReconciliationApi();
        if (!(helper && helper.shouldReplayAuthoritativeCorrection)) return false;

        return !!helper.shouldReplayAuthoritativeCorrection({
            pendingInputCount: pendingInputCount,
            lastAckedSeq: Number(options.lastAckedSeq || 0),
            lastReplayAckSeq: Number(options.lastReplayAckSeq || 0),
            horizontalDistSq: horizontalDistSq,
            replayCorrectionDistance: replayDistance,
            authoritativeStateChanged: replayTriggerChanged,
            allowReplayWithoutAckAdvance: allowReplayWithoutAckAdvance,
            movingIntent: movingIntent,
            canCorrectWhileMoving: canCorrectWhileMoving,
            latestPendingAgeMs: latestPendingAgeMs,
            minPendingAgeMs: movingIntent ? pendingReplayGraceMs : 0,
            allowFreshPendingReplay: allowFreshPendingReplay
        });
    }

    function applyIdleBlendCorrectionState(state, params) {
        if (!state || typeof state !== 'object') return false;
        var options = params || {};
        var dt = Math.max(0, Number(options.dt || 0));
        var horizontalDistSq = Math.max(0, Number(options.horizontalDistSq || 0));
        var idleBlendRate = Math.max(0.1, Number(options.idleBlendRate || 5));
        var distFactor = Math.min(1, Math.sqrt(horizontalDistSq) * 0.6);
        var blend = Math.min(1, dt * (idleBlendRate + (idleBlendRate * distFactor)));
        var xKey = String(options.xKey || 'x');
        var yKey = String(options.yKey || 'y');
        var zKey = String(options.zKey || 'z');
        var dx = Number(options.dx || 0);
        var dy = Number(options.dy || 0);
        var dz = Number(options.dz || 0);
        var authoritativeX = Object.prototype.hasOwnProperty.call(options, 'authoritativeX')
            ? Number(options.authoritativeX || 0)
            : Number(state[xKey] || 0);
        var authoritativeY = Object.prototype.hasOwnProperty.call(options, 'authoritativeY')
            ? Number(options.authoritativeY || 0)
            : Number(state[yKey] || 0);
        var authoritativeZ = Object.prototype.hasOwnProperty.call(options, 'authoritativeZ')
            ? Number(options.authoritativeZ || 0)
            : Number(state[zKey] || 0);

        state[xKey] = Number(state[xKey] || 0) + (dx * blend);
        state[zKey] = Number(state[zKey] || 0) + (dz * blend);
        state[yKey] = Number(state[yKey] || 0) + (dy * blend);

        if (horizontalDistSq < 0.005) {
            state[xKey] = authoritativeX;
            state[zKey] = authoritativeZ;
        }
        if (Math.abs(dy) < 0.05) {
            state[yKey] = authoritativeY;
        }

        if (typeof options.onBlendApplied === 'function') {
            options.onBlendApplied({
                blend: blend,
                state: state,
                xKey: xKey,
                yKey: yKey,
                zKey: zKey
            });
        }

        return {
            blend: blend,
            x: state[xKey],
            y: state[yKey],
            z: state[zKey]
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GamePlayerReplay = {
        buildAuthoritativeMotionKey: buildAuthoritativeMotionKey,
        fallbackReplaySteps: fallbackReplaySteps,
        buildReplayStepPlan: buildReplayStepPlan,
        believableReplayDistanceWu: believableReplayDistanceWu,
        shouldReplayAuthoritativeMotion: shouldReplayAuthoritativeMotion,
        applyIdleBlendCorrectionState: applyIdleBlendCorrectionState
    };
})();
