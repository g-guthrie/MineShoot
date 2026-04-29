import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

import {
  createMovementInputState,
  stepAuthoritativeMovement
} from '../../shared/authoritative-movement.js';
import {
  buildAuthoritativeMotionRevision,
  buildReplayStepsFromPendingInputs,
  replayMotionState,
  shouldReplayAuthoritativeCorrection
} from '../../shared/authoritative-reconciliation.js';
import {
  EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS
} from '../../shared/entity-constants.js';

class FakeDocument {
  constructor() {
    this.listeners = new Map();
    this.pointerLockElement = { nodeType: 1 };
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const list = this.listeners.get(key) || [];
    list.push(handler);
    this.listeners.set(key, list);
  }

  removeEventListener() {}

  dispatch(type, event = {}) {
    const list = this.listeners.get(String(type || '')) || [];
    const payload = {
      preventDefault() {},
      repeat: false,
      button: 0,
      movementX: 0,
      movementY: 0,
      ...event
    };
    for (const handler of list) handler(payload);
  }
}

class FakeWindow {
  constructor() {
    this.listeners = new Map();
    this.innerWidth = 1280;
    this.innerHeight = 720;
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const list = this.listeners.get(key) || [];
    list.push(handler);
    this.listeners.set(key, list);
  }

  removeEventListener() {}

  dispatch(type, event = {}) {
    const list = this.listeners.get(String(type || '')) || [];
    for (const handler of list) handler(event);
  }
}

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

function createExpectedEntity(spawn) {
  return {
    x: Number(spawn.x || 0),
    y: EYE_HEIGHT,
    z: Number(spawn.z || 0),
    yaw: 0,
    pitch: 0,
    velocityY: 0,
    isGrounded: true,
    jumpHoldTimer: 0,
    jumpHeldLast: false,
    moveSpeedNorm: 0,
    sprinting: false,
    fastBackpedal: false
  };
}

function createInputState(patch = {}) {
  const input = createMovementInputState();
  Object.assign(input, patch);
  return input;
}

