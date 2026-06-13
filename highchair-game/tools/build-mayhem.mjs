#!/usr/bin/env node
/**
 * Mayhem Arena: a hand-authored 3x3 biome battleground using the boxman
 * MineShoot world as the layout template, rebuilt with the engine's full
 * textured block palette.
 *
 *   NW arctic mountain | N  citadel        | NE desert mesas
 *   W  skatepark       | C  river crossing | E  jungle ruin
 *   SW volcano         | S  quarry pit     | SE pirate cove
 *
 * Run: node tools/build-mayhem.mjs   ->  assets/maps/mayhem-arena.json (+ .meta.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = Number(process.argv[2] ?? 6121);

// ---------------------------------------------------------------------------
// Block ids (legacy registry, same ids as the biome arena)
// ---------------------------------------------------------------------------
const B = {
  BRICKS: 1, BEDROCK: 2, COAL_ORE: 3, COBBLE: 4, DIAMOND: 6, DIRT: 8, DRAGON: 9,
  EMERALD: 11, EMERALD_ORE: 12, GLASS: 14, GOLD_ORE: 15, GRASS: 16,
  GRAVEL: 17, ICE: 18, INFECTED_CORE: 19, INFECTED: 20, IRON_ORE: 21,
  LAVA: 22, LOG: 23, MOSSY: 24, NUIT_LEAVES: 25, OAK_LEAVES: 27,
  OAK_PLANKS: 28, SAND_LIGHT: 29, SAND: 30, SANDSTONE_LIGHT: 31,
  SANDSTONE: 32, SHADOW_PEBBLE: 33, SHADOWROCK: 34, SNOW: 35,
  STONE_BRICKS: 36, STONE: 37, SWIRL_RUNE: 38, WATER: 43,
  SNOW_ICY: 44, SNOW_ROUGH: 45, SNOW_PEBBLES: 46, SNOW_ROCKS: 47,
  ICE_BLOCK: 48, SHALE_TOP: 49, SHALE_BOTTOM: 50, SHALE_ROCK: 51,
  LAVA_DIRT: 52, LAVA_DIRT_CRACKED: 53, LAVA_ROCKY: 54,
  JUNGLE: 56, JUNGLE_MOSSY: 57, JUNGLE_DAMAGED: 58, JUNGLE_DIRT: 59,
  JUNGLE_DIRT_ROOTS: 60, JUNGLE_DIRT_TRAMPLED: 61, COBBLE_DARK: 62,
  COBBLE_LARGE_DARK: 63, OAK_DARK: 64, OAK_SLATS: 65, OAK_SLATS_DARK: 66,
  CRACKED_SAND: 67, GLASS_WINDOW: 68,
};

const BLOCK_TYPES = [
  { id: 1, name: 'bricks', textureUri: 'blocks/bricks.png' },
  { id: 2, name: 'bedrock', textureUri: 'blocks/clay.png' },
  { id: 3, name: 'coal-ore', textureUri: 'blocks/coal-ore.png' },
  { id: 4, name: 'cobblestone', textureUri: 'blocks/cobblestone.png' },
  { id: 6, name: 'diamond-block', textureUri: 'blocks/diamond-block.png' },
  { id: 8, name: 'dirt', textureUri: 'blocks/dirt.png' },
  { id: 9, name: 'dragon_block', textureUri: 'blocks/dragon_block' },
  { id: 11, name: 'emerald-block', textureUri: 'blocks/emerald-block.png' },
  { id: 12, name: 'emerald-ore', textureUri: 'blocks/emerald-ore.png' },
  { id: 14, name: 'glass', textureUri: 'blocks/glass.png' },
  { id: 15, name: 'gold-ore', textureUri: 'blocks/gold-ore.png' },
  { id: 16, name: 'grass', textureUri: 'blocks/grass' },
  { id: 17, name: 'gravel', textureUri: 'blocks/gravel.png' },
  { id: 18, name: 'ice', textureUri: 'blocks/ice.png' },
  { id: 19, name: 'infected-shadowrock-core', textureUri: 'blocks/infected-shadowrock-core.png' },
  { id: 20, name: 'infected-shadowrock', textureUri: 'blocks/infected-shadowrock.png' },
  { id: 21, name: 'iron-ore', textureUri: 'blocks/iron-ore.png' },
  { id: 22, name: 'lava', textureUri: 'blocks/lava.png', isLiquid: true },
  { id: 23, name: 'log', textureUri: 'blocks/log' },
  { id: 24, name: 'mossy-coblestone', textureUri: 'blocks/mossy-coblestone.png' },
  { id: 25, name: 'nuit-leaves', textureUri: 'blocks/nuit-leaves.png' },
  { id: 27, name: 'oak-leaves', textureUri: 'blocks/oak-leaves.png' },
  { id: 28, name: 'oak-planks', textureUri: 'blocks/oak-planks.png' },
  { id: 29, name: 'sand-light', textureUri: 'blocks/sand-light.png' },
  { id: 30, name: 'sand', textureUri: 'blocks/sand.png' },
  { id: 31, name: 'sandstone-light', textureUri: 'blocks/sandstone-light.png' },
  { id: 32, name: 'sandstone', textureUri: 'blocks/sandstone.png' },
  { id: 33, name: 'shadow-pebble', textureUri: 'blocks/shadow-pebble.png' },
  { id: 34, name: 'shadowrock', textureUri: 'blocks/shadowrock.png' },
  { id: 35, name: 'snow', textureUri: 'blocks/snow.png' },
  { id: 36, name: 'stone-bricks', textureUri: 'blocks/stone-bricks.png' },
  { id: 37, name: 'stone', textureUri: 'blocks/stone.png' },
  { id: 38, name: 'swirl-rune', textureUri: 'blocks/swirl-rune.png' },
  { id: 43, name: 'water-still', textureUri: 'blocks/water-still.png', isLiquid: true },
  { id: 44, name: 'snow-icy', textureUri: 'blocks/snow-icy.png' },
  { id: 45, name: 'snow-rough', textureUri: 'blocks/snow-rough.png' },
  { id: 46, name: 'snow-pebbles', textureUri: 'blocks/snow-pebbles.png' },
  { id: 47, name: 'snow-rocks', textureUri: 'blocks/snow-rocks.png' },
  { id: 48, name: 'ice-block', textureUri: 'blocks/ice-block.png' },
  { id: 49, name: 'shale-cliff-top', textureUri: 'blocks/shale-cliff-top' },
  { id: 50, name: 'shale-cliff-bottom', textureUri: 'blocks/shale-cliff-bottom' },
  { id: 51, name: 'shale-rock', textureUri: 'blocks/shale-rock.png' },
  { id: 52, name: 'lava-dirt', textureUri: 'blocks/lava-dirt.png' },
  { id: 53, name: 'lava-dirt-cracked', textureUri: 'blocks/lava-dirt-cracked.png' },
  { id: 54, name: 'lava-rocky', textureUri: 'blocks/lava-rocky.png' },
  { id: 56, name: 'jungle-block', textureUri: 'blocks/jungle-block.png' },
  { id: 57, name: 'jungle-block-mossy', textureUri: 'blocks/jungle-block-mossy.png' },
  { id: 58, name: 'jungle-block-damaged', textureUri: 'blocks/jungle-block-damaged.png' },
  { id: 59, name: 'jungle-dirt', textureUri: 'blocks/jungle-dirt.png' },
  { id: 60, name: 'jungle-dirt-roots', textureUri: 'blocks/jungle-dirt-roots.png' },
  { id: 61, name: 'jungle-dirt-trampled', textureUri: 'blocks/jungle-dirt-trampled.png' },
  { id: 62, name: 'cobblestone-dark', textureUri: 'blocks/cobblestone-dark.png' },
  { id: 63, name: 'cobblestone-large-dark', textureUri: 'blocks/cobblestone-large-dark.png' },
  { id: 64, name: 'oak-planks-dark', textureUri: 'blocks/oak-planks-dark.png' },
  { id: 65, name: 'oak-slats', textureUri: 'blocks/oak-slats.png' },
  { id: 66, name: 'oak-slats-dark', textureUri: 'blocks/oak-slats-dark.png' },
  { id: 67, name: 'cracked_sand', textureUri: 'blocks/cracked_sand' },
  { id: 68, name: 'glass-window', textureUri: 'blocks/glass-window.png' },
];

// ---------------------------------------------------------------------------
// RNG / noise / storage
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
function hash2(x, z, salt) {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(salt, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = t => t * t * (3 - 2 * t);
function valueNoise(x, z, scale, salt) {
  const fx = x / scale, fz = z / scale;
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const tx = smooth(fx - x0), tz = smooth(fz - z0);
  const a = hash2(x0, z0, salt), b = hash2(x0 + 1, z0, salt);
  const c = hash2(x0, z0 + 1, salt), d = hash2(x0 + 1, z0 + 1, salt);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}
const fbm = (x, z, salt) =>
  valueNoise(x, z, 22, salt) * 0.65 + valueNoise(x, z, 9, salt + 1) * 0.35;

const R = 84;            // world half-extent
const CELL = 56;         // 3x3 cells of 56 = 168
const RIM = 76;          // mountains rise outside this
const blocks = new Map();
const reserved = new Set();

const key3 = (x, y, z) => `${x},${y},${z}`;
const set = (x, y, z, id) => blocks.set(key3(Math.round(x), Math.round(y), Math.round(z)), id);
const unset = (x, y, z) => blocks.delete(key3(Math.round(x), Math.round(y), Math.round(z)));
const reserve = (x, z, m = 0) => {
  for (let dx = -m; dx <= m; dx++)
    for (let dz = -m; dz <= m; dz++) reserved.add(`${x + dx},${z + dz}`);
};
const isReserved = (x, z) => reserved.has(`${x},${z}`);

function fillBox(x1, y1, z1, x2, y2, z2, id) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
      for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) set(x, y, z, id);
}
function clearBox(x1, y1, z1, x2, y2, z2) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
      for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) unset(x, y, z);
}
function walls(x1, z1, x2, z2, y1, y2, id) {
  for (let x = x1; x <= x2; x++)
    for (let z = z1; z <= z2; z++) {
      if (x === x1 || x === x2 || z === z1 || z === z2) {
        for (let y = y1; y <= y2; y++) set(x, y, z, id);
      }
    }
}
function pick(weighted) {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [id, w] of weighted) {
    r -= w;
    if (r <= 0) return id;
  }
  return weighted[0][0];
}
function topAt(x, z) {
  for (let y = 44; y >= 0; y--) if (blocks.has(key3(x, y, z))) return y;
  return 1;
}
/** A stepped ramp along +x/-x/+z/-z: each step is `width` wide, 1 high. */
function ramp(x, y, z, dir, length, width, id) {
  const [dx, dz] = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] }[dir];
  const [px, pz] = [dz, dx]; // perpendicular
  for (let i = 0; i < length; i++) {
    for (let j = -Math.floor(width / 2); j <= Math.floor(width / 2); j++) {
      for (let yy = y; yy <= y + i; yy++) {
        set(x + dx * i + px * j, yy, z + dz * i + pz * j, id);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Biome ground definitions (cell coords: col,row in 0..2, north = -z)
// ---------------------------------------------------------------------------
const CELLS = [
  { col: 0, row: 0, name: 'arctic' }, { col: 1, row: 0, name: 'citadel' }, { col: 2, row: 0, name: 'desert' },
  { col: 0, row: 1, name: 'skatepark' }, { col: 1, row: 1, name: 'river' }, { col: 2, row: 1, name: 'jungle' },
  { col: 0, row: 2, name: 'volcano' }, { col: 1, row: 2, name: 'quarry' }, { col: 2, row: 2, name: 'cove' },
];
const GROUND = {
  arctic: { surface: [[B.SNOW, 12], [B.SNOW_ROUGH, 3], [B.SNOW_ICY, 1], [B.SNOW_PEBBLES, 1]], fill: B.DIRT, amp: 2.2 },
  citadel: { surface: [[B.GRASS, 8], [B.SAND_LIGHT, 1]], fill: B.DIRT, amp: 1.2 },
  desert: { surface: [[B.SAND, 10], [B.SAND_LIGHT, 4], [B.CRACKED_SAND, 1]], fill: B.SANDSTONE, amp: 2.0 },
  skatepark: { surface: [[B.STONE, 10], [B.COBBLE, 1.5], [B.GRAVEL, 0.8]], fill: B.STONE, amp: 0.6 },
  river: { surface: [[B.GRASS, 10], [B.JUNGLE_DIRT_TRAMPLED, 1]], fill: B.DIRT, amp: 1.2 },
  jungle: { surface: [[B.GRASS, 9], [B.JUNGLE_DIRT, 2], [B.JUNGLE_DIRT_ROOTS, 1]], fill: B.JUNGLE_DIRT, amp: 1.8 },
  volcano: { surface: [[B.LAVA_DIRT, 8], [B.LAVA_DIRT_CRACKED, 3], [B.SHADOW_PEBBLE, 2]], fill: B.SHADOWROCK, amp: 1.6 },
  quarry: { surface: [[B.GRAVEL, 6], [B.DIRT, 4], [B.STONE, 2]], fill: B.STONE, amp: 1.4 },
  cove: { surface: [[B.SAND_LIGHT, 10], [B.SAND, 5]], fill: B.SAND, amp: 1.2 },
};

function cellAt(x, z) {
  const col = Math.min(2, Math.max(0, Math.floor((x + R) / CELL)));
  const row = Math.min(2, Math.max(0, Math.floor((z + R) / CELL)));
  return CELLS.find(c => c.col === col && c.row === row);
}
const cellCenter = name => {
  const c = CELLS.find(e => e.name === name);
  return { x: (c.col - 1) * CELL, z: (c.row - 1) * CELL };
};

// River path: gentle S-curve north-to-south through the center column.
function riverOffset(z) {
  return Math.round(Math.sin(z * 0.05) * 7);
}
function inRiver(x, z) {
  const center = riverOffset(z);
  return Math.abs(x - center) <= 3;
}
function inRiverBank(x, z) {
  const center = riverOffset(z);
  return Math.abs(x - center) <= 5;
}

// ---------------------------------------------------------------------------
// Pass 1: terrain (float heights, blurred, then quantized)
// ---------------------------------------------------------------------------
const rawH = new Map();
for (let x = -R - 1; x <= R + 1; x++) {
  for (let z = -R - 1; z <= R + 1; z++) {
    const cell = cellAt(x, z);
    const g = GROUND[cell.name];
    let h = 2 + fbm(x, z, 7) * g.amp;

    // skatepark and citadel grounds are deliberately flat
    if (cell.name === 'skatepark' || cell.name === 'citadel') h = 2 + fbm(x, z, 7) * g.amp * 0.4;

    // volcano cone (SW): rises toward its center
    if (cell.name === 'volcano') {
      const c = cellCenter('volcano');
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < 22) h += smooth(Math.min(1, (22 - d) / 22)) * 13;
    }

    // arctic mountain (NW)
    if (cell.name === 'arctic') {
      const c = cellCenter('arctic');
      const d = Math.hypot(x - (c.x - 6), z - (c.z - 6));
      if (d < 20) h += smooth(Math.min(1, (20 - d) / 20)) * 11;
    }

    // quarry pit (S): sinks toward its center in terraces (rounded later)
    if (cell.name === 'quarry') {
      const c = cellCenter('quarry');
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < 20) h -= smooth(Math.min(1, (20 - d) / 20)) * 7;
    }

    // cove (SE): dips to sea level toward the corner inlet
    if (cell.name === 'cove') {
      const d = Math.hypot(x - 62, z - 62);
      if (d < 30) h -= smooth(Math.min(1, (30 - d) / 30)) * 2.2;
    }

    // river valley through the middle column
    if (Math.abs(x - riverOffset(z)) < 10 && Math.abs(z) < R) {
      const t = 1 - Math.abs(x - riverOffset(z)) / 10;
      h = h * (1 - smooth(t) * 0.6) + 1.6 * smooth(t) * 0.6;
    }

    // rim mountains
    const cheb = Math.max(Math.abs(x), Math.abs(z));
    if (cheb > RIM) h += smooth(Math.min(1, (cheb - RIM) / (R - RIM))) * 8;

    rawH.set(`${x},${z}`, h);
  }
}
function heightAt(x, z) {
  let sum = 0;
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) sum += rawH.get(`${x + dx},${z + dz}`) ?? 2;
  return Math.max(1, Math.round(sum / 9));
}

