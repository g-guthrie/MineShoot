import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {
  compileCylinderColliderBoxes,
  compileDomeColliderBoxes,
  compileSphereColliderBoxes
} from '../../shared/collider-authoring.js';

function createTestWorldLayout(options = {}) {
  const rows = Math.max(1, Number(options.rows) || 1);
  const cols = Math.max(1, Number(options.cols) || 1);
  const worldMin = options.worldMin != null ? Number(options.worldMin) : 0;
  const worldMax = options.worldMax != null ? Number(options.worldMax) : 32;
  const worldSize = options.worldSize != null ? Number(options.worldSize) : 32;
  const cellWidth = (worldMax - worldMin) / cols;
  const cellDepth = (worldMax - worldMin) / rows;
  const cells = Array.isArray(options.cells) && options.cells.length
    ? options.cells.map((entry) => ({
        quadrant: entry.quadrant,
        biome: entry.biome,
        row: Number(entry.row),
        col: Number(entry.col)
      }))
    : [{ quadrant: 'r0c0', biome: 'jungle', row: 0, col: 0 }];

  function resolveCell(quadrant) {
    const raw = String(quadrant || '');
    const match = /^r(\d+)c(\d+)$/i.exec(raw);
    if (!match) return { row: 0, col: 0 };
    const row = Math.max(0, Math.min(rows - 1, Number(match[1]) || 0));
    const col = Math.max(0, Math.min(cols - 1, Number(match[2]) || 0));
    return { row, col };
  }

  function quadrantBounds(quadrant) {
    const resolved = resolveCell(quadrant);
    return {
      minX: worldMin + (resolved.col * cellWidth),
      maxX: worldMin + ((resolved.col + 1) * cellWidth),
      minZ: worldMin + (resolved.row * cellDepth),
      maxZ: worldMin + ((resolved.row + 1) * cellDepth)
    };
  }

  function biomeAtPosition(x, z) {
    const clampedX = Math.max(worldMin, Math.min(worldMax, Number(x) || 0));
    const clampedZ = Math.max(worldMin, Math.min(worldMax, Number(z) || 0));
    const col = Math.max(0, Math.min(cols - 1, Math.floor(((clampedX - worldMin) / (worldMax - worldMin || 1)) * cols)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor(((clampedZ - worldMin) / (worldMax - worldMin || 1)) * rows)));
    const found = cells.find((entry) => entry.row === row && entry.col === col);
    return found ? found.biome : 'jungle';
  }

  return {
    BASE_WORLD_SIZE: worldSize,
    WORLD_AREA_SCALE: 1,
    WORLD_SIZE: worldSize,
    WORLD_CENTER: worldSize * 0.5,
    WORLD_MARGIN: worldMin,
    WORLD_MIN: worldMin,
    WORLD_MAX: worldMax,
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
    DEFAULT_QUADRANT_MAP: cells,
    quadrantBounds,
    biomeAtPosition,
    buildBiomePerimeter() {}
  };
}

function createFullGridLayout() {
  const biomes = [
    'arctic',
    'volcano',
    'desert',
    'jungle',
    'pirate-cove',
    'nuclear',
    'quarry',
    'wall-street',
    'whoville'
  ];
  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const index = (row * 3) + col;
      cells.push({
        quadrant: `r${row}c${col}`,
        biome: biomes[index],
        row,
        col
      });
    }
  }
  return createTestWorldLayout({ rows: 3, cols: 3, cells });
}

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
    worldLayout: options.worldLayout || createTestWorldLayout(),
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

  if (!options.skipDefaultQuadrantBuilder) {
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
  }

  const sandbox = {
    THREE,
    __MAYHEM_RUNTIME: runtime,
    __TEST_CHOOSE_SPAWN_POINT__: function chooseSpawnPoint() {
      return { x: 0, z: 0 };
    },
    __TEST_COMPILE_CYLINDER_COLLIDER_BOXES__: compileCylinderColliderBoxes,
    __TEST_COMPILE_DOME_COLLIDER_BOXES__: compileDomeColliderBoxes,
    __TEST_COMPILE_SPHERE_COLLIDER_BOXES__: compileSphereColliderBoxes,
    globalThis: null
  };
  sandbox.globalThis = sandbox;

  const materialCode = await fs.readFile(new URL('../../js/world/material-library.js', import.meta.url), 'utf8');
  vm.runInContext(materialCode, vm.createContext(sandbox));

  const worldCode = await fs.readFile(new URL('../../js/world/world.js', import.meta.url), 'utf8');
  const transformedWorldCode = worldCode
    .replace(
      /^import\s+\{\s*chooseSpawnPoint\s*\}\s+from\s+['"][^'"]+['"];\s*/m,
      'const chooseSpawnPoint = globalThis.__TEST_CHOOSE_SPAWN_POINT__;\n'
    )
    .replace(
      /^import\s+\{\s*compileCylinderColliderBoxes,\s*compileDomeColliderBoxes,\s*compileSphereColliderBoxes\s*\}\s+from\s+['"][^'"]+['"];\s*/m,
      'const compileCylinderColliderBoxes = globalThis.__TEST_COMPILE_CYLINDER_COLLIDER_BOXES__;\nconst compileDomeColliderBoxes = globalThis.__TEST_COMPILE_DOME_COLLIDER_BOXES__;\nconst compileSphereColliderBoxes = globalThis.__TEST_COMPILE_SPHERE_COLLIDER_BOXES__;\n'
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
  const firstGroundMeshes = scene.children.filter((object) => object.userData && object.userData.isBiomeGround);
  const firstCollidables = GameWorld.getCollidables();
  assert.equal(firstGroundMeshes.length, 1);
  assert.equal(firstCollidables.length, 2);
  assert.equal(firstCollidables[0].geometry, firstCollidables[1].geometry);
  const firstSharedGeometry = firstCollidables[0].geometry;
  const firstGroundMesh = firstGroundMeshes[0];
  const firstDecorMesh = tracked.decorMeshes[0];
  const firstUniqueGeometry = tracked.uniqueGeometries[0];
  const firstUniqueMaterial = tracked.uniqueMaterials[0];

  GameWorld.create(scene);

  const secondGroundMeshes = scene.children.filter((object) => object.userData && object.userData.isBiomeGround);
  const secondCollidables = GameWorld.getCollidables();
  assert.equal(scene.children.includes(persistent), true);
  assert.equal(scene.children.length, firstSceneChildCount);
  assert.equal(firstGroundMesh.parent, null);
  assert.equal(firstDecorMesh.parent, null);
  assert.equal(firstUniqueGeometry.wasDisposed, true);
  assert.equal(firstUniqueMaterial.wasDisposed, true);
  assert.equal(secondGroundMeshes.length, 1);
  assert.equal(secondCollidables[0].geometry, firstSharedGeometry);
});