async function loadPlayerMovementHarness(options = {}) {
  const [inputBindingsCode, inputLabelsCode, statusCode, reconciliationCode, loadoutCode, cameraCode, inputCode, sprintCode, visualCode, motionStateCode, replayCode, statusBridgeCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/core/input-bindings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/core/input-labels.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-status.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-reconciliation.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-loadout.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-camera.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-input.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-sprint.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-visual.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-motion-state.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-replay.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-status-bridge.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player.js', import.meta.url), 'utf8')
  ]);
  const documentObj = new FakeDocument();
  const windowObj = new FakeWindow();
  const calls = {
    triggerActions: [],
    animationUpdates: [],
    audioPlays: [],
    gunOffsetUpdates: 0,
    cameraUpdates: []
  };
  const worldState = {
    bounds: options.bounds || { minX: 0, maxX: 50, minZ: 0, maxZ: 50, size: 50 },
    spawn: options.spawn || { x: 5, z: 6 },
    collisionBoxes: Array.isArray(options.collisionBoxes) ? options.collisionBoxes.slice() : [],
    getGroundHeightAt: typeof options.getGroundHeightAt === 'function'
      ? options.getGroundHeightAt
      : (() => 0)
  };
  const configuredWeaponStats = Object.assign({
    rifle: { id: 'rifle', adsFovDeg: 56 },
    sniper: { id: 'sniper', adsFovDeg: 24 }
  }, options.weaponStats || {});

  const runtime = {
    GameShared: {
      authoritativeMovement: {
        createMovementInputState,
        stepAuthoritativeMovement
      },
      authoritativeReconciliation: {
        buildAuthoritativeMotionRevision,
        buildReplayStepsFromPendingInputs,
        replayMotionState,
        shouldReplayAuthoritativeCorrection
      },
      gameplayTuning: {
        movement: {},
        network: options.networkTuning || {},
        weaponStats: configuredWeaponStats
      },
      entityConstants: {},
      getNetworkTuning() {
        return this.gameplayTuning.network || {};
      },
      getWeaponStats(weaponId) {
        return this.gameplayTuning.weaponStats[weaponId] || null;
      },
      resolveWeaponAdsFovDeg(weaponStats) {
        return Number(weaponStats && weaponStats.adsFovDeg || 56);
      },
      getSelectableWeaponIds() {
        return Object.keys(configuredWeaponStats);
      }
    },
    GamePlayerWorld: {
      create() {
        return {
          getWorldBounds() {
            return worldState.bounds;
          },
          getDefaultSpawnPoint() {
            return worldState.spawn;
          },
          getSpawnThreatPoints() {
            return [];
          },
          getRandomSpawnPoint() {
            return worldState.spawn;
          },
          getSpawnPadding() {
            return 8;
          },
          getGroundHeightAt(x, z) {
            return worldState.getGroundHeightAt(x, z);
          },
          getCollisionBoxes() {
            return worldState.collisionBoxes.slice();
          }
        };
      }
    },
    GameActorVisualFactory: {
      create() {
        const root = new THREE.Group();
        return {
          root,
          rigApi: null,
          rig: null,
          setAlive() {},
          setHitboxVisibility() {},
          syncHitboxes() {},
          setSpawnShield() {},
          setWeapon() {},
          setWorldTransform(position, nextYaw) {
            root.position.set(
              Number(position && position.x || 0),
              Number(position && position.y || 0),
              Number(position && position.z || 0)
            );
            root.rotation.y = Number(nextYaw || 0);
          },
          triggerAction(action, payload) {
            calls.triggerActions.push({
              action: String(action || ''),
              payload: payload ? JSON.parse(JSON.stringify(payload)) : null
            });
          }
        };
      }
    },
    GamePlayerView: {
      create() {
        return {
          updateAvatarAnimation(dt, speed, options) {
            calls.animationUpdates.push({
              dt: Number(dt || 0),
              speed: Number(speed || 0),
              options: options ? JSON.parse(JSON.stringify({
                sprinting: !!options.sprinting,
                fastBackpedal: !!options.fastBackpedal,
                isGrounded: !!options.isGrounded,
                adsActive: !!options.adsActive,
                movingForward: !!options.movingForward,
                movingBackward: !!options.movingBackward
              })) : null
            });
          },
          updateCamera(_dt, options) {
            if (!options || !options.camera) return;
            calls.cameraUpdates.push({
              firstPersonView: !!options.firstPersonView,
              inspectMode: !!options.inspectMode
            });
            const scopeActive = options.scopeTargetActive != null ? !!options.scopeTargetActive : !!options.adsActive;
            options.camera.position.set(
              Number(options.playerX || 0),
              Number(options.posY || 0),
              Number(options.playerZ || 0)
            );
            options.camera.fov = scopeActive
              ? Number(options.adsFovForWeapon(options.currentWeaponId) || options.adsFov || 56)
              : Number(options.cameraFov || 75);
            options.camera.updateProjectionMatrix();
          },
          syncAvatarVisibility() {},
          resetRecoilState() {},
          applyUnifiedGunOffsets() {
            calls.gunOffsetUpdates += 1;
          },
          getAdsState(options) {
            const scopeActive = options.scopeTargetActive != null ? !!options.scopeTargetActive : !!options.adsActive;
            return {
              weaponId: options.currentWeaponId,
              active: scopeActive,
              blend: scopeActive ? 1 : 0,
              sniper: !!options.sniperMode,
              scopeActive: !!(scopeActive && options.sniperMode),
              ready: !!(scopeActive && options.sniperMode),
              phase: scopeActive ? 'ready' : 'inactive'
            };
          },
          getScopeBlend() {
            return 0;
          },
          triggerFireAction() {},
          getMuzzleWorldPosition() {
            return null;
          },
          getCoreWorldPosition() {
            return null;
          },
          getEyeWorldPosition() {
            return null;
          },
          getThrowableOriginWorldPosition() {
            return null;
          },
          syncAvatarVisibility() {}
        };
      }
    },
    GameHitscan: {
      getAllWeaponIds() {
        return ['rifle', 'sniper'];
      },
      isAdsBlocked() {
        return false;
      }
    },
    GameAudio: {
      play(soundId, options) {
        calls.audioPlays.push({
          soundId: String(soundId || ''),
          options: options ? JSON.parse(JSON.stringify(options)) : null
        });
      }
    },
    ...options.runtimeOverrides
  };

  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE,
    document: documentObj,
    window: Object.assign(windowObj, {
      localStorage: {
        getItem() { return null; },
        setItem() {},
        removeItem() {}
      }
    }),
    Date,
    performance: {
      now() {
        return 0;
      }
    }
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(inputBindingsCode, context);
  vm.runInContext(inputLabelsCode, context);
  vm.runInContext(statusCode, context);
  vm.runInContext(reconciliationCode, context);
  vm.runInContext(loadoutCode, context);
  vm.runInContext(cameraCode, context);
  vm.runInContext(inputCode, context);
  vm.runInContext(sprintCode, context);
  vm.runInContext(visualCode, context);
  vm.runInContext(motionStateCode, context);
  vm.runInContext(replayCode, context);
  vm.runInContext(statusBridgeCode, context);
  vm.runInContext(code, context);

  const player = sandbox.__MAYHEM_RUNTIME.GamePlayer;
  const scene = new THREE.Scene();
  player.init(scene);

  function buildStepOptions(dtSec) {
    return {
      dtSec,
      bounds: worldState.bounds,
      collisionBoxes: worldState.collisionBoxes,
      getGroundHeightAt: worldState.getGroundHeightAt,
      movementLocked: false,
      eyeHeight: EYE_HEIGHT,
      playerHeight: PLAYER_HEIGHT,
      playerRadius: PLAYER_RADIUS,
      epsilon: 0.001
    };
  }

  return {
    player,
    documentObj,
    windowObj,
    calls,
    worldState,
    buildStepOptions
  };
}

