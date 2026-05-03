export const BASE_WORLD_SIZE = 50;
export const WORLD_AREA_SCALE = 11;
export const WORLD_SIZE = Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE));
export const WORLD_CENTER = WORLD_SIZE * 0.5;
export const WORLD_MARGIN = 2;
export const WORLD_MIN = WORLD_MARGIN;
export const WORLD_MAX = WORLD_SIZE - WORLD_MARGIN;
export const WORLD_PLAYABLE_SPAN = WORLD_MAX - WORLD_MIN;
export const DEFAULT_SPAWN_PADDING = 8;

export const BIOME_ARCTIC = 'arctic';
export const BIOME_URBAN = 'urban';
export const BIOME_DESERT = 'desert';
export const BIOME_JUNGLE = 'jungle';
export const BIOME_NUCLEAR = 'nuclear';
export const BIOME_CITADEL = 'citadel';
export const BIOME_QUARRY = 'quarry';
export const BIOME_RIVER_ARCHES = 'river-arches';
export const BIOME_VOLCANO = 'volcano';
export const BIOME_GRID_COLS = 3;
export const BIOME_GRID_ROWS = 3;
export const DEFAULT_BIOME_CELL_LABELS = [
  BIOME_ARCTIC,
  BIOME_VOLCANO,
  BIOME_DESERT,
  BIOME_JUNGLE,
  'pirate-cove',
  BIOME_NUCLEAR,
  BIOME_QUARRY,
  BIOME_RIVER_ARCHES,
  'whoville'
];

const CELL_WIDTH = WORLD_PLAYABLE_SPAN / BIOME_GRID_COLS;
const CELL_DEPTH = WORLD_PLAYABLE_SPAN / BIOME_GRID_ROWS;
const LEGACY_QUADRANTS = {
  NW: { row: 0, col: 0 },
  NE: { row: 0, col: BIOME_GRID_COLS - 1 },
  SW: { row: BIOME_GRID_ROWS - 1, col: 0 },
  SE: { row: BIOME_GRID_ROWS - 1, col: BIOME_GRID_COLS - 1 }
};

function clampGridIndex(value, size) {
  const next = Math.floor(Number(value) || 0);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.min(size - 1, next));
}

function cellIdFor(row, col) {
  return 'r' + String(row) + 'c' + String(col);
}

function buildBiomeCellMap(labels) {
  const entries = [];
  for (let row = 0; row < BIOME_GRID_ROWS; row++) {
    for (let col = 0; col < BIOME_GRID_COLS; col++) {
      const index = (row * BIOME_GRID_COLS) + col;
      entries.push({
        cell: cellIdFor(row, col),
        quadrant: cellIdFor(row, col),
        row,
        col,
        biome: labels[index] || BIOME_JUNGLE,
        label: labels[index] || ('cell ' + String(index + 1))
      });
    }
  }
  return entries;
}

function clampPlayableRatio(value) {
  if (!(WORLD_MAX > WORLD_MIN)) return 0;
  const clamped = Math.max(WORLD_MIN, Math.min(WORLD_MAX, Number(value || 0)));
  const ratio = (clamped - WORLD_MIN) / WORLD_PLAYABLE_SPAN;
  return Math.max(0, Math.min(0.999999, ratio));
}

function findCellEntry(row, col, biomeMap) {
  const map = Array.isArray(biomeMap) && biomeMap.length ? biomeMap : DEFAULT_BIOME_MAP;
  for (let i = 0; i < map.length; i++) {
    const entry = map[i];
    if (!entry) continue;
    if (Number(entry.row) === row && Number(entry.col) === col) return entry;
  }
  return null;
}

