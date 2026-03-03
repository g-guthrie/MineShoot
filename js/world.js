/**
 * world.js - Scalable world generation, structures, cover, lighting
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
    var WORLD_AREA_SCALE = 5; // requested: 5x larger playable area
    var WORLD_SIZE = Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE));
    var WORLD_CENTER = WORLD_SIZE * 0.5;
    var WORLD_MARGIN = 2;
    var WORLD_MIN = WORLD_MARGIN;
    var WORLD_MAX = WORLD_SIZE - WORLD_MARGIN;
    var DEFAULT_SPAWN_PADDING = 8;
    // Baseline world size used for current combat tuning (1 unit = 1 meter convention).
    var COMBAT_TUNED_WORLD_SIZE = 112;

    var DEFAULT_WORLD_PROFILE_VERSION = Math.max(1, Math.round(Number(SHARED_WORLD_CFG && SHARED_WORLD_CFG.profileVersion) || 2));
    var DEFAULT_WORLD_FLAGS = {
        envV2: (SHARED_WORLD_CFG && SHARED_WORLD_CFG.flags) ? !!SHARED_WORLD_CFG.flags.envV2 : true,
        terrainPhysicsV2: (SHARED_WORLD_CFG && SHARED_WORLD_CFG.flags) ? !!SHARED_WORLD_CFG.flags.terrainPhysicsV2 : false
    };

    var WORLD_PROFILE_VERSION = DEFAULT_WORLD_PROFILE_VERSION;
    var WORLD_FLAGS = cloneWorldFlags(DEFAULT_WORLD_FLAGS);

    var WORLD_SEED = 'mineshoot-v1';
    var seedHash = 1;
    var rngState = 1;
    var waterPools = [];
    var spawnExclusionZones = [];

    var animatedWaterfallSheets = [];
    var animatedMistCards = [];
    var animClock = 0;

    // Solid meshes used for movement/raycast collisions.
    var collidables = [];

    var BIOME_ARCTIC = 'arctic';
    var BIOME_URBAN = 'urban';
    var BIOME_DESERT = 'desert';
    var BIOME_JUNGLE = 'jungle';

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
        seedHash = hashSeed(WORLD_SEED);
        rngState = seedHash;
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

    function resolveDebugGridFromLocation() {
        try {
            var params = new URLSearchParams(window.location.search || '');
            var raw = String(params.get('debugGrid') || '').toLowerCase();
            return raw === '1' || raw === 'true' || raw === 'on';
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

    function clamp01(value) {
        if (value < 0) return 0;
        if (value > 1) return 1;
        return value;
    }

    function smoothStep(edge0, edge1, x) {
        if (edge0 === edge1) return (x < edge0) ? 0 : 1;
        var t = clamp01((x - edge0) / (edge1 - edge0));
        return t * t * (3 - 2 * t);
    }

    function fract(value) {
        return value - Math.floor(value);
    }

    function hash2(ix, iz) {
        var n = Math.sin((ix * 127.1) + (iz * 311.7) + (seedHash * 0.013));
        return fract(n * 43758.5453123);
    }

    function valueNoise2(x, z, scale) {
        var sx = x * scale;
        var sz = z * scale;

        var ix = Math.floor(sx);
        var iz = Math.floor(sz);

        var fx = sx - ix;
        var fz = sz - iz;

        var u = fx * fx * (3 - (2 * fx));
        var v = fz * fz * (3 - (2 * fz));

        var a = hash2(ix, iz);
        var b = hash2(ix + 1, iz);
        var c = hash2(ix, iz + 1);
        var d = hash2(ix + 1, iz + 1);

        var nx0 = a + ((b - a) * u);
        var nx1 = c + ((d - c) * u);
        return ((nx0 + ((nx1 - nx0) * v)) * 2) - 1;
    }

    function terrainColorNoise(x, z) {
        return (valueNoise2(x, z, 0.055) * 0.65) + (valueNoise2(x, z, 0.18) * 0.35);
    }

    function biomeBlendWeights(x, z) {
        var blendBand = WORLD_SIZE * 0.09;
        var wx = smoothStep(WORLD_CENTER - blendBand, WORLD_CENTER + blendBand, x);
        var wz = smoothStep(WORLD_CENTER - blendBand, WORLD_CENTER + blendBand, z);
        return {
            arctic: (1 - wx) * (1 - wz),
            urban: wx * (1 - wz),
            desert: (1 - wx) * wz,
            jungle: wx * wz
        };
    }

    function isSpawnExcluded(x, z, padding) {
        var pad = padding || 0;
        for (var i = 0; i < spawnExclusionZones.length; i++) {
            var zone = spawnExclusionZones[i];
            if (!zone) continue;
            var dx = x - zone.x;
            var dz = z - zone.z;
            var distSq = (dx * dx) + (dz * dz);
            var r = Math.max(0, Number(zone.radius || 0)) + pad;
            if (distSq <= (r * r)) return true;
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
        var pad = padding || 0;
        for (var i = 0; i < collidables.length; i++) {
            var box = collidables[i] && collidables[i].userData ? collidables[i].userData.collisionBox : null;
            if (!box) continue;
            if (x > (box.min.x - pad) && x < (box.max.x + pad) &&
                z > (box.min.z - pad) && z < (box.max.z + pad)) {
                return true;
            }
        }
        return false;
    }

    function randomSpawnPoint(padding) {
        var pad = (typeof padding === 'number') ? padding : DEFAULT_SPAWN_PADDING;
        var min = WORLD_MIN + pad;
        var max = WORLD_MAX - pad;
        for (var tries = 0; tries < 42; tries++) {
            var x = randRange(min, max);
            var z = randRange(min, max);
            var gy = getGroundHeightAt(x, z);
            if (gy < -0.15) continue;
            if (isSpawnExcluded(x, z, 0.85)) continue;
            if (isPointBlockedByCollidables(x, z, 1.15)) continue;
            return { x: x, z: z };
        }

        for (var fallback = 0; fallback < 18; fallback++) {
            var fx = randRange(min, max);
            var fz = randRange(min, max);
            if (!isSpawnExcluded(fx, fz, 0.85)) {
                return { x: fx, z: fz };
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

    function createWaterfallTexture() {
        if (typeof document === 'undefined' || !document.createElement) return null;
        var canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 256;

        var ctx = canvas.getContext('2d');
        if (!ctx) return null;

        var grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, 'rgba(180,235,255,0.08)');
        grad.addColorStop(0.18, 'rgba(155,224,255,0.34)');
        grad.addColorStop(0.52, 'rgba(130,208,246,0.76)');
        grad.addColorStop(1, 'rgba(105,188,236,0.10)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.globalAlpha = 0.34;
        for (var y = 0; y < canvas.height; y += 14) {
            ctx.fillStyle = ((y / 14) % 2 === 0) ? 'rgba(220,248,255,0.9)' : 'rgba(140,206,240,0.8)';
            ctx.fillRect(0, y, canvas.width, 6);
        }

        ctx.globalAlpha = 0.2;
        for (var x = 4; x < canvas.width; x += 12) {
            ctx.fillStyle = 'rgba(235,250,255,0.85)';
            ctx.fillRect(x, 0, 3, canvas.height);
        }

        var texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1.0, 1.8);
        texture.offset.set(0, 0);
        texture.needsUpdate = true;
        return texture;
    }

    GameWorld.create = function (scene, options) {
        var meta = normalizeWorldMeta(options && options.worldMeta ? options.worldMeta : null);
        var selectedSeed = meta.worldSeed || resolveSeedFromLocation();

        setSeed(selectedSeed);
        WORLD_PROFILE_VERSION = meta.worldProfileVersion;
        WORLD_FLAGS = cloneWorldFlags(meta.worldFlags);

        collidables = [];
        waterPools = [];
        spawnExclusionZones = [];
        animatedWaterfallSheets = [];
        animatedMistCards = [];
        animClock = 0;

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
            return isPointBlockedByCollidables(x, z, padding || 0);
        }

        function createDesertMesa(centerX, centerZ, baseRadius, tiers, bodyMat, topMat) {
            var yCursor = 0;
            var tierCount = Math.max(3, Math.round(tiers || 4));
            for (var t = 0; t < tierCount; t++) {
                var width = Math.max(2.4, (baseRadius * 2.0) - (t * 1.6));
                var height = 1.15 + ((t % 2) * 0.25);
                var solid = t <= 1;
                var jitterX = (t === 0) ? 0 : randRange(-0.35, 0.35);
                var jitterZ = (t === 0) ? 0 : randRange(-0.35, 0.35);
                var y = yCursor + (height * 0.5);
                addBlock(centerX + jitterX, y, centerZ + jitterZ, width, height, width, (t >= tierCount - 2) ? topMat : bodyMat, solid);
                yCursor += height * 0.58;
            }

            addBlock(centerX + randRange(-baseRadius * 0.18, baseRadius * 0.18), yCursor + 0.8, centerZ, baseRadius * 0.8, 0.8, baseRadius * 0.8, topMat, false);
            addSpawnExclusionCircle(centerX, centerZ, Math.max(2.8, baseRadius * 0.95));
        }

        function createArcticMountain(centerX, centerZ, rockMat, snowMat, iceMat) {
            var yCursor = 0;
            var baseWidth = 21;
            for (var tier = 0; tier < 7; tier++) {
                var width = Math.max(3.2, baseWidth - (tier * 2.5));
                var height = (tier < 2) ? 1.7 : ((tier < 5) ? 1.45 : 1.1);
                var y = yCursor + (height * 0.5);
                var solid = tier <= 2 || tier === 4;
                var mat = (tier >= 4) ? snowMat : rockMat;
                addBlock(centerX + randRange(-0.28, 0.28), y, centerZ + randRange(-0.28, 0.28), width, height, width, mat, solid);
                yCursor += height * 0.6;
            }

            // Traversable ledges.
            addBlock(centerX + 5.1, 4.2, centerZ - 2.2, 5.1, 1.1, 2.8, snowMat, true);
            addBlock(centerX - 4.7, 5.4, centerZ + 1.6, 4.6, 1.0, 2.5, snowMat, true);
            addRamp(centerX + 2.3, 2.35, centerZ + 5.1, 5.2, 1.1, 3.3, rockMat, Math.PI * 0.5, -0.24, true);

            // Decorative peak.
            addBlock(centerX, yCursor + 1.25, centerZ - 0.4, 2.2, 2.5, 2.2, iceMat, false);
            addSpawnExclusionCircle(centerX, centerZ, 8.4);

            return {
                x: centerX,
                z: centerZ,
                topY: yCursor + 2
            };
        }

        function addWaterfallFeature(anchorX, anchorZ, cliffMat, waterPoolMat) {
            var lipX = anchorX + 6.0;
            var lipZ = anchorZ + 2.8;

            addBlock(lipX, 5.1, lipZ, 4.6, 1.3, 2.4, cliffMat, false);
            addBlock(lipX + 1.0, 3.4, lipZ + 0.2, 5.4, 2.2, 2.8, cliffMat, false);
            addBlock(lipX + 1.4, 1.1, lipZ + 0.45, 6.0, 2.2, 3.2, cliffMat, false);

            var cascadeTexture = createWaterfallTexture();
            var mainSheetMaterial = new THREE.MeshLambertMaterial({
                color: 0x95deff,
                map: cascadeTexture,
                transparent: true,
                opacity: 0.74,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            var secondSheetMaterial = new THREE.MeshLambertMaterial({
                color: 0x79c8ef,
                map: cascadeTexture ? cascadeTexture.clone() : null,
                transparent: true,
                opacity: 0.55,
                depthWrite: false,
                side: THREE.DoubleSide
            });

            if (secondSheetMaterial.map) {
                secondSheetMaterial.map.wrapS = THREE.RepeatWrapping;
                secondSheetMaterial.map.wrapT = THREE.RepeatWrapping;
                secondSheetMaterial.map.repeat.set(1.1, 2.1);
                secondSheetMaterial.map.offset.set(0.08, 0);
            }

            var sheetA = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 8.3, 1, 6), mainSheetMaterial);
            sheetA.position.set(lipX + 1.45, 3.85, lipZ + 0.55);
            sheetA.rotation.y = -0.24;
            scene.add(sheetA);

            var sheetB = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 7.5, 1, 5), secondSheetMaterial);
            sheetB.position.set(lipX + 1.78, 3.35, lipZ + 0.78);
            sheetB.rotation.y = -0.24;
            scene.add(sheetB);

            animatedWaterfallSheets.push({
                mesh: sheetA,
                material: mainSheetMaterial,
                speed: 0.9,
                baseOpacity: 0.74,
                wobbleAmp: 0.05,
                wobbleFreq: 2.7,
                phase: randRange(0, Math.PI * 2),
                offset: 0,
                baseX: sheetA.position.x
            });
            animatedWaterfallSheets.push({
                mesh: sheetB,
                material: secondSheetMaterial,
                speed: 1.25,
                baseOpacity: 0.55,
                wobbleAmp: 0.04,
                wobbleFreq: 3.4,
                phase: randRange(0, Math.PI * 2),
                offset: 0,
                baseX: sheetB.position.x
            });

            var mistMat = new THREE.MeshBasicMaterial({
                color: 0xd8f5ff,
                transparent: true,
                opacity: 0.28,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            for (var i = 0; i < 3; i++) {
                var mist = new THREE.Mesh(new THREE.PlaneGeometry(2.0 + (i * 0.5), 1.0 + (i * 0.25)), mistMat.clone());
                mist.position.set(lipX + 2.5 + (i * 0.3), 0.8 + (i * 0.2), lipZ + 1.0 + (i * 0.25));
                mist.rotation.y = -0.45 + (i * 0.22);
                scene.add(mist);
                animatedMistCards.push({
                    mesh: mist,
                    baseOpacity: mist.material.opacity,
                    phase: randRange(0, Math.PI * 2)
                });
            }

            var basin = new THREE.Mesh(
                new THREE.CylinderGeometry(2.1, 2.5, 0.12, 20),
                waterPoolMat
            );
            basin.position.set(lipX + 2.6, -0.1, lipZ + 1.0);
            basin.receiveShadow = true;
            scene.add(basin);

            addSpawnExclusionCircle(lipX + 2.6, lipZ + 1.0, 3.1);
        }

        // --- Ground ---
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
            addSpawnExclusionCircle(poolPt.x, poolPt.z, poolRadius * 0.62);
        }

        var groundSeg = Math.max(48, Math.round(WORLD_SIZE * 1.15));
        var groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, groundSeg, groundSeg);
        groundGeo.rotateX(-Math.PI / 2);
        groundGeo.translate(WORLD_CENTER, 0, WORLD_CENTER);

        var groundPos = groundGeo.attributes.position;
        var groundColors = new Float32Array(groundPos.count * 3);
        var color = new THREE.Color();
        var arcticColor = new THREE.Color(0xdcefff);
        var urbanColor = new THREE.Color(0x8f969e);
        var desertColor = new THREE.Color(0xd7c28a);
        var jungleColor = new THREE.Color(0x3e7f43);
        var waterColor = new THREE.Color(0x2f6f8f);

        for (var vi = 0; vi < groundPos.count; vi++) {
            var gx = groundPos.getX(vi);
            var gz = groundPos.getZ(vi);
            var gy = getGroundHeightAt(gx, gz);
            groundPos.setY(vi, gy);

            var weights = biomeBlendWeights(gx, gz);
            color.r = (arcticColor.r * weights.arctic) + (urbanColor.r * weights.urban) + (desertColor.r * weights.desert) + (jungleColor.r * weights.jungle);
            color.g = (arcticColor.g * weights.arctic) + (urbanColor.g * weights.urban) + (desertColor.g * weights.desert) + (jungleColor.g * weights.jungle);
            color.b = (arcticColor.b * weights.arctic) + (urbanColor.b * weights.urban) + (desertColor.b * weights.desert) + (jungleColor.b * weights.jungle);

            var n = terrainColorNoise(gx, gz);
            color.offsetHSL(n * 0.012, n * 0.06, n * 0.085);
            color.r = clamp01(color.r);
            color.g = clamp01(color.g);
            color.b = clamp01(color.b);

            if (gy < -0.05) {
                var waterDepth = clamp01((-gy) * 1.15);
                color.r = color.r + ((waterColor.r - color.r) * (0.74 + (waterDepth * 0.2)));
                color.g = color.g + ((waterColor.g - color.g) * (0.74 + (waterDepth * 0.2)));
                color.b = color.b + ((waterColor.b - color.b) * (0.74 + (waterDepth * 0.2)));
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
        var lowerGroundMat = new THREE.MeshLambertMaterial({ color: 0x22372a });
        var lowerGround = new THREE.Mesh(lowerGroundGeo, lowerGroundMat);
        lowerGround.rotation.x = -Math.PI / 2;
        lowerGround.position.set(WORLD_CENTER, -6, WORLD_CENTER);
        lowerGround.receiveShadow = true;
        scene.add(lowerGround);

        var debugGridEnabled = resolveDebugGridFromLocation();
        if (debugGridEnabled) {
            var gridSegments = Math.max(40, Math.round(WORLD_SIZE));
            var gridHelper = new THREE.GridHelper(WORLD_SIZE, gridSegments, 0x5fa55f, 0x4a7f4a);
            gridHelper.position.set(WORLD_CENTER, 0.045, WORLD_CENTER);
            var mats = Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material];
            for (var gm = 0; gm < mats.length; gm++) {
                mats[gm].transparent = true;
                mats[gm].opacity = 0.32;
            }
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
        var mesaBodyMat = new THREE.MeshLambertMaterial({ color: 0xae8456 });
        var mesaTopMat = new THREE.MeshLambertMaterial({ color: 0xc79b68 });
        var snowRockMat = new THREE.MeshLambertMaterial({ color: 0x8ea2b4 });
        var snowCapMat = new THREE.MeshLambertMaterial({ color: 0xeff7ff });
        var icePeakMat = new THREE.MeshLambertMaterial({ color: 0xbbe5ff });

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
        var x;
        var z;

        // Jungle: dense vegetation and logs.
        var jungleTreeTarget = Math.round(14 * WORLD_AREA_SCALE);
        var jungleBushTarget = Math.round(18 * WORLD_AREA_SCALE);
        var jungleLogTarget = Math.round(7 * WORLD_AREA_SCALE);

        tries = 0;
        placed = 0;
        while (placed < jungleTreeTarget && tries < jungleTreeTarget * 7) {
            tries++;
            var jt = randomPointInBiome(BIOME_JUNGLE, 4);
            x = jt.x;
            z = jt.z;
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
            x = jb.x;
            z = jb.z;
            if (getGroundHeightAt(x, z) < -0.15) continue;
            addBush(x, z, jungleLeafMat);
            placed++;
        }

        tries = 0;
        placed = 0;
        while (placed < jungleLogTarget && tries < jungleLogTarget * 9) {
            tries++;
            var jl = randomPointInBiome(BIOME_JUNGLE, 4);
            x = jl.x;
            z = jl.z;
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
            x = ap.x;
            z = ap.z;
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
            x = dp.x;
            z = dp.z;
            if (pointBlocked(x, z, 1.2)) continue;
            addBlock(x, 0.7, z, randRange(1.0, 2.2), randRange(1.1, 2.0), randRange(1.0, 2.2), sandMat, true);
            if (placed % 3 === 0) {
                addBlock(x + 0.45, 1.15, z, 0.2, 1.4, 0.2, cactusMat, false);
                addBlock(x + 0.72, 1.05, z, 0.34, 0.2, 0.2, cactusMat, false);
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

        // Desert hero landmarks: mesa/cliff clusters.
        var mesaPlaced = 0;
        var mesaTarget = 3;
        var mesaTries = 0;
        while (mesaPlaced < mesaTarget && mesaTries < 30) {
            mesaTries++;
            var mesaPt = randomPointInBiome(BIOME_DESERT, 10);
            if (Math.abs(mesaPt.x - WORLD_CENTER) < 12 && Math.abs(mesaPt.z - WORLD_CENTER) < 12) continue;
            if (pointBlocked(mesaPt.x, mesaPt.z, 5.5)) continue;
            createDesertMesa(mesaPt.x, mesaPt.z, randRange(4.8, 7.1), 4 + Math.round(random01() * 2), mesaBodyMat, mesaTopMat);
            mesaPlaced++;
        }

        // Arctic hero landmark: snowy mountain.
        var mountainCenter = null;
        for (var mountainTry = 0; mountainTry < 20 && !mountainCenter; mountainTry++) {
            var mountainPt = randomPointInBiome(BIOME_ARCTIC, 12);
            if (Math.abs(mountainPt.x - WORLD_CENTER) < 10 && Math.abs(mountainPt.z - WORLD_CENTER) < 10) continue;
            if (pointBlocked(mountainPt.x, mountainPt.z, 8.0)) continue;
            mountainCenter = createArcticMountain(mountainPt.x, mountainPt.z, snowRockMat, snowCapMat, icePeakMat);
        }

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

        if (mountainCenter) {
            addWaterfallFeature(mountainCenter.x, mountainCenter.z, cliffMat, waterMat);
        }

        // --- Lighting ---
        scene.add(new THREE.AmbientLight(0x6c747b, 0.92));

        var dirLight = new THREE.DirectionalLight(0xfff4d8, 1.12);
        dirLight.position.set(WORLD_CENTER + (WORLD_SIZE * 0.22), WORLD_SIZE * 0.95, WORLD_CENTER - (WORLD_SIZE * 0.12));
        dirLight.castShadow = false;
        scene.add(dirLight);

        scene.add(new THREE.HemisphereLight(0xbfdfff, 0x4d6149, 0.68));

        scene.background = new THREE.Color(0x9cc7e4);
        scene.fog = new THREE.Fog(0x9abfd8, WORLD_SIZE * 0.45, WORLD_SIZE * 1.28);
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

    globalThis.__MAYHEM_RUNTIME.GameWorld = GameWorld;
})();
