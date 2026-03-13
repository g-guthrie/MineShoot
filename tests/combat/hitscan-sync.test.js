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
import { sampleSpreadOffset } from '../../shared/hitscan-authority.js';

function createHitbox(type, center, size, targetId) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial());
  mesh.position.set(center.x, center.y, center.z);
  mesh.userData = {
    type,
    ownerType: 'net',
    targetId
  };
  mesh.updateMatrixWorld(true);
  return mesh;
}

function roundPoint(point) {
  return {
    x: Number(point.x.toFixed(6)),
    y: Number(point.y.toFixed(6)),
    z: Number(point.z.toFixed(6))
  };
}

function expectedPointForPellet(camera, hitbox, weaponStats, pelletIndex, shotToken) {
  const offset = sampleSpreadOffset(weaponStats, false, pelletIndex, shotToken);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(offset.x, offset.y), camera);
  raycaster.far = Number(weaponStats.maxRange || 0);
  const hit = raycaster.intersectObject(hitbox, false)[0];
  return hit ? roundPoint(hit.point) : null;
}

async function loadHitscanHarness({ weaponId, targets, netActive = true }) {
  const code = await fs.readFile(new URL('../../js/combat/hitscan.js', import.meta.url), 'utf8');
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 200);
  camera.position.set(0, 1.6, 0);
  camera.lookAt(new THREE.Vector3(0, 1.6, -10));
  camera.updateProjectionMatrix();

  const runtime = {
    GameShared: {
      gameplayTuning,
      getSelectableWeaponIds,
      getWeaponFalloffProfile,
      getWeaponPresentation,
      resolveWeaponAimProfile,
      hitscanAuthority: {
        sampleSpreadOffset
      },
      damage: null
    },
    GameEnemy: {
      getLockTargets() { return []; },
      getHitboxArray() { return []; }
    },
    GameNet: {
      isActive() { return netActive; },
      getLockTargets() { return targets; },
      getHitboxArray() {
        const out = [];
        for (const target of targets) {
          if (target.bodyHitbox) out.push(target.bodyHitbox);
          if (target.headHitbox) out.push(target.headHitbox);
        }
        return out;
      }
    },
    GameWorld: {
      getCollidables() { return []; }
    },
    GamePlayer: {
      getAdsState() { return { active: false, weaponId }; },
      getCamera() { return camera; },
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
  sandbox.__MAYHEM_RUNTIME.GameHitscan.setWeapon(weaponId);

  return {
    camera,
    GameHitscan: sandbox.__MAYHEM_RUNTIME.GameHitscan,
    setNow(value) {
      sandbox.__now = Number(value || 0);
    }
  };
}

test('rifle multiplayer fire reuses the shared shot-token spread sample', async () => {
  const targetId = 'net:rifle-target';
  const bodyHitbox = createHitbox('body', { x: 0, y: 1.6, z: -12 }, { x: 8, y: 8, z: 0.6 }, targetId);
  const harness = await loadHitscanHarness({
    weaponId: 'rifle',
    targets: [{
      targetId,
      ownerType: 'net',
      worldPos: new THREE.Vector3(0, 1.6, -12),
      hitbox: bodyHitbox,
      bodyHitbox,
      alive: true
    }]
  });

  const hits = [];
  const shotToken = 'sync-rifle';

  harness.GameHitscan.fire(
    harness.camera,
    (_hitboxMesh, hitPoint) => { hits.push(roundPoint(hitPoint)); },
    () => {},
    shotToken
  );

  harness.setNow(2000);
  harness.GameHitscan.fire(
    harness.camera,
    (_hitboxMesh, hitPoint) => { hits.push(roundPoint(hitPoint)); },
    () => {},
    shotToken
  );

  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0], hits[1]);
  assert.deepEqual(
    hits[0],
    expectedPointForPellet(harness.camera, bodyHitbox, gameplayTuning.weaponStats.rifle, 0, shotToken)
  );
});

test('shotgun multiplayer fire keeps pellet order aligned with the shared shot-token spread sample', async () => {
  const targetId = 'net:shotgun-target';
  const bodyHitbox = createHitbox('body', { x: 0, y: 1.6, z: -10 }, { x: 40, y: 20, z: 0.6 }, targetId);
  const harness = await loadHitscanHarness({
    weaponId: 'shotgun',
    targets: [{
      targetId,
      ownerType: 'net',
      worldPos: new THREE.Vector3(0, 1.6, -10),
      hitbox: bodyHitbox,
      bodyHitbox,
      alive: true
    }]
  });

  const shotToken = 'sync-shotgun';
  const firstFire = [];
  const secondFire = [];

  harness.GameHitscan.fire(
    harness.camera,
    (_hitboxMesh, hitPoint) => { firstFire.push(roundPoint(hitPoint)); },
    () => {},
    shotToken
  );

  harness.setNow(2500);
  harness.GameHitscan.fire(
    harness.camera,
    (_hitboxMesh, hitPoint) => { secondFire.push(roundPoint(hitPoint)); },
    () => {},
    shotToken
  );

  const expected = [];
  for (let pelletIndex = 0; pelletIndex < Number(gameplayTuning.weaponStats.shotgun.pellets || 0); pelletIndex++) {
    expected.push(expectedPointForPellet(
      harness.camera,
      bodyHitbox,
      gameplayTuning.weaponStats.shotgun,
      pelletIndex,
      shotToken
    ));
  }

  assert.equal(firstFire.length, Number(gameplayTuning.weaponStats.shotgun.pellets || 0));
  assert.deepEqual(firstFire, secondFire);
  assert.deepEqual(firstFire, expected);
});
