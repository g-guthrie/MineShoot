import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMovementInputState,
  stepAuthoritativeMovement
} from '../../shared/authoritative-movement.js';

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
  assert.ok(entity.z < -0.79 && entity.z > -0.81);
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
  assert.ok(entity.z < 9.21 && entity.z > 9.19);
});
