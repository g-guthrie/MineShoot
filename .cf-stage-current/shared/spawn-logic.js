function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

const DEFAULT_SPAWN_ANCHORS = [
  { u: 0.14, v: 0.14 },
  { u: 0.50, v: 0.16 },
  { u: 0.86, v: 0.14 },
  { u: 0.18, v: 0.32 },
  { u: 0.50, v: 0.34 },
  { u: 0.82, v: 0.32 },
  { u: 0.16, v: 0.50 },
  { u: 0.84, v: 0.50 },
  { u: 0.18, v: 0.68 },
  { u: 0.50, v: 0.66 },
  { u: 0.82, v: 0.68 },
  { u: 0.14, v: 0.86 },
  { u: 0.50, v: 0.84 },
  { u: 0.86, v: 0.86 }
];

function pointFromNormalized(boundsMin, boundsMax, u, v) {
  return {
    x: lerp(boundsMin, boundsMax, clamp01(u)),
    z: lerp(boundsMin, boundsMax, clamp01(v))
  };
}

function distanceToNearest(point, avoidPoints) {
  if (!Array.isArray(avoidPoints) || avoidPoints.length === 0) return Infinity;
  let nearest = Infinity;
  for (let i = 0; i < avoidPoints.length; i++) {
    const other = avoidPoints[i];
    if (!other) continue;
    const dx = Number(point.x || 0) - Number(other.x || 0);
    const dz = Number(point.z || 0) - Number(other.z || 0);
    const dist = Math.sqrt((dx * dx) + (dz * dz));
    if (dist < nearest) nearest = dist;
  }
  return nearest;
}

function candidateScore(point, avoidPoints, minClearance) {
  const nearest = distanceToNearest(point, avoidPoints);
  if (!isFinite(nearest)) return 1000;
  const clearance = Math.max(0, nearest - Math.max(0, Number(minClearance || 0)));
  return nearest + (clearance * 0.35);
}

export function chooseSpawnPoint(options = {}) {
  const boundsMin = Number(options.boundsMin || 0);
  const boundsMax = Number(options.boundsMax || 100);
  const padding = Math.max(0, Number(options.padding || 0));
  const min = boundsMin + padding;
  const max = boundsMax - padding;
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const getGroundHeightAt = typeof options.getGroundHeightAt === 'function'
    ? options.getGroundHeightAt
    : (() => 0);
  const isBlocked = typeof options.isBlocked === 'function'
    ? options.isBlocked
    : (() => false);
  const isExcluded = typeof options.isExcluded === 'function'
    ? options.isExcluded
    : (() => false);
  const minGroundY = Number.isFinite(options.minGroundY) ? Number(options.minGroundY) : -0.15;
  const minClearance = Math.max(0, Number(options.minClearance || 0));
  const avoidPoints = Array.isArray(options.avoidPoints) ? options.avoidPoints : [];

  const candidates = [];
  const anchors = Array.isArray(options.anchors) && options.anchors.length
    ? options.anchors
    : DEFAULT_SPAWN_ANCHORS;

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    if (!anchor) continue;
    candidates.push(pointFromNormalized(min, max, anchor.u, anchor.v));
  }

  for (let j = 0; j < anchors.length; j++) {
    const anchor = anchors[j];
    if (!anchor) continue;
    const jitter = 0.045;
    candidates.push(pointFromNormalized(
      min,
      max,
      Number(anchor.u || 0.5) + ((random() - 0.5) * jitter),
      Number(anchor.v || 0.5) + ((random() - 0.5) * jitter)
    ));
  }

  const extraRandom = Math.max(8, Number(options.extraRandomCandidates || 12));
  for (let k = 0; k < extraRandom; k++) {
    candidates.push({
      x: lerp(min, max, random()),
      z: lerp(min, max, random())
    });
  }

  let best = null;
  let bestScore = -Infinity;
  let fallback = null;

  for (let n = 0; n < candidates.length; n++) {
    const candidate = candidates[n];
    const x = Number(candidate.x || 0);
    const z = Number(candidate.z || 0);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;

    const groundY = Number(getGroundHeightAt(x, z) || 0);
    if (groundY < minGroundY) continue;
    if (isExcluded(x, z, 0)) continue;
    if (isBlocked(x, z, 0)) continue;

    if (!fallback) {
      fallback = { x, z };
    }

    const score = candidateScore({ x, z }, avoidPoints, minClearance) + (random() * 0.35);
    if (score > bestScore) {
      bestScore = score;
      best = { x, z };
    }
  }

  if (best) return best;
  if (fallback) return fallback;
  return {
    x: lerp(min, max, 0.5),
    z: lerp(min, max, 0.5)
  };
}
