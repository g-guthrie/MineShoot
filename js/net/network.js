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

    var cloneWorldFlags = PROTOCOL.cloneWorldFlags;
    var sanitizeRoomId = PROTOCOL.sanitizeRoomId;
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

    function runtimeProfileApi() {
        return runtime.GameRuntimeProfile || null;
    }

    function playerApi() {
        return runtime.GamePlayer || null;
    }

    function playerCombatApi() {
        return runtime.GamePlayerCombat || null;
    }

    function abilityFxApi() {
        return runtime.GameAbilityFx || null;
    }

    function transportApi() {
        return runtime.GameNetTransport || null;
    }

    function remoteSyncApi() {
        return runtime.GameNetRemoteSync || null;
    }

    function hitscanApi() {
        return runtime.GameHitscan || null;
    }

    function socketIdentity() {
        if (GameNetAuth && GameNetAuth.getSocketIdentity) return GameNetAuth.getSocketIdentity();
        return GameNetAuth && GameNetAuth.getUser ? GameNetAuth.getUser() : null;
    }

    function currentUser() {
        if (GameNetAuth && GameNetAuth.getCurrentUser) return GameNetAuth.getCurrentUser();
        return socketIdentity();
    }

    function activeWorldMeta() {
        var worldApi = runtime.GameWorld || null;
        return worldApi && worldApi.getWorldMeta ? worldApi.getWorldMeta() : null;
    }

    function damagePointY(entityY) {
        var points = sharedApi.entityPoints || {};
        return points.entityDamagePointY ? points.entityDamagePointY(entityY) : (entityY + 1.06);
    }

    function markerPointY(entityY) {
        var points = sharedApi.entityPoints || {};
        return points.entityMarkerPointY ? points.entityMarkerPointY(entityY) : (entityY + 2.25);
    }

    function buildWsEndpoint() {
        var profile = runtimeProfileApi();
        var endpoint = (profile && profile.resolveWsUrl)
            ? profile.resolveWsUrl(WS_URL)
            : ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + WS_URL);
        var params = new URLSearchParams();
        params.set('room', String(netState.getRoomId() || 'global'));
        if (GameNetAuth && GameNetAuth.getSocketPlayerId) {
            params.set('pid', String(GameNetAuth.getSocketPlayerId() || ''));
        }
        var actor = GameNetAuth && GameNetAuth.getPartyIdentity ? GameNetAuth.getPartyIdentity() : null;
        if (actor && actor.id) {
            params.set('actorId', String(actor.id));
            params.set('actorName', String(actor.username || actor.id));
        }
        var user = socketIdentity();
        if (user && user.id) {
            params.set('uid', String(user.id));
            params.set('username', String(user.username || user.id));
            params.set('classId', String(user.classId || 'abilities'));
        }
        return endpoint + '?' + params.toString();
    }

    function buildFirePayload(msgType, weaponId, shotToken) {
        if (!weaponId) return null;
        var payload = {
            t: msgType,
            weaponId: String(weaponId)
        };
        var fireIntent = hitscanApi() && hitscanApi().buildNetworkFireIntent
            ? hitscanApi().buildNetworkFireIntent(shotToken)
            : null;
        if (fireIntent && String(fireIntent.weaponId || '') === String(weaponId)) {
            if (fireIntent.adsActive) payload.adsActive = true;
            if (isFinite(Number(fireIntent.viewFovDeg)) && Number(fireIntent.viewFovDeg) > 0.0001) {
                payload.viewFovDeg = Number(fireIntent.viewFovDeg);
            }
            if (fireIntent.aimOrigin) {
                payload.aimOrigin = {
                    x: Number(fireIntent.aimOrigin.x || 0),
                    y: Number(fireIntent.aimOrigin.y || 0),
                    z: Number(fireIntent.aimOrigin.z || 0)
                };
            }
            if (fireIntent.aimForward) {
                payload.aimForward = {
                    x: Number(fireIntent.aimForward.x || 0),
                    y: Number(fireIntent.aimForward.y || 0),
                    z: Number(fireIntent.aimForward.z || 0)
                };
            }
        }
        var gamePlayer = playerApi();
        if (!payload.adsActive && gamePlayer && gamePlayer.getAdsState) {
            var adsState = gamePlayer.getAdsState();
            if (adsState && adsState.ready) payload.adsActive = true;
        }
        if (!payload.viewFovDeg && gamePlayer && gamePlayer.getCamera) {
            var camera = gamePlayer.getCamera();
            var cameraFov = Number(camera && camera.fov);
            if (isFinite(cameraFov) && cameraFov > 0.0001) payload.viewFovDeg = cameraFov;
        }
        if (!payload.aimForward && gamePlayer && gamePlayer.getRotation) {
            var rot = gamePlayer.getRotation();
            var yaw = Number(rot && rot.yaw || 0);
            var pitch = Number(rot && rot.pitch || 0);
            var x = -Math.sin(yaw) * Math.cos(pitch);
            var y = Math.sin(-pitch);
            var z = -Math.cos(yaw) * Math.cos(pitch);
            var len = Math.sqrt((x * x) + (y * y) + (z * z)) || 1;
            if (isFinite(len) && len > 0.000001) {
                payload.aimForward = {
                    x: x / len,
                    y: y / len,
                    z: z / len
                };
            }
        }
        if (!payload.aimOrigin) {
            var fireOrigin = null;
            if (gamePlayer && gamePlayer.getEyeWorldPosition) {
                fireOrigin = gamePlayer.getEyeWorldPosition();
            }
            if ((!fireOrigin || !isFinite(Number(fireOrigin.x)) || !isFinite(Number(fireOrigin.y)) || !isFinite(Number(fireOrigin.z))) && gamePlayer && gamePlayer.getCamera) {
                var fireCamera = gamePlayer.getCamera();
                if (fireCamera && fireCamera.position) {
                    fireOrigin = fireCamera.position;
                }
            }
            if (fireOrigin && isFinite(Number(fireOrigin.x)) && isFinite(Number(fireOrigin.y)) && isFinite(Number(fireOrigin.z))) {
                var eyeOrigin = {
                    x: Number(fireOrigin.x || 0),
                    y: Number(fireOrigin.y || 0),
                    z: Number(fireOrigin.z || 0)
                };
                var sharedPoints = sharedApi.entityPoints || {};
                payload.aimOrigin = sharedPoints.logicalHitscanOriginFromEye && payload.aimForward
                    ? sharedPoints.logicalHitscanOriginFromEye(eyeOrigin, payload.aimForward)
                    : eyeOrigin;
            }
        }
        var estimatedServerTime = Number(connectionTiming.getEstimatedServerTime ? connectionTiming.getEstimatedServerTime() : 0);
        if (isFinite(estimatedServerTime) && estimatedServerTime > 0) {
            payload.estimatedServerShotTime = Math.round(estimatedServerTime);
        }
        if (shotToken) payload.shotToken = String(shotToken);
        return payload;
    }

    if (GameNetEntities && GameNetEntities.configure) {
        GameNetEntities.configure({
            getSharedApi: function () { return sharedApi; },
            getActorVisualFactory: function () { return runtime.GameActorVisualFactory || null; },
            getAbilityFxApi: abilityFxApi
        });
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

    function debugWarn(message, payload) {
        var locationObj = globalThis.location || null;
        var host = locationObj && locationObj.hostname ? String(locationObj.hostname) : '';
        if (host !== 'localhost' && host !== '127.0.0.1') return;
        if (globalThis.console && typeof globalThis.console.warn === 'function') {
            globalThis.console.warn('[GameNet]', message, payload);
        }
    }

    function seedCommittedWeaponLoadoutPending() {
        var loadoutState = runtime.GameLoadoutState || null;
        if (!loadoutState || !loadoutState.getCommittedLoadout || !netState.setPendingWeaponLoadout) return;
        var committed = loadoutState.getCommittedLoadout();
        var slots = committed && Array.isArray(committed.weaponSlots)
            ? committed.weaponSlots.slice(0, 2)
            : [];
        if (!slots[0] || !slots[1]) return;
        netState.setPendingWeaponLoadout(PROTOCOL.normalizeWeaponLoadoutPayload(slots[0], slots[1]));
    }

    function normalizeLoadoutPair(slots) {
        if (!Array.isArray(slots)) return [];
        var out = [];
        var seen = {};
        for (var i = 0; i < slots.length && out.length < 2; i++) {
            var id = String(slots[i] || '');
            if (!id || seen[id]) continue;
            seen[id] = true;
            out.push(id);
        }
        return out;
    }

    function pendingSelfWeaponLoadout(entity) {
        var pending = netState.getPendingWeaponLoadout ? netState.getPendingWeaponLoadout() : null;
        if (!pending || !entity || entity.id !== netState.getSelfId()) return entity;

        var pendingSlots = normalizeLoadoutPair([pending.slot1, pending.slot2]);
        if (!pendingSlots.length) return entity;

        var authoritativeSlots = normalizeLoadoutPair(entity.weaponLoadout);
        var authoritativeWeaponId = String(entity.weaponId || '');
        var loadoutMatches = authoritativeSlots.length === pendingSlots.length;
        if (loadoutMatches) {
            for (var i = 0; i < pendingSlots.length; i++) {
                if (authoritativeSlots[i] !== pendingSlots[i]) {
                    loadoutMatches = false;
                    break;
                }
            }
        }
        var preferredWeaponId = String(pendingSlots[0] || '');
        if (loadoutMatches && authoritativeWeaponId === preferredWeaponId) {
            netState.setPendingWeaponLoadout(null);
            return entity;
        }

        var nextEntity = Object.assign({}, entity);
        nextEntity.weaponLoadout = pendingSlots.slice();
        if (preferredWeaponId) {
            nextEntity.weaponId = preferredWeaponId;
        }
        return nextEntity;
    }

    function consumeNotice() {
        return netState.consumeNotice();
    }

    function wsEndpoint() {
        return buildWsEndpoint();
    }

    function gameplayNetworkTuning() {
        var shared = sharedApi || {};
        return shared.getNetworkTuning ? (shared.getNetworkTuning() || {}) : {};
    }

    function pingCadenceMs() {
        var ping = gameplayNetworkTuning().ping || {};
        var raw = Number(ping.cadenceMs || 500);
        if (!isFinite(raw) || raw <= 0) return 500;
        return Math.max(100, raw);
    }

    function updateRemoteFromSnapshot(entity, snapshotMeta) {
        if (!sceneRef) return;
        entity = pendingSelfWeaponLoadout(entity);
        if (entity.id === netState.getSelfId()) {
            if (!connectionTiming.shouldAcceptSelfSnapshot(entity, snapshotMeta)) return;
            netState.setSelfState(entity);
            joinState.resolveJoinOnSelfSnapshot(entity.id);
            var acceptance = connectionTiming.noteAcceptedSelfSnapshot(entity, snapshotMeta);
            if (acceptance.ackSeq > 0) {
                netState.ackInputSeq(acceptance.ackSeq);
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

    function applySnapshot(entities, projectiles, fireZones, opts) {
        opts = opts || {};
        connectionTiming.updateSnapshotTiming(opts);
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

    var effects = effectsFactory.create({
        getEntitiesApi: function () { return GameNetEntities; },
        getNetState: function () { return netState; },
        getConnectionTiming: function () { return connectionTiming; },
        getPlayerApi: playerApi,
        getPlayerCombatApi: playerCombatApi,
        getAbilityFxApi: abilityFxApi,
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
        abilityEventQueue: queues.abilityEventQueue,
        classCastResultQueue: queues.classCastResultQueue,
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
        getChokeVictimStateForEntity: effects.getChokeVictimStateForEntity,
        getSharedApi: function () { return sharedApi; },
        getAbilityFxApi: abilityFxApi,
        consumeNotice: consumeNotice,
        throwAckQueue: queues.throwAckQueue,
        throwRejectQueue: queues.throwRejectQueue,
        throwableEventQueue: queues.throwableEventQueue,
        abilityEventQueue: queues.abilityEventQueue,
        classCastResultQueue: queues.classCastResultQueue,
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
        getRenderMap: function () { return GameNetEntities.getRenderMap(); },
        getChokeVictimStateForEntity: effects.getChokeVictimStateForEntity
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
        buildFirePayload: buildFirePayload,
        fireMessageType: MSG_C2S.FIRE,
        rollMessageType: MSG_C2S.ROLL,
        reloadMessageType: MSG_C2S.RELOAD,
        equipWeaponMessageType: MSG_C2S.EQUIP_WEAPON,
        normalizeWeaponLoadoutPayload: PROTOCOL.normalizeWeaponLoadoutPayload,
        normalizeThrowPayload: PROTOCOL.normalizeThrowPayload,
        normalizeReloadPayload: PROTOCOL.normalizeReloadPayload,
        normalizeAbilityLoadoutPayload: PROTOCOL.normalizeAbilityLoadoutPayload,
        normalizeClassCastPayload: PROTOCOL.normalizeClassCastPayload,
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
            netState.reset();
            connectionTiming.reset();
    }

    var GameNet = {
        init: init,
        shutdown: shutdown,
        update: runtimeCore.update,
        isActive: function () { return active; },
        isConnected: function () { return connected; },
        setRoomId: function (nextRoomId) {
            var nextId = sanitizeRoomId ? sanitizeRoomId(nextRoomId) : String(nextRoomId || '');
            netState.setRoomId(nextId);
            netState.setWorldMeta(null);
            netState.setWorldMismatchNotified(false);
            netState.setInputSendInterval(DEFAULT_INPUT_SEND_INTERVAL);
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
        remoteEntities: GameNetEntities
    };

    runtime.GameNet = GameNet;
})();
