export const BASE_WORLD_SIZE = 50;
export const WORLD_AREA_SCALE = 5;
export const WORLD_SIZE = Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE));
export const WORLD_CENTER = WORLD_SIZE * 0.5;
export const WORLD_MARGIN = 2;
export const WORLD_MIN = WORLD_MARGIN;
export const WORLD_MAX = WORLD_SIZE - WORLD_MARGIN;
export const DEFAULT_SPAWN_PADDING = 8;
export const COMBAT_TUNED_WORLD_SIZE = 112;

export const BIOME_ARCTIC = 'arctic';
export const BIOME_URBAN = 'urban';
export const BIOME_DESERT = 'desert';
export const BIOME_JUNGLE = 'jungle';

export const DEFAULT_QUADRANT_MAP = [
  { quadrant: 'NW', biome: BIOME_ARCTIC },
  { quadrant: 'NE', biome: BIOME_URBAN },
  { quadrant: 'SW', biome: BIOME_DESERT },
  { quadrant: 'SE', biome: BIOME_JUNGLE }
];

export function quadrantBounds(quadrant, padding) {
  const pad = Number(padding || 0);
  if (quadrant === 'NW') return { minX: WORLD_MIN + pad, maxX: WORLD_CENTER - pad, minZ: WORLD_MIN + pad, maxZ: WORLD_CENTER - pad };
  if (quadrant === 'NE') return { minX: WORLD_CENTER + pad, maxX: WORLD_MAX - pad, minZ: WORLD_MIN + pad, maxZ: WORLD_CENTER - pad };
  if (quadrant === 'SW') return { minX: WORLD_MIN + pad, maxX: WORLD_CENTER - pad, minZ: WORLD_CENTER + pad, maxZ: WORLD_MAX - pad };
  return { minX: WORLD_CENTER + pad, maxX: WORLD_MAX - pad, minZ: WORLD_CENTER + pad, maxZ: WORLD_MAX - pad };
}

export function buildBiomePerimeter(place, materials) {
  if (!place || typeof place.addBlock !== 'function') return;

  const mats = materials || {};
  const edgeH = 3.0;
  const edgeThick = 1.2;
  const halfLen = (WORLD_CENTER - WORLD_MIN);
  const qMid = (WORLD_MIN + WORLD_CENTER) * 0.5;
  const qMid2 = (WORLD_CENTER + WORLD_MAX) * 0.5;

  place.addBlock(qMid, edgeH * 0.5, WORLD_MIN - edgeThick * 0.5, halfLen, edgeH, edgeThick, mats.arcticBase || null, true);
  place.addBlock(qMid, edgeH + 0.2, WORLD_MIN - edgeThick * 0.5, halfLen, 0.4, edgeThick + 0.2, mats.arcticCap || null, false);
  for (let ni = 0; ni < 5; ni++) {
    const nx = WORLD_MIN + halfLen * 0.15 + (halfLen * 0.7 * ni / 4);
    place.addBlock(nx, edgeH * 0.7, WORLD_MIN - edgeThick * 0.8, 1.4, edgeH * 0.5, 0.3, mats.arcticIce || null, false);
  }

  place.addBlock(qMid2, edgeH * 0.5, WORLD_MIN - edgeThick * 0.5, halfLen, edgeH, edgeThick, mats.urbanBase || null, true);
  place.addBlock(qMid2, edgeH + 0.15, WORLD_MIN - edgeThick * 0.5, halfLen, 0.1, 0.1, mats.urbanRail || null, false);
  place.addBlock(qMid2, edgeH * 0.65, WORLD_MIN - edgeThick * 0.85, halfLen * 0.6, 0.3, 0.15, mats.urbanPaint || null, false);

  place.addBlock(qMid, edgeH * 0.5, WORLD_MAX + edgeThick * 0.5, halfLen, edgeH, edgeThick, mats.desertBase || null, true);
  place.addBlock(qMid, edgeH + 0.15, WORLD_MAX + edgeThick * 0.5, halfLen, 0.35, edgeThick + 0.3, mats.desertCap || null, false);

  place.addBlock(qMid2, edgeH * 0.5, WORLD_MAX + edgeThick * 0.5, halfLen, edgeH, edgeThick, mats.jungleBase || null, true);
  place.addBlock(qMid2, edgeH + 0.1, WORLD_MAX + edgeThick * 0.5, halfLen, 0.3, edgeThick + 0.1, mats.jungleMoss || null, false);
  for (let si = 0; si < 6; si++) {
    const sx = WORLD_CENTER + halfLen * 0.1 + (halfLen * 0.8 * si / 5);
    const vineH = 1.2 + (si % 3) * 0.5;
    place.addBlock(sx, vineH * 0.5, WORLD_MAX + edgeThick * 0.85, 0.25, vineH, 0.2, mats.jungleVine || null, false);
  }

  place.addBlock(WORLD_MIN - edgeThick * 0.5, edgeH * 0.5, qMid, edgeThick, edgeH, halfLen, mats.arcticBase || null, true);
  place.addBlock(WORLD_MIN - edgeThick * 0.5, edgeH + 0.2, qMid, edgeThick + 0.2, 0.4, halfLen, mats.arcticCap || null, false);

  place.addBlock(WORLD_MIN - edgeThick * 0.5, edgeH * 0.5, qMid2, edgeThick, edgeH, halfLen, mats.desertBase || null, true);
  place.addBlock(WORLD_MIN - edgeThick * 0.5, edgeH + 0.15, qMid2, edgeThick + 0.3, 0.35, halfLen, mats.desertCap || null, false);

  place.addBlock(WORLD_MAX + edgeThick * 0.5, edgeH * 0.5, qMid, edgeThick, edgeH, halfLen, mats.urbanBase || null, true);
  place.addBlock(WORLD_MAX + edgeThick * 0.5, edgeH + 0.15, qMid, 0.1, 0.1, halfLen, mats.urbanRail || null, false);
  place.addBlock(WORLD_MAX + edgeThick * 0.85, edgeH * 0.5, qMid, 0.15, 0.3, halfLen * 0.5, mats.urbanPaint || null, false);

  place.addBlock(WORLD_MAX + edgeThick * 0.5, edgeH * 0.5, qMid2, edgeThick, edgeH, halfLen, mats.jungleBase || null, true);
  place.addBlock(WORLD_MAX + edgeThick * 0.5, edgeH + 0.1, qMid2, edgeThick + 0.1, 0.3, halfLen, mats.jungleMoss || null, false);
  for (let ei = 0; ei < 6; ei++) {
    const ez = WORLD_CENTER + halfLen * 0.1 + (halfLen * 0.8 * ei / 5);
    const evH = 1.0 + (ei % 3) * 0.6;
    place.addBlock(WORLD_MAX + edgeThick * 0.85, evH * 0.5, ez, 0.2, evH, 0.25, mats.jungleVine || null, false);
  }
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.worldLayout = {
  BASE_WORLD_SIZE,
  WORLD_AREA_SCALE,
  WORLD_SIZE,
  WORLD_CENTER,
  WORLD_MARGIN,
  WORLD_MIN,
  WORLD_MAX,
  DEFAULT_SPAWN_PADDING,
  COMBAT_TUNED_WORLD_SIZE,
  BIOME_ARCTIC,
  BIOME_URBAN,
  BIOME_DESERT,
  BIOME_JUNGLE,
  DEFAULT_QUADRANT_MAP,
  quadrantBounds,
  buildBiomePerimeter
};
