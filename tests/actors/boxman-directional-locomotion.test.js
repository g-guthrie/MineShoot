import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDirectionalLocomotionPose,
  createDirectionalLocomotionState,
  resolveMoveIntent,
  TURN_ENTRY_RATE,
  TURN_ENTRY_SNAP_ANGLE,
  TURN_IDLE_POSE_START_RATE,
  TURN_SOFT_START_RATE,
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
  assert.ok(Math.abs(forwardDiagonalState.targetFacingYaw + (30 * (Math.PI / 180))) < 0.000001);
  assert.ok(Math.abs(retreatDiagonalState.targetFacingYaw - (40 * (Math.PI / 180))) < 0.000001);
});

test('directional locomotion does not produce a special idle pose for small standing mouse turns', () => {
  const state = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(state, 1, {
    yaw: 0,
    turnRate: TURN_IDLE_POSE_START_RATE + ((TURN_SOFT_START_RATE - TURN_IDLE_POSE_START_RATE) * 0.5),
    speedNorm: 0,
    sprinting: false,
    airborne: false
  });

  assert.equal(state.useTurnLoopClip, false);
  assert.equal(state.useTurnEntryClip, false);
  assert.equal(state.poseName, '');
  assert.equal(state.idleTurnPoseWeight, 0);

  const rig = makeRig();
  const applied = applyDirectionalLocomotionPose(rig, state, {
    speedNorm: 0,
    sprinting: false
  });

  assert.equal(applied, false);
  assert.ok(Math.abs(rig.modelRoot.rotation.y - Math.PI) < 0.000001);
  assert.equal(rig.bodyLower.rotation.y, 0);
  assert.equal(rig.bodyUpper.rotation.y, 0);
  assert.equal(rig.headBone.rotation.y, 0);
});

test('directional locomotion does not produce a rotate loop while standing and mousing', () => {
  const state = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(state, 0.016, {
    yaw: 0,
    turnRate: 220 * (Math.PI / 180),
    turnAmount: 35 * (Math.PI / 180),
    speedNorm: 0,
    sprinting: false,
    airborne: false
  });

  assert.equal(state.useTurnLoopClip, false);
  assert.equal(state.useTurnEntryClip, false);
  assert.equal(state.turnClipDirection, 0);

  const rig = makeRig();
  rig.headBone.rotation.y = 0.3;
  const applied = applyDirectionalLocomotionPose(rig, state, {
    speedNorm: 0,
    sprinting: false
  });

  assert.equal(applied, false);
  assert.equal(rig.headBone.rotation.y, 0.3);
});

test('directional locomotion no longer scales standing turn head guidance because idle mouse turns have no pose reaction', () => {
  const lighterTurn = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(lighterTurn, 0.016, {
    yaw: 0,
    turnRate: 45 * (Math.PI / 180),
    turnAmount: 10 * (Math.PI / 180),
    speedNorm: 0,
    sprinting: false,
    airborne: false
  });
  const heavierTurn = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(heavierTurn, 0.016, {
    yaw: 0,
    turnRate: 220 * (Math.PI / 180),
    turnAmount: 40 * (Math.PI / 180),
    speedNorm: 0,
    sprinting: false,
    airborne: false
  });

  assert.equal(lighterTurn.turnLoopPoseWeight, 0);
  assert.equal(heavierTurn.turnLoopPoseWeight, 0);

  const lightRig = makeRig();
  lightRig.headBone.rotation.y = 0.3;
  applyDirectionalLocomotionPose(lightRig, lighterTurn, {
    speedNorm: 0,
    sprinting: false
  });

  const heavyRig = makeRig();
  heavyRig.headBone.rotation.y = 0.3;
  applyDirectionalLocomotionPose(heavyRig, heavierTurn, {
    speedNorm: 0,
    sprinting: false
  });

  assert.equal(lightRig.headBone.rotation.y, 0.3);
  assert.equal(heavyRig.headBone.rotation.y, 0.3);
});

test('directional locomotion does not produce a standing turn entry while mousing in place', () => {
  const state = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(state, 0.016, {
    yaw: 0,
    turnRate: 220 * (Math.PI / 180),
    turnAmount: (TURN_ENTRY_SNAP_ANGLE * 0.55),
    speedNorm: 0,
    sprinting: false,
    airborne: false
  });
  updateDirectionalLocomotionState(state, 0.016, {
    yaw: 0,
    turnRate: TURN_ENTRY_RATE,
    turnAmount: (TURN_ENTRY_SNAP_ANGLE * 0.55),
    speedNorm: 0,
    sprinting: false,
    airborne: false
  });

  assert.equal(state.useTurnEntryClip, false);
  assert.equal(state.turnClipDirection, 0);
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
  assert.ok(Math.abs(rig.modelRoot.rotation.y - (Math.PI - (55 * (Math.PI / 180)))) < 0.000001);
  assert.ok(rig.bodyLower.rotation.y > 0.18);
  assert.ok(rig.bodyUpper.rotation.y > 0.23);
  assert.ok(rig.headBone.rotation.y > 0.33);
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

  assert.ok(Math.abs(rig.modelRoot.rotation.y - (Math.PI - (10 * (Math.PI / 180)))) < 0.000001);
  assert.ok(rig.bodyLower.rotation.x > 0);
  assert.ok(rig.bodyUpper.rotation.x > 0);
});

test('directional locomotion swaps backward diagonal visual facing so back-left faces right', () => {
  const leftRetreat = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(leftRetreat, 0.016, {
    movingBackward: true,
    movingLeft: true,
    speedNorm: 0.7,
    sprinting: false
  });
  const rightRetreat = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(rightRetreat, 0.016, {
    movingBackward: true,
    movingRight: true,
    speedNorm: 0.7,
    sprinting: false
  });

  assert.ok(Math.abs(leftRetreat.targetFacingYaw + (75 * (Math.PI / 180))) < 0.000001);
  assert.equal(leftRetreat.poseName, 'back_right');
  assert.ok(Math.abs(rightRetreat.targetFacingYaw - (40 * (Math.PI / 180))) < 0.000001);
  assert.equal(rightRetreat.poseName, 'back_left');
});

test('directional locomotion recenters quickly after pure lateral movement is released', () => {
  const state = createDirectionalLocomotionState();
  updateDirectionalLocomotionState(state, 1, {
    movingLeft: true,
    speedNorm: 0.7,
    sprinting: false
  });
  assert.ok(Math.abs(state.facingYaw) > 0.5);

  updateDirectionalLocomotionState(state, 1, {
    movingLeft: false,
    movingRight: false,
    movingForward: false,
    movingBackward: false,
    speedNorm: 0,
    sprinting: false
  });

  assert.ok(Math.abs(state.facingYaw) < 0.000001);
  assert.ok(Math.abs(state.bodyLowerAimYaw) < 0.000001);
  assert.ok(Math.abs(state.bodyUpperAimYaw) < 0.000001);
  assert.ok(Math.abs(state.headAimYaw) < 0.000001);
});
