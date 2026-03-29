import {
  EYE_HEIGHT,
  BODY_HITBOX_SIZE,
  HEAD_HITBOX_SIZE
} from '../../../../shared/entity-constants.js';

const HISTORY_WINDOW_MS = 1200;
const MAX_REWIND_MS = 250;
const FUTURE_TOLERANCE_MS = 50;
const TELEPORT_RESET_DISTANCE_SQ = 64;
const BODY_CENTER_OFFSET_Y = 0.7625;
const HEAD_CENTER_OFFSET_Y = 2.0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(rad) {
  let value = Number(rad || 0);
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function lerpAngle(a, b, t) {
  const start = normalizeAngle(a);
  const delta = normalizeAngle(b - start);
  return normalizeAngle(start + (delta * t));
}

function cloneHistorySample(entity, timeMs) {
  return {
    timeMs: Number(timeMs || 0),
    x: Number(entity && entity.x || 0),
    y: Number(entity && entity.y || EYE_HEIGHT),
    z: Number(entity && entity.z || 0),
    yaw: Number(entity && entity.yaw || 0),
    pitch: Number(entity && entity.pitch || 0),
    alive: !!(entity && entity.alive)
  };
}

export function ensureHistoryBuffer(entity) {
  if (!entity) return [];
  if (!Array.isArray(entity.stateHistory)) entity.stateHistory = [];
  return entity.stateHistory;
}

export function recordHistorySample(entity, timeMs) {
  if (!entity) return null;
  const history = ensureHistoryBuffer(entity);
  const sample = cloneHistorySample(entity, timeMs);
  const last = history.length > 0 ? history[history.length - 1] : null;
  const dx = last ? (last.x - sample.x) : 0;
  const dy = last ? (last.y - sample.y) : 0;
  const dz = last ? (last.z - sample.z) : 0;
  const teleported = !!(
    last &&
    (
      ((dx * dx) + (dy * dy) + (dz * dz)) > TELEPORT_RESET_DISTANCE_SQ ||
      (!!last.alive !== !!sample.alive && sample.alive)
    )
  );

  if (teleported) {
    history.length = 0;
  }

  if (last && last.timeMs === sample.timeMs) {
    history[history.length - 1] = sample;
  } else if (
    last &&
    last.x === sample.x &&
    last.y === sample.y &&
    last.z === sample.z &&
    last.yaw === sample.yaw &&
    last.pitch === sample.pitch &&
    last.alive === sample.alive
  ) {
    last.timeMs = sample.timeMs;
  } else {
    history.push(sample);
  }

  const minTime = sample.timeMs - HISTORY_WINDOW_MS;
  while (history.length > 1 && history[0].timeMs < minTime) {
    history.shift();
  }
  return sample;
}

export function resolveShotServerTime(nowMs, rawShotServerTime) {
  const stamp = Number(rawShotServerTime);
  if (!Number.isFinite(stamp)) return Number(nowMs || 0);
  return clamp(stamp, Number(nowMs || 0) - MAX_REWIND_MS, Number(nowMs || 0) + FUTURE_TOLERANCE_MS);
}

export function sampleEntityHistory(entity, targetTimeMs) {
  if (!entity) return null;
  const history = ensureHistoryBuffer(entity);
  if (history.length === 0) {
    return cloneHistorySample(entity, targetTimeMs);
  }

  const targetTime = Number(targetTimeMs || 0);
  if (targetTime <= history[0].timeMs) return { ...history[0] };
  if (targetTime >= history[history.length - 1].timeMs) return { ...history[history.length - 1] };

  for (let i = history.length - 1; i > 0; i--) {
    const after = history[i];
    const before = history[i - 1];
    if (targetTime < before.timeMs || targetTime > after.timeMs) continue;
    const span = Math.max(1, after.timeMs - before.timeMs);
    const t = clamp((targetTime - before.timeMs) / span, 0, 1);
    return {
      timeMs: targetTime,
      x: lerp(before.x, after.x, t),
      y: lerp(before.y, after.y, t),
      z: lerp(before.z, after.z, t),
      yaw: lerpAngle(before.yaw, after.yaw, t),
      pitch: lerp(before.pitch, after.pitch, t),
      alive: before.alive
    };
  }

  return { ...history[history.length - 1] };
}

function normalizeVector3(x, y, z) {
  const len = Math.sqrt((x * x) + (y * y) + (z * z)) || 1;
  return {
    x: x / len,
    y: y / len,
    z: z / len
  };
}

function dot3(a, b) {
  return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function sub3(a, b) {
  return {
    x: Number(a.x || 0) - Number(b.x || 0),
    y: Number(a.y || 0) - Number(b.y || 0),
    z: Number(a.z || 0) - Number(b.z || 0)
  };
}

function addScaled3(a, b, scale) {
  return {
    x: Number(a.x || 0) + (Number(b.x || 0) * scale),
    y: Number(a.y || 0) + (Number(b.y || 0) * scale),
    z: Number(a.z || 0) + (Number(b.z || 0) * scale)
  };
}

function aimDirectionFromAngles(yaw, pitch) {
  const cosPitch = Math.cos(Number(pitch || 0));
  return normalizeVector3(
    -Math.sin(Number(yaw || 0)) * cosPitch,
    Math.sin(Number(pitch || 0)),
    -Math.cos(Number(yaw || 0)) * cosPitch
  );
}

export function buildShotRay(shooterSample, aimYaw, aimPitch) {
  const sample = shooterSample || {};
  return {
    origin: {
      x: Number(sample.x || 0),
      y: Number(sample.y || EYE_HEIGHT),
      z: Number(sample.z || 0)
    },
    direction: aimDirectionFromAngles(
      typeof aimYaw === 'number' ? aimYaw : sample.yaw,
      typeof aimPitch === 'number' ? aimPitch : sample.pitch
    )
  };
}

export function isAimPlausible(shooterSample, aimYaw, aimPitch, minDot = 0.9) {
  if (!shooterSample) return false;
  const viewDir = aimDirectionFromAngles(shooterSample.yaw, shooterSample.pitch);
  const shotDir = aimDirectionFromAngles(aimYaw, aimPitch);
  return dot3(viewDir, shotDir) >= Math.max(-1, Math.min(1, Number(minDot || 0.9)));
}

function targetBox(targetSample, size, centerOffsetY) {
  const eyeY = Number(targetSample && targetSample.y || EYE_HEIGHT);
  const footY = eyeY - EYE_HEIGHT;
  const centerY = footY + centerOffsetY;
  return {
    min: {
      x: Number(targetSample.x || 0) - (size.x * 0.5),
      y: centerY - (size.y * 0.5),
      z: Number(targetSample.z || 0) - (size.z * 0.5)
    },
    max: {
      x: Number(targetSample.x || 0) + (size.x * 0.5),
      y: centerY + (size.y * 0.5),
      z: Number(targetSample.z || 0) + (size.z * 0.5)
    }
  };
}

function intersectRayAxisAlignedBox(ray, box, maxDistance) {
  let tMin = 0;
  let tMax = Number(maxDistance || 0);
  const origin = ray.origin;
  const direction = ray.direction;

  for (const axis of ['x', 'y', 'z']) {
    const dir = Number(direction[axis] || 0);
    const start = Number(origin[axis] || 0);
    const min = Number(box.min[axis] || 0);
    const max = Number(box.max[axis] || 0);

    if (Math.abs(dir) < 1e-6) {
      if (start < min || start > max) return null;
      continue;
    }

    let t1 = (min - start) / dir;
    let t2 = (max - start) / dir;
    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  if (tMax < 0) return null;
  const distance = tMin >= 0 ? tMin : tMax;
  if (distance < 0 || distance > maxDistance) return null;
  return distance;
}

function rotateAroundY(vector, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: (vector.x * cos) - (vector.z * sin),
    y: vector.y,
    z: (vector.x * sin) + (vector.z * cos)
  };
}

function rotateAroundX(vector, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: vector.x,
    y: (vector.y * cos) - (vector.z * sin),
    z: (vector.y * sin) + (vector.z * cos)
  };
}

function intersectRayCollider(ray, collider, maxDistance) {
  if (!collider || !collider.center || !collider.half) return null;
  if (collider.type === 'aabb') {
    return intersectRayAxisAlignedBox(ray, {
      min: {
        x: collider.center.x - collider.half.x,
        y: collider.center.y - collider.half.y,
        z: collider.center.z - collider.half.z
      },
      max: {
        x: collider.center.x + collider.half.x,
        y: collider.center.y + collider.half.y,
        z: collider.center.z + collider.half.z
      }
    }, maxDistance);
  }

  const localOrigin = sub3(ray.origin, collider.center);
  let transformedOrigin = rotateAroundY(localOrigin, -(Number(collider.rotY || 0)));
  transformedOrigin = rotateAroundX(transformedOrigin, -(Number(collider.tiltX || 0)));
  let transformedDirection = rotateAroundY(ray.direction, -(Number(collider.rotY || 0)));
  transformedDirection = rotateAroundX(transformedDirection, -(Number(collider.tiltX || 0)));

  return intersectRayAxisAlignedBox({
    origin: transformedOrigin,
    direction: transformedDirection
  }, {
    min: { x: -collider.half.x, y: -collider.half.y, z: -collider.half.z },
    max: { x: collider.half.x, y: collider.half.y, z: collider.half.z }
  }, maxDistance);
}

export function isOccluded(ray, colliders, targetDistance, epsilon = 0.05) {
  const maxDistance = Math.max(0, Number(targetDistance || 0) - Math.max(0, Number(epsilon || 0.05)));
  if (!Array.isArray(colliders) || colliders.length === 0 || maxDistance <= 0) return false;
  for (let i = 0; i < colliders.length; i++) {
    const distance = intersectRayCollider(ray, colliders[i], maxDistance);
    if (distance != null && distance > 0.05 && distance < maxDistance) {
      return true;
    }
  }
  return false;
}

function bestIntersectionForTarget(ray, targetSample, maxDistance) {
  const headDistance = intersectRayAxisAlignedBox(
    ray,
    targetBox(targetSample, HEAD_HITBOX_SIZE, HEAD_CENTER_OFFSET_Y),
    maxDistance
  );
  const bodyDistance = intersectRayAxisAlignedBox(
    ray,
    targetBox(targetSample, BODY_HITBOX_SIZE, BODY_CENTER_OFFSET_Y),
    maxDistance
  );

  if (headDistance == null && bodyDistance == null) return null;
  if (headDistance != null && (bodyDistance == null || headDistance <= bodyDistance)) {
    return { hitType: 'head', distance: headDistance };
  }
  return { hitType: 'body', distance: bodyDistance };
}

export function findLagCompensatedHit(options = {}) {
  const shooter = options.shooter;
  const entities = Array.isArray(options.entities) ? options.entities : [];
  const shotServerTime = Number(options.shotServerTime || 0);
  const maxDistance = Math.max(0, Number(options.maxDistance || 0));
  if (!shooter || maxDistance <= 0) return null;

  const shooterSample = sampleEntityHistory(shooter, shotServerTime);
  const ray = buildShotRay(shooterSample, options.aimYaw, options.aimPitch);
  const colliders = Array.isArray(options.colliders) ? options.colliders : [];
  let best = null;
  let sawOccludedHit = false;

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!entity || entity.id === shooter.id) continue;
    if ((entity.spawnShieldUntil || 0) > shotServerTime) continue;

    const targetSample = sampleEntityHistory(entity, shotServerTime);
    if (!targetSample || !targetSample.alive) continue;

    const hit = bestIntersectionForTarget(ray, targetSample, maxDistance);
    if (!hit) continue;
    if (isOccluded(ray, colliders, hit.distance)) {
      sawOccludedHit = true;
      continue;
    }
    if (!best || hit.distance < best.distance) {
      best = {
        entity,
        targetSample,
        shooterSample,
        hitType: hit.hitType,
        distance: hit.distance,
        impactPoint: addScaled3(ray.origin, ray.direction, hit.distance),
        ray,
        shotServerTime
      };
    }
  }

  if (!best && sawOccludedHit) {
    return {
      blocked: true,
      reason: 'occluded',
      shooterSample,
      ray,
      shotServerTime
    };
  }
  return best;
}
