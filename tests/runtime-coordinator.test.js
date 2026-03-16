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

test('runtime main registers a GameMain api', async () => {
  const code = await readModule('../js/runtime/main.js');
  const sandbox = {
    console,
    document: {
      getElementById() { return null; },
      querySelector() { return null; }
    },
    window: {
      location: {
        pathname: '/'
      }
    },
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  sandbox.globalThis.window = sandbox.window;
  sandbox.globalThis.document = sandbox.document;

  vm.runInContext(code, vm.createContext(sandbox));

  assert.equal(typeof sandbox.globalThis.__MAYHEM_RUNTIME.GameMain, 'object');
  assert.equal(typeof sandbox.globalThis.__MAYHEM_RUNTIME.GameMain.launchModeById, 'function');
  assert.equal(typeof sandbox.globalThis.__MAYHEM_RUNTIME.GameMain.getActivityState, 'function');
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

test('runtime coordinator reads local-match state when offline runtime is active', async () => {
  const code = await readModule('../js/app/runtime-coordinator.js');
  let capturedReadMatchContext = null;

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
        GameLocalMatch: {
          getMatchState() {
            return { started: true, gameMode: 'lms' };
          },
          getSelfState() {
            return { id: 'guest-self', alive: true, lmsLives: 3 };
          }
        },
        GamePlayerCombat: {
          getRespawnState() {
            return null;
          }
        },
        GameRuntimeShell: {
          create(opts) {
            capturedReadMatchContext = opts.readMatchContext;
            return {
              launchModeById() { return { ok: true }; },
              getActivityState() { return 'in_match'; }
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
  assert.deepEqual(JSON.parse(JSON.stringify(matchContext.matchState)), { started: true, gameMode: 'lms' });
  assert.deepEqual(JSON.parse(JSON.stringify(matchContext.selfState)), { id: 'guest-self', alive: true, lmsLives: 3 });
});

test('runtime coordinator seeds network room ids through GameNet before multiplayer init flips on', async () => {
  const code = await readModule('../js/app/runtime-coordinator.js');
  let capturedSetRoomId = null;
  const gameNetCalls = [];
  const localMatchCalls = [];

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
          setRoomId(roomId) {
            gameNetCalls.push(String(roomId || ''));
          }
        },
        GameLocalMatch: {
          setRoomId(roomId) {
            localMatchCalls.push(String(roomId || ''));
          }
        },
        GameRuntimeShell: {
          create(opts) {
            capturedSetRoomId = opts.setRoomId;
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

  assert.equal(typeof capturedSetRoomId, 'function');
  capturedSetRoomId('ffa-01');

  assert.deepEqual(gameNetCalls, ['ffa-01']);
  assert.deepEqual(localMatchCalls, []);
});

test('runtime coordinator breaks sprint and still fires on the same click', async () => {
  const code = await readModule('../js/app/runtime-coordinator.js');
  let capturedStartOptions = null;
  let sprinting = true;
  let sprintRequested = true;
  let cancelSprintCalls = 0;
  let fireCalls = 0;
  const playerActions = [];

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame() {},
    document: {
      pointerLockElement: null,
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
        GameUI: {
          setDebugInfo() {},
          setIdleWarning() {},
          setDebugVisuals() {},
          updateMatchStatus() {}
        },
        GamePlayer: {
          canUseWeapon() {
            return true;
          },
          isSprinting() {
            return sprinting;
          },
          cancelSprintUntilRelease() {
            cancelSprintCalls += 1;
            sprinting = false;
            sprintRequested = false;
            return true;
          },
          getNetworkInputState() {
            return {
              forward: true,
              backward: false,
              left: false,
              right: false,
              jump: false,
              sprint: sprintRequested,
              adsActive: false
            };
          },
          triggerAction(kind) {
            playerActions.push(String(kind || ''));
          }
        },
        GameHitscan: {
          fire() {
            fireCalls += 1;
            return true;
          },
          getCurrentWeapon() {
            return { id: 'rifle' };
          }
        },
        GameAbilities: {
          isDeadeyeActive() {
            return false;
          }
        },
        GameGameplayRuntimeBootstrap: {
          start(opts) {
            capturedStartOptions = opts;
            return Promise.resolve({
              renderer: { domElement: {} },
              scene: {},
              clock: {
                getDelta() {
                  return 0.016;
                }
              },
              camera: {},
              controlsApi: {
                bind() {}
              },
              multiplayerMode: false
            });
          }
        },
        GameRuntimeSession: {
          create() {
            return {
              bindRuntimeControls() {},
              emitSessionState() {},
              isPlaying() {
                return false;
              },
              getActivityState() {
                return 'in_match';
              }
            };
          }
        },
        GameGameplayRuntimeLoop: {
          create() {
            return {
              step() {
                return {};
              }
            };
          }
        },
        GamePresentationRuntimeLoop: {
          create() {
            return {
              renderFrame() {}
            };
          }
        },
        GameLoop: {
          requestFrame() {}
        },
        GameRuntimeShell: {
          create(opts) {
            return {
              launchModeById() {
                return opts.startRuntime();
              },
              getActivityState() {
                return 'menu';
              },
              getActiveRuntimeMode() {
                return {
                  id: 'single_full_sandbox',
                  authorityMode: 'offline'
                };
              },
              getStartupDebugNotice() {
                return '';
              }
            };
          }
        }
      }
    }
  };

  vm.runInContext(code, vm.createContext(sandbox));

  const coordinator = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator.create();
  await coordinator.launchModeById('single_full_sandbox', {});

  assert.equal(typeof capturedStartOptions.tryPlayerFire, 'function');

  capturedStartOptions.tryPlayerFire();

  assert.equal(cancelSprintCalls, 1);
  assert.equal(fireCalls, 1);
  assert.deepEqual(playerActions, ['fire']);
});
