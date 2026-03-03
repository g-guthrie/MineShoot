/**
 * world.js - Static authored world layout for open-arena combat.
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

    // Baseline world size used for combat-distance scaling.
    var COMBAT_TUNED_WORLD_SIZE = 112;

    var BIOME_ARCTIC = 'arctic';
    var BIOME_URBAN = 'urban';
    var BIOME_DESERT = 'desert';
    var BIOME_JUNGLE = 'jungle';

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
    var animClock = 0;

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

    function biomeAt(x, z) {
        if (x < WORLD_CENTER && z < WORLD_CENTER) return BIOME_ARCTIC;
        if (x >= WORLD_CENTER && z < WORLD_CENTER) return BIOME_URBAN;
        if (x < WORLD_CENTER && z >= WORLD_CENTER) return BIOME_DESERT;
        return BIOME_JUNGLE;
    }

    function biomeBounds(biomeId, padding) {
        var pad = Number(padding || 0);
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

    function placeBiomeSpec(bounds, spec, place) {
        if (!bounds || !spec || !place) return;
        var blocks = Array.isArray(spec.blocks) ? spec.blocks : [];
        var ramps = Array.isArray(spec.ramps) ? spec.ramps : [];
        var exclusions = Array.isArray(spec.exclusions) ? spec.exclusions : [];

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            var bp = pointInBounds(bounds, b.u, b.v);
            place.addBlock(bp.x, Number(b.y || 0), bp.z, Number(b.w || 1), Number(b.h || 1), Number(b.d || 1), b.material, b.solid !== false);
        }

        for (var r = 0; r < ramps.length; r++) {
            var rp = ramps[r];
            var rPos = pointInBounds(bounds, rp.u, rp.v);
            place.addRamp(
                rPos.x,
                Number(rp.y || 0),
                rPos.z,
                Number(rp.w || 1),
                Number(rp.h || 1),
                Number(rp.d || 1),
                rp.material,
                Number(rp.rotY || 0),
                Number(rp.tiltX || 0),
                rp.solid !== false
            );
        }

        for (var e = 0; e < exclusions.length; e++) {
            var ex = exclusions[e];
            var exPos = pointInBounds(bounds, ex.u, ex.v);
            addSpawnExclusionCircle(exPos.x, exPos.z, Number(ex.radius || 1));
        }
    }

    function createArcticMountain(centerX, centerZ, mats, place) {
        var yCursor = 0;
        var tierWidths = [20.0, 17.4, 15.0, 12.6, 10.4, 8.4, 6.7, 5.2];
        var tierHeights = [1.8, 1.7, 1.6, 1.5, 1.35, 1.2, 1.1, 1.0];

        for (var t = 0; t < tierWidths.length; t++) {
            var h = tierHeights[t];
            var y = yCursor + (h * 0.5);
            place.addBlock(centerX, y, centerZ, tierWidths[t], h, tierWidths[t], t >= 4 ? mats.snow : mats.rock, true);
            yCursor += h * 0.62;
        }

        // Traversable mountain features (all solid to prevent foot sinking).
        place.addBlock(centerX + 5.2, 4.3, centerZ - 2.2, 5.3, 1.1, 2.8, mats.snow, true);
        place.addBlock(centerX - 4.9, 5.5, centerZ + 1.8, 4.7, 1.0, 2.5, mats.snow, true);
        place.addRamp(centerX + 2.4, 2.4, centerZ + 5.1, 5.2, 1.1, 3.2, mats.rock, Math.PI * 0.5, -0.24, true);
        place.addRamp(centerX - 2.5, 3.1, centerZ - 4.7, 4.7, 1.0, 2.9, mats.snow, Math.PI * 1.12, -0.2, true);

        addSpawnExclusionCircle(centerX, centerZ, 9.2);
    }

    function addArcticIcicle(x, z, height, mat, place) {
        var h = Math.max(1.6, Number(height || 2.8));
        place.addBlock(x, h * 0.5, z, 0.78, h, 0.78, mat, true);
    }

    function createDesertRidge(centerX, centerZ, mat, place) {
        var offsets = [
            { dx: -4.8, dz: -1.2, h: 2.3, w: 2.4, d: 2.0 },
            { dx: -2.4, dz: -0.3, h: 2.8, w: 2.6, d: 2.2 },
            { dx: 0.0, dz: 0.4, h: 3.2, w: 2.8, d: 2.3 },
            { dx: 2.4, dz: 1.0, h: 2.7, w: 2.5, d: 2.1 },
            { dx: 4.9, dz: 1.6, h: 2.2, w: 2.3, d: 2.0 }
        ];
        for (var i = 0; i < offsets.length; i++) {
            var seg = offsets[i];
            place.addBlock(centerX + seg.dx, seg.h * 0.5, centerZ + seg.dz, seg.w, seg.h, seg.d, mat, true);
        }
        addSpawnExclusionCircle(centerX, centerZ, 6.4);
    }

    function addSimpleCactus(x, z, mat, place) {
        place.addBlock(x, 1.1, z, 0.42, 2.2, 0.42, mat, true);
    }

    function addStaticJungleTree(x, z, trunkMat, leafMat, place) {
        place.addBlock(x, 1.65, z, 0.82, 3.3, 0.82, trunkMat, true);
        place.addBlock(x, 3.55, z, 2.4, 1.1, 2.4, leafMat, false);
    }

    function addStaticLog(x, z, alongX, logMat, place) {
        if (alongX) {
            place.addBlock(x, 0.32, z, 2.8, 0.64, 0.9, logMat, true);
        } else {
            place.addBlock(x, 0.32, z, 0.9, 0.64, 2.8, logMat, true);
        }
    }

    function createJungleLab(centerX, centerZ, mats, place) {
        // 8 blocking parts: base, upper pad, 4 pillars, 2 walls.
        place.addBlock(centerX, 0.45, centerZ, 8.6, 0.9, 6.6, mats.stone, true);
        place.addBlock(centerX, 1.1, centerZ, 4.2, 0.8, 2.8, mats.core, true);

        place.addBlock(centerX - 3.2, 1.8, centerZ - 2.4, 0.8, 3.6, 0.8, mats.stone, true);
        place.addBlock(centerX + 3.2, 1.8, centerZ - 2.4, 0.8, 3.6, 0.8, mats.stone, true);
        place.addBlock(centerX - 3.2, 1.8, centerZ + 2.4, 0.8, 3.6, 0.8, mats.stone, true);
        place.addBlock(centerX + 3.2, 1.8, centerZ + 2.4, 0.8, 3.6, 0.8, mats.stone, true);

        place.addBlock(centerX - 1.4, 1.5, centerZ, 0.8, 2.2, 2.7, mats.stone, true);
        place.addBlock(centerX + 1.4, 1.5, centerZ, 0.8, 2.2, 2.7, mats.stone, true);

        addSpawnExclusionCircle(centerX, centerZ, 4.8);
    }

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

        var place = {
            addBlock: addBlock,
            addRamp: addRamp
        };

        // --- Ground ---
        var groundSeg = Math.max(48, Math.round(WORLD_SIZE * 1.15));
        var groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, groundSeg, groundSeg);
        groundGeo.rotateX(-Math.PI / 2);
        groundGeo.translate(WORLD_CENTER, 0, WORLD_CENTER);

        var groundPos = groundGeo.attributes.position;
        var groundColors = new Float32Array(groundPos.count * 3);
        var color = new THREE.Color();
        var arcticColor = new THREE.Color(0xb9def8);
        var urbanColor = new THREE.Color(0x8f969e);
        var desertColor = new THREE.Color(0xd6bf7f);
        var jungleColor = new THREE.Color(0x3b7c3f);
        var seamColor = new THREE.Color(0x666b64);

        for (var vi = 0; vi < groundPos.count; vi++) {
            var gx = groundPos.getX(vi);
            var gz = groundPos.getZ(vi);
            var gy = getGroundHeightAt(gx, gz);
            groundPos.setY(vi, gy);

            var biomeId = biomeAt(gx, gz);
            if (biomeId === BIOME_ARCTIC) color.copy(arcticColor);
            else if (biomeId === BIOME_URBAN) color.copy(urbanColor);
            else if (biomeId === BIOME_DESERT) color.copy(desertColor);
            else color.copy(jungleColor);

            if (Math.abs(gx - WORLD_CENTER) <= 0.55 || Math.abs(gz - WORLD_CENTER) <= 0.55) {
                color.r = color.r + ((seamColor.r - color.r) * 0.45);
                color.g = color.g + ((seamColor.g - color.g) * 0.45);
                color.b = color.b + ((seamColor.b - color.b) * 0.45);
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

        var lowerGroundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 3, WORLD_SIZE * 3);
        var lowerGroundMat = new THREE.MeshLambertMaterial({ color: 0x22372a });
        var lowerGround = new THREE.Mesh(lowerGroundGeo, lowerGroundMat);
        lowerGround.rotation.x = -Math.PI / 2;
        lowerGround.position.set(WORLD_CENTER, -6, WORLD_CENTER);
        lowerGround.receiveShadow = true;
        scene.add(lowerGround);

        // Visual seam strips only.
        var seamStripMat = new THREE.MeshLambertMaterial({ color: 0x646861 });
        addBlock(WORLD_CENTER, 0.08, WORLD_CENTER, 1.06, 0.16, WORLD_SIZE - (WORLD_MARGIN * 2.2), seamStripMat, false);
        addBlock(WORLD_CENTER, 0.08, WORLD_CENTER, WORLD_SIZE - (WORLD_MARGIN * 2.2), 0.16, 1.06, seamStripMat, false);

        // --- Materials ---
        var concreteMat = new THREE.MeshLambertMaterial({ color: 0x7f868d });
        var railMat = new THREE.MeshLambertMaterial({ color: 0x595f66 });

        var snowRockMat = new THREE.MeshLambertMaterial({ color: 0x8ea2b4 });
        var snowCapMat = new THREE.MeshLambertMaterial({ color: 0xeff7ff });
        var icePeakMat = new THREE.MeshLambertMaterial({ color: 0xbbe5ff });

        var mesaBodyMat = new THREE.MeshLambertMaterial({ color: 0xae8456 });
        var cactusMat = new THREE.MeshLambertMaterial({ color: 0x4f8a3d });

        var jungleWoodMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
        var jungleLeafMat = new THREE.MeshLambertMaterial({ color: 0x2f6f2f });
        var jungleArtifactStoneMat = new THREE.MeshLambertMaterial({ color: 0x6d7e5f });
        var jungleArtifactCoreMat = new THREE.MeshLambertMaterial({ color: 0x89caa7 });

        // --- Authored biome layout ---
        var arcticBounds = biomeBounds(BIOME_ARCTIC, 6);
        var urbanBounds = biomeBounds(BIOME_URBAN, 6);
        var desertBounds = biomeBounds(BIOME_DESERT, 6);
        var jungleBounds = biomeBounds(BIOME_JUNGLE, 6);

        // Urban skatepark: keep exactly 6 blockers.
        placeBiomeSpec(urbanBounds, {
            ramps: [
                { u: 0.32, v: 0.34, y: 0.9, w: 6.5, h: 1.4, d: 3.6, material: concreteMat, rotY: 0, tiltX: -0.28, solid: true },
                { u: 0.68, v: 0.66, y: 0.9, w: 6.5, h: 1.4, d: 3.6, material: concreteMat, rotY: Math.PI, tiltX: -0.28, solid: true }
            ],
            blocks: [
                { u: 0.50, v: 0.50, y: 0.65, w: 7.2, h: 1.3, d: 3.0, material: concreteMat, solid: true },
                { u: 0.50, v: 0.50, y: 1.45, w: 6.2, h: 0.12, d: 0.12, material: railMat, solid: true },
                { u: 0.16, v: 0.62, y: 0.55, w: 4.8, h: 1.1, d: 2.4, material: concreteMat, solid: true },
                { u: 0.84, v: 0.38, y: 0.55, w: 4.8, h: 1.1, d: 2.4, material: concreteMat, solid: true }
            ]
        }, place);

        // Arctic: 12 mountain blockers + 4 icicles = 16.
        var arcticCenterPt = pointInBounds(arcticBounds, 0.50, 0.50);
        createArcticMountain(arcticCenterPt.x, arcticCenterPt.z, {
            rock: snowRockMat,
            snow: snowCapMat
        }, place);

        var arcticIcicleOffsets = [
            { dx: -8.6, dz: -5.6, h: 2.8 },
            { dx: -7.3, dz: 5.9, h: 3.1 },
            { dx: 8.2, dz: -6.2, h: 2.9 },
            { dx: 7.1, dz: 5.7, h: 2.7 }
        ];
        for (var ai = 0; ai < arcticIcicleOffsets.length; ai++) {
            var ic = arcticIcicleOffsets[ai];
            addArcticIcicle(arcticCenterPt.x + ic.dx, arcticCenterPt.z + ic.dz, ic.h, icePeakMat, place);
        }

        generationStats.arctic.crystals = 4;
        generationStats.arctic.drifts = 0;
        generationStats.arctic.foothillCrystals = 0;
        generationStats.arctic.foothillDrifts = 0;

        // Desert: 5 ridge blockers + 5 cacti blockers = 10.
        var desertCenterPt = pointInBounds(desertBounds, 0.48, 0.50);
        createDesertRidge(desertCenterPt.x, desertCenterPt.z, mesaBodyMat, place);
        var cactusPoints = [
            pointInBounds(desertBounds, 0.22, 0.28),
            pointInBounds(desertBounds, 0.72, 0.26),
            pointInBounds(desertBounds, 0.18, 0.78),
            pointInBounds(desertBounds, 0.74, 0.76),
            pointInBounds(desertBounds, 0.88, 0.54)
        ];
        for (var dc = 0; dc < cactusPoints.length; dc++) {
            addSimpleCactus(cactusPoints[dc].x, cactusPoints[dc].z, cactusMat, place);
        }

        generationStats.desert.rocks = 0;
        generationStats.desert.cacti = 5;
        generationStats.desert.ridges = 1;
        generationStats.desert.mesas = 0;

        // Jungle: 8 lab blockers + 8 trees + 4 logs = 20.
        var jungleCenterPt = pointInBounds(jungleBounds, 0.50, 0.52);
        createJungleLab(jungleCenterPt.x, jungleCenterPt.z, {
            stone: jungleArtifactStoneMat,
            core: jungleArtifactCoreMat
        }, place);

        var jungleTreePoints = [
            pointInBounds(jungleBounds, 0.20, 0.18),
            pointInBounds(jungleBounds, 0.36, 0.16),
            pointInBounds(jungleBounds, 0.64, 0.18),
            pointInBounds(jungleBounds, 0.80, 0.20),
            pointInBounds(jungleBounds, 0.18, 0.78),
            pointInBounds(jungleBounds, 0.34, 0.84),
            pointInBounds(jungleBounds, 0.66, 0.82),
            pointInBounds(jungleBounds, 0.82, 0.76)
        ];
        for (var jt = 0; jt < jungleTreePoints.length; jt++) {
            addStaticJungleTree(jungleTreePoints[jt].x, jungleTreePoints[jt].z, jungleWoodMat, jungleLeafMat, place);
        }

        var jungleLogPoints = [
            { p: pointInBounds(jungleBounds, 0.24, 0.50), alongX: true },
            { p: pointInBounds(jungleBounds, 0.76, 0.48), alongX: false },
            { p: pointInBounds(jungleBounds, 0.50, 0.24), alongX: true },
            { p: pointInBounds(jungleBounds, 0.52, 0.78), alongX: false }
        ];
        for (var jl = 0; jl < jungleLogPoints.length; jl++) {
            addStaticLog(jungleLogPoints[jl].p.x, jungleLogPoints[jl].p.z, jungleLogPoints[jl].alongX, jungleWoodMat, place);
        }

        generationStats.jungle.trees = 8;
        generationStats.jungle.bushes = 0;
        generationStats.jungle.logs = 4;
        generationStats.jungle.artifacts = 1;
        generationStats.jungle.borderTrees = 0;

        // --- Lighting ---
        scene.add(new THREE.AmbientLight(0x6a7584, 0.94));

        var dirLight = new THREE.DirectionalLight(0xfff4d8, 1.12);
        dirLight.position.set(WORLD_CENTER + (WORLD_SIZE * 0.22), WORLD_SIZE * 0.95, WORLD_CENTER - (WORLD_SIZE * 0.12));
        dirLight.castShadow = false;
        scene.add(dirLight);

        scene.add(new THREE.HemisphereLight(0xc5e8ff, 0x4d6149, 0.7));

        var arcticFillLight = new THREE.PointLight(0x8ed5ff, 0.32, WORLD_SIZE * 0.95);
        arcticFillLight.position.set(WORLD_CENTER * 0.48, WORLD_SIZE * 0.28, WORLD_CENTER * 0.5);
        scene.add(arcticFillLight);

        scene.background = new THREE.Color(0x95c5ea);
        scene.fog = new THREE.Fog(0x93bad7, WORLD_SIZE * 0.45, WORLD_SIZE * 1.28);
    };

    GameWorld.update = function (dtSec) {
        if (!dtSec || dtSec <= 0) return;
        if (animatedWaterfallSheets.length === 0 && animatedMistCards.length === 0) return;

        animClock += dtSec;

        for (var i = 0; i < animatedWaterfallSheets.length; i++) {
            var sheet = animatedWaterfallSheets[i];
            if (!sheet || !sheet.mesh || !sheet.material) continue;

            sheet.offset = (sheet.offset + (dtSec * sheet.speed)) % 1;
            if (sheet.material.map) {
                sheet.material.map.offset.y = -sheet.offset;
            }

            sheet.mesh.position.x = sheet.baseX + (Math.sin((animClock * sheet.wobbleFreq) + sheet.phase) * sheet.wobbleAmp);
            sheet.material.opacity = sheet.baseOpacity + (Math.sin((animClock * 1.8) + sheet.phase) * 0.03);
        }

        for (var m = 0; m < animatedMistCards.length; m++) {
            var mist = animatedMistCards[m];
            if (!mist || !mist.mesh || !mist.mesh.material) continue;
            mist.mesh.material.opacity = mist.baseOpacity + (Math.sin((animClock * 2.2) + mist.phase) * 0.06);
        }
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

    GameWorld.getSpawnExclusionZones = function () {
        return spawnExclusionZones.slice();
    };

    GameWorld.getGenerationStats = function () {
        return cloneGenerationStats(generationStats);
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
        return setSeed(seedText);
    };

    globalThis.__MAYHEM_RUNTIME.GameWorld = GameWorld;
})();
