import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadStatusHarness() {
  const code = await fs.readFile(new URL('../../js/actors/player-status.js', import.meta.url), 'utf8');
  let now = 1000;
  let spawnShieldVisual = null;
  const sandbox = {
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  vm.runInContext(code, vm.createContext(sandbox));
  const factory = sandbox.globalThis.__MAYHEM_RUNTIME.GamePlayerStatus;
  const api = factory.create({
    nowMs() {
      return now;
    },
    getAbilityFxApi() {
      return {
        chokeLiftAt(state, stamp) {
          return stamp >= Number(state.startedAt || 0) ? Number(state.chokeLift || 0) : 0;
        }
      };
    },
    onStatusVisualChange(snapshot) {
      spawnShieldVisual = !!(snapshot && snapshot.spawnShielded);
    }
  });
  return {
    api,
    setNow(value) {
      now = Number(value || 0);
    },
    getSpawnShieldVisual() {
      return spawnShieldVisual;
    }
  };
}

test('player status applies action restrictions and clears them once they expire', async () => {
  const harness = await loadStatusHarness();
  harness.api.applyStatusState({
    weaponUntil: 1300,
    throwableUntil: 1400,
    abilityUntil: 1500
  });

  assert.equal(harness.api.canUseWeapon(), false);
  assert.equal(harness.api.canUseThrowable(), false);
  assert.equal(harness.api.canUseAbility(), false);

  harness.setNow(1600);
  harness.api.clearExpiredStatusState();

  assert.equal(harness.api.canUseWeapon(), true);
  assert.equal(harness.api.canUseThrowable(), true);
  assert.equal(harness.api.canUseAbility(), true);
});

test('player status reports movement lock and choke lift from the status timeline', async () => {
  const harness = await loadStatusHarness();
  harness.api.applyStatusState({
    chokeStartedAt: 1000,
    chokeUntil: 1600,
    chokeLift: 1.4,
    hookPullUntil: 1500
  });

  assert.equal(harness.api.isMovementLocked(), true);
  assert.equal(harness.api.isChoked(), true);
  assert.equal(harness.api.activeChokeLift(), 1.4);

  harness.setNow(1700);
  harness.api.clearExpiredStatusState();

  assert.equal(harness.api.isMovementLocked(), false);
  assert.equal(harness.api.activeChokeLift(), 0);
});

test('player status updates spawn shield visual state when the shield changes', async () => {
  const harness = await loadStatusHarness();

  harness.api.applyStatusState({
    spawnShieldUntil: 1300
  });
  assert.equal(harness.getSpawnShieldVisual(), true);

  harness.setNow(1400);
  harness.api.clearExpiredStatusState();
  harness.api.applyStatusState({
    spawnShieldUntil: 0
  });
  assert.equal(harness.getSpawnShieldVisual(), false);
});
