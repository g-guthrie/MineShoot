import { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS } from './entity-constants.js';
import { getMovementTuning } from './gameplay-tuning.js';

const DEFAULT_TUNING = getMovementTuning();
const DEFAULT_EPSILON = 0.001;

function defaultBounds(bounds) {
  return {
    minX: typeof bounds?.minX === 'number' ? bounds.minX : (typeof bounds?.min === 'number' ? bounds.min : -Infinity),
    maxX: typeof bounds?.maxX === 'number' ? bounds.maxX : (typeof bounds?.max === 'number' ? bounds.max : Infinity),
    minZ: typeof bounds?.minZ === 'number' ? bounds.minZ : (typeof bounds?.min === 'number' ? bounds.min : -Infinity),
    maxZ: typeof bounds?.maxZ === 'number' ? bounds.maxZ : (typeof bounds?.max === 'number' ? bounds.max : Infinity)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createMovementInputState() {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    adsActive: false
  };
}

function applyStrafeBias(input, move) {
  if (!input) return move;
  const forwardHeld = !!input.forward;
  const backwardHeld = !!input.backward;
  const leftHeld = !!input.left;
  const rightHeld = !!input.right;
  if (leftHeld === rightHeld) return move;
  if (forwardHeld || backwardHeld) {
    return {
      forward: move.forward,
      right: leftHeld
        ? Math.tan(45 * (Math.PI / 180)) * (move.right < 0 ? -1 : 1)
        : Math.tan(30 * (Math.PI / 180)) * (move.right < 0 ? -1 : 1)
    };
  }
  return {
    forward: leftHeld
      ? 0
      : (1 / Math.tan(65 * (Math.PI / 180))),
    right: move.right
  };
}

export function hasIntentInputMessage(msg) {
  if (!msg || typeof msg !== 'object') return false;
  return (
    typeof msg.forward === 'boolean' ||
    typeof msg.backward === 'boolean' ||
    typeof msg.left === 'boolean' ||
    typeof msg.right === 'boolean' ||
    typeof msg.jump === 'boolean' ||
    typeof msg.sprint === 'boolean' ||
    typeof msg.adsActive === 'boolean'
  );
}

export function intersectsXZ(x, z, radius, box) {
  const closestX = Math.max(box.min.x, Math.min(x, box.max.x));
  const closestZ = Math.max(box.min.z, Math.min(z, box.max.z));
  const dx = x - closestX;
  const dz = z - closestZ;
  return ((dx * dx) + (dz * dz)) < (radius * radius);
}

export function isBlockedAt(nextX, nextZ, feetY, boxes, options = {}) {
  const playerHeight = Number(options.playerHeight || PLAYER_HEIGHT);
  const playerRadius = Number(options.playerRadius || PLAYER_RADIUS);
  const epsilon = Number(options.epsilon || DEFAULT_EPSILON);
  if (!Array.isArray(boxes) || boxes.length === 0) return false;

  const headY = feetY + playerHeight;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (!box || !box.min || !box.max) continue;
    if (headY <= (box.min.y + epsilon) || feetY >= (box.max.y - epsilon)) continue;
    if (intersectsXZ(nextX, nextZ, playerRadius, box)) return true;
  }
  return false;
}

export function findLandingSurfaceY(x, z, currentFeetY, nextFeetY, boxes, getGroundHeightAt, options = {}) {
  const playerRadius = Number(options.playerRadius || PLAYER_RADIUS) * 0.9;
  const epsilon = Number(options.epsilon || DEFAULT_EPSILON);
  const baseGroundY = typeof getGroundHeightAt === 'function' ? Number(getGroundHeightAt(x, z) || 0) : 0;
  if (!Array.isArray(boxes) || boxes.length === 0) return baseGroundY;

  let best = null;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (!box || !box.min || !box.max) continue;
    const top = box.max.y;
    if (!intersectsXZ(x, z, playerRadius, box)) continue;
    if (top <= (currentFeetY + epsilon) && top >= (nextFeetY - epsilon)) {
      if (best === null || top > best) best = top;
    }
  }
  if (best === null || best < baseGroundY) return baseGroundY;
  return best;
}

export function findCeilingY(x, z, currentHeadY, nextHeadY, boxes, options = {}) {
  const playerRadius = Number(options.playerRadius || PLAYER_RADIUS) * 0.9;
  const epsilon = Number(options.epsilon || DEFAULT_EPSILON);
  if (!Array.isArray(boxes) || boxes.length === 0) return null;

  let best = null;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (!box || !box.min || !box.max) continue;
    const bottom = box.min.y;
    if (!intersectsXZ(x, z, playerRadius, box)) continue;
    if (bottom >= (currentHeadY - epsilon) && bottom <= (nextHeadY + epsilon)) {
      if (best === null || bottom < best) best = bottom;
    }
  }
  return best;
}

