import test from 'node:test';
import assert from 'node:assert/strict';

import { createMovementInputState } from '../../shared/authoritative-movement.js';
import {
  buildMotionStateFromSnapshot,
  buildReplayStepsFromPendingInputs,
  replayMotionState,
  shouldReplayAuthoritativeCorrection
} from '../../shared/authoritative-reconciliation.js';
import { consumeQueuedAuthoritativeInputs } from '../../cloudflare/server/room/RoomRuntime.js';

function flatGround() {
  return 0;
}

test('reconciliation snapshot builder falls back to ground height when y is absent', () => {
  const state = buildMotionStateFromSnapshot({ x: 3, z: -2 }, {
    getGroundHeightAt: () => 4
  });

  assert.equal(state.x, 3);
  assert.equal(state.z, -2);
  assert.equal(state.y, 5.6);
});

test('replay motion defaults to the bounded pending-sample duration budget', () => {
  const input = createMovementInputState();
  input.forward = true;

  const replayed = replayMotionState(
    { x: 0, y: 1.6, z: 0, yaw: 0, isGrounded: true },
    [
      { dtMs: 50, yaw: 0, pitch: 0, inputState: input },
      { dtMs: 100, yaw: 0, pitch: 0, inputState: input }
    ],
    {
      bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
      collisionBoxes: [],
      getGroundHeightAt: flatGround,
      movementLocked: false
    }
  );

  assert.equal(replayed.x, 0);
  assert.ok(replayed.z < -0.87 && replayed.z > -0.88);
});

test('replay applies the server slow time scaling through stepDtScale', () => {
  const input = createMovementInputState();
  input.forward = true;
  const samples = [
    { dtMs: 50, yaw: 0, pitch: 0, inputState: input },
    { dtMs: 100, yaw: 0, pitch: 0, inputState: input }
  ];
  const replayOptions = {
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  };

  const fullSpeed = replayMotionState({ x: 0, y: 1.6, z: 0, yaw: 0, isGrounded: true }, samples, replayOptions);
  const slowed = replayMotionState({ x: 0, y: 1.6, z: 0, yaw: 0, isGrounded: true }, samples, {
    ...replayOptions,
    stepDtScale: 0.5
  });

  // Slowed replay must cover meaningfully less ground than the full-speed
  // replay (not exactly half due to per-step acceleration ramp).
  assert.ok(Math.abs(slowed.z) < Math.abs(fullSpeed.z) * 0.75);
  assert.ok(Math.abs(slowed.z) > 0);
});

test('server slow scaling stays applied when a forced backlog drain replays real sample durations', () => {
  const input = createMovementInputState();
  input.forward = true;
  const mkQueue = () => Array.from({ length: 6 }, (_, i) => ({
    seq: i + 1,
    dtMs: 16,
    yaw: 0,
    pitch: 0,
    inputState: { ...input }
  }));

  const fullSpeed = consumeQueuedAuthoritativeInputs(
    { yaw: 0, pitch: 0, inputState: createMovementInputState(), inputQueue: mkQueue() },
    0.016,
    { createMovementInputState }
  );
  const slowed = consumeQueuedAuthoritativeInputs(
    { yaw: 0, pitch: 0, inputState: createMovementInputState(), inputQueue: mkQueue() },
    0.016 * 0.5,
    { createMovementInputState, sampleDtScale: 0.5 }
  );

  const totalDt = (plan) => plan.steps.reduce((sum, step) => sum + Number(step.dtSec || 0), 0);
  assert.ok(totalDt(fullSpeed) > 0);
  assert.ok(Math.abs(totalDt(slowed) - (totalDt(fullSpeed) * 0.5)) < 0.0005);
});

