/**
 * network.js - Global room websocket + remote entity rendering
 * Auth logic lives in net/auth.js (GameNetAuth); thin wrappers kept for backward compat.
 * Remote entity visuals/hitboxes live in net/remote-entities.js (GameNetEntities).
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNet
 */
(function () {
    'use strict';

    var GameNet = {};
    var entityPoints = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityPoints) || {};

    var PROTOCOL = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol) ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol : null;
    var MSG = (PROTOCOL && PROTOCOL.msg) ? PROTOCOL.msg : { c2s: {}, s2c: {} };
    var MSG_C2S = MSG.c2s || {};
    var MSG_S2C = MSG.s2c || {};

    var WS_URL = (PROTOCOL && PROTOCOL.wsPath) ? PROTOCOL.wsPath : '/api/ws';

    var GameNetAuth = globalThis.__MAYHEM_RUNTIME.GameNetAuth;
    var GameNetEntities = globalThis.__MAYHEM_RUNTIME.GameNetEntities;

    function runtimeProfile() {
        return globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile || null;
    }

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
    var INPUT_SEND_INTERVAL = 0.05;

    var snapshotMap = new Map();
    var snapshotHelper = null;

    var remoteProjectileState = [];
    var remoteFireZoneState = [];
    var throwAckQueue = [];
    var throwRejectQueue = [];
    var throwableEventQueue = [];
    var classCastResultQueue = [];
    var damageFeedbackQueue = [];
    var incomingDamageFeedbackQueue = [];

    var notices = [];

    function cloneWorldFlags(flags) {
        if (PROTOCOL && typeof PROTOCOL.cloneWorldFlags === 'function') {
            return PROTOCOL.cloneWorldFlags(flags);
        }
        return {
            envV2: !!(flags && flags.envV2),
            terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
        };
    }

    function protocolWorldConfig() {
        return (PROTOCOL && PROTOCOL.world) ? PROTOCOL.world : null;
    }

    function buildExpectedWorldMeta(roomName) {
        if (PROTOCOL && typeof PROTOCOL.buildExpectedWorldMeta === 'function') {
            return PROTOCOL.buildExpectedWorldMeta(roomName, protocolWorldConfig());
        }
        var cfg = protocolWorldConfig();
        var profileVersion = Math.max(1, Math.round(Number(cfg && cfg.profileVersion) || 6));
        var prefix = String((cfg && cfg.seedPrefix) || 'room-env-v6-static');
        var normalizedRoom = sanitizeRoomId(roomName || roomId || 'global');
        return {
            roomId: normalizedRoom,
            worldSeed: prefix + '-' + normalizedRoom,
            worldProfileVersion: profileVersion,
            worldFlags: cloneWorldFlags((cfg && cfg.flags) ? cfg.flags : { envV2: true, terrainPhysicsV2: true })
        };
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
        var runtime = runtimeProfile();
        var endpoint = (runtime && runtime.resolveWsUrl)
            ? runtime.resolveWsUrl(WS_URL)
            : ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + WS_URL);
        var params = new URLSearchParams();
        params.set('room', String(roomId || 'global'));
        if (GameNetAuth.getSocketPlayerId) {
            params.set('pid', String(GameNetAuth.getSocketPlayerId() || ''));
        }
        var actor = GameNetAuth.getPartyIdentity ? GameNetAuth.getPartyIdentity() : null;
        if (actor && actor.id) {
            params.set('actorId', String(actor.id));
            params.set('actorName', String(actor.username || actor.id));
        }
        var u = GameNetAuth.getSocketIdentity ? GameNetAuth.getSocketIdentity() : GameNetAuth.getUser();
        if (u && u.id) {
            params.set('uid', String(u.id));
            params.set('username', String(u.username || u.id));
            params.set('classId', String(u.classId || 'abilities'));
        }
        return endpoint + '?' + params.toString();
    }

    function sanitizeRoomId(raw) {
        if (PROTOCOL && typeof PROTOCOL.sanitizeRoomId === 'function') {
            return PROTOCOL.sanitizeRoomId(raw);
        }
        var id = String(raw || '').toLowerCase().trim();
        id = id.replace(/[^a-z0-9-]/g, '');
        if (!id) return 'global';
        if (id.length > 32) id = id.slice(0, 32);
        return id;
    }

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
        if (!globalThis.__MAYHEM_RUNTIME.GamePlayer || !globalThis.__MAYHEM_RUNTIME.GamePlayer.respawn) return;
        globalThis.__MAYHEM_RUNTIME.GamePlayer.respawn(
            Number(pendingSpawnSync.x || 0),
            Number(pendingSpawnSync.z || 0)
        );
        if (globalThis.__MAYHEM_RUNTIME.GamePlayerCombat && globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.setInvulnTimer) {
            globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.setInvulnTimer(pendingSpawnSync.kind === 'respawn' ? 1.0 : 0.6);
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

        if (entityId === selfId && globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition) {
            var selfPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
            return {
                x: selfPos.x,
                y: entityPoints.entityDamagePointY ? entityPoints.entityDamagePointY(selfPos.y) : (selfPos.y + 1.06),
                z: selfPos.z
            };
        }

        var render = GameNetEntities.getRenderMap().get(entityId);
        if (!render || !render.group) return null;
        return {
            x: render.group.position.x,
            y: entityPoints.entityDamagePointY ? entityPoints.entityDamagePointY(render.group.position.y) : (render.group.position.y + 1.06),
            z: render.group.position.z
        };
    }

    function markerPointForEntityId(entityId) {
        if (!entityId) return null;

        if (entityId === selfId && globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition) {
            var selfPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
            return {
                x: selfPos.x,
                y: entityPoints.entityMarkerPointY ? entityPoints.entityMarkerPointY(selfPos.y) : (selfPos.y + 2.25),
                z: selfPos.z
            };
        }

        var render = GameNetEntities.getRenderMap().get(entityId);
        if (!render || !render.group) return null;
        return {
            x: render.group.position.x,
            y: entityPoints.entityMarkerPointY ? entityPoints.entityMarkerPointY(render.group.position.y) : (render.group.position.y + 2.25),
            z: render.group.position.z
        };
    }

    function normalizeWeaponLoadoutPayload(slot1, slot2) {
        if (PROTOCOL && typeof PROTOCOL.normalizeWeaponLoadoutPayload === 'function') {
            return PROTOCOL.normalizeWeaponLoadoutPayload(slot1, slot2);
        }
        return {
            slot1: String(slot1 || ''),
            slot2: String(slot2 || '')
        };
    }

    function flushPendingWeaponLoadout() {
        var pending = pendingWeaponLoadout;
        if (!pending) return false;
        if (!wsSend({
            t: (MSG_C2S.WEAPON_LOADOUT || 'weapon_loadout'),
            slot1: pending.slot1,
            slot2: pending.slot2
        })) return false;
        pendingWeaponLoadout = null;
        return true;
    }

    function getRenderCoreWorldPosition(render, outVec3) {
        if (!render) return null;
        var out = outVec3 || new THREE.Vector3();
        if (render.rigApi && render.rigApi.getCoreWorldPosition) {
            return render.rigApi.getCoreWorldPosition(out);
        }
        out.copy(render.group.position);
        out.y += 1.0;
        return out;
    }

    function chokeLiftAt(state, now) {
        if (!state) return 0;
        var stamp = Number(now || Date.now());
        var startedAt = Number(state.startedAt || 0);
        var endsAt = Number(state.endsAt || 0);
        if (!(endsAt > stamp)) return 0;
        var maxLift = Number(state.liftHeight || 1.0);
        if (!(endsAt > startedAt)) return maxLift;
        var progress = Math.max(0, Math.min(1, (stamp - startedAt) / (endsAt - startedAt)));
        if (progress <= 0) return 0;
        if (progress >= 1) return 0;
        if (progress < 0.24) return maxLift * Math.sin((progress / 0.24) * (Math.PI * 0.5));
        if (progress > 0.76) return maxLift * Math.cos(((progress - 0.76) / 0.24) * (Math.PI * 0.5));
        return maxLift;
    }

    function getChokeVictimStateForEntity(entityId) {
        if (!entityId) return { lift: 0, liftHeight: 0, startedAt: 0, endsAt: 0 };
        var now = Date.now();
        var selfFx = selfState && selfState.abilityFx ? selfState.abilityFx : null;
        var selfChokeVictim = selfFx && selfFx.chokeVictim ? selfFx.chokeVictim : null;
        if (selfState && selfState.id === entityId && selfChokeVictim && selfChokeVictim.endsAt > now) {
            return {
                lift: chokeLiftAt(selfChokeVictim, now),
                liftHeight: Number(selfChokeVictim.liftHeight || 1.0),
                startedAt: Number(selfChokeVictim.startedAt || 0),
                endsAt: Number(selfChokeVictim.endsAt || 0)
            };
        }
        var render = GameNetEntities.getRenderMap().get(entityId);
        if (render && render.chokeVictimState && render.chokeVictimState.endsAt > now) {
            return {
                lift: chokeLiftAt(render.chokeVictimState, now),
                liftHeight: Number(render.chokeVictimState.liftHeight || 1.0),
                startedAt: Number(render.chokeVictimState.startedAt || 0),
                endsAt: Number(render.chokeVictimState.endsAt || 0)
            };
        }
        return { lift: 0, liftHeight: 0, startedAt: 0, endsAt: 0 };
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
        getActiveWorldMeta: function () {
            return globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getWorldMeta
                ? globalThis.__MAYHEM_RUNTIME.GameWorld.getWorldMeta()
                : null;
        },
        throwAckQueue: throwAckQueue,
        throwRejectQueue: throwRejectQueue,
        throwableEventQueue: throwableEventQueue,
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
        getCurrentUser: function () {
            if (GameNetAuth.getSocketIdentity) return GameNetAuth.getSocketIdentity();
            return GameNetAuth.getUser ? GameNetAuth.getUser() : null;
        },
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
        getSocketIdentity: function () {
            return GameNetAuth.getSocketIdentity ? GameNetAuth.getSocketIdentity() : GameNetAuth.getUser();
        },
        nextConnectAttemptSeq: function () {
            connectAttemptSeq += 1;
            return connectAttemptSeq;
        },
        getConnectAttemptSeq: function () { return connectAttemptSeq; },
        getTransportApi: function () { return globalThis.__MAYHEM_RUNTIME.GameNetTransport || null; },
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
        getPlayerApi: function () { return globalThis.__MAYHEM_RUNTIME.GamePlayer || null; },
        nextInputSeq: function () {
            var current = inputSeq;
            inputSeq += 1;
            return current;
        },
        getInputSeqHistory: function () { return inputSeqHistory; },
        setLastInputSeqSent: function (value) { lastInputSeqSent = value; },
        getInputMessageType: function () { return MSG_C2S.INPUT || 'input'; },
        getRemoteSyncApi: function () { return globalThis.__MAYHEM_RUNTIME.GameNetRemoteSync || null; },
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
        if (!weaponId) return false;
        var payload = {
            t: (MSG_C2S.FIRE || 'fire'),
            weaponId: String(weaponId)
        };
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState) {
            var adsState = globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState();
            if (adsState && adsState.active) payload.adsActive = true;
        }
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getCamera) {
            var camera = globalThis.__MAYHEM_RUNTIME.GamePlayer.getCamera();
            var cameraFov = Number(camera && camera.fov);
            if (isFinite(cameraFov) && cameraFov > 0.0001) payload.viewFovDeg = cameraFov;
        }
        if (shotToken) payload.shotToken = String(shotToken);
        return wsSend(payload);
    };

    GameNet.sendEquipWeapon = function (weaponId) {
        if (!weaponId) return false;
        return wsSend({
            t: (MSG_C2S.EQUIP_WEAPON || 'equip_weapon'),
            weaponId: String(weaponId)
        });
    };

    GameNet.sendWeaponLoadout = function (slot1, slot2) {
        pendingWeaponLoadout = normalizeWeaponLoadoutPayload(slot1, slot2);
        return flushPendingWeaponLoadout();
    };

    GameNet.sendThrow = function (throwableId, clientThrowId, throwIntent) {
        var payload = (PROTOCOL && typeof PROTOCOL.normalizeThrowPayload === 'function')
            ? PROTOCOL.normalizeThrowPayload(throwableId, clientThrowId, throwIntent)
            : {
                t: (MSG_C2S.THROW || 'throw'),
                throwableId: String(throwableId || ''),
                clientThrowId: String(clientThrowId || '')
            };
        return wsSend(payload);
    };

    GameNet.consumeThrowAck = stateView.consumeThrowAck;
    GameNet.consumeThrowReject = stateView.consumeThrowReject;
    GameNet.consumeThrowableEvent = stateView.consumeThrowableEvent;
    GameNet.getAuthoritativeThrowableState = stateView.getAuthoritativeThrowableState;

    GameNet.sendAbilityLoadout = function (slot1, slot2) {
        var payload = (PROTOCOL && typeof PROTOCOL.normalizeAbilityLoadoutPayload === 'function')
            ? PROTOCOL.normalizeAbilityLoadoutPayload(slot1, slot2)
            : { t: (MSG_C2S.CLASS_QUEUE || 'class_queue'), slot1: String(slot1 || ''), slot2: String(slot2 || '') };
        return wsSend(payload);
    };

    GameNet.sendClassCast = function (slot, castData) {
        var payload = (PROTOCOL && typeof PROTOCOL.normalizeClassCastPayload === 'function')
            ? PROTOCOL.normalizeClassCastPayload(slot, castData)
            : { t: (MSG_C2S.CLASS_CAST || 'class_cast'), slot: Number(slot || 0) };
        return wsSend(payload);
    };

    GameNet.sendAbilityCast = GameNet.sendClassCast;


    GameNet.consumeClassCastResult = stateView.consumeClassCastResult;
    GameNet.consumeDamageFeedback = stateView.consumeDamageFeedback;
    GameNet.consumeIncomingDamageFeedback = stateView.consumeIncomingDamageFeedback;
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
