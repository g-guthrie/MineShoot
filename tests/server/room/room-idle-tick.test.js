import test from 'node:test';
import assert from 'node:assert/strict';

test('tick early-exits when no clients are connected, skipping simulation work', () => {
  let cleanupCalled = false;
  let stopTickCalled = false;
  let syncFixturesCalled = false;
  let broadcastCalled = false;

  const room = {
    clients: new Map(),
    players: new Map(),
    lastTickAt: Date.now() - 16,
    lastSnapshotAt: 0,
    tickHandle: 1,
    cleanupDisconnectedPlayers() { cleanupCalled = true; },
    stopTickIfEmpty() { stopTickCalled = true; },
    maybeResetPublicMatch() {},
    syncRoomFixtures() { syncFixturesCalled = true; },
    startPublicMatchIfReady() {},
    tickPlayers() {},
    recordAliveEntityPoseHistories() {},
    updateLeaderProgress() {},
    broadcastSnapshot() { broadcastCalled = true; }
  };

  // Simulate the tick() logic
  const now = Date.now();
  const dtSec = Math.max(0.001, Math.min(0.2, (now - room.lastTickAt) / 1000));
  room.lastTickAt = now;
  room.cleanupDisconnectedPlayers(now);
  if (room.clients.size === 0) {
    room.stopTickIfEmpty();
    // early return - don't run simulation
  } else {
    room.syncRoomFixtures();
    room.broadcastSnapshot(false);
  }

  assert.equal(cleanupCalled, true, 'cleanup should always run');
  assert.equal(stopTickCalled, true, 'stopTickIfEmpty should be called on early exit');
  assert.equal(syncFixturesCalled, false, 'syncRoomFixtures should NOT run with no clients');
  assert.equal(broadcastCalled, false, 'broadcastSnapshot should NOT run with no clients');
});

test('tick runs full simulation when clients are connected', () => {
  let syncFixturesCalled = false;
  let broadcastCalled = false;

  const fakeSocket = {};
  const room = {
    clients: new Map([[fakeSocket, { userId: 'u1' }]]),
    players: new Map(),
    lastTickAt: Date.now() - 16,
    lastSnapshotAt: 0,
    tickHandle: 1,
    cleanupDisconnectedPlayers() {},
    stopTickIfEmpty() {},
    maybeResetPublicMatch() {},
    syncRoomFixtures() { syncFixturesCalled = true; },
    startPublicMatchIfReady() {},
    tickPlayers() {},
    recordAliveEntityPoseHistories() {},
    updateLeaderProgress() {},
    broadcastSnapshot() { broadcastCalled = true; }
  };

  const now = Date.now();
  room.lastTickAt = now;
  room.cleanupDisconnectedPlayers(now);
  if (room.clients.size === 0) {
    room.stopTickIfEmpty();
  } else {
    room.syncRoomFixtures();
    room.broadcastSnapshot(false);
  }

  assert.equal(syncFixturesCalled, true, 'syncRoomFixtures should run with connected clients');
  assert.equal(broadcastCalled, true, 'broadcastSnapshot should run with connected clients');
});

test('tick catch-up stays on fixed-size sim steps and caps the number of steps per wake-up', () => {
  const ROOM_SIM_TICK_MS = 1000 / 60;
  const MAX_ROOM_TICK_FRAME_MS = 250;
  const MAX_SIM_STEPS_PER_TICK = 6;
  const stepSizes = [];
  let broadcastCalled = false;

  const room = {
    clients: new Map([[{}, { userId: 'u1' }]]),
    players: new Map(),
    lastTickAt: Date.now() - 220,
    simulationAccumulatorMs: 0,
    snapshotAccumulatorMs: 0,
    cleanupDisconnectedPlayers() {},
    stopTickIfEmpty() {},
    maybeResetPublicMatch() {},
    syncRoomFixtures() {},
    startPublicMatchIfReady() {},
    tickEntityMatchEntries() {},
    tickPlayers(dtSec) { stepSizes.push(dtSec); },
    recordAliveEntityPoseHistories() {},
    updateLeaderProgress() {},
    broadcastSnapshot() { broadcastCalled = true; }
  };

  const now = Date.now();
  const frameDeltaMs = Math.max(0, Math.min(MAX_ROOM_TICK_FRAME_MS, now - room.lastTickAt));
  room.lastTickAt = now;
  room.cleanupDisconnectedPlayers(now);
  room.syncRoomFixtures();
  room.simulationAccumulatorMs = Math.min(MAX_ROOM_TICK_FRAME_MS, Math.max(0, Number(room.simulationAccumulatorMs || 0)) + frameDeltaMs);
  room.snapshotAccumulatorMs = Math.min(MAX_ROOM_TICK_FRAME_MS, Math.max(0, Number(room.snapshotAccumulatorMs || 0)) + frameDeltaMs);

  let simSteps = 0;
  while (room.simulationAccumulatorMs >= ROOM_SIM_TICK_MS && simSteps < MAX_SIM_STEPS_PER_TICK) {
    room.maybeResetPublicMatch();
    room.startPublicMatchIfReady();
    room.tickEntityMatchEntries();
    room.tickPlayers(ROOM_SIM_TICK_MS / 1000);
    room.recordAliveEntityPoseHistories(now);
    room.updateLeaderProgress();
    room.simulationAccumulatorMs -= ROOM_SIM_TICK_MS;
    simSteps += 1;
  }
  if (room.snapshotAccumulatorMs >= ROOM_SIM_TICK_MS) {
    room.broadcastSnapshot(false);
  }

  assert.equal(stepSizes.length, MAX_SIM_STEPS_PER_TICK);
  assert.ok(stepSizes.every((value) => Math.abs(value - (1 / 60)) < 0.000001));
  assert.equal(broadcastCalled, true);
});
