import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

function getGameNetRuntimeScriptUrls() {
  return [
    new URL('../../js/net/join-state.js', import.meta.url),
    new URL('../../js/net/connection-timing.js', import.meta.url),
    new URL('../../js/net/runtime-state.js', import.meta.url),
    new URL('../../js/net/commands.js', import.meta.url),
    new URL('../../js/net/network-access.js', import.meta.url),
    new URL('../../js/net/network-config.js', import.meta.url),
    new URL('../../js/net/network-fire-payload.js', import.meta.url),
    new URL('../../js/net/network-loadout.js', import.meta.url),
    new URL('../../js/net/message-router.js', import.meta.url),
    new URL('../../js/net/runtime-core.js', import.meta.url),
    new URL('../../js/net/network-snapshot-buffer.js', import.meta.url),
    new URL('../../js/net/network-snapshot-apply.js', import.meta.url),
    new URL('../../js/net/state-view.js', import.meta.url),
    new URL('../../js/net/effects.js', import.meta.url),
    new URL('../../js/net/network.js', import.meta.url)
  ];
}

async function loadScript(modulePath, sandbox) {
  const code = await fs.readFile(modulePath instanceof URL ? modulePath : new URL(modulePath, import.meta.url), 'utf8');
  vm.runInContext(code, vm.createContext(sandbox));
}

async function createNetHarness(options = {}) {
  const initialNowMs = Math.max(0, Number(options.nowMs || 0));
  let nowMs = initialNowMs;
  let runtimeState = null;
  let runtimeCoreOpts = null;
  const updateCalls = [];
  const renderMap = options.renderMap instanceof Map ? options.renderMap : new Map();

  class FakeDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [nowMs]));
    }

    static now() {
      return nowMs;
    }
  }
  FakeDate.parse = Date.parse;
  FakeDate.UTC = Date.UTC;

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Date: FakeDate,
    Map,
    URLSearchParams,
    WebSocket: function WebSocket() {},
    THREE: {
      Vector3: class Vector3 {
        constructor(x = 0, y = 0, z = 0) {
          this.x = x;
          this.y = y;
          this.z = z;
        }

        copy(v) {
          this.x = Number(v && v.x || 0);
          this.y = Number(v && v.y || 0);
          this.z = Number(v && v.z || 0);
          return this;
        }
      }
    },
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameShared: {
          protocol: {
            msg: {
              c2s: {
                INPUT: 'input',
                FIRE: 'fire',
                EQUIP_WEAPON: 'equip_weapon',
                WEAPON_LOADOUT: 'weapon_loadout',
                THROW: 'throw',
                CLASS_QUEUE: 'class_queue',
                CLASS_CAST: 'class_cast',
                RELOAD: 'reload',
                ENTER_MATCH: 'enter_match',
                ROLL: 'roll'
              },
              s2c: {
                WELCOME: 'welcome',
                SNAPSHOT: 'snapshot'
              }
            },
            wsPath: '/api/ws',
            sanitizeRoomId(value) { return String(value || '').toLowerCase(); },
            cloneWorldFlags(flags) { return { ...(flags || {}) }; },
            buildExpectedWorldMeta(roomId) {
              return {
                roomId: String(roomId || ''),
                worldSeed: 'seed-' + String(roomId || ''),
                worldProfileVersion: 1,
                worldFlags: { envV2: true, terrainPhysicsV2: true }
              };
            },
            normalizeAbilityLoadoutPayload() { return {}; },
            normalizeClassCastPayload() { return {}; },
            normalizeThrowPayload() { return {}; },
            normalizeReloadPayload() { return {}; },
            normalizeWeaponLoadoutPayload(slot1, slot2) { return { slot1, slot2 }; }
          },
          getNetworkTuning() {
            return {
              flags: Object.assign({
                remoteReceiveJitterBuffer: true,
                snapshotDeltaCompression: true,
                replayFirstSelfCorrection: true
              }, options.networkFlags || {})
            };
          }
        },
        GameNetAuth: {
          getSocketIdentity() { return { id: 'user-1' }; },
          ensureArenaIdentity() { return Promise.resolve({ id: 'user-1' }); }
        },
        GameNetEntities: {
          classStats() { return { armorMax: 100, wallhackRadius: 0 }; },
          getHitboxArray() { return []; },
          getRenderMap() { return renderMap; },
          updateFromSnapshot(entity, snapshotMeta) {
            updateCalls.push({
              entity: JSON.parse(JSON.stringify(entity)),
              snapshotMeta: JSON.parse(JSON.stringify(snapshotMeta || {})),
              at: nowMs
            });
          },
          removeRemoteVisual() {},
          init() {},
          cleanup() {},
          setHitboxVisibility() {}
        },
        GameNetRuntimeCore: {
          create(opts) {
            runtimeCoreOpts = opts;
            return {
              connectWs() {
                if (opts.onTransportConnectStart) opts.onTransportConnectStart();
              },
              shutdownConnection() {},
              clearReconnectTimer() {},
              update() {},
              wsSend() { return false; }
            };
          }
        },
        GameNetSnapshots: null,
        GameAbilityFx: null
      }
    }
  };

  const scriptUrls = getGameNetRuntimeScriptUrls().filter((scriptUrl) => {
    const href = String(scriptUrl);
    return !href.endsWith('/js/net/runtime-core.js');
  });

  for (const scriptUrl of scriptUrls) {
    const href = String(scriptUrl);
    if (href.endsWith('/js/net/network.js')) {
      const runtime = sandbox.globalThis.__MAYHEM_RUNTIME;
      const runtimeStateFactory = runtime.GameNetRuntimeState;
      if (runtimeStateFactory && runtimeStateFactory.create && !runtimeStateFactory.__capturedForTests) {
        const originalCreate = runtimeStateFactory.create.bind(runtimeStateFactory);
        runtimeStateFactory.create = function wrappedCreate(createOptions) {
          runtimeState = originalCreate(createOptions);
          return runtimeState;
        };
        runtimeStateFactory.__capturedForTests = true;
      }
    }
    await loadScript(scriptUrl, sandbox);
  }

  return {
    net: sandbox.globalThis.__MAYHEM_RUNTIME.GameNet,
    getRuntimeState() {
      return runtimeState;
    },
    getUpdateCalls() {
      return updateCalls.slice();
    },
    init() {
      sandbox.globalThis.__MAYHEM_RUNTIME.GameNet.init({});
    },
    dispatch(message) {
      runtimeCoreOpts.handleMessage(JSON.stringify(message));
    },
    setNow(value) {
      nowMs = Math.max(0, Number(value || 0));
    },
    update() {
      sandbox.globalThis.__MAYHEM_RUNTIME.GameNet.update(1 / 60, { x: 0, y: 0, z: 0 }, { yaw: 0, pitch: 0 });
    }
  };
}

