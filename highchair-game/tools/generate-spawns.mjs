#!/usr/bin/env node
/**
 * Generates deathmatch spawn points from the world colliders — the
 * canonical replacement for hand-placed points, which drifted as the world
 * gained solid decor (players could spawn inside the nuclear cooling tower).
 *
 * A candidate must be:
 *  - open ground: highest collider top at (x,z) within [-0.5, 1.2]
 *  - uncovered: no collider volume overhead (surface+0.4 .. surface+6)
 *    within a 1.4-unit footprint (no spawning under floors/bridges)
 *  - unenclosed: at least 3 of 8 horizontal rays (length 10) escape without
 *    hitting a wall taller than chest height (rejects tower/room interiors)
 *  - away from the rim (|x|,|z| <= 66)
 * Then 16 survivors are picked greedy max-min-distance for spread.
 *
 *   node tools/generate-spawns.mjs   -> updates assets/maps/boxman-arena.meta.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const collidersPath = path.join(here, '..', 'assets', 'maps', 'boxman-world.colliders.json');
const metaPath = path.join(here, '..', 'assets', 'maps', 'boxman-arena.meta.json');

const colliders = JSON.parse(fs.readFileSync(collidersPath, 'utf8')).map(c => ({
  ...c,
  // conservative AABB for rotated boxes
  ex: (c.rotY || c.tiltX) ? Math.max(c.hx, c.hz) : c.hx,
  ez: (c.rotY || c.tiltX) ? Math.max(c.hx, c.hz) : c.hz,
}));

const GRID_STEP = 4;
const EDGE_MARGIN = 66;
const SURFACE_MIN = -0.5;
const SURFACE_MAX = 1.2;
const FOOT_RADIUS = 1.4;
const CLEARANCE_TOP = 6;
const ESCAPE_RAYS = 8;
const ESCAPE_LENGTH = 10;
const ESCAPE_MIN_OPEN = 3;
const WALL_MIN_HEIGHT = 1.6; // walls shorter than chest height don't trap you
const SPAWN_COUNT = 16;

function surfaceY(x, z) {
  let top = 0;
  for (const c of colliders) {
    if (Math.abs(x - c.x) <= c.ex && Math.abs(z - c.z) <= c.ez) {
      top = Math.max(top, c.y + c.hy);
    }
  }
  return top;
}

function hasOverhead(x, z, surface) {
  const lo = surface + 0.4;
  const hi = surface + CLEARANCE_TOP;
  for (const c of colliders) {
    if (Math.abs(x - c.x) > c.ex + FOOT_RADIUS || Math.abs(z - c.z) > c.ez + FOOT_RADIUS) continue;
    const cLo = c.y - c.hy;
    const cHi = c.y + c.hy;
    if (cHi > lo && cLo < hi && cLo > surface + 0.2) return true; // volume above, not the floor itself
  }
  return false;
}

function escapeOpen(x, z, surface) {
  let open = 0;
  for (let i = 0; i < ESCAPE_RAYS; i++) {
    const a = (i / ESCAPE_RAYS) * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    let blocked = false;
    for (let d = 1; d <= ESCAPE_LENGTH; d += 1) {
      const px = x + dx * d, pz = z + dz * d;
      for (const c of colliders) {
        if (Math.abs(px - c.x) > c.ex || Math.abs(pz - c.z) > c.ez) continue;
        const top = c.y + c.hy;
        const bottom = c.y - c.hy;
        // A wall: rises well above the spawn surface and isn't just floor
        if (top > surface + WALL_MIN_HEIGHT && bottom < surface + WALL_MIN_HEIGHT) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
    }
    if (!blocked) open++;
  }
  return open >= ESCAPE_MIN_OPEN;
}

const candidates = [];
for (let x = -EDGE_MARGIN; x <= EDGE_MARGIN; x += GRID_STEP) {
  for (let z = -EDGE_MARGIN; z <= EDGE_MARGIN; z += GRID_STEP) {
    const s = surfaceY(x, z);
    if (s < SURFACE_MIN || s > SURFACE_MAX) continue;
    if (hasOverhead(x, z, s)) continue;
    if (!escapeOpen(x, z, s)) continue;
    candidates.push({ x, y: +s.toFixed(2), z });
  }
}
if (candidates.length < SPAWN_COUNT) {
  throw new Error(`only ${candidates.length} spawn candidates found — loosen the criteria`);
}

// Greedy max-min-distance spread, seeded from the point nearest the center.
const picked = [candidates.reduce((a, b) =>
  (a.x * a.x + a.z * a.z) <= (b.x * b.x + b.z * b.z) ? a : b)];
while (picked.length < SPAWN_COUNT) {
  let best, bestScore = -1;
  for (const c of candidates) {
    let minD = Infinity;
    for (const p of picked) {
      const d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2;
      if (d < minD) minD = d;
    }
    if (minD > bestScore) { bestScore = minD; best = c; }
  }
  picked.push(best);
}

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
meta.spawnPoints = picked;
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
console.log(`${candidates.length} candidates -> ${picked.length} spawns:`);
console.log(picked.map(p => `(${p.x}, ${p.y}, ${p.z})`).join(' '));
