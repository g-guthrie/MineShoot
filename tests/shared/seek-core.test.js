import test from 'node:test';
import assert from 'node:assert/strict';

import { selectSeekTarget } from '../../shared/seek-core.js';

test('rect lock selection prefers the candidate nearest the reticle center', () => {
  const result = selectSeekTarget({
    origin: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    maxRange: 24,
    coneHalfAngleDeg: 180,
    preferScreenCenter: true,
    boxWidthPx: 200,
    boxHeightPx: 200,
    viewportWidth: 1000,
    viewportHeight: 1000,
    candidates: [
      {
        id: 'near-but-off-center',
        corePos: { x: 0.5, y: 0, z: -4 }
      },
      {
        id: 'farther-but-centered',
        corePos: { x: 0, y: 0, z: -8 }
      }
    ],
    projectToNdc(worldPos) {
      if (worldPos.x === 0.5) return { x: 0.15, y: 0, z: 0 };
      return { x: 0.02, y: 0, z: 0 };
    }
  });

  assert.equal(result.lockTargetId, 'farther-but-centered');
  assert.equal(result.nearestTargetId, 'farther-but-centered');
  assert.equal(result.distance, 8);
});

test('rect lock selection falls back to nearest distance when candidates share the same center offset', () => {
  const result = selectSeekTarget({
    origin: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    maxRange: 24,
    coneHalfAngleDeg: 180,
    preferScreenCenter: true,
    boxWidthPx: 200,
    boxHeightPx: 200,
    viewportWidth: 1000,
    viewportHeight: 1000,
    candidates: [
      {
        id: 'closer',
        corePos: { x: 0, y: 0, z: -4 }
      },
      {
        id: 'farther',
        corePos: { x: 0, y: 0, z: -8 }
      }
    ],
    projectToNdc() {
      return { x: 0.04, y: 0, z: 0 };
    }
  });

  assert.equal(result.lockTargetId, 'closer');
  assert.equal(result.distance, 4);
});
