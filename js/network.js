/**
 * network.js - Global room websocket + remote entity rendering
 * Auth logic lives in net/auth.js (GameNetAuth); thin wrappers kept for backward compat.
 * Remote entity visuals/hitboxes live in net/remote-entities.js (GameNetEntities).
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNet
 */
(function () {
    'use strict';

    var GameNet = {};

    var PROTOCOL = globalThis.__MAYHEM_RUNTIME.GameShared.protocol;
    var MSG = PROTOCOL.msg;
    var MSG_C2S = MSG.c2s;
    var MSG_S2C = MSG.s2c;

    var WS_URL = PROTOCOL.wsPath;

    var GameNetAuth = globalThis.__MAYHEM_RUNTIME.GameNetAuth;
    var GameNetEntities = globalThis.__MAYHEM_RUNTIME.GameNetEntities;
    var runtimeAccessFactory = globalThis.__MAYHEM_RUNTIME.GameNetRuntimeAccess;
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

    var roomId = 'global';
    var selfId = '';
    var selfState = null;
    var matchState = null;
    var gameMode = '';
    var privateRoomPhase = '';
    var worldMeta = null;
    var worldMismatchNotified = false;
    var pendingSpawnSync = null;
    var pendingRespawnInfo = null;
    var initialSpawnApplied = false;
    var pendingWeaponLoadout = null;

    var inputSeq = 1;
    var lastInputSeqSent = 0;
    var lastInputSeqAcked = 0;
    var inputSeqHistory = [];
    var inputSendTimer = 0;
    var INPUT_SEND_INTERVAL = (1 / 60);

    var snapshotMap = new Map();
    var snapshotHelper = null;

    var remoteProjectileState = [];
    var remoteFireZoneState = [];
    var throwAckQueue = [];
    var throwRejectQueue = [];
    var throwableEventQueue = [];
    var abilityEventQueue = [];
    var classCastResultQueue = [];
    var damageFeedbackQueue = [];
    var incomingDamageFeedbackQueue = [];

    var notices = [];
    var cloneWorldFlags = PROTOCOL.cloneWorldFlags;

    function buildExpectedWorldMeta(roomName) {
        return PROTOCOL.buildExpectedWorldMeta(roomName || roomId || 'global', PROTOCOL.world);
    }

    function classStats(classId) {
        return GameNetEntities.classStats(classId);
    }

    function pushNotice(text) {
        notices.push(text);
        if (notices.length > 6) notices.shift();
    }

    function consumeNotice() {
        if (notices.length === 0) return '';
        return notices.shift();
    }

    function wsEndpoint() {
        return runtimeAccess.buildWsEndpoint({
            wsPath: WS_URL,
            roomId: roomId,
            authApi: GameNetAuth
        });
    }

    var sanitizeRoomId = PROTOCOL.sanitizeRoomId;

    function updateRemoteFromSnapshot(entity) {
        if (!sceneRef) return;
        if (entity.id === selfId) {
            selfState = entity;
            if (typeof entity.seq === 'number' && isFinite(entity.seq)) {
                lastInputSeqAcked = Math.max(lastInputSeqAcked, Math.floor(Number(entity.seq || 0)));
                if (inputSeqHistory.length > 0) {
                    inputSeqHistory = inputSeqHistory.filter(function (entry) {
                        return entry && Number(entry.seq || 0) > lastInputSeqAcked;
                    });
                }
            }
            if (!initialSpawnApplied && entity && typeof entity.x === 'number' && typeof entity.z === 'number') {
                pendingSpawnSync = {
                    x: Number(entity.x || 0),
                    z: Number(entity.z || 0),
                    executeAt: Date.now(),
                    kind: 'initial'
                };
            }
            return;
        }
        GameNetEntities.updateFromSnapshot(entity);
    }

    function applyPendingSpawnSync() {
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
            initialSpawnApplied = true;
        }
        pendingSpawnSync = null;
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
            snapshotMap.clear();
        }
        for (var i = 0; i < entities.length; i++) {
            var e = entities[i];
            snapshotMap.set(e.id, e);
            updateRemoteFromSnapshot(e);
        }
        var removedIds = Array.isArray(opts.removedEntityIds) ? opts.removedEntityIds : [];
        for (i = 0; i < removedIds.length; i++) {
            snapshotMap.delete(removedIds[i]);
            GameNetEntities.removeRemoteVisual(removedIds[i]);
        }

        var toRemove = [];
        renderMap.forEach(function (_v, id) {
            if (!snapshotMap.has(id)) toRemove.push(id);
        });
        for (i = 0; i < toRemove.length; i++) {
            GameNetEntities.removeRemoteVisual(toRemove[i]);
        }

        remoteProjectileState = Array.isArray(projectiles) ? projectiles.slice() : [];
        remoteFireZoneState = Array.isArray(fireZones) ? fireZones.slice() : [];
    }

    function initSnapshotHelper() {
        if (!globalThis.__MAYHEM_RUNTIME.GameNetSnapshots || !globalThis.__MAYHEM_RUNTIME.GameNetSnapshots.create) {
            snapshotHelper = null;
            return;
        }
        snapshotHelper = globalThis.__MAYHEM_RUNTIME.GameNetSnapshots.create({
            onEntity: function (entity) {
                updateRemoteFromSnapshot(entity);
            },
            onPrune: function (nextMap) {
                snapshotMap = nextMap;
                var renderMap = GameNetEntities.getRenderMap();
                var toRemove = [];
                renderMap.forEach(function (_v, id) {
                    if (!snapshotMap.has(id)) toRemove.push(id);
                });
                for (var i = 0; i < toRemove.length; i++) {
                    GameNetEntities.removeRemoteVisual(toRemove[i]);
                }
            },
            onProjectiles: function (projectiles) {
                remoteProjectileState = projectiles;
            },
            onFireZones: function (fireZones) {
                remoteFireZoneState = fireZones;
            }
        });
    }

    function damagePointForEntityId(entityId) {
        if (!entityId) return null;

        if (entityId === selfId) {
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

        if (entityId === selfId) {
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
        var pending = pendingWeaponLoadout;
        if (!pending) return false;
        if (!wsSend({
            t: MSG_C2S.WEAPON_LOADOUT,
            slot1: pending.slot1,
            slot2: pending.slot2
        })) return false;
        pendingWeaponLoadout = null;
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
            ? abilityFxView.readAbilityFx(selfState)
            : (selfState && selfState.abilityFx ? selfState.abilityFx : null);
        var selfChokeVictim = selfFx && selfFx.chokeVictim ? selfFx.chokeVictim : null;
        if (selfState && selfState.id === entityId && selfChokeVictim && selfChokeVictim.endsAt > now) {
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

    var messageRouter = globalThis.__MAYHEM_RUNTIME.GameNetMessageRouter.create({
        msgTypes: MSG_S2C,
        runtime: globalThis.__MAYHEM_RUNTIME,
        sanitizeRoomId: sanitizeRoomId,
        buildExpectedWorldMeta: buildExpectedWorldMeta,
        cloneWorldFlags: cloneWorldFlags,
        applySnapshot: applySnapshot,
        pushNotice: pushNotice,
        flushPendingWeaponLoadout: flushPendingWeaponLoadout,
        damagePointForEntityId: damagePointForEntityId,
        getRenderMap: function () { return GameNetEntities.getRenderMap(); },
        getSelfId: function () { return selfId; },
        setSelfId: function (value) { selfId = value; },
        getRoomId: function () { return roomId; },
        setRoomId: function (value) { roomId = value; },
        getGameMode: function () { return gameMode; },
        setGameMode: function (value) { gameMode = value; },
        getPrivateRoomPhase: function () { return privateRoomPhase; },
        setPrivateRoomPhase: function (value) { privateRoomPhase = value; },
        getMatchState: function () { return matchState; },
        setMatchState: function (value) { matchState = value; },
        getSelfState: function () { return selfState; },
        setConnected: function (value) { connected = !!value; },
        setPendingRespawnInfo: function (value) { pendingRespawnInfo = value; },
        setPendingSpawnSync: function (value) { pendingSpawnSync = value; },
        setWorldMeta: function (value) { worldMeta = value; },
        getWorldMismatchNotified: function () { return worldMismatchNotified; },
        setWorldMismatchNotified: function (value) { worldMismatchNotified = !!value; },
        getActiveWorldMeta: runtimeAccess.getActiveWorldMeta,
        throwAckQueue: throwAckQueue,
        throwRejectQueue: throwRejectQueue,
        throwableEventQueue: throwableEventQueue,
        abilityEventQueue: abilityEventQueue,
        classCastResultQueue: classCastResultQueue,
        damageFeedbackQueue: damageFeedbackQueue,
        incomingDamageFeedbackQueue: incomingDamageFeedbackQueue
    });

    function handleMessage(raw) {
        messageRouter.handleMessage(raw);
    }

    var stateView = globalThis.__MAYHEM_RUNTIME.GameNetStateView.create({
        buildExpectedWorldMeta: buildExpectedWorldMeta,
        cloneWorldFlags: cloneWorldFlags,
        classStats: classStats,
        getRoomId: function () { return roomId; },
        getWorldMeta: function () { return worldMeta; },
        getRenderMap: function () { return GameNetEntities.getRenderMap(); },
        getSelfState: function () { return selfState; },
        getSelfId: function () { return selfId; },
        getMatchState: function () { return matchState; },
        getSnapshotMap: function () { return snapshotMap; },
        getInputSeqHistory: function () { return inputSeqHistory; },
        getLastInputSeqSent: function () { return lastInputSeqSent; },
        getLastInputSeqAcked: function () { return lastInputSeqAcked; },
        getInputSendInterval: function () { return INPUT_SEND_INTERVAL; },
        getPendingRespawnInfo: function () { return pendingRespawnInfo; },
        getGameMode: function () { return gameMode; },
        getPrivateRoomPhase: function () { return privateRoomPhase; },
        getRemoteProjectileState: function () { return remoteProjectileState; },
        getRemoteFireZoneState: function () { return remoteFireZoneState; },
        getCurrentUser: function () { return runtimeAccess.getCurrentUser(GameNetAuth); },
        getRenderCoreWorldPosition: getRenderCoreWorldPosition,
        markerPointForEntityId: markerPointForEntityId,
        getChokeVictimStateForEntity: getChokeVictimStateForEntity,
        consumeNotice: consumeNotice,
        throwAckQueue: throwAckQueue,
        throwRejectQueue: throwRejectQueue,
        throwableEventQueue: throwableEventQueue,
        classCastResultQueue: classCastResultQueue,
        damageFeedbackQueue: damageFeedbackQueue,
        incomingDamageFeedbackQueue: incomingDamageFeedbackQueue
    });

    var runtimeCore = globalThis.__MAYHEM_RUNTIME.GameNetRuntimeCore.create({
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
        getPendingRespawnInfo: function () { return pendingRespawnInfo; },
        setPendingRespawnInfo: function (value) { pendingRespawnInfo = value; },
        applyPendingSpawnSync: applyPendingSpawnSync,
        getInputSendTimer: function () { return inputSendTimer; },
        setInputSendTimer: function (value) { inputSendTimer = value; },
        getInputSendInterval: function () { return INPUT_SEND_INTERVAL; },
        getPlayerApi: runtimeAccess.getPlayerApi,
        nextInputSeq: function () {
            var current = inputSeq;
            inputSeq += 1;
            return current;
        },
        getInputSeqHistory: function () { return inputSeqHistory; },
        setLastInputSeqSent: function (value) { lastInputSeqSent = value; },
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

    GameNet.setRoomId = function (nextRoomId) {
        roomId = sanitizeRoomId(nextRoomId);
        worldMeta = null;
        worldMismatchNotified = false;
        return roomId;
    };

    GameNet.getRoomId = function () {
        return roomId;
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

        snapshotMap.clear();
        snapshotHelper = null;
        remoteProjectileState = [];
        remoteFireZoneState = [];
        throwAckQueue.length = 0;
        throwRejectQueue.length = 0;
        throwableEventQueue.length = 0;
        classCastResultQueue.length = 0;
        damageFeedbackQueue.length = 0;
        incomingDamageFeedbackQueue.length = 0;
        notices = [];
        pendingSpawnSync = null;
        pendingRespawnInfo = null;
        initialSpawnApplied = false;
        pendingWeaponLoadout = null;
        lastInputSeqSent = 0;
        lastInputSeqAcked = 0;
        inputSeqHistory = [];
        selfState = null;
        selfId = '';
        matchState = null;
        gameMode = '';
        privateRoomPhase = '';
        worldMeta = null;
        worldMismatchNotified = false;
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
        pendingWeaponLoadout = PROTOCOL.normalizeWeaponLoadoutPayload(slot1, slot2);
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

    globalThis.__MAYHEM_RUNTIME.GameNet = GameNet;
})();
