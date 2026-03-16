import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadLegacyMain(sandboxRuntime = {}) {
  const code = await fs.readFile(new URL('../../js/runtime/main.js', import.meta.url), 'utf8');
  const sandbox = {
    globalThis: {
      __MAYHEM_RUNTIME: {
        ...sandboxRuntime
      }
    }
  };
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameMain;
}

test('runtime main compatibility facade lazily delegates to the runtime coordinator', async () => {
  let createCalls = 0;
  let launchCalls = 0;
  let activityCalls = 0;

  const gameMain = await loadLegacyMain({
    GameRuntimeCoordinator: {
      create() {
        createCalls += 1;
        return {
          launchModeById(modeId, options) {
            launchCalls += 1;
            return { ok: true, modeId, options };
          },
          getActivityState() {
            activityCalls += 1;
            return 'private_room_lobby';
          }
        };
      }
    }
  });

  assert.equal(typeof gameMain.launchModeById, 'function');
  assert.equal(typeof gameMain.getActivityState, 'function');
  assert.equal(createCalls, 0);

  assert.equal(gameMain.getActivityState(), 'private_room_lobby');
  assert.equal(createCalls, 1);
  assert.equal(activityCalls, 1);

  assert.deepEqual(
    gameMain.launchModeById('cloud_multiplayer', { roomId: 'ffa-01' }),
    { ok: true, modeId: 'cloud_multiplayer', options: { roomId: 'ffa-01' } }
  );
  assert.equal(createCalls, 1);
  assert.equal(launchCalls, 1);
});

test('runtime main compatibility facade falls back cleanly when the runtime coordinator is unavailable', async () => {
  const gameMain = await loadLegacyMain();

  assert.equal(gameMain.getActivityState(), 'menu');
  assert.deepEqual(
    JSON.parse(JSON.stringify(await gameMain.launchModeById('cloud_multiplayer', { roomId: 'ffa-01' }))),
    { ok: false, error: 'GameRuntimeCoordinator is unavailable.' }
  );
});

test('runtime main leaves an already-registered GameMain implementation untouched', async () => {
  const existingMain = {
    launchModeById() {
      return { ok: true, owner: 'existing' };
    },
    getActivityState() {
      return 'in_match';
    }
  };

  const gameMain = await loadLegacyMain({
    GameMain: existingMain
  });

  assert.equal(gameMain, existingMain);
  assert.deepEqual(gameMain.launchModeById('cloud_multiplayer', {}), { ok: true, owner: 'existing' });
  assert.equal(gameMain.getActivityState(), 'in_match');
});