function welcomeMessage() {
  return {
    t: 'welcome',
    selfId: 'user-1',
    roomId: 'ffa-01',
    gameMode: 'ffa',
    matchState: { gameMode: 'ffa', started: false, ended: false },
    worldSeed: 'seed-ffa-01',
    worldProfileVersion: 1,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  };
}

function selfSnapshotMessage(seq, snapshotSeq, serverTime) {
  return {
    t: 'snapshot',
    snapshotSeq,
    serverTime,
    entities: [{
      id: 'user-1',
      username: 'ALPHA',
      alive: true,
      seq,
      x: 0,
      y: 1.6,
      z: 0,
      yaw: 0,
      pitch: 0,
      velocityY: 0,
      jumpHoldTimer: 0,
      moveSpeedNorm: 0,
      isGrounded: true,
      jumpHeldLast: false,
      sprinting: false,
      fastBackpedal: false,
      weaponId: 'rifle'
    }],
    projectiles: [],
    fireZones: []
  };
}

test('GameNet self reconciliation keeps only inputs above the accepted self ack', async () => {
  const harness = await createNetHarness({
    nowMs: 1000,
    networkFlags: { remoteReceiveJitterBuffer: false }
  });
  harness.init();
  harness.dispatch(welcomeMessage());

  const netState = harness.getRuntimeState();
  netState.setLastInputSeqSent(3);
  netState.setInputSeqHistory([
    {
      seq: 1,
      at: 920,
      dtMs: 16,
      yaw: 0,
      pitch: 0,
      weaponId: 'rifle',
      movementLocked: false,
      inputState: { forward: true }
    },
    {
      seq: 2,
      at: 950,
      dtMs: 30,
      yaw: 0.1,
      pitch: 0,
      weaponId: 'shotgun',
      movementLocked: false,
      inputState: { forward: true, left: true }
    },
    {
      seq: 3,
      at: 980,
      dtMs: 30,
      yaw: 0.2,
      pitch: 0.1,
      weaponId: 'sniper',
      movementLocked: true,
      inputState: { forward: true, sprint: true }
    }
  ]);

  harness.dispatch(selfSnapshotMessage(2, 10, 995));

  const reconciliationState = harness.net.view.getSelfReconciliationState();
  assert.ok(reconciliationState);
  assert.deepEqual(Array.from(reconciliationState.pendingInputs, (sample) => sample.seq), [3]);
  assert.equal(reconciliationState.pendingInputCount, 1);
  assert.equal(reconciliationState.latestPendingAgeMs, 20);
  assert.equal(reconciliationState.pendingInputs[0].weaponId, 'sniper');
  assert.equal(reconciliationState.pendingInputs[0].movementLocked, true);
});

