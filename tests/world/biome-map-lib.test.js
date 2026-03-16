import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildReport } = require('../../scripts/biome-map-lib.cjs');

test('arctic biome map uses raw biome edges and tracks glacier fields', () => {
  const report = buildReport('arctic');

  assert.ok(report.content.includes('Arctic biome distribution map'));
  assert.ok(report.content.includes('Bounds x:[2, 56] z:[2, 56]  grid:14x14'));
  assert.equal(report.countsByKind.get('glacier'), 4);
  assert.equal(report.countsByKind.get('spire'), 17);
});
