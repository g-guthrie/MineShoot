import test from 'node:test';
import assert from 'node:assert/strict';

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

test('cell bounds preserve the old authored cell footprint', () => {
  const centerCell = quadrantBounds('r1c1', 6);
  assert.equal(Math.round(centerCell.maxX - centerCell.minX), 42);
  assert.equal(Math.round(centerCell.maxZ - centerCell.minZ), 42);

  const biome = biomeAtPosition((centerCell.minX + centerCell.maxX) * 0.5, (centerCell.minZ + centerCell.maxZ) * 0.5);
  assert.equal(biome, DEFAULT_QUADRANT_MAP[4].biome);
});

test('lms beacons emit one anchor per biome cell', () => {
  const anchors = buildLmsBeaconAnchors();
  assert.equal(anchors.length, 9);
  assert.equal(new Set(anchors.map((anchor) => anchor.id)).size, 9);
  assert.equal(new Set(anchors.map((anchor) => String(anchor.row) + '-' + String(anchor.col))).size, 9);
});

test('headless world collision data builds for the authored 3x3 layout', () => {
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
