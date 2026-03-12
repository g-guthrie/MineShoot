import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function readModule(modulePath) {
  return fs.readFile(new URL(modulePath, import.meta.url), 'utf8');
}

test('runtime coordinator creates the runtime shell lazily and delegates launch/activity calls', async () => {
  const code = await readModule('../js/app/runtime-coordinator.js');
  let shellCreateCalls = 0;
  let launchCalls = 0;
  let activityCalls = 0;

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame() {},
    document: {
      querySelector() { return null; },
      getElementById() { return null; },
      hasFocus() { return false; }
    },
    window: {
      location: {
        pathname: '/'
      }
    },
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameRuntimeShell: {
          create() {
            shellCreateCalls += 1;
            return {
              launchModeById(modeId, options) {
                launchCalls += 1;
                return { ok: true, modeId, options };
              },
              getActivityState() {
                activityCalls += 1;
                return 'menu';
              }
            };
          }
        }
      }
    }
  };

  vm.runInContext(code, vm.createContext(sandbox));

  const factory = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator;
  assert.equal(typeof factory.create, 'function');

  const coordinator = factory.create();
  assert.equal(shellCreateCalls, 0);

  assert.equal(coordinator.getActivityState(), 'menu');
  assert.equal(shellCreateCalls, 1);
  assert.equal(activityCalls, 1);

  assert.deepEqual(
    coordinator.launchModeById('cloud_multiplayer', { roomId: 'room-1' }),
    { ok: true, modeId: 'cloud_multiplayer', options: { roomId: 'room-1' } }
  );
  assert.equal(shellCreateCalls, 1);
  assert.equal(launchCalls, 1);
});

test('main.js initializes GameMain from GameRuntimeCoordinator', async () => {
  const code = await readModule('../js/main.js');
  const createdApi = {
    launchModeById() { return { ok: true }; },
    getActivityState() { return 'menu'; }
  };
  let createCalls = 0;

  const sandbox = {
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameRuntimeCoordinator: {
          create() {
            createCalls += 1;
            return createdApi;
          }
        }
      }
    }
  };

  vm.runInContext(code, vm.createContext(sandbox));

  assert.equal(createCalls, 1);
  assert.equal(sandbox.globalThis.__MAYHEM_RUNTIME.GameMain, createdApi);
});

test('runtime coordinator reads respawn countdown from self combat instead of net selectors', async () => {
  const code = await readModule('../js/app/runtime-coordinator.js');
  let capturedReadMatchContext = null;
  const expectedRespawnState = {
    active: true,
    respawnAt: 2400,
    remainingMs: 900
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame() {},
    document: {
      querySelector() { return null; },
      getElementById() { return null; },
      hasFocus() { return false; }
    },
    window: {
      location: {
        pathname: '/'
      }
    },
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameNet: {
          view: {
            getMatchState() {
              return { started: true, gameMode: 'ffa' };
            },
            getAuthoritativeSelfState() {
              return { id: 'usr_test', alive: false };
            },
            getRespawnState() {
              return { active: true, respawnAt: 9999, remainingMs: 9999 };
            },
            getPrivateRoomPhase() {
              return 'in_match';
            }
          }
        },
        GamePlayerCombat: {
          getRespawnState() {
            return expectedRespawnState;
          }
        },
        GameRuntimeShell: {
          create(opts) {
            capturedReadMatchContext = opts.readMatchContext;
            return {
              launchModeById() { return { ok: true }; },
              getActivityState() { return 'menu'; }
            };
          }
        }
      }
    }
  };

  vm.runInContext(code, vm.createContext(sandbox));

  const coordinator = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator.create();
  coordinator.getActivityState();

  assert.equal(typeof capturedReadMatchContext, 'function');
  const matchContext = capturedReadMatchContext();
  assert.deepEqual(JSON.parse(JSON.stringify(matchContext.respawnState)), expectedRespawnState);
  assert.deepEqual(JSON.parse(JSON.stringify(matchContext.selfState)), { id: 'usr_test', alive: false });
});
