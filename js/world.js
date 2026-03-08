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

    var BASE_WORLD_SIZE = 50;
    var WORLD_AREA_SCALE = 5;
    var WORLD_SIZE = Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE));
    var WORLD_CENTER = WORLD_SIZE * 0.5;
    var WORLD_MARGIN = 2;
    var WORLD_MIN = WORLD_MARGIN;
    var WORLD_MAX = WORLD_SIZE - WORLD_MARGIN;
    var DEFAULT_SPAWN_PADDING = 8;

    var COMBAT_TUNED_WORLD_SIZE = 112;

    var BIOME_ARCTIC = 'arctic';
    var BIOME_URBAN = 'urban';
    var BIOME_DESERT = 'desert';
    var BIOME_JUNGLE = 'jungle';

    var DEFAULT_QUADRANT_MAP = [
        { quadrant: 'NW', biome: BIOME_ARCTIC },
        { quadrant: 'NE', biome: BIOME_URBAN },
        { quadrant: 'SW', biome: BIOME_DESERT },
        { quadrant: 'SE', biome: BIOME_JUNGLE }
    ];

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
    var animClock = 0;

    // --- Ground color per biome ---
    var GROUND_COLORS = {};
    GROUND_COLORS[BIOME_ARCTIC] = 0xd0e8f4;
    GROUND_COLORS[BIOME_URBAN]  = 0x8f969e;
    GROUND_COLORS[BIOME_DESERT] = 0xd6bf7f;
    GROUND_COLORS[BIOME_JUNGLE] = 0x3b7c3f;

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

    function getCombatScale() {
        if (COMBAT_TUNED_WORLD_SIZE <= 0) return 1;
        return WORLD_SIZE / COMBAT_TUNED_WORLD_SIZE;
    }

    function scaleCombatDistance(value) {
        return value * getCombatScale();
    }

    function cloneGenerationStats(stats) {
        if (!stats || typeof stats !== 'object') return null;
        return {
            jungle: {
                trees: Number(stats.jungle && stats.jungle.trees) || 0,
                bushes: Number(stats.jungle && stats.jungle.bushes) || 0,
                logs: Number(stats.jungle && stats.jungle.logs) || 0,
                artifacts: Number(stats.jungle && stats.jungle.artifacts) || 0,
                borderTrees: Number(stats.jungle && stats.jungle.borderTrees) || 0
            },
            arctic: {
                crystals: Number(stats.arctic && stats.arctic.crystals) || 0,
                drifts: Number(stats.arctic && stats.arctic.drifts) || 0,
                foothillCrystals: Number(stats.arctic && stats.arctic.foothillCrystals) || 0,
                foothillDrifts: Number(stats.arctic && stats.arctic.foothillDrifts) || 0
            },
            desert: {
                rocks: Number(stats.desert && stats.desert.rocks) || 0,
                cacti: Number(stats.desert && stats.desert.cacti) || 0,
                ridges: Number(stats.desert && stats.desert.ridges) || 0,
                mesas: Number(stats.desert && stats.desert.mesas) || 0
            }
        };
    }

    function clamp01(value) {
        if (value < 0) return 0;
        if (value > 1) return 1;
        return value;
    }

    function lerp(a, b, t) {
        return a + ((b - a) * t);
    }

    function quadrantBounds(quadrant, padding) {
        var pad = Number(padding || 0);
        if (quadrant === 'NW') return { minX: WORLD_MIN + pad, maxX: WORLD_CENTER - pad, minZ: WORLD_MIN + pad, maxZ: WORLD_CENTER - pad };
        if (quadrant === 'NE') return { minX: WORLD_CENTER + pad, maxX: WORLD_MAX - pad, minZ: WORLD_MIN + pad, maxZ: WORLD_CENTER - pad };
        if (quadrant === 'SW') return { minX: WORLD_MIN + pad, maxX: WORLD_CENTER - pad, minZ: WORLD_CENTER + pad, maxZ: WORLD_MAX - pad };
        return { minX: WORLD_CENTER + pad, maxX: WORLD_MAX - pad, minZ: WORLD_CENTER + pad, maxZ: WORLD_MAX - pad };
    }

    function biomeAt(x, z) {
        var q = (x < WORLD_CENTER ? 'W' : 'E');
        q = (z < WORLD_CENTER ? 'N' : 'S') + q;
        for (var i = 0; i < DEFAULT_QUADRANT_MAP.length; i++) {
            if (DEFAULT_QUADRANT_MAP[i].quadrant === q) return DEFAULT_QUADRANT_MAP[i].biome;
        }
        return BIOME_JUNGLE;
    }

    function biomeBounds(biomeId, padding) {
        for (var i = 0; i < DEFAULT_QUADRANT_MAP.length; i++) {
            if (DEFAULT_QUADRANT_MAP[i].biome === biomeId) {
                return quadrantBounds(DEFAULT_QUADRANT_MAP[i].quadrant, padding);
            }
        }
        return quadrantBounds('SE', padding);
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

    function randomSpawnPoint(padding) {
        var pad = (typeof padding === 'number') ? padding : DEFAULT_SPAWN_PADDING;
        var min = WORLD_MIN + pad;
        var max = WORLD_MAX - pad;

        for (var tries = 0; tries < 42; tries++) {
            var x = lerp(min, max, Math.random());
            var z = lerp(min, max, Math.random());
            var gy = getGroundHeightAt(x, z);
            if (gy < -0.15) continue;
            if (isSpawnExcluded(x, z, 0.85)) continue;
            if (isPointBlockedByCollidables(x, z, 1.15)) continue;
            return { x: x, z: z };
        }

        return {
            x: lerp(min, max, Math.random()),
            z: lerp(min, max, Math.random())
        };
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
        animClock = 0;

        generationStats = {
            jungle: { trees: 0, bushes: 0, logs: 0, artifacts: 0, borderTrees: 0 },
            arctic: { crystals: 0, drifts: 0, foothillCrystals: 0, foothillDrifts: 0 },
            desert: { rocks: 0, cacti: 0, ridges: 0, mesas: 0 }
        };

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

        // --- Ground plane with per-biome vertex colors ---
        var groundSeg = Math.max(48, Math.round(WORLD_SIZE * 1.15));
        var groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, groundSeg, groundSeg);
        groundGeo.rotateX(-Math.PI / 2);
        groundGeo.translate(WORLD_CENTER, 0, WORLD_CENTER);

        var groundPos = groundGeo.attributes.position;
        var groundColors = new Float32Array(groundPos.count * 3);
        var color = new THREE.Color();
        var seamColor = new THREE.Color(0x666b64);

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

            if (Math.abs(gx - WORLD_CENTER) <= 0.55 || Math.abs(gz - WORLD_CENTER) <= 0.55) {
                color.r += (seamColor.r - color.r) * 0.45;
                color.g += (seamColor.g - color.g) * 0.45;
                color.b += (seamColor.b - color.b) * 0.45;
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

        var matLib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;

        // Abyss plane far below to hide the void.
        var lowerGroundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 3, WORLD_SIZE * 3);
        var lowerGroundMat = matLib.getLambert({ color: 0x1a2a20 });
        var lowerGround = new THREE.Mesh(lowerGroundGeo, lowerGroundMat);
        lowerGround.rotation.x = -Math.PI / 2;
        lowerGround.position.set(WORLD_CENTER, -6, WORLD_CENTER);
        lowerGround.receiveShadow = true;
        scene.add(lowerGround);

        // Visual seam strips.
        var seamStripMat = matLib.getLambert({ color: 0x646861 });
        addBlock(WORLD_CENTER, 0.08, WORLD_CENTER, 1.06, 0.16, WORLD_SIZE - (WORLD_MARGIN * 2.2), seamStripMat, false);
        addBlock(WORLD_CENTER, 0.08, WORLD_CENTER, WORLD_SIZE - (WORLD_MARGIN * 2.2), 0.16, 1.06, seamStripMat, false);

        // --- Natural center dividers (biome debris extending past seam) ---
        (function buildCenterDividers() {
            var C = WORLD_CENTER;

            // Arctic side (NW) -- ice shelves along both seam arms
            var iceFrost = matLib.getLambert({ color: 0xc8e8f8 });
            var iceAccent = matLib.getLambert({ color: 0x9ad4f0, transparent: true, opacity: 0.75 });
            var snowDrift = matLib.getLambert({ color: 0xdce8f2 });
            // Along Z-seam (heading north from center)
            addBlock(C - 3.5, 0.75, C - 4.0, 2.8, 1.5, 1.8, iceFrost, true);
            addBlock(C - 3.5, 1.6, C - 4.0, 2.4, 0.3, 1.4, iceAccent, false);
            addBlock(C - 2.0, 0.15, C - 3.0, 2.0, 0.3, 1.5, snowDrift, false);
            addBlock(C - 5.5, 0.6, C - 2.5, 2.0, 1.2, 1.4, iceFrost, true);
            // Along X-seam (heading west from center)
            addBlock(C - 4.5, 0.65, C - 3.0, 1.6, 1.3, 2.2, iceFrost, true);
            addBlock(C - 4.5, 1.4, C - 3.0, 1.2, 0.25, 1.8, iceAccent, false);
            addBlock(C - 3.0, 0.12, C - 1.8, 1.8, 0.24, 1.2, snowDrift, false);

            // Urban side (NE) -- jersey barriers and chain-link fence
            var concreteBarrier = matLib.getLambert({ color: 0x6a7078 });
            var concreteLt = matLib.getLambert({ color: 0x8a9098 });
            var chainLink = matLib.getLambert({ color: 0x3a3e44 });
            // Along Z-seam (heading north)
            addBlock(C + 3.0, 0.35, C - 3.5, 2.4, 0.7, 0.8, concreteBarrier, true);
            addBlock(C + 3.0, 0.35, C - 3.5, 2.0, 0.5, 0.6, concreteLt, false);
            addBlock(C + 5.0, 0.35, C - 5.0, 2.4, 0.7, 0.8, concreteBarrier, true);
            // Along X-seam (heading east)
            addBlock(C + 4.0, 0.35, C - 2.5, 0.8, 0.7, 2.4, concreteBarrier, true);
            addBlock(C + 3.5, 0.75, C - 4.5, 0.08, 1.5, 3.0, chainLink, false);
            addBlock(C + 3.5, 1.55, C - 4.5, 0.06, 0.06, 3.0, chainLink, false);

            // Desert side (SW) -- eroded mesa fragments
            var sandstone = matLib.getLambert({ color: 0xc49a5c });
            var mesaFrag = matLib.getLambert({ color: 0xb07842 });
            var darkRock = matLib.getLambert({ color: 0x8a6b4a });
            // Along Z-seam (heading south)
            addBlock(C - 4.0, 0.5, C + 3.5, 3.5, 1.0, 2.0, sandstone, true);
            addBlock(C - 4.0, 1.1, C + 3.5, 3.0, 0.2, 1.6, mesaFrag, false);
            addBlock(C - 2.5, 0.3, C + 5.5, 2.0, 0.6, 1.5, sandstone, true);
            // Along X-seam (heading west)
            addBlock(C - 3.5, 0.45, C + 3.0, 1.8, 0.9, 2.5, sandstone, true);
            addBlock(C - 5.0, 0.2, C + 2.0, 0.6, 0.4, 0.5, darkRock, false);
            addBlock(C - 3.0, 0.15, C + 5.0, 0.5, 0.3, 0.4, darkRock, false);

            // Jungle side (SE) -- mossy stones with vines, fallen log
            var mossyStone = matLib.getLambert({ color: 0x3d4a32 });
            var jungleStone = matLib.getLambert({ color: 0x4a5040 });
            var jungleVineC = matLib.getLambert({ color: 0x1e5a1e });
            var logMat = matLib.getLambert({ color: 0x5c3d1e });
            // Along Z-seam (heading south)
            addBlock(C + 3.5, 0.6, C + 4.0, 2.2, 1.2, 1.8, mossyStone, true);
            addBlock(C + 3.8, 1.0, C + 4.0, 0.2, 0.8, 0.2, jungleVineC, false);
            addBlock(C + 3.2, 0.8, C + 4.3, 0.2, 0.6, 0.2, jungleVineC, false);
            addBlock(C + 5.0, 0.5, C + 2.5, 1.8, 1.0, 1.5, jungleStone, true);
            // Along X-seam (heading east)
            addBlock(C + 4.5, 0.55, C + 3.5, 1.5, 1.1, 2.0, mossyStone, true);
            addBlock(C + 4.8, 0.9, C + 3.5, 0.2, 0.7, 0.2, jungleVineC, false);
            // Fallen log across the seam
            addBlock(C + 2.5, 0.3, C + 1.5, 0.7, 0.6, 3.5, logMat, true);
            addBlock(C + 2.6, 0.62, C + 1.4, 0.5, 0.04, 1.5, mossyStone, false);
        })();

        // --- Biome-themed perimeter walls ---
        (function buildBiomeWalls() {
            var edgeH = 3.0;
            var edgeThick = 1.2;
            var halfLen = (WORLD_CENTER - WORLD_MIN) + edgeThick * 0.5;
            var qMid = (WORLD_MIN + WORLD_CENTER) * 0.5;
            var qMid2 = (WORLD_CENTER + WORLD_MAX) * 0.5;

            var arcticBase = matLib.getLambert({ color: 0x8aafcc });
            var arcticCap  = matLib.getLambert({ color: 0xc8e8f8 });
            var arcticIce  = matLib.getLambert({ color: 0x9ad4f0, transparent: true, opacity: 0.7 });

            var urbanBase  = matLib.getLambert({ color: 0x6a7078 });
            var urbanRail  = matLib.getLambert({ color: 0x3a3e44 });
            var urbanPaint = matLib.getLambert({ color: 0xc85a3a });

            var desertBase = matLib.getLambert({ color: 0xc49a5c });
            var desertCap  = matLib.getLambert({ color: 0xb07842 });

            var jungleBase = matLib.getLambert({ color: 0x4a5040 });
            var jungleVine = matLib.getLambert({ color: 0x2d5a28 });
            var jungleMoss = matLib.getLambert({ color: 0x3d6a32 });

            // North wall (Z-min): left=Arctic(NW), right=Urban(NE)
            addBlock(qMid, edgeH * 0.5, WORLD_MIN - edgeThick * 0.5, halfLen, edgeH, edgeThick, arcticBase, true);
            addBlock(qMid, edgeH + 0.2, WORLD_MIN - edgeThick * 0.5, halfLen, 0.4, edgeThick + 0.2, arcticCap, false);
            for (var ni = 0; ni < 5; ni++) {
                var nx = WORLD_MIN + halfLen * 0.15 + (halfLen * 0.7 * ni / 4);
                addBlock(nx, edgeH * 0.7, WORLD_MIN - edgeThick * 0.8, 1.4, edgeH * 0.5, 0.3, arcticIce, false);
            }

            addBlock(qMid2, edgeH * 0.5, WORLD_MIN - edgeThick * 0.5, halfLen, edgeH, edgeThick, urbanBase, true);
            addBlock(qMid2, edgeH + 0.15, WORLD_MIN - edgeThick * 0.5, halfLen, 0.1, 0.1, urbanRail, false);
            addBlock(qMid2, edgeH * 0.65, WORLD_MIN - edgeThick * 0.85, halfLen * 0.6, 0.3, 0.15, urbanPaint, false);

            // South wall (Z-max): left=Desert(SW), right=Jungle(SE)
            addBlock(qMid, edgeH * 0.5, WORLD_MAX + edgeThick * 0.5, halfLen, edgeH, edgeThick, desertBase, true);
            addBlock(qMid, edgeH + 0.15, WORLD_MAX + edgeThick * 0.5, halfLen, 0.35, edgeThick + 0.3, desertCap, false);

            addBlock(qMid2, edgeH * 0.5, WORLD_MAX + edgeThick * 0.5, halfLen, edgeH, edgeThick, jungleBase, true);
            addBlock(qMid2, edgeH + 0.1, WORLD_MAX + edgeThick * 0.5, halfLen, 0.3, edgeThick + 0.1, jungleMoss, false);
            for (var si = 0; si < 6; si++) {
                var sx = WORLD_CENTER + halfLen * 0.1 + (halfLen * 0.8 * si / 5);
                var vineH = 1.2 + (si % 3) * 0.5;
                addBlock(sx, vineH * 0.5, WORLD_MAX + edgeThick * 0.85, 0.25, vineH, 0.2, jungleVine, false);
            }

            // West wall (X-min): top=Arctic(NW), bottom=Desert(SW)
            addBlock(WORLD_MIN - edgeThick * 0.5, edgeH * 0.5, qMid, edgeThick, edgeH, halfLen, arcticBase, true);
            addBlock(WORLD_MIN - edgeThick * 0.5, edgeH + 0.2, qMid, edgeThick + 0.2, 0.4, halfLen, arcticCap, false);

            addBlock(WORLD_MIN - edgeThick * 0.5, edgeH * 0.5, qMid2, edgeThick, edgeH, halfLen, desertBase, true);
            addBlock(WORLD_MIN - edgeThick * 0.5, edgeH + 0.15, qMid2, edgeThick + 0.3, 0.35, halfLen, desertCap, false);

            // East wall (X-max): top=Urban(NE), bottom=Jungle(SE)
            addBlock(WORLD_MAX + edgeThick * 0.5, edgeH * 0.5, qMid, edgeThick, edgeH, halfLen, urbanBase, true);
            addBlock(WORLD_MAX + edgeThick * 0.5, edgeH + 0.15, qMid, 0.1, 0.1, halfLen, urbanRail, false);
            addBlock(WORLD_MAX + edgeThick * 0.85, edgeH * 0.5, qMid, 0.15, 0.3, halfLen * 0.5, urbanPaint, false);

            addBlock(WORLD_MAX + edgeThick * 0.5, edgeH * 0.5, qMid2, edgeThick, edgeH, halfLen, jungleBase, true);
            addBlock(WORLD_MAX + edgeThick * 0.5, edgeH + 0.1, qMid2, edgeThick + 0.1, 0.3, halfLen, jungleMoss, false);
            for (var ei = 0; ei < 6; ei++) {
                var ez = WORLD_CENTER + halfLen * 0.1 + (halfLen * 0.8 * ei / 5);
                var evH = 1.0 + (ei % 3) * 0.6;
                addBlock(WORLD_MAX + edgeThick * 0.85, evH * 0.5, ez, 0.2, evH, 0.25, jungleVine, false);
            }
        })();

        // --- Quadrant dispatch ---
        var quadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {};

        var quadrantCtx = {
            scene: scene,
            addExclusion: function (x, z, r) { addSpawnExclusionCircle(x, z, r); },
            addWaterfallSheet: function (data) { animatedWaterfallSheets.push(data); },
            addMistCard: function (data) { animatedMistCards.push(data); },
            addLeafSway: function (data) { animatedLeaves.push(data); },
            addIceShimmer: function (data) { animatedIceShimmers.push(data); },
            addFlicker: function (data) { animatedFlickers.push(data); }
        };

        for (var qi = 0; qi < DEFAULT_QUADRANT_MAP.length; qi++) {
            var entry = DEFAULT_QUADRANT_MAP[qi];
            var builder = quadrants[entry.biome];
            if (typeof builder !== 'function') continue;
            var qBounds = quadrantBounds(entry.quadrant, 6);
            var stats = builder(qBounds, place, quadrantCtx);
            if (stats && generationStats[entry.biome]) {
                var target = generationStats[entry.biome];
                for (var sk in stats) {
                    if (typeof stats[sk] === 'number') target[sk] = stats[sk];
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
                for (var ti = 0; ti < sheet.tiles.length; ti++) {
                    var tile = sheet.tiles[ti];
                    if (!tile || !tile.material) continue;
                    var on = ((step + tile.row + (tile.column * 2)) % 4) < 2;
                    tile.material.color.setHex(on ? Number(sheet.lightColor || 0x74d6f2) : Number(sheet.darkColor || 0x3d8fb3));
                    tile.material.opacity = on ? 0.78 : 0.5;
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
    GameWorld.getCombatScale = function () { return getCombatScale(); };
    GameWorld.scaleCombatDistance = function (value) { return scaleCombatDistance(value); };
    GameWorld.getSpawnPadding = function () { return DEFAULT_SPAWN_PADDING; };
    GameWorld.getRandomSpawnPoint = function (padding) { return randomSpawnPoint(padding); };
    GameWorld.getGroundHeightAt = function (x, z) { return getGroundHeightAt(x, z); };
    GameWorld.getRecommendedEnemyCount = function () { return Math.max(8, Math.round(5 * Math.sqrt(WORLD_AREA_SCALE))); };
    GameWorld.getSeed = function () { return WORLD_SEED; };
    GameWorld.setSeed = function (seedText) { return setSeed(seedText); };

    globalThis.__MAYHEM_RUNTIME.GameWorld = GameWorld;
})();
