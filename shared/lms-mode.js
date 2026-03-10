import {
  BIOME_GRID_COLS,
  BIOME_GRID_ROWS,
  DEFAULT_BIOME_CELL_LABELS
} from './world-layout.js';

export const LMS_MODE_ID = 'lms';

export const lmsRules = {
  startingLives: 4,
  maxLives: 4,
  chargePerElimination: 1,
  chargePerExtraLife: 2,
  respawnDelayMs: 2500,
  beaconRotateMs: 60000,
  beaconWarmupMs: 20000,
  beaconBankRadius: 4.5,
  beaconChannelMs: 4000,
  finalBankingCutoffRemaining: 4
};

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function lerp(a, b, t) {
  return Number(a || 0) + ((Number(b || 0) - Number(a || 0)) * clamp01(t));
}

function normalizeGridSize(value, fallback) {
  const next = Math.max(1, Math.round(Number(value || fallback)));
  return Number.isFinite(next) ? next : fallback;
}

function labelForCell(labels, index, row, col) {
  if (Array.isArray(labels) && labels[index]) return String(labels[index]).toUpperCase();
  return 'CELL ' + String(row + 1) + '-' + String(col + 1);
}

export function buildLmsBeaconAnchors(options = {}) {
  const min = Number(options.boundsMin || 0);
  const max = Number(options.boundsMax || 100);
  const paddingNorm = clamp01(options.paddingNorm != null ? options.paddingNorm : 0.08);
  const gridCols = normalizeGridSize(options.gridCols, BIOME_GRID_COLS);
  const gridRows = normalizeGridSize(options.gridRows, BIOME_GRID_ROWS);
  const labels = Array.isArray(options.labels) && options.labels.length
    ? options.labels
    : DEFAULT_BIOME_CELL_LABELS;

  const anchors = [];
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const cellIndex = (row * gridCols) + col;
      const cellMinU = col / gridCols;
      const cellMaxU = (col + 1) / gridCols;
      const cellMinV = row / gridRows;
      const cellMaxV = (row + 1) / gridRows;
      const innerU = paddingNorm * (cellMaxU - cellMinU);
      const innerV = paddingNorm * (cellMaxV - cellMinV);
      const u = lerp(cellMinU + innerU, cellMaxU - innerU, 0.5);
      const v = lerp(cellMinV + innerV, cellMaxV - innerV, 0.5);
      anchors.push({
        id: 'beacon_' + String(cellIndex + 1),
        label: labelForCell(labels, cellIndex, row, col),
        row,
        col,
        u,
        v,
        x: lerp(min, max, u),
        z: lerp(min, max, v)
      });
    }
  }
  return anchors;
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.lmsMode = {
  id: LMS_MODE_ID,
  rules: lmsRules,
  buildBeaconAnchors: buildLmsBeaconAnchors
};
