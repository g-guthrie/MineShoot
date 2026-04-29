import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v) {
    this.x = Number(v && v.x || 0);
    this.y = Number(v && v.y || 0);
    this.z = Number(v && v.z || 0);
    return this;
  }
}

async function loadNetworkFactories() {
  const sandbox = {
    console,
    Date,
    Map,
    JSON,
    Math,
    Number,
    String,
    Array,
    Object,
    isFinite,
    setTimeout,
    clearTimeout,
    THREE: { Vector3 },
    __MAYHEM_RUNTIME: {}
  };
  const context = vm.createContext(sandbox);
  for (const scriptPath of [
    '../../js/net/runtime-state.js',
    '../../js/net/network-snapshot-apply.js',
    '../../js/net/message-router.js',
    '../../js/net/state-view.js'
  ]) {
    const code = await fs.readFile(new URL(scriptPath, import.meta.url), 'utf8');
    vm.runInContext(code, context);
  }
  return sandbox.__MAYHEM_RUNTIME;
}

function createNetworkHarness(runtime) {
  const netState = runtime.GameNetRuntimeState.create({
    initialRoomId: 'global',
    inputSendInterval: 1 / 60
  });
  const queues = netState.getQueueRefs();
  const renderMap = new Map();

  function cloneWorldFlags(flags) {
    return { ...(flags || {}) };
  }

  function buildExpectedWorldMeta(roomId) {
    return {
      roomId: String(roomId || 'global'),
      worldSeed: 'test-seed',
      worldProfileVersion: 1,
      worldFlags: {}
    };
  }

  const connectionTiming = {
    canAcceptSnapshotTiming() { return true; },
    updateSnapshotTiming() { return true; },
    shouldAcceptSelfSnapshot() { return true; },
    noteAcceptedSelfSnapshot(entity) {
      return { ackSeq: Math.max(0, Number(entity && entity.seq || 0)) };
    },
    connectionTimingState() {
      return { rttMs: 32, rttJitterMs: 4, snapshot: { intervalMs: 50, jitterMs: 3 } };
    },
    getLastAcceptedSelfAckAt() {
      return Date.now() - 24;
    }
  };

  const gameNetEntities = {
    getRenderMap() {
      return renderMap;
    },
    updateFromSnapshot(entity) {
      const id = String(entity && entity.id || '');
      if (!id) return;
      renderMap.set(id, {
        id,
        kind: 'player',
        username: String(entity.username || id),
        classId: String(entity.classId || 'runner'),
        hp: Number(entity.hp || 0),
        hpMax: Number(entity.hpMax || 0),
        armor: Number(entity.armor || 0),
        armorMax: Number(entity.armorMax || 0),
        alive: entity.alive !== false,
        group: {
          visible: true,
          position: new Vector3(Number(entity.x || 0), Number(entity.y || 0), Number(entity.z || 0))
        },
        bodyHitbox: { visible: true },
        headHitbox: { visible: true }
      });
    },
    removeRemoteVisual(entityId) {
      renderMap.delete(String(entityId || ''));
    }
  };

  function applySnapshot(entities, projectiles, fireZones, opts) {
    return runtime.GameNetNetworkSnapshotApply.applySnapshot({
      sceneRef: {},
      netState,
      connectionTiming,
      joinState: { resolveJoinOnSelfSnapshot() {} },
      GameNetEntities: gameNetEntities,
      remoteReceiveJitterBufferEnabled: false,
      snapshotDeltaCompressionEnabled: false,
      pendingSelfWeaponLoadout(entity) { return entity; },
      translateSelfEntryState(entity) { return entity; }
    }, entities, projectiles, fireZones, opts);
  }

  const router = runtime.GameNetMessageRouter.create({
    msgTypes: { WELCOME: 'welcome', SNAPSHOT: 'snapshot' },
    sanitizeRoomId(value) { return String(value || '').toLowerCase(); },
    buildExpectedWorldMeta,
    cloneWorldFlags,
    applySnapshot,
    pushNotice: netState.pushNotice,
    flushPendingWeaponLoadout() {},
    resolveJoinOnWelcome() {},
    damagePointForEntityId() { return null; },
    getRenderMap: gameNetEntities.getRenderMap,
    setRemoteAliveState(entityId, alive) {
      const render = renderMap.get(String(entityId || ''));
      if (!render) return false;
      render.alive = !!alive;
      return true;
    },
    getSelfId: netState.getSelfId,
    setSelfId: netState.setSelfId,
    getRoomId: netState.getRoomId,
    setRoomId: netState.setRoomId,
    getGameMode: netState.getGameMode,
    setGameMode: netState.setGameMode,
    getPrivateRoomPhase: netState.getPrivateRoomPhase,
    setPrivateRoomPhase: netState.setPrivateRoomPhase,
    getMatchState: netState.getMatchState,
    setMatchState: netState.setMatchState,
    setInputSendInterval: netState.setInputSendInterval,
    getSelfState: netState.getSelfState,
    setConnected() {},
    setPendingRespawnInfo: netState.setPendingRespawnInfo,
    setPendingSpawnSync: netState.setPendingSpawnSync,
    setWorldMeta: netState.setWorldMeta,
    getWorldMismatchNotified: netState.getWorldMismatchNotified,
    setWorldMismatchNotified: netState.setWorldMismatchNotified,
    getActiveWorldMeta() { return null; },
    throwAckQueue: queues.throwAckQueue,
    throwRejectQueue: queues.throwRejectQueue,
    throwableEventQueue: queues.throwableEventQueue,
    shotEffectQueue: queues.shotEffectQueue,
    shotRejectQueue: queues.shotRejectQueue,
    damageFeedbackQueue: queues.damageFeedbackQueue,
    incomingDamageFeedbackQueue: queues.incomingDamageFeedbackQueue
  });

  const stateView = runtime.GameNetStateView.create({
    buildExpectedWorldMeta,
    cloneWorldFlags,
    classStats() { return { armorMax: 100, wallhackRadius: 0 }; },
    getRoomId: netState.getRoomId,
    getWorldMeta: netState.getWorldMeta,
    getRenderMap: gameNetEntities.getRenderMap,
    getSelfState: netState.getSelfState,
    getSelfId: netState.getSelfId,
    getMatchState: netState.getMatchState,
    getSnapshotMap: netState.getSnapshotMap,
    getInputSeqHistory: netState.getInputSeqHistory,
    getLastInputSeqSent: netState.getLastInputSeqSent,
    getLastInputSeqAcked: netState.getLastInputSeqAcked,
    getLastSentInputSample: netState.getLastSentInputSample,
    getInputSendTimer: netState.getInputSendTimer,
    getInputSendInterval: netState.getInputSendInterval,
    getPendingRespawnInfo: netState.getPendingRespawnInfo,
    getGameMode: netState.getGameMode,
    getPrivateRoomPhase: netState.getPrivateRoomPhase,
    getRemoteSnapshotTiming: netState.getRemoteSnapshotTiming,
    getRemoteSnapshotTimeline: netState.getRemoteSnapshotTimeline,
    getRemoteProjectileState: netState.getRemoteProjectileState,
    getRemoteFireZoneState: netState.getRemoteFireZoneState,
    getConnectionTimingState: connectionTiming.connectionTimingState,
    getLastAcceptedSelfAckAt: connectionTiming.getLastAcceptedSelfAckAt,
    getCurrentInputState() {
      return { forward: true, backward: false, left: false, right: false, jump: false, sprint: true, adsActive: false };
    },
    getCurrentRotation() {
      return { yaw: 0.2, pitch: -0.05 };
    },
    getCurrentUser() {
      return { id: 'usr_self', classId: 'runner' };
    },
    getRenderCoreWorldPosition(render, out) {
      return out.copy(render.group.position);
    },
    getSharedApi() {
      return {
        authoritativeReconciliation: {
          buildAuthoritativeMotionRevision(state) {
            return `${state.id}:${state.seq}`;
          }
        }
      };
    },
    throwAckQueue: queues.throwAckQueue,
    throwRejectQueue: queues.throwRejectQueue,
    throwableEventQueue: queues.throwableEventQueue,
    shotEffectQueue: queues.shotEffectQueue,
    shotRejectQueue: queues.shotRejectQueue,
    damageFeedbackQueue: queues.damageFeedbackQueue,
    incomingDamageFeedbackQueue: queues.incomingDamageFeedbackQueue
  });

  return { netState, router, stateView, renderMap };
}

