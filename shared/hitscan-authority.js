import {
  HEAD_HITBOX_SIZE,
  BODY_HITBOX_SIZE,
  EYE_HEIGHT,
  BODY_HITBOX_CENTER_OFFSET_Y,
  HEAD_HITBOX_CENTER_OFFSET_Y
} from './entity-constants.js';
import { applyFalloff } from './damage.js';

const CAMERA_FOV_DEG = 75;
const ADS_FOV_DEG = 56;
const SNIPER_SCOPE_FOV_DEG = 24;
const DEFAULT_ASPECT = 16 / 9;
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

function weaponFovDeg(weaponId, adsActive) {
  if (!adsActive) return CAMERA_FOV_DEG;
  return weaponId === 'sniper' ? SNIPER_SCOPE_FOV_DEG : ADS_FOV_DEG;
}

function spreadOffset(weaponStats, adsActive, pelletIndex, shotToken) {
  const spread = Math.max(0, Number(weaponStats && weaponStats.hipfireSpread || 0));
  if (spread <= 0.00001) return { x: 0, y: 0 };
  const adsMult = Math.max(0, Number(weaponStats && weaponStats.adsSpreadMultiplier != null ? weaponStats.adsSpreadMultiplier : 1));
  const spreadScale = adsActive ? adsMult : 1;
  if (spreadScale <= 0.00001) return { x: 0, y: 0 };
  const maxRadius = spread * spreadScale;
  const angle = seededUnit(shotToken, pelletIndex * 2) * Math.PI * 2;
  const radius = Math.sqrt(seededUnit(shotToken, pelletIndex * 2 + 1)) * maxRadius;
  return {
    x: Math.cos(angle) * radius / DEFAULT_ASPECT,
    y: -Math.sin(angle) * radius
  };
}

function buildRayDirection(forward, adsActive, weaponStats, pelletIndex, shotToken) {
  const baseForward = normalizeVec3(forward);
  const worldUp = Math.abs(baseForward.y) > 0.98 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const right = normalizeVec3(crossVec3(baseForward, worldUp));
  const up = normalizeVec3(crossVec3(right, baseForward));
  const offset = spreadOffset(weaponStats, adsActive, pelletIndex, shotToken);
  if (offset.x === 0 && offset.y === 0) return baseForward;

  const fovY = weaponFovDeg(weaponStats && weaponStats.id || '', adsActive) * Math.PI / 180;
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
  const feetY = Number((entity.y || EYE_HEIGHT) - EYE_HEIGHT);
  const bodyCenterY = feetY + BODY_HITBOX_CENTER_OFFSET_Y;
  const headCenterY = feetY + HEAD_HITBOX_CENTER_OFFSET_Y;
  const halfBody = {
    x: BODY_HITBOX_SIZE.x * 0.5,
    y: BODY_HITBOX_SIZE.y * 0.5,
    z: BODY_HITBOX_SIZE.z * 0.5
  };
  const halfHead = {
    x: HEAD_HITBOX_SIZE.x * 0.5,
    y: HEAD_HITBOX_SIZE.y * 0.5,
    z: HEAD_HITBOX_SIZE.z * 0.5
  };
  return {
    body: {
      min: { x: entity.x - halfBody.x, y: bodyCenterY - halfBody.y, z: entity.z - halfBody.z },
      max: { x: entity.x + halfBody.x, y: bodyCenterY + halfBody.y, z: entity.z + halfBody.z }
    },
    head: {
      min: { x: entity.x - halfHead.x, y: headCenterY - halfHead.y, z: entity.z - halfHead.z },
      max: { x: entity.x + halfHead.x, y: headCenterY + halfHead.y, z: entity.z + halfHead.z }
    }
  };
}

function effectiveRange(weaponStats, adsActive) {
  let range = Number(weaponStats && weaponStats.maxRange || 0);
  if (weaponStats && weaponStats.infiniteRange) return Infinity;
  if (adsActive) {
    range *= Math.max(1, Number(weaponStats && weaponStats.adsHitscanRangeMultiplier || 1));
  }
  return Math.max(0, range);
}

export function resolveHitscanShot(options) {
  const origin = options && options.origin ? options.origin : null;
  const forward = options && options.forward ? options.forward : null;
  const weaponStats = options && options.weaponStats ? options.weaponStats : null;
  if (!origin || !forward || !weaponStats) return [];

  const targets = Array.isArray(options.targets) ? options.targets : [];
  const worldBoxes = Array.isArray(options.worldBoxes) ? options.worldBoxes : [];
  const adsActive = !!(options && options.adsActive);
  const shotToken = String(options && options.shotToken || '');
  const maxDistance = effectiveRange(weaponStats, adsActive);
  const pellets = Math.max(1, Number(weaponStats.pellets || 1));
  const out = [];

  for (let pelletIndex = 0; pelletIndex < pellets; pelletIndex++) {
    const dir = buildRayDirection(forward, adsActive, weaponStats, pelletIndex, shotToken);
    let worldHitDistance = maxDistance;
    for (let i = 0; i < worldBoxes.length; i++) {
      const hitDistance = intersectRayAabb(origin, dir, worldBoxes[i], maxDistance);
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

    if (!best) continue;
    const rawDamage = best.hitType === 'head'
      ? Number(weaponStats.headDamage || 0)
      : Number(weaponStats.bodyDamage || 0);
    out.push({
      target: best.target,
      hitType: best.hitType,
      distance: best.distance,
      point: best.point,
      damage: applyFalloff(rawDamage, best.distance, options && options.falloffBands ? options.falloffBands : [])
    });
  }

  return out;
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.hitscanAuthority = {
  resolveHitscanShot
};
