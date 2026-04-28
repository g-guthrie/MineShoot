import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRotatedBoxAabb,
  createHeadlessRecorder,
  ensureHeadlessWorldRuntime
} from '../../shared/headless-world-runtime.js';
import {
  compileCylinderColliderBoxes,
  compileDomeColliderBoxes
} from '../../shared/collider-authoring.js';
import {
  BIOME_ARCTIC,
  BIOME_WALL_STREET,
  BIOME_DESERT,
  BIOME_GRID_COLS,
  BIOME_GRID_ROWS,
  BIOME_GRID_LINE_X,
  BIOME_GRID_LINE_Z,
  BIOME_JUNGLE,
  BIOME_NUCLEAR,
  BIOME_QUARRY,
  BIOME_VOLCANO,
  DEFAULT_QUADRANT_MAP,
  WORLD_SIZE,
  quadrantBounds,
  biomeAtPosition
} from '../../shared/world-layout.js';
import { buildWorldCollisionData } from '../../shared/world-collision.js';

test('world layout expands to a 3x3 biome grid', () => {
  assert.equal(BIOME_GRID_COLS, 3);
  assert.equal(BIOME_GRID_ROWS, 3);
  assert.equal(DEFAULT_QUADRANT_MAP.length, 9);
  assert.deepEqual(
    DEFAULT_QUADRANT_MAP.map((entry) => entry.quadrant),
    ['r0c0', 'r0c1', 'r0c2', 'r1c0', 'r1c1', 'r1c2', 'r2c0', 'r2c1', 'r2c2']
  );
  assert.deepEqual(BIOME_GRID_LINE_X.map((value) => Math.round(value)), [56, 110]);
  assert.deepEqual(BIOME_GRID_LINE_Z.map((value) => Math.round(value)), [56, 110]);
  assert.equal(WORLD_SIZE, 166);
  assert.deepEqual(
    DEFAULT_QUADRANT_MAP.map((entry) => entry.biome),
    [
      BIOME_ARCTIC,
      BIOME_VOLCANO,
      BIOME_DESERT,
      BIOME_JUNGLE,
      'pirate-cove',
      BIOME_NUCLEAR,
      BIOME_QUARRY,
      BIOME_WALL_STREET,
      'whoville'
    ]
  );
});

test('cell bounds cover the full biome cell footprint', () => {
  const centerCell = quadrantBounds('r1c1');
  assert.equal(Math.round(centerCell.maxX - centerCell.minX), 54);
  assert.equal(Math.round(centerCell.maxZ - centerCell.minZ), 54);

  const biome = biomeAtPosition((centerCell.minX + centerCell.maxX) * 0.5, (centerCell.minZ + centerCell.maxZ) * 0.5);
  assert.equal(biome, DEFAULT_QUADRANT_MAP[4].biome);
});

