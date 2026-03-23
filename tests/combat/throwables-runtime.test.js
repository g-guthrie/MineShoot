import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

import { gameplayTuning, getDefaultThrowableId, normalizeThrowableId } from '../../shared/gameplay-tuning.js';

async function loadThrowablesHarness(tuning = gameplayTuning, runtimeOverrides = {}, options = {}) {
  const [projectileRuntimeCode, trajectoryCode, fireZonesCode, authoritativeSyncCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/combat/throwables-projectile-runtime.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/combat/throwables-trajectory.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/combat/throwables-fire-zones.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/combat/throwables-authoritative-sync.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/combat/throwables.js', import.meta.url), 'utf8')
  ]);
  const scene = new THREE.Scene();
  const timeState = { now: 1000 };
  const shared = {
    gameplayTuning: tuning,
    getDefaultThrowableId,
    normalizeThrowableId,
    ...((runtimeOverrides && runtimeOverrides.GameShared) || {})
  };
  const runtime = {
    GameShared: shared,
    GameWorld: {
      getCollidables() { return []; },
      getGroundHeightAt() { return -50; }
    },
    GameEnemy: {
      getEnemies() { return []; },
      getHitboxArray() { return []; }
    },
    ...runtimeOverrides
  };
  runtime.GameShared = shared;
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE,
    Date: {
      now() {
        return timeState.now;
      }
    }
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(projectileRuntimeCode, context);
  vm.runInContext(trajectoryCode, context);
  vm.runInContext(fireZonesCode, context);
  vm.runInContext(authoritativeSyncCode, context);
  vm.runInContext(code, context);
  const GameThrowables = sandbox.__MAYHEM_RUNTIME.GameThrowables;
  if (!options.skipInit) {
    GameThrowables.init(scene);
  }
  return {
    GameThrowables,
    scene,
    timeState,
    runtime: sandbox.__MAYHEM_RUNTIME,
    init() {
      GameThrowables.init(scene);
    }
  };
}

function countProjectileMeshes(scene, projectileType) {
  return scene.children.filter((node) => node && node.userData && node.userData.projectileType === projectileType).length;
}

test('throwables runtime clears predicted knives once the authoritative impact event arrives', async () => {
  const harness = await loadThrowablesHarness();
  const { GameThrowables, scene } = harness;

  const predicted = GameThrowables.throwPredicted('knife', {}, 'cthrow_knife', {
    origin: { x: 0, y: 1, z: 0 },
    direction: { x: 0, y: 0, z: -1 }
  });
  assert.equal(predicted, true);
  assert.equal(countProjectileMeshes(scene, 'knife'), 1);

  GameThrowables.confirmPredictedThrow('cthrow_knife', {
    projectileId: 'proj_knife'
  });
  GameThrowables.applyNetworkEvent({
    t: 'throw_impact',
    projectileId: 'proj_knife',
    projectileType: 'knife',
    impactType: 'world',
    x: 0,
    y: 1,
    z: -1
  });
  GameThrowables.update(0, function () {});

  assert.equal(countProjectileMeshes(scene, 'knife'), 0);
  assert.equal(GameThrowables.getDebugTelemetry().predictedCount, 0);
});

test('throwables runtime spends and restores predicted charges around rejected throws', async () => {
  const harness = await loadThrowablesHarness();
  const { GameThrowables } = harness;

  assert.equal(GameThrowables.getState().knife.charges, 1);
  assert.equal(GameThrowables.throwPredicted('knife', {}, 'cthrow_knife_reject', {
    origin: { x: 0, y: 1, z: 0 },
    direction: { x: 0, y: 0, z: -1 }
  }), true);
  assert.equal(GameThrowables.getState().knife.charges, 0);

  GameThrowables.rejectPredictedThrow('cthrow_knife_reject');

  assert.equal(GameThrowables.getState().knife.charges, 1);
});

test('throwables runtime falls back to id labels when shared defs are missing', async () => {
  const harness = await loadThrowablesHarness({});
  const state = harness.GameThrowables.getState();

  assert.deepEqual(Object.keys(state), ['frag', 'plasma', 'molotov', 'knife']);
  assert.equal(state.frag.label, 'FRAG');
  assert.equal(state.knife.label, 'KNIFE');
  assert.equal(state.plasma.charges, 1);
});

test('throwables runtime refreshes shared tuning that arrives after module evaluation', async () => {
  const harness = await loadThrowablesHarness({}, {
    GameShared: {},
    GameCombatTuning: {}
  }, {
    skipInit: true
  });

  harness.runtime.GameShared = {
    gameplayTuning,
    getDefaultThrowableId,
    normalizeThrowableId
  };
  harness.runtime.GameCombatTuning = {
    getThrowableDistanceTuning() {
      const throwables = gameplayTuning.throwables;
      return {
        fragRadius: throwables.frag.radius,
        plasmaRadius: throwables.plasma.radius,
        plasmaCatchRadius: throwables.plasma.catchRadius,
        missileRadius: throwables.missile.radius,
        molotovFireRadius: throwables.molotov.fireRadius,
        plasmaAcquireRange: throwables.plasma.acquireRange,
        plasmaAcquireHalfAngleDeg: throwables.plasma.acquireHalfAngleDeg,
        plasmaStickExplodeDelay: throwables.plasma.stickExplodeDelay
      };
    },
    getThrowableMechanicsTuning() {
      return gameplayTuning.throwableMechanics;
    }
  };

  harness.init();
  const missileTuning = harness.GameThrowables.getMissileTuning();

  assert.ok(missileTuning);
  assert.equal(missileTuning.speed, gameplayTuning.throwables.missile.speed);
  assert.deepEqual(harness.GameThrowables.getTypes(), gameplayTuning.throwables.order);
});

