export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

export function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

export function normalizeYaw(rad) {
  let value = Number(rad || 0);
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export function yawToForward(yaw) {
  return {
    x: -Math.sin(yaw),
    z: -Math.cos(yaw)
  };
}

export function yawToRight(yaw) {
  return {
    x: Math.cos(yaw),
    z: -Math.sin(yaw)
  };
}

export function lookToDirection(yaw, pitch) {
  const cp = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cp,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cp
  };
}

export function length2(x, z) {
  return Math.sqrt((x * x) + (z * z));
}

export function normalize2(x, z) {
  const len = length2(x, z);
  if (len <= 0.000001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

export function distanceSq2(a, b) {
  const dx = Number(a.x || 0) - Number(b.x || 0);
  const dz = Number(a.z || 0) - Number(b.z || 0);
  return (dx * dx) + (dz * dz);
}

export function rayHitVerticalCylinder(origin, dir, target, radius, minY, maxY, maxDistance) {
  const ox = Number(origin.x || 0) - Number(target.x || 0);
  const oz = Number(origin.z || 0) - Number(target.z || 0);
  const dx = Number(dir.x || 0);
  const dz = Number(dir.z || 0);
  const a = (dx * dx) + (dz * dz);
  if (a <= 0.000001) return null;
  const b = 2 * ((ox * dx) + (oz * dz));
  const c = (ox * ox) + (oz * oz) - (radius * radius);
  const disc = (b * b) - (4 * a * c);
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const near = (-b - root) / (2 * a);
  const far = (-b + root) / (2 * a);
  const t = near >= 0 ? near : far;
  if (t < 0 || t > maxDistance) return null;
  const y = Number(origin.y || 0) + (Number(dir.y || 0) * t);
  if (y < minY || y > maxY) return null;
  return t;
}

export function seededNoise(seed) {
  let value = Math.imul((Number(seed || 1) | 0) ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

