import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadStateView(renderMap) {
  return loadStateViewWithOptions({
    getRenderMap() {
      return renderMap;
    },
    getRenderCoreWorldPosition(render, outVec3) {
      return outVec3.set(
        Number(render.group.position.x || 0),
        Number(render.group.position.y || 0) + 1,
        Number(render.group.position.z || 0)
      );
    }
  });
}

async function loadStateViewWithOptions(options = {}, sharedOverrides = {}) {
  const [interpCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/net/interpolation.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/net/state-view.js', import.meta.url), 'utf8')
  ]);
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: sharedOverrides
    },
    globalThis: null,
    console,
    Map,
    THREE
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(interpCode, context);
  vm.runInContext(code, context);
  return sandbox.__MAYHEM_RUNTIME.GameNetStateView.create(options);
}

test('network state view reuses lock target arrays and wrappers across calls', async () => {
  const render = {
    id: 'usr_remote',
    alive: true,
    group: {
      position: new THREE.Vector3(3, 4, 5)
    },
    bodyHitbox: { id: 'body' },
    headHitbox: { id: 'head' }
  };
  const renderMap = new Map([['usr_remote', render]]);
  const view = await loadStateView(renderMap);

  const firstTargets = view.getLockTargets();
  render.group.position.set(8, 9, 10);
  const secondTargets = view.getLockTargets();

  assert.equal(firstTargets.length, 1);
  assert.equal(secondTargets.length, 1);
  assert.equal(firstTargets, secondTargets);
  assert.equal(firstTargets[0], secondTargets[0]);
  assert.equal(firstTargets[0].worldPos, secondTargets[0].worldPos);
  assert.deepEqual(
    { x: secondTargets[0].worldPos.x, y: secondTargets[0].worldPos.y, z: secondTargets[0].worldPos.z },
    { x: 8, y: 10, z: 10 }
  );
});

test('network state view reuses entity state arrays and wrappers across calls', async () => {
  const render = {
    id: 'usr_remote',
    kind: 'player',
    username: 'REMOTE',
    classId: 'abilities',
    hp: 90,
    hpMax: 100,
    armor: 20,
    armorMax: 40,
    alive: true,
    group: {
      position: new THREE.Vector3(1, 2, 3)
    }
  };
  const renderMap = new Map([['usr_remote', render]]);
  const view = await loadStateView(renderMap);

  const first = view.getEntityStateList();
  render.group.position.set(5, 6, 7);
  render.hp = 75;
  const second = view.getEntityStateList();

  assert.equal(first, second);
  assert.equal(first[0], second[0]);
  assert.equal(second[0].hp, 75);
  assert.equal(second[0].worldPos, render.group.position);
});

test('network state view uses shared interpolation clock helpers and entity constants defaults', async () => {
  const [interpCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/net/interpolation.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/net/state-view.js', import.meta.url), 'utf8')
  ]);
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        entityConstants: {
          DEFAULT_HP_MAX: 420,
          DEFAULT_ARMOR_MAX: 110
        },
        gameplayTuning: {
          network: {
            remoteInterpolation: {
              defaultDelayMs: 88,
              minDelayMs: 40,
              maxDelayMs: 120,
              intervalDelayScale: 2,
              jitterDelayScale: 1,
              maxExtrapolationMinMs: 10,
              maxExtrapolationMaxMs: 50,
              maxExtrapolationIntervalScale: 0.5,
              maxExtrapolationJitterScale: 0.25
            }
          }
        }
      }
    },
    globalThis: null,
    console,
    Map,
    THREE
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(interpCode, context);
  vm.runInContext(code, context);
  const view = sandbox.__MAYHEM_RUNTIME.GameNetStateView.create({
    getRenderMap() {
      return new Map();
    },
    getCurrentUser() {
      return { id: 'usr_self', classId: 'abilities' };
    },
    getSelfState() {
      return null;
    },
    classStats() {
      return { armorMax: 0, wallhackRadius: 90 };
    },
    getRemoteSnapshotTiming() {
      return {
        latestServerTime: 1000,
        latestReceivedAt: 1100,
        clockOffsetMs: 100,
        cadenceMs: 30
      };
    }
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(view.getRemotePresentationClock(1130))),
    {
      nowMs: 1130,
      latestServerTime: 1000,
      latestReceivedAt: 1100,
      clockOffsetMs: 100,
      cadenceMs: 30,
      estimatedServerTime: 1030,
      interpolationDelayMs: 56,
      renderServerTime: 974
    }
  );
  assert.equal(view.getSelfState().hp, 420);
  assert.equal(view.getSelfState().hpMax, 420);
  assert.equal(view.getSelfState().armor, 110);
  assert.equal(view.getSelfState().armorMax, 110);
});

