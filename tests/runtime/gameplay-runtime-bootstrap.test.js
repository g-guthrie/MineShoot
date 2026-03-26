import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadBootstrapHarness(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../../js/runtime/gameplay-runtime-bootstrap.js', import.meta.url), 'utf8');
  const calls = {
    enemyInit: [],
    localMatchInit: [],
    netInit: 0,
    netShutdown: 0,
    throwableInfo: [],
    throwablesInit: 0,
    docsInit: 0,
    removeResizeHandler: 0,
    worldDispose: 0,
    playerDestroy: 0,
    enemyDispose: 0,
    throwablesShutdown: 0,
    hookVisualsDispose: 0,
    overheadReset: 0,
    uiReset: 0,
    hitscanReset: 0,
    audioStopAll: 0
  };
  const runtime = {
    GameBootstrap: {
      createRenderContext() {
        return {
          renderer: {},
          scene: { label: 'scene' },
          clock: { label: 'clock' }
        };
      },
      installResizeHandler() {
        return function removeResizeHandler() {
          calls.removeResizeHandler += 1;
        };
      }
    },
    GameWorld: {
      create() {},
      dispose() {
        calls.worldDispose += 1;
      },
      getRecommendedEnemyCount() { return 6; }
    },
    GameUI: {
      init() {},
      resetGameplayHud() {
        calls.uiReset += 1;
      },
      updateThrowableInfo(state) {
        calls.throwableInfo.push(state);
      },
      updateAbilityInfo() {}
    },
    GameDocs: {
      init() {
        calls.docsInit += 1;
      }
    },
    GameOverhead: {
      init() {},
      reset() {
        calls.overheadReset += 1;
      }
    },
    GamePlayer: {
      init() {
        return { label: 'camera' };
      },
      destroy() {
        calls.playerDestroy += 1;
      }
    },
    GameThrowables: {
      init() {
        calls.throwablesInit += 1;
      },
      shutdown() {
        calls.throwablesShutdown += 1;
      },
      getState() {
        return { throwable: 'frag' };
      }
    },
    GameNet: {
      init() {
        calls.netInit += 1;
      },
      shutdown() {
        calls.netShutdown += 1;
      }
    },
    GameAbilities: {
      init() {},
      clearTransientState() {},
      getHudState() { return {}; }
    },
    GameHookVisuals: {
      init() {},
      dispose() {
        calls.hookVisualsDispose += 1;
      }
    },
    GameGameplayHudSync: {
      syncSelfCombatHud() {}
    },
    GamePlayerCombat: {
      init() {},
      applyArmorProfile() {},
      getArmorMax() { return 90; }
    },
    GameHitscan: {
      setWeapon(id) { return { id, name: String(id || '').toUpperCase() }; },
      getCurrentWeapon() { return { id: 'rifle', name: 'RIFLE' }; },
      reset() {
        calls.hitscanReset += 1;
      }
    },
    GameGameplayControls: {
      create() {
        return {
          bind() {}
        };
      }
    },
    GameLocalMatch: {
      init(options) {
        calls.localMatchInit.push(options);
      },
      shutdown() {
        calls.localMatchInit.push({ shutdown: true });
      }
    },
    GameEnemy: {
      init(scene, count) {
        calls.enemyInit.push({ scene, count });
      },
      dispose() {
        calls.enemyDispose += 1;
      }
    },
    GameAudio: {
      stopAll() {
        calls.audioStopAll += 1;
      }
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    THREE: {},
    window: {
      innerWidth: 1280,
      innerHeight: 720,
      devicePixelRatio: 1,
      addEventListener() {}
    },
    document: {
      body: {
        appendChild() {}
      }
    },
    performance: {
      now() { return 0; }
    },
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return {
    bootstrap: sandbox.__MAYHEM_RUNTIME.GameGameplayRuntimeBootstrap,
    calls
  };
}

test('gameplay runtime bootstrap starts offline sandbox without bots', async () => {
  const harness = await loadBootstrapHarness();

  const result = await harness.bootstrap.start({
    activeRuntimeMode: {
      id: 'single_full_sandbox',
      authorityMode: 'offline',
      gameMode: 'ffa'
    },
    applyAbilityProfile() {},
    applyDebugVisuals() {},
    applyWeapon() {},
    canUseLocalAction() { return true; },
    handleEnemyHit() {},
    hasInputCapture() { return false; },
    isPlaying() { return false; },
    setTransientDebug() {},
    startupDebugNotice: '',
    syncCommittedLoadoutToRuntime() { return []; },
    toggleDebugVisuals() { return false; },
    tryPlayerFire() {}
  });

  assert.equal(result.multiplayerMode, false);
  assert.equal(typeof result.disposeRuntime, 'function');
  assert.deepEqual(
    JSON.parse(JSON.stringify(harness.calls.localMatchInit)),
    [{ gameMode: 'ffa' }]
  );
  assert.equal(harness.calls.enemyInit.length, 0);
  assert.deepEqual(harness.calls.throwableInfo, []);
  assert.equal(harness.calls.netInit, 0);
  assert.equal(harness.calls.docsInit, 1);
  assert.equal(harness.calls.throwablesInit, 1);

  result.disposeRuntime();
  assert.equal(harness.calls.removeResizeHandler, 1);
  assert.equal(harness.calls.worldDispose, 1);
  assert.equal(harness.calls.playerDestroy, 1);
  assert.equal(harness.calls.enemyDispose, 0);
  assert.equal(harness.calls.throwablesShutdown, 1);
  assert.equal(harness.calls.hookVisualsDispose, 0);
  assert.equal(harness.calls.overheadReset, 1);
  assert.equal(harness.calls.uiReset, 1);
  assert.equal(harness.calls.hitscanReset, 1);
  assert.equal(harness.calls.audioStopAll, 1);
});

test('gameplay runtime bootstrap does not double-init multiplayer networking when net runtime lacks isActive', async () => {
  const harness = await loadBootstrapHarness({
    GameNet: {
      init() {
        harnessCalls.netInit += 1;
      },
      shutdown() {
        harnessCalls.netShutdown += 1;
      },
      view: {
        getWorldMeta() {
          return {
            worldSeed: 'seed-room-01'
          };
        }
      }
    }
  });

  const harnessCalls = harness.calls;
  const result = await harness.bootstrap.start({
    activeRuntimeMode: {
      id: 'cloud_multiplayer',
      authorityMode: 'networked'
    },
    applyAbilityProfile() {},
    applyDebugVisuals() {},
    applyWeapon() {},
    canUseLocalAction() { return true; },
    handleEnemyHit() {},
    hasInputCapture() { return false; },
    isPlaying() { return false; },
    setTransientDebug() {},
    startupDebugNotice: '',
    syncCommittedLoadoutToRuntime() { return []; },
    toggleDebugVisuals() { return false; },
    tryPlayerFire() {}
  });

  assert.equal(result.multiplayerMode, true);
  assert.equal(harness.calls.netInit, 1);
  result.disposeRuntime();
  assert.equal(harness.calls.netShutdown, 1);
  assert.equal(harness.calls.removeResizeHandler, 1);
});

test('gameplay runtime bootstrap prefers the loaded docs runtime over the legacy global docs reference', async () => {
  const harness = await loadBootstrapHarness({
    GameDocs: {
      init() {
        throw new Error('legacy docs global should not initialize when loader runtime is available');
      }
    },
    GameRuntimeLoader: {
      getLoadedDocsRuntime() {
        return {
          init() {
            harness.calls.docsInit += 1;
          }
        };
      }
    }
  });

  const result = await harness.bootstrap.start({
    activeRuntimeMode: {
      id: 'single_full_sandbox',
      authorityMode: 'offline',
      gameMode: 'ffa'
    },
    applyAbilityProfile() {},
    applyDebugVisuals() {},
    applyWeapon() {},
    canUseLocalAction() { return true; },
    handleEnemyHit() {},
    hasInputCapture() { return false; },
    isPlaying() { return false; },
    setTransientDebug() {},
    startupDebugNotice: '',
    syncCommittedLoadoutToRuntime() { return []; },
    toggleDebugVisuals() { return false; },
    tryPlayerFire() {}
  });

  assert.equal(result.multiplayerMode, false);
  assert.equal(harness.calls.docsInit, 1);
});
