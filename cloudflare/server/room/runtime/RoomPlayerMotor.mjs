import {
  EYE_HEIGHT,
  PLAYER_RADIUS,
  DEFAULT_HP_MAX,
  DEFAULT_ARMOR_MAX
} from '../../../../shared/entity-constants.js';
import {
  ARMOR_REGEN_DELAY_MS,
  ARMOR_REGEN_PER_SEC,
  regenArmorFromLastDamage
} from '../../../../shared/survivability.js';
import {
  PLAYER_HEIGHT,
  PITCH_LIMIT,
  COLLISION_EPSILON,
  applyPlayerInputIntent,
  simulatePlayerMotion as simulateSharedPlayerMotion
} from '../../../../shared/player-motion.js';

export function buildSpawnAvoidPoints(entity, entities) {
  const avoidPoints = [];
  const selfId = entity && entity.id ? entity.id : '';
  for (let i = 0; i < entities.length; i++) {
    const other = entities[i];
    if (!other || !other.alive || other.id === selfId) continue;
    avoidPoints.push({
      x: Number(other.x || 0),
      z: Number(other.z || 0)
    });
  }
  return avoidPoints;
}

export function applySpawnPoint(entity, spawn, terrainEyeYAt) {
  if (!entity || !spawn) return;
  entity.x = Number(spawn.x || 0);
  entity.z = Number(spawn.z || 0);
  entity.y = terrainEyeYAt(entity.x, entity.z);
}

export function applySpawnShield(entity, now, spawnShieldMs) {
  if (!entity) return;
  entity.spawnShieldUntil = Number(now || 0) + Math.max(0, Number(spawnShieldMs || 0));
}

export function spawnEntityRandomly(options = {}) {
  const entity = options.entity;
  const chooseSpawnPoint = options.chooseSpawnPoint;
  const terrainEyeYAt = options.terrainEyeYAt;
  if (!entity || typeof chooseSpawnPoint !== 'function' || typeof terrainEyeYAt !== 'function') return null;
  const spawn = chooseSpawnPoint(entity);
  applySpawnPoint(entity, spawn, terrainEyeYAt);
  entity.plannedSpawnPoint = null;
  return spawn;
}

export function planEntityRespawn(options = {}) {
  const entity = options.entity;
  const chooseSpawnPoint = options.chooseSpawnPoint;
  if (!entity || typeof chooseSpawnPoint !== 'function') return null;
  const spawn = chooseSpawnPoint(entity);
  entity.plannedSpawnPoint = {
    x: Number(spawn.x || 0),
    z: Number(spawn.z || 0)
  };
  return entity.plannedSpawnPoint;
}

export function buildPlayerEntity(options = {}) {
  const chooseSpawnPoint = options.chooseSpawnPoint;
  const terrainEyeYAt = options.terrainEyeYAt;
  const now = Number(options.now || 0);
  const preset = options.preset || { armorMax: DEFAULT_ARMOR_MAX, wallhackRadius: 90 };
  const eyeHeight = Number(options.eyeHeight || EYE_HEIGHT);

  const entity = {
    id: String(options.userId || ''),
    kind: 'player',
    username: String(options.username || 'player'),
    classId: String(options.classId || 'ffa'),
    x: 0,
    y: eyeHeight,
    z: 0,
    yaw: 0,
    pitch: 0,
    hp: Number(options.maxHp || DEFAULT_HP_MAX),
    hpMax: Number(options.maxHp || DEFAULT_HP_MAX),
    armor: Number(preset.armorMax || 0),
    armorMax: Number(preset.armorMax || 0),
    wallhackRadius: Number(preset.wallhackRadius || 0),
    alive: true,
    respawnAt: 0,
    plannedSpawnPoint: null,
    spawnShieldUntil: 0,
    lastDamageAt: 0,
    seq: 0,
    velocityY: 0,
    grounded: true,
    jumpHoldRemaining: 0,
    moveForward: 0,
    moveStrafe: 0,
    jumpHeld: false,
    sprintHeld: false,
    adsActive: false,
    lastProcessedInputSeq: 0,
    lastJumpHeld: false,
    lastShotAt: {},
    stateHistory: [],
    weaponId: 'rifle',
    moveSpeedNorm: 0,
    sprinting: false,
    muzzleFlashUntil: 0,
    kills: 0,
    deaths: 0,
    progressScore: 0,
    teamId: '',
    disconnectedAt: 0,
    stunUntil: 0,
    slowUntil: 0,
    slowMultiplier: 1,
    streamHeat: 0,
    streamOverheatedUntil: 0
  };

  spawnEntityRandomly({
    entity,
    chooseSpawnPoint,
    terrainEyeYAt
  });
  applySpawnShield(entity, now, options.spawnShieldMs);
  return entity;
}

export function enforceTerrainFloor(options = {}) {
  const entity = options.entity;
  const terrainEyeYAt = options.terrainEyeYAt;
  if (!entity || typeof terrainEyeYAt !== 'function') return 0;
  const floorEyeY = terrainEyeYAt(entity.x, entity.z);
  if (!Number.isFinite(entity.y) || entity.y < floorEyeY) {
    entity.y = floorEyeY;
  }
  return floorEyeY;
}

export function applyInput(options = {}) {
  const entity = options.entity;
  const message = options.message || {};
  const clamp = options.clamp;
  const now = Number(options.now || 0);

  if (!entity || !entity.alive || typeof clamp !== 'function') return;
  applyPlayerInputIntent({
    entity,
    message,
    clamp,
    now
  });
  entity.weaponId = 'rifle';
}