test('GameNet remote jitter buffer drains snapshots only when due and honors added delay padding', async () => {
  const renderMap = new Map([
    ['usr_padded', { lossDelayPaddingMs: 30 }]
  ]);
  const harness = await createNetHarness({
    nowMs: 1000,
    networkFlags: { remoteReceiveJitterBuffer: true },
    renderMap
  });
  harness.init();

  harness.dispatch({
    t: 'snapshot',
    snapshotSeq: 1,
    serverTime: 1000,
    entities: [{
      id: 'usr_plain',
      username: 'REMOTE',
      alive: true,
      x: 1,
      y: 1.6,
      z: 0,
      yaw: 0,
      pitch: 0,
      velocityY: 0,
      jumpHoldTimer: 0,
      moveSpeedNorm: 0,
      isGrounded: true,
      jumpHeldLast: false,
      sprinting: false,
      fastBackpedal: false,
      weaponId: 'rifle'
    }],
    projectiles: [],
    fireZones: []
  });

  assert.equal(harness.getUpdateCalls().length, 0);
  assert.equal(harness.getRuntimeState().getRemoteFrameQueue().length, 1);
  const firstReadyAt = Number(harness.getRuntimeState().peekRemoteFrame().readyAt || 0);

  harness.setNow(Math.max(0, Math.floor(firstReadyAt) - 1));
  harness.update();
  assert.equal(harness.getUpdateCalls().length, 0);

  harness.setNow(Math.ceil(firstReadyAt));
  harness.update();
  assert.deepEqual(harness.getUpdateCalls().map((entry) => entry.entity.id), ['usr_plain']);

  harness.setNow(1070);
  harness.dispatch({
    t: 'snapshot',
    snapshotSeq: 2,
    serverTime: 1070,
    entities: [{
      id: 'usr_padded',
      username: 'PADDED',
      alive: true,
      x: 2,
      y: 1.6,
      z: 0,
      yaw: 0,
      pitch: 0,
      velocityY: 0,
      jumpHoldTimer: 0,
      moveSpeedNorm: 0,
      isGrounded: true,
      jumpHeldLast: false,
      sprinting: false,
      fastBackpedal: false,
      weaponId: 'rifle'
    }],
    projectiles: [],
    fireZones: []
  });
  harness.setNow(1105);
  harness.dispatch({
    t: 'snapshot',
    snapshotSeq: 3,
    serverTime: 1105,
    entities: [{
      id: 'usr_late',
      username: 'LATE',
      alive: true,
      x: 3,
      y: 1.6,
      z: 0,
      yaw: 0,
      pitch: 0,
      velocityY: 0,
      jumpHoldTimer: 0,
      moveSpeedNorm: 0,
      isGrounded: true,
      jumpHeldLast: false,
      sprinting: false,
      fastBackpedal: false,
      weaponId: 'rifle'
    }],
    projectiles: [],
    fireZones: []
  });

  assert.equal(harness.getRuntimeState().getRemoteFrameQueue().length, 2);
  const queuedFrames = harness.getRuntimeState().getRemoteFrameQueue();
  const paddedReadyAt = Number(queuedFrames[0] && queuedFrames[0].readyAt || 0);
  const lateReadyAt = Number(queuedFrames[1] && queuedFrames[1].readyAt || 0);
  assert.ok(paddedReadyAt - 1070 >= 90, `expected padding to add delay, saw readyAt=${paddedReadyAt}`);
  assert.ok(lateReadyAt > paddedReadyAt, `expected later frame to stay queued longer, saw ${lateReadyAt} vs ${paddedReadyAt}`);

  harness.setNow(Math.max(0, Math.floor(paddedReadyAt) - 1));
  harness.update();
  assert.deepEqual(harness.getUpdateCalls().map((entry) => entry.entity.id), ['usr_plain']);

  harness.setNow(Math.ceil(paddedReadyAt));
  harness.update();
  assert.deepEqual(harness.getUpdateCalls().map((entry) => entry.entity.id), ['usr_plain', 'usr_padded']);
  assert.equal(harness.getRuntimeState().getRemoteFrameQueue().length, 1);

  harness.setNow(Math.max(0, Math.floor(lateReadyAt) - 1));
  harness.update();
  assert.deepEqual(harness.getUpdateCalls().map((entry) => entry.entity.id), ['usr_plain', 'usr_padded']);

  harness.setNow(Math.ceil(lateReadyAt));
  harness.update();
  assert.deepEqual(harness.getUpdateCalls().map((entry) => entry.entity.id), ['usr_plain', 'usr_padded', 'usr_late']);
  assert.equal(harness.getRuntimeState().getRemoteFrameQueue().length, 0);
});
