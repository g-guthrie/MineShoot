const BASE_WORLD_SIZE = 50;
const WORLD_AREA_SCALE = 5;
const WORLD_SIZE = Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE));
const WORLD_CENTER = WORLD_SIZE * 0.5;
const WORLD_MARGIN = 2;
const WORLD_MIN = WORLD_MARGIN;
const WORLD_MAX = WORLD_SIZE - WORLD_MARGIN;

const BIOME_ARCTIC = 'arctic';
const BIOME_URBAN = 'urban';
const BIOME_DESERT = 'desert';
const BIOME_JUNGLE = 'jungle';

const DEFAULT_WORLD_SEED = 'mineshoot-v1';
const DEFAULT_WORLD_PROFILE_VERSION = 3;
const DEFAULT_WORLD_FLAGS = {
  envV2: true,
  terrainPhysicsV2: true
};

function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
  };
}

function normalizeWorldMeta(rawMeta) {
  if (!rawMeta || typeof rawMeta !== 'object') {
    return {
      worldSeed: '',
      worldProfileVersion: DEFAULT_WORLD_PROFILE_VERSION,
      worldFlags: cloneWorldFlags(DEFAULT_WORLD_FLAGS)
    };
  }

  let seed = '';
  if (typeof rawMeta.worldSeed === 'string' && rawMeta.worldSeed.trim()) {
    seed = rawMeta.worldSeed.trim();
  } else if (typeof rawMeta.seed === 'string' && rawMeta.seed.trim()) {
    seed = rawMeta.seed.trim();
  }

  return {
    worldSeed: seed,
    worldProfileVersion: Math.max(1, Math.round(Number(rawMeta.worldProfileVersion) || DEFAULT_WORLD_PROFILE_VERSION)),
    worldFlags: cloneWorldFlags(rawMeta.worldFlags || DEFAULT_WORLD_FLAGS)
  };
}

function hashSeed(seedText) {
  const str = String(seedText || DEFAULT_WORLD_SEED);
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function createRng(seedText) {
  let state = hashSeed(seedText);
  return {
    random01() {
      state ^= (state << 13);
      state ^= (state >>> 17);
      state ^= (state << 5);
      return (state >>> 0) / 4294967295;
    },
    getState() {
      return (state >>> 0) || 1;
    }
  };
}

function biomeBounds(biomeId, padding) {
  const pad = Number(padding || 0);
  if (biomeId === BIOME_ARCTIC) {
    return { minX: WORLD_MIN + pad, maxX: WORLD_CENTER - pad, minZ: WORLD_MIN + pad, maxZ: WORLD_CENTER - pad };
  }
  if (biomeId === BIOME_URBAN) {
    return { minX: WORLD_CENTER + pad, maxX: WORLD_MAX - pad, minZ: WORLD_MIN + pad, maxZ: WORLD_CENTER - pad };
  }
  if (biomeId === BIOME_DESERT) {
    return { minX: WORLD_MIN + pad, maxX: WORLD_CENTER - pad, minZ: WORLD_CENTER + pad, maxZ: WORLD_MAX - pad };
  }
  return { minX: WORLD_CENTER + pad, maxX: WORLD_MAX - pad, minZ: WORLD_CENTER + pad, maxZ: WORLD_MAX - pad };
}

function clonePools(pools) {
  const out = [];
  for (let i = 0; i < pools.length; i++) {
    const p = pools[i];
    out.push({
      x: Number(p.x || 0),
      z: Number(p.z || 0),
      radius: Number(p.radius || 0),
      depth: Number(p.depth || 0),
      surfaceY: Number(p.surfaceY || 0)
    });
  }
  return out;
}

export function createTerrainSampler(worldMeta) {
  const meta = normalizeWorldMeta(worldMeta);
  const worldSeed = meta.worldSeed || DEFAULT_WORLD_SEED;
  const rng = createRng(worldSeed);

  function randRange(min, max) {
    return min + (rng.random01() * (max - min));
  }

  function randomPointInBiome(biomeId, padding) {
    const b = biomeBounds(biomeId, padding || 0);
    return {
      x: randRange(b.minX, b.maxX),
      z: randRange(b.minZ, b.maxZ)
    };
  }

  const waterPools = [];
  const junglePoolCount = Math.max(3, Math.round(WORLD_AREA_SCALE * 1.2));
  let poolTries = 0;
  while (waterPools.length < junglePoolCount && poolTries < junglePoolCount * 8) {
    poolTries++;
    const poolPt = randomPointInBiome(BIOME_JUNGLE, 5);
    const poolRadius = randRange(2.5, 5.2);
    if (poolPt.x + poolRadius > WORLD_MAX - 2 || poolPt.z + poolRadius > WORLD_MAX - 2) continue;

    waterPools.push({
      x: poolPt.x,
      z: poolPt.z,
      radius: poolRadius,
      depth: randRange(0.55, 0.9),
      surfaceY: -0.22
    });
  }

  const stablePools = clonePools(waterPools);

  function getGroundHeightAt(x, z) {
    const sx = Number(x || 0);
    const sz = Number(z || 0);
    let y = 0;
    for (let i = 0; i < stablePools.length; i++) {
      const p = stablePools[i];
      const dx = sx - p.x;
      const dz = sz - p.z;
      const d = Math.sqrt((dx * dx) + (dz * dz));
      if (d >= p.radius) continue;
      const t = 1 - (d / p.radius);
      const depth = p.depth * (0.35 + (0.65 * t));
      const sampleY = -depth;
      if (sampleY < y) y = sampleY;
    }
    return y;
  }

  return {
    worldSeed,
    worldProfileVersion: meta.worldProfileVersion,
    worldFlags: cloneWorldFlags(meta.worldFlags),
    worldSize: WORLD_SIZE,
    worldMin: WORLD_MIN,
    worldMax: WORLD_MAX,
    worldCenter: WORLD_CENTER,
    worldAreaScale: WORLD_AREA_SCALE,
    waterPools: clonePools(stablePools),
    poolRngStateAfter: rng.getState(),
    getGroundHeightAt
  };
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.terrainSampler = {
  createTerrainSampler
};
