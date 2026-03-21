import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadAwareness(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../../js/core/awareness.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: runtimeOverrides,
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameAwareness;
}

test('awareness consumes scratch lock target providers without cloning entries', async () => {
  const localTargets = [{
    targetId: 'enemy:1',
    worldPos: { x: 0, y: 0, z: -12 },
    alive: true
  }];
  const netTargets = [{
    targetId: 'net:remote',
    worldPos: { x: 16, y: 0, z: 0 },
    alive: true
  }];
  const awareness = await loadAwareness({
    GameEnemy: {
      getLockTargets() {
        return localTargets;
      }
    },
    GameNet: {
      view: {
        getLockTargets() {
          return netTargets;
        }
      }
    }
  });

  const firstTargets = awareness.collectTargets();
  const secondTargets = awareness.collectTargets();
  const state = awareness.buildState({ x: 0, z: 0 }, 0);

  assert.equal(firstTargets, secondTargets);
  assert.equal(firstTargets[0], localTargets[0]);
  assert.equal(firstTargets[1], netTargets[0]);
  assert.equal(state.segments.length, 8);
  assert.ok(state.segments.some((value) => value > 0));
});
