import test from 'node:test';
import assert from 'node:assert/strict';

import { chooseSpawnPoint } from '../../shared/spawn-logic.js';

test('spawn point picks a valid candidate when checks pass', () => {
  const point = chooseSpawnPoint({
    boundsMin: 0,
    boundsMax: 100,
    padding: 4,
    random: () => 0.5,
    getGroundHeightAt: () => 1,
    isBlocked: () => false,
    isExcluded: () => false
  });
  assert.ok(Number.isFinite(point.x));
  assert.ok(Number.isFinite(point.z));
  assert.ok(point.x >= 4 && point.x <= 96);
  assert.ok(point.z >= 4 && point.z <= 96);
});

test('spawn point falls back to an unblocked spot when every candidate is excluded', () => {
  const blockedAt = new Set();
  const point = chooseSpawnPoint({
    boundsMin: 0,
    boundsMax: 100,
    padding: 4,
    random: () => 0.5,
    getGroundHeightAt: () => 1,
    // Geometry blocks the map center so the old blind fallback would clip.
    isBlocked: (x, z) => {
      const blocked = Math.abs(x - 50) < 5 && Math.abs(z - 50) < 5;
      if (blocked) blockedAt.add(`${x},${z}`);
      return blocked;
    },
    isExcluded: () => true
  });
  assert.ok(Number.isFinite(point.x));
  assert.ok(Number.isFinite(point.z));
  assert.ok(!(Math.abs(point.x - 50) < 5 && Math.abs(point.z - 50) < 5), 'fallback must not land in blocked geometry');
});

test('spawn point still returns the map center when no candidate has valid ground', () => {
  const point = chooseSpawnPoint({
    boundsMin: 0,
    boundsMax: 100,
    padding: 4,
    random: () => 0.5,
    getGroundHeightAt: () => -10,
    isBlocked: () => false,
    isExcluded: () => false
  });
  assert.equal(point.x, 50);
  assert.equal(point.z, 50);
});
