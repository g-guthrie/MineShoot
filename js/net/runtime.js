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
        var INPUT_SEND_INTERVAL = (1 / 30);
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

        function updateRemoteFromSnapshot(entity) {
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
            GameNetEntities.updateFromSnapshot(entity);
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

        function applySnapshot(entities, projectiles, fireZones, opts) {
            opts = opts || {};
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
                updateRemoteFromSnapshot(e);
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

            netState.setRemoteProjectileState(projectiles);
            netState.setRemoteFireZoneState(fireZones);
        }

        function initSnapshotHelper() {
            if (!runtime.GameNetSnapshots || !runtime.GameNetSnapshots.create) {
                snapshotHelper = null;
                return;
            }
            snapshotHelper = runtime.GameNetSnapshots.create({
                onEntity: function (entity) {
                    updateRemoteFromSnapshot(entity);
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
            classStats: classStats,
            getRoomId: netState.getRoomId,
            getWorldMeta: netState.getWorldMeta,
            getRenderMap: function () { return GameNetEntities.getRenderMap(); },
            getSelfState: netState.getSelfState,
            getSelfId: netState.getSelfId,
            getMatchState: netState.getMatchState,
            getSnapshotMap: netState.getSnapshotMap,
            getInputSeqHistory: netState.getInputSeqHistory,
            getLocalPredictionSamples: netState.getLocalPredictionSamples,
            getLastInputSeqSent: netState.getLastInputSeqSent,
            getLastInputSeqAcked: netState.getLastInputSeqAcked,
            getInputSendInterval: netState.getInputSendInterval,
            getPendingRespawnInfo: netState.getPendingRespawnInfo,
            getGameMode: netState.getGameMode,
            getPrivateRoomPhase: netState.getPrivateRoomPhase,
            getRemoteProjectileState: netState.getRemoteProjectileState,
            getRemoteFireZoneState: netState.getRemoteFireZoneState,
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
            getPlayerApi: runtimeAccess.getPlayerApi,
            nextInputSeq: netState.nextInputSeq,
            getInputSeqHistory: netState.getInputSeqHistory,
            pushLocalPredictionSample: netState.pushLocalPredictionSample,
            clearLocalPredictionSamples: netState.clearLocalPredictionSamples,
            setLastInputSeqSent: netState.setLastInputSeqSent,
            getInputMessageType: function () { return MSG_C2S.INPUT; },
            getRemoteSyncApi: runtimeAccess.getRemoteSyncApi,
            getRenderMap: function () { return GameNetEntities.getRenderMap(); },
            getChokeVictimStateForEntity: getChokeVictimStateForEntity
        });

        function connectWs() {
            runtimeCore.connectWs();
        }

        function wsSend(msg) {
            return runtimeCore.wsSend(msg);
        }

        GameNet.setRoomId = function (nextRoomId) {
            var nextId = sanitizeRoomId(nextRoomId);
            netState.setRoomId(nextId);
            netState.setWorldMeta(null);
            netState.setWorldMismatchNotified(false);
            return nextId;
        };

        GameNet.getRoomId = function () {
            return netState.getRoomId();
        };

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
            runtimeCore.shutdownConnection();

            GameNetEntities.cleanup();
            snapshotHelper = null;
            netState.reset();
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
        GameNet.getSelfState = stateView.getSelfState;
        GameNet.update = runtimeCore.update;

        GameNet.sendFire = function (weaponId, shotToken) {
            var payload = runtimeAccess.buildFirePayload(MSG_C2S.FIRE, weaponId, shotToken);
            if (!payload) return false;
            return wsSend(payload);
        };

        GameNet.sendEquipWeapon = function (weaponId) {
            if (!weaponId) return false;
            return wsSend({
                t: MSG_C2S.EQUIP_WEAPON,
                weaponId: String(weaponId)
            });
        };

        GameNet.sendWeaponLoadout = function (slot1, slot2) {
            netState.setPendingWeaponLoadout(PROTOCOL.normalizeWeaponLoadoutPayload(slot1, slot2));
            return flushPendingWeaponLoadout();
        };

        GameNet.sendThrow = function (throwableId, clientThrowId, throwIntent) {
            return wsSend(PROTOCOL.normalizeThrowPayload(throwableId, clientThrowId, throwIntent));
        };

        GameNet.consumeThrowAck = stateView.consumeThrowAck;
        GameNet.consumeThrowReject = stateView.consumeThrowReject;
        GameNet.consumeThrowableEvent = stateView.consumeThrowableEvent;
        GameNet.consumeAbilityEvent = stateView.consumeAbilityEvent;
        GameNet.getAuthoritativeThrowableState = stateView.getAuthoritativeThrowableState;

        GameNet.sendAbilityLoadout = function (slot1, slot2) {
            return wsSend(PROTOCOL.normalizeAbilityLoadoutPayload(slot1, slot2));
        };

        GameNet.sendAbilityCast = function (slot, castData) {
            return wsSend(PROTOCOL.normalizeClassCastPayload(slot, castData));
        };

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

        return GameNet;
    }

    runtime.GameNetRuntime = {
        create: create
    };
})();
