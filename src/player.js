/**
 * player.js - Local first-person player: look, movement (via the shared
 * authoritative movement solver, so traversal matches the tuned world),
 * and camera sync.
 */
import { stepAuthoritativeMovement } from '../shared/authoritative-movement.js';
import { EYE_HEIGHT } from '../shared/entity-constants.js';
import { WORLD_MIN, WORLD_MAX } from '../shared/world-layout.js';
import { getWorldBoxes } from './world-boxes.js';
import { audio } from './audio.js';

const LOOK_SENSITIVITY = 0.0023;
const PITCH_LIMIT = 1.55;

export function createLocalPlayer({ blocks }) {
  const runtime = globalThis.__MAYHEM_RUNTIME;
  const GameWorld = runtime.GameWorld;

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
    if (blockBoxes.length === 0) return getWorldBoxes();
    return getWorldBoxes().concat(blockBoxes);
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
    stepAuthoritativeMovement(entity, inputState, {
      dtSec: dt,
      collisionBoxes: self.collisionBoxes(),
      getGroundHeightAt: (x, z) => GameWorld.getGroundHeightAt(x, z),
      bounds: { minX: WORLD_MIN, maxX: WORLD_MAX, minZ: WORLD_MIN, maxZ: WORLD_MAX }
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
