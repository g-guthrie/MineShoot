#!/usr/bin/env node
/**
 * Imports the boxman MineShoot world (hand-authored AABB boxes/ramps across
 * 9 biomes) into the SDK voxel map format.
 *
 *   node tools/import-boxman.mjs [path-to-mineshoot]
 *
 * - Drives the MineShoot headless world recorder to capture every
 *   addBlock/addRamp call with position, size, rotation and material color.
 * - Voxelizes them at 1 unit = 1 block (ramps become stepped voxels).
 * - Preserves the boxman flat-color look by generating one solid-color
 *   24x24 PNG block texture per palette color (assets/blocks/boxman/).
 * - Emits assets/maps/boxman-arena.json + .meta.json (spawns, chests,
 *   items, drop region — computed from the voxelized world).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const MINESHOOT_ROOT =
  process.argv[2] ?? '/Users/gguthrie/Desktop/MineShoot-boxman-pre-clean-rebuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.join(here, '..');

// ---------------------------------------------------------------------------
// 1. Drive the MineShoot headless builders with a color-capturing recorder
// ---------------------------------------------------------------------------
const runtimeMod = await import(path.join(MINESHOOT_ROOT, 'shared/headless-world-runtime.js'));
const layout = await import(path.join(MINESHOOT_ROOT, 'shared/world-layout.js'));
// Quadrant modules register themselves on the global runtime on import.
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

/** Captured geometry: {x,y,z,w,h,d,rotY,tiltX,color,opacity} (world units). */
const entries = [];

function colorOf(material) {
  if (!material) return 0x808080;
  const c = material.color;
  return c && c.value != null ? c.value : typeof c === 'number' ? c : 0x808080;
}
function opacityOf(material) {
  if (!material) return 1;
  return material.transparent ? Number(material.opacity ?? 1) : 1;
}

const basePlace = recorder.place;
const place = {
  ...basePlace,
  addBlock(x, y, z, w, h, d, material, isSolid) {
    if (isSolid !== false) {
      entries.push({
        x, y, z, w, h, d, rotY: 0, tiltX: 0,
        color: colorOf(material), opacity: opacityOf(material),
      });
    }
    return basePlace.addBlock(x, y, z, w, h, d, material, isSolid);
  },
  addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid) {
    if (isSolid !== false) {
      entries.push({
        x, y, z, w, h, d, rotY: rotY || 0, tiltX: tiltX || 0,
        color: colorOf(material), opacity: opacityOf(material),
      });
    }
    return basePlace.addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid);
  },
};

layout.buildBiomePerimeter(place, null, layout.DEFAULT_QUADRANT_MAP);

const quadrants = runtime.WorldQuadrants || {};
const biomeCells = []; // {biome, bounds} for ground coloring
for (const entry of layout.DEFAULT_QUADRANT_MAP) {
  const builder = quadrants[entry.biome];
  if (typeof builder !== 'function') continue;
  const rawBounds = layout.quadrantBounds(entry.quadrant);
  biomeCells.push({ biome: entry.biome, bounds: rawBounds });
  builder(rawBounds, place, { ...recorder.ctx, biomeEntry: entry, rawBounds });
}

console.log(`captured ${entries.length} solid boxes/ramps across ${biomeCells.length} biomes`);

// ---------------------------------------------------------------------------
// 2. Palette: quantize colors -> block types backed by solid-color PNGs
// ---------------------------------------------------------------------------
const FIRST_BLOCK_ID = 100; // clear of the legacy registry ids
const palette = new Map(); // key -> {id, name, color, opacity}

function paletteKey(color, opacity) {
  // Light quantization merges near-identical authored shades.
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const q = v => Math.round(v / 12) * 12;
  return `${q(r)},${q(g)},${q(b)},${opacity < 0.95 ? 'T' : 'O'}`;
}

function paletteEntry(color, opacity) {
  const key = paletteKey(color, opacity);
  let entry = palette.get(key);
  if (!entry) {
    const id = FIRST_BLOCK_ID + palette.size;
    const hex = color.toString(16).padStart(6, '0');
    entry = { id, name: `boxman-${hex}${opacity < 0.95 ? '-t' : ''}`, color, opacity };
    palette.set(key, entry);
  }
  return entry;
}

// ---------------------------------------------------------------------------
// 3. Voxelize
// ---------------------------------------------------------------------------
const OFFSET = -Math.round(layout.WORLD_CENTER ?? 84); // center the world on 0,0
const blocks = new Map();
const key3 = (x, y, z) => `${x},${y},${z}`;

