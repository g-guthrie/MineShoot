/**
 * movement.js - First-person character controller: axis-separated AABB
 * collision against the world's box list, gravity, jumping, sprint, and
 * optional per-zone jump boost (the space biome's low gravity pads).
 */
import { ARENA, EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS } from '../shared/combat.js';

const JOG_SPEED = 8;
const RUN_SPEED = 13.5;
const ADS_MOVE_MULT = 0.55;
const JUMP_VELOCITY = 8.6;
const GRAVITY = 21;
const EPSILON = 0.001;

function intersectsXZ(x, z, radius, box) {
  const closestX = Math.max(box.min.x, Math.min(x, box.max.x));
  const closestZ = Math.max(box.min.z, Math.min(z, box.max.z));
  const dx = x - closestX;
  const dz = z - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

function blockedAt(x, z, feetY, boxes) {
  const headY = feetY + PLAYER_HEIGHT;
  for (const box of boxes) {
    if (headY <= box.min.y + EPSILON || feetY >= box.max.y - EPSILON) continue;
    // Boxes the player can step onto (knee height) don't block movement.
    if (box.max.y - feetY <= 0.55) continue;
    if (intersectsXZ(x, z, PLAYER_RADIUS, box)) return true;
  }
  return false;
}

/** Highest landable surface under the player between two heights. */
function landingY(x, z, fromY, toY, boxes, groundAt) {
  let best = groundAt(x, z);
  for (const box of boxes) {
    const top = box.max.y;
    if (top > best && top <= fromY + EPSILON && top >= toY - EPSILON) {
      if (intersectsXZ(x, z, PLAYER_RADIUS * 0.9, box)) best = top;
    }
  }
  return best;
}

/**
 * Mutates entity {x, y(eye), z, yaw, velocityY, isGrounded, moveSpeedNorm,
 * sprinting}. options: { dt, boxes, groundAt, jumpScaleAt }.
 */
export function stepMovement(entity, input, { dt, boxes, groundAt, jumpScaleAt }) {
  const feetY = entity.y - EYE_HEIGHT;

  // Horizontal intent in the facing frame.
  let forward = 0;
  let right = 0;
  if (input.forward) forward += 1;
  if (input.backward) forward -= 1;
  if (input.left) right -= 1;
  if (input.right) right += 1;

  const sprinting = !!input.sprint && forward > 0 && !input.adsActive;
  let speed = sprinting ? RUN_SPEED : JOG_SPEED;
  if (input.adsActive) speed *= ADS_MOVE_MULT;

  const length = Math.hypot(forward, right);
  let moveX = 0;
  let moveZ = 0;
  if (length > 0) {
    const yaw = entity.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    moveX = ((forward * fx + right * rx) / length) * speed * dt;
    moveZ = ((forward * fz + right * rz) / length) * speed * dt;
  }

  const minBound = ARENA.min + PLAYER_RADIUS;
  const maxBound = ARENA.max - PLAYER_RADIUS;

  // Axis-separated slide.
  const nextX = Math.max(minBound, Math.min(maxBound, entity.x + moveX));
  if (!blockedAt(nextX, entity.z, feetY, boxes)) entity.x = nextX;
  const nextZ = Math.max(minBound, Math.min(maxBound, entity.z + moveZ));
  if (!blockedAt(entity.x, nextZ, feetY, boxes)) entity.z = nextZ;

  entity.moveSpeedNorm = Math.min(1.4, (length > 0 ? speed : 0) / RUN_SPEED);
  entity.sprinting = sprinting && length > 0;

  // Vertical: jump, gravity, landing.
  if (input.jump && entity.isGrounded) {
    const boost = jumpScaleAt ? jumpScaleAt(entity.x, entity.z) : 1;
    entity.velocityY = JUMP_VELOCITY * boost;
    entity.isGrounded = false;
  }
  entity.velocityY -= GRAVITY * dt;
  let nextFeet = feetY + entity.velocityY * dt;

  if (entity.velocityY <= 0) {
    const floor = landingY(entity.x, entity.z, feetY, nextFeet, boxes, groundAt);
    if (nextFeet <= floor + EPSILON) {
      nextFeet = floor;
      entity.velocityY = 0;
      entity.isGrounded = true;
    } else {
      entity.isGrounded = false;
    }
  } else {
    entity.isGrounded = false;
  }

  entity.y = nextFeet + EYE_HEIGHT;
}
