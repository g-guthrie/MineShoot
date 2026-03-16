const EPS = 1e-6;

export function vec3(x, y, z) {
  return {
    x: Number(x || 0),
    y: Number(y || 0),
    z: Number(z || 0)
  };
}

export function normalizeVec3(v) {
  const x = Number(v && v.x || 0);
  const y = Number(v && v.y || 0);
  const z = Number(v && v.z || 0);
  const len = Math.sqrt((x * x) + (y * y) + (z * z));
  if (len <= EPS) return { x: 0, y: 0, z: -1 };
  return { x: x / len, y: y / len, z: z / len };
}

export function dotVec3(a, b) {
  return (
    Number(a && a.x || 0) * Number(b && b.x || 0) +
    Number(a && a.y || 0) * Number(b && b.y || 0) +
    Number(a && a.z || 0) * Number(b && b.z || 0)
  );
}

export function distanceVec3(a, b) {
  const dx = Number(b && b.x || 0) - Number(a && a.x || 0);
  const dy = Number(b && b.y || 0) - Number(a && a.y || 0);
  const dz = Number(b && b.z || 0) - Number(a && a.z || 0);
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function directionAndDistance(from, to) {
  const dx = Number(to && to.x || 0) - Number(from && from.x || 0);
  const dy = Number(to && to.y || 0) - Number(from && from.y || 0);
  const dz = Number(to && to.z || 0) - Number(from && from.z || 0);
  const distance = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
  if (distance <= EPS) {
    return {
      distance,
      direction: { x: 0, y: 0, z: -1 }
    };
  }
  return {
    distance,
    direction: { x: dx / distance, y: dy / distance, z: dz / distance }
  };
}

export function passesConeGate(forwardDir, targetDir, halfAngleDeg) {
  const halfDeg = Number(halfAngleDeg || 0);
  if (halfDeg >= 179) return true;
  const cosLimit = Math.cos((Math.max(0, halfDeg) * Math.PI) / 180);
  return dotVec3(normalizeVec3(forwardDir), normalizeVec3(targetDir)) >= cosLimit;
}

function candidatePos(candidate) {
  if (!candidate || !candidate.corePos) return null;
  const p = candidate.corePos;
  if (
    !Number.isFinite(Number(p.x)) ||
    !Number.isFinite(Number(p.y)) ||
    !Number.isFinite(Number(p.z))
  ) {
    return null;
  }
  return p;
}

function candidateAllowed(candidate, ownerTypes) {
  if (!candidate) return false;
  if (candidate.alive === false) return false;
  if (!ownerTypes || ownerTypes.length === 0) return true;
  const ownerType = String(candidate.ownerType || '');
  for (let i = 0; i < ownerTypes.length; i++) {
    if (ownerType === ownerTypes[i]) return true;
  }
  return false;
}

export function selectSeekTarget(options) {
  const cfg = options || {};
  const origin = cfg.origin || { x: 0, y: 0, z: 0 };
  const forward = normalizeVec3(cfg.forward || { x: 0, y: 0, z: -1 });
  const maxRange = Math.max(0.01, Number(cfg.maxRange || 24));
  const coneHalfAngleDeg = Math.max(0, Number(cfg.coneHalfAngleDeg || 180));
  const ownerTypes = Array.isArray(cfg.ownerTypes) ? cfg.ownerTypes : null;
  const candidates = Array.isArray(cfg.candidates) ? cfg.candidates : [];
  const hasWorldLos = typeof cfg.hasWorldLos === 'function' ? cfg.hasWorldLos : null;
  const projectToNdc = typeof cfg.projectToNdc === 'function' ? cfg.projectToNdc : null;
  const preferScreenCenter = !!cfg.preferScreenCenter;
  const boxSizePx = Number(cfg.boxSizePx || 0);
  const boxWidthPx = Number(cfg.boxWidthPx || boxSizePx || 0);
  const boxHeightPx = Number(cfg.boxHeightPx || boxSizePx || 0);
  const viewportWidth = Math.max(1, Number(cfg.viewportWidth || 1));
  const viewportHeight = Math.max(1, Number(cfg.viewportHeight || 1));
  const halfNdcX = boxWidthPx > 0 ? (boxWidthPx * 0.5) / (viewportWidth * 0.5) : 0;
  const halfNdcY = boxHeightPx > 0 ? (boxHeightPx * 0.5) / (viewportHeight * 0.5) : 0;

  let selected = null;
  let selectedDistance = Infinity;
  let selectedNorm = Infinity;
  let nearestNorm = Infinity;
  let nearestTargetId = '';

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidateAllowed(candidate, ownerTypes)) continue;
    const targetPos = candidatePos(candidate);
    if (!targetPos) continue;

    let projection = null;
    if (projectToNdc) {
      projection = projectToNdc(targetPos);
      if (!projection || !Number.isFinite(projection.x) || !Number.isFinite(projection.y) || !Number.isFinite(projection.z)) {
        continue;
      }
      if (projection.z > 1 || projection.z < -1) continue;

      if (halfNdcX > EPS && halfNdcY > EPS) {
        const nx = projection.x / halfNdcX;
        const ny = projection.y / halfNdcY;
        const norm = Math.sqrt((nx * nx) + (ny * ny));
        if (norm < nearestNorm) {
          nearestNorm = norm;
          nearestTargetId = String(candidate.id || '');
        }
      }
    }

    const dirDist = directionAndDistance(origin, targetPos);
    if (dirDist.distance <= EPS || dirDist.distance > maxRange) continue;
    if (!passesConeGate(forward, dirDist.direction, coneHalfAngleDeg)) continue;

    if (projectToNdc && halfNdcX > EPS && halfNdcY > EPS) {
      if (Math.abs(projection.x) > halfNdcX || Math.abs(projection.y) > halfNdcY) continue;
    }

    if (hasWorldLos && !hasWorldLos(targetPos, dirDist.distance)) continue;

    let candidateNorm = Infinity;
    if (projection && halfNdcX > EPS && halfNdcY > EPS) {
      const sx = projection.x / halfNdcX;
      const sy = projection.y / halfNdcY;
      candidateNorm = Math.sqrt((sx * sx) + (sy * sy));
    }

    const shouldReplace = preferScreenCenter
      ? (
        candidateNorm < selectedNorm - EPS ||
        (
          Math.abs(candidateNorm - selectedNorm) <= EPS &&
          dirDist.distance < selectedDistance
        )
      )
      : (dirDist.distance < selectedDistance);

    if (shouldReplace) {
      selected = candidate;
      selectedDistance = dirDist.distance;
      selectedNorm = candidateNorm;
    }
  }

  return {
    candidate: selected,
    hasLock: !!selected,
    distance: Number.isFinite(selectedDistance) ? selectedDistance : -1,
    lockTargetId: selected ? String(selected.id || '') : '',
    nearestTargetId,
    nearestNorm: Number.isFinite(nearestNorm) ? nearestNorm : -1,
    lockNorm: Number.isFinite(selectedNorm) ? selectedNorm : -1,
    reticleHalfNdcX: halfNdcX,
    reticleHalfNdcY: halfNdcY,
    candidateCount: candidates.length
  };
}

