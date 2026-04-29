import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadRuntimeStateFactory() {
  const sandbox = {
    console,
    Date,
    Map,
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  const context = vm.createContext(sandbox);
  const code = await fs.readFile(new URL('../../js/net/runtime-state.js', import.meta.url), 'utf8');
  vm.runInContext(code, context);
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameNetRuntimeState;
}

test('runtime state ignores out-of-order remote snapshot timing and entity samples', async () => {
  const GameNetRuntimeState = await loadRuntimeStateFactory();
  const state = GameNetRuntimeState.create({});

  assert.equal(state.recordRemoteSnapshotTiming(1000, 1000, 10), 1000);
  assert.equal(state.recordRemoteSnapshotTiming(1100, 1100, 11), 1100);
  assert.equal(state.recordRemoteSnapshotTiming(1050, 1200, 9), 1100);

  state.recordRemoteSnapshotEntity('usr_remote', {
    id: 'usr_remote',
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    moveSpeedNorm: 0,
    velocityY: 0,
    weaponId: 'rifle'
  }, 1000);
  state.recordRemoteSnapshotEntity('usr_remote', {
    id: 'usr_remote',
    x: 1,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    moveSpeedNorm: 0,
    velocityY: 0,
    weaponId: 'rifle'
  }, 1100);
  state.recordRemoteSnapshotEntity('usr_remote', {
    id: 'usr_remote',
    x: 0.5,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    moveSpeedNorm: 0,
    velocityY: 0,
    weaponId: 'rifle'
  }, 1050);

  assert.deepEqual(
    JSON.parse(JSON.stringify(state.getRemoteSnapshotTimeline('usr_remote').map((sample) => Number(sample.serverTime || 0)))),
    [1000, 1100]
  );
});

test('runtime state tracks snapshot ack, retained baselines, and buffered remote frames', async () => {
  const GameNetRuntimeState = await loadRuntimeStateFactory();
  const state = GameNetRuntimeState.create({});

  state.setSnapshotAckSeq(7);
  state.setSnapshotAckSeq(5);
  assert.equal(state.getSnapshotAckSeq(), 7);

  const snapshotMap = new Map([
    ['u1', { id: 'u1', x: 1 }],
    ['u2', { id: 'u2', x: 2 }]
  ]);
  state.rememberSnapshotBaseline(9, snapshotMap);
  const baseline = state.getSnapshotBaseline(9);
  assert.ok(baseline instanceof Map);
  assert.deepEqual(JSON.parse(JSON.stringify(Array.from(baseline.values()))), [{ id: 'u1', x: 1 }, { id: 'u2', x: 2 }]);

  state.enqueueRemoteFrame({ snapshotSeq: 1, readyAt: 10 });
  state.enqueueRemoteFrame({ snapshotSeq: 2, readyAt: 20 });
  assert.equal(state.peekRemoteFrame().snapshotSeq, 1);
  assert.equal(state.shiftRemoteFrame().snapshotSeq, 1);
  assert.equal(state.peekRemoteFrame().snapshotSeq, 2);

  for (let seq = 3; seq <= 20; seq++) {
    state.enqueueRemoteFrame({ snapshotSeq: seq, readyAt: seq * 10 });
  }
  assert.equal(state.getRemoteFrameQueue().length, 19);
  assert.equal(state.peekRemoteFrame().snapshotSeq, 2);

  for (let seq = 21; seq <= 40; seq++) {
    state.enqueueRemoteFrame({ snapshotSeq: seq, readyAt: seq * 10 });
  }
  assert.equal(state.getRemoteFrameQueue().length, 32);
  assert.equal(state.peekRemoteFrame().snapshotSeq, 9);
});

test('runtime state reset clears replay and snapshot buffers', async () => {
  const GameNetRuntimeState = await loadRuntimeStateFactory();
  const state = GameNetRuntimeState.create({});

  state.setSelfState({ id: 'usr_self' });
  state.setInputSeqHistory([{ seq: 3, at: 100 }]);
  state.setSnapshotAckSeq(9);
  state.enqueueRemoteFrame({ snapshotSeq: 1, readyAt: 10 });
  state.rememberSnapshotBaseline(12, new Map([['u1', { id: 'u1', x: 4 }]]));

  state.reset();

  assert.equal(state.getSelfState(), null);
  assert.deepEqual(Array.from(state.getInputSeqHistory()), []);
  assert.equal(state.getSnapshotAckSeq(), 0);
  assert.equal(state.peekRemoteFrame(), null);
  assert.equal(state.getSnapshotBaseline(12), null);
});
