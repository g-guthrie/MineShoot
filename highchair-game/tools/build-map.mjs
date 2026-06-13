#!/usr/bin/env node
/**
 * Four-biome PvP arena generator.
 *
 * Produces assets/maps/biome-arena.json (the world) and
 * assets/maps/biome-arena.meta.json (spawn points, chest/item spawns and the
 * chest drop region, computed from the generated terrain so gameplay config
 * can never drift from the map).
 *
 * Layout (north = -z):
 *   NW snow & ice fortress   |  NE jungle temple ruins
 *   -------------------------+------------------------
 *   SW lava shadow keep      |  SE sandstone citadel
 * with a raised neutral plaza + monument in the center, diagonal lanes from
 * each biome heart to the plaza gates, and a north skybridge sniper lane.
 *
 * Deterministic: same SEED -> same map. Re-run after tweaks: node tools/build-map.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = Number(process.argv[2] ?? 20260612);

// ---------------------------------------------------------------------------
// Block registry. Ids 1-43 match the legacy arena registry (gameplay tables
// reference them); 44+ register the unused textures already on disk.
// ---------------------------------------------------------------------------
const B = {
  BRICKS: 1, BEDROCK: 2, COBBLE: 4, DIAMOND: 6, DIRT: 8, DRAGON: 9,
  EMERALD: 11, EMERALD_ORE: 12, GLASS: 14, GOLD_ORE: 15, GRASS: 16, GRAVEL: 17, ICE: 18,
  INFECTED_CORE: 19, INFECTED: 20, LAVA: 22, LOG: 23, MOSSY: 24,
  NUIT_LEAVES: 25, OAK_LEAVES: 27, OAK_PLANKS: 28, SAND_LIGHT: 29, SAND: 30,
  SANDSTONE_LIGHT: 31, SANDSTONE: 32, SHADOW_PEBBLE: 33, SHADOWROCK: 34,
  SNOW: 35, STONE_BRICKS: 36, STONE: 37, SWIRL_RUNE: 38, WATER: 43,
  // new registrations
  SNOW_ICY: 44, SNOW_ROUGH: 45, SNOW_PEBBLES: 46, SNOW_ROCKS: 47,
  ICE_BLOCK: 48, SHALE_TOP: 49, SHALE_BOTTOM: 50, SHALE_ROCK: 51,
  LAVA_DIRT: 52, LAVA_DIRT_CRACKED: 53, LAVA_ROCKY: 54,
  JUNGLE: 56, JUNGLE_MOSSY: 57, JUNGLE_DAMAGED: 58,
  JUNGLE_DIRT: 59, JUNGLE_DIRT_ROOTS: 60, JUNGLE_DIRT_TRAMPLED: 61,
  COBBLE_DARK: 62, COBBLE_LARGE_DARK: 63, OAK_DARK: 64, OAK_SLATS: 65,
  OAK_SLATS_DARK: 66, CRACKED_SAND: 67, GLASS_WINDOW: 68,
};

const BLOCK_TYPES = [
  { id: 1, name: 'bricks', textureUri: 'blocks/bricks.png' },
  { id: 2, name: 'bedrock', textureUri: 'blocks/clay.png' },
  { id: 3, name: 'coal-ore', textureUri: 'blocks/coal-ore.png' },
  { id: 4, name: 'cobblestone', textureUri: 'blocks/cobblestone.png' },
  { id: 5, name: 'creep', textureUri: 'blocks/creep.png' },
  { id: 6, name: 'diamond-block', textureUri: 'blocks/diamond-block.png' },
  { id: 7, name: 'diamond-ore', textureUri: 'blocks/diamond-ore.png' },
  { id: 8, name: 'dirt', textureUri: 'blocks/dirt.png' },
  { id: 9, name: 'dragon_block', textureUri: 'blocks/dragon_block' },
  { id: 10, name: 'dragons-stone', textureUri: 'blocks/dragons-stone.png' },
  { id: 11, name: 'emerald-block', textureUri: 'blocks/emerald-block.png' },
  { id: 12, name: 'emerald-ore', textureUri: 'blocks/emerald-ore.png' },
  { id: 13, name: 'ghost-dirt', textureUri: 'blocks/ghost-dirt.png' },
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
  { id: 26, name: 'nuit', textureUri: 'blocks/nuit.png' },
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
  { id: 39, name: 'void-sand', textureUri: 'blocks/void-sand.png' },
  { id: 40, name: 'void_grass', textureUri: 'blocks/void_grass' },
  { id: 41, name: 'voidsoil', textureUri: 'blocks/voidsoil.png' },
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
// Deterministic RNG + value noise
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
function fbm(x, z, salt) {
  return valueNoise(x, z, 18, salt) * 0.6 + valueNoise(x, z, 7, salt + 1) * 0.3 + valueNoise(x, z, 3, salt + 2) * 0.1;
}

// ---------------------------------------------------------------------------
// World storage
// ---------------------------------------------------------------------------
const R = 56;            // world half-extent; playable inside ~±50
const RIM_START = 47;    // mountains rise from here (Chebyshev distance)
const PLAZA_R = 16;      // central plaza radius
const PLAZA_Y = 4;       // plaza floor height
const blocks = new Map();
const reserved = new Set(); // columns claimed by structures/lanes (no trees)

const key = (x, y, z) => `${x},${y},${z}`;
const set = (x, y, z, id) => blocks.set(key(Math.round(x), Math.round(y), Math.round(z)), id);
const clear = (x, y, z) => blocks.delete(key(Math.round(x), Math.round(y), Math.round(z)));
const reserve = (x, z, margin = 0) => {
  for (let dx = -margin; dx <= margin; dx++)
    for (let dz = -margin; dz <= margin; dz++) reserved.add(`${x + dx},${z + dz}`);
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
      for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) clear(x, y, z);
}
/** Walls of a rectangle (hollow), y1..y2. */
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

