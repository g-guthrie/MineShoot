/**
 * world.js - Scalable world generation, structures, cover, lighting
 * Loaded as global: window.GameWorld
 */
(function () {
    'use strict';

    var GameWorld = {};

    var PRIM = globalThis.__GAME_PRIMITIVES__ || {};
    var WORLD_LAYOUT = globalThis.__GAME_WORLD_LAYOUT__ || null;
    var WORLD_PRIM = PRIM.world || {};
    var ENTITY_PRIM = PRIM.entity || {};
    var BASE_WORLD_SIZE = Number(WORLD_PRIM.base_world_size || 50);
    var WORLD_AREA_SCALE = Number(WORLD_PRIM.area_scale || 5);
    var WORLD_SIZE = Number(WORLD_PRIM.world_size || Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE)));
    var WORLD_CENTER = Number(WORLD_PRIM.center || (WORLD_SIZE * 0.5));
    var WORLD_MARGIN = Number(WORLD_PRIM.margin || 2);
    var WORLD_MIN = Number(WORLD_PRIM.min || WORLD_MARGIN);
    var WORLD_MAX = Number(WORLD_PRIM.max || (WORLD_SIZE - WORLD_MARGIN));
    var DEFAULT_SPAWN_PADDING = Number(ENTITY_PRIM.spawn_padding_default || 8);
    var WORLD_SEED = String(WORLD_PRIM.seed_default || 'mineshoot-v1');
    var rngState = 1;
    var DEFAULT_ENTITY_RADIUS = Number(ENTITY_PRIM.capsule_radius || 0.58);
    var DEFAULT_ENTITY_HEIGHT = Number(ENTITY_PRIM.capsule_height || 1.7);
    var EPSILON = 0.001;

    // Solid meshes used for movement/raycast collisions.
    var collidables = [];
    var chunkStore = new Map();
    var sceneRef = null;
    var worldConfigRef = null;
    var chunkStreamingEnabled = false;
    var chunkSize = Math.max(4, Math.floor(Number(WORLD_PRIM.chunk_size || 16)));
    var interestRadiusChunks = Math.max(1, Math.floor(Number(WORLD_PRIM.interest_radius_chunks || 2)));
    var chunkMaterialPalette = null;

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
        if (WORLD_PRIM.scale_axis) return WORLD_PRIM.scale_axis(value);
        return (value / BASE_WORLD_SIZE) * WORLD_SIZE;
    }

    function scaleSpan(value) {
        if (WORLD_PRIM.scale_span) return WORLD_PRIM.scale_span(value);
        return Math.max(1, (value / BASE_WORLD_SIZE) * WORLD_SIZE);
    }

    function applyWorldConfig(manifest) {
        manifest = (manifest && typeof manifest === 'object') ? manifest : null;
        if (WORLD_LAYOUT && WORLD_LAYOUT.getConfig) {
            var cfg = WORLD_LAYOUT.getConfig({
                areaScale: manifest ? manifest.areaScale : undefined,
                worldSize: manifest ? manifest.size : undefined,
                margin: manifest ? manifest.margin : undefined,
                min: manifest ? manifest.min : undefined,
                max: manifest ? manifest.max : undefined,
                center: manifest ? manifest.center : undefined,
                seed: manifest ? manifest.seed : resolveSeedFromLocation(),
                chunkSize: manifest ? manifest.chunkSize : undefined,
                interestRadiusChunks: manifest ? manifest.interestRadiusChunks : undefined
            });
            worldConfigRef = cfg;
            WORLD_AREA_SCALE = Number(cfg.areaScale);
            WORLD_SIZE = Number(cfg.worldSize);
            WORLD_CENTER = Number(cfg.center);
            WORLD_MARGIN = Number(cfg.margin);
            WORLD_MIN = Number(cfg.min);
            WORLD_MAX = Number(cfg.max);
            chunkSize = Math.max(4, Math.floor(Number(cfg.chunkSize || chunkSize)));
            interestRadiusChunks = Math.max(1, Math.floor(Number(cfg.interestRadiusChunks || interestRadiusChunks)));
            setSeed(cfg.seed || resolveSeedFromLocation());
            return;
        }

        if (!manifest) {
            WORLD_AREA_SCALE = Number(WORLD_PRIM.area_scale || 5);
            WORLD_SIZE = Number(WORLD_PRIM.world_size || Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE)));
            WORLD_CENTER = Number(WORLD_PRIM.center || (WORLD_SIZE * 0.5));
            WORLD_MARGIN = Number(WORLD_PRIM.margin || 2);
            WORLD_MIN = Number(WORLD_PRIM.min || WORLD_MARGIN);
            WORLD_MAX = Number(WORLD_PRIM.max || (WORLD_SIZE - WORLD_MARGIN));
            setSeed(resolveSeedFromLocation());
            return;
        }

        WORLD_AREA_SCALE = Number(
            (typeof manifest.areaScale === 'number' && isFinite(manifest.areaScale))
                ? manifest.areaScale
                : (WORLD_PRIM.area_scale || 5)
        );
        WORLD_SIZE = Number(
            (typeof manifest.size === 'number' && isFinite(manifest.size) && manifest.size > 0)
                ? manifest.size
                : (WORLD_PRIM.world_size || Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE)))
        );
        WORLD_MARGIN = Number(
            (typeof manifest.margin === 'number' && isFinite(manifest.margin))
                ? manifest.margin
                : (WORLD_PRIM.margin || 2)
        );
        WORLD_MIN = Number((typeof manifest.min === 'number' && isFinite(manifest.min)) ? manifest.min : WORLD_MARGIN);
        WORLD_MAX = Number((typeof manifest.max === 'number' && isFinite(manifest.max)) ? manifest.max : (WORLD_SIZE - WORLD_MARGIN));
        WORLD_CENTER = Number((typeof manifest.center === 'number' && isFinite(manifest.center)) ? manifest.center : ((WORLD_MIN + WORLD_MAX) * 0.5));
        chunkSize = Math.max(4, Math.floor(Number(manifest.chunkSize || WORLD_PRIM.chunk_size || chunkSize)));
        interestRadiusChunks = Math.max(1, Math.floor(Number(manifest.interestRadiusChunks || WORLD_PRIM.interest_radius_chunks || interestRadiusChunks)));
        setSeed(manifest.seed || resolveSeedFromLocation());
    }

    function normalizeSolidSpec(raw) {
        if (!raw || typeof raw !== 'object') return null;
        var x = Number(raw.x);
        var y = Number(raw.y);
        var z = Number(raw.z);
        var w = Number(raw.w);
        var h = Number(raw.h);
        var d = Number(raw.d);
        if (!isFinite(x) || !isFinite(y) || !isFinite(z) || !isFinite(w) || !isFinite(h) || !isFinite(d)) {
            return null;
        }
        if (w <= 0 || h <= 0 || d <= 0) return null;
        return {
            x: x,
            y: y,
            z: z,
            w: w,
            h: h,
            d: d,
            kind: String(raw.kind || '')
        };
    }

    function normalizeSolidSpecs(rawList) {
        if (!Array.isArray(rawList)) return [];
        var out = [];
        for (var i = 0; i < rawList.length; i++) {
            var spec = normalizeSolidSpec(rawList[i]);
            if (spec) out.push(spec);
        }
        return out;
    }

    function buildDefaultSolidSpecs() {
        if (WORLD_LAYOUT && WORLD_LAYOUT.buildSolidSpecs) {
            return WORLD_LAYOUT.buildSolidSpecs({
                areaScale: WORLD_AREA_SCALE,
                worldSize: WORLD_SIZE,
                margin: WORLD_MARGIN,
                min: WORLD_MIN,
                max: WORLD_MAX,
                center: WORLD_CENTER,
                seed: WORLD_SEED,
                chunkSize: chunkSize,
                interestRadiusChunks: interestRadiusChunks
            });
        }

        var solids = [];
        function add(x, y, z, w, h, d, kind) {
            solids.push({ x: x, y: y, z: z, w: w, h: h, d: d, kind: kind || '' });
        }
        function px(value) { return scaleAxis(value); }
        function span(value) { return scaleSpan(value); }

        var coreCoverLayout = WORLD_PRIM.core_cover_layout || [];
        if (coreCoverLayout.length > 0) {
            for (var c = 0; c < coreCoverLayout.length; c++) {
                var cc = coreCoverLayout[c];
                add(px(cc[0]), cc[1], px(cc[2]), span(cc[3]), cc[4], span(cc[5]), 'core');
            }
        } else {
            add(px(25), 1.5, px(25), span(4), 3, span(1), 'core');
            add(px(25), 1.5, px(27), span(1), 3, span(3), 'core');
            add(px(25), 1.5, px(23), span(1), 3, span(3), 'core');
        }

        var edgeStep = Math.max(2, Math.round(WORLD_SIZE / 30));
        var edge;
        for (edge = WORLD_MIN + 1; edge <= WORLD_MAX - 1; edge += edgeStep) {
            var northHeight = 2 + ((edge % (edgeStep * 3) === 0) ? 1 : 0) + ((edge % (edgeStep * 5) === 0) ? 1 : 0);
            var southHeight = 2 + ((edge % (edgeStep * 4) === 0) ? 1 : 0);
            add(edge, northHeight / 2, WORLD_MIN + 0.8, edgeStep * 0.92, northHeight, 1.2, 'barrier');
            add(edge, southHeight / 2, WORLD_MAX - 0.8, edgeStep * 0.92, southHeight, 1.2, 'barrier');
        }

        for (edge = WORLD_MIN + 1; edge <= WORLD_MAX - 1; edge += edgeStep) {
            var westHeight = 2 + ((edge % (edgeStep * 4) === 0) ? 1 : 0);
            var eastHeight = 2 + ((edge % (edgeStep * 3) === 0) ? 1 : 0);
            add(WORLD_MIN + 0.8, westHeight / 2, edge, 1.2, westHeight, edgeStep * 0.92, 'barrier');
            add(WORLD_MAX - 0.8, eastHeight / 2, edge, 1.2, eastHeight, edgeStep * 0.92, 'barrier');
        }

        return solids;
    }

    function randRange(min, max) {
        return min + random01() * (max - min);
    }

    function intersectsXZ(x, z, radius, box) {
        var closestX = Math.max(box.min.x, Math.min(x, box.max.x));
        var closestZ = Math.max(box.min.z, Math.min(z, box.max.z));
        var dx = x - closestX;
        var dz = z - closestZ;
        return ((dx * dx + dz * dz) < (radius * radius));
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function collectCapsuleOverlaps(x, z, feetY, height, radius) {
        var out = [];
        if (!collidables || collidables.length === 0) return out;

        feetY = (typeof feetY === 'number') ? feetY : 0;
        height = (typeof height === 'number') ? height : DEFAULT_ENTITY_HEIGHT;
        radius = (typeof radius === 'number') ? radius : DEFAULT_ENTITY_RADIUS;
        var headY = feetY + height;

        for (var i = 0; i < collidables.length; i++) {
            var mesh = collidables[i];
            var box = mesh && mesh.userData ? mesh.userData.collisionBox : null;
            if (!box) continue;
            if (headY <= box.min.y + EPSILON || feetY >= box.max.y - EPSILON) continue;
            if (!intersectsXZ(x, z, radius, box)) continue;
            out.push(box);
        }

        return out;
    }

    function separationFromBox(x, z, radius, box) {
        var closestX = clamp(x, box.min.x, box.max.x);
        var closestZ = clamp(z, box.min.z, box.max.z);
        var dx = x - closestX;
        var dz = z - closestZ;
        var distSq = dx * dx + dz * dz;
        var pad = 0.002;

        if (distSq > 1e-8) {
            var dist = Math.sqrt(distSq);
            var overlap = (radius - dist) + pad;
            if (overlap <= 0) return { x: 0, z: 0 };
            return { x: (dx / dist) * overlap, z: (dz / dist) * overlap };
        }

        var toMinX = Math.abs(x - box.min.x);
        var toMaxX = Math.abs(box.max.x - x);
        var toMinZ = Math.abs(z - box.min.z);
        var toMaxZ = Math.abs(box.max.z - z);

        var min = toMinX;
        var axis = 'xMin';
        if (toMaxX < min) { min = toMaxX; axis = 'xMax'; }
        if (toMinZ < min) { min = toMinZ; axis = 'zMin'; }
        if (toMaxZ < min) { min = toMaxZ; axis = 'zMax'; }

        if (axis === 'xMin') return { x: -(radius + toMinX + pad), z: 0 };
        if (axis === 'xMax') return { x: (radius + toMaxX + pad), z: 0 };
        if (axis === 'zMin') return { x: 0, z: -(radius + toMinZ + pad) };
        return { x: 0, z: (radius + toMaxZ + pad) };
    }

    function resolveCapsulePenetrationState(state, options) {
        options = options || {};
        var x = (typeof state.x === 'number') ? state.x : WORLD_CENTER;
        var z = (typeof state.z === 'number') ? state.z : WORLD_CENTER;
        var feetY = (typeof state.feetY === 'number') ? state.feetY : 0;
        var height = (typeof state.height === 'number') ? state.height : DEFAULT_ENTITY_HEIGHT;
        var radius = (typeof state.radius === 'number') ? state.radius : DEFAULT_ENTITY_RADIUS;
        var maxIterations = Math.max(1, Math.floor(options.maxIterations || 8));
        var minBound = WORLD_MIN + radius;
        var maxBound = WORLD_MAX - radius;
        var movedDistance = 0;

        var overlaps = collectCapsuleOverlaps(x, z, feetY, height, radius);
        var hadOverlap = overlaps.length > 0;

        for (var iter = 0; iter < maxIterations && overlaps.length > 0; iter++) {
            var movedThisIter = 0;
            for (var i = 0; i < overlaps.length; i++) {
                var sep = separationFromBox(x, z, radius, overlaps[i]);
                x += sep.x;
                z += sep.z;
                movedThisIter += Math.sqrt((sep.x * sep.x) + (sep.z * sep.z));
            }

            x = clamp(x, minBound, maxBound);
            z = clamp(z, minBound, maxBound);
            movedDistance += movedThisIter;
            overlaps = collectCapsuleOverlaps(x, z, feetY, height, radius);

            if (movedThisIter <= 0.0001) break;
        }

        return {
            x: x,
            z: z,
            feetY: feetY,
            hadOverlap: hadOverlap,
            resolved: overlaps.length === 0,
            overlapCount: overlaps.length,
            movedDistance: movedDistance
        };
    }

    function isCapsuleBlockedAt(x, z, feetY, height, radius) {
        if (!collidables || collidables.length === 0) return false;
        feetY = (typeof feetY === 'number') ? feetY : 0;
        height = (typeof height === 'number') ? height : DEFAULT_ENTITY_HEIGHT;
        radius = (typeof radius === 'number') ? radius : DEFAULT_ENTITY_RADIUS;
        var headY = feetY + height;

        for (var i = 0; i < collidables.length; i++) {
            var mesh = collidables[i];
            var box = mesh && mesh.userData ? mesh.userData.collisionBox : null;
            if (!box) continue;
            if (headY <= box.min.y + EPSILON || feetY >= box.max.y - EPSILON) continue;
            if (intersectsXZ(x, z, radius, box)) return true;
        }
        return false;
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

    function randomSafeSpawnPoint(options) {
        options = options || {};
        var tries = Math.max(1, Math.floor(options.tries || 60));
        var pad = (typeof options.padding === 'number') ? options.padding : DEFAULT_SPAWN_PADDING;
        var feetY = (typeof options.feetY === 'number') ? options.feetY : 0;
        var height = (typeof options.height === 'number') ? options.height : DEFAULT_ENTITY_HEIGHT;
        var radius = (typeof options.radius === 'number') ? options.radius : DEFAULT_ENTITY_RADIUS;

        for (var i = 0; i < tries; i++) {
            var p = randomSpawnPoint(pad);
            if (!isCapsuleBlockedAt(p.x, p.z, feetY, height, radius)) return p;
        }

        var fallback = randomSpawnPoint(pad);
        return fallback;
    }

    function validateSpawnState(state) {
        var x = (typeof state.x === 'number') ? state.x : WORLD_CENTER;
        var z = (typeof state.z === 'number') ? state.z : WORLD_CENTER;
        var feetY = (typeof state.feetY === 'number') ? state.feetY : 0;
        var height = (typeof state.height === 'number') ? state.height : DEFAULT_ENTITY_HEIGHT;
        var radius = (typeof state.radius === 'number') ? state.radius : DEFAULT_ENTITY_RADIUS;
        var minBound = WORLD_MIN + radius;
        var maxBound = WORLD_MAX - radius;
        var overlapCount = collectCapsuleOverlaps(x, z, feetY, height, radius).length;

        return {
            valid: overlapCount === 0 && x >= minBound && x <= maxBound && z >= minBound && z <= maxBound,
            overlapCount: overlapCount,
            inBounds: x >= minBound && x <= maxBound && z >= minBound && z <= maxBound
        };
    }

    function safeSpawnPoint(options) {
        options = options || {};
        var pad = (typeof options.padding === 'number') ? options.padding : DEFAULT_SPAWN_PADDING;
        var tries = Math.max(1, Math.floor(options.tries || 60));
        var feetY = (typeof options.feetY === 'number') ? options.feetY : 0;
        var height = (typeof options.height === 'number') ? options.height : DEFAULT_ENTITY_HEIGHT;
        var radius = (typeof options.radius === 'number') ? options.radius : DEFAULT_ENTITY_RADIUS;

        for (var i = 0; i < tries; i++) {
            var p = randomSpawnPoint(pad);
            var resolved = resolveCapsulePenetrationState({
                x: p.x,
                z: p.z,
                feetY: feetY,
                height: height,
                radius: radius
            }, { maxIterations: 12 });
            var check = validateSpawnState({
                x: resolved.x,
                z: resolved.z,
                feetY: feetY,
                height: height,
                radius: radius
            });
            if (check.valid) {
                return { x: resolved.x, z: resolved.z };
            }
        }

        var fallback = randomSafeSpawnPoint({
            padding: pad,
            tries: tries,
            feetY: feetY,
            height: height,
            radius: radius
        });
        var resolvedFallback = resolveCapsulePenetrationState({
            x: fallback.x,
            z: fallback.z,
            feetY: feetY,
            height: height,
            radius: radius
        }, { maxIterations: 16 });
        return { x: resolvedFallback.x, z: resolvedFallback.z };
    }

    function createLocalManifest() {
        applyWorldConfig(null);
        var solids = buildDefaultSolidSpecs();
        return {
            version: 1,
            seed: WORLD_SEED,
            size: WORLD_SIZE,
            center: WORLD_CENTER,
            margin: WORLD_MARGIN,
            min: WORLD_MIN,
            max: WORLD_MAX,
            areaScale: WORLD_AREA_SCALE,
            chunkSize: chunkSize,
            interestRadiusChunks: interestRadiusChunks,
            chunkStreaming: false,
            solidBoxes: solids
        };
    }

    function removeCollidableMesh(mesh) {
        for (var i = collidables.length - 1; i >= 0; i--) {
            if (collidables[i] === mesh) {
                collidables.splice(i, 1);
            }
        }
    }

    function removeChunkByKey(key) {
        var entry = chunkStore.get(key);
        if (!entry) return;
        var meshes = entry.meshes || [];
        for (var i = 0; i < meshes.length; i++) {
            var mesh = meshes[i];
            if (mesh && mesh.parent) mesh.parent.remove(mesh);
            removeCollidableMesh(mesh);
        }
        chunkStore.delete(key);
    }

    function solidMaterialForKind(kind) {
        if (!chunkMaterialPalette) {
            return new THREE.MeshLambertMaterial({ color: 0x8b7355 });
        }
        if (kind === 'core') {
            var coreMats = chunkMaterialPalette.core || [];
            if (coreMats.length > 0) {
                var idx = Number(chunkMaterialPalette._coreMatCursor || 0) % coreMats.length;
                chunkMaterialPalette._coreMatCursor = idx + 1;
                return coreMats[idx];
            }
        }
        if (kind === 'barrier' && chunkMaterialPalette.barrier) return chunkMaterialPalette.barrier;
        if (chunkMaterialPalette.cover) return chunkMaterialPalette.cover;
        return chunkMaterialPalette.defaultMat || new THREE.MeshLambertMaterial({ color: 0x8b7355 });
    }

    function createSolidMesh(spec, scene) {
        var geo = new THREE.BoxGeometry(spec.w, spec.h, spec.d);
        var mesh = new THREE.Mesh(geo, solidMaterialForKind(String(spec.kind || '')));
        mesh.position.set(spec.x, spec.y, spec.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        mesh.updateMatrixWorld(true);
        mesh.userData.collisionBox = new THREE.Box3().setFromObject(mesh);
        collidables.push(mesh);
        return mesh;
    }

    function normalizeChunkSnapshot(rawChunk) {
        if (!rawChunk || typeof rawChunk !== 'object') return null;
        var key = String(rawChunk.key || '');
        if (!key) return null;
        var version = Number(rawChunk.version || 1);
        if (!isFinite(version)) version = 1;
        var solids = normalizeSolidSpecs(rawChunk.solids || []);
        return {
            key: key,
            version: version,
            solids: solids,
            decor: Array.isArray(rawChunk.decor) ? rawChunk.decor.slice() : [],
            blockers: Array.isArray(rawChunk.blockers) ? rawChunk.blockers.slice() : [],
            nav: Array.isArray(rawChunk.nav) ? rawChunk.nav.slice() : []
        };
    }

    function applyChunkSnapshotInternal(rawChunk) {
        if (!sceneRef) return false;
        var chunk = normalizeChunkSnapshot(rawChunk);
        if (!chunk) return false;

        removeChunkByKey(chunk.key);
        var meshes = [];
        for (var i = 0; i < chunk.solids.length; i++) {
            meshes.push(createSolidMesh(chunk.solids[i], sceneRef));
        }
        chunkStore.set(chunk.key, {
            key: chunk.key,
            version: chunk.version,
            meshes: meshes
        });
        return true;
    }

    GameWorld.create = function (scene, manifest) {
        if (!manifest || typeof manifest !== 'object') {
            throw new Error('World manifest is required.');
        }
        applyWorldConfig(manifest);
        sceneRef = scene;
        collidables = [];
        chunkStore.clear();
        chunkStreamingEnabled = !!manifest.chunkStreaming;
        if (typeof manifest.chunkSize === 'number' && isFinite(manifest.chunkSize)) {
            chunkSize = Math.max(4, Math.floor(manifest.chunkSize));
        }
        if (typeof manifest.interestRadiusChunks === 'number' && isFinite(manifest.interestRadiusChunks)) {
            interestRadiusChunks = Math.max(1, Math.floor(manifest.interestRadiusChunks));
        }
        var authoritativeSolids = normalizeSolidSpecs(manifest.solidBoxes);

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
            addBlock(x, trunkHeight / 2, z, 1, trunkHeight, 1, trunkMat, false);
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
                addBlock(x, 0.35, z, 3, 0.7, 1, logMat, false);
            } else {
                addBlock(x, 0.35, z, 1, 0.7, 3, logMat, false);
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

        var gridSegments = Math.max(40, Math.round(WORLD_SIZE));
        var gridHelper = new THREE.GridHelper(WORLD_SIZE, gridSegments, 0x2a5d2a, 0x2a5d2a);
        gridHelper.position.set(WORLD_CENTER, 0.01, WORLD_CENTER);
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
        chunkMaterialPalette = {
            core: [stoneMat, blockMat, brickMat],
            barrier: dirtMat,
            cover: dirtMat,
            defaultMat: blockMat,
            _coreMatCursor: 0
        };

        // Authoritative solid cover/barrier geometry (server manifest in net mode).
        var coreMats = [stoneMat, blockMat, brickMat];
        var manifestSolids = authoritativeSolids;
        var coreMatIndex = 0;
        if (chunkStreamingEnabled) {
            var initialChunks = Array.isArray(manifest.initialChunks) ? manifest.initialChunks : [];
            for (var c = 0; c < initialChunks.length; c++) {
                applyChunkSnapshotInternal(initialChunks[c]);
            }
        } else {
            if (!manifestSolids || manifestSolids.length === 0) {
                throw new Error('World manifest has no solid geometry.');
            }
            for (var s = 0; s < manifestSolids.length; s++) {
                var solid = manifestSolids[s];
                var solidKind = String(solid.kind || '');
                var solidMat = dirtMat;
                if (solidKind === 'core') {
                    solidMat = coreMats[coreMatIndex % coreMats.length];
                    coreMatIndex++;
                }
                addBlock(solid.x, solid.y, solid.z, solid.w, solid.h, solid.d, solidMat, true);
            }
        }

        // Edge walls slightly below the arena so the map feels grounded.
        addBlock(WORLD_CENTER, -1.5, 0, WORLD_SIZE, 3, 1, cliffMat, false);
        addBlock(WORLD_CENTER, -1.5, WORLD_SIZE, WORLD_SIZE, 3, 1, cliffMat, false);
        addBlock(0, -1.5, WORLD_CENTER, 1, 3, WORLD_SIZE, cliffMat, false);
        addBlock(WORLD_SIZE, -1.5, WORLD_CENTER, 1, 3, WORLD_SIZE, cliffMat, false);

        // Dense border trees.
        var borderStep = Math.max(7, Math.round(WORLD_SIZE / 12));
        var borderOffset = 2.8;
        var rowToggle = 0;
        var edge;
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

    GameWorld.isChunkStreaming = function () {
        return !!chunkStreamingEnabled;
    };

    GameWorld.getChunkConfig = function () {
        return {
            chunkSize: chunkSize,
            interestRadiusChunks: interestRadiusChunks
        };
    };

    GameWorld.applyChunkSnapshot = function (chunkSnapshot) {
        if (!chunkStreamingEnabled) return false;
        return applyChunkSnapshotInternal(chunkSnapshot);
    };

    GameWorld.applyChunkDelta = function (delta) {
        if (!chunkStreamingEnabled || !delta || typeof delta !== 'object') return false;
        var key = String(delta.key || '');
        if (!key) return false;
        if (delta.op === 'remove') {
            removeChunkByKey(key);
            return true;
        }
        if (delta.chunk && typeof delta.chunk === 'object') {
            return applyChunkSnapshotInternal(delta.chunk);
        }
        if (Array.isArray(delta.solids)) {
            return applyChunkSnapshotInternal({
                key: key,
                version: Number(delta.version || 1),
                solids: delta.solids
            });
        }
        return false;
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

    GameWorld.getRandomSpawnPointSafe = function (options) {
        return safeSpawnPoint(options);
    };

    GameWorld.isPointBlocked = function (x, z, options) {
        options = options || {};
        return isCapsuleBlockedAt(
            x,
            z,
            (typeof options.feetY === 'number') ? options.feetY : 0,
            (typeof options.height === 'number') ? options.height : DEFAULT_ENTITY_HEIGHT,
            (typeof options.radius === 'number') ? options.radius : DEFAULT_ENTITY_RADIUS
        );
    };

    GameWorld.resolveCapsulePenetration = function (state, options) {
        return resolveCapsulePenetrationState(state || {}, options || {});
    };

    GameWorld.validateSpawn = function (state) {
        return validateSpawnState(state || {});
    };

    GameWorld.getSafeSpawn = function (options) {
        return safeSpawnPoint(options || {});
    };

    GameWorld.getRecommendedEnemyCount = function () {
        return Math.max(8, Math.round(5 * Math.sqrt(WORLD_AREA_SCALE)));
    };

    GameWorld.getSeed = function () {
        return WORLD_SEED;
    };

    GameWorld.getLocalManifest = function () {
        return createLocalManifest();
    };

    GameWorld.setSeed = function (seedText) {
        setSeed(seedText);
        return WORLD_SEED;
    };

    window.GameWorld = GameWorld;
})();
