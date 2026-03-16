import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadRuntimeShellHarness({ modes, netApi } = {}) {
  const code = await fs.readFile(new URL('../../js/app/runtime-shell.js', import.meta.url), 'utf8');
  let clearSelectedModeCount = 0;
  let setRoomIdCalls = 0;
  let authHiddenCount = 0;
  let startCalls = 0;
  let failureCalls = 0;

  const sandbox = {
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  vm.runInContext(code, vm.createContext(sandbox));

  const runtimeShell = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeShell.create({
    getRuntimeProfile() {
      return {
        selectMode(modeId) {
          return modes && modes[modeId] ? { ...modes[modeId] } : null;
        },
        clearSelectedMode() {
          clearSelectedModeCount += 1;
        }
      };
    },
    getAuthApi() {
      return {
        setAuthVisible(visible) {
          if (visible === false) authHiddenCount += 1;
        }
      };
    },
    getNetApi() {
      return netApi || null;
    },
    getRuntimeModeUi() {
      return {
        startupNoticeForMode(mode) {
          return 'Launching ' + String(mode && mode.id || '');
        }
      };
    },
    setRoomId() {
      setRoomIdCalls += 1;
    },
    startRuntime() {
      startCalls += 1;
      return Promise.resolve();
    },
    onNetworkLaunchFailure() {
      failureCalls += 1;
    }
  });

  return {
    runtimeShell,
    counts() {
      return {
        clearSelectedModeCount,
        setRoomIdCalls,
        authHiddenCount,
        startCalls,
        failureCalls
      };
    }
  };
}

test('runtime shell waits for authoritative join before resolving networked launches', async () => {
  let resolveJoin = null;
  const harness = await loadRuntimeShellHarness({
    modes: {
      cloud_multiplayer: {
        id: 'cloud_multiplayer',
        authorityMode: 'networked',
        roomId: 'global',
        gameMode: 'ffa'
      }
    },
    netApi: {
      beginJoinAttempt() {
        return new Promise((resolve) => {
          resolveJoin = resolve;
        });
      }
    }
  });

  const launchPromise = harness.runtimeShell.launchModeById('cloud_multiplayer', {
    roomId: 'ffa-01',
    gameMode: 'ffa'
  });

  let settled = false;
  launchPromise.then(() => { settled = true; }, () => { settled = true; });
  await Promise.resolve();

  assert.equal(settled, false);
  assert.equal(harness.counts().startCalls, 1);
  assert.equal(harness.counts().setRoomIdCalls, 1);
  assert.equal(harness.counts().authHiddenCount, 1);

  resolveJoin({ roomId: 'ffa-01', selfId: 'usr_test' });
  const result = await launchPromise;

  assert.equal(result.ok, true);
  assert.equal(result.mode.roomId, 'ffa-01');
});

test('runtime shell supports offline launches without requiring net join state', async () => {
  let beginJoinCalls = 0;
  const harness = await loadRuntimeShellHarness({
    modes: {
      single_full_sandbox: {
        id: 'single_full_sandbox',
        authorityMode: 'offline',
        roomId: '',
        gameMode: 'lms'
      }
    },
    netApi: {
      beginJoinAttempt() {
        beginJoinCalls += 1;
        return Promise.resolve();
      }
    }
  });

  const result = await harness.runtimeShell.launchModeById('single_full_sandbox', {
    gameMode: 'lms'
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode.authorityMode, 'offline');
  assert.equal(beginJoinCalls, 0);
  assert.equal(harness.counts().setRoomIdCalls, 0);
  assert.equal(harness.counts().authHiddenCount, 0);
});

test('runtime shell shuts down net state and clears mode selection on networked launch failure', async () => {
  let rejectJoin = null;
  let resetCalls = 0;
  let shutdownCalls = 0;
  const harness = await loadRuntimeShellHarness({
    modes: {
      cloud_multiplayer: {
        id: 'cloud_multiplayer',
        authorityMode: 'networked',
        roomId: 'global',
        gameMode: 'ffa'
      }
    },
    netApi: {
      beginJoinAttempt() {
        return new Promise((_resolve, reject) => {
          rejectJoin = reject;
        });
      },
      resetJoinAttempt() {
        resetCalls += 1;
      },
      shutdown() {
        shutdownCalls += 1;
      }
    }
  });

  const resultPromise = harness.runtimeShell.launchModeById('cloud_multiplayer', {
    roomId: 'ffa-01',
    gameMode: 'ffa'
  });

  rejectJoin(new Error('Timed out joining room FFA-01.'));
  const result = await resultPromise;

  assert.equal(result.ok, false);
  assert.equal(result.error, 'Timed out joining room FFA-01.');
  assert.equal(resetCalls, 1);
  assert.equal(shutdownCalls, 1);
  assert.equal(harness.counts().failureCalls, 1);
  assert.equal(harness.counts().clearSelectedModeCount, 1);
});
