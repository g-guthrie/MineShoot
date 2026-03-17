import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadScript(modulePath, sandbox) {
  const code = await fs.readFile(new URL(modulePath, import.meta.url), 'utf8');
  vm.runInContext(code, vm.createContext(sandbox));
}

test('GameNetRuntime compatibility wiring exposes remote presentation selectors', async () => {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    Map,
    URLSearchParams,
    WebSocket: function WebSocket() {},
    THREE: {
      Vector3: class Vector3 {
        copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
      }
    },
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameShared: {
          protocol: {
            msg: { c2s: {}, s2c: {} },
            wsPath: '/api/ws',
            world: {},
            sanitizeRoomId(value) { return String(value || ''); },
            cloneWorldFlags(flags) { return { ...(flags || {}) }; },
            buildExpectedWorldMeta() {
              return {
                roomId: 'test-room',
                worldSeed: 'seed',
                worldProfileVersion: 1,
                worldFlags: {}
              };
            },
            normalizeWeaponLoadoutPayload() { return {}; },
            normalizeThrowPayload() { return {}; },
            normalizeAbilityLoadoutPayload() { return {}; },
            normalizeClassCastPayload() { return {}; }
          }
        },
        GameNetAuth: {},
        GameNetEntities: {
          classStats() { return { armorMax: 100, wallhackRadius: 0 }; },
          getRenderMap() { return new Map(); },
          updateFromSnapshot() {},
          removeRemoteVisual() {},
          getHitboxArray() { return []; },
          setHitboxVisibility() {},
          init() {},
          cleanup() {}
        },
        GameNetCommands: {
          create() {
            return {
              sendFire() { return false; },
              sendEquipWeapon() { return false; },
              sendWeaponLoadout() { return false; },
              sendThrow() { return false; },
              sendAbilityLoadout() { return false; },
              sendAbilityCast() { return false; }
            };
          }
        },
        GameNetRuntimeAccess: {
          create() {
            return {
              buildWsEndpoint() { return 'ws://example.test'; },
              getActiveWorldMeta() { return null; },
              getSocketIdentity() { return null; },
              getCurrentUser() { return null; },
              getTransportApi() { return null; },
              getRemoteSyncApi() { return null; },
              buildFirePayload() { return null; },
              damagePointY(y) { return y; },
              markerPointY(y) { return y; }
            };
          }
        },
        GameNetMessageRouter: {
          create() {
            return { handleMessage() {} };
          }
        },
        GameNetRuntimeCore: {
          create() {
            return {
              connectWs() {},
              shutdownConnection() {},
              update() {},
              wsSend() { return false; }
            };
          }
        },
        GameAbilityFx: null
      }
    }
  };

  await loadScript('../../js/net/state-view.js', sandbox);
  await loadScript('../../js/net/runtime-state.js', sandbox);
  await loadScript('../../js/net/runtime.js', sandbox);

  const GameNet = sandbox.globalThis.__MAYHEM_RUNTIME.GameNetRuntime.create();

  assert.equal(typeof GameNet.getRemotePresentationClock, 'function');
  assert.equal(typeof GameNet.sampleRemoteEntityPresentation, 'function');
  assert.equal(typeof GameNet.damagePointForEntityId, 'function');
  assert.equal(GameNet.getRemotePresentationClock(), null);
  assert.equal(GameNet.sampleRemoteEntityPresentation('usr_remote'), null);
  assert.equal(GameNet.damagePointForEntityId('usr_remote'), null);
});

