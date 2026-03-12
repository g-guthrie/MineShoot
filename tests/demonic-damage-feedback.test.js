import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadDamageRuntime() {
  const code = await fs.readFile(new URL('../demonic/gameplay/feedback/damage-runtime.js', import.meta.url), 'utf8');
  const sandbox = {
    __DEMONIC_RUNTIME: {},
    globalThis: null,
    console,
    Math
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__DEMONIC_RUNTIME.GameDamageFeedbackRuntime;
}

test('demonic damage feedback runtime records directional sectors and flash level', async () => {
  const api = await loadDamageRuntime();
  const runtime = api.create({
    getPlayerSnapshot() {
      return { x: 0, z: 0, yaw: 0 };
    }
  });

  runtime.trigger({ x: 8, z: -6 }, 48);
  const state = runtime.getSnapshot();
  const lit = state.sectors.filter((value) => value > 0);

  assert.equal(lit.length > 0, true);
  assert.equal(state.flashLevel > 0, true);
});
