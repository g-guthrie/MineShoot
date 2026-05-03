import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function readModule(modulePath) {
  return fs.readFile(new URL(modulePath, import.meta.url), 'utf8');
}

async function readCoordinatorModules() {
  return Promise.all([
    readModule('../js/app/runtime-match-view.js'),
    readModule('../js/app/runtime-match-actions.js'),
    readModule('../js/app/runtime-match-host.js'),
    readModule('../js/app/runtime-coordinator-access.js'),
    readModule('../js/app/runtime-coordinator-ui.js'),
    readModule('../js/app/runtime-coordinator.js')
  ]);
}

test('runtime coordinator creates the runtime shell lazily and delegates launch/activity calls', async () => {
  const [matchViewCode, actionsCode, hostCode, accessCode, uiCode, code] = await readCoordinatorModules();
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

  const context = vm.createContext(sandbox);
  vm.runInContext(matchViewCode, context);
  vm.runInContext(actionsCode, context);
  vm.runInContext(hostCode, context);
  vm.runInContext(accessCode, context);
  vm.runInContext(uiCode, context);
  vm.runInContext(code, context);

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

test('runtime coordinator reads respawn countdown from self combat instead of net selectors', async () => {
  const [matchViewCode, actionsCode, hostCode, accessCode, uiCode, code] = await readCoordinatorModules();
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
              getActivityState() { return 'in_match'; },
              getActiveRuntimeMode() {
                return {
                  id: 'cloud_multiplayer',
                  authorityMode: 'networked'
                };
              }
            };
          }
        }
      }
    }
  };

  const context = vm.createContext(sandbox);
  vm.runInContext(matchViewCode, context);
  vm.runInContext(actionsCode, context);
  vm.runInContext(hostCode, context);
  vm.runInContext(accessCode, context);
  vm.runInContext(uiCode, context);
  vm.runInContext(code, context);

  const coordinator = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator.create();
  coordinator.getActivityState();

  assert.equal(typeof capturedReadMatchContext, 'function');
  const matchContext = capturedReadMatchContext();
  assert.deepEqual(JSON.parse(JSON.stringify(matchContext.respawnState)), expectedRespawnState);
  assert.equal(matchContext.selfState, null);
});

test('runtime coordinator reads local-match state when offline runtime is active', async () => {
  const [matchViewCode, actionsCode, hostCode, accessCode, uiCode, code] = await readCoordinatorModules();
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
            return { started: true, gameMode: 'ffa' };
          },
          getSelfState() {
            return { id: 'guest-self', alive: true, kills: 3 };
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

  const context = vm.createContext(sandbox);
  vm.runInContext(matchViewCode, context);
  vm.runInContext(actionsCode, context);
  vm.runInContext(hostCode, context);
  vm.runInContext(accessCode, context);
  vm.runInContext(uiCode, context);
  vm.runInContext(code, context);

  const coordinator = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator.create();
  coordinator.getActivityState();

  assert.equal(typeof capturedReadMatchContext, 'function');
  const matchContext = capturedReadMatchContext();
  assert.deepEqual(JSON.parse(JSON.stringify(matchContext.matchState)), { started: true, gameMode: 'ffa' });
  assert.deepEqual(JSON.parse(JSON.stringify(matchContext.selfState)), { id: 'guest-self', alive: true, kills: 3 });
});

test('runtime coordinator seeds network room ids through GameNet before multiplayer init flips on', async () => {
  const [matchViewCode, actionsCode, hostCode, accessCode, uiCode, code] = await readCoordinatorModules();
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

  const context = vm.createContext(sandbox);
  vm.runInContext(matchViewCode, context);
  vm.runInContext(actionsCode, context);
  vm.runInContext(hostCode, context);
  vm.runInContext(accessCode, context);
  vm.runInContext(uiCode, context);
  vm.runInContext(code, context);

  const coordinator = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator.create();
  coordinator.getActivityState();

  assert.equal(typeof capturedSetRoomId, 'function');
  capturedSetRoomId('ffa-01');

  assert.deepEqual(gameNetCalls, ['ffa-01']);
  assert.deepEqual(localMatchCalls, []);
});

