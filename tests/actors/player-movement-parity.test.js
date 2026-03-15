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
  replayMotionState,
  shouldReplayAuthoritativeCorrection
} from '../../shared/authoritative-reconciliation.js';

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
    y: 1.6,
    z: Number(spawn.z || 0),
    yaw: 0,
    pitch: 0,
    velocityY: 0,
    isGrounded: true,
    jumpHoldTimer: 0,
    jumpHeldLast: false,
    moveSpeedNorm: 0,
    sprinting: false
  };
}

function createInputState(patch = {}) {
  const input = createMovementInputState();
  Object.assign(input, patch);
  return input;
}

async function loadPlayerMovementHarness(options = {}) {
  const code = await fs.readFile(new URL('../../js/actors/player.js', import.meta.url), 'utf8');
  const documentObj = new FakeDocument();
  const windowObj = new FakeWindow();
  const calls = {
    triggerActions: [],
    animationUpdates: [],
    gunOffsetUpdates: 0
  };
  const worldState = {
    bounds: options.bounds || { minX: 0, maxX: 50, minZ: 0, maxZ: 50, size: 50 },
    spawn: options.spawn || { x: 5, z: 6 },
    collisionBoxes: Array.isArray(options.collisionBoxes) ? options.collisionBoxes.slice() : [],
    getGroundHeightAt: typeof options.getGroundHeightAt === 'function'
      ? options.getGroundHeightAt
      : (() => 0)
  };

  const runtime = {
    GameShared: {
      authoritativeMovement: {
        createMovementInputState,
        stepAuthoritativeMovement
      },
      authoritativeReconciliation: {
        replayMotionState,
        shouldReplayAuthoritativeCorrection
      },
      gameplayTuning: {
        movement: {},
        weaponStats: {
          rifle: { id: 'rifle', adsFovDeg: 56 },
          sniper: { id: 'sniper', adsFovDeg: 24 }
        }
      },
      entityConstants: {},
      getWeaponStats(weaponId) {
        return this.gameplayTuning.weaponStats[weaponId] || null;
      },
      resolveWeaponAdsFovDeg(weaponStats) {
        return Number(weaponStats && weaponStats.adsFovDeg || 56);
      },
      getSelectableWeaponIds() {
        return ['rifle', 'sniper'];
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
          setHealFlash() {},
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
                isGrounded: !!options.isGrounded,
                adsActive: !!options.adsActive,
                movingForward: !!options.movingForward,
                movingBackward: !!options.movingBackward
              })) : null
            });
          },
          updateCamera(_dt, options) {
            if (!options || !options.camera) return;
            options.camera.position.set(
              Number(options.playerX || 0),
              Number(options.posY || 0),
              Number(options.playerZ || 0)
            );
            options.camera.fov = options.adsActive
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
            return {
              weaponId: options.currentWeaponId,
              active: !!options.adsActive,
              blend: options.adsActive ? 1 : 0,
              sniper: !!options.sniperMode,
              scopeActive: !!(options.adsActive && options.sniperMode)
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
    ...options.runtimeOverrides
  };

  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE,
    document: documentObj,
    window: windowObj,
    Date,
    performance: {
      now() {
        return 0;
      }
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));

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
      eyeHeight: 1.6,
      playerHeight: 1.7,
      playerRadius: 0.35,
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
}

test('player live forward movement matches the shared authoritative step', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
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
  harness.documentObj.dispatch('keydown', { code: 'KeyE' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);

  assertPlayerMatchesExpected(harness.player, expected);
});

test('player ADS movement slowdown matches the shared authoritative step', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.player.setAdsEnabled(true);
  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true, adsActive: true }), harness.buildStepOptions(0.1));
  harness.player.update(0.1);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.player.getAdsState().active, true);
});

test('backward jump keeps movement parity and only flips the presentation tilt', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'KeyS' });
  harness.documentObj.dispatch('keydown', { code: 'Space' });
  stepAuthoritativeMovement(expected, createInputState({ backward: true, jump: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.deepEqual(harness.calls.triggerActions, [{
    action: 'jump',
    payload: { reverseLegTilt: true }
  }]);
});

test('holding sprint in air no longer depends on a local sprint queue', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.documentObj.dispatch('keydown', { code: 'Space' });
  stepAuthoritativeMovement(expected, createInputState({ jump: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  harness.documentObj.dispatch('keyup', { code: 'Space' });
  harness.documentObj.dispatch('keydown', { code: 'KeyW' });
  harness.documentObj.dispatch('keydown', { code: 'KeyE' });
  stepAuthoritativeMovement(expected, createInputState({ forward: true, sprint: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.player.isSprinting(), true);
});

test('jump while ADS keeps the sampled input path aligned with the shared step', async () => {
  const harness = await loadPlayerMovementHarness();
  const expected = createExpectedEntity(harness.worldState.spawn);

  harness.player.setAdsEnabled(true);
  harness.documentObj.dispatch('keydown', { code: 'Space' });
  stepAuthoritativeMovement(expected, createInputState({ jump: true, adsActive: true }), harness.buildStepOptions(0.05));
  harness.player.update(0.05);

  assertPlayerMatchesExpected(harness.player, expected);
  assert.equal(harness.player.getAdsState().active, true);
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

test('player replay correction restores the airborne forward jump path after local drift', async () => {
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
    eyeHeight: 1.6,
    playerHeight: 1.7,
    playerRadius: 0.35,
    epsilon: 0.001,
    fallbackYaw: acknowledged.yaw,
    fallbackPitch: acknowledged.pitch
  });

  assertPlayerMatchesExpected(harness.player, expectedCorrected);
});
