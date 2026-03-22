/**
 * interpolation.js - Unified remote-entity interpolation helpers.
 * Single source of truth for snapshot interpolation, extrapolation,
 * and clock-offset smoothing used by remote-sync, state-view,
 * and remote-entities.
 *
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetInterpolation
 */
(function () {
    'use strict';

    // ── Utilities ──

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalizeAngle(rad) {
        while (rad > Math.PI) rad -= Math.PI * 2;
        while (rad < -Math.PI) rad += Math.PI * 2;
        return rad;
    }

    function lerpAngle(a, b, t) {
        return Number(a || 0) + (normalizeAngle(Number(b || 0) - Number(a || 0)) * t);
    }

    function choosePresentationValue(older, newer, t) {
        return t >= 0.5 ? newer : older;
    }

    function lerpNumber(a, b, t) {
        return Number(a || 0) + ((Number(b || 0) - Number(a || 0)) * t);
    }

    // ── Tuning ──

    function readInterpolationTuning() {
        var shared = (globalThis.__MAYHEM_RUNTIME || {}).GameShared || {};
        var network = shared.gameplayTuning && shared.gameplayTuning.network
            ? shared.gameplayTuning.network
            : null;
        return network && network.remoteInterpolation ? network.remoteInterpolation : {};
    }

    function readMovementTuning() {
        var shared = (globalThis.__MAYHEM_RUNTIME || {}).GameShared || {};
        return shared.gameplayTuning && shared.gameplayTuning.movement
            ? shared.gameplayTuning.movement
            : {};
    }

    function readGravityWuPerSecSq() {
        return Math.max(0, Number(readMovementTuning().gravity || 18));
    }

    // ── Clock-offset smoothing ──
    // Graduated alpha to avoid hard snaps on moderate jitter while still
    // converging quickly after large clock resets.

    function smoothClockOffset(currentOffset, measuredOffset, snapDeltaMs) {
        if (!isFinite(currentOffset)) return measuredOffset;
        var delta = Math.abs(measuredOffset - currentOffset);
        var alpha;
        if (delta > snapDeltaMs * 3) {
            alpha = 1;                               // hard reset
        } else if (delta > snapDeltaMs) {
            alpha = 0.35;                             // fast catch-up
        } else if (delta > snapDeltaMs * 0.5) {
            alpha = 0.2;                              // moderate correction
        } else {
            alpha = 0.12;                             // gentle blend
        }
        return currentOffset + (measuredOffset - currentOffset) * alpha;
    }

    // ── Interpolation delay from tuning + measured cadence ──

    function computeInterpolationDelay(intervalMs, jitterMs, tuning) {
        var t = tuning || readInterpolationTuning();
        var minDelay = Math.max(32, Number(t.minDelayMs || 56));
        var maxDelay = Math.max(minDelay, Number(t.maxDelayMs || 160));
        return clamp(
            (intervalMs * Number(t.intervalDelayScale || 1.6)) +
            (jitterMs * Number(t.jitterDelayScale || 1.4)),
            minDelay,
            maxDelay
        );
    }

    // ── Max extrapolation from tuning + measured cadence ──

    function computeMaxExtrapolation(intervalMs, jitterMs, tuning) {
        var t = tuning || readInterpolationTuning();
        return clamp(
            (intervalMs * Number(t.maxExtrapolationIntervalScale || 0.28)) +
            (jitterMs * Number(t.maxExtrapolationJitterScale || 0.45)),
            Math.max(1, Number(t.maxExtrapolationMinMs || 8)),
            Math.max(1, Number(t.maxExtrapolationMaxMs || 36))
        );
    }

    // ── Freeze gap from tuning + measured cadence ──

    function computeFreezeGap(intervalMs, jitterMs, tuning) {
        var t = tuning || readInterpolationTuning();
        return clamp(
            (intervalMs * Number(t.freezeGapIntervalScale || 1.25)) +
            (jitterMs * Number(t.freezeGapJitterScale || 1.8)),
            Math.max(1, Number(t.freezeGapMinMs || 48)),
            Math.max(1, Number(t.freezeGapMaxMs || 160))
        );
    }

    function buildPresentationClock(timingState, nowMs) {
        var timing = timingState || {};
        var latestServerTime = Math.max(
            0,
            Number(
                timing.latestServerTime != null
                    ? timing.latestServerTime
                    : timing.serverTime || 0
            )
        );
        var latestReceivedAt = Math.max(
            0,
            Number(
                timing.latestReceivedAt != null
                    ? timing.latestReceivedAt
                    : timing.receivedAt || 0
            )
        );
        if (!(latestServerTime > 0) || !(latestReceivedAt > 0)) return null;

        var tuning = readInterpolationTuning();
        var clockOffsetMs = Number(
            timing.clockOffsetMs != null
                ? timing.clockOffsetMs
                : timing.serverTimeOffsetMs
        );
        if (!isFinite(clockOffsetMs)) {
            clockOffsetMs = latestReceivedAt - latestServerTime;
        }

        var cadenceMs = Math.max(
            0,
            Number(
                timing.cadenceMs != null
                    ? timing.cadenceMs
                    : timing.intervalMs || 0
            )
        );
        var intervalMs = clamp(cadenceMs, 0, 140);
        var jitterMs = clamp(Number(timing.jitterMs || 0), 0, 120);
        var explicitDelayMs = Number(
            timing.interpolationDelayMs != null
                ? timing.interpolationDelayMs
                : timing.explicitDelayMs
        );
        var interpolationDelayMs = explicitDelayMs > 0
            ? Math.max(1, explicitDelayMs)
            : (intervalMs > 0 || jitterMs > 0)
                ? computeInterpolationDelay(Math.max(1, intervalMs), jitterMs, tuning)
                : Math.max(1, Number(tuning.defaultDelayMs || 1));
        var sampleNowMs = Math.max(0, Number(nowMs || Date.now()));
        var estimatedServerTime = Math.max(latestServerTime, sampleNowMs - clockOffsetMs);

        return {
            nowMs: sampleNowMs,
            latestServerTime: latestServerTime,
            latestReceivedAt: latestReceivedAt,
            clockOffsetMs: clockOffsetMs,
            cadenceMs: cadenceMs,
            estimatedServerTime: estimatedServerTime,
            interpolationDelayMs: interpolationDelayMs,
            renderServerTime: Math.max(0, estimatedServerTime - interpolationDelayMs)
        };
    }

    // ── Damped extrapolation scale ──
    // Quadratic decay so that extrapolation slows down as it extends
    // further from the last known position, reducing snap-back when the
    // next real snapshot arrives.

    function dampedExtrapolationScale(rawMs, maxMs, stepMs, tuning) {
        if (maxMs <= 0 || stepMs <= 0) return 0;
        var norm = rawMs / maxMs;
        var t = tuning || readInterpolationTuning();
        var decay = Math.max(0.1, Number(t.extrapolationDecay || 1.2));
        var damped = norm * Math.exp(-(norm * norm) * decay);
        return (damped * maxMs) / stepMs;
    }

    function projectBallisticFootY(entry, elapsedMs, gravityWuPerSecSq) {
        var dtSec = Math.max(0, Number(elapsedMs || 0)) / 1000;
        var gravity = Math.max(0, Number(gravityWuPerSecSq != null ? gravityWuPerSecSq : readGravityWuPerSecSq()));
        return Number(entry && entry.footY || 0) +
            (Number(entry && entry.velocityY || 0) * dtSec) -
            (0.5 * gravity * dtSec * dtSec);
    }

    function rewindBallisticFootY(entry, rewindMs, gravityWuPerSecSq) {
        var dtSec = Math.max(0, Number(rewindMs || 0)) / 1000;
        var gravity = Math.max(0, Number(gravityWuPerSecSq != null ? gravityWuPerSecSq : readGravityWuPerSecSq()));
        return Number(entry && entry.footY || 0) -
            (Number(entry && entry.velocityY || 0) * dtSec) -
            (0.5 * gravity * dtSec * dtSec);
    }

    function interpolateFootY(older, newer, t, spanMs, tuning) {
        var alpha = clamp(Number(t || 0), 0, 1);
        var base = older || newer || null;
        var head = newer || older || null;
        if (!base || !head) return 0;
        var interpTuning = tuning || readInterpolationTuning();
        if (interpTuning.verticalBallisticEnabled === false) {
            return lerpNumber(base.footY, head.footY, alpha);
        }
        var olderAirborne = older && older.isGrounded === false;
        var newerAirborne = newer && newer.isGrounded === false;
        var olderVelocityValid = older && isFinite(Number(older.velocityY));
        var newerVelocityValid = newer && isFinite(Number(newer.velocityY));
        if (!(olderAirborne && newerAirborne) || !olderVelocityValid || !newerVelocityValid) {
            return lerpNumber(base.footY, head.footY, alpha);
        }
        var totalSpanMs = Math.max(1, Number(spanMs || 0));
        var elapsedMs = totalSpanMs * alpha;
        var remainingMs = totalSpanMs - elapsedMs;
        var gravity = Math.max(0, Number(interpTuning.gravityWuPerSecSq || readGravityWuPerSecSq()));
        var forwardFootY = projectBallisticFootY(older, elapsedMs, gravity);
        var backwardFootY = rewindBallisticFootY(newer, remainingMs, gravity);
        return lerpNumber(forwardFootY, backwardFootY, alpha);
    }

    function frameRateIndependentAlpha(dtSec, remainingPerSecond) {
        var dt = Math.max(0, Number(dtSec || 0));
        if (!(dt > 0)) return 0;
        var remaining = clamp(Number(remainingPerSecond || 0.001), 0.00001, 0.99);
        return 1 - Math.pow(remaining, dt);
    }

    function cloneTransform(entry) {
        if (!entry) return null;
        return {
            x: Number(entry.x || 0),
            footY: Number(entry.footY || 0),
            z: Number(entry.z || 0),
            yaw: Number(entry.yaw || 0),
            pitch: Number(entry.pitch || 0),
            moveSpeedNorm: Number(entry.moveSpeedNorm || 0),
            sprinting: !!entry.sprinting,
            movingForward: !!entry.movingForward,
            movingBackward: !!entry.movingBackward,
            isGrounded: entry.isGrounded !== false,
            velocityY: Number(entry.velocityY || 0),
            muzzleFlashUntil: Number(entry.muzzleFlashUntil || 0)
        };
    }

    function easeOutCubic(t) {
        var clamped = clamp(Number(t || 0), 0, 1);
        return 1 - Math.pow(1 - clamped, 3);
    }

    function blendTransforms(from, to, t) {
        if (!from) return cloneTransform(to);
        if (!to) return cloneTransform(from);
        var alpha = clamp(Number(t || 0), 0, 1);
        return {
            x: lerpNumber(from.x, to.x, alpha),
            footY: lerpNumber(from.footY, to.footY, alpha),
            z: lerpNumber(from.z, to.z, alpha),
            yaw: lerpAngle(from.yaw, to.yaw, alpha),
            pitch: lerpNumber(from.pitch, to.pitch, alpha),
            moveSpeedNorm: lerpNumber(from.moveSpeedNorm, to.moveSpeedNorm, alpha),
            sprinting: alpha >= 0.5 ? !!to.sprinting : !!from.sprinting,
            movingForward: alpha >= 0.5 ? !!to.movingForward : !!from.movingForward,
            movingBackward: alpha >= 0.5 ? !!to.movingBackward : !!from.movingBackward,
            isGrounded: alpha >= 0.5 ? to.isGrounded !== false : from.isGrounded !== false,
            velocityY: lerpNumber(from.velocityY, to.velocityY, alpha),
            muzzleFlashUntil: Math.max(
                Number(from.muzzleFlashUntil || 0),
                Number(to.muzzleFlashUntil || 0)
            )
        };
    }

    // ── Core buffered-transform interpolation ──
    // Works with any snapshot history array where each entry has at least:
    //   { serverTime, receivedAt, x, footY, z, yaw, pitch,
    //     moveSpeedNorm, sprinting, movingForward, movingBackward,
    //     isGrounded, velocityY, muzzleFlashUntil? }
    //
    // Returns an interpolated/extrapolated transform object, or null if
    // the history is empty.

    function interpolateBufferedTransform(render, nowMs, options) {
        if (!render || !Array.isArray(render.snapshotHistory) || render.snapshotHistory.length === 0) return null;
        var opts = options || {};
        var history = render.snapshotHistory;
        var latest = history[history.length - 1];
        var intervalMs = clamp(Number(render.snapshotIntervalMs || 50), 16, 140);
        var jitterMs = clamp(Number(render.snapshotJitterMs || 0), 0, 120);
        var tuning = readInterpolationTuning();
        var renderClock = buildPresentationClock({
            latestServerTime: Number(latest.serverTime || 0),
            latestReceivedAt: Number(latest.receivedAt || nowMs),
            clockOffsetMs: Number(render.serverTimeOffsetMs),
            cadenceMs: intervalMs,
            jitterMs: jitterMs,
            interpolationDelayMs: Number(render.interpolationDelayMs || 0)
        }, nowMs);
        var renderServerTime = Number(renderClock && renderClock.renderServerTime || 0);
        var overrideDelay = Number(opts.delayMs);
        if (isFinite(overrideDelay) && overrideDelay >= 0) {
            renderServerTime = nowMs - Number(renderClock && renderClock.clockOffsetMs || 0) - overrideDelay;
        }

        // -- single entry or before first sample --
        if (history.length === 1 || renderServerTime <= Number(history[0].serverTime || 0)) {
            return _cloneHistoryEntry(history[0]);
        }

        // -- find bracketing samples and lerp --
        for (var i = history.length - 1; i > 0; i--) {
            var newer = history[i];
            var older = history[i - 1];
            var olderTime = Number(older.serverTime || 0);
            var newerTime = Number(newer.serverTime || 0);
            if (renderServerTime < olderTime || renderServerTime > newerTime) continue;
            var span = Math.max(1, newerTime - olderTime);
            var t = clamp((renderServerTime - olderTime) / span, 0, 1);
            return _lerpEntries(older, newer, t);
        }

        // -- past latest: extrapolate or freeze --
        var last = history[history.length - 1];
        var prev = history.length > 1 ? history[history.length - 2] : last;
        var latestGapMs = Math.max(0, nowMs - Number(last.receivedAt || nowMs));
        var explicitFreezeGap = Number(render.freezeGapMs);
        var freezeGapMs = explicitFreezeGap > 0
            ? explicitFreezeGap
            : computeFreezeGap(intervalMs, jitterMs, tuning);

        if (history.length < 2 || latestGapMs > freezeGapMs) {
            if (!render.freezePresentation) {
                render.freezePresentation = cloneTransform(render.lastPresentedTransform || last);
                render.freezePresentationAt = Math.max(0, Number(nowMs || 0));
            }
            return cloneTransform(render.freezePresentation || last);
        }

        var stepMs = Math.max(1, Number(last.serverTime || 0) - Number(prev.serverTime || 0));
        var explicitMaxExtrap = Number(render.maxExtrapolationMs);
        var maxExtrapMs = explicitMaxExtrap > 0
            ? explicitMaxExtrap
            : computeMaxExtrapolation(intervalMs, jitterMs, tuning);
        var rawExtrapMs = clamp(renderServerTime - Number(last.serverTime || 0), 0, Math.min(maxExtrapMs, intervalMs + jitterMs));
        var scale = dampedExtrapolationScale(rawExtrapMs, maxExtrapMs, stepMs, tuning);
        var effectiveExtrapolationMs = scale * stepMs;
        var extrapolatedFootY = (tuning.verticalBallisticEnabled !== false && last.isGrounded === false)
            ? projectBallisticFootY(last, effectiveExtrapolationMs, tuning.gravityWuPerSecSq)
            : (Number(last.footY || 0) + ((Number(last.footY || 0) - Number(prev.footY || 0)) * scale));

        return {
            x: Number(last.x || 0) + ((Number(last.x || 0) - Number(prev.x || 0)) * scale),
            footY: extrapolatedFootY,
            z: Number(last.z || 0) + ((Number(last.z || 0) - Number(prev.z || 0)) * scale),
            yaw: Number(last.yaw || 0) + (normalizeAngle(Number(last.yaw || 0) - Number(prev.yaw || 0)) * scale),
            pitch: Number(last.pitch || 0) + ((Number(last.pitch || 0) - Number(prev.pitch || 0)) * scale),
            moveSpeedNorm: Number(last.moveSpeedNorm || 0),
            sprinting: !!last.sprinting,
            movingForward: !!last.movingForward,
            movingBackward: !!last.movingBackward,
            isGrounded: last.isGrounded !== false,
            velocityY: Number(last.velocityY || 0),
            muzzleFlashUntil: Number(last.muzzleFlashUntil || 0)
        };
    }

    function _cloneHistoryEntry(entry) {
        return cloneTransform(entry);
    }

    function _lerpEntries(older, newer, t) {
        var spanMs = Math.max(1, Number(newer && newer.serverTime || 0) - Number(older && older.serverTime || 0));
        return {
            x: lerpNumber(older.x, newer.x, t),
            footY: interpolateFootY(older, newer, t, spanMs),
            z: lerpNumber(older.z, newer.z, t),
            yaw: lerpAngle(older.yaw, newer.yaw, t),
            pitch: lerpNumber(older.pitch, newer.pitch, t),
            moveSpeedNorm: lerpNumber(older.moveSpeedNorm, newer.moveSpeedNorm, t),
            sprinting: !!choosePresentationValue(!!older.sprinting, !!newer.sprinting, t),
            movingForward: !!choosePresentationValue(!!older.movingForward, !!newer.movingForward, t),
            movingBackward: !!choosePresentationValue(!!older.movingBackward, !!newer.movingBackward, t),
            isGrounded: choosePresentationValue(older.isGrounded !== false, newer.isGrounded !== false, t) !== false,
            velocityY: lerpNumber(older.velocityY, newer.velocityY, t),
            muzzleFlashUntil: Number(choosePresentationValue(Number(older.muzzleFlashUntil || 0), Number(newer.muzzleFlashUntil || 0), t) || 0)
        };
    }

    // ── Public API ──

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetInterpolation = {
        clamp: clamp,
        normalizeAngle: normalizeAngle,
        lerpAngle: lerpAngle,
        choosePresentationValue: choosePresentationValue,
        lerpNumber: lerpNumber,
        readInterpolationTuning: readInterpolationTuning,
        buildPresentationClock: buildPresentationClock,
        smoothClockOffset: smoothClockOffset,
        computeInterpolationDelay: computeInterpolationDelay,
        computeMaxExtrapolation: computeMaxExtrapolation,
        computeFreezeGap: computeFreezeGap,
        dampedExtrapolationScale: dampedExtrapolationScale,
        frameRateIndependentAlpha: frameRateIndependentAlpha,
        cloneTransform: cloneTransform,
        blendTransforms: blendTransforms,
        easeOutCubic: easeOutCubic,
        projectBallisticFootY: projectBallisticFootY,
        rewindBallisticFootY: rewindBallisticFootY,
        interpolateFootY: interpolateFootY,
        interpolateBufferedTransform: interpolateBufferedTransform
    };
})();
