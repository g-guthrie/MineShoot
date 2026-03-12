(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function createWall(width, height, depth, color) {
        return new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            new THREE.MeshLambertMaterial({ color: color })
        );
    }

    function create(options) {
        options = options || {};
        var scene = options.scene || null;
        if (!scene) throw new Error('Demonic world preview requires a THREE scene.');

        var root = new THREE.Group();
        var floor = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100, 20, 20),
            new THREE.MeshLambertMaterial({ color: 0x17101d })
        );
        floor.rotation.x = -Math.PI * 0.5;
        root.add(floor);

        var wallMatColor = 0x24192d;
        var north = createWall(100, 8, 2, wallMatColor);
        north.position.set(0, 4, -50);
        root.add(north);
        var south = createWall(100, 8, 2, wallMatColor);
        south.position.set(0, 4, 50);
        root.add(south);
        var west = createWall(2, 8, 100, wallMatColor);
        west.position.set(-50, 4, 0);
        root.add(west);
        var east = createWall(2, 8, 100, wallMatColor);
        east.position.set(50, 4, 0);
        root.add(east);

        var coverRoot = new THREE.Group();
        root.add(coverRoot);

        var targetMarker = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0xffd47d })
        );
        targetMarker.visible = false;
        root.add(targetMarker);

        var spawnMarkers = [];

        scene.add(root);

        function syncCoverBlocks(blocks) {
            var list = Array.isArray(blocks) ? blocks : [];
            while (coverRoot.children.length > list.length) {
                coverRoot.remove(coverRoot.children[coverRoot.children.length - 1]);
            }
            for (var i = 0; i < list.length; i++) {
                var block = list[i];
                var mesh = coverRoot.children[i];
                if (!mesh) {
                    mesh = createWall(
                        Number(block.width || 1),
                        Number(block.height || 1),
                        Number(block.depth || 1),
                        Number(block.color || 0x31223b)
                    );
                    coverRoot.add(mesh);
                }
                mesh.position.set(Number(block.x || 0), Number(block.y || 0), Number(block.z || 0));
            }
        }

        function syncSpawnMarkers(spawnPoints) {
            var list = Array.isArray(spawnPoints) ? spawnPoints : [];
            while (spawnMarkers.length > list.length) {
                var marker = spawnMarkers.pop();
                if (marker.parent) marker.parent.remove(marker);
            }
            for (var i = 0; i < list.length; i++) {
                var point = list[i];
                var marker = spawnMarkers[i];
                if (!marker) {
                    marker = new THREE.Mesh(
                        new THREE.CircleGeometry(0.8, 18),
                        new THREE.MeshBasicMaterial({ color: 0x56c1ff, transparent: true, opacity: 0.32 })
                    );
                    marker.rotation.x = -Math.PI * 0.5;
                    spawnMarkers.push(marker);
                    root.add(marker);
                }
                marker.position.set(Number(point.x || 0), 0.04, Number(point.z || 0));
            }
        }

        return {
            update: function (snapshot) {
                var state = snapshot || {};
                syncCoverBlocks(state.coverBlocks);
                syncSpawnMarkers(state.spawnPoints);
                var activeStates = state.activeStates || {};
                var active = activeStates.slot1 || activeStates.slot2 || null;
                var aimPoint = active && active.meta ? active.meta.aimPoint : null;
                if (aimPoint) {
                    targetMarker.visible = true;
                    targetMarker.position.set(Number(aimPoint.x || 0), Number(aimPoint.y || 0), Number(aimPoint.z || 0));
                } else {
                    targetMarker.visible = false;
                }
            },
            destroy: function () {
                if (root.parent) root.parent.remove(root);
            }
        };
    }

    demonicRuntime.GameWorldPreviewRuntime = {
        create: create
    };
})();
