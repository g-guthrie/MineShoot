import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

import {
  gameplayTuning,
  getSelectableWeaponIds,
  getWeaponFalloffProfile,
  getWeaponPresentation,
  resolveWeaponAimProfile
} from '../../shared/gameplay-tuning.js';
import { resolveHitscanShot } from '../../shared/hitscan-authority.js';

function createHitbox(type, center, size, targetId = 'target') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial());
  mesh.position.set(center.x, center.y, center.z);
  mesh.userData = {
    type,
    ownerType: 'enemy',
    targetId
  };
  mesh.updateMatrixWorld(true);
  return mesh;
}

async function loadHitscanHarness(pistolOverrides = {}, targets = []) {
  const [tracerCode, weaponRuntimeCode, shotRuntimeCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/combat/hitscan-tracer-runtime.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/combat/hitscan-weapon-runtime.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/combat/hitscan-shot-runtime.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/combat/hitscan.js', import.meta.url), 'utf8')
  ]);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 200);
  camera.position.set(0, 1.6, 0);
  camera.lookAt(new THREE.Vector3(0, 1.6, -10));
  scene.add(camera);

  const runtime = {
    triggeredActions: [],
    GameShared: {
      gameplayTuning: {
        ...gameplayTuning,
        weaponStats: {
          ...gameplayTuning.weaponStats,
          pistol: {
            ...gameplayTuning.weaponStats.pistol,
            ...pistolOverrides
          }
        }
      },
      getSelectableWeaponIds,
      getWeaponFalloffProfile,
      getWeaponPresentation,
      resolveWeaponAimProfile,
      hitscanAuthority: {
        resolveHitscanShot(options) {
          runtime.lastShotOptions = options;
          return resolveHitscanShot(options);
        }
      },
      damage: null
    },
    GameEnemy: {
      getLockTargets() {
        return targets;
      },
      getHitboxArray() {
        const out = [];
        for (const target of targets) {
          if (target.bodyHitbox) out.push(target.bodyHitbox);
          if (target.headHitbox) out.push(target.headHitbox);
        }
        return out;
      }
    },
    GameNet: {
      getLockTargets() { return []; },
      getHitboxArray() { return []; }
    },
    GameWorld: {
      getCollidables() { return []; }
    },
    GamePlayer: {
      getAdsState() { return { active: false, weaponId: 'pistol' }; },
      getCamera() { return camera; },
      getMuzzleWorldPosition() { return new THREE.Vector3(0, 1.6, 0); },
      getRotation() { return { yaw: 0, pitch: 0 }; },
      getPosition() { return new THREE.Vector3(0, 1.6, 0); },
      setAdsEnabled() {},
      triggerAction(action, options) {
        runtime.triggeredActions.push({
          action: String(action || ''),
          options: options || null
        });
        return true;
      }
    }
  };

  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    THREE,
    window: {
      innerWidth: 1280,
      innerHeight: 720
    },
    performance: {
      now() { return sandbox.__now; }
    },
    __now: 1000,
    console
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(tracerCode, context);
  vm.runInContext(weaponRuntimeCode, context);
  vm.runInContext(shotRuntimeCode, context);
  vm.runInContext(code, context);
  sandbox.__MAYHEM_RUNTIME.GameHitscan.setWeapon('pistol');

  return {
    camera,
    runtime: sandbox.__MAYHEM_RUNTIME,
    GameHitscan: sandbox.__MAYHEM_RUNTIME.GameHitscan,
    setNow(value) {
      sandbox.__now = Number(value || 0);
    }
  };
}

