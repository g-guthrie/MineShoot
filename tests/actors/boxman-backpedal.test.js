import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyBackpedalPose,
  createBackpedalState,
  isPureBackpedal,
  updateBackpedalState
} from '../../js/actors/boxman-backpedal.js';

function makeRig() {
  function bone() {
    return {
      rotation: { x: 0, y: 0, z: 0 }
    };
  }
  return {
    bodyUpper: bone(),
    bodyLower: bone(),
    headBone: bone(),
    armUpperL: bone(),
    armUpperR: bone(),
    legUpperL: bone(),
    legUpperR: bone(),
    legLowerL: bone(),
    legLowerR: bone()
  };
}

test('pure backpedal detection only activates on straight grounded backward movement', () => {
  assert.equal(isPureBackpedal({ movingBackward: true }), true);
  assert.equal(isPureBackpedal({ movingBackward: true, movingLeft: true }), false);
  assert.equal(isPureBackpedal({ movingBackward: true, movingForward: true }), false);
  assert.equal(isPureBackpedal({ movingBackward: true, airborne: true }), false);
});

test('backpedal state starts with a custom start window and then settles into the loop', () => {
  const state = createBackpedalState();
  updateBackpedalState(state, 0.016, {
    movingBackward: true,
    speedNorm: 0.5,
    sprinting: false
  });
  assert.ok(state.active);
  assert.ok(state.startRemaining > 0);

  updateBackpedalState(state, 0.3, {
    movingBackward: true,
    speedNorm: 0.5,
    sprinting: false
  });
  assert.equal(state.startRemaining, 0);
});

test('backpedal pose adds a backward-settle posture during the authored start', () => {
  const state = createBackpedalState();
  updateBackpedalState(state, 0.016, {
    movingBackward: true,
    speedNorm: 0.6,
    sprinting: false
  });
  const rig = makeRig();

  const applied = applyBackpedalPose(rig, state, {
    movingBackward: true,
    speedNorm: 0.6,
    sprinting: false
  });

  assert.equal(applied, true);
  assert.ok(rig.bodyUpper.rotation.x > 0);
  assert.ok(rig.bodyLower.rotation.x > 0);
  assert.ok(rig.legLowerL.rotation.x > 0);
  assert.ok(rig.legLowerR.rotation.x > 0);
});
