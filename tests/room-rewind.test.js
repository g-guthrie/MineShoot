import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHitboxesFromPose,
  buildRewoundTargetEntity,
  clampRewindShotTime,
  recordEntityPoseHistory,
  rewindEntityPose,
  seedEntityPoseHistory
} from '../cloudflare/server/room/RoomRewind.js';

function createEntity(overrides = {}) {
  return {
    id: 'u1',
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    velocityY: 0,
    isGrounded: true,
    poseHistory: [],
    ...overrides
  };
}

test('room rewind interpolates entity pose between stored samples', () => {
  const entity = createEntity();
  recordEntityPoseHistory(entity, 1000);
  entity.x = 10;
  entity.y = 2.6;
  entity.z = -4;
  entity.yaw = 0.5;
  entity.pitch = 0.2;
  entity.velocityY = 3;
  entity.isGrounded = false;
  recordEntityPoseHistory(entity, 1100);

  const rewound = rewindEntityPose(entity, 1050, 1100);
  assert.equal(Number(rewound.x.toFixed(2)), 5);
  assert.equal(Number(rewound.y.toFixed(2)), 2.1);
  assert.equal(Number(rewound.z.toFixed(2)), -2);
  assert.equal(Number(rewound.yaw.toFixed(2)), 0.25);
  assert.equal(Number(rewound.pitch.toFixed(2)), 0.1);
  assert.equal(Number(rewound.velocityY.toFixed(2)), 1.5);
  assert.equal(rewound.isGrounded, false);
});

test('room rewind clamps stale shot times to the maximum rewind window', () => {
  assert.equal(clampRewindShotTime(1000, 1500), 1250);
  assert.equal(clampRewindShotTime(1490, 1500), 1490);
  assert.equal(clampRewindShotTime(0, 1500), 1500);
});

test('room rewind falls back to the current pose when history is unavailable', () => {
  const entity = createEntity({ x: 12, y: 3, z: -9, yaw: 0.7, pitch: -0.2, velocityY: 2, isGrounded: false, poseHistory: [] });
  const rewound = rewindEntityPose(entity, 1400, 1500);

  assert.equal(rewound.x, 12);
  assert.equal(rewound.y, 3);
  assert.equal(rewound.z, -9);
  assert.equal(rewound.yaw, 0.7);
  assert.equal(rewound.pitch, -0.2);
  assert.equal(rewound.velocityY, 2);
  assert.equal(rewound.isGrounded, false);
});

test('room rewind reseeding prevents interpolation across teleports', () => {
  const entity = createEntity({ x: 0 });
  recordEntityPoseHistory(entity, 1000);
  entity.x = 100;
  entity.z = 50;
  entity.y = 4;
  seedEntityPoseHistory(entity, 2000);

  const rewound = rewindEntityPose(entity, 1950, 2000);
  assert.equal(rewound.x, 100);
  assert.equal(rewound.z, 50);
  assert.equal(rewound.y, 4);
});

test('room rewind builds explicit hitboxes from a rewound target pose', () => {
  const entity = createEntity();
  recordEntityPoseHistory(entity, 1000);
  entity.x = 8;
  entity.z = -6;
  recordEntityPoseHistory(entity, 1100);

  const target = buildRewoundTargetEntity(entity, 1050, 1100);
  const hitboxes = buildHitboxesFromPose({ x: target.x, y: target.y, z: target.z });

  assert.deepEqual(target.bodyBox, hitboxes.bodyBox);
  assert.deepEqual(target.headBox, hitboxes.headBox);
});