for (let x = -R; x <= R; x++) {
  for (let z = -R; z <= R; z++) {
    const cell = cellAt(x, z);
    const g = GROUND[cell.name];
    let h = heightAt(x, z);
    let surface = pick(g.surface);
    let fill = g.fill;

    // quarry terraces: quantize the pit into 2-block benches
    if (cell.name === 'quarry') {
      const c = cellCenter('quarry');
      if (Math.hypot(x - c.x, z - c.z) < 21) h = Math.max(1, Math.round(h / 2) * 2);
    }

    if (inRiver(x, z)) {
      h = 1;
      surface = B.WATER;
      fill = B.GRAVEL;
      reserve(x, z);
    } else if (inRiverBank(x, z)) {
      surface = B.SAND_LIGHT;
    }

    // cove water: anything that dipped below sea level becomes sea
    if (cell.name === 'cove' && h <= 1) {
      h = 1;
      surface = B.WATER;
      fill = B.SAND;
      reserve(x, z);
    }

    set(x, 0, z, B.BEDROCK);
    for (let y = 1; y < h; y++) set(x, y, z, fill);
    set(x, h, z, surface);

    const cheb = Math.max(Math.abs(x), Math.abs(z));
    if (cheb >= R - 1) for (let y = 1; y <= 22; y++) set(x, y, z, B.BEDROCK);
    if (cheb > RIM) reserve(x, z);
  }
}