test('pistol local fire keeps only one winning pellet hit', async () => {
  const bodyHitbox = createHitbox('body', { x: 0, y: 1.5, z: -10 }, { x: 1.2, y: 1.2, z: 0.8 }, 'enemy:1');
  const headHitbox = createHitbox('head', { x: 0, y: 2.15, z: -10 }, { x: 0.45, y: 0.35, z: 0.35 }, 'enemy:1');
  const harness = await loadHitscanHarness({
    pellets: 12,
    hipfireSpread: 0.12,
    maxRange: 24,
    adsMaxRange: 28,
    singleHitFromPellets: true,
    aimProfile: {
      hipfire: { spread: 0.12, maxRange: 24 },
      ads: { spread: 0.08, maxRange: 28 }
    }
  }, [{
    targetId: 'enemy:1',
    ownerType: 'enemy',
    worldPos: new THREE.Vector3(0, 1.5, -10),
    hitbox: bodyHitbox,
    bodyHitbox,
    headHitbox,
    alive: true
  }]);

  const hits = [];
  let misses = 0;
  const fired = harness.GameHitscan.fire(
    harness.camera,
    (hitboxMesh, hitPoint, distance, hitType) => {
      hits.push({
        hitboxType: hitboxMesh.userData.type,
        hitType,
        point: hitPoint,
        distance
      });
    },
    () => { misses += 1; },
    'body-lock'
  );

  assert.equal(fired, true);
  assert.equal(hits.length, 1);
  assert.equal(misses, 0);
  assert.equal(['body', 'head'].includes(hits[0].hitboxType), true);
});

test('pistol local fire still succeeds with the shared pellet weapon config', async () => {
  const bodyHitbox = createHitbox('body', { x: 0, y: 1.5, z: -10 }, { x: 1.2, y: 1.2, z: 0.8 }, 'enemy:2');
  const headHitbox = createHitbox('head', { x: 0, y: 2.15, z: -10 }, { x: 0.45, y: 0.35, z: 0.35 }, 'enemy:2');
  const harness = await loadHitscanHarness({
    pellets: 12,
    hipfireSpread: 0.06,
    maxRange: 24,
    adsMaxRange: 28,
    singleHitFromPellets: true,
    aimProfile: {
      hipfire: { spread: 0.06, maxRange: 24 },
      ads: { spread: 0.035, maxRange: 28 }
    }
  }, [{
    targetId: 'enemy:2',
    ownerType: 'enemy',
    worldPos: new THREE.Vector3(0, 1.5, -10),
    hitbox: bodyHitbox,
    bodyHitbox,
    headHitbox,
    alive: true
  }]);

  let hitCount = 0;
  const fired = harness.GameHitscan.fire(
    harness.camera,
    () => { hitCount += 1; },
    () => {},
    'pellet-token'
  );

  assert.equal(fired, true);
  assert.equal(hitCount, 1);
});

test('pistol reticle spec uses the shared crosshair path instead of the shotgun circle', async () => {
  const harness = await loadHitscanHarness();

  assert.deepEqual(JSON.parse(JSON.stringify(harness.GameHitscan.getReticleSpec('pistol'))), {
    type: 'crosshair',
    size: 0,
    adsActive: false,
    targetGroup: 'crosshair',
    targetSource: 'center'
  });
});

test('reticle target preview reports the active reticle group for each weapon family', async () => {
  const bodyHitbox = createHitbox('body', { x: 0, y: 1.5, z: -10 }, { x: 1.2, y: 1.2, z: 0.8 }, 'enemy:preview');
  const headHitbox = createHitbox('head', { x: 0, y: 2.15, z: -10 }, { x: 0.45, y: 0.35, z: 0.35 }, 'enemy:preview');
  const harness = await loadHitscanHarness({}, [{
    targetId: 'enemy:preview',
    ownerType: 'enemy',
    worldPos: new THREE.Vector3(0, 1.5, -10),
    hitbox: bodyHitbox,
    bodyHitbox,
    headHitbox,
    alive: true
  }]);

  assert.deepEqual(JSON.parse(JSON.stringify(harness.GameHitscan.getReticleTargetPreview(harness.camera))), {
    currentAimTargetId: 'enemy:preview',
    reticleTarget: {
      group: 'crosshair',
      active: true
    }
  });

  harness.GameHitscan.setWeapon('shotgun');
  assert.deepEqual(JSON.parse(JSON.stringify(harness.GameHitscan.getReticleTargetPreview(harness.camera))), {
    currentAimTargetId: 'enemy:preview',
    reticleTarget: {
      group: 'circle',
      active: true
    }
  });
});

