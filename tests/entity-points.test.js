import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AVATAR_ARM_LEFT_CENTER_OFFSET,
  AVATAR_ARM_RIGHT_CENTER_OFFSET,
  AVATAR_ARM_SIZE,
  AVATAR_HEAD_CENTER_OFFSET,
  AVATAR_HEAD_SIZE,
  AVATAR_LEG_LEFT_CENTER_OFFSET,
  AVATAR_LEG_RIGHT_CENTER_OFFSET,
  AVATAR_LEG_SIZE,
  AVATAR_TORSO_CENTER_OFFSET,
  AVATAR_TORSO_SIZE,
  BODY_HITBOX_CENTER_OFFSET_Y,
  BODY_HITBOX_SIZE,
  HEAD_HITBOX_CENTER_OFFSET_Y,
  HEAD_HITBOX_SIZE
} from '../shared/entity-constants.js';
import {
  entityBodyHitboxY,
  entityBodyHitboxYFromFeet,
  entityFeetY,
  entityHeadHitboxY,
  entityHeadHitboxYFromFeet
} from '../shared/entity-points.js';

test('feet-based hitbox helpers preserve the shared center offsets', () => {
  const feetY = 3.25;

  assert.equal(entityBodyHitboxYFromFeet(feetY), feetY + BODY_HITBOX_CENTER_OFFSET_Y);
  assert.equal(entityHeadHitboxYFromFeet(feetY), feetY + HEAD_HITBOX_CENTER_OFFSET_Y);
});

test('entity-space and feet-space hitbox helpers agree on the same position', () => {
  const entityY = 4.85;
  const feetY = entityFeetY(entityY);

  assert.equal(entityBodyHitboxY(entityY), entityBodyHitboxYFromFeet(feetY));
  assert.equal(entityHeadHitboxY(entityY), entityHeadHitboxYFromFeet(feetY));
});

test('combat hitbox vertical split is derived from avatar torso and head primitives', () => {
  const torsoTopY = AVATAR_TORSO_CENTER_OFFSET.y + (AVATAR_TORSO_SIZE.y * 0.5);
  const legBottomY = Math.min(
    AVATAR_LEG_LEFT_CENTER_OFFSET.y - (AVATAR_LEG_SIZE.y * 0.5),
    AVATAR_LEG_RIGHT_CENTER_OFFSET.y - (AVATAR_LEG_SIZE.y * 0.5)
  );
  const bodyTopY = BODY_HITBOX_CENTER_OFFSET_Y + (BODY_HITBOX_SIZE.y * 0.5);
  const bodyBottomY = BODY_HITBOX_CENTER_OFFSET_Y - (BODY_HITBOX_SIZE.y * 0.5);
  const headBottomY = HEAD_HITBOX_CENTER_OFFSET_Y - (HEAD_HITBOX_SIZE.y * 0.5);
  const primitiveHeadBottomY = AVATAR_HEAD_CENTER_OFFSET.y - (AVATAR_HEAD_SIZE.y * 0.5);
  const widestHalfX = Math.max(
    AVATAR_TORSO_SIZE.x * 0.5,
    Math.abs(AVATAR_ARM_LEFT_CENTER_OFFSET.x) + (AVATAR_ARM_SIZE.x * 0.5),
    Math.abs(AVATAR_ARM_RIGHT_CENTER_OFFSET.x) + (AVATAR_ARM_SIZE.x * 0.5),
    Math.abs(AVATAR_LEG_LEFT_CENTER_OFFSET.x) + (AVATAR_LEG_SIZE.x * 0.5),
    Math.abs(AVATAR_LEG_RIGHT_CENTER_OFFSET.x) + (AVATAR_LEG_SIZE.x * 0.5)
  );
  const deepestHalfZ = Math.max(
    AVATAR_TORSO_SIZE.z * 0.5,
    Math.abs(AVATAR_ARM_LEFT_CENTER_OFFSET.z) + (AVATAR_ARM_SIZE.z * 0.5),
    Math.abs(AVATAR_ARM_RIGHT_CENTER_OFFSET.z) + (AVATAR_ARM_SIZE.z * 0.5),
    Math.abs(AVATAR_LEG_LEFT_CENTER_OFFSET.z) + (AVATAR_LEG_SIZE.z * 0.5),
    Math.abs(AVATAR_LEG_RIGHT_CENTER_OFFSET.z) + (AVATAR_LEG_SIZE.z * 0.5)
  );

  assert.equal(bodyTopY, torsoTopY);
  assert.ok(Math.abs(bodyBottomY - legBottomY) < 1e-9);
  assert.equal(BODY_HITBOX_SIZE.x, widestHalfX * 2);
  assert.equal(BODY_HITBOX_SIZE.z, deepestHalfZ * 2);
  assert.equal(HEAD_HITBOX_CENTER_OFFSET_Y, AVATAR_HEAD_CENTER_OFFSET.y);
  assert.equal(HEAD_HITBOX_SIZE.y, AVATAR_HEAD_SIZE.y);
  assert.equal(headBottomY, primitiveHeadBottomY);
});
