/**
 * player-world.js - World, spawn, and collision helpers for the local player.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerWorld
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GamePlayerWorld = {};

    GamePlayerWorld.create = function (options) {
        options = options || {};

        var playerRadius = Math.max(0, Number(options.playerRadius || 0.35));
        var playerHeight = Math.max(playerRadius, Number(options.playerHeight || 1.7));
        var epsilon = Math.max(0.000001, Number(options.epsilon || 0.001));

        function getWorldBounds() {
            return runtime.GameWorld.getBounds();
        }

        function getDefaultSpawnPoint() {
            var bounds = getWorldBounds();
            var centerX = (typeof bounds.centerX === 'number')
                ? bounds.centerX
                : ((bounds.min + bounds.max) * 0.5);
            var centerZ = (typeof bounds.centerZ === 'number')
                ? bounds.centerZ
                : ((bounds.min + bounds.max) * 0.5);
            var minZ = (typeof bounds.minZ === 'number') ? bounds.minZ : bounds.min;
            var maxZ = (typeof bounds.maxZ === 'number') ? bounds.maxZ : bounds.max;
            var z = Math.min(maxZ - 4, centerZ + Math.max(6, (maxZ - minZ) * 0.34));
            return { x: centerX, z: z };
        }

        function getSpawnThreatPoints() {
            var points = [];
            var net = runtime.GameNet || null;
            var netView = net && net.view ? net.view : net;
            if (runtime.GameEnemy && runtime.GameEnemy.getLockTargets) {
                var localTargets = runtime.GameEnemy.getLockTargets() || [];
                for (var i = 0; i < localTargets.length; i++) {
                    var localTarget = localTargets[i];
                    if (!localTarget || !localTarget.worldPos) continue;
                    points.push({
                        x: Number(localTarget.worldPos.x || 0),
                        z: Number(localTarget.worldPos.z || 0)
                    });
                }
            }
            if (netView && netView.getLockTargets) {
                var netTargets = netView.getLockTargets() || [];
                for (var n = 0; n < netTargets.length; n++) {
                    var netTarget = netTargets[n];
                    if (!netTarget || !netTarget.worldPos) continue;
                    points.push({
                        x: Number(netTarget.worldPos.x || 0),
                        z: Number(netTarget.worldPos.z || 0)
                    });
                }
            }
            return points;
        }

        function getRandomSpawnPoint(spawnPadding, config) {
            if (!runtime.GameWorld || !runtime.GameWorld.getRandomSpawnPoint) return null;
            return runtime.GameWorld.getRandomSpawnPoint(spawnPadding, config || null);
        }

        function getSpawnPadding(defaultValue) {
            if (runtime.GameWorld && runtime.GameWorld.getSpawnPadding) {
                return runtime.GameWorld.getSpawnPadding();
            }
            return Number(defaultValue || 0);
        }

        function getGroundHeightAt(x, z) {
            if (runtime.GameWorld && runtime.GameWorld.getGroundHeightAt) {
                return runtime.GameWorld.getGroundHeightAt(x, z);
            }
            return 0;
        }

        function getCollisionBoxes() {
            if (!runtime.GameWorld || !runtime.GameWorld.getCollidables) return [];

            var meshes = runtime.GameWorld.getCollidables();
            if (!meshes || meshes.length === 0) return [];

            var boxes = [];
            for (var i = 0; i < meshes.length; i++) {
                var mesh = meshes[i];
                if (!mesh) continue;
                if (!mesh.userData) mesh.userData = {};

                var box = mesh.userData.collisionBox;
                if (!box) {
                    mesh.updateMatrixWorld(true);
                    box = new THREE.Box3().setFromObject(mesh);
                    mesh.userData.collisionBox = box;
                }
                boxes.push(box);
            }
            return boxes;
        }

        function intersectsXZ(x, z, radius, box) {
            var closestX = Math.max(box.min.x, Math.min(x, box.max.x));
            var closestZ = Math.max(box.min.z, Math.min(z, box.max.z));
            var dx = x - closestX;
            var dz = z - closestZ;
            return ((dx * dx + dz * dz) < (radius * radius));
        }

        function isBlockedAt(nextX, nextZ, feetY) {
            var boxes = getCollisionBoxes();
            if (boxes.length === 0) return false;

            var headY = feetY + playerHeight;
            for (var i = 0; i < boxes.length; i++) {
                var box = boxes[i];
                if (headY <= box.min.y + epsilon || feetY >= box.max.y - epsilon) continue;
                if (intersectsXZ(nextX, nextZ, playerRadius, box)) return true;
            }
            return false;
        }

        function findLandingSurfaceY(x, z, currentFeetY, nextFeetY) {
            var boxes = getCollisionBoxes();
            var baseGroundY = getGroundHeightAt(x, z);
            if (boxes.length === 0) return baseGroundY;

            var best = null;
            for (var i = 0; i < boxes.length; i++) {
                var box = boxes[i];
                var top = box.max.y;
                if (!intersectsXZ(x, z, playerRadius * 0.9, box)) continue;
                if (top <= currentFeetY + epsilon && top >= nextFeetY - epsilon) {
                    if (best === null || top > best) best = top;
                }
            }
            if (best === null || best < baseGroundY) return baseGroundY;
            return best;
        }

        function findCeilingY(x, z, currentHeadY, nextHeadY) {
            var boxes = getCollisionBoxes();
            if (boxes.length === 0) return null;

            var best = null;
            for (var i = 0; i < boxes.length; i++) {
                var box = boxes[i];
                var bottom = box.min.y;
                if (!intersectsXZ(x, z, playerRadius * 0.9, box)) continue;
                if (bottom >= currentHeadY - epsilon && bottom <= nextHeadY + epsilon) {
                    if (best === null || bottom < best) best = bottom;
                }
            }
            return best;
        }

        return {
            getWorldBounds: getWorldBounds,
            getDefaultSpawnPoint: getDefaultSpawnPoint,
            getSpawnThreatPoints: getSpawnThreatPoints,
            getRandomSpawnPoint: getRandomSpawnPoint,
            getSpawnPadding: getSpawnPadding,
            getGroundHeightAt: getGroundHeightAt,
            getCollisionBoxes: getCollisionBoxes,
            isBlockedAt: isBlockedAt,
            findLandingSurfaceY: findLandingSurfaceY,
            findCeilingY: findCeilingY
        };
    };

    runtime.GamePlayerWorld = GamePlayerWorld;
})();
