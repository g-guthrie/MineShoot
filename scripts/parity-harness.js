#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function loadSideEffectModule(relPath, context) {
  const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  vm.runInContext(code, context, { filename: relPath });
}

function makeContext() {
  const context = vm.createContext({
    console,
    Math,
    Date,
    setTimeout,
    clearTimeout
  });
  context.globalThis = context;
  context.window = context;
  return context;
}

function hashSeed(seedText) {
  const str = String(seedText || 'seed');
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function makeRng(seedText) {
  let state = hashSeed(seedText);
  return () => {
    state ^= (state << 13);
    state ^= (state >>> 17);
    state ^= (state << 5);
    return ((state >>> 0) / 4294967295);
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function makeAabb(cx, cy, cz, w, h, d) {
  return {
    min: { x: cx - (w * 0.5), y: cy - (h * 0.5), z: cz - (d * 0.5) },
    max: { x: cx + (w * 0.5), y: cy + (h * 0.5), z: cz + (d * 0.5) }
  };
}

function buildColliders(layout, config) {
  const solids = layout.buildSolidSpecs(config);
  const out = [];
  for (const s of solids) {
    if (!s) continue;
    out.push(makeAabb(s.x, s.y, s.z, s.w, s.h, s.d));
  }
  return out;
}

function intersectsCircleAabbXZ(x, z, radius, box) {
  const cx = clamp(x, box.min.x, box.max.x);
  const cz = clamp(z, box.min.z, box.max.z);
  const dx = x - cx;
  const dz = z - cz;
  return (dx * dx + dz * dz) < (radius * radius);
}

function collectOverlaps(colliders, x, z, feetY, height, radius) {
  const headY = feetY + height;
  const out = [];
  for (const box of colliders) {
    if (headY <= box.min.y + 0.001 || feetY >= box.max.y - 0.001) continue;
    if (!intersectsCircleAabbXZ(x, z, radius, box)) continue;
    out.push(box);
  }
  return out;
}

function separateFromBox(x, z, radius, box) {
  const cx = clamp(x, box.min.x, box.max.x);
  const cz = clamp(z, box.min.z, box.max.z);
  const dx = x - cx;
  const dz = z - cz;
  const distSq = dx * dx + dz * dz;
  const pad = 0.002;

  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const overlap = (radius - dist) + pad;
    if (overlap <= 0) return { x: 0, z: 0 };
    return { x: (dx / dist) * overlap, z: (dz / dist) * overlap };
  }

  const toMinX = Math.abs(x - box.min.x);
  const toMaxX = Math.abs(box.max.x - x);
  const toMinZ = Math.abs(z - box.min.z);
  const toMaxZ = Math.abs(box.max.z - z);

  let min = toMinX;
  let axis = 'xMin';
  if (toMaxX < min) { min = toMaxX; axis = 'xMax'; }
  if (toMinZ < min) { min = toMinZ; axis = 'zMin'; }
  if (toMaxZ < min) { min = toMaxZ; axis = 'zMax'; }

  if (axis === 'xMin') return { x: -(radius + toMinX + pad), z: 0 };
  if (axis === 'xMax') return { x: (radius + toMaxX + pad), z: 0 };
  if (axis === 'zMin') return { x: 0, z: -(radius + toMinZ + pad) };
  return { x: 0, z: (radius + toMaxZ + pad) };
}

function resolveOverlap(colliders, state, bounds) {
  let x = state.x;
  let z = state.z;
  const feetY = state.feetY;
  const height = state.height;
  const radius = state.radius;
  const minBound = bounds.min + radius;
  const maxBound = bounds.max - radius;

  for (let iter = 0; iter < 12; iter++) {
    const overlaps = collectOverlaps(colliders, x, z, feetY, height, radius);
    if (overlaps.length === 0) return { x, z, resolved: true };
    let moved = 0;
    for (const box of overlaps) {
      const sep = separateFromBox(x, z, radius, box);
      x += sep.x;
      z += sep.z;
      moved += Math.sqrt((sep.x * sep.x) + (sep.z * sep.z));
    }
    x = clamp(x, minBound, maxBound);
    z = clamp(z, minBound, maxBound);
    if (moved < 0.0001) break;
  }

  return { x, z, resolved: collectOverlaps(colliders, x, z, feetY, height, radius).length === 0 };
}

function randomSpawn(rng, world, padding) {
  const min = world.min + padding;
  const max = world.max - padding;
  return {
    x: min + rng() * (max - min),
    z: min + rng() * (max - min)
  };
}

function runSpawnSafety(prim, layout) {
  const world = layout.getConfig({});
  const entity = prim.entity || {};
  const colliders = buildColliders(layout, world);
  const seeds = ['mineshoot-v1', 'mineshoot-v2', 'arena-a', 'arena-b', 'arena-c', 'arena-d', 'arena-e', 'arena-f', 'arena-g', 'arena-h'];
  let overlaps = 0;
  let total = 0;

  for (const seed of seeds) {
    const rng = makeRng(seed);
    for (let i = 0; i < 50; i++) {
      total++;
      const spawn = randomSpawn(rng, world, entity.spawn_padding_default || 8);
      const resolved = resolveOverlap(colliders, {
        x: spawn.x,
        z: spawn.z,
        feetY: 0,
        height: entity.capsule_height,
        radius: entity.capsule_radius
      }, world);
      const stillOverlap = !resolved.resolved;
      if (stillOverlap) overlaps++;
    }
  }

  return {
    total,
    overlaps,
    ok: overlaps === 0
  };
}

function runSchemaChecks(schema) {
  const checks = [];
  checks.push(schema.validateClientInput({
    t: 'input',
    seq: 1,
    moveX: 0.25,
    moveZ: -1,
    jumpHeld: false,
    sprint: false,
    yaw: 0.1,
    pitch: 0.2,
    actions: ['fire']
  }).ok);
  checks.push(!schema.validateClientInput({ t: 'input', x: 'bad' }).ok);
  checks.push(schema.validateLoadout({ slots: ['rifle', 'shotgun'] }, ['rifle', 'shotgun', 'sniper']).ok);
  checks.push(!schema.validateLoadout({ slots: ['invalid'] }, ['rifle']).ok);
  checks.push(schema.validateServerEntitySnapshot({
    t: 'entity_snapshot',
    serverTime: Date.now(),
    entities: [{
      id: 'p1', kind: 'player', classId: 'sharpshooter',
      x: 0, feetY: 0, z: 0, yaw: 0, pitch: 0,
      hp: 500, hpMax: 500, armor: 90, armorMax: 90, alive: true,
      weaponId: 'rifle', moveSpeedNorm: 0, sprinting: false
    }]
  }).ok);
  checks.push(schema.validateFireIntent({ t: 'fire_intent', weaponId: 'rifle', seq: 2, fireMode: 'single' }).ok);
  checks.push(schema.validateThrowIntent({ t: 'throw_intent', throwableId: 'frag', seq: 3 }).ok);
  checks.push(schema.validateChunkSubscribe({ t: 'chunk_subscribe', centerChunkX: 0, centerChunkZ: 0 }).ok);
  checks.push(schema.validateWsClientMessage({ t: 'equip_weapon', weaponId: 'shotgun' }).ok);
  checks.push(schema.validateWsClientMessage({ t: 'class_queue', classId: 'ninja' }).ok);
  return checks.every(Boolean);
}

function run() {
  const context = makeContext();
  loadSideEffectModule('shared/game-primitives.js', context);
  loadSideEffectModule('shared/world-layout.js', context);
  loadSideEffectModule('shared/game-schema.js', context);

  const prim = context.__GAME_PRIMITIVES__;
  const layout = context.__GAME_WORLD_LAYOUT__;
  const schema = context.__GAME_SCHEMA__;

  const spawn = runSpawnSafety(prim, layout);
  const schemaOk = runSchemaChecks(schema);

  const lines = [];
  lines.push('[parity-harness] Spawn safety: ' + spawn.overlaps + ' overlaps across ' + spawn.total + ' spawn samples');
  lines.push('[parity-harness] Schema checks: ' + (schemaOk ? 'pass' : 'fail'));

  const pass = spawn.ok && schemaOk;
  lines.push('[parity-harness] RESULT: ' + (pass ? 'PASS' : 'FAIL'));
  console.log(lines.join('\n'));
  process.exit(pass ? 0 : 1);
}

run();
