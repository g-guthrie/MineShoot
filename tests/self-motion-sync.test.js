import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadSelfMotionSyncHarness(runtimeOverrides = {}) {
  const applyCalls = [];
  const reconcileCalls = [];
  const runtime = {
    GamePlayer: {
      applyAuthoritativeMotion(state, options) {
        applyCalls.push({
          state: JSON.parse(JSON.stringify(state)),
          options: JSON.parse(JSON.stringify(options || {}))
        });
      },
      reconcileAuthoritativeMotion(state, options) {
        reconcileCalls.push({
          state: JSON.parse(JSON.stringify(state)),
          options: JSON.parse(JSON.stringify(options || {}))
        });
      }
    },
    GameNet: {
      getInputSyncState() {
        return {
          pendingInputCount: 0,
          hasUnsentInputTail: false,
          lastSentSeq: 0,
          lastAckedSeq: 0
        };
      },
      getPendingInputSamples() {
        return [];
      }
    },
    ...runtimeOverrides
  };
  const timeState = { now: 1000 };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    Date: {
      now() {
        return timeState.now;
      }
    }
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  for (const path of [
    '../js/ability-fx.js',
    '../js/net/self-motion-sync.js'
  ]) {
    const code = await fs.readFile(new URL(path, import.meta.url), 'utf8');
    vm.runInContext(code, context);
  }
  return {
    syncPlayerMotion: sandbox.__MAYHEM_RUNTIME.GameNetSelfMotionSync.syncPlayerMotion,
    applyCalls,
    reconcileCalls,
    timeState
  };
}

test('GameNetSelfMotionSync does not re-run reconciliation for identical authoritative snapshots', async () => {
  const harness = await loadSelfMotionSyncHarness();
  const reconcileState = {
    authoritativeState: {
      id: 'usr_test',
      seq: 10,
      x: 4,
      y: 1.6,
      z: 8,
      yaw: 0.25,
      pitch: 0.05,
      velocityY: 0,
      isGrounded: true,
      alive: true,
      abilityFx: null
    },
    pendingInputCount: 0,
    hasUnsentInputTail: false,
    lastSentSeq: 10,
    lastAckedSeq: 10,
    pendingInputs: []
  };

  harness.syncPlayerMotion(reconcileState, 0.016);
  harness.syncPlayerMotion(reconcileState, 0.016);

  assert.equal(harness.reconcileCalls.length, 1);

  const nextState = JSON.parse(JSON.stringify(reconcileState));
  nextState.authoritativeState.seq = 11;
  nextState.authoritativeState.x = 4.25;
  harness.syncPlayerMotion(nextState, 0.016);

  assert.equal(harness.reconcileCalls.length, 2);
});

test('GameNetSelfMotionSync ignores pure ack-seq churn when authoritative motion is unchanged', async () => {
  const harness = await loadSelfMotionSyncHarness();
  const reconcileState = {
    authoritativeState: {
      id: 'usr_test',
      seq: 10,
      x: 4,
      y: 1.6,
      z: 8,
      yaw: 0.25,
      pitch: 0.05,
      velocityY: 0,
      isGrounded: true,
      alive: true,
      abilityFx: null
    },
    pendingInputCount: 0,
    hasUnsentInputTail: false,
    lastSentSeq: 10,
    lastAckedSeq: 10,
    pendingInputs: []
  };

  harness.syncPlayerMotion(reconcileState, 0.016);
  harness.syncPlayerMotion({
    ...reconcileState,
    authoritativeState: {
      ...reconcileState.authoritativeState,
      seq: 11
    },
    lastSentSeq: 11,
    lastAckedSeq: 11
  }, 0.016);

  assert.equal(harness.reconcileCalls.length, 1);
});

test('GameNetSelfMotionSync prefers the explicit reconciliation contract payload', async () => {
  const harness = await loadSelfMotionSyncHarness({
    GameNet: {
      getInputSyncState() {
        throw new Error('legacy input sync selector should not be used');
      },
      getPendingInputSamples() {
        throw new Error('legacy pending input selector should not be used');
      }
    }
  });

  harness.syncPlayerMotion({
    authoritativeState: {
      id: 'usr_test',
      seq: 7,
      x: 3,
      y: 1.6,
      z: 9,
      yaw: 0.15,
      pitch: 0,
      velocityY: 0,
      isGrounded: true,
      alive: true,
      abilityFx: null
    },
    pendingInputCount: 2,
    hasUnsentInputTail: true,
    lastSentSeq: 9,
    lastAckedSeq: 7,
    pendingInputs: [{ seq: 8, dtMs: 16, yaw: 0.2, pitch: 0, inputState: { forward: true } }]
  }, 0.016);

  assert.equal(harness.reconcileCalls.length, 1);
  assert.equal(harness.reconcileCalls[0].state.seq, 7);
  assert.equal(harness.reconcileCalls[0].options.pendingInputCount, 2);
  assert.equal(harness.reconcileCalls[0].options.hasUnsentInputTail, true);
  assert.equal(harness.reconcileCalls[0].options.lastSentSeq, 9);
  assert.equal(harness.reconcileCalls[0].options.lastAckedSeq, 7);
  assert.deepEqual(harness.reconcileCalls[0].options.pendingInputs, [
    { seq: 8, dtMs: 16, yaw: 0.2, pitch: 0, inputState: { forward: true } }
  ]);
});

test('GameNetSelfMotionSync hard-applies authoritative motion while hook pull is active', async () => {
  const harness = await loadSelfMotionSyncHarness();

  harness.syncPlayerMotion({
    authoritativeState: {
      id: 'usr_test',
      seq: 4,
      x: 12,
      y: 2.4,
      z: 15,
      yaw: 0.3,
      pitch: -0.1,
      velocityY: 0,
      isGrounded: false,
      alive: true,
      abilityFx: {
        hookedUntil: 1300
      }
    },
    pendingInputCount: 1,
    hasUnsentInputTail: false,
    lastSentSeq: 4,
    lastAckedSeq: 4,
    pendingInputs: [{ seq: 5, dtMs: 16, yaw: 0.3, pitch: -0.1, inputState: { forward: true } }]
  }, 0.016);

  assert.equal(harness.applyCalls.length, 1);
  assert.equal(harness.reconcileCalls.length, 0);
  assert.deepEqual(harness.applyCalls[0].options, { deferViewSync: true });
});
