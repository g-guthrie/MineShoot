import {
  compileCylinderColliderBoxes,
  compileDomeColliderBoxes
} from './collider-authoring.js';

function createHeadlessColor(value) {
  return {
    value: value != null ? Number(value) : 0,
    setHex(next) {
      this.value = Number(next || 0);
      return this;
    },
    copy(other) {
      this.value = Number(other && other.value != null ? other.value : other || 0);
      return this;
    },
    clone() {
      return createHeadlessColor(this.value);
    }
  };
}

function createHeadlessMaterial(spec) {
  const source = spec && typeof spec === 'object' ? spec : {};
  const material = {
    transparent: !!source.transparent,
    opacity: source.opacity != null ? Number(source.opacity) : 1,
    side: source.side,
    emissiveIntensity: source.emissiveIntensity != null ? Number(source.emissiveIntensity) : 0,
    color: createHeadlessColor(source.color),
    clone() {
      return createHeadlessMaterial({
        color: this.color && this.color.value,
        transparent: this.transparent,
        opacity: this.opacity,
        side: this.side,
        emissive: this.emissive && this.emissive.value,
        emissiveIntensity: this.emissiveIntensity
      });
    }
  };
  if (source.emissive != null) material.emissive = createHeadlessColor(source.emissive);
  return material;
}

