import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyStrafePose,
  createStrafeState,
  isPureStrafe,
  readPureStrafeDirection,
  updateStrafeState
} from '../../js/actors/boxman-strafe.js';

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

test('pure strafe direction only activates on straight grounded left or right movement', () => {
  assert.equal(readPureStrafeDirection({ movingLeft: true }), -1);
  assert.equal(readPureStrafeDirection({ movingRight: true }), 1);
  assert.equal(isPureStrafe({ movingLeft: true }), true);
  assert.equal(isPureStrafe({ movingRight: true }), true);
  assert.equal(readPureStrafeDirection({ movingLeft: true, movingForward: true }), 0);
  assert.equal(readPureStrafeDirection({ movingLeft: true, movingRight: true }), 0);
  assert.equal(readPureStrafeDirection({ movingRight: true, airborne: true }), 0);
});

test('strafe state blends in when the direction changes and then settles', () => {
  const state = createStrafeState();
  updateStrafeState(state, 0.016, {
    movingLeft: true,
    speedNorm: 0.5,
    sprinting: false
  });
  assert.ok(state.active);
  assert.equal(state.direction, -1);
  assert.ok(state.startRemaining > 0);

  updateStrafeState(state, 0.3, {
    movingLeft: true,
    speedNorm: 0.5,
    sprinting: false
  });
  assert.equal(state.startRemaining, 0);

  updateStrafeState(state, 0.016, {
    movingRight: true,
    speedNorm: 0.5,
    sprinting: false
  });
  assert.equal(state.direction, 1);
  assert.ok(state.startRemaining > 0);
});

test('strafe pose mirrors left and right body lean so each side has its own read', () => {
  const leftState = createStrafeState();
  updateStrafeState(leftState, 0.2, {
    movingLeft: true,
    speedNorm: 0.6,
    sprinting: false
  });
  const leftRig = makeRig();
  applyStrafePose(leftRig, leftState, {
    movingLeft: true,
    speedNorm: 0.6,
    sprinting: false
  });

  const rightState = createStrafeState();
  updateStrafeState(rightState, 0.2, {
    movingRight: true,
    speedNorm: 0.6,
    sprinting: false
  });
  const rightRig = makeRig();
  applyStrafePose(rightRig, rightState, {
    movingRight: true,
    speedNorm: 0.6,
    sprinting: false
  });

  assert.ok(leftRig.bodyUpper.rotation.z < 0);
  assert.ok(rightRig.bodyUpper.rotation.z > 0);
  assert.ok(leftRig.legUpperL.rotation.z < 0);
  assert.ok(leftRig.legUpperR.rotation.z > 0);
  assert.ok(rightRig.legUpperL.rotation.z < 0);
  assert.ok(rightRig.legUpperR.rotation.z > 0);
  assert.ok(leftRig.legLowerL.rotation.x > 0.2);
  assert.ok(rightRig.legLowerL.rotation.x > 0.2);
  assert.ok(leftRig.legUpperL.rotation.x < 0);
  assert.ok(rightRig.legUpperL.rotation.x < 0);
});
