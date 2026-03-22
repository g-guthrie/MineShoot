import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveHitscanShot } from '../../shared/hitscan-authority.js';
import { gameplayTuning } from '../../shared/gameplay-tuning.js';

function makeWeaponStats(overrides = {}) {
  return {
    id: 'rifle',
    pellets: 1,
    hipfireSpread: 0.01,
    adsFovDeg: 56,
    maxRange: 100,
    adsMaxRange: 100,
    bodyDamage: 10,
    headDamage: 20,
    ...overrides
  };
}

function makePistolStats(overrides = {}) {
  return makeWeaponStats({
    id: 'pistol',
    bodyDamage: 46,
    headDamage: 96,
    hipfireSpread: 0.137,
    adsFovDeg: 56,
    maxRange: 24,
    adsMaxRange: 28,
    pellets: 12,
    hipfireCylinderRadiusWu: 2.53,
    adsCylinderRadiusWu: 3.16,
    singleHitFromPellets: true,
    aimProfile: {
      hipfire: { spread: 0.137, maxRange: 24 },
      ads: { spread: 0.225, maxRange: 28 }
    },
    ...overrides
  });
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

function hitAreaAtDistance(spread, fovDeg, distance) {
  const halfAngle = Math.atan(Number(spread || 0) * Math.tan((Number(fovDeg || 0) * Math.PI / 180) * 0.5));
  const radius = Math.tan(halfAngle) * Number(distance || 0);
  return Math.PI * radius * radius;
}

test('shared pistol tuning keeps the legacy spread values for compatibility while exposing cylinder radii', () => {
  const pistol = gameplayTuning.weaponStats.pistol;
  assert.equal(pistol.hipfireCylinderRadiusWu, 2.53);
  assert.equal(pistol.adsCylinderRadiusWu, 3.16);
  assert.ok(Math.abs(hitAreaAtDistance(pistol.hipfireSpread, 75, 24) - 20) < 0.05);
  assert.ok(Math.abs(hitAreaAtDistance(pistol.adsSpread, pistol.adsFovDeg, 24) - 25.9) < 0.1);
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

test('ADS can resolve hitscan shots with perfect accuracy', () => {
  const shots = resolveHitscanShot({
    origin: { x: 0, y: 1.6, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    weaponStats: makeWeaponStats({
      id: 'rifle',
      hipfireSpread: 0.01,
      aimProfile: {
        hipfire: { spread: 0.01, maxRange: 100 },
        ads: { spread: 0, maxRange: 100 }
      }
    }),
    adsActive: true,
    viewFovDeg: 56,
    shotToken: 'perfect-ads',
    targets: [{ x: 0, y: 1.6, z: -50 }],
    worldBoxes: []
  });

  assert.equal(shots.length, 1);
  assert.equal(shots[0].point.x, 0);
  assert.equal(shots[0].point.y, 1.6);
});

test('hitscan clamp honors per-weapon ADS FOV tuning', () => {
  const weaponStats = makeWeaponStats({ adsFovDeg: 64 });
  const zoomedShot = resolveSingleShot(64, weaponStats);
  const overZoomedShot = resolveSingleShot(24, weaponStats);

  assert.equal(overZoomedShot.point.x, zoomedShot.point.x);
  assert.equal(overZoomedShot.point.y, zoomedShot.point.y);
  assert.equal(overZoomedShot.point.z, zoomedShot.point.z);
});

test('pistol keeps only one winning pellet even when many pellets can hit', () => {
  const shots = resolveHitscanShot({
    origin: { x: 0, y: 1.6, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    weaponStats: makePistolStats({
      hipfireSpread: 0.12,
      aimProfile: {
        hipfire: { spread: 0.12, maxRange: 24 },
        ads: { spread: 0.08, maxRange: 28 }
      }
    }),
    shotToken: 'single-winner',
    targets: [{ id: 'big-target', x: 0, y: 1.6, z: -10 }],
    worldBoxes: []
  });

  assert.equal(shots.length, 1);
  assert.equal(shots[0].mode, 'circle_scan');
  assert.equal(shots[0].sampleIndex >= 0, true);
});

test('pistol cylinder width does not widen with distance the way a cone would', () => {
  const near = resolveHitscanShot({
    origin: { x: 0, y: 1.6, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    weaponStats: makePistolStats(),
    shotToken: 'near-cylinder',
    targets: [{
      id: 'near-body',
      bodyBox: {
        min: { x: 0.55, y: 1.0, z: -8.4 },
        max: { x: 0.95, y: 2.0, z: -7.6 }
      }
    }],
    worldBoxes: []
  });

  const far = resolveHitscanShot({
    origin: { x: 0, y: 1.6, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    weaponStats: makePistolStats(),
    shotToken: 'far-cylinder',
    targets: [{
      id: 'far-body',
      bodyBox: {
        min: { x: 0.55, y: 1.0, z: -20.4 },
        max: { x: 0.95, y: 2.0, z: -19.6 }
      }
    }],
    worldBoxes: []
  });

  assert.equal(near.length, 1);
  assert.equal(far.length, 1);
});

test('pistol range cap prevents pellet hits beyond max range', () => {
  const shots = resolveHitscanShot({
    origin: { x: 0, y: 1.6, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    weaponStats: makePistolStats(),
    shotToken: 'too-far',
    targets: [{
      id: 'far-target',
      x: 0,
      y: 1.6,
      z: -40
    }],
    worldBoxes: []
  });

  assert.equal(shots.length, 0);
});

test('pistol can still naturally resolve a head hit from the winning pellet', () => {
  const shots = resolveHitscanShot({
    origin: { x: 0, y: 1.6, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    weaponStats: makePistolStats({
      hipfireSpread: 0.01,
      aimProfile: {
        hipfire: { spread: 0.01, maxRange: 24 },
        ads: { spread: 0.005, maxRange: 28 }
      }
    }),
    shotToken: 'natural-head',
    targets: [{
      id: 'close-head',
      bodyBox: {
        min: { x: 0.55, y: 1.0, z: -8.4 },
        max: { x: 1.35, y: 2.05, z: -7.6 }
      },
      headBox: {
        min: { x: -0.12, y: 1.45, z: -8.25 },
        max: { x: 0.12, y: 1.8, z: -7.95 }
      }
    }],
    worldBoxes: []
  });

  assert.equal(shots.length, 1);
  assert.equal(shots[0].hitType, 'head');
  assert.equal(shots[0].sampleIndex >= 0, true);
});
