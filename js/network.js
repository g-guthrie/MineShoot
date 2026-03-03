/**
 * network.js - Cloudflare auth + global room websocket + remote entity rendering
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNet
 */
(function () {
    'use strict';

    var GameNet = {};

    var PROTOCOL = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol) ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol : null;
    var AUTH_PATH = (PROTOCOL && PROTOCOL.authPath) ? PROTOCOL.authPath : {};
    var MSG = (PROTOCOL && PROTOCOL.msg) ? PROTOCOL.msg : { c2s: {}, s2c: {} };
    var MSG_C2S = MSG.c2s || {};
    var MSG_S2C = MSG.s2c || {};

    var SESSION_ME_URL = AUTH_PATH.me || '/api/me';
    var SESSION_LOGIN_URL = AUTH_PATH.login || '/api/auth/login';
    var SESSION_LOGOUT_URL = AUTH_PATH.logout || '/api/auth/logout';
    var WS_URL = (PROTOCOL && PROTOCOL.wsPath) ? PROTOCOL.wsPath : '/api/ws';

    var AUTH_COOKIE_HELP = 'Username + 4-digit PIN';

    var active = false;
    var connected = false;
    var ws = null;
    var reconnectTimer = null;
    var transport = null;
    var sceneRef = null;

    var user = null;
    var guestMode = false;
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
    var renderMap = new Map();
    var hitboxArray = [];
    var hitboxVisible = true;
    var REMOTE_EYE_HEIGHT = 1.6;
    var HEAD_HITBOX_LINEAR_SCALE = Math.cbrt(0.7);
    var HEAD_HITBOX_SIZE = {
        x: 1.55 * HEAD_HITBOX_LINEAR_SCALE,
        y: 0.95 * HEAD_HITBOX_LINEAR_SCALE,
        z: 1.55 * HEAD_HITBOX_LINEAR_SCALE
    };

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

    function classWallhackRadiusFor(classId) {
        if (globalThis.__MAYHEM_RUNTIME.GameCombatTuning && globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassWallhackRadius) {
            return globalThis.__MAYHEM_RUNTIME.GameCombatTuning.getClassWallhackRadius(classId);
        }
        var fallback = {
            abilities: 90,
            ninja: 90,
            jedi: 85,
            magician: 100,
            sharpshooter: 115,
            brawler: 75
        };
        return fallback[classId] || fallback.abilities;
    }

    function classStats(classId) {
        var defs = {
            abilities: { armorMax: 90, wallhackRadius: classWallhackRadiusFor('abilities') },
            ninja: { armorMax: 80, wallhackRadius: classWallhackRadiusFor('ninja') },
            jedi: { armorMax: 130, wallhackRadius: classWallhackRadiusFor('jedi') },
            magician: { armorMax: 100, wallhackRadius: classWallhackRadiusFor('magician') },
            sharpshooter: { armorMax: 90, wallhackRadius: classWallhackRadiusFor('sharpshooter') },
            brawler: { armorMax: 150, wallhackRadius: classWallhackRadiusFor('brawler') }
        };
        return defs[classId] || defs.abilities;
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
        var proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        var endpoint = proto + '//' + window.location.host + WS_URL;
        var params = new URLSearchParams();
        params.set('room', String(roomId || 'global'));
        if (user && user.id) {
            params.set('uid', String(user.id));
            params.set('username', String(user.username || user.id));
            params.set('classId', String(user.classId || 'abilities'));
            if (guestMode) params.set('guest', '1');
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

    function makeGuestUser() {
        var nonce = Math.random().toString(36).slice(2, 8).toUpperCase();
        return {
            id: 'guest-' + Date.now().toString(36) + '-' + nonce.toLowerCase(),
            username: 'Guest-' + nonce,
            classId: 'abilities'
        };
    }

    function apiFetch(url, options) {
        options = options || {};
        var cfg = {
            method: options.method || 'GET',
            headers: options.headers || {},
            credentials: 'include'
        };
        if (options.body !== undefined) {
            cfg.body = options.body;
        }
        return fetch(url, cfg);
    }

    function authOverlay() {
        return document.getElementById('auth-overlay');
    }

    function setAuthStatus(msg, isErr) {
        var el = document.getElementById('auth-status');
        if (!el) return;
        el.textContent = msg || '';
        el.style.color = isErr ? '#ff9a9a' : '#d4ffd4';
    }

    function setAuthVisible(visible) {
        var overlay = authOverlay();
        if (!overlay) return;
        overlay.style.display = visible ? 'flex' : 'none';
    }

    function bindAuthForm(onAuthed) {
        var form = document.getElementById('auth-form');
        if (!form) {
            onAuthed(null);
            return;
        }

        var usernameInput = document.getElementById('auth-username');
        var pinInput = document.getElementById('auth-pin');
        var playBtn = document.getElementById('auth-play-btn');
        var logoutBtn = document.getElementById('auth-logout-btn');
        var localBtn = document.getElementById('auth-local-btn');

        function lockForm(lock) {
            if (usernameInput) usernameInput.disabled = lock;
            if (pinInput) pinInput.disabled = lock;
            if (playBtn) playBtn.disabled = lock;
            if (logoutBtn) logoutBtn.disabled = lock;
            if (localBtn) localBtn.disabled = lock;
        }

        function login(username, pin) {
            lockForm(true);
            setAuthStatus('Signing in...', false);

            apiFetch(SESSION_LOGIN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, pin: pin })
            })
                .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
                .then(function (res) {
                    lockForm(false);
                    if (!res.body || !res.body.ok) {
                        setAuthStatus((res.body && res.body.error) || 'Login failed.', true);
                        return;
                    }

                    user = res.body.user;
                    setAuthStatus('Welcome, ' + user.username + '!', false);
                    setAuthVisible(false);
                    onAuthed(user);
                })
                .catch(function () {
                    lockForm(false);
                    setAuthStatus('Network error during login.', true);
                });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var username = usernameInput ? usernameInput.value.trim() : '';
            var pin = pinInput ? pinInput.value.trim() : '';
            if (!username) {
                setAuthStatus('Enter a username.', true);
                return;
            }
            if (!/^\d{4}$/.test(pin)) {
                setAuthStatus('PIN must be exactly 4 digits.', true);
                return;
            }
            login(username, pin);
        });

        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                apiFetch(SESSION_LOGOUT_URL, { method: 'POST' })
                    .finally(function () {
                        user = null;
                        setAuthVisible(true);
                        setAuthStatus('Logged out. ' + AUTH_COOKIE_HELP, false);
                    });
            });
        }

        if (localBtn) {
            localBtn.addEventListener('click', function () {
                lockForm(true);
                user = null;
                setAuthStatus('Bypassed login. Starting local mode...', false);
                setAuthVisible(false);
                onAuthed(null);
            });
        }
    }

    function createRemoteVisual(entity) {
        var group = new THREE.Group();
        var color = entity.kind === 'bot' ? 0x8f5a2d : 0x3772c4;
        var rigApi = null;
        if (globalThis.__MAYHEM_RUNTIME.GameAvatarRig && globalThis.__MAYHEM_RUNTIME.GameAvatarRig.create) {
            rigApi = globalThis.__MAYHEM_RUNTIME.GameAvatarRig.create(entity.kind === 'bot' ? 'bot' : 'remote', {
                bodyColor: color,
                skinColor: 0xd2a77d,
                legColor: entity.kind === 'bot' ? 0x4a3420 : 0x2d2d2d,
                weaponId: entity.weaponId || 'rifle'
            });
            group.add(rigApi.root);
        } else {
            var bodyMat = new THREE.MeshLambertMaterial({ color: color });
            var limbMat = new THREE.MeshLambertMaterial({ color: entity.kind === 'bot' ? 0x4a3420 : 0x2d2d2d });
            var skinMat = new THREE.MeshLambertMaterial({ color: 0xd2a77d });

            var body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), bodyMat);
            body.position.y = 1.0;
            group.add(body);

            var head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skinMat);
            head.position.y = 1.8;
            group.add(head);

            var armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
            armL.position.set(-0.45, 1.0, 0);
            group.add(armL);

            var armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), skinMat);
            armR.position.set(0.45, 1.0, 0);
            group.add(armR);

            var legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), limbMat);
            legL.position.set(-0.18, 0.45, 0);
            group.add(legL);

            var legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), limbMat);
            legR.position.set(0.18, 0.45, 0);
            group.add(legR);
        }

        var bodyHitbox = new THREE.Mesh(
            new THREE.BoxGeometry(2.7, 1.525, 2.7),
            new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: hitboxVisible ? 0.3 : 0,
                wireframe: true,
                color: 0x22bbff,
                depthTest: true
            })
        );
        bodyHitbox.userData = {
            type: 'body',
            ownerType: 'net',
            netEntityId: entity.id,
            targetId: 'net:' + entity.id
        };
        sceneRef.add(bodyHitbox);

        var headHitbox = new THREE.Mesh(
            new THREE.BoxGeometry(HEAD_HITBOX_SIZE.x, HEAD_HITBOX_SIZE.y, HEAD_HITBOX_SIZE.z),
            new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: hitboxVisible ? 0.3 : 0,
                wireframe: true,
                color: 0xff6666,
                depthTest: false
            })
        );
        headHitbox.userData = {
            type: 'head',
            ownerType: 'net',
            netEntityId: entity.id,
            targetId: 'net:' + entity.id
        };
        sceneRef.add(headHitbox);

        group.position.set(
            entity.x,
            ((typeof entity.y === 'number' ? entity.y : REMOTE_EYE_HEIGHT) - REMOTE_EYE_HEIGHT),
            entity.z
        );
        group.rotation.y = (entity.yaw || 0);

        sceneRef.add(group);
        hitboxArray.push(bodyHitbox);
        hitboxArray.push(headHitbox);

        return {
            id: entity.id,
            kind: entity.kind,
            group: group,
            bodyHitbox: bodyHitbox,
            headHitbox: headHitbox,
            rigApi: rigApi,
            targetX: entity.x,
            targetY: entity.y || 1.6,
            targetFootY: ((typeof entity.y === 'number' ? entity.y : REMOTE_EYE_HEIGHT) - REMOTE_EYE_HEIGHT),
            targetZ: entity.z,
            targetYaw: (entity.yaw || 0),
            targetPitch: entity.pitch || 0,
            hp: entity.hp,
            hpMax: entity.hpMax,
            armor: entity.armor,
            armorMax: entity.armorMax,
            classId: entity.classId,
            username: entity.username,
            alive: entity.alive,
            wallhackRadius: entity.wallhackRadius || classStats(entity.classId).wallhackRadius,
            moveSpeedNorm: entity.moveSpeedNorm || 0,
            sprinting: !!entity.sprinting,
            weaponId: entity.weaponId || 'rifle',
            muzzleFlashUntil: entity.muzzleFlashUntil || 0,
            streamHeat: entity.streamHeat || 0,
            streamOverheatedUntil: entity.streamOverheatedUntil || 0
        };
    }

    function removeRemoteVisual(id) {
        var r = renderMap.get(id);
        if (!r) return;

        if (r.group && r.group.parent) r.group.parent.remove(r.group);
        if (r.bodyHitbox && r.bodyHitbox.parent) r.bodyHitbox.parent.remove(r.bodyHitbox);
        if (r.headHitbox && r.headHitbox.parent) r.headHitbox.parent.remove(r.headHitbox);

        var next = [];
        for (var i = 0; i < hitboxArray.length; i++) {
            var hb = hitboxArray[i];
            if (hb !== r.bodyHitbox && hb !== r.headHitbox) next.push(hb);
        }
        hitboxArray = next;

        renderMap.delete(id);
    }

    function ensureRemote(entity) {
        if (!renderMap.has(entity.id)) {
            renderMap.set(entity.id, createRemoteVisual(entity));
        }
        return renderMap.get(entity.id);
    }

    function updateRemoteFromSnapshot(entity) {
        if (!sceneRef) return;
        if (entity.id === selfId) {
            selfState = entity;
            return;
        }

        var r = ensureRemote(entity);
        r.targetX = entity.x;
        r.targetY = entity.y || 1.6;
        r.targetFootY = ((typeof entity.y === 'number' ? entity.y : REMOTE_EYE_HEIGHT) - REMOTE_EYE_HEIGHT);
        r.targetZ = entity.z;
        r.targetYaw = (entity.yaw || 0);
        r.targetPitch = entity.pitch || 0;
        r.hp = entity.hp;
        r.hpMax = entity.hpMax;
        r.armor = entity.armor;
        r.armorMax = entity.armorMax;
        r.classId = entity.classId;
        r.username = entity.username;
        r.alive = entity.alive;
        r.wallhackRadius = entity.wallhackRadius || classStats(entity.classId).wallhackRadius;
        r.moveSpeedNorm = entity.moveSpeedNorm || 0;
        r.sprinting = !!entity.sprinting;
        r.weaponId = entity.weaponId || 'rifle';
        r.streamHeat = entity.streamHeat || 0;
        r.streamOverheatedUntil = entity.streamOverheatedUntil || 0;
        r.muzzleFlashUntil = entity.muzzleFlashUntil || 0;
        r.shadowDashUntil = entity.shadowDashUntil || 0;
        r.chokeState = entity.chokeState || null;

        r.group.visible = !!entity.alive;
        r.bodyHitbox.visible = !!entity.alive;
        r.headHitbox.visible = !!entity.alive;

        if (r.shadowDashUntil && r.shadowDashUntil > Date.now()) {
            r.group.visible = false;
        }
    }

    function applySnapshot(entities, projectiles, fireZones) {
        if (snapshotHelper && snapshotHelper.applySnapshot) {
            snapshotHelper.applySnapshot(entities, projectiles, fireZones);
            return;
        }
        if (!Array.isArray(entities)) return;

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
            removeRemoteVisual(toRemove[i]);
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
                var toRemove = [];
                renderMap.forEach(function (_v, id) {
                    if (!snapshotMap.has(id)) toRemove.push(id);
                });
                for (var i = 0; i < toRemove.length; i++) {
                    removeRemoteVisual(toRemove[i]);
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

        var render = renderMap.get(entityId);
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

        var render = renderMap.get(entityId);
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
                var targetRender = renderMap.get(msg.targetId);
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
            pushNotice('Ability profile synced.');
            if (selfState) {
                selfState.classId = msg.classId || selfState.classId;
                selfState.queuedClassId = null;
                selfState.abilityCooldownRemaining = 0;
                selfState.ultimateCooldownRemaining = 0;
            }
            return;
        }

        if (msg.t === (MSG_S2C.CLASS_QUEUED || 'class_queued')) {
            // Backward compatibility for older Worker versions.
            pushNotice('Ability profile synced.');
            if (selfState) {
                selfState.classId = msg.classId || selfState.classId;
                selfState.queuedClassId = null;
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
        if (!active || !user) return;
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
        renderMap.forEach(function (r) {
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
        bindAuthForm(function (userObj) {
            onAuthed(userObj || user);
        });

        setAuthVisible(true);
        setAuthStatus('Checking session...', false);

        apiFetch(SESSION_ME_URL)
            .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
            .then(function (res) {
                if (res.body && res.body.ok) {
                    user = res.body.user;
                    setAuthVisible(false);
                    onAuthed(user);
                    return;
                }

                setAuthVisible(true);
                setAuthStatus(AUTH_COOKIE_HELP, false);
            })
            .catch(function () {
                setAuthVisible(true);
                setAuthStatus('Could not reach auth API. ' + AUTH_COOKIE_HELP, true);
            });
    };

    GameNet.getCurrentUser = function () {
        if (guestMode && !user) {
            user = makeGuestUser();
        }
        return user;
    };

    GameNet.enableGuestMode = function () {
        guestMode = true;
        if (!user) {
            user = makeGuestUser();
        }
        setAuthVisible(false);
        setAuthStatus('', false);
        return user;
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

        var ids = [];
        renderMap.forEach(function (_v, id) { ids.push(id); });
        for (var i = 0; i < ids.length; i++) removeRemoteVisual(ids[i]);

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
    };

    GameNet.isActive = function () {
        return !!active;
    };

    GameNet.isConnected = function () {
        return !!connected;
    };

    GameNet.getHitboxArray = function () {
        return hitboxArray;
    };

    GameNet.setHitboxVisibility = function (visible) {
        hitboxVisible = !!visible;
        renderMap.forEach(function (r) {
            if (!r.bodyHitbox || !r.headHitbox) return;
            r.bodyHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
            r.headHitbox.material.opacity = hitboxVisible ? 0.3 : 0;
        });
    };

    GameNet.getEntityStateList = function () {
        var out = [];
        renderMap.forEach(function (r) {
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
        if (!selfState && user) {
            var defaults = classStats(user.classId || 'abilities');
            return {
                id: user.id,
                hp: 500,
                hpMax: 500,
                armor: defaults.armorMax,
                armorMax: defaults.armorMax,
                classId: user.classId || 'abilities',
                wallhackRadius: defaults.wallhackRadius,
                queuedClassId: null,
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

        renderMap.forEach(function (r) {
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
            focusShots: selfState.focusShots || 0,
            focusUntil: selfState.focusUntil || 0,
            rageUntil: selfState.rageUntil || 0,
            shadowDashUntil: selfState.shadowDashUntil || 0,
            chokeState: selfState.chokeState || null,
            deadeyeState: selfState.deadeyeState || null
        };
    };

    GameNet.getLockTargets = function () {
        var out = [];
        renderMap.forEach(function (r) {
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
        return apiFetch(SESSION_LOGOUT_URL, { method: 'POST' })
            .finally(function () {
                GameNet.shutdown();
                user = null;
                setAuthVisible(true);
                setAuthStatus('Logged out.', false);
            });
    };

    globalThis.__MAYHEM_RUNTIME.GameNet = GameNet;
})();
