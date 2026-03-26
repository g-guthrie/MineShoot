import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadPlayerHarness(runtimeOverrides = {}, options = {}) {
  const [inputBindingsCode, inputLabelsCode, statusCode, viewCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/core/input-bindings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/core/input-labels.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-status.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player-view.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/actors/player.js', import.meta.url), 'utf8')
  ]);
  const documentObj = runtimeOverrides.__document || {
    pointerLockElement: null,
    addEventListener() {},
    removeEventListener() {}
  };
  const windowObj = runtimeOverrides.__window || {
    addEventListener() {},
    removeEventListener() {},
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    }
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
        const movementCollider = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.5, 0.5, 2.8, 8)),
          new THREE.LineBasicMaterial({ color: 0x33ff66, transparent: true, opacity: 0.3 })
        );
        movementCollider.userData = { type: 'movement_collider' };
        return {
          root: new THREE.Group(),
          movementCollider,
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
  const context = vm.createContext(sandbox);
  vm.runInContext(inputBindingsCode, context);
  vm.runInContext(inputLabelsCode, context);
  vm.runInContext(statusCode, context);
  vm.runInContext(viewCode, context);
  vm.runInContext(code, context);
  if (options.returnRuntime) {
    return {
      player: sandbox.__MAYHEM_RUNTIME.GamePlayer,
      runtime: sandbox.__MAYHEM_RUNTIME
    };
  }
  return sandbox.__MAYHEM_RUNTIME.GamePlayer;
}

test('loadout sync repairs a stale equipped weapon id so sniper scope can recover', async () => {
  const player = await loadPlayerHarness();

  player.setWeaponModel('machinegun');
  player.setLoadout({ slots: ['sniper', 'rifle'] });
  const adsState = player.getAdsState();

  assert.equal(adsState.weaponId, 'rifle');
  assert.equal(adsState.sniper, false);
});

test('player init replaces prior input bindings cleanly across repeated init calls', async () => {
  const listenerAdds = new Map();
  const listenerRemoves = new Map();
  const listenerActive = new Map();
  const windowAdds = new Map();
  const windowRemoves = new Map();
  const windowActive = new Map();
  const player = await loadPlayerHarness({
    __document: {
      pointerLockElement: null,
      addEventListener(type) {
        listenerAdds.set(type, (listenerAdds.get(type) || 0) + 1);
        listenerActive.set(type, (listenerActive.get(type) || 0) + 1);
      },
      removeEventListener(type) {
        listenerRemoves.set(type, (listenerRemoves.get(type) || 0) + 1);
        listenerActive.set(type, Math.max(0, (listenerActive.get(type) || 0) - 1));
      }
    },
    __window: {
      addEventListener(type) {
        windowAdds.set(type, (windowAdds.get(type) || 0) + 1);
        windowActive.set(type, (windowActive.get(type) || 0) + 1);
      },
      removeEventListener(type) {
        windowRemoves.set(type, (windowRemoves.get(type) || 0) + 1);
        windowActive.set(type, Math.max(0, (windowActive.get(type) || 0) - 1));
      }
    }
  });

  const scene = new THREE.Scene();
  player.init(scene);
  player.init(scene);
  player.destroy();

  assert.equal(listenerAdds.get('keydown'), 2);
  assert.equal(listenerAdds.get('keyup'), 2);
  assert.equal(listenerAdds.get('mousemove'), 2);
  assert.equal(listenerAdds.get('contextmenu'), 2);
  assert.equal(listenerAdds.get('pointerlockchange'), 2);
  assert.equal(listenerRemoves.get('keydown'), 2);
  assert.equal(listenerRemoves.get('keyup'), 2);
  assert.equal(listenerRemoves.get('mousemove'), 2);
  assert.equal(listenerRemoves.get('contextmenu'), 2);
  assert.equal(listenerRemoves.get('pointerlockchange'), 2);
  assert.equal(listenerActive.get('keydown'), 0);
  assert.equal(listenerActive.get('keyup'), 0);
  assert.equal(listenerActive.get('mousemove'), 0);
  assert.equal(listenerActive.get('contextmenu'), 0);
  assert.equal(listenerActive.get('pointerlockchange'), 0);
  assert.equal(windowAdds.get('resize'), 2);
  assert.equal(windowAdds.get('blur'), 2);
  assert.equal(windowRemoves.get('resize'), 2);
  assert.equal(windowRemoves.get('blur'), 2);
  assert.equal(windowActive.get('resize'), 0);
  assert.equal(windowActive.get('blur'), 0);
});

test('fire action is a no-op when the player view rig is not initialized', async () => {
  const player = await loadPlayerHarness();

  assert.doesNotThrow(() => {
    player.triggerAction('fire');
  });
});

test('player getters fill provided vectors and equipSlot changes the equipped weapon', async () => {
  const player = await loadPlayerHarness();
  const scene = new THREE.Scene();
  player.init(scene);
  player.setLoadout({ slots: ['sniper', 'rifle'] });

  const posOut = new THREE.Vector3();
  const eyeOut = new THREE.Vector3();
  const coreOut = new THREE.Vector3();
  const throwOut = new THREE.Vector3();
  const muzzleOut = new THREE.Vector3();
  const camera = player.getCamera();

  assert.equal(player.equipSlot(0), 'rifle');
  assert.equal(player.getEquippedWeaponId(), 'rifle');
  assert.equal(player.getPosition(posOut), posOut);
  assert.deepEqual({ x: posOut.x, y: posOut.y, z: posOut.z }, { x: 5, y: 1.6, z: 6 });
  assert.notEqual(player.getPosition(), posOut);

  assert.equal(player.getEyeWorldPosition(eyeOut), eyeOut);
  assert.equal(player.getCoreWorldPosition(coreOut), coreOut);
  assert.equal(player.getThrowableOriginWorldPosition(throwOut), throwOut);
  assert.equal(player.getMuzzleWorldPosition(muzzleOut), muzzleOut);
  assert.deepEqual(
    { x: eyeOut.x, y: eyeOut.y, z: eyeOut.z },
    { x: camera.position.x, y: camera.position.y, z: camera.position.z }
  );
  assert.ok(coreOut.y < eyeOut.y);
  assert.ok(throwOut.y < eyeOut.y);
});

test('player init adds the movement collider debug mesh to the scene with the avatar helpers', async () => {
  const player = await loadPlayerHarness();
  const scene = new THREE.Scene();

  player.init(scene);

  const movementCollider = scene.children.find((node) => node && node.userData && node.userData.type === 'movement_collider');
  assert.ok(movementCollider);
});

test('player resolves shared tuning lazily when GameShared arrives after script load', async () => {
  const harness = await loadPlayerHarness({
    GameShared: null
  }, { returnRuntime: true });
  const { player, runtime } = harness;
  runtime.GameShared = {
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
  };

  const scene = new THREE.Scene();

  assert.doesNotThrow(() => {
    player.init(scene);
  });
  assert.deepEqual(JSON.parse(JSON.stringify(player.getLoadout())), { slots: ['rifle', 'sniper'] });
});

test('player requests Boxman only for the local avatar visual path', async () => {
  const createCalls = [];
  const player = await loadPlayerHarness({
    GameActorVisualFactory: {
      create(opts) {
        createCalls.push(opts);
        return {
          root: new THREE.Group(),
          rigApi: null,
          rig: null,
          setAlive() {},
          setHitboxVisibility() {},
          syncHitboxes() {}
        };
      }
    }
  });

  player.init(new THREE.Scene());

  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0].ownerType, 'player');
  assert.equal(createCalls[0].preferBoxman, true);
});
