import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadConnectionTimingFactory() {
  const sandbox = {
    console,
    Date,
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  const context = vm.createContext(sandbox);
  const code = await fs.readFile(new URL('../../js/net/connection-timing.js', import.meta.url), 'utf8');
  vm.runInContext(code, context);
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameNetConnectionTiming;
}

test('connection timing rejects stale snapshots from rolling back the accepted clock', async () => {
  const GameNetConnectionTiming = await loadConnectionTimingFactory();
  const timing = GameNetConnectionTiming.create({
    getPingCadenceMs() { return 500; },
    getIsConnected() { return true; },
    getNowMs() { return 1200; }
  });

  assert.equal(timing.updateSnapshotTiming({
    snapshotSeq: 10,
    serverTime: 1000,
    receivedAt: 1100
  }), true);

  const firstState = timing.connectionTimingState();
  assert.equal(firstState.snapshot.serverTime, 1000);
  assert.equal(firstState.snapshot.serverTimeOffsetMs, 100);

  assert.equal(timing.updateSnapshotTiming({
    snapshotSeq: 9,
    serverTime: 900,
    receivedAt: 1150
  }), false);

  const secondState = timing.connectionTimingState();
  assert.equal(secondState.snapshot.serverTime, 1000);
  assert.equal(secondState.snapshot.serverTimeOffsetMs, 100);
  assert.equal(timing.authoritativeNowMs(), 1100);
});