// ---------------------------------------------------------------------------
// Biomes (north = -z): NW snow, NE jungle, SW lava, SE sandstone
// ---------------------------------------------------------------------------
const BIOMES = {
  snow: {
    base: 2, amp: 2.6, salt: 11,
    surface: [[B.SNOW, 10], [B.SNOW_ROUGH, 3], [B.SNOW_ICY, 1.5], [B.SNOW_PEBBLES, 1], [B.SNOW_ROCKS, 0.7]],
    fill: B.DIRT, path: B.SNOW_PEBBLES, rockTop: B.SHALE_TOP, rockSide: B.SHALE_BOTTOM,
  },
  jungle: {
    base: 2, amp: 2.2, salt: 23,
    surface: [[B.GRASS, 10], [B.JUNGLE_DIRT, 2.5], [B.JUNGLE_DIRT_ROOTS, 1.2], [B.JUNGLE_DIRT_TRAMPLED, 1]],
    fill: B.JUNGLE_DIRT, path: B.JUNGLE_DIRT_TRAMPLED, rockTop: B.MOSSY, rockSide: B.MOSSY,
  },
  lava: {
    base: 1.6, amp: 1.4, salt: 37,
    surface: [[B.LAVA_DIRT, 10], [B.LAVA_DIRT_CRACKED, 3], [B.SHADOW_PEBBLE, 2], [B.LAVA_ROCKY, 1]],
    fill: B.SHADOWROCK, path: B.SHADOW_PEBBLE, rockTop: B.SHADOWROCK, rockSide: B.SHADOWROCK,
  },
  sand: {
    base: 2, amp: 2.0, salt: 53,
    surface: [[B.SAND, 10], [B.SAND_LIGHT, 4], [B.CRACKED_SAND, 1.2]],
    fill: B.SANDSTONE, path: B.SANDSTONE_LIGHT, rockTop: B.SANDSTONE, rockSide: B.SANDSTONE,
  },
};

/** Smooth biome weights at a column (bilinear over a ±6 transition band). */
function biomeWeights(x, z) {
  const band = 6;
  const e = Math.min(1, Math.max(0, (x + band) / (band * 2))); // 0 west, 1 east
  const s = Math.min(1, Math.max(0, (z + band) / (band * 2))); // 0 north, 1 south
  return {
    snow: (1 - e) * (1 - s),
    jungle: e * (1 - s),
    lava: (1 - e) * s,
    sand: e * s,
  };
}
function dominantBiome(x, z) {
  const w = biomeWeights(x, z);
  // Dither inside the blend band for a natural seam.
  const names = Object.keys(w);
  const r = hash2(x, z, 99);
  let acc = 0;
  for (const name of names) {
    acc += w[name];
    if (r <= acc) return name;
  }
  return names[3];
}

// Lakes/basins (handled as terrain overrides)
const FROZEN_LAKE = { x: -30, z: -16, rx: 8, rz: 6 };
const JUNGLE_POOL = { x: 22, z: -13, rx: 5, rz: 4 };
const inEllipse = (x, z, e) => ((x - e.x) / e.rx) ** 2 + ((z - e.z) / e.rz) ** 2 <= 1;

// Lava river: parametric band through the SW quadrant.
function inLavaRiver(x, z) {
  if (x > -6 || z < 8) return false;
  // a gentle arc from (-52, 18) to (-14, 50)
  const t = (x + 52) / 38; // 0..1 west->east
  if (t < 0 || t > 1) return false;
  const center = 18 + t * 30 + Math.sin(t * Math.PI * 2) * 3;
  return Math.abs(z - center) <= 1.6;
}