test('spread metrics track the true hitscan area instead of bloom scale multipliers', async () => {
  const harness = await loadHitscanHarness({
    hipfireSpread: 0.05,
    adsSpread: 0.03,
    hipfireCylinderRadiusWu: 0.8,
    adsCylinderRadiusWu: 1.0,
    hipfireBloomScale: 4,
    adsBloomScale: 0.25,
    aimProfile: {
      hipfire: { spread: 0.05, maxRange: 24 },
      ads: { spread: 0.03, maxRange: 28 }
    }
  });

  const hipfireMetrics = harness.GameHitscan.getSpreadMetrics('pistol');
  assert.equal(Math.round(hipfireMetrics.radiusPx), 19);
  assert.equal(Math.round(hipfireMetrics.radiusXpx), 19);
  assert.equal(Math.round(hipfireMetrics.radiusYpx), 19);
});

test('pistol local fire spends the shot and misses when targets are out of range', async () => {
  const bodyHitbox = createHitbox('body', { x: 0, y: 1.5, z: -50 }, { x: 1.2, y: 1.2, z: 0.8 }, 'enemy:3');
  const harness = await loadHitscanHarness({}, []);
  harness.runtime.GameEnemy.getLockTargets = function () {
    return [{
      targetId: 'enemy:3',
      ownerType: 'enemy',
      worldPos: new THREE.Vector3(0, 1.5, -50),
      hitbox: bodyHitbox,
      bodyHitbox,
      alive: true
    }];
  };
  harness.runtime.GameEnemy.getHitboxArray = function () {
    return [bodyHitbox];
  };
  let misses = 0;

  const beforeAmmo = harness.GameHitscan.getCurrentWeapon().ammoInMag;
  const fired = harness.GameHitscan.fire(
    harness.camera,
    () => {
      throw new Error('expected no hit');
    },
    () => { misses += 1; },
    'no-lock'
  );
  const afterAmmo = harness.GameHitscan.getCurrentWeapon().ammoInMag;

  assert.equal(fired, true);
  assert.equal(misses, 1);
  assert.equal(beforeAmmo - afterAmmo, 1);
});

test('firearms auto-reload after the magazine empties and refill after reload time elapses', async () => {
  const harness = await loadHitscanHarness({
    magazineSize: 2,
    reloadMs: 900,
    cooldownMs: 10,
    pellets: 1,
    singleHitFromPellets: false,
    maxRange: 24,
    aimProfile: {
      hipfire: { spread: 0, maxRange: 24 },
      ads: { spread: 0, maxRange: 24 }
    }
  }, []);

  harness.setNow(1000);
  assert.equal(harness.GameHitscan.fire(harness.camera, () => {}, () => {}, 'shot-1'), true);
  harness.setNow(1020);
  assert.equal(harness.GameHitscan.fire(harness.camera, () => {}, () => {}, 'shot-2'), true);

  const emptyState = harness.GameHitscan.getCurrentWeapon();
  assert.equal(emptyState.ammoInMag, 0);
  assert.equal(emptyState.reloading, true);
  assert.ok(emptyState.reloadRemaining > 0);

  harness.setNow(2000);
  const reloadedState = harness.GameHitscan.getCurrentWeapon();
  assert.equal(reloadedState.reloading, false);
  assert.equal(reloadedState.ammoInMag, 2);
});

test('manual reload starts only after the magazine has spent rounds', async () => {
  const harness = await loadHitscanHarness({
    magazineSize: 3,
    reloadMs: 900,
    cooldownMs: 10,
    pellets: 1,
    singleHitFromPellets: false,
    maxRange: 24,
    aimProfile: {
      hipfire: { spread: 0, maxRange: 24 },
      ads: { spread: 0, maxRange: 24 }
    }
  }, []);

  harness.setNow(1000);
  assert.equal(harness.GameHitscan.reloadCurrentWeapon(), false);

  assert.equal(harness.GameHitscan.fire(harness.camera, () => {}, () => {}, 'shot-1'), true);
  harness.setNow(1020);

  assert.equal(harness.GameHitscan.reloadCurrentWeapon(), true);
  assert.equal(harness.GameHitscan.getCurrentWeapon().reloading, true);
});

