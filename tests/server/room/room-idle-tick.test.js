import test from 'node:test';
import assert from 'node:assert/strict';

import {
  currentRoomNowMs,
  ensureRoomTick,
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

test('tick keeps the simulation clock anchored to wall time in steady state', () => {
  const { room } = createTickRoom({
    clients: new Map([[{}, { userId: 'u1' }]])
  });

  tickRoom(room, {
    nowMs: () => 1020,
    simTickMs: 1000 / 60,
    snapshotTickMs: 1000 / 60
  });

  const accumulator = Math.max(0, Number(room.simulationAccumulatorMs || 0));
  assert.ok(Math.abs(room.simulationNowMs - (1020 - accumulator)) < 0.000001);
});

test('tick keeps the snapshot stamp on simulated-state time after clamps drop wall time', () => {
  const SIM_TICK_MS = 1000 / 60;
  const { calls, room } = createTickRoom({
    clients: new Map([[{}, { userId: 'u1' }]])
  });

  // A 1s stall: frame delta clamps to maxFrameMs and the step cap drops the
  // rest. The sim clock must stay on the time entities were actually stepped
  // to — stamping the wall-derived `now - accumulator` would mark positions
  // with a future time and clients would see a backward-velocity glitch.
  tickRoom(room, {
    nowMs: () => 2000,
    simTickMs: SIM_TICK_MS,
    snapshotTickMs: SIM_TICK_MS,
    maxFrameMs: 250,
    maxSteps: 6
  });

  const steppedMs = calls.simSteps.reduce((sum, dtSec) => sum + (dtSec * 1000), 0);
  assert.equal(calls.simSteps.length, 6);
  assert.ok(Math.abs(room.simulationNowMs - (1000 + steppedMs)) < 0.000001);
  // The clamp dropped time, so the wall-derived value would be far ahead.
  const accumulator = Math.max(0, Number(room.simulationAccumulatorMs || 0));
  assert.ok(room.simulationNowMs < (2000 - accumulator));
});

test('ensureRoomTick re-anchors a stale simulation clock when a room resumes', () => {
  const room = {
    tickHandle: null,
    simulationNowMs: 1000,
    tick() {}
  };

  ensureRoomTick(room, {
    nowMs: () => 50000,
    setInterval: () => 1
  });

  assert.equal(room.simulationNowMs, 50000);
  assert.equal(room.lastTickAt, 50000);
});