test('GameNetStateView samples remote presentation from snapshot timelines', async () => {
  const sandbox = {
    console,
    Date,
    Map,
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameAbilityFx: null
      }
    }
  };

  await loadScript('../../js/net/state-view.js', sandbox);
  await loadScript('../../js/net/runtime-state.js', sandbox);

  const runtime = sandbox.globalThis.__MAYHEM_RUNTIME;
  const state = runtime.GameNetRuntimeState.create({
    initialRoomId: 'global',
    inputSendInterval: 1 / 60
  });

  state.recordRemoteSnapshotTiming(1000, 1100);
  state.recordRemoteSnapshotTiming(1050, 1150);
  state.recordRemoteSnapshotEntity('usr_remote', {
    id: 'usr_remote',
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: false,
    isGrounded: true,
    velocityY: 0,
    weaponId: 'rifle'
  }, 1000);
  state.recordRemoteSnapshotEntity('usr_remote', {
    id: 'usr_remote',
    x: 10,
    y: 2.6,
    z: 5,
    yaw: 1,
    pitch: 0.2,
    moveSpeedNorm: 1,
    sprinting: true,
    movingForward: true,
    movingBackward: false,
    isGrounded: true,
    velocityY: 0.5,
    weaponId: 'shotgun'
  }, 1050);

  const view = runtime.GameNetStateView.create({
    buildExpectedWorldMeta() {
      return {
        roomId: 'global',
        worldSeed: 'seed',
        worldProfileVersion: 1,
        worldFlags: {}
      };
    },
    cloneWorldFlags(flags) { return { ...(flags || {}) }; },
    classStats() { return { armorMax: 100, wallhackRadius: 0 }; },
    getRoomId: state.getRoomId,
    getWorldMeta: state.getWorldMeta,
    getRenderMap() { return new Map(); },
    getSelfState: state.getSelfState,
    getSelfId: state.getSelfId,
    getMatchState: state.getMatchState,
    getSnapshotMap: state.getSnapshotMap,
    getRemoteSnapshotTiming: state.getRemoteSnapshotTiming,
    getRemoteSnapshotTimeline: state.getRemoteSnapshotTimeline,
    getInputSeqHistory: state.getInputSeqHistory,
    getLastInputSeqSent: state.getLastInputSeqSent,
    getLastInputSeqAcked: state.getLastInputSeqAcked,
    getLastSentInputSample: state.getLastSentInputSample,
    getInputSendTimer: state.getInputSendTimer,
    getInputSendInterval: state.getInputSendInterval,
    getPendingRespawnInfo: state.getPendingRespawnInfo,
    getGameMode: state.getGameMode,
    getPrivateRoomPhase: state.getPrivateRoomPhase,
    getRemoteProjectileState: state.getRemoteProjectileState,
    getRemoteFireZoneState: state.getRemoteFireZoneState,
    getCurrentInputState() { return null; },
    getCurrentRotation() { return null; },
    getCurrentUser() { return null; },
    getRenderCoreWorldPosition() { return null; },
    markerPointForEntityId() { return null; },
    damagePointForEntityId() { return null; },
    getChokeVictimStateForEntity() { return null; },
    consumeNotice() { return ''; },
    throwAckQueue: [],
    throwRejectQueue: [],
    throwableEventQueue: [],
    abilityEventQueue: [],
    classCastResultQueue: [],
    damageFeedbackQueue: [],
    incomingDamageFeedbackQueue: []
  });

  const clock = JSON.parse(JSON.stringify(view.getRemotePresentationClock(1225)));
  const sample = JSON.parse(JSON.stringify(view.sampleRemoteEntityPresentation('usr_remote', 1225)));

  assert.deepEqual(clock, {
    nowMs: 1225,
    latestServerTime: 1050,
    latestReceivedAt: 1150,
    clockOffsetMs: 100,
    cadenceMs: 50,
    estimatedServerTime: 1125,
    interpolationDelayMs: 100,
    renderServerTime: 1025
  });
  assert.equal(sample.serverTime, 1025);
  assert.equal(sample.weaponId, 'shotgun');
  assert.equal(sample.sprinting, true);
  assert.equal(sample.movingForward, true);
  assert.ok(Math.abs(sample.x - 5) < 0.0001);
  assert.ok(Math.abs(sample.y - 2.1) < 0.0001);
  assert.ok(Math.abs(sample.z - 2.5) < 0.0001);
  assert.ok(Math.abs(sample.yaw - 0.5) < 0.0001);
  assert.ok(Math.abs(sample.pitch - 0.1) < 0.0001);
  assert.ok(Math.abs(sample.moveSpeedNorm - 0.5) < 0.0001);
  assert.ok(Math.abs(sample.velocityY - 0.25) < 0.0001);
});

test('GameNetStateView returns safe empty values when optional selectors are absent', async () => {
  const sandbox = {
    console,
    Date,
    Map,
    THREE: {
      Vector3: class Vector3 {
        copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
      }
    },
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameAbilityFx: null
      }
    }
  };

  await loadScript('../../js/net/state-view.js', sandbox);

  const view = sandbox.globalThis.__MAYHEM_RUNTIME.GameNetStateView.create({
    buildExpectedWorldMeta() {
      return {};
    }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(view.getExpectedWorldMeta())), {
    roomId: '',
    worldSeed: '',
    worldProfileVersion: 0,
    worldFlags: {}
  });
  assert.deepEqual(JSON.parse(JSON.stringify(view.getAuthoritativeThrowableState())), {
    projectiles: [],
    fireZones: [],
    selfThrowables: null
  });
  assert.equal(view.getEntityName('missing'), '');
  assert.equal(view.getRespawnState(), null);
  assert.equal(view.getGameMode(), '');
});