test('throwables runtime uses the shared throwable default selection', async () => {
  const harness = await loadThrowablesHarness(gameplayTuning, {
    GameShared: {
      gameplayTuning,
      getDefaultThrowableId() {
        return 'plasma';
      },
      normalizeThrowableId(requestedId) {
        return requestedId === 'frag' ? 'frag' : 'plasma';
      }
    }
  });

  assert.equal(harness.GameThrowables.getSelectedThrowable(), 'plasma');
  assert.equal(harness.GameThrowables.setSelectedThrowable('frag'), true);
  assert.equal(harness.GameThrowables.getSelectedThrowable(), 'frag');
});

test('throwables runtime eases remote projectile meshes toward new authoritative positions', async () => {
  const harness = await loadThrowablesHarness();
  const { GameThrowables, scene } = harness;

  GameThrowables.syncAuthoritativeState({
    projectiles: [{
      id: 'proj_remote',
      type: 'knife',
      ownerId: 'usr_other',
      x: 0,
      y: 1,
      z: 0,
      vx: 0,
      vy: 0,
      vz: -12,
      age: 0
    }],
    fireZones: []
  }, 'usr_self');

  const mesh = scene.children.find((node) => node && node.userData && node.userData.projectileType === 'knife');
  assert.ok(mesh);
  assert.equal(mesh.position.z, 0);

  GameThrowables.syncAuthoritativeState({
    projectiles: [{
      id: 'proj_remote',
      type: 'knife',
      ownerId: 'usr_other',
      x: 0,
      y: 1,
      z: -10,
      vx: 0,
      vy: 0,
      vz: -12,
      age: 0.5
    }],
    fireZones: []
  }, 'usr_self');

  assert.equal(mesh.position.z, 0);
  GameThrowables.update(0.016, function () {});
  assert.equal(mesh.position.z < 0, true);
  assert.equal(mesh.position.z > -10, true);
});

test('throwables runtime attaches remote stuck plasma to the authoritative target position', async () => {
  const renderMap = new Map([[
    'usr_target',
    {
      group: {
        position: new THREE.Vector3(10, 0, -4)
      }
    }
  ]]);
  const harness = await loadThrowablesHarness(gameplayTuning, {
    GameNetEntities: {
      getRenderMap() { return renderMap; }
    }
  });
  const { GameThrowables, scene } = harness;

  GameThrowables.syncAuthoritativeState({
    projectiles: [{
      id: 'proj_stuck',
      type: 'plasma',
      ownerId: 'usr_other',
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 1.2,
      stickyUntil: 2200,
      stuckToTargetId: 'usr_target',
      stuckOffsetX: 0.2,
      stuckOffsetY: 0.1,
      stuckOffsetZ: -0.3
    }],
    fireZones: []
  }, 'usr_self');

  const mesh = scene.children.find((node) => node && node.userData && node.userData.projectileType === 'plasma');
  assert.ok(mesh);
  GameThrowables.update(0.016, function () {});

  assert.equal(mesh.position.x, 10.2);
  assert.equal(mesh.position.y, 1.1);
  assert.equal(mesh.position.z, -4.3);
});

test('throwables runtime attaches stuck plasma to the local self position when the authoritative target is the player', async () => {
  const harness = await loadThrowablesHarness(gameplayTuning, {
    GameShared: {
      gameplayTuning,
      entityConstants: {
        EYE_HEIGHT: 1.6
      }
    },
    GameNet: {
      getAuthoritativeSelfState() {
        return { id: 'usr_self' };
      }
    },
    GamePlayer: {
      getPosition() {
        return { x: 3, y: 1.6, z: -2 };
      }
    }
  });
  const { GameThrowables, scene } = harness;

  GameThrowables.syncAuthoritativeState({
    projectiles: [{
      id: 'proj_self_stuck',
      type: 'plasma',
      ownerId: 'usr_other',
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 1.2,
      stickyUntil: 2200,
      stuckToTargetId: 'usr_self',
      stuckOffsetX: 0.2,
      stuckOffsetY: 0.1,
      stuckOffsetZ: -0.3
    }],
    fireZones: []
  }, 'usr_self');

  const mesh = scene.children.find((node) => node && node.userData && node.userData.projectileType === 'plasma');
  assert.ok(mesh);
  GameThrowables.update(0.016, function () {});

  assert.equal(mesh.position.x, 3.2);
  assert.equal(mesh.position.y, 1.1);
  assert.equal(mesh.position.z, -2.3);
});

