export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function distSq(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function dist(a: Vec3, b: Vec3): number {
  return Math.sqrt(distSq(a, b));
}

export function normalize(v: Vec3): Vec3 {
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (m === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

/** Direction a player is looking, from yaw/pitch. yaw 0 faces -z; positive pitch looks up. */
export function lookDirection(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cp,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cp,
  };
}

export interface AABB {
  min: Vec3;
  max: Vec3;
}

/** AABB centered horizontally on `pos` with `pos.y` at the bottom (feet). */
export function entityAABB(pos: Vec3, halfX: number, height: number): AABB {
  return {
    min: { x: pos.x - halfX, y: pos.y, z: pos.z - halfX },
    max: { x: pos.x + halfX, y: pos.y + height, z: pos.z + halfX },
  };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.z < b.max.z && a.max.z > b.min.z
  );
}

/**
 * Ray vs AABB (slab method). Returns hit distance along the ray, or null.
 * Only hits in front of the origin within maxDist count.
 */
export function rayAABB(origin: Vec3, dir: Vec3, box: AABB, maxDist: number): number | null {
  let tMin = 0;
  let tMax = maxDist;

  for (const axis of ['x', 'y', 'z'] as const) {
    const o = origin[axis];
    const d = dir[axis];
    const lo = box.min[axis];
    const hi = box.max[axis];

    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }

    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  return tMin;
}
