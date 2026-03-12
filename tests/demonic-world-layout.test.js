import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadWorldLayout() {
  const code = await fs.readFile(new URL('../demonic/gameplay/world/layout.js', import.meta.url), 'utf8');
  const sandbox = {
    __DEMONIC_RUNTIME: {},
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__DEMONIC_RUNTIME.GameWorldLayout;
}

test('demonic world layout defines one arena source for bounds, spawns, threats, and cover', async () => {
  const api = await loadWorldLayout();
  const layout = api.createArenaLayout();

  assert.equal(layout.worldSeed, 'demonic-seed-a');
  assert.equal(Array.isArray(layout.spawnPoints), true);
  assert.equal(layout.spawnPoints.length > 0, true);
  assert.equal(Array.isArray(layout.threatPoints), true);
  assert.equal(Array.isArray(layout.coverBlocks), true);
  assert.equal(layout.coverBlocks.length >= 5, true);
  assert.equal(layout.bounds.minX, -50);
  assert.equal(layout.bounds.maxZ, 50);
});