function materialsForBiome(biomeId, mats) {
  const key = String(biomeId || BIOME_JUNGLE);
  const dynamicBase = mats[key + 'Base'];
  const dynamicAccent = mats[key + 'Accent'];
  const dynamicDetail = mats[key + 'Detail'];
  if (dynamicBase || dynamicAccent || dynamicDetail) {
    return {
      base: dynamicBase || dynamicAccent || dynamicDetail || null,
      accent: dynamicAccent || dynamicBase || dynamicDetail || null,
      detail: dynamicDetail || dynamicAccent || dynamicBase || null
    };
  }
  if (biomeId === BIOME_ARCTIC) return { base: mats.arcticBase || null, accent: mats.arcticAccent || mats.arcticBase || null, detail: mats.arcticDetail || mats.arcticAccent || null };
  if (biomeId === BIOME_URBAN) return { base: mats.urbanBase || null, accent: mats.urbanAccent || mats.urbanBase || null, detail: mats.urbanDetail || mats.urbanAccent || null };
  if (biomeId === BIOME_DESERT) return { base: mats.desertBase || null, accent: mats.desertAccent || mats.desertBase || null, detail: mats.desertDetail || mats.desertAccent || null };
  if (biomeId === BIOME_NUCLEAR) return { base: mats.nuclearBase || mats.urbanBase || null, accent: mats.nuclearAccent || mats.urbanAccent || null, detail: mats.nuclearDetail || mats.urbanDetail || null };
  if (biomeId === BIOME_CITADEL) return { base: mats.citadelBase || mats.quarryBase || mats.desertBase || null, accent: mats.citadelAccent || mats.quarryAccent || mats.desertAccent || null, detail: mats.citadelDetail || mats.quarryDetail || mats.desertDetail || null };
  if (biomeId === BIOME_QUARRY) return { base: mats.quarryBase || mats.desertBase || null, accent: mats.quarryAccent || mats.desertAccent || null, detail: mats.quarryDetail || mats.desertDetail || null };
  if (biomeId === BIOME_RIVER_ARCHES) return { base: mats.riverArchesBase || mats.jungleBase || null, accent: mats.riverArchesAccent || mats.desertAccent || null, detail: mats.riverArchesDetail || mats.jungleDetail || null };
  return {
    base: mats.jungleBase || null,
    accent: mats.jungleAccent || mats.jungleBase || null,
    detail: mats.jungleDetail || mats.jungleAccent || null
  };
}

function addHorizontalAccent(place, biomeId, bounds, z, edgeH, edgeThick, mats, invert) {
  const centerX = (bounds.minX + bounds.maxX) * 0.5;
  const span = Math.max(1.5, bounds.maxX - bounds.minX);
  const direction = invert ? -1 : 1;
  if (biomeId === BIOME_ARCTIC) {
    for (let i = 0; i < 3; i++) {
      const x = bounds.minX + (span * (0.2 + (i * 0.3)));
      const spikeH = 1.1 + (i % 2) * 0.55;
      place.addBlock(x, spikeH * 0.5, z + (edgeThick * 0.32 * direction), 0.45, spikeH, 0.28, mats.detail, false);
    }
    return;
  }
  if (biomeId === BIOME_URBAN) {
    place.addBlock(centerX, edgeH + 0.14, z, span * 0.7, 0.1, 0.12, mats.accent, false);
    place.addBlock(centerX, edgeH * 0.62, z + (edgeThick * 0.28 * direction), span * 0.52, 0.2, 0.14, mats.detail, false);
    return;
  }
  if (biomeId === BIOME_NUCLEAR) {
    place.addBlock(centerX, edgeH + 0.14, z, span * 0.82, 0.14, 0.18, mats.accent, false);
    for (let i = 0; i < 3; i++) {
      const x = bounds.minX + (span * (0.2 + (i * 0.3)));
      place.addBlock(x, edgeH * 0.62, z + (edgeThick * 0.28 * direction), 0.24, 0.42, 0.24, mats.detail, false);
    }
    return;
  }
  if (biomeId === BIOME_RIVER_ARCHES) {
    place.addBlock(centerX, edgeH * 0.72, z, span * 0.92, 0.3, edgeThick + 0.22, mats.accent, false);
    place.addBlock(centerX, edgeH + 0.1, z + (edgeThick * 0.18 * direction), span * 0.74, 0.28, edgeThick * 0.72, mats.detail, false);
    for (let i = 0; i < 4; i++) {
      const x = bounds.minX + (span * (0.13 + (i * 0.24)));
      const reedH = 0.9 + (i % 2) * 0.35;
      place.addBlock(x, reedH * 0.5, z + (edgeThick * 0.38 * direction), 0.18, reedH, 0.16, mats.detail, false);
    }
    return;
  }
  if (biomeId === BIOME_DESERT) {
    place.addBlock(centerX, edgeH + 0.14, z, span, 0.35, edgeThick + 0.18, mats.accent, false);
    return;
  }
  if (biomeId === BIOME_CITADEL || biomeId === BIOME_QUARRY) {
    place.addBlock(centerX, edgeH * 0.66, z, span * 0.88, 0.22, edgeThick + 0.1, mats.base, true);
    place.addBlock(centerX, edgeH + 0.14, z, span * 0.6, 0.16, 0.18, mats.accent, false);
    return;
  }

  place.addBlock(centerX, edgeH + 0.1, z, span, 0.26, edgeThick + 0.12, mats.accent, false);
  for (let i = 0; i < 4; i++) {
    const x = bounds.minX + (span * (0.16 + (i * 0.22)));
    const vineH = 0.95 + (i % 2) * 0.5;
    place.addBlock(x, vineH * 0.5, z + (edgeThick * 0.34 * direction), 0.2, vineH, 0.18, mats.detail, false);
  }
}

