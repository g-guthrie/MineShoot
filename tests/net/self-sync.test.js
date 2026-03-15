import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadSelfSyncHarness(runtimeOverrides = {}) {
  const statusCalls = [];
  const actionRestrictionCalls = [];
  const reconcileCalls = [];
  const runtime = {
    GameNet: {
      getMatchState() { return null; }
    },
    GamePlayer: {
      setAliveVisual() {},
      setStatusState(state) {
        statusCalls.push(JSON.parse(JSON.stringify(state)));
      },
      setActionRestrictions(state) {
        actionRestrictionCalls.push(JSON.parse(JSON.stringify(state)));
      },
      reconcileAuthoritativeMotion(_state, options) {
        reconcileCalls.push(JSON.parse(JSON.stringify(options || {})));
      }
    },
    GamePlayerCombat: {
      syncFromNetwork() {}
    },
    GameHitscan: {},
    GameThrowables: {},
    GameUI: {},
    ...runtimeOverrides
  };
  const timeState = { now: 1000 };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    Date: {
      now() {
        return timeState.now;
      }
    }
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  for (const path of [
    '../../js/combat/ability-fx.js',
    '../../js/net/self-sync.js'
  ]) {
    const code = await fs.readFile(new URL(path, import.meta.url), 'utf8');
    vm.runInContext(code, context);
  }
  return {
    syncPlayerState: sandbox.__MAYHEM_RUNTIME.GameNetSelfSync.syncPlayerState,
    statusCalls,
    actionRestrictionCalls,
    reconcileCalls,
    timeState
  };
}

test('GameNetSelfSync uses authoritative lock timers instead of deriving choke locks locally', async () => {
  const harness = await loadSelfSyncHarness();

  harness.syncPlayerState({
    id: 'usr_test',
    alive: true,
    stunUntil: 0,
    spawnShieldUntil: 0,
    weaponLockUntil: 2100,
    throwableLockUntil: 2200,
    abilityLockUntil: 2300,
    abilityFx: {
      chokeCasterUntil: 1250,
      chokeVictim: {
        startedAt: 900,
        endsAt: 1300,
        liftHeight: 1.5
      },
      hookedStartedAt: 1150,
      hookedUntil: 1500
    }
  }, 0.05);

  assert.deepEqual(harness.statusCalls.at(-1), {
    stunUntil: 0,
    hookPullStartedAt: 1150,
    hookPullUntil: 1500,
    chokeStartedAt: 900,
    chokeUntil: 1300,
    chokeLift: 1.5,
    spawnShieldUntil: 0
  });
  assert.deepEqual(harness.actionRestrictionCalls.at(-1), {
    weaponUntil: 2100,
    throwableUntil: 2200,
    abilityUntil: 2300
  });
});

test('GameNetSelfSync remaps authoritative timer stamps onto the local clock when timing data is available', async () => {
  const harness = await loadSelfSyncHarness({
    GameNet: {
      getMatchState() { return null; },
      getAuthoritativeNow() { return 1000; },
      toLocalTime(timestamp) {
        return Number(timestamp || 0) + 600;
      }
    }
  });

  harness.timeState.now = 1600;
  harness.syncPlayerState({
    id: 'usr_test',
    alive: true,
    stunUntil: 1400,
    spawnShieldUntil: 1500,
    weaponLockUntil: 1600,
    throwableLockUntil: 1700,
    abilityLockUntil: 1800,
    abilityFx: {
      chokeVictim: {
        startedAt: 900,
        endsAt: 1300,
        liftHeight: 1.5
      },
      hookedStartedAt: 950,
      hookedUntil: 1250
    }
  }, 0.05);

  assert.deepEqual(harness.statusCalls.at(-1), {
    stunUntil: 2000,
    hookPullStartedAt: 1550,
    hookPullUntil: 1850,
    chokeStartedAt: 1500,
    chokeUntil: 1900,
    chokeLift: 1.5,
    spawnShieldUntil: 2100
  });
  assert.deepEqual(harness.actionRestrictionCalls.at(-1), {
    weaponUntil: 2200,
    throwableUntil: 2300,
    abilityUntil: 2400
  });
});

