import { protocol as SHARED_PROTOCOL } from '../../../../shared/protocol.js';
import * as SHARED_LAYOUT from '../../../../shared/world-layout.js';
import * as ThreeModule from '../../../../js/vendor/three.min.js';

if (!globalThis.THREE) {
  globalThis.THREE = ThreeModule && (ThreeModule.default || ThreeModule);
}

const quadrantsModule = await import('../../../../js/world/quadrants.js');

const DEFAULT_WORLD_CFG = (SHARED_PROTOCOL && SHARED_PROTOCOL.world) ? SHARED_PROTOCOL.world : {};
const DEFAULT_WORLD_FLAGS = {
  envV2: !!(DEFAULT_WORLD_CFG.flags && DEFAULT_WORLD_CFG.flags.envV2),
  terrainPhysicsV2: (DEFAULT_WORLD_CFG.flags)
    ? !!DEFAULT_WORLD_CFG.flags.terrainPhysicsV2
    : true
};

const colliderCache = new Map();

function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
  };
}

function normalizeWorldMeta(rawMeta) {
  const source = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
  return {
    worldSeed: String(source.worldSeed || source.seed || `${String(DEFAULT_WORLD_CFG.seedPrefix || 'room-env-v6-static')}-global`),
    worldProfileVersion: Math.max(1, Math.round(Number(source.worldProfileVersion || DEFAULT_WORLD_CFG.profileVersion || 6))),
    worldFlags: cloneWorldFlags(source.worldFlags || DEFAULT_WORLD_FLAGS)
  };
}

function cacheKeyFor(meta) {
  return JSON.stringify({
    worldSeed: meta.worldSeed,
    worldProfileVersion: meta.worldProfileVersion,
    worldFlags: cloneWorldFlags(meta.worldFlags)
  });
}

function createRecorder(colliders) {
  function createTransformState() {
    return {
      x: 0,
      y: 0,
      z: 0,
      set(x, y, z) {
        this.x = Number(x || 0);
        this.y = Number(y || 0);
        this.z = Number(z || 0);
      }
    };
  }

  function makeNode(material) {
    return {
      material: material || null,
      position: createTransformState(),
      rotation: createTransformState(),
      scale: createTransformState()
    };
  }

  return {
    addBlock(x, y, z, w, h, d, material, isSolid) {
      if (isSolid !== false) {
        colliders.push({
          type: 'aabb',
          center: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
          half: { x: Math.abs(Number(w || 0)) * 0.5, y: Math.abs(Number(h || 0)) * 0.5, z: Math.abs(Number(d || 0)) * 0.5 }
        });
      }
      return makeNode(material);
    },
    addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid) {
      if (isSolid !== false) {
        colliders.push({
          type: 'obb',
          center: { x: Number(x || 0), y: Number(y || 0), z: Number(z || 0) },
          half: { x: Math.abs(Number(w || 0)) * 0.5, y: Math.abs(Number(h || 0)) * 0.5, z: Math.abs(Number(d || 0)) * 0.5 },
          rotY: Number(rotY || 0),
          tiltX: Number(tiltX || 0)
        });
      }
      return makeNode(material);
    },
    addDecor(_x, _y, _z, _geometry, material) {
      return makeNode(material);
    }
  };
}

function buildPerimeterMaterials() {
  return {};
}

function buildHeadlessColliders(worldMeta) {
  const colliders = [];
  const place = createRecorder(colliders);
  const biomeMap = SHARED_LAYOUT.DEFAULT_QUADRANT_MAP.slice();
  const quadrantCtx = {
    scene: { add() {} },
    addExclusion() {},
    addWaterfallSheet() {},
    addMistCard() {},
    addLeafSway() {},
    addIceShimmer() {},
    addFlicker() {},
    addSteamColumn() {},
    assetFactory: null
  };

  SHARED_LAYOUT.buildBiomePerimeter(place, buildPerimeterMaterials(), biomeMap);

  for (let i = 0; i < biomeMap.length; i++) {
    const entry = biomeMap[i];
    const builder = quadrantsModule.GameWorldQuadrants
      ? quadrantsModule.GameWorldQuadrants[entry.biome]
      : null;
    if (typeof builder !== 'function') continue;
    const rawBounds = SHARED_LAYOUT.quadrantBounds(entry.quadrant, 0);
    const paddedBounds = SHARED_LAYOUT.quadrantBounds(entry.quadrant, 6);
    builder(paddedBounds, place, {
      ...quadrantCtx,
      biomeEntry: entry,
      rawBounds,
      paddedBounds
    });
  }

  return {
    worldMeta: normalizeWorldMeta(worldMeta),
    colliders
  };
}

export function getHeadlessWorldColliders(rawWorldMeta) {
  const meta = normalizeWorldMeta(rawWorldMeta);
  const key = cacheKeyFor(meta);
  if (!colliderCache.has(key)) {
    colliderCache.set(key, buildHeadlessColliders(meta));
  }
  return colliderCache.get(key);
}
