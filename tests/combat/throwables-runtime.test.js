import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

import { gameplayTuning } from '../../shared/gameplay-tuning.js';

async function loadThrowablesHarness(tuning = gameplayTuning) {
  const code = await fs.readFile(new URL('../../js/combat/throwables.js', import.meta.url), 'utf8');
  const scene = new THREE.Scene();
  const timeState = { now: 1000 };
  const runtime = {
    GameShared: {
      gameplayTuning: tuning
    },
    GameWorld: {
      getCollidables() { return []; },
      getGroundHeightAt() { return -50; }
    },
    GameEnemy: {
      getEnemies() { return []; },
      getHitboxArray() { return []; }
    }
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE,
    Date: {
      now() {
        return timeState.now;
      }
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  const GameThrowables = sandbox.__MAYHEM_RUNTIME.GameThrowables;
  GameThrowables.init(scene);
  return {
    GameThrowables,
    scene,
    timeState
  };
}

function countProjectileMeshes(scene, projectileType) {
  return scene.children.filter((node) => node && node.userData && node.userData.projectileType === projectileType).length;
}

test('throwables runtime clears predicted knives once the authoritative impact event arrives', async () => {
  const harness = await loadThrowablesHarness();
  const { GameThrowables, scene } = harness;

  const predicted = GameThrowables.throwPredicted('knife', {}, 'cthrow_knife', {
    origin: { x: 0, y: 1, z: 0 },
    direction: { x: 0, y: 0, z: -1 }
  });
  assert.equal(predicted, true);
  assert.equal(countProjectileMeshes(scene, 'knife'), 1);

  GameThrowables.confirmPredictedThrow('cthrow_knife', {
    projectileId: 'proj_knife'
  });
  GameThrowables.applyNetworkEvent({
    t: 'throw_impact',
    projectileId: 'proj_knife',
    projectileType: 'knife',
    impactType: 'world',
    x: 0,
    y: 1,
    z: -1
  });
  GameThrowables.update(0, function () {});

  assert.equal(countProjectileMeshes(scene, 'knife'), 0);
  assert.equal(GameThrowables.getDebugTelemetry().predictedCount, 0);
});

test('throwables runtime falls back to id labels when shared defs are missing', async () => {
  const harness = await loadThrowablesHarness({});
  const state = harness.GameThrowables.getState();

  assert.deepEqual(Object.keys(state), ['frag', 'plasma', 'molotov', 'knife']);
  assert.equal(state.frag.label, 'FRAG');
  assert.equal(state.knife.label, 'KNIFE');
  assert.equal(state.plasma.charges, 1);
});

test('throwables runtime eases remote projectile meshes toward new authoritative positions', async () => {
  const harness = await loadThrowablesHarness();
  const { GameThrowables, scene } = harness;

  GameThrowables.syncAuthoritativeState({
    projectiles: [{
      id: 'proj_remote',
      type: 'knife',
      ownerId: 'usr_other',
      x: 0,
      y: 1,
      z: 0,
      vx: 0,
      vy: 0,
      vz: -12,
      age: 0
    }],
    fireZones: []
  }, 'usr_self');

  const mesh = scene.children.find((node) => node && node.userData && node.userData.projectileType === 'knife');
  assert.ok(mesh);
  assert.equal(mesh.position.z, 0);

  GameThrowables.syncAuthoritativeState({
    projectiles: [{
      id: 'proj_remote',
      type: 'knife',
      ownerId: 'usr_other',
      x: 0,
      y: 1,
      z: -10,
      vx: 0,
      vy: 0,
      vz: -12,
      age: 0.5
    }],
    fireZones: []
  }, 'usr_self');

  assert.equal(mesh.position.z, 0);
  GameThrowables.update(0.016, function () {});
  assert.equal(mesh.position.z < 0, true);
  assert.equal(mesh.position.z > -10, true);
});
