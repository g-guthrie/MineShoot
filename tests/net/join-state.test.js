import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadJoinStateFactory() {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  const context = vm.createContext(sandbox);
  const code = await fs.readFile(new URL('../../js/net/join-state.js', import.meta.url), 'utf8');
  vm.runInContext(code, context);
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameNetJoinState;
}

test('GameNetJoinState times out even when callers forget to mark transport connect start', async () => {
  const GameNetJoinState = await loadJoinStateFactory();
  const joinState = GameNetJoinState.create({
    sanitizeRoomId(value) {
      return String(value || '').trim().toLowerCase();
    },
    getRoomId() {
      return 'ffa-01';
    }
  });

  await assert.rejects(
    joinState.beginJoinAttempt({ expectedRoomId: 'FFA-01', timeoutMs: 5 }),
    /Timed out joining room FFA-01\./
  );
  assert.equal(joinState.hasJoinAttempt(), false);
});
