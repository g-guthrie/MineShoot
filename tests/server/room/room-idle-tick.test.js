import test from 'node:test';
import assert from 'node:assert/strict';

import {
  currentRoomNowMs,
  stopRoomTickIfEmpty,
  tickRoom
} from '../../../cloudflare/server/room/RoomTick.js';

function createTickRoom(overrides = {}) {
  const calls = {
    cleanup: 0,
    syncFixtures: 0,
    stop: 0,
    snapshots: 0,
    simSteps: []
  };
  const room = {
    clients: new Map(),
    players: new Map(),
    lastTickAt: 1000,
    simulationNowMs: 1000,
    simulationAccumulatorMs: 0,
    snapshotAccumulatorMs: 0,
    cleanupDisconnectedPlayers() { calls.cleanup += 1; },
    stopTickIfEmpty() { calls.stop += 1; },
    syncRoomFixtures() { calls.syncFixtures += 1; },
    maybeResetPublicMatch() {},
    startPublicMatchIfReady() {},
    tickEntityMatchEntries() {},
    tickPlayers(dtSec) { calls.simSteps.push(dtSec); },
    recordAliveEntityPoseHistories() {},
    currentNowMs() { return currentRoomNowMs(this, () => 0); },
    updateLeaderProgress() {},
    broadcastSnapshot() { calls.snapshots += 1; },
    ...overrides
  };
  return { calls, room };
}

test('tick early-exits when no clients are connected, skipping simulation work', () => {
  const { calls, room } = createTickRoom();

  tickRoom(room, { nowMs: () => 1020 });

  assert.equal(calls.cleanup, 1);
  assert.equal(calls.stop, 1);
  assert.equal(calls.syncFixtures, 0);
  assert.equal(calls.snapshots, 0);
  assert.deepEqual(calls.simSteps, []);
});

test('tick runs fixed simulation and snapshot work when clients are connected', () => {
  const { calls, room } = createTickRoom({
    clients: new Map([[{}, { userId: 'u1' }]])
  });

  tickRoom(room, {
    nowMs: () => 1020,
    simTickMs: 1000 / 60,
    snapshotTickMs: 1000 / 60
  });

  assert.equal(calls.syncFixtures, 1);
  assert.equal(calls.simSteps.length, 1);
  assert.equal(Math.abs(calls.simSteps[0] - (1 / 60)) < 0.000001, true);
  assert.equal(calls.snapshots, 1);
});

test('tick catch-up stays on fixed-size sim steps and caps the number of steps per wake-up', () => {
  const ROOM_SIM_TICK_MS = 1000 / 60;
  const { calls, room } = createTickRoom({
    clients: new Map([[{}, { userId: 'u1' }]])
  });

  tickRoom(room, {
    nowMs: () => 1220,
    simTickMs: ROOM_SIM_TICK_MS,
    snapshotTickMs: ROOM_SIM_TICK_MS,
    maxFrameMs: 250,
    maxSteps: 6
  });

  assert.equal(calls.simSteps.length, 6);
  assert.ok(calls.simSteps.every((value) => Math.abs(value - (1 / 60)) < 0.000001));
  assert.equal(calls.snapshots, 1);
  assert.equal(room.simulationAccumulatorMs <= ROOM_SIM_TICK_MS, true);
});

test('stopRoomTickIfEmpty keeps live human rooms running and clears sim-only rooms', () => {
  let cleared = false;
  const liveRoom = {
    clients: new Map(),
    players: new Map([['u1', { id: 'u1' }]]),
    tickHandle: 1
  };
  const simRoom = {
    clients: new Map(),
    players: new Map([['sim', { id: 'sim', fixtureType: 'sim_player' }]]),
    tickHandle: 2,
    inSimulationTick: true,
    simulationAccumulatorMs: 5,
    snapshotAccumulatorMs: 5
  };

  assert.equal(stopRoomTickIfEmpty(liveRoom, { clearInterval() { cleared = true; } }), false);
  assert.equal(cleared, false);
  assert.equal(stopRoomTickIfEmpty(simRoom, { clearInterval() { cleared = true; } }), true);
  assert.equal(cleared, true);
  assert.equal(simRoom.tickHandle, null);
  assert.equal(simRoom.inSimulationTick, false);
});

test('currentRoomNowMs uses simulation time only inside simulation ticks', () => {
  assert.equal(currentRoomNowMs({ inSimulationTick: true, simulationNowMs: 123 }, () => 456), 123);
  assert.equal(currentRoomNowMs({ inSimulationTick: false, simulationNowMs: 123 }, () => 456), 456);
});
