import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { buildAuthoritativeMotionRevision } from '../../shared/authoritative-reconciliation.js';

async function loadSelfMotionSyncHarness() {
  const code = await fs.readFile(new URL('../../js/net/self-motion-sync.js', import.meta.url), 'utf8');
  let reconcileCall = null;
  const sandbox = {
    console,
    Date,
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameShared: {
          authoritativeReconciliation: {
            buildAuthoritativeMotionRevision
          }
        },
        GameNet: {
          view: {
            getInputSyncState() {
              return {
                pendingInputCount: 1,
                ackDrift: 1,
                latestPendingAgeMs: 80,
                latestAckAgeMs: 20,
                hasUnsentInputTail: false,
                lastSentSeq: 2,
                lastAckedSeq: 1,
                inputSendIntervalMs: 33
              };
            },
            getPendingInputSamples() {
              return [{
                seq: 2,
                dtMs: 50,
                yaw: 0,
                pitch: 0,
                weaponId: 'sniper',
                movementLocked: true,
                inputState: {
                  forward: true,
                  backward: false,
                  left: false,
                  right: false,
                  jump: false,
                  sprint: false,
                  adsActive: true
                }
              }];
            }
          },
          timing: {
            getConnectionTimingState() {
              return { rttMs: 60, rttJitterMs: 5 };
            },
            getAuthoritativeNow() {
              return 1234;
            }
          }
        },
        GamePlayer: {
          reconcileAuthoritativeMotion(state, options) {
            reconcileCall = {
              state: JSON.parse(JSON.stringify(state)),
              options: JSON.parse(JSON.stringify(options))
            };
          }
        }
      }
    }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);
  return {
    syncPlayerMotion: sandbox.globalThis.__MAYHEM_RUNTIME.GameNetSelfMotionSync.syncPlayerMotion,
    getReconcileCall() {
      return reconcileCall;
    }
  };
}

test('self motion sync forwards historical weapon and movement-lock replay samples to player reconciliation', async () => {
  const harness = await loadSelfMotionSyncHarness();

  harness.syncPlayerMotion({
    id: 'usr_self',
    x: 1,
    y: 1.6,
    z: 2,
    yaw: 0,
    pitch: 0,
    velocityY: 0,
    jumpHoldTimer: 0,
    moveSpeedNorm: 0.4,
    isGrounded: true,
    jumpHeldLast: false,
    sprinting: false,
    fastBackpedal: true,
    alive: true,
    weaponId: 'rifle',
    seq: 1
  }, 0.05);

  const reconcileCall = harness.getReconcileCall();
  assert.ok(reconcileCall);
  assert.equal(reconcileCall.options.pendingInputs.length, 1);
  assert.equal(reconcileCall.options.pendingInputs[0].weaponId, 'sniper');
  assert.equal(reconcileCall.options.pendingInputs[0].movementLocked, true);
  assert.match(String(reconcileCall.options.authoritativeMotionRevision || ''), /sniper|rifle/);
});
