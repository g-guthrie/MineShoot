import { createTerrainSampler } from '../../shared/terrain-sampler.js';

export function createSharedTerrainSampler(worldMeta) {
  const sampler = createTerrainSampler(worldMeta);
  if (!sampler || typeof sampler.getGroundHeightAt !== 'function') {
    throw new Error('GameShared.terrainSampler is missing required getGroundHeightAt(x, z).');
  }
  return sampler;
}