function createHeadlessVector3() {
  return {
    x: 0,
    y: 0,
    z: 0,
    set(x, y, z) {
      this.x = Number(x || 0);
      this.y = Number(y || 0);
      this.z = Number(z || 0);
      return this;
    }
  };
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

export function createRotatedBoxAabb(x, y, z, w, h, d, rotY, rotX) {
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

function headlessGeometryBounds(geometry) {
  if (!geometry) return null;
  if (
    typeof geometry.width === 'number' &&
    typeof geometry.height === 'number' &&
    typeof geometry.depth === 'number'
  ) {
    return {
      w: Math.max(0.001, Number(geometry.width || 0)),
      h: Math.max(0.001, Number(geometry.height || 0)),
      d: Math.max(0.001, Number(geometry.depth || 0))
    };
  }
  if (typeof geometry.radius === 'number') {
    const radius = Math.max(0.001, Number(geometry.radius || 0));
    const diameter = radius * 2;
    return { w: diameter, h: diameter, d: diameter };
  }
  if (typeof geometry.radiusTop === 'number' || typeof geometry.radiusBottom === 'number') {
    const radius = Math.max(
      Math.max(0.001, Number(geometry.radiusTop || 0)),
      Math.max(0.001, Number(geometry.radiusBottom || 0))
    );
    return {
      w: radius * 2,
      h: Math.max(0.001, Number(geometry.height || (radius * 2))),
      d: radius * 2
    };
  }
  if (typeof geometry.tube === 'number' || typeof geometry.radius === 'number') {
    const major = Math.max(0.001, Number(geometry.radius || 0));
    const tube = Math.max(0.001, Number(geometry.tube || 0));
    const diameter = (major + tube) * 2;
    return {
      w: diameter,
      h: tube * 2,
      d: diameter
    };
  }
  return null;
}

function createHeadlessMaterialLibrary() {
  return {
    getLambert(spec) { return createHeadlessMaterial(spec); },
    getBasic(spec) { return createHeadlessMaterial(spec); }
  };
}

export function ensureHeadlessWorldRuntime() {
  const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
  runtime.GameMaterialLibrary = runtime.GameMaterialLibrary || createHeadlessMaterialLibrary();

  if (!globalThis.THREE) globalThis.THREE = {};
  if (!globalThis.THREE.MeshStandardMaterial) {
    globalThis.THREE.MeshStandardMaterial = function MeshStandardMaterial(spec) {
      Object.assign(this, createHeadlessMaterial(spec));
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
  if (!globalThis.THREE.SphereGeometry) {
    globalThis.THREE.SphereGeometry = function SphereGeometry(radius, widthSegments, heightSegments) {
      this.radius = radius;
      this.widthSegments = widthSegments;
      this.heightSegments = heightSegments;
    };
  }
  if (!globalThis.THREE.CylinderGeometry) {
    globalThis.THREE.CylinderGeometry = function CylinderGeometry(radiusTop, radiusBottom, height, radialSegments) {
      this.radiusTop = radiusTop;
      this.radiusBottom = radiusBottom;
      this.height = height;
      this.radialSegments = radialSegments;
    };
  }
  if (!globalThis.THREE.TorusGeometry) {
    globalThis.THREE.TorusGeometry = function TorusGeometry(radius, tube, radialSegments, tubularSegments) {
      this.radius = radius;
      this.tube = tube;
      this.radialSegments = radialSegments;
      this.tubularSegments = tubularSegments;
    };
  }
  if (!globalThis.THREE.Shape) {
    globalThis.THREE.Shape = function Shape() {
      this.commands = [];
      this.holes = [];
    };
    globalThis.THREE.Shape.prototype.moveTo = function moveTo(x, y) {
      this.commands.push({ type: 'moveTo', x, y });
      return this;
    };
    globalThis.THREE.Shape.prototype.lineTo = function lineTo(x, y) {
      this.commands.push({ type: 'lineTo', x, y });
      return this;
    };
    globalThis.THREE.Shape.prototype.quadraticCurveTo = function quadraticCurveTo(cpx, cpy, x, y) {
      this.commands.push({ type: 'quadraticCurveTo', cpx, cpy, x, y });
      return this;
    };
    globalThis.THREE.Shape.prototype.absarc = function absarc(cx, cy, radius, startAngle, endAngle, clockwise) {
      this.commands.push({ type: 'absarc', cx, cy, radius, startAngle, endAngle, clockwise: !!clockwise });
      return this;
    };
    globalThis.THREE.Shape.prototype.closePath = function closePath() {
      this.commands.push({ type: 'closePath' });
      return this;
    };
  }
  if (!globalThis.THREE.ShapeGeometry) {
    globalThis.THREE.ShapeGeometry = function ShapeGeometry(shape) {
      this.shape = shape || null;
    };
  }
  if (!globalThis.THREE.Mesh) {
    globalThis.THREE.Mesh = function Mesh(geometry, material) {
      this.geometry = geometry || null;
      this.material = material || null;
      this.position = createHeadlessVector3();
      this.rotation = { x: 0, y: 0, z: 0 };
      this.userData = {};
    };
  }
  if (!globalThis.THREE.DoubleSide) globalThis.THREE.DoubleSide = 2;

  return runtime;
}

export function createHeadlessRecorder() {
  const collidables = [];
  const spawnExclusionZones = [];

  function record(box, isSolid, x, y, z, material, rotY, rotX, userData) {
    const mesh = {
      position: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
      rotation: { x: Number(rotX || 0), y: Number(rotY || 0), z: 0 },
      material: material || null,
      userData: Object.assign({ collisionBox: box || null }, userData && typeof userData === 'object' ? userData : {})
    };
    if (isSolid !== false && box) collidables.push(box);
    return mesh;
  }

  function buildColliderUserData(spec, primitive, sliceIndex, sliceCount) {
    const data = {
      collisionAuthoring: true,
      collisionPrimitive: String(primitive || ''),
      collisionSliceIndex: Math.max(0, Number(sliceIndex || 0)),
      collisionSliceCount: Math.max(1, Number(sliceCount || 1))
    };
    if (spec && spec.role) data.role = String(spec.role);
    if (spec && spec.collisionGroup) data.collisionGroup = String(spec.collisionGroup);
    const meta = spec && spec.meta && typeof spec.meta === 'object' ? spec.meta : null;
    if (meta) {
      for (const key in meta) {
        data[key] = meta[key];
      }
    }
    return data;
  }

  function recordColliderBoxes(boxes, spec, primitive) {
    const out = [];
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (!box) continue;
      out.push(record(
        createRotatedBoxAabb(box.x, box.y, box.z, box.w, box.h, box.d, 0, 0),
        true,
        box.x,
        box.y,
        box.z,
        null,
        0,
        0,
        buildColliderUserData(spec, primitive, i, boxes.length)
      ));
    }
    return out;
  }

  const scene = {
    add() {}
  };

  const ctx = {
    scene,
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
    addFlicker() {},
    addSteamColumn() {}
  };

  return {
    collidables,
    spawnExclusionZones,
    scene,
    ctx,
    place: {
      addBlock(x, y, z, w, h, d, material, isSolid) {
        void isSolid;
        return record(createRotatedBoxAabb(x, y, z, w, h, d, 0, 0), true, x, y, z, material, 0, 0);
      },
      addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid) {
        void isSolid;
        return record(createRotatedBoxAabb(x, y, z, w, h, d, rotY || 0, tiltX || 0), true, x, y, z, material, rotY || 0, tiltX || 0);
      },
      addDecor(x, y, z, geometry, material, rotY, rotX, rotZ) {
        const bounds = headlessGeometryBounds(geometry);
        const mesh = record(
          bounds ? createRotatedBoxAabb(x, y, z, bounds.w, bounds.h, bounds.d, rotY || 0, rotX || 0) : null,
          !!bounds,
          x,
          y,
          z,
          material,
          rotY || 0,
          rotX || 0,
          {}
        );
        mesh.rotation.z = Number(rotZ || 0);
        return mesh;
      },
      addBoxCollider(spec) {
        const value = spec || {};
        return recordColliderBoxes([{
          x: Number(value.x || 0),
          y: Number(value.y || 0),
          z: Number(value.z || 0),
          w: Number(value.w || 0),
          h: Number(value.h || 0),
          d: Number(value.d || 0)
        }], value, 'box');
      },
      addCylinderCollider(spec) {
        return recordColliderBoxes(compileCylinderColliderBoxes(spec || {}), spec || {}, 'cylinder');
      },
      addDomeCollider(spec) {
        return recordColliderBoxes(compileDomeColliderBoxes(spec || {}), spec || {}, 'dome');
      }
    }
  };
}
