import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadFeedbackSyncHarness(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../../js/net/feedback-sync.js', import.meta.url), 'utf8');
  const audioCalls = [];
  const uiCalls = [];
  const damageCalls = [];
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
      showPredictedHitMarker() { uiCalls.push('predicted'); },
      showDamageNumber(_worldPoint, damage, isKill, _camera, hitType, options) {
        uiCalls.push('damage');
        damageCalls.push({
          damage,
          isKill: !!isKill,
          hitType,
          options: options ? JSON.parse(JSON.stringify(options)) : undefined
        });
      }
    },
    GamePlayerCombat: {
      showIncomingFeedback() {}
    },
    GameShared: {
      gameplayTuning: {
        network: {
          feedback: {
            predictedHitTtlMs: 900,
            confirmedShotTtlMs: 2000
          }
        }
      }
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    Date,
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
    emitPredictedLocalDamageFeedback: sandbox.__MAYHEM_RUNTIME.GameNetFeedbackSync.emitPredictedLocalDamageFeedback,
    emitPredictedLocalHitFeedback: sandbox.__MAYHEM_RUNTIME.GameNetFeedbackSync.emitPredictedLocalHitFeedback,
    audioCalls,
    uiCalls,
    damageCalls
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

test('feedback sync can emit predicted local hit feedback immediately and register the shot token', async () => {
  const queue = [{
    damage: 24,
    hitType: 'body',
    weaponId: 'rifle',
    shotToken: 'predicted-shot',
    pelletIndex: 0,
    killed: false,
    worldPos: { x: 1, y: 2, z: 3 }
  }];
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

  harness.emitPredictedLocalDamageFeedback({
    weaponId: 'rifle',
    hitType: 'body',
    shotToken: 'predicted-shot',
    pelletIndex: 0,
    damage: 24,
    worldPos: { x: 1, y: 2, z: 3 },
    camera: {}
  });
  harness.syncGameplayFeedback({ camera: {} });

  assert.deepEqual(harness.audioCalls, ['bulletImpact']);
  assert.deepEqual(harness.uiCalls, ['damage', 'hit']);
  assert.deepEqual(harness.damageCalls, [{
    damage: 24,
    isKill: false,
    hitType: 'body',
    options: undefined
  }]);
});

test('feedback sync reveals the authoritative target overhead bar when damage lands', async () => {
  const reveals = [];
  const queue = [{
    damage: 24,
    hitType: 'body',
    weaponId: 'rifle',
    shotToken: 'overhead-shot',
    pelletIndex: 0,
    killed: false,
    targetId: 'net:usr_target',
    worldPos: { x: 1, y: 2, z: 3 }
  }];
  const harness = await loadFeedbackSyncHarness({
    GameOverhead: {
      revealTarget(targetId, durationMs) {
        reveals.push({ targetId, durationMs });
      }
    },
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

  harness.syncGameplayFeedback({ camera: {} });

  assert.deepEqual(reveals, [{ targetId: 'net:usr_target', durationMs: 1500 }]);
});

test('feedback sync suppresses duplicate non-kill hitmarker feedback after a predicted local hit', async () => {
  const queue = [{
    damage: 24,
    hitType: 'body',
    weaponId: 'rifle',
    shotToken: 'shot_same',
    pelletIndex: 0,
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

    harness.notifyPredictedLocalHit({ weaponId: 'rifle', shotToken: 'shot_same', pelletIndex: 0 });
    now = 1080;
    harness.syncGameplayFeedback({ camera: {} });

    assert.deepEqual(harness.audioCalls, []);
    assert.deepEqual(harness.uiCalls, ['hit']);
    assert.deepEqual(harness.damageCalls, []);
  } finally {
    Date.now = originalDateNow;
  }
});

test('feedback sync does not suppress a later authoritative hit from the same weapon when the shot token differs', async () => {
  const queue = [{
    damage: 32,
    hitType: 'body',
    weaponId: 'rifle',
    shotToken: 'shot_two',
    pelletIndex: 0,
    killed: false,
    worldPos: { x: 4, y: 5, z: 6 }
  }];
  const originalDateNow = Date.now;
  let now = 2000;
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

    harness.notifyPredictedLocalHit({ weaponId: 'rifle', shotToken: 'shot_one', pelletIndex: 0 });
    now = 2080;
    harness.syncGameplayFeedback({ camera: {} });

    assert.deepEqual(harness.audioCalls, ['bulletImpact']);
    assert.deepEqual(harness.uiCalls, ['hit', 'damage']);
    assert.equal(harness.damageCalls.length, 1);
  } finally {
    Date.now = originalDateNow;
  }
});

test('feedback sync tracks multiple in-flight predicted hits by shot token', async () => {
  const queue = [
    {
      damage: 18,
      hitType: 'body',
      weaponId: 'rifle',
      shotToken: 'shot_two',
      pelletIndex: 0,
      killed: false,
      worldPos: { x: 1, y: 2, z: 3 }
    },
    {
      damage: 22,
      hitType: 'body',
      weaponId: 'rifle',
      shotToken: 'shot_three',
      pelletIndex: 0,
      killed: false,
      worldPos: { x: 3, y: 4, z: 5 }
    }
  ];
  const originalDateNow = Date.now;
  let now = 3000;
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

    harness.notifyPredictedLocalHit({ weaponId: 'rifle', shotToken: 'shot_one', pelletIndex: 0 });
    now += 20;
    harness.notifyPredictedLocalHit({ weaponId: 'rifle', shotToken: 'shot_two', pelletIndex: 0 });
    now += 60;
    harness.syncGameplayFeedback({ camera: {} });

    assert.deepEqual(harness.audioCalls, ['bulletImpact']);
    assert.deepEqual(harness.uiCalls, ['hit', 'hit', 'damage']);
    assert.equal(harness.damageCalls.length, 1);
  } finally {
    Date.now = originalDateNow;
  }
});

test('feedback sync still suppresses a matching non-kill authoritative hit after higher RTT', async () => {
  const queue = [{
    damage: 27,
    hitType: 'body',
    weaponId: 'rifle',
    shotToken: 'slow-shot',
    pelletIndex: 0,
    killed: false,
    worldPos: { x: 7, y: 8, z: 9 }
  }];
  const originalDateNow = Date.now;
  let now = 4000;
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

    harness.notifyPredictedLocalHit({ weaponId: 'rifle', shotToken: 'slow-shot', pelletIndex: 0 });
    now = 4780;
    harness.syncGameplayFeedback({ camera: {} });

    assert.deepEqual(harness.audioCalls, []);
    assert.deepEqual(harness.uiCalls, ['hit']);
    assert.deepEqual(harness.damageCalls, []);
  } finally {
    Date.now = originalDateNow;
  }
});

test('feedback sync lets predicted hit suppression expire after the predicted-hit TTL', async () => {
  const queue = [{
    damage: 21,
    hitType: 'body',
    weaponId: 'rifle',
    shotToken: 'expired-shot',
    pelletIndex: 0,
    killed: false,
    worldPos: { x: 6, y: 7, z: 8 }
  }];
  const originalDateNow = Date.now;
  let now = 7000;
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

    harness.notifyPredictedLocalHit({ weaponId: 'rifle', shotToken: 'expired-shot', pelletIndex: 0 });
    now = 7920;
    harness.syncGameplayFeedback({ camera: {} });

    assert.deepEqual(harness.audioCalls, ['bulletImpact']);
    assert.deepEqual(harness.uiCalls, ['hit', 'damage']);
    assert.equal(harness.damageCalls.length, 1);
  } finally {
    Date.now = originalDateNow;
  }
});

