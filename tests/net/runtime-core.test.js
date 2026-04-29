import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadRuntimeCoreFactory() {
  const sandbox = {
    console,
    Date,
    Map,
    WebSocket: function WebSocket() {}
  };
  sandbox.WebSocket.OPEN = 1;
  sandbox.globalThis = { __MAYHEM_RUNTIME: {} };
  const context = vm.createContext(sandbox);
  const code = await fs.readFile(new URL('../../js/net/runtime-core.js', import.meta.url), 'utf8');
  vm.runInContext(code, context);
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameNetRuntimeCore;
}

test('runtime core sends redundant input tails plus snapshot ack and link metrics', async () => {
  const GameNetRuntimeCore = await loadRuntimeCoreFactory();
  const sentMessages = [];
  const inputHistory = [
    {
      seq: 1,
      at: 10,
      dtMs: 16,
      yaw: 0.1,
      pitch: 0.01,
      weaponId: 'rifle',
      inputState: { forward: true }
    },
    {
      seq: 2,
      at: 26,
      dtMs: 16,
      yaw: 0.2,
      pitch: 0.02,
      weaponId: 'rifle',
      inputState: { forward: true, left: true }
    },
    {
      seq: 3,
      at: 42,
      dtMs: 16,
      yaw: 0.3,
      pitch: 0.03,
      weaponId: 'rifle',
      inputState: { forward: true, sprint: true }
    }
  ];
  let inputSendTimer = 0;
  let pingSendTimer = 0;
  let lastSentSeq = 0;
  let lastSentInputSample = inputHistory[inputHistory.length - 1];
  const socket = {
    readyState: 1,
    send(raw) {
      sentMessages.push(JSON.parse(raw));
    }
  };

  const core = GameNetRuntimeCore.create({
    isActive: () => true,
    getTransport: () => null,
    setTransport() {},
    getReconnectTimer: () => null,
    setReconnectTimer() {},
    getWs: () => socket,
    setWs() {},
    setConnected() {},
    getSocketIdentity: () => ({ id: 'usr_test' }),
    nextConnectAttemptSeq: () => 1,
    getConnectAttemptSeq: () => 1,
    wsEndpoint: () => 'ws://localhost',
    handleMessage() {},
    ensureArenaIdentity: () => null,
    applyPendingSpawnSync() {},
    getPendingRespawnInfo: () => null,
    setPendingRespawnInfo() {},
    setPendingSpawnSync() {},
    getConnectionTimingState: () => ({ rttMs: 88, rttJitterMs: 14 }),
    getSnapshotAckSeq: () => 12,
    toLocalClockTime: (value) => value,
    isConnected: () => true,
    getInputSendTimer: () => inputSendTimer,
    setInputSendTimer(value) { inputSendTimer = Number(value || 0); },
    getInputSendInterval: () => 1 / 30,
    getLastSentInputSample: () => lastSentInputSample,
    setLastSentInputSample(value) { lastSentInputSample = value; },
    getPingSendTimer: () => pingSendTimer,
    setPingSendTimer(value) { pingSendTimer = Number(value || 0); },
    getPingCadenceSeconds: () => 0.5,
    getPingMessageType: () => 'ping',
    getPlayerApi: () => ({
      getAnimNetState: () => ({ equippedWeaponId: 'rifle' }),
      getNetworkInputState: () => ({ forward: true, sprint: true }),
      isMovementLocked: () => false
    }),
    nextInputSeq: () => 4,
    getInputSeqHistory: () => inputHistory,
    setLastInputSeqSent(value) { lastSentSeq = Number(value || 0); },
    getInputMessageType: () => 'input',
    getRemoteSyncApi: () => null,
    getRenderMap: () => new Map()
  });

  core.update(0.016, { x: 0, y: 0, z: 0 }, { yaw: 0.4, pitch: 0.05 });

  const inputMessage = sentMessages.find((message) => message.t === 'input');
  const pingMessage = sentMessages.find((message) => message.t === 'ping');
  assert.ok(inputMessage);
  assert.ok(pingMessage);
  assert.equal(lastSentSeq, 4);
  assert.equal(inputMessage.snapshotAckSeq, 12);
  assert.equal(inputMessage.linkRttMs, 88);
  assert.equal(inputMessage.linkJitterMs, 14);
  assert.equal(Array.isArray(inputMessage.inputs), true);
  assert.equal(inputMessage.inputs.length, 4);
  assert.deepEqual(inputMessage.inputs.map((sample) => sample.seq), [1, 2, 3, 4]);
  assert.equal(pingMessage.snapshotAckSeq, 12);
  assert.equal(pingMessage.linkRttMs, 88);
  assert.equal(pingMessage.linkJitterMs, 14);
});

