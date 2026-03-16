import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureHeadlessWorldRuntime } from '../../shared/headless-world-runtime.js';
import {
  BIOME_ARCTIC,
  BIOME_BASIN,
  BIOME_CITADEL,
  BIOME_DESERT,
  BIOME_GRID_COLS,
  BIOME_GRID_ROWS,
  BIOME_GRID_LINE_X,
  BIOME_GRID_LINE_Z,
  BIOME_JUNGLE,
  BIOME_NUCLEAR,
  BIOME_QUARRY,
  BIOME_RADAR,
  BIOME_URBAN,
  DEFAULT_QUADRANT_MAP,
  WORLD_SIZE,
  quadrantBounds,
  biomeAtPosition
} from '../../shared/world-layout.js';
import { buildLmsBeaconAnchors } from '../../shared/lms-mode.js';
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
      BIOME_RADAR,
      BIOME_DESERT,
      BIOME_JUNGLE,
      BIOME_CITADEL,
      BIOME_NUCLEAR,
      BIOME_QUARRY,
      BIOME_BASIN,
      BIOME_URBAN
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

test('lms beacons emit one anchor per biome cell', () => {
  const anchors = buildLmsBeaconAnchors();
  assert.equal(anchors.length, 9);
  assert.equal(new Set(anchors.map((anchor) => anchor.id)).size, 9);
  assert.equal(new Set(anchors.map((anchor) => String(anchor.row) + '-' + String(anchor.col))).size, 9);
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
  return {
    blocks,
    place: {
      addBlock(x, y, z, w, h, d, material, isSolid) {
        blocks.push({
          kind: 'block',
          x: Number(x || 0),
          y: Number(y || 0),
          z: Number(z || 0),
          w: Number(w || 0),
          h: Number(h || 0),
          d: Number(d || 0),
          material,
          isSolid: isSolid !== false
        });
        return {
          position: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
          material: material || null
        };
      },
      addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid) {
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
          isSolid: isSolid !== false
        });
        return {
          position: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
          material: material || null
        };
      },
      addDecor() {
        return {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          material: null
        };
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

test('arctic mountain keeps a lower summit while adding more glacier texture', () => {
  const runtime = ensureHeadlessWorldRuntime();
  const builder = runtime.WorldQuadrants && runtime.WorldQuadrants.arctic;
  assert.equal(typeof builder, 'function');

  const rawBounds = quadrantBounds('r0c0');
  const recorder = createGeometryRecorder();
  const stats = builder(rawBounds, recorder.place, {
    ...recorder.ctx,
    biomeEntry: { biome: BIOME_ARCTIC },
    rawBounds
  });

  assert.ok(stats);
  assert.ok(stats.peakHeight >= 19.5);
  assert.ok(stats.peakHeight <= 21.5);
  assert.ok(stats.terraceCount <= 6);
  assert.ok(stats.minRouteShelfDepth >= 3.5);
  assert.ok(stats.minRouteShelfWidth >= 4.0);
  assert.ok(stats.summitWidth >= 4.0);
  assert.ok(stats.summitDepth >= 3.5);
  assert.equal(stats.glacierPatches, 8);
  assert.ok(stats.groundSpires >= 30);
  assert.ok(stats.crystals >= 36);
  assert.ok(stats.edgeTouchSides.north >= 1);
  assert.ok(stats.edgeTouchSides.east >= 1);
  assert.ok(stats.edgeTouchSides.south >= 1);
  assert.ok(stats.edgeTouchSides.west >= 1);
});

test('nuclear cooling towers sit flush to the east wall and tower over the old profile', () => {
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
  assert.ok(stats.towerPeakHeight >= 26);
  assert.ok(stats.towerPeakHeight <= 28.5);
  assert.ok(Math.abs(stats.towerEastFaceX - rawBounds.maxX) < 0.001);
  assert.ok(stats.campusCenterX < 132);
});

test('nuclear reactor sign renders as a centered radiation trefoil bitmap', () => {
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

  const signTile = 0.42;
  const signCellSize = signTile * 0.88;
  const expectedPattern = [
    '00000011111000000',
    '00000111111100000',
    '00001111111110000',
    '00001111111110000',
    '00000111111100000',
    '00000011111000000',
    '00000000000000000',
    '01100001110000110',
    '11110001110001111',
    '11111001110011111',
    '11111001110011111',
    '01111100000011110',
    '00111100000011100',
    '00011100000011000',
    '00001100000010000',
    '00000000000000000',
    '00000000000000000'
  ];
  const signBacking = recorder.blocks.find((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    Math.abs(block.w - 7.3) < 0.0001 &&
    Math.abs(block.h - 7.3) < 0.0001 &&
    Math.abs(block.d - 0.08) < 0.0001
  );
  assert.ok(signBacking);

  const signOriginX = signBacking.x - (((expectedPattern[0].length - 1) * signTile) * 0.5);
  const signOriginY = signBacking.y + (((expectedPattern.length - 1) * signTile) * 0.5);
  const signBlocks = recorder.blocks.filter((block) =>
    block.kind === 'block' &&
    block.isSolid === false &&
    Math.abs(block.d - 0.08) < 0.0001 &&
    Math.abs(block.w - signCellSize) < 0.0001 &&
    Math.abs(block.h - signCellSize) < 0.0001
  );
  const actualPattern = expectedPattern.map((row) => row.split(''));

  for (let row = 0; row < actualPattern.length; row += 1) {
    for (let col = 0; col < actualPattern[row].length; col += 1) {
      actualPattern[row][col] = '0';
    }
  }

  for (const block of signBlocks) {
    const col = Math.round((block.x - signOriginX) / signTile);
    const row = Math.round((signOriginY - block.y) / signTile);
    assert.ok(col >= 0 && col < expectedPattern[0].length, 'sign tile column should fit the bitmap');
    assert.ok(row >= 0 && row < expectedPattern.length, 'sign tile row should fit the bitmap');
    actualPattern[row][col] = '1';
  }

  assert.equal(
    signBlocks.length,
    expectedPattern.join('').split('').filter((cell) => cell === '1').length
  );
  assert.deepEqual(
    actualPattern.map((row) => row.join('')),
    expectedPattern
  );
});
