/**
 * network.js - Global room websocket + remote entity rendering
 * Auth logic lives in net/auth.js (GameNetAuth); thin wrappers kept for backward compat.
 * Remote entity visuals/hitboxes live in net/remote-entities.js (GameNetEntities).
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNet
 */
(function () {
    'use strict';

    var GameNet = {};

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

    var roomId = 'global';
    var selfId = '';
    var selfState = null;
    var matchState = null;
    var gameMode = '';
    var worldMeta = null;
    var worldMismatchNotified = false;
    var pendingSpawnSync = null;
    var pendingRespawnInfo = null;
    var initialSpawnApplied = false;

    var inputSeq = 1;
    var inputSendTimer = 0;
    var INPUT_SEND_INTERVAL = 0.05;

    var snapshotMap = new Map();
    var snapshotHelper = null;

    var remoteProjectileState = [];
    var remoteFireZoneState = [];
    var throwAckQueue = [];
    var throwRejectQueue = [];
    var throwableEventQueue = [];
    var damageFeedbackQueue = [];
    var incomingDamageFeedbackQueue = [];
    var seekerRejectQueue = [];

    var notices = [];

    function cloneWorldFlags(flags) {
        return {
            envV2: !!(flags && flags.envV2),
            terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
        };
    }

    function protocolWorldConfig() {
        return (PROTOCOL && PROTOCOL.world) ? PROTOCOL.world : null;
    }

    function buildExpectedWorldMeta(roomName) {
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
        var u = GameNetAuth.getUser();
        if (u && u.id) {
            params.set('uid', String(u.id));
            params.set('username', String(u.username || u.id));
            params.set('classId', String(u.classId || 'default'));
            if (GameNetAuth.isGuest()) params.set('guest', '1');
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
                y: selfPos.y + 1.1,
                z: selfPos.z
            };
        }

        var render = GameNetEntities.getRenderMap().get(entityId);
        if (!render || !render.group) return null;
        return {
            x: render.group.position.x,
            y: render.group.position.y + 1.06,
            z: render.group.position.z
        };
    }

    function markerPointForEntityId(entityId) {
        if (!entityId) return null;

        if (entityId === selfId && globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition) {
            var selfPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
            return {
                x: selfPos.x,
                y: selfPos.y + 2.2,
                z: selfPos.z
            };
        }

        var render = GameNetEntities.getRenderMap().get(entityId);
        if (!render || !render.group) return null;
        return {
            x: render.group.position.x,
            y: render.group.position.y + 2.25,
            z: render.group.position.z
        };
    }

    function setRemoteSpawnShieldVisual(render, active) {
        if (!render || !render.actorVisual || !render.actorVisual.visual) return;
        render.actorVisual.visual.traverse(function (node) {
            if (!node || !node.isMesh || !node.material) return;
            var mat = node.material;
            if (mat.__spawnShieldBaseOpacity === undefined) {
                mat.__spawnShieldBaseOpacity = (typeof mat.opacity === 'number') ? mat.opacity : 1;
                mat.__spawnShieldBaseTransparent = !!mat.transparent;
            }
            if (active) {
                mat.transparent = true;
                mat.opacity = Math.min(mat.__spawnShieldBaseOpacity, 0.42);
            } else {
                mat.opacity = mat.__spawnShieldBaseOpacity;
                mat.transparent = mat.__spawnShieldBaseTransparent;
            }
            mat.needsUpdate = true;
        });
    }

    function handleMessage(raw) {
        var msg = null;
        try {
            msg = JSON.parse(raw);
        } catch (err) {
            return;
        }
        if (!msg || !msg.t) return;

        if (msg.t === (MSG_S2C.WELCOME || 'welcome')) {
            connected = true;
            selfId = msg.selfId || selfId;
            roomId = sanitizeRoomId(msg.roomId || roomId || 'global');
            gameMode = String(msg.gameMode || gameMode || '').toLowerCase();
            matchState = (msg.matchState && typeof msg.matchState === 'object') ? msg.matchState : null;
            pendingRespawnInfo = null;

            var expectedMeta = buildExpectedWorldMeta(roomId);
            var nextMeta = {
                roomId: roomId,
                worldSeed: (typeof msg.worldSeed === 'string' && msg.worldSeed.trim()) ? msg.worldSeed.trim() : expectedMeta.worldSeed,
                worldProfileVersion: Math.max(1, Math.round(Number(msg.worldProfileVersion) || expectedMeta.worldProfileVersion)),
                worldFlags: cloneWorldFlags((msg.worldFlags && typeof msg.worldFlags === 'object') ? msg.worldFlags : expectedMeta.worldFlags)
            };
            worldMeta = nextMeta;

            if (!msg.worldSeed) {
                pushNotice('Server world metadata missing; using local fallback profile.');
            } else if (
                expectedMeta.worldSeed !== nextMeta.worldSeed ||
                expectedMeta.worldProfileVersion !== nextMeta.worldProfileVersion ||
                expectedMeta.worldFlags.envV2 !== nextMeta.worldFlags.envV2 ||
                expectedMeta.worldFlags.terrainPhysicsV2 !== nextMeta.worldFlags.terrainPhysicsV2
            ) {
                pushNotice('Server world profile differs from local defaults.');
            }

            if (!worldMismatchNotified && globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getWorldMeta) {
                var activeWorldMeta = globalThis.__MAYHEM_RUNTIME.GameWorld.getWorldMeta();
                if (
                    activeWorldMeta &&
                    activeWorldMeta.worldSeed &&
                    (
                        String(activeWorldMeta.worldSeed) !== nextMeta.worldSeed ||
                        Number(activeWorldMeta.worldProfileVersion || 0) !== nextMeta.worldProfileVersion
                    )
                ) {
                    worldMismatchNotified = true;
                    pushNotice('World metadata mismatch with active scene. Rejoin room to resync.');
                }
            }

            pushNotice('Joined room ' + roomId);
            return;
        }

        if (msg.t === (MSG_S2C.SNAPSHOT || 'snapshot')) {
            gameMode = String(msg.gameMode || gameMode || '').toLowerCase();
            matchState = (msg.matchState && typeof msg.matchState === 'object') ? msg.matchState : matchState;
            applySnapshot(msg.entities || [], msg.projectiles || [], msg.fireZones || [], {
                delta: !!msg.delta,
                removedEntityIds: msg.removedEntityIds || []
            });
            return;
        }

        if (msg.t === (MSG_S2C.THROW_SPAWN || 'throw_spawn')) {
            throwAckQueue.push({
                projectileId: msg.projectileId || '',
                ownerId: msg.ownerId || '',
                clientThrowId: msg.clientThrowId || '',
                throwableId: msg.throwableId || ''
            });
            if (throwAckQueue.length > 32) throwAckQueue.shift();
            return;
        }

        if (msg.t === (MSG_S2C.THROW_REJECT || 'throw_reject')) {
            throwRejectQueue.push({
                throwableId: msg.throwableId || '',
                clientThrowId: msg.clientThrowId || '',
                reason: msg.reason || 'rejected'
            });
            if (throwRejectQueue.length > 32) throwRejectQueue.shift();
            return;
        }

        if (msg.t === (MSG_S2C.SEEKER_REJECT || 'seeker_reject')) {
            seekerRejectQueue.push({
                weaponId: msg.weaponId || 'seekergun',
                reason: msg.reason || 'invalid'
            });
            if (seekerRejectQueue.length > 32) seekerRejectQueue.shift();
            return;
        }

        if (
            msg.t === (MSG_S2C.THROW_IMPACT || 'throw_impact') ||
            msg.t === (MSG_S2C.THROW_EXPLODE || 'throw_explode') ||
            msg.t === (MSG_S2C.AOE_END || 'aoe_end')
        ) {
            throwableEventQueue.push(msg);
            if (throwableEventQueue.length > 64) throwableEventQueue.shift();
            return;
        }

        if (msg.t === (MSG_S2C.DAMAGE_EVENT || 'damage_event')) {
            if (selfState && msg.targetId === selfId) {
                if (typeof msg.health === 'number') selfState.hp = msg.health;
                if (typeof msg.armor === 'number') selfState.armor = msg.armor;
                if (msg.killed) selfState.alive = false;
                incomingDamageFeedbackQueue.push({
                    sourcePos: damagePointForEntityId(msg.sourceId || ''),
                    damage: Math.max(0, Number(msg.damage || 0)),
                    hitType: msg.hitType === 'head' ? 'head' : 'body'
                });
                if (incomingDamageFeedbackQueue.length > 32) incomingDamageFeedbackQueue.shift();
            }

            if (msg.targetId && msg.targetId !== selfId) {
                var targetRender = GameNetEntities.getRenderMap().get(msg.targetId);
                if (targetRender) {
                    if (typeof msg.health === 'number') targetRender.hp = msg.health;
                    if (typeof msg.armor === 'number') targetRender.armor = msg.armor;
                    if (msg.killed) targetRender.alive = false;
                }
            }

            if (msg.sourceId === selfId) {
                damageFeedbackQueue.push({
                    targetId: msg.targetId || '',
                    damage: Math.max(0, Number(msg.damage || 0)),
                    hitType: msg.hitType === 'head' ? 'head' : 'body',
                    weaponId: msg.weaponId || '',
                    shotToken: msg.shotToken || '',
                    killed: !!msg.killed,
                    worldPos: damagePointForEntityId(msg.targetId || '')
                });
                if (damageFeedbackQueue.length > 48) damageFeedbackQueue.shift();
            }
            return;
        }

        if (msg.t === (MSG_S2C.DEATH_RESPAWN || 'death_respawn')) {
            if (msg.entityId === selfId) {
                var respawnAt = Math.max(Date.now(), Number(msg.respawnAt || 0));
                pendingRespawnInfo = {
                    active: true,
                    respawnAt: respawnAt
                };
                if (typeof msg.x === 'number' && typeof msg.z === 'number') {
                    pendingSpawnSync = {
                        x: Number(msg.x || 0),
                        z: Number(msg.z || 0),
                        executeAt: respawnAt,
                        kind: 'respawn'
                    };
                } else {
                    pendingSpawnSync = null;
                }
                if (selfState) selfState.alive = false;
            }
            return;
        }

        if (msg.t === (MSG_S2C.ERROR || 'error')) {
            pushNotice(msg.message || 'Server error');
            return;
        }
    }

    function clearReconnectTimer() {
        if (transport && transport.shutdown) {
            transport.shutdown();
            transport = null;
        }
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    function connectWs() {
        if (!active || !GameNetAuth.getUser()) return;
        clearReconnectTimer();

        if (globalThis.__MAYHEM_RUNTIME.GameNetTransport && globalThis.__MAYHEM_RUNTIME.GameNetTransport.create) {
            transport = globalThis.__MAYHEM_RUNTIME.GameNetTransport.create({
                endpoint: wsEndpoint,
                isActive: function () { return active; },
                reconnectMs: 1200,
                onOpen: function (socket) {
                    ws = socket;
                    connected = true;
                    socket.send(JSON.stringify({ t: (MSG_C2S.JOIN_ROOM || 'join_room') }));
                },
                onMessage: handleMessage,
                onClose: function () {
                    connected = false;
                    ws = null;
                },
                onError: function () {
                    connected = false;
                }
            });
            transport.connect();
            return;
        }

        var endpoint = wsEndpoint();
        ws = new WebSocket(endpoint);

        ws.addEventListener('open', function () {
            connected = true;
            ws.send(JSON.stringify({ t: (MSG_C2S.JOIN_ROOM || 'join_room') }));
        });

        ws.addEventListener('message', function (event) {
            handleMessage(event.data);
        });

        ws.addEventListener('close', function () {
            connected = false;
            ws = null;
            if (!active) return;
            reconnectTimer = setTimeout(function () {
                connectWs();
            }, 1200);
        });

        ws.addEventListener('error', function () {
            connected = false;
        });
    }

    function wsSend(msg) {
        if (transport && transport.send) return transport.send(msg);
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify(msg));
        return true;
    }

    function normalizeAngle(rad) {
        while (rad > Math.PI) rad -= Math.PI * 2;
        while (rad < -Math.PI) rad += Math.PI * 2;
        return rad;
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

    GameNet.requireAuth = function (onAuthed) {
        GameNetAuth.requireAuth(onAuthed);
    };

    GameNet.getCurrentUser = function () {
        return GameNetAuth.getCurrentUser();
    };

    GameNet.enableGuestMode = function () {
        return GameNetAuth.enableGuestMode();
    };

    GameNet.setRoomId = function (nextRoomId) {
        roomId = sanitizeRoomId(nextRoomId);
        worldMeta = null;
        worldMismatchNotified = false;
        return roomId;
    };

    GameNet.getRoomId = function () {
        return roomId;
    };

    GameNet.getExpectedWorldMeta = function () {
        var expected = buildExpectedWorldMeta(roomId);
        return {
            roomId: expected.roomId,
            worldSeed: expected.worldSeed,
            worldProfileVersion: expected.worldProfileVersion,
            worldFlags: cloneWorldFlags(expected.worldFlags)
        };
    };

    GameNet.getWorldMeta = function () {
        if (!worldMeta) return null;
        return {
            roomId: worldMeta.roomId,
            worldSeed: worldMeta.worldSeed,
            worldProfileVersion: worldMeta.worldProfileVersion,
            worldFlags: cloneWorldFlags(worldMeta.worldFlags)
        };
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
        connected = false;
        clearReconnectTimer();

        if (ws) {
            try { ws.close(); } catch (err) {}
            ws = null;
        }

        GameNetEntities.cleanup();

        snapshotMap.clear();
        snapshotHelper = null;
        remoteProjectileState = [];
        remoteFireZoneState = [];
        throwAckQueue = [];
        throwRejectQueue = [];
        throwableEventQueue = [];
        damageFeedbackQueue = [];
        seekerRejectQueue = [];
        pendingSpawnSync = null;
        pendingRespawnInfo = null;
        initialSpawnApplied = false;
        selfState = null;
        selfId = '';
        matchState = null;
        gameMode = '';
        worldMeta = null;
        worldMismatchNotified = false;
        GameNetAuth.clearUser();
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

    GameNet.getEntityStateList = function () {
        var out = [];
        GameNetEntities.getRenderMap().forEach(function (r) {
            out.push({
                id: r.id,
                kind: r.kind,
                username: r.username,
                classId: r.classId,
                hp: r.hp,
                hpMax: r.hpMax,
                armor: r.armor,
                armorMax: r.armorMax,
                alive: r.alive,
                worldPos: r.group.position,
                headY: 2.45,
                targetId: 'net:' + r.id
            });
        });
        return out;
    };

    GameNet.getSelfState = function () {
        var u = GameNetAuth.getUser();
        if (!selfState && u) {
            var defaults = classStats(u.classId || 'default');
            return {
                id: u.id,
                hp: 500,
                hpMax: 500,
                armor: defaults.armorMax,
                armorMax: defaults.armorMax,
                classId: u.classId || 'default',
                wallhackRadius: defaults.wallhackRadius,
                throwables: null,
                kills: 0,
                deaths: 0,
                progressScore: 0,
                teamId: '',
                alive: true
            };
        }
        return selfState;
    };

    GameNet.update = function (dt, playerPos, rotation) {
        if (!active) return;

        if (pendingRespawnInfo && pendingRespawnInfo.active && Date.now() >= Number(pendingRespawnInfo.respawnAt || 0)) {
            pendingRespawnInfo = null;
        }
        applyPendingSpawnSync();

        inputSendTimer -= dt;
        if (inputSendTimer <= 0) {
            inputSendTimer = INPUT_SEND_INTERVAL;
            if (playerPos && rotation) {
                var anim = (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getAnimNetState)
                    ? globalThis.__MAYHEM_RUNTIME.GamePlayer.getAnimNetState()
                    : null;
                wsSend({
                    t: (MSG_C2S.INPUT || 'input'),
                    seq: inputSeq++,
                    x: playerPos.x,
                    y: playerPos.y,
                    z: playerPos.z,
                    yaw: rotation.yaw || 0,
                    pitch: rotation.pitch || 0,
                    sprint: !!(anim && anim.sprinting),
                    jump: false,
                    weaponId: (anim && anim.equippedWeaponId) ? anim.equippedWeaponId : 'rifle',
                    moveSpeedNorm: anim && typeof anim.moveSpeedNorm === 'number' ? anim.moveSpeedNorm : 0,
                    sprinting: !!(anim && anim.sprinting)
                });
            }
        }

        GameNetEntities.getRenderMap().forEach(function (r) {
            var lerp = Math.min(1, dt * 10);
            r.group.position.x += (r.targetX - r.group.position.x) * lerp;
            r.group.position.y += ((r.targetFootY || 0) - r.group.position.y) * lerp;
            r.group.position.z += (r.targetZ - r.group.position.z) * lerp;

            var deltaYaw = normalizeAngle(r.targetYaw - r.group.rotation.y);
            r.group.rotation.y += deltaYaw * lerp;

            if (r.rigApi) {
                r.rigApi.setWeapon(r.weaponId || 'rifle');
                r.rigApi.updateAimPitch(r.targetPitch || 0);
                r.rigApi.updateLocomotion(r.moveSpeedNorm || 0, !!r.sprinting, dt, false);
                if (r.rigApi.setMuzzleVisible) {
                    r.rigApi.setMuzzleVisible((r.muzzleFlashUntil || 0) > Date.now());
                }
                if (r.rigApi.applyThrowPose) r.rigApi.applyThrowPose(dt);
            }

            setRemoteSpawnShieldVisual(r, !!(r.spawnShieldUntil && r.spawnShieldUntil > Date.now()));

            if (r.actorVisual && r.actorVisual.syncHitboxes) {
                r.actorVisual.syncHitboxes(r.group.position);
            } else if (r.bodyHitbox && r.headHitbox) {
                r.bodyHitbox.position.set(r.group.position.x, r.group.position.y + 0.7625, r.group.position.z);
                r.headHitbox.position.set(r.group.position.x, r.group.position.y + 2.0, r.group.position.z);
            }
        });
    };

    GameNet.sendFire = function (hitbox, weaponId, hitType, shotToken) {
        if (!hitbox || !hitbox.userData) return false;
        var targetEntityId = String(hitbox.userData.netEntityId || '');
        if (!targetEntityId && typeof hitbox.userData.targetId === 'string' && hitbox.userData.targetId.indexOf('net:') === 0) {
            targetEntityId = String(hitbox.userData.targetId).slice(4);
        }
        if (!targetEntityId) return false;
        var payload = {
            t: (MSG_C2S.FIRE || 'fire'),
            targetId: targetEntityId,
            weaponId: weaponId,
            hitType: hitType === 'head' ? 'head' : 'body'
        };
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState) {
            var adsState = globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState();
            if (adsState && adsState.active) payload.adsActive = true;
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

    GameNet.sendThrow = function (throwableId, clientThrowId, throwIntent) {
        var payload = {
            t: (MSG_C2S.THROW || 'throw'),
            throwableId: throwableId,
            clientThrowId: clientThrowId || ''
        };
        if (throwIntent && throwIntent.origin && throwIntent.direction) {
            payload.throwIntent = {
                origin: {
                    x: Number(throwIntent.origin.x || 0),
                    y: Number(throwIntent.origin.y || 0),
                    z: Number(throwIntent.origin.z || 0)
                },
                direction: {
                    x: Number(throwIntent.direction.x || 0),
                    y: Number(throwIntent.direction.y || 0),
                    z: Number(throwIntent.direction.z || 0)
                },
                aimPoint: throwIntent.aimPoint ? {
                    x: Number(throwIntent.aimPoint.x || 0),
                    y: Number(throwIntent.aimPoint.y || 0),
                    z: Number(throwIntent.aimPoint.z || 0)
                } : null
            };
        }
        return wsSend(payload);
    };

    GameNet.consumeThrowAck = function () {
        if (!throwAckQueue.length) return null;
        return throwAckQueue.shift();
    };

    GameNet.consumeThrowReject = function () {
        if (!throwRejectQueue.length) return null;
        return throwRejectQueue.shift();
    };

    GameNet.consumeThrowableEvent = function () {
        if (!throwableEventQueue.length) return null;
        return throwableEventQueue.shift();
    };

    GameNet.getAuthoritativeThrowableState = function () {
        var selfThrowables = (selfState && selfState.throwables) ? selfState.throwables : null;
        return {
            projectiles: remoteProjectileState.slice(),
            fireZones: remoteFireZoneState.slice(),
            selfThrowables: selfThrowables
        };
    };

    GameNet.sendSeekerShot = function (lockTargetId, throwIntent, clientShotId, weaponId, adsActive) {
        var payload = {
            t: (MSG_C2S.SEEKER_SHOT || 'seeker_shot')
        };
        if (lockTargetId) payload.lockTargetId = String(lockTargetId);
        if (clientShotId) payload.clientShotId = String(clientShotId);
        if (weaponId) payload.weaponId = String(weaponId);
        if (adsActive) payload.adsActive = true;
        if (throwIntent && throwIntent.origin && throwIntent.direction) {
            payload.throwIntent = {
                origin: {
                    x: Number(throwIntent.origin.x || 0),
                    y: Number(throwIntent.origin.y || 0),
                    z: Number(throwIntent.origin.z || 0)
                },
                direction: {
                    x: Number(throwIntent.direction.x || 0),
                    y: Number(throwIntent.direction.y || 0),
                    z: Number(throwIntent.direction.z || 0)
                },
                aimPoint: throwIntent.aimPoint ? {
                    x: Number(throwIntent.aimPoint.x || 0),
                    y: Number(throwIntent.aimPoint.y || 0),
                    z: Number(throwIntent.aimPoint.z || 0)
                } : null
            };
        }
        return wsSend(payload);
    };

    GameNet.consumeSeekerReject = function () {
        if (!seekerRejectQueue.length) return null;
        return seekerRejectQueue.shift();
    };

    GameNet.consumeDamageFeedback = function () {
        if (!damageFeedbackQueue.length) return null;
        return damageFeedbackQueue.shift();
    };

    GameNet.consumeIncomingDamageFeedback = function () {
        if (!incomingDamageFeedbackQueue.length) return null;
        return incomingDamageFeedbackQueue.shift();
    };

    GameNet.getEntityMarkerWorldPos = function (entityId) {
        return markerPointForEntityId(entityId);
    };

    GameNet.getMatchState = function () {
        return matchState ? JSON.parse(JSON.stringify(matchState)) : null;
    };

    GameNet.getRespawnState = function () {
        if (!pendingRespawnInfo || !pendingRespawnInfo.active) return null;
        return {
            active: true,
            respawnAt: Number(pendingRespawnInfo.respawnAt || 0),
            remainingMs: Math.max(0, Number(pendingRespawnInfo.respawnAt || 0) - Date.now())
        };
    };

    GameNet.getGameMode = function () {
        return gameMode || '';
    };

    GameNet.getEntityName = function (entityId) {
        var id = String(entityId || '');
        if (!id) return '';
        if (selfState && id === selfId) return String(selfState.username || selfState.id || '');
        var snapshotEntity = snapshotMap.get(id);
        if (snapshotEntity) return String(snapshotEntity.username || snapshotEntity.id || '');
        var render = GameNetEntities.getRenderMap().get(id);
        return render ? String(render.username || render.id || '') : '';
    };

    GameNet.getLockTargets = function () {
        var out = [];
        GameNetEntities.getRenderMap().forEach(function (r) {
            if (!r || !r.alive) return;
            var worldPos = getRenderCoreWorldPosition(r, new THREE.Vector3());
            if (!worldPos) return;
            out.push({
                targetId: 'net:' + r.id,
                ownerType: 'net',
                worldPos: worldPos,
                hitbox: r.bodyHitbox || null,
                alive: true,
                netEntityId: r.id
            });
        });
        return out;
    };

    GameNet.consumeNotice = function () {
        return consumeNotice();
    };

    GameNet.logout = function () {
        return GameNetAuth.logout()
            .finally(function () {
                GameNet.shutdown();
            });
    };

    globalThis.__MAYHEM_RUNTIME.GameNet = GameNet;
})();
