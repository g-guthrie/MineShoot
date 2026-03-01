/**
 * wallhack.js - Shared wallhack silhouette manager for local and remote entities
 * Loaded as global: window.GameWallhack
 */
(function () {
    'use strict';

    var GameWallhack = {};

    var sceneRef = null;
    var enabled = true;
    var initialized = false;
    var descriptorsById = new Map();
    var ghostById = new Map();

    function createGhostFromVisual(visualRoot) {
        if (!visualRoot) return null;
        var ghost = visualRoot.clone(true);
        var mats = [];

        ghost.traverse(function (node) {
            if (!node.isMesh) return;
            var mat = new THREE.MeshBasicMaterial({
                color: 0x65d8ff,
                transparent: true,
                opacity: 0.24,
                depthTest: false,
                depthWrite: false
            });
            node.material = mat;
            node.renderOrder = 90;
            mats.push(mat);
        });

        ghost.visible = false;
        ghost.scale.multiplyScalar(1.05);
        ghost.userData.revealMaterials = mats;
        ghost.userData.baseOpacity = 0.24;
        return ghost;
    }

    function attachGhost(id, descriptor) {
        var existing = ghostById.get(id);
        if (existing) return existing;

        var usingExternal = !!descriptor.revealGhost;
        var ghost = usingExternal ? descriptor.revealGhost : createGhostFromVisual(descriptor.visualRoot);
        if (!ghost) return null;

        if (!usingExternal) {
            var parent = descriptor.attachParent || sceneRef;
            if (parent) parent.add(ghost);
        }

        var entry = {
            ghost: ghost,
            external: usingExternal
        };
        ghostById.set(id, entry);
        return entry;
    }

    function detachGhost(id) {
        var entry = ghostById.get(id);
        if (!entry) return;
        if (entry.ghost) {
            entry.ghost.visible = false;
            if (!entry.external && entry.ghost.parent) {
                entry.ghost.parent.remove(entry.ghost);
            }
        }
        ghostById.delete(id);
    }

    function copyGhostTransform(entry, descriptor) {
        if (!entry || !entry.ghost || !descriptor || !descriptor.visualRoot) return;
        var ghost = entry.ghost;
        var visual = descriptor.visualRoot;

        if (ghost.parent && visual.parent && ghost.parent === visual.parent) {
            ghost.position.copy(visual.position);
            ghost.quaternion.copy(visual.quaternion);
            ghost.scale.copy(visual.scale).multiplyScalar(1.05);
            return;
        }

        ghost.position.setFromMatrixPosition(visual.matrixWorld);
        ghost.quaternion.setFromRotationMatrix(visual.matrixWorld);
    }

    function updateGhostOpacity(ghost, idSeed) {
        if (!ghost || !ghost.userData || !ghost.userData.revealMaterials) return;
        var mats = ghost.userData.revealMaterials;
        var base = (typeof ghost.userData.baseOpacity === 'number') ? ghost.userData.baseOpacity : 0.24;
        var pulse = 0.05 * Math.sin(performance.now() * 0.011 + idSeed);
        var opacity = base + pulse;
        for (var i = 0; i < mats.length; i++) {
            mats[i].opacity = opacity;
        }
    }

    GameWallhack.init = function (scene) {
        sceneRef = scene;
        initialized = true;
        enabled = true;
    };

    GameWallhack.setEnabled = function (value) {
        enabled = !!value;
        return enabled;
    };

    GameWallhack.isEnabled = function () {
        return enabled;
    };

    GameWallhack.isActive = function () {
        return !!initialized;
    };

    GameWallhack.syncEntities = function (descriptors) {
        if (!initialized) return;
        descriptors = Array.isArray(descriptors) ? descriptors : [];

        var nextMap = new Map();
        for (var i = 0; i < descriptors.length; i++) {
            var d = descriptors[i];
            if (!d || !d.id) continue;
            nextMap.set(String(d.id), d);
            attachGhost(String(d.id), d);
        }

        ghostById.forEach(function (_entry, id) {
            if (!nextMap.has(id)) detachGhost(id);
        });
        descriptorsById = nextMap;
    };

    GameWallhack.update = function (camera, playerPos, radius) {
        if (!initialized || !playerPos) return;
        radius = Math.max(0, Number(radius || 0));

        descriptorsById.forEach(function (descriptor, id) {
            var entry = ghostById.get(id);
            if (!entry || !entry.ghost) return;
            var ghost = entry.ghost;

            copyGhostTransform(entry, descriptor);

            if (!enabled || !descriptor.alive || !descriptor.worldPos || radius <= 0) {
                ghost.visible = false;
                return;
            }

            var dx = descriptor.worldPos.x - playerPos.x;
            var dz = descriptor.worldPos.z - playerPos.z;
            var horizontalDist = Math.sqrt((dx * dx) + (dz * dz));
            if (horizontalDist > radius) {
                ghost.visible = false;
                return;
            }
            ghost.visible = true;
            updateGhostOpacity(ghost, id.length);
        });
    };

    window.GameWallhack = GameWallhack;
})();