function assertPlayerMatchesExpected(player, expected) {
  const pos = player.getPosition();
  const rot = player.getRotation();
  const anim = player.getAnimNetState();
  assertClose(pos.x, expected.x);
  assertClose(pos.y, expected.y);
  assertClose(pos.z, expected.z);
  assertClose(rot.yaw, expected.yaw);
  assertClose(rot.pitch, expected.pitch);
  assertClose(anim.moveSpeedNorm, expected.moveSpeedNorm);
  assert.equal(player.isSprinting(), !!expected.sprinting);
  assert.equal(player.isFastBackpedal(), !!expected.fastBackpedal);
  assert.equal(anim.fastBackpedal, !!expected.fastBackpedal);
}

function motionDistanceToExpected(pos, expected) {
  const dx = Number(pos.x || 0) - Number(expected.x || 0);
  const dy = Number(pos.y || 0) - Number(expected.y || 0);
  const dz = Number(pos.z || 0) - Number(expected.z || 0);
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function assertSmoothCorrectionToward(player, before, expected) {
  const after = player.getPosition();
  const beforeError = motionDistanceToExpected(before, expected);
  const afterError = motionDistanceToExpected(after, expected);
  assert.equal(afterError < beforeError, true);
  assert.equal(afterError > 0.01, true);
}

test('player live forward movement matches the shared authoritative step', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);

  assertPlayerMatchesExpected(harness.player, expected);
});

test('player initial spawn uses terrain height instead of a flat eye-height fallback', async () => {
  const harness = await loadPlayerMovementHarness({
    spawn: { x: 5, z: 6 },
    getGroundHeightAt() {
      return 3.5;
    }
  });

  const pos = harness.player.getPosition();

  assertClose(pos.x, 5);
  assertClose(pos.z, 6);
  assertClose(pos.y, 5.1);
});

test('player passes the first-person camera toggle into the camera view payload', async () => {
  const harness = await loadPlayerMovementHarness({
    runtimeOverrides: {
      GameGameplayControls: {
        isFirstPersonViewEnabled() {
          return true;
        }
      }
    }
  });

  assert.equal(harness.calls.cameraUpdates.at(-1).firstPersonView, true);
});

test('player inspect mode freezes movement input and uses orbit look without changing aim', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  assert.equal(harness.player.setInspectMode(true), true);
  assert.equal(harness.player.isInspectModeActive(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.player.getNetworkInputState())), {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    adsActive: false
  });

  harness.player.update(0.1);
  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.calls.cameraUpdates.at(-1).inspectMode, true);

  const beforeOrbit = harness.player.getInspectOrbitState();
  harness.player.applyLookDelta(20, -10, 1);
  const afterOrbit = harness.player.getInspectOrbitState();
  assert.notEqual(afterOrbit.yaw, beforeOrbit.yaw);
  assert.notEqual(afterOrbit.pitch, beforeOrbit.pitch);
  const rotation = harness.player.getRotation();
  assertClose(rotation.yaw, 0);
  assertClose(rotation.pitch, 0);
});