export function steerHomingVelocity(options) {
  const cfg = options || {};
  const targetPos = cfg.targetPos || null;
  const projectilePos = cfg.projectilePos || null;
  if (!targetPos || !projectilePos) {
    return vec3(
      Number(cfg.velocity && cfg.velocity.x || 0),
      Number(cfg.velocity && cfg.velocity.y || 0),
      Number(cfg.velocity && cfg.velocity.z || 0)
    );
  }
  const dirDist = directionAndDistance(projectilePos, targetPos);
  const speed = Math.max(0, Number(cfg.speed || 0)) + Math.max(0, Number(cfg.boost || 0));
  const blend = Math.max(0, Math.min(1, Number(cfg.dt || 0) * Math.max(0, Number(cfg.lerp || 0))));
  const goal = {
    x: dirDist.direction.x * speed,
    y: dirDist.direction.y * speed,
    z: dirDist.direction.z * speed
  };
  const current = cfg.velocity || { x: 0, y: 0, z: 0 };
  return {
    x: Number(current.x || 0) + ((goal.x - Number(current.x || 0)) * blend),
    y: Number(current.y || 0) + ((goal.y - Number(current.y || 0)) * blend),
    z: Number(current.z || 0) + ((goal.z - Number(current.z || 0)) * blend)
  };
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.seekCore = {
  vec3,
  normalizeVec3,
  dotVec3,
  distanceVec3,
  passesConeGate,
  selectSeekTarget,
  steerHomingVelocity
};
