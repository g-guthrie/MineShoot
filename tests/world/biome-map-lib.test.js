import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildReport, buildUnitAreaReport } = require('../../scripts/biome-map-lib.cjs');

test('arctic biome map uses raw biome edges and tracks glacier fields', () => {
  const report = buildReport('arctic');

  assert.ok(report.content.includes('Arctic biome distribution map'));
  assert.ok(report.content.includes('Bounds x:[2, 56] z:[2, 56]  grid:14x14'));
  assert.equal(report.countsByKind.get('glacier'), 8);
  assert.equal(report.countsByKind.get('spire'), 30);
  assert.ok(report.denseCells.some((cell) => cell.row === 0));
  assert.ok(report.denseCells.some((cell) => cell.row === 13));
  assert.ok(report.denseCells.some((cell) => cell.col === 0));
  assert.ok(report.denseCells.some((cell) => cell.col === 13));
});

test('arctic unit-area report shows exact edges and neighboring object slices', () => {
  const report = buildUnitAreaReport('arctic');

  assert.ok(report.content.includes('Arctic unit-area biome map'));
  assert.ok(report.content.includes('Exact biome edges: west x=2, east x=56, north z=2, south z=56'));
  assert.ok(report.content.includes('Sample region x:[2, 68) z:[2, 68)  neighbor margin:12'));
  assert.ok(report.content.includes('Radar    neighbor x:[56, 68) z:[2, 56)'));
  assert.ok(report.content.includes('Jungle   neighbor x:[2, 56) z:[56, 68)'));
  assert.ok(report.content.includes('Binary biome mask'));
  assert.match(report.content, /\n    [-+]+\n 56 /);
  assert.ok(report.content.includes('Object map (sampled authored placements across the visible biome slices)'));
});
