import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearStopRecoveryState,
  createRigMotionState
} from '../../js/actors/boxman-rig-state.js';

test('clearStopRecoveryState cancels the stop lock and settle pose', () => {
  const motionState = createRigMotionState();
  motionState.lockName = 'stop';
  motionState.lockRemaining = 0.12;
  motionState.stopLockDuration = 0.18;
  motionState.stopSettleRemaining = 0.22;
  motionState.stopDirectionalSnapshot = { poseName: 'forward_left' };

  assert.equal(clearStopRecoveryState(motionState), true);

  assert.equal(motionState.lockName, '');
  assert.equal(motionState.lockRemaining, 0);
  assert.equal(motionState.stopLockDuration, 0);
  assert.equal(motionState.stopSettleRemaining, 0);
  assert.equal(motionState.stopDirectionalSnapshot, null);
});

test('clearStopRecoveryState ignores unrelated movement locks', () => {
  const motionState = createRigMotionState();
  motionState.lockName = 'jump_idle';
  motionState.lockRemaining = 0.12;

  assert.equal(clearStopRecoveryState(motionState), false);

  assert.equal(motionState.lockName, 'jump_idle');
  assert.equal(motionState.lockRemaining, 0.12);
});
