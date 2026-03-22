import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadPresentationRuntimeLoopHarness(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../../presentation/runtime-loop.js', import.meta.url), 'utf8');
  const calls = {
    tracking: [],
    reticleTargets: [],
    overhead: [],
    awareness: [],
    hud: [],
    hookVisuals: [],
    render: []
  };
  const runtime = {
    GameHitscan: {
      getReticleTargetPreview() {
        return {
          currentAimTargetId: 'enemy:test',
          reticleTarget: {
            group: 'circle',
            active: true
          }
        };
      }
    },
    GameUI: {
      updateTrackingReticle(visible, hasTarget) {
        calls.tracking.push({ visible, hasTarget });
      },
      setReticleTargetState(group, active) {
        calls.reticleTargets.push({ group, active });
      }
    },
    GameOverhead: {
      update(camera, playerPos, aimTargetId) {
        calls.overhead.push({ camera, playerPos, aimTargetId });
      }
    },
    GameAwareness: {
      buildState(playerPos, yaw) {
        calls.awareness.push({ playerPos, yaw });
        return { beacons: [] };
      }
    },
    GameGameplayHudSync: {
      update(state) {
        calls.hud.push(state);
      }
    },
    GameHookVisuals: {
      render(multiplayerMode) {
        calls.hookVisuals.push(multiplayerMode);
      }
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return {
    createLoop: sandbox.__MAYHEM_RUNTIME.GamePresentationRuntimeLoop.create,
    calls
  };
}

test('presentation runtime loop applies reticle target preview without weapon-specific branching', async () => {
  const harness = await loadPresentationRuntimeLoopHarness();
  const camera = {
    layers: {
      set() {}
    }
  };
  const loop = harness.createLoop({
    getCamera() { return camera; },
    getRenderer() {
      return {
        render(scene, nextCamera) {
          harness.calls.render.push({ scene, camera: nextCamera });
        }
      };
    },
    getScene() {
      return { id: 'scene' };
    }
  });

  loop.renderFrame({
    camera,
    currentWeapon: { id: 'shotgun' },
    playerPos: { x: 0, y: 1.6, z: 0 },
    playerRot: { yaw: 0.75 },
    dt: 0.016,
    multiplayerMode: false,
    debugVisualsOn: false,
    controlsApi: {
      hasArmedThrowablePreview() {
        return false;
      }
    }
  });

  assert.deepEqual(harness.calls.reticleTargets, [{ group: 'circle', active: true }]);
  assert.equal(harness.calls.overhead[0].aimTargetId, 'enemy:test');
  assert.equal(harness.calls.render.length, 1);
});
