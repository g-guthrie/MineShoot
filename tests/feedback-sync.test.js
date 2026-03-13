import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadFeedbackSyncHarness(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../js/net/feedback-sync.js', import.meta.url), 'utf8');
  const audioCalls = [];
  const uiCalls = [];
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
      showKillMarker() { uiCalls.push('kill'); },
      showHitMarker() { uiCalls.push('hit'); },
      showDamageNumber() { uiCalls.push('damage'); }
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
    notifyPredictedLocalHit: sandbox.__MAYHEM_RUNTIME.GameNetFeedbackSync.notifyPredictedLocalHit,
    audioCalls,
    uiCalls
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

test('feedback sync suppresses duplicate non-kill hitmarker feedback after a predicted local hit', async () => {
  const queue = [{
    damage: 24,
    hitType: 'body',
    weaponId: 'rifle',
    killed: false,
    worldPos: { x: 1, y: 2, z: 3 }
  }];
  const originalDateNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const harness = await loadFeedbackSyncHarness({
      GameNet: {
        consumeClassCastResult() { return null; },
        consumeDamageFeedback() { return queue.shift() || null; },
        consumeIncomingDamageFeedback() { return null; },
        consumeThrowAck() { return null; },
        consumeThrowReject() { return null; },
        getAuthoritativeThrowableState() { return { projectiles: [], fireZones: [], selfThrowables: null }; },
        consumeThrowableEvent() { return null; },
        consumeAbilityEvent() { return null; },
        damagePointForEntityId() { return null; }
      }
    });

    harness.notifyPredictedLocalHit({ weaponId: 'rifle' });
    now = 1080;
    harness.syncGameplayFeedback({ camera: {} });

    assert.deepEqual(harness.audioCalls, []);
    assert.deepEqual(harness.uiCalls, ['damage']);
  } finally {
    Date.now = originalDateNow;
  }
});
