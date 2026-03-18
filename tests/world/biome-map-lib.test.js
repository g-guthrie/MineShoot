import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildReport, buildUnitAreaReport, buildVerticalSeamReport } = require('../../scripts/biome-map-lib.cjs');

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

test('wall street map pushes mass to the edges while keeping the center street open', () => {
  const report = buildReport('wall-street');
  const cellWithLabel = (label) => report.denseCells.find((cell) => cell.labels.includes(label));
  const topBandCells = report.denseCells.filter((cell) => cell.row <= 1);
  const westEdgeRun = report.denseCells.filter((cell) => cell.row <= 10 && cell.col <= 2);
  const eastEdgeRun = report.denseCells.filter((cell) => cell.row <= 10 && cell.col >= 11);
  const centerStreet = report.denseCells.filter((cell) =>
    cell.row <= 10 && cell.col >= 5 && cell.col <= 8
  );
  const southEndcap = report.denseCells.filter((cell) =>
    cell.row >= 10 && cell.col >= 6 && cell.col <= 8
  );
  const northPlanters = report.denseCells.filter((cell) =>
    cell.labels.some((label) => label.startsWith('north-planter'))
  );
  const westAnnex = cellWithLabel('west-annex');
  const eastBrokerage = cellWithLabel('east-brokerage');
  const grandStair = cellWithLabel('grand-stair');

  assert.ok(report.content.includes('Wall Street biome distribution map'));
  assert.ok(report.occupiedCells >= 24);
  assert.ok(report.occupiedCells <= 30);
  assert.ok(report.denseCells.every((cell) => cell.count <= 2));
  assert.equal(topBandCells.length, 2);
  assert.equal(northPlanters.length, 2);
  assert.ok(westEdgeRun.length >= 8);
  assert.ok(eastEdgeRun.length >= 8);
  assert.ok(centerStreet.length <= 1);
  assert.ok(southEndcap.length >= 3);
  assert.ok(westAnnex && westAnnex.row >= 5 && westAnnex.row <= 7 && westAnnex.col <= 1);
  assert.ok(eastBrokerage && eastBrokerage.row >= 5 && eastBrokerage.row <= 7 && eastBrokerage.col >= 12);
  assert.ok(grandStair && grandStair.row >= 10);
});

test('citadel to wall street seam report shows the shared border and authored placements on both sides', () => {
  const report = buildVerticalSeamReport('citadel', 'wall-street');

  assert.equal(report.outputFile, 'citadel-wall-street-seam.txt');
  assert.equal(report.seamZ, 110);
  assert.ok(report.content.includes('Citadel to Wall Street seam map'));
  assert.ok(report.content.includes('Shared biome border: z=110'));
  assert.ok(report.content.includes('Biome mask (C = Citadel, W = Wall Street)'));
  assert.ok(report.content.includes('Citadel legend'));
  assert.ok(report.content.includes('Wall Street legend'));
  assert.match(report.content, /\n    -{54}\n110 /);
  assert.ok(report.content.includes('  B base'));
  assert.ok(report.content.includes('  F exchange'));
});
