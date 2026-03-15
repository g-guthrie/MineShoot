/**
 * network.js - Global room websocket + remote entity rendering
 * Auth logic lives in net/auth.js (GameNetAuth); thin wrappers kept for backward compat.
 * Remote entity visuals/hitboxes live in net/remote-entities.js (GameNetEntities).
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNet
 */
(function () {
    'use strict';

    var GameNet = {};
    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    var PROTOCOL = runtime.GameShared.protocol;
    var MSG = PROTOCOL.msg;
    var MSG_C2S = MSG.c2s;
    var MSG_S2C = MSG.s2c;

    var WS_URL = PROTOCOL.wsPath;

    var GameNetAuth = runtime.GameNetAuth;
    var GameNetEntities = runtime.GameNetEntities;
    var commandFactory = runtime.GameNetCommands;
    if (!commandFactory || !commandFactory.create) {
        throw new Error('GameNetCommands is required before GameNet initialization.');
    }
    var runtimeAccessFactory = runtime.GameNetRuntimeAccess;
    if (!runtimeAccessFactory || !runtimeAccessFactory.create) {
        throw new Error('GameNetRuntimeAccess is required before GameNet initialization.');
    }
    var runtimeAccess = runtimeAccessFactory.create();
    var netStateFactory = runtime.GameNetRuntimeState;
    if (!netStateFactory || !netStateFactory.create) {
        throw new Error('GameNetRuntimeState is required before GameNet initialization.');
    }

    var active = false;
    var connected = false;
    var ws = null;
    var reconnectTimer = null;
    var transport = null;
    var sceneRef = null;
    var connectAttemptSeq = 0;

    var DEFAULT_INPUT_SEND_INTERVAL = 1 / 60;
    var netState = netStateFactory.create({
        initialRoomId: 'global',
        inputSendInterval: DEFAULT_INPUT_SEND_INTERVAL
    });
    var queues = netState.getQueueRefs();
    var snapshotHelper = null;
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
    var rttJitterMs = 0;
    var lastPongAt = 0;
    var pingSendTimer = 0.5;

    var cloneWorldFlags = PROTOCOL.cloneWorldFlags;
    var sanitizeRoomId = PROTOCOL.sanitizeRoomId;
    var joinAttempt = null;

    function clearJoinAttemptTimer(attempt) {
        var current = attempt || joinAttempt;
        if (!current || !current.timer) return;
        clearTimeout(current.timer);
        current.timer = null;
    }

    function resetJoinAttempt() {
        clearJoinAttemptTimer(joinAttempt);
        joinAttempt = null;
    }

    function failJoin(reason) {
        if (!joinAttempt) return false;
        var current = joinAttempt;
        joinAttempt = null;
        clearJoinAttemptTimer(current);
        if (typeof current.reject === 'function') {
            current.reject(new Error(String(reason || 'Room join failed.')));
        }
        return true;
    }

    function maybeResolveJoinAttempt() {
        if (!joinAttempt || !joinAttempt.welcomeReceived || !joinAttempt.selfSnapshotReceived) return false;
        var current = joinAttempt;
        joinAttempt = null;
        clearJoinAttemptTimer(current);
        if (typeof current.resolve === 'function') {
            current.resolve({
                roomId: current.expectedRoomId,
                selfId: current.selfId || netState.getSelfId() || ''
            });
        }
        return true;
    }

    function markJoinConnectStart() {
        if (!joinAttempt || joinAttempt.timer) return;
        joinAttempt.timer = setTimeout(function () {
            failJoin('Timed out joining room ' + String(joinAttempt && joinAttempt.expectedRoomId || netState.getRoomId() || '').toUpperCase() + '.');
        }, Math.max(1, Number(joinAttempt.timeoutMs || 5000)));
    }

    function resolveJoinOnWelcome(data) {
        if (!joinAttempt) return false;
        var actualRoomId = sanitizeRoomId(data && data.roomId || netState.getRoomId() || 'global');
        if (actualRoomId !== joinAttempt.expectedRoomId) {
            failJoin(
                'Joined unexpected room ' + actualRoomId.toUpperCase() +
                ' while expecting ' + joinAttempt.expectedRoomId.toUpperCase() + '.'
            );
            return false;
        }
        joinAttempt.welcomeReceived = true;
        joinAttempt.selfId = String(data && data.selfId || netState.getSelfId() || '');
        return maybeResolveJoinAttempt();
    }

    function resolveJoinOnSelfSnapshot(entityId) {
        if (!joinAttempt) return false;
        var expectedSelfId = String(joinAttempt.selfId || netState.getSelfId() || '');
        if (expectedSelfId && String(entityId || '') !== expectedSelfId) return false;
        joinAttempt.selfSnapshotReceived = true;
        return maybeResolveJoinAttempt();
    }

    function buildExpectedWorldMeta(roomName) {
        return PROTOCOL.buildExpectedWorldMeta(roomName || netState.getRoomId() || 'global', PROTOCOL.world);
    }

    function classStats(classId) {
        return GameNetEntities.classStats(classId);
    }

    function pushNotice(text) {
        netState.pushNotice(text);
    }

    function consumeNotice() {
        return netState.consumeNotice();
    }

    function wsEndpoint() {
        return runtimeAccess.buildWsEndpoint({
            wsPath: WS_URL,
            roomId: netState.getRoomId(),
            authApi: GameNetAuth
        });
    }

    function gameplayNetworkTuning() {
        var shared = runtime.GameShared || {};
        var tuning = shared.gameplayTuning && shared.gameplayTuning.network
            ? shared.gameplayTuning.network
            : null;
        return tuning || {};
    }

    function pingCadenceMs() {
        var ping = gameplayNetworkTuning().ping || {};
        var raw = Number(ping.cadenceMs || 500);
        if (!isFinite(raw) || raw <= 0) return 500;
        return Math.max(100, raw);
    }

    function resetConnectionTimingState() {
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
        rttJitterMs = 0;
        lastPongAt = 0;
        pingSendTimer = pingCadenceMs() / 1000;
    }

    function readSelfSnapshotSeq(entity) {
        var raw = Number(entity && entity.seq);
        if (!isFinite(raw)) return 0;
        return Math.max(0, Math.floor(raw));
    }

    function readSnapshotServerTime(snapshotMeta) {
        var serverTime = Number(snapshotMeta && snapshotMeta.serverTime || 0);
        return isFinite(serverTime) && serverTime > 0 ? serverTime : 0;
    }

    function shouldAcceptSelfSnapshot(entity, snapshotMeta) {
        var seq = readSelfSnapshotSeq(entity);
        var serverTime = readSnapshotServerTime(snapshotMeta);
        if (seq > 0 && lastAppliedSelfSeq > 0) {
            if (seq < lastAppliedSelfSeq) return false;
            if (seq === lastAppliedSelfSeq) {
                return serverTime > lastAppliedSelfServerTime;
            }
            return true;
        }
        if (lastAppliedSelfSeq > 0 && serverTime > 0 && serverTime <= lastAppliedSelfServerTime) {
            return false;
        }
        return true;
    }

    function updatePongTiming(msg, receivedAt) {
        var stamp = Math.max(0, Number(receivedAt || Date.now()));
        var clientTime = Number(msg && msg.clientTime || 0);
        if (!isFinite(clientTime) || clientTime <= 0) return false;
        var rttSample = Math.max(0, stamp - clientTime);
        var pingTuning = gameplayNetworkTuning().ping || {};
        var rttAlpha = Number(pingTuning.rttAlpha || 0.15);
        var jitterAlpha = Number(pingTuning.jitterAlpha || 0.2);
        if (!isFinite(estimatedRttMs)) {
            estimatedRttMs = rttSample;
            rttJitterMs = 0;
        } else {
            var jitterSample = Math.abs(rttSample - estimatedRttMs);
            estimatedRttMs += (rttSample - estimatedRttMs) * Math.max(0.01, Math.min(1, rttAlpha));
            rttJitterMs += (jitterSample - rttJitterMs) * Math.max(0.01, Math.min(1, jitterAlpha));
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
        if (connected && isFinite(serverTimeOffsetMs)) {
            return Math.max(0, Date.now() - serverTimeOffsetMs);
        }
        return Date.now();
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
            rttJitterMs: Math.max(0, Number(rttJitterMs || 0)),
            lastPongAt: Math.max(0, Number(lastPongAt || 0)),
            pingCadenceMs: pingCadenceMs()
        };
    }

    function updateRemoteFromSnapshot(entity, snapshotMeta) {
        if (!sceneRef) return;
        if (entity.id === netState.getSelfId()) {
            if (!shouldAcceptSelfSnapshot(entity, snapshotMeta)) return;
            netState.setSelfState(entity);
            resolveJoinOnSelfSnapshot(entity.id);
            var ackSeq = readSelfSnapshotSeq(entity);
            var acceptedServerTime = readSnapshotServerTime(snapshotMeta);
            if (ackSeq > 0) {
                lastAppliedSelfSeq = Math.max(lastAppliedSelfSeq, ackSeq);
                netState.ackInputSeq(ackSeq);
                lastAcceptedSelfAckAt = Math.max(0, Number(snapshotMeta && snapshotMeta.receivedAt || Date.now()));
            }
            if (acceptedServerTime > 0) {
                lastAppliedSelfServerTime = Math.max(lastAppliedSelfServerTime, acceptedServerTime);
            }
            if (!netState.getInitialSpawnApplied() && entity && typeof entity.x === 'number' && typeof entity.z === 'number') {
                netState.setPendingSpawnSync({
                    x: Number(entity.x || 0),
                    z: Number(entity.z || 0),
                    executeAt: Date.now(),
                    kind: 'initial'
                });
            }
            return;
        }
        if (netState.recordRemoteSnapshotEntity) {
            netState.recordRemoteSnapshotEntity(entity.id, entity, snapshotMeta && snapshotMeta.serverTime);
        }
        GameNetEntities.updateFromSnapshot(entity, snapshotMeta);
    }

    function applyPendingSpawnSync() {
        var pendingSpawnSync = netState.getPendingSpawnSync();
        if (!pendingSpawnSync) return;
        if (Date.now() < Number(pendingSpawnSync.executeAt || 0)) return;
        var playerApi = runtimeAccess.getPlayerApi();
        if (!playerApi || !playerApi.respawn) return;
        playerApi.respawn(
            Number(pendingSpawnSync.x || 0),
            Number(pendingSpawnSync.z || 0)
        );
        var playerCombatApi = runtimeAccess.getPlayerCombatApi();
        if (playerCombatApi && playerCombatApi.setInvulnTimer) {
            playerCombatApi.setInvulnTimer(pendingSpawnSync.kind === 'respawn' ? 1.0 : 0.6);
        }
        if (pendingSpawnSync.kind === 'initial') {
            netState.setInitialSpawnApplied(true);
        }
        netState.setPendingSpawnSync(null);
    }

    function updateSnapshotTiming(opts) {
        var serverTime = Number(opts && opts.serverTime || 0);
        var receivedAt = Number(opts && opts.receivedAt || Date.now());
        if (!isFinite(serverTime) || serverTime <= 0) return false;
        if (!isFinite(receivedAt) || receivedAt <= 0) receivedAt = Date.now();
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
        if (!isFinite(serverTimeOffsetMs) || Math.abs(measuredOffsetMs - serverTimeOffsetMs) > 120) {
            serverTimeOffsetMs = measuredOffsetMs;
        } else {
            serverTimeOffsetMs += (measuredOffsetMs - serverTimeOffsetMs) * 0.12;
        }
        return true;
    }

    function applySnapshot(entities, projectiles, fireZones, opts) {
        opts = opts || {};
        updateSnapshotTiming(opts);
        if (netState.recordRemoteSnapshotTiming) {
            netState.recordRemoteSnapshotTiming(opts.serverTime, opts.receivedAt);
        }
        if (snapshotHelper && snapshotHelper.applySnapshot) {
            snapshotHelper.applySnapshot(entities, projectiles, fireZones, opts);
            return;
        }
        if (!Array.isArray(entities)) return;

        var renderMap = GameNetEntities.getRenderMap();
        if (!opts.delta) {
            netState.clearSnapshotMap();
        }
        for (var i = 0; i < entities.length; i++) {
            var e = entities[i];
            netState.setSnapshotEntity(e.id, e);
            updateRemoteFromSnapshot(e, opts);
        }
        var removedIds = Array.isArray(opts.removedEntityIds) ? opts.removedEntityIds : [];
        for (i = 0; i < removedIds.length; i++) {
            netState.deleteSnapshotEntity(removedIds[i]);
            GameNetEntities.removeRemoteVisual(removedIds[i]);
        }

        var toRemove = [];
        renderMap.forEach(function (_v, id) {
            if (!netState.getSnapshotMap().has(id)) toRemove.push(id);
        });
        for (i = 0; i < toRemove.length; i++) {
            GameNetEntities.removeRemoteVisual(toRemove[i]);
        }
        if (netState.pruneRemoteSnapshotTimelines) {
            netState.pruneRemoteSnapshotTimelines(netState.getSnapshotMap());
        }

        if (projectiles !== undefined) {
            netState.setRemoteProjectileState(projectiles);
        }
        if (fireZones !== undefined) {
            netState.setRemoteFireZoneState(fireZones);
        }
    }

    function initSnapshotHelper() {
        if (!runtime.GameNetSnapshots || !runtime.GameNetSnapshots.create) {
            snapshotHelper = null;
            return;
        }
        snapshotHelper = runtime.GameNetSnapshots.create({
            onEntity: function (entity, snapshotMeta) {
                updateRemoteFromSnapshot(entity, snapshotMeta);
            },
            onPrune: function (nextMap) {
                netState.replaceSnapshotMap(nextMap);
                var renderMap = GameNetEntities.getRenderMap();
                var toRemove = [];
                renderMap.forEach(function (_v, id) {
                    if (!netState.getSnapshotMap().has(id)) toRemove.push(id);
                });
                for (var i = 0; i < toRemove.length; i++) {
                    GameNetEntities.removeRemoteVisual(toRemove[i]);
                }
                if (netState.pruneRemoteSnapshotTimelines) {
                    netState.pruneRemoteSnapshotTimelines(nextMap);
                }
            },
            onProjectiles: function (projectiles) {
                netState.setRemoteProjectileState(projectiles);
            },
            onFireZones: function (fireZones) {
                netState.setRemoteFireZoneState(fireZones);
            }
        });
    }

    function damagePointForEntityId(entityId) {
        if (!entityId) return null;

        if (entityId === netState.getSelfId()) {
            var playerApi = runtimeAccess.getPlayerApi();
            var selfPos = playerApi && playerApi.getPosition ? playerApi.getPosition() : null;
            if (!selfPos) return null;
            return {
                x: selfPos.x,
                y: runtimeAccess.damagePointY(selfPos.y),
                z: selfPos.z
            };
        }

        var render = GameNetEntities.getRenderMap().get(entityId);
        if (!render || !render.group) return null;
        return {
            x: render.group.position.x,
            y: runtimeAccess.damagePointY(render.group.position.y),
            z: render.group.position.z
        };
    }

    function markerPointForEntityId(entityId) {
        if (!entityId) return null;

        if (entityId === netState.getSelfId()) {
            var playerApi = runtimeAccess.getPlayerApi();
            var selfPos = playerApi && playerApi.getPosition ? playerApi.getPosition() : null;
            if (!selfPos) return null;
            return {
                x: selfPos.x,
                y: runtimeAccess.markerPointY(selfPos.y),
                z: selfPos.z
            };
        }

        var render = GameNetEntities.getRenderMap().get(entityId);
        if (!render || !render.group) return null;
        return {
            x: render.group.position.x,
            y: runtimeAccess.markerPointY(render.group.position.y),
            z: render.group.position.z
        };
    }

    function flushPendingWeaponLoadout() {
        var pending = netState.getPendingWeaponLoadout();
        if (!pending) return false;
        if (!wsSend({
            t: MSG_C2S.WEAPON_LOADOUT,
            slot1: pending.slot1,
            slot2: pending.slot2
        })) return false;
        netState.setPendingWeaponLoadout(null);
        return true;
    }

    function clearRemoteWorldState() {
        netState.clearSnapshotMap();
        if (netState.pruneRemoteSnapshotTimelines) {
            netState.pruneRemoteSnapshotTimelines(new Map());
        }
        netState.setRemoteProjectileState([]);
        netState.setRemoteFireZoneState([]);
        GameNetEntities.cleanup();
    }

    function getRenderCoreWorldPosition(render, outVec3) {
        if (!render) return null;
        var out = outVec3 || new THREE.Vector3();
        if (render.actorVisual && render.actorVisual.getCoreWorldPosition) {
            return render.actorVisual.getCoreWorldPosition(out);
        }
        out.copy(render.group.position);
        out.y += 1.0;
        return out;
    }

    function getChokeVictimStateForEntity(entityId) {
        var abilityFxView = runtimeAccess.getAbilityFxApi();
        var emptyState = abilityFxView && abilityFxView.emptyChokeVictimState
            ? abilityFxView.emptyChokeVictimState()
            : { lift: 0, liftHeight: 0, startedAt: 0, endsAt: 0 };
        function withLocalTimestamps(state) {
            if (!state) return emptyState;
            return {
                lift: Number(state.lift || 0),
                liftHeight: Number(state.liftHeight || 0),
                startedAt: toLocalClockTime(state.startedAt),
                endsAt: toLocalClockTime(state.endsAt)
            };
        }
        if (!entityId) return emptyState;
        var now = authoritativeNowMs();
        var selfState = netState.getSelfState();
        var selfFx = abilityFxView && abilityFxView.readAbilityFx
            ? abilityFxView.readAbilityFx(selfState)
            : (selfState && selfState.abilityFx ? selfState.abilityFx : null);
        var selfChokeVictim = selfFx && selfFx.chokeVictim ? selfFx.chokeVictim : null;
        if (selfState && selfState.id === entityId && selfChokeVictim && selfChokeVictim.endsAt > now) {
            return abilityFxView && abilityFxView.toChokeVictimVisualState
                ? withLocalTimestamps(abilityFxView.toChokeVictimVisualState(selfChokeVictim, now))
                : emptyState;
        }
        var render = GameNetEntities.getRenderMap().get(entityId);
        if (render && render.chokeVictimState && render.chokeVictimState.endsAt > now) {
            return abilityFxView && abilityFxView.toChokeVictimVisualState
                ? withLocalTimestamps(abilityFxView.toChokeVictimVisualState(render.chokeVictimState, now))
                : emptyState;
        }
        return emptyState;
    }

    var messageRouter = runtime.GameNetMessageRouter.create({
        msgTypes: MSG_S2C,
        runtime: runtime,
        sanitizeRoomId: sanitizeRoomId,
        buildExpectedWorldMeta: buildExpectedWorldMeta,
        cloneWorldFlags: cloneWorldFlags,
        applySnapshot: applySnapshot,
        pushNotice: pushNotice,
        flushPendingWeaponLoadout: flushPendingWeaponLoadout,
        resolveJoinOnWelcome: resolveJoinOnWelcome,
        damagePointForEntityId: damagePointForEntityId,
        getRenderMap: function () { return GameNetEntities.getRenderMap(); },
        getSelfId: netState.getSelfId,
        setSelfId: netState.setSelfId,
        getRoomId: netState.getRoomId,
        setRoomId: netState.setRoomId,
        getGameMode: netState.getGameMode,
        setGameMode: netState.setGameMode,
        getPrivateRoomPhase: netState.getPrivateRoomPhase,
        setPrivateRoomPhase: netState.setPrivateRoomPhase,
        getMatchState: netState.getMatchState,
        setMatchState: netState.setMatchState,
        setInputSendInterval: function (value) {
            var next = Number(value || 0);
            if (!isFinite(next) || next <= 0) return;
            netState.setInputSendInterval(Math.max(1 / 90, Math.min(0.1, next)));
        },
        getSelfState: netState.getSelfState,
        setConnected: function (value) { connected = !!value; },
        setPendingRespawnInfo: netState.setPendingRespawnInfo,
        setPendingSpawnSync: netState.setPendingSpawnSync,
        setWorldMeta: netState.setWorldMeta,
        getWorldMismatchNotified: netState.getWorldMismatchNotified,
        setWorldMismatchNotified: netState.setWorldMismatchNotified,
        getActiveWorldMeta: runtimeAccess.getActiveWorldMeta,
        handlePong: updatePongTiming,
        throwAckQueue: queues.throwAckQueue,
        throwRejectQueue: queues.throwRejectQueue,
        throwableEventQueue: queues.throwableEventQueue,
        abilityEventQueue: queues.abilityEventQueue,
        classCastResultQueue: queues.classCastResultQueue,
        damageFeedbackQueue: queues.damageFeedbackQueue,
        incomingDamageFeedbackQueue: queues.incomingDamageFeedbackQueue
    });

    function handleMessage(raw) {
        messageRouter.handleMessage(raw);
    }

    var stateView = runtime.GameNetStateView.create({
        buildExpectedWorldMeta: buildExpectedWorldMeta,
        cloneWorldFlags: cloneWorldFlags,
        classStats: classStats,
        getRoomId: netState.getRoomId,
        getWorldMeta: netState.getWorldMeta,
        getRenderMap: function () { return GameNetEntities.getRenderMap(); },
        getSelfState: netState.getSelfState,
        getSelfId: netState.getSelfId,
        getMatchState: netState.getMatchState,
        getSnapshotMap: netState.getSnapshotMap,
        getInputSeqHistory: netState.getInputSeqHistory,
        getLastInputSeqSent: netState.getLastInputSeqSent,
        getLastInputSeqAcked: netState.getLastInputSeqAcked,
        getLastSentInputSample: netState.getLastSentInputSample,
        getInputSendTimer: netState.getInputSendTimer,
        getInputSendInterval: netState.getInputSendInterval,
        getPendingRespawnInfo: netState.getPendingRespawnInfo,
        getGameMode: netState.getGameMode,
        getPrivateRoomPhase: netState.getPrivateRoomPhase,
        getRemoteProjectileState: netState.getRemoteProjectileState,
        getRemoteFireZoneState: netState.getRemoteFireZoneState,
        getConnectionTimingState: connectionTimingState,
        getLastAcceptedSelfAckAt: function () { return lastAcceptedSelfAckAt; },
        getCurrentInputState: function () {
            var playerApi = runtimeAccess.getPlayerApi();
            return playerApi && playerApi.getNetworkInputState
                ? playerApi.getNetworkInputState()
                : null;
        },
        getCurrentRotation: function () {
            var playerApi = runtimeAccess.getPlayerApi();
            return playerApi && playerApi.getRotation
                ? playerApi.getRotation()
                : null;
        },
        getCurrentUser: function () { return runtimeAccess.getCurrentUser(GameNetAuth); },
        getRenderCoreWorldPosition: getRenderCoreWorldPosition,
        markerPointForEntityId: markerPointForEntityId,
        getChokeVictimStateForEntity: getChokeVictimStateForEntity,
        consumeNotice: consumeNotice,
        throwAckQueue: queues.throwAckQueue,
        throwRejectQueue: queues.throwRejectQueue,
        throwableEventQueue: queues.throwableEventQueue,
        abilityEventQueue: queues.abilityEventQueue,
        classCastResultQueue: queues.classCastResultQueue,
        damageFeedbackQueue: queues.damageFeedbackQueue,
        incomingDamageFeedbackQueue: queues.incomingDamageFeedbackQueue
    });

    var runtimeCore = runtime.GameNetRuntimeCore.create({
        isActive: function () { return active; },
        setConnected: function (value) { connected = !!value; },
        getSocketIdentity: function () { return runtimeAccess.getSocketIdentity(GameNetAuth); },
        nextConnectAttemptSeq: function () {
            connectAttemptSeq += 1;
            return connectAttemptSeq;
        },
        getConnectAttemptSeq: function () { return connectAttemptSeq; },
        getTransportApi: runtimeAccess.getTransportApi,
        getTransport: function () { return transport; },
        setTransport: function (value) { transport = value; },
        getReconnectTimer: function () { return reconnectTimer; },
        setReconnectTimer: function (value) { reconnectTimer = value; },
        getWs: function () { return ws; },
        setWs: function (value) { ws = value; },
        wsEndpoint: wsEndpoint,
        handleMessage: handleMessage,
        ensureArenaIdentity: function () {
            return GameNetAuth.ensureArenaIdentity ? GameNetAuth.ensureArenaIdentity() : null;
        },
        onTransportConnectStart: markJoinConnectStart,
        onTransportClose: function () {
            resetConnectionTimingState();
            clearRemoteWorldState();
            if (joinAttempt) failJoin('Disconnected while joining room ' + joinAttempt.expectedRoomId.toUpperCase() + '.');
        },
        onTransportError: function () {
            resetConnectionTimingState();
            clearRemoteWorldState();
            if (joinAttempt) failJoin('WebSocket error while joining room ' + joinAttempt.expectedRoomId.toUpperCase() + '.');
        },
        getPendingRespawnInfo: netState.getPendingRespawnInfo,
        setPendingRespawnInfo: netState.setPendingRespawnInfo,
        applyPendingSpawnSync: applyPendingSpawnSync,
        isConnected: function () { return connected; },
        getInputSendTimer: netState.getInputSendTimer,
        setInputSendTimer: netState.setInputSendTimer,
        getInputSendInterval: netState.getInputSendInterval,
        setLastSentInputSample: netState.setLastSentInputSample,
        getPingSendTimer: function () { return pingSendTimer; },
        setPingSendTimer: function (value) { pingSendTimer = Math.max(0, Number(value || 0)); },
        getPingCadenceSeconds: function () { return pingCadenceMs() / 1000; },
        getPingMessageType: function () { return MSG_C2S.PING || 'ping'; },
        getPlayerApi: runtimeAccess.getPlayerApi,
        nextInputSeq: netState.nextInputSeq,
        getInputSeqHistory: netState.getInputSeqHistory,
        setLastInputSeqSent: netState.setLastInputSeqSent,
        getInputMessageType: function () { return MSG_C2S.INPUT; },
        getRemoteSyncApi: runtimeAccess.getRemoteSyncApi,
        getRenderMap: function () { return GameNetEntities.getRenderMap(); },
        getChokeVictimStateForEntity: getChokeVictimStateForEntity
    });

    function clearReconnectTimer() {
        runtimeCore.clearReconnectTimer();
    }

    function connectWs() {
        runtimeCore.connectWs();
    }

    function wsSend(msg) {
        return runtimeCore.wsSend(msg);
    }

    var commandsApi = commandFactory.create({
        wsSend: wsSend,
        buildFirePayload: runtimeAccess.buildFirePayload,
        fireMessageType: MSG_C2S.FIRE,
        equipWeaponMessageType: MSG_C2S.EQUIP_WEAPON,
        normalizeWeaponLoadoutPayload: PROTOCOL.normalizeWeaponLoadoutPayload,
        normalizeThrowPayload: PROTOCOL.normalizeThrowPayload,
        normalizeAbilityLoadoutPayload: PROTOCOL.normalizeAbilityLoadoutPayload,
        normalizeClassCastPayload: PROTOCOL.normalizeClassCastPayload,
        setPendingWeaponLoadout: netState.setPendingWeaponLoadout,
        flushPendingWeaponLoadout: flushPendingWeaponLoadout
    });

    GameNet.setRoomId = function (nextRoomId) {
        var nextId = sanitizeRoomId(nextRoomId);
        netState.setRoomId(nextId);
        netState.setWorldMeta(null);
        netState.setWorldMismatchNotified(false);
        netState.setInputSendInterval(DEFAULT_INPUT_SEND_INTERVAL);
        resetConnectionTimingState();
        return nextId;
    };

    GameNet.getRoomId = function () {
        return netState.getRoomId();
    };

    GameNet.beginJoinAttempt = function (opts) {
        opts = opts || {};
        resetJoinAttempt();
        return new Promise(function (resolve, reject) {
            joinAttempt = {
                expectedRoomId: sanitizeRoomId(opts.expectedRoomId || netState.getRoomId() || 'global'),
                timeoutMs: Math.max(1, Number(opts.timeoutMs || 5000)),
                welcomeReceived: false,
                selfSnapshotReceived: false,
                selfId: '',
                timer: null,
                resolve: resolve,
                reject: reject
            };
        });
    };

    GameNet.failJoin = failJoin;
    GameNet.resetJoinAttempt = resetJoinAttempt;

    GameNet.init = function (scene) {
        sceneRef = scene;
        active = true;
        GameNetEntities.init(scene);
        initSnapshotHelper();
        connectWs();
    };

    GameNet.shutdown = function () {
        if (connected) {
            wsSend({ t: MSG_C2S.LEAVE_ROOM });
        }
        active = false;
        failJoin('Disconnected while joining room.');
        resetJoinAttempt();
        runtimeCore.shutdownConnection();

        GameNetEntities.cleanup();

        snapshotHelper = null;
        netState.reset();
        resetConnectionTimingState();
        joinAttempt = null;
    };

    GameNet.isActive = function () {
        return !!active;
    };

    GameNet.isConnected = function () {
        return !!connected;
    };

    GameNet.getHitboxArray = function () {
        return GameNetEntities.getHitboxArray();
    };

    GameNet.setHitboxVisibility = function (visible) {
        GameNetEntities.setHitboxVisibility(visible);
    };

    GameNet.getEntityStateList = stateView.getEntityStateList;
    GameNet.getAuthoritativeSelfState = stateView.getAuthoritativeSelfState;
    GameNet.getSelfState = stateView.getSelfState;
    GameNet.getSelfReconciliationState = stateView.getSelfReconciliationState;

    GameNet.update = runtimeCore.update;

    GameNet.sendFire = commandsApi.sendFire;
    GameNet.sendEquipWeapon = commandsApi.sendEquipWeapon;
    GameNet.sendWeaponLoadout = commandsApi.sendWeaponLoadout;
    GameNet.sendThrow = commandsApi.sendThrow;

    GameNet.consumeThrowAck = stateView.consumeThrowAck;
    GameNet.consumeThrowReject = stateView.consumeThrowReject;
    GameNet.consumeThrowableEvent = stateView.consumeThrowableEvent;
    GameNet.consumeAbilityEvent = stateView.consumeAbilityEvent;
    GameNet.getAuthoritativeThrowableState = stateView.getAuthoritativeThrowableState;

    GameNet.sendAbilityLoadout = commandsApi.sendAbilityLoadout;
    GameNet.sendAbilityCast = commandsApi.sendAbilityCast;

    GameNet.consumeClassCastResult = stateView.consumeClassCastResult;
    GameNet.consumeDamageFeedback = stateView.consumeDamageFeedback;
    GameNet.consumeIncomingDamageFeedback = stateView.consumeIncomingDamageFeedback;
    GameNet.damagePointForEntityId = damagePointForEntityId;
    GameNet.getEntityMarkerWorldPos = stateView.getEntityMarkerWorldPos;
    GameNet.getChokeVictimStateForEntity = stateView.getChokeVictimStateForEntity;
    GameNet.getSelfAbilityState = stateView.getSelfAbilityState;
    GameNet.getMatchState = stateView.getMatchState;
    GameNet.getInputSyncState = stateView.getInputSyncState;
    GameNet.getPendingInputSamples = stateView.getPendingInputSamples;
    GameNet.getRespawnState = stateView.getRespawnState;
    GameNet.getGameMode = stateView.getGameMode;
    GameNet.getPrivateRoomPhase = stateView.getPrivateRoomPhase;
    GameNet.getExpectedWorldMeta = stateView.getExpectedWorldMeta;
    GameNet.getWorldMeta = stateView.getWorldMeta;
    GameNet.getEntityName = stateView.getEntityName;
    GameNet.getLockTargets = stateView.getLockTargets;
    GameNet.consumeNotice = stateView.consumeNotice;
    GameNet.getSnapshotTimingState = snapshotTimingState;
    GameNet.getConnectionTimingState = connectionTimingState;
    GameNet.getAuthoritativeNow = authoritativeNowMs;
    GameNet.getEstimatedServerTime = function () {
        if (!connected || !isFinite(serverTimeOffsetMs)) return 0;
        return Math.max(0, Date.now() - serverTimeOffsetMs);
    };
    GameNet.toLocalTime = toLocalClockTime;

    resetConnectionTimingState();
    runtime.GameNet = GameNet;
})();
