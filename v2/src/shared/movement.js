import { PLAYER, DEFAULT_LOADOUT } from './constants.js';
import { clamp, normalize2, normalizeYaw, yawToForward, yawToRight } from './math.js';
import { chooseSpawn, resolveHorizontalCollision } from './world.js';

export function createPlayerState(options = {}) {
  const spawn = options.spawn || { x: 0, z: 0, yaw: 0 };
  return {
    id: String(options.id || ''),
    name: String(options.name || 'Player'),
    kind: options.kind || 'human',
    x: Number(spawn.x || 0),
    y: PLAYER.eyeHeight,
    z: Number(spawn.z || 0),
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: normalizeYaw(spawn.yaw || 0),
    pitch: 0,
    grounded: true,
    health: PLAYER.maxHealth,
    alive: true,
    respawnAt: 0,
    kills: 0,
    deaths: 0,
    weaponId: DEFAULT_LOADOUT[0],
    loadout: DEFAULT_LOADOUT.slice(),
    lastFireAt: -Infinity,
    lastInputSeq: 0
  };
}

export function clonePlayerState(player) {
  return player ? JSON.parse(JSON.stringify(player)) : null;
}

export function normalizeInput(input = {}) {
  return {
    seq: Math.max(0, Math.floor(Number(input.seq || 0))),
    forward: !!input.forward,
    backward: !!input.backward,
    left: !!input.left,
    right: !!input.right,
    jump: !!input.jump,
    sprint: !!input.sprint,
    yaw: normalizeYaw(input.yaw || 0),
    pitch: clamp(input.pitch || 0, -1.45, 1.45)
  };
}

export function respawnPlayer(player, world, spawnIndex = 0, nowMs = 0) {
  const spawn = chooseSpawn(world, spawnIndex);
  player.x = Number(spawn.x || 0);
  player.y = PLAYER.eyeHeight;
  player.z = Number(spawn.z || 0);
  player.vx = 0;
  player.vy = 0;
  player.vz = 0;
  player.yaw = normalizeYaw(spawn.yaw || 0);
  player.pitch = 0;
  player.grounded = true;
  player.health = PLAYER.maxHealth;
  player.alive = true;
  player.respawnAt = 0;
  player.lastFireAt = nowMs - 500;
  return player;
}

export function stepPlayer(player, rawInput, dtSec, world) {
  if (!player || !player.alive) return player;
  const input = normalizeInput(rawInput);
  const dt = clamp(dtSec, 0, 0.05);
  player.lastInputSeq = Math.max(player.lastInputSeq || 0, input.seq || 0);
  player.yaw = input.yaw;
  player.pitch = input.pitch;

  const forward = yawToForward(player.yaw);
  const right = yawToRight(player.yaw);
  let wishX = 0;
  let wishZ = 0;
  if (input.forward) {
    wishX += forward.x;
    wishZ += forward.z;
  }
  if (input.backward) {
    wishX -= forward.x;
    wishZ -= forward.z;
  }
  if (input.right) {
    wishX += right.x;
    wishZ += right.z;
  }
  if (input.left) {
    wishX -= right.x;
    wishZ -= right.z;
  }
  const wish = normalize2(wishX, wishZ);
  const maxSpeed = input.sprint && input.forward ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const accel = player.grounded ? PLAYER.groundAccel : PLAYER.airAccel;

  player.vx += wish.x * accel * dt;
  player.vz += wish.z * accel * dt;
  const horizontalSpeed = Math.sqrt((player.vx * player.vx) + (player.vz * player.vz));
  if (horizontalSpeed > maxSpeed) {
    player.vx = (player.vx / horizontalSpeed) * maxSpeed;
    player.vz = (player.vz / horizontalSpeed) * maxSpeed;
  }

  if (player.grounded && wish.x === 0 && wish.z === 0) {
    const drop = Math.max(0, horizontalSpeed - (PLAYER.friction * dt));
    const scale = horizontalSpeed > 0 ? drop / horizontalSpeed : 0;
    player.vx *= scale;
    player.vz *= scale;
  }

  if (player.grounded && input.jump) {
    player.vy = PLAYER.jumpVelocity;
    player.grounded = false;
  }

  player.vy -= PLAYER.gravity * dt;
  let nextX = player.x + (player.vx * dt);
  let nextZ = player.z + (player.vz * dt);
  const resolved = resolveHorizontalCollision(world, { x: nextX, z: nextZ }, PLAYER.radius);
  if (Math.abs(resolved.x - nextX) > 0.0001) player.vx = 0;
  if (Math.abs(resolved.z - nextZ) > 0.0001) player.vz = 0;
  player.x = resolved.x;
  player.z = resolved.z;

  player.y += player.vy * dt;
  if (player.y <= PLAYER.eyeHeight) {
    player.y = PLAYER.eyeHeight;
    player.vy = 0;
    player.grounded = true;
  }

  return player;
}

