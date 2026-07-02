#!/usr/bin/env node
/**
 * Exports the ORIGINAL boxman MineShoot world (all 9 quadrant builders,
 * kraken and pirate ship included) as a GLB of real rotated cuboids with
 * flat-color materials — no voxelization, the actual smooth geometry.
 *
 *   node tools/export-boxman-glb.mjs [path-to-mineshoot]
 *   -> assets/models/environment/boxman-world.glb
 *
 * The game spawns it as a fixed TRIMESH entity (GameManager._spawnWorldMesh).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MINESHOOT_ROOT =
  process.argv[2] ?? '/Users/gguthrie/Desktop/MineShoot-boxman-pre-clean-rebuild';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'assets', 'models', 'environment', 'boxman-world.glb');

// ---------------------------------------------------------------------------
// 1. Capture every solid box/ramp from the quadrant builders
// ---------------------------------------------------------------------------
const runtimeMod = await import(path.join(MINESHOOT_ROOT, 'shared/headless-world-runtime.js'));
const layout = await import(path.join(MINESHOOT_ROOT, 'shared/world-layout.js'));
for (const file of [
  'quadrant-arctic.js', 'quadrant-river-arches.js', 'quadrant-citadel.js',
  'quadrant-desert.js', 'quadrant-jungle.js', 'prefab-fuel-spheres.js',
  'prefab-reactor-tank.js', 'quadrant-nuclear-simpsons.js', 'quadrant-quarry.js',
  'quadrant-pirate-cove.js', 'quadrant-volcano.js', 'quadrant-urban.js',
  'quadrant-whoville.js',
]) {
  await import(path.join(MINESHOOT_ROOT, 'js/world', file));
}

const runtime = runtimeMod.ensureHeadlessWorldRuntime();
const recorder = runtimeMod.createHeadlessRecorder();
const entries = [];

function matOf(material) {
  if (!material) return { color: 0x808080, opacity: 1, emissive: 0 };
  return {
    color: material.color?.value ?? 0x808080,
    opacity: material.transparent ? Number(material.opacity ?? 1) : 1,
    emissive: material.emissive?.value ?? 0,
  };
}

const basePlace = recorder.place;
const place = {
  ...basePlace,
  addBlock(x, y, z, w, h, d, material, isSolid) {
    entries.push({ x, y, z, w, h, d, rotY: 0, tiltX: 0, solid: isSolid !== false, ...matOf(material) });
    return basePlace.addBlock(x, y, z, w, h, d, material, isSolid);
  },
  addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid) {
    entries.push({ x, y, z, w, h, d, rotY: rotY || 0, tiltX: tiltX || 0, solid: isSolid !== false, ...matOf(material) });
    return basePlace.addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid);
  },
};

layout.buildBiomePerimeter(place, null, layout.DEFAULT_QUADRANT_MAP);
const quadrants = runtime.WorldQuadrants || {};
const biomeCells = [];
for (const entry of layout.DEFAULT_QUADRANT_MAP) {
  const builder = quadrants[entry.biome];
  if (typeof builder !== 'function') continue;
  const rawBounds = layout.quadrantBounds(entry.quadrant);
  biomeCells.push({ biome: entry.biome, bounds: rawBounds });
  builder(rawBounds, place, { ...recorder.ctx, biomeEntry: entry, rawBounds });
}

// Ground slabs per biome cell (the runtime renders a ground plane separately).
const GROUND_COLORS = {
  arctic: 0xe8f4ff, desert: 0xdcc878, jungle: 0x3f7a2e, urban: 0x55585e,
  'nuclear-simpsons': 0x6a7a52, nuclear: 0x6a7a52, citadel: 0xcfd4dc,
  quarry: 0x8a7a5a, 'river-arches': 0xc9b88a, volcano: 0x2c2a32,
  'pirate-cove': 0xd8c89a, whoville: 0x7aa84a,
};
for (const cell of biomeCells) {
  const b = cell.bounds;
  const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
  entries.push({
    x: (b.minX + b.maxX) / 2, y: -0.5, z: (b.minZ + b.maxZ) / 2,
    w: w + 0.01, h: 1, d: d + 0.01,
    rotY: 0, tiltX: 0, solid: true,
    color: GROUND_COLORS[cell.biome] ?? 0x6a7a5a, opacity: 1, emissive: 0,
  });
}

console.log(`captured ${entries.length} cuboids across ${biomeCells.length} biomes`);

// ---------------------------------------------------------------------------
// 2. Build GLB: vertices PRE-BAKED into world space, one mesh per material
//    with identity transforms. (Node-transform tricks get mangled by the
//    engine's gltf-transform join pass — baked geometry survives it.)
// ---------------------------------------------------------------------------

const FACES = [
  { n: [1, 0, 0], c: [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]] },
  { n: [-1, 0, 0], c: [[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]] },
  { n: [0, 1, 0], c: [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]] },
  { n: [0, -1, 0], c: [[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]] },
  { n: [0, 0, 1], c: [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]] },
  { n: [0, 0, -1], c: [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]] },
];

// materials keyed by color+opacity+emissive; geometry accumulated per material
const materials = [];
const matIndex = new Map();
const matGeo = []; // per material: { pos: [], nrm: [], idx: [] }
function materialFor(e) {
  const key = `${e.color}|${e.opacity.toFixed(2)}|${e.emissive}`;
  if (matIndex.has(key)) return matIndex.get(key);
  const c = [(e.color >> 16 & 255) / 255, (e.color >> 8 & 255) / 255, (e.color & 255) / 255];
  const em = [(e.emissive >> 16 & 255) / 255, (e.emissive >> 8 & 255) / 255, (e.emissive & 255) / 255];
  materials.push({
    pbrMetallicRoughness: {
      baseColorFactor: [...c, e.opacity],
      metallicFactor: 0,
      roughnessFactor: 0.95,
    },
    ...(e.emissive ? { emissiveFactor: em } : {}),
    ...(e.opacity < 0.99 ? { alphaMode: 'BLEND', doubleSided: true } : {}),
  });
  matGeo.push({ pos: [], nrm: [], idx: [] });
  const idx = materials.length - 1;
  matIndex.set(key, idx);
  return idx;
}

const OFFSET = -Math.round(layout.WORLD_CENTER ?? 84); // center world on origin
let cuboids = 0;
for (const e of entries) {
  if (e.opacity < 0.05) continue;
  const g = matGeo[materialFor(e)];

  // rotation: yaw about Y then tilt about X (runtime sets mesh.rotation.x/.y)
  const cy = Math.cos(e.rotY), sy = Math.sin(e.rotY);
  const cx = Math.cos(e.tiltX), sx = Math.sin(e.tiltX);
  const rot = ([x, y, z]) => {
    // Rx (tilt) then Ry (yaw) — matches three.js applying euler.y then euler.x
    let y1 = y * cx - z * sx;
    let z1 = y * sx + z * cx;
    let x2 = x * cy + z1 * sy;
    let z2 = -x * sy + z1 * cy;
    return [x2, y1, z2];
  };

  for (const f of FACES) {
    const base = g.pos.length / 3;
    const [nx, ny, nz] = rot(f.n);
    for (const corner of f.c) {
      const [wx, wy, wz] = rot([corner[0] * e.w, corner[1] * e.h, corner[2] * e.d]);
      g.pos.push(wx + e.x + OFFSET, wy + e.y, wz + e.z + OFFSET);
      g.nrm.push(nx, ny, nz);
    }
    g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  cuboids++;
}

// assemble buffers: [pos... | nrm... | idx...] with per-material accessors
const posParts = [], nrmParts = [], idxParts = [];
let posOff = 0, nrmOff = 0, idxOff = 0;
const meta2 = [];
for (const g of matGeo) {
  const posBytes = Buffer.from(new Float32Array(g.pos).buffer);
  const nrmBytes = Buffer.from(new Float32Array(g.nrm).buffer);
  if (g.pos.length / 3 > 65535) {
    throw new Error('material group exceeds uint16 index range; split needed');
  }
  const idxBytes = Buffer.from(new Uint16Array(g.idx).buffer);
  // per-material min/max for POSITION accessor (required)
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < g.pos.length; i += 3) {
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], g.pos[i + k]); mx[k] = Math.max(mx[k], g.pos[i + k]); }
  }
  meta2.push({ posOff, nrmOff, idxOff, vCount: g.pos.length / 3, iCount: g.idx.length, mn, mx });
  posParts.push(posBytes); nrmParts.push(nrmBytes); idxParts.push(idxBytes);
  posOff += posBytes.length; nrmOff += nrmBytes.length; idxOff += idxBytes.length;
}
const posAll = Buffer.concat(posParts), nrmAll = Buffer.concat(nrmParts), idxAll = Buffer.concat(idxParts);
const bin = Buffer.concat([posAll, nrmAll, idxAll]);

const accessors = [];
const meshes = [];
const nodes = [];
meta2.forEach((m, i) => {
  const posAcc = accessors.push({ bufferView: 0, byteOffset: m.posOff, componentType: 5126, count: m.vCount, type: 'VEC3', min: m.mn, max: m.mx }) - 1;
  const nrmAcc = accessors.push({ bufferView: 1, byteOffset: m.nrmOff, componentType: 5126, count: m.vCount, type: 'VEC3' }) - 1;
  const idxAcc = accessors.push({ bufferView: 2, byteOffset: m.idxOff, componentType: 5123, count: m.iCount, type: 'SCALAR' }) - 1;
  const meshIdx = meshes.push({ primitives: [{ attributes: { POSITION: posAcc, NORMAL: nrmAcc }, indices: idxAcc, material: i }] }) - 1;
  nodes.push({ mesh: meshIdx });
});

const gltf = {
  asset: { version: '2.0', generator: 'export-boxman-glb (baked)' },
  scene: 0,
  scenes: [{ nodes: nodes.map((_, i) => i) }],
  nodes,
  meshes,
  materials,
  buffers: [{ byteLength: bin.length }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posAll.length, target: 34962 },
    { buffer: 0, byteOffset: posAll.length, byteLength: nrmAll.length, target: 34962 },
    { buffer: 0, byteOffset: posAll.length + nrmAll.length, byteLength: idxAll.length, target: 34963 },
  ],
  accessors,
};

// GLB container
const jsonBuf = Buffer.from(JSON.stringify(gltf));
const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
const binPad = (4 - (bin.length % 4)) % 4;
const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
const binChunk = Buffer.concat([bin, Buffer.alloc(binPad)]);
const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;

const out = Buffer.alloc(total);
out.writeUInt32LE(0x46546c67, 0); // magic 'glTF'
out.writeUInt32LE(2, 4);
out.writeUInt32LE(total, 8);
out.writeUInt32LE(jsonChunk.length, 12);
out.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
jsonChunk.copy(out, 20);
let o = 20 + jsonChunk.length;
out.writeUInt32LE(binChunk.length, o);
out.writeUInt32LE(0x004e4942, o + 4); // 'BIN'
binChunk.copy(out, o + 8);

fs.writeFileSync(OUT, out);

// Solid cuboids as physics colliders, in final world coordinates (the mesh
// entity spawns at y+2 over the bedrock shell; see GameManager).
const WORLD_MESH_LIFT = 2;
const colliders = entries
  .filter(e => e.solid && e.opacity >= 0.5)
  .map(e => ({
    x: +(e.x + OFFSET).toFixed(3), y: +(e.y + WORLD_MESH_LIFT).toFixed(3), z: +(e.z + OFFSET).toFixed(3),
    hx: +(e.w / 2).toFixed(3), hy: +(e.h / 2).toFixed(3), hz: +(e.d / 2).toFixed(3),
    rotY: +e.rotY.toFixed(4), tiltX: +e.tiltX.toFixed(4),
  }));
fs.writeFileSync(path.join(here, '..', 'assets', 'maps', 'boxman-world.colliders.json'), JSON.stringify(colliders));
console.log(`colliders: ${colliders.length} solid cuboids`);
console.log(`wrote ${OUT}: ${(total / 1024).toFixed(0)} KB, ${cuboids} cuboids baked, ${materials.length} materials/meshes`);