function terrainHeightF(x, z) {
  const w = biomeWeights(x, z);
  let h = 0;
  for (const [name, weight] of Object.entries(w)) {
    const b = BIOMES[name];
    h += weight * (b.base + fbm(x, z, b.salt) * b.amp);
  }

  // Snow cliff shelf along the far north-west.
  if (x < -38 && z < -8) {
    const t = Math.min(1, (-38 - x) / 6) * Math.min(1, (-8 - z) / 6);
    h += smooth(t) * 5;
  }

  // Center apron flattens toward the plaza.
  const d = Math.hypot(x, z);
  if (d < PLAZA_R + 10) {
    const t = Math.min(1, Math.max(0, (PLAZA_R + 10 - d) / 10));
    h = h * (1 - smooth(t)) + 3 * smooth(t);
  }

  // Rim mountains then bedrock wall.
  const cheb = Math.max(Math.abs(x), Math.abs(z));
  if (cheb > RIM_START) {
    const t = Math.min(1, (cheb - RIM_START) / (R - RIM_START));
    h += smooth(t) * 9;
  }

  return Math.max(1, h);
}

// Diagonal lanes: biome heart -> plaza corner gate.
const LANES = [
  { from: [-34, -34], to: [-10, -10] }, // snow
  { from: [34, -34], to: [10, -10] },   // jungle
  { from: [-34, 34], to: [-10, 10] },   // lava
  { from: [34, 34], to: [10, 10] },     // sand
];
function laneFactor(x, z) {
  // Returns 0..1 if (x,z) lies near a lane segment.
  let best = 0;
  for (const lane of LANES) {
    const [ax, az] = lane.from, [bx, bz] = lane.to;
    const abx = bx - ax, abz = bz - az;
    const len2 = abx * abx + abz * abz;
    const t = Math.min(1, Math.max(0, ((x - ax) * abx + (z - az) * abz) / len2));
    const px = ax + abx * t, pz = az + abz * t;
    const dist = Math.hypot(x - px, z - pz);
    if (dist <= 2.5) best = Math.max(best, 1 - dist / 2.5);
  }
  return best;
}

// ---------------------------------------------------------------------------
// Pass 1: terrain
// ---------------------------------------------------------------------------
const surfaceY = new Map(); // "x,z" -> terrain surface y (pre-structures)

// Heights are computed as floats, box-blurred 3x3 to kill single-block
// jitter (which reads as harsh shadow checkering in-game), then rounded.
const rawHeight = new Map();
for (let x = -R - 1; x <= R + 1; x++) {
  for (let z = -R - 1; z <= R + 1; z++) {
    rawHeight.set(`${x},${z}`, terrainHeightF(x, z));
  }
}
function smoothedHeight(x, z) {
  let sum = 0;
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) sum += rawHeight.get(`${x + dx},${z + dz}`) ?? 1;
  return Math.max(1, Math.round(sum / 9));
}

for (let x = -R; x <= R; x++) {
  for (let z = -R; z <= R; z++) {
    const biomeName = dominantBiome(x, z);
    const biome = BIOMES[biomeName];
    let h = smoothedHeight(x, z);

    const lane = laneFactor(x, z);
    if (lane > 0) {
      h = Math.round(h * (1 - lane) + 3 * lane); // lanes grade gently to plaza height
      reserve(x, z);
    }

    const cheb = Math.max(Math.abs(x), Math.abs(z));
    let surface = lane > 0.45 ? biome.path : pick(biome.surface);
    let fill = biome.fill;

    if (cheb > RIM_START + 2) {
      surface = biome.rockTop;
      fill = biome.rockSide;
      reserve(x, z);
    }

    // Water/ice/lava features carve the terrain down to a 1-deep basin.
    if (inEllipse(x, z, FROZEN_LAKE)) { h = 2; surface = B.ICE; fill = B.DIRT; reserve(x, z); }
    if (inEllipse(x, z, JUNGLE_POOL)) { h = 2; surface = B.WATER; fill = B.SAND_LIGHT; reserve(x, z); }
    if (inLavaRiver(x, z)) { h = 2; surface = B.LAVA; fill = B.SHADOWROCK; reserve(x, z); }

    set(x, 0, z, B.BEDROCK);
    for (let y = 1; y < h; y++) {
      // Cliff faces read as shale in the snow quadrant.
      const exposedSide = biomeName === 'snow' && h - y <= 4 && h > 5;
      set(x, y, z, exposedSide ? biome.rockSide : fill);
    }
    set(x, h, z, surface);
    surfaceY.set(`${x},${z}`, h);

    // Outer bedrock wall: nobody leaves, nobody builds out.
    if (cheb >= R - 1) {
      for (let y = 1; y <= 16; y++) set(x, y, z, B.BEDROCK);
    }
  }
}