function addVerticalAccent(place, biomeId, bounds, x, edgeH, edgeThick, mats, invert) {
  const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;
  const span = Math.max(1.5, bounds.maxZ - bounds.minZ);
  const direction = invert ? -1 : 1;
  if (biomeId === BIOME_ARCTIC) {
    place.addBlock(x, edgeH + 0.18, centerZ, edgeThick + 0.18, 0.34, span, mats.accent, false);
    return;
  }
  if (biomeId === BIOME_URBAN) {
    place.addBlock(x, edgeH + 0.14, centerZ, 0.12, 0.1, span * 0.72, mats.accent, false);
    place.addBlock(x + (edgeThick * 0.28 * direction), edgeH * 0.56, centerZ, 0.14, 0.2, span * 0.45, mats.detail, false);
    return;
  }
  if (biomeId === BIOME_NUCLEAR) {
    place.addBlock(x, edgeH + 0.14, centerZ, 0.18, 0.14, span * 0.82, mats.accent, false);
    for (let i = 0; i < 3; i++) {
      const z = bounds.minZ + (span * (0.2 + (i * 0.3)));
      place.addBlock(x + (edgeThick * 0.28 * direction), edgeH * 0.62, z, 0.24, 0.42, 0.24, mats.detail, false);
    }
    return;
  }
  if (biomeId === BIOME_RIVER_ARCHES) {
    place.addBlock(x, edgeH * 0.72, centerZ, edgeThick + 0.22, 0.3, span * 0.92, mats.accent, false);
    place.addBlock(x + (edgeThick * 0.18 * direction), edgeH + 0.1, centerZ, edgeThick * 0.72, 0.28, span * 0.74, mats.detail, false);
    for (let i = 0; i < 4; i++) {
      const z = bounds.minZ + (span * (0.13 + (i * 0.24)));
      const reedH = 0.9 + (i % 2) * 0.35;
      place.addBlock(x + (edgeThick * 0.38 * direction), reedH * 0.5, z, 0.16, reedH, 0.18, mats.detail, false);
    }
    return;
  }
  if (biomeId === BIOME_DESERT) {
    place.addBlock(x, edgeH + 0.14, centerZ, edgeThick + 0.18, 0.35, span, mats.accent, false);
    return;
  }
  if (biomeId === BIOME_CITADEL || biomeId === BIOME_QUARRY) {
    place.addBlock(x, edgeH * 0.66, centerZ, edgeThick + 0.1, 0.22, span * 0.88, mats.base, true);
    place.addBlock(x, edgeH + 0.14, centerZ, 0.18, 0.16, span * 0.6, mats.accent, false);
    return;
  }

  place.addBlock(x, edgeH + 0.1, centerZ, edgeThick + 0.12, 0.26, span, mats.accent, false);
  for (let i = 0; i < 4; i++) {
    const z = bounds.minZ + (span * (0.16 + (i * 0.22)));
    const vineH = 0.95 + (i % 2) * 0.5;
    place.addBlock(x + (edgeThick * 0.34 * direction), vineH * 0.5, z, 0.18, vineH, 0.2, mats.detail, false);
  }
}

