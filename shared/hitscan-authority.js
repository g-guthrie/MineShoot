import { applyFalloff } from './damage.js';
import { resolveWeaponAdsFovDeg, resolveWeaponAimProfile } from './gameplay-tuning.js';
import { buildCombatHitboxesFromEntityPosition } from './entity-points.js';

const CAMERA_FOV_DEG = 75;
const DEFAULT_ASPECT = 16 / 9;
const EPS = 1e-6;
const AUTOLOCK_SAMPLE_FACTORS = [
  { x: 0, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 0, z: 1 },
  { x: -1, y: -1, z: -1 },
  { x: -1, y: -1, z: 1 },
  { x: -1, y: 1, z: -1 },
  { x: -1, y: 1, z: 1 },
  { x: 1, y: -1, z: -1 },
  { x: 1, y: -1, z: 1 },
  { x: 1, y: 1, z: -1 },
  { x: 1, y: 1, z: 1 }
];

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clampNumber(Number(value || 0), 0, 1);
}

function normalizeVec3(v) {
  const len = Math.sqrt((v.x * v.x) + (v.y * v.y) + (v.z * v.z)) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function addVec3(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scaleVec3(v, scalar) {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

function crossVec3(a, b) {
  return {
    x: (a.y * b.z) - (a.z * b.y),
    y: (a.z * b.x) - (a.x * b.z),
    z: (a.x * b.y) - (a.y * b.x)
  };
}

function subtractVec3(a, b) {
  return {
    x: Number(a && a.x || 0) - Number(b && b.x || 0),
    y: Number(a && a.y || 0) - Number(b && b.y || 0),
    z: Number(a && a.z || 0) - Number(b && b.z || 0)
  };
}

function dotVec3(a, b) {
  return (
    Number(a && a.x || 0) * Number(b && b.x || 0) +
    Number(a && a.y || 0) * Number(b && b.y || 0) +
    Number(a && a.z || 0) * Number(b && b.z || 0)
  );
}

function distanceVec3(a, b) {
  const d = subtractVec3(a, b);
  return Math.sqrt((d.x * d.x) + (d.y * d.y) + (d.z * d.z));
}

function hashStringSeed(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed, salt) {
  let x = (hashStringSeed(seed) ^ Math.imul((salt + 1), 1597334677)) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) / 4294967296);
}

function explicitBox(box) {
  if (!box || !box.min || !box.max) return null;
  const min = {
    x: Number(box.min.x || 0),
    y: Number(box.min.y || 0),
    z: Number(box.min.z || 0)
  };
  const max = {
    x: Number(box.max.x || 0),
    y: Number(box.max.y || 0),
    z: Number(box.max.z || 0)
  };
  if (
    !Number.isFinite(min.x) || !Number.isFinite(min.y) || !Number.isFinite(min.z) ||
    !Number.isFinite(max.x) || !Number.isFinite(max.y) || !Number.isFinite(max.z)
  ) {
    return null;
  }
  return { min, max };
}

function boxCenter(box) {
  return {
    x: (Number(box.min.x || 0) + Number(box.max.x || 0)) * 0.5,
    y: (Number(box.min.y || 0) + Number(box.max.y || 0)) * 0.5,
    z: (Number(box.min.z || 0) + Number(box.max.z || 0)) * 0.5
  };
}

function boxHalfExtents(box) {
  return {
    x: Math.max(0, (Number(box.max.x || 0) - Number(box.min.x || 0)) * 0.5),
    y: Math.max(0, (Number(box.max.y || 0) - Number(box.min.y || 0)) * 0.5),
    z: Math.max(0, (Number(box.max.z || 0) - Number(box.min.z || 0)) * 0.5)
  };
}

function sampleBoxPoints(box) {
  const center = boxCenter(box);
  const half = boxHalfExtents(box);
  const out = [];
  for (let i = 0; i < AUTOLOCK_SAMPLE_FACTORS.length; i++) {
    const factor = AUTOLOCK_SAMPLE_FACTORS[i];
    out.push({
      x: center.x + (half.x * factor.x),
      y: center.y + (half.y * factor.y),
      z: center.z + (half.z * factor.z)
    });
  }
  return out;
}

function weaponFovDeg(weaponStats, adsActive) {
  if (!adsActive) return CAMERA_FOV_DEG;
  return resolveWeaponAdsFovDeg(weaponStats);
}

function resolveViewFovDeg(weaponStats, viewFovDeg) {
  const fallback = weaponFovDeg(weaponStats, false);
  const raw = Number(viewFovDeg);
  if (!Number.isFinite(raw) || raw <= 0.0001) return fallback;

  const scoped = weaponFovDeg(weaponStats, true);
  return clampNumber(raw, Math.min(CAMERA_FOV_DEG, scoped), Math.max(CAMERA_FOV_DEG, scoped));
}

export function sampleSpreadOffset(weaponStats, adsActive, pelletIndex, shotToken) {
  const pattern = weaponStats && Array.isArray(weaponStats.pelletPattern) ? weaponStats.pelletPattern : null;
  if (pattern && pattern.length) {
    const entry = pattern[Math.abs(Math.trunc(Number(pelletIndex || 0))) % pattern.length] || {};
    return {
      x: Number(entry.x || 0) / DEFAULT_ASPECT,
      y: Number(entry.y || 0)
    };
  }
  const aim = resolveWeaponAimProfile(weaponStats, adsActive);
  const spread = Math.max(0, Number(aim && aim.spread || 0));
  if (spread <= 0.00001) return { x: 0, y: 0 };
  const maxRadius = spread;
  const angle = seededUnit(shotToken, pelletIndex * 2) * Math.PI * 2;
  const radius = Math.sqrt(seededUnit(shotToken, pelletIndex * 2 + 1)) * maxRadius;
  return {
    x: Math.cos(angle) * radius / DEFAULT_ASPECT,
    y: -Math.sin(angle) * radius
  };
}

function buildRayDirection(forward, adsActive, weaponStats, pelletIndex, shotToken, viewFovDeg) {
  const baseForward = normalizeVec3(forward);
  const worldUp = Math.abs(baseForward.y) > 0.98 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const right = normalizeVec3(crossVec3(baseForward, worldUp));
  const up = normalizeVec3(crossVec3(right, baseForward));
  const offset = sampleSpreadOffset(weaponStats, adsActive, pelletIndex, shotToken);
  if (offset.x === 0 && offset.y === 0) return baseForward;

  const fovY = resolveViewFovDeg(weaponStats, viewFovDeg) * Math.PI / 180;
  const tanHalfY = Math.tan(fovY * 0.5);
  const tanHalfX = tanHalfY * DEFAULT_ASPECT;
  return normalizeVec3(addVec3(
    baseForward,
    addVec3(
      scaleVec3(right, offset.x * tanHalfX),
      scaleVec3(up, offset.y * tanHalfY)
    )
  ));
}

function buildRayDirectionFromOffset(forward, weaponStats, offset, viewFovDeg) {
  const baseForward = normalizeVec3(forward);
  const worldUp = Math.abs(baseForward.y) > 0.98 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const right = normalizeVec3(crossVec3(baseForward, worldUp));
  const up = normalizeVec3(crossVec3(right, baseForward));
  if (!offset || (offset.x === 0 && offset.y === 0)) return baseForward;

  const fovY = resolveViewFovDeg(weaponStats, viewFovDeg) * Math.PI / 180;
  const tanHalfY = Math.tan(fovY * 0.5);
  const tanHalfX = tanHalfY * DEFAULT_ASPECT;
  return normalizeVec3(addVec3(
    baseForward,
    addVec3(
      scaleVec3(right, Number(offset.x || 0) * tanHalfX),
      scaleVec3(up, Number(offset.y || 0) * tanHalfY)
    )
  ));
}

function intersectRayAabb(origin, dir, box, maxDistance) {
  if (!box || !box.min || !box.max) return null;
  let tmin = -Infinity;
  let tmax = Infinity;
  const axes = ['x', 'y', 'z'];
  for (let i = 0; i < axes.length; i++) {
    const axis = axes[i];
    const o = Number(origin[axis] || 0);
    const d = Number(dir[axis] || 0);
    const min = Number(box.min[axis] || 0);
    const max = Number(box.max[axis] || 0);
    if (Math.abs(d) < 0.000001) {
      if (o < min || o > max) return null;
      continue;
    }
    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  const hitDistance = tmin >= 0 ? tmin : tmax;
  if (hitDistance < 0 || hitDistance > maxDistance) return null;
  return hitDistance;
}

function entityHitboxes(entity) {
  const explicitBody = explicitBox(entity && entity.bodyBox);
  const explicitHead = explicitBox(entity && entity.headBox);
  if (explicitBody || explicitHead) {
    return {
      body: explicitBody,
      head: explicitHead
    };
  }
  const generated = buildCombatHitboxesFromEntityPosition(entity || {});
  return {
    body: explicitBox(generated.bodyBox),
    head: explicitBox(generated.headBox)
  };
}

function effectiveRange(weaponStats, adsActive) {
  const aim = resolveWeaponAimProfile(weaponStats, adsActive);
  if (aim && aim.maxRange === Infinity) return Infinity;
  return Math.max(0, Number(aim && aim.maxRange || 0));
}

function readAimOrigin(options) {
  if (options && options.aimOrigin) return options.aimOrigin;
  return options && options.origin ? options.origin : null;
}

function readAimForward(options) {
  if (options && options.aimForward) return options.aimForward;
  return options && options.forward ? options.forward : null;
}

function autoLockConfig(weaponStats) {
  const cfg = weaponStats && weaponStats.autoLock;
  return cfg && cfg.enabled !== false ? cfg : null;
}

function coneHalfAngleDegForAutoLock(cfg, adsActive) {
  return Math.max(
    0.5,
    Number(
      adsActive
        ? (cfg.adsConeHalfAngleDeg != null ? cfg.adsConeHalfAngleDeg : cfg.hipfireConeHalfAngleDeg)
        : (cfg.hipfireConeHalfAngleDeg != null ? cfg.hipfireConeHalfAngleDeg : cfg.adsConeHalfAngleDeg)
    ) || 0.5
  );
}

function headshotChanceMaxForAutoLock(cfg, adsActive) {
  return clamp01(
    adsActive
      ? (cfg.adsHeadshotChanceMax != null ? cfg.adsHeadshotChanceMax : cfg.hipfireHeadshotChanceMax)
      : (cfg.hipfireHeadshotChanceMax != null ? cfg.hipfireHeadshotChanceMax : cfg.adsHeadshotChanceMax)
  );
}

function worldLineBlocked(origin, targetPoint, worldBoxes) {
  const distance = distanceVec3(origin, targetPoint);
  if (!(distance > EPS)) return false;
  const dir = normalizeVec3(subtractVec3(targetPoint, origin));
  const boxes = Array.isArray(worldBoxes) ? worldBoxes : [];
  for (let i = 0; i < boxes.length; i++) {
    const box = explicitBox(boxes[i]);
    if (!box) continue;
    const hitDistance = intersectRayAabb(origin, dir, box, distance);
    if (hitDistance != null && hitDistance < (distance - 0.05)) return true;
  }
  return false;
}

function evaluateConeOverlap(origin, forward, box, maxDistance, coneHalfAngleDeg, worldBoxes) {
  if (!box) return null;
  const samples = sampleBoxPoints(box);
  const cosLimit = Math.cos((Math.max(0.1, Number(coneHalfAngleDeg || 0.1)) * Math.PI) / 180);
  let overlapCount = 0;
  let bestSample = null;
  let bestDot = -1;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const toSample = subtractVec3(sample, origin);
    const distance = Math.sqrt((toSample.x * toSample.x) + (toSample.y * toSample.y) + (toSample.z * toSample.z));
    if (!(distance > EPS) || distance > maxDistance) continue;
    const dir = {
      x: toSample.x / distance,
      y: toSample.y / distance,
      z: toSample.z / distance
    };
    const dot = dotVec3(forward, dir);
    if (dot < cosLimit) continue;
    if (worldLineBlocked(origin, sample, worldBoxes)) continue;
    overlapCount++;
    if (!bestSample || dot > bestDot) {
      bestSample = sample;
      bestDot = dot;
    }
  }

  if (overlapCount <= 0 || !bestSample) return null;
  return {
    overlap: overlapCount / samples.length,
    alignment: clamp01((bestDot - cosLimit) / Math.max(EPS, 1 - cosLimit)),
    point: bestSample,
    distance: distanceVec3(origin, bestSample)
  };
}

function chooseBetterSelection(currentBest, nextCandidate) {
  if (!nextCandidate) return currentBest;
  if (!currentBest) return nextCandidate;
  if (nextCandidate.score > currentBest.score + 1e-6) return nextCandidate;
  if (Math.abs(nextCandidate.score - currentBest.score) <= 1e-6 && nextCandidate.alignment > currentBest.alignment + 1e-6) {
    return nextCandidate;
  }
  if (
    Math.abs(nextCandidate.score - currentBest.score) <= 1e-6 &&
    Math.abs(nextCandidate.alignment - currentBest.alignment) <= 1e-6 &&
    nextCandidate.distance < currentBest.distance
  ) {
    return nextCandidate;
  }
  return currentBest;
}

export function resolveAutoLockPreview(options) {
  const origin = readAimOrigin(options);
  const forward = readAimForward(options) ? normalizeVec3(readAimForward(options)) : null;
  const weaponStats = options && options.weaponStats ? options.weaponStats : null;
  const cfg = autoLockConfig(weaponStats);
  if (!origin || !forward || !weaponStats || !cfg) return { kind: 'none' };

  const targets = Array.isArray(options.targets) ? options.targets : [];
  const worldBoxes = Array.isArray(options.worldBoxes) ? options.worldBoxes : [];
  const adsActive = !!(options && options.adsActive);
  const maxDistance = effectiveRange(weaponStats, adsActive);
  const coneHalfAngleDeg = coneHalfAngleDegForAutoLock(cfg, adsActive);
  const minTargetOverlap = clamp01(cfg.minTargetOverlap != null ? cfg.minTargetOverlap : (cfg.minBodyOverlap != null ? cfg.minBodyOverlap : 0.1));
  const headOverlapWeight = clampNumber(Number(cfg.headOverlapWeight != null ? cfg.headOverlapWeight : 0.7), 0, 2);
  let bestLock = null;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (!target) continue;
    const boxes = entityHitboxes(target);
    const body = evaluateConeOverlap(origin, forward, boxes.body, maxDistance, coneHalfAngleDeg, worldBoxes);
    const head = evaluateConeOverlap(origin, forward, boxes.head, maxDistance, coneHalfAngleDeg, worldBoxes);
    const bodyOverlap = body ? body.overlap : 0;
    const headOverlap = head ? head.overlap : 0;
    const primaryOverlap = Math.max(bodyOverlap, headOverlap);
    if (primaryOverlap < minTargetOverlap) continue;
    bestLock = chooseBetterSelection(bestLock, {
      kind: 'lock',
      target,
      body,
      head,
      score: bodyOverlap + (headOverlap * headOverlapWeight),
      alignment: Math.max(body ? body.alignment : 0, head ? head.alignment : 0),
      distance: Math.min(body ? body.distance : Infinity, head ? head.distance : Infinity)
    });
  }

  return bestLock || { kind: 'none' };
}