test('runtime core forces a send after cumulative tiny movement and yaw drift', async () => {
  const GameNetRuntimeCore = await loadRuntimeCoreFactory();
  const sentMessages = [];
  const inputHistory = [];
  let inputSendTimer = 1;
  let pingSendTimer = 1;
  let nextSeq = 1;
  let lastSentInputSample = null;
  let positionDriftWu = 0;
  let yawDriftRad = 0;
  const socket = {
    readyState: 1,
    send(raw) {
      sentMessages.push(JSON.parse(raw));
    }
  };

  const core = GameNetRuntimeCore.create({
    isActive: () => true,
    getTransport: () => null,
    setTransport() {},
    getReconnectTimer: () => null,
    setReconnectTimer() {},
    getWs: () => socket,
    setWs() {},
    setConnected() {},
    getSocketIdentity: () => ({ id: 'usr_test' }),
    nextConnectAttemptSeq: () => 1,
    getConnectAttemptSeq: () => 1,
    wsEndpoint: () => 'ws://localhost',
    handleMessage() {},
    ensureArenaIdentity: () => null,
    applyPendingSpawnSync() { return false; },
    getPendingRespawnInfo: () => null,
    setPendingRespawnInfo() {},
    setPendingSpawnSync() {},
    getConnectionTimingState: () => ({ rttMs: 0, rttJitterMs: 0 }),
    getSnapshotAckSeq: () => 0,
    toLocalClockTime: (value) => value,
    isConnected: () => true,
    getInputSendTimer: () => inputSendTimer,
    setInputSendTimer(value) { inputSendTimer = Number(value || 0); },
    getInputSendInterval: () => 1 / 30,
    getLastSentInputSample: () => lastSentInputSample,
    setLastSentInputSample(value) { lastSentInputSample = value; },
    getAccumulatedPositionDriftWu: () => positionDriftWu,
    getAccumulatedYawDriftRad: () => yawDriftRad,
    updateInputDriftTracking(position, yaw) {
      if (position && typeof position === 'object') {
        positionDriftWu += Math.abs(Number(position.x || 0)) * 0.2;
      }
      yawDriftRad += Math.abs(Number(yaw || 0)) * 0.2;
      return { positionDriftWu, yawDriftRad };
    },
    resetInputDriftTracking() {
      positionDriftWu = 0;
      yawDriftRad = 0;
      return { positionDriftWu, yawDriftRad };
    },
    getPingSendTimer: () => pingSendTimer,
    setPingSendTimer(value) { pingSendTimer = Number(value || 0); },
    getPingCadenceSeconds: () => 99,
    getPingMessageType: () => 'ping',
    getPlayerApi: () => ({
      getAnimNetState: () => ({ equippedWeaponId: 'rifle' }),
      getNetworkInputState: () => ({ forward: false }),
      isMovementLocked: () => false
    }),
    nextInputSeq: () => nextSeq++,
    getInputSeqHistory: () => inputHistory,
    setLastInputSeqSent() {},
    getInputMessageType: () => 'input',
    getRemoteSyncApi: () => null,
    getRenderMap: () => new Map()
  });

  core.update(0.016, { x: 0.08, y: 0, z: 0 }, { yaw: 0.02, pitch: 0 });
  core.update(0.016, { x: 0.08, y: 0, z: 0 }, { yaw: 0.02, pitch: 0 });
  core.update(0.016, { x: 0.08, y: 0, z: 0 }, { yaw: 0.02, pitch: 0 });
  core.update(0.016, { x: 0.08, y: 0, z: 0 }, { yaw: 0.02, pitch: 0 });

  const inputMessage = sentMessages.find((message) => message.t === 'input');
  assert.ok(inputMessage);
  assert.equal(positionDriftWu, 0);
  assert.equal(yawDriftRad, 0);
});