export const DEFAULT_BIOME_MAP = buildBiomeCellMap(DEFAULT_BIOME_CELL_LABELS);
export const DEFAULT_QUADRANT_MAP = DEFAULT_BIOME_MAP;
export const BIOME_GRID_LINE_X = Array.from(
  { length: BIOME_GRID_COLS - 1 },
  (_, index) => WORLD_MIN + (CELL_WIDTH * (index + 1))
);
export const BIOME_GRID_LINE_Z = Array.from(
  { length: BIOME_GRID_ROWS - 1 },
  (_, index) => WORLD_MIN + (CELL_DEPTH * (index + 1))
);

export function resolveBiomeCell(cell) {
  if (cell && typeof cell === 'object') {
    if (Number.isFinite(Number(cell.row)) && Number.isFinite(Number(cell.col))) {
      return {
        row: clampGridIndex(cell.row, BIOME_GRID_ROWS),
        col: clampGridIndex(cell.col, BIOME_GRID_COLS)
      };
    }
    if (typeof cell.cell === 'string') return resolveBiomeCell(cell.cell);
    if (typeof cell.quadrant === 'string') return resolveBiomeCell(cell.quadrant);
  }

  const raw = String(cell || '').trim();
  if (LEGACY_QUADRANTS[raw]) return { ...LEGACY_QUADRANTS[raw] };

  const match = /^r(\d+)c(\d+)$/i.exec(raw);
  if (match) {
    return {
      row: clampGridIndex(match[1], BIOME_GRID_ROWS),
      col: clampGridIndex(match[2], BIOME_GRID_COLS)
    };
  }

  return { row: BIOME_GRID_ROWS - 1, col: BIOME_GRID_COLS - 1 };
}

export function cellBounds(cell) {
  const { row, col } = resolveBiomeCell(cell);
  return {
    row,
    col,
    cell: cellIdFor(row, col),
    minX: WORLD_MIN + (col * CELL_WIDTH),
    maxX: WORLD_MIN + ((col + 1) * CELL_WIDTH),
    minZ: WORLD_MIN + (row * CELL_DEPTH),
    maxZ: WORLD_MIN + ((row + 1) * CELL_DEPTH)
  };
}

export function quadrantBounds(quadrant) {
  return cellBounds(quadrant);
}

export function getBiomeCellAtPosition(x, z, biomeMap) {
  const row = clampGridIndex(clampPlayableRatio(z) * BIOME_GRID_ROWS, BIOME_GRID_ROWS);
  const col = clampGridIndex(clampPlayableRatio(x) * BIOME_GRID_COLS, BIOME_GRID_COLS);
  return findCellEntry(row, col, biomeMap) || DEFAULT_BIOME_MAP[DEFAULT_BIOME_MAP.length - 1];
}

export function biomeAtPosition(x, z, biomeMap) {
  const cell = getBiomeCellAtPosition(x, z, biomeMap);
  return cell ? cell.biome : BIOME_JUNGLE;
}

