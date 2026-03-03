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

    var DEFAULT_WORLD_PROFILE_VERSION = Math.max(1, Math.round(Number(SHARED_WORLD_CFG && SHARED_WORLD_CFG.profileVersion) || 3));
    var DEFAULT_WORLD_FLAGS = {
        envV2: (SHARED_WORLD_CFG && SHARED_WORLD_CFG.flags) ? !!SHARED_WORLD_CFG.flags.envV2 : true,
        terrainPhysicsV2: (SHARED_WORLD_CFG && SHARED_WORLD_CFG.flags) ? !!SHARED_WORLD_CFG.flags.terrainPhysicsV2 : true
    };

    var WORLD_PROFILE_VERSION = DEFAULT_WORLD_PROFILE_VERSION;
    var WORLD_FLAGS = cloneWorldFlags(DEFAULT_WORLD_FLAGS);

    var WORLD_SEED = 'mineshoot-v1';
    var seedHash = 1;
    var rngState = 1;
    var waterPools = [];
    var terrainSampler = null;
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

    function pointHash(x, z, salt) {
        var sx = Math.floor((x * 1.31) + (salt * 13.7));
        var sz = Math.floor((z * 1.63) - (salt * 9.1));
        return hash2(sx, sz);
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

    function cloneWaterPools(rawPools) {
        var out = [];
        if (!rawPools || !rawPools.length) return out;
        for (var i = 0; i < rawPools.length; i++) {
            var p = rawPools[i];
            out.push({
                x: Number(p && p.x || 0),
                z: Number(p && p.z || 0),
                radius: Number(p && p.radius || 0),
                depth: Number(p && p.depth || 0),
                surfaceY: Number(p && p.surfaceY || 0)
            });
        }
        return out;
    }

    function getGroundHeightAt(x, z) {
        if (terrainSampler && typeof terrainSampler.getGroundHeightAt === 'function') {
            return Number(terrainSampler.getGroundHeightAt(x, z) || 0);
        }

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
        terrainSampler = null;
        spawnExclusionZones = [];
        animatedWaterfallSheets = [];
        animatedMistCards = [];
        animClock = 0;

        var SHARED_TERRAIN = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.terrainSampler)
            ? globalThis.__MAYHEM_RUNTIME.GameShared.terrainSampler
            : null;
        if (SHARED_TERRAIN && typeof SHARED_TERRAIN.createTerrainSampler === 'function') {
            terrainSampler = SHARED_TERRAIN.createTerrainSampler({
                worldSeed: WORLD_SEED,
                worldProfileVersion: WORLD_PROFILE_VERSION,
                worldFlags: cloneWorldFlags(WORLD_FLAGS)
            });
            if (terrainSampler && terrainSampler.waterPools) {
                waterPools = cloneWaterPools(terrainSampler.waterPools);
            }
            if (terrainSampler && typeof terrainSampler.poolRngStateAfter === 'number' && isFinite(terrainSampler.poolRngStateAfter)) {
                var samplerRngState = (terrainSampler.poolRngStateAfter >>> 0) || 1;
                rngState = samplerRngState;
            }
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

        function addJungleTree(x, z, trunkHeight, trunkMat, leavesMat, vineMat, flowerMat, forcedStyle) {
            var trunkH = Math.max(2.4, Number(trunkHeight) || 3.2);
            var styleSeed = pointHash(x, z, 11);
            var style = forcedStyle || 'broad';
            if (!forcedStyle) {
                if (styleSeed < 0.24) style = 'broad';
                else if (styleSeed < 0.46) style = 'spire';
                else if (styleSeed < 0.69) style = 'split';
                else if (styleSeed < 0.88) style = 'palm';
                else style = 'giant';
            }

            var trunkWidth = 0.82 + (pointHash(x, z, 17) * 0.24);
            if (style === 'palm') trunkWidth = 0.56 + (pointHash(x, z, 18) * 0.14);
            if (style === 'giant') {
                trunkH += 1.8 + (pointHash(x, z, 19) * 2.7);
                trunkWidth = 1.14 + (pointHash(x, z, 20) * 0.34);
            }

            addBlock(x, trunkH * 0.5, z, trunkWidth, trunkH, trunkWidth, trunkMat, true);

            var canopyY = trunkH + 0.45;
            if (style === 'broad') {
                addBlock(x, canopyY, z, 3.5, 1.2, 3.5, leavesMat, false);
                addBlock(x, canopyY + 0.8, z, 2.4, 0.95, 2.4, leavesMat, false);
                addBlock(x + 0.65, canopyY + 0.25, z - 0.45, 1.6, 0.8, 1.6, leavesMat, false);
            } else if (style === 'spire') {
                addBlock(x, canopyY - 0.2, z, 2.6, 0.9, 2.6, leavesMat, false);
                addBlock(x, canopyY + 0.6, z, 1.9, 0.85, 1.9, leavesMat, false);
                addBlock(x, canopyY + 1.25, z, 1.25, 0.7, 1.25, leavesMat, false);
            } else if (style === 'split') {
                addBlock(x - 0.9, canopyY + 0.35, z, 2.2, 0.95, 2.2, leavesMat, false);
                addBlock(x + 0.95, canopyY + 0.75, z + 0.25, 2.1, 0.9, 2.1, leavesMat, false);
                addBlock(x, canopyY - 0.1, z, 1.8, 0.8, 1.8, leavesMat, false);
            } else if (style === 'palm') {
                addBlock(x, canopyY + 0.2, z, 3.8, 0.28, 0.9, leavesMat, false);
                addBlock(x, canopyY + 0.2, z, 0.9, 0.28, 3.8, leavesMat, false);
                addBlock(x + 0.35, canopyY + 0.05, z - 0.2, 2.4, 0.24, 0.8, leavesMat, false);
                addBlock(x - 0.35, canopyY + 0.05, z + 0.25, 0.8, 0.24, 2.6, leavesMat, false);
            } else {
                addBlock(x, canopyY, z, 4.2, 1.35, 4.2, leavesMat, false);
                addBlock(x, canopyY + 0.9, z, 3.2, 1.1, 3.2, leavesMat, false);
                addBlock(x, canopyY + 1.65, z, 2.3, 0.95, 2.3, leavesMat, false);
                addBlock(x + 0.95, canopyY + 0.5, z - 0.8, 2.1, 0.9, 2.1, leavesMat, false);
                addBlock(x + 0.9, 0.5, z + 0.9, 0.72, 1.0, 0.72, trunkMat, true);
                addBlock(x - 0.95, 0.5, z - 0.9, 0.72, 1.0, 0.72, trunkMat, true);
            }

            var vineCount = (style === 'giant') ? 4 : ((style === 'palm') ? 1 : 2);
            for (var v = 0; v < vineCount; v++) {
                var vHash = pointHash(x, z, 24 + v);
                var angle = vHash * Math.PI * 2;
                var vx = x + (Math.cos(angle) * (0.55 + (trunkWidth * 0.75)));
                var vz = z + (Math.sin(angle) * (0.55 + (trunkWidth * 0.75)));
                var vineHeight = 0.8 + (pointHash(x, z, 31 + v) * Math.max(0.7, trunkH * 0.4));
                addBlock(vx, canopyY - (vineHeight * 0.5), vz, 0.18, vineHeight, 0.18, vineMat, false);
            }

            if (flowerMat && pointHash(x, z, 39) > 0.65) {
                var petals = 2 + Math.round(pointHash(x, z, 40) * 2);
                for (var f = 0; f < petals; f++) {
                    var theta = ((Math.PI * 2) / petals) * f;
                    var fx = x + (Math.cos(theta) * (0.85 + (pointHash(x, z, 41 + f) * 0.5)));
                    var fz = z + (Math.sin(theta) * (0.85 + (pointHash(x, z, 44 + f) * 0.5)));
                    addBlock(fx, 0.08, fz, 0.16, 0.16, 0.16, flowerMat, false);
                }
            }
        }

        function addBush(x, z, leavesMat, flowerMat) {
            var size = 1.05 + (pointHash(x, z, 52) * 0.95);
            var height = 0.45 + (pointHash(x, z, 53) * 0.55);
            addBlock(x, height * 0.5, z, size, height, size, leavesMat, false);
            if (flowerMat && pointHash(x, z, 54) > 0.72) {
                addBlock(x + 0.2, height + 0.07, z - 0.1, 0.14, 0.14, 0.14, flowerMat, false);
                addBlock(x - 0.16, height + 0.06, z + 0.17, 0.14, 0.14, 0.14, flowerMat, false);
            }
        }

        function addLog(x, z, alongX, logMat) {
            var length = 2.2 + (pointHash(x, z, 61) * 1.6);
            var thickness = 0.55 + (pointHash(x, z, 62) * 0.3);
            if (alongX) {
                addBlock(x, thickness * 0.5, z, length, thickness, 0.85, logMat, true);
            } else {
                addBlock(x, thickness * 0.5, z, 0.85, thickness, length, logMat, true);
            }
        }

        function addJungleArtifact(x, z, bodyMat, relicMat, vineMat) {
            addBlock(x, 0.28, z, 3.8, 0.56, 3.8, bodyMat, true);
            addBlock(x, 0.88, z, 2.4, 0.64, 2.4, bodyMat, true);
            addBlock(x, 1.58, z, 1.1, 0.76, 1.1, relicMat, true);
            addBlock(x, 2.2, z, 0.52, 0.48, 0.52, relicMat, false);

            var p = 1.18;
            addBlock(x - p, 1.08, z - p, 0.42, 1.6, 0.42, bodyMat, true);
            addBlock(x + p, 1.04, z - p, 0.42, 1.52, 0.42, bodyMat, true);
            addBlock(x - p, 1.01, z + p, 0.42, 1.46, 0.42, bodyMat, true);
            addBlock(x + p, 1.15, z + p, 0.42, 1.72, 0.42, bodyMat, true);

            addBlock(x - 1.25, 0.86, z + 0.4, 0.18, 1.2, 0.18, vineMat, false);
            addBlock(x + 1.35, 0.92, z - 0.55, 0.18, 1.1, 0.18, vineMat, false);
            addSpawnExclusionCircle(x, z, 2.95);
        }

        function addArcticCrystal(x, z, iceMat, frostMat) {
            var h = 1.6 + (pointHash(x, z, 71) * 3.4);
            var width = 0.58 + (pointHash(x, z, 72) * 0.52);
            var mat = (pointHash(x, z, 73) > 0.58) ? frostMat : iceMat;
            addBlock(x, h * 0.5, z, width, h, width, mat, true);

            if (h > 2.6) {
                var sideH = h * 0.52;
                addBlock(x + 0.55, sideH * 0.5, z - 0.35, width * 0.52, sideH, width * 0.52, iceMat, false);
                addBlock(x - 0.46, sideH * 0.4, z + 0.28, width * 0.46, sideH * 0.8, width * 0.46, frostMat, false);
            }
        }

        function addSnowDrift(x, z, snowMat) {
            var w = 1.7 + (pointHash(x, z, 81) * 2.6);
            var d = 1.6 + (pointHash(x, z, 82) * 2.4);
            var h = 0.2 + (pointHash(x, z, 83) * 0.4);
            addBlock(x, h * 0.5, z, w, h, d, snowMat, false);
        }

        function addCactus(x, z, cactusMat) {
            var stemHeight = 1.5 + (pointHash(x, z, 91) * 2.8);
            var stemWidth = 0.24 + (pointHash(x, z, 92) * 0.22);
            addBlock(x, stemHeight * 0.5, z, stemWidth, stemHeight, stemWidth, cactusMat, true);

            var armSeed = pointHash(x, z, 93);
            if (armSeed > 0.34) {
                var dir = (armSeed > 0.67) ? 1 : -1;
                var armY = stemHeight * (0.46 + (pointHash(x, z, 94) * 0.2));
                addBlock(x + (dir * 0.34), armY, z, 0.52, 0.16, 0.16, cactusMat, true);
                addBlock(x + (dir * 0.58), armY + 0.28, z, 0.16, 0.62, 0.16, cactusMat, true);
            }

            if (pointHash(x, z, 95) > 0.71) {
                var armY2 = stemHeight * (0.58 + (pointHash(x, z, 96) * 0.18));
                addBlock(x, armY2, z + 0.32, 0.16, 0.16, 0.52, cactusMat, true);
                addBlock(x, armY2 + 0.22, z + 0.54, 0.16, 0.48, 0.16, cactusMat, true);
            }
        }

        function createDesertCliffRidge(centerX, centerZ, length, dirAngle, bodyMat, capMat) {
            var segmentCount = Math.max(4, Math.round(length / 2.8));
            var cosA = Math.cos(dirAngle);
            var sinA = Math.sin(dirAngle);
            var half = (segmentCount - 1) * 0.5;

            for (var s = 0; s < segmentCount; s++) {
                var t = (s - half) / (half || 1);
                var along = t * (length * 0.5);
                var wobble = Math.sin(t * Math.PI * 1.7) * (0.8 + (pointHash(centerX, centerZ, 101 + s) * 0.9));
                var px = centerX + (cosA * along) + (sinA * wobble);
                var pz = centerZ + (sinA * along) - (cosA * wobble);
                var rise = 2.0 + ((1 - Math.abs(t)) * 1.9) + (pointHash(px, pz, 121) * 1.25);
                var width = 2.2 + (pointHash(px, pz, 122) * 2.4);
                var depth = 1.9 + (pointHash(px, pz, 123) * 1.8);
                addBlock(px, rise * 0.5, pz, width, rise, depth, bodyMat, true);
                addBlock(px, rise + 0.16, pz, width * 0.82, 0.32, depth * 0.8, capMat, false);
            }

            addSpawnExclusionCircle(centerX, centerZ, Math.max(3.8, length * 0.36));
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
            var baseWidth = 23.5 + randRange(-1.6, 2.4);
            var tierCount = 8;
            for (var tier = 0; tier < tierCount; tier++) {
                var width = Math.max(3.2, baseWidth - (tier * 2.45));
                var height = (tier < 2) ? 1.85 : ((tier < 5) ? 1.52 : 1.18);
                var y = yCursor + (height * 0.5);
                var solid = tier <= 3 || tier === 5;
                var mat = (tier >= 4) ? snowMat : rockMat;
                addBlock(centerX + randRange(-0.32, 0.32), y, centerZ + randRange(-0.32, 0.32), width, height, width, mat, solid);
                yCursor += height * 0.62;
            }

            // Traversable ledges.
            addBlock(centerX + 5.3, 4.4, centerZ - 2.3, 5.4, 1.15, 2.9, snowMat, true);
            addBlock(centerX - 5.0, 5.6, centerZ + 1.7, 4.8, 1.05, 2.6, snowMat, true);
            addRamp(centerX + 2.4, 2.45, centerZ + 5.3, 5.4, 1.15, 3.4, rockMat, Math.PI * 0.5, -0.25, true);
            addRamp(centerX - 2.6, 3.18, centerZ - 4.8, 4.8, 1.0, 3.0, snowMat, Math.PI * 1.12, -0.21, true);

            // Blue glacier shelves around the core.
            addBlock(centerX + 7.2, 1.25, centerZ + 2.8, 3.4, 0.75, 2.4, iceMat, true);
            addBlock(centerX - 6.8, 1.15, centerZ - 2.4, 2.8, 0.7, 2.0, iceMat, true);
            addBlock(centerX + 0.5, 6.55, centerZ - 0.3, 3.0, 0.82, 2.4, snowMat, true);

            // Decorative peak.
            addBlock(centerX, yCursor + 1.45, centerZ - 0.35, 2.4, 2.8, 2.4, iceMat, false);
            addBlock(centerX - 0.6, yCursor + 2.15, centerZ + 0.6, 1.1, 1.6, 1.1, iceMat, false);
            addSpawnExclusionCircle(centerX, centerZ, 9.2);

            return {
                x: centerX,
                z: centerZ,
                topY: yCursor + 2.4
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
        if (!terrainSampler || !terrainSampler.waterPools) {
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
        }
        for (var poolIdx = 0; poolIdx < waterPools.length; poolIdx++) {
            var poolEntry = waterPools[poolIdx];
            addSpawnExclusionCircle(poolEntry.x, poolEntry.z, poolEntry.radius * 0.62);
        }

        var groundSeg = Math.max(48, Math.round(WORLD_SIZE * 1.15));
        var groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, groundSeg, groundSeg);
        groundGeo.rotateX(-Math.PI / 2);
        groundGeo.translate(WORLD_CENTER, 0, WORLD_CENTER);

        var groundPos = groundGeo.attributes.position;
        var groundColors = new Float32Array(groundPos.count * 3);
        var color = new THREE.Color();
        var arcticColor = new THREE.Color(0xb7dcf8);
        var urbanColor = new THREE.Color(0x8f969e);
        var desertColor = new THREE.Color(0xd6bf7f);
        var jungleColor = new THREE.Color(0x3a7a3e);
        var seamColor = new THREE.Color(0x666b64);
        var waterColor = new THREE.Color(0x2f6f8f);

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

            var n = terrainColorNoise(gx, gz);
            if (biomeId === BIOME_ARCTIC) {
                color.offsetHSL((-0.01 + (n * 0.008)), 0.07 + (n * 0.015), 0.07 + (n * 0.05));
            } else if (biomeId === BIOME_URBAN) {
                color.offsetHSL(n * 0.006, n * 0.018, n * 0.03);
            } else if (biomeId === BIOME_DESERT) {
                color.offsetHSL(n * 0.01, n * 0.03, n * 0.055);
            } else {
                color.offsetHSL(n * 0.016, n * 0.06, n * 0.078);
            }

            if (Math.abs(gx - WORLD_CENTER) <= 0.55 || Math.abs(gz - WORLD_CENTER) <= 0.55) {
                color.r = color.r + ((seamColor.r - color.r) * 0.42);
                color.g = color.g + ((seamColor.g - color.g) * 0.42);
                color.b = color.b + ((seamColor.b - color.b) * 0.42);
            }

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
        var jungleFlowerMat = new THREE.MeshLambertMaterial({ color: 0xe7bf53 });
        var jungleArtifactStoneMat = new THREE.MeshLambertMaterial({ color: 0x6d7e5f });
        var jungleArtifactCoreMat = new THREE.MeshLambertMaterial({ color: 0x89caa7 });
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

        // Hard seam strips keep quadrants visually explicit for biome plug-and-play.
        var seamStripMat = new THREE.MeshLambertMaterial({ color: 0x646861 });
        addBlock(WORLD_CENTER, 0.08, WORLD_CENTER, 1.06, 0.16, WORLD_SIZE - (WORLD_MARGIN * 2.2), seamStripMat, false);
        addBlock(WORLD_CENTER, 0.08, WORLD_CENTER, WORLD_SIZE - (WORLD_MARGIN * 2.2), 0.16, 1.06, seamStripMat, false);

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

        // Jungle: more variation, denser undergrowth, and hidden shrine artifacts.
        var jungleTreeTarget = Math.round(18 * WORLD_AREA_SCALE);
        var jungleBushTarget = Math.round(24 * WORLD_AREA_SCALE);
        var jungleLogTarget = Math.round(8 * WORLD_AREA_SCALE);
        var jungleArtifactTarget = Math.max(2, Math.round(WORLD_AREA_SCALE * 0.9));

        tries = 0;
        placed = 0;
        while (placed < jungleTreeTarget && tries < jungleTreeTarget * 9) {
            tries++;
            var jt = randomPointInBiome(BIOME_JUNGLE, 4);
            x = jt.x;
            z = jt.z;
            if (getGroundHeightAt(x, z) < -0.18) continue;
            if (pointBlocked(x, z, 1.4)) continue;
            var treeHeight = 2.7 + (pointHash(x, z, 151) * 2.8);
            addJungleTree(x, z, treeHeight, jungleWoodMat, jungleLeafMat, vineMat, jungleFlowerMat);
            placed++;
        }

        tries = 0;
        placed = 0;
        while (placed < jungleBushTarget && tries < jungleBushTarget * 6) {
            tries++;
            var jb = randomPointInBiome(BIOME_JUNGLE, 3);
            x = jb.x;
            z = jb.z;
            if (getGroundHeightAt(x, z) < -0.15) continue;
            if (pointBlocked(x, z, 0.75)) continue;
            addBush(x, z, jungleLeafMat, jungleFlowerMat);
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
            addLog(x, z, pointHash(x, z, 159) > 0.5, jungleWoodMat);
            placed++;
        }

        tries = 0;
        placed = 0;
        while (placed < jungleArtifactTarget && tries < jungleArtifactTarget * 14) {
            tries++;
            var ja = randomPointInBiome(BIOME_JUNGLE, 9);
            x = ja.x;
            z = ja.z;
            if (getGroundHeightAt(x, z) < -0.08) continue;
            if (pointBlocked(x, z, 3.1)) continue;
            addJungleArtifact(x, z, jungleArtifactStoneMat, jungleArtifactCoreMat, vineMat);
            placed++;
        }

        // Arctic: brighter blue crystal fields plus snow drifts.
        var iceMat = new THREE.MeshLambertMaterial({ color: 0xaad8ff });
        var frostMat = new THREE.MeshLambertMaterial({ color: 0xecf8ff });
        var arcticCrystalTarget = Math.round(20 * WORLD_AREA_SCALE);
        var arcticDriftTarget = Math.round(16 * WORLD_AREA_SCALE);
        tries = 0;
        placed = 0;
        while (placed < arcticCrystalTarget && tries < arcticCrystalTarget * 8) {
            tries++;
            var ap = randomPointInBiome(BIOME_ARCTIC, 4);
            x = ap.x;
            z = ap.z;
            if (pointBlocked(x, z, 1.25)) continue;
            addArcticCrystal(x, z, iceMat, frostMat);
            placed++;
        }

        tries = 0;
        placed = 0;
        while (placed < arcticDriftTarget && tries < arcticDriftTarget * 7) {
            tries++;
            var ad = randomPointInBiome(BIOME_ARCTIC, 4);
            x = ad.x;
            z = ad.z;
            if (pointBlocked(x, z, 1.7)) continue;
            addSnowDrift(x, z, snowCapMat);
            placed++;
        }

        // Desert: layered cliffs, sandstone boulders, and cactus clusters.
        var sandMat = new THREE.MeshLambertMaterial({ color: 0xd9bf75 });
        var cactusMat = new THREE.MeshLambertMaterial({ color: 0x4f8a3d });
        var desertRockTarget = Math.round(10 * WORLD_AREA_SCALE);
        var cactusTarget = Math.round(14 * WORLD_AREA_SCALE);
        var cliffPlaced = 0;
        var cliffTarget = 4;
        var cliffTries = 0;
        while (cliffPlaced < cliffTarget && cliffTries < cliffTarget * 14) {
            cliffTries++;
            var cliffPt = randomPointInBiome(BIOME_DESERT, 10);
            if (Math.abs(cliffPt.x - WORLD_CENTER) < 10 && Math.abs(cliffPt.z - WORLD_CENTER) < 10) continue;
            if (pointBlocked(cliffPt.x, cliffPt.z, 6.2)) continue;
            createDesertCliffRidge(cliffPt.x, cliffPt.z, randRange(10, 17), randRange(0, Math.PI * 2), mesaBodyMat, mesaTopMat);
            cliffPlaced++;
        }

        tries = 0;
        placed = 0;
        while (placed < desertRockTarget && tries < desertRockTarget * 8) {
            tries++;
            var dp = randomPointInBiome(BIOME_DESERT, 4);
            x = dp.x;
            z = dp.z;
            if (pointBlocked(x, z, 1.2)) continue;
            var rockH = randRange(1.0, 2.2);
            addBlock(x, rockH * 0.5, z, randRange(1.0, 2.4), rockH, randRange(1.0, 2.4), sandMat, true);
            placed++;
        }

        tries = 0;
        placed = 0;
        while (placed < cactusTarget && tries < cactusTarget * 7) {
            tries++;
            var dc = randomPointInBiome(BIOME_DESERT, 4);
            x = dc.x;
            z = dc.z;
            if (pointBlocked(x, z, 0.85)) continue;
            addCactus(x, z, cactusMat);
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
        if (!mountainCenter) {
            var arcticFallbackBounds = biomeBounds(BIOME_ARCTIC, 14);
            var fallbackX = (arcticFallbackBounds.minX + arcticFallbackBounds.maxX) * 0.5;
            var fallbackZ = (arcticFallbackBounds.minZ + arcticFallbackBounds.maxZ) * 0.5;
            mountainCenter = createArcticMountain(fallbackX, fallbackZ, snowRockMat, snowCapMat, icePeakMat);
        }

        // Arctic mountain foothills: extra crystals + drifts for a colder blue silhouette.
        if (mountainCenter) {
            for (var ring = 0; ring < 6; ring++) {
                var ang = (Math.PI * 2 * ring) / 6;
                var radius = 8.6 + randRange(0.8, 3.2);
                var mx = mountainCenter.x + (Math.cos(ang) * radius);
                var mz = mountainCenter.z + (Math.sin(ang) * radius);
                if (biomeAt(mx, mz) !== BIOME_ARCTIC) continue;
                if (pointBlocked(mx, mz, 1.4)) continue;
                addArcticCrystal(mx, mz, icePeakMat, frostMat);
                if (!pointBlocked(mx + 1.1, mz - 0.6, 1.0)) {
                    addSnowDrift(mx + 1.1, mz - 0.6, snowCapMat);
                }
            }
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
