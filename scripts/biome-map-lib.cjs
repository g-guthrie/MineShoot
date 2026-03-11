const fs = require('fs');
const path = require('path');

const GRID_COLS = 14;
const GRID_ROWS = 14;
const WORLD_MIN = 2;
const WORLD_PLAYABLE_SPAN = 162;
const CELL_SPAN = WORLD_PLAYABLE_SPAN / 3;
const CELL_PADDING = 6;

const BIOME_CELLS = {
  arctic: { row: 0, col: 0 },
  radar: { row: 0, col: 1 },
  desert: { row: 0, col: 2 },
  jungle: { row: 1, col: 0 },
  citadel: { row: 1, col: 1 },
  nuclear: { row: 1, col: 2 },
  quarry: { row: 2, col: 0 },
  basin: { row: 2, col: 1 },
  urban: { row: 2, col: 2 }
};

function biomeBounds(biomeId) {
  const cell = BIOME_CELLS[biomeId];
  if (!cell) throw new Error(`Unknown biome: ${biomeId}`);
  return {
    minX: WORLD_MIN + (cell.col * CELL_SPAN) + CELL_PADDING,
    maxX: WORLD_MIN + ((cell.col + 1) * CELL_SPAN) - CELL_PADDING,
    minZ: WORLD_MIN + (cell.row * CELL_SPAN) + CELL_PADDING,
    maxZ: WORLD_MIN + ((cell.row + 1) * CELL_SPAN) - CELL_PADDING
  };
}

function pt(bounds, u, v) {
  return {
    x: bounds.minX + ((bounds.maxX - bounds.minX) * u),
    z: bounds.minZ + ((bounds.maxZ - bounds.minZ) * v)
  };
}

function point(kind, x, z, label) {
  return { type: 'point', kind, x, z, label: label || kind };
}

function uvPoint(bounds, kind, u, v, label) {
  const pos = pt(bounds, u, v);
  return point(kind, pos.x, pos.z, label);
}

function uvPoints(bounds, kind, entries, labelPrefix) {
  return entries.map((entry, index) => uvPoint(bounds, kind, entry.u, entry.v, `${labelPrefix || kind}-${index + 1}`));
}

function line(kind, start, end, segments, label) {
  return { type: 'line', kind, start, end, segments: segments || 4, label: label || kind };
}

function uvLine(bounds, kind, start, end, segments, label) {
  return line(kind, pt(bounds, start.u, start.v), pt(bounds, end.u, end.v), segments, label);
}

function linesToPoints(feature) {
  if (feature.type !== 'line') return [feature];
  const count = Math.max(2, Number(feature.segments) || 2);
  const items = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    items.push(point(
      feature.kind,
      feature.start.x + ((feature.end.x - feature.start.x) * t),
      feature.start.z + ((feature.end.z - feature.start.z) * t),
      feature.label
    ));
  }
  return items;
}

function cellFor(bounds, x, z) {
  const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(((x - bounds.minX) / (bounds.maxX - bounds.minX)) * GRID_COLS)));
  const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(((z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * GRID_ROWS)));
  return { row, col };
}

function makeGrid() {
  return Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => ({
      items: [],
      kinds: new Set(),
      labels: new Set()
    }))
  );
}

function headerLine() {
  let text = '    ';
  for (let col = 0; col < GRID_COLS; col++) text += String(col).padStart(2, ' ') + ' ';
  return text;
}

function renderGrid(label, grid, cellRenderer) {
  const lines = [label, headerLine()];
  for (let row = 0; row < GRID_ROWS; row++) {
    let lineText = String(row).padStart(2, ' ') + ' |';
    for (let col = 0; col < GRID_COLS; col++) lineText += ' ' + cellRenderer(grid[row][col]) + ' ';
    lines.push(lineText);
  }
  return lines.join('\n');
}

function densityGlyph(count) {
  if (count <= 0) return '.';
  if (count < 10) return String(count);
  return '+';
}

function dominantGlyph(bucket, glyphs) {
  if (!bucket.items.length) return '.';
  if (bucket.kinds.size > 1) return '*';
  return glyphs[bucket.items[0].kind] || '?';
}

