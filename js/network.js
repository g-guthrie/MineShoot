/**
 * network.js - Cloudflare auth + global room websocket + remote entity rendering
 * Loaded as global: window.GameNet
 */
(function () {
    'use strict';

    var GameNet = {};

    var SESSION_ME_URL = '/api/me';
    var SESSION_LOGIN_URL = '/api/auth/login';
    var SESSION_LOGOUT_URL = '/api/auth/logout';
    var WORLD_BOOTSTRAP_URL = '/api/world/bootstrap';
    var WS_URL = '/api/ws';

    var AUTH_COOKIE_HELP = 'Username + 4-digit PIN';

    var active = false;
    var connected = false;
    var ws = null;
    var reconnectTimer = null;
    var sceneRef = null;

    var user = null;
    var selfId = '';
    var selfState = null;
    var worldManifest = null;

    var inputSeq = 1;
    var inputSendTimer = 0;
    var INPUT_SEND_INTERVAL = 0.05;
    var lastChunkKey = '';

    var snapshotMap = new Map();
    var renderMap = new Map();
    var hitboxArray = [];
    var hitboxVisible = true;
    var beamScratchA = new THREE.Vector3();
    var beamScratchB = new THREE.Vector3();
    var PRIM = globalThis.__GAME_PRIMITIVES__ || {};
    var SCHEMA = globalThis.__GAME_SCHEMA__ || {};
    var COMBAT_PRIM = PRIM.combat || {};
    var CLASS_PRESETS = COMBAT_PRIM.class_presets || {};
    var MAX_HP = Number(COMBAT_PRIM.max_hp || 500);
    var COORDS_PRIM = PRIM.coords || {};
    var HITBOX_PRIM = PRIM.hitboxes || {};
    var BODY_HITBOX_OFFSET_Y = Number(COORDS_PRIM.body_hitbox_offset_y || 1.0);
    var HEAD_HITBOX_OFFSET_Y = Number(COORDS_PRIM.head_hitbox_offset_y || 2.475);
    var OVERHEAD_OFFSET_Y = Number(COORDS_PRIM.overhead_bar_offset_y || 2.9);
    var CORE_OFFSET_Y = Number(COORDS_PRIM.core_anchor_offset_y || 1.0);
    var MUZZLE_FALLBACK_OFFSET_Y = Number(COORDS_PRIM.muzzle_fallback_offset_y || 1.45);

    var REMOTE_BEAM_HOLD_MS = 180;

    var notices = [];

    function classStats(classId) {
        var defs = CLASS_PRESETS;
        if (!defs || Object.keys(defs).length === 0) {
            defs = {
                ninja: { armorMax: 80, wallhackRadius: 90 },
                jedi: { armorMax: 130, wallhackRadius: 85 },
                magician: { armorMax: 100, wallhackRadius: 100 },
                sharpshooter: { armorMax: 90, wallhackRadius: 115 },
                brawler: { armorMax: 150, wallhackRadius: 75 }
            };
        }
        return defs[classId] || defs.sharpshooter;
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
        return proto + '//' + window.location.host + WS_URL;
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

    function fetchWorldManifest() {
        return apiFetch(WORLD_BOOTSTRAP_URL)
            .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
            .then(function (res) {
                if (!res.body || !res.body.ok) {
                    throw new Error((res.body && res.body.error) || 'world_bootstrap_unavailable');
                }
                if (!res.body.world || typeof res.body.world !== 'object') {
                    throw new Error('world_bootstrap_missing_manifest');
                }
                worldManifest = res.body.world;
                if (typeof res.body.chunkSize === 'number') worldManifest.chunkSize = res.body.chunkSize;
                if (typeof res.body.interestRadiusChunks === 'number') worldManifest.interestRadiusChunks = res.body.interestRadiusChunks;
                if (Array.isArray(res.body.initialChunks) && !Array.isArray(worldManifest.initialChunks)) {
                    worldManifest.initialChunks = res.body.initialChunks;
                }
                return worldManifest;
            });
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
        if (window.GameUIShell) {
            if (visible && window.GameUIShell.showAuthOverlay) {
                window.GameUIShell.showAuthOverlay();
                return;
            }
            if (!visible && window.GameUIShell.hideAuthOverlay) {
                window.GameUIShell.hideAuthOverlay();
                return;
            }
        }
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
        if (!window.GameAvatarRig || !window.GameAvatarRig.create) {
            throw new Error('GameAvatarRig is required for remote entity rendering.');
        }
        var group = new THREE.Group();
        var color = entity.kind === 'bot' ? 0x8f5a2d : 0x3772c4;
        var rigApi = window.GameAvatarRig.create(entity.kind === 'bot' ? 'bot' : 'remote', {
            bodyColor: color,
            skinColor: 0xd2a77d,
            legColor: entity.kind === 'bot' ? 0x4a3420 : 0x2d2d2d,
            weaponId: entity.weaponId || 'rifle'
        });
        group.add(rigApi.root);

        var bodySize = (HITBOX_PRIM.body && HITBOX_PRIM.body.size) || [2.7, 2.0, 2.7];
        var headSize = (HITBOX_PRIM.head && HITBOX_PRIM.head.size) || [1.55, 0.95, 1.55];

        var bodyHitbox = new THREE.Mesh(
            new THREE.BoxGeometry(bodySize[0], bodySize[1], bodySize[2]),
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
            new THREE.BoxGeometry(headSize[0], headSize[1], headSize[2]),
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
            (typeof entity.feetY === 'number' ? entity.feetY : 0),
            entity.z
        );
        group.rotation.y = (entity.yaw || 0) + Math.PI;

        sceneRef.add(group);
        hitboxArray.push(bodyHitbox);
        hitboxArray.push(headHitbox);

        var beamGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(),
            new THREE.Vector3()
        ]);
        var beamMat = new THREE.LineBasicMaterial({
            color: 0x66ddff,
            transparent: true,
            opacity: 0.85,
            depthTest: false
        });
        var beamLine = new THREE.Line(beamGeom, beamMat);
        beamLine.visible = false;
        beamLine.renderOrder = 25;
        sceneRef.add(beamLine);

        return {
            id: entity.id,
            kind: entity.kind,
            group: group,
            bodyHitbox: bodyHitbox,
            headHitbox: headHitbox,
            rigApi: rigApi,
            targetX: entity.x,
            targetFeetY: (typeof entity.feetY === 'number' ? entity.feetY : 0),
            targetZ: entity.z,
            targetYaw: (entity.yaw || 0) + Math.PI,
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
            animState: entity.animState || 'idle',
            animPhase: (typeof entity.animPhase === 'number') ? entity.animPhase : 0,
            gripMode: entity.gripMode || 'two_hand',
            aimPitch: (typeof entity.aimPitch === 'number') ? entity.aimPitch : (entity.pitch || 0),
            weaponId: entity.weaponId || 'rifle',
            beamTargetId: entity.beamTargetId || '',
            beamActiveUntil: entity.beamActiveUntil || 0,
            beamHeat: entity.beamHeat || 0,
            beamOverheated: !!entity.beamOverheated,
            beamLine: beamLine
        };
    }

    function removeRemoteVisual(id) {
        var r = renderMap.get(id);
        if (!r) return;

        if (r.group && r.group.parent) r.group.parent.remove(r.group);
        if (r.bodyHitbox && r.bodyHitbox.parent) r.bodyHitbox.parent.remove(r.bodyHitbox);
        if (r.headHitbox && r.headHitbox.parent) r.headHitbox.parent.remove(r.headHitbox);
        if (r.beamLine && r.beamLine.parent) r.beamLine.parent.remove(r.beamLine);

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
        r.targetFeetY = (typeof entity.feetY === 'number' ? entity.feetY : 0);
        r.targetZ = entity.z;
        r.targetYaw = (entity.yaw || 0) + Math.PI;
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
        r.animState = entity.animState || 'idle';
        r.animPhase = (typeof entity.animPhase === 'number') ? entity.animPhase : 0;
        r.gripMode = entity.gripMode || 'two_hand';
        r.aimPitch = (typeof entity.aimPitch === 'number') ? entity.aimPitch : (entity.pitch || 0);
        r.weaponId = entity.weaponId || 'rifle';
        r.beamTargetId = entity.beamTargetId || '';
        r.beamActiveUntil = entity.beamActiveUntil || 0;
        r.beamHeat = entity.beamHeat || 0;
        r.beamOverheated = !!entity.beamOverheated;

        r.group.visible = !!entity.alive;
        r.bodyHitbox.visible = !!entity.alive;
        r.headHitbox.visible = !!entity.alive;
    }

    function applySnapshot(entities) {
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
    }

    function handleMessage(raw) {
        var msg = null;
        try {
            msg = JSON.parse(raw);
        } catch (err) {
            return;
        }
        if (!msg || !msg.t) return;

        if (msg.t === 'welcome') {
            connected = true;
            selfId = msg.selfId || selfId;
            if (worldManifest) {
                if (typeof msg.chunkSize === 'number') worldManifest.chunkSize = msg.chunkSize;
                if (typeof msg.interestRadiusChunks === 'number') worldManifest.interestRadiusChunks = msg.interestRadiusChunks;
            }
            pushNotice('Joined room ' + (msg.roomId || 'global'));
            return;
        }

        if (msg.t === 'entity_snapshot') {
            if (SCHEMA.validateServerEntitySnapshot) {
                var validated = SCHEMA.validateServerEntitySnapshot(msg);
                if (!validated.ok) {
                    pushNotice('Invalid entity snapshot dropped (' + validated.errors[0] + ')');
                    return;
                }
                applySnapshot(validated.value.entities || []);
                return;
            }
            applySnapshot(msg.entities || []);
            return;
        }

        if (msg.t === 'throwable_snapshot') {
            if (SCHEMA.validateThrowableSnapshot) {
                var throwableSnapValidated = SCHEMA.validateThrowableSnapshot(msg);
                if (!throwableSnapValidated.ok) {
                    pushNotice('Invalid throwable snapshot dropped (' + throwableSnapValidated.errors[0] + ')');
                    return;
                }
            }
            if (window.GameThrowables && window.GameThrowables.applyAuthoritativeSnapshot) {
                window.GameThrowables.applyAuthoritativeSnapshot(msg);
            }
            return;
        }

        if (msg.t === 'throwable_event') {
            if (SCHEMA.validateThrowableEvent) {
                var throwableEventValidated = SCHEMA.validateThrowableEvent(msg);
                if (!throwableEventValidated.ok) {
                    pushNotice('Invalid throwable event dropped (' + throwableEventValidated.errors[0] + ')');
                    return;
                }
            }
            if (window.GameThrowables && window.GameThrowables.applyAuthoritativeEvent) {
                window.GameThrowables.applyAuthoritativeEvent(msg);
            }
            return;
        }

        if (msg.t === 'chunk_snapshot') {
            if (SCHEMA.validateChunkSnapshot) {
                var chunkValidated = SCHEMA.validateChunkSnapshot(msg);
                if (!chunkValidated.ok) {
                    pushNotice('Invalid chunk snapshot dropped (' + chunkValidated.errors[0] + ')');
                    return;
                }
            }
            if (window.GameWorld && window.GameWorld.applyChunkSnapshot && msg.chunk) {
                window.GameWorld.applyChunkSnapshot(msg.chunk);
            }
            return;
        }

        if (msg.t === 'chunk_delta') {
            if (SCHEMA.validateChunkDelta) {
                var deltaValidated = SCHEMA.validateChunkDelta(msg);
                if (!deltaValidated.ok) {
                    pushNotice('Invalid chunk delta dropped (' + deltaValidated.errors[0] + ')');
                    return;
                }
            }
            if (window.GameWorld && window.GameWorld.applyChunkDelta) {
                window.GameWorld.applyChunkDelta(msg);
            }
            return;
        }

        if (msg.t === 'server_reconcile') {
            if (SCHEMA.validateServerReconcile) {
                var recValidated = SCHEMA.validateServerReconcile(msg);
                if (!recValidated.ok) {
                    pushNotice('Invalid reconcile dropped (' + recValidated.errors[0] + ')');
                    return;
                }
            }
            if (window.GamePlayer && window.GamePlayer.applyServerReconcile) {
                window.GamePlayer.applyServerReconcile(msg);
            }
            return;
        }

        if (msg.t === 'damage_event') {
            if (selfState && msg.targetId === selfId) {
                if (typeof msg.health === 'number') selfState.hp = msg.health;
                if (typeof msg.armor === 'number') selfState.armor = msg.armor;
            }
            return;
        }

        if (msg.t === 'death_respawn') {
            if (msg.entityId === selfId) {
                pushNotice('Respawning...');
            }
            return;
        }

        if (msg.t === 'class_queued') {
            pushNotice('Class queued: ' + msg.classId);
            if (selfState) selfState.queuedClassId = msg.classId;
            return;
        }

        if (msg.t === 'error') {
            pushNotice(msg.message || 'Server error');
            return;
        }
    }

    function clearReconnectTimer() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    function connectWs() {
        if (!active || !user) return;
        clearReconnectTimer();

        var endpoint = wsEndpoint();
        ws = new WebSocket(endpoint);

        ws.addEventListener('open', function () {
            connected = true;
            ws.send(JSON.stringify({ t: 'join_room' }));
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
        if (msg && SCHEMA.validateWsClientMessage) {
            var checked = SCHEMA.validateWsClientMessage(msg);
            if (!checked.ok) {
                if (window.__DEV__) console.warn('[net] invalid payload:', checked.errors);
                return false;
            }
        }
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify(msg));
        return true;
    }

    function normalizeAngle(rad) {
        while (rad > Math.PI) rad -= Math.PI * 2;
        while (rad < -Math.PI) rad += Math.PI * 2;
        return rad;
    }

    function chunkSizeValue() {
        if (worldManifest && typeof worldManifest.chunkSize === 'number' && isFinite(worldManifest.chunkSize)) {
            return Math.max(4, Math.floor(worldManifest.chunkSize));
        }
        if (window.GameWorld && window.GameWorld.getChunkConfig) {
            var cfg = window.GameWorld.getChunkConfig();
            if (cfg && typeof cfg.chunkSize === 'number' && isFinite(cfg.chunkSize)) {
                return Math.max(4, Math.floor(cfg.chunkSize));
            }
        }
        return 16;
    }

    function chunkCoordsForPosition(pos) {
        var size = chunkSizeValue();
        return {
            cx: Math.floor((pos && typeof pos.x === 'number' ? pos.x : 0) / size),
            cz: Math.floor((pos && typeof pos.z === 'number' ? pos.z : 0) / size)
        };
    }

    function getRenderCoreWorldPosition(render, outVec3) {
        if (!render) return null;
        var out = outVec3 || new THREE.Vector3();
        if (render.rigApi && render.rigApi.getCoreWorldPosition) {
            return render.rigApi.getCoreWorldPosition(out);
        }
        out.copy(render.group.position);
        out.y += CORE_OFFSET_Y;
        return out;
    }

    function getRenderMuzzleWorldPosition(render, outVec3) {
        if (!render) return null;
        var out = outVec3 || new THREE.Vector3();
        if (render.rigApi && render.rigApi.getMuzzleWorldPosition) {
            return render.rigApi.getMuzzleWorldPosition(out);
        }
        out.copy(render.group.position);
        out.y += MUZZLE_FALLBACK_OFFSET_Y;
        return out;
    }

    function resolveBeamTargetPosition(targetId, outVec3) {
        if (!targetId) return null;
        var out = outVec3 || new THREE.Vector3();

        if (targetId === selfId && window.GamePlayer && window.GamePlayer.getFeetPosition) {
            var selfPos = window.GamePlayer.getFeetPosition();
            out.copy(selfPos);
            out.y += CORE_OFFSET_Y;
            return out;
        }

        var render = renderMap.get(targetId);
        if (!render) return null;
        return getRenderCoreWorldPosition(render, out);
    }

    function setBeamPoints(line, start, end) {
        if (!line || !line.geometry || !line.geometry.attributes || !line.geometry.attributes.position) return;
        var arr = line.geometry.attributes.position.array;
        arr[0] = start.x; arr[1] = start.y; arr[2] = start.z;
        arr[3] = end.x; arr[4] = end.y; arr[5] = end.z;
        line.geometry.attributes.position.needsUpdate = true;
        line.geometry.computeBoundingSphere();
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
        return user;
    };

    GameNet.fetchWorldManifest = function () {
        return fetchWorldManifest();
    };

    GameNet.getWorldManifest = function () {
        return worldManifest;
    };

    GameNet.init = function (scene) {
        sceneRef = scene;
        active = true;
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
        selfState = null;
        selfId = '';
        worldManifest = null;
        lastChunkKey = '';
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
                headY: OVERHEAD_OFFSET_Y,
                targetId: 'net:' + r.id
            });
        });
        return out;
    };

    GameNet.getSelfState = function () {
        if (!selfState && user) {
            var defaults = classStats(user.classId || 'sharpshooter');
            return {
                id: user.id,
                hp: MAX_HP,
                hpMax: MAX_HP,
                armor: defaults.armorMax,
                armorMax: defaults.armorMax,
                classId: user.classId || 'sharpshooter',
                wallhackRadius: defaults.wallhackRadius,
                queuedClassId: null,
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
                var feetPos = (window.GamePlayer && window.GamePlayer.getFeetPosition)
                    ? window.GamePlayer.getFeetPosition()
                    : playerPos;
                var inputDebug = (window.GamePlayer && window.GamePlayer.getInputStateDebug)
                    ? window.GamePlayer.getInputStateDebug()
                    : null;
                var keys = (inputDebug && inputDebug.keys) ? inputDebug.keys : {};
                var moveX = 0;
                var moveZ = 0;
                if (keys.left) moveX -= 1;
                if (keys.right) moveX += 1;
                if (keys.forward) moveZ += 1;
                if (keys.backward) moveZ -= 1;
                var len = Math.sqrt((moveX * moveX) + (moveZ * moveZ));
                if (len > 0.001) {
                    moveX /= len;
                    moveZ /= len;
                }
                wsSend({
                    t: 'input',
                    seq: inputSeq++,
                    moveX: moveX,
                    moveZ: moveZ,
                    jumpHeld: !!keys.jump,
                    sprint: !!keys.sprint,
                    yaw: rotation.yaw || 0,
                    pitch: rotation.pitch || 0,
                    cameraMode: (window.GamePlayer && window.GamePlayer.getPerspective && window.GamePlayer.getPerspective() === 'third') ? 'third' : 'first',
                    actions: []
                });

                var chunk = chunkCoordsForPosition(feetPos);
                var chunkKey = String(chunk.cx) + ':' + String(chunk.cz);
                if (chunkKey !== lastChunkKey) {
                    lastChunkKey = chunkKey;
                    wsSend({
                        t: 'chunk_subscribe',
                        centerChunkX: chunk.cx,
                        centerChunkZ: chunk.cz
                    });
                }
            }
        }

        renderMap.forEach(function (r) {
            var lerp = Math.min(1, dt * 10);
            r.group.position.x += (r.targetX - r.group.position.x) * lerp;
            r.group.position.y += ((r.targetFeetY || 0) - r.group.position.y) * lerp;
            r.group.position.z += (r.targetZ - r.group.position.z) * lerp;

            var deltaYaw = normalizeAngle(r.targetYaw - r.group.rotation.y);
            r.group.rotation.y += deltaYaw * lerp;

            if (r.rigApi) {
                r.rigApi.setWeapon(r.weaponId || 'rifle');
                if (r.rigApi.setMotionState) {
                    r.rigApi.setMotionState({
                        speedNorm: r.moveSpeedNorm || 0,
                        sprinting: !!r.sprinting,
                        grounded: (r.animState !== 'airborne'),
                        strafing: (r.animState === 'strafe'),
                        animState: r.animState || 'idle'
                    });
                }
                if (r.rigApi.setActionState) {
                    r.rigApi.setActionState({
                        aiming: true,
                        firing: false
                    });
                }
                if (r.rigApi.updateAimPitch) {
                    r.rigApi.updateAimPitch((typeof r.aimPitch === 'number') ? r.aimPitch : (r.targetPitch || 0));
                }
                if (r.rigApi.updatePose) {
                    r.rigApi.updatePose(dt, r.animPhase || 0);
                } else if (r.rigApi.updateLocomotion) {
                    r.rigApi.updateLocomotion(r.moveSpeedNorm || 0, !!r.sprinting, dt);
                }
            }

            r.bodyHitbox.position.set(r.group.position.x, r.group.position.y + BODY_HITBOX_OFFSET_Y, r.group.position.z);
            r.headHitbox.position.set(r.group.position.x, r.group.position.y + HEAD_HITBOX_OFFSET_Y, r.group.position.z);

            if (r.beamLine) {
                var beamActive = !!r.alive && r.beamTargetId && (r.beamActiveUntil || 0) > Date.now();
                if (beamActive) {
                    var beamStart = getRenderMuzzleWorldPosition(r, beamScratchA);
                    var beamEnd = resolveBeamTargetPosition(r.beamTargetId, beamScratchB);
                    if (beamStart && beamEnd) {
                        setBeamPoints(r.beamLine, beamStart, beamEnd);
                        r.beamLine.visible = true;
                        r.beamLine.material.opacity = r.beamOverheated ? 0.2 : 0.85;
                    } else {
                        r.beamLine.visible = false;
                    }
                } else {
                    r.beamLine.visible = false;
                }
            }
        });
    };

    GameNet.sendFireIntent = function (weaponId, fireMode) {
        if (!weaponId) return false;
        return wsSend({
            t: 'fire_intent',
            seq: inputSeq++,
            weaponId: String(weaponId),
            fireMode: String(fireMode || 'single')
        });
    };

    GameNet.sendEquipWeapon = function (weaponId) {
        if (!weaponId) return false;
        return wsSend({
            t: 'equip_weapon',
            weaponId: String(weaponId)
        });
    };

    GameNet.sendThrowIntent = function (throwableId) {
        if (!throwableId) return false;
        return wsSend({
            t: 'throw_intent',
            seq: inputSeq++,
            throwableId: String(throwableId)
        });
    };

    GameNet.queueClassChange = function (classId) {
        return wsSend({ t: 'class_queue', classId: classId });
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
                hitboxes: [r.bodyHitbox, r.headHitbox],
                alive: true,
                netEntityId: r.id
            });
        });
        return out;
    };

    GameNet.getWallhackDescriptors = function () {
        var out = [];
        GameNet.appendWallhackDescriptors(out);
        return out;
    };

    GameNet.appendWallhackDescriptors = function (out) {
        if (!Array.isArray(out)) return out;
        renderMap.forEach(function (r) {
            out.push({
                id: 'net:' + r.id,
                alive: !!r.alive,
                worldPos: r.group ? r.group.position : null,
                headOffsetY: HEAD_HITBOX_OFFSET_Y,
                visualRoot: (r.rigApi && r.rigApi.root) ? r.rigApi.root : r.group,
                revealGhost: null,
                attachParent: r.group || null,
                kind: r.kind || 'player'
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

    window.GameNet = GameNet;
})();
