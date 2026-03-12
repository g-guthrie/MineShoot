import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadWorldRuntime() {
  const layoutCode = await fs.readFile(new URL('../demonic/gameplay/world/layout.js', import.meta.url), 'utf8');
  const boundsCode = await fs.readFile(new URL('../demonic/gameplay/world/bounds.js', import.meta.url), 'utf8');
  const collisionCode = await fs.readFile(new URL('../demonic/gameplay/world/collision.js', import.meta.url), 'utf8');
  const runtimeCode = await fs.readFile(new URL('../demonic/gameplay/world/runtime.js', import.meta.url), 'utf8');
  const sandbox = {
    __DEMONIC_RUNTIME: {},
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(layoutCode, context);
  vm.runInContext(boundsCode, context);
  vm.runInContext(collisionCode, context);
  vm.runInContext(runtimeCode, context);
  return sandbox.__DEMONIC_RUNTIME.GameWorldRuntime;
}

test('demonic world runtime exposes a single query owner for bounds and grounding', async () => {
  const api = await loadWorldRuntime();
  const world = api.create({
    mode: { id: 'single_full_sandbox' },
    context: { roomId: 'local' }
  });

  const query = world.getQuery();
  const spawn = query.getDefaultSpawnPoint();
  const clamped = query.clampHorizontalPosition(-99, 140);

  assert.equal(typeof spawn.x, 'number');
  assert.equal(typeof spawn.z, 'number');
  assert.equal(clamped.x >= -50, true);
  assert.equal(clamped.z <= 50, true);
  assert.equal(query.getGroundHeightAt(0, 0), 0);
  assert.equal(world.getSnapshot().coverBlocks.length > 0, true);
});