test('runtime coordinator breaks sprint and fires after the weapon raise delay', async () => {
  const [matchViewCode, actionsCode, hostCode, accessCode, uiCode, code] = await readCoordinatorModules();
  let capturedStartOptions = null;
  let sprinting = true;
  let sprintRequested = true;
  let cancelSprintCalls = 0;
  let tempCancelCalls = 0;
  let fireCalls = 0;
  const timers = [];
  const playerActions = [];

  const sandbox = {
    console,
    setTimeout(callback, delayMs) {
      timers.push({ callback, delayMs: Number(delayMs || 0) });
      return timers.length;
    },
    clearTimeout() {},
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
          isSprintKeyHeld() {
            return sprintRequested;
          },
          cancelSprintTemporarily() {
            tempCancelCalls += 1;
            sprinting = false;
            sprintRequested = false;
            return true;
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

  const context = vm.createContext(sandbox);
  vm.runInContext(matchViewCode, context);
  vm.runInContext(actionsCode, context);
  vm.runInContext(hostCode, context);
  vm.runInContext(accessCode, context);
  vm.runInContext(uiCode, context);
  vm.runInContext(code, context);

  const coordinator = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator.create();
  await coordinator.launchModeById('single_full_sandbox', {});

  assert.equal(typeof capturedStartOptions.tryPlayerFire, 'function');

  capturedStartOptions.tryPlayerFire();

  assert.equal(tempCancelCalls, 1);
  assert.equal(cancelSprintCalls, 0);
  assert.equal(fireCalls, 0);
  assert.deepEqual(playerActions, []);
  assert.equal(timers.length, 1);
  assert.ok(timers[0].delayMs >= 90);

  timers.shift().callback();

  assert.equal(tempCancelCalls, 1);
  assert.equal(fireCalls, 1);
  assert.deepEqual(playerActions, ['fire']);
});

test('runtime coordinator does not fire while the player is rolling', async () => {
  const [matchViewCode, actionsCode, hostCode, accessCode, uiCode, code] = await readCoordinatorModules();
  let capturedStartOptions = null;
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
          isRolling() {
            return true;
          },
          isSprinting() {
            return false;
          },
          cancelSprintUntilRelease() {
            return false;
          },
          getNetworkInputState() {
            return {
              forward: true,
              backward: false,
              left: false,
              right: false,
              jump: false,
              sprint: false,
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

  const context = vm.createContext(sandbox);
  vm.runInContext(matchViewCode, context);
  vm.runInContext(actionsCode, context);
  vm.runInContext(hostCode, context);
  vm.runInContext(accessCode, context);
  vm.runInContext(uiCode, context);
  vm.runInContext(code, context);

  const coordinator = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator.create();
  await coordinator.launchModeById('single_full_sandbox', {});

  assert.equal(typeof capturedStartOptions.tryPlayerFire, 'function');

  capturedStartOptions.tryPlayerFire();

  assert.equal(fireCalls, 0);
  assert.deepEqual(playerActions, []);
});

test('runtime coordinator reveals the local overhead target when a local hit lands', async () => {
  const [matchViewCode, actionsCode, hostCode, accessCode, uiCode, code] = await readCoordinatorModules();
  let capturedStartOptions = null;
  const revealedTargets = [];

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
          updateMatchStatus() {},
          showHitMarker() {},
          showKillMarker() {},
          showDamageNumber() {}
        },
        GameOverhead: {
          revealTarget(targetId, durationMs) {
            revealedTargets.push({ targetId, durationMs });
          }
        },
        GameAudio: {
          play() {}
        },
        GamePlayer: {
          canUseWeapon() {
            return true;
          },
          isSprinting() {
            return false;
          },
          cancelSprintUntilRelease() {
            return false;
          },
          getNetworkInputState() {
            return {
              forward: false,
              backward: false,
              left: false,
              right: false,
              jump: false,
              sprint: false,
              adsActive: false
            };
          },
          triggerAction() {}
        },
        GameHitscan: {
          fire(_camera, onHit) {
            onHit(
              { userData: { ownerType: 'enemy', targetId: 'enemy:2' } },
              { clone() { return { x: 1, y: 2, z: 3 }; } },
              10,
              'body',
              20,
              { id: 'rifle' },
              null
            );
            return true;
          },
          getCurrentWeapon() {
            return { id: 'rifle' };
          }
        },
        GameEnemy: {
          damage() {
            return { enemy: { index: 2 }, killed: false };
          }
        },
        GameGameplayRuntimeBootstrap: {
          start(opts) {
            capturedStartOptions = opts;
            return Promise.resolve({
              renderer: { domElement: {} },
              scene: {},
              clock: { getDelta() { return 0.016; } },
              camera: {},
              controlsApi: { bind() {} },
              multiplayerMode: false
            });
          }
        },
        GameRuntimeSession: {
          create() {
            return {
              bindRuntimeControls() {},
              emitSessionState() {},
              isPlaying() { return false; },
              getActivityState() { return 'in_match'; }
            };
          }
        },
        GameGameplayRuntimeLoop: {
          create() {
            return {
              step() { return {}; }
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

  const context = vm.createContext(sandbox);
  vm.runInContext(matchViewCode, context);
  vm.runInContext(actionsCode, context);
  vm.runInContext(hostCode, context);
  vm.runInContext(accessCode, context);
  vm.runInContext(uiCode, context);
  vm.runInContext(code, context);

  const coordinator = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator.create();
  await coordinator.launchModeById('single_full_sandbox', {});

  capturedStartOptions.tryPlayerFire();

  assert.deepEqual(revealedTargets, []);
});
