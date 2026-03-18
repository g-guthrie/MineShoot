const fs = require('fs');
const path = require('path');

const GRID_COLS = 14;
const GRID_ROWS = 14;
const WORLD_MIN = 2;
const WORLD_PLAYABLE_SPAN = 162;
const WORLD_MAX = WORLD_MIN + WORLD_PLAYABLE_SPAN;
const CELL_SPAN = WORLD_PLAYABLE_SPAN / 3;
const DEFAULT_NEIGHBOR_MARGIN = 12;
const OBJECT_SYMBOL_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const BIOME_CELLS = {
  arctic: { row: 0, col: 0 },
  radar: { row: 0, col: 1 },
  desert: { row: 0, col: 2 },
  jungle: { row: 1, col: 0 },
  citadel: { row: 1, col: 1 },
  nuclear: { row: 1, col: 2 },
  quarry: { row: 2, col: 0 },
  'wall-street': { row: 2, col: 1 },
  urban: { row: 2, col: 2 }
};

function biomeBounds(biomeId) {
  const cell = BIOME_CELLS[biomeId];
  if (!cell) throw new Error(`Unknown biome: ${biomeId}`);
  return {
    minX: WORLD_MIN + (cell.col * CELL_SPAN),
    maxX: WORLD_MIN + ((cell.col + 1) * CELL_SPAN),
    minZ: WORLD_MIN + (cell.row * CELL_SPAN),
    maxZ: WORLD_MIN + ((cell.row + 1) * CELL_SPAN)
  };
}

