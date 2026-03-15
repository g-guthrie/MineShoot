/**
 * runtime.js - Net runtime composition and compatibility API assembly.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetRuntime
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create() {
        var GameNet = {};
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

        var active = false;
        var connected = false;
        var ws = null;
        var reconnectTimer = null;
        var transport = null;
        var sceneRef = null;
        var connectAttemptSeq = 0;
        var INPUT_SEND_INTERVAL = (1 / 60);
        var netStateFactory = runtime.GameNetRuntimeState;
        if (!netStateFactory || !netStateFactory.create) {
            throw new Error('GameNetRuntimeState is required before GameNet initialization.');
        }
        var netState = netStateFactory.create({
            initialRoomId: 'global',
            inputSendInterval: INPUT_SEND_INTERVAL
        });
        var snapshotHelper = null;
        var queues = netState.getQueueRefs();
        var cloneWorldFlags = PROTOCOL.cloneWorldFlags;
        var sanitizeRoomId = PROTOCOL.sanitizeRoomId;

        function buildExpectedWorldMeta(roomName) {
            return PROTOCOL.buildExpectedWorldMeta(roomName || netState.getRoomId() || 'global', PROTOCOL.world);
        }

        function classStats(classId) {
            return GameNetEntities.classStats(classId);
        }

        function getPlayerApi() {
            return runtime.GamePlayer || null;
        }

        function getPlayerCombatApi() {
            return runtime.GamePlayerCombat || null;
        }

        function getTransportApi() {
            return runtime.GameNetTransport || null;
        }

        function getRemoteSyncApi() {
            return runtime.GameNetRemoteSync || null;
        }

        function getAbilityFxApi() {
            return runtime.GameAbilityFx || null;
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

        function updateRemoteFromSnapshot(entity, snapshotOpts) {
            if (!sceneRef) return;
            if (entity.id === netState.getSelfId()) {
                netState.setSelfState(entity);
                if (typeof entity.seq === 'number' && isFinite(entity.seq)) {
                    netState.ackInputSeq(entity.seq);
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
                netState.recordRemoteSnapshotEntity(entity.id, entity, snapshotOpts && snapshotOpts.serverTime);
            }
            GameNetEntities.updateFromSnapshot(entity);
        }

        function applyPendingSpawnSync() {
            var pendingSpawnSync = netState.getPendingSpawnSync();
            if (!pendingSpawnSync) return;
            if (Date.now() < Number(pendingSpawnSync.executeAt || 0)) return;
            var playerApi = getPlayerApi();
            if (!playerApi || !playerApi.respawn) return;
            playerApi.respawn(
                Number(pendingSpawnSync.x || 0),
                Number(pendingSpawnSync.z || 0)
            );
            var playerCombatApi = getPlayerCombatApi();
            if (playerCombatApi && playerCombatApi.setInvulnTimer) {
                playerCombatApi.setInvulnTimer(pendingSpawnSync.kind === 'respawn' ? 1.0 : 0.6);
            }
            if (pendingSpawnSync.kind === 'initial') {
                netState.setInitialSpawnApplied(true);
            }
            netState.setPendingSpawnSync(null);
        }

        function applySnapshot(entities, projectiles, fireZones, opts) {
            opts = opts || {};
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

            netState.setRemoteProjectileState(projectiles);
            netState.setRemoteFireZoneState(fireZones);
        }

        function initSnapshotHelper() {
            if (!runtime.GameNetSnapshots || !runtime.GameNetSnapshots.create) {
                snapshotHelper = null;
                return;
            }
            snapshotHelper = runtime.GameNetSnapshots.create({
                onEntity: function (entity, snapshotOpts) {
                    updateRemoteFromSnapshot(entity, snapshotOpts);
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
                var playerApi = getPlayerApi();
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
                var playerApi = getPlayerApi();
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
            var abilityFxView = getAbilityFxApi();
            var emptyState = abilityFxView && abilityFxView.emptyChokeVictimState
                ? abilityFxView.emptyChokeVictimState()
                : { lift: 0, liftHeight: 0, startedAt: 0, endsAt: 0 };
            if (!entityId) return emptyState;
            var now = Date.now();
            var selfFx = abilityFxView && abilityFxView.readAbilityFx
                ? abilityFxView.readAbilityFx(netState.getSelfState())
                : (netState.getSelfState() && netState.getSelfState().abilityFx ? netState.getSelfState().abilityFx : null);
            var selfChokeVictim = selfFx && selfFx.chokeVictim ? selfFx.chokeVictim : null;
            if (netState.getSelfState() && netState.getSelfState().id === entityId && selfChokeVictim && selfChokeVictim.endsAt > now) {
                return abilityFxView && abilityFxView.toChokeVictimVisualState
                    ? abilityFxView.toChokeVictimVisualState(selfChokeVictim, now)
                    : emptyState;
            }
            var render = GameNetEntities.getRenderMap().get(entityId);
            if (render && render.chokeVictimState && render.chokeVictimState.endsAt > now) {
                return abilityFxView && abilityFxView.toChokeVictimVisualState
                    ? abilityFxView.toChokeVictimVisualState(render.chokeVictimState, now)
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
            getSelfState: netState.getSelfState,
            setConnected: function (value) { connected = !!value; },
            setPendingRespawnInfo: netState.setPendingRespawnInfo,
            setPendingSpawnSync: netState.setPendingSpawnSync,
            setWorldMeta: netState.setWorldMeta,
            getWorldMismatchNotified: netState.getWorldMismatchNotified,
            setWorldMismatchNotified: netState.setWorldMismatchNotified,
            getActiveWorldMeta: runtimeAccess.getActiveWorldMeta,
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
            getRoomId: netState.getRoomId,
            getWorldMeta: netState.getWorldMeta,
            getRenderMap: function () { return GameNetEntities.getRenderMap(); },
            getSelfState: netState.getSelfState,
            getSelfId: netState.getSelfId,
            getMatchState: netState.getMatchState,
            getSnapshotMap: netState.getSnapshotMap,
            getRemoteSnapshotTiming: netState.getRemoteSnapshotTiming,
            getRemoteSnapshotTimeline: netState.getRemoteSnapshotTimeline,
            getInputSeqHistory: netState.getInputSeqHistory,
            getLocalPredictionSamples: netState.getLocalPredictionSamples,
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
            damagePointForEntityId: damagePointForEntityId,
            getCurrentInputState: function () {
                var playerApi = getPlayerApi();
                return playerApi && playerApi.getNetworkInputState
                    ? playerApi.getNetworkInputState()
                    : null;
            },
            getCurrentRotation: function () {
                var playerApi = getPlayerApi();
                return playerApi && playerApi.getRotation
                    ? playerApi.getRotation()
                    : null;
            },
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
            getTransportApi: getTransportApi,
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
            handleSupersededIdentity: function () {
                if (GameNetAuth && GameNetAuth.forceNewArenaIdentity) {
                    return Promise.resolve(GameNetAuth.forceNewArenaIdentity());
                }
                if (GameNetAuth && GameNetAuth.ensureArenaIdentity) {
                    return Promise.resolve(GameNetAuth.ensureArenaIdentity());
                }
                return null;
            },
            getPendingRespawnInfo: netState.getPendingRespawnInfo,
            setPendingRespawnInfo: netState.setPendingRespawnInfo,
            applyPendingSpawnSync: applyPendingSpawnSync,
            getInputSendTimer: netState.getInputSendTimer,
            setInputSendTimer: netState.setInputSendTimer,
            getInputSendInterval: netState.getInputSendInterval,
            setLastSentInputSample: netState.setLastSentInputSample,
            getPlayerApi: getPlayerApi,
            nextInputSeq: netState.nextInputSeq,
            getInputSeqHistory: netState.getInputSeqHistory,
            pushLocalPredictionSample: netState.pushLocalPredictionSample,
            clearLocalPredictionSamples: netState.clearLocalPredictionSamples,
            setLastInputSeqSent: netState.setLastInputSeqSent,
            getInputMessageType: function () { return MSG_C2S.INPUT; },
            getRemoteSyncApi: getRemoteSyncApi,
            getRenderMap: function () { return GameNetEntities.getRenderMap(); },
            getChokeVictimStateForEntity: getChokeVictimStateForEntity,
            sampleRemoteEntityPresentation: stateView.sampleRemoteEntityPresentation
        });

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

        var runtimeApi = {
            setRoomId: function (nextRoomId) {
                var nextId = sanitizeRoomId(nextRoomId);
                netState.setRoomId(nextId);
                netState.setWorldMeta(null);
                netState.setWorldMismatchNotified(false);
                return nextId;
            },
            getRoomId: function () {
                return netState.getRoomId();
            },
            init: function (scene) {
                sceneRef = scene;
                active = true;
                GameNetEntities.init(scene);
                initSnapshotHelper();
                connectWs();
            },
            shutdown: function () {
                if (connected) {
                    wsSend({ t: MSG_C2S.LEAVE_ROOM });
                }
                active = false;
                runtimeCore.shutdownConnection();

                GameNetEntities.cleanup();
                snapshotHelper = null;
                netState.reset();
            },
            isActive: function () {
                return !!active;
            },
            isConnected: function () {
                return !!connected;
            },
            update: runtimeCore.update
        };

        var remoteEntitiesApi = {
            getHitboxArray: function () {
                return GameNetEntities.getHitboxArray();
            },
            setHitboxVisibility: function (visible) {
                GameNetEntities.setHitboxVisibility(visible);
            }
        };

        GameNet.runtime = runtimeApi;
        GameNet.view = stateView;
        GameNet.commands = commandsApi;
        GameNet.remoteEntities = remoteEntitiesApi;

        GameNet.setRoomId = runtimeApi.setRoomId;
        GameNet.getRoomId = runtimeApi.getRoomId;
        GameNet.init = runtimeApi.init;
        GameNet.shutdown = runtimeApi.shutdown;
        GameNet.isActive = runtimeApi.isActive;
        GameNet.isConnected = runtimeApi.isConnected;
        GameNet.update = runtimeApi.update;
        GameNet.getHitboxArray = remoteEntitiesApi.getHitboxArray;
        GameNet.setHitboxVisibility = remoteEntitiesApi.setHitboxVisibility;
        GameNet.sendFire = commandsApi.sendFire;
        GameNet.sendEquipWeapon = commandsApi.sendEquipWeapon;
        GameNet.sendWeaponLoadout = commandsApi.sendWeaponLoadout;
        GameNet.sendThrow = commandsApi.sendThrow;
        GameNet.sendAbilityLoadout = commandsApi.sendAbilityLoadout;
        GameNet.sendAbilityCast = commandsApi.sendAbilityCast;
        GameNet.getEntityStateList = stateView.getEntityStateList;
        GameNet.getAuthoritativeSelfState = stateView.getAuthoritativeSelfState;
        GameNet.getSelfState = stateView.getSelfState;
        GameNet.consumeThrowAck = stateView.consumeThrowAck;
        GameNet.consumeThrowReject = stateView.consumeThrowReject;
        GameNet.consumeThrowableEvent = stateView.consumeThrowableEvent;
        GameNet.consumeAbilityEvent = stateView.consumeAbilityEvent;
        GameNet.getAuthoritativeThrowableState = stateView.getAuthoritativeThrowableState;
        GameNet.consumeClassCastResult = stateView.consumeClassCastResult;
        GameNet.consumeDamageFeedback = stateView.consumeDamageFeedback;
        GameNet.consumeIncomingDamageFeedback = stateView.consumeIncomingDamageFeedback;
        GameNet.damagePointForEntityId = stateView.damagePointForEntityId;
        GameNet.getEntityMarkerWorldPos = stateView.getEntityMarkerWorldPos;
        GameNet.getChokeVictimStateForEntity = stateView.getChokeVictimStateForEntity;
        GameNet.getSelfAbilityState = stateView.getSelfAbilityState;
        GameNet.getMatchState = stateView.getMatchState;
        GameNet.getInputSyncState = stateView.getInputSyncState;
        GameNet.getSelfReconciliationState = stateView.getSelfReconciliationState;
        GameNet.getPendingInputSamples = stateView.getPendingInputSamples;
        GameNet.getRespawnState = stateView.getRespawnState;
        GameNet.getRemotePresentationClock = stateView.getRemotePresentationClock;
        GameNet.sampleRemoteEntityPresentation = stateView.sampleRemoteEntityPresentation;
        GameNet.getGameMode = stateView.getGameMode;
        GameNet.getPrivateRoomPhase = stateView.getPrivateRoomPhase;
        GameNet.getExpectedWorldMeta = stateView.getExpectedWorldMeta;
        GameNet.getWorldMeta = stateView.getWorldMeta;
        GameNet.getEntityName = stateView.getEntityName;
        GameNet.getLockTargets = stateView.getLockTargets;
        GameNet.consumeNotice = stateView.consumeNotice;

        return GameNet;
    }

    runtime.GameNetRuntime = {
        create: create
    };
})();