function buildReport(biomeId) {
  const spec = BIOME_SPECS[biomeId];
  if (!spec) throw new Error(`Missing biome spec: ${biomeId}`);
  const bounds = biomeBounds(biomeId);
  const authoredFeatures = spec.build(bounds);
  const sampledFeatures = authoredFeatures.flatMap(linesToPoints);
  const grid = makeGrid();

  for (const feature of sampledFeatures) {
    const cell = cellFor(bounds, feature.x, feature.z);
    const bucket = grid[cell.row][cell.col];
    if (bucket.labels.has(feature.label)) continue;
    bucket.items.push(feature);
    bucket.kinds.add(feature.kind);
    bucket.labels.add(feature.label);
  }

  const countsByKind = new Map();
  for (const feature of authoredFeatures) countsByKind.set(feature.kind, (countsByKind.get(feature.kind) || 0) + 1);

  const denseCells = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const bucket = grid[row][col];
      if (!bucket.items.length) continue;
      denseCells.push({
        row,
        col,
        count: bucket.items.length,
        kinds: Array.from(bucket.kinds).sort(),
        labels: bucket.items.map((item) => item.label).sort()
      });
    }
  }
  denseCells.sort((a, b) => b.count - a.count || a.row - b.row || a.col - b.col);

  const occupiedCells = denseCells.length;
  const occupancyRate = ((occupiedCells / (GRID_ROWS * GRID_COLS)) * 100).toFixed(1);
  const usedKinds = Array.from(countsByKind.keys()).sort();

  const lines = [];
  lines.push(`${spec.name} biome authored-feature map`);
  lines.push(`Biome: ${biomeId}`);
  lines.push(`Bounds x:[${bounds.minX}, ${bounds.maxX}] z:[${bounds.minZ}, ${bounds.maxZ}]  grid:${GRID_COLS}x${GRID_ROWS}`);
  lines.push(`Features: ${authoredFeatures.length} high-level placements across ${occupiedCells}/${GRID_ROWS * GRID_COLS} cells (${occupancyRate}% occupied)`);
  lines.push('');
  lines.push(renderGrid('Dominant feature map', grid, (bucket) => dominantGlyph(bucket, spec.glyphs)));
  lines.push('');
  lines.push(renderGrid('Density heatmap', grid, (bucket) => densityGlyph(bucket.items.length)));
  lines.push('');
  lines.push('Legend');
  for (const kind of usedKinds) lines.push(`  ${spec.glyphs[kind] || '?'} ${kind}`);
  lines.push('  * mixed cell');
  lines.push('');
  lines.push('Counts by feature kind');
  for (const [kind, count] of Array.from(countsByKind.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`  ${kind.padEnd(14, ' ')} ${String(count).padStart(3, ' ')}`);
  }
  lines.push('');
  lines.push('Top dense cells');
  for (const cell of denseCells.slice(0, 12)) {
    lines.push(`  r${cell.row} c${cell.col}  count=${cell.count}  kinds=${cell.kinds.join(',')}  labels=${cell.labels.join(', ')}`);
  }

  return {
    biomeId,
    name: spec.name,
    countsByKind,
    occupiedCells,
    occupancyRate,
    denseCells,
    content: lines.join('\n') + '\n'
  };
}

function writeAllReports(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const biomeIds = Object.keys(BIOME_SPECS);
  const reports = biomeIds.map((biomeId) => buildReport(biomeId));

  for (const report of reports) {
    fs.writeFileSync(path.join(outputDir, `${report.biomeId}.txt`), report.content, 'utf8');
  }

  const summaryLines = ['# Biome ASCII Maps', '', 'Generated by `npm run maps:biomes`.', ''];
  summaryLines.push('| Biome | Features | Occupied Cells | Hotspot | File |');
  summaryLines.push('| --- | ---: | ---: | --- | --- |');
  for (const report of reports) {
    const totalFeatures = Array.from(report.countsByKind.values()).reduce((sum, count) => sum + count, 0);
    const hotspot = report.denseCells[0]
      ? `r${report.denseCells[0].row} c${report.denseCells[0].col} (${report.denseCells[0].count})`
      : 'none';
    summaryLines.push(`| ${report.name} | ${totalFeatures} | ${report.occupiedCells}/196 (${report.occupancyRate}%) | ${hotspot} | [${report.biomeId}.txt](./${report.biomeId}.txt) |`);
  }
  summaryLines.push('');
  fs.writeFileSync(path.join(outputDir, 'README.md'), summaryLines.join('\n') + '\n', 'utf8');

  return reports;
}

