import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

import { gameplayTuning } from '../../shared/gameplay-tuning.js';

async function loadTrajectoryHarness(options = {}) {
  const code = await fs.readFile(new URL('../../js/combat/throwables-trajectory.js', import.meta.url), 'utf8');
  const scene = new THREE.Scene();
  let lastIntent = null;
  const runtime = {
    GamePlayer: options.playerApi || null
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);

  const factory = sandbox.__MAYHEM_RUNTIME.GameThrowablesTrajectory;
  const api = factory.create({
    getDefs() {
      return options.defs || gameplayTuning.throwables;
    },
    getScene() {
      return scene;
    },
    getMechanicsTuning() {
      return options.mechanicsTuning || gameplayTuning.throwableMechanics;
    },
    getDistanceTuning() {
      return options.distanceTuning || {};
    },
    getWorldTargets() {
      return options.worldTargets || { worldMeshes: [], hitboxes: [] };
    },
    segmentCollision(start, end) {
      if (typeof options.segmentCollision === 'function') {
        return options.segmentCollision(start, end);
      }
      return null;
    },
    plasmaMaxLife(def) {
      if (typeof options.plasmaMaxLife === 'function') {
        return options.plasmaMaxLife(def);
      }
      return Number(def && def.maxLife || def && def.fuse || 2.2);
    },
    onIntentBuilt(intent) {
      lastIntent = intent;
    }
  });

  return {
    api,
    scene,
    getLastIntent() {
      return lastIntent;
    }
  };
}

function makeCamera() {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 200);
  camera.position.set(0, 1.6, 0);
  camera.lookAt(0, 1.6, -1);
  camera.updateMatrixWorld(true);
  return camera;
}

test('throwables trajectory builds throw intent from the held origin and center-screen hit target', async () => {
  const target = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial()
  );
  target.position.set(0, 1.6, -8);
  target.updateMatrixWorld(true);

  const harness = await loadTrajectoryHarness({
    worldTargets: {
      worldMeshes: [target],
      hitboxes: []
    },
    playerApi: {
      getThrowableOriginWorldPosition() {
        return new THREE.Vector3(0.4, 1.2, 0.1);
      }
    }
  });
  const camera = makeCamera();

  const intent = harness.api.buildThrowIntent(camera);

  assert.ok(intent);
  assert.equal(intent.origin.x, 0.4);
  assert.equal(intent.origin.y, 1.2);
  assert.equal(intent.origin.z, 0.1);
  assert.ok(intent.aimPoint.z < -7);
  assert.ok(intent.direction.z < -0.98);
  assert.ok(harness.getLastIntent());
  assert.equal(harness.getLastIntent().origin.x, 0.4);
});

test('throwables trajectory preview creates visible helpers, clears them, and removes them on reset', async () => {
  const harness = await loadTrajectoryHarness();
  const intent = {
    origin: new THREE.Vector3(0, 1.1, 0),
    direction: new THREE.Vector3(0, 0, -1)
  };

  harness.api.setDebugPreviewVolumesEnabled(true);
  const preview = harness.api.updateTrajectoryPreview('molotov', intent);

  assert.ok(preview);
  assert.equal(preview.type, 'molotov');
  assert.equal(harness.scene.children.length, 5);

  const areaDisk = harness.scene.children.find((node) => node && node.geometry && node.geometry.type === 'CylinderGeometry');
  const nearDots = harness.scene.children.find((node) => node && node.isPoints);
  assert.ok(areaDisk);
  assert.equal(areaDisk.visible, true);
  assert.ok(nearDots);
  assert.equal(nearDots.visible, true);

  harness.api.clearTrajectoryPreview();
  assert.equal(areaDisk.visible, false);
  assert.equal(nearDots.visible, false);

  harness.api.reset();
  assert.equal(harness.scene.children.length, 0);
});

test('throwables trajectory falls back to a forward aim point when nothing is hit', async () => {
  const harness = await loadTrajectoryHarness();
  const camera = makeCamera();

  const intent = harness.api.buildThrowIntent(camera);

  assert.ok(intent);
  assert.ok(intent.aimPoint.z < -90);
  assert.ok(intent.direction.z < -0.98);
});

test('throwables trajectory exposes plasma debug state from the simulated arc', async () => {
  const harness = await loadTrajectoryHarness({
    distanceTuning: {
      plasmaAcquireRange: 16
    },
    segmentCollision(start, end) {
      if (end.z > -2) return null;
      return {
        kind: 'world',
        object: null,
        point: new THREE.Vector3(0, 1.2, -2.2),
        distance: start.distanceTo(new THREE.Vector3(0, 1.2, -2.2))
      };
    }
  });
  const camera = makeCamera();

  const state = harness.api.getPlasmaDebugState(camera);

  assert.ok(state);
  assert.equal(state.catchRadius, gameplayTuning.throwables.plasma.catchRadius);
  assert.ok(state.fuseSec > 0);
  assert.ok(state.trackDuration > 0);
  assert.ok(state.trackLerp > 0);
  assert.ok(state.curveStrength > 0);
  assert.ok(state.referenceDistance > 1);
  assert.ok(state.referenceDistance < 16);
});
