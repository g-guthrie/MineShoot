import './protocol.js';
import './terrain-sampler.js';
import {
  createHeadlessRecorder,
  ensureHeadlessWorldRuntime
} from './headless-world-runtime.js';
import '../js/world/intersection-builder.js';
import '../js/world/quadrant-arctic.js';
import '../js/world/quadrant-basin.js';
import '../js/world/quadrant-citadel.js';
import '../js/world/quadrant-desert.js';
import '../js/world/quadrant-jungle.js';
import '../js/world/quadrant-nuclear.js';
import '../js/world/quadrant-quarry.js';
import '../js/world/quadrant-radar.js';
import '../js/world/quadrant-urban.js';
import {
  WORLD_MIN,
  WORLD_MAX,
  DEFAULT_QUADRANT_MAP,
  quadrantBounds,
  buildBiomePerimeter
} from './world-layout.js';

function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
  };
}

export function buildWorldCollisionData(worldMeta) {
  const runtime = ensureHeadlessWorldRuntime();
  const recorder = createHeadlessRecorder();
  const intersections = runtime.WorldIntersections || {};
  const quadrants = runtime.WorldQuadrants || {};

  if (typeof intersections.buildGridDecor === 'function') {
    intersections.buildGridDecor({
      place: recorder.place,
      materialLibrary: runtime.GameMaterialLibrary,
      layout: runtime.GameShared.worldLayout,
      biomeMap: DEFAULT_QUADRANT_MAP.slice(),
      fx: recorder.ctx
    });
  }

  buildBiomePerimeter(recorder.place, null, DEFAULT_QUADRANT_MAP);

  for (let qi = 0; qi < DEFAULT_QUADRANT_MAP.length; qi++) {
    const entry = DEFAULT_QUADRANT_MAP[qi];
    const builder = quadrants[entry.biome];
    if (typeof builder !== 'function') continue;
    builder(quadrantBounds(entry.quadrant, 6), recorder.place, recorder.ctx);
  }

  return {
    worldSeed: String(worldMeta && worldMeta.worldSeed || ''),
    worldProfileVersion: Number(worldMeta && worldMeta.worldProfileVersion || 0),
    worldFlags: cloneWorldFlags(worldMeta && worldMeta.worldFlags),
    boundsMin: WORLD_MIN,
    boundsMax: WORLD_MAX,
    collidables: recorder.collidables.slice(),
    spawnExclusionZones: recorder.spawnExclusionZones.slice()
  };
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.worldCollision = {
  buildWorldCollisionData
};