/** Highest solid y in a column AFTER structure passes (for spawns). */
function topAt(x, z) {
  for (let y = 30; y >= 0; y--) {
    if (blocks.has(key(x, y, z))) return y;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Pass 2: central plaza, under-room, monument
// ---------------------------------------------------------------------------
function buildPlaza() {
  for (let x = -PLAZA_R; x <= PLAZA_R; x++) {
    for (let z = -PLAZA_R; z <= PLAZA_R; z++) {
      const d = Math.hypot(x, z);
      if (d > PLAZA_R) continue;
      reserve(x, z);

      // Raised platform: walls of the platform read as dark cobble.
      for (let y = 1; y <= PLAZA_Y; y++) set(x, y, z, B.COBBLE_LARGE_DARK);
      // Floor pattern: stone bricks with a rune cross and dark rings.
      let floorId = B.STONE_BRICKS;
      if (Math.abs(x) <= 1 || Math.abs(z) <= 1) floorId = B.SWIRL_RUNE;
      else if (Math.round(d) === 12 || Math.round(d) === 6) floorId = B.COBBLE_DARK;
      set(x, PLAZA_Y, z, floorId);
      // Clear anything above the platform floor (terrain apron overlap).
      for (let y = PLAZA_Y + 1; y <= PLAZA_Y + 12; y++) clear(x, y, z);
    }
  }

  // Under-room: a close-quarters chamber beneath the plaza (floor y1,
  // two blocks of headroom, plaza floor as ceiling).
  clearBox(-9, 2, -9, 9, 3, 9);
  for (let x = -9; x <= 9; x += 4) {
    for (let z = -9; z <= 9; z += 4) {
      fillBox(x, 2, z, x, 3, z, B.COBBLE_DARK); // pillars
    }
  }
  // Four stairwells from the plaza floor down into the under-room.
  for (const [sx, sz] of [[-7, 0], [7, 0], [0, -7], [0, 7]]) {
    clearBox(sx - 1, PLAZA_Y, sz - 1, sx + 1, PLAZA_Y, sz + 1);
    const dx = -Math.sign(sx), dz = -Math.sign(sz);
    set(sx, 3, sz, B.STONE_BRICKS);
    set(sx + dx, 2, sz + dz, B.STONE_BRICKS);
  }

  // Parapet ring with four diagonal gates.
  for (let x = -PLAZA_R; x <= PLAZA_R; x++) {
    for (let z = -PLAZA_R; z <= PLAZA_R; z++) {
      const d = Math.hypot(x, z);
      if (d < PLAZA_R - 1 || d > PLAZA_R) continue;
      const angle = Math.atan2(z, x);
      const deg = ((angle * 180) / Math.PI + 360) % 360;
      // Gates at the four diagonals (45/135/225/315), 24 degrees wide.
      const nearGate = [45, 135, 225, 315].some(g => Math.abs(((deg - g + 540) % 360) - 180) > 168);
      if (nearGate) continue;
      set(x, PLAZA_Y + 1, z, B.STONE_BRICKS);
      const slit = Math.round(d * deg) % 5 === 0;
      set(x, PLAZA_Y + 2, z, slit ? B.GLASS_WINDOW : B.STONE_BRICKS);
    }
  }

  // Steps up to each gate from the apron.
  for (const [gx, gz] of [[12, 12], [-12, 12], [12, -12], [-12, -12]]) {
    const dirx = Math.sign(gx), dirz = Math.sign(gz);
    fillBox(gx + dirx, 3, gz + dirz, gx + dirx * 2, 3, gz + dirz * 2, B.COBBLE);
  }

  // Monument: central tower with a mid platform and beacon.
  for (let y = PLAZA_Y + 1; y <= PLAZA_Y + 9; y++) {
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        if (Math.abs(x) === 2 || Math.abs(z) === 2) {
          const band = y === PLAZA_Y + 5 ? B.SWIRL_RUNE : B.STONE_BRICKS;
          set(x, y, z, band);
        }
      }
    }
  }
  // Mid platform ring (jump-across target from the bridges).
  for (let x = -4; x <= 4; x++) {
    for (let z = -4; z <= 4; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) === 4 || Math.max(Math.abs(x), Math.abs(z)) === 3) {
        set(x, PLAZA_Y + 6, z, B.OAK_DARK);
      }
    }
  }
  // Beacon top.
  fillBox(-1, PLAZA_Y + 10, -1, 1, PLAZA_Y + 10, 1, B.EMERALD);
  set(0, PLAZA_Y + 11, 0, B.DIAMOND);

  // Steps up the monument's east face to the oak platform ring.
  set(3, PLAZA_Y + 1, 0, B.STONE_BRICKS);
  set(3, PLAZA_Y + 2, 1, B.STONE_BRICKS);
  set(3, PLAZA_Y + 3, 2, B.STONE_BRICKS);
  set(2, PLAZA_Y + 4, 3, B.STONE_BRICKS);
  set(1, PLAZA_Y + 5, 3, B.STONE_BRICKS);
}
buildPlaza();

