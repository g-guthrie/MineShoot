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

    var inputSeq = 1;
    var inputSendTimer = 0;
    var inputSendInterval = 1 / 30;

    var snapshotMap = new Map();
    var renderMap = new Map();
    var hitboxArray = [];
    var hitboxVisible = true;
    var beamScratchA = new THREE.Vector3();
    var beamScratchB = new THREE.Vector3();

    var REMOTE_BEAM_HOLD_MS = 180;

    var PRIM = window.__GAME_PRIMITIVES__ || {};
    var COORDS = PRIM.coords || {};
    var NETWORK_PRIM = PRIM.network || {};
    var COORD = window.__GAME_COORD_SYSTEM__ || {};
    var TICK_RATE_HZ = (typeof NETWORK_PRIM.tick_rate_hz === 'number' && isFinite(NETWORK_PRIM.tick_rate_hz))
        ? Math.max(1, Math.floor(NETWORK_PRIM.tick_rate_hz))
        : 30;
    inputSendInterval = 1 / TICK_RATE_HZ;
    var INTERPOLATION_DELAY_MS = (typeof NETWORK_PRIM.interpolation_delay_ms === 'number' && isFinite(NETWORK_PRIM.interpolation_delay_ms))
        ? Math.max(0, NETWORK_PRIM.interpolation_delay_ms)
        : 80;
    var EXTRAPOLATION_CAP_MS = (typeof NETWORK_PRIM.extrapolation_cap_ms === 'number' && isFinite(NETWORK_PRIM.extrapolation_cap_ms))
        ? Math.max(0, NETWORK_PRIM.extrapolation_cap_ms)
        : 100;
    var STALE_HOLD_MS = (typeof NETWORK_PRIM.stale_hold_ms === 'number' && isFinite(NETWORK_PRIM.stale_hold_ms))
        ? Math.max(0, NETWORK_PRIM.stale_hold_ms)
        : 300;
    var BODY_HITBOX_OFFSET_Y = (typeof COORDS.body_hitbox_offset_y === 'number' && isFinite(COORDS.body_hitbox_offset_y))
        ? COORDS.body_hitbox_offset_y
        : 1.0;
    var HEAD_HITBOX_OFFSET_Y = (typeof COORDS.head_hitbox_offset_y === 'number' && isFinite(COORDS.head_hitbox_offset_y))
        ? COORDS.head_hitbox_offset_y
        : 2.475;

    var serverClockOffsetMs = 0;
    var serverClockInit = false;
    var latestServerTime = 0;

    var notices = [];

    function classStats(classId) {
        var defs = {
            ninja: { armorMax: 80, wallhackRadius: 90 },
            jedi: { armorMax: 130, wallhackRadius: 85 },
            magician: { armorMax: 100, wallhackRadius: 100 },
            sharpshooter: { armorMax: 90, wallhackRadius: 115 },
            brawler: { armorMax: 150, wallhackRadius: 75 }
        };
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

    function resolveFeetY(entity) {
        if (entity && typeof entity.feetY === 'number' && isFinite(entity.feetY)) return entity.feetY;
        if (entity && typeof entity.y === 'number' && isFinite(entity.y)) return entity.y;
        return 0;
    }

    function shortestArcRad(fromRad, toRad) {
        var diff = (toRad || 0) - (fromRad || 0);
        if (COORD && typeof COORD.wrapRad === 'function') return COORD.wrapRad(diff);
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return diff;
    }

    function normalizeAngle(rad) {
        if (COORD && typeof COORD.wrapRad === 'function') return COORD.wrapRad(rad || 0);
        var out = Number(rad || 0);
        while (out > Math.PI) out -= Math.PI * 2;
        while (out < -Math.PI) out += Math.PI * 2;
        return out;
    }

    function updateServerClock(serverTime) {
        if (typeof serverTime !== 'number' || !isFinite(serverTime)) return;
        latestServerTime = Math.max(latestServerTime, serverTime);
        var measuredOffset = serverTime - Date.now();
        if (!serverClockInit) {
            serverClockOffsetMs = measuredOffset;
            serverClockInit = true;
            return;
        }
        // Simple low-pass filter to smooth jitter.
        serverClockOffsetMs = serverClockOffsetMs + (measuredOffset - serverClockOffsetMs) * 0.1;
    }

    function currentRenderServerTime() {
        if (!serverClockInit) return Date.now() - INTERPOLATION_DELAY_MS;
        return Date.now() + serverClockOffsetMs - INTERPOLATION_DELAY_MS;
    }

    function snapshotOfEntity(entity, serverTime) {
        return {
            serverTime: serverTime,
            receivedAt: Date.now(),
            x: entity.x || 0,
            feetY: resolveFeetY(entity),
            z: entity.z || 0,
            yaw: normalizeAngle(entity.yaw || 0),
            pitch: entity.pitch || 0
        };
    }

    function pushEntitySnapshot(entity, serverTime) {
        if (!entity || !entity.id) return;
        var time = (typeof serverTime === 'number' && isFinite(serverTime)) ? serverTime : Date.now();
        var history = snapshotMap.get(entity.id);
        if (!history) {
            history = [];
            snapshotMap.set(entity.id, history);
        }
        if (history.length > 0 && history[history.length - 1].serverTime === time) {
            history[history.length - 1] = snapshotOfEntity(entity, time);
        } else {
            history.push(snapshotOfEntity(entity, time));
            if (history.length > 48) history.shift();
        }
    }

    function interpolateEntitySnapshot(history, renderServerTime) {
        if (!history || history.length === 0) return null;

        var latest = history[history.length - 1];
        if (history.length === 1) {
            return {
                x: latest.x,
                feetY: latest.feetY,
                z: latest.z,
                yaw: latest.yaw,
                pitch: latest.pitch
            };
        }

        var i;
        for (i = 0; i < history.length - 1; i++) {
            var a = history[i];
            var b = history[i + 1];
            if (renderServerTime >= a.serverTime && renderServerTime <= b.serverTime) {
                var span = Math.max(1, b.serverTime - a.serverTime);
                var t = Math.max(0, Math.min(1, (renderServerTime - a.serverTime) / span));
                return {
                    x: a.x + (b.x - a.x) * t,
                    feetY: a.feetY + (b.feetY - a.feetY) * t,
                    z: a.z + (b.z - a.z) * t,
                    yaw: normalizeAngle(a.yaw + shortestArcRad(a.yaw, b.yaw) * t),
                    pitch: a.pitch + (b.pitch - a.pitch) * t
                };
            }
        }

        // Render time is ahead of latest snapshot: capped extrapolation.
        var leadMs = renderServerTime - latest.serverTime;
        if (leadMs > 0) {
            var clampedLead = Math.min(leadMs, EXTRAPOLATION_CAP_MS);
            if ((Date.now() - latest.receivedAt) > STALE_HOLD_MS) clampedLead = 0;

            var prev = history[history.length - 2];
            var dtMs = Math.max(1, latest.serverTime - prev.serverTime);
            var velX = (latest.x - prev.x) / dtMs;
            var velY = (latest.feetY - prev.feetY) / dtMs;
            var velZ = (latest.z - prev.z) / dtMs;
            return {
                x: latest.x + velX * clampedLead,
                feetY: latest.feetY + velY * clampedLead,
                z: latest.z + velZ * clampedLead,
                yaw: latest.yaw,
                pitch: latest.pitch
            };
        }

        // Render time is older than oldest snapshot: hold oldest.
        var first = history[0];
        return {
            x: first.x,
            feetY: first.feetY,
            z: first.z,
            yaw: first.yaw,
            pitch: first.pitch
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
        if (window.GameAvatarRig && window.GameAvatarRig.create) {
            rigApi = window.GameAvatarRig.create(entity.kind === 'bot' ? 'bot' : 'remote', {
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
            new THREE.BoxGeometry(2.7, 2.0, 2.7),
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
            new THREE.BoxGeometry(1.55, 0.95, 1.55),
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

        group.position.set(entity.x, resolveFeetY(entity), entity.z);
        group.rotation.y = entity.yaw || 0;
        bodyHitbox.position.set(group.position.x, group.position.y + BODY_HITBOX_OFFSET_Y, group.position.z);
        headHitbox.position.set(group.position.x, group.position.y + HEAD_HITBOX_OFFSET_Y, group.position.z);

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
            pitch: entity.pitch || 0,
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
            beamTargetId: entity.beamTargetId || '',
            beamActiveUntil: entity.beamActiveUntil || 0,
            beamHeat: entity.beamHeat || 0,
            beamOverheated: !!entity.beamOverheated,
            beamLine: beamLine,
            lastServerTime: 0
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
        snapshotMap.delete(id);
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
        r.pitch = entity.pitch || 0;
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
        r.beamTargetId = entity.beamTargetId || '';
        r.beamActiveUntil = entity.beamActiveUntil || 0;
        r.beamHeat = entity.beamHeat || 0;
        r.beamOverheated = !!entity.beamOverheated;
        r.lastServerTime = latestServerTime;

        r.group.visible = !!entity.alive;
        r.bodyHitbox.visible = !!entity.alive;
        r.headHitbox.visible = !!entity.alive;
    }

    function applySnapshot(entities, serverTime) {
        if (!Array.isArray(entities)) return;

        updateServerClock(serverTime);
        var activeIds = {};
        for (var i = 0; i < entities.length; i++) {
            var e = entities[i];
            activeIds[e.id] = true;
            if (e.id === selfId) {
                selfState = e;
                continue;
            }
            pushEntitySnapshot(e, serverTime);
            updateRemoteFromSnapshot(e);
        }

        var toRemove = [];
        renderMap.forEach(function (_v, id) {
            if (!activeIds[id]) toRemove.push(id);
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
            if (typeof msg.tickRate === 'number' && isFinite(msg.tickRate)) {
                TICK_RATE_HZ = Math.max(1, Math.floor(msg.tickRate));
                inputSendInterval = 1 / TICK_RATE_HZ;
            }
            pushNotice('Joined room ' + (msg.roomId || 'global'));
            return;
        }

        if (msg.t === 'entity_snapshot' || msg.t === 'snapshot') {
            applySnapshot(msg.entities || [], msg.serverTime);
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
            if (msg.entityId === selfId && window.GamePlayer && window.GamePlayer.respawnRandom) {
                window.GamePlayer.respawnRandom();
            }
            return;
        }

        if (msg.t === 'server_reconcile') {
            if (!selfState) selfState = {};
            if (typeof msg.x === 'number' && isFinite(msg.x)) selfState.x = msg.x;
            if (typeof msg.z === 'number' && isFinite(msg.z)) selfState.z = msg.z;
            if (typeof msg.feetY === 'number' && isFinite(msg.feetY)) selfState.feetY = msg.feetY;
            if (typeof msg.yaw === 'number' && isFinite(msg.yaw)) selfState.yaw = msg.yaw;
            if (typeof msg.pitch === 'number' && isFinite(msg.pitch)) selfState.pitch = msg.pitch;
            if (typeof msg.velY === 'number' && isFinite(msg.velY)) selfState.velY = msg.velY;
            if (typeof msg.grounded === 'boolean') selfState.grounded = msg.grounded;
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
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify(msg));
        return true;
    }

    function getRenderCoreWorldPosition(render, outVec3) {
        if (!render) return null;
        var out = outVec3 || new THREE.Vector3();
        if (render.rigApi && render.rigApi.getSocketWorldPosition) {
            var socketCore = render.rigApi.getSocketWorldPosition('core_anchor', out);
            if (socketCore) return socketCore;
        }
        if (render.rigApi && render.rigApi.getCoreWorldPosition) {
            return render.rigApi.getCoreWorldPosition(out);
        }
        out.copy(render.group.position);
        out.y += BODY_HITBOX_OFFSET_Y;
        return out;
    }

    function getRenderMuzzleWorldPosition(render, outVec3) {
        if (!render) return null;
        var out = outVec3 || new THREE.Vector3();
        if (render.rigApi && render.rigApi.getSocketWorldPosition) {
            var socketMuzzle = render.rigApi.getSocketWorldPosition('muzzle_socket', out);
            if (socketMuzzle) return socketMuzzle;
        }
        if (render.rigApi && render.rigApi.getMuzzleWorldPosition) {
            return render.rigApi.getMuzzleWorldPosition(out);
        }
        out.copy(render.group.position);
        out.y += Number(COORDS.muzzle_fallback_offset_y || 1.45);
        return out;
    }

    function resolveBeamTargetPosition(targetId, outVec3) {
        if (!targetId) return null;
        var out = outVec3 || new THREE.Vector3();

        if (targetId === selfId && window.GamePlayer && window.GamePlayer.getPosition) {
            var selfPos = window.GamePlayer.getPosition();
            out.copy(selfPos);
            out.y -= 0.6;
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
        serverClockOffsetMs = 0;
        serverClockInit = false;
        latestServerTime = 0;
        selfState = null;
        selfId = '';
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
                headY: 2.9,
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
                hp: 500,
                hpMax: 500,
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
            inputSendTimer = inputSendInterval;
            if (playerPos && rotation) {
                var inputState = (window.GamePlayer && window.GamePlayer.getNetInputState)
                    ? window.GamePlayer.getNetInputState()
                    : null;
                wsSend({
                    t: 'input',
                    seq: inputSeq++,
                    moveX: inputState ? inputState.moveX : 0,
                    moveZ: inputState ? inputState.moveZ : 0,
                    jumpHeld: !!(inputState && inputState.jumpHeld),
                    sprint: !!(inputState && inputState.sprint),
                    yaw: rotation.yaw || 0,
                    pitch: rotation.pitch || 0,
                    cameraMode: (inputState && inputState.cameraMode) ? inputState.cameraMode : 'first',
                    shoulderSide: (inputState && inputState.shoulderSide) ? inputState.shoulderSide : 'right',
                    actions: []
                });
            }
        }

        var renderServerTime = currentRenderServerTime();
        renderMap.forEach(function (r) {
            var history = snapshotMap.get(r.id);
            var sampled = interpolateEntitySnapshot(history, renderServerTime);
            if (sampled) {
                r.group.position.set(sampled.x, sampled.feetY, sampled.z);
                r.group.rotation.y = sampled.yaw;
                r.pitch = sampled.pitch;
            }

            if (r.rigApi) {
                r.rigApi.setWeapon(r.weaponId || 'rifle');
                if (r.rigApi.updatePose) {
                    r.rigApi.updatePose({
                        moveSpeedNorm: r.moveSpeedNorm || 0,
                        sprinting: !!r.sprinting,
                        aimPitch: r.pitch || 0,
                        equippedWeaponId: r.weaponId || 'rifle'
                    }, dt);
                } else {
                    r.rigApi.updateAimPitch(r.pitch || 0);
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

    GameNet.sendFire = function (hitbox, weaponId, hitType) {
        if (!hitbox || !hitbox.userData || !hitbox.userData.netEntityId) return false;
        return wsSend({
            t: 'fire_intent',
            seq: inputSeq++,
            targetId: hitbox.userData.netEntityId,
            weaponId: weaponId,
            hitType: hitType === 'head' ? 'head' : 'body'
        });
    };

    GameNet.sendEquipWeapon = function (weaponId) {
        if (!weaponId) return false;
        return wsSend({
            t: 'equip_weapon',
            weaponId: String(weaponId)
        });
    };

    GameNet.sendPlasmaTick = function (targetId) {
        return wsSend({
            t: 'beam_intent',
            seq: inputSeq++,
            weaponId: 'plasma',
            active: true
        });
    };

    GameNet.sendBeamIntent = function (active, weaponId) {
        return wsSend({
            t: 'beam_intent',
            seq: inputSeq++,
            weaponId: weaponId || 'plasma',
            active: !!active
        });
    };

    GameNet.sendThrow = function (throwableId) {
        return wsSend({ t: 'throw_intent', throwableId: throwableId });
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

    window.GameNet = GameNet;
})();