test('player movement honors remapped forward input and ignores the old key', async () => {
  const harness = await loadPlayerMovementHarness({
    runtimeOverrides: {
      GameInputBindings: {
        matches(actionId, event) {
          return actionId === 'move_forward' && event && event.code === 'KeyI';
        }
      }
    }
  });
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  harness.player.update(0.1);
  assertPlayerMatchesExpected(harness.player, expected);

  harness.documentObj.dispatch('keydown', { code: 'KeyI' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);

  assertPlayerMatchesExpected(harness.player, expected);
});

test('player live collision stop matches the shared authoritative step', async () => {
  const harness = await loadPlayerMovementHarness({
    collisionBoxes: [{
      min: { x: 4, y: 0, z: 4.8 },
      max: { x: 6, y: 3, z: 5.8 }
    }]
  });
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);

  assertPlayerMatchesExpected(harness.player, expected);
});

test('player can recover from a shallow blocking overlap instead of staying trapped in the mesh', async () => {
  const harness = await loadPlayerMovementHarness({
    spawn: { x: 0.2, z: 0 },
    collisionBoxes: [{
      min: { x: -0.4, y: 0, z: -1 },
      max: { x: 0.4, y: 3, z: 1 }
    }]
  });

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  harness.player.update(0.05);

  const pos = harness.player.getPosition();
  assert.ok(Math.abs(Number(pos.x || 0)) > 0.89 || Math.abs(Number(pos.z || 0)) > 1.0);
});

test('player jump start and hold match the shared authoritative step', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'Space' });
  stepAuthoritativeMovement(expected, createInputState({ jump: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);
  assertPlayerMatchesExpected(harness.player, expected);

  stepAuthoritativeMovement(expected, createInputState({ jump: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);
  assertPlayerMatchesExpected(harness.player, expected);
});

test('player ground sprinting matches the shared authoritative step', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  harness.documentObj.dispatch('keydown', { code: 'ShiftLeft' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);

  assertPlayerMatchesExpected(harness.player, expected);
});

test('player footstep audio cadence follows the Boxman walk and sprint contact loops', async () => {
  const footstepWorld = {
    bounds: { minX: 0, maxX: 120, minZ: 0, maxZ: 120, size: 120 },
    spawn: { x: 60, z: 60 }
  };
  const walkHarness = await loadPlayerMovementHarness(footstepWorld);
  walkHarness.documentObj.dispatch('keydown', { code: 'KeyW' });
  for (let i = 0; i < 60; i++) {
    walkHarness.player.update(1 / 60);
  }

  assert.equal(walkHarness.calls.audioPlays.length, 3);
  for (const call of walkHarness.calls.audioPlays) {
    assert.equal(call.soundId, 'footstep');
    assert.equal(call.options.mode, 'walk');
    assert.equal(call.options.running, false);
  }

  const runHarness = await loadPlayerMovementHarness(footstepWorld);
  runHarness.documentObj.dispatch('keydown', { code: 'KeyW' });
  runHarness.documentObj.dispatch('keydown', { code: 'ShiftLeft' });
  for (let i = 0; i < 60; i++) {
    runHarness.player.update(1 / 60);
  }

  assert.equal(runHarness.calls.audioPlays.length, 4);
  for (const call of runHarness.calls.audioPlays) {
    assert.equal(call.soundId, 'footstep');
    assert.equal(call.options.mode, 'run');
    assert.equal(call.options.running, true);
  }
});

test('player backward sprint matches the shared authoritative step and forwards fastBackpedal to animation', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyS' });
  harness.documentObj.dispatch('keydown', { code: 'ShiftLeft' });
  stepAuthoritativeMovement(expected, createInputState({ backward: true, sprint: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(expected.sprinting, false);
  assert.equal(expected.fastBackpedal, true);
  assert.equal(harness.calls.animationUpdates.length > 0, true);
  assert.deepEqual(harness.calls.animationUpdates[harness.calls.animationUpdates.length - 1].options, {
    sprinting: false,
    fastBackpedal: true,
    isGrounded: true,
    adsActive: false,
    movingForward: false,
    movingBackward: true
  });
});

test('canceling sprint holds sprint off until the sprint key is pressed again', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  harness.documentObj.dispatch('keydown', { code: 'ShiftLeft' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.player.cancelSprintUntilRelease(), true);
  assert.equal(harness.player.isSprinting(), false);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.player.getNetworkInputState())), {
    forward: true,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    adsActive: false
  });

  stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: false }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);
  assertPlayerMatchesExpected(harness.player, expected);

  harness.documentObj.dispatch('keyup', { code: 'ShiftLeft' });
  harness.documentObj.dispatch('keydown', { code: 'ShiftLeft' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);

  assertPlayerMatchesExpected(harness.player, expected);
});

