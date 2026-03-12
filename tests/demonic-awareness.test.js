import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadAwarenessRuntime() {
  const code = await fs.readFile(new URL('../demonic/gameplay/awareness/runtime.js', import.meta.url), 'utf8');
  const sandbox = {
    __DEMONIC_RUNTIME: {},
    globalThis: null,
    console,
    Math
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__DEMONIC_RUNTIME.GameAwarenessRuntime;
}

test('demonic awareness runtime produces radar segments and off-radar beacons from threat points', async () => {
  const api = await loadAwarenessRuntime();
  const runtime = api.create({
    getPlayerSnapshot() {
      return { x: 0, z: 0, yaw: 0 };
    },
    getWorldSnapshot() {
      return {
        threatPoints: [
          { x: 0, z: -5 },
          { x: 0, z: -60 }
        ]
      };
    }
  });

  const state = runtime.getSnapshot();
  assert.equal(Array.isArray(state.segments), true);
  assert.equal(state.segments.length, 8);
  assert.equal(state.coreIntensity > 0, true);
  assert.equal(state.beacons.length > 0, true);
});
