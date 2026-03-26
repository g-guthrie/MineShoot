import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMovementInputState,
  isBlockedAt,
  stepAuthoritativeMovement
} from '../../shared/authoritative-movement.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../../shared/entity-constants.js';

function createEntity(overrides = {}) {
  return {
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    velocityY: 0,
    isGrounded: true,
    jumpHoldTimer: 0,
    jumpHeldLast: false,
    airborneSprintCarry: false,
    ...overrides
  };
}

function flatGround() {
  return 0;
}

test('authoritative movement advances forward from intent input', () => {
  const entity = createEntity();
  const input = createMovementInputState();
  input.forward = true;

  stepAuthoritativeMovement(entity, input, {
    dtSec: 0.1,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.equal(entity.x, 0);
  assert.ok(entity.z < -0.69 && entity.z > -0.71);
  assert.ok(entity.moveSpeedNorm > 0);
});

test('authoritative movement respects blocking collision boxes', () => {
  const entity = createEntity();
  const input = createMovementInputState();
  input.forward = true;
  const blockingBox = {
    min: { x: -1, y: 0, z: -1.5 },
    max: { x: 1, y: 3, z: -0.2 }
  };

  stepAuthoritativeMovement(entity, input, {
    dtSec: 0.1,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [blockingBox],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.equal(entity.z, 0);
  assert.equal(entity.moveSpeedNorm, 0);
});

test('authoritative movement blocks slightly low overhangs with the default player height', () => {
  const blocked = isBlockedAt(0, 0, 0, [{
    min: { x: -1, y: 1.74, z: -1 },
    max: { x: 1, y: 3, z: 1 }
  }]);

  assert.equal(blocked, true);
  assert.ok(PLAYER_HEIGHT > 1.74);
});

test('authoritative movement uses the widened default radius for near-side contact', () => {
  const blocked = isBlockedAt(0, 0, 0, [{
    min: { x: 0.39, y: 0, z: -0.5 },
    max: { x: 1, y: 3, z: 0.5 }
  }]);

  assert.equal(blocked, true);
  assert.ok(PLAYER_RADIUS >= 0.4);
});

test('authoritative movement applies jump intent and vertical motion', () => {
  const entity = createEntity();
  const input = createMovementInputState();
  input.jump = true;

  stepAuthoritativeMovement(entity, input, {
    dtSec: 0.05,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.ok(entity.y > 1.6);
  assert.equal(entity.isGrounded, false);
  assert.ok(entity.velocityY > 0);
});

test('authoritative movement still starts a jump while ADS is active', () => {
  const entity = createEntity();
  const input = createMovementInputState();
  input.jump = true;
  input.adsActive = true;

  stepAuthoritativeMovement(entity, input, {
    dtSec: 0.05,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.ok(entity.y > 1.6);
  assert.equal(entity.isGrounded, false);
  assert.ok(entity.velocityY > 0);
});

test('authoritative movement leaves positions unconstrained when bounds are absent', () => {
  const entity = createEntity({ x: 10, z: 10 });
  const input = createMovementInputState();
  input.forward = true;

  stepAuthoritativeMovement(entity, input, {
    dtSec: 0.1,
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.equal(entity.x, 10);
  assert.ok(entity.z < 9.31 && entity.z > 9.29);
});

test('authoritative movement biases pure strafe into diagonal travel to match the lower-body cap', () => {
  const entity = createEntity();
  const input = createMovementInputState();
  input.right = true;

  stepAuthoritativeMovement(entity, input, {
    dtSec: 0.1,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.ok(entity.x > 0.63 && entity.x < 0.65);
  assert.ok(entity.z < -0.29 && entity.z > -0.31);
  assert.ok(entity.moveSpeedNorm > 0);
});

test('authoritative movement uses asymmetric diagonal bias for left and right input', () => {
  const leftEntity = createEntity();
  const leftInput = createMovementInputState();
  leftInput.forward = true;
  leftInput.left = true;
  stepAuthoritativeMovement(leftEntity, leftInput, {
    dtSec: 0.1,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  const rightEntity = createEntity();
  const rightInput = createMovementInputState();
  rightInput.forward = true;
  rightInput.right = true;
  stepAuthoritativeMovement(rightEntity, rightInput, {
    dtSec: 0.1,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.ok(leftEntity.x < -0.49 && leftEntity.x > -0.51);
  assert.ok(leftEntity.z < -0.49 && leftEntity.z > -0.51);
  assert.ok(rightEntity.x > 0.34 && rightEntity.x < 0.36);
  assert.ok(rightEntity.z < -0.60 && rightEntity.z > -0.62);
});

test('authoritative movement gives backward sprint a smaller speed boost without setting sprint presentation', () => {
  const entity = createEntity();
  const input = createMovementInputState();
  input.backward = true;
  input.sprint = true;

  stepAuthoritativeMovement(entity, input, {
    dtSec: 0.1,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.equal(entity.sprinting, false);
  assert.equal(entity.fastBackpedal, true);
  assert.ok(entity.z > 0.86 && entity.z < 0.89);
  assert.ok(entity.moveSpeedNorm > 0.79 && entity.moveSpeedNorm < 0.81);
});

test('authoritative movement carries sprint through takeoff but does not allow starting sprint midair', () => {
  const entity = createEntity();
  const jumpInput = createMovementInputState();
  jumpInput.forward = true;
  jumpInput.jump = true;
  jumpInput.sprint = true;

  stepAuthoritativeMovement(entity, jumpInput, {
    dtSec: 0.05,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.equal(entity.isGrounded, false);
  assert.equal(entity.airborneSprintCarry, true);
  assert.equal(entity.sprinting, true);

  const midairStartEntity = createEntity({
    y: 2.2,
    velocityY: 5,
    isGrounded: false,
    jumpHeldLast: false,
    sprinting: false,
    airborneSprintCarry: false
  });
  const midairSprintInput = createMovementInputState();
  midairSprintInput.forward = true;
  midairSprintInput.sprint = true;

  stepAuthoritativeMovement(midairStartEntity, midairSprintInput, {
    dtSec: 0.05,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.equal(midairStartEntity.sprinting, false);
  assert.equal(midairStartEntity.airborneSprintCarry, false);
});

test('authoritative movement cancels sprint carry in air and resumes sprint on landing if still held', () => {
  const entity = createEntity({
    y: 2.0,
    velocityY: 2.5,
    isGrounded: false,
    jumpHeldLast: false,
    sprinting: true,
    airborneSprintCarry: true
  });
  const releaseInput = createMovementInputState();
  releaseInput.forward = true;

  stepAuthoritativeMovement(entity, releaseInput, {
    dtSec: 0.05,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.equal(entity.sprinting, false);
  assert.equal(entity.airborneSprintCarry, false);

  const landingEntity = createEntity({
    y: 1.7,
    velocityY: -8,
    isGrounded: false,
    jumpHeldLast: false,
    sprinting: false,
    airborneSprintCarry: false
  });
  const landingInput = createMovementInputState();
  landingInput.forward = true;
  landingInput.sprint = true;

  stepAuthoritativeMovement(landingEntity, landingInput, {
    dtSec: 0.05,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    collisionBoxes: [],
    getGroundHeightAt: flatGround,
    movementLocked: false
  });

  assert.equal(landingEntity.isGrounded, true);
  assert.equal(landingEntity.sprinting, true);
  assert.equal(landingEntity.airborneSprintCarry, false);
});