test('temporary sprint cancel from firing resumes automatically while sprint is still held', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);
  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => now;

  try {
    harness.documentObj.dispatch('keydown', { code: 'KeyW' });
    harness.documentObj.dispatch('keydown', { code: 'ShiftLeft' });
    stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: true }), harness.buildStepOptions(0.1));
    harness.player.update(0.1);
    assertPlayerMatchesExpected(harness.player, expected);

    assert.equal(harness.player.cancelSprintTemporarily(280), true);
    assert.equal(harness.player.getNetworkInputState().sprint, false);
    stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: false }), harness.buildStepOptions(0.1));
    harness.player.update(0.1);
    assertPlayerMatchesExpected(harness.player, expected);
    assert.equal(harness.player.isSprinting(), false);

    now += 150;
    stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: false }), harness.buildStepOptions(0.1));
    harness.player.update(0.1);
    assertPlayerMatchesExpected(harness.player, expected);
    assert.equal(harness.player.isSprinting(), false);

    now += 150;
    stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: true }), harness.buildStepOptions(0.1));
    harness.player.update(0.1);
    assertPlayerMatchesExpected(harness.player, expected);
    assert.equal(harness.player.isSprinting(), true);
  } finally {
    Date.now = originalNow;
  }
});

test('equipped sniper enters scope movement slowdown automatically', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.player.setWeaponModel('sniper');
  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true, adsActive: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.player.getAdsState().active, true);
  assert.equal(harness.player.getAdsState().sniper, true);
});

test('equipped sniper still restores sprint movement when sprint is held', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.player.setWeaponModel('sniper');
  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  harness.documentObj.dispatch('keydown', { code: 'ShiftLeft' });

  assert.equal(harness.player.getAdsState().active, false);

  stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.player.getAdsState().active, false);
});

