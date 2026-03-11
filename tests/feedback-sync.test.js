import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadFeedbackSyncHarness(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../js/net/feedback-sync.js', import.meta.url), 'utf8');
  const audioCalls = [];
  const runtime = {
    GameNet: {
      consumeClassCastResult() { return null; },
      consumeDamageFeedback() { return null; },
      consumeAbilityEvent() { return null; },
      consumeIncomingDamageFeedback() { return null; },
      consumeThrowAck() { return null; },
      consumeThrowReject() { return null; },
      getAuthoritativeThrowableState() { return { projectiles: [], fireZones: [], selfThrowables: null }; },
      consumeThrowableEvent() { return null; },
      damagePointForEntityId() { return null; }
    },
    GameAudio: {
      play(name) { audioCalls.push(name); }
    },
    GamePlayer: {
      getPosition() { return { x: 0, y: 1.6, z: 0 }; }
    },
    GameThrowables: {
      syncAuthoritativeState() {},
      applyNetworkEvent() {},
      update() {},
      confirmPredictedThrow() {},
      rejectPredictedThrow() {}
    },
    GameUI: {
      showKillMarker() {},
      showHitMarker() {},
      showDamageNumber() {}
    },
    GamePlayerCombat: {
      showIncomingFeedback() {}
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE: {
      Vector3: class {
        constructor(x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        }
      }
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return {
    syncGameplayFeedback: sandbox.__MAYHEM_RUNTIME.GameNetFeedbackSync.syncGameplayFeedback,
    audioCalls
  };
}

test('feedback sync plays choke cast for the victim and nearby bystanders', async () => {
  const queue = [];
  const harness = await loadFeedbackSyncHarness({
    GameNet: {
      consumeClassCastResult() { return null; },
      consumeDamageFeedback() { return null; },
      consumeIncomingDamageFeedback() { return null; },
      consumeThrowAck() { return null; },
      consumeThrowReject() { return null; },
      getAuthoritativeThrowableState() { return { projectiles: [], fireZones: [], selfThrowables: null }; },
      consumeThrowableEvent() { return null; },
      consumeAbilityEvent() {
        return queue.shift() || null;
      },
      damagePointForEntityId() {
        return { x: 3, y: 1.6, z: 0 };
      }
    }
  });

  queue.push({ abilityId: 'choke', sourceId: 'usr_other', targetId: 'usr_self' });
  harness.syncGameplayFeedback({ selfState: { id: 'usr_self' }, dt: 0.016 });
  queue.push({ abilityId: 'choke', sourceId: 'usr_other', targetId: 'usr_target' });
  harness.syncGameplayFeedback({ selfState: { id: 'usr_self' }, dt: 0.016 });

  assert.deepEqual(harness.audioCalls, ['chokeCast', 'chokeCast']);
});

test('feedback sync ignores distant choke casts for unrelated bystanders', async () => {
  const queue = [{ abilityId: 'choke', sourceId: 'usr_far', targetId: 'usr_target' }];
  const harness = await loadFeedbackSyncHarness({
    GameNet: {
      consumeClassCastResult() { return null; },
      consumeDamageFeedback() { return null; },
      consumeIncomingDamageFeedback() { return null; },
      consumeThrowAck() { return null; },
      consumeThrowReject() { return null; },
      getAuthoritativeThrowableState() { return { projectiles: [], fireZones: [], selfThrowables: null }; },
      consumeThrowableEvent() { return null; },
      consumeAbilityEvent() {
        return queue.shift() || null;
      },
      damagePointForEntityId() {
        return { x: 80, y: 1.6, z: 0 };
      }
    }
  });

  harness.syncGameplayFeedback({ selfState: { id: 'usr_self' }, dt: 0.016 });

  assert.deepEqual(harness.audioCalls, []);
});
