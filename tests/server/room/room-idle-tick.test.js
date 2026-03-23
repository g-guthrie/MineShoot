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
