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
    var worldMeta = null;
    var worldMismatchNotified = false;

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
    var classCastResultQueue = [];
    var damageFeedbackQueue = [];
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
            params.set('classId', String(u.classId || 'abilities'));
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
            return;
        }
        GameNetEntities.updateFromSnapshot(entity);
    }

    function applySnapshot(entities, projectiles, fireZones) {
        if (snapshotHelper && snapshotHelper.applySnapshot) {
            snapshotHelper.applySnapshot(entities, projectiles, fireZones);
            return;
        }
        if (!Array.isArray(entities)) return;

        var renderMap = GameNetEntities.getRenderMap();
        snapshotMap.clear();
        for (var i = 0; i < entities.length; i++) {
            var e = entities[i];
            snapshotMap.set(e.id, e);
            updateRemoteFromSnapshot(e);
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
            applySnapshot(msg.entities || [], msg.projectiles || [], msg.fireZones || []);
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
                    killed: !!msg.killed,
                    worldPos: damagePointForEntityId(msg.targetId || '')
                });
                if (damageFeedbackQueue.length > 48) damageFeedbackQueue.shift();
            }
            return;
        }

        if (msg.t === (MSG_S2C.DEATH_RESPAWN || 'death_respawn')) {
            if (msg.entityId === selfId && globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.respawnRandom) {
                globalThis.__MAYHEM_RUNTIME.GamePlayer.respawnRandom();
            }
            return;
        }

        if (
            msg.t === (MSG_S2C.CLASS_CAST_OK || 'class_cast_ok') ||
            msg.t === (MSG_S2C.CLASS_CAST_REJECT || 'class_cast_reject')
        ) {
            classCastResultQueue.push(msg);
            if (classCastResultQueue.length > 16) classCastResultQueue.shift();
            return;
        }

        if (msg.t === (MSG_S2C.CLASS_CHANGED || 'class_changed')) {
            pushNotice('Ability loadout synced.');
            if (selfState) {
                selfState.classId = msg.classId || selfState.classId;
                selfState.abilityCooldownRemaining = 0;
                selfState.ultimateCooldownRemaining = 0;
            }
            if (msg.abilityLoadout && globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.setLoadout) {
                globalThis.__MAYHEM_RUNTIME.GameAbilities.setLoadout(msg.abilityLoadout.slot1, msg.abilityLoadout.slot2);
            }
            return;
        }

        if (msg.t === (MSG_S2C.CLASS_QUEUED || 'class_queued')) {
            pushNotice('Ability loadout synced.');
            if (selfState) {
                selfState.classId = msg.classId || selfState.classId;
                selfState.abilityCooldownRemaining = 0;
                selfState.ultimateCooldownRemaining = 0;
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

    function getChokeLiftForEntity(entityId) {
        if (!entityId) return 0;
        var now = Date.now();
        var lift = 0;
        GameNetEntities.getRenderMap().forEach(function (r) {
            if (!r.chokeState || !r.chokeState.targetId) return;
            if (r.chokeState.targetId !== entityId) return;
            if (r.chokeState.endsAt && r.chokeState.endsAt > now) {
                lift = Math.max(lift, r.chokeState.liftHeight || 1.0);
            }
        });
        if (selfState && selfState.chokeState && selfState.chokeState.targetId === entityId) {
            if (selfState.chokeState.endsAt && selfState.chokeState.endsAt > now) {
                lift = Math.max(lift, selfState.chokeState.liftHeight || 1.0);
            }
        }
        return lift;
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
        classCastResultQueue = [];
        damageFeedbackQueue = [];
        seekerRejectQueue = [];
        selfState = null;
        selfId = '';
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
            var defaults = classStats(u.classId || 'abilities');
            return {
                id: u.id,
                hp: 500,
                hpMax: 500,
                armor: defaults.armorMax,
                armorMax: defaults.armorMax,
                classId: u.classId || 'abilities',
                wallhackRadius: defaults.wallhackRadius,
                throwables: null,
                alive: true
            };
        }
        return selfState;
    };

    GameNet.update = function (dt, playerPos, rotation) {
        if (!active) return;

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
                r.rigApi.updateLocomotion(r.moveSpeedNorm || 0, !!r.sprinting, dt);
                if (r.rigApi.setMuzzleVisible) {
                    r.rigApi.setMuzzleVisible((r.muzzleFlashUntil || 0) > Date.now());
                }
                if (r.rigApi.applyThrowPose) r.rigApi.applyThrowPose(dt);
                if (r.rigApi.applyChokeGripPose) {
                    if (r.chokeState && r.chokeState.targetId && r.chokeState.endsAt > Date.now()) {
                        if (!r._chokeGripTriggered) {
                            r._chokeGripTriggered = true;
                            r.rigApi.triggerChokeGripPose((r.chokeState.endsAt - Date.now()) / 1000);
                        }
                    } else {
                        r._chokeGripTriggered = false;
                    }
                    r.rigApi.applyChokeGripPose(dt);
                }
            }

            var chokeVictimLift = getChokeLiftForEntity(r.id);
            if (chokeVictimLift > 0) {
                r.group.position.y += chokeVictimLift;
                if (r.rigApi && r.rigApi.rig) {
                    var squirmPhase = Date.now() * 0.012;
                    var squirmAmp = 0.55;
                    var rig = r.rigApi.rig;
                    if (rig.legL) rig.legL.rotation.x = Math.sin(squirmPhase) * squirmAmp;
                    if (rig.legR) rig.legR.rotation.x = Math.sin(squirmPhase + 2.1) * squirmAmp;
                    if (rig.armL) rig.armL.rotation.x = Math.sin(squirmPhase + 1.0) * squirmAmp;
                }
            }

            r.bodyHitbox.position.set(r.group.position.x, r.group.position.y + 0.7625, r.group.position.z);
            r.headHitbox.position.set(r.group.position.x, r.group.position.y + 2.0, r.group.position.z);
        });
    };

    GameNet.sendFire = function (hitbox, weaponId, hitType, shotToken) {
        if (!hitbox || !hitbox.userData || !hitbox.userData.netEntityId) return false;
        var payload = {
            t: (MSG_C2S.FIRE || 'fire'),
            targetId: hitbox.userData.netEntityId,
            weaponId: weaponId,
            hitType: hitType === 'head' ? 'head' : 'body'
        };
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

    GameNet.queueClassChange = function (classId) {
        return wsSend({ t: (MSG_C2S.CLASS_QUEUE || 'class_queue'), classId: classId });
    };

    GameNet.sendAbilityLoadout = function (slot1, slot2) {
        return wsSend({ t: (MSG_C2S.CLASS_QUEUE || 'class_queue'), slot1: slot1, slot2: slot2 });
    };

    GameNet.sendClassCast = function (slot, castData) {
        var payload = { t: (MSG_C2S.CLASS_CAST || 'class_cast'), slot: slot };
        if (castData && castData.aimPoint) {
            payload.aimPoint = {
                x: Number(castData.aimPoint.x || 0),
                y: Number(castData.aimPoint.y || 0),
                z: Number(castData.aimPoint.z || 0)
            };
        }
        if (castData && castData.lockTargetId) {
            payload.lockTargetId = String(castData.lockTargetId);
        }
        return wsSend(payload);
    };

    GameNet.sendAbilityCast = GameNet.sendClassCast;

    GameNet.sendSeekerShot = function (lockTargetId, throwIntent, clientShotId, weaponId) {
        var payload = {
            t: (MSG_C2S.SEEKER_SHOT || 'seeker_shot')
        };
        if (lockTargetId) payload.lockTargetId = String(lockTargetId);
        if (clientShotId) payload.clientShotId = String(clientShotId);
        if (weaponId) payload.weaponId = String(weaponId);
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

    GameNet.consumeClassCastResult = function () {
        if (!classCastResultQueue.length) return null;
        return classCastResultQueue.shift();
    };

    GameNet.consumeDamageFeedback = function () {
        if (!damageFeedbackQueue.length) return null;
        return damageFeedbackQueue.shift();
    };

    GameNet.getEntityMarkerWorldPos = function (entityId) {
        return markerPointForEntityId(entityId);
    };

    GameNet.getSelfAbilityState = function () {
        if (!selfState) return null;
        return {
            abilityCooldownRemaining: selfState.abilityCooldownRemaining || 0,
            ultimateCooldownRemaining: selfState.ultimateCooldownRemaining || 0,
            abilityLoadout: selfState.abilityLoadout || null,
            chokeState: selfState.chokeState || null,
            deadeyeState: selfState.deadeyeState || null
        };
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