test('manual reload notifies the player rig so the reload pose starts immediately', async () => {
  const harness = await loadHitscanHarness({
    magazineSize: 3,
    reloadMs: 900,
    cooldownMs: 10,
    pellets: 1,
    singleHitFromPellets: false,
    maxRange: 24,
    aimProfile: {
      hipfire: { spread: 0, maxRange: 24 },
      ads: { spread: 0, maxRange: 24 }
    }
  }, []);

  harness.setNow(1000);
  assert.equal(harness.GameHitscan.fire(harness.camera, () => {}, () => {}, 'shot-1'), true);
  harness.setNow(1020);

  assert.equal(harness.GameHitscan.reloadCurrentWeapon(), true);
  assert.equal(harness.runtime.triggeredActions.length, 1);
  assert.equal(harness.runtime.triggeredActions[0].action, 'reload');
  assert.equal(harness.runtime.triggeredActions[0].options.duration, 0.9);
  assert.equal(harness.runtime.triggeredActions[0].options.weaponId, 'pistol');
});

test('empty-mag auto reload notifies the player rig so the reload pose starts immediately', async () => {
  const harness = await loadHitscanHarness({
    magazineSize: 2,
    reloadMs: 900,
    cooldownMs: 10,
    pellets: 1,
    singleHitFromPellets: false,
    maxRange: 24,
    aimProfile: {
      hipfire: { spread: 0, maxRange: 24 },
      ads: { spread: 0, maxRange: 24 }
    }
  }, []);

  harness.setNow(1000);
  assert.equal(harness.GameHitscan.fire(harness.camera, () => {}, () => {}, 'shot-1'), true);
  harness.setNow(1020);
  assert.equal(harness.GameHitscan.fire(harness.camera, () => {}, () => {}, 'shot-2'), true);

  assert.equal(harness.runtime.triggeredActions.length, 1);
  assert.equal(harness.runtime.triggeredActions[0].action, 'reload');
  assert.equal(harness.runtime.triggeredActions[0].options.duration, 0.9);
  assert.equal(harness.runtime.triggeredActions[0].options.weaponId, 'pistol');
});

test('tracer renderer uses traveled head-tail distance on early frames', async () => {
  const harness = await loadHitscanHarness();
  const configuredSegmentLength = getWeaponPresentation('pistol').tracer.segmentLength;
  const tracerSpeed = getWeaponPresentation('pistol').tracer.speed;

  const fired = harness.GameHitscan.fire(
    harness.camera,
    () => {},
    () => {},
    'tracer-scale'
  );
  assert.equal(fired, true);

  const dt = 1 / 2000;
  harness.GameHitscan.updateTracers(dt);

  const tracerMesh = harness.camera.parent.children.find((child) => child && child.isInstancedMesh);
  assert.ok(tracerMesh);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  let foundActiveTracer = false;

  for (let i = 0; i < tracerMesh.count; i++) {
    tracerMesh.getMatrixAt(i, matrix);
    matrix.decompose(position, quaternion, scale);
    if (
      Math.abs(scale.x) <= 1e-6 &&
      Math.abs(scale.y) <= 1e-6 &&
      Math.abs(scale.z) <= 1e-6 &&
      position.length() <= 1e-6
    ) {
      continue;
    }
    foundActiveTracer = true;
    break;
  }

  assert.equal(foundActiveTracer, true);

  const expectedVisibleLength = Math.min(configuredSegmentLength, tracerSpeed * dt) * 0.82;
  assert.ok(scale.y > 0.05);
  assert.ok(scale.y <= expectedVisibleLength + 0.05);
  assert.ok(scale.y < configuredSegmentLength * 0.82);
});
