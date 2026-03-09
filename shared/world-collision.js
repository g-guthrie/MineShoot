import './protocol.js';
import './terrain-sampler.js';
import '../js/world/intersection-builder.js';
import '../js/world/quadrant-arctic.js';
import '../js/world/quadrant-desert.js';
import '../js/world/quadrant-jungle.js';
import '../js/world/quadrant-urban.js';
import {
  WORLD_SIZE,
  WORLD_CENTER,
  WORLD_MARGIN,
  WORLD_MIN,
  WORLD_MAX,
  DEFAULT_QUADRANT_MAP,
  quadrantBounds,
  buildBiomePerimeter
} from './world-layout.js';

function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
  };
}

function headlessMaterialLibrary() {
  return {
    getLambert(spec) { return spec || {}; },
    getBasic(spec) { return spec || {}; }
  };
}

function ensureHeadlessRuntime() {
  const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
  runtime.GameMaterialLibrary = runtime.GameMaterialLibrary || headlessMaterialLibrary();
  if (!globalThis.THREE) globalThis.THREE = {};
  if (!globalThis.THREE.MeshStandardMaterial) {
    globalThis.THREE.MeshStandardMaterial = function MeshStandardMaterial(spec) {
      if (spec && typeof spec === 'object') Object.assign(this, spec);
    };
  }
  if (!globalThis.THREE.PlaneGeometry) {
    globalThis.THREE.PlaneGeometry = function PlaneGeometry(width, height) {
      this.width = width;
      this.height = height;
    };
  }
  if (!globalThis.THREE.BoxGeometry) {
    globalThis.THREE.BoxGeometry = function BoxGeometry(width, height, depth) {
      this.width = width;
      this.height = height;
      this.depth = depth;
    };
  }
  if (!globalThis.THREE.DoubleSide) globalThis.THREE.DoubleSide = 2;
  return runtime;
}

function pushPoint(points, x, y, z, rotY, rotX) {
  let nx = x;
  let ny = y;
  let nz = z;

  if (rotX) {
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const rx = ny * cosX - nz * sinX;
    const rz = ny * sinX + nz * cosX;
    ny = rx;
    nz = rz;
  }

  if (rotY) {
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const rx = nx * cosY + nz * sinY;
    const rz = (-nx * sinY) + nz * cosY;
    nx = rx;
    nz = rz;
  }

  points.push({ x: nx, y: ny, z: nz });
}

function rotatedBoxAabb(x, y, z, w, h, d, rotY, rotX) {
  const hx = Number(w || 0) * 0.5;
  const hy = Number(h || 0) * 0.5;
  const hz = Number(d || 0) * 0.5;
  const points = [];
  const xs = [-hx, hx];
  const ys = [-hy, hy];
  const zs = [-hz, hz];
  for (let xi = 0; xi < xs.length; xi++) {
    for (let yi = 0; yi < ys.length; yi++) {
      for (let zi = 0; zi < zs.length; zi++) {
        pushPoint(points, xs[xi], ys[yi], zs[zi], Number(rotY || 0), Number(rotX || 0));
      }
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    minX = Math.min(minX, x + p.x);
    minY = Math.min(minY, y + p.y);
    minZ = Math.min(minZ, z + p.z);
    maxX = Math.max(maxX, x + p.x);
    maxY = Math.max(maxY, y + p.y);
    maxZ = Math.max(maxZ, z + p.z);
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ }
  };
}

function buildRecorder() {
  const collidables = [];
  const spawnExclusionZones = [];

  function record(box, isSolid) {
    const mesh = {
      userData: { collisionBox: box || null }
    };
    if (isSolid !== false && box) collidables.push(box);
    return mesh;
  }

  return {
    collidables,
    spawnExclusionZones,
    place: {
      addBlock(x, y, z, w, h, d, _material, isSolid) {
        return record(rotatedBoxAabb(x, y, z, w, h, d, 0, 0), isSolid);
      },
      addRamp(x, y, z, w, h, d, _material, rotY, tiltX, isSolid) {
        return record(rotatedBoxAabb(x, y, z, w, h, d, rotY || 0, tiltX || 0), isSolid);
      },
      addDecor() {
        return { userData: {} };
      }
    },
    ctx: {
      addExclusion(x, z, r) {
        spawnExclusionZones.push({
          x: Number(x || 0),
          z: Number(z || 0),
          radius: Math.max(0.1, Number(r || 0.1))
        });
      },
      addWaterfallSheet() {},
      addMistCard() {},
      addLeafSway() {},
      addIceShimmer() {},
      addFlicker() {}
    }
  };
}

export function buildWorldCollisionData(worldMeta) {
  const runtime = ensureHeadlessRuntime();
  const recorder = buildRecorder();
  const intersections = runtime.WorldIntersections || {};
  const quadrants = runtime.WorldQuadrants || {};

  buildBiomePerimeter(recorder.place, null);

  if (typeof intersections.stampIntersection === 'function') {
    intersections.stampIntersection({
      centerX: WORLD_CENTER,
      centerZ: WORLD_CENTER,
      span: WORLD_SIZE - (WORLD_MARGIN * 2.2),
      place: recorder.place,
      materialLibrary: runtime.GameMaterialLibrary,
      seamMaterial: null,
      seamSpec: (typeof intersections.createSeamSpec === 'function')
        ? intersections.createSeamSpec({ armWidth: 1.06, height: 0.16 })
        : { armWidth: 1.06, halfWidth: 0.53, height: 0.16 },
      biomeMap: DEFAULT_QUADRANT_MAP.slice()
    });
  }

  for (let qi = 0; qi < DEFAULT_QUADRANT_MAP.length; qi++) {
    const entry = DEFAULT_QUADRANT_MAP[qi];
    const builder = quadrants[entry.biome];
    if (typeof builder !== 'function') continue;
    builder(quadrantBounds(entry.quadrant, 6), recorder.place, recorder.ctx);
  }

  return {
    worldSeed: String(worldMeta && worldMeta.worldSeed || ''),
    worldProfileVersion: Number(worldMeta && worldMeta.worldProfileVersion || 0),
    worldFlags: cloneWorldFlags(worldMeta && worldMeta.worldFlags),
    boundsMin: WORLD_MIN,
    boundsMax: WORLD_MAX,
    collidables: recorder.collidables.slice(),
    spawnExclusionZones: recorder.spawnExclusionZones.slice()
  };
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.worldCollision = {
  buildWorldCollisionData
};