/** Fill voxels whose centers fall inside the (possibly rotated) box. */
function voxelize(entry) {
  if (entry.opacity < 0.5) return; // glow planes etc. — not real geometry
  const id = paletteEntry(entry.color, entry.opacity).id;

  const { x, y, z, w, h, d, rotY, tiltX } = entry;
  const maxR = Math.sqrt(w * w + h * h + d * d) / 2;
  const x0 = Math.floor(x - maxR), x1 = Math.ceil(x + maxR);
  const y0 = Math.max(0, Math.floor(y - maxR)), y1 = Math.ceil(y + maxR);
  const z0 = Math.floor(z - maxR), z1 = Math.ceil(z + maxR);

  const cy = Math.cos(-rotY), sy = Math.sin(-rotY);
  const cx = Math.cos(-tiltX), sx = Math.sin(-tiltX);
  const hw = w / 2 + 0.01, hh = h / 2 + 0.01, hd = d / 2 + 0.01;

  let filled = 0;
  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      for (let iz = z0; iz <= z1; iz++) {
        let px = ix + 0.5 - x, py = iy + 0.5 - y, pz = iz + 0.5 - z;
        // inverse yaw (about Y), then inverse tilt (about X)
        let lx = px * cy - pz * sy;
        let lz = px * sy + pz * cy;
        let ly = py * cx - lz * sx;
        lz = py * sx + lz * cx;
        if (Math.abs(lx) <= hw && Math.abs(ly) <= hh && Math.abs(lz) <= hd) {
          blocks.set(key3(ix + OFFSET, iy, iz + OFFSET), id);
          filled++;
        }
      }
    }
  }

  // Thin slabs/rails can miss every voxel center; keep at least their center.
  if (filled === 0) {
    blocks.set(key3(Math.round(x - 0.5) + OFFSET, Math.max(0, Math.round(y - 0.5)), Math.round(z - 0.5) + OFFSET), id);
  }
}

// Ground layer per biome cell, then structures on top.
const GROUND_COLORS = {
  arctic: 0xe8f4ff, desert: 0xdcc878, jungle: 0x3f7a2e, urban: 0x55585e,
  'nuclear-simpsons': 0x6a7a52, nuclear: 0x6a7a52, citadel: 0xcfd4dc,
  quarry: 0x8a7a5a, 'river-arches': 0xc9b88a, volcano: 0x2c2a32,
  'pirate-cove': 0xd8c89a, whoville: 0x7aa84a,
};

const min = Math.round(layout.WORLD_MIN), max = Math.round(layout.WORLD_MAX);
for (const cell of biomeCells) {
  const groundId = paletteEntry(GROUND_COLORS[cell.biome] ?? 0x6a7a5a, 1).id;
  const bx0 = Math.max(min, Math.floor(cell.bounds.minX ?? cell.bounds.x0 ?? min));
  const bx1 = Math.min(max, Math.ceil(cell.bounds.maxX ?? cell.bounds.x1 ?? max));
  const bz0 = Math.max(min, Math.floor(cell.bounds.minZ ?? cell.bounds.z0 ?? min));
  const bz1 = Math.min(max, Math.ceil(cell.bounds.maxZ ?? cell.bounds.z1 ?? max));
  for (let x = bx0; x <= bx1; x++) {
    for (let z = bz0; z <= bz1; z++) {
      blocks.set(key3(x + OFFSET, 0, z + OFFSET), groundId);
    }
  }
}

for (const entry of entries) voxelize(entry);

console.log(`voxelized: ${blocks.size} blocks, ${palette.size} palette colors`);

