import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadAbilityFx() {
  const code = await fs.readFile(new URL('../../js/combat/ability-fx.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {},
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameAbilityFx;
}

test('ability fx resolveHookVisualEnd fills provided output objects without changing fallback behavior', async () => {
  const abilityFx = await loadAbilityFx();
  const outVec3 = {
    x: 0,
    y: 0,
    z: 0,
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  };

  const result = abilityFx.resolveHookVisualEnd({
    phase: 'latched',
    targetId: 'enemy:1'
  }, function () {
    return { x: 4, y: 5, z: 6 };
  }, outVec3);

  assert.equal(result, outVec3);
  assert.deepEqual({ x: outVec3.x, y: outVec3.y, z: outVec3.z }, { x: 4, y: 5, z: 6 });
  const fallback = abilityFx.resolveHookVisualEnd({
    phase: 'travel',
    headPos: { x: 1, y: 2, z: 3 }
  });
  assert.deepEqual({ x: fallback.x, y: fallback.y, z: fallback.z }, { x: 1, y: 2, z: 3 });
});
