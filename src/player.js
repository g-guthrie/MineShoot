/**
 * player.js - Local first-person player: look, movement, and camera sync.
 */
import { stepMovement } from './movement.js';
import { EYE_HEIGHT } from '../shared/combat.js';
import { audio } from './audio.js';

const LOOK_SENSITIVITY = 0.0023;
const PITCH_LIMIT = 1.55;

export function createLocalPlayer({ world, blocks }) {
  const entity = {
    x: 0,
    y: EYE_HEIGHT,
    z: 0,
    yaw: 0,
    velocityY: 0,
    isGrounded: true,
    moveSpeedNorm: 0,
    sprinting: false
  };

  const self = {
    entity,
    pitch: 0,
    eyeHeight: EYE_HEIGHT
  };

  let footstepTimer = 0;

  self.collisionBoxes = function () {
    const blockBoxes = blocks.collisionBoxes();
    if (blockBoxes.length === 0) return world.collidables;
    return world.collidables.concat(blockBoxes);
  };

  self.spawnAt = function (point) {
    entity.x = point.x;
    entity.y = point.y;
    entity.z = point.z;
    entity.velocityY = 0;
    entity.isGrounded = true;
    entity.yaw = Math.random() * Math.PI * 2;
    self.pitch = 0;
  };

  self.look = function (dx, dy) {
    entity.yaw -= dx * LOOK_SENSITIVITY;
    if (entity.yaw > Math.PI) entity.yaw -= Math.PI * 2;
    if (entity.yaw < -Math.PI) entity.yaw += Math.PI * 2;
    self.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, self.pitch - dy * LOOK_SENSITIVITY));
  };

  self.step = function (dt, inputState) {
    const grounded = entity.isGrounded;
    stepMovement(entity, inputState, {
      dt,
      boxes: self.collisionBoxes(),
      groundAt: world.groundAt,
      jumpScaleAt: world.jumpScaleAt
    });

    if (!grounded && entity.isGrounded) {
      audio.play('land', 0.25);
    }
    if (inputState.jump && grounded && !entity.isGrounded) {
      audio.play('jump', 0.4);
    }

    const speedNorm = entity.moveSpeedNorm || 0;
    if (entity.isGrounded && speedNorm > 0.1) {
      footstepTimer -= dt * (entity.sprinting ? 1.5 : 1);
      if (footstepTimer <= 0) {
        footstepTimer = 0.38;
        audio.play('footstep', 0.18, 0.9 + Math.random() * 0.2);
      }
    } else {
      footstepTimer = Math.min(footstepTimer, 0.12);
    }
  };

  self.syncCamera = function (camera) {
    camera.position.set(entity.x, entity.y, entity.z);
    camera.rotation.set(self.pitch, entity.yaw, 0);
  };

  self.forwardDir = function () {
    const cosP = Math.cos(self.pitch);
    return {
      x: -Math.sin(entity.yaw) * cosP,
      y: Math.sin(self.pitch),
      z: -Math.cos(entity.yaw) * cosP
    };
  };

  return self;
}