// ---------------------------------------------------------------------------
// Pass 3: biome structures
// ---------------------------------------------------------------------------

/** Mark a rectangle reserved (with margin) so trees keep clear. */
function reserveRect(x1, z1, x2, z2, margin = 2) {
  for (let x = x1 - margin; x <= x2 + margin; x++)
    for (let z = z1 - margin; z <= z2 + margin; z++) reserved.add(`${x},${z}`);
}

// --- NW: snow fort with watchtower ---
function buildSnowFort() {
  const x1 = -42, z1 = -44, x2 = -28, z2 = -30;
  reserveRect(x1, z1, x2, z2);
  const base = 3;
  // level the courtyard
  for (let x = x1; x <= x2; x++)
    for (let z = z1; z <= z2; z++) {
      for (let y = 1; y < base; y++) set(x, y, z, B.DIRT);
      set(x, base, z, B.SNOW);
      for (let y = base + 1; y <= base + 14; y++) clear(x, y, z);
    }
  walls(x1, z1, x2, z2, base + 1, base + 4, B.LOG);
  // gate toward the center (south-east corner side)
  clearBox(x2, base + 1, -38, x2, base + 3, -36);
  // plank walk atop the walls
  walls(x1, z1, x2, z2, base + 5, base + 5, B.OAK_SLATS_DARK);
  // watchtower on the fort's SE corner, roof floor at base+9 (y12) so the
  // north skybridge (deck y12, z -32..-31) docks flush onto it.
  const tx1 = x2 - 4, tz1 = z2 - 4; // -32..-29 by -34..-31
  fillBox(tx1, base + 1, tz1, tx1 + 3, base + 9, tz1 + 3, B.LOG);
  clearBox(tx1 + 1, base + 1, tz1 + 1, tx1 + 2, base + 8, tz1 + 2);
  fillBox(tx1, base + 9, tz1, tx1 + 3, base + 9, tz1 + 3, B.OAK_SLATS_DARK);
  fillBox(tx1 - 1, base + 10, tz1 - 1, tx1 + 4, base + 10, tz1 + 4, B.SNOW); // parapet rim
  clearBox(tx1, base + 10, tz1, tx1 + 3, base + 10, tz1 + 3);
  clearBox(tx1 + 4, base + 10, z2 - 2, tx1 + 4, base + 10, z2 - 1); // east gap to the bridge
  // ladder shaft ledges up to the roof
  for (let y = base + 1; y <= base + 8; y += 2) set(tx1 + 1, y, tz1 + 1, B.OAK_SLATS);
  // ice throne decoration in the courtyard
  fillBox(-36, base + 1, -34, -34, base + 1, -33, B.ICE_BLOCK);
}
buildSnowFort();

// --- NE: jungle stepped temple ---
function buildTemple() {
  const cx = 34, cz = -32;
  reserveRect(cx - 9, cz - 9, cx + 9, cz + 9);
  const base = 3;
  const tiers = [
    { r: 8, y1: base, y2: base + 2 },
    { r: 6, y1: base + 3, y2: base + 5 },
    { r: 4, y1: base + 6, y2: base + 8 },
    { r: 2, y1: base + 9, y2: base + 10 },
  ];
  for (const tier of tiers) {
    for (let x = cx - tier.r; x <= cx + tier.r; x++) {
      for (let z = cz - tier.r; z <= cz + tier.r; z++) {
        for (let y = tier.y1; y <= tier.y2; y++) {
          const moss = hash2(x * 3 + y, z * 3 - y, 7) < 0.45;
          set(x, y, z, moss ? B.JUNGLE_MOSSY : B.MOSSY);
        }
      }
    }
  }
  // 3-wide grand staircase descending the west (center-facing) face
  for (let i = 0; i <= 10; i++) {
    const y = base + 10 - i;
    const x = cx - 2 - i;
    fillBox(x, y, cz - 1, x, y, cz + 1, B.COBBLE);
    clearBox(x, y + 1, cz - 1, x, y + 4, cz + 1);
  }
  // top pillars (sniper nest)
  for (const [px, pz] of [[cx - 2, cz - 2], [cx + 2, cz - 2], [cx - 2, cz + 2], [cx + 2, cz + 2]]) {
    fillBox(px, base + 11, pz, px, base + 13, pz, B.JUNGLE);
  }
  fillBox(cx - 2, base + 14, cz - 2, cx + 2, base + 14, cz + 2, B.JUNGLE_DAMAGED);
  set(cx, base + 11, cz, B.EMERALD_ORE);
  // inner chamber on tier 1 with an east entrance
  clearBox(cx - 4, base + 1, cz - 3, cx + 6, base + 2, cz + 3);
  clearBox(cx + 7, base + 1, cz - 1, cx + 8, base + 2, cz + 1);
  set(cx, base + 1, cz, B.GOLD_ORE);
}
buildTemple();

