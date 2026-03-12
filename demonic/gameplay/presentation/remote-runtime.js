(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function bodyColor(entity) {
        return String(entity && entity.kind || '') === 'bot' ? 0x7e5430 : 0x6f90ff;
    }

    function weaponColor(weaponId) {
        switch (String(weaponId || '')) {
            case 'shotgun': return 0x7a4b27;
            case 'sniper': return 0x314131;
            case 'pistol': return 0x555555;
            case 'machinegun': return 0x333333;
            default: return 0x444444;
        }
    }

    function createBox(w, h, d, color) {
        return new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshLambertMaterial({ color: color })
        );
    }

    function createRemoteVisual(entity) {
        var root = new THREE.Group();
        var torso = createBox(0.8, 1.0, 0.5, bodyColor(entity));
        torso.position.set(0, 1.3, 0);
        root.add(torso);

        var head = createBox(0.55, 0.55, 0.55, 0xd2a77d);
        head.position.set(0, 2.1, 0);
        root.add(head);

        var legL = createBox(0.28, 0.9, 0.28, 0x2f2f2f);
        var legR = createBox(0.28, 0.9, 0.28, 0x2f2f2f);
        legL.position.set(-0.18, 0.45, 0);
        legR.position.set(0.18, 0.45, 0);
        root.add(legL);
        root.add(legR);

        var gun = createBox(0.16, 0.12, 0.72, weaponColor(entity && entity.weaponId));
        gun.position.set(0.28, 1.18, -0.28);
        gun.rotation.x = -1.1;
        root.add(gun);

        return {
            root: root,
            torso: torso,
            legL: legL,
            legR: legR,
            gun: gun
        };
    }

    function create(options) {
        options = options || {};
        var scene = options.scene || null;
        if (!scene) throw new Error('Demonic remote runtime requires a THREE scene.');

        var remoteMap = new Map();
        var snapshotState = {
            remoteCount: 0,
            ids: []
        };

        function syncRemoteEntity(entity) {
            var id = String(entity && entity.id || '');
            if (!id) return;
            var visual = remoteMap.get(id);
            if (!visual) {
                visual = createRemoteVisual(entity);
                remoteMap.set(id, visual);
                scene.add(visual.root);
            }

            visual.root.visible = entity.alive !== false;
            visual.root.position.set(
                Number(entity.x || 0),
                Number((entity.y != null ? entity.y : 1.6) - 1.6),
                Number(entity.z || 0)
            );
            visual.root.rotation.y = Number(entity.yaw || 0);
            visual.root.rotation.z = entity.alive === false ? -Math.PI * 0.5 : 0;
            if (entity.alive === false) {
                visual.root.position.y = 0.15;
            }
            visual.torso.material.color.setHex(bodyColor(entity));
            visual.gun.material.color.setHex(weaponColor(entity.weaponId));

            var stride = Math.min(0.7, Math.max(0, Number(entity.moveSpeedNorm || 0)) * 0.9);
            visual.legL.rotation.x = entity.alive === false ? 0 : stride;
            visual.legR.rotation.x = entity.alive === false ? 0 : -stride;
        }

        function pruneRemoteEntities(activeIds) {
            remoteMap.forEach(function (visual, id) {
                if (activeIds.has(id)) return;
                if (visual.root && visual.root.parent) visual.root.parent.remove(visual.root);
                remoteMap.delete(id);
            });
        }

        return {
            update: function (entities) {
                var list = Array.isArray(entities) ? entities : [];
                var activeIds = new Set();
                for (var i = 0; i < list.length; i++) {
                    var entity = list[i];
                    var id = String(entity && entity.id || '');
                    if (!id) continue;
                    activeIds.add(id);
                    syncRemoteEntity(entity);
                }
                pruneRemoteEntities(activeIds);
                snapshotState.remoteCount = list.length;
                snapshotState.ids = list.map(function (entity) {
                    return String(entity && entity.id || '');
                }).filter(Boolean);
            },
            getSnapshot: function () {
                return {
                    remoteCount: Number(snapshotState.remoteCount || 0),
                    ids: snapshotState.ids.slice()
                };
            },
            destroy: function () {
                remoteMap.forEach(function (visual) {
                    if (visual.root && visual.root.parent) visual.root.parent.remove(visual.root);
                });
                remoteMap.clear();
                snapshotState.remoteCount = 0;
                snapshotState.ids = [];
            }
        };
    }

    demonicRuntime.GameRemotePreviewRuntime = {
        create: create
    };
})();
