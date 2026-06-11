/**
 * generate-map.mjs - Builds the three-biome arena map: marine lagoon and
 * beach in the west, jungle ruins in the middle, alien "space" outpost on
 * shadowrock in the east. Reuses the existing block palette (so the game
 * config's per-block damage/material tables stay valid) and keeps ground
 * at y=1 inside the original +-45 envelope so chest/item/spawn coordinates
 * from gameConfig.ts remain correct.
 *
 * Usage: node dev/generate-map.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const B = {
  bricks: 1, bedrock: 2, cobble: 4, diamond: 6, glass: 14, goldOre: 15,
  grass: 16, shadowCore: 19, shadowInfected: 20, log: 23, mossy: 24,
  leaves: 27, planks: 28, sandLight: 29, sand: 30, sandstone: 32,
  shadowrock: 34, stoneBricks: 36, stone: 37, swirl: 38, waterStill: 43,
  emerald: 11
};

const MIN = -55;
const MAX = 55;
const LAGOON_X = -43;   // x < LAGOON_X is water
const MARINE_X = -18;   // x < MARINE_X is marine
const SPACE_X = 18;     // x > SPACE_X is space

const source = JSON.parse(readFileSync('assets/map.json', 'utf8'));
const blocks = {};

function set(x, y, z, id) {
  blocks[`${x},${y},${z}`] = id;
}

// Deterministic pseudo-random so the map is stable between runs.
let seed = 1337;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

// Keep-out zones around configured chest/item spawns.
const config = readFileSync('gameConfig.ts', 'utf8');
const keepOut = [];
for (const match of config.matchAll(/position:\s*\{\s*x:\s*(-?\d+\.?\d*),\s*y:\s*-?\d+\.?\d*,\s*z:\s*(-?\d+\.?\d*)/g)) {
  keepOut.push({ x: Number(match[1]), z: Number(match[2]) });
}
function nearSpawn(x, z, r = 3) {
  return keepOut.some((p) => Math.abs(p.x - x) < r && Math.abs(p.z - z) < r);
}

// ---------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------
for (let x = MIN; x <= MAX; x++) {
  for (let z = MIN; z <= MAX; z++) {
    set(x, 0, z, B.bedrock);
    if (x < LAGOON_X) {
      set(x, 1, z, B.waterStill);
    } else if (x < MARINE_X) {
      set(x, 1, z, rand() < 0.12 ? B.sandLight : B.sand);
    } else if (x <= SPACE_X) {
      set(x, 1, z, B.grass);
    } else {
      set(x, 1, z, rand() < 0.15 ? B.shadowInfected : B.shadowrock);
    }
  }
}

// Perimeter wall.
for (let i = MIN; i <= MAX; i++) {
  for (let y = 1; y <= 5; y++) {
    set(MIN, y, i, B.stoneBricks);
    set(MAX, y, i, B.stoneBricks);
    set(i, y, MIN, B.stoneBricks);
    set(i, y, MAX, B.stoneBricks);
  }
}

// ---------------------------------------------------------------------
// Marine: piers over the lagoon, palms, sandstone rocks
// ---------------------------------------------------------------------
for (const pz of [-30, 10, 38]) {
  for (let x = LAGOON_X - 10; x <= LAGOON_X + 4; x++) {
    set(x, 2, pz, B.planks);
    set(x, 2, pz + 1, B.planks);
    if ((x + 100) % 4 === 0) {
      set(x, 1, pz - 1, B.log);
      set(x, 1, pz + 2, B.log);
    }
  }
}
function palm(x, z) {
  if (nearSpawn(x, z, 4)) return;
  for (let y = 2; y <= 5; y++) set(x, y, z, B.log);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) + Math.abs(dz) <= 2) set(x + dx, 6, z + dz, B.leaves);
    }
  }
}
palm(-32, -40); palm(-25, -12); palm(-36, 22); palm(-28, 46); palm(-22, -34);
for (let i = 0; i < 10; i++) {
  const x = Math.floor(LAGOON_X + 2 + rand() * (LAGOON_X * -1 + MARINE_X - 4));
  const z = Math.floor(MIN + 4 + rand() * (MAX - MIN - 8));
  if (nearSpawn(x, z)) continue;
  set(x, 2, z, B.sandstone);
  if (rand() < 0.5) set(x, 3, z, B.sandstone);
}

// ---------------------------------------------------------------------
// Jungle: canopy trees, mossy ruins
// ---------------------------------------------------------------------
function tree(x, z, height) {
  if (nearSpawn(x, z, 4)) return;
  for (let y = 2; y < 2 + height; y++) set(x, y, z, B.log);
  const top = 1 + height;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      set(x + dx, top, z + dz, B.leaves);
      if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) set(x + dx, top + 1, z + dz, B.leaves);
    }
  }
}
tree(-10, -38, 5); tree(4, -30, 6); tree(14, -44, 5); tree(-14, -10, 6);
tree(10, -2, 5); tree(-4, 14, 6); tree(14, 26, 5); tree(-12, 36, 5);
tree(2, 44, 6); tree(8, 12, 4);

// Ruins: broken mossy walls and an arch near the middle.
function wall(x1, z1, x2, z2, height, id) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
    for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
      if (nearSpawn(x, z, 2)) continue;
      const h = 1 + Math.floor(rand() * height);
      for (let y = 2; y < 2 + h; y++) set(x, y, z, id);
    }
  }
}
wall(-8, -22, -2, -22, 3, B.mossy);
wall(6, -18, 6, -12, 3, B.cobble);
wall(-6, 22, 2, 22, 3, B.mossy);
wall(-2, 30, -2, 36, 3, B.cobble);
// Arch
for (let y = 2; y <= 5; y++) { set(-2, y, 4, B.stoneBricks); set(2, y, 4, B.stoneBricks); }
for (let x = -2; x <= 2; x++) set(6, x === 0 ? 6 : 6, 4, B.stoneBricks), set(x, 6, 4, B.stoneBricks);

// ---------------------------------------------------------------------
// Space: craters, glass-domed outpost, glowing accents, rune pads
// ---------------------------------------------------------------------
function crater(cx, cz, r) {
  for (let a = 0; a < 16; a++) {
    const x = Math.round(cx + Math.cos((a / 16) * Math.PI * 2) * r);
    const z = Math.round(cz + Math.sin((a / 16) * Math.PI * 2) * r);
    if (nearSpawn(x, z)) continue;
    set(x, 2, z, B.stone);
    if (a % 3 === 0) set(x, 3, z, B.stone);
  }
}
crater(30, -32, 4); crater(44, 8, 3); crater(28, 38, 4);

// Outpost: stone-brick base with a glass dome.
for (let x = 36; x <= 44; x++) {
  for (let z = -14; z <= -6; z++) {
    if (x === 36 || x === 44 || z === -14 || z === -6) {
      for (let y = 2; y <= 4; y++) {
        const isDoor = (z === -10 || z === -11) && x === 36 && y <= 3;
        if (!isDoor) set(x, y, z, B.stoneBricks);
      }
    }
  }
}
for (let x = 37; x <= 43; x++) {
  for (let z = -13; z <= -7; z++) {
    const dx = x - 40;
    const dz = z + 10;
    if (dx * dx + dz * dz <= 12) set(x, 5, z, B.glass);
  }
}
set(40, 2, -10, B.diamond); // power core inside

// Glow accents and rune pads.
for (const [gx, gz] of [[24, 16], [48, -40], [50, 44], [34, 4]]) {
  if (!nearSpawn(gx, gz)) {
    set(gx, 2, gz, rand() < 0.5 ? B.diamond : B.emerald);
  }
}
for (const [px, pz] of [[26, -8], [44, 26], [36, -46]]) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (!nearSpawn(px + dx, pz + dz)) set(px + dx, 1, pz + dz, B.swirl);
    }
  }
}
// Scattered gold ore veins in the rock.
for (let i = 0; i < 8; i++) {
  const x = Math.floor(SPACE_X + 3 + rand() * (MAX - SPACE_X - 6));
  const z = Math.floor(MIN + 4 + rand() * (MAX - MIN - 8));
  if (!nearSpawn(x, z)) set(x, 2, z, B.goldOre);
}

// ---------------------------------------------------------------------
writeFileSync('assets/map.json', JSON.stringify({
  blockTypes: source.blockTypes,
  blocks,
  entities: source.entities ?? {},
  version: source.version
}));
console.log(`map written: ${Object.keys(blocks).length} blocks, ${keepOut.length} keep-out points respected`);