test('network state view follows a ballistic vertical path for airborne remote samples', async () => {
  const view = await loadStateViewWithOptions({
    getRenderMap() {
      return new Map();
    },
    getRemoteSnapshotTiming() {
      return {
        latestServerTime: 1200,
        latestReceivedAt: 1200,
        clockOffsetMs: 0,
        interpolationDelayMs: 100,
        cadenceMs: 100
      };
    },
    getRemoteSnapshotTimeline() {
      return [
        { serverTime: 1000, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, moveSpeedNorm: 0, sprinting: false, movingForward: false, movingBackward: false, isGrounded: false, velocityY: 8, weaponId: 'rifle' },
        { serverTime: 1200, x: 4, y: 1.24, z: 0, yaw: 0, pitch: 0, moveSpeedNorm: 0, sprinting: false, movingForward: false, movingBackward: false, isGrounded: false, velocityY: 4.4, weaponId: 'rifle' }
      ];
    }
  }, {
    gameplayTuning: {
      network: {
        remoteInterpolation: {
          verticalBallisticEnabled: true
        }
      },
      movement: {
        gravity: 18
      }
    }
  });

  const sample = view.sampleRemoteEntityPresentation('usr_remote', 1250);
  assert.equal(Number(sample.y.toFixed(2)), 1);
});

test('network state view can sample remote presentation directly from the live render history', async () => {
  const render = {
    id: 'usr_remote',
    weaponId: 'rifle',
    snapshotHistory: [
      { serverTime: 1000, receivedAt: 1000, x: 0, footY: 0, z: 0, yaw: 0, pitch: 0, moveSpeedNorm: 0, sprinting: false, movingForward: false, movingBackward: false, isGrounded: true, velocityY: 0 },
      { serverTime: 1100, receivedAt: 1100, x: 10, footY: 1, z: -2, yaw: 0.4, pitch: 0.1, moveSpeedNorm: 0, sprinting: false, movingForward: false, movingBackward: false, isGrounded: true, velocityY: 0 }
    ],
    snapshotIntervalMs: 50,
    snapshotJitterMs: 0,
    interpolationDelayMs: 90,
    serverTimeOffsetMs: 0
  };
  const view = await loadStateView(new Map([['usr_remote', render]]));

  const sample = view.sampleRemoteEntityPresentation('usr_remote', 1100);

  assert.equal(Number(sample.x.toFixed(2)), 1);
  assert.equal(Number(sample.y.toFixed(2)), 0.1);
  assert.equal(Number(sample.z.toFixed(2)), -0.2);
  assert.equal(sample.weaponId, 'rifle');
});

test('network state view uses the same stale-gap freeze pose as the live remote renderer', async () => {
  const render = {
    id: 'usr_remote',
    weaponId: 'rifle',
    snapshotHistory: [
      { serverTime: 900, receivedAt: 900, x: 10, footY: 1, z: -2, yaw: 0.4, pitch: 0.1, moveSpeedNorm: 0, sprinting: false, movingForward: false, movingBackward: false, isGrounded: true, velocityY: 0 },
      { serverTime: 1000, receivedAt: 1000, x: 20, footY: 2, z: -4, yaw: 0.8, pitch: 0.2, moveSpeedNorm: 0, sprinting: false, movingForward: false, movingBackward: false, isGrounded: true, velocityY: 0 }
    ],
    snapshotIntervalMs: 50,
    snapshotJitterMs: 0,
    interpolationDelayMs: 90,
    serverTimeOffsetMs: 0,
    freezeGapMs: 80,
    lastPresentedTransform: {
      x: 18,
      footY: 1.8,
      z: -3.6,
      yaw: 0.7,
      pitch: 0.2,
      moveSpeedNorm: 0,
      sprinting: false,
      movingForward: false,
      movingBackward: false,
      isGrounded: true,
      velocityY: 0,
      muzzleFlashUntil: 0
    }
  };
  const view = await loadStateView(new Map([['usr_remote', render]]));

  const sample = view.sampleRemoteEntityPresentation('usr_remote', 1200);

  assert.equal(Number(sample.x.toFixed(2)), 18);
  assert.equal(Number(sample.y.toFixed(2)), 1.8);
  assert.equal(Number(sample.z.toFixed(2)), -3.6);
});

test('network state view reports wrap-safe ack drift', async () => {
  const view = await loadStateViewWithOptions({
    getRenderMap() {
      return new Map();
    },
    getInputSeqHistory() {
      return [];
    },
    getLastInputSeqSent() {
      return 1;
    },
    getLastInputSeqAcked() {
      return 4294967295;
    }
  });

  assert.equal(view.getInputSyncState().ackDrift, 2);
});

test('network state view keeps grounded vertical interpolation linear', async () => {
  const view = await loadStateViewWithOptions({
    getRenderMap() {
      return new Map();
    },
    getRemoteSnapshotTiming() {
      return {
        latestServerTime: 1200,
        latestReceivedAt: 1200,
        clockOffsetMs: 0,
        interpolationDelayMs: 100,
        cadenceMs: 100
      };
    },
    getRemoteSnapshotTimeline() {
      return [
        { serverTime: 1000, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, moveSpeedNorm: 0, sprinting: false, movingForward: false, movingBackward: false, isGrounded: true, velocityY: 0, weaponId: 'rifle' },
        { serverTime: 1200, x: 4, y: 1.24, z: 0, yaw: 0, pitch: 0, moveSpeedNorm: 0, sprinting: false, movingForward: false, movingBackward: false, isGrounded: true, velocityY: 0, weaponId: 'rifle' }
      ];
    }
  }, {
    gameplayTuning: {
      network: {
        remoteInterpolation: {
          verticalBallisticEnabled: true
        }
      }
    }
  });

  const sample = view.sampleRemoteEntityPresentation('usr_remote', 1250);
  assert.equal(Number(sample.y.toFixed(2)), 0.93);
});