// ---------------------------------------------------------------------------
// 4. Solid-color PNG textures (minimal encoder, zero deps)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function solidPng(color, alpha, size = 24) {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const a = Math.round(alpha * 255);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let yRow = 0; yRow < size; yRow++) {
    const rowStart = yRow * (1 + size * 4);
    raw[rowStart] = 0; // filter: none
    for (let xCol = 0; xCol < size; xCol++) {
      const o = rowStart + 1 + xCol * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const texDir = path.join(gameRoot, 'assets', 'blocks', 'boxman');
fs.rmSync(texDir, { recursive: true, force: true });
fs.mkdirSync(texDir, { recursive: true });
for (const entry of palette.values()) {
  fs.writeFileSync(
    path.join(texDir, `${entry.name}.png`),
    solidPng(entry.color, entry.opacity),
  );
}

// ---------------------------------------------------------------------------
// 5. Map JSON
// ---------------------------------------------------------------------------
const BEDROCK = { id: 2, name: 'bedrock', textureUri: 'blocks/clay.png' };
const blockTypes = [
  BEDROCK,
  ...[...palette.values()].map(entry => ({
    id: entry.id,
    name: entry.name,
    textureUri: `blocks/boxman/${entry.name}.png`,
    ...(entry.opacity < 0.95 ? { isLiquid: false } : {}),
  })),
];

// Bedrock shell so nobody falls or builds out of the world.
const bMin = min + OFFSET - 1, bMax = max + OFFSET + 1;
for (let x = bMin; x <= bMax; x++) {
  for (let z = bMin; z <= bMax; z++) {
    if (x === bMin || x === bMax || z === bMin || z === bMax) {
      for (let y = 0; y <= 24; y++) blocks.set(key3(x, y, z), BEDROCK.id);
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Gameplay meta from the voxelized world
// ---------------------------------------------------------------------------
function topAt(x, z) {
  for (let y = 40; y >= 0; y--) if (blocks.has(key3(x, y, z))) return y;
  return -1;
}
function walkableY(x, z) {
  for (let y = 0; y <= 36; y++) {
    if (blocks.has(key3(x, y, z)) && !blocks.has(key3(x, y + 1, z)) && !blocks.has(key3(x, y + 2, z))) {
      return y;
    }
  }
  return -1;
}

const lo = min + OFFSET + 6, hi = max + OFFSET - 6;

/** Pick spread-out walkable points; prefer flat ground for spawns. */
function pickPoints(count, { maxY = 4, minSeparation = 14, seed = 7 } = {}) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const picked = [];
  for (let attempt = 0; attempt < count * 400 && picked.length < count; attempt++) {
    const x = Math.round(lo + rand() * (hi - lo));
    const z = Math.round(lo + rand() * (hi - lo));
    const y = walkableY(x, z);
    if (y < 0 || y > maxY) continue;
    if (picked.some(p => Math.hypot(p.x - x, p.z - z) < minSeparation)) continue;
    picked.push({ x: x + 0.5, y: y + 2, z: z + 0.5 });
  }
  return picked;
}

/** High points on structures: chest spots worth fighting for. */
function pickHighPoints(count) {
  const found = [];
  for (let x = lo; x <= hi; x += 3) {
    for (let z = lo; z <= hi; z += 3) {
      const y = walkableY(x, z);
      if (y >= 5 && y <= 24) found.push({ x: x + 0.5, y: y + 1, z: z + 0.5 });
    }
  }
  // spread them out
  found.sort((a, b) => b.y - a.y);
  const picked = [];
  for (const p of found) {
    if (picked.length >= count) break;
    if (picked.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 18)) continue;
    picked.push(p);
  }
  return picked;
}

const spawnPoints = pickPoints(16, { maxY: 4, minSeparation: 24, seed: 11 });
const groundChests = pickPoints(14, { maxY: 5, minSeparation: 18, seed: 23 })
  .map(p => ({ position: { x: p.x, y: p.y - 1, z: p.z }, yawDeg: 0 }));
const highChests = pickHighPoints(8).map(p => ({ position: p, yawDeg: 0 }));
const itemSpawns = pickPoints(16, { maxY: 6, minSeparation: 16, seed: 41 })
  .map(p => ({ x: p.x, y: p.y - 1, z: p.z }));

const meta = {
  source: 'boxman MineShoot world (imported)',
  bounds: { min: { x: bMin, z: bMin }, max: { x: bMax, z: bMax } },
  chestDropRegion: {
    min: { x: bMin + 10, y: 40, z: bMin + 10 },
    max: { x: bMax - 10, y: 40, z: bMax - 10 },
  },
  spawnPoints,
  chestSpawns: [...groundChests, ...highChests],
  itemSpawns,
};

// ---------------------------------------------------------------------------
// 7. Write
// ---------------------------------------------------------------------------
const mapsDir = path.join(gameRoot, 'assets', 'maps');
const blocksOut = {};
for (const [k, v] of blocks) blocksOut[k] = v;
fs.writeFileSync(
  path.join(mapsDir, 'boxman-arena.json'),
  JSON.stringify({ blockTypes, blocks: blocksOut }),
);
fs.writeFileSync(path.join(mapsDir, 'boxman-arena.meta.json'), JSON.stringify(meta, null, 2));

console.log(`boxman-arena: ${blocks.size} blocks, ${blockTypes.length} block types`);
console.log(`spawns: ${spawnPoints.length} players, ${meta.chestSpawns.length} chests (${highChests.length} elevated), ${itemSpawns.length} items`);
console.log(`bounds: ${bMin}..${bMax}`);
