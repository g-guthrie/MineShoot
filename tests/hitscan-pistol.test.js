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
} from '../shared/gameplay-tuning.js';
import { resolveHitscanShot } from '../shared/hitscan-authority.js';

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
  const code = await fs.readFile(new URL('../js/hitscan.js', import.meta.url), 'utf8');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 200);
  camera.position.set(0, 1.6, 0);
  camera.lookAt(new THREE.Vector3(0, 1.6, -10));
  scene.add(camera);

  const runtime = {
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
      getMuzzleWorldPosition() { return new THREE.Vector3(0, 1.6, 0); },
      getRotation() { return { yaw: 0, pitch: 0 }; },
      getPosition() { return new THREE.Vector3(0, 1.6, 0); },
      setAdsEnabled() {}
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

  vm.runInContext(code, vm.createContext(sandbox));
  sandbox.__MAYHEM_RUNTIME.GameHitscan.setWeapon('pistol');

  return {
    camera,
    runtime: sandbox.__MAYHEM_RUNTIME,
    GameHitscan: sandbox.__MAYHEM_RUNTIME.GameHitscan
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
