import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadPlayerHarness(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../js/player.js', import.meta.url), 'utf8');
  const documentObj = runtimeOverrides.__document || {
    pointerLockElement: null,
    addEventListener() {},
    removeEventListener() {}
  };
  const windowObj = runtimeOverrides.__window || {
    addEventListener() {},
    removeEventListener() {}
  };
  const defaultWorld = {
    getBounds() {
      return { minX: 0, maxX: 50, minZ: 0, maxZ: 50, size: 50 };
    },
    getRandomSpawnPoint() {
      return { x: 5, z: 6 };
    },
    getGroundHeightAt() {
      return 0;
    },
    getSpawnPadding() {
      return 8;
    },
    getCollidables() {
      return [];
    }
  };
  const runtime = {
    GameShared: {
      gameplayTuning: {
        movement: {},
        weaponStats: {
          rifle: { adsFovDeg: 56 },
          sniper: { adsFovDeg: 24 }
        }
      },
      entityConstants: {},
      getWeaponStats(weaponId) {
        return this.gameplayTuning.weaponStats[weaponId] || null;
      },
      resolveWeaponAdsFovDeg(weaponStats) {
        return Number(weaponStats && weaponStats.adsFovDeg || 56);
      },
      getSelectableWeaponIds() {
        return ['rifle', 'sniper'];
      }
    },
    GamePlayerWorld: {
      create() {
        return {
          getWorldBounds: defaultWorld.getBounds,
          getDefaultSpawnPoint() { return { x: 25, z: 42 }; },
          getSpawnThreatPoints() { return []; },
          getRandomSpawnPoint: defaultWorld.getRandomSpawnPoint,
          getSpawnPadding: defaultWorld.getSpawnPadding,
          getGroundHeightAt: defaultWorld.getGroundHeightAt,
          getCollisionBoxes() { return []; },
          isBlockedAt() { return false; },
          findLandingSurfaceY(_x, _z, _currentFeetY, nextFeetY) { return Math.min(0, nextFeetY); },
          findCeilingY() { return null; }
        };
      }
    },
    GameWorld: defaultWorld,
    GameActorVisualFactory: {
      create() {
        return {
          root: new THREE.Group(),
          rigApi: null,
          rig: null,
          setAlive() {},
          setHitboxVisibility() {},
          syncHitboxes() {}
        };
      }
    },
    GameHitscan: {
      getAllWeaponIds() {
        return ['rifle', 'sniper'];
      }
    },
    ...runtimeOverrides
  };
  delete runtime.__document;
  delete runtime.__window;
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE,
    document: documentObj,
    window: windowObj,
    performance: {
      now() {
        return 0;
      }
    }
  };
  sandbox.globalThis = sandbox;
  if (!runtimeOverrides.GamePlayerView) {
    const viewCode = await fs.readFile(new URL('../js/player-view.js', import.meta.url), 'utf8');
    vm.runInContext(viewCode, vm.createContext(sandbox));
  }
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GamePlayer;
}

test('loadout sync repairs a stale equipped weapon id so sniper scope can recover', async () => {
  const player = await loadPlayerHarness();

  player.setWeaponModel('machinegun');
  player.setLoadout({ slots: ['sniper', 'rifle'] });
  const adsState = player.getAdsState();

  assert.equal(adsState.weaponId, 'sniper');
  assert.equal(adsState.sniper, true);
});

test('player init binds movement input listeners only once across repeated init calls', async () => {
  const listenerCounts = new Map();
  const windowCounts = new Map();
  const player = await loadPlayerHarness({
    __document: {
      pointerLockElement: null,
      addEventListener(type) {
        listenerCounts.set(type, (listenerCounts.get(type) || 0) + 1);
      },
      removeEventListener() {}
    },
    __window: {
      addEventListener(type) {
        windowCounts.set(type, (windowCounts.get(type) || 0) + 1);
      },
      removeEventListener() {}
    }
  });

  const scene = new THREE.Scene();
  player.init(scene);
  player.init(scene);

  assert.equal(listenerCounts.get('keydown'), 1);
  assert.equal(listenerCounts.get('keyup'), 1);
  assert.equal(listenerCounts.get('mousemove'), 1);
  assert.equal(listenerCounts.get('mousedown'), 1);
  assert.equal(listenerCounts.get('contextmenu'), 1);
  assert.equal(listenerCounts.get('pointerlockchange'), 1);
  assert.equal(windowCounts.get('resize'), 1);
  assert.equal(windowCounts.get('blur'), 1);
});

test('player init places the spawn at terrain height instead of eye height alone', async () => {
  const player = await loadPlayerHarness({
    GamePlayerWorld: {
      create() {
        return {
          getWorldBounds() { return { minX: 0, maxX: 50, minZ: 0, maxZ: 50, size: 50 }; },
          getDefaultSpawnPoint() { return { x: 25, z: 42 }; },
          getSpawnThreatPoints() { return []; },
          getRandomSpawnPoint() { return { x: 5, z: 6 }; },
          getSpawnPadding() { return 8; },
          getGroundHeightAt() { return 7; },
          getCollisionBoxes() { return []; },
          isBlockedAt() { return false; },
          findLandingSurfaceY(_x, _z, _currentFeetY, nextFeetY) { return Math.min(7, nextFeetY); },
          findCeilingY() { return null; }
        };
      }
    }
  });

  const scene = new THREE.Scene();
  player.init(scene);

  assert.equal(player.getPosition().y, 8.6);
});

test('authoritative motion can defer camera sync until the end of the frame', async () => {
  let updateCameraCalls = 0;
  const player = await loadPlayerHarness({
    GamePlayerView: {
      create() {
        return {
          updateCamera() {
            updateCameraCalls += 1;
          }
        };
      }
    }
  });

  const scene = new THREE.Scene();
  player.init(scene);
  const baselineCalls = updateCameraCalls;

  player.applyAuthoritativeMotion({
    x: 9,
    y: 1.6,
    z: 9,
    yaw: 0,
    pitch: 0
  }, { deferViewSync: true });

  assert.equal(updateCameraCalls, baselineCalls);

  player.flushDeferredViewSync(0.016);

  assert.equal(updateCameraCalls, baselineCalls + 1);
});

test('fire action is a no-op when the player view rig is not initialized', async () => {
  const player = await loadPlayerHarness();

  assert.doesNotThrow(() => {
    player.triggerAction('fire');
  });
});