// --- scattered jungle ruins ---
function buildRuin(cx, cz) {
  reserveRect(cx - 3, cz - 3, cx + 3, cz + 3, 1);
  const base = topAt(cx, cz);
  const h = 2 + Math.floor(rng() * 3);
  for (let x = cx - 3; x <= cx + 3; x++) {
    for (const z of [cz - 3, cz + 3]) {
      if (rng() < 0.7) {
        const top = base + 1 + Math.floor(rng() * h);
        for (let y = base + 1; y <= top; y++) set(x, y, z, rng() < 0.5 ? B.JUNGLE_DAMAGED : B.MOSSY);
      }
    }
  }
  for (let z = cz - 2; z <= cz + 2; z++) {
    if (rng() < 0.6) {
      const top = base + 1 + Math.floor(rng() * h);
      for (let y = base + 1; y <= top; y++) set(cx - 3, y, z, B.JUNGLE_MOSSY);
    }
  }
}
buildRuin(18, -34);
buildRuin(40, -14);
buildRuin(26, -46);

// --- SW: lava shadow keep ---
function buildShadowKeep() {
  const x1 = -42, z1 = 26, x2 = -26, z2 = 42;
  reserveRect(x1, z1, x2, z2, 3);
  const base = 3;
  for (let x = x1; x <= x2; x++)
    for (let z = z1; z <= z2; z++) {
      for (let y = 1; y < base; y++) set(x, y, z, B.SHADOWROCK);
      set(x, base, z, B.SHADOW_PEBBLE);
      for (let y = base + 1; y <= base + 16; y++) clear(x, y, z);
    }
  walls(x1, z1, x2, z2, base + 1, base + 5, B.SHADOWROCK);
  // ramparts: walkway + crenellations
  walls(x1, z1, x2, z2, base + 6, base + 6, B.INFECTED);
  for (let x = x1; x <= x2; x += 2) {
    set(x, base + 7, z1, B.INFECTED);
    set(x, base + 7, z2, B.INFECTED);
  }
  for (let z = z1; z <= z2; z += 2) {
    set(x1, base + 7, z, B.INFECTED);
    set(x2, base + 7, z, B.INFECTED);
  }
  // gate faces the center (north-east corner side)
  clearBox(-34, base + 1, z1, -32, base + 4, z1);
  // glowing core pillar in the courtyard
  fillBox(-35, base + 1, 33, -33, base + 3, 35, B.INFECTED_CORE);
  set(-34, base + 4, 34, B.DRAGON);
  // corner tower with dragon cap
  fillBox(x1 + 1, base + 1, z2 - 5, x1 + 5, base + 11, z2 - 1, B.SHADOWROCK);
  clearBox(x1 + 2, base + 1, z2 - 4, x1 + 4, base + 10, z2 - 2);
  for (let y = base + 1; y <= base + 10; y += 2) set(x1 + 3, y, z2 - 3, B.OAK_SLATS_DARK);
  fillBox(x1 + 1, base + 11, z2 - 5, x1 + 5, base + 11, z2 - 1, B.DRAGON);
  // moat causeway across the river toward the lane
  fillBox(-24, 2, 30, -18, 2, 32, B.SHADOW_PEBBLE);
}
buildShadowKeep();

// log bridge over the lava river on the western side
function buildLavaBridge() {
  const z = 24;
  for (let x = -50; x <= -42; x++) {
    set(x, 3, z, B.LOG);
    set(x, 3, z + 1, B.LOG);
  }
}
buildLavaBridge();

