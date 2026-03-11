import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadSelfSyncHarness(runtimeOverrides = {}) {
  const statusCalls = [];
  const actionRestrictionCalls = [];
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
      reconcileAuthoritativeMotion() {}
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
    '../js/ability-fx.js',
    '../js/net/self-sync.js'
  ]) {
    const code = await fs.readFile(new URL(path, import.meta.url), 'utf8');
    vm.runInContext(code, context);
  }
  return {
    syncPlayerState: sandbox.__MAYHEM_RUNTIME.GameNetSelfSync.syncPlayerState,
    statusCalls,
    actionRestrictionCalls,
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
