import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadHookVisualsHarness(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../../js/combat/hook-visuals.js', import.meta.url), 'utf8');
  let renderMap = new Map();
  const runtime = {
    GameAbilityFx: {
      resolveHookVisualEnd(state, resolveTargetPosition) {
        if (state && state.targetId) {
          const resolved = resolveTargetPosition(state.targetId);
          if (resolved) return resolved;
        }
        return state && state.endPos ? state.endPos : null;
      }
    },
    GameNet: {
      view: {
        getSelfAbilityState() {
          return null;
        }
      },
      remoteEntities: {
        getRenderMap() {
          return renderMap;
        },
        getHookOriginWorldPosition(_entityId, out) {
          return out.set(1, 2, 3);
        },
        getCoreWorldPosition(_targetId, out) {
          return out.set(6, 7, 8);
        }
      }
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    THREE,
    console
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return {
    api: sandbox.__MAYHEM_RUNTIME.GameHookVisuals,
    setRenderMap(nextMap) {
      renderMap = nextMap;
    }
  };
}

test('hook visuals dispose stale remote chains and clear old scenes on reinit', async () => {
  const harness = await loadHookVisualsHarness();
  const firstScene = new THREE.Scene();
  const secondScene = new THREE.Scene();

  harness.api.init(firstScene);
  harness.setRenderMap(new Map([[
    'usr_remote',
    {
      group: {
        position: new THREE.Vector3(10, 0, -4)
      },
      hookState: {
        targetId: 'usr_target',
        endPos: { x: 6, y: 7, z: 8 }
      }
    }
  ]]));

  harness.api.render(true);
  assert.equal(firstScene.children.length, 26);

  harness.setRenderMap(new Map());
  harness.api.render(true);
  assert.equal(firstScene.children.length, 13);

  harness.api.init(secondScene);
  assert.equal(firstScene.children.length, 0);
  assert.equal(secondScene.children.length, 0);
});

test('hook visuals pass a reusable output vector into hook-end resolution', async () => {
  const receivedOuts = [];
  const harness = await loadHookVisualsHarness({
    GameAbilityFx: {
      resolveHookVisualEnd(state, resolveTargetPosition, out) {
        receivedOuts.push(out);
        const resolved = resolveTargetPosition(state.targetId);
        return out.set(resolved.x, resolved.y, resolved.z);
      }
    },
    GameAbilities: {
      getHookState() {
        return {
          phase: 'latched',
          targetId: 'enemy:1'
        };
      }
    },
    GamePlayer: {
      getThrowableOriginWorldPosition(out) {
        return out.set(1, 2, 3);
      }
    },
    GameEnemy: {
      getLockTargets() {
        return [{
          targetId: 'enemy:1',
          worldPos: new THREE.Vector3(6, 7, 8),
          alive: true
        }];
      }
    }
  });
  const scene = new THREE.Scene();

  harness.api.init(scene);
  harness.api.render(false);
  harness.api.render(false);

  assert.equal(receivedOuts.length, 2);
  assert.ok(receivedOuts[0] instanceof THREE.Vector3);
  assert.equal(receivedOuts[0], receivedOuts[1]);
});