// --- SE: sandstone citadel with twin towers ---
function buildCitadel() {
  const x1 = 26, z1 = 28, x2 = 44, z2 = 40;
  reserveRect(x1, z1, x2, z2, 3);
  const base = 3;
  for (let x = x1; x <= x2; x++)
    for (let z = z1; z <= z2; z++) {
      for (let y = 1; y < base; y++) set(x, y, z, B.SANDSTONE);
      set(x, base, z, B.SANDSTONE_LIGHT);
      for (let y = base + 1; y <= base + 16; y++) clear(x, y, z);
    }
  walls(x1, z1, x2, z2, base + 1, base + 4, B.SANDSTONE);
  walls(x1, z1, x2, z2, base + 5, base + 5, B.SANDSTONE_LIGHT);
  // arched gate facing the center (north-west side)
  clearBox(x1, base + 1, 33, x1, base + 3, 35);
  set(x1, base + 4, 34, B.BRICKS);
  // twin towers + connecting bridge
  for (const tx of [x1 + 3, x2 - 3]) {
    fillBox(tx - 2, base + 1, z2 - 5, tx + 2, base + 9, z2 - 1, B.SANDSTONE);
    clearBox(tx - 1, base + 1, z2 - 4, tx + 1, base + 8, z2 - 2);
    for (let y = base + 1; y <= base + 8; y += 2) set(tx, y, z2 - 3, B.OAK_SLATS);
    fillBox(tx - 2, base + 9, z2 - 5, tx + 2, base + 9, z2 - 1, B.SANDSTONE_LIGHT);
    walls(tx - 2, z2 - 5, tx + 2, z2 - 1, base + 10, base + 10, B.SANDSTONE_LIGHT);
  }
  fillBox(x1 + 6, base + 9, z2 - 3, x2 - 6, base + 9, z2 - 3, B.OAK_PLANKS);
  fillBox(x1 + 6, base + 10, z2 - 4, x2 - 6, base + 10, z2 - 4, B.SANDSTONE_LIGHT);
}
buildCitadel();

// freestanding arches on the sand lane
function buildArch(cx, cz, axis) {
  reserveRect(cx - 3, cz - 3, cx + 3, cz + 3, 0);
  const base = topAt(cx, cz);
  for (let i = -3; i <= 3; i++) {
    const x = axis === 'x' ? cx + i : cx;
    const z = axis === 'x' ? cz : cz + i;
    if (Math.abs(i) === 3) fillBox(x, base + 1, z, x, base + 4, z, B.SANDSTONE);
    else set(x, base + 5, z, B.SANDSTONE_LIGHT);
  }
}
buildArch(24, 24, 'x');
buildArch(40, 18, 'z');

// --- north skybridge: snow fort tower roof <-> temple top (sniper lane) ---
function buildSkybridge() {
  const y = 12; // flush with the tower roof; meets the temple top tier (y13 surface)
  for (let x = -27; x <= 31; x++) {
    set(x, y, -32, B.OAK_DARK);
    set(x, y, -31, B.OAK_DARK);
    if (x % 6 === 0) {
      set(x, y + 1, -33, B.LOG);
      set(x, y + 1, -30, B.LOG);
    }
  }
}
buildSkybridge();

// ---------------------------------------------------------------------------
// Pass 4: trees
// ---------------------------------------------------------------------------
function buildPine(x, z) {
  const base = topAt(x, z);
  const h = 4 + Math.floor(rng() * 3);
  for (let y = base + 1; y <= base + h; y++) set(x, y, z, B.LOG);
  for (let r = 2; r >= 0; r--) {
    const y = base + h - 1 + (2 - r);
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= r + (r > 0 ? 1 : 0)) set(x + dx, y, z + dz, B.OAK_LEAVES);
      }
  }
  set(x, base + h + 2, z, B.SNOW);
}
function buildJungleTree(x, z) {
  const base = topAt(x, z);
  const h = 5 + Math.floor(rng() * 3);
  for (let y = base + 1; y <= base + h; y++) set(x, y, z, B.LOG);
  const leaf = rng() < 0.3 ? B.NUIT_LEAVES : B.OAK_LEAVES;
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++)
      for (let dy = 0; dy <= 1; dy++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy === 1) continue;
        set(x + dx, base + h + dy, z + dz, leaf);
      }
  set(x, base + h + 2, z, leaf);
}
function buildPalm(x, z) {
  const base = topAt(x, z);
  const h = 4 + Math.floor(rng() * 2);
  for (let y = base + 1; y <= base + h; y++) set(x, y, z, B.LOG);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) {
    set(x + dx, base + h + 1, z + dz, B.NUIT_LEAVES);
  }
}

