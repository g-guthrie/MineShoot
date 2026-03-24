import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDirectionalLocomotionPose,
  createDirectionalLocomotionState,
  resolveMoveIntent,
  updateDirectionalLocomotionState
} from '../../js/actors/boxman-directional-locomotion.js';

function bone() {
  return {
    rotation: { x: 0, y: 0, z: 0 }
  };
}

function makeRig() {
  return {
    modelRoot: {
      rotation: { y: Math.PI }
    },
    modelBaseYaw: Math.PI,
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

test('directional locomotion resolves local movement angle by camera-relative input', () => {
  const forward = resolveMoveIntent({ movingForward: true });
  const forwardRight = resolveMoveIntent({ movingForward: true, movingRight: true });
  const left = resolveMoveIntent({ movingLeft: true });
  const backLeft = resolveMoveIntent({ movingBackward: true, movingLeft: true });

  assert.equal(forward.angle, 0);
  assert.ok(Math.abs(forwardRight.angle - (Math.PI * 0.25)) < 0.000001);
  assert.ok(Math.abs(left.angle + (Math.PI * 0.5)) < 0.000001);
  assert.ok(Math.abs(backLeft.angle + (Math.PI * 0.75)) < 0.000001);
  assert.equal(left.pureStrafe, true);
  assert.equal(backLeft.diagonal, true);
});

test('directional locomotion hits the planned movement-facing targets for strafe and diagonals', () => {
  const strafeState = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(strafeState, 0.016, {
    movingLeft: true,
    speedNorm: 0.6,
    sprinting: false
  });
  const forwardDiagonalState = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(forwardDiagonalState, 0.016, {
    movingForward: true,
    movingRight: true,
    speedNorm: 0.6,
    sprinting: false
  });
  const retreatDiagonalState = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(retreatDiagonalState, 0.016, {
    movingBackward: true,
    movingRight: true,
    speedNorm: 0.6,
    sprinting: false
  });

  assert.ok(Math.abs(strafeState.targetFacingYaw - (90 * (Math.PI / 180))) < 0.000001);
  assert.ok(Math.abs(forwardDiagonalState.targetFacingYaw + (45 * (Math.PI / 180))) < 0.000001);
  assert.ok(Math.abs(retreatDiagonalState.targetFacingYaw + (30 * (Math.PI / 180))) < 0.000001);
});

test('directional locomotion uses soft idle turn entry when yaw rate is high and movement is near zero', () => {
  const state = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(state, 0.016, {
    yaw: 0,
    turnRate: 100 * (Math.PI / 180),
    speedNorm: 0,
    sprinting: false,
    airborne: false
  });

  assert.equal(state.useTurnEntryClip, true);
  assert.equal(state.turnClipDirection, 1);
});

test('directional locomotion turns the whole model toward travel and twists torso/head back toward aim', () => {
  const state = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(state, 1, {
    movingRight: true,
    speedNorm: 0.7,
    sprinting: false
  });
  const rig = makeRig();
  const applied = applyDirectionalLocomotionPose(rig, state, {
    movingRight: true,
    speedNorm: 0.7,
    sprinting: false
  });

  assert.equal(applied, true);
  assert.ok(Math.abs(rig.modelRoot.rotation.y - (Math.PI * 0.5)) < 0.000001);
  assert.ok(rig.bodyLower.rotation.y > 0.25);
  assert.ok(rig.bodyUpper.rotation.y > 0.35);
  assert.ok(rig.headBone.rotation.y > 0.5);
});

test('directional locomotion keeps pure backward centered and retreat-biased', () => {
  const state = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(state, 1, {
    movingBackward: true,
    speedNorm: 0.7,
    sprinting: false
  });
  const rig = makeRig();
  applyDirectionalLocomotionPose(rig, state, {
    movingBackward: true,
    speedNorm: 0.7,
    sprinting: false
  });

  assert.ok(Math.abs(rig.modelRoot.rotation.y - Math.PI) < 0.000001);
  assert.ok(rig.bodyLower.rotation.x > 0);
  assert.ok(rig.bodyUpper.rotation.x > 0);
});
