import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

function createVec3() {
  return {
    x: 0,
    y: 0,
    z: 0,
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  };
}

async function loadRemoteEntities(gameplayTuning = null) {
  const [interpCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/net/interpolation.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/net/remote-entities.js', import.meta.url), 'utf8')
  ]);
  const scene = {
    added: [],
    add(node) {
      this.added.push(node);
      if (node && typeof node === 'object') node.parent = this;
    }
  };
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        entityConstants: { EYE_HEIGHT: 1.6 },
        gameplayTuning
      },
      GameActorVisualFactory: {
        create() {
          const root = {
            position: createVec3(),
            rotation: { y: 0 },
            visible: true,
            parent: null
          };
          const bodyHitbox = { position: createVec3(), userData: {} };
          const headHitbox = { position: createVec3(), userData: {} };
          return {
            root,
            rigApi: {},
            bodyHitbox,
            headHitbox,
            setWorldTransform(position, yaw) {
              root.position.set(position.x, position.y, position.z);
              root.rotation.y = yaw;
            },
            syncHitboxes(position) {
              bodyHitbox.position.set(position.x, position.y + 0.7625, position.z);
              headHitbox.position.set(position.x, position.y + 2.0, position.z);
            },
            setAlive(alive) {
              root.visible = !!alive;
            },
            setHitboxVisibility() {}
          };
        }
      }
    },
    globalThis: null,
    console,
    Date
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(interpCode, context);
  vm.runInContext(code, context);
  const entitiesApi = sandbox.__MAYHEM_RUNTIME.GameNetEntities;
  entitiesApi.init(scene);
  return { entitiesApi, scene };
}

function snapshotEntity(id, overrides = {}) {
  return {
    id,
    kind: 'player',
    username: id,
    classId: 'abilities',
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    hp: 100,
    hpMax: 100,
    armor: 0,
    armorMax: 0,
    weaponId: 'rifle',
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: false,
    velocityY: 0,
    isGrounded: true,
    alive: true,
    spawnShieldUntil: 0,
    wallhackRadius: 90,
    weaponAmmo: {},
    muzzleFlashUntil: 0,
    streamHeat: 0,
    streamOverheatedUntil: 0,
    abilityId: '',
    ...overrides
  };
}

test('remote entities reseed history and snap immediately on large position jumps', async () => {
  const { entitiesApi } = await loadRemoteEntities();
  const entityId = 'usr_remote';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    x: 1,
    y: 1.6,
    z: 2
  }), {
    serverTime: 1000,
    receivedAt: 1000
  });

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    x: 20,
    y: 1.6,
    z: 24,
    yaw: 0.75
  }), {
    serverTime: 1050,
    receivedAt: 1050
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  assert.ok(render);
  assert.equal(render.snapshotHistory.length, 1);
  assert.equal(render.snapshotHistory[0].x, 20);
  assert.equal(render.group.position.x, 20);
  assert.equal(render.group.position.y, 0);
  assert.equal(render.group.position.z, 24);
  assert.equal(render.group.rotation.y, 0.75);
  assert.equal(render.bodyHitbox.position.x, 20);
  assert.equal(render.headHitbox.position.z, 24);
});

test('remote entities reseed history on dead-to-alive transitions', async () => {
  const { entitiesApi } = await loadRemoteEntities();
  const entityId = 'usr_respawn';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    alive: false,
    x: 5,
    z: 6
  }), {
    serverTime: 1000,
    receivedAt: 1000
  });

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    alive: true,
    x: 7,
    z: 9
  }), {
    serverTime: 1060,
    receivedAt: 1060
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  assert.ok(render);
  assert.equal(render.snapshotHistory.length, 1);
  assert.equal(render.snapshotHistory[0].alive, true);
  assert.equal(render.group.position.x, 7);
  assert.equal(render.group.position.z, 9);
  assert.equal(render.group.visible, true);
});

