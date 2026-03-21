import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import { getWeaponPresentation, resolveReloadPresentationState } from '../../shared/gameplay-tuning.js';

async function loadPlayerView(getCurrentWeaponState) {
  const code = await fs.readFile(new URL('../../js/actors/player-view.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        getWeaponPresentation,
        resolveReloadPresentationState
      }
    },
    globalThis: null,
    console,
    THREE,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GamePlayerView.create({
    getCurrentWeaponState
  });
}

function baseAnimState(overrides = {}) {
  return {
    actorVisual: null,
    avatarRigApi: null,
    runSpeed: 14,
    sprinting: false,
    isGrounded: true,
    pitch: 0,
    hooked: false,
    hookPullStartedAt: 0,
    choked: false,
    chokeStartedAt: 0,
    adsActive: false,
    movingForward: false,
    movingBackward: false,
    movingLeft: false,
    movingRight: false,
    ...overrides
  };
}

function baseCameraState(overrides = {}) {
  return {
    camera: new THREE.PerspectiveCamera(75, 1, 0.1, 100),
    playerX: 0,
    playerZ: 0,
    posY: 1.6,
    yaw: 0,
    pitch: 0,
    currentWeaponId: 'rifle',
    avatarGroup: new THREE.Group(),
    avatarRigApi: null,
    avatarAliveVisible: true,
    sniperMode: false,
    adsActive: false,
    sprinting: false,
    speedNorm: 0,
    choked: false,
    chokeStartedAt: 0,
    chokeLift: 0,
    updateAvatarPose() {},
    getWorldCollidables() { return []; },
    pitchLimit: Math.PI * 0.5,
    cameraShoulder: 1.75,
    cameraDist: 3.74,
    thirdHeight: 0.7,
    sniperScopeShoulder: 0.08,
    adsShoulder: 2,
    sniperScopeDist: 0.14,
    adsDist: 1.72,
    sniperScopeHeight: 0.12,
    adsHeight: 0.46,
    sniperScopeBlendSpeed: 18,
    adsBlendSpeed: 16,
    firstPersonSmooth: 20,
    thirdSmooth: 12,
    cameraFov: 75,
    adsFov: 56,
    adsFovForWeapon() { return 56; },
    ...overrides
  };
}

test('player view forwards reload state and progress into actor visuals', async () => {
  const calls = [];
  const view = await loadPlayerView(function () {
    return {
      reloading: true,
      reloadMs: 1000,
      reloadRemaining: 250
    };
  });

  view.updateAvatarAnimation(0.016, 0, baseAnimState({
    actorVisual: {
      updateAnimation(_dt, animState) {
        calls.push(animState);
      }
    }
  }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].reloading, true);
  assert.ok(Math.abs(calls[0].reloadPct - 0.75) < 0.000001);
});

test('player view falls back to the rig api when no actor visual wrapper is present', async () => {
  const calls = [];
  const view = await loadPlayerView(function () {
    return {
      reloading: true,
      reloadMs: 1200,
      reloadRemaining: 300
    };
  });

  view.updateAvatarAnimation(0.016, 0, baseAnimState({
    avatarRigApi: {
      updateAnimation(_dt, animState) {
        calls.push(animState);
      }
    }
  }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].reloading, true);
  assert.ok(Math.abs(calls[0].reloadPct - 0.75) < 0.000001);
});

test('player view applies sprint FOV scaling from speedNorm', async () => {
  const fastView = await loadPlayerView(() => null);
  const fastState = baseCameraState({
    sprinting: true,
    speedNorm: 1
  });
  fastView.updateCamera(1, fastState);

  const slowView = await loadPlayerView(() => null);
  const slowState = baseCameraState({
    sprinting: true,
    speedNorm: 0
  });
  slowView.updateCamera(1, slowState);

  assert.ok(fastState.camera.fov > slowState.camera.fov);
  assert.equal(slowState.camera.fov, 75);
});

test('player view clears muzzle flash on frame updates without relying on timers', async () => {
  const muzzleStates = [];
  const view = await loadPlayerView(() => null);
  const actorVisual = {
    setMuzzleVisible(visible) {
      muzzleStates.push(visible);
    },
    triggerAction() {}
  };
  const avatarRigApi = {
    rig: {
      gun: {},
      armR: { rotation: { x: 0 } },
      armL: { rotation: { x: 0 } }
    },
    triggerAction() {}
  };
  const cameraState = baseCameraState({
    actorVisual,
    avatarRigApi
  });

  view.triggerFireAction({
    currentWeaponId: 'rifle',
    actorVisual,
    avatarRigApi
  });

  assert.deepEqual(muzzleStates, [true]);

  view.updateCamera(0.03, cameraState);
  assert.deepEqual(muzzleStates, [true]);

  view.updateCamera(0.04, cameraState);
  assert.deepEqual(muzzleStates, [true, false]);
});