test('feedback sync keeps confirmed-shot suppression alive past the predicted-hit TTL', async () => {
  const queue = [
    {
      damage: 26,
      hitType: 'body',
      weaponId: 'rifle',
      shotToken: 'confirm-window',
      pelletIndex: 0,
      killed: false,
      worldPos: { x: 1, y: 2, z: 3 }
    },
    {
      damage: 26,
      hitType: 'body',
      weaponId: 'rifle',
      shotToken: 'confirm-window',
      pelletIndex: 0,
      killed: false,
      worldPos: { x: 1, y: 2, z: 3 }
    }
  ];
  const originalDateNow = Date.now;
  let now = 8000;
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

    harness.syncGameplayFeedback({ camera: {} });
    now = 9200;
    harness.syncGameplayFeedback({ camera: {} });

    assert.deepEqual(harness.audioCalls, ['bulletImpact', 'bulletImpact']);
    assert.deepEqual(harness.uiCalls, ['hit', 'damage', 'damage']);
    assert.equal(harness.damageCalls.length, 2);
  } finally {
    Date.now = originalDateNow;
  }
});

test('feedback sync reads suppression TTLs from shared tuning', async () => {
  const queue = [{
    damage: 21,
    hitType: 'body',
    weaponId: 'rifle',
    shotToken: 'shared-ttl',
    pelletIndex: 0,
    killed: false,
    worldPos: { x: 6, y: 7, z: 8 }
  }];
  const originalDateNow = Date.now;
  let now = 7000;
  Date.now = () => now;
  try {
    const harness = await loadFeedbackSyncHarness({
      GameShared: {
        gameplayTuning: {
          network: {
            feedback: {
              predictedHitTtlMs: 100,
              confirmedShotTtlMs: 150
            }
          }
        }
      },
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

    harness.notifyPredictedLocalHit({ weaponId: 'rifle', shotToken: 'shared-ttl', pelletIndex: 0 });
    now = 7120;
    harness.syncGameplayFeedback({ camera: {} });

    assert.deepEqual(harness.audioCalls, ['bulletImpact']);
    assert.equal(harness.damageCalls.length, 1);
  } finally {
    Date.now = originalDateNow;
  }
});

test('feedback sync tracks shotgun pellets independently while showing only one authoritative white X per shot', async () => {
  const queue = [
    {
      damage: 14,
      hitType: 'body',
      weaponId: 'shotgun',
      shotToken: 'pellet-burst',
      pelletIndex: 0,
      killed: false,
      worldPos: { x: 1, y: 2, z: 3 }
    },
    {
      damage: 19,
      hitType: 'head',
      weaponId: 'shotgun',
      shotToken: 'pellet-burst',
      pelletIndex: 1,
      killed: false,
      worldPos: { x: 4, y: 5, z: 6 }
    }
  ];
  const originalDateNow = Date.now;
  let now = 5000;
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

    harness.emitPredictedLocalDamageFeedback({
      weaponId: 'shotgun',
      shotToken: 'pellet-burst',
      pelletIndex: 0,
      hitType: 'body',
      damage: 14,
      worldPos: { x: 1, y: 2, z: 3 },
      camera: {}
    });
    now += 20;
    harness.emitPredictedLocalDamageFeedback({
      weaponId: 'shotgun',
      shotToken: 'pellet-burst',
      pelletIndex: 1,
      hitType: 'head',
      damage: 19,
      worldPos: { x: 4, y: 5, z: 6 },
      camera: {}
    });
    now += 180;
    harness.syncGameplayFeedback({ camera: {} });

    assert.deepEqual(harness.audioCalls, ['bulletImpact', 'bulletImpact']);
    assert.deepEqual(harness.uiCalls, ['damage', 'damage', 'hit']);
    assert.deepEqual(harness.damageCalls, [
      {
        damage: 14,
        isKill: false,
        hitType: 'body',
        options: { spreadX: 152, spreadY: 72 }
      },
      {
        damage: 19,
        isKill: false,
        hitType: 'head',
        options: { spreadX: 152, spreadY: 72 }
      }
    ]);
  } finally {
    Date.now = originalDateNow;
  }
});

test('feedback sync still shows authoritative kill feedback even after a predicted local hit', async () => {
  const queue = [{
    damage: 120,
    hitType: 'head',
    weaponId: 'sniper',
    shotToken: 'kill-shot',
    pelletIndex: 0,
    killed: true,
    worldPos: { x: 2, y: 4, z: 6 }
  }];
  const originalDateNow = Date.now;
  let now = 6000;
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

    harness.emitPredictedLocalDamageFeedback({
      weaponId: 'sniper',
      shotToken: 'kill-shot',
      pelletIndex: 0,
      hitType: 'head',
      damage: 120,
      worldPos: { x: 2, y: 4, z: 6 },
      camera: {}
    });
    now += 120;
    harness.syncGameplayFeedback({ camera: {} });

    assert.deepEqual(harness.audioCalls, ['bulletImpact']);
    assert.deepEqual(harness.uiCalls, ['damage', 'kill']);
    assert.deepEqual(harness.damageCalls, [{
      damage: 120,
      isKill: false,
      hitType: 'head',
      options: undefined
    }]);
  } finally {
    Date.now = originalDateNow;
  }
});
