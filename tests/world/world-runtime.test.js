import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadWorldRuntime(options = {}) {
  const shared = {
    protocol: {
      world: {
        profileVersion: 6,
        flags: {
          envV2: true,
          terrainPhysicsV2: true
        },
        seedPrefix: 'test-seed'
      }
    },
    worldLayout: {
      BASE_WORLD_SIZE: 32,
      WORLD_AREA_SCALE: 1,
      WORLD_SIZE: 32,
      WORLD_CENTER: 16,
      WORLD_MARGIN: 0,
      WORLD_MIN: 0,
      WORLD_MAX: 32,
      DEFAULT_SPAWN_PADDING: 2,
      BIOME_ARCTIC: 'arctic',
      BIOME_URBAN: 'urban',
      BIOME_DESERT: 'desert',
      BIOME_JUNGLE: 'jungle',
      BIOME_NUCLEAR: 'nuclear',
      BIOME_CITADEL: 'citadel',
      BIOME_QUARRY: 'quarry',
      BIOME_WALL_STREET: 'wall-street',
      BIOME_RADAR: 'radar',
      DEFAULT_QUADRANT_MAP: [
        { quadrant: 'r0c0', biome: 'jungle' }
      ],
      quadrantBounds() {
        return { minX: 0, maxX: 32, minZ: 0, maxZ: 32 };
      },
      biomeAtPosition() {
        return 'jungle';
      },
      buildBiomePerimeter() {}
    },
    terrainSampler: {
      createTerrainSampler() {
        return {
          getGroundHeightAt() {
            return 0;
          }
        };
      }
    }
  };
  const runtime = {
    GameShared: options.deferShared ? null : shared,
    WorldQuadrants: {}
  };

  const tracked = {
    uniqueGeometries: [],
    uniqueMaterials: [],
    decorMeshes: []
  };

  runtime.WorldQuadrants.jungle = function buildTestQuadrant(bounds, place, ctx) {
    const material = runtime.GameMaterialLibrary.getLambert({ color: 0x336633 });
    place.addBlock(4, 1, 4, 2, 2, 2, material, true);
    place.addBlock(8, 1, 4, 2, 2, 2, material, true);

    const uniqueGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
    const baseGeometryDispose = uniqueGeometry.dispose.bind(uniqueGeometry);
    uniqueGeometry.dispose = function disposeGeometry() {
      this.wasDisposed = true;
      return baseGeometryDispose();
    };

    const uniqueMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0x442200 });
    const baseMaterialDispose = uniqueMaterial.dispose.bind(uniqueMaterial);
    uniqueMaterial.dispose = function disposeMaterial() {
      this.wasDisposed = true;
      return baseMaterialDispose();
    };

    tracked.uniqueGeometries.push(uniqueGeometry);
    tracked.uniqueMaterials.push(uniqueMaterial);
    tracked.decorMeshes.push(place.addDecor(12, 1, 12, uniqueGeometry, uniqueMaterial));

    ctx.addExclusion(10, 10, 2);

    return {
      blockCount: 2
    };
  };

  const sandbox = {
    THREE,
    __MAYHEM_RUNTIME: runtime,
    __TEST_CHOOSE_SPAWN_POINT__: function chooseSpawnPoint() {
      return { x: 0, z: 0 };
    },
    globalThis: null
  };
  sandbox.globalThis = sandbox;

  const materialCode = await fs.readFile(new URL('../../js/world/material-library.js', import.meta.url), 'utf8');
  vm.runInContext(materialCode, vm.createContext(sandbox));

  const worldCode = await fs.readFile(new URL('../../js/world/world.js', import.meta.url), 'utf8');
  const transformedWorldCode = worldCode.replace(
    /^import\s+\{\s*chooseSpawnPoint\s*\}\s+from\s+['"][^'"]+['"];\s*/m,
    'const chooseSpawnPoint = globalThis.__TEST_CHOOSE_SPAWN_POINT__;\n'
  );
  vm.runInContext(transformedWorldCode, sandbox);

  return {
    GameWorld: sandbox.__MAYHEM_RUNTIME.GameWorld,
    runtime: sandbox.__MAYHEM_RUNTIME,
    shared,
    tracked
  };
}

test('world runtime rebuild removes old world objects while reusing shared block geometry', async () => {
  const { GameWorld, tracked } = await loadWorldRuntime();
  const scene = new THREE.Scene();
  const persistent = new THREE.Object3D();
  scene.add(persistent);

  GameWorld.create(scene);

  const firstSceneChildCount = scene.children.length;
  const firstCollidables = GameWorld.getCollidables();
  assert.equal(firstCollidables.length, 2);
  assert.equal(firstCollidables[0].geometry, firstCollidables[1].geometry);
  const firstSharedGeometry = firstCollidables[0].geometry;
  const firstDecorMesh = tracked.decorMeshes[0];
  const firstUniqueGeometry = tracked.uniqueGeometries[0];
  const firstUniqueMaterial = tracked.uniqueMaterials[0];

  GameWorld.create(scene);

  const secondCollidables = GameWorld.getCollidables();
  assert.equal(scene.children.includes(persistent), true);
  assert.equal(scene.children.length, firstSceneChildCount);
  assert.equal(firstDecorMesh.parent, null);
  assert.equal(firstUniqueGeometry.wasDisposed, true);
  assert.equal(firstUniqueMaterial.wasDisposed, true);
  assert.equal(secondCollidables[0].geometry, firstSharedGeometry);
});

test('world runtime can load before GameShared and resolve layout on create', async () => {
  const { GameWorld, runtime, shared } = await loadWorldRuntime({ deferShared: true });
  runtime.GameShared = shared;
  const scene = new THREE.Scene();

  assert.doesNotThrow(() => {
    GameWorld.create(scene);
  });
  assert.equal(GameWorld.getSize(), 32);
  assert.equal(GameWorld.getBounds().max, 32);
});