test('remote entities keep sprint movement gaps in history when the speed-aware teleport threshold covers them', async () => {
  const { entitiesApi } = await loadRemoteEntities({
    movement: {
      runSpeed: 14
    },
    network: {
      remoteInterpolation: {
        teleportBaseThresholdWu: 8,
        teleportSpeedAllowanceScale: 1.5
      }
    }
  });
  const entityId = 'usr_sprint_gap';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    x: 0,
    z: 0,
    moveSpeedNorm: 1,
    sprinting: true,
    movingForward: true
  }), {
    serverTime: 1000,
    receivedAt: 1000
  });

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    x: 10,
    z: 0,
    moveSpeedNorm: 1,
    sprinting: true,
    movingForward: true
  }), {
    serverTime: 1200,
    receivedAt: 1200
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  assert.ok(render);
  assert.equal(render.snapshotHistory.length, 2);
  assert.equal(render.snapshotHistory[0].x, 0);
  assert.equal(render.snapshotHistory[1].x, 10);
  assert.equal(render.group.position.x, 0);
});

test('remote entities reuse the same snapshot history array between updates', async () => {
  const { entitiesApi } = await loadRemoteEntities();
  const entityId = 'usr_history_reuse';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    x: 0,
    z: 0
  }), {
    serverTime: 1000,
    receivedAt: 1000
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  const firstHistory = render.snapshotHistory;

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    x: 2,
    z: 0
  }), {
    serverTime: 1050,
    receivedAt: 1050
  });

  assert.equal(render.snapshotHistory, firstHistory);
  assert.equal(render.snapshotHistory.length, 2);
});

test('remote entities clamp extreme interval spikes before smoothing cadence', async () => {
  const { entitiesApi } = await loadRemoteEntities();
  const entityId = 'usr_outlier_interval';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1000,
    receivedAt: 1000
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  render.snapshotIntervalMs = 100;
  render.lastSnapshotStepMs = 100;
  render.snapshotJitterMs = 0;

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1600,
    receivedAt: 1600
  });

  assert.ok(render);
  assert.equal(Number(render.snapshotIntervalMs.toFixed(2)), 160);
  assert.equal(Number(render.lastSnapshotStepMs.toFixed(2)), 300);
});

test('remote entities add and decay temporary delay padding during packet loss bursts', async () => {
  const { entitiesApi } = await loadRemoteEntities({
    network: {
      remoteInterpolation: {
        lossBurstThresholdScale: 1.5,
        lossDelayPaddingTriggerCount: 2,
        lossDelayPaddingIntervalScale: 1.0,
        lossDelayPaddingMaxMs: 120
      }
    }
  });
  const entityId = 'usr_loss_padding';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1000,
    receivedAt: 1000
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  render.snapshotIntervalMs = 100;
  render.lastSnapshotStepMs = 100;
  render.snapshotJitterMs = 0;

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1360,
    receivedAt: 1360
  });

  const paddingAfterBurst = Number(render.lossDelayPaddingMs || 0);
  assert.equal(paddingAfterBurst > 0, true);

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1460,
    receivedAt: 1460
  });

  assert.equal(Number(render.lossDelayPaddingMs || 0) < paddingAfterBurst, true);
});

test('remote entities raise interpolation delay faster than they lower it', async () => {
  const { entitiesApi } = await loadRemoteEntities({
    network: {
      remoteInterpolation: {
        minDelayMs: 1,
        maxDelayMs: 400,
        intervalDelayScale: 1.6,
        jitterDelayScale: 1.4,
        delayIncreaseTargetWeight: 0.7,
        delayDecreaseTargetWeight: 0.2
      }
    }
  });
  const entityId = 'usr_delay_weights';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1000,
    receivedAt: 1000
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  render.snapshotIntervalMs = 120;
  render.snapshotJitterMs = 0;
  render.interpolationDelayMs = 80;

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1000,
    receivedAt: 1001
  });

  const raisedDelay = Number(render.interpolationDelayMs || 0);
  const increaseAmount = raisedDelay - 80;

  render.snapshotIntervalMs = 50;
  render.snapshotJitterMs = 0;

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1000,
    receivedAt: 1002
  });

  const loweredDelay = Number(render.interpolationDelayMs || 0);
  const decreaseAmount = raisedDelay - loweredDelay;

  assert.equal(Number(raisedDelay.toFixed(2)), 158.4);
  assert.equal(Number(loweredDelay.toFixed(2)), 142.72);
  assert.equal(increaseAmount > decreaseAmount, true);
});