// ---------------------------------------------------------------------------
// Pass 2: landmarks
// ---------------------------------------------------------------------------

// --- NW arctic: shale-banded mountain with climbing shelves + frozen lake ---
(function arctic() {
  const c = cellCenter('arctic');
  const mx = c.x - 6, mz = c.z - 6;
  // shale band partway up the cone + summit beacon
  for (let x = mx - 20; x <= mx + 20; x++) {
    for (let z = mz - 20; z <= mz + 20; z++) {
      const top = topAt(x, z);
      if (top >= 8 && top <= 11) set(x, top, z, B.SHALE_TOP);
      if (top >= 12) set(x, top, z, B.SNOW);
    }
  }
  const peak = topAt(mx, mz);
  fillBox(mx - 1, peak + 1, mz - 1, mx + 1, peak + 1, mz + 1, B.ICE_BLOCK);
  set(mx, peak + 2, mz, B.DIAMOND);
  // climbing shelves spiraling the east face
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    const sx = mx + Math.round(Math.cos(a) * (16 - i * 1.5));
    const sz = mz + Math.round(Math.sin(a) * (16 - i * 1.5));
    const sy = topAt(sx, sz);
    fillBox(sx - 1, sy, sz - 1, sx + 1, sy, sz + 1, B.SHALE_ROCK);
  }
  // frozen lake SE of the mountain
  for (let x = c.x + 8; x <= c.x + 22; x++) {
    for (let z = c.z + 6; z <= c.z + 18; z++) {
      if (((x - (c.x + 15)) / 7) ** 2 + ((z - (c.z + 12)) / 6) ** 2 <= 1) {
        clearBox(x, 2, z, x, 20, z);
        set(x, 2, z, B.ICE);
        reserve(x, z);
      }
    }
  }
})();