test('backward jump keeps movement parity and only flips the presentation tilt', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyS' });
  harness.documentObj.dispatch('keydown', { code: 'Space' });
  stepAuthoritativeMovement(expected, createInputState({ backward: true, jump: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.deepEqual(harness.calls.audioPlays.map((call) => call.soundId), ['jump']);
  assert.deepEqual(harness.calls.triggerActions, [{
    action: 'jump',
    payload: { reverseLegTilt: true }
  }]);
});

test('pressing sprint for the first time in air does not start sprint until landing', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'Space' });
  stepAuthoritativeMovement(expected, createInputState({ jump: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  harness.documentObj.dispatch('keyup', { code: 'Space' });
  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  harness.documentObj.dispatch('keydown', { code: 'ShiftLeft' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.player.isSprinting(), false);
});

test('sprinting jump carries sprint in air and can resume sprint on landing when still held', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  harness.documentObj.dispatch('keydown', { code: 'ShiftLeft' });
  harness.documentObj.dispatch('keydown', { code: 'Space' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: true, jump: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.player.isSprinting(), true);
  assert.deepEqual(harness.calls.audioPlays.map((call) => call.soundId), ['jump']);
  assert.equal(harness.calls.audioPlays[0].options.running, true);

  harness.documentObj.dispatch('keyup', { code: 'Space' });
  harness.documentObj.dispatch('keyup', { code: 'ShiftLeft' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: false }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);
  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.player.isSprinting(), false);

  expected.y = 1.62;
  expected.velocityY = -8;
  expected.isGrounded = false;
  expected.sprinting = false;
  expected.airborneSprintCarry = false;
  harness.player.applyAuthoritativeMotion({
    ...expected
  });

  harness.documentObj.dispatch('keydown', { code: 'ShiftLeft' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.player.isSprinting(), true);
});

test('jump while sniper auto-scope is active keeps airborne movement and sampled input aligned with the shared step', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.player.setWeaponModel('sniper');
  harness.documentObj.dispatch('keydown', { code: 'Space' });
  stepAuthoritativeMovement(expected, createInputState({ jump: true, adsActive: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.player.getAdsState().active, true);
  assert.equal(expected.isGrounded, false);
  assert.ok(expected.velocityY > 0);
  assert.ok(harness.player.getPosition().y > 1.6);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.player.getNetworkInputState())), {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: true,
    sprint: false,
    adsActive: true
  });
});

test('player replay correction eases the airborne forward jump path back after local drift', async () => {
  const harness = await loadPlayerMovementHarness();
  const acknowledged = createExpectedEntity(harness.worldState.spawn);
  const replayed = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  harness.documentObj.dispatch('keydown', { code: 'Space' });

  stepAuthoritativeMovement(acknowledged, createInputState({ forward: true, jump: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  Object.assign(replayed, JSON.parse(JSON.stringify(acknowledged)));
  stepAuthoritativeMovement(replayed, createInputState({ forward: true, jump: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  harness.player.applyAuthoritativeMotion({
    ...replayed,
    x: replayed.x + 3.2,
    z: replayed.z + 0.8
  });

  const driftedPos = harness.player.getPosition();
  assert.ok(Math.hypot(driftedPos.x - replayed.x, driftedPos.z - replayed.z) > 3);

  const pendingInput = {
    seq: 2,
    dtMs: 50,
    yaw: acknowledged.yaw,
    pitch: acknowledged.pitch,
    inputState: createInputState({ forward: true, jump: true })
  };
  const corrected = harness.player.reconcileAuthoritativeMotion(acknowledged, {
    dt: 0.05,
    allowReplayCorrection: true,
    pendingInputCount: 1,
    lastSentSeq: 2,
    lastAckedSeq: 1,
    latestPendingAgeMs: 80,
    latestAckAgeMs: 20,
    ackDrift: 1,
    hasUnsentInputTail: false,
    pendingInputs: [pendingInput],
    rttMs: 60,
    rttJitterMs: 0
  });

  assert.equal(corrected, true);

  const expectedCorrected = replayMotionState(acknowledged, [pendingInput], {
    stepMovement: stepAuthoritativeMovement,
    bounds: harness.worldState.bounds,
    collisionBoxes: harness.worldState.collisionBoxes,
    getGroundHeightAt: harness.worldState.getGroundHeightAt,
    movementLocked: false,
    eyeHeight: EYE_HEIGHT,
    playerHeight: PLAYER_HEIGHT,
    playerRadius: PLAYER_RADIUS,
    epsilon: 0.001,
    fallbackYaw: acknowledged.yaw,
    fallbackPitch: acknowledged.pitch
  });

  assertSmoothCorrectionToward(harness.player, driftedPos, expectedCorrected);
});

test('player replay correction stays replay-first for a recent fast sprint window and blends instead of snapping', async () => {
  const harness = await loadPlayerMovementHarness();
  const acknowledged = createExpectedEntity(harness.worldState.spawn);
  const sprintInputs = [];
  for (let i = 0; i < 4; i++) {
    sprintInputs.push({
      seq: i + 2,
      dtMs: 50,
      yaw: acknowledged.yaw,
      pitch: acknowledged.pitch,
      inputState: createInputState({ forward: true, sprint: true })
    });
  }

  const expectedCorrected = replayMotionState(acknowledged, sprintInputs, {
    stepMovement: stepAuthoritativeMovement,
    bounds: harness.worldState.bounds,
    collisionBoxes: harness.worldState.collisionBoxes,
    getGroundHeightAt: harness.worldState.getGroundHeightAt,
    movementLocked: false,
    eyeHeight: EYE_HEIGHT,
    playerHeight: PLAYER_HEIGHT,
    playerRadius: PLAYER_RADIUS,
    epsilon: 0.001,
    fallbackYaw: acknowledged.yaw,
    fallbackPitch: acknowledged.pitch
  });

  harness.player.applyAuthoritativeMotion({
    ...expectedCorrected,
    z: acknowledged.z - 5.1
  });
  const driftedPos = harness.player.getPosition();

  const corrected = harness.player.reconcileAuthoritativeMotion(acknowledged, {
    dt: 0.05,
    allowReplayCorrection: true,
    pendingInputCount: sprintInputs.length,
    lastSentSeq: sprintInputs.length + 1,
    lastAckedSeq: 1,
    latestPendingAgeMs: 80,
    latestAckAgeMs: 20,
    ackDrift: sprintInputs.length,
    hasUnsentInputTail: true,
    inputSendIntervalMs: 50,
    pendingInputs: sprintInputs,
    rttMs: 60,
    rttJitterMs: 0
  });

  assert.equal(corrected, true);
  assertSmoothCorrectionToward(harness.player, driftedPos, expectedCorrected);
});

test('player small moving correction eases toward the acknowledged state instead of snapping instantly', async () => {
  const harness = await loadPlayerMovementHarness({
    networkTuning: {
      flags: {
        adaptiveSelfReconciliation: true
      },
      selfReconciliation: {
        movingBlendDistanceWu: 0.5,
        movingBlendVerticalWu: 0.35,
        movingCorrectionDecayMs: 100
      }
    }
  });
  const acknowledged = createExpectedEntity(harness.worldState.spawn);

  harness.player.applyAuthoritativeMotion({
    ...acknowledged,
    z: acknowledged.z - 0.4
  });

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });

  const before = harness.player.getPosition();
  const beforeError = Math.abs(Number(before.z || 0) - Number(acknowledged.z || 0));

  const corrected = harness.player.reconcileAuthoritativeMotion(acknowledged, {
    dt: 0.05,
    allowReplayCorrection: true,
    pendingInputCount: 0,
    lastSentSeq: 1,
    lastAckedSeq: 1,
    latestPendingAgeMs: 0,
    latestAckAgeMs: 0,
    ackDrift: 0,
    hasUnsentInputTail: false,
    pendingInputs: [],
    rttMs: 40,
    rttJitterMs: 0
  });

  const after = harness.player.getPosition();
  const afterError = Math.abs(Number(after.z || 0) - Number(acknowledged.z || 0));

  assert.equal(corrected, true);
  assert.equal(afterError < beforeError, true);
  assert.equal(afterError > 0.01, true);
});

test('player replay correction respects the historical movement-locked state on queued inputs', async () => {
  const harness = await loadPlayerMovementHarness();
  const acknowledged = createExpectedEntity(harness.worldState.spawn);

  harness.player.applyAuthoritativeMotion({
    ...acknowledged,
    z: acknowledged.z - 2.5
  });
  const driftedPos = harness.player.getPosition();

  const corrected = harness.player.reconcileAuthoritativeMotion(acknowledged, {
    dt: 0.05,
    allowReplayCorrection: true,
    pendingInputCount: 1,
    lastSentSeq: 2,
    lastAckedSeq: 1,
    latestPendingAgeMs: 80,
    latestAckAgeMs: 20,
    ackDrift: 1,
    hasUnsentInputTail: false,
    pendingInputs: [{
      seq: 2,
      dtMs: 50,
      yaw: acknowledged.yaw,
      pitch: acknowledged.pitch,
      weaponId: 'rifle',
      movementLocked: true,
      inputState: createInputState({ forward: true })
    }],
    rttMs: 60,
    rttJitterMs: 0
  });

  assert.equal(corrected, true);
  assertSmoothCorrectionToward(harness.player, driftedPos, acknowledged);
});

test('player replay correction respects the historical weapon movement multipliers on queued inputs', async () => {
  const harness = await loadPlayerMovementHarness({
    weaponStats: {
      rifle: { id: 'rifle', adsFovDeg: 56, moveSpeedMultiplier: 1 },
      sniper: { id: 'sniper', adsFovDeg: 24, moveSpeedMultiplier: 0.5 }
    }
  });
  const acknowledged = createExpectedEntity(harness.worldState.spawn);

  harness.player.applyAuthoritativeMotion({
    ...acknowledged,
    z: acknowledged.z - 2.5
  });
  const driftedPos = harness.player.getPosition();

  const pendingInputs = [{
    seq: 2,
    dtMs: 100,
    yaw: acknowledged.yaw,
    pitch: acknowledged.pitch,
    weaponId: 'sniper',
    movementLocked: false,
    inputState: createInputState({ forward: true })
  }];
  const expectedCorrected = replayMotionState(acknowledged, pendingInputs, {
    stepMovement: stepAuthoritativeMovement,
    bounds: harness.worldState.bounds,
    collisionBoxes: harness.worldState.collisionBoxes,
    getGroundHeightAt: harness.worldState.getGroundHeightAt,
    movementLocked: false,
    fallbackWeaponId: 'rifle',
    resolveStepMovementOptions(step) {
      if (String(step && step.weaponId || '') === 'sniper') {
        return { moveSpeedMultiplier: 0.5, adsMoveMultiplier: 0.4 };
      }
      return { moveSpeedMultiplier: 1, adsMoveMultiplier: 0.4 };
    },
    eyeHeight: EYE_HEIGHT,
    playerHeight: PLAYER_HEIGHT,
    playerRadius: PLAYER_RADIUS,
    epsilon: 0.001,
    fallbackYaw: acknowledged.yaw,
    fallbackPitch: acknowledged.pitch
  });

  const corrected = harness.player.reconcileAuthoritativeMotion(acknowledged, {
    dt: 0.1,
    allowReplayCorrection: true,
    pendingInputCount: 1,
    lastSentSeq: 2,
    lastAckedSeq: 1,
    latestPendingAgeMs: 80,
    latestAckAgeMs: 20,
    ackDrift: 1,
    hasUnsentInputTail: false,
    pendingInputs,
    rttMs: 60,
    rttJitterMs: 0
  });

  assert.equal(corrected, true);
  assertSmoothCorrectionToward(harness.player, driftedPos, expectedCorrected);
});

test('player roll only triggers while there is movement input', async () => {
  const harness = await loadPlayerMovementHarness();

  assert.equal(harness.player.tryRoll(), false);
  assert.equal(harness.player.isRolling(), false);

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });

  assert.equal(harness.player.tryRoll(), true);
  assert.equal(harness.player.isRolling(), true);
  assert.deepEqual(harness.calls.triggerActions.at(-1), {
    action: 'roll',
    payload: {
      movingForward: true,
      movingBackward: false,
      movingLeft: false,
      movingRight: false
    }
  });
});

test('player ignores new movement and jump presses during a roll until they are released', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.player.setRollState({
    rollUntil: Date.now() + 1000,
    rollInputState: {
      movingForward: true,
      movingBackward: false,
      movingLeft: false,
      movingRight: false
    }
  });
  harness.documentObj.dispatch('keydown', { code: 'KeyA', repeat: false });
  harness.documentObj.dispatch('keydown', { code: 'Space', repeat: false, preventDefault() {} });

  stepAuthoritativeMovement(expected, createInputState({ forward: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);
  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.calls.triggerActions.some((entry) => entry.action === 'jump'), false);

  harness.player.setRollState({ rollUntil: 0 });
  stepAuthoritativeMovement(expected, createInputState({}), harness.buildStepOptions(0.1));
  harness.player.update(0.1);
  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.calls.triggerActions.some((entry) => entry.action === 'jump'), false);

  harness.documentObj.dispatch('keyup', { code: 'KeyA' });
  harness.documentObj.dispatch('keyup', { code: 'Space' });
  harness.documentObj.dispatch('keydown', { code: 'KeyA', repeat: false });

  stepAuthoritativeMovement(expected, createInputState({ left: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);
  assertPlayerMatchesExpected(harness.player, expected);
});

test('player roll forwards the current movement direction to the avatar action', async () => {
  const harness = await loadPlayerMovementHarness();

  harness.documentObj.dispatch('keydown', { code: 'KeyS' });
  harness.documentObj.dispatch('keydown', { code: 'KeyD' });

  assert.equal(harness.player.tryRoll(), true);
  assert.deepEqual(harness.calls.triggerActions.at(-1), {
    action: 'roll',
    payload: {
      movingForward: false,
      movingBackward: true,
      movingLeft: false,
      movingRight: true
    }
  });
});

test('player network input state keeps the frozen roll direction while rolling', async () => {
  const harness = await loadPlayerMovementHarness();

  harness.player.setRollState({
    rollUntil: Date.now() + 1000,
    rollInputState: {
      movingForward: true,
      movingBackward: false,
      movingLeft: false,
      movingRight: false
    }
  });

  const inputState = harness.player.getNetworkInputState();

  assert.equal(inputState.forward, true);
  assert.equal(inputState.backward, false);
  assert.equal(inputState.left, false);
  assert.equal(inputState.right, false);
  assert.equal(inputState.jump, false);
  assert.equal(inputState.sprint, false);
  assert.equal(inputState.adsActive, false);
});