export function stepAuthoritativeMovement(entity, inputState, options = {}) {
  if (!entity) return entity;

  const moveSpeedMultiplier = Math.max(0.1, Number(options.moveSpeedMultiplier || 1));
  const adsMoveMultiplier = Math.max(0.1, Number(options.adsMoveMultiplier || DEFAULT_TUNING.adsMoveMult || 0.4));
  const tuning = {
    jogSpeed: Number(options.jogSpeed || DEFAULT_TUNING.jogSpeed || 8) * moveSpeedMultiplier,
    runSpeed: Number(options.runSpeed || DEFAULT_TUNING.runSpeed || 14) * moveSpeedMultiplier,
    jumpVelocity: Number(options.jumpVelocity || DEFAULT_TUNING.jumpVelocity || 8.8),
    jumpHoldAccel: Number(options.jumpHoldAccel || DEFAULT_TUNING.jumpHoldAccel || 16),
    maxJumpHold: Number(options.maxJumpHold || DEFAULT_TUNING.maxJumpHold || 0.2),
    jumpReleaseMult: Number(options.jumpReleaseMult || DEFAULT_TUNING.jumpReleaseMult || 0.42),
    gravity: Number(options.gravity || DEFAULT_TUNING.gravity || 18),
    adsMoveMult: adsMoveMultiplier
  };
  const dtSec = Math.max(0, Number(options.dtSec || 0));
  const bounds = defaultBounds(options.bounds);
  const boxes = Array.isArray(options.collisionBoxes) ? options.collisionBoxes : [];
  const getGroundHeightAt = typeof options.getGroundHeightAt === 'function' ? options.getGroundHeightAt : (() => 0);
  const movementLocked = !!options.movementLocked;
  const eyeHeight = Number(options.eyeHeight || EYE_HEIGHT);
  const playerHeight = Number(options.playerHeight || PLAYER_HEIGHT);
  const playerRadius = Number(options.playerRadius || PLAYER_RADIUS);
  const epsilon = Number(options.epsilon || DEFAULT_EPSILON);

  const input = inputState || createMovementInputState();
  const adsActive = !!input.adsActive;
  const sprintInputHeld = !!input.sprint && !adsActive && !movementLocked;
  const groundedAtFrameStart = !!entity.isGrounded;
  const sprintCarryActive = !!entity.airborneSprintCarry;
  const effectiveSprintRequested = groundedAtFrameStart
    ? sprintInputHeld
    : (sprintCarryActive && sprintInputHeld);
  const speedCap = adsActive ? (tuning.jogSpeed * tuning.adsMoveMult) : (effectiveSprintRequested ? tuning.runSpeed : tuning.jogSpeed);

  const currentFeetY = Number(entity.y || eyeHeight) - eyeHeight;
  const minBoundX = Number(bounds.minX) + playerRadius;
  const maxBoundX = Number(bounds.maxX) - playerRadius;
  const minBoundZ = Number(bounds.minZ) + playerRadius;
  const maxBoundZ = Number(bounds.maxZ) - playerRadius;

  const yaw = Number(entity.yaw || 0);
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);

  let moveForward = 0;
  let moveRight = 0;
  if (!movementLocked) {
    if (input.forward) moveForward += 1;
    if (input.backward) moveForward -= 1;
    if (input.left) moveRight -= 1;
    if (input.right) moveRight += 1;
    const biased = applyStrafeBias(input, {
      forward: moveForward,
      right: moveRight
    });
    moveForward = Number(biased.forward || 0);
    moveRight = Number(biased.right || 0);
  }

  let moveX = (moveForward * forwardX) + (moveRight * rightX);
  let moveZ = (moveForward * forwardZ) + (moveRight * rightZ);

  const moveLength = Math.sqrt((moveX * moveX) + (moveZ * moveZ));
  if (moveLength > 0) {
    moveX = (moveX / moveLength) * speedCap * dtSec;
    moveZ = (moveZ / moveLength) * speedCap * dtSec;
  } else {
    moveX = 0;
    moveZ = 0;
  }

  const startX = Number(entity.x || 0);
  const startZ = Number(entity.z || 0);
  let nextX = clamp(startX + moveX, minBoundX, maxBoundX);
  if (!isBlockedAt(nextX, startZ, currentFeetY, boxes, { playerHeight, playerRadius, epsilon })) {
    entity.x = nextX;
  }

  let nextZ = clamp(Number(entity.z || 0) + moveZ, minBoundZ, maxBoundZ);
  if (!isBlockedAt(Number(entity.x || 0), nextZ, currentFeetY, boxes, { playerHeight, playerRadius, epsilon })) {
    entity.z = nextZ;
  }

  const movedX = Number(entity.x || 0) - startX;
  const movedZ = Number(entity.z || 0) - startZ;
  const horizontalSpeed = Math.sqrt((movedX * movedX) + (movedZ * movedZ)) / Math.max(dtSec, 0.0001);
  entity.moveSpeedNorm = clamp(horizontalSpeed / Math.max(tuning.runSpeed, 0.0001), 0, 1.4);
  entity.sprinting = effectiveSprintRequested && horizontalSpeed > 0.06;

  const jumpHeld = !!input.jump && !movementLocked;
  const jumpJustPressed = jumpHeld && !entity.jumpHeldLast;
  const jumpJustReleased = !jumpHeld && !!entity.jumpHeldLast;
  entity.jumpHeldLast = jumpHeld;

  if (jumpJustPressed && !!entity.isGrounded) {
    entity.velocityY = tuning.jumpVelocity;
    entity.isGrounded = false;
    entity.jumpHoldTimer = tuning.maxJumpHold;
  }
  if (jumpJustReleased && Number(entity.velocityY || 0) > 0) {
    entity.velocityY *= tuning.jumpReleaseMult;
    entity.jumpHoldTimer = 0;
  }
  if (jumpHeld && Number(entity.jumpHoldTimer || 0) > 0 && Number(entity.velocityY || 0) > 0) {
    entity.velocityY += tuning.jumpHoldAccel * dtSec;
    entity.jumpHoldTimer -= dtSec;
    if (entity.jumpHoldTimer < 0) entity.jumpHoldTimer = 0;
  }

  entity.velocityY = Number(entity.velocityY || 0) - (tuning.gravity * dtSec);
  let nextFeetY = currentFeetY + (Number(entity.velocityY || 0) * dtSec);

  if (Number(entity.velocityY || 0) <= 0) {
    const landingY = findLandingSurfaceY(Number(entity.x || 0), Number(entity.z || 0), currentFeetY, nextFeetY, boxes, getGroundHeightAt, {
      playerRadius,
      epsilon
    });
    if (nextFeetY <= (landingY + epsilon)) {
      nextFeetY = landingY;
      entity.velocityY = 0;
      entity.isGrounded = true;
      entity.jumpHoldTimer = 0;
    } else {
      entity.isGrounded = false;
    }
  } else {
    const currentHeadY = currentFeetY + playerHeight;
    const nextHeadY = nextFeetY + playerHeight;
    const ceilingY = findCeilingY(Number(entity.x || 0), Number(entity.z || 0), currentHeadY, nextHeadY, boxes, {
      playerRadius,
      epsilon
    });
    if (ceilingY !== null && nextHeadY >= (ceilingY - epsilon)) {
      nextFeetY = ceilingY - playerHeight;
      entity.velocityY = 0;
      entity.jumpHoldTimer = 0;
    }
    entity.isGrounded = false;
  }

  const baseGround = Number(getGroundHeightAt(Number(entity.x || 0), Number(entity.z || 0)) || 0);
  if (nextFeetY < baseGround) {
    nextFeetY = baseGround;
    entity.velocityY = 0;
    entity.isGrounded = true;
    entity.jumpHoldTimer = 0;
  }

  if (groundedAtFrameStart && !entity.isGrounded) {
    entity.airborneSprintCarry = !!effectiveSprintRequested;
  } else if (!groundedAtFrameStart && entity.isGrounded) {
    entity.airborneSprintCarry = false;
  } else if (!entity.isGrounded && !sprintInputHeld) {
    entity.airborneSprintCarry = false;
  } else if (entity.isGrounded) {
    entity.airborneSprintCarry = false;
  }

  if (entity.isGrounded) {
    entity.sprinting = sprintInputHeld && horizontalSpeed > 0.06;
  } else {
    entity.sprinting = !!entity.airborneSprintCarry && sprintInputHeld && horizontalSpeed > 0.06;
  }

  entity.y = nextFeetY + eyeHeight;
  return entity;
}

const runtime = (typeof globalThis !== 'undefined') ? globalThis : {};
runtime.__MAYHEM_RUNTIME = runtime.__MAYHEM_RUNTIME || {};
runtime.__MAYHEM_RUNTIME.GameShared = runtime.__MAYHEM_RUNTIME.GameShared || {};
runtime.__MAYHEM_RUNTIME.GameShared.authoritativeMovement = {
  createMovementInputState,
  hasIntentInputMessage,
  intersectsXZ,
  isBlockedAt,
  findLandingSurfaceY,
  findCeilingY,
  stepAuthoritativeMovement
};