// --- N citadel: white fortress with corner towers and a great hall ---
(function citadel() {
  const c = cellCenter('citadel');
  const x1 = c.x - 16, z1 = c.z - 14, x2 = c.x + 16, z2 = c.z + 14;
  reserveCellRect(x1, z1, x2, z2, 3);
  const base = 3;
  for (let x = x1; x <= x2; x++)
    for (let z = z1; z <= z2; z++) {
      for (let y = 1; y < base; y++) set(x, y, z, B.SANDSTONE_LIGHT);
      set(x, base, z, (x + z) % 7 === 0 ? B.SANDSTONE_LIGHT : B.STONE_BRICKS);
      clearBox(x, base + 1, z, x, base + 18, z);
    }
  walls(x1, z1, x2, z2, base + 1, base + 5, B.SANDSTONE_LIGHT);
  // battlements
  for (let x = x1; x <= x2; x += 2) { set(x, base + 6, z1, B.SANDSTONE_LIGHT); set(x, base + 6, z2, B.SANDSTONE_LIGHT); }
  for (let z = z1; z <= z2; z += 2) { set(x1, base + 6, z, B.SANDSTONE_LIGHT); set(x2, base + 6, z, B.SANDSTONE_LIGHT); }
  // gates on south + north
  clearBox(c.x - 2, base + 1, z2, c.x + 2, base + 4, z2);
  clearBox(c.x - 2, base + 1, z1, c.x + 2, base + 4, z1);
  // corner towers
  for (const [tx, tz] of [[x1 + 2, z1 + 2], [x2 - 2, z1 + 2], [x1 + 2, z2 - 2], [x2 - 2, z2 - 2]]) {
    fillBox(tx - 2, base + 1, tz - 2, tx + 2, base + 10, tz + 2, B.SANDSTONE_LIGHT);
    clearBox(tx - 1, base + 1, tz - 1, tx + 1, base + 9, tz + 1);
    for (let y = base + 1; y <= base + 9; y += 2) set(tx, y, tz, B.OAK_SLATS);
    walls(tx - 2, tz - 2, tx + 2, tz + 2, base + 11, base + 11, B.SANDSTONE_LIGHT);
    // window slits
    set(tx - 2, base + 6, tz, B.GLASS_WINDOW); set(tx + 2, base + 6, tz, B.GLASS_WINDOW);
  }
  // central great hall with glass clerestory
  fillBox(c.x - 7, base + 1, c.z - 5, c.x + 7, base + 7, c.z + 5, B.STONE_BRICKS);
  clearBox(c.x - 6, base + 1, c.z - 4, c.x + 6, base + 6, c.z + 4);
  for (let x = c.x - 5; x <= c.x + 5; x += 2) { set(x, base + 5, c.z - 5, B.GLASS_WINDOW); set(x, base + 5, c.z + 5, B.GLASS_WINDOW); }
  clearBox(c.x - 1, base + 1, c.z - 5, c.x + 1, base + 3, c.z - 5);
  clearBox(c.x - 1, base + 1, c.z + 5, c.x + 1, base + 3, c.z + 5);
  set(c.x, base + 1, c.z, B.SWIRL_RUNE); // hall centerpiece
  set(c.x, base + 8, c.z, B.EMERALD);
})();

