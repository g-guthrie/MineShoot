import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

import {
  buildMotionStateFromSnapshot,
  replayMotionState,
  shouldReplayAuthoritativeCorrection
} from '../shared/authoritative-reconciliation.js';

async function loadPlayerRuntime() {
  const code = await fs.readFile(new URL('../demonic/gameplay/player/runtime.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        authoritativeReconciliation: {
          buildMotionStateFromSnapshot,
          replayMotionState,
          shouldReplayAuthoritativeCorrection
        }
      }
    },
    __DEMONIC_RUNTIME: {
      FeelTuning: {
        mouseSensitivity: 0.002,
        pitchLimitDeg: 89,
        movement: {
          jogSpeed: 8,
          runSpeed: 14,
          jumpVelocity: 8.8,
          gravity: 18,
          adsMoveMult: 0.4
        },
        camera: {
          adsSensitivityMult: 0.7,
          sniperScopeSensitivityMult: 0.42
        }
      }
    },
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);
  return sandbox.__DEMONIC_RUNTIME.GamePlayerRuntime;
}

test('demonic player runtime replays pending inputs from authoritative self snapshots', async () => {
  const api = await loadPlayerRuntime();
  const player = api.create({
    getInputSnapshot() {
      return {};
    },
    consumeLookDelta() {
      return { x: 0, y: 0 };
    },
    getWorldQuery() {
      return {
        getBounds() {
          return { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
        },
        getGroundHeightAt() {
          return 0;
        }
      };
    },
    getCombatSnapshot() {
      return { selectedWeaponId: 'machinegun' };
    }
  });

  player.reconcileAuthoritativeMotion(
    { x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0, isGrounded: true, velocityY: 0 },
    {
      lastAckedSeq: 3,
      pendingInputs: [
        {
          dtMs: 50,
          yaw: 0,
          pitch: 0,
          inputState: { moveForward: true }
        },
        {
          dtMs: 100,
          yaw: 0,
          pitch: 0,
          inputState: { moveForward: true }
        }
      ]
    }
  );

  const snapshot = player.getSnapshot();
  assert.equal(player.getLastReplayAckSeq(), 3);
  assert.equal(snapshot.x, 0);
  assert.ok(snapshot.z < -0.99 && snapshot.z > -1.01);
  assert.equal(snapshot.airborne, false);
});
