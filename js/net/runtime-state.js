/**
 * runtime-state.js - Mutable authoritative runtime state for the PvP net lane.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetRuntimeState
 */
(function () {
    'use strict';

    var MAX_REMOTE_FRAME_QUEUE_SIZE = 32;

    function create(opts) {
        opts = opts || {};
        var initialInputSendInterval = Number(opts.inputSendInterval || (1 / 60));
        var initialRoomId = String(opts.initialRoomId || 'global');

        var snapshotMap = new Map();
        var remoteSnapshotTimelineMap = new Map();
        var remoteFrameQueue = [];
        var snapshotBaselineBySeq = new Map();
        var snapshotBaselineOrder = [];
        var throwAckQueue = [];
        var throwRejectQueue = [];
        var throwableEventQueue = [];
        var shotEffectQueue = [];
        var shotRejectQueue = [];
        var damageFeedbackQueue = [];
        var incomingDamageFeedbackQueue = [];
        var notices = [];
        var remoteSnapshotTiming = {
            latestSnapshotSeq: 0,
            latestServerTime: 0,
            latestReceivedAt: 0,
            clockOffsetMs: 0,
            clockSampleCount: 0,
            cadenceMs: 0
        };

        var state = {
            roomId: initialRoomId,
            selfId: '',
            selfState: null,
            matchState: null,
            gameMode: '',
            privateRoomPhase: '',
            worldMeta: null,
            worldMismatchNotified: false,
            pendingSpawnSync: null,
            pendingRespawnInfo: null,
            initialSpawnApplied: false,
            pendingWeaponLoadout: null,
            lastSentInputSample: null,
            lastSentPlayerPos: null,
            lastDriftSamplePos: null,
            accumulatedPositionDriftWu: 0,
            lastDriftSampleYaw: 0,
            accumulatedYawDriftRad: 0,
            snapshotAckSeq: 0,
            inputSeq: 1,
            lastInputSeqSent: 0,
            lastInputSeqAcked: 0,
            inputSeqHistory: [],
            localPredictionSamples: [],
            inputSendTimer: 0,
            inputSendInterval: initialInputSendInterval,
            remoteProjectileState: [],
            remoteFireZoneState: []
        };

        function reset() {
            state.selfId = '';
            state.selfState = null;
            state.matchState = null;
            state.gameMode = '';
            state.privateRoomPhase = '';
            state.worldMeta = null;
            state.worldMismatchNotified = false;
            state.pendingSpawnSync = null;
            state.pendingRespawnInfo = null;
            state.initialSpawnApplied = false;
            state.pendingWeaponLoadout = null;
            state.lastSentInputSample = null;
            state.lastSentPlayerPos = null;
            state.lastDriftSamplePos = null;
            state.accumulatedPositionDriftWu = 0;
            state.lastDriftSampleYaw = 0;
            state.accumulatedYawDriftRad = 0;
            state.snapshotAckSeq = 0;
            state.inputSeq = 1;
            state.lastInputSeqSent = 0;
            state.lastInputSeqAcked = 0;
            state.inputSeqHistory = [];
            state.localPredictionSamples = [];
            state.inputSendTimer = 0;
            state.inputSendInterval = initialInputSendInterval;
            state.remoteProjectileState = [];
            state.remoteFireZoneState = [];
            snapshotMap.clear();
            remoteSnapshotTimelineMap.clear();
            remoteFrameQueue.length = 0;
            snapshotBaselineBySeq.clear();
            snapshotBaselineOrder.length = 0;
            throwAckQueue.length = 0;
            throwRejectQueue.length = 0;
            throwableEventQueue.length = 0;
            shotEffectQueue.length = 0;
            shotRejectQueue.length = 0;
            damageFeedbackQueue.length = 0;
            incomingDamageFeedbackQueue.length = 0;
            notices.length = 0;
            remoteSnapshotTiming.latestSnapshotSeq = 0;
            remoteSnapshotTiming.latestServerTime = 0;
            remoteSnapshotTiming.latestReceivedAt = 0;
            remoteSnapshotTiming.clockOffsetMs = 0;
            remoteSnapshotTiming.clockSampleCount = 0;
            remoteSnapshotTiming.cadenceMs = 0;
        }

        function pushNotice(text) {
            notices.push(text);
            if (notices.length > 6) notices.shift();
        }

        function consumeNotice() {
            if (!notices.length) return '';
            return notices.shift();
        }

        function nextInputSeq() {
            var current = state.inputSeq;
            state.inputSeq += 1;
            return current;
        }

        function inputSeqModulo() {
            return 4294967296;
        }

        function normalizeInputSeq(value) {
            var modulo = inputSeqModulo();
            var floored = Math.max(0, Math.floor(Number(value || 0)));
            return ((floored % modulo) + modulo) % modulo;
        }

        function compareInputSeq(nextSeq, priorSeq) {
            var modulo = inputSeqModulo();
            var next = normalizeInputSeq(nextSeq);
            var prior = normalizeInputSeq(priorSeq);
            if (next === prior) return 0;
            var diff = ((next - prior) % modulo + modulo) % modulo;
            return diff < (modulo / 2) ? 1 : -1;
        }

        function ackInputSeq(seq) {
            var nextAck = Math.floor(Number(seq || 0));
            if (!isFinite(nextAck)) return state.lastInputSeqAcked;
            if (state.lastInputSeqAcked <= 0 || compareInputSeq(nextAck, state.lastInputSeqAcked) >= 0) {
                state.lastInputSeqAcked = normalizeInputSeq(nextAck);
            }
            if (state.inputSeqHistory.length > 0) {
                state.inputSeqHistory = state.inputSeqHistory.filter(function (entry) {
                    return entry && compareInputSeq(entry.seq, state.lastInputSeqAcked) > 0;
                });
            }
            return state.lastInputSeqAcked;
        }

        function setRemoteProjectileState(projectiles) {
            state.remoteProjectileState = Array.isArray(projectiles) ? projectiles.slice() : [];
        }

        function setRemoteFireZoneState(fireZones) {
            state.remoteFireZoneState = Array.isArray(fireZones) ? fireZones.slice() : [];
        }

        function normalizeRemoteSnapshotNumber(value, fallback) {
            var parsed = Number(value);
            return isFinite(parsed) ? parsed : Number(fallback || 0);
        }

        function recordRemoteSnapshotTiming(serverTime, receivedAt, snapshotSeq) {
            var nextServerTime = Math.max(0, Math.round(Number(serverTime || 0)));
            var nextReceivedAt = Math.max(0, Math.round(Number(receivedAt || Date.now())));
            var nextSnapshotSeq = Math.max(0, Math.floor(Number(snapshotSeq || 0)));
            if (!(nextServerTime > 0)) return remoteSnapshotTiming.latestServerTime;
            if (nextSnapshotSeq > 0 && remoteSnapshotTiming.latestSnapshotSeq > 0 && nextSnapshotSeq <= remoteSnapshotTiming.latestSnapshotSeq) {
                return remoteSnapshotTiming.latestServerTime;
            }
            if (!(nextSnapshotSeq > 0) && remoteSnapshotTiming.latestServerTime > 0 && nextServerTime <= remoteSnapshotTiming.latestServerTime) {
                return remoteSnapshotTiming.latestServerTime;
            }
            if (remoteSnapshotTiming.latestServerTime > 0 && nextServerTime > remoteSnapshotTiming.latestServerTime) {
                var intervalMs = nextServerTime - remoteSnapshotTiming.latestServerTime;
                if (intervalMs > 0) {
                    remoteSnapshotTiming.cadenceMs = remoteSnapshotTiming.cadenceMs > 0
                        ? Number(((remoteSnapshotTiming.cadenceMs * 0.75) + (intervalMs * 0.25)).toFixed(3))
                        : intervalMs;
                }
            }
            var sampleOffsetMs = nextReceivedAt - nextServerTime;
            remoteSnapshotTiming.clockOffsetMs = remoteSnapshotTiming.clockSampleCount > 0
                ? Number(((remoteSnapshotTiming.clockOffsetMs * 0.8) + (sampleOffsetMs * 0.2)).toFixed(3))
                : sampleOffsetMs;
            if (nextSnapshotSeq > 0) {
                remoteSnapshotTiming.latestSnapshotSeq = nextSnapshotSeq;
            }
            remoteSnapshotTiming.clockSampleCount += 1;
            remoteSnapshotTiming.latestServerTime = Math.max(remoteSnapshotTiming.latestServerTime, nextServerTime);
            remoteSnapshotTiming.latestReceivedAt = Math.max(remoteSnapshotTiming.latestReceivedAt, nextReceivedAt);
            return remoteSnapshotTiming.latestServerTime;
        }

        function recordRemoteSnapshotEntity(entityId, entity, serverTime) {
            var id = String(entityId || (entity && entity.id) || '');
            var snapshotTime = Math.max(0, Math.round(Number(serverTime || 0)));
            if (!id || !entity || !(snapshotTime > 0)) return [];
            var sample = {
                serverTime: snapshotTime,
                x: normalizeRemoteSnapshotNumber(entity.x, 0),
                y: normalizeRemoteSnapshotNumber(entity.y, 1.6),
                z: normalizeRemoteSnapshotNumber(entity.z, 0),
                yaw: normalizeRemoteSnapshotNumber(entity.yaw, 0),
                pitch: normalizeRemoteSnapshotNumber(entity.pitch, 0),
                moveSpeedNorm: normalizeRemoteSnapshotNumber(entity.moveSpeedNorm, 0),
                sprinting: !!entity.sprinting,
                fastBackpedal: !!entity.fastBackpedal,
                movingForward: !!entity.movingForward,
                movingBackward: !!entity.movingBackward,
                movingLeft: !!entity.movingLeft,
                movingRight: !!entity.movingRight,
                isGrounded: entity.isGrounded !== false,
                velocityY: normalizeRemoteSnapshotNumber(entity.velocityY, 0),
                weaponId: String(entity.weaponId || 'rifle')
            };
            var history = remoteSnapshotTimelineMap.get(id);
            if (!Array.isArray(history)) {
                history = [];
                remoteSnapshotTimelineMap.set(id, history);
            }
            if (history.length > 0 && snapshotTime < Number(history[history.length - 1].serverTime || 0)) {
                return history;
            }
            if (history.length > 0 && Number(history[history.length - 1].serverTime || 0) === snapshotTime) {
                history[history.length - 1] = sample;
            } else {
                history.push(sample);
            }
            var latestServerTime = Math.max(remoteSnapshotTiming.latestServerTime, snapshotTime);
            var cutoffTime = latestServerTime - 750;
            while (history.length > 0 && Number(history[0].serverTime || 0) < cutoffTime) {
                history.shift();
            }
            while (history.length > 24) {
                history.shift();
            }
            return history;
        }

        function pruneRemoteSnapshotTimelines(activeIds) {
            var allow = activeIds instanceof Map ? activeIds : new Map();
            var staleIds = [];
            remoteSnapshotTimelineMap.forEach(function (_history, entityId) {
                if (!allow.has(entityId)) staleIds.push(entityId);
            });
            for (var i = 0; i < staleIds.length; i++) {
                remoteSnapshotTimelineMap.delete(staleIds[i]);
            }
            return remoteSnapshotTimelineMap;
        }

        function pushLocalPredictionSample(sample) {
            if (!sample || typeof sample !== 'object') return state.localPredictionSamples;
            state.localPredictionSamples.push(sample);
            if (state.localPredictionSamples.length > 16) {
                state.localPredictionSamples.shift();
            }
            return state.localPredictionSamples;
        }

        function clearLocalPredictionSamples() {
            state.localPredictionSamples = [];
            return state.localPredictionSamples;
        }

        function clonePlayerPosition(value) {
            if (!value || typeof value !== 'object') return null;
            var x = Number(value.x || 0);
            var y = Number(value.y || 0);
            var z = Number(value.z || 0);
            if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return null;
            return { x: x, y: y, z: z };
        }

        function normalizeAngle(rad) {
            var value = Number(rad || 0);
            while (value > Math.PI) value -= Math.PI * 2;
            while (value < -Math.PI) value += Math.PI * 2;
            return value;
        }

        function resetInputDriftTracking(position, yaw) {
            state.lastSentPlayerPos = clonePlayerPosition(position);
            state.lastDriftSamplePos = clonePlayerPosition(position);
            state.accumulatedPositionDriftWu = 0;
            state.lastDriftSampleYaw = Number(isFinite(Number(yaw)) ? yaw : 0);
            state.accumulatedYawDriftRad = 0;
            return {
                position: state.lastSentPlayerPos,
                yaw: state.lastDriftSampleYaw
            };
        }

        function updateInputDriftTracking(position, yaw) {
            var nextPosition = clonePlayerPosition(position);
            if (nextPosition && state.lastDriftSamplePos) {
                var dx = nextPosition.x - Number(state.lastDriftSamplePos.x || 0);
                var dy = nextPosition.y - Number(state.lastDriftSamplePos.y || 0);
                var dz = nextPosition.z - Number(state.lastDriftSamplePos.z || 0);
                state.accumulatedPositionDriftWu += Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
            }
            if (nextPosition) {
                state.lastDriftSamplePos = nextPosition;
            } else if (!state.lastDriftSamplePos) {
                state.lastDriftSamplePos = null;
            }
            if (isFinite(Number(yaw))) {
                var normalizedYaw = normalizeAngle(Number(yaw || 0));
                if (isFinite(Number(state.lastDriftSampleYaw))) {
                    state.accumulatedYawDriftRad += Math.abs(normalizeAngle(normalizedYaw - Number(state.lastDriftSampleYaw || 0)));
                }
                state.lastDriftSampleYaw = normalizedYaw;
            }
            return {
                positionDriftWu: Number(state.accumulatedPositionDriftWu || 0),
                yawDriftRad: Number(state.accumulatedYawDriftRad || 0)
            };
        }

        function remoteFrameFreshness(frame) {
            var snapshotSeq = Math.max(0, Number(frame && frame.snapshotSeq || 0));
            var serverTime = Math.max(0, Number(frame && frame.serverTime || 0));
            var receivedAt = Math.max(0, Number(frame && frame.receivedAt || 0));
            var readyAt = Math.max(0, Number(frame && frame.readyAt || 0));
            return snapshotSeq || serverTime || receivedAt || readyAt;
        }

        function enqueueRemoteFrame(frame) {
            if (!frame || typeof frame !== 'object') return remoteFrameQueue;
            var readyAt = Math.max(0, Number(frame.readyAt || 0));
            var snapshotSeq = Math.max(0, Number(frame.snapshotSeq || 0));
            var insertAt = remoteFrameQueue.length;
            for (var i = 0; i < remoteFrameQueue.length; i++) {
                var queued = remoteFrameQueue[i] || {};
                var queuedReadyAt = Math.max(0, Number(queued.readyAt || 0));
                var queuedSnapshotSeq = Math.max(0, Number(queued.snapshotSeq || 0));
                if (
                    readyAt < queuedReadyAt ||
                    (readyAt === queuedReadyAt && snapshotSeq > 0 && queuedSnapshotSeq > 0 && snapshotSeq < queuedSnapshotSeq)
                ) {
                    insertAt = i;
                    break;
                }
            }
            remoteFrameQueue.splice(insertAt, 0, frame);
            while (remoteFrameQueue.length > MAX_REMOTE_FRAME_QUEUE_SIZE) {
                var dropIndex = 0;
                var oldestFreshness = remoteFrameFreshness(remoteFrameQueue[0]);
                for (var j = 1; j < remoteFrameQueue.length; j++) {
                    var nextFreshness = remoteFrameFreshness(remoteFrameQueue[j]);
                    if (nextFreshness < oldestFreshness) {
                        oldestFreshness = nextFreshness;
                        dropIndex = j;
                    }
                }
                remoteFrameQueue.splice(dropIndex, 1);
            }
            return remoteFrameQueue;
        }

        function peekRemoteFrame() {
            return remoteFrameQueue.length > 0 ? remoteFrameQueue[0] : null;
        }

        function shiftRemoteFrame() {
            return remoteFrameQueue.length > 0 ? remoteFrameQueue.shift() : null;
        }

        function clearRemoteFrameQueue() {
            remoteFrameQueue.length = 0;
            return remoteFrameQueue;
        }

        function setSnapshotAckSeq(seq) {
            var next = Math.max(0, Math.floor(Number(seq || 0)));
            if (next <= 0) {
                state.snapshotAckSeq = 0;
                return state.snapshotAckSeq;
            }
            if (next > state.snapshotAckSeq) {
                state.snapshotAckSeq = next;
            }
            return state.snapshotAckSeq;
        }

        function cloneSnapshotValue(value) {
            if (Array.isArray(value)) {
                return value.map(cloneSnapshotValue);
            }
            if (value && typeof value === 'object') {
                var out = {};
                for (var key in value) {
                    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
                    out[key] = cloneSnapshotValue(value[key]);
                }
                return out;
            }
            return value;
        }

        function cloneSnapshotMap(source) {
            var sourceMap = source instanceof Map ? source : new Map();
            var out = new Map();
            sourceMap.forEach(function (entity, id) {
                out.set(String(id || ''), cloneSnapshotValue(entity));
            });
            return out;
        }

        function rememberSnapshotBaseline(snapshotSeq, sourceMap) {
            var seq = Math.max(0, Math.floor(Number(snapshotSeq || 0)));
            if (!(seq > 0)) return null;
            var cloned = cloneSnapshotMap(sourceMap);
            snapshotBaselineBySeq.set(seq, cloned);
            snapshotBaselineOrder.push(seq);
            while (snapshotBaselineOrder.length > 16) {
                var staleSeq = snapshotBaselineOrder.shift();
                snapshotBaselineBySeq.delete(staleSeq);
            }
            return cloned;
        }

        function getSnapshotBaseline(snapshotSeq) {
            return snapshotBaselineBySeq.get(Math.max(0, Math.floor(Number(snapshotSeq || 0)))) || null;
        }

        function clearSnapshotBaselines() {
            snapshotBaselineBySeq.clear();
            snapshotBaselineOrder.length = 0;
            return snapshotBaselineBySeq;
        }

        function queueRefs() {
            return {
                throwAckQueue: throwAckQueue,
                throwRejectQueue: throwRejectQueue,
                throwableEventQueue: throwableEventQueue,
                shotEffectQueue: shotEffectQueue,
                shotRejectQueue: shotRejectQueue,
                damageFeedbackQueue: damageFeedbackQueue,
                incomingDamageFeedbackQueue: incomingDamageFeedbackQueue
            };
        }

        return {
            reset: reset,
            getRoomId: function () { return state.roomId; },
            setRoomId: function (value) { state.roomId = String(value || initialRoomId); },
            getSelfId: function () { return state.selfId; },
            setSelfId: function (value) { state.selfId = String(value || ''); },
            getSelfState: function () { return state.selfState; },
            setSelfState: function (value) { state.selfState = value || null; },
            getMatchState: function () { return state.matchState; },
            setMatchState: function (value) { state.matchState = value || null; },
            getGameMode: function () { return state.gameMode; },
            setGameMode: function (value) { state.gameMode = String(value || ''); },
            getPrivateRoomPhase: function () { return state.privateRoomPhase; },
            setPrivateRoomPhase: function (value) { state.privateRoomPhase = String(value || ''); },
            getWorldMeta: function () { return state.worldMeta; },
            setWorldMeta: function (value) { state.worldMeta = value || null; },
            getWorldMismatchNotified: function () { return !!state.worldMismatchNotified; },
            setWorldMismatchNotified: function (value) { state.worldMismatchNotified = !!value; },
            getPendingSpawnSync: function () { return state.pendingSpawnSync; },
            setPendingSpawnSync: function (value) { state.pendingSpawnSync = value || null; },
            getPendingRespawnInfo: function () { return state.pendingRespawnInfo; },
            setPendingRespawnInfo: function (value) { state.pendingRespawnInfo = value || null; },
            getInitialSpawnApplied: function () { return !!state.initialSpawnApplied; },
            setInitialSpawnApplied: function (value) { state.initialSpawnApplied = !!value; },
            getPendingWeaponLoadout: function () { return state.pendingWeaponLoadout; },
            setPendingWeaponLoadout: function (value) { state.pendingWeaponLoadout = value || null; },
            getLastSentInputSample: function () { return state.lastSentInputSample || null; },
            setLastSentInputSample: function (value) { state.lastSentInputSample = value || null; },
            getLastSentPlayerPos: function () { return state.lastSentPlayerPos; },
            getAccumulatedPositionDriftWu: function () { return Number(state.accumulatedPositionDriftWu || 0); },
            getAccumulatedYawDriftRad: function () { return Number(state.accumulatedYawDriftRad || 0); },
            updateInputDriftTracking: updateInputDriftTracking,
            resetInputDriftTracking: resetInputDriftTracking,
            getSnapshotAckSeq: function () { return state.snapshotAckSeq; },
            setSnapshotAckSeq: setSnapshotAckSeq,
            getInputSeqHistory: function () { return state.inputSeqHistory; },
            setInputSeqHistory: function (value) { state.inputSeqHistory = Array.isArray(value) ? value : []; },
            getLocalPredictionSamples: function () { return state.localPredictionSamples; },
            pushLocalPredictionSample: pushLocalPredictionSample,
            clearLocalPredictionSamples: clearLocalPredictionSamples,
            getRemoteFrameQueue: function () { return remoteFrameQueue; },
            enqueueRemoteFrame: enqueueRemoteFrame,
            peekRemoteFrame: peekRemoteFrame,
            shiftRemoteFrame: shiftRemoteFrame,
            clearRemoteFrameQueue: clearRemoteFrameQueue,
            getLastInputSeqSent: function () { return state.lastInputSeqSent; },
            setLastInputSeqSent: function (value) { state.lastInputSeqSent = Number(value || 0); },
            getLastInputSeqAcked: function () { return state.lastInputSeqAcked; },
            ackInputSeq: ackInputSeq,
            nextInputSeq: nextInputSeq,
            getInputSendTimer: function () { return state.inputSendTimer; },
            setInputSendTimer: function (value) { state.inputSendTimer = Number(value || 0); },
            getInputSendInterval: function () { return state.inputSendInterval; },
            setInputSendInterval: function (value) {
                var next = Number(value || 0);
                if (!isFinite(next) || next <= 0) return state.inputSendInterval;
                state.inputSendInterval = next;
                return state.inputSendInterval;
            },
            getRemoteProjectileState: function () { return state.remoteProjectileState; },
            setRemoteProjectileState: setRemoteProjectileState,
            getRemoteFireZoneState: function () { return state.remoteFireZoneState; },
            setRemoteFireZoneState: setRemoteFireZoneState,
            getSnapshotMap: function () { return snapshotMap; },
            clearSnapshotMap: function () { snapshotMap.clear(); },
            setSnapshotEntity: function (id, entity) { snapshotMap.set(id, entity); },
            deleteSnapshotEntity: function (id) { snapshotMap.delete(id); },
            replaceSnapshotMap: function (nextMap) { snapshotMap = nextMap instanceof Map ? nextMap : new Map(); },
            rememberSnapshotBaseline: rememberSnapshotBaseline,
            getSnapshotBaseline: getSnapshotBaseline,
            clearSnapshotBaselines: clearSnapshotBaselines,
            recordRemoteSnapshotTiming: recordRemoteSnapshotTiming,
            getRemoteSnapshotTiming: function () {
                return {
                    latestSnapshotSeq: Number(remoteSnapshotTiming.latestSnapshotSeq || 0),
                    latestServerTime: Number(remoteSnapshotTiming.latestServerTime || 0),
                    latestReceivedAt: Number(remoteSnapshotTiming.latestReceivedAt || 0),
                    clockOffsetMs: Number(remoteSnapshotTiming.clockOffsetMs || 0),
                    clockSampleCount: Number(remoteSnapshotTiming.clockSampleCount || 0),
                    cadenceMs: Number(remoteSnapshotTiming.cadenceMs || 0)
                };
            },
            recordRemoteSnapshotEntity: recordRemoteSnapshotEntity,
            getRemoteSnapshotTimeline: function (entityId) {
                var history = remoteSnapshotTimelineMap.get(String(entityId || ''));
                return Array.isArray(history) ? history : [];
            },
            pruneRemoteSnapshotTimelines: pruneRemoteSnapshotTimelines,
            pushNotice: pushNotice,
            consumeNotice: consumeNotice,
            getQueueRefs: queueRefs,
            getThrowAckQueue: function () { return throwAckQueue; },
            getThrowRejectQueue: function () { return throwRejectQueue; },
            getThrowableEventQueue: function () { return throwableEventQueue; },
            getShotEffectQueue: function () { return shotEffectQueue; },
            getShotRejectQueue: function () { return shotRejectQueue; },
            getDamageFeedbackQueue: function () { return damageFeedbackQueue; },
            getIncomingDamageFeedbackQueue: function () { return incomingDamageFeedbackQueue; }
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetRuntimeState = {
        create: create
    };
})();