// --- NE desert: twin mesas + natural arch ---
(function desert() {
  const c = cellCenter('desert');
  const mesa = (mx, mz, r, hgt) => {
    for (let x = mx - r; x <= mx + r; x++) {
      for (let z = mz - r; z <= mz + r; z++) {
        const d = Math.hypot(x - mx, z - mz);
        if (d > r) continue;
        const noise = hash2(x, z, 31) * 1.5;
        const top = 2 + Math.round(hgt * Math.min(1, (r - d) / 2.5) + noise * 0.4);
        for (let y = 2; y <= top; y++) set(x, y, z, y === top ? B.CRACKED_SAND : y > top - 3 ? B.SANDSTONE : B.SANDSTONE_LIGHT);
      }
    }
    reserveCellRect(mx - r, mz - r, mx + r, mz + r, 1);
  };
  mesa(c.x - 10, c.z - 8, 9, 9);
  mesa(c.x + 12, c.z + 6, 7, 7);
  // ramp up the big mesa
  ramp(c.x - 10 + 9, 3, c.z - 8, 'e', 6, 3, B.SANDSTONE);
  // natural arch between them
  const ax = c.x + 1, az = c.z - 1;
  for (let i = -5; i <= 5; i++) {
    const yArc = 2 + Math.round(6 - (i * i) / 5);
    set(ax + i, yArc, az, B.SANDSTONE);
    set(ax + i, yArc - 1, az, B.SANDSTONE);
    if (Math.abs(i) === 5) fillBox(ax + i, 2, az, ax + i, yArc, az, B.SANDSTONE);
  }
  reserveCellRect(ax - 6, az - 1, ax + 6, az + 1, 0);
})();