test('plasma grenade stays ballistic instead of steering toward nearby enemies after launch', async () => {
  const enemy = {
    alive: true,
    group: { position: new THREE.Vector3(4, 0, -8) },
    bodyHitbox: { position: new THREE.Vector3(4, 1.05, -8) }
  };
  const harness = await loadThrowablesHarness(gameplayTuning, {
    GameEnemy: {
      getEnemies() { return [enemy]; },
      getHitboxArray() { return []; }
    }
  });
  const { GameThrowables, scene } = harness;

  const predicted = GameThrowables.throwPredicted('plasma', {}, 'cthrow_plasma', {
    origin: { x: 0, y: 1, z: 0 },
    direction: { x: 0, y: 0, z: -1 }
  });
  assert.equal(predicted, true);

  for (let i = 0; i < 8; i++) {
    GameThrowables.update(0.05, function () {});
  }

  const mesh = scene.children.find((node) => node && node.userData && node.userData.projectileType === 'plasma');
  assert.ok(mesh);
  assert.ok(Math.abs(mesh.position.x) < 0.05);
  assert.ok(mesh.position.z < -3);
});

test('plasma grenade seeks then sticks at chest height when a target enters the catch radius', async () => {
  const plasmaTrackingTuning = JSON.parse(JSON.stringify(gameplayTuning));
  plasmaTrackingTuning.throwables.plasma.catchRadius = 1.5;
  plasmaTrackingTuning.throwables.plasma.acquireRange = 18;
  plasmaTrackingTuning.throwables.plasma.acquireHalfAngleDeg = 35;
  plasmaTrackingTuning.throwables.plasma.stickExplodeDelay = 2.2;
  plasmaTrackingTuning.throwables.plasma.stickHeight = 0.9;
  plasmaTrackingTuning.throwables.plasma.seekLerp = 8;
  plasmaTrackingTuning.throwables.plasma.seekSpeed = 32;
  const bodyHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.2, 0.8),
    new THREE.MeshBasicMaterial()
  );
  bodyHitbox.position.set(1.15, 1.05, -2.8);
  const enemy = {
    alive: true,
    group: { position: new THREE.Vector3(1.15, 0, -2.8) },
    bodyHitbox
  };
  const harness = await loadThrowablesHarness(plasmaTrackingTuning, {
    GameEnemy: {
      getEnemies() { return [enemy]; },
      getHitboxArray() { return [bodyHitbox]; }
    }
  });
  const { GameThrowables, scene } = harness;

  const predicted = GameThrowables.throwPredicted('plasma', {}, 'cthrow_plasma_track', {
    origin: { x: 0, y: 1, z: 0 },
    direction: { x: 0, y: 0, z: -1 }
  });
  assert.equal(predicted, true);

  // Tick until the grenade catches and finishes seeking (max 0.3s seek + arrival)
  for (let i = 0; i < 20; i++) {
    GameThrowables.update(0.05, function () {});
  }
  const mesh = scene.children.find((node) => node && node.userData && node.userData.projectileType === 'plasma');
  assert.ok(mesh);

  // After seek resolves, grenade should be at the enemy chest (group.y + stickHeight)
  const stuckX = mesh.position.x;
  const stuckY = mesh.position.y;
  const stuckZ = mesh.position.z;
  assert.ok(Math.abs(stuckY - 0.9) < 0.1, 'grenade should be near chest height (0.9)');

  // Position should not change once stuck
  for (let i = 0; i < 4; i++) {
    GameThrowables.update(0.05, function () {});
  }
  assert.equal(mesh.position.x, stuckX);
  assert.equal(mesh.position.y, stuckY);
  assert.equal(mesh.position.z, stuckZ);
});

test('ability missile launch aims from the muzzle toward the crosshair hit point', async () => {
  const aimBlock = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, 0.5),
    new THREE.MeshBasicMaterial()
  );
  aimBlock.position.set(0, 1.6, -20);
  aimBlock.updateMatrixWorld(true);

  const harness = await loadThrowablesHarness(gameplayTuning, {
    GameWorld: {
      getCollidables() { return [aimBlock]; },
      getGroundHeightAt() { return -50; }
    },
    GamePlayer: {
      getMuzzleWorldPosition() {
        return new THREE.Vector3(1, 1.6, 0);
      }
    }
  });
  const { GameThrowables } = harness;

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 1.6, 0);
  camera.lookAt(0, 1.6, -20);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const intent = GameThrowables.fireAbilityMissile(camera, { predictLocal: false, abilityId: 'missile' });

  assert.ok(intent);
  assert.equal(intent.origin.x, 1);
  assert.equal(intent.origin.y, 1.6);
  assert.ok(intent.aimPoint);
  assert.ok(Math.abs(intent.aimPoint.x) < 0.01);
  assert.ok(Math.abs(intent.aimPoint.y - 1.6) < 0.01);
  assert.ok(intent.aimPoint.z < -19 && intent.aimPoint.z > -21);
  assert.ok(intent.direction.x < -0.04);
  assert.ok(intent.direction.z < -0.95);
});