function colliderVerticalHalf(collider) {
  if (!collider || !collider.half) return 0;
  const base = Math.abs(Number(collider.half.y || 0));
  const tilt = Math.abs(Number(collider.tiltX || 0));
  return base + (Math.abs(Number(collider.half.z || 0)) * Math.sin(tilt));
}

function colliderVerticalOverlap(collider, feetY, headY) {
  if (!collider || !collider.center || !collider.half) return false;
  const halfY = colliderVerticalHalf(collider);
  const minY = Number(collider.center.y || 0) - halfY;
  const maxY = Number(collider.center.y || 0) + halfY;
  return !(headY <= minY + COLLISION_EPSILON || feetY >= maxY - COLLISION_EPSILON);
}

function rotateAroundY(x, z, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: (x * cos) - (z * sin),
    z: (x * sin) + (z * cos)
  };
}

function intersectsColliderXZ(x, z, radius, collider) {
  if (!collider || !collider.center || !collider.half) return false;
  let localX = Number(x || 0) - Number(collider.center.x || 0);
  let localZ = Number(z || 0) - Number(collider.center.z || 0);

  if (collider.type === 'obb') {
    const rotated = rotateAroundY(localX, localZ, -Number(collider.rotY || 0));
    localX = rotated.x;
    localZ = rotated.z;
  }

  const halfX = Math.abs(Number(collider.half.x || 0));
  const halfZ = Math.abs(Number(collider.half.z || 0));
  const closestX = Math.max(-halfX, Math.min(localX, halfX));
  const closestZ = Math.max(-halfZ, Math.min(localZ, halfZ));
  const dx = localX - closestX;
  const dz = localZ - closestZ;
  return ((dx * dx) + (dz * dz)) < (radius * radius);
}

function isBlockedAt(x, z, feetY, colliders) {
  if (!Array.isArray(colliders) || colliders.length === 0) return false;
  const headY = Number(feetY || 0) + PLAYER_HEIGHT;
  for (let i = 0; i < colliders.length; i++) {
    const collider = colliders[i];
    if (!colliderVerticalOverlap(collider, feetY, headY)) continue;
    if (intersectsColliderXZ(x, z, PLAYER_RADIUS, collider)) return true;
  }
  return false;
}

function movementIntentMagnitude(entity) {
  const forward = Number(entity && entity.moveForward || 0);
  const strafe = Number(entity && entity.moveStrafe || 0);
  return Math.sqrt((forward * forward) + (strafe * strafe));
}

export function simulateMovement(options = {}) {
  const entity = options.entity;
  const terrainEyeYAt = options.terrainEyeYAt;
  const clamp = options.clamp;
  const now = Number(options.now || 0);
  const dtSec = Math.max(0, Number(options.dtSec || 0));
  const boundsMin = Number(options.boundsMin || 0);
  const boundsMax = Number(options.boundsMax || 0);
  const colliders = Array.isArray(options.worldColliders) ? options.worldColliders : [];

  if (!entity || !entity.alive || typeof terrainEyeYAt !== 'function' || typeof clamp !== 'function' || dtSec <= 0) {
    return false;
  }
  const changed = simulateSharedPlayerMotion({
    entity,
    dtSec,
    now,
    boundsMin,
    boundsMax,
    terrainEyeYAt,
    clamp,
    isBlockedAt(nextX, nextZ, feetY) {
      return isBlockedAt(nextX, nextZ, feetY, colliders);
    }
  });
  entity.weaponId = 'rifle';
  return changed;
}

export function regenArmor(options = {}) {
  const entity = options.entity;
  const now = Number(options.now || 0);
  const dtSec = Math.max(0, Number(options.dtSec || 0));
  return regenArmorFromLastDamage(entity, dtSec, now, {
    regenDelayMs: options.regenDelayMs || ARMOR_REGEN_DELAY_MS,
    regenPerSec: options.regenPerSec || ARMOR_REGEN_PER_SEC
  });
}

export function respawnIfNeeded(options = {}) {
  const entity = options.entity;
  const now = Number(options.now || 0);
  const chooseSpawnPoint = options.chooseSpawnPoint;
  const terrainEyeYAt = options.terrainEyeYAt;
  const spawnShieldMs = options.spawnShieldMs;

  if (!entity || entity.alive || Number(entity.respawnAt || 0) > now) return false;

  entity.hp = entity.hpMax;
  entity.armor = entity.armorMax;
  entity.alive = true;
  entity.respawnAt = 0;
  entity.lastDamageAt = 0;

  if (entity.plannedSpawnPoint) {
    applySpawnPoint(entity, entity.plannedSpawnPoint, terrainEyeYAt);
    entity.plannedSpawnPoint = null;
  } else {
    spawnEntityRandomly({
      entity,
      chooseSpawnPoint,
      terrainEyeYAt
    });
  }

  applySpawnShield(entity, now, spawnShieldMs);
  entity.lastShotAt = {};
  entity.muzzleFlashUntil = 0;
  entity.velocityY = 0;
  entity.grounded = true;
  entity.jumpHoldRemaining = 0;
  entity.moveForward = 0;
  entity.moveStrafe = 0;
  entity.jumpHeld = false;
  entity.sprintHeld = false;
  entity.adsActive = false;
  entity.lastJumpHeld = false;
  entity.moveSpeedNorm = 0;
  entity.sprinting = false;
  entity.stunUntil = 0;
  entity.slowUntil = 0;
  entity.slowMultiplier = 1;
  return true;
}