// --- W skatepark: bowls, quarter pipes, rails, fun box ---
(function skatepark() {
  const c = cellCenter('skatepark');
  reserveCellRect(c.x - 20, c.z - 18, c.x + 20, c.z + 18, 2);
  // flatten plaza
  for (let x = c.x - 20; x <= c.x + 20; x++)
    for (let z = c.z - 18; z <= c.z + 18; z++) {
      clearBox(x, 3, z, x, 24, z);
      set(x, 2, z, (x % 6 === 0 || z % 6 === 0) ? B.COBBLE : B.STONE);
    }
  // bowl (sunken)
  for (let x = c.x - 14; x <= c.x - 4; x++)
    for (let z = c.z - 12; z <= c.z - 2; z++) {
      const d = Math.hypot(x - (c.x - 9), z - (c.z - 7));
      if (d <= 5.5) {
        clearBox(x, 1, z, x, 2, z);
        set(x, d <= 3 ? 1 : 2, z, B.STONE); // sunken bowl floor
      }
    }
  // quarter pipe (stepped) along the north edge
  ramp(c.x - 16, 3, c.z - 16, 'n', 4, 9, B.STONE);
  // fun box with rails
  fillBox(c.x + 2, 3, c.z + 2, c.x + 10, 4, c.z + 6, B.BRICKS);
  fillBox(c.x + 2, 5, c.z + 4, c.x + 10, 5, c.z + 4, B.OAK_SLATS_DARK); // rail
  ramp(c.x + 1, 3, c.z + 4, 'w', 2, 5, B.BRICKS);
  // colored paint accents
  for (let i = 0; i < 14; i++) {
    const x = c.x - 18 + Math.floor(rng() * 36);
    const z = c.z - 16 + Math.floor(rng() * 32);
    if (!blocks.has(key3(x, 3, z))) set(x, 2, z, [B.EMERALD, B.DIAMOND, B.BRICKS][Math.floor(rng() * 3)]);
  }
  // perimeter rails
  for (let x = c.x - 20; x <= c.x + 20; x += 2) { set(x, 3, c.z + 18, B.OAK_SLATS); }
})();

// --- C river crossing: two arched stone bridges + fishing hut ---
(function river() {
  for (const bz of [-10, 14]) {
    const cx = riverOffset(bz);
    for (let i = -6; i <= 6; i++) {
      const y = 2 + Math.round(2.4 - (i * i) / 14);
      fillBox(cx + i, y, bz - 2, cx + i, y, bz + 2, B.STONE_BRICKS);
      set(cx + i, y + 1, bz - 2, B.COBBLE_DARK);
      set(cx + i, y + 1, bz + 2, B.COBBLE_DARK);
      reserve(cx + i, bz, 2);
    }
  }
  // fishing hut on the east bank
  const hx = riverOffset(2) + 8, hz = 2;
  reserveCellRect(hx - 3, hz - 3, hx + 3, hz + 3, 1);
  const hy = topAt(hx, hz);
  fillBox(hx - 3, hy + 1, hz - 3, hx + 3, hy + 4, hz + 3, B.OAK_PLANKS);
  clearBox(hx - 2, hy + 1, hz - 2, hx + 2, hy + 3, hz + 2);
  clearBox(hx - 3, hy + 1, hz, hx - 3, hy + 2, hz);
  fillBox(hx - 4, hy + 5, hz - 4, hx + 4, hy + 5, hz + 4, B.OAK_SLATS_DARK);
  // little dock
  fillBox(hx - 8, 2, hz, hx - 4, 2, hz + 1, B.OAK_DARK);
})();

// --- E jungle: canopy + ruined shrine ---
(function jungle() {
  const c = cellCenter('jungle');
  // ruined shrine
  const sx = c.x + 4, sz = c.z - 4;
  reserveCellRect(sx - 6, sz - 6, sx + 6, sz + 6, 1);
  const base = topAt(sx, sz);
  fillBox(sx - 6, base + 1, sz - 6, sx + 6, base + 1, sz + 6, B.MOSSY);
  walls(sx - 5, sz - 5, sx + 5, sz + 5, base + 2, base + 4, B.JUNGLE_MOSSY);
  clearBox(sx - 5, base + 2, sz, sx - 5, base + 3, sz + 1);
  clearBox(sx + 5, base + 2, sz - 1, sx + 5, base + 3, sz);
  // broken: knock holes in the walls
  for (let i = 0; i < 14; i++) {
    const wx = sx - 5 + Math.floor(rng() * 11);
    const wz = rng() < 0.5 ? sz - 5 : sz + 5;
    clearBox(wx, base + 3 + Math.floor(rng() * 2), wz, wx, base + 4, wz);
  }
  fillBox(sx - 1, base + 2, sz - 1, sx + 1, base + 2, sz + 1, B.JUNGLE_DAMAGED);
  set(sx, base + 3, sz, B.GOLD_ORE);
})();

