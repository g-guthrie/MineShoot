import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadStateView(renderMap) {
  const code = await fs.readFile(new URL('../../js/net/state-view.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {}
    },
    globalThis: null,
    console,
    Map,
    THREE
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameNetStateView.create({
    getRenderMap() {
      return renderMap;
    },
    getRenderCoreWorldPosition(render, outVec3) {
      return outVec3.set(
        Number(render.group.position.x || 0),
        Number(render.group.position.y || 0) + 1,
        Number(render.group.position.z || 0)
      );
    }
  });
}

test('network state view reuses lock target arrays and wrappers across calls', async () => {
  const render = {
    id: 'usr_remote',
    alive: true,
    group: {
      position: new THREE.Vector3(3, 4, 5)
    },
    bodyHitbox: { id: 'body' },
    headHitbox: { id: 'head' }
  };
  const renderMap = new Map([['usr_remote', render]]);
  const view = await loadStateView(renderMap);

  const firstTargets = view.getLockTargets();
  render.group.position.set(8, 9, 10);
  const secondTargets = view.getLockTargets();

  assert.equal(firstTargets.length, 1);
  assert.equal(secondTargets.length, 1);
  assert.equal(firstTargets, secondTargets);
  assert.equal(firstTargets[0], secondTargets[0]);
  assert.equal(firstTargets[0].worldPos, secondTargets[0].worldPos);
  assert.deepEqual(
    { x: secondTargets[0].worldPos.x, y: secondTargets[0].worldPos.y, z: secondTargets[0].worldPos.z },
    { x: 8, y: 10, z: 10 }
  );
});