test('headless world collision data builds for the full 3x3 biome layout', () => {
  const data = buildWorldCollisionData({
    worldSeed: 'audit-seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  assert.ok(Array.isArray(data.collidables));
  assert.ok(Array.isArray(data.spawnExclusionZones));
  assert.ok(data.collidables.length > 0);
  assert.ok(data.spawnExclusionZones.length > 0);
});

test('headless world recorder keeps decor non-blocking by default unless geometry opts in', () => {
  ensureHeadlessWorldRuntime();
  const recorder = createHeadlessRecorder();
  const visualOnlyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
  const collidingGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
  collidingGeometry.userData = collidingGeometry.userData || {};
  collidingGeometry.userData.collisionEnabled = true;

  recorder.place.addDecor(4, 1, 4, visualOnlyGeometry, null);
  recorder.place.addDecor(8, 1, 8, collidingGeometry, null);

  assert.equal(recorder.collidables.length, 1);
  assert.deepEqual(recorder.collidables[0], createRotatedBoxAabb(8, 1, 8, 1, 2, 1, 0, 0));
});

test('headless world collision data no longer includes thin seam colliders on biome divider lines', () => {
  const data = buildWorldCollisionData({
    worldSeed: 'audit-seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  const seamLike = data.collidables.filter((box) => {
    const centerX = (box.min.x + box.max.x) * 0.5;
    const centerZ = (box.min.z + box.max.z) * 0.5;
    const spanX = box.max.x - box.min.x;
    const spanZ = box.max.z - box.min.z;
    const onVerticalSeam = (Math.abs(centerX - 56) < 0.05 || Math.abs(centerX - 110) < 0.05) && spanX < 0.5 && spanZ > 20;
    const onHorizontalSeam = (Math.abs(centerZ - 56) < 0.05 || Math.abs(centerZ - 110) < 0.05) && spanZ < 0.5 && spanX > 20;
    return onVerticalSeam || onHorizontalSeam;
  });

  assert.equal(seamLike.length, 0);
});

function createGeometryRecorder() {
  const blocks = [];
  const decors = [];

  function applyColliderUserData(userData, spec, primitive, sliceIndex, sliceCount) {
    userData.collisionAuthoring = true;
    userData.collisionPrimitive = String(primitive || '');
    userData.collisionSliceIndex = Math.max(0, Number(sliceIndex || 0));
    userData.collisionSliceCount = Math.max(1, Number(sliceCount || 1));
    if (spec && spec.role) userData.role = String(spec.role);
    if (spec && spec.collisionGroup) userData.collisionGroup = String(spec.collisionGroup);
    const meta = spec && spec.meta && typeof spec.meta === 'object' ? spec.meta : null;
    if (meta) {
      for (const key in meta) {
        userData[key] = meta[key];
      }
    }
  }

  function pushColliderBoxes(boxesToAdd, spec, primitive) {
    const out = [];
    for (let i = 0; i < boxesToAdd.length; i++) {
      const box = boxesToAdd[i];
      const userData = {};
      applyColliderUserData(userData, spec, primitive, i, boxesToAdd.length);
      blocks.push({
        kind: 'block',
        x: Number(box.x || 0),
        y: Number(box.y || 0),
        z: Number(box.z || 0),
        w: Number(box.w || 0),
        h: Number(box.h || 0),
        d: Number(box.d || 0),
        material: null,
        isSolid: true,
        userData
      });
      out.push({
        position: { x: Number(box.x || 0), y: Number(box.y || 0), z: Number(box.z || 0) },
        userData
      });
    }
    return out;
  }

  return {
    blocks,
    decors,
    place: {
      addBlock(x, y, z, w, h, d, material, isSolid) {
        const userData = {};
        blocks.push({
          kind: 'block',
          x: Number(x || 0),
          y: Number(y || 0),
          z: Number(z || 0),
          w: Number(w || 0),
          h: Number(h || 0),
          d: Number(d || 0),
          material,
          isSolid: isSolid !== false,
          userData
        });
        return {
          position: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
          material: material || null,
          userData
        };
      },
      addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid) {
        const userData = {};
        blocks.push({
          kind: 'ramp',
          x: Number(x || 0),
          y: Number(y || 0),
          z: Number(z || 0),
          w: Number(w || 0),
          h: Number(h || 0),
          d: Number(d || 0),
          rotY: Number(rotY || 0),
          tiltX: Number(tiltX || 0),
          material,
          isSolid: isSolid !== false,
          userData
        });
        return {
          position: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
          material: material || null,
          userData
        };
      },
      addDecor(x, y, z, geometry, material, rotY, rotX, rotZ) {
        const userData = {};
        decors.push({
          kind: 'decor',
          x: Number(x || 0),
          y: Number(y || 0),
          z: Number(z || 0),
          geometry,
          material,
          rotY: Number(rotY || 0),
          rotX: Number(rotX || 0),
          rotZ: Number(rotZ || 0),
          userData
        });
        return {
          position: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
          rotation: { x: Number(rotX || 0), y: Number(rotY || 0), z: Number(rotZ || 0) },
          material: material || null,
          geometry: geometry || null,
          userData
        };
      },
      addBoxCollider(spec) {
        const value = spec || {};
        return pushColliderBoxes([{
          x: Number(value.x || 0),
          y: Number(value.y || 0),
          z: Number(value.z || 0),
          w: Number(value.w || 0),
          h: Number(value.h || 0),
          d: Number(value.d || 0)
        }], value, 'box');
      },
      addCylinderCollider(spec) {
        return pushColliderBoxes(compileCylinderColliderBoxes(spec || {}), spec || {}, 'cylinder');
      },
      addDomeCollider(spec) {
        return pushColliderBoxes(compileDomeColliderBoxes(spec || {}), spec || {}, 'dome');
      }
    },
    ctx: {
      scene: { add() {} },
      addExclusion() {},
      addWaterfallSheet() {},
      addMistCard() {},
      addLeafSway() {},
      addIceShimmer() {},
      addFlicker() {},
      addSteamColumn() {}
    }
  };
}

function solidGeometryAabbs(blocks) {
  return blocks
    .filter((block) => block.isSolid)
    .map((block) => createRotatedBoxAabb(
      block.x,
      block.y,
      block.z,
      block.w,
      block.h,
      block.d,
      block.rotY || 0,
      block.tiltX || 0
    ));
}

function pointHitsSolid(aabbs, x, y, z) {
  return aabbs.some((aabb) =>
    x >= aabb.min.x &&
    x <= aabb.max.x &&
    y >= aabb.min.y &&
    y <= aabb.max.y &&
    z >= aabb.min.z &&
    z <= aabb.max.z
  );
}

test('nuclear simpsons biome uses shared authored round colliders instead of biome-local hidden collision helpers', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.nuclear;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r1c2');
  const recorder = createGeometryRecorder();
  const stats = builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_NUCLEAR },
    rawBounds
  });

  assert.ok(stats);
  assert.equal(stats.towers, 2);
  assert.equal(stats.reactorBuildings, 1);

  const hiddenCollisionHelpers = recorder.blocks.filter((block) =>
    block.userData &&
    (
      block.userData.collisionOnly === true ||
      String(block.userData.role || '').includes('-collision')
    )
  );
  assert.equal(hiddenCollisionHelpers.length, 0);

  const sharedRoundColliders = recorder.blocks.filter((block) =>
    block.userData &&
    block.userData.collisionAuthoring === true
  );
  assert.ok(sharedRoundColliders.length > 0);
  assert.ok(sharedRoundColliders.every((block) => block.isSolid === true));
  assert.ok(sharedRoundColliders.some((block) => block.userData.collisionPrimitive === 'cylinder'));
  assert.ok(sharedRoundColliders.some((block) => block.userData.collisionPrimitive === 'dome'));
  assert.ok(sharedRoundColliders.some((block) => block.userData.collisionGroup === 'nuclear-round'));
  assert.ok(sharedRoundColliders.some((block) => block.userData.collisionGroup === 'reactor-tank'));

  const reactorBodies = recorder.blocks.filter((block) =>
    block.userData &&
    block.userData.role === 'reactor-body'
  );
  const officeBodies = recorder.blocks.filter((block) =>
    block.userData &&
    block.userData.role === 'office-body'
  );
  const warehouseBodies = recorder.blocks.filter((block) =>
    block.userData &&
    block.userData.role === 'warehouse-body'
  );
  const prefabMainTank = recorder.decors.filter((decor) =>
    decor.userData &&
    decor.userData.role === 'tank-main'
  );
  assert.equal(reactorBodies.length, 1);
  assert.equal(officeBodies.length, 1);
  assert.equal(warehouseBodies.length, 0);
  assert.equal(prefabMainTank.length, 1);
});

