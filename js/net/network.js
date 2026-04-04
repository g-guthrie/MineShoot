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
    var accessApi = runtime.GameNetAccess && runtime.GameNetAccess.create
        ? runtime.GameNetAccess.create(runtime, assemblyDeps, {})
        : null;
    var configApi = runtime.GameNetConfig || null;
    var firePayloadApi = runtime.GameNetFirePayload || null;
    var loadoutHelper = runtime.GameNetNetworkLoadout && runtime.GameNetNetworkLoadout.create
        ? runtime.GameNetNetworkLoadout.create({
            getNetState: function () { return netState; },
            getProtocol: function () { return PROTOCOL; },
            getConnectionTiming: function () { return connectionTiming; }
        })
        : null;
    var snapshotBufferApi = runtime.GameNetSnapshotBuffer || null;
    var snapshotApplyApi = runtime.GameNetNetworkSnapshotApply || null;

    function runtimeProfileApi() {
        return accessApi && accessApi.runtimeProfile ? accessApi.runtimeProfile() : (runtime.GameRuntimeProfile || null);
    }

    function playerApi() {
        return accessApi && accessApi.playerApi ? accessApi.playerApi() : (runtime.GamePlayer || null);
    }

    function playerCombatApi() {
        return accessApi && accessApi.playerCombatApi ? accessApi.playerCombatApi() : (runtime.GamePlayerCombat || null);
    }

    function transportApi() {
        return accessApi && accessApi.transportApi ? accessApi.transportApi() : (runtime.GameNetTransport || null);
    }

    function remoteSyncApi() {
        return accessApi && accessApi.remoteSyncApi ? accessApi.remoteSyncApi() : (runtime.GameNetRemoteSync || null);
    }

    function hitscanApi() {
        return accessApi && accessApi.hitscanApi ? accessApi.hitscanApi() : (runtime.GameHitscan || null);
    }

    function socketIdentity() {
        if (accessApi && accessApi.socketIdentity) return accessApi.socketIdentity();
        if (GameNetAuth && GameNetAuth.getSocketIdentity) return GameNetAuth.getSocketIdentity();
        return GameNetAuth && GameNetAuth.getUser ? GameNetAuth.getUser() : null;
    }

    function currentUser() {
        if (accessApi && accessApi.currentUser) return accessApi.currentUser();
        if (GameNetAuth && GameNetAuth.getCurrentUser) return GameNetAuth.getCurrentUser();
        return socketIdentity();
    }

    function activeWorldMeta() {
        return accessApi && accessApi.activeWorldMeta ? accessApi.activeWorldMeta() : null;
    }

    function damagePointY(entityY) {
        return accessApi && accessApi.damagePointY ? accessApi.damagePointY(entityY) : (entityY + 1.06);
    }

    function markerPointY(entityY) {
        return accessApi && accessApi.markerPointY ? accessApi.markerPointY(entityY) : (entityY + 2.25);
    }

    function buildWsEndpoint() {
        if (accessApi && accessApi.buildWsEndpoint) {
            return accessApi.buildWsEndpoint({
                roomId: netState.getRoomId,
                socketPlayerId: GameNetAuth && GameNetAuth.getSocketPlayerId ? GameNetAuth.getSocketPlayerId() : null,
                actorIdentity: GameNetAuth && GameNetAuth.getPartyIdentity ? GameNetAuth.getPartyIdentity() : null,
                socketIdentity: socketIdentity(),
                runtimeProfile: runtimeProfileApi(),
                wsPath: WS_URL
            });
        }
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
            params.set('classId', String(user.classId || 'ffa'));
        }
        return endpoint + '?' + params.toString();
    }

    function buildFirePayload(msgType, weaponId, shotToken) {
        if (firePayloadApi && firePayloadApi.buildPayload) {
            return firePayloadApi.buildPayload({
                msgType: msgType,
                weaponId: weaponId,
                shotToken: shotToken,
                fireIntent: hitscanApi() && hitscanApi().buildNetworkFireIntent
                    ? hitscanApi().buildNetworkFireIntent(shotToken)
                    : null,
                player: playerApi(),
                sharedApi: sharedApi,
                connectionTiming: connectionTiming
            });
        }
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
                payload.aimOrigin = sharedPoints.logicalMuzzleOriginFromEye && payload.aimForward
                    ? sharedPoints.logicalMuzzleOriginFromEye(eyeOrigin, payload.aimForward)
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
            getActorVisualFactory: function () { return runtime.GameActorVisualFactory || null; }
        });
    }

    function buildExpectedWorldMeta(roomName) {
        if (configApi && configApi.buildExpectedWorldMeta) {
            return configApi.buildExpectedWorldMeta(roomName || netState.getRoomId() || 'global');
        }
        return PROTOCOL.buildExpectedWorldMeta(roomName || netState.getRoomId() || 'global', PROTOCOL.world);
    }

    function classStats(classId) {
        if (configApi && configApi.classStats) return configApi.classStats(classId);
        return GameNetEntities.classStats(classId);
    }

    function pushNotice(text) {
        if (loadoutHelper && loadoutHelper.pushNotice) {
            loadoutHelper.pushNotice(text);
            return;
        }
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
        if (loadoutHelper && loadoutHelper.seedCommittedWeaponLoadoutPending) {
            loadoutHelper.seedCommittedWeaponLoadoutPending();
            return;
        }
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
        if (loadoutHelper && loadoutHelper.normalizeLoadoutPair) {
            return loadoutHelper.normalizeLoadoutPair(slots);
        }
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
        if (loadoutHelper && loadoutHelper.pendingSelfWeaponLoadout) {
            return loadoutHelper.pendingSelfWeaponLoadout(entity);
        }
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
        return loadoutHelper && loadoutHelper.consumeNotice
            ? loadoutHelper.consumeNotice()
            : netState.consumeNotice();
    }

    function translateSelfEntryState(entity) {
        if (loadoutHelper && loadoutHelper.translateSelfEntryState) {
            return loadoutHelper.translateSelfEntryState(entity);
        }
        if (!entity || entity.id !== netState.getSelfId()) return entity;
        var entryUntil = Number(entity.matchEntryUntil || 0);
        if (!(entryUntil > 0)) return entity;
        var nextEntity = Object.assign({}, entity);
        nextEntity.matchEntryUntil = Number(connectionTiming.toLocalClockTime(entryUntil) || entryUntil);
        return nextEntity;
    }

    function wsEndpoint() {
        return buildWsEndpoint();
    }

    function gameplayNetworkTuning() {
        if (configApi && configApi.gameplayNetworkTuning) return configApi.gameplayNetworkTuning();
        var shared = sharedApi || {};
        return shared.getNetworkTuning ? (shared.getNetworkTuning() || {}) : {};
    }

    function gameplayNetworkFlags() {
        if (configApi && configApi.gameplayNetworkFlags) return configApi.gameplayNetworkFlags();
        return gameplayNetworkTuning().flags || {};
    }

    function replayFirstSelfCorrectionEnabled() {
        if (configApi && configApi.replayFirstSelfCorrectionEnabled) return configApi.replayFirstSelfCorrectionEnabled();
        return gameplayNetworkFlags().replayFirstSelfCorrection !== false;
    }

    function remoteReceiveJitterBufferEnabled() {
        if (configApi && configApi.remoteReceiveJitterBufferEnabled) return configApi.remoteReceiveJitterBufferEnabled();
        return gameplayNetworkFlags().remoteReceiveJitterBuffer !== false;
    }

    function snapshotDeltaCompressionEnabled() {
        if (configApi && configApi.snapshotDeltaCompressionEnabled) return configApi.snapshotDeltaCompressionEnabled();
        return gameplayNetworkFlags().snapshotDeltaCompression !== false;
    }

    function pingCadenceMs() {
        if (configApi && configApi.pingCadenceMs) return configApi.pingCadenceMs();
        var ping = gameplayNetworkTuning().ping || {};
        var raw = Number(ping.cadenceMs || 500);
        if (!isFinite(raw) || raw <= 0) return 500;
        return Math.max(100, raw);
    }

    function cloneSnapshotValue(value) {
        if (snapshotBufferApi && snapshotBufferApi.cloneSnapshotValue) {
            return snapshotBufferApi.cloneSnapshotValue(value, PROTOCOL);
        }
        if (PROTOCOL.cloneSnapshotValue) {
            return PROTOCOL.cloneSnapshotValue(value);
        }
        return value && typeof value === 'object'
            ? JSON.parse(JSON.stringify(value))
            : value;
    }

    function applySnapshotEntityPatch(baseEntity, patch) {
        if (snapshotBufferApi && snapshotBufferApi.applySnapshotEntityPatch) {
            return snapshotBufferApi.applySnapshotEntityPatch(baseEntity, patch, {
                protocol: PROTOCOL,
                cloneSnapshotValue: cloneSnapshotValue
            });
        }
        if (PROTOCOL.applySnapshotEntityPatch) {
            return PROTOCOL.applySnapshotEntityPatch(baseEntity, patch);
        }
        var base = baseEntity && typeof baseEntity === 'object' ? cloneSnapshotValue(baseEntity) : {};
        var nextPatch = patch && typeof patch === 'object' ? patch : null;
        if (!nextPatch || !nextPatch.id) return null;
        base.id = String(nextPatch.id);
        for (var key in nextPatch) {
            if (!Object.prototype.hasOwnProperty.call(nextPatch, key) || key === 'id') continue;
            base[key] = cloneSnapshotValue(nextPatch[key]);
        }
        return base;
    }

    function computeRemoteBufferDelayMs(frame) {
        if (snapshotBufferApi && snapshotBufferApi.computeRemoteBufferDelayMs) {
            return snapshotBufferApi.computeRemoteBufferDelayMs(frame, {
                getConnectionTimingState: connectionTiming.connectionTimingState,
                getRenderMap: function () { return GameNetEntities.getRenderMap(); }
            });
        }
        var timingState = connectionTiming.connectionTimingState ? connectionTiming.connectionTimingState() : null;
        var snapshotState = timingState && timingState.snapshot ? timingState.snapshot : null;
        var cadenceMs = Math.max(0, Number(snapshotState && snapshotState.intervalMs || 0));
        var jitterMs = Math.max(0, Number(snapshotState && snapshotState.jitterMs || 0));
        var baseDelayMs = Math.min(
            180,
            Math.max(60, Math.max((cadenceMs * 1.25) + (jitterMs * 2), 60))
        );
        var extraDelayMs = 0;
        if (frame && Array.isArray(frame.entities)) {
            for (var i = 0; i < frame.entities.length; i++) {
                var entity = frame.entities[i];
                if (!entity || !entity.id) continue;
                var render = GameNetEntities.getRenderMap().get(String(entity.id || ''));
                extraDelayMs = Math.max(extraDelayMs, Math.max(0, Number(render && render.lossDelayPaddingMs || 0)));
            }
        }
        return baseDelayMs + Math.min(120, extraDelayMs);
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
        if (snapshotBufferApi && snapshotBufferApi.enqueueBufferedRemoteFrame) {
            return snapshotBufferApi.enqueueBufferedRemoteFrame(frame, {
                nowMs: Date.now,
                computeRemoteBufferDelayMs: computeRemoteBufferDelayMs,
                enqueueRemoteFrame: netState.enqueueRemoteFrame
            });
        }
        if (!frame) return false;
        var receivedAt = Math.max(0, Number(frame.receivedAt || Date.now()));
        frame.readyAt = receivedAt + computeRemoteBufferDelayMs(frame);
        netState.enqueueRemoteFrame(frame);
        return true;
    }

    function drainBufferedRemoteFrames() {
        if (snapshotBufferApi && snapshotBufferApi.drainBufferedRemoteFrames) {
            snapshotBufferApi.drainBufferedRemoteFrames({
                enabled: remoteReceiveJitterBufferEnabled(),
                nowMs: Date.now,
                peekRemoteFrame: netState.peekRemoteFrame,
                shiftRemoteFrame: netState.shiftRemoteFrame,
                applyFrame: applyBufferedRemoteFrame
            });
            return;
        }
        if (!remoteReceiveJitterBufferEnabled()) return;
        var now = Date.now();
        var nextFrame = netState.peekRemoteFrame ? netState.peekRemoteFrame() : null;
        while (nextFrame && Number(nextFrame.readyAt || 0) <= now) {
            applyBufferedRemoteFrame(netState.shiftRemoteFrame());
            nextFrame = netState.peekRemoteFrame ? netState.peekRemoteFrame() : null;
        }
    }

    function updateRemoteFromSnapshot(entity, snapshotMeta) {
        if (snapshotApplyApi && snapshotApplyApi.updateRemoteFromSnapshot) {
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
        if (!sceneRef) return;
        entity = pendingSelfWeaponLoadout(entity);
        entity = translateSelfEntryState(entity);
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
        if (remoteReceiveJitterBufferEnabled() && remoteFrameCollector) {
            remoteFrameCollector.entities.push(cloneSnapshotValue(entity));
            return;
        }
        if (netState.recordRemoteSnapshotEntity) {
            netState.recordRemoteSnapshotEntity(entity.id, entity, snapshotMeta && snapshotMeta.serverTime);
        }
        GameNetEntities.updateFromSnapshot(entity, snapshotMeta);
    }

    function decodeSnapshotEntities(entities, opts) {
        if (snapshotApplyApi && snapshotApplyApi.decodeSnapshotEntities) {
            return snapshotApplyApi.decodeSnapshotEntities({
                protocol: PROTOCOL,
                netState: netState,
                snapshotDeltaCompressionEnabled: snapshotDeltaCompressionEnabled()
            }, entities, opts);
        }
        var patches = Array.isArray(opts && opts.entityPatches) ? opts.entityPatches : [];
        if (!(snapshotDeltaCompressionEnabled() && opts && opts.delta && patches.length > 0)) {
            return Array.isArray(entities) ? entities : [];
        }
        var baseline = netState.getSnapshotBaseline
            ? netState.getSnapshotBaseline(Math.max(0, Number(opts.baseSnapshotSeq || 0)))
            : null;
        if (!(baseline instanceof Map)) return null;
        var out = [];
        for (var i = 0; i < patches.length; i++) {
            var patch = patches[i];
            if (!patch || !patch.id) return null;
            var entity = applySnapshotEntityPatch(baseline.get(String(patch.id || '')) || null, patch);
            if (!entity || !entity.id) return null;
            out.push(entity);
        }
        return out;
    }

    function applySnapshot(entities, projectiles, fireZones, opts) {
        if (snapshotApplyApi && snapshotApplyApi.applySnapshot) {
            return snapshotApplyApi.applySnapshot({
                protocol: PROTOCOL,
                netState: netState,
                connectionTiming: connectionTiming,
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
        opts = opts || {};
        var shouldValidateSnapshotOrder = Number(opts.snapshotSeq || 0) > 0 || Number(opts.serverTime || 0) > 0;
        if (
            shouldValidateSnapshotOrder &&
            connectionTiming.canAcceptSnapshotTiming &&
            !connectionTiming.canAcceptSnapshotTiming(opts)
        ) {
            return;
        }
        var decodedEntities = decodeSnapshotEntities(entities, opts);
        if (decodedEntities === null) {
            return;
        }
        var acceptedSnapshot = connectionTiming.updateSnapshotTiming(opts);
        if (shouldValidateSnapshotOrder && !acceptedSnapshot) return;
        if (netState.recordRemoteSnapshotTiming) {
            netState.recordRemoteSnapshotTiming(opts.serverTime, opts.receivedAt, opts.snapshotSeq);
        }
        if (remoteReceiveJitterBufferEnabled()) {
            remoteFrameCollector = {
                delta: !!opts.delta,
                snapshotSeq: Math.max(0, Number(opts.snapshotSeq || 0)),
                serverTime: Number(opts.serverTime || 0),
                receivedAt: Number(opts.receivedAt || Date.now()),
                entities: [],
                removedEntityIds: Array.isArray(opts.removedEntityIds) ? opts.removedEntityIds.slice() : [],
                projectiles: projectiles !== undefined ? cloneSnapshotValue(projectiles) : undefined,
                fireZones: fireZones !== undefined ? cloneSnapshotValue(fireZones) : undefined
            };
        }
        if (snapshotHelper && snapshotHelper.applySnapshot) {
            snapshotHelper.applySnapshot(decodedEntities, projectiles, fireZones, opts);
            if (remoteReceiveJitterBufferEnabled() && remoteFrameCollector) {
                enqueueBufferedRemoteFrame(remoteFrameCollector);
                remoteFrameCollector = null;
            }
            if (Number(opts.snapshotSeq || 0) > 0 && netState.rememberSnapshotBaseline) {
                netState.rememberSnapshotBaseline(opts.snapshotSeq, netState.getSnapshotMap());
                netState.setSnapshotAckSeq(opts.snapshotSeq);
            }
            return;
        }
        if (!Array.isArray(decodedEntities)) return;

        var renderMap = GameNetEntities.getRenderMap();
        if (!opts.delta) {
            netState.clearSnapshotMap();
        }
        for (var i = 0; i < decodedEntities.length; i++) {
            var e = decodedEntities[i];
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

        var bufferedCollector = remoteFrameCollector;
        if (remoteReceiveJitterBufferEnabled()) {
            remoteFrameCollector = null;
        }

        if (projectiles !== undefined) {
            netState.setRemoteProjectileState(projectiles);
        }
        if (fireZones !== undefined) {
            netState.setRemoteFireZoneState(fireZones);
        }
        if (remoteReceiveJitterBufferEnabled() && bufferedCollector) {
            enqueueBufferedRemoteFrame(bufferedCollector);
        }
        if (Number(opts.snapshotSeq || 0) > 0 && netState.rememberSnapshotBaseline) {
            netState.rememberSnapshotBaseline(opts.snapshotSeq, netState.getSnapshotMap());
            netState.setSnapshotAckSeq(opts.snapshotSeq);
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
