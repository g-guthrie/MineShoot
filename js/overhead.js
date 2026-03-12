/**
 * overhead.js - floating health/armor bars over combatants
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameOverhead
 */
(function () {
    'use strict';

    var GameOverhead = {};

    var container = null;
    var entries = new Map();

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

    function getLocalEnemyDescriptors() {
        if (!globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies) return [];

        var enemies = globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies();
        var out = [];

        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            if (!e || !e.alive || !e.group) continue;
            out.push({
                id: 'enemy:' + e.index,
                targetId: 'enemy:' + e.index,
                name: 'AI_' + (e.index + 1),
                hp: e.hp,
                hpMax: e.maxHp || 500,
                armor: typeof e.armor === 'number' ? e.armor : 0,
                armorMax: typeof e.armorMax === 'number' ? e.armorMax : 100,
                worldPos: e.group.position,
                headY: 2.9
            });
        }

        return out;
    }

    function getNetworkDescriptors() {
        var net = globalThis.__MAYHEM_RUNTIME.GameNet || null;
        var netView = net && net.view ? net.view : net;
        if (!netView || !netView.getEntityStateList) return [];
        var list = netView.getEntityStateList();
        var out = [];

        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (!e || !e.alive || !e.worldPos) continue;
            out.push({
                id: 'net:' + e.id,
                targetId: e.targetId || ('net:' + e.id),
                name: e.username || e.id,
                hp: e.hp,
                hpMax: e.hpMax,
                armor: e.armor,
                armorMax: e.armorMax,
                worldPos: e.worldPos,
                headY: e.headY || 2.9
            });
        }

        return out;
    }

    function descriptorVisible(desc, playerPos, crosshairTargetId) {
        if (!desc || !desc.worldPos || !playerPos) return false;
        if (crosshairTargetId && crosshairTargetId === desc.targetId) return true;

        var dx = desc.worldPos.x - playerPos.x;
        var dz = desc.worldPos.z - playerPos.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        return d <= 22;
    }

    function updateEntry(entry, desc, camera, stamp, playerPos, crosshairTargetId) {
        entry.touched = stamp;

        if (!descriptorVisible(desc, playerPos, crosshairTargetId)) {
            entry.root.style.display = 'none';
            return;
        }

        var p = new THREE.Vector3(desc.worldPos.x, (desc.worldPos.y || 0) + desc.headY, desc.worldPos.z);
        p.project(camera);

        if (p.z < -1 || p.z > 1) {
            entry.root.style.display = 'none';
            return;
        }

        var x = (p.x * 0.5 + 0.5) * window.innerWidth;
        var y = (-p.y * 0.5 + 0.5) * window.innerHeight;

        entry.root.style.display = 'block';
        entry.root.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
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

    GameOverhead.update = function (camera, playerPos, crosshairTargetId) {
        if (!camera || !playerPos) return;
        ensureContainer();

        var stamp = performance.now();
        var descriptors = getLocalEnemyDescriptors().concat(getNetworkDescriptors());

        for (var i = 0; i < descriptors.length; i++) {
            var desc = descriptors[i];
            var entry = entries.get(desc.id);
            if (!entry) {
                entry = makeEntry(desc.id);
                entries.set(desc.id, entry);
            }
            updateEntry(entry, desc, camera, stamp, playerPos, crosshairTargetId);
        }

        cleanupUntouched(stamp);
    };

    globalThis.__MAYHEM_RUNTIME.GameOverhead = GameOverhead;
})();
