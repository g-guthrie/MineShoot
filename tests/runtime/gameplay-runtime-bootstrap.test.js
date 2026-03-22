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
    throwableInfo: [],
    docsInit: 0
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
      installResizeHandler() {}
    },
    GameWorld: {
      create() {},
      getRecommendedEnemyCount() { return 6; }
    },
    GameUI: {
      init() {},
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
      init() {}
    },
    GamePlayer: {
      init() {
        return { label: 'camera' };
      }
    },
    GameThrowables: {
      init() {},
      getState() {
        return { throwable: 'frag' };
      }
    },
    GameNet: {
      init() {
        calls.netInit += 1;
      }
    },
    GameAbilities: {
      init() {},
      getHudState() { return {}; }
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
      getCurrentWeapon() { return { id: 'rifle', name: 'RIFLE' }; }
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
      }
    },
    GameEnemy: {
      init(scene, count) {
        calls.enemyInit.push({ scene, count });
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

test('gameplay runtime bootstrap restores offline sandbox bots and local match startup', async () => {
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
  assert.deepEqual(
    JSON.parse(JSON.stringify(harness.calls.localMatchInit)),
    [{ gameMode: 'ffa' }]
  );
  assert.equal(harness.calls.enemyInit.length, 1);
  assert.equal(harness.calls.enemyInit[0].count, 6);
  assert.deepEqual(harness.calls.throwableInfo, [{ throwable: 'frag' }]);
  assert.equal(harness.calls.netInit, 0);
  assert.equal(harness.calls.docsInit, 1);
});

test('gameplay runtime bootstrap does not double-init multiplayer networking when net runtime lacks isActive', async () => {
  const harness = await loadBootstrapHarness({
    GameNet: {
      init() {
        harnessCalls.netInit += 1;
      },
      getWorldMeta() {
        return {
          worldSeed: 'seed-room-01'
        };
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