// --- SW volcano: crater with lava pool + lava stream ---
(function volcano() {
  const c = cellCenter('volcano');
  // crater
  for (let x = c.x - 6; x <= c.x + 6; x++)
    for (let z = c.z - 6; z <= c.z + 6; z++) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d <= 5.5) {
        const top = topAt(x, z);
        clearBox(x, top - 2, z, x, 40, z);
        set(x, top - 3, z, d <= 4 ? B.LAVA : B.LAVA_ROCKY);
      }
    }
  // rocky rim accents
  for (let a = 0; a < 14; a++) {
    const ang = (a / 14) * Math.PI * 2;
    const x = c.x + Math.round(Math.cos(ang) * 7);
    const z = c.z + Math.round(Math.sin(ang) * 7);
    const y = topAt(x, z);
    if (a % 3 === 0) fillBox(x, y + 1, z, x, y + 1 + (a % 2), z, B.SHADOWROCK);
  }
  // lava stream flowing NE toward the river valley
  for (let i = 0; i < 26; i++) {
    const x = c.x + 7 + i;
    const z = c.z - 4 - Math.round(i * 0.55);
    if (Math.max(Math.abs(x), Math.abs(z)) > R - 3) break;
    const y = Math.max(1, topAt(x, z));
    set(x, y, z, B.LAVA);
    set(x, Math.max(1, y - 1), z, B.LAVA_ROCKY);
    reserve(x, z, 1);
  }
  // obsidian-ish spikes field
  for (let i = 0; i < 8; i++) {
    const x = c.x - 16 + Math.floor(rng() * 14);
    const z = c.z + 6 + Math.floor(rng() * 14);
    if (isReserved(x, z)) continue;
    const y = topAt(x, z);
    fillBox(x, y + 1, z, x, y + 2 + Math.floor(rng() * 3), z, B.DRAGON);
    reserve(x, z, 1);
  }
})();

// --- S quarry: ore-banded terraces + timber headframe ---
(function quarry() {
  const c = cellCenter('quarry');
  // ore veins on the terrace walls
  for (let x = c.x - 20; x <= c.x + 20; x++) {
    for (let z = c.z - 20; z <= c.z + 20; z++) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d > 21) continue;
      const top = topAt(x, z);
      const r = hash2(x, z, 77);
      if (r < 0.06) set(x, top, z, B.COAL_ORE);
      else if (r < 0.1) set(x, top, z, B.IRON_ORE);
      else if (r < 0.12) set(x, top, z, B.GOLD_ORE);
    }
  }
  // timber headframe at the pit center
  const px = c.x, pz = c.z;
  const py = topAt(px, pz);
  reserveCellRect(px - 3, pz - 3, px + 3, pz + 3, 1);
  for (const [lx, lz] of [[px - 3, pz - 3], [px + 3, pz - 3], [px - 3, pz + 3], [px + 3, pz + 3]]) {
    fillBox(lx, py + 1, lz, lx, py + 7, lz, B.LOG);
  }
  fillBox(px - 3, py + 8, pz - 3, px + 3, py + 8, pz + 3, B.OAK_SLATS_DARK);
  fillBox(px - 1, py + 9, pz - 1, px + 1, py + 9, pz + 1, B.OAK_DARK);
  set(px, py + 1, pz, B.GOLD_ORE);
})();

// --- SE cove: lagoon with a pirate ship + palm beach ---
(function cove() {
  // ship in the lagoon, hull pointing NE
  const sx = 56, sz = 56;
  reserveCellRect(sx - 12, sz - 6, sx + 12, sz + 6, 2);
  // hull: layered ellipses (deck y5)
  for (let i = -9; i <= 9; i++) {
    const half = Math.round(4 * Math.sqrt(Math.max(0, 1 - (i / 10) ** 2)));
    for (let j = -half; j <= half; j++) {
      fillBox(sx + i, 2, sz + j, sx + i, 4, sz + j, B.OAK_DARK);
      set(sx + i, 5, sz + j, B.OAK_PLANKS); // deck
    }
  }
  // raised stern + bow
  fillBox(sx - 9, 5, sz - 2, sx - 6, 7, sz + 2, B.OAK_DARK);
  fillBox(sx - 9, 8, sz - 2, sx - 6, 8, sz + 2, B.OAK_PLANKS);
  fillBox(sx + 8, 5, sz - 1, sx + 9, 6, sz + 1, B.OAK_DARK);
  // masts + snow-block sails
  for (const mxOff of [-3, 3]) {
    fillBox(sx + mxOff, 6, sz, sx + mxOff, 13, sz, B.LOG);
    fillBox(sx + mxOff - 2, 9, sz, sx + mxOff + 2, 12, sz, B.SNOW);
  }
  // gangplank to the beach
  fillBox(sx - 2, 2, sz - 10, sx, 2, sz - 4, B.OAK_SLATS);
  // beach palms
  for (let i = 0; i < 6; i++) {
    const x = 34 + Math.floor(rng() * 18);
    const z = 34 + Math.floor(rng() * 18);
    if (isReserved(x, z)) continue;
    const y = topAt(x, z);
    if (blocks.get(key3(x, y, z)) === B.WATER) continue;
    for (let yy = y + 1; yy <= y + 4; yy++) set(x, yy, z, B.LOG);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) set(x + dx, y + 5, z + dz, B.NUIT_LEAVES);
    reserve(x, z, 1);
  }
})();

