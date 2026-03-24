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
  assert.ok(replayed.z < -1.12 && replayed.z > -1.13);
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
