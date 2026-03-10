import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadSelfSyncHarness() {
  const statusCalls = [];
  const actionRestrictionCalls = [];
  const runtime = {
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
    GameUI: {}
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
      hookedUntil: 1500
    }
  }, 0.05);

  assert.deepEqual(harness.statusCalls.at(-1), {
    stunUntil: 0,
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