function reserveCellRect(x1, z1, x2, z2, m = 0) {
  for (let x = x1 - m; x <= x2 + m; x++)
    for (let z = z1 - m; z <= z2 + m; z++) reserved.add(`${x},${z}`);
}

// ---------------------------------------------------------------------------
// Pass 3: trees + scatter
// ---------------------------------------------------------------------------
function pine(x, z) {
  const y = topAt(x, z);
  const h = 4 + Math.floor(rng() * 3);
  for (let yy = y + 1; yy <= y + h; yy++) set(x, yy, z, B.LOG);
  for (let r = 2; r >= 0; r--) {
    const ly = y + h - 1 + (2 - r);
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++)
        if (Math.abs(dx) + Math.abs(dz) <= r + (r > 0 ? 1 : 0)) set(x + dx, ly, z + dz, B.OAK_LEAVES);
  }
  set(x, y + h + 2, z, B.SNOW);
}
function bigTree(x, z) {
  const y = topAt(x, z);
  const h = 5 + Math.floor(rng() * 3);
  for (let yy = y + 1; yy <= y + h; yy++) set(x, yy, z, B.LOG);
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++)
      for (let dy = 0; dy <= 1; dy++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy === 1) continue;
        set(x + dx, y + h + dy, z + dz, B.OAK_LEAVES);
      }
  set(x, y + h + 2, z, B.OAK_LEAVES);
}
function scatterTrees(count, name, fn) {
  const c = cellCenter(name);
  let placed = 0;
  for (let i = 0; i < count * 40 && placed < count; i++) {
    const x = c.x - 24 + Math.floor(rng() * 48);
    const z = c.z - 24 + Math.floor(rng() * 48);
    if (isReserved(x, z)) continue;
    const top = blocks.get(key3(x, topAt(x, z), z));
    if (top === B.WATER || top === B.LAVA || top === B.ICE) continue;
    fn(x, z);
    reserve(x, z, 2);
    placed++;
  }
}
scatterTrees(8, 'arctic', pine);
scatterTrees(16, 'jungle', bigTree);
scatterTrees(5, 'river', bigTree);
scatterTrees(4, 'citadel', bigTree);

// ---------------------------------------------------------------------------
// Pass 4: gameplay meta
// ---------------------------------------------------------------------------
function walkableY(x, z) {
  for (let y = 1; y <= 40; y++) {
    if (blocks.has(key3(x, y, z)) && !blocks.has(key3(x, y + 1, z)) && !blocks.has(key3(x, y + 2, z))) {
      const ground = blocks.get(key3(x, y, z));
      if (ground === B.WATER || ground === B.LAVA) return -1;
      return y;
    }
  }
  return -1;
}
function pickPoints(count, { maxY = 6, minSep = 18, seed = 5 } = {}) {
  const r = mulberry32(seed);
  const picked = [];
  for (let i = 0; i < count * 500 && picked.length < count; i++) {
    const x = Math.round(-R + 8 + r() * (R * 2 - 16));
    const z = Math.round(-R + 8 + r() * (R * 2 - 16));
    const y = walkableY(x, z);
    if (y < 0 || y > maxY) continue;
    if (picked.some(p => Math.hypot(p.x - x, p.z - z) < minSep)) continue;
    picked.push({ x: x + 0.5, y: y + 2, z: z + 0.5 });
  }
  return picked;
}

const spawnPoints = pickPoints(18, { maxY: 7, minSep: 26, seed: 13 });
const itemSpawns = pickPoints(16, { maxY: 9, minSep: 20, seed: 29 }).map(p => ({ x: p.x, y: p.y - 1, z: p.z }));
const chestSpawns = pickPoints(20, { maxY: 12, minSep: 22, seed: 41 }).map(p => ({
  position: { x: p.x, y: p.y - 1, z: p.z },
  yawDeg: Math.floor(rng() * 4) * 90,
}));

const meta = {
  source: 'mayhem-arena (tools/build-mayhem.mjs)',
  seed: SEED,
  bounds: { min: { x: -R, z: -R }, max: { x: R, z: R } },
  chestDropRegion: { min: { x: -R + 12, y: 40, z: -R + 12 }, max: { x: R - 12, y: 40, z: R - 12 } },
  spawnPoints,
  chestSpawns,
  itemSpawns,
};

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------
const here = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.join(here, '..', 'assets', 'maps');
const blocksOut = {};
for (const [k, v] of blocks) blocksOut[k] = v;
fs.writeFileSync(path.join(mapsDir, 'mayhem-arena.json'), JSON.stringify({ blockTypes: BLOCK_TYPES, blocks: blocksOut }));
fs.writeFileSync(path.join(mapsDir, 'mayhem-arena.meta.json'), JSON.stringify(meta, null, 2));
console.log(`mayhem-arena: ${blocks.size} blocks | spawns ${spawnPoints.length}, chests ${chestSpawns.length}, items ${itemSpawns.length}`);