function resolveRayHits(options) {
  const origin = readAimOrigin(options);
  const forward = readAimForward(options);
  const weaponStats = options && options.weaponStats ? options.weaponStats : null;
  if (!origin || !forward || !weaponStats) return [];

  const targets = Array.isArray(options.targets) ? options.targets : [];
  const worldBoxes = Array.isArray(options.worldBoxes) ? options.worldBoxes : [];
  const adsActive = !!(options && options.adsActive);
  const shotToken = String(options && options.shotToken || '');
  const viewFovDeg = Number(options && options.viewFovDeg);
  const maxDistance = effectiveRange(weaponStats, adsActive);
  const pellets = Math.max(1, Number(weaponStats.pellets || 1));
  const out = [];

  for (let pelletIndex = 0; pelletIndex < pellets; pelletIndex++) {
    const pelletOffset = sampleSpreadOffset(weaponStats, adsActive, pelletIndex, shotToken);
    const dir = buildRayDirection(forward, adsActive, weaponStats, pelletIndex, shotToken, viewFovDeg);
    let worldHitDistance = maxDistance;
    for (let i = 0; i < worldBoxes.length; i++) {
      const box = explicitBox(worldBoxes[i]);
      if (!box) continue;
      const hitDistance = intersectRayAabb(origin, dir, box, maxDistance);
      if (hitDistance != null && hitDistance < worldHitDistance) {
        worldHitDistance = hitDistance;
      }
    }

    let best = null;
    for (let i = 0; i < targets.length; i++) {
      const entity = targets[i];
      if (!entity) continue;
      const boxes = entityHitboxes(entity);
      const headDistance = intersectRayAabb(origin, dir, boxes.head, worldHitDistance);
      const bodyDistance = intersectRayAabb(origin, dir, boxes.body, worldHitDistance);
      if (headDistance == null && bodyDistance == null) continue;

      let hitType = 'body';
      let hitDistance = bodyDistance;
      if (headDistance != null && (bodyDistance == null || headDistance <= bodyDistance)) {
        hitType = 'head';
        hitDistance = headDistance;
      }

      if (!best || hitDistance < best.distance) {
        best = {
          target: entity,
          hitType,
          distance: hitDistance,
          point: {
            x: origin.x + dir.x * hitDistance,
            y: origin.y + dir.y * hitDistance,
            z: origin.z + dir.z * hitDistance
          }
        };
      }
    }

    if (best) {
      const rawDamage = best.hitType === 'head'
        ? Number(weaponStats.headDamage || 0)
        : Number(weaponStats.bodyDamage || 0);
      out.push({
        target: best.target,
        hit: true,
        hitType: best.hitType,
        distance: best.distance,
        point: best.point,
        damage: applyFalloff(rawDamage, best.distance, options && options.falloffBands ? options.falloffBands : []),
        mode: options && options.mode ? options.mode : 'hitscan',
        pelletIndex,
        pelletScore: (pelletOffset.x * pelletOffset.x) + (pelletOffset.y * pelletOffset.y)
      });
      continue;
    }

    if (options && options.includeMisses) {
      out.push({
        target: null,
        hit: false,
        hitType: 'miss',
        distance: worldHitDistance,
        point: {
          x: origin.x + dir.x * worldHitDistance,
          y: origin.y + dir.y * worldHitDistance,
          z: origin.z + dir.z * worldHitDistance
        },
        damage: 0,
        mode: options && options.mode ? options.mode : 'hitscan',
        pelletIndex,
        pelletScore: (pelletOffset.x * pelletOffset.x) + (pelletOffset.y * pelletOffset.y)
      });
    }
  }

  return out;
}