test('nuclear simpsons biome blocks intended spaces while keeping the gate gap and visual dressing open', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.nuclear;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r1c2');
  const recorder = createGeometryRecorder();
  builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_NUCLEAR },
    rawBounds
  });

  const nonSolidVisuals = recorder.blocks.filter((block) =>
    block.isSolid === false &&
    block.userData &&
    (
      String(block.userData.role || '').includes('window') ||
      String(block.userData.role || '').includes('glow') ||
      String(block.userData.role || '').includes('frame') ||
      String(block.userData.role || '').includes('power-line')
    )
  );
  assert.ok(nonSolidVisuals.length > 0);

  const coolingTowerSteam = recorder.decors.filter((decor) =>
    decor.userData &&
    decor.userData.role === 'cooling-tower-steam'
  );
  assert.equal(coolingTowerSteam.length, 2);

  const solidAabbs = solidGeometryAabbs(recorder.blocks);
  const centerX = (rawBounds.minX + rawBounds.maxX) * 0.5;
  const centerZ = (rawBounds.minZ + rawBounds.maxZ) * 0.5;
  const officeX = centerX - 10;
  const officeZ = centerZ + 11;
  const westFenceX = centerX - 24;
  const northFenceZ = centerZ - 20;
  const towerX = rawBounds.maxX - 6;
  const northTowerZ = centerZ - 10;
  const reactorTankX = centerX + 6;
  const reactorTankZ = centerZ + 12;

  assert.equal(pointHitsSolid(solidAabbs, officeX, 2, officeZ), true);
  assert.equal(pointHitsSolid(solidAabbs, westFenceX, 1, northFenceZ), false);
  assert.equal(pointHitsSolid(solidAabbs, westFenceX, 1, centerZ), false);
  assert.equal(pointHitsSolid(solidAabbs, towerX, 6, northTowerZ), true);
  assert.equal(pointHitsSolid(solidAabbs, reactorTankX, 4, reactorTankZ), false);

  const colliderSlices = recorder.blocks.filter((block) =>
    block.userData &&
    block.userData.collisionAuthoring === true
  );
  assert.ok(colliderSlices.every((block) => block.kind === 'block'));
});

