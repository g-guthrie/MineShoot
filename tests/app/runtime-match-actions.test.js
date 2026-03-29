import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadRuntimeMatchActionsHarness() {
  const code = await fs.readFile(new URL('../../js/app/runtime-match-actions.js', import.meta.url), 'utf8');
  const predictedFeedback = [];
  const sentFire = [];
  const triggerActions = [];
  const audioCalls = [];
  const sandbox = {
    console,
    Date: class FakeDate extends Date {
      static now() {
        return 1700000000000;
      }
    },
    document: {
      hasFocus() {
        return true;
      }
    },
    globalThis: null,
    __MAYHEM_RUNTIME: {}
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);
  const factory = sandbox.__MAYHEM_RUNTIME.GameRuntimeMatchActions;
  const actions = factory.create({
    isMultiplayerMode() { return true; },
    getCamera() { return { fov: 56 }; },
    getGamePlayerApi() {
      return {
        canUseWeapon() { return true; },
        isRolling() { return false; },
        getNetworkInputState() { return { sprint: false }; },
        isSprintKeyHeld() { return false; },
        isSprinting() { return false; },
        triggerAction(action) {
          triggerActions.push(String(action || ''));
        }
      };
    },
    getCurrentSelfCombatApi() {
      return {
        canUseGameplayActions() { return true; }
      };
    },
    getGameHitscanApi() {
      return {
        getCurrentWeapon() {
          return { id: 'rifle', cooldownMs: 400 };
        },
        shouldPredictNetHit() { return true; },
        fire(camera, onHit, _onMiss, shotToken) {
          onHit(
            { userData: { ownerType: 'net' } },
            { x: 1, y: 2, z: 3 },
            12,
            'body',
            24,
            { id: 'rifle' },
            0
          );
          return !!camera && typeof shotToken === 'string' && shotToken.length > 0;
        }
      };
    },
    getGameNetApi() {
      return {
        isConnected() { return true; }
      };
    },
    getGameNetFeedbackSyncApi() {
      return {
        emitPredictedLocalDamageFeedback(payload) {
          predictedFeedback.push(JSON.parse(JSON.stringify(payload)));
        }
      };
    },
    getCurrentMatchCommandApi() {
      return {
        sendFire(weaponId, shotToken) {
          sentFire.push({ weaponId: String(weaponId || ''), shotToken: String(shotToken || '') });
          return true;
        }
      };
    },
    getGameAudioApi() {
      return {
        play(name, payload) {
          audioCalls.push({ name: String(name || ''), payload: JSON.parse(JSON.stringify(payload || {})) });
        }
      };
    }
  });

  return {
    actions,
    predictedFeedback,
    sentFire,
    triggerActions,
    audioCalls
  };
}

test('runtime match actions use the real local fire flow for multiplayer prediction and net send', async () => {
  const harness = await loadRuntimeMatchActionsHarness();

  harness.actions.tryPlayerFire();

  assert.equal(harness.predictedFeedback.length, 1);
  assert.equal(harness.sentFire.length, 1);
  assert.equal(harness.triggerActions.includes('fire'), true);
  assert.equal(harness.audioCalls.length, 1);
  assert.equal(harness.sentFire[0].weaponId, 'rifle');
  assert.equal(harness.predictedFeedback[0].weaponId, 'rifle');
  assert.equal(harness.predictedFeedback[0].damage, 24);
  assert.equal(harness.predictedFeedback[0].shotToken, harness.sentFire[0].shotToken);
});