test('message router snapshots feed the state view selectors used by gameplay', async () => {
  const runtime = await loadNetworkFactories();
  const harness = createNetworkHarness(runtime);

  harness.router.handleMessage(JSON.stringify({
    t: 'welcome',
    selfId: 'usr_self',
    roomId: 'FFA-ROOM',
    gameMode: 'ffa',
    inputSendHz: 60,
    matchState: { mode: 'ffa', targetScore: 10, started: true },
    worldSeed: 'test-seed',
    worldProfileVersion: 1,
    worldFlags: {}
  }));

  harness.netState.setLastInputSeqSent(13);
  harness.netState.setLastSentInputSample({
    seq: 13,
    at: Date.now() - 8,
    yaw: 0.1,
    pitch: -0.05,
    weaponId: 'rifle',
    inputState: { forward: true, sprint: true }
  });
  harness.netState.setInputSeqHistory([
    {
      seq: 13,
      at: Date.now() - 8,
      dtMs: 16,
      yaw: 0.1,
      pitch: -0.05,
      weaponId: 'rifle',
      inputState: { forward: true, sprint: true }
    }
  ]);

  harness.router.handleMessage(JSON.stringify({
    t: 'snapshot',
    snapshotSeq: 7,
    serverTime: 1000,
    gameMode: 'ffa',
    matchState: { mode: 'ffa', targetScore: 10, leaderId: 'usr_self', started: true },
    entities: [
      {
        id: 'usr_self',
        seq: 12,
        username: 'Self',
        x: 1,
        y: 1.6,
        z: 2,
        hp: 400,
        hpMax: 400,
        armor: 0,
        armorMax: 100,
        alive: true,
        weaponId: 'rifle'
      },
      {
        id: 'enemy_one',
        username: 'Enemy',
        classId: 'runner',
        x: 6,
        y: 1.6,
        z: -4,
        hp: 260,
        hpMax: 400,
        armor: 40,
        armorMax: 100,
        alive: true,
        weaponId: 'shotgun'
      }
    ],
    projectiles: [{ id: 'proj_one' }],
    fireZones: [{ id: 'zone_one' }]
  }));

  const matchState = harness.stateView.getMatchState();
  assert.deepEqual(matchState, { mode: 'ffa', targetScore: 10, leaderId: 'usr_self', started: true });
  matchState.leaderId = 'mutated';
  assert.equal(harness.stateView.getMatchState().leaderId, 'usr_self');

  const selfState = harness.stateView.getAuthoritativeSelfState();
  assert.equal(selfState.id, 'usr_self');
  assert.equal(selfState.seq, 12);

  const reconciliationState = harness.stateView.getSelfReconciliationState();
  assert.equal(reconciliationState.acceptedSelfSeq, 12);
  assert.equal(reconciliationState.lastAckedSeq, 12);
  assert.equal(reconciliationState.pendingInputCount, 1);
  assert.equal(reconciliationState.pendingInputs[0].seq, 13);
  assert.equal(reconciliationState.authoritativeMotionRevision, 'usr_self:12');

  const entityStates = harness.stateView.getEntityStateList();
  assert.equal(entityStates.length, 1);
  assert.equal(entityStates[0].id, 'enemy_one');
  assert.equal(entityStates[0].targetId, 'net:enemy_one');
  assert.equal(entityStates[0].hp, 260);

  const lockTargets = harness.stateView.getLockTargets();
  assert.equal(lockTargets.length, 1);
  assert.equal(lockTargets[0].targetId, 'net:enemy_one');
  assert.equal(lockTargets[0].worldPos.x, 6);
  assert.equal(lockTargets[0].bodyHitbox.visible, true);

  assert.deepEqual(JSON.parse(JSON.stringify(harness.stateView.getAuthoritativeThrowableState())), {
    projectiles: [{ id: 'proj_one' }],
    fireZones: [{ id: 'zone_one' }],
    selfThrowables: null
  });
});