// ---------------------------------------------------------------------------
// Gameplay columns (reserved BEFORE tree scatter so nothing grows on them)
// ---------------------------------------------------------------------------
const spawnColumns = [
  // four per biome: heart-adjacent, lane-adjacent, flank, rim-side
  [-22, -22], [-40, -16], [-16, -40], [-44, -42],
  [22, -22], [40, -16], [16, -40], [44, -44],
  [-22, 22], [-44, 16], [-16, 44], [-24, 44],
  [22, 22], [44, 16], [16, 44], [44, 44],
];
const chestColumns = [
  // plaza deck (outside the under-room footprint) + two under-room chests
  [11, 0], [-11, 0], [0, 11], [0, -11], [4, 0], [-4, 0],
  // snow: fort courtyard, tower foot, lake shore, cliff shelf
  [-35, -37], [-34, -33], [-24, -16], [-46, -20],
  // jungle: temple chamber, stair base, pool, ruins
  [38, -32], [23, -32], [22, -10], [18, -34],
  // lava: keep courtyard, rampart corner, causeway, river bridge
  [-34, 36], [-30, 30], [-20, 31], [-46, 24],
  // sand: citadel courtyard, tower bridge, arches, dune
  [35, 34], [30, 36], [24, 22], [42, 12],
  // lane midpoints
  [-20, -20], [20, -20], [-20, 20], [20, 20],
];
const itemColumns = [
  [0, 0], // monument base
  [-34, -34], [34, -34], [-34, 34], [34, 34], // hearts
  [-12, -12], [12, -12], [-12, 12], [12, 12], // gates
  [0, -30], [30, 0], [0, 30], [-30, 0], // cardinal midfields
  [-26, -44], [44, -26], [26, 44],
];
for (const [x, z] of [...spawnColumns, ...chestColumns, ...itemColumns]) {
  reserve(x, z, 1);
}

function scatter(count, area, fn) {
  let placed = 0;
  for (let i = 0; i < count * 30 && placed < count; i++) {
    const x = Math.round(area.x1 + rng() * (area.x2 - area.x1));
    const z = Math.round(area.z1 + rng() * (area.z2 - area.z1));
    if (isReserved(x, z) || Math.hypot(x, z) < PLAZA_R + 6) continue;
    fn(x, z);
    reserve(x, z, 2);
    placed++;
  }
}
scatter(9, { x1: -48, z1: -48, x2: -8, z2: -8 }, buildPine);
scatter(13, { x1: 8, z1: -48, x2: 48, z2: -8 }, buildJungleTree);
scatter(5, { x1: 8, z1: 8, x2: 48, z2: 48 }, buildPalm);

// lava rocks scatter in SW
scatter(7, { x1: -48, z1: 8, x2: -8, z2: 48 }, (x, z) => {
  const base = topAt(x, z);
  fillBox(x, base + 1, z, x + 1, base + 1 + Math.floor(rng() * 2), z + 1, B.LAVA_ROCKY);
});

// ---------------------------------------------------------------------------
// Pass 5: gameplay meta (spawns computed from final terrain)
// ---------------------------------------------------------------------------

/**
 * Lowest walkable floor in a column: solid block with 2 air above. Finds room
 * floors under roofs (under-room, keep courtyards) instead of the roof itself.
 */
function walkableY(x, z) {
  for (let y = 1; y <= 28; y++) {
    if (
      blocks.has(key(x, y, z)) &&
      !blocks.has(key(x, y + 1, z)) &&
      !blocks.has(key(x, y + 2, z))
    ) {
      return y;
    }
  }
  return topAt(x, z);
}

function groundPoint(x, z, clearance) {
  return { x: x + 0.5, y: walkableY(x, z) + clearance, z: z + 0.5 };
}

const spawnPoints = spawnColumns.map(([x, z]) => groundPoint(x, z, 2));
const chestSpawns = chestColumns.map(([x, z]) => ({
  position: groundPoint(x, z, 1),
  yawDeg: Math.floor(rng() * 4) * 90,
}));
const itemSpawns = itemColumns.map(([x, z]) => groundPoint(x, z, 1));

const meta = {
  seed: SEED,
  bounds: { min: { x: -R, z: -R }, max: { x: R, z: R } },
  chestDropRegion: { min: { x: -44, y: 40, z: -44 }, max: { x: 44, y: 40, z: 44 } },
  spawnPoints,
  chestSpawns,
  itemSpawns,
};

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
const here = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.join(here, '..', 'assets', 'maps');

const blocksOut = {};
for (const [k, v] of blocks) blocksOut[k] = v;

fs.writeFileSync(
  path.join(mapsDir, 'biome-arena.json'),
  JSON.stringify({ blockTypes: BLOCK_TYPES, blocks: blocksOut }),
);
fs.writeFileSync(
  path.join(mapsDir, 'biome-arena.meta.json'),
  JSON.stringify(meta, null, 2),
);

console.log(`biome-arena: ${blocks.size} blocks, seed ${SEED}`);
console.log(`spawns: ${spawnPoints.length} players, ${chestSpawns.length} chests, ${itemSpawns.length} items`);
