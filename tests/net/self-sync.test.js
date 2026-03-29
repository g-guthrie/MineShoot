import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadSelfSyncHarness() {
  const code = await fs.readFile(new URL('../../js/net/self-sync.js', import.meta.url), 'utf8');
  let motionSyncCall = null;
  const sandbox = {
    console,
    Date,
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameNet: {
          view: {
            getMatchState() { return null; }
          },
          timing: {
            getAuthoritativeNow() { return 1000; },
            toLocalTime(value) { return value; }
          }
        },
        GameNetSelfMotionSync: {
          syncPlayerMotion(reconciliationState, dt) {
            motionSyncCall = {
              reconciliationState: JSON.parse(JSON.stringify(reconciliationState)),
              dt: Number(dt || 0)
            };
          }
        },
        GamePlayer: {
          setAliveVisual() {},
          setRollState() {},
          setStatusState() {},
          setActionRestrictions() {}
        }
      }
    }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);
  return {
    syncPlayerState: sandbox.globalThis.__MAYHEM_RUNTIME.GameNetSelfSync.syncPlayerState,
    getMotionSyncCall() {
      return motionSyncCall;
    }
  };
}

test('self sync prefers the provided reconciliation contract when forwarding motion sync', async () => {
  const harness = await loadSelfSyncHarness();
  const selfState = {
    id: 'usr_self',
    alive: true,
    weaponId: 'rifle'
  };
  const reconciliationState = {
    authoritativeState: {
      id: 'usr_self',
      weaponId: 'rifle'
    },
    pendingInputs: [{
      seq: 2,
      weaponId: 'sniper',
      movementLocked: true,
      inputState: { forward: true }
    }]
  };

  harness.syncPlayerState(selfState, 0.05, {
    reconciliationState
  });

  const motionSyncCall = harness.getMotionSyncCall();
  assert.ok(motionSyncCall);
  assert.equal(motionSyncCall.dt, 0.05);
  assert.deepEqual(motionSyncCall.reconciliationState, reconciliationState);
});