function biomeCell(biomeId) {
  const cell = BIOME_CELLS[biomeId];
  if (!cell) throw new Error(`Unknown biome: ${biomeId}`);
  return cell;
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

function edgeLerp(min, max, t) {
  return min + ((max - min) * Number(t || 0));
}

function sideBasis(side) {
  if (side === 'north') return { alongX: 1, alongZ: 0, inwardX: 0, inwardZ: 1 };
  if (side === 'south') return { alongX: 1, alongZ: 0, inwardX: 0, inwardZ: -1 };
  if (side === 'east') return { alongX: 0, alongZ: 1, inwardX: -1, inwardZ: 0 };
  return { alongX: 0, alongZ: 1, inwardX: 1, inwardZ: 0 };
}

function borderPackCenter(bounds, pack) {
  const blockW = (pack.side === 'north' || pack.side === 'south') ? 4.8 : 2.6;
  const blockD = (pack.side === 'north' || pack.side === 'south') ? 2.6 : 4.8;
  const edgeInset = Math.max(0, Number(pack.edgeInset || 0));
  return {
    x: (pack.side === 'east')
      ? bounds.maxX - edgeInset - (blockW * 0.5)
      : (pack.side === 'west')
        ? bounds.minX + edgeInset + (blockW * 0.5)
        : edgeLerp(bounds.minX, bounds.maxX, pack.t),
    z: (pack.side === 'south')
      ? bounds.maxZ - edgeInset - (blockD * 0.5)
      : (pack.side === 'north')
        ? bounds.minZ + edgeInset + (blockD * 0.5)
        : edgeLerp(bounds.minZ, bounds.maxZ, pack.t)
  };
}

function borderPackPrimary(bounds, pack, baseW = 1.2) {
  const center = borderPackCenter(bounds, pack);
  const edgeInset = Math.max(0, Number(pack.edgeInset || 0));
  return {
    x: (pack.side === 'east')
      ? bounds.maxX - edgeInset - (baseW * 0.5)
      : (pack.side === 'west')
        ? bounds.minX + edgeInset + (baseW * 0.5)
        : center.x,
    z: (pack.side === 'south')
      ? bounds.maxZ - edgeInset - (baseW * 0.5)
      : (pack.side === 'north')
        ? bounds.minZ + edgeInset + (baseW * 0.5)
        : center.z
  };
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

function buildBiomeDataset(biomeId) {
  const spec = BIOME_SPECS[biomeId];
  if (!spec) throw new Error(`Missing biome spec: ${biomeId}`);
  const bounds = biomeBounds(biomeId);
  const authoredFeatures = spec.build(bounds);
  const sampledFeatures = authoredFeatures.flatMap(linesToPoints);
  return {
    biomeId,
    spec,
    bounds,
    authoredFeatures,
    sampledFeatures
  };
}

function unitRegionForBiome(biomeId, margin) {
  const bounds = biomeBounds(biomeId);
  const cell = biomeCell(biomeId);
  const neighborMargin = Math.max(0, Math.floor(Number(margin) || 0));
  return {
    minX: Math.max(WORLD_MIN, bounds.minX - (cell.col > 0 ? neighborMargin : 0)),
    maxX: Math.min(WORLD_MAX, bounds.maxX + (cell.col < 2 ? neighborMargin : 0)),
    minZ: Math.max(WORLD_MIN, bounds.minZ - (cell.row > 0 ? neighborMargin : 0)),
    maxZ: Math.min(WORLD_MAX, bounds.maxZ + (cell.row < 2 ? neighborMargin : 0))
  };
}

function intersectionBounds(a, b) {
  const minX = Math.max(a.minX, b.minX);
  const maxX = Math.min(a.maxX, b.maxX);
  const minZ = Math.max(a.minZ, b.minZ);
  const maxZ = Math.min(a.maxZ, b.maxZ);
  if (!(maxX > minX) || !(maxZ > minZ)) return null;
  return { minX, maxX, minZ, maxZ };
}

function internalBoundaries(regionMin, regionMax, boundsMin, boundsMax) {
  const values = [];
  if (regionMin < boundsMin && boundsMin < regionMax) values.push(boundsMin);
  if (regionMin < boundsMax && boundsMax < regionMax) values.push(boundsMax);
  return values.sort((a, b) => a - b);
}

function axisHeader(prefix, regionMin, regionMax, boundarySet, digitFn) {
  let line = prefix;
  for (let value = regionMin; value < regionMax; value++) {
    if (boundarySet.has(value) && value > regionMin) line += '|';
    line += digitFn(value);
  }
  return line;
}

function separatorRow(prefix, regionMin, regionMax, boundarySet) {
  let line = prefix;
  for (let value = regionMin; value < regionMax; value++) {
    if (boundarySet.has(value) && value > regionMin) line += '+';
    line += '-';
  }
  return line;
}

function renderUnitMap(region, bounds, cellRenderer) {
  const boundaryCols = new Set(internalBoundaries(region.minX, region.maxX, bounds.minX, bounds.maxX));
  const boundaryRows = new Set(internalBoundaries(region.minZ, region.maxZ, bounds.minZ, bounds.maxZ));
  const lines = [];

  lines.push(axisHeader('x10 ', region.minX, region.maxX, boundaryCols, (value) => String(Math.floor(value / 10) % 10)));
  lines.push(axisHeader('x01 ', region.minX, region.maxX, boundaryCols, (value) => String(Math.abs(value % 10))));

  for (let z = region.minZ; z < region.maxZ; z++) {
    if (boundaryRows.has(z) && z > region.minZ) {
      lines.push(separatorRow('    ', region.minX, region.maxX, boundaryCols));
    }
    let line = String(z).padStart(3, ' ') + ' ';
    for (let x = region.minX; x < region.maxX; x++) {
      if (boundaryCols.has(x) && x > region.minX) line += '|';
      line += cellRenderer(x, z);
    }
    lines.push(line);
  }

  return lines.join('\n');
}

function visibleBiomeSlices(region) {
  return Object.entries(BIOME_CELLS)
    .map(([biomeId, cell]) => {
      const bounds = biomeBounds(biomeId);
      const visible = intersectionBounds(region, bounds);
      if (!visible) return null;
      return {
        biomeId,
        name: BIOME_SPECS[biomeId].name,
        row: cell.row,
        col: cell.col,
        bounds,
        visible
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

function preferredObjectSymbol(spec, kind) {
  const preferred = spec && spec.glyphs && spec.glyphs[kind];
  if (typeof preferred === 'string' && /^[A-Za-z0-9]$/.test(preferred)) return preferred;
  const fallback = String(kind || '').replace(/[^A-Za-z0-9]/g, '');
  return fallback ? fallback[0].toUpperCase() : null;
}

function assignObjectSymbols(entries) {
  const assigned = new Map();
  const taken = new Set(['.', '*', '|', '-', '+']);

  for (const entry of entries) {
    const preferred = preferredObjectSymbol(entry.spec, entry.kind);
    if (preferred && !taken.has(preferred)) {
      assigned.set(entry.key, preferred);
      taken.add(preferred);
      continue;
    }
    for (const candidate of OBJECT_SYMBOL_POOL) {
      if (taken.has(candidate)) continue;
      assigned.set(entry.key, candidate);
      taken.add(candidate);
      break;
    }
  }

  return assigned;
}

function buildObjectBuckets(region, datasets) {
  const buckets = new Map();
  const usedKinds = new Map();

  for (const dataset of datasets) {
    for (const feature of dataset.sampledFeatures) {
      if (feature.x < region.minX || feature.x >= region.maxX || feature.z < region.minZ || feature.z >= region.maxZ) continue;
      const x = Math.floor(feature.x);
      const z = Math.floor(feature.z);
      const bucketKey = `${z}:${x}`;
      const featureKey = `${dataset.biomeId}:${feature.kind}`;
      const bucket = buckets.get(bucketKey) || new Set();
      bucket.add(featureKey);
      buckets.set(bucketKey, bucket);
      if (!usedKinds.has(featureKey)) {
        usedKinds.set(featureKey, {
          key: featureKey,
          biomeId: dataset.biomeId,
          biomeName: dataset.spec.name,
          kind: feature.kind,
          spec: dataset.spec
        });
      }
    }
  }

  return { buckets, usedKinds };
}

function buildReport(biomeId) {
  const { spec, bounds, authoredFeatures, sampledFeatures } = buildBiomeDataset(biomeId);
  const displayBiomeId = String(spec.displayBiomeId || biomeId);
  const outputFile = String(spec.outputFile || `${biomeId}.txt`);
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
  lines.push(`${spec.name} biome distribution map`);
  lines.push(`Biome: ${displayBiomeId}`);
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
    displayBiomeId,
    outputFile,
    name: spec.name,
    countsByKind,
    occupiedCells,
    occupancyRate,
    denseCells,
    content: lines.join('\n') + '\n'
  };
}

function buildUnitAreaReport(biomeId, options) {
  const focus = buildBiomeDataset(biomeId);
  const neighborMargin = Math.max(0, Math.floor(Number(options && options.neighborMargin) || DEFAULT_NEIGHBOR_MARGIN));
  const region = unitRegionForBiome(biomeId, neighborMargin);
  const slices = visibleBiomeSlices(region);
  const datasetByBiome = new Map();
  const datasets = slices.map((slice) => {
    if (!datasetByBiome.has(slice.biomeId)) datasetByBiome.set(slice.biomeId, buildBiomeDataset(slice.biomeId));
    return datasetByBiome.get(slice.biomeId);
  });
  const { buckets, usedKinds } = buildObjectBuckets(region, datasets);
  const symbolEntries = Array.from(usedKinds.values())
    .sort((a, b) => a.biomeName.localeCompare(b.biomeName) || a.kind.localeCompare(b.kind));
  const symbols = assignObjectSymbols(symbolEntries);

  const lines = [];
  lines.push(`${focus.spec.name} unit-area biome map`);
  lines.push(`Biome: ${biomeId}`);
  lines.push('Unit resolution: 1x1 world units');
  lines.push(`Focus bounds x:[${focus.bounds.minX}, ${focus.bounds.maxX}) z:[${focus.bounds.minZ}, ${focus.bounds.maxZ})`);
  lines.push(`Exact biome edges: west x=${focus.bounds.minX}, east x=${focus.bounds.maxX}, north z=${focus.bounds.minZ}, south z=${focus.bounds.maxZ}`);
  lines.push(`Sample region x:[${region.minX}, ${region.maxX}) z:[${region.minZ}, ${region.maxZ})  neighbor margin:${neighborMargin}`);
  lines.push('');
  lines.push('Visible biome slices');
  for (const slice of slices) {
    lines.push(`  ${slice.name.padEnd(8, ' ')} ${slice.biomeId === biomeId ? 'focus   ' : 'neighbor'} x:[${slice.visible.minX}, ${slice.visible.maxX}) z:[${slice.visible.minZ}, ${slice.visible.maxZ})`);
  }
  lines.push('');
  lines.push(`Binary biome mask (1 = ${focus.spec.name} biome, 0 = non-${focus.spec.name.toLowerCase()} neighbor area)`);
  lines.push(renderUnitMap(region, focus.bounds, (x, z) => (
    x >= focus.bounds.minX && x < focus.bounds.maxX &&
    z >= focus.bounds.minZ && z < focus.bounds.maxZ
  ) ? '1' : '0'));
  lines.push('');
  lines.push('Object map (sampled authored placements across the visible biome slices)');
  lines.push(renderUnitMap(region, focus.bounds, (x, z) => {
    const bucket = buckets.get(`${z}:${x}`);
    if (!bucket || !bucket.size) return '.';
    if (bucket.size > 1) return '*';
    const [key] = bucket;
    return symbols.get(key) || '?';
  }));
  lines.push('');
  lines.push('Object legend');
  for (const entry of symbolEntries) {
    lines.push(`  ${symbols.get(entry.key)} ${entry.biomeName}/${entry.kind}`);
  }
  lines.push('  * mixed unit (multiple object kinds overlap in the same 1x1 cell)');
  lines.push('  . empty unit');

  return {
    biomeId,
    name: focus.spec.name,
    region,
    visibleBiomes: slices,
    content: lines.join('\n') + '\n'
  };
}

function writeAllReports(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const biomeIds = Object.keys(BIOME_SPECS);
  const reports = biomeIds.map((biomeId) => buildReport(biomeId));
  const arcticUnitArea = buildUnitAreaReport('arctic');

  for (const report of reports) {
    fs.writeFileSync(path.join(outputDir, report.outputFile), report.content, 'utf8');
    const legacyPath = path.join(outputDir, `${report.biomeId}.txt`);
    if (report.outputFile !== `${report.biomeId}.txt` && fs.existsSync(legacyPath)) {
      fs.rmSync(legacyPath, { force: true });
    }
  }
  fs.writeFileSync(path.join(outputDir, 'arctic-unit-area.txt'), arcticUnitArea.content, 'utf8');

  const summaryLines = ['# Biome ASCII Maps', '', 'Generated by `npm run maps:biomes`.', ''];
  summaryLines.push('| Biome | Features | Occupied Cells | Hotspot | File |');
  summaryLines.push('| --- | ---: | ---: | --- | --- |');
  for (const report of reports) {
    const totalFeatures = Array.from(report.countsByKind.values()).reduce((sum, count) => sum + count, 0);
    const hotspot = report.denseCells[0]
      ? `r${report.denseCells[0].row} c${report.denseCells[0].col} (${report.denseCells[0].count})`
      : 'none';
    summaryLines.push(`| ${report.name} | ${totalFeatures} | ${report.occupiedCells}/196 (${report.occupancyRate}%) | ${hotspot} | [${report.outputFile}](./${report.outputFile}) |`);
  }
  summaryLines.push('');
  summaryLines.push('## Specialized maps');
  summaryLines.push('');
  summaryLines.push('- [Arctic unit-area boundary map](./arctic-unit-area.txt) - 1x1 world-unit mask with exact Arctic biome edges and sampled neighboring object strips.');
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
      glacier: 'G',
      spire: 'S',
      boulder: 'B',
      drift: 'd',
      fragment: 'f'
    },
    build(bounds) {
      const borderPacks = [
        {
          label: 'north-west-pack',
          side: 'north',
          t: 0.16,
          companions: [
            { along: -1.3, inset: 1.5 },
            { along: 1.5, inset: 2.5 }
          ]
        },
        {
          label: 'north-east-pack',
          side: 'north',
          t: 0.82,
          companions: [
            { along: -1.5, inset: 1.6 },
            { along: 1.2, inset: 2.4 }
          ]
        },
        {
          label: 'east-north-pack',
          side: 'east',
          t: 0.24,
          companions: [
            { along: -1.4, inset: 1.5 },
            { along: 1.4, inset: 2.3 }
          ]
        },
        {
          label: 'south-east-pack',
          side: 'south',
          t: 0.76,
          edgeInset: 2.8,
          companions: [
            { along: -1.4, inset: 1.4 },
            { along: 1.2, inset: 2.3 }
          ]
        },
        {
          label: 'south-west-pack',
          side: 'south',
          t: 0.24,
          edgeInset: 2.8,
          companions: [
            { along: -1.2, inset: 1.4 },
            { along: 1.5, inset: 2.4 }
          ]
        },
        {
          label: 'west-north-pack',
          side: 'west',
          t: 0.26,
          companions: [
            { along: -1.4, inset: 1.5 },
            { along: 1.2, inset: 2.3 }
          ]
        }
      ];
      const interiorGroups = [
        {
          label: 'inner-west-cluster',
          x: pt(bounds, 0.34, 0.32).x,
          z: pt(bounds, 0.34, 0.32).z,
          spires: [
            { dx: -1.0, dz: 0.5 },
            { dx: 1.0, dz: -0.6 }
          ]
        },
        {
          label: 'inner-east-cluster',
          x: pt(bounds, 0.66, 0.34).x,
          z: pt(bounds, 0.66, 0.34).z,
          spires: [
            { dx: -0.8, dz: 0.4 },
            { dx: 0.9, dz: -0.7 }
          ]
        },
        {
          label: 'inner-south-cluster',
          x: pt(bounds, 0.52, 0.66).x,
          z: pt(bounds, 0.52, 0.66).z,
          spires: [
            { dx: -1.2, dz: -0.4 },
            { dx: 0.2, dz: 0.1 },
            { dx: 1.3, dz: 0.6 }
          ]
        },
        {
          label: 'mid-west-cluster',
          x: pt(bounds, 0.30, 0.62).x,
          z: pt(bounds, 0.30, 0.62).z,
          spires: [
            { dx: -1.2, dz: 0.4 },
            { dx: 0.1, dz: -0.3 },
            { dx: 1.3, dz: 0.5 }
          ]
        },
        {
          label: 'mid-east-cluster',
          x: pt(bounds, 0.72, 0.62).x,
          z: pt(bounds, 0.72, 0.62).z,
          spires: [
            { dx: -1.2, dz: 0.2 },
            { dx: 0.2, dz: -0.4 },
            { dx: 1.2, dz: 0.5 }
          ]
        }
      ];
      return [
        uvPoint(bounds, 'mountain', 0.46, 0.46, 'mountain'),
        uvPoint(bounds, 'overhang', 0.76, 0.28, 'overhang'),
        uvPoint(bounds, 'shelf', 0.26, 0.28, 'ice-shelf'),
        uvPoint(bounds, 'arch', 0.34, 0.72, 'ice-arch'),
        uvPoint(bounds, 'pool', 0.70, 0.78, 'frozen-pool'),
        ...borderPacks.map((pack) => {
          const center = borderPackCenter(bounds, pack);
          return point('glacier', center.x, center.z, pack.label);
        }),
        ...borderPacks.flatMap((pack) => {
          const basis = sideBasis(pack.side);
          const primary = borderPackPrimary(bounds, pack);
          return [
            point('spire', primary.x, primary.z, `${pack.label}-primary`),
            ...pack.companions.map((companion, index) =>
              point(
                'spire',
                primary.x + (basis.alongX * companion.along) + (basis.inwardX * companion.inset),
                primary.z + (basis.alongZ * companion.along) + (basis.inwardZ * companion.inset),
                `${pack.label}-companion-${index + 1}`
              )
            )
          ];
        }),
        ...interiorGroups.flatMap((group) =>
          group.spires.map((spire, index) =>
            point('spire', group.x + spire.dx, group.z + spire.dz, `${group.label}-${index + 1}`)
          )
        ),
        ...uvPoints(bounds, 'boulder', [
          { u: 0.28, v: 0.36 }, { u: 0.74, v: 0.58 }, { u: 0.42, v: 0.80 },
          { u: 0.62, v: 0.18 }, { u: 0.56, v: 0.68 }
        ], 'boulder'),
        ...uvPoints(bounds, 'drift', [
          { u: 0.08, v: 0.10 }, { u: 0.42, v: 0.08 }, { u: 0.92, v: 0.18 }, { u: 0.10, v: 0.54 },
          { u: 0.90, v: 0.46 }, { u: 0.28, v: 0.70 }, { u: 0.52, v: 0.80 }, { u: 0.76, v: 0.66 }
        ], 'drift'),
        ...uvPoints(bounds, 'fragment', [
          { u: 0.03, v: 0.08 }, { u: 0.30, v: 0.03 }, { u: 0.78, v: 0.02 }, { u: 0.98, v: 0.20 },
          { u: 0.97, v: 0.68 }, { u: 0.82, v: 0.98 }, { u: 0.22, v: 0.97 }, { u: 0.02, v: 0.78 },
          { u: 0.28, v: 0.18 }, { u: 0.72, v: 0.18 }, { u: 0.22, v: 0.84 }, { u: 0.76, v: 0.84 }
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
      heroArch: 'H',
      pocket: 'P',
      rubble: 'R',
      arch: 'A',
      butte: 'B',
      outcrop: 'O',
      filler: 'I',
      fossil: 'F',
      cactus: 'C',
      bush: 'b',
      bone: 'o',
      dune: 'D',
      fence: 'W',
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
        uvPoint(bounds, 'heroArch', 0.52, 0.54, 'center-hero-arch'),
        uvPoint(bounds, 'butte', 0.42, 0.56, 'center-butte'),
        uvPoint(bounds, 'fence', 0.64, 0.50, 'center-fence'),
        ...uvPoints(bounds, 'arch', [{ u: 0.12, v: 0.52 }], 'arch'),
        ...uvPoints(bounds, 'outcrop', [{ u: 0.56, v: 0.88 }], 'outcrop'),
        ...uvPoints(bounds, 'filler', [
          { u: 0.86, v: 0.12 }, { u: 0.82, v: 0.18 }, { u: 0.78, v: 0.24 },
          { u: 0.92, v: 0.34 }, { u: 0.88, v: 0.46 }, { u: 0.86, v: 0.60 }, { u: 0.90, v: 0.72 }
        ], 'filler'),
        uvPoint(bounds, 'fossil', 0.18, 0.72, 'fossil-ribs'),
        ...uvPoints(bounds, 'cactus', [
          { u: 0.18, v: 0.46 }, { u: 0.20, v: 0.86 }, { u: 0.34, v: 0.66 }, { u: 0.46, v: 0.78 },
          { u: 0.58, v: 0.70 }, { u: 0.76, v: 0.46 }, { u: 0.78, v: 0.64 }, { u: 0.84, v: 0.86 }
        ], 'cactus'),
        ...uvPoints(bounds, 'bush', [
          { u: 0.34, v: 0.60 }, { u: 0.58, v: 0.62 }, { u: 0.74, v: 0.56 }, { u: 0.48, v: 0.48 }
        ], 'bush'),
        ...uvPoints(bounds, 'bone', [{ u: 0.72, v: 0.62 }, { u: 0.78, v: 0.66 }, { u: 0.24, v: 0.24 }], 'bone'),
        ...uvPoints(bounds, 'dune', [
          { u: 0.40, v: 0.90 }, { u: 0.16, v: 0.16 }, { u: 0.40, v: 0.22 }
        ], 'dune'),
        ...uvPoints(bounds, 'tumbleweed', [{ u: 0.32, v: 0.18 }, { u: 0.24, v: 0.86 }], 'tumbleweed'),
        ...uvPoints(bounds, 'rock', [
          { u: 0.26, v: 0.26 }, { u: 0.46, v: 0.48 }, { u: 0.62, v: 0.58 },
          { u: 0.72, v: 0.34 }, { u: 0.20, v: 0.70 }, { u: 0.56, v: 0.46 }
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
          { u: 0.16, v: 0.08 }, { u: 0.34, v: 0.18 }, { u: 0.54, v: 0.16 },
          { u: 0.28, v: 0.44 }, { u: 0.82, v: 0.26 }, { u: 0.80, v: 0.78 },
          { u: 0.56, v: 0.86 }, { u: 0.22, v: 0.82 }, { u: 0.90, v: 0.58 }
        ], 'giant'),
        ...uvPoints(bounds, 'canopy', [
          { u: 0.12, v: 0.12 }, { u: 0.16, v: 0.28 }, { u: 0.20, v: 0.48 },
          { u: 0.40, v: 0.10 }, { u: 0.70, v: 0.12 }, { u: 0.90, v: 0.22 },
          { u: 0.94, v: 0.70 }, { u: 0.34, v: 0.88 }, { u: 0.66, v: 0.90 },
          { u: 0.84, v: 0.86 }, { u: 0.38, v: 0.68 }
        ], 'canopy'),
        ...uvPoints(bounds, 'bushy', [
          { u: 0.24, v: 0.24 }, { u: 0.30, v: 0.62 }, { u: 0.46, v: 0.36 },
          { u: 0.74, v: 0.30 }, { u: 0.88, v: 0.44 }, { u: 0.70, v: 0.72 },
          { u: 0.48, v: 0.82 }, { u: 0.28, v: 0.86 }, { u: 0.82, v: 0.84 }
        ], 'bushy'),
        ...uvPoints(bounds, 'sapling', [
          { u: 0.18, v: 0.72 }, { u: 0.32, v: 0.84 }, { u: 0.46, v: 0.40 },
          { u: 0.88, v: 0.58 }, { u: 0.96, v: 0.68 }
        ], 'sapling'),
        ...uvPoints(bounds, 'fern', [
          { u: 0.14, v: 0.20 }, { u: 0.18, v: 0.24 },
          { u: 0.28, v: 0.50 }, { u: 0.32, v: 0.54 },
          { u: 0.72, v: 0.24 }, { u: 0.78, v: 0.28 },
          { u: 0.44, v: 0.78 }, { u: 0.50, v: 0.82 }, { u: 0.56, v: 0.84 },
          { u: 0.84, v: 0.62 }, { u: 0.88, v: 0.68 }
        ], 'fern'),
        ...uvPoints(bounds, 'log', [
          { u: 0.24, v: 0.56 }, { u: 0.60, v: 0.40 }, { u: 0.50, v: 0.78 }, { u: 0.74, v: 0.74 }
        ], 'log'),
        ...uvPoints(bounds, 'mushroom', [
          { u: 0.22, v: 0.60 }, { u: 0.26, v: 0.62 }, { u: 0.62, v: 0.30 }, { u: 0.66, v: 0.34 },
          { u: 0.42, v: 0.76 }, { u: 0.48, v: 0.82 }, { u: 0.86, v: 0.66 }, { u: 0.74, v: 0.72 }
        ], 'mushroom'),
        uvLine(bounds, 'vinePath', { u: 0.14, v: 0.72 }, { u: 0.30, v: 0.82 }, 4, 'vine-1'),
        uvLine(bounds, 'vinePath', { u: 0.72, v: 0.66 }, { u: 0.86, v: 0.78 }, 4, 'vine-2'),
        ...[
          { kind: 'blocker', x: center.x - 6.0, z: center.z - 3.2, label: 'fallen-pillar' },
          { kind: 'blocker', x: center.x - 9.8, z: center.z - 1.4, label: 'corridor-blocker-1' },
          { kind: 'blocker', x: center.x - 7.0, z: center.z + 0.8, label: 'corridor-blocker-2' },
          { kind: 'blocker', x: center.x - 9.2, z: center.z + 3.0, label: 'corridor-blocker-3' },
          { kind: 'mossPatch', x: pt(bounds, 0.60, 0.40).x + 0.4, z: pt(bounds, 0.60, 0.40).z + 0.3, label: 'moss-1' },
          { kind: 'mossPatch', x: waterfall.x + 5.0, z: waterfall.z + 7.2, label: 'moss-2' },
          { kind: 'mossPatch', x: pt(bounds, 0.50, 0.78).x + 0.5, z: pt(bounds, 0.50, 0.78).z + 0.2, label: 'moss-3' },
          { kind: 'mossPatch', x: pt(bounds, 0.70, 0.72).x + 0.35, z: pt(bounds, 0.70, 0.72).z + 0.45, label: 'moss-4' }
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
  'wall-street': {
    name: 'Wall Street',
    displayBiomeId: 'wall-street',
    outputFile: 'wall-street.txt',
    glyphs: {
      exchange: 'F',
      podium: 'L',
      tower: 'T',
      annex: 'W',
      brokerage: 'E',
      village: 'V',
      stairs: 'S',
      alley: 'A',
      cover: 'C',
      kiosk: 'K',
      arch: 'H',
      lamp: 'l'
    },
    build(bounds) {
      const exchange = pt(bounds, 0.50, 0.84);
      const podium = pt(bounds, 0.50, 0.94);
      return [
        uvLine(bounds, 'stairs', { u: 0.50, v: 0.38 }, { u: 0.50, v: 0.79 }, 8, 'grand-stair'),
        uvLine(bounds, 'alley', { u: 0.31, v: 0.40 }, { u: 0.32, v: 0.82 }, 7, 'west-alley'),
        uvLine(bounds, 'alley', { u: 0.67, v: 0.38 }, { u: 0.68, v: 0.80 }, 7, 'east-alley'),
        point('exchange', exchange.x, exchange.z, 'stock-exchange'),
        point('podium', podium.x, podium.z, 'ceo-podium'),
        uvPoint(bounds, 'tower', 0.50, 0.94, 'ceo-tower'),
        uvPoint(bounds, 'annex', 0.25, 0.62, 'west-annex'),
        uvPoint(bounds, 'brokerage', 0.81, 0.60, 'east-brokerage'),
        ...uvPoints(bounds, 'village', [
          { u: 0.15, v: 0.24 },
          { u: 0.86, v: 0.24 },
          { u: 0.39, v: 0.44 },
          { u: 0.66, v: 0.41 }
        ], 'support'),
        ...uvPoints(bounds, 'kiosk', [{ u: 0.28, v: 0.36 }, { u: 0.74, v: 0.34 }], 'ticker-kiosk'),
        ...uvPoints(bounds, 'arch', [{ u: 0.31, v: 0.67 }, { u: 0.69, v: 0.63 }], 'alley-arch'),
        ...uvPoints(bounds, 'lamp', [{ u: 0.45, v: 0.47 }, { u: 0.60, v: 0.45 }], 'street-lamp'),
        ...uvPoints(bounds, 'cover', [
          { u: 0.47, v: 0.36 },
          { u: 0.24, v: 0.50 },
          { u: 0.38, v: 0.46 },
          { u: 0.50, v: 0.44 },
          { u: 0.61, v: 0.43 },
          { u: 0.50, v: 0.54 },
          { u: 0.46, v: 0.56 },
          { u: 0.58, v: 0.60 },
          { u: 0.30, v: 0.58 },
          { u: 0.22, v: 0.56 },
          { u: 0.70, v: 0.53 }
        ], 'cover')
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
  buildUnitAreaReport,
  writeAllReports
};
