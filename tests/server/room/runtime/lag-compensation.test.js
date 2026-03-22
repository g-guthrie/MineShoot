import test from 'node:test';
import assert from 'node:assert/strict';

import {
  recordHistorySample,
  sampleEntityHistory
} from '../../../../cloudflare/server/room/runtime/lag-compensation.mjs';

function createEntity(overrides = {}) {
  return {
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    alive: true,
    stateHistory: [],
    ...overrides
  };
}

test('lag compensation reseeds history when an entity teleports', () => {
  const entity = createEntity();
  recordHistorySample(entity, 1000);
  entity.x = 100;
  entity.z = 50;
  entity.y = 4;
  recordHistorySample(entity, 2000);

  const sampled = sampleEntityHistory(entity, 1950);
  assert.equal(sampled.x, 100);
  assert.equal(sampled.z, 50);
  assert.equal(sampled.y, 4);
});