test('GameNetSelfSync locks the player out for the rest of an LMS round when out of round', async () => {
  const harness = await loadSelfSyncHarness({
    GameNet: {
      getMatchState() {
        return {
          gameMode: 'lms',
          started: true,
          ended: false,
          resetAt: 4200
        };
      }
    }
  });
  harness.syncPlayerState({
    id: 'usr_test',
    alive: false,
    outOfRound: true,
    stunUntil: 0,
    spawnShieldUntil: 0,
    weaponLockUntil: 0,
    throwableLockUntil: 0,
    abilityLockUntil: 0,
    abilityFx: null
  }, 0.05);

  assert.deepEqual(harness.statusCalls.at(-1), {
    stunUntil: 86401000,
    hookPullStartedAt: 0,
    hookPullUntil: 0,
    chokeStartedAt: 0,
    chokeUntil: 0,
    chokeLift: 0,
    spawnShieldUntil: 0
  });
  assert.deepEqual(harness.actionRestrictionCalls.at(-1), {
    weaponUntil: 86401000,
    throwableUntil: 86401000,
    abilityUntil: 86401000
  });
});

test('GameNetSelfSync enables replay correction when reconciling authoritative motion', async () => {
  const harness = await loadSelfSyncHarness({
    GameNet: {
      getMatchState() { return null; },
      getInputSyncState() {
        return {
          pendingInputCount: 2,
          lastSentSeq: 11,
          lastAckedSeq: 9,
          latestPendingAgeMs: 87,
          latestAckAgeMs: 41,
          ackDrift: 2
        };
      },
      getConnectionTimingState() {
        return {
          rttMs: 118,
          rttJitterMs: 22
        };
      },
      getPendingInputSamples() {
        return [{ seq: 10 }, { seq: 11 }];
      }
    },
    GamePlayer: {
      setAliveVisual() {},
      setStatusState() {},
      setActionRestrictions() {},
      reconcileAuthoritativeMotion(_state, options) {
        harness.reconcileCalls.push(JSON.parse(JSON.stringify(options)));
      }
    }
  });

  harness.syncPlayerState({
    id: 'usr_test',
    alive: true,
    x: 1,
    y: 1.6,
    z: 2,
    weaponLockUntil: 0,
    throwableLockUntil: 0,
    abilityLockUntil: 0,
    abilityFx: null
  }, 0.05);

  assert.equal(harness.reconcileCalls.length, 1);
  assert.equal(harness.reconcileCalls[0].allowReplayCorrection, true);
  assert.equal(harness.reconcileCalls[0].pendingInputCount, 2);
  assert.equal(harness.reconcileCalls[0].lastAckedSeq, 9);
  assert.equal(harness.reconcileCalls[0].latestPendingAgeMs, 87);
  assert.equal(harness.reconcileCalls[0].latestAckAgeMs, 41);
  assert.equal(harness.reconcileCalls[0].ackDrift, 2);
  assert.equal(harness.reconcileCalls[0].rttMs, 118);
  assert.equal(harness.reconcileCalls[0].rttJitterMs, 22);
});

test('GameNetSelfSync can skip local motion reconciliation when a dedicated motion sync already ran', async () => {
  const harness = await loadSelfSyncHarness();

  harness.syncPlayerState({
    id: 'usr_test',
    alive: true,
    x: 1,
    y: 1.6,
    z: 2,
    weaponLockUntil: 0,
    throwableLockUntil: 0,
    abilityLockUntil: 0,
    abilityFx: null
  }, 0.05, {
    skipMotionSync: true
  });

  assert.equal(harness.reconcileCalls.length, 0);
});
