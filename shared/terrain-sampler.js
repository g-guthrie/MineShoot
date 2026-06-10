import {
  WORLD_SIZE,
  WORLD_CENTER,
  WORLD_MIN,
  WORLD_MAX
} from './world-layout.js';

const DEFAULT_WORLD_SEED = 'room-env-v6-static-global';
const DEFAULT_WORLD_PROFILE_VERSION = 7;
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

export function createTerrainSampler(worldMeta) {
  const meta = normalizeWorldMeta(worldMeta);
  const worldSeed = meta.worldSeed || DEFAULT_WORLD_SEED;

  return {
    worldSeed,
    worldProfileVersion: meta.worldProfileVersion,
    worldFlags: cloneWorldFlags(meta.worldFlags),
    worldSize: WORLD_SIZE,
    worldMin: WORLD_MIN,
    worldMax: WORLD_MAX,
    worldCenter: WORLD_CENTER,
    getGroundHeightAt() {
      return 0;
    }
  };
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.terrainSampler = {
  createTerrainSampler
};
