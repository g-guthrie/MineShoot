import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadGameplayRuntimeLoopHarness(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../gameplay/runtime-loop.js', import.meta.url), 'utf8');
  const calls = {
    selfSync: []
  };
  const runtime = {
    GameWorld: { update() {} },
    GamePlayer: {
      update() {},
      getPosition() { return { x: 0, y: 1.6, z: 0 }; },
      getRotation() { return { yaw: 0, pitch: 0 }; },
      getAdsState() { return null; },
      getAnimNetState() { return null; },
      isSprinting() { return false; },
      flushDeferredViewSync() {}
    },
    GameHitscan: {
      getCurrentWeapon() { return { id: 'rifle', automatic: false }; },
      tick() {},
      updateTracers() {}
    },
    GameUI: {
      updateWeaponInfo() {},
      updateSprintEffects() {},
      updateAbilityInfo() {}
    },
    GamePlayerCombat: {
      tickInvulnTimer() {},
      tickArmorRegen() {}
    },
    GameNet: {
      update() {},
      view: {
        getSelfReconciliationState() {
          return { authoritativeState: { id: 'usr_test', seq: 1 }, pendingInputs: [] };
        },
        getAuthoritativeSelfState() {
          return { id: 'usr_test', alive: false };
        },
        getRespawnState() {
          return { active: true, respawnAt: 1800, remainingMs: 800 };
        },
        getSelfAbilityState() { return null; },
        consumeNotice() { return ''; }
      }
    },
    GameNetSelfSync: {
      syncPlayerState(state, dt, options) {
        calls.selfSync.push({
          state: JSON.parse(JSON.stringify(state)),
          dt,
          options: JSON.parse(JSON.stringify(options || null))
        });
      }
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return {
    createLoop: sandbox.__MAYHEM_RUNTIME.GameGameplayRuntimeLoop.create,
    calls
  };
}

test('gameplay runtime loop passes reconciliation state through self-state sync', async () => {
  const harness = await loadGameplayRuntimeLoopHarness();
  const loop = harness.createLoop({
    readMatchContext() {
      return {
        selfState: { id: 'usr_test', alive: true }
      };
    },
    getCamera() { return null; }
  });

  loop.step(0.016);

  assert.equal(harness.calls.selfSync.length, 1);
  assert.equal(harness.calls.selfSync[0].state.id, 'usr_test');
  assert.deepEqual(harness.calls.selfSync[0].options, {
    respawnState: { active: true, respawnAt: 1800, remainingMs: 800 },
    reconciliationState: {
      authoritativeState: { id: 'usr_test', seq: 1 },
      pendingInputs: []
    }
  });
});

test('gameplay runtime loop shows sprint effects during fast backpedal without forward sprint state', async () => {
  const sprintCalls = [];
  const harness = await loadGameplayRuntimeLoopHarness({
    GamePlayer: {
      update() {},
      getPosition() { return { x: 0, y: 1.6, z: 0 }; },
      getRotation() { return { yaw: 0, pitch: 0 }; },
      getAdsState() { return null; },
      getAnimNetState() { return { moveSpeedNorm: 0.8, sprinting: false, fastBackpedal: true }; },
      isSprinting() { return false; },
      isFastBackpedal() { return true; },
      flushDeferredViewSync() {}
    },
    GameUI: {
      updateWeaponInfo() {},
      updateSprintEffects(state) { sprintCalls.push(state); },
      updateAbilityInfo() {}
    }
  });
  const loop = harness.createLoop({
    readMatchContext() {
      return { selfState: { id: 'usr_test', alive: true } };
    },
    getCamera() { return null; }
  });

  loop.step(0.016);

  assert.equal(sprintCalls.length, 1);
  assert.equal(sprintCalls[0].intensity, 0.8);
});

test('phone reticle auto-fire requires leaving and re-entering a target', async () => {
  let active = true;
  let targetId = 'enemy:one';
  let fireCalls = 0;
  const harness = await loadGameplayRuntimeLoopHarness({
    GameHitscan: {
      getCurrentWeapon() { return { id: 'rifle', automatic: false }; },
      getReticleTargetPreview() {
        return {
          currentAimTargetId: targetId,
          reticleTarget: {
            group: 'crosshair',
            active
          }
        };
      },
      tick() {},
      updateTracers() {}
    }
  });
  const loop = harness.createLoop({
    readMatchContext() {
      return { selfState: { id: 'usr_test', alive: true } };
    },
    getCamera() { return {}; },
    hasInputCapture() { return true; },
    tryPlayerFire() { fireCalls += 1; },
    controlsApi: {
      isPhoneSizedTouchDevice() { return true; },
      isDesktopAutoFireEnabled() { return false; },
      hasArmedThrowablePreview() { return false; }
    }
  });

  loop.step(0.016);
  loop.step(0.016);
  assert.equal(fireCalls, 1);

  active = false;
  loop.step(0.016);
  active = true;
  loop.step(0.016);
  assert.equal(fireCalls, 2);

  targetId = 'enemy:two';
  loop.step(0.016);
  assert.equal(fireCalls, 3);
});

test('desktop reticle auto-fire remains continuous while the target stays active', async () => {
  let fireCalls = 0;
  const harness = await loadGameplayRuntimeLoopHarness({
    GameHitscan: {
      getCurrentWeapon() { return { id: 'rifle', automatic: false }; },
      getReticleTargetPreview() {
        return {
          currentAimTargetId: 'enemy:one',
          reticleTarget: {
            group: 'crosshair',
            active: true
          }
        };
      },
      tick() {},
      updateTracers() {}
    }
  });
  const loop = harness.createLoop({
    readMatchContext() {
      return { selfState: { id: 'usr_test', alive: true } };
    },
    getCamera() { return {}; },
    hasInputCapture() { return true; },
    tryPlayerFire() { fireCalls += 1; },
    controlsApi: {
      isPhoneSizedTouchDevice() { return false; },
      isDesktopAutoFireEnabled() { return true; },
      hasArmedThrowablePreview() { return false; }
    }
  });

  loop.step(0.016);
  loop.step(0.016);

  assert.equal(fireCalls, 2);
});