export function buildBiomePerimeter(place, materials, biomeMap) {
  if (!place || typeof place.addBlock !== 'function') return;

  const map = Array.isArray(biomeMap) && biomeMap.length ? biomeMap : DEFAULT_BIOME_MAP;
  const mats = materials || {};
  const edgeH = 3.0;
  const edgeThick = 1.2;

  for (let col = 0; col < BIOME_GRID_COLS; col++) {
    const topEntry = findCellEntry(0, col, map);
    const topBounds = cellBounds({ row: 0, col });
    const topMats = materialsForBiome(topEntry && topEntry.biome, mats);
    const topCenterX = (topBounds.minX + topBounds.maxX) * 0.5;
    const topSpan = topBounds.maxX - topBounds.minX;
    const topZ = WORLD_MIN - (edgeThick * 0.5);
    place.addBlock(topCenterX, edgeH * 0.5, topZ, topSpan, edgeH, edgeThick, topMats.base, true);
    addHorizontalAccent(place, topEntry && topEntry.biome, topBounds, topZ, edgeH, edgeThick, topMats, false);

    const bottomEntry = findCellEntry(BIOME_GRID_ROWS - 1, col, map);
    const bottomBounds = cellBounds({ row: BIOME_GRID_ROWS - 1, col });
    const bottomMats = materialsForBiome(bottomEntry && bottomEntry.biome, mats);
    const bottomCenterX = (bottomBounds.minX + bottomBounds.maxX) * 0.5;
    const bottomSpan = bottomBounds.maxX - bottomBounds.minX;
    const bottomZ = WORLD_MAX + (edgeThick * 0.5);
    place.addBlock(bottomCenterX, edgeH * 0.5, bottomZ, bottomSpan, edgeH, edgeThick, bottomMats.base, true);
    addHorizontalAccent(place, bottomEntry && bottomEntry.biome, bottomBounds, bottomZ, edgeH, edgeThick, bottomMats, true);
  }

  for (let row = 0; row < BIOME_GRID_ROWS; row++) {
    const leftEntry = findCellEntry(row, 0, map);
    const leftBounds = cellBounds({ row, col: 0 });
    const leftMats = materialsForBiome(leftEntry && leftEntry.biome, mats);
    const leftCenterZ = (leftBounds.minZ + leftBounds.maxZ) * 0.5;
    const leftSpan = leftBounds.maxZ - leftBounds.minZ;
    const leftX = WORLD_MIN - (edgeThick * 0.5);
    place.addBlock(leftX, edgeH * 0.5, leftCenterZ, edgeThick, edgeH, leftSpan, leftMats.base, true);
    addVerticalAccent(place, leftEntry && leftEntry.biome, leftBounds, leftX, edgeH, edgeThick, leftMats, false);

    const rightEntry = findCellEntry(row, BIOME_GRID_COLS - 1, map);
    const rightBounds = cellBounds({ row, col: BIOME_GRID_COLS - 1 });
    const rightMats = materialsForBiome(rightEntry && rightEntry.biome, mats);
    const rightCenterZ = (rightBounds.minZ + rightBounds.maxZ) * 0.5;
    const rightSpan = rightBounds.maxZ - rightBounds.minZ;
    const rightX = WORLD_MAX + (edgeThick * 0.5);
    place.addBlock(rightX, edgeH * 0.5, rightCenterZ, edgeThick, edgeH, rightSpan, rightMats.base, true);
    addVerticalAccent(place, rightEntry && rightEntry.biome, rightBounds, rightX, edgeH, edgeThick, rightMats, true);
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
  WORLD_PLAYABLE_SPAN,
  DEFAULT_SPAWN_PADDING,
  BIOME_ARCTIC,
  BIOME_URBAN,
  BIOME_DESERT,
  BIOME_JUNGLE,
  BIOME_NUCLEAR,
  BIOME_CITADEL,
  BIOME_QUARRY,
  BIOME_RIVER_ARCHES,
  BIOME_GRID_COLS,
  BIOME_GRID_ROWS,
  DEFAULT_BIOME_CELL_LABELS,
  DEFAULT_BIOME_MAP,
  DEFAULT_QUADRANT_MAP,
  BIOME_GRID_LINE_X,
  BIOME_GRID_LINE_Z,
  resolveBiomeCell,
  cellBounds,
  quadrantBounds,
  getBiomeCellAtPosition,
  biomeAtPosition,
  buildBiomePerimeter
};
