/**
 * connection-timing.js - Snapshot, clock-offset, RTT, and self-ack timing for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetConnectionTiming
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};

        var lastSnapshotServerTime = 0;
        var lastSnapshotReceivedAt = 0;
        var serverTimeOffsetMs = NaN;
        var snapshotIntervalMs = 0;
        var snapshotJitterMs = 0;
        var lastSnapshotStepMs = 0;
        var lastAppliedSelfSeq = 0;
        var lastAppliedSelfServerTime = 0;
        var lastAcceptedSelfAckAt = 0;
        var estimatedRttMs = NaN;
        var pessimisticRttMs = NaN;
        var rttJitterMs = 0;
        var recentRttSamples = [];
        var lastPongAt = 0;
        var pingSendTimer = 0.5;

        function nowMs() {
            return opts.getNowMs ? Math.max(0, Number(opts.getNowMs() || 0)) : Date.now();
        }

        function pingCadenceMs() {
            return opts.getPingCadenceMs ? Math.max(1, Number(opts.getPingCadenceMs() || 0)) : 500;
        }

        function isConnected() {
            return !!(opts.getIsConnected && opts.getIsConnected());
        }

        function readSelfSnapshotSeq(entity) {
            var raw = Number(entity && entity.seq);
            if (!isFinite(raw)) return 0;
            return normalizeSelfSeq(raw);
        }

        function readSnapshotServerTime(snapshotMeta) {
            var serverTime = Number(snapshotMeta && snapshotMeta.serverTime || 0);
            return isFinite(serverTime) && serverTime > 0 ? serverTime : 0;
        }

        function reset() {
            lastSnapshotServerTime = 0;
            lastSnapshotReceivedAt = 0;
            serverTimeOffsetMs = NaN;
            snapshotIntervalMs = 0;
            snapshotJitterMs = 0;
            lastSnapshotStepMs = 0;
            lastAppliedSelfSeq = 0;
            lastAppliedSelfServerTime = 0;
            lastAcceptedSelfAckAt = 0;
            estimatedRttMs = NaN;
            pessimisticRttMs = NaN;
            rttJitterMs = 0;
            recentRttSamples = [];
            lastPongAt = 0;
            pingSendTimer = pingCadenceMs() / 1000;
        }

        function selfSeqModulo() {
            var explicitModulo = opts.getSelfSeqModulo ? Number(opts.getSelfSeqModulo() || 0) : 0;
            return explicitModulo > 1 ? explicitModulo : 4294967296;
        }

        function normalizeSelfSeq(value) {
            var modulo = selfSeqModulo();
            var floored = Math.max(0, Math.floor(Number(value || 0)));
            if (!(modulo > 1)) return floored;
            return ((floored % modulo) + modulo) % modulo;
        }

        function compareSelfSeq(nextSeq, priorSeq) {
            var modulo = selfSeqModulo();
            var next = normalizeSelfSeq(nextSeq);
            var prior = normalizeSelfSeq(priorSeq);
            if (next === prior) return 0;
            if (!(modulo > 1)) return next > prior ? 1 : -1;
            var diff = ((next - prior) % modulo + modulo) % modulo;
            if (diff === 0) return 0;
            return diff < (modulo / 2) ? 1 : -1;
        }

        function shouldAcceptSelfSnapshot(entity, snapshotMeta) {
            var seq = readSelfSnapshotSeq(entity);
            var serverTime = readSnapshotServerTime(snapshotMeta);
            if (seq > 0 && lastAppliedSelfSeq > 0) {
                var seqOrder = compareSelfSeq(seq, lastAppliedSelfSeq);
                if (seqOrder < 0) return false;
                if (seqOrder === 0) {
                    return serverTime > lastAppliedSelfServerTime;
                }
                return true;
            }
            if (lastAppliedSelfSeq > 0 && serverTime > 0 && serverTime <= lastAppliedSelfServerTime) {
                return false;
            }
            return true;
        }

        function noteAcceptedSelfSnapshot(entity, snapshotMeta) {
            var ackSeq = readSelfSnapshotSeq(entity);
            var acceptedServerTime = readSnapshotServerTime(snapshotMeta);
            if (ackSeq > 0) {
                lastAppliedSelfSeq = ackSeq;
                lastAcceptedSelfAckAt = Math.max(0, Number(snapshotMeta && snapshotMeta.receivedAt || nowMs()));
            }
            if (acceptedServerTime > 0) {
                lastAppliedSelfServerTime = Math.max(lastAppliedSelfServerTime, acceptedServerTime);
            }
            return {
                ackSeq: ackSeq,
                acceptedServerTime: acceptedServerTime,
                acceptedAt: lastAcceptedSelfAckAt
            };
        }

        function updatePongTiming(msg, receivedAt) {
            var stamp = Math.max(0, Number(receivedAt || nowMs()));
            var clientTime = Number(msg && msg.clientTime || 0);
            if (!isFinite(clientTime) || clientTime <= 0) return false;
            var rttSample = Math.max(0, stamp - clientTime);
            var pingTuning = opts.getPingTuning ? (opts.getPingTuning() || {}) : {};
            var rttAlpha = Number(pingTuning.rttAlpha || 0.15);
            var pessimisticRttAlpha = Number(pingTuning.pessimisticRttAlpha || 0.05);
            var pessimisticWindowMs = Math.max(
                pingCadenceMs(),
                Number(pingTuning.pessimisticWindowMs || 2000)
            );
            var jitterAlpha = Number(pingTuning.jitterAlpha || 0.2);
            if (!isFinite(estimatedRttMs)) {
                estimatedRttMs = rttSample;
                rttJitterMs = 0;
            } else {
                var jitterSample = Math.abs(rttSample - estimatedRttMs);
                estimatedRttMs += (rttSample - estimatedRttMs) * Math.max(0.01, Math.min(1, rttAlpha));
                rttJitterMs += (jitterSample - rttJitterMs) * Math.max(0.01, Math.min(1, jitterAlpha));
            }
            recentRttSamples.push({
                receivedAt: stamp,
                rttMs: rttSample
            });
            while (recentRttSamples.length > 0 && (stamp - Number(recentRttSamples[0].receivedAt || 0)) > pessimisticWindowMs) {
                recentRttSamples.shift();
            }
            var pessimisticSample = recentRttSamples.reduce(function (maxValue, sample) {
                return Math.max(maxValue, Number(sample && sample.rttMs || 0));
            }, rttSample);
            if (!isFinite(pessimisticRttMs)) {
                pessimisticRttMs = pessimisticSample;
            } else {
                pessimisticRttMs = Math.max(
                    rttSample,
                    pessimisticRttMs + ((pessimisticSample - pessimisticRttMs) * Math.max(0.01, Math.min(1, pessimisticRttAlpha)))
                );
            }
            lastPongAt = stamp;
            return true;
        }

        function snapshotTimingState() {
            if (!isFinite(serverTimeOffsetMs) || lastSnapshotServerTime <= 0 || lastSnapshotReceivedAt <= 0) return null;
            return {
                serverTime: Number(lastSnapshotServerTime || 0),
                receivedAt: Number(lastSnapshotReceivedAt || 0),
                serverTimeOffsetMs: Number(serverTimeOffsetMs || 0)
            };
        }

        function authoritativeNowMs() {
            if (isConnected() && isFinite(serverTimeOffsetMs)) {
                return Math.max(0, nowMs() - serverTimeOffsetMs);
            }
            return nowMs();
        }

        function toLocalClockTime(serverTimestamp) {
            var stamp = Number(serverTimestamp || 0);
            if (!(stamp > 0)) return 0;
            if (!isFinite(serverTimeOffsetMs)) return stamp;
            return Math.max(0, stamp + serverTimeOffsetMs);
        }

        function connectionTimingState() {
            var snapshotState = snapshotTimingState();
            return {
                snapshot: snapshotState ? {
                    serverTime: snapshotState.serverTime,
                    receivedAt: snapshotState.receivedAt,
                    serverTimeOffsetMs: snapshotState.serverTimeOffsetMs,
                    intervalMs: Math.max(0, Number(snapshotIntervalMs || 0)),
                    jitterMs: Math.max(0, Number(snapshotJitterMs || 0))
                } : null,
                rttMs: isFinite(estimatedRttMs) ? Math.max(0, Number(estimatedRttMs || 0)) : 0,
                responsiveRttMs: isFinite(estimatedRttMs) ? Math.max(0, Number(estimatedRttMs || 0)) : 0,
                pessimisticRttMs: isFinite(pessimisticRttMs) ? Math.max(0, Number(pessimisticRttMs || 0)) : 0,
                rttJitterMs: Math.max(0, Number(rttJitterMs || 0)),
                lastPongAt: Math.max(0, Number(lastPongAt || 0)),
                pingCadenceMs: pingCadenceMs()
            };
        }

        function updateSnapshotTiming(snapshotTiming) {
            var timing = snapshotTiming || {};
            var serverTime = Number(timing.serverTime || 0);
            var receivedAt = Number(timing.receivedAt || nowMs());
            if (!isFinite(serverTime) || serverTime <= 0) return false;
            if (!isFinite(receivedAt) || receivedAt <= 0) receivedAt = nowMs();
            if (lastSnapshotReceivedAt > 0) {
                var nextStepMs = Math.max(1, receivedAt - lastSnapshotReceivedAt);
                if (snapshotIntervalMs <= 0) {
                    snapshotIntervalMs = nextStepMs;
                    lastSnapshotStepMs = nextStepMs;
                    snapshotJitterMs = 0;
                } else {
                    var priorIntervalMs = Math.max(1, Number(snapshotIntervalMs || nextStepMs));
                    var priorStepMs = Math.max(1, Number(lastSnapshotStepMs || nextStepMs));
                    snapshotIntervalMs = (priorIntervalMs * 0.7) + (nextStepMs * 0.3);
                    snapshotJitterMs = (Number(snapshotJitterMs || 0) * 0.65) + (Math.abs(nextStepMs - priorStepMs) * 0.35);
                    lastSnapshotStepMs = nextStepMs;
                }
            }
            lastSnapshotServerTime = serverTime;
            lastSnapshotReceivedAt = receivedAt;
            var measuredOffsetMs = receivedAt - serverTime;
            var interpModule = (globalThis.__MAYHEM_RUNTIME || {}).GameNetInterpolation || null;
            var interpTuning = interpModule && interpModule.readInterpolationTuning
                ? (interpModule.readInterpolationTuning() || {})
                : {};
            var offsetSnapDeltaMs = Math.max(1, Number(interpTuning.serverOffsetSnapDeltaMs || 150));
            if (interpModule && interpModule.smoothClockOffset) {
                serverTimeOffsetMs = interpModule.smoothClockOffset(serverTimeOffsetMs, measuredOffsetMs, offsetSnapDeltaMs);
            } else if (!isFinite(serverTimeOffsetMs)) {
                serverTimeOffsetMs = measuredOffsetMs;
            } else {
                serverTimeOffsetMs += (measuredOffsetMs - serverTimeOffsetMs) * 0.12;
            }
            return true;
        }

        function getLastAcceptedSelfAckAt() {
            return Math.max(0, Number(lastAcceptedSelfAckAt || 0));
        }

        function getPingSendTimer() {
            return Number(pingSendTimer || 0);
        }

        function setPingSendTimer(value) {
            pingSendTimer = Math.max(0, Number(value || 0));
        }

        function getEstimatedServerTime() {
            if (!isConnected() || !isFinite(serverTimeOffsetMs)) return 0;
            return Math.max(0, nowMs() - serverTimeOffsetMs);
        }

        reset();

        return {
            reset: reset,
            shouldAcceptSelfSnapshot: shouldAcceptSelfSnapshot,
            noteAcceptedSelfSnapshot: noteAcceptedSelfSnapshot,
            updatePongTiming: updatePongTiming,
            snapshotTimingState: snapshotTimingState,
            authoritativeNowMs: authoritativeNowMs,
            toLocalClockTime: toLocalClockTime,
            connectionTimingState: connectionTimingState,
            updateSnapshotTiming: updateSnapshotTiming,
            getLastAcceptedSelfAckAt: getLastAcceptedSelfAckAt,
            getPingSendTimer: getPingSendTimer,
            setPingSendTimer: setPingSendTimer,
            getPingCadenceSeconds: function () { return pingCadenceMs() / 1000; },
            getEstimatedServerTime: getEstimatedServerTime
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetConnectionTiming = {
        create: create
    };
})();
