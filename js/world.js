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
    // Baseline world size used for current combat tuning (1 unit = 1 meter convention).
    var COMBAT_TUNED_WORLD_SIZE = 112;
    var WORLD_SEED = 'mineshoot-v1';
    var rngState = 1;
    var waterPools = [];

    // Solid meshes used for movement/raycast collisions.
    var collidables = [];
    var BIOME_ARCTIC = 'arctic';
    var BIOME_URBAN = 'urban';
    var BIOME_DESERT = 'desert';
    var BIOME_JUNGLE = 'jungle';

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

    function scaleAxis(value) {
        return (value / BASE_WORLD_SIZE) * WORLD_SIZE;
    }

    function scaleSpan(value) {
        return Math.max(1, (value / BASE_WORLD_SIZE) * WORLD_SIZE);
    }

    function getCombatScale() {
        if (COMBAT_TUNED_WORLD_SIZE <= 0) return 1;
        return WORLD_SIZE / COMBAT_TUNED_WORLD_SIZE;
    }

    function scaleCombatDistance(value) {
        return value * getCombatScale();
    }

    function randRange(min, max) {
        return min + random01() * (max - min);
    }

    function randomSpawnPoint(padding) {
        var pad = (typeof padding === 'number') ? padding : DEFAULT_SPAWN_PADDING;
        var min = WORLD_MIN + pad;
        var max = WORLD_MAX - pad;
        for (var tries = 0; tries < 20; tries++) {
            var x = randRange(min, max);
            var z = randRange(min, max);
            if (getGroundHeightAt(x, z) > -0.15) {
                return { x: x, z: z };
            }
        }
        return { x: randRange(min, max), z: randRange(min, max) };
    }

    function biomeAt(x, z) {
        if (x < WORLD_CENTER && z < WORLD_CENTER) return BIOME_ARCTIC;
        if (x >= WORLD_CENTER && z < WORLD_CENTER) return BIOME_URBAN;
        if (x < WORLD_CENTER && z >= WORLD_CENTER) return BIOME_DESERT;
        return BIOME_JUNGLE;
    }

    function biomeBounds(biomeId, padding) {
        var pad = padding || 0;
        if (biomeId === BIOME_ARCTIC) {
            return { minX: WORLD_MIN + pad, maxX: WORLD_CENTER - pad, minZ: WORLD_MIN + pad, maxZ: WORLD_CENTER - pad };
        }
        if (biomeId === BIOME_URBAN) {
            return { minX: WORLD_CENTER + pad, maxX: WORLD_MAX - pad, minZ: WORLD_MIN + pad, maxZ: WORLD_CENTER - pad };
        }
        if (biomeId === BIOME_DESERT) {
            return { minX: WORLD_MIN + pad, maxX: WORLD_CENTER - pad, minZ: WORLD_CENTER + pad, maxZ: WORLD_MAX - pad };
        }
        return { minX: WORLD_CENTER + pad, maxX: WORLD_MAX - pad, minZ: WORLD_CENTER + pad, maxZ: WORLD_MAX - pad };
    }

    function randomPointInBiome(biomeId, padding) {
        var b = biomeBounds(biomeId, padding || 0);
        return {
            x: randRange(b.minX, b.maxX),
            z: randRange(b.minZ, b.maxZ)
        };
    }

    function getGroundHeightAt(x, z) {
        var y = 0;
        for (var i = 0; i < waterPools.length; i++) {
            var p = waterPools[i];
            var dx = x - p.x;
            var dz = z - p.z;
            var d = Math.sqrt(dx * dx + dz * dz);
            if (d >= p.radius) continue;
            var t = 1 - (d / p.radius);
            var depth = p.depth * (0.35 + 0.65 * t);
            var sampleY = -depth;
            if (sampleY < y) y = sampleY;
        }
        return y;
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

        function addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid) {
            var geo = new THREE.BoxGeometry(w, h, d);
            var mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, y, z);
            mesh.rotation.y = rotY || 0;
            mesh.rotation.x = tiltX || 0;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            if (isSolid !== false) {
                markSolid(mesh);
            }
            return mesh;
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
        waterPools = [];
        var junglePoolCount = Math.max(3, Math.round(WORLD_AREA_SCALE * 1.2));
        var poolTries = 0;
        while (waterPools.length < junglePoolCount && poolTries < junglePoolCount * 8) {
            poolTries++;
            var poolPt = randomPointInBiome(BIOME_JUNGLE, 5);
            var poolRadius = randRange(2.5, 5.2);
            if (poolPt.x + poolRadius > WORLD_MAX - 2 || poolPt.z + poolRadius > WORLD_MAX - 2) continue;
            waterPools.push({
                x: poolPt.x,
                z: poolPt.z,
                radius: poolRadius,
                depth: randRange(0.55, 0.9),
                surfaceY: -0.22
            });
        }

        var groundSeg = Math.max(48, Math.round(WORLD_SIZE * 1.15));
        var groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, groundSeg, groundSeg);
        groundGeo.rotateX(-Math.PI / 2);
        groundGeo.translate(WORLD_CENTER, 0, WORLD_CENTER);
        var groundPos = groundGeo.attributes.position;
        var groundColors = new Float32Array(groundPos.count * 3);
        var color = new THREE.Color();
        for (var vi = 0; vi < groundPos.count; vi++) {
            var gx = groundPos.getX(vi);
            var gz = groundPos.getZ(vi);
            var gy = getGroundHeightAt(gx, gz);
            groundPos.setY(vi, gy);

            var biomeId = biomeAt(gx, gz);
            if (biomeId === BIOME_ARCTIC) {
                color.setHex(0xd6ecff);
            } else if (biomeId === BIOME_URBAN) {
                color.setHex(0x888f97);
            } else if (biomeId === BIOME_DESERT) {
                color.setHex(0xd8c184);
            } else {
                color.setHex(0x3f7e3d);
            }
            if (gy < -0.05) {
                color.setHex(0x2f6f8f);
            }

            groundColors[(vi * 3)] = color.r;
            groundColors[(vi * 3) + 1] = color.g;
            groundColors[(vi * 3) + 2] = color.b;
        }
        groundGeo.setAttribute('color', new THREE.BufferAttribute(groundColors, 3));
        groundPos.needsUpdate = true;
        groundGeo.computeVertexNormals();
        var groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
        var ground = new THREE.Mesh(groundGeo, groundMat);
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

        var gridSegments = Math.max(40, Math.round(WORLD_SIZE));
        var gridHelper = new THREE.GridHelper(WORLD_SIZE, gridSegments, 0x2a5d2a, 0x2a5d2a);
        gridHelper.position.set(WORLD_CENTER, 0.04, WORLD_CENTER);
        scene.add(gridHelper);

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

        // Biome-specific props and cover.
        var tries = 0;
        var placed = 0;
        var x, z;

        // Jungle: dense vegetation and logs.
        var jungleTreeTarget = Math.round(14 * WORLD_AREA_SCALE);
        var jungleBushTarget = Math.round(18 * WORLD_AREA_SCALE);
        var jungleLogTarget = Math.round(7 * WORLD_AREA_SCALE);
        tries = 0;
        placed = 0;
        while (placed < jungleTreeTarget && tries < jungleTreeTarget * 7) {
            tries++;
            var jt = randomPointInBiome(BIOME_JUNGLE, 4);
            x = jt.x; z = jt.z;
            if (getGroundHeightAt(x, z) < -0.18) continue;
            if (pointBlocked(x, z, 1.35)) continue;
            addJungleTree(x, z, 3 + (placed % 3), jungleWoodMat, jungleLeafMat, vineMat);
            placed++;
        }

        tries = 0;
        placed = 0;
        while (placed < jungleBushTarget && tries < jungleBushTarget * 5) {
            tries++;
            var jb = randomPointInBiome(BIOME_JUNGLE, 3);
            x = jb.x; z = jb.z;
            if (getGroundHeightAt(x, z) < -0.15) continue;
            addBush(x, z, jungleLeafMat);
            placed++;
        }

        tries = 0;
        placed = 0;
        while (placed < jungleLogTarget && tries < jungleLogTarget * 9) {
            tries++;
            var jl = randomPointInBiome(BIOME_JUNGLE, 4);
            x = jl.x; z = jl.z;
            if (getGroundHeightAt(x, z) < -0.12) continue;
            if (pointBlocked(x, z, 1.2)) continue;
            addLog(x, z, (placed % 2) === 0, jungleWoodMat);
            placed++;
        }

        // Arctic: ice blocks and crystal-like pillars.
        var iceMat = new THREE.MeshLambertMaterial({ color: 0xbfe6ff });
        var frostMat = new THREE.MeshLambertMaterial({ color: 0xe8f6ff });
        var arcticTarget = Math.round(16 * WORLD_AREA_SCALE);
        tries = 0;
        placed = 0;
        while (placed < arcticTarget && tries < arcticTarget * 8) {
            tries++;
            var ap = randomPointInBiome(BIOME_ARCTIC, 4);
            x = ap.x; z = ap.z;
            if (pointBlocked(x, z, 1.25)) continue;
            var h = randRange(1.2, 3.8);
            addBlock(x, h * 0.5, z, randRange(0.7, 1.3), h, randRange(0.7, 1.3), (placed % 3 === 0) ? frostMat : iceMat, true);
            placed++;
        }

        // Desert: sandstone cover and cacti.
        var sandMat = new THREE.MeshLambertMaterial({ color: 0xd9bf75 });
        var cactusMat = new THREE.MeshLambertMaterial({ color: 0x4f8a3d });
        var desertRockTarget = Math.round(12 * WORLD_AREA_SCALE);
        tries = 0;
        placed = 0;
        while (placed < desertRockTarget && tries < desertRockTarget * 8) {
            tries++;
            var dp = randomPointInBiome(BIOME_DESERT, 4);
            x = dp.x; z = dp.z;
            if (pointBlocked(x, z, 1.2)) continue;
            addBlock(x, 0.7, z, randRange(1.0, 2.2), randRange(1.1, 2.0), randRange(1.0, 2.2), sandMat, true);
            if (placed % 3 === 0) {
                addBlock(x + 0.45, 1.15, z, 0.2, 1.4, 0.2, cactusMat, true);
                addBlock(x + 0.72, 1.05, z, 0.34, 0.2, 0.2, cactusMat, true);
            }
            placed++;
        }

        // Urban skatepark: ramps, rails, and ledges.
        var concreteMat = new THREE.MeshLambertMaterial({ color: 0x7f868d });
        var railMat = new THREE.MeshLambertMaterial({ color: 0x595f66 });
        var urbanBounds = biomeBounds(BIOME_URBAN, 6);
        var urbanMidX = (urbanBounds.minX + urbanBounds.maxX) * 0.5;
        var urbanMidZ = (urbanBounds.minZ + urbanBounds.maxZ) * 0.5;
        addRamp(urbanMidX - 6, 0.9, urbanMidZ - 4, 6.5, 1.4, 3.6, concreteMat, 0, -0.28, true);
        addRamp(urbanMidX + 6, 0.9, urbanMidZ + 3, 6.5, 1.4, 3.6, concreteMat, Math.PI, -0.28, true);
        addBlock(urbanMidX, 0.65, urbanMidZ, 7.2, 1.3, 3.0, concreteMat, true); // center funbox
        addBlock(urbanMidX, 1.45, urbanMidZ, 6.2, 0.12, 0.12, railMat, true); // rail
        addBlock(urbanMidX - 10, 0.55, urbanMidZ + 4, 4.8, 1.1, 2.4, concreteMat, true);
        addBlock(urbanMidX + 10, 0.55, urbanMidZ - 4, 4.8, 1.1, 2.4, concreteMat, true);

        // Water surfaces over carved jungle pools (non-coplanar above basin floors).
        var waterMat = new THREE.MeshLambertMaterial({
            color: 0x2f7ca1,
            transparent: true,
            opacity: 0.72
        });
        for (var wp = 0; wp < waterPools.length; wp++) {
            var pool = waterPools[wp];
            var water = new THREE.Mesh(
                new THREE.CylinderGeometry(pool.radius * 0.98, pool.radius * 0.98, 0.12, 24),
                waterMat
            );
            water.position.set(pool.x, pool.surfaceY, pool.z);
            water.receiveShadow = true;
            scene.add(water);
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

    GameWorld.getCombatScale = function () {
        return getCombatScale();
    };

    GameWorld.scaleCombatDistance = function (value) {
        return scaleCombatDistance(value);
    };

    GameWorld.getSpawnPadding = function () {
        return DEFAULT_SPAWN_PADDING;
    };

    GameWorld.getRandomSpawnPoint = function (padding) {
        return randomSpawnPoint(padding);
    };

    GameWorld.getGroundHeightAt = function (x, z) {
        return getGroundHeightAt(x, z);
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
