import { WORLD_BOUNDS } from './constants.js';
import { clamp } from './math.js';

export function createWorld() {
  return {
    bounds: { ...WORLD_BOUNDS },
    spawns: [
      { x: -34, z: -34, yaw: -Math.PI * 0.25 },
      { x: 34, z: 34, yaw: Math.PI * 0.75 },
      { x: -34, z: 30, yaw: -Math.PI * 0.75 },
      { x: 34, z: -30, yaw: Math.PI * 0.25 },
      { x: 0, z: -40, yaw: 0 },
      { x: 0, z: 40, yaw: Math.PI }
    ],
    obstacles: [
      { id: 'mid-a', x: -9, z: -5, w: 12, d: 5, h: 3.8 },
      { id: 'mid-b', x: 10, z: 7, w: 12, d: 5, h: 3.8 },
      { id: 'lane-a', x: -28, z: 12, w: 6, d: 20, h: 3.2 },
      { id: 'lane-b', x: 28, z: -12, w: 6, d: 20, h: 3.2 },
      { id: 'cover-a', x: -14, z: 28, w: 16, d: 4, h: 2.5 },
      { id: 'cover-b', x: 14, z: -28, w: 16, d: 4, h: 2.5 }
    ]
  };
}

export function chooseSpawn(world, index = 0) {
  const spawns = world && Array.isArray(world.spawns) ? world.spawns : [];
  if (!spawns.length) return { x: 0, z: 0, yaw: 0 };
  return spawns[Math.abs(index) % spawns.length];
}

function circleOverlapsBox(x, z, radius, box) {
  const halfW = Number(box.w || 0) * 0.5;
  const halfD = Number(box.d || 0) * 0.5;
  const nearestX = clamp(x, Number(box.x || 0) - halfW, Number(box.x || 0) + halfW);
  const nearestZ = clamp(z, Number(box.z || 0) - halfD, Number(box.z || 0) + halfD);
  const dx = x - nearestX;
  const dz = z - nearestZ;
  return (dx * dx) + (dz * dz) < radius * radius;
}

export function resolveHorizontalCollision(world, position, radius) {
  const bounds = world.bounds || WORLD_BOUNDS;
  let nextX = clamp(position.x, bounds.minX + radius, bounds.maxX - radius);
  let nextZ = clamp(position.z, bounds.minZ + radius, bounds.maxZ - radius);
  const boxes = Array.isArray(world.obstacles) ? world.obstacles : [];

  for (const box of boxes) {
    if (!circleOverlapsBox(nextX, nextZ, radius, box)) continue;
    const halfW = Number(box.w || 0) * 0.5;
    const halfD = Number(box.d || 0) * 0.5;
    const left = Number(box.x || 0) - halfW - radius;
    const right = Number(box.x || 0) + halfW + radius;
    const top = Number(box.z || 0) - halfD - radius;
    const bottom = Number(box.z || 0) + halfD + radius;
    const pushLeft = Math.abs(nextX - left);
    const pushRight = Math.abs(right - nextX);
    const pushTop = Math.abs(nextZ - top);
    const pushBottom = Math.abs(bottom - nextZ);
    const minPush = Math.min(pushLeft, pushRight, pushTop, pushBottom);
    if (minPush === pushLeft) nextX = left;
    else if (minPush === pushRight) nextX = right;
    else if (minPush === pushTop) nextZ = top;
    else nextZ = bottom;
  }

  return { x: nextX, z: nextZ };
}

