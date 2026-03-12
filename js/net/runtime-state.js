/**
 * runtime-state.js - Mutable authoritative runtime state for the Mayhem net lane.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetRuntimeState
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};
        var initialInputSendInterval = Number(opts.inputSendInterval || (1 / 30));
        var initialRoomId = String(opts.initialRoomId || 'global');

        var snapshotMap = new Map();
        var remoteSnapshotTimelineMap = new Map();
        var throwAckQueue = [];
        var throwRejectQueue = [];
        var throwableEventQueue = [];
        var abilityEventQueue = [];
        var classCastResultQueue = [];
        var damageFeedbackQueue = [];
        var incomingDamageFeedbackQueue = [];
        var notices = [];
        var remoteSnapshotTiming = {
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
            state.inputSeq = 1;
            state.lastInputSeqSent = 0;
            state.lastInputSeqAcked = 0;
            state.inputSeqHistory = [];
            state.localPredictionSamples = [];
            state.inputSendTimer = 0;
            state.remoteProjectileState = [];
            state.remoteFireZoneState = [];
            snapshotMap.clear();
            remoteSnapshotTimelineMap.clear();
            throwAckQueue.length = 0;
            throwRejectQueue.length = 0;
            throwableEventQueue.length = 0;
            abilityEventQueue.length = 0;
            classCastResultQueue.length = 0;
            damageFeedbackQueue.length = 0;
            incomingDamageFeedbackQueue.length = 0;
            notices.length = 0;
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

        function ackInputSeq(seq) {
            var nextAck = Math.floor(Number(seq || 0));
            if (!isFinite(nextAck)) return state.lastInputSeqAcked;
            state.lastInputSeqAcked = Math.max(state.lastInputSeqAcked, nextAck);
            if (state.inputSeqHistory.length > 0) {
                state.inputSeqHistory = state.inputSeqHistory.filter(function (entry) {
                    return entry && Number(entry.seq || 0) > state.lastInputSeqAcked;
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

        function recordRemoteSnapshotTiming(serverTime, receivedAt) {
            var nextServerTime = Math.max(0, Math.round(Number(serverTime || 0)));
            var nextReceivedAt = Math.max(0, Math.round(Number(receivedAt || Date.now())));
            if (!(nextServerTime > 0)) return remoteSnapshotTiming.latestServerTime;
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
                movingForward: !!entity.movingForward,
                movingBackward: !!entity.movingBackward,
                isGrounded: entity.isGrounded !== false,
                velocityY: normalizeRemoteSnapshotNumber(entity.velocityY, 0),
                weaponId: String(entity.weaponId || 'rifle')
            };
            var history = remoteSnapshotTimelineMap.get(id);
            if (!Array.isArray(history)) {
                history = [];
                remoteSnapshotTimelineMap.set(id, history);
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

        function queueRefs() {
            return {
                throwAckQueue: throwAckQueue,
                throwRejectQueue: throwRejectQueue,
                throwableEventQueue: throwableEventQueue,
                abilityEventQueue: abilityEventQueue,
                classCastResultQueue: classCastResultQueue,
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
            getInputSeqHistory: function () { return state.inputSeqHistory; },
            setInputSeqHistory: function (value) { state.inputSeqHistory = Array.isArray(value) ? value : []; },
            getLocalPredictionSamples: function () { return state.localPredictionSamples; },
            pushLocalPredictionSample: pushLocalPredictionSample,
            clearLocalPredictionSamples: clearLocalPredictionSamples,
            getLastInputSeqSent: function () { return state.lastInputSeqSent; },
            setLastInputSeqSent: function (value) { state.lastInputSeqSent = Number(value || 0); },
            getLastInputSeqAcked: function () { return state.lastInputSeqAcked; },
            ackInputSeq: ackInputSeq,
            nextInputSeq: nextInputSeq,
            getInputSendTimer: function () { return state.inputSendTimer; },
            setInputSendTimer: function (value) { state.inputSendTimer = Number(value || 0); },
            getInputSendInterval: function () { return state.inputSendInterval; },
            getRemoteProjectileState: function () { return state.remoteProjectileState; },
            setRemoteProjectileState: setRemoteProjectileState,
            getRemoteFireZoneState: function () { return state.remoteFireZoneState; },
            setRemoteFireZoneState: setRemoteFireZoneState,
            getSnapshotMap: function () { return snapshotMap; },
            clearSnapshotMap: function () { snapshotMap.clear(); },
            setSnapshotEntity: function (id, entity) { snapshotMap.set(id, entity); },
            deleteSnapshotEntity: function (id) { snapshotMap.delete(id); },
            replaceSnapshotMap: function (nextMap) { snapshotMap = nextMap instanceof Map ? nextMap : new Map(); },
            recordRemoteSnapshotTiming: recordRemoteSnapshotTiming,
            getRemoteSnapshotTiming: function () {
                return {
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
            getAbilityEventQueue: function () { return abilityEventQueue; },
            getClassCastResultQueue: function () { return classCastResultQueue; },
            getDamageFeedbackQueue: function () { return damageFeedbackQueue; },
            getIncomingDamageFeedbackQueue: function () { return incomingDamageFeedbackQueue; }
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetRuntimeState = {
        create: create
    };
})();
