/**
 * world.js - Scalable world generation, structures, cover, lighting
 * Loaded as global: window.GameWorld
 */
(function () {
    'use strict';

    var GameWorld = {};

    var BASE_WORLD_SIZE = 50;
    var WORLD_AREA_SCALE = 5; // requested: 5x larger playable area
    var WORLD_SIZE = Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE));
    var WORLD_CENTER = WORLD_SIZE * 0.5;
    var WORLD_MARGIN = 2;
    var WORLD_MIN = WORLD_MARGIN;
    var WORLD_MAX = WORLD_SIZE - WORLD_MARGIN;
    var DEFAULT_SPAWN_PADDING = 8;
    var WORLD_SEED = 'mineshoot-v1';
    var rngState = 1;

    // Solid meshes used for movement/raycast collisions.
    var collidables = [];

    function hashSeed(seedText) {
        var str = String(seedText || 'mineshoot-v1');
        var hash = 2166136261 >>> 0;
        for (var i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0) || 1;
    }

    function setSeed(seedText) {
        WORLD_SEED = String(seedText || 'mineshoot-v1');
        rngState = hashSeed(WORLD_SEED);
    }

    function random01() {
        // xorshift32 deterministic PRNG.
        rngState ^= (rngState << 13);
        rngState ^= (rngState >>> 17);
        rngState ^= (rngState << 5);
        return ((rngState >>> 0) / 4294967295);
    }

    function resolveSeedFromLocation() {
        try {
            var params = new URLSearchParams(window.location.search || '');
            return params.get('seed') || WORLD_SEED;
        } catch (err) {
            return WORLD_SEED;
        }
    }

    function shouldShowDebugGrid() {
        try {
            var params = new URLSearchParams(window.location.search || '');
            return params.get('grid') === '1' || params.get('debugGrid') === '1';
        } catch (err) {
            return false;
        }
    }

    function scaleAxis(value) {
        return (value / BASE_WORLD_SIZE) * WORLD_SIZE;
    }

    function scaleSpan(value) {
        return Math.max(1, (value / BASE_WORLD_SIZE) * WORLD_SIZE);
    }

    function randRange(min, max) {
        return min + random01() * (max - min);
    }

    function randomSpawnPoint(padding) {
        var pad = (typeof padding === 'number') ? padding : DEFAULT_SPAWN_PADDING;
        var min = WORLD_MIN + pad;
        var max = WORLD_MAX - pad;
        return {
            x: randRange(min, max),
            z: randRange(min, max)
        };
    }

    GameWorld.create = function (scene) {
        setSeed(resolveSeedFromLocation());
        collidables = [];

        function markSolid(mesh) {
            mesh.updateMatrixWorld(true);
            mesh.userData.collisionBox = new THREE.Box3().setFromObject(mesh);
            collidables.push(mesh);
        }

        function addBlock(x, y, z, w, h, d, material, isSolid) {
            var geo = new THREE.BoxGeometry(w, h, d);
            var mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);

            if (isSolid !== false) {
                markSolid(mesh);
            }
            return mesh;
        }

        function addPatch(x, z, w, d, color) {
            addBlock(x, 0.01, z, w, 0.02, d, new THREE.MeshLambertMaterial({ color: color }), false);
        }

        function addJungleTree(x, z, trunkHeight, trunkMat, leavesMat, vineMat) {
            var canopyY = trunkHeight + 0.4;
            addBlock(x, trunkHeight / 2, z, 1, trunkHeight, 1, trunkMat, true);
            addBlock(x, canopyY, z, 3, 1.2, 3, leavesMat, false);
            addBlock(x, canopyY + 0.85, z, 2, 1, 2, leavesMat, false);
            addBlock(x - 1.1, canopyY - 0.5, z, 0.2, 1.5, 0.2, vineMat, false);
            addBlock(x + 1.1, canopyY - 0.35, z + 0.35, 0.2, 1.2, 0.2, vineMat, false);
        }

        function addBush(x, z, leavesMat) {
            addBlock(x, 0.35, z, 1.4, 0.7, 1.4, leavesMat, false);
        }

        function addLog(x, z, alongX, logMat) {
            if (alongX) {
                addBlock(x, 0.35, z, 3, 0.7, 1, logMat, true);
            } else {
                addBlock(x, 0.35, z, 1, 0.7, 3, logMat, true);
            }
        }

        function pointBlocked(x, z, padding) {
            var pad = padding || 0;
            for (var i = 0; i < collidables.length; i++) {
                var box = collidables[i].userData && collidables[i].userData.collisionBox;
                if (!box) continue;
                if (x > (box.min.x - pad) && x < (box.max.x + pad) &&
                    z > (box.min.z - pad) && z < (box.max.z + pad)) {
                    return true;
                }
            }
            return false;
        }

        // --- Ground ---
        var groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
        var groundMat = new THREE.MeshLambertMaterial({ color: 0x3a7d3a });
        var ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(WORLD_CENTER, 0, WORLD_CENTER);
        ground.receiveShadow = true;
        scene.add(ground);

        // Lower terrain skirt to avoid floating-square look at large scale.
        var lowerSize = WORLD_SIZE * 3;
        var lowerGroundGeo = new THREE.PlaneGeometry(lowerSize, lowerSize);
        var lowerGroundMat = new THREE.MeshLambertMaterial({ color: 0x1c2f1c });
        var lowerGround = new THREE.Mesh(lowerGroundGeo, lowerGroundMat);
        lowerGround.rotation.x = -Math.PI / 2;
        lowerGround.position.set(WORLD_CENTER, -6, WORLD_CENTER);
        lowerGround.receiveShadow = true;
        scene.add(lowerGround);

        // Large biome tint patches as a first pass on multi-biome readability.
        var quarter = WORLD_SIZE * 0.25;
        addPatch(quarter, quarter, WORLD_SIZE * 0.34, WORLD_SIZE * 0.34, 0xdcecff);               // ice
        addPatch(WORLD_SIZE - quarter, quarter, WORLD_SIZE * 0.34, WORLD_SIZE * 0.34, 0x8a8f95);   // urban
        addPatch(quarter, WORLD_SIZE - quarter, WORLD_SIZE * 0.34, WORLD_SIZE * 0.34, 0xd9c58d);   // beach
        addPatch(WORLD_SIZE - quarter, WORLD_SIZE - quarter, WORLD_SIZE * 0.34, WORLD_SIZE * 0.34, 0x2e6a2f); // jungle
        addPatch(WORLD_CENTER, WORLD_CENTER, WORLD_SIZE * 0.28, WORLD_SIZE * 0.28, 0x2f7a3b);      // rainforest

        if (shouldShowDebugGrid()) {
            var gridSegments = Math.max(40, Math.round(WORLD_SIZE));
            var gridHelper = new THREE.GridHelper(WORLD_SIZE, gridSegments, 0x2a5d2a, 0x2a5d2a);
            gridHelper.position.set(WORLD_CENTER, 0.2, WORLD_CENTER);
            scene.add(gridHelper);
        }

        // --- Structure materials ---
        var blockMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
        var stoneMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        var brickMat = new THREE.MeshLambertMaterial({ color: 0x994444 });
        var jungleWoodMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
        var jungleLeafMat = new THREE.MeshLambertMaterial({ color: 0x2f6f2f });
        var vineMat = new THREE.MeshLambertMaterial({ color: 0x2a7d3f });
        var dirtMat = new THREE.MeshLambertMaterial({ color: 0x5a4028 });
        var cliffMat = new THREE.MeshLambertMaterial({ color: 0x3f3325 });

        // Scale the original cover layout into the larger world.
        function px(value) { return scaleAxis(value); }
        function span(value) { return scaleSpan(value); }

        addBlock(px(25), 1.5, px(25), span(4), 3, span(1), stoneMat);
        addBlock(px(25), 1.5, px(27), span(1), 3, span(3), stoneMat);
        addBlock(px(25), 1.5, px(23), span(1), 3, span(3), stoneMat);

        addBlock(px(10), 1, px(10), span(3), 2, span(3), blockMat);
        addBlock(px(10), 3, px(10), span(1), 2, span(1), blockMat);
        addBlock(px(40), 1, px(10), span(3), 2, span(3), brickMat);
        addBlock(px(40), 3, px(10), span(1), 2, span(1), brickMat);
        addBlock(px(10), 1, px(40), span(3), 2, span(3), brickMat);
        addBlock(px(10), 3, px(40), span(1), 2, span(1), brickMat);
        addBlock(px(40), 1, px(40), span(3), 2, span(3), blockMat);
        addBlock(px(40), 3, px(40), span(1), 2, span(1), blockMat);

        addBlock(px(20), 1, px(15), span(6), 2, span(1), stoneMat);
        addBlock(px(30), 1, px(35), span(6), 2, span(1), stoneMat);
        addBlock(px(15), 1, px(30), span(1), 2, span(6), blockMat);
        addBlock(px(35), 1, px(20), span(1), 2, span(6), blockMat);

        addBlock(px(8), 0.5, px(25), span(1), 1, span(1), blockMat);
        addBlock(px(42), 0.5, px(25), span(1), 1, span(1), blockMat);
        addBlock(px(25), 0.5, px(8), span(1), 1, span(1), stoneMat);
        addBlock(px(25), 0.5, px(42), span(1), 1, span(1), stoneMat);

        addBlock(px(18), 1, px(22), span(2), 2, span(2), brickMat);
        addBlock(px(32), 1, px(28), span(2), 2, span(2), brickMat);
        addBlock(px(22), 1, px(38), span(2), 2, span(2), stoneMat);
        addBlock(px(28), 1, px(12), span(2), 2, span(2), stoneMat);

        // Edge walls slightly below the arena so the map feels grounded.
        addBlock(WORLD_CENTER, -1.5, 0, WORLD_SIZE, 3, 1, cliffMat, false);
        addBlock(WORLD_CENTER, -1.5, WORLD_SIZE, WORLD_SIZE, 3, 1, cliffMat, false);
        addBlock(0, -1.5, WORLD_CENTER, 1, 3, WORLD_SIZE, cliffMat, false);
        addBlock(WORLD_SIZE, -1.5, WORLD_CENTER, 1, 3, WORLD_SIZE, cliffMat, false);

        // Jungle border barriers.
        var edgeStep = Math.max(2, Math.round(WORLD_SIZE / 30));
        var edge;
        for (edge = WORLD_MIN + 1; edge <= WORLD_MAX - 1; edge += edgeStep) {
            var northHeight = 2 + ((edge % (edgeStep * 3) === 0) ? 1 : 0) + ((edge % (edgeStep * 5) === 0) ? 1 : 0);
            var southHeight = 2 + ((edge % (edgeStep * 4) === 0) ? 1 : 0);
            addBlock(edge, northHeight / 2, WORLD_MIN + 0.8, edgeStep * 0.92, northHeight, 1.2, dirtMat, true);
            addBlock(edge, southHeight / 2, WORLD_MAX - 0.8, edgeStep * 0.92, southHeight, 1.2, dirtMat, true);
        }

        for (edge = WORLD_MIN + 1; edge <= WORLD_MAX - 1; edge += edgeStep) {
            var westHeight = 2 + ((edge % (edgeStep * 4) === 0) ? 1 : 0);
            var eastHeight = 2 + ((edge % (edgeStep * 3) === 0) ? 1 : 0);
            addBlock(WORLD_MIN + 0.8, westHeight / 2, edge, 1.2, westHeight, edgeStep * 0.92, dirtMat, true);
            addBlock(WORLD_MAX - 0.8, eastHeight / 2, edge, 1.2, eastHeight, edgeStep * 0.92, dirtMat, true);
        }

        // Dense border trees.
        var borderStep = Math.max(7, Math.round(WORLD_SIZE / 12));
        var borderOffset = 2.8;
        var rowToggle = 0;
        for (edge = WORLD_MIN + 3; edge <= WORLD_MAX - 3; edge += borderStep) {
            addJungleTree(edge, WORLD_MIN + borderOffset + (rowToggle % 2) * 0.8, 3 + (rowToggle % 3), jungleWoodMat, jungleLeafMat, vineMat);
            addJungleTree(edge, WORLD_MAX - borderOffset - (rowToggle % 2) * 0.8, 3 + ((rowToggle + 1) % 3), jungleWoodMat, jungleLeafMat, vineMat);
            rowToggle++;
        }

        rowToggle = 0;
        for (edge = WORLD_MIN + 3; edge <= WORLD_MAX - 3; edge += borderStep) {
            addJungleTree(WORLD_MIN + borderOffset + (rowToggle % 2) * 0.8, edge, 3 + (rowToggle % 3), jungleWoodMat, jungleLeafMat, vineMat);
            addJungleTree(WORLD_MAX - borderOffset - (rowToggle % 2) * 0.8, edge, 3 + ((rowToggle + 1) % 3), jungleWoodMat, jungleLeafMat, vineMat);
            rowToggle++;
        }

        // Interior vegetation and cover tuned for the larger area.
        var centerKeepout = Math.max(10, WORLD_SIZE * 0.11);
        var treeTarget = Math.round(18 * WORLD_AREA_SCALE);
        var bushTarget = Math.round(24 * WORLD_AREA_SCALE);
        var logTarget = Math.round(8 * WORLD_AREA_SCALE);
        var tries = 0;
        var placed = 0;
        var x, z;

        while (placed < treeTarget && tries < treeTarget * 6) {
            tries++;
            x = randRange(WORLD_MIN + 4, WORLD_MAX - 4);
            z = randRange(WORLD_MIN + 4, WORLD_MAX - 4);

            if (Math.abs(x - WORLD_CENTER) < centerKeepout && Math.abs(z - WORLD_CENTER) < centerKeepout) continue;
            if (pointBlocked(x, z, 1.3)) continue;

            addJungleTree(x, z, 3 + (placed % 3), jungleWoodMat, jungleLeafMat, vineMat);
            placed++;
        }

        tries = 0;
        placed = 0;
        while (placed < bushTarget && tries < bushTarget * 4) {
            tries++;
            x = randRange(WORLD_MIN + 2, WORLD_MAX - 2);
            z = randRange(WORLD_MIN + 2, WORLD_MAX - 2);
            if (Math.abs(x - WORLD_CENTER) < centerKeepout * 0.8 && Math.abs(z - WORLD_CENTER) < centerKeepout * 0.8) continue;
            addBush(x, z, jungleLeafMat);
            placed++;
        }

        tries = 0;
        placed = 0;
        while (placed < logTarget && tries < logTarget * 8) {
            tries++;
            x = randRange(WORLD_MIN + 3, WORLD_MAX - 3);
            z = randRange(WORLD_MIN + 3, WORLD_MAX - 3);
            if (pointBlocked(x, z, 1.2)) continue;
            addLog(x, z, (placed % 2) === 0, jungleWoodMat);
            placed++;
        }

        // --- Lighting ---
        scene.add(new THREE.AmbientLight(0x606060, 1.0));

        var dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(WORLD_CENTER + WORLD_SIZE * 0.1, WORLD_SIZE, WORLD_CENTER + WORLD_SIZE * 0.1);
        dirLight.castShadow = false;
        scene.add(dirLight);

        scene.add(new THREE.HemisphereLight(0x87CEEB, 0x3a7d3a, 0.5));

        scene.background = new THREE.Color(0x87CEEB);
        scene.fog = new THREE.Fog(0x87CEEB, WORLD_SIZE * 0.6, WORLD_SIZE * 1.6);
    };

    GameWorld.getCollidables = function () {
        return collidables;
    };

    GameWorld.getBounds = function () {
        return {
            min: WORLD_MIN,
            max: WORLD_MAX,
            size: WORLD_SIZE,
            center: WORLD_CENTER
        };
    };

    GameWorld.getSize = function () {
        return WORLD_SIZE;
    };

    GameWorld.getCenter = function () {
        return WORLD_CENTER;
    };

    GameWorld.getAreaScale = function () {
        return WORLD_AREA_SCALE;
    };

    GameWorld.getSpawnPadding = function () {
        return DEFAULT_SPAWN_PADDING;
    };

    GameWorld.getRandomSpawnPoint = function (padding) {
        return randomSpawnPoint(padding);
    };

    GameWorld.getRecommendedEnemyCount = function () {
        return Math.max(8, Math.round(5 * Math.sqrt(WORLD_AREA_SCALE)));
    };

    GameWorld.getSeed = function () {
        return WORLD_SEED;
    };

    GameWorld.setSeed = function (seedText) {
        setSeed(seedText);
        return WORLD_SEED;
    };

    window.GameWorld = GameWorld;
})();
