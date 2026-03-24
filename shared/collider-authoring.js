const EPSILON = 0.0001;
const DEFAULT_RADIAL_SLICES = 7;
const DEFAULT_DOME_HEIGHT_SLICES = 4;
const DEFAULT_FRUSTUM_HEIGHT_SLICES = 3;

function clampPositive(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Math.max(0, Number(fallback || 0));
  return Math.max(0, number);
}

function normalizeOddSliceCount(value, fallback) {
  let count = Math.max(1, Math.round(Number(value || fallback || 1)));
  if ((count % 2) === 0) count += 1;
  return count;
}

function pushDiskStripBoxes(out, x, y, z, radius, height, radialSlices) {
  const safeRadius = clampPositive(radius);
  const safeHeight = clampPositive(height);
  if (!(safeRadius > EPSILON) || !(safeHeight > EPSILON)) return;

  const slices = normalizeOddSliceCount(radialSlices, DEFAULT_RADIAL_SLICES);
  const stripDepth = (safeRadius * 2) / slices;
  for (let i = 0; i < slices; i++) {
    const localMinZ = -safeRadius + (i * stripDepth);
    const localMaxZ = localMinZ + stripDepth;
    const centerLocalZ = (localMinZ + localMaxZ) * 0.5;
    const sampleAbsZ = Math.max(0, Math.min(Math.abs(localMinZ), Math.abs(localMaxZ)));
    const halfWidth = Math.sqrt(Math.max(0, (safeRadius * safeRadius) - (sampleAbsZ * sampleAbsZ)));
    const width = halfWidth * 2;
    if (!(width > EPSILON)) continue;
    out.push({
      x: Number(x || 0),
      y: Number(y || 0),
      z: Number(z || 0) + centerLocalZ,
      w: width,
      h: safeHeight,
      d: stripDepth
    });
  }
}

export function compileCylinderColliderBoxes(spec = {}) {
  const x = Number(spec.x || 0);
  const y = Number(spec.y || 0);
  const z = Number(spec.z || 0);
  const height = clampPositive(spec.height);
  const radiusTop = clampPositive(spec.radiusTop != null ? spec.radiusTop : spec.radius);
  const radiusBottom = clampPositive(spec.radiusBottom != null ? spec.radiusBottom : spec.radiusTop != null ? spec.radiusTop : spec.radius);
  if (!(height > EPSILON) || !(radiusTop > EPSILON || radiusBottom > EPSILON)) return [];

  const radialSlices = normalizeOddSliceCount(spec.radialSlices, DEFAULT_RADIAL_SLICES);
  const heightSlices = Math.max(
    1,
    Math.round(Number(
      spec.heightSlices != null
        ? spec.heightSlices
        : Math.abs(radiusTop - radiusBottom) > EPSILON
          ? DEFAULT_FRUSTUM_HEIGHT_SLICES
          : 1
    ) || 1)
  );
  const layerHeight = height / heightSlices;
  const bottomY = y - (height * 0.5);
  const out = [];

  for (let i = 0; i < heightSlices; i++) {
    const t0 = i / heightSlices;
    const t1 = (i + 1) / heightSlices;
    const layerRadius = Math.max(
      radiusBottom + ((radiusTop - radiusBottom) * t0),
      radiusBottom + ((radiusTop - radiusBottom) * t1)
    );
    const layerCenterY = bottomY + ((i + 0.5) * layerHeight);
    pushDiskStripBoxes(out, x, layerCenterY, z, layerRadius, layerHeight, radialSlices);
  }

  return out;
}

export function compileDomeColliderBoxes(spec = {}) {
  const x = Number(spec.x || 0);
  const baseY = Number(spec.baseY || 0);
  const z = Number(spec.z || 0);
  const radius = clampPositive(spec.radius);
  if (!(radius > EPSILON)) return [];

  const radialSlices = normalizeOddSliceCount(spec.radialSlices, DEFAULT_RADIAL_SLICES);
  const heightSlices = Math.max(
    1,
    Math.round(Number(spec.heightSlices || DEFAULT_DOME_HEIGHT_SLICES) || DEFAULT_DOME_HEIGHT_SLICES)
  );
  const layerHeight = radius / heightSlices;
  const out = [];

  for (let i = 0; i < heightSlices; i++) {
    const y0 = i * layerHeight;
    const y1 = (i + 1) * layerHeight;
    const layerRadius = Math.sqrt(Math.max(0, (radius * radius) - (y0 * y0)));
    const layerCenterY = baseY + ((y0 + y1) * 0.5);
    pushDiskStripBoxes(out, x, layerCenterY, z, layerRadius, layerHeight, radialSlices);
  }

  return out;
}
