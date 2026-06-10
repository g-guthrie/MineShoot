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
        gameplayTuning,
        getNetworkTuning() {
          return (this.gameplayTuning && this.gameplayTuning.network) || {};
        },
        getMovementTuning() {
          return (this.gameplayTuning && this.gameplayTuning.movement) || {};
        }
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
    classId: 'ffa',
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

test('remote entities hide the live target immediately when alive state is cleared', async () => {
  const { entitiesApi } = await loadRemoteEntities();
  const entityId = 'usr_fell';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1000,
    receivedAt: 1000
  });

  assert.equal(entitiesApi.setAliveState(entityId, false), true);

  const render = entitiesApi.getRenderMap().get(entityId);
  assert.ok(render);
  assert.equal(render.alive, false);
  assert.equal(render.group.visible, false);
  assert.equal(render.bodyHitbox.visible, false);
  assert.equal(render.headHitbox.visible, false);
  assert.equal(render.snapshotHistory.length, 1);
  assert.equal(render.snapshotHistory[0].alive, false);
  assert.equal(render.snapshotHistory[0].x, 0);
  assert.equal(render.snapshotHistory[0].z, 0);
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

test('remote entities default new renders to the online snapshot cadence', async () => {
  const { entitiesApi } = await loadRemoteEntities();
  const entityId = 'usr_default_cadence';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1000,
    receivedAt: 1000
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  assert.ok(render);
  assert.equal(render.snapshotIntervalMs, 1000 / 30);
  assert.equal(render.lastSnapshotStepMs, 1000 / 30);
});

test('remote entities refresh lateral movement flags on every snapshot', async () => {
  const { entitiesApi } = await loadRemoteEntities();
  const entityId = 'usr_lateral_flags';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    movingLeft: true,
    movingRight: false
  }), {
    serverTime: 1000,
    receivedAt: 1000
  });

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    movingLeft: false,
    movingRight: true
  }), {
    serverTime: 1050,
    receivedAt: 1050
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  assert.ok(render);
  assert.equal(render.movingLeft, false);
  assert.equal(render.movingRight, true);
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

test('remote entities skip loss padding when the entity was merely omitted from delta snapshots', async () => {
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
  const entityId = 'usr_idle_omission';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1000,
    receivedAt: 1000,
    snapshotSeq: 10,
    prevAppliedSnapshotSeq: 9
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  render.snapshotIntervalMs = 100;
  render.lastSnapshotStepMs = 100;
  render.snapshotJitterMs = 0;

  // Frames 11-13 reached this viewer but omitted the idle entity (delta
  // compression); the serverTime gap when it resumes moving is not packet
  // loss, and the multi-second resume spacing is not a cadence sample.
  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, { x: 2 }), {
    serverTime: 1360,
    receivedAt: 1360,
    snapshotSeq: 14,
    prevAppliedSnapshotSeq: 13
  });

  assert.equal(Number(render.lossDelayPaddingMs || 0), 0);
  assert.equal(Number(render.consecutiveMissedSnapshots || 0), 0);
  assert.equal(Number(render.snapshotIntervalMs), 100);
});

test('remote entities learn the effective interval of cadence-limited entities without counting loss', async () => {
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
  const entityId = 'usr_cadence_tier';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, { x: 1 }), {
    serverTime: 1000,
    receivedAt: 1000,
    snapshotSeq: 10,
    prevAppliedSnapshotSeq: 9
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  render.snapshotIntervalMs = 100;
  render.lastSnapshotStepMs = 100;
  render.snapshotJitterMs = 0;

  // Degraded-cadence tier: the server sends this moving entity on every 2nd
  // frame (seq gap 2 while the viewer applied every frame). The ~66ms
  // arrival spacing is its real effective interval and must be learned,
  // but the omitted frame is not packet loss.
  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, { x: 2 }), {
    serverTime: 1066,
    receivedAt: 1066,
    snapshotSeq: 12,
    prevAppliedSnapshotSeq: 11
  });

  assert.equal(Number(render.lossDelayPaddingMs || 0), 0);
  assert.equal(Number(render.consecutiveMissedSnapshots || 0), 0);
  assert.equal(Number(render.snapshotIntervalMs.toFixed(2)), 89.8);

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, { x: 3 }), {
    serverTime: 1132,
    receivedAt: 1132,
    snapshotSeq: 14,
    prevAppliedSnapshotSeq: 13
  });

  assert.equal(Number(render.lossDelayPaddingMs || 0), 0);
  assert.ok(
    Number(render.snapshotIntervalMs) < 89.8 && Number(render.snapshotIntervalMs) > 66,
    `expected interval converging toward 66ms, saw ${render.snapshotIntervalMs}`
  );
});

test('remote entities still count loss when burst frames inflate the global seq for every viewer frame', async () => {
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
  const entityId = 'usr_burst_seq';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, { x: 1 }), {
    serverTime: 1000,
    receivedAt: 1000,
    snapshotSeq: 10,
    prevAppliedSnapshotSeq: 9
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  render.snapshotIntervalMs = 100;
  render.lastSnapshotStepMs = 100;
  render.snapshotJitterMs = 0;

  // The global seq jumped by 4 but the viewer's own received-frame gap is
  // also 4: every frame the viewer got contained this entity, so the
  // serverTime stall is potential packet loss, not a delta omission.
  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, { x: 2 }), {
    serverTime: 1360,
    receivedAt: 1360,
    snapshotSeq: 14,
    prevAppliedSnapshotSeq: 10
  });

  assert.equal(Number(render.lossDelayPaddingMs || 0) > 0, true);
});

test('remote entities still add loss padding when the snapshot stream itself gapped', async () => {
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
  const entityId = 'usr_stream_gap';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId), {
    serverTime: 1000,
    receivedAt: 1000,
    snapshotSeq: 10
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  render.snapshotIntervalMs = 100;
  render.lastSnapshotStepMs = 100;
  render.snapshotJitterMs = 0;

  // Consecutive seq with a large serverTime gap means the stream stalled.
  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, { x: 2 }), {
    serverTime: 1360,
    receivedAt: 1360,
    snapshotSeq: 11
  });

  assert.equal(Number(render.lossDelayPaddingMs || 0) > 0, true);
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

test('remote entities seed a recovery blend when fresh snapshots resume after a freeze', async () => {
  const { entitiesApi } = await loadRemoteEntities({
    network: {
      remoteInterpolation: {
        freezeRecoveryBlendMs: 64
      }
    }
  });
  const entityId = 'usr_freeze_recover';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    x: 0,
    z: 0
  }), {
    serverTime: 1000,
    receivedAt: 1000
  });

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    x: 2,
    z: 0
  }), {
    serverTime: 1100,
    receivedAt: 1100
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  render.freezePresentation = {
    x: 1.25,
    footY: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    fastBackpedal: false,
    movingForward: false,
    movingBackward: false,
    movingLeft: false,
    movingRight: false,
    isGrounded: true,
    velocityY: 0,
    muzzleFlashUntil: 0
  };
  render.freezePresentationAt = 1180;

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    x: 3,
    z: 0
  }), {
    serverTime: 1200,
    receivedAt: 1200
  });

  assert.ok(render.freezeBlendFrom);
  assert.equal(Number(render.freezeBlendFrom.x || 0), 1.25);
  assert.equal(Number(render.freezeBlendStartAt || 0), 1200);
  assert.equal(Number(render.freezeBlendDurationMs || 0), 64);
  assert.equal(render.freezePresentation, null);
});
