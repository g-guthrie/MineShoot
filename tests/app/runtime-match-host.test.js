import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadHostHarness({ bootstrapStart, clockDeltas } = {}) {
  const code = await fs.readFile(new URL('../../js/app/runtime-match-host.js', import.meta.url), 'utf8');
  const calls = {
    frameRequests: [],
    frameCancels: [],
    bootstrapStarts: 0,
    bootstrapDisposals: [],
    controlsUnbind: [],
    sessionEmits: 0,
    stepDts: [],
    renderFrames: []
  };
  let nextFrameHandle = 1;
  const pendingClockDeltas = Array.isArray(clockDeltas) ? clockDeltas.slice() : [];

  function nextClockDelta() {
    return pendingClockDeltas.length ? pendingClockDeltas.shift() : 0.016;
  }

  const sandbox = {
    requestAnimationFrame() {
      return nextFrameHandle++;
    },
    cancelAnimationFrame() {},
    document: {
      pointerLockElement: null,
      exitPointerLock() {
        this.pointerLockElement = null;
      }
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

  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);

  const hostFactory = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeMatchHost;
  const host = hostFactory.create({
    getBootstrapApi() {
      return {
        start(opts) {
          calls.bootstrapStarts += 1;
          return bootstrapStart
            ? bootstrapStart(opts, calls)
            : Promise.resolve({
                renderer: {
                  domElement: {
                    parentNode: {
                      removeChild() {}
                    }
                  },
                  dispose() {}
                },
                scene: {},
                clock: {
                  getDelta() {
                    return nextClockDelta();
                  }
                },
                camera: {},
                controlsApi: {
                  bind() {},
                  unbind() {
                    calls.controlsUnbind.push(calls.bootstrapStarts);
                  }
                },
                multiplayerMode: false,
                disposeRuntime() {
                  calls.bootstrapDisposals.push(calls.bootstrapStarts);
                }
              });
        }
      };
    },
    getRuntimeSessionFactory() {
      return {
        create() {
          return {
            bindRuntimeControls() {},
            emitSessionState() {
              calls.sessionEmits += 1;
            },
            isPlaying() {
              return false;
            }
          };
        }
      };
    },
    getGameplayRuntimeLoopFactory() {
      return {
        create() {
          return {
            step(dt) {
              calls.stepDts.push(dt);
              return { dt, stepIndex: calls.stepDts.length };
            }
          };
        }
      };
    },
    getPresentationRuntimeLoopFactory() {
      return {
        create() {
          return {
            renderFrame(frame) {
              calls.renderFrames.push(frame);
            }
          };
        }
      };
    },
    getLoopApi() {
      return {
        requestFrame(cb) {
          const handle = nextFrameHandle++;
          calls.frameRequests.push({ handle, cb });
          return handle;
        },
        cancelFrame(handle) {
          calls.frameCancels.push(handle);
        }
      };
    },
    getRuntimeProfileApi() {
      return {
        clearSelectedMode() {}
      };
    },
    getMatchViewApi() {
      return {
        readMatchContext() {
          return {
            privateRoomPhase: '',
            matchState: null
          };
        },
        updateMenuSessionPanel() {},
        winnerLabel() {
          return 'PLAYER';
        },
        didSelfWin() {
          return false;
        },
        modeDisplayName() {
          return 'Free For All';
        },
        objectiveSummary() {
          return 'Goal 0';
        },
        resultsSummary() {
          return 'Summary unavailable.';
        },
        formatSecondsRemaining() {
          return '0.0s';
        }
      };
    },
    getActionsApi() {
      return {
        validateLoadoutSelections() {
          return { ok: true };
        },
        applyAbilityProfile() {},
        applyDebugVisuals() {},
        applyWeapon() {},
        canUseLocalAction() {
          return true;
        },
        handleEnemyHit() {},
        syncCommittedLoadoutToRuntime() {
          return [];
        },
        toggleDebugVisuals() {
          return false;
        },
        tryPlayerFire() {},
        syncReticleWithWeapon() {},
        isDebugVisualsOn() {
          return false;
        }
      };
    },
    getRuntimeShell() {
      return {
        getActivityState() {
          return 'menu';
        }
      };
    },
    buildBootstrapRuntimeDeps() {
      return {};
    },
    isPrivateRoomSession() {
      return false;
    }
  });

  return { host, calls };
}

test('runtime match host cancels the frame loop and tears down the active runtime', async () => {
  const harness = await loadHostHarness();

  await harness.host.startRuntime({});

  assert.equal(harness.calls.frameRequests.length, 1);
  assert.deepEqual(harness.calls.stepDts, [0.016]);
  assert.equal(harness.calls.renderFrames.length, 1);
  assert.equal(harness.host.isRuntimeReady(), true);

  harness.host.teardownRuntime('test_exit');

  assert.equal(harness.host.isRuntimeReady(), false);
  assert.deepEqual(harness.calls.frameCancels, [harness.calls.frameRequests[0].handle]);
  assert.deepEqual(harness.calls.bootstrapDisposals, [1]);
  assert.deepEqual(harness.calls.controlsUnbind, [1]);
});

test('runtime match host slices browser frame spikes before gameplay and renders once', async () => {
  const harness = await loadHostHarness({ clockDeltas: [0.1] });

  await harness.host.startRuntime({});

  assert.equal(harness.calls.frameRequests.length, 1);
  assert.equal(harness.calls.stepDts.length, 4);
  assert.equal(harness.calls.renderFrames.length, 1);
  assert.equal(
    Math.round(harness.calls.stepDts.reduce((total, dt) => total + dt, 0) * 1000),
    Math.round((4 / 60) * 1000)
  );
  for (const dt of harness.calls.stepDts) {
    assert.ok(dt <= (1 / 60) + 0.000001);
  }
  assert.equal(Math.round(harness.calls.renderFrames[0].dt * 1000), Math.round((4 / 60) * 1000));
});

test('runtime match host does not double-step normal 60hz frame jitter', async () => {
  const harness = await loadHostHarness({ clockDeltas: [0.018] });

  await harness.host.startRuntime({});

  assert.deepEqual(harness.calls.stepDts, [0.018]);
  assert.equal(harness.calls.renderFrames.length, 1);
});

test('runtime match host tears down the previous runtime before starting a new one', async () => {
  const harness = await loadHostHarness();

  await harness.host.startRuntime({});
  await harness.host.startRuntime({});

  assert.equal(harness.calls.bootstrapStarts, 2);
  assert.deepEqual(harness.calls.bootstrapDisposals, [1]);
  assert.deepEqual(harness.calls.controlsUnbind, [1]);
  assert.equal(harness.host.isRuntimeReady(), true);
});

test('runtime match host disposes stale bootstrap results that resolve after teardown', async () => {
  const pending = [];
  const harness = await loadHostHarness({
    bootstrapStart(_opts, calls) {
      return new Promise((resolve) => {
        pending.push(function resolveStart() {
          const startIndex = calls.bootstrapStarts;
          resolve({
            renderer: {
              domElement: {
                parentNode: {
                  removeChild() {}
                }
              },
              dispose() {}
            },
            scene: {},
            clock: {
              getDelta() {
                return 0.016;
              }
            },
            camera: {},
            controlsApi: {
              bind() {},
              unbind() {
                calls.controlsUnbind.push(startIndex);
              }
            },
            multiplayerMode: false,
            disposeRuntime() {
              calls.bootstrapDisposals.push(startIndex);
            }
          });
        });
      });
    }
  });

  const startPromise = harness.host.startRuntime({});
  harness.host.teardownRuntime('cancel_before_ready');
  pending[0]();
  await startPromise;

  assert.equal(harness.host.isRuntimeReady(), false);
  assert.deepEqual(harness.calls.bootstrapDisposals, [1]);
  assert.deepEqual(harness.calls.controlsUnbind, [1]);
});
