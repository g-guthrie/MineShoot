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

function directionAfterUpdate(view, state, dt) {
  view.updateCamera(dt, state);
  const out = new THREE.Vector3();
  state.camera.getWorldDirection(out);
  return out;
}

test('player view keeps reload bookkeeping out of character animation payloads', async () => {
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
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], 'reloading'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], 'reloadPct'), false);
});

test('player view strips reload bookkeeping when falling back to the rig api', async () => {
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
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], 'reloading'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], 'reloadPct'), false);
});

test('player view forwards yaw and derived turn rate into actor animation updates', async () => {
  const calls = [];
  const view = await loadPlayerView(() => null);

  view.updateAvatarAnimation(0.016, 0, baseAnimState({
    yaw: 0,
    actorVisual: {
      updateAnimation(_dt, animState) {
        calls.push(animState);
      }
    }
  }));
  view.updateAvatarAnimation(0.016, 0, baseAnimState({
    yaw: Math.PI * 0.25,
    actorVisual: {
      updateAnimation(_dt, animState) {
        calls.push(animState);
      }
    }
  }));

  assert.equal(calls[1].yaw, Math.PI * 0.25);
  assert.ok(calls[1].turnRate > 40);
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

test('player view getter helpers fill provided output vectors without allocating fallback results', async () => {
  const view = await loadPlayerView(() => null);
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.position.set(4, 5, 6);
  camera.lookAt(4, 5, -10);
  camera.updateMatrixWorld(true);

  const muzzleOut = new THREE.Vector3();
  const coreOut = new THREE.Vector3();
  const eyeOut = new THREE.Vector3();
  const throwOut = new THREE.Vector3();
  const state = { camera, actorVisual: null, avatarRigApi: null };

  assert.equal(view.getMuzzleWorldPosition(state, muzzleOut), muzzleOut);
  assert.equal(view.getCoreWorldPosition(state, coreOut), coreOut);
  assert.equal(view.getEyeWorldPosition(state, eyeOut), eyeOut);
  assert.equal(view.getThrowableOriginWorldPosition(state, throwOut), throwOut);
  assert.equal(eyeOut.x, camera.position.x);
  assert.equal(eyeOut.y, camera.position.y);
  assert.ok(coreOut.y < eyeOut.y);
  assert.ok(throwOut.y < eyeOut.y);
});

test('player view gives scoped sniper shots a stronger camera kick than rifle shots', async () => {
  const rifleView = await loadPlayerView(() => null);
  const rifleState = baseCameraState({
    currentWeaponId: 'rifle',
    adsActive: true,
    sniperMode: false,
    actorVisual: {
      setMuzzleVisible() {},
      triggerAction() {}
    },
    avatarRigApi: {
      rig: {
        gun: {},
        armR: { rotation: { x: 0 } },
        armL: { rotation: { x: 0 } }
      },
      triggerAction() {}
    }
  });
  directionAfterUpdate(rifleView, rifleState, 0.016);
  const rifleBaselineQuat = rifleState.camera.quaternion.clone();
  rifleView.triggerFireAction(rifleState);
  directionAfterUpdate(rifleView, rifleState, 0.04);
  const rifleDelta = rifleBaselineQuat.angleTo(rifleState.camera.quaternion);

  const sniperView = await loadPlayerView(() => null);
  const sniperState = baseCameraState({
    currentWeaponId: 'sniper',
    adsActive: true,
    sniperMode: true,
    adsFovForWeapon() { return 24; },
    actorVisual: {
      setMuzzleVisible() {},
      triggerAction() {}
    },
    avatarRigApi: {
      rig: {
        gun: {},
        armR: { rotation: { x: 0 } },
        armL: { rotation: { x: 0 } }
      },
      triggerAction() {}
    }
  });
  directionAfterUpdate(sniperView, sniperState, 0.016);
  const sniperBaselineQuat = sniperState.camera.quaternion.clone();
  sniperView.triggerFireAction(sniperState);
  directionAfterUpdate(sniperView, sniperState, 0.04);
  const sniperDelta = sniperBaselineQuat.angleTo(sniperState.camera.quaternion);

  assert.ok(sniperDelta > rifleDelta);
});

test('player view keeps the scoped sniper recoil pattern stronger than an unscoped recoil fallback', async () => {
  const view = await loadPlayerView(() => null);
  const makeState = (adsActive) => baseCameraState({
    currentWeaponId: 'sniper',
    adsActive,
    sniperMode: !!adsActive,
    adsFovForWeapon() { return 24; },
    actorVisual: {
      setMuzzleVisible() {},
      triggerAction() {}
    },
    avatarRigApi: {
      rig: {
        gun: {},
        armR: { rotation: { x: 0 } },
        armL: { rotation: { x: 0 } }
      },
      triggerAction() {}
    }
  });

  const unscoped = makeState(false);
  directionAfterUpdate(view, unscoped, 0.016);
  view.triggerFireAction(unscoped);
  const unscopedBaseline = unscoped.camera.getWorldDirection(new THREE.Vector3()).clone();
  const unscopedAfter = directionAfterUpdate(view, unscoped, 0.04).clone();
  const unscopedDelta = unscopedBaseline.angleTo(unscopedAfter);

  const scopedView = await loadPlayerView(() => null);
  const scoped = makeState(true);
  directionAfterUpdate(scopedView, scoped, 0.016);
  scopedView.triggerFireAction(scoped);
  const scopedBaseline = scoped.camera.getWorldDirection(new THREE.Vector3()).clone();
  const scopedAfter = directionAfterUpdate(scopedView, scoped, 0.04).clone();
  const scopedDelta = scopedBaseline.angleTo(scopedAfter);

  assert.ok(scopedDelta > unscopedDelta);
});
