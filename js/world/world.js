import { chooseSpawnPoint } from '../../shared/spawn-logic.js';
import {
    compileCylinderColliderBoxes,
    compileDomeColliderBoxes,
    compileSphereColliderBoxes
} from '../../shared/collider-authoring.js';

/**
 * world.js - Static authored world layout for open-arena combat.
 * Biome content is provided by plug-and-play quadrant modules in js/world/.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameWorld
 */
(function () {
    'use strict';

    var GameWorld = {};

    function sharedApi() {
        return (globalThis.__MAYHEM_RUNTIME && globalThis.__MAYHEM_RUNTIME.GameShared) || {};
    }

    function sharedProtocol() {
        return sharedApi().protocol || null;
    }

    function sharedWorldConfig() {
        var protocol = sharedProtocol();
        return (protocol && protocol.world) ? protocol.world : null;
    }

    function sharedLayout() {
        return sharedApi().worldLayout || null;
    }

    var BASE_WORLD_SIZE = 32;
    var WORLD_AREA_SCALE = 1;
    var WORLD_SIZE = 32;
    var WORLD_CENTER = 16;
    var WORLD_MARGIN = 0;
    var WORLD_MIN = 0;
    var WORLD_MAX = 32;
    var DEFAULT_SPAWN_PADDING = 2;

    var BIOME_ARCTIC = 'arctic';
    var BIOME_URBAN = 'urban';
    var BIOME_DESERT = 'desert';
    var BIOME_JUNGLE = 'jungle';
    var BIOME_NUCLEAR = 'nuclear';
    var BIOME_CITADEL = 'citadel';
    var BIOME_QUARRY = 'quarry';
    var BIOME_WALL_STREET = 'wall-street';
    var BIOME_RADAR = 'radar';

    var DEFAULT_QUADRANT_MAP = [];

    var DEFAULT_WORLD_PROFILE_VERSION = 6;
    var DEFAULT_WORLD_FLAGS = {
        envV2: true,
        terrainPhysicsV2: true
    };

    var WORLD_PROFILE_VERSION = DEFAULT_WORLD_PROFILE_VERSION;
    var WORLD_FLAGS = cloneWorldFlags(DEFAULT_WORLD_FLAGS);
    var WORLD_SEED = 'room-env-v6-static-global';
    var worldConfigInitialized = false;

    var terrainSampler = null;
    var collidables = [];
    var spawnExclusionZones = [];
    var generationStats = null;
    var activeScene = null;
    var worldSceneObjects = [];
    var boxGeometryCache = {};
    var colliderMaterial = null;

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
    GROUND_COLORS[BIOME_CITADEL] = 0xf6f2ea;
    GROUND_COLORS[BIOME_QUARRY] = 0x8a6f5f;
    GROUND_COLORS[BIOME_WALL_STREET] = 0x6a6258;
    GROUND_COLORS[BIOME_RADAR] = 0x1a6b8a;
    GROUND_COLORS['volcano'] = 0x2a2a2a;
    GROUND_COLORS['whoville'] = 0xf0f5ff;

    function groundColorForBiome(biomeId) {
        if (Object.prototype.hasOwnProperty.call(GROUND_COLORS, biomeId)) {
            return GROUND_COLORS[biomeId];
        }
        return GROUND_COLORS[BIOME_JUNGLE];
    }

    function cloneWorldFlags(flags) {
        return {
            envV2: !!(flags && flags.envV2),
            terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
        };
    }

    function refreshSharedWorldConfig() {
        var layout = sharedLayout();
        if (layout) {
            BASE_WORLD_SIZE = Number(layout.BASE_WORLD_SIZE || BASE_WORLD_SIZE);
            WORLD_AREA_SCALE = Number(layout.WORLD_AREA_SCALE || WORLD_AREA_SCALE);
            WORLD_SIZE = Number(layout.WORLD_SIZE || WORLD_SIZE);
            WORLD_CENTER = Number(layout.WORLD_CENTER || WORLD_CENTER);
            WORLD_MARGIN = Number(layout.WORLD_MARGIN || WORLD_MARGIN);
            WORLD_MIN = Number(layout.WORLD_MIN || WORLD_MIN);
            WORLD_MAX = Number(layout.WORLD_MAX || WORLD_MAX);
            DEFAULT_SPAWN_PADDING = Number(layout.DEFAULT_SPAWN_PADDING || DEFAULT_SPAWN_PADDING);
            BIOME_ARCTIC = String(layout.BIOME_ARCTIC || BIOME_ARCTIC);
            BIOME_URBAN = String(layout.BIOME_URBAN || BIOME_URBAN);
            BIOME_DESERT = String(layout.BIOME_DESERT || BIOME_DESERT);
            BIOME_JUNGLE = String(layout.BIOME_JUNGLE || BIOME_JUNGLE);
            BIOME_NUCLEAR = String(layout.BIOME_NUCLEAR || BIOME_NUCLEAR);
            BIOME_CITADEL = String(layout.BIOME_CITADEL || BIOME_CITADEL);
            BIOME_QUARRY = String(layout.BIOME_QUARRY || BIOME_QUARRY);
            BIOME_WALL_STREET = String(layout.BIOME_WALL_STREET || BIOME_WALL_STREET);
            BIOME_RADAR = String(layout.BIOME_RADAR || BIOME_RADAR);
            DEFAULT_QUADRANT_MAP = Array.isArray(layout.DEFAULT_QUADRANT_MAP) ? layout.DEFAULT_QUADRANT_MAP.slice() : DEFAULT_QUADRANT_MAP;
        }

        var config = sharedWorldConfig();
        if (config) {
            DEFAULT_WORLD_PROFILE_VERSION = Math.max(1, Math.round(Number(config.profileVersion) || DEFAULT_WORLD_PROFILE_VERSION));
            DEFAULT_WORLD_FLAGS = {
                envV2: config.flags ? !!config.flags.envV2 : true,
                terrainPhysicsV2: config.flags ? !!config.flags.terrainPhysicsV2 : true
            };
            if (!worldConfigInitialized) {
                WORLD_PROFILE_VERSION = DEFAULT_WORLD_PROFILE_VERSION;
                WORLD_FLAGS = cloneWorldFlags(DEFAULT_WORLD_FLAGS);
                WORLD_SEED = String(config.seedPrefix || 'room-env-v6-static') + '-global';
                worldConfigInitialized = true;
            }
        }
    }

    function requireSharedLayout() {
        refreshSharedWorldConfig();
        var layout = sharedLayout();
        if (!layout) {
            throw new Error('GameWorld requires GameShared.worldLayout before world creation.');
        }
        return layout;
    }

    function normalizeWorldMeta(rawMeta) {
        refreshSharedWorldConfig();
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
        return requireSharedLayout().quadrantBounds(quadrant);
    }

    function boxGeometryKey(w, h, d) {
        return [Number(w || 0), Number(h || 0), Number(d || 0)].join('|');
    }

    function getSharedBoxGeometry(w, h, d) {
        var key = boxGeometryKey(w, h, d);
        if (boxGeometryCache[key]) return boxGeometryCache[key];
        var geometry = new THREE.BoxGeometry(w, h, d);
        geometry.userData = geometry.userData || {};
        geometry.userData.__mayhemSharedGeometry = true;
        boxGeometryCache[key] = geometry;
        return geometry;
    }

    function trackWorldObject(object) {
        if (!object) return object;
        worldSceneObjects.push(object);
        return object;
    }

    function addTrackedObject(targetScene, object) {
        if (!object) return object;
        targetScene.add(object);
        return trackWorldObject(object);
    }

    function getColliderMaterial() {
        if (colliderMaterial) return colliderMaterial;
        colliderMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        colliderMaterial.userData = colliderMaterial.userData || {};
        colliderMaterial.userData.__mayhemSharedMaterial = true;
        return colliderMaterial;
    }

    function geometryLocalBounds(geometry) {
        if (!geometry) return null;
        if (!geometry.boundingBox) {
            if (typeof geometry.computeBoundingBox === 'function') {
                geometry.computeBoundingBox();
            } else if (
                typeof geometry.width === 'number' &&
                typeof geometry.height === 'number' &&
                typeof geometry.depth === 'number'
            ) {
                geometry.boundingBox = new THREE.Box3(
                    new THREE.Vector3(-geometry.width * 0.5, -geometry.height * 0.5, -geometry.depth * 0.5),
                    new THREE.Vector3(geometry.width * 0.5, geometry.height * 0.5, geometry.depth * 0.5)
                );
            } else if (typeof geometry.radius === 'number') {
                var radius = Math.max(0.001, Number(geometry.radius || 0));
                geometry.boundingBox = new THREE.Box3(
                    new THREE.Vector3(-radius, -radius, -radius),
                    new THREE.Vector3(radius, radius, radius)
                );
            }
        }
        return geometry.boundingBox || null;
    }

    function markDecorSolid(mesh) {
        if (!mesh || !mesh.geometry) return false;
        if (mesh.geometry.userData && mesh.geometry.userData.collisionDisabled) return false;
        var localBounds = geometryLocalBounds(mesh.geometry);
        if (!localBounds) return false;
        mesh.updateMatrixWorld(true);
        var worldBounds = localBounds.clone();
        worldBounds.applyMatrix4(mesh.matrixWorld);
        mesh.userData = mesh.userData || {};
        mesh.userData.collisionBox = worldBounds;
        collidables.push(mesh);
        return true;
    }

    function disposeObjectGeometry(object, disposedGeometries) {
        if (!object || !object.geometry || typeof object.geometry.dispose !== 'function') return;
        if (object.geometry.userData && object.geometry.userData.__mayhemSharedGeometry) return;
        if (disposedGeometries.indexOf(object.geometry) !== -1) return;
        disposedGeometries.push(object.geometry);
        object.geometry.dispose();
    }

    function disposeObjectMaterial(object, disposedMaterials) {
        if (!object || !object.material) return;
        var materials = Array.isArray(object.material) ? object.material : [object.material];
        for (var i = 0; i < materials.length; i++) {
            var material = materials[i];
            if (!material || typeof material.dispose !== 'function') continue;
            if (material.userData && material.userData.__mayhemSharedMaterial) continue;
            if (disposedMaterials.indexOf(material) !== -1) continue;
            disposedMaterials.push(material);
            material.dispose();
        }
    }

    function clearWorldScene() {
        if (!activeScene || !worldSceneObjects.length) return;
        var disposedGeometries = [];
        var disposedMaterials = [];
        for (var i = 0; i < worldSceneObjects.length; i++) {
            var root = worldSceneObjects[i];
            if (!root) continue;
            root.traverse(function (object) {
                disposeObjectGeometry(object, disposedGeometries);
                disposeObjectMaterial(object, disposedMaterials);
            });
            if (root.parent) {
                root.parent.remove(root);
            } else {
                activeScene.remove(root);
            }
        }
        worldSceneObjects = [];
        activeScene = null;
    }

    function biomeAt(x, z) {
        return requireSharedLayout().biomeAtPosition(x, z, DEFAULT_QUADRANT_MAP);
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
        refreshSharedWorldConfig();
        var layout = requireSharedLayout();
        clearWorldScene();
        activeScene = scene;

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

        function applyColliderUserData(mesh, spec, primitive, sliceIndex, sliceCount) {
            if (!mesh) return mesh;
            mesh.userData = mesh.userData || {};
            mesh.userData.collisionAuthoring = true;
            mesh.userData.collisionPrimitive = String(primitive || '');
            mesh.userData.collisionSliceIndex = Math.max(0, Number(sliceIndex || 0));
            mesh.userData.collisionSliceCount = Math.max(1, Number(sliceCount || 1));
            if (spec && spec.role) mesh.userData.role = String(spec.role);
            if (spec && spec.collisionGroup) mesh.userData.collisionGroup = String(spec.collisionGroup);
            var meta = spec && spec.meta && typeof spec.meta === 'object' ? spec.meta : null;
            if (meta) {
                for (var key in meta) {
                    mesh.userData[key] = meta[key];
                }
            }
            return mesh;
        }

        function addColliderBoxes(boxes, spec, primitive) {
            var out = [];
            for (var i = 0; i < boxes.length; i++) {
                var box = boxes[i];
                if (!box) continue;
                var mesh = new THREE.Mesh(
                    getSharedBoxGeometry(box.w, box.h, box.d),
                    getColliderMaterial()
                );
                mesh.position.set(box.x, box.y, box.z);
                mesh.visible = false;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                applyColliderUserData(mesh, spec, primitive, i, boxes.length);
                markSolid(mesh);
                out.push(mesh);
            }
            return out;
        }

        function addBlock(x, y, z, w, h, d, material, isSolid) {
            var geo = getSharedBoxGeometry(w, h, d);
            var mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            addTrackedObject(scene, mesh);
            void isSolid;
            markSolid(mesh);
            return mesh;
        }

        function addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid) {
            var geo = getSharedBoxGeometry(w, h, d);
            var mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, y, z);
            mesh.rotation.y = rotY || 0;
            mesh.rotation.x = tiltX || 0;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            addTrackedObject(scene, mesh);
            void isSolid;
            markSolid(mesh);
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
            addTrackedObject(scene, mesh);
            markDecorSolid(mesh);
            return mesh;
        }

        function addCylinderCollider(spec) {
            return addColliderBoxes(compileCylinderColliderBoxes(spec || {}), spec || {}, 'cylinder');
        }

        function addDomeCollider(spec) {
            return addColliderBoxes(compileDomeColliderBoxes(spec || {}), spec || {}, 'dome');
        }

        function addSphereCollider(spec) {
            return addColliderBoxes(compileSphereColliderBoxes(spec || {}), spec || {}, 'sphere');
        }

        function addBoxCollider(spec) {
            spec = spec || {};
            return addColliderBoxes([{
                x: Number(spec.x || 0),
                y: Number(spec.y || 0),
                z: Number(spec.z || 0),
                w: Number(spec.w || 0),
                h: Number(spec.h || 0),
                d: Number(spec.d || 0)
            }], spec, 'box');
        }

        var place = {
            addBlock: addBlock,
            addRamp: addRamp,
            addDecor: addDecor,
            addBoxCollider: addBoxCollider,
            addCylinderCollider: addCylinderCollider,
            addDomeCollider: addDomeCollider,
            addSphereCollider: addSphereCollider
        };

        var quadrantCtx = {
            scene: {
                add: function (object) {
                    return addTrackedObject(scene, object);
                }
            },
            addExclusion: function (x, z, r) { addSpawnExclusionCircle(x, z, r); },
            addWaterfallSheet: function (data) { animatedWaterfallSheets.push(data); },
            addMistCard: function (data) { animatedMistCards.push(data); },
            addLeafSway: function (data) { animatedLeaves.push(data); },
            addIceShimmer: function (data) { animatedIceShimmers.push(data); },
            addFlicker: function (data) { animatedFlickers.push(data); },
            addSteamColumn: function (data) { animatedSteamColumns.push(data); }
        };

        var matLib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;

        // --- Ground plane split per biome cell to keep edges crisp ---
        for (var gi = 0; gi < DEFAULT_QUADRANT_MAP.length; gi++) {
            var groundEntry = DEFAULT_QUADRANT_MAP[gi];
            if (!groundEntry) continue;
            var groundBounds = quadrantBounds(groundEntry.quadrant);
            var groundWidth = Math.max(0.01, Number(groundBounds.maxX - groundBounds.minX) || 0.01);
            var groundDepth = Math.max(0.01, Number(groundBounds.maxZ - groundBounds.minZ) || 0.01);
            var groundSegX = Math.max(16, Math.round(groundWidth * 1.15));
            var groundSegZ = Math.max(16, Math.round(groundDepth * 1.15));
            var groundCenterX = (groundBounds.minX + groundBounds.maxX) * 0.5;
            var groundCenterZ = (groundBounds.minZ + groundBounds.maxZ) * 0.5;
            var groundGeo = new THREE.PlaneGeometry(groundWidth, groundDepth, groundSegX, groundSegZ);
            groundGeo.rotateX(-Math.PI / 2);
            groundGeo.translate(groundCenterX, 0, groundCenterZ);

            var groundPos = groundGeo.attributes.position;
            for (var vi = 0; vi < groundPos.count; vi++) {
                var gx = groundPos.getX(vi);
                var gz = groundPos.getZ(vi);
                groundPos.setY(vi, getGroundHeightAt(gx, gz));
            }

            groundPos.needsUpdate = true;
            groundGeo.computeVertexNormals();

            var ground = new THREE.Mesh(
                groundGeo,
                matLib.getLambert({ color: groundColorForBiome(groundEntry.biome) })
            );
            ground.receiveShadow = true;
            ground.userData = ground.userData || {};
            ground.userData.isBiomeGround = true;
            ground.userData.biome = groundEntry.biome;
            ground.userData.cell = groundEntry.quadrant;
            addTrackedObject(scene, ground);
        }

        // Abyss plane far below to hide the void.
        var lowerGroundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 3, WORLD_SIZE * 3);
        var lowerGroundMat = matLib.getLambert({ color: 0x1a2a20 });
        var lowerGround = new THREE.Mesh(lowerGroundGeo, lowerGroundMat);
        lowerGround.rotation.x = -Math.PI / 2;
        lowerGround.position.set(WORLD_CENTER, -6, WORLD_CENTER);
        lowerGround.receiveShadow = true;
        addTrackedObject(scene, lowerGround);

        // --- Biome-themed perimeter walls ---
        (function buildBiomeWalls() {
            layout.buildBiomePerimeter(place, {
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
                citadelBase: matLib.getLambert({ color: 0xf0ebe2 }),
                citadelAccent: matLib.getLambert({ color: 0xffffff }),
                citadelDetail: matLib.getLambert({ color: 0xd5cabd }),
                quarryBase: matLib.getLambert({ color: 0x866f61 }),
                quarryAccent: matLib.getLambert({ color: 0xb39984 }),
                quarryDetail: matLib.getLambert({ color: 0x5e4c40 }),
                wallStreetBase: matLib.getLambert({ color: 0x69757b }),
                wallStreetAccent: matLib.getLambert({ color: 0x5aa1b7 }),
                wallStreetDetail: matLib.getLambert({ color: 0x355965 }),
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
        addTrackedObject(scene, new THREE.AmbientLight(0x6a7584, 0.94));

        var dirLight = new THREE.DirectionalLight(0xfff4d8, 1.12);
        dirLight.position.set(WORLD_CENTER + (WORLD_SIZE * 0.22), WORLD_SIZE * 0.95, WORLD_CENTER - (WORLD_SIZE * 0.12));
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = WORLD_SIZE * 2.2;
        dirLight.shadow.camera.left = -WORLD_SIZE * 0.75;
        dirLight.shadow.camera.right = WORLD_SIZE * 0.75;
        dirLight.shadow.camera.top = WORLD_SIZE * 0.75;
        dirLight.shadow.camera.bottom = -WORLD_SIZE * 0.75;
        dirLight.shadow.bias = -0.0002;
        dirLight.shadow.normalBias = 0.02;
        dirLight.target.position.set(WORLD_CENTER, 0, WORLD_CENTER);
        addTrackedObject(scene, dirLight.target);
        addTrackedObject(scene, dirLight);

        (function addVisibleSun() {
            var sunDirection = new THREE.Vector3(
                dirLight.position.x - WORLD_CENTER,
                dirLight.position.y - (WORLD_SIZE * 0.15),
                dirLight.position.z - WORLD_CENTER
            ).normalize();
            var sunDistance = WORLD_SIZE * 1.45;
            var sunCenter = new THREE.Vector3(
                WORLD_CENTER + (sunDirection.x * sunDistance),
                Math.max(WORLD_SIZE * 0.88, (WORLD_SIZE * 0.52) + (sunDirection.y * sunDistance)),
                WORLD_CENTER + (sunDirection.z * sunDistance)
            );

            var sunCore = new THREE.Mesh(
                new THREE.SphereGeometry(WORLD_SIZE * 0.055, 20, 16),
                matLib.getBasic({ color: 0xfff3c4 })
            );
            sunCore.position.copy(sunCenter);
            sunCore.castShadow = false;
            sunCore.receiveShadow = false;
            addTrackedObject(scene, sunCore);

            var sunHalo = new THREE.Mesh(
                new THREE.SphereGeometry(WORLD_SIZE * 0.085, 20, 16),
                matLib.getBasic({ color: 0xffd890, transparent: true, opacity: 0.22 })
            );
            sunHalo.position.copy(sunCenter);
            sunHalo.castShadow = false;
            sunHalo.receiveShadow = false;
            addTrackedObject(scene, sunHalo);
        })();

        addTrackedObject(scene, new THREE.HemisphereLight(0xd4e8ff, 0x4d6149, 0.7));

        var arcticFillLight = new THREE.PointLight(0x8ed5ff, 0.32, WORLD_SIZE * 0.95);
        arcticFillLight.position.set(WORLD_CENTER * 0.48, WORLD_SIZE * 0.28, WORLD_CENTER * 0.5);
        addTrackedObject(scene, arcticFillLight);

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
                addTrackedObject(scene, root);

                for (var i = 0; i < cells.length; i++) {
                    var cell = cells[i];
                    var block = new THREE.Mesh(
                        getSharedBoxGeometry(
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
                    block.castShadow = true;
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
            var baseIntensity = Number(flk.baseIntensity);
            if (!isFinite(baseIntensity)) baseIntensity = 0.7;
            var amplitude = Number(flk.amplitude);
            if (!isFinite(amplitude)) amplitude = 0.3;
            var wave = Math.sin((animClock * flk.freq) + flk.phase);
            flk.material.emissiveIntensity = baseIntensity + (wave * amplitude);
            var opacityBase = Number(flk.opacityBase);
            if (isFinite(opacityBase) && typeof flk.material.opacity === 'number') {
                var opacityAmplitude = Number(flk.opacityAmplitude);
                if (!isFinite(opacityAmplitude)) opacityAmplitude = 0;
                flk.material.opacity = Math.max(0, Math.min(1, opacityBase + (wave * opacityAmplitude)));
            }
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

    GameWorld.dispose = function () {
        clearWorldScene();
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
    };

    GameWorld.getCollidables = function () { return collidables; };

    GameWorld.getBounds = function () {
        refreshSharedWorldConfig();
        return { min: WORLD_MIN, max: WORLD_MAX, size: WORLD_SIZE, center: WORLD_CENTER };
    };

    GameWorld.getWorldMeta = function () {
        refreshSharedWorldConfig();
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
    GameWorld.getSize = function () { refreshSharedWorldConfig(); return WORLD_SIZE; };
    GameWorld.getCenter = function () { refreshSharedWorldConfig(); return WORLD_CENTER; };
    GameWorld.getAreaScale = function () { refreshSharedWorldConfig(); return WORLD_AREA_SCALE; };
    GameWorld.getSpawnPadding = function () { refreshSharedWorldConfig(); return DEFAULT_SPAWN_PADDING; };
    GameWorld.getRandomSpawnPoint = function (padding, options) { return randomSpawnPoint(padding, options); };
    GameWorld.getGroundHeightAt = function (x, z) { return getGroundHeightAt(x, z); };
    GameWorld.getRecommendedEnemyCount = function () {
        refreshSharedWorldConfig();
        return Math.max(8, Math.round(5 * Math.sqrt(WORLD_AREA_SCALE)));
    };
    GameWorld.getSeed = function () { return WORLD_SEED; };
    GameWorld.setSeed = function (seedText) { return setSeed(seedText); };

    globalThis.__MAYHEM_RUNTIME.GameWorld = GameWorld;
})();
