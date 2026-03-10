import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveHitscanShot } from '../shared/hitscan-authority.js';

function makeWeaponStats(overrides = {}) {
  return {
    id: 'rifle',
    pellets: 1,
    hipfireSpread: 0.01,
    adsSpread: 0.01,
    maxRange: 100,
    adsMaxRange: 100,
    bodyDamage: 10,
    headDamage: 20,
    ...overrides
  };
}

function resolveSingleShot(viewFovDeg, weaponStats = makeWeaponStats()) {
  const shots = resolveHitscanShot({
    origin: { x: 0, y: 1.6, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    weaponStats,
    adsActive: false,
    viewFovDeg,
    shotToken: 'b',
    targets: [{ x: 0, y: 1.6, z: -50 }],
    worldBoxes: []
  });
  assert.equal(shots.length, 1);
  return shots[0];
}

test('hitscan spread follows the current on-screen FOV', () => {
  const hipfireShot = resolveSingleShot(75);
  const zoomedShot = resolveSingleShot(56);

  assert.ok(Math.abs(zoomedShot.point.x) < Math.abs(hipfireShot.point.x));
  assert.ok(Math.abs(zoomedShot.point.y - 1.6) < Math.abs(hipfireShot.point.y - 1.6));
});

test('hitscan view FOV clamps to the weapon zoom range', () => {
  const zoomedShot = resolveSingleShot(56);
  const overZoomedShot = resolveSingleShot(24);

  assert.equal(overZoomedShot.point.x, zoomedShot.point.x);
  assert.equal(overZoomedShot.point.y, zoomedShot.point.y);
  assert.equal(overZoomedShot.point.z, zoomedShot.point.z);
});

test('sniper spread honors deeper scoped FOV values', () => {
  const weaponStats = makeWeaponStats({ id: 'sniper' });
  const hipfireShot = resolveSingleShot(75, weaponStats);
  const scopedShot = resolveSingleShot(24, weaponStats);

  assert.ok(Math.abs(scopedShot.point.x) < Math.abs(hipfireShot.point.x));
  assert.ok(Math.abs(scopedShot.point.y - 1.6) < Math.abs(hipfireShot.point.y - 1.6));
});