test('replay step building matches the live server weighting model when both use the same total dt', () => {
  const input = createMovementInputState();
  input.forward = true;
  const samples = [
    { seq: 1, dtMs: 50, yaw: 0, pitch: 0, inputState: input },
    { seq: 2, dtMs: 100, yaw: 0, pitch: 0, inputState: input }
  ];

  const replayPlan = buildReplayStepsFromPendingInputs(samples, {
    createMovementInputState
  });
  const serverPlan = consumeQueuedAuthoritativeInputs({
    yaw: 0,
    pitch: 0,
    inputState: createMovementInputState(),
    inputQueue: samples.map((sample) => ({
      ...sample,
      inputState: { ...sample.inputState }
    }))
  }, replayPlan.totalWeightSec, { createMovementInputState });

  assert.deepEqual(serverPlan.steps, replayPlan.steps);
  assert.equal(serverPlan.processedSeq, replayPlan.processedSeq);
});

test('replay motion carries jump state across pending samples', () => {
  const jumpInput = createMovementInputState();
  jumpInput.jump = true;

  const replayed = replayMotionState(
    { x: 0, y: 1.6, z: 0, yaw: 0, isGrounded: true, velocityY: 0, jumpHoldTimer: 0, jumpHeldLast: false },
    [
      { dtMs: 50, yaw: 0, pitch: 0, inputState: jumpInput },
      { dtMs: 50, yaw: 0, pitch: 0, inputState: jumpInput }
    ],
    {
      bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
      collisionBoxes: [],
      getGroundHeightAt: flatGround,
      movementLocked: false
    }
  );

  assert.ok(replayed.y > 2.0);
  assert.equal(replayed.isGrounded, false);
  assert.ok(replayed.velocityY > 0);
});

test('replay snapshot builder restores airborne sprint carry from airborne sprinting snapshots', () => {
  const state = buildMotionStateFromSnapshot({
    x: 0,
    y: 2.4,
    z: 0,
    yaw: 0,
    isGrounded: false,
    sprinting: true
  });

  assert.equal(state.airborneSprintCarry, true);
});

test('replay correction runs for meaningful drift even when ack sequence does not advance', () => {
  assert.equal(
    shouldReplayAuthoritativeCorrection({
      pendingInputCount: 2,
      lastAckedSeq: 8,
      lastReplayAckSeq: 7,
      horizontalDistSq: 0.36,
      replayCorrectionDistance: 0.55
    }),
    true
  );
  assert.equal(
    shouldReplayAuthoritativeCorrection({
      pendingInputCount: 0,
      lastAckedSeq: 8,
      lastReplayAckSeq: 7,
      horizontalDistSq: 0.36,
      replayCorrectionDistance: 0.55
    }),
    false
  );
  assert.equal(
    shouldReplayAuthoritativeCorrection({
      pendingInputCount: 2,
      lastAckedSeq: 8,
      lastReplayAckSeq: 8,
      horizontalDistSq: 0.36,
      replayCorrectionDistance: 0.55,
      allowReplayWithoutAckAdvance: true
    }),
    true
  );
  assert.equal(
    shouldReplayAuthoritativeCorrection({
      pendingInputCount: 2,
      lastAckedSeq: 8,
      lastReplayAckSeq: 7,
      horizontalDistSq: 0.04,
      replayCorrectionDistance: 0.55
    }),
    false
  );
  assert.equal(
    shouldReplayAuthoritativeCorrection({
      pendingInputCount: 2,
      lastAckedSeq: 8,
      lastReplayAckSeq: 7,
      horizontalDistSq: 0.36,
      replayCorrectionDistance: 0.55,
      movingIntent: true,
      canCorrectWhileMoving: false
    }),
    false
  );
  assert.equal(
    shouldReplayAuthoritativeCorrection({
      pendingInputCount: 2,
      lastAckedSeq: 8,
      lastReplayAckSeq: 7,
      horizontalDistSq: 0.36,
      replayCorrectionDistance: 0.55,
      latestPendingAgeMs: 45,
      minPendingAgeMs: 125
    }),
    false
  );
  assert.equal(
    shouldReplayAuthoritativeCorrection({
      pendingInputCount: 2,
      lastAckedSeq: 8,
      lastReplayAckSeq: 7,
      horizontalDistSq: 0.36,
      replayCorrectionDistance: 0.55,
      latestPendingAgeMs: 45,
      minPendingAgeMs: 125,
      allowFreshPendingReplay: true
    }),
    true
  );
});
