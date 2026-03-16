import { chooseSpawnPoint } from '../../shared/spawn-logic.js';

/**
 * world.js - Static authored world layout for open-arena combat.
 * Biome content is provided by plug-and-play quadrant modules in js/world/.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameWorld
 */
(function () {
    'use strict';

    var GameWorld = {};

    var SHARED_PROTOCOL = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol)
        ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol
        : null;
    var SHARED_WORLD_CFG = (SHARED_PROTOCOL && SHARED_PROTOCOL.world) ? SHARED_PROTOCOL.world : null;
    var SHARED_LAYOUT = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.worldLayout)
        ? globalThis.__MAYHEM_RUNTIME.GameShared.worldLayout
        : null;

    var BASE_WORLD_SIZE = SHARED_LAYOUT.BASE_WORLD_SIZE;
    var WORLD_AREA_SCALE = SHARED_LAYOUT.WORLD_AREA_SCALE;
    var WORLD_SIZE = SHARED_LAYOUT.WORLD_SIZE;
    var WORLD_CENTER = SHARED_LAYOUT.WORLD_CENTER;
    var WORLD_MARGIN = SHARED_LAYOUT.WORLD_MARGIN;
    var WORLD_MIN = SHARED_LAYOUT.WORLD_MIN;
    var WORLD_MAX = SHARED_LAYOUT.WORLD_MAX;
    var DEFAULT_SPAWN_PADDING = SHARED_LAYOUT.DEFAULT_SPAWN_PADDING;

    var BIOME_ARCTIC = SHARED_LAYOUT.BIOME_ARCTIC;
    var BIOME_URBAN = SHARED_LAYOUT.BIOME_URBAN;
    var BIOME_DESERT = SHARED_LAYOUT.BIOME_DESERT;
    var BIOME_JUNGLE = SHARED_LAYOUT.BIOME_JUNGLE;
    var BIOME_NUCLEAR = SHARED_LAYOUT.BIOME_NUCLEAR;
    var BIOME_CITADEL = SHARED_LAYOUT.BIOME_CITADEL;
    var BIOME_QUARRY = SHARED_LAYOUT.BIOME_QUARRY;
    var BIOME_BASIN = SHARED_LAYOUT.BIOME_BASIN;
    var BIOME_RADAR = SHARED_LAYOUT.BIOME_RADAR;

    var DEFAULT_QUADRANT_MAP = SHARED_LAYOUT.DEFAULT_QUADRANT_MAP.slice();

    var DEFAULT_WORLD_PROFILE_VERSION = Math.max(1, Math.round(Number(SHARED_WORLD_CFG && SHARED_WORLD_CFG.profileVersion) || 6));
    var DEFAULT_WORLD_FLAGS = {
        envV2: (SHARED_WORLD_CFG && SHARED_WORLD_CFG.flags) ? !!SHARED_WORLD_CFG.flags.envV2 : true,
        terrainPhysicsV2: (SHARED_WORLD_CFG && SHARED_WORLD_CFG.flags) ? !!SHARED_WORLD_CFG.flags.terrainPhysicsV2 : true
    };

    var WORLD_PROFILE_VERSION = DEFAULT_WORLD_PROFILE_VERSION;
    var WORLD_FLAGS = cloneWorldFlags(DEFAULT_WORLD_FLAGS);
    var WORLD_SEED = String((SHARED_WORLD_CFG && SHARED_WORLD_CFG.seedPrefix) || 'room-env-v6-static') + '-global';

    var terrainSampler = null;
    var collidables = [];
    var spawnExclusionZones = [];
    var generationStats = null;

    var animatedWaterfallSheets = [];
    var animatedMistCards = [];
    var animatedLeaves = [];
    var animatedIceShimmers = [];
    var animatedFlickers = [];
    var animatedSteamColumns = [];
    var animatedClouds = [];
    var animClock = 0;

    // --- Ground color per biome ---
    var GROUND_COLORS = {};
    GROUND_COLORS[BIOME_ARCTIC] = 0xd0e8f4;
    GROUND_COLORS[BIOME_URBAN]  = 0x8f969e;
    GROUND_COLORS[BIOME_DESERT] = 0xd6bf7f;
    GROUND_COLORS[BIOME_JUNGLE] = 0x3b7c3f;
    GROUND_COLORS[BIOME_NUCLEAR] = 0x788188;
    GROUND_COLORS[BIOME_CITADEL] = 0x7d766d;
    GROUND_COLORS[BIOME_QUARRY] = 0x8a6f5f;
    GROUND_COLORS[BIOME_BASIN] = 0x658798;
    GROUND_COLORS[BIOME_RADAR] = 0x97a19a;

    function cloneWorldFlags(flags) {
        return {
            envV2: !!(flags && flags.envV2),
            terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
        };
    }

    function normalizeWorldMeta(rawMeta) {
        if (!rawMeta || typeof rawMeta !== 'object') {
            return {
                worldSeed: '',
                worldProfileVersion: DEFAULT_WORLD_PROFILE_VERSION,
                worldFlags: cloneWorldFlags(DEFAULT_WORLD_FLAGS)
            };
        }

        var seed = '';
        if (typeof rawMeta.worldSeed === 'string' && rawMeta.worldSeed.trim()) {
            seed = rawMeta.worldSeed.trim();
        } else if (typeof rawMeta.seed === 'string' && rawMeta.seed.trim()) {
            seed = rawMeta.seed.trim();
        }

        return {
            worldSeed: seed,
            worldProfileVersion: Math.max(1, Math.round(Number(rawMeta.worldProfileVersion) || DEFAULT_WORLD_PROFILE_VERSION)),
            worldFlags: cloneWorldFlags(rawMeta.worldFlags || DEFAULT_WORLD_FLAGS)
        };
    }

    function setSeed(seedText) {
        var next = String(seedText || '').trim();
        if (!next) return WORLD_SEED;
        WORLD_SEED = next;
        return WORLD_SEED;
    }

    function cloneGenerationStats(stats) {
        if (!stats || typeof stats !== 'object') return null;
        var copy = {};
        for (var biomeId in stats) {
            if (!stats[biomeId] || typeof stats[biomeId] !== 'object') continue;
            copy[biomeId] = {};
            for (var key in stats[biomeId]) {
                copy[biomeId][key] = Number(stats[biomeId][key]) || 0;
            }
        }
        return copy;
    }

    function clamp01(value) {
        if (value < 0) return 0;
        if (value > 1) return 1;
        return value;
    }

    function lerp(a, b, t) {
        return a + ((b - a) * t);
    }

    function quadrantBounds(quadrant) {
        return SHARED_LAYOUT.quadrantBounds(quadrant);
    }

    function biomeAt(x, z) {
        return SHARED_LAYOUT.biomeAtPosition(x, z, DEFAULT_QUADRANT_MAP);
    }

    function biomeBounds(biomeId) {
        for (var i = 0; i < DEFAULT_QUADRANT_MAP.length; i++) {
            if (DEFAULT_QUADRANT_MAP[i].biome === biomeId) {
                return quadrantBounds(DEFAULT_QUADRANT_MAP[i].quadrant);
            }
        }
        return quadrantBounds(DEFAULT_QUADRANT_MAP[DEFAULT_QUADRANT_MAP.length - 1].quadrant);
    }

    function pointInBounds(bounds, u, v) {
        var uu = clamp01(Number(u || 0));
        var vv = clamp01(Number(v || 0));
        return {
            x: lerp(bounds.minX, bounds.maxX, uu),
            z: lerp(bounds.minZ, bounds.maxZ, vv)
        };
    }

    function isSpawnExcluded(x, z, padding) {
        var pad = Number(padding || 0);
        for (var i = 0; i < spawnExclusionZones.length; i++) {
            var zone = spawnExclusionZones[i];
            if (!zone) continue;
            var dx = x - zone.x;
            var dz = z - zone.z;
            var r = Math.max(0, Number(zone.radius || 0)) + pad;
            if ((dx * dx) + (dz * dz) <= (r * r)) return true;
        }
        return false;
    }

    function addSpawnExclusionCircle(x, z, radius) {
        spawnExclusionZones.push({
            x: Number(x || 0),
            z: Number(z || 0),
            radius: Math.max(0.1, Number(radius || 0.1))
        });
    }

    function isPointBlockedByCollidables(x, z, padding) {
        var pad = Number(padding || 0);
        for (var i = 0; i < collidables.length; i++) {
            var mesh = collidables[i];
            var box = (mesh && mesh.userData) ? mesh.userData.collisionBox : null;
            if (!box) continue;
            if (x > (box.min.x - pad) && x < (box.max.x + pad) && z > (box.min.z - pad) && z < (box.max.z + pad)) {
                return true;
            }
        }
        return false;
    }

    function getGroundHeightAt(x, z) {
        if (WORLD_FLAGS.terrainPhysicsV2 && terrainSampler && typeof terrainSampler.getGroundHeightAt === 'function') {
            return Number(terrainSampler.getGroundHeightAt(Number(x || 0), Number(z || 0)) || 0);
        }
        return 0;
    }

    function randomSpawnPoint(padding, options) {
        var pad = (typeof padding === 'number') ? padding : DEFAULT_SPAWN_PADDING;
        var opts = options || {};
        return chooseSpawnPoint({
            boundsMin: WORLD_MIN,
            boundsMax: WORLD_MAX,
            padding: pad,
            minGroundY: -0.15,
            minClearance: Number(opts.minClearance || 0),
            avoidPoints: Array.isArray(opts.avoidPoints) ? opts.avoidPoints : [],
            getGroundHeightAt: getGroundHeightAt,
            isExcluded: function (x, z) {
                return isSpawnExcluded(x, z, 0.85);
            },
            isBlocked: function (x, z) {
                return isPointBlockedByCollidables(x, z, 1.15);
            }
        });
    }

    // ---------------------------------------------------------------
    // World creation
    // ---------------------------------------------------------------

    GameWorld.create = function (scene, options) {
        var meta = normalizeWorldMeta(options && options.worldMeta ? options.worldMeta : null);
        if (meta.worldSeed) {
            setSeed(meta.worldSeed);
        }
        WORLD_PROFILE_VERSION = meta.worldProfileVersion;
        WORLD_FLAGS = cloneWorldFlags(meta.worldFlags);

        terrainSampler = null;
        collidables = [];
        spawnExclusionZones = [];
        animatedWaterfallSheets = [];
        animatedMistCards = [];
        animatedLeaves = [];
        animatedIceShimmers = [];
        animatedFlickers = [];
        animatedSteamColumns = [];
        animatedClouds = [];
        animClock = 0;

        generationStats = {};

        var SHARED_TERRAIN = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.terrainSampler)
            ? globalThis.__MAYHEM_RUNTIME.GameShared.terrainSampler
            : null;
        if (SHARED_TERRAIN && typeof SHARED_TERRAIN.createTerrainSampler === 'function') {
            terrainSampler = SHARED_TERRAIN.createTerrainSampler({
                worldSeed: WORLD_SEED,
                worldProfileVersion: WORLD_PROFILE_VERSION,
                worldFlags: cloneWorldFlags(WORLD_FLAGS)
            });
        }

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
            if (isSolid !== false) markSolid(mesh);
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
            if (isSolid !== false) markSolid(mesh);
            return mesh;
        }

        function addDecor(x, y, z, geometry, material, rotY, rotX, rotZ) {
            var mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, y, z);
            if (rotY) mesh.rotation.y = rotY;
            if (rotX) mesh.rotation.x = rotX;
            if (rotZ) mesh.rotation.z = rotZ;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            return mesh;
        }

        var place = {
            addBlock: addBlock,
            addRamp: addRamp,
            addDecor: addDecor
        };

        var quadrantCtx = {
            scene: scene,
            addExclusion: function (x, z, r) { addSpawnExclusionCircle(x, z, r); },
            addWaterfallSheet: function (data) { animatedWaterfallSheets.push(data); },
            addMistCard: function (data) { animatedMistCards.push(data); },
            addLeafSway: function (data) { animatedLeaves.push(data); },
            addIceShimmer: function (data) { animatedIceShimmers.push(data); },
            addFlicker: function (data) { animatedFlickers.push(data); },
            addSteamColumn: function (data) { animatedSteamColumns.push(data); }
        };

        // --- Ground plane with per-biome vertex colors ---
        var groundSeg = Math.max(48, Math.round(WORLD_SIZE * 1.15));
        var groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, groundSeg, groundSeg);
        groundGeo.rotateX(-Math.PI / 2);
        groundGeo.translate(WORLD_CENTER, 0, WORLD_CENTER);

        var groundPos = groundGeo.attributes.position;
        var groundColors = new Float32Array(groundPos.count * 3);
        var color = new THREE.Color();

        var biomeColorCache = {};
        for (var bk in GROUND_COLORS) {
            biomeColorCache[bk] = new THREE.Color(GROUND_COLORS[bk]);
        }

        for (var vi = 0; vi < groundPos.count; vi++) {
            var gx = groundPos.getX(vi);
            var gz = groundPos.getZ(vi);
            var gy = getGroundHeightAt(gx, gz);
            groundPos.setY(vi, gy);

            var biomeId = biomeAt(gx, gz);
            color.copy(biomeColorCache[biomeId] || biomeColorCache[BIOME_JUNGLE]);

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

        var matLib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;

        // Abyss plane far below to hide the void.
        var lowerGroundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 3, WORLD_SIZE * 3);
        var lowerGroundMat = matLib.getLambert({ color: 0x1a2a20 });
        var lowerGround = new THREE.Mesh(lowerGroundGeo, lowerGroundMat);
        lowerGround.rotation.x = -Math.PI / 2;
        lowerGround.position.set(WORLD_CENTER, -6, WORLD_CENTER);
        lowerGround.receiveShadow = true;
        scene.add(lowerGround);

        // --- Biome-themed perimeter walls ---
        (function buildBiomeWalls() {
            SHARED_LAYOUT.buildBiomePerimeter(place, {
                arcticBase: matLib.getLambert({ color: 0x8aafcc }),
                arcticAccent: matLib.getLambert({ color: 0xc8e8f8 }),
                arcticDetail: matLib.getLambert({ color: 0x9ad4f0, transparent: true, opacity: 0.7 }),
                urbanBase: matLib.getLambert({ color: 0x6a7078 }),
                urbanAccent: matLib.getLambert({ color: 0x3a3e44 }),
                urbanDetail: matLib.getLambert({ color: 0xc85a3a }),
                desertBase: matLib.getLambert({ color: 0xc49a5c }),
                desertAccent: matLib.getLambert({ color: 0xb07842 }),
                desertDetail: matLib.getLambert({ color: 0x8a6b4a }),
                jungleBase: matLib.getLambert({ color: 0x4a5040 }),
                jungleAccent: matLib.getLambert({ color: 0x3d6a32 }),
                jungleDetail: matLib.getLambert({ color: 0x2d5a28 }),
                nuclearBase: matLib.getLambert({ color: 0x737a80 }),
                nuclearAccent: matLib.getLambert({ color: 0xcaa43c }),
                nuclearDetail: matLib.getLambert({ color: 0x50575d }),
                citadelBase: matLib.getLambert({ color: 0x6d6961 }),
                citadelAccent: matLib.getLambert({ color: 0x989086 }),
                citadelDetail: matLib.getLambert({ color: 0x4b4740 }),
                quarryBase: matLib.getLambert({ color: 0x866f61 }),
                quarryAccent: matLib.getLambert({ color: 0xb39984 }),
                quarryDetail: matLib.getLambert({ color: 0x5e4c40 }),
                basinBase: matLib.getLambert({ color: 0x69757b }),
                basinAccent: matLib.getLambert({ color: 0x5aa1b7 }),
                basinDetail: matLib.getLambert({ color: 0x355965 }),
                radarBase: matLib.getLambert({ color: 0x8c958e }),
                radarAccent: matLib.getLambert({ color: 0xc7d5d0 }),
                radarDetail: matLib.getLambert({ color: 0x56636b })
            }, DEFAULT_QUADRANT_MAP);
        })();

        // --- Quadrant dispatch ---
        var quadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {};

        for (var qi = 0; qi < DEFAULT_QUADRANT_MAP.length; qi++) {
            var entry = DEFAULT_QUADRANT_MAP[qi];
            var builder = quadrants[entry.biome];
            if (typeof builder !== 'function') continue;
            var rawBounds = quadrantBounds(entry.quadrant);
            var builderCtx = Object.assign({}, quadrantCtx, {
                biomeEntry: entry,
                rawBounds: rawBounds
            });
            var stats = builder(rawBounds, place, builderCtx);
            if (stats) {
                var target = generationStats[entry.biome] || {};
                generationStats[entry.biome] = target;
                for (var sk in stats) {
                    if (typeof stats[sk] === 'number') target[sk] = (Number(target[sk]) || 0) + stats[sk];
                }
            }
        }

        // --- Lighting ---
        scene.add(new THREE.AmbientLight(0x6a7584, 0.94));

        var dirLight = new THREE.DirectionalLight(0xfff4d8, 1.12);
        dirLight.position.set(WORLD_CENTER + (WORLD_SIZE * 0.22), WORLD_SIZE * 0.95, WORLD_CENTER - (WORLD_SIZE * 0.12));
        dirLight.castShadow = false;
        scene.add(dirLight);

        scene.add(new THREE.HemisphereLight(0xd4e8ff, 0x4d6149, 0.7));

        var arcticFillLight = new THREE.PointLight(0x8ed5ff, 0.32, WORLD_SIZE * 0.95);
        arcticFillLight.position.set(WORLD_CENTER * 0.48, WORLD_SIZE * 0.28, WORLD_CENTER * 0.5);
        scene.add(arcticFillLight);

        // --- Sky & atmosphere ---
        scene.background = new THREE.Color(0x6a9bc2);
        scene.fog = new THREE.Fog(0x7eaec8, WORLD_SIZE * 0.5, WORLD_SIZE * 1.4);

        (function buildBlockClouds() {
            var cloudMat = matLib.getLambert({ color: 0xf5fbff });
            var BLOCK_W = 3.2;
            var BLOCK_H = 1.6;
            var BLOCK_D = 3.2;

            function addCloudCluster(cx, cy, cz, cells, driftSpeed, driftPhase) {
                var root = new THREE.Group();
                root.position.set(cx, cy, cz);
                root.userData.baseX = cx;
                root.userData.baseZ = cz;
                scene.add(root);

                for (var i = 0; i < cells.length; i++) {
                    var cell = cells[i];
                    var block = new THREE.Mesh(
                        new THREE.BoxGeometry(
                            (cell.w || 1) * BLOCK_W,
                            (cell.h || 1) * BLOCK_H,
                            (cell.d || 1) * BLOCK_D
                        ),
                        cloudMat
                    );
                    block.position.set(
                        (cell.x || 0) * BLOCK_W,
                        (cell.y || 0) * BLOCK_H,
                        (cell.z || 0) * BLOCK_D
                    );
                    block.castShadow = false;
                    block.receiveShadow = false;
                    root.add(block);
                }

                animatedClouds.push({
                    root: root,
                    baseX: cx,
                    baseZ: cz,
                    driftSpeed: driftSpeed,
                    driftPhase: driftPhase
                });
            }

            addCloudCluster(18, 33.6, 22, [
                { x: 0,  y: 0, z: 0, w: 4, d: 2 },
                { x: -2, y: 0, z: 0, w: 2, d: 2 },
                { x: 2,  y: 0, z: 0, w: 2, d: 1 },
                { x: -1, y: 1, z: 0, w: 2, d: 1 },
                { x: 1,  y: 1, z: 0, w: 1, d: 1 },
                { x: 0,  y: -1,z: 1, w: 2, d: 1 }
            ], 0.55, 0.2);

            addCloudCluster(74, 37.2, 18, [
                { x: 0,  y: 0, z: 0, w: 5, d: 2 },
                { x: -3, y: 0, z: 0, w: 2, d: 1 },
                { x: 3,  y: 0, z: 0, w: 2, d: 2 },
                { x: -1, y: 1, z: 0, w: 3, d: 1 },
                { x: 1,  y: 1, z: -1,w: 2, d: 1 },
                { x: 0,  y: -1,z: 1, w: 2, d: 1 }
            ], 0.38, 1.3);

            addCloudCluster(96, 32.4, 70, [
                { x: 0,  y: 0, z: 0, w: 3, d: 2 },
                { x: -2, y: 0, z: 0, w: 1, d: 1 },
                { x: 2,  y: 0, z: 0, w: 1, d: 1 },
                { x: 0,  y: 1, z: 0, w: 1, d: 1 }
            ], 0.62, 2.1);

            addCloudCluster(40, 40.8, 88, [
                { x: 0,  y: 0, z: 0, w: 6, d: 2 },
                { x: -4, y: 0, z: 0, w: 2, d: 2 },
                { x: 4,  y: 0, z: 0, w: 2, d: 1 },
                { x: -1, y: 1, z: 0, w: 4, d: 1 },
                { x: 2,  y: 1, z: -1,w: 2, d: 1 },
                { x: 0,  y: -1,z: 1, w: 3, d: 1 }
            ], 0.29, 0.9);

            addCloudCluster(12, 36.0, 92, [
                { x: 0,  y: 0, z: 0, w: 3, d: 1 },
                { x: -2, y: 0, z: 0, w: 1, d: 1 },
                { x: 1,  y: 1, z: 0, w: 1, d: 1 }
            ], 0.48, 2.8);

            addCloudCluster(58, 31.2, 54, [
                { x: 0,  y: 0, z: 0, w: 2, d: 1 },
                { x: -1, y: 0, z: 0, w: 1, d: 1 },
                { x: 1,  y: 1, z: 0, w: 1, d: 1 }
            ], 0.71, 1.7);
        })();
    };

    // ---------------------------------------------------------------
    // Animation tick
    // ---------------------------------------------------------------

    GameWorld.update = function (dtSec) {
        if (!dtSec || dtSec <= 0) return;

        animClock += dtSec;

        for (var i = 0; i < animatedWaterfallSheets.length; i++) {
            var sheet = animatedWaterfallSheets[i];
            if (!sheet) continue;

            if (sheet.tiles && sheet.tiles.length) {
                var stepInterval = Math.max(0.1, Number(sheet.stepInterval || 0.5));
                var step = Math.floor(animClock / stepInterval);
                var rowDirection = Number(sheet.rowDirection || 1);
                var pulseInterval = Math.max(0, Number(sheet.pulseInterval || 0));
                var pulseDuration = Math.max(0.12, Number(sheet.pulseDuration || 0.9));
                var pulseWidth = Math.max(0.45, Number(sheet.pulseWidth || 1.4));
                var pulseSkew = Number(sheet.pulseColumnSkew || 0.45);
                var pulsePhase = Number(sheet.pulsePhase || 0);
                var pulseRow = -1000;
                var pulseActive = false;
                var pulseLightColor = Number(sheet.pulseLightColor || sheet.lightColor || 0x74d6f2);
                if (pulseInterval > 0) {
                    var cyclePos = (animClock + pulsePhase) % pulseInterval;
                    if (cyclePos < pulseDuration) {
                        pulseActive = true;
                        pulseRow = (cyclePos / pulseDuration) * (Math.max(1, Number(sheet.rowCount || 1)) + (pulseWidth * 2));
                    }
                }
                for (var ti = 0; ti < sheet.tiles.length; ti++) {
                    var tile = sheet.tiles[ti];
                    if (!tile || !tile.material) continue;
                    var on = ((step + (tile.row * rowDirection) + (tile.column * 2)) % 4) < 2;
                    var color = on ? Number(sheet.lightColor || 0x74d6f2) : Number(sheet.darkColor || 0x3d8fb3);
                    var opacity = on ? 0.78 : 0.5;
                    if (pulseActive) {
                        var pulseCenter = pulseRow + (tile.column * pulseSkew);
                        var pulseDist = Math.abs(tile.row - pulseCenter);
                        if (pulseDist < pulseWidth) {
                            var pulseMix = 1 - (pulseDist / pulseWidth);
                            color = pulseMix > 0.38 ? pulseLightColor : color;
                            opacity = Math.max(opacity, 0.58 + (pulseMix * 0.28));
                        }
                    }
                    tile.material.color.setHex(color);
                    tile.material.opacity = opacity;
                }
                continue;
            }

            if (!sheet.mesh || !sheet.material) continue;

            sheet.offset = (sheet.offset + (dtSec * sheet.speed)) % 1;
            if (sheet.material.map) {
                sheet.material.map.offset.y = -sheet.offset;
            }

            sheet.mesh.position.x = sheet.baseX + (Math.sin((animClock * sheet.wobbleFreq) + sheet.phase) * sheet.wobbleAmp);
            sheet.material.opacity = sheet.baseOpacity + (Math.sin((animClock * 3.14) + sheet.phase) * 0.10);
        }

        for (var m = 0; m < animatedMistCards.length; m++) {
            var mist = animatedMistCards[m];
            if (!mist || !mist.mesh || !mist.mesh.material) continue;
            mist.mesh.material.opacity = mist.baseOpacity + (Math.sin((animClock * 2.2) + mist.phase) * 0.06);
        }

        for (var li = 0; li < animatedLeaves.length; li++) {
            var leaf = animatedLeaves[li];
            if (!leaf || !leaf.mesh) continue;
            leaf.mesh.rotation.y = leaf.baseRotY + Math.sin((animClock * leaf.freq) + leaf.phase) * leaf.amp;
        }

        for (var si = 0; si < animatedIceShimmers.length; si++) {
            var ice = animatedIceShimmers[si];
            if (!ice || !ice.material) continue;
            ice.material.opacity = ice.baseOpacity + Math.sin((animClock * 1.4) + ice.phase) * 0.06;
        }

        for (var fi = 0; fi < animatedFlickers.length; fi++) {
            var flk = animatedFlickers[fi];
            if (!flk || !flk.material) continue;
            var v = 0.7 + Math.sin((animClock * flk.freq) + flk.phase) * 0.3;
            flk.material.emissiveIntensity = v;
        }

        for (var sti = 0; sti < animatedSteamColumns.length; sti++) {
            var steam = animatedSteamColumns[sti];
            if (!steam || !steam.tiles || !steam.tiles.length) continue;
            var cycle = Math.max(1.4, Number(steam.cycle || 2.4));
            for (var stj = 0; stj < steam.tiles.length; stj++) {
                var steamTile = steam.tiles[stj];
                if (!steamTile || !steamTile.mesh || !steamTile.material) continue;
                var local = ((animClock + Number(steamTile.phase || 0)) % cycle) / cycle;
                steamTile.mesh.position.y = Number(steamTile.baseY || 0) + (local * Number(steam.rise || 3.2));
                steamTile.mesh.position.x = Number(steamTile.baseX || 0) + Math.sin((animClock * Number(steam.swayFreq || 0.9)) + Number(steamTile.phase || 0)) * Number(steam.swayAmp || 0.18);
                steamTile.mesh.position.z = Number(steamTile.baseZ || 0) + Math.cos((animClock * Number(steam.swayFreq || 0.9)) + Number(steamTile.phase || 0)) * Number(steam.depthAmp || 0.12);
                steamTile.material.opacity = Math.max(0, Number(steam.baseOpacity || 0.16) * (1 - local));
            }
        }

        for (var ci = 0; ci < animatedClouds.length; ci++) {
            var cloud = animatedClouds[ci];
            if (!cloud || !cloud.root) continue;
            cloud.root.position.x = cloud.baseX + Math.sin((animClock * cloud.driftSpeed) + cloud.driftPhase) * 3.2;
            cloud.root.position.z = cloud.baseZ + Math.cos((animClock * cloud.driftSpeed * 0.7) + cloud.driftPhase) * 1.6;
        }
    };

    // ---------------------------------------------------------------
    // Public API (unchanged contract)
    // ---------------------------------------------------------------

    GameWorld.getCollidables = function () { return collidables; };

    GameWorld.getBounds = function () {
        return { min: WORLD_MIN, max: WORLD_MAX, size: WORLD_SIZE, center: WORLD_CENTER };
    };

    GameWorld.getWorldMeta = function () {
        return {
            seed: WORLD_SEED,
            worldSeed: WORLD_SEED,
            worldProfileVersion: WORLD_PROFILE_VERSION,
            worldFlags: cloneWorldFlags(WORLD_FLAGS),
            size: WORLD_SIZE,
            areaScale: WORLD_AREA_SCALE
        };
    };

    GameWorld.getSpawnExclusionZones = function () { return spawnExclusionZones.slice(); };
    GameWorld.getGenerationStats = function () { return cloneGenerationStats(generationStats); };
    GameWorld.getSize = function () { return WORLD_SIZE; };
    GameWorld.getCenter = function () { return WORLD_CENTER; };
    GameWorld.getAreaScale = function () { return WORLD_AREA_SCALE; };
    GameWorld.getSpawnPadding = function () { return DEFAULT_SPAWN_PADDING; };
    GameWorld.getRandomSpawnPoint = function (padding, options) { return randomSpawnPoint(padding, options); };
    GameWorld.getGroundHeightAt = function (x, z) { return getGroundHeightAt(x, z); };
    GameWorld.getRecommendedEnemyCount = function () { return Math.max(8, Math.round(5 * Math.sqrt(WORLD_AREA_SCALE))); };
    GameWorld.getSeed = function () { return WORLD_SEED; };
    GameWorld.setSeed = function (seedText) { return setSeed(seedText); };

    globalThis.__MAYHEM_RUNTIME.GameWorld = GameWorld;
})();
