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

  function record(box, isSolid, x, y, z, material, rotY, rotX) {
    const mesh = {
      position: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
      rotation: { x: Number(rotX || 0), y: Number(rotY || 0), z: 0 },
      material: material || null,
      userData: { collisionBox: box || null }
    };
    if (isSolid !== false && box) collidables.push(box);
    return mesh;
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
        return record(createRotatedBoxAabb(x, y, z, w, h, d, 0, 0), isSolid, x, y, z, material, 0, 0);
      },
      addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid) {
        return record(createRotatedBoxAabb(x, y, z, w, h, d, rotY || 0, tiltX || 0), isSolid, x, y, z, material, rotY || 0, tiltX || 0);
      },
      addDecor() {
        return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, userData: {} };
      }
    }
  };
}
