/**
 * network.js - Global room websocket + remote entity rendering
 * Auth logic lives in net/auth.js (GameNetAuth).
 * Remote entity visuals/hitboxes live in net/remote-entities.js (GameNetEntities).
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNet
 */
(function () {
    'use strict';
    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var assemblyDeps = runtime.GameNetAssemblyDeps || {};

    var sharedApi = assemblyDeps.GameShared || runtime.GameShared;
    var PROTOCOL = sharedApi.protocol;
    var MSG = PROTOCOL.msg;
    var MSG_C2S = MSG.c2s;
    var MSG_S2C = MSG.s2c;

    var WS_URL = PROTOCOL.wsPath;

    var GameNetAuth = assemblyDeps.GameNetAuth || runtime.GameNetAuth;
    var GameNetEntities = assemblyDeps.GameNetEntities || runtime.GameNetEntities;
    var commandFactory = assemblyDeps.GameNetCommands || runtime.GameNetCommands;
    if (!commandFactory || !commandFactory.create) {
        throw new Error('GameNetCommands is required before GameNet initialization.');
    }
    var joinStateFactory = assemblyDeps.GameNetJoinState || runtime.GameNetJoinState;
    if (!joinStateFactory || !joinStateFactory.create) {
        throw new Error('GameNetJoinState is required before GameNet initialization.');
    }
    var timingFactory = assemblyDeps.GameNetConnectionTiming || runtime.GameNetConnectionTiming;
    if (!timingFactory || !timingFactory.create) {
        throw new Error('GameNetConnectionTiming is required before GameNet initialization.');
    }
    var netStateFactory = assemblyDeps.GameNetRuntimeState || runtime.GameNetRuntimeState;
    if (!netStateFactory || !netStateFactory.create) {
        throw new Error('GameNetRuntimeState is required before GameNet initialization.');
    }
    var messageRouterFactory = assemblyDeps.GameNetMessageRouter || runtime.GameNetMessageRouter;
    var stateViewFactory = assemblyDeps.GameNetStateView || runtime.GameNetStateView;
    var runtimeCoreFactory = assemblyDeps.GameNetRuntimeCore || runtime.GameNetRuntimeCore;
    var snapshotsFactory = assemblyDeps.GameNetSnapshots || runtime.GameNetSnapshots;
    var effectsFactory = assemblyDeps.GameNetEffects || runtime.GameNetEffects;
    if (!messageRouterFactory || !messageRouterFactory.create) {
        throw new Error('GameNetMessageRouter is required before GameNet initialization.');
    }
    if (!stateViewFactory || !stateViewFactory.create) {
        throw new Error('GameNetStateView is required before GameNet initialization.');
    }
    if (!runtimeCoreFactory || !runtimeCoreFactory.create) {
        throw new Error('GameNetRuntimeCore is required before GameNet initialization.');
    }
    if (!effectsFactory || !effectsFactory.create) {
        throw new Error('GameNetEffects is required before GameNet initialization.');
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
    var remoteFrameCollector = null;

    var cloneWorldFlags = PROTOCOL.cloneWorldFlags;
    var sanitizeRoomId = PROTOCOL.sanitizeRoomId;
    if (!runtime.GameNetConfig) {
        throw new Error('GameNetConfig is required before GameNet initialization.');
    }
    var configApi = runtime.GameNetConfig;
    var joinState = joinStateFactory.create({
        sanitizeRoomId: sanitizeRoomId,
        getRoomId: netState.getRoomId,
        getSelfId: netState.getSelfId
    });
    var connectionTiming = timingFactory.create({
        getPingTuning: gameplayNetworkTuning,
        getPingCadenceMs: pingCadenceMs,
        getIsConnected: function () { return connected; },
        getNowMs: function () { return Date.now(); }
    });
    if (!runtime.GameNetAccess || !runtime.GameNetAccess.create) {
        throw new Error('GameNetAccess is required before GameNet initialization.');
    }
    if (!runtime.GameNetFirePayload || !runtime.GameNetFirePayload.buildPayload) {
        throw new Error('GameNetFirePayload is required before GameNet initialization.');
    }
    if (!runtime.GameNetNetworkLoadout || !runtime.GameNetNetworkLoadout.create) {
        throw new Error('GameNetNetworkLoadout is required before GameNet initialization.');
    }
    if (!runtime.GameNetSnapshotBuffer) {
        throw new Error('GameNetSnapshotBuffer is required before GameNet initialization.');
    }
    if (!runtime.GameNetNetworkSnapshotApply) {
        throw new Error('GameNetNetworkSnapshotApply is required before GameNet initialization.');
    }

    var accessApi = runtime.GameNetAccess.create(runtime, assemblyDeps, {});
    var firePayloadApi = runtime.GameNetFirePayload;
    var loadoutHelper = runtime.GameNetNetworkLoadout.create({
        getNetState: function () { return netState; },
        getProtocol: function () { return PROTOCOL; },
        getConnectionTiming: function () { return connectionTiming; }
    });
    var snapshotBufferApi = runtime.GameNetSnapshotBuffer;
    var snapshotApplyApi = runtime.GameNetNetworkSnapshotApply;

    function runtimeProfileApi() {
        return accessApi.runtimeProfile();
    }

    function playerApi() {
        return accessApi.playerApi();
    }

    function playerCombatApi() {
        return accessApi.playerCombatApi();
    }

    function transportApi() {
        return accessApi.transportApi();
    }

    function remoteSyncApi() {
        return accessApi.remoteSyncApi();
    }

    function hitscanApi() {
        return accessApi.hitscanApi();
    }

    function socketIdentity() {
        return accessApi.socketIdentity();
    }

    function currentUser() {
        return accessApi.currentUser();
    }

    function activeWorldMeta() {
        return configApi.activeWorldMeta ? configApi.activeWorldMeta() : accessApi.activeWorldMeta();
    }

    function damagePointY(entityY) {
        return accessApi.damagePointY(entityY);
    }

    function markerPointY(entityY) {
        return accessApi.markerPointY(entityY);
    }

    function buildWsEndpoint() {
        return accessApi.buildWsEndpoint({
            roomId: netState.getRoomId,
            socketPlayerId: GameNetAuth && GameNetAuth.getSocketPlayerId ? GameNetAuth.getSocketPlayerId() : null,
            actorIdentity: GameNetAuth && GameNetAuth.getPartyIdentity ? GameNetAuth.getPartyIdentity() : null,
            socketIdentity: socketIdentity(),
            runtimeProfile: runtimeProfileApi(),
            wsPath: WS_URL
        });
    }

    function buildFirePayload(msgType, weaponId, shotToken) {
        var hitscan = hitscanApi();
        return firePayloadApi.buildPayload({
            msgType: msgType,
            weaponId: weaponId,
            shotToken: shotToken,
            fireIntent: hitscan && hitscan.buildNetworkFireIntent
                ? hitscan.buildNetworkFireIntent(shotToken)
                : null,
            player: playerApi(),
            sharedApi: sharedApi,
            connectionTiming: connectionTiming
        });
    }

    if (GameNetEntities && GameNetEntities.configure) {
        GameNetEntities.configure({
            getSharedApi: function () { return sharedApi; },
            getActorVisualFactory: function () { return runtime.GameActorVisualFactory || null; }
        });
    }

    function buildExpectedWorldMeta(roomName) {
        return configApi.buildExpectedWorldMeta(roomName || netState.getRoomId() || 'global');
    }

    function classStats(classId) {
        return configApi.classStats(classId);
    }

    function pushNotice(text) {
        loadoutHelper.pushNotice(text);
    }

    function debugWarn(message, payload) {
        var locationObj = globalThis.location || null;
        var host = locationObj && locationObj.hostname ? String(locationObj.hostname) : '';
        if (host !== 'localhost' && host !== '127.0.0.1') return;
        if (globalThis.console && typeof globalThis.console.warn === 'function') {
            globalThis.console.warn('[GameNet]', message, payload);
        }
    }

    function seedCommittedWeaponLoadoutPending() {
        loadoutHelper.seedCommittedWeaponLoadoutPending();
    }

    function pendingSelfWeaponLoadout(entity) {
        return loadoutHelper.pendingSelfWeaponLoadout(entity);
    }

    function consumeNotice() {
        return loadoutHelper.consumeNotice();
    }

    function translateSelfEntryState(entity) {
        return loadoutHelper.translateSelfEntryState(entity);
    }

    function wsEndpoint() {
        return buildWsEndpoint();
    }

    function gameplayNetworkTuning() {
        return configApi.gameplayNetworkTuning();
    }

    function remoteReceiveJitterBufferEnabled() {
        return configApi.remoteReceiveJitterBufferEnabled();
    }

    function snapshotDeltaCompressionEnabled() {
        return configApi.snapshotDeltaCompressionEnabled();
    }

    function pingCadenceMs() {
        return configApi.pingCadenceMs();
    }

    function cloneSnapshotValue(value) {
        return snapshotBufferApi.cloneSnapshotValue(value, PROTOCOL);
    }

    function computeRemoteBufferDelayMs(frame) {
        return snapshotBufferApi.computeRemoteBufferDelayMs(frame, {
            getConnectionTimingState: connectionTiming.connectionTimingState,
            getRenderMap: function () { return GameNetEntities.getRenderMap(); }
        });
    }

    function applyBufferedRemoteFrame(frame) {
        if (!frame) return false;
        var snapshotMeta = {
            delta: !!frame.delta,
            serverTime: Number(frame.serverTime || 0),
            receivedAt: Number(frame.receivedAt || Date.now()),
            snapshotSeq: Math.max(0, Number(frame.snapshotSeq || 0))
        };
        var entities = Array.isArray(frame.entities) ? frame.entities : [];
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (!entity || !entity.id) continue;
            if (netState.recordRemoteSnapshotEntity) {
                netState.recordRemoteSnapshotEntity(entity.id, entity, snapshotMeta.serverTime);
            }
            GameNetEntities.updateFromSnapshot(entity, snapshotMeta);
        }
        var removedIds = Array.isArray(frame.removedEntityIds) ? frame.removedEntityIds : [];
        for (i = 0; i < removedIds.length; i++) {
            GameNetEntities.removeRemoteVisual(removedIds[i]);
        }
        if (frame.projectiles !== undefined) {
            netState.setRemoteProjectileState(frame.projectiles);
        }
        if (frame.fireZones !== undefined) {
            netState.setRemoteFireZoneState(frame.fireZones);
        }
        if (netState.pruneRemoteSnapshotTimelines) {
            netState.pruneRemoteSnapshotTimelines(netState.getSnapshotMap());
        }
        return true;
    }

    function enqueueBufferedRemoteFrame(frame) {
        return snapshotBufferApi.enqueueBufferedRemoteFrame(frame, {
            nowMs: Date.now,
            computeRemoteBufferDelayMs: computeRemoteBufferDelayMs,
            enqueueRemoteFrame: netState.enqueueRemoteFrame
        });
    }

    function drainBufferedRemoteFrames() {
        snapshotBufferApi.drainBufferedRemoteFrames({
            enabled: remoteReceiveJitterBufferEnabled(),
            nowMs: Date.now,
            peekRemoteFrame: netState.peekRemoteFrame,
            shiftRemoteFrame: netState.shiftRemoteFrame,
            applyFrame: applyBufferedRemoteFrame
        });
    }

    function updateRemoteFromSnapshot(entity, snapshotMeta) {
        return snapshotApplyApi.updateRemoteFromSnapshot({
            sceneRef: sceneRef,
            protocol: PROTOCOL,
            netState: netState,
            connectionTiming: connectionTiming,
            joinState: joinState,
            GameNetEntities: GameNetEntities,
            remoteReceiveJitterBufferEnabled: remoteReceiveJitterBufferEnabled(),
            getRemoteFrameCollector: function () { return remoteFrameCollector; },
            setRemoteFrameCollector: function (value) { remoteFrameCollector = value; },
            pendingSelfWeaponLoadout: pendingSelfWeaponLoadout,
            translateSelfEntryState: translateSelfEntryState
        }, entity, snapshotMeta);
    }

    function applySnapshot(entities, projectiles, fireZones, opts) {
        return snapshotApplyApi.applySnapshot({
            sceneRef: sceneRef,
            protocol: PROTOCOL,
            netState: netState,
            connectionTiming: connectionTiming,
            joinState: joinState,
            GameNetEntities: GameNetEntities,
            snapshotHelper: snapshotHelper,
            remoteReceiveJitterBufferEnabled: remoteReceiveJitterBufferEnabled(),
            snapshotDeltaCompressionEnabled: snapshotDeltaCompressionEnabled(),
            getRemoteFrameCollector: function () { return remoteFrameCollector; },
            setRemoteFrameCollector: function (value) { remoteFrameCollector = value; },
            enqueueBufferedRemoteFrame: enqueueBufferedRemoteFrame,
            pendingSelfWeaponLoadout: pendingSelfWeaponLoadout,
            translateSelfEntryState: translateSelfEntryState
        }, entities, projectiles, fireZones, opts);
    }

    function initSnapshotHelper() {
        if (!snapshotsFactory || !snapshotsFactory.create) {
            snapshotHelper = null;
            return;
        }
        snapshotHelper = snapshotsFactory.create({
            onEntity: function (entity, snapshotMeta) {
                updateRemoteFromSnapshot(entity, snapshotMeta);
            },
            onPrune: function (nextMap) {
                netState.replaceSnapshotMap(nextMap);
                if (remoteReceiveJitterBufferEnabled()) {
                    return;
                }
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
                if (remoteReceiveJitterBufferEnabled() && remoteFrameCollector) {
                    remoteFrameCollector.projectiles = cloneSnapshotValue(projectiles);
                    return;
                }
                netState.setRemoteProjectileState(projectiles);
            },
            onFireZones: function (fireZones) {
                if (remoteReceiveJitterBufferEnabled() && remoteFrameCollector) {
                    remoteFrameCollector.fireZones = cloneSnapshotValue(fireZones);
                    return;
                }
                netState.setRemoteFireZoneState(fireZones);
            }
        });
    }

    var effects = effectsFactory.create({
        getEntitiesApi: function () { return GameNetEntities; },
        getNetState: function () { return netState; },
        getConnectionTiming: function () { return connectionTiming; },
        getPlayerApi: playerApi,
        getPlayerCombatApi: playerCombatApi,
        damagePointY: damagePointY,
        markerPointY: markerPointY,
        wsSend: wsSend,
        weaponLoadoutMessageType: MSG_C2S.WEAPON_LOADOUT
    });

    var messageRouter = messageRouterFactory.create({
        msgTypes: MSG_S2C,
        runtime: runtime,
        sanitizeRoomId: sanitizeRoomId,
        buildExpectedWorldMeta: buildExpectedWorldMeta,
        cloneWorldFlags: cloneWorldFlags,
        applySnapshot: applySnapshot,
        pushNotice: pushNotice,
        flushPendingWeaponLoadout: effects.flushPendingWeaponLoadout,
        resolveJoinOnWelcome: joinState.resolveJoinOnWelcome,
        damagePointForEntityId: effects.damagePointForEntityId,
        getRenderMap: function () { return GameNetEntities.getRenderMap(); },
        setRemoteAliveState: function (entityId, alive) {
            return GameNetEntities && GameNetEntities.setAliveState
                ? GameNetEntities.setAliveState(entityId, alive)
                : false;
        },
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
        toLocalClockTime: connectionTiming.toLocalClockTime,
        getConnectionTimingState: connectionTiming.connectionTimingState,
        setWorldMeta: netState.setWorldMeta,
        getWorldMismatchNotified: netState.getWorldMismatchNotified,
        setWorldMismatchNotified: netState.setWorldMismatchNotified,
        getActiveWorldMeta: activeWorldMeta,
        handlePong: connectionTiming.updatePongTiming,
        debugWarn: debugWarn,
        throwAckQueue: queues.throwAckQueue,
        throwRejectQueue: queues.throwRejectQueue,
        throwableEventQueue: queues.throwableEventQueue,
        shotEffectQueue: queues.shotEffectQueue,
        shotRejectQueue: queues.shotRejectQueue,
        damageFeedbackQueue: queues.damageFeedbackQueue,
        incomingDamageFeedbackQueue: queues.incomingDamageFeedbackQueue
    });

    function handleMessage(raw) {
        messageRouter.handleMessage(raw);
    }

    var stateView = stateViewFactory.create({
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
        getRemoteSnapshotTiming: netState.getRemoteSnapshotTiming,
        getRemoteSnapshotTimeline: netState.getRemoteSnapshotTimeline,
        getRemoteProjectileState: netState.getRemoteProjectileState,
        getRemoteFireZoneState: netState.getRemoteFireZoneState,
        getConnectionTimingState: connectionTiming.connectionTimingState,
        getLastAcceptedSelfAckAt: connectionTiming.getLastAcceptedSelfAckAt,
        getCurrentInputState: function () {
            var gamePlayer = playerApi();
            return gamePlayer && gamePlayer.getNetworkInputState
                ? gamePlayer.getNetworkInputState()
                : null;
        },
        getCurrentRotation: function () {
            var gamePlayer = playerApi();
            return gamePlayer && gamePlayer.getRotation
                ? gamePlayer.getRotation()
                : null;
        },
        getCurrentUser: currentUser,
        getRenderCoreWorldPosition: effects.getRenderCoreWorldPosition,
        markerPointForEntityId: effects.markerPointForEntityId,
        getSharedApi: function () { return sharedApi; },
        consumeNotice: consumeNotice,
        throwAckQueue: queues.throwAckQueue,
        throwRejectQueue: queues.throwRejectQueue,
        throwableEventQueue: queues.throwableEventQueue,
        shotEffectQueue: queues.shotEffectQueue,
        shotRejectQueue: queues.shotRejectQueue,
        damageFeedbackQueue: queues.damageFeedbackQueue,
        incomingDamageFeedbackQueue: queues.incomingDamageFeedbackQueue
    });

    var runtimeCore = runtimeCoreFactory.create({
        isActive: function () { return active; },
        setConnected: function (value) { connected = !!value; },
        getSocketIdentity: socketIdentity,
        nextConnectAttemptSeq: function () {
            connectAttemptSeq += 1;
            return connectAttemptSeq;
        },
        getConnectAttemptSeq: function () { return connectAttemptSeq; },
        getTransportApi: transportApi,
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
        onTransportConnectStart: joinState.markJoinConnectStart,
        onTransportClose: function () {
            connectionTiming.reset();
            effects.clearRemoteWorldState();
            var attempt = joinState.getJoinAttempt();
            if (attempt) joinState.failJoin('Disconnected while joining room ' + attempt.expectedRoomId.toUpperCase() + '.');
        },
        onTransportError: function () {
            connectionTiming.reset();
            effects.clearRemoteWorldState();
            var attempt = joinState.getJoinAttempt();
            if (attempt) joinState.failJoin('WebSocket error while joining room ' + attempt.expectedRoomId.toUpperCase() + '.');
        },
        getPendingRespawnInfo: netState.getPendingRespawnInfo,
        setPendingRespawnInfo: netState.setPendingRespawnInfo,
        setPendingSpawnSync: netState.setPendingSpawnSync,
        getConnectionTimingState: connectionTiming.connectionTimingState,
        toLocalClockTime: connectionTiming.toLocalClockTime,
        applyPendingSpawnSync: effects.applyPendingSpawnSync,
        isConnected: function () { return connected; },
        getInputSendTimer: netState.getInputSendTimer,
        setInputSendTimer: netState.setInputSendTimer,
        getInputSendInterval: netState.getInputSendInterval,
        getLastSentInputSample: netState.getLastSentInputSample,
        setLastSentInputSample: netState.setLastSentInputSample,
        getAccumulatedPositionDriftWu: netState.getAccumulatedPositionDriftWu,
        getAccumulatedYawDriftRad: netState.getAccumulatedYawDriftRad,
        updateInputDriftTracking: netState.updateInputDriftTracking,
        resetInputDriftTracking: netState.resetInputDriftTracking,
        getSnapshotAckSeq: netState.getSnapshotAckSeq,
        getPingSendTimer: connectionTiming.getPingSendTimer,
        setPingSendTimer: connectionTiming.setPingSendTimer,
        getPingCadenceSeconds: connectionTiming.getPingCadenceSeconds,
        getPingMessageType: function () { return MSG_C2S.PING || 'ping'; },
        getPlayerApi: playerApi,
        nextInputSeq: netState.nextInputSeq,
        getInputSeqHistory: netState.getInputSeqHistory,
        setLastInputSeqSent: netState.setLastInputSeqSent,
        getInputMessageType: function () { return MSG_C2S.INPUT; },
        getRemoteSyncApi: remoteSyncApi,
        getRenderMap: function () { return GameNetEntities.getRenderMap(); }
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
        enterMatchMessageType: MSG_C2S.ENTER_MATCH,
        buildFirePayload: buildFirePayload,
        fireMessageType: MSG_C2S.FIRE,
        rollMessageType: MSG_C2S.ROLL,
        reloadMessageType: MSG_C2S.RELOAD,
        equipWeaponMessageType: MSG_C2S.EQUIP_WEAPON,
        normalizeWeaponLoadoutPayload: PROTOCOL.normalizeWeaponLoadoutPayload,
        normalizeThrowPayload: PROTOCOL.normalizeThrowPayload,
        normalizeReloadPayload: PROTOCOL.normalizeReloadPayload,
        setPendingWeaponLoadout: netState.setPendingWeaponLoadout,
        flushPendingWeaponLoadout: effects.flushPendingWeaponLoadout
    });

    var timingApi = {
        getSnapshotTimingState: connectionTiming.snapshotTimingState,
        getConnectionTimingState: connectionTiming.connectionTimingState,
        getAuthoritativeNow: connectionTiming.authoritativeNowMs,
        getEstimatedServerTime: function () {
            return connectionTiming.getEstimatedServerTime();
        },
        toLocalTime: connectionTiming.toLocalClockTime
    };

    function init(scene) {
            sceneRef = scene;
            active = true;
            seedCommittedWeaponLoadoutPending();
            GameNetEntities.init(scene);
            initSnapshotHelper();
            connectWs();
    }

    function shutdown() {
            active = false;
            joinState.failJoin('Disconnected while joining room.');
            joinState.resetJoinAttempt();
            runtimeCore.shutdownConnection();
            GameNetEntities.cleanup();
            snapshotHelper = null;
            remoteFrameCollector = null;
            netState.reset();
            connectionTiming.reset();
    }

    var GameNet = {
        init: init,
        shutdown: shutdown,
        update: function (dt, playerPos, rotation) {
            drainBufferedRemoteFrames();
            return runtimeCore.update(dt, playerPos, rotation);
        },
        isActive: function () { return active; },
        isConnected: function () { return connected; },
        setRoomId: function (nextRoomId) {
            var nextId = sanitizeRoomId ? sanitizeRoomId(nextRoomId) : String(nextRoomId || '');
            netState.setRoomId(nextId);
            netState.setWorldMeta(null);
            netState.setWorldMismatchNotified(false);
            netState.setInputSendInterval(DEFAULT_INPUT_SEND_INTERVAL);
            if (netState.resetInputDriftTracking) netState.resetInputDriftTracking(null, 0);
            if (netState.clearRemoteFrameQueue) netState.clearRemoteFrameQueue();
            if (netState.clearSnapshotBaselines) netState.clearSnapshotBaselines();
            if (netState.setSnapshotAckSeq) netState.setSnapshotAckSeq(0);
            connectionTiming.reset();
            return nextId;
        },
        getRoomId: netState.getRoomId,
        beginJoinAttempt: joinState.beginJoinAttempt,
        failJoin: joinState.failJoin,
        resetJoinAttempt: joinState.resetJoinAttempt,
        view: stateView,
        commands: commandsApi,
        timing: timingApi,
        effects: effects,
        remoteEntities: GameNetEntities,
        getHitboxArray: function () {
            return GameNetEntities && GameNetEntities.getHitboxArray
                ? GameNetEntities.getHitboxArray()
                : [];
        },
        getRenderMap: function () {
            return GameNetEntities && GameNetEntities.getRenderMap
                ? GameNetEntities.getRenderMap()
                : new Map();
        },
        getLockTargets: function () {
            return stateView && stateView.getLockTargets
                ? stateView.getLockTargets()
                : [];
        }
    };

    runtime.GameNet = GameNet;
})();