function resolveAutoLockShot(options) {
  const origin = readAimOrigin(options);
  const forward = readAimForward(options);
  const weaponStats = options && options.weaponStats ? options.weaponStats : null;
  const cfg = autoLockConfig(weaponStats);
  if (!origin || !forward || !weaponStats || !cfg) return [];

  const preview = resolveAutoLockPreview(options);
  if (preview.kind === 'lock') {
    const hasBody = !!preview.body;
    const hasHead = !!preview.head;
    const adsActive = !!(options && options.adsActive);
    const headshotChance = hasHead && hasBody
      ? clamp01(
        headshotChanceMaxForAutoLock(cfg, adsActive) *
        Math.pow(Math.max(0, preview.alignment), Math.max(0.25, Number(cfg.headshotAlignmentExponent || 1.5)))
      )
      : (hasHead ? 1 : 0);
    const shotToken = String(options && options.shotToken || '');
    const hitType = hasHead && !hasBody
      ? 'head'
      : (hasBody && !hasHead
        ? 'body'
        : ((hasHead && seededUnit(shotToken || 'autolock', 211) < headshotChance) ? 'head' : 'body'));
    const point = hitType === 'head'
      ? (preview.head ? preview.head.point : (preview.body ? preview.body.point : null))
      : (preview.body ? preview.body.point : (preview.head ? preview.head.point : null));
    if (!point) return [];
    const distance = distanceVec3(origin, point);
    const rawDamage = hitType === 'head'
      ? Number(weaponStats.headDamage || 0)
      : Number(weaponStats.bodyDamage || 0);
    return [{
      target: preview.target,
      hit: true,
      hitType,
      distance,
      point,
      damage: applyFalloff(rawDamage, distance, options && options.falloffBands ? options.falloffBands : []),
      mode: 'autolock',
      headshotChance
    }];
  }

  return [];
}

export function resolveHitscanTrace(options) {
  const origin = readAimOrigin(options);
  const forward = readAimForward(options);
  const weaponStats = options && options.weaponStats ? options.weaponStats : null;
  if (!origin || !forward || !weaponStats) return [];
  return autoLockConfig(weaponStats) ? resolveAutoLockShot(options) : resolveRayHits(options);
}

export function resolveHitscanShot(options) {
  const traces = resolveHitscanTrace(options);
  const out = [];
  for (let i = 0; i < traces.length; i++) {
    const trace = traces[i];
    if (!trace || trace.hit === false) continue;
    out.push(trace);
  }
  return out;
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.hitscanAuthority = {
  resolveHitscanTrace,
  resolveHitscanShot,
  resolveAutoLockPreview,
  sampleSpreadOffset
};
