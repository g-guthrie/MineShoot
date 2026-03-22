/**
 * overhead.js - floating health/armor bars over combatants
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameOverhead
 */
(function () {
    'use strict';

    var GameOverhead = {};

    var container = null;
    var entries = new Map();
    var revealUntilByTargetId = new Map();
    var REVEAL_HOLD_MS = 1500;
    var sharedRuntime = (globalThis.__MAYHEM_RUNTIME && globalThis.__MAYHEM_RUNTIME.GameShared) || {};
    var entityPoints = sharedRuntime.entityPoints || {};
    var entityConstants = sharedRuntime.entityConstants || {};
    var projectionScratch = new THREE.Vector3();
    var descriptorScratch = {
        id: '',
        targetId: '',
        name: '',
        hp: 0,
        hpMax: 0,
        armor: 0,
        armorMax: 0,
        worldPos: null
    };
    var OVERHEAD_HEAD_CLEARANCE_Y = 0.18;

    function ensureContainer() {
        if (container) return;
        container = document.getElementById('overhead-bars');
        if (!container) {
            container = document.createElement('div');
            container.id = 'overhead-bars';
            document.body.appendChild(container);
        }
    }

    function makeEntry(id) {
        var root = document.createElement('div');
        root.className = 'overhead-entry';
        root.dataset.id = id;

        var name = document.createElement('div');
        name.className = 'overhead-name';
        name.textContent = '';

        var hpWrap = document.createElement('div');
        hpWrap.className = 'overhead-hp-wrap';
        var hpBar = document.createElement('div');
        hpBar.className = 'overhead-hp-bar';
        hpWrap.appendChild(hpBar);

        var armorWrap = document.createElement('div');
        armorWrap.className = 'overhead-armor-wrap';
        var armorBar = document.createElement('div');
        armorBar.className = 'overhead-armor-bar';
        armorWrap.appendChild(armorBar);

        root.appendChild(name);
        root.appendChild(hpWrap);
        root.appendChild(armorWrap);

        container.appendChild(root);

        return {
            id: id,
            root: root,
            name: name,
            hpBar: hpBar,
            armorBar: armorBar,
            touched: 0
        };
    }

    function healthColor(pct) {
        if (pct > 0.6) return '#61d96c';
        if (pct > 0.3) return '#ffc655';
        return '#ff6f6f';
    }

    function nowStamp() {
        if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
            return Number(performance.now() || 0);
        }
        return Date.now();
    }

    function descriptorTargetId(desc) {
        return desc && desc.targetId ? String(desc.targetId) : '';
    }

    function descriptorMarkerY(desc) {
        if (!desc || !desc.worldPos) return 0;
        var feetY = Number(desc.worldPos.y || 0);
        var markerY = entityPoints && entityPoints.entityMarkerPointYFromFeet
            ? entityPoints.entityMarkerPointYFromFeet(feetY)
            : (feetY + 2.25);
        var headTopY = feetY +
            Number(entityConstants.AVATAR_HEAD_CENTER_OFFSET && entityConstants.AVATAR_HEAD_CENTER_OFFSET.y || 2.1) +
            (Number(entityConstants.AVATAR_HEAD_SIZE && entityConstants.AVATAR_HEAD_SIZE.y || 0.55) * 0.5);
        return Math.max(markerY, headTopY + OVERHEAD_HEAD_CLEARANCE_Y);
    }

    function pruneExpiredRevealTargets(stamp) {
        revealUntilByTargetId.forEach(function (revealUntil, targetId) {
            if (Number(revealUntil || 0) <= stamp) {
                revealUntilByTargetId.delete(targetId);
            }
        });
    }

    function syncDescriptor(id, targetId, name, hp, hpMax, armor, armorMax, worldPos, camera, stamp, crosshairTargetId) {
        descriptorScratch.id = id;
        descriptorScratch.targetId = targetId;
        descriptorScratch.name = name;
        descriptorScratch.hp = hp;
        descriptorScratch.hpMax = hpMax;
        descriptorScratch.armor = armor;
        descriptorScratch.armorMax = armorMax;
        descriptorScratch.worldPos = worldPos;
        var entry = entries.get(id);
        if (!entry) {
            entry = makeEntry(id);
            entries.set(id, entry);
        }
        updateEntry(entry, descriptorScratch, camera, stamp, crosshairTargetId);
    }

    function syncLocalEnemyEntries(camera, stamp, crosshairTargetId) {
        if (!globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies) return [];

        var enemies = globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies();
        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            if (!e || !e.alive || !e.group) continue;
            syncDescriptor(
                'enemy:' + e.index,
                'enemy:' + e.index,
                'AI_' + (e.index + 1),
                e.hp,
                e.maxHp || 500,
                typeof e.armor === 'number' ? e.armor : 0,
                typeof e.armorMax === 'number' ? e.armorMax : 100,
                e.group.position,
                camera,
                stamp,
                crosshairTargetId
            );
        }
    }

    function syncNetworkEntries(camera, stamp, crosshairTargetId) {
        var net = globalThis.__MAYHEM_RUNTIME.GameNet || null;
        var netView = net && net.view ? net.view : net;
        if (!netView || !netView.getEntityStateList) return [];
        var list = netView.getEntityStateList();

        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (!e || !e.alive || !e.worldPos) continue;
            syncDescriptor(
                'net:' + e.id,
                e.targetId || ('net:' + e.id),
                e.username || e.id,
                e.hp,
                e.hpMax,
                e.armor,
                e.armorMax,
                e.worldPos,
                camera,
                stamp,
                crosshairTargetId
            );
        }
    }

    function descriptorVisible(desc, stamp, crosshairTargetId) {
        if (!desc || !desc.worldPos) return false;
        if (crosshairTargetId && crosshairTargetId === descriptorTargetId(desc)) return true;
        return Number(revealUntilByTargetId.get(descriptorTargetId(desc)) || 0) > stamp;
    }

    function updateEntry(entry, desc, camera, stamp, crosshairTargetId) {
        entry.touched = stamp;

        if (!descriptorVisible(desc, stamp, crosshairTargetId)) {
            entry.root.style.display = 'none';
            return;
        }

        var p = projectionScratch.set(desc.worldPos.x, descriptorMarkerY(desc), desc.worldPos.z);
        p.project(camera);

        if (p.z < -1 || p.z > 1 || p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1) {
            entry.root.style.display = 'none';
            return;
        }

        var x = (p.x * 0.5 + 0.5) * window.innerWidth;
        var y = (-p.y * 0.5 + 0.5) * window.innerHeight;

        entry.root.style.display = 'block';
        entry.root.style.left = Math.round(x) + 'px';
        entry.root.style.top = Math.round(y) + 'px';
        entry.name.textContent = desc.name || '';

        var hpMax = Math.max(1, desc.hpMax || 1);
        var hpPct = Math.max(0, Math.min(1, (desc.hp || 0) / hpMax));
        entry.hpBar.style.width = Math.round(hpPct * 100) + '%';
        entry.hpBar.style.background = healthColor(hpPct);

        var armorMax = Math.max(1, desc.armorMax || 1);
        var armorPct = Math.max(0, Math.min(1, (desc.armor || 0) / armorMax));
        entry.armorBar.style.width = Math.round(armorPct * 100) + '%';
    }

    function cleanupUntouched(stamp) {
        var remove = [];
        entries.forEach(function (entry, id) {
            if (entry.touched !== stamp) remove.push(id);
        });

        for (var i = 0; i < remove.length; i++) {
            var id = remove[i];
            var e = entries.get(id);
            if (e && e.root && e.root.parentNode) e.root.parentNode.removeChild(e.root);
            entries.delete(id);
        }
    }

    GameOverhead.init = function () {
        ensureContainer();
    };

    GameOverhead.reset = function () {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        container = null;
        entries = new Map();
        revealUntilByTargetId = new Map();
    };

    GameOverhead.revealTarget = function (targetId, durationMs) {
        var id = String(targetId || '');
        if (!id) return false;
        var holdMs = Math.max(0, Number(durationMs || REVEAL_HOLD_MS));
        revealUntilByTargetId.set(id, nowStamp() + holdMs);
        return true;
    };

    GameOverhead.update = function (camera, _playerPos, crosshairTargetId) {
        if (!camera) return;
        ensureContainer();

        var stamp = nowStamp();
        pruneExpiredRevealTargets(stamp);
        syncLocalEnemyEntries(camera, stamp, crosshairTargetId);
        syncNetworkEntries(camera, stamp, crosshairTargetId);

        cleanupUntouched(stamp);
    };

    globalThis.__MAYHEM_RUNTIME.GameOverhead = GameOverhead;
})();