const BIOME_SPECS = {
  arctic: {
    name: 'Arctic',
    glyphs: {
      mountain: 'M',
      overhang: 'O',
      shelf: 'H',
      arch: 'A',
      pool: 'P',
      spire: 'S',
      boulder: 'B',
      drift: 'd',
      fragment: 'f'
    },
    build(bounds) {
      return [
        uvPoint(bounds, 'mountain', 0.46, 0.46, 'mountain'),
        uvPoint(bounds, 'overhang', 0.76, 0.28, 'overhang'),
        uvPoint(bounds, 'shelf', 0.26, 0.28, 'ice-shelf'),
        uvPoint(bounds, 'arch', 0.34, 0.72, 'ice-arch'),
        uvPoint(bounds, 'pool', 0.70, 0.78, 'frozen-pool'),
        ...uvPoints(bounds, 'spire', [
          { u: 0.18, v: 0.18 }, { u: 0.24, v: 0.24 }, { u: 0.12, v: 0.78 },
          { u: 0.20, v: 0.84 }, { u: 0.84, v: 0.74 }, { u: 0.88, v: 0.66 }
        ], 'spire'),
        ...uvPoints(bounds, 'boulder', [
          { u: 0.28, v: 0.36 }, { u: 0.74, v: 0.58 }, { u: 0.42, v: 0.80 },
          { u: 0.62, v: 0.18 }, { u: 0.56, v: 0.68 }
        ], 'boulder'),
        ...uvPoints(bounds, 'drift', [
          { u: 0.18, v: 0.46 }, { u: 0.80, v: 0.42 }, { u: 0.42, v: 0.12 }, { u: 0.60, v: 0.88 },
          { u: 0.12, v: 0.64 }, { u: 0.86, v: 0.54 }, { u: 0.50, v: 0.92 }, { u: 0.58, v: 0.08 }
        ], 'drift'),
        ...uvPoints(bounds, 'fragment', [
          { u: 0.16, v: 0.22 }, { u: 0.84, v: 0.22 }, { u: 0.13, v: 0.84 }, { u: 0.87, v: 0.74 },
          { u: 0.28, v: 0.14 }, { u: 0.72, v: 0.86 }, { u: 0.68, v: 0.28 }
        ], 'fragment')
      ];
    }
  },
  radar: {
    name: 'Radar',
    glyphs: {
      mast: 'M',
      dish: 'D',
      bunker: 'B',
      lane: 'L',
      beacon: 'b'
    },
    build(bounds) {
      return [
        uvPoint(bounds, 'mast', 0.5, 0.48, 'relay-mast'),
        uvPoint(bounds, 'dish', 0.2, 0.2, 'dish-a'),
        uvPoint(bounds, 'dish', 0.78, 0.28, 'dish-b'),
        uvPoint(bounds, 'bunker', 0.18, 0.78, 'bunker-a'),
        uvPoint(bounds, 'bunker', 0.78, 0.78, 'bunker-b'),
        point('lane', biomeBounds('radar').minX + 11.0, pt(bounds, 0.5, 0.48).z, 'west-lane'),
        point('lane', biomeBounds('radar').maxX - 11.0, pt(bounds, 0.5, 0.48).z, 'east-lane'),
        point('lane', pt(bounds, 0.5, 0.48).x, bounds.minZ + 11.2, 'north-lane'),
        uvPoint(bounds, 'beacon', 0.2, 0.2, 'beacon-a'),
        uvPoint(bounds, 'beacon', 0.78, 0.28, 'beacon-b')
      ];
    }
  },
  desert: {
    name: 'Desert',
    glyphs: {
      crown: 'M',
      eastWall: 'E',
      northWall: 'N',
      pocket: 'P',
      rubble: 'R',
      arch: 'A',
      outcrop: 'O',
      filler: 'I',
      fossil: 'F',
      cactus: 'C',
      bush: 'b',
      bone: 'o',
      dune: 'D',
      tumbleweed: 't',
      rock: 'r'
    },
    build(bounds) {
      return [
        uvPoint(bounds, 'crown', 0.90, 0.18, 'mesa-crown'),
        uvLine(bounds, 'eastWall', { u: 0.93, v: 0.30 }, { u: 0.93, v: 0.86 }, 6, 'east-shelf-band'),
        uvLine(bounds, 'northWall', { u: 0.22, v: 0.18 }, { u: 0.76, v: 0.18 }, 6, 'north-crumble-band'),
        ...uvPoints(bounds, 'pocket', [
          { u: 0.72, v: 0.30 }, { u: 0.80, v: 0.44 }, { u: 0.82, v: 0.60 }, { u: 0.86, v: 0.80 }
        ], 'shelf-pocket'),
        ...uvPoints(bounds, 'rubble', [
          { u: 0.66, v: 0.34 }, { u: 0.70, v: 0.48 }, { u: 0.76, v: 0.56 }, { u: 0.84, v: 0.66 }
        ], 'rubble'),
        ...uvPoints(bounds, 'arch', [{ u: 0.12, v: 0.52 }], 'arch'),
        ...uvPoints(bounds, 'outcrop', [{ u: 0.56, v: 0.88 }], 'outcrop'),
        ...uvPoints(bounds, 'filler', [
          { u: 0.86, v: 0.12 }, { u: 0.82, v: 0.18 }, { u: 0.78, v: 0.24 },
          { u: 0.92, v: 0.34 }, { u: 0.88, v: 0.46 }, { u: 0.86, v: 0.60 }, { u: 0.90, v: 0.72 }
        ], 'filler'),
        uvPoint(bounds, 'fossil', 0.18, 0.72, 'fossil-ribs'),
        ...uvPoints(bounds, 'cactus', [
          { u: 0.12, v: 0.56 }, { u: 0.20, v: 0.86 }, { u: 0.34, v: 0.66 }, { u: 0.46, v: 0.78 },
          { u: 0.58, v: 0.70 }, { u: 0.66, v: 0.52 }, { u: 0.78, v: 0.64 }, { u: 0.84, v: 0.86 }
        ], 'cactus'),
        ...uvPoints(bounds, 'bush', [
          { u: 0.24, v: 0.58 }, { u: 0.58, v: 0.62 }, { u: 0.74, v: 0.56 }
        ], 'bush'),
        ...uvPoints(bounds, 'bone', [{ u: 0.60, v: 0.66 }, { u: 0.64, v: 0.68 }, { u: 0.24, v: 0.24 }], 'bone'),
        ...uvPoints(bounds, 'dune', [
          { u: 0.40, v: 0.90 }, { u: 0.16, v: 0.16 }, { u: 0.40, v: 0.22 }
        ], 'dune'),
        ...uvPoints(bounds, 'tumbleweed', [{ u: 0.32, v: 0.18 }, { u: 0.24, v: 0.86 }], 'tumbleweed'),
        ...uvPoints(bounds, 'rock', [
          { u: 0.26, v: 0.26 }, { u: 0.46, v: 0.48 }, { u: 0.62, v: 0.58 },
          { u: 0.72, v: 0.34 }, { u: 0.20, v: 0.70 }
        ], 'rock')
      ];
    }
  },
  jungle: {
    name: 'Jungle',
    glyphs: {
      waterfall: 'W',
      shrine: 'S',
      edgeTree: 'E',
      giant: 'G',
      canopy: 'T',
      bushy: 'B',
      sapling: 'p',
      fern: 'f',
      log: 'l',
      mushroom: 'm',
      vinePath: 'v',
      blocker: 'X',
      mossPatch: 'o'
    },
    build(bounds) {
      const center = pt(bounds, 0.67, 0.56);
      const waterfall = { x: bounds.minX + 2.75, z: pt(bounds, 0, 0.34).z };
      return [
        point('shrine', center.x, center.z, 'shrine'),
        point('waterfall', waterfall.x, waterfall.z, 'waterfall'),
        ...[
          { x: bounds.minX + 1.55, z: waterfall.z - 10.8 },
          { x: bounds.minX + 1.6, z: waterfall.z + 10.4 },
          { x: bounds.minX + 1.45, z: waterfall.z - 19.5 },
          { x: bounds.minX + 1.52, z: waterfall.z + 24.8 },
          { x: bounds.minX + 1.3, z: bounds.maxZ - 4.6 },
          { x: bounds.maxX - 2.4, z: bounds.maxZ - 2.5 }
        ].map((entry, index) => point('edgeTree', entry.x, entry.z, `edge-tree-${index + 1}`)),
        ...uvPoints(bounds, 'giant', [
          { u: 0.18, v: 0.04 }, { u: 0.36, v: 0.14 }, { u: 0.62, v: 0.10 },
          { u: 0.72, v: 0.34 }, { u: 0.72, v: 0.76 }, { u: 0.48, v: 0.90 },
          { u: 0.98, v: 0.52 }, { u: 0.90, v: 0.92 }, { u: 0.84, v: 0.04 }
        ], 'giant'),
        ...uvPoints(bounds, 'canopy', [
          { u: 0.12, v: 0.06 }, { u: 0.32, v: 0.04 }, { u: 0.54, v: 0.03 },
          { u: 0.78, v: 0.05 }, { u: 0.96, v: 0.18 }, { u: 0.97, v: 0.40 },
          { u: 0.95, v: 0.70 }, { u: 0.82, v: 0.96 }, { u: 0.56, v: 0.95 },
          { u: 0.28, v: 0.94 }, { u: 0.10, v: 0.90 }, { u: 0.68, v: 0.26 }, { u: 0.34, v: 0.68 }
        ], 'canopy'),
        ...uvPoints(bounds, 'bushy', [
          { u: 0.18, v: 0.16 }, { u: 0.90, v: 0.26 }, { u: 0.88, v: 0.60 },
          { u: 0.70, v: 0.88 }, { u: 0.34, v: 0.90 }, { u: 0.56, v: 0.36 }, { u: 0.42, v: 0.76 }
        ], 'bushy'),
        ...uvPoints(bounds, 'sapling', [{ u: 0.92, v: 0.46 }, { u: 0.16, v: 0.84 }, { u: 0.62, v: 0.78 }], 'sapling'),
        ...uvPoints(bounds, 'fern', [
          { u: 0.18, v: 0.26 }, { u: 0.60, v: 0.22 }, { u: 0.75, v: 0.40 },
          { u: 0.80, v: 0.70 }, { u: 0.24, v: 0.66 }, { u: 0.56, v: 0.74 },
          { u: 0.88, v: 0.38 }, { u: 0.90, v: 0.82 }, { u: 0.30, v: 0.14 },
          { u: 0.70, v: 0.86 }, { u: 0.42, v: 0.28 }
        ], 'fern'),
        ...uvPoints(bounds, 'log', [{ u: 0.28, v: 0.58 }, { u: 0.74, v: 0.50 }, { u: 0.54, v: 0.78 }], 'log'),
        ...uvPoints(bounds, 'mushroom', [
          { u: 0.29, v: 0.59 }, { u: 0.26, v: 0.61 }, { u: 0.73, v: 0.49 }, { u: 0.76, v: 0.53 },
          { u: 0.50, v: 0.23 }, { u: 0.54, v: 0.79 }, { u: 0.58, v: 0.77 }, { u: 0.86, v: 0.72 }
        ], 'mushroom'),
        uvLine(bounds, 'vinePath', { u: 0.16, v: 0.78 }, { u: 0.32, v: 0.86 }, 4, 'vine-1'),
        uvLine(bounds, 'vinePath', { u: 0.78, v: 0.64 }, { u: 0.88, v: 0.82 }, 4, 'vine-2'),
        ...[
          { kind: 'blocker', x: center.x - 5.4, z: center.z - 3.1, label: 'fallen-pillar' },
          { kind: 'blocker', x: center.x - 8.4, z: center.z - 0.4, label: 'corridor-blocker-1' },
          { kind: 'blocker', x: center.x - 10.4, z: center.z + 1.2, label: 'corridor-blocker-2' },
          { kind: 'blocker', x: center.x - 6.4, z: center.z + 2.4, label: 'corridor-blocker-3' },
          { kind: 'mossPatch', x: waterfall.x + 2.2, z: waterfall.z + 2.2, label: 'moss-1' },
          { kind: 'mossPatch', x: waterfall.x - 2.0, z: waterfall.z + 4.6, label: 'moss-2' },
          { kind: 'mossPatch', x: center.x - 3.4, z: center.z + 3.1, label: 'moss-3' },
          { kind: 'mossPatch', x: center.x + 3.6, z: center.z - 1.7, label: 'moss-4' }
        ].map((entry) => point(entry.kind, entry.x, entry.z, entry.label))
      ];
    }
  },
  citadel: {
    name: 'Citadel',
    glyphs: {
      base: 'B',
      ring: 'R',
      stair: 'S',
      tower: 'T',
      ramp: 'r',
      spire: 'P',
      beacon: 'b'
    },
    build(bounds) {
      const center = pt(bounds, 0.5, 0.5);
      return [
        point('base', center.x, center.z, 'citadel-base'),
        point('ring', center.x, center.z, 'inner-ring'),
        ...[
          { x: center.x, z: center.z - 14.0, label: 'north-stair' },
          { x: center.x + 14.0, z: center.z, label: 'east-stair' },
          { x: center.x, z: center.z + 14.0, label: 'south-stair' },
          { x: center.x - 14.0, z: center.z, label: 'west-stair' }
        ].map((entry) => point('stair', entry.x, entry.z, entry.label)),
        ...[
          { x: center.x - 7.0, z: center.z - 7.0 },
          { x: center.x + 7.0, z: center.z - 7.0 },
          { x: center.x - 7.0, z: center.z + 7.0 },
          { x: center.x + 7.0, z: center.z + 7.0 }
        ].map((entry, index) => point('tower', entry.x, entry.z, `corner-tower-${index + 1}`)),
        ...[
          { x: center.x - 7.0, z: center.z, label: 'west-ramp' },
          { x: center.x + 7.0, z: center.z, label: 'east-ramp' },
          { x: center.x, z: center.z - 7.0, label: 'north-ramp' },
          { x: center.x, z: center.z + 7.0, label: 'south-ramp' },
          { x: center.x - 4.9, z: center.z, label: 'inner-west-ramp' },
          { x: center.x + 4.9, z: center.z, label: 'inner-east-ramp' },
          { x: center.x, z: center.z - 4.9, label: 'inner-north-ramp' },
          { x: center.x, z: center.z + 4.9, label: 'inner-south-ramp' }
        ].map((entry) => point('ramp', entry.x, entry.z, entry.label)),
        point('spire', center.x, center.z, 'spire'),
        point('beacon', center.x, center.z, 'beacon')
      ];
    }
  },
  nuclear: {
    name: 'Nuclear',
    glyphs: {
      campus: 'C',
      tower: 'T',
      yard: 'Y',
      pipe: 'P',
      lane: 'L',
      beacon: 'b'
    },
    build(bounds) {
      const hub = pt(bounds, 0.48, 0.55);
      return [
        point('campus', hub.x, hub.z, 'reactor-campus'),
        ...uvPoints(bounds, 'tower', [{ u: 0.2, v: 0.26 }, { u: 0.82, v: 0.3 }], 'cooling-tower'),
        uvPoint(bounds, 'yard', 0.74, 0.78, 'control-yard'),
        point('pipe', hub.x - 8.4, hub.z + 0.5, 'west-pipe'),
        point('pipe', hub.x + 8.6, hub.z - 0.8, 'east-pipe'),
        point('lane', hub.x, bounds.minZ + 3.4, 'north-lane'),
        point('lane', bounds.minX + 4.2, hub.z + 10.2, 'west-lane'),
        point('lane', bounds.maxX - 4.0, hub.z - 9.8, 'east-lane'),
        point('beacon', hub.x - 4.4, hub.z - 3.8, 'beacon-a'),
        point('beacon', hub.x + 4.6, hub.z + 3.8, 'beacon-b')
      ];
    }
  },
  quarry: {
    name: 'Quarry',
    glyphs: {
      pit: 'P',
      ramp: 'r',
      crane: 'C',
      catwalk: 'W',
      drill: 'D',
      ridge: 'R'
    },
    build(bounds) {
      const center = pt(bounds, 0.42, 0.56);
      return [
        point('pit', center.x, center.z, 'quarry-pit'),
        ...[
          { x: center.x + 7.6, z: center.z + 4.1, label: 'ramp-a' },
          { x: center.x + 5.8, z: center.z - 4.8, label: 'ramp-b' },
          { x: center.x - 7.2, z: center.z + 5.2, label: 'ramp-c' }
        ].map((entry) => point('ramp', entry.x, entry.z, entry.label)),
        uvPoint(bounds, 'crane', 0.76, 0.22, 'crane'),
        uvPoint(bounds, 'catwalk', 0.66, 0.72, 'catwalk'),
        uvPoint(bounds, 'drill', 0.18, 0.22, 'drill'),
        ...uvPoints(bounds, 'ridge', [{ u: 0.10, v: 0.86 }, { u: 0.88, v: 0.86 }], 'ridge')
      ];
    }
  },
  basin: {
    name: 'Basin',
    glyphs: {
      basin: 'B',
      house: 'H',
      catwalk: 'C',
      pipe: 'P',
      beacon: 'b'
    },
    build(bounds) {
      const basin = pt(bounds, 0.46, 0.56);
      return [
        point('basin', basin.x, basin.z, 'main-basin'),
        uvPoint(bounds, 'house', 0.76, 0.28, 'pump-house'),
        uvPoint(bounds, 'catwalk', 0.24, 0.24, 'catwalk'),
        point('pipe', bounds.minX + 5.0, basin.z + 8.8, 'west-pipe'),
        point('pipe', bounds.maxX - 5.0, basin.z - 8.4, 'east-pipe'),
        uvPoint(bounds, 'beacon', 0.76, 0.28, 'house-beacon')
      ];
    }
  },
  urban: {
    name: 'Urban',
    glyphs: {
      plaza: 'P',
      billboard: 'B',
      shelter: 'S',
      overpass: 'O',
      stairs: 'T',
      quarterpipe: 'Q',
      ledge: 'L',
      kicker: 'K',
      pad: 'p',
      wall: 'W',
      slab: 's',
      bench: 'b',
      lamp: 'l'
    },
    build(bounds) {
      return [
        uvPoint(bounds, 'plaza', 0.52, 0.52, 'sunken-plaza'),
        uvPoint(bounds, 'billboard', 0.80, 0.18, 'billboard'),
        uvPoint(bounds, 'shelter', 0.20, 0.74, 'shelter'),
        uvPoint(bounds, 'overpass', 0.22, 0.26, 'overpass'),
        uvPoint(bounds, 'stairs', 0.62, 0.32, 'stair-set'),
        ...uvPoints(bounds, 'quarterpipe', [{ u: 0.74, v: 0.70 }, { u: 0.38, v: 0.80 }], 'quarterpipe'),
        ...uvPoints(bounds, 'ledge', [{ u: 0.84, v: 0.52 }, { u: 0.60, v: 0.58 }], 'ledge'),
        ...uvPoints(bounds, 'kicker', [{ u: 0.47, v: 0.34 }, { u: 0.68, v: 0.64 }], 'kicker'),
        uvPoint(bounds, 'pad', 0.78, 0.42, 'manual-pad'),
        ...uvPoints(bounds, 'wall', [{ u: 0.10, v: 0.52 }, { u: 0.92, v: 0.58 }], 'wall'),
        ...uvPoints(bounds, 'slab', [{ u: 0.34, v: 0.46 }, { u: 0.70, v: 0.18 }], 'slab'),
        ...uvPoints(bounds, 'bench', [{ u: 0.14, v: 0.18 }, { u: 0.88, v: 0.84 }, { u: 0.54, v: 0.18 }], 'bench'),
        ...uvPoints(bounds, 'lamp', [{ u: 0.16, v: 0.34 }, { u: 0.86, v: 0.62 }, { u: 0.58, v: 0.12 }], 'lamp')
      ];
    }
  }
};

module.exports = {
  BIOME_SPECS,
  buildReport,
  writeAllReports
};