test('world runtime keeps decor non-blocking by default but allows explicit collision opt-in', async () => {
  const { GameWorld, runtime } = await loadWorldRuntime({ skipDefaultQuadrantBuilder: true });
  runtime.WorldQuadrants.jungle = function buildTestQuadrant(_bounds, place) {
    const material = runtime.GameMaterialLibrary.getLambert({ color: 0x336633 });
    const visualOnlyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
    const collidingGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
    collidingGeometry.userData = collidingGeometry.userData || {};
    collidingGeometry.userData.collisionEnabled = true;

    place.addDecor(4, 1, 4, visualOnlyGeometry, material);
    place.addDecor(8, 1, 8, collidingGeometry, material);
  };
  const scene = new THREE.Scene();

  GameWorld.create(scene);

  const collidables = GameWorld.getCollidables();
  assert.equal(collidables.length, 1);
  assert.equal(Math.round(collidables[0].position.x), 8);
  assert.equal(Math.round(collidables[0].position.z), 8);
});

test('world runtime builds one tagged ground mesh per biome cell without crossing seams', async () => {
  const worldLayout = createFullGridLayout();
  const { GameWorld, shared } = await loadWorldRuntime({
    worldLayout,
    skipDefaultQuadrantBuilder: true
  });
  const scene = new THREE.Scene();

  GameWorld.create(scene);

  const biomeGroundMeshes = scene.children.filter((object) => object.userData && object.userData.isBiomeGround);
  assert.equal(biomeGroundMeshes.length, 9);

  const seenCells = new Set();
  const expectedBiomes = new Map(
    shared.worldLayout.DEFAULT_QUADRANT_MAP.map((entry) => [entry.quadrant, entry.biome])
  );

  for (const mesh of biomeGroundMeshes) {
    const cell = mesh.userData.cell;
    const expectedBiome = expectedBiomes.get(cell);
    assert.ok(expectedBiome);
    assert.equal(mesh.userData.biome, expectedBiome);
    seenCells.add(cell);

    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const bounds = shared.worldLayout.quadrantBounds(cell);
    const epsilon = 0.0001;
    assert.ok(box.min.x >= (bounds.minX - epsilon));
    assert.ok(box.max.x <= (bounds.maxX + epsilon));
    assert.ok(box.min.z >= (bounds.minZ - epsilon));
    assert.ok(box.max.z <= (bounds.maxZ + epsilon));
  }

  assert.equal(seenCells.size, 9);
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

test('world runtime keeps non-solid surface skins visible without turning them into colliders', async () => {
  const { GameWorld, runtime } = await loadWorldRuntime({ skipDefaultQuadrantBuilder: true });
  runtime.WorldQuadrants.jungle = function buildTestQuadrant(_bounds, place) {
    const material = runtime.GameMaterialLibrary.getLambert({ color: 0x336633 });
    place.addBlock(4, 0.04, 4, 6, 0.08, 6, material, false);
    place.addBlock(10, 1, 10, 2, 2, 2, material, true);
  };
  const scene = new THREE.Scene();

  GameWorld.create(scene);

  const authoredMeshes = scene.children.filter((object) =>
    object.isMesh === true &&
    object.userData &&
    object.userData.isBiomeGround !== true
  );
  const collidables = GameWorld.getCollidables();

  assert.equal(authoredMeshes.length >= 2, true);
  assert.equal(collidables.length, 1);
  assert.equal(collidables[0].userData.isSolid, true);
});
