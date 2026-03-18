import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildReport, buildUnitAreaReport } = require('../../scripts/biome-map-lib.cjs');

test('arctic biome map uses raw biome edges and tracks glacier fields', () => {
  const report = buildReport('arctic');
  const southWestPackCell = report.denseCells.find((cell) => cell.labels.includes('south-west-pack'));
  const southEastPackCell = report.denseCells.find((cell) => cell.labels.includes('south-east-pack'));

  assert.ok(report.content.includes('Arctic biome distribution map'));
  assert.ok(report.content.includes('Bounds x:[2, 56] z:[2, 56]  grid:14x14'));
  assert.equal(report.countsByKind.get('glacier'), 6);
  assert.equal(report.countsByKind.get('spire'), 31);
  assert.equal(report.occupiedCells, 45);
  assert.ok(report.denseCells.some((cell) => cell.row === 0));
  assert.ok(report.denseCells.some((cell) => cell.col === 0));
  assert.ok(report.denseCells.some((cell) => cell.col === 13));
  assert.ok(report.denseCells.some((cell) => cell.row >= 8 && cell.row <= 10 && cell.col >= 4 && cell.col <= 10));
  assert.equal(southWestPackCell && southWestPackCell.row, 12);
  assert.equal(southEastPackCell && southEastPackCell.row, 12);
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

test('jungle map keeps a looser but readable distribution after the reauthor', () => {
  const report = buildReport('jungle');

  assert.ok(report.content.includes('Jungle biome distribution map'));
  assert.ok(report.occupiedCells >= 58);
  assert.ok(report.occupiedCells <= 62);
  assert.equal(report.countsByKind.get('edgeTree'), 6);
  assert.ok(report.denseCells.every((cell) => cell.count <= 2));
  assert.ok(report.denseCells.some((cell) => cell.row >= 5 && cell.row <= 8 && cell.col >= 2 && cell.col <= 4));
  assert.ok(report.denseCells.some((cell) => cell.row >= 10 && cell.row <= 12 && cell.col >= 6 && cell.col <= 11));
});

test('desert map gains a center hero beat without creating a new hotspot', () => {
  const report = buildReport('desert');
  const heroArchCell = report.denseCells.find((cell) => cell.labels.includes('center-hero-arch'));
  const centerBand = report.denseCells.filter((cell) =>
    cell.row >= 6 && cell.row <= 9 && cell.col >= 5 && cell.col <= 8
  );
  const westArchPocket = report.denseCells.filter((cell) =>
    cell.row >= 6 && cell.row <= 8 && cell.col >= 0 && cell.col <= 3
  );

  assert.ok(report.content.includes('Desert biome distribution map'));
  assert.ok(report.occupiedCells >= 54);
  assert.ok(report.occupiedCells <= 60);
  assert.equal(report.countsByKind.get('heroArch'), 1);
  assert.equal(report.countsByKind.get('butte'), 1);
  assert.equal(report.countsByKind.get('fence'), 1);
  assert.ok(report.denseCells.every((cell) => cell.count <= 2));
  assert.ok(heroArchCell);
  assert.ok(heroArchCell.row >= 6 && heroArchCell.row <= 8);
  assert.ok(heroArchCell.col >= 6 && heroArchCell.col <= 8);
  assert.ok(centerBand.length >= 4);
  assert.ok(centerBand.length > westArchPocket.length);
});

test('wall street map starts earlier, stays center-dominant, and avoids new hotspots', () => {
  const report = buildReport('wall-street');
  const topBandCells = report.denseCells.filter((cell) => cell.row <= 3);
  const northInteriorSupport = report.denseCells.filter((cell) =>
    cell.row >= 3 && cell.row <= 6 && cell.col >= 5 && cell.col <= 8
  );
  const westFlank = report.denseCells.filter((cell) =>
    cell.row >= 5 && cell.row <= 11 && cell.col >= 3 && cell.col <= 5
  );
  const eastFlank = report.denseCells.filter((cell) =>
    cell.row >= 5 && cell.row <= 11 && cell.col >= 9 && cell.col <= 11
  );
  const centerBand = report.denseCells.filter((cell) =>
    cell.row >= 5 && cell.row <= 12 && cell.col >= 6 && cell.col <= 8
  );

  assert.ok(report.content.includes('Wall Street biome distribution map'));
  assert.ok(report.occupiedCells >= 34);
  assert.ok(report.occupiedCells <= 38);
  assert.ok(report.denseCells.every((cell) => cell.count <= 2));
  assert.ok(topBandCells.length >= 2);
  assert.ok(northInteriorSupport.length >= 2);
  assert.ok(westFlank.length >= 1);
  assert.ok(eastFlank.length >= 1);
  assert.ok(centerBand.length > westFlank.length);
  assert.ok(centerBand.length > eastFlank.length);
});