test('wall street keeps all paving and collision inside the biome bounds', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants['wall-street'];
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r2c1');
  const geometryRecorder = createGeometryRecorder();
  builder(rawBounds, geometryRecorder.place, {
    ...geometryRecorder.ctx,
    biomeEntry: { biome: BIOME_WALL_STREET },
    rawBounds
  });

  const overflowBlocks = geometryRecorder.blocks.filter((block) => {
    const bounds = createRotatedBoxAabb(
      block.x,
      block.y,
      block.z,
      block.w,
      block.h,
      block.d,
      block.rotY || 0,
      block.tiltX || 0
    );
    return bounds.min.x < rawBounds.minX - 0.0001 ||
      bounds.max.x > rawBounds.maxX + 0.0001 ||
      bounds.min.z < rawBounds.minZ - 0.0001 ||
      bounds.max.z > rawBounds.maxZ + 0.0001;
  });
  assert.equal(overflowBlocks.length, 0);

  const collisionRecorder = createHeadlessRecorder();
  builder(rawBounds, collisionRecorder.place, {
    ...collisionRecorder.ctx,
    biomeEntry: { biome: BIOME_WALL_STREET },
    rawBounds
  });
  const overflowColliders = collisionRecorder.collidables.filter((box) =>
    box.min.x < rawBounds.minX - 0.0001 ||
    box.max.x > rawBounds.maxX + 0.0001 ||
    box.min.z < rawBounds.minZ - 0.0001 ||
    box.max.z > rawBounds.maxZ + 0.0001
  );
  assert.equal(overflowColliders.length, 0);
});

test('desert arch shadow slabs sit below the solid spans instead of overlapping them', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.desert;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r0c2');
  const recorder = createGeometryRecorder();
  builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_DESERT },
    rawBounds
  });

  const smallSpan = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === true &&
    Math.abs(block.w - 8.0) < 0.0001 &&
    Math.abs(block.h - 1.2) < 0.0001 &&
    Math.abs(block.d - 2.0) < 0.0001
  );
  const smallShadow = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    Math.abs(block.w - 6.0) < 0.0001 &&
    Math.abs(block.h - 0.28) < 0.0001 &&
    Math.abs(block.d - 1.4) < 0.0001
  );
  const largeSpan = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === true &&
    Math.abs(block.w - 11.8) < 0.0001 &&
    Math.abs(block.h - 1.4) < 0.0001 &&
    Math.abs(block.d - 3.0) < 0.0001
  );
  const largeShadow = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    Math.abs(block.w - 7.8) < 0.0001 &&
    Math.abs(block.h - 0.24) < 0.0001 &&
    Math.abs(block.d - 1.8) < 0.0001
  );

  assert.ok(smallSpan);
  assert.ok(smallShadow);
  assert.ok(largeSpan);
  assert.ok(largeShadow);
  assert.ok((smallShadow.y + (smallShadow.h * 0.5)) < (smallSpan.y - (smallSpan.h * 0.5)));
  assert.ok((largeShadow.y + (largeShadow.h * 0.5)) < (largeSpan.y - (largeSpan.h * 0.5)));
});

test('pirate cove splits water and sand into one flat flush seam without overlap', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants['pirate-cove'];
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r1c1');
  const recorder = createGeometryRecorder();
  builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: 'pirate-cove' },
    rawBounds
  });

  const water = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    block.userData &&
    block.userData.role === 'water'
  );
  const sand = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    block.userData &&
    block.userData.role === 'shore' &&
    block.userData.part === 'sand'
  );

  assert.ok(water);
  assert.ok(sand);
  assert.ok(Math.abs((water.y + (water.h * 0.5)) - (sand.y + (sand.h * 0.5))) < 0.0001);
  assert.ok(Math.abs((water.x + (water.w * 0.5)) - (sand.x - (sand.w * 0.5))) < 0.0001);
  assert.ok((water.x + (water.w * 0.5)) <= (sand.x - (sand.w * 0.5)));
});
