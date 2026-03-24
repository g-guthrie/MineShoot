import test from 'node:test';
import assert from 'node:assert/strict';

await import('../../js/actors/boxman-rig.js');

const boxmanRig = globalThis.__MAYHEM_RUNTIME.GameBoxmanRig;

test('boxman reverses locomotion playback for backward run and sprint clips', () => {
  const runPlayback = boxmanRig._test.resolveClipPlayback({
    movingForward: false,
    movingBackward: true
  }, 'run');
  const sprintPlayback = boxmanRig._test.resolveClipPlayback({
    movingForward: false,
    movingBackward: true
  }, 'sprint');

  assert.equal(runPlayback.reverse, true);
  assert.equal(runPlayback.timeScale, -1);
  assert.equal(sprintPlayback.reverse, true);
  assert.equal(sprintPlayback.timeScale, -1);
});

test('boxman keeps forward playback for non-backpedal states', () => {
  const forwardRun = boxmanRig._test.resolveClipPlayback({
    movingForward: true,
    movingBackward: false
  }, 'run');
  const strafeRun = boxmanRig._test.resolveClipPlayback({
    movingForward: false,
    movingBackward: false,
    movingLeft: true
  }, 'run');
  const jumpClip = boxmanRig._test.resolveClipPlayback({
    movingForward: false,
    movingBackward: true
  }, 'jump_running');

  assert.equal(forwardRun.reverse, false);
  assert.equal(forwardRun.timeScale, 1);
  assert.equal(strafeRun.reverse, false);
  assert.equal(strafeRun.timeScale, 1);
  assert.equal(jumpClip.reverse, false);
  assert.equal(jumpClip.timeScale, 1);
});

test('boxman skips the crouch lead-in on jump clips because gameplay is already airborne', () => {
  assert.equal(boxmanRig._test.clipStartFraction('jump_idle'), 0.24);
  assert.equal(boxmanRig._test.clipStartFraction('jump_running'), 0.24);
  assert.equal(boxmanRig._test.clipStartFraction('run'), 0);
});

test('boxman skips the built-in side start clips for pure strafes', () => {
  assert.equal(boxmanRig._test.movementStartClip({
    movingLeft: true,
    movingForward: false,
    movingBackward: false,
    movingRight: false
  }), '');
  assert.equal(boxmanRig._test.movementStartClip({
    movingRight: true,
    movingForward: false,
    movingBackward: false,
    movingLeft: false
  }), '');
});