test('runtime core rate-limits look-only immediate sends on high-refresh frames', async () => {
  const GameNetRuntimeCore = await loadRuntimeCoreFactory();
  const sentMessages = [];
  const inputHistory = [];
  let inputSendTimer = 1 / 60;
  let pingSendTimer = 99;
  let nextSeq = 2;
  let lastSentSeq = 0;
  let lastSentInputSample = {
    seq: 1,
    at: 1000,
    dtMs: 16,
    yaw: 0,
    pitch: 0,
    weaponId: 'rifle',
    inputState: { forward: true }
  };
  const socket = {
    readyState: 1,
    send(raw) {
      sentMessages.push(JSON.parse(raw));
    }
  };

  const core = GameNetRuntimeCore.create({
    isActive: () => true,
    getTransport: () => null,
    setTransport() {},
    getReconnectTimer: () => null,
    setReconnectTimer() {},
    getWs: () => socket,
    setWs() {},
    setConnected() {},
    getSocketIdentity: () => ({ id: 'usr_test' }),
    nextConnectAttemptSeq: () => 1,
    getConnectAttemptSeq: () => 1,
    wsEndpoint: () => 'ws://localhost',
    handleMessage() {},
    ensureArenaIdentity: () => null,
    applyPendingSpawnSync() { return false; },
    getPendingRespawnInfo: () => null,
    setPendingRespawnInfo() {},
    setPendingSpawnSync() {},
    getConnectionTimingState: () => ({ rttMs: 0, rttJitterMs: 0 }),
    getSnapshotAckSeq: () => 0,
    toLocalClockTime: (value) => value,
    isConnected: () => true,
    getInputSendTimer: () => inputSendTimer,
    setInputSendTimer(value) { inputSendTimer = Number(value || 0); },
    getInputSendInterval: () => 1 / 60,
    getLastSentInputSample: () => lastSentInputSample,
    setLastSentInputSample(value) { lastSentInputSample = value; },
    getAccumulatedPositionDriftWu: () => 0,
    getAccumulatedYawDriftRad: () => 0,
    updateInputDriftTracking() {},
    resetInputDriftTracking() {},
    getPingSendTimer: () => pingSendTimer,
    setPingSendTimer(value) { pingSendTimer = Number(value || 0); },
    getPingCadenceSeconds: () => 99,
    getPingMessageType: () => 'ping',
    getPlayerApi: () => ({
      getAnimNetState: () => ({ equippedWeaponId: 'rifle' }),
      getNetworkInputState: () => ({ forward: true }),
      isMovementLocked: () => false
    }),
    nextInputSeq: () => nextSeq++,
    getInputSeqHistory: () => inputHistory,
    setLastInputSeqSent(value) { lastSentSeq = Number(value || 0); },
    getInputMessageType: () => 'input',
    getRemoteSyncApi: () => null,
    getRenderMap: () => new Map()
  });

  core.update(1 / 240, { x: 0, y: 0, z: 0 }, { yaw: 0.01, pitch: 0 });
  core.update(1 / 240, { x: 0, y: 0, z: 0 }, { yaw: 0.02, pitch: 0 });
  core.update(1 / 240, { x: 0, y: 0, z: 0 }, { yaw: 0.03, pitch: 0 });
  core.update(1 / 240, { x: 0, y: 0, z: 0 }, { yaw: 0.04, pitch: 0 });

  assert.equal(sentMessages.filter((message) => message.t === 'input').length, 2);
  assert.equal(lastSentSeq, 3);
});
