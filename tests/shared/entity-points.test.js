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
  BODY_HITBOX_DEPTH_SCALE,
  BODY_HITBOX_HEIGHT_SCALE,
  BODY_HITBOX_SQUARE_PADDING,
  BODY_HITBOX_SIZE,
  HEAD_HITBOX_HEIGHT_SCALE,
  HEAD_HITBOX_LINEAR_SCALE,
  HEAD_HITBOX_SQUARE_PADDING,
  HEAD_HITBOX_TOP_PADDING,
  HEAD_HITBOX_CENTER_OFFSET_Y,
  HEAD_HITBOX_SIZE
} from '../../shared/entity-constants.js';
import {
  HITSCAN_ORIGIN_FORWARD_OFFSET,
  MUZZLE_ORIGIN_FORWARD_OFFSET,
  ROLL_BODY_HITBOX_LINEAR_SCALE,
  buildCombatHitboxesFromFeetPosition,
  entityBodyHitboxYFromFeet,
  entityFeetY,
  entityHeadHitboxYFromFeet,
  entityMarkerPointYFromFeet,
  logicalHitscanOriginFromEye,
  logicalMuzzleOriginFromEye
} from '../../shared/entity-points.js';

test('feet-based hitbox helpers preserve the shared center offsets', () => {
  const feetY = 3.25;

  assert.equal(entityBodyHitboxYFromFeet(feetY), feetY + BODY_HITBOX_CENTER_OFFSET_Y);
  assert.equal(entityHeadHitboxYFromFeet(feetY), feetY + HEAD_HITBOX_CENTER_OFFSET_Y);
  assert.equal(entityMarkerPointYFromFeet(feetY), feetY + 2.25);
});

test('entity-space and feet-space hitbox helpers agree on the same position', () => {
  const entityY = 4.85;
  const feetY = entityFeetY(entityY);

  assert.equal(entityFeetY(entityY), feetY);
  assert.equal(entityBodyHitboxYFromFeet(feetY), feetY + BODY_HITBOX_CENTER_OFFSET_Y);
  assert.equal(entityHeadHitboxYFromFeet(feetY), feetY + HEAD_HITBOX_CENTER_OFFSET_Y);
});

test('combat hitbox vertical split is derived from avatar torso and head primitives', () => {
  const torsoTopY = AVATAR_TORSO_CENTER_OFFSET.y + (AVATAR_TORSO_SIZE.y * 0.5);
  const legBottomY = Math.min(
    AVATAR_LEG_LEFT_CENTER_OFFSET.y - (AVATAR_LEG_SIZE.y * 0.5),
    AVATAR_LEG_RIGHT_CENTER_OFFSET.y - (AVATAR_LEG_SIZE.y * 0.5)
  );
  const bodyBaseHeight = torsoTopY - legBottomY;
  const bodyHeightIncrease = bodyBaseHeight * (BODY_HITBOX_HEIGHT_SCALE - 1);
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
  const bodyBaseSquareSize = Math.max(widestHalfX * 2, deepestHalfZ * 2);
  const headBaseSquareSize = Math.max(AVATAR_HEAD_SIZE.x, AVATAR_HEAD_SIZE.z);

  assert.ok(Math.abs(bodyTopY - (torsoTopY + bodyHeightIncrease)) < 1e-9);
  assert.ok(Math.abs(bodyBottomY - legBottomY) < 1e-9);
  assert.equal(BODY_HITBOX_SIZE.x, bodyBaseSquareSize + BODY_HITBOX_SQUARE_PADDING);
  assert.ok(Math.abs(BODY_HITBOX_SIZE.y - (bodyBaseHeight * BODY_HITBOX_HEIGHT_SCALE)) < 1e-9);
  assert.equal(BODY_HITBOX_SIZE.z, (bodyBaseSquareSize + BODY_HITBOX_SQUARE_PADDING) * BODY_HITBOX_DEPTH_SCALE);
  assert.equal(HEAD_HITBOX_SIZE.x, (headBaseSquareSize + HEAD_HITBOX_SQUARE_PADDING) * HEAD_HITBOX_LINEAR_SCALE);
  assert.equal(HEAD_HITBOX_SIZE.z, (headBaseSquareSize + HEAD_HITBOX_SQUARE_PADDING) * HEAD_HITBOX_LINEAR_SCALE);
  assert.ok(
    Math.abs(
      HEAD_HITBOX_SIZE.y - (((AVATAR_HEAD_SIZE.y + HEAD_HITBOX_TOP_PADDING) * HEAD_HITBOX_LINEAR_SCALE) * HEAD_HITBOX_HEIGHT_SCALE)
    ) < 1e-9
  );
  assert.ok(Math.abs(headBottomY - bodyTopY) < 1e-9);
  assert.ok(headBottomY > primitiveHeadBottomY);
});

test('logical hitscan origin pushes forward from the eye by the shared muzzle offset', () => {
  assert.deepEqual(
    logicalHitscanOriginFromEye({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: -1 }),
    { x: 1, y: 2, z: 3 - HITSCAN_ORIGIN_FORWARD_OFFSET }
  );
});

test('logical muzzle origin pushes farther forward from the eye than the old hitscan origin', () => {
  assert.deepEqual(
    logicalMuzzleOriginFromEye({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: -1 }),
    { x: 1, y: 2, z: 3 - MUZZLE_ORIGIN_FORWARD_OFFSET }
  );
});

test('rolling combat hitboxes keep the body bottom anchored while hiding the head', () => {
  const hitboxes = buildCombatHitboxesFromFeetPosition(4, 3.25, -2, { rolling: true });
  const baseBodyBottomY = entityBodyHitboxYFromFeet(3.25) - (BODY_HITBOX_SIZE.y * 0.5);

  assert.equal(hitboxes.headBox, null);
  assert.equal(hitboxes.bodyBox.min.y, baseBodyBottomY);
  assert.ok(Math.abs((hitboxes.bodyBox.max.x - hitboxes.bodyBox.min.x) - (BODY_HITBOX_SIZE.x * ROLL_BODY_HITBOX_LINEAR_SCALE)) < 1e-9);
  assert.ok(Math.abs((hitboxes.bodyBox.max.y - hitboxes.bodyBox.min.y) - (BODY_HITBOX_SIZE.y * ROLL_BODY_HITBOX_LINEAR_SCALE)) < 1e-9);
  assert.ok(Math.abs((hitboxes.bodyBox.max.z - hitboxes.bodyBox.min.z) - (BODY_HITBOX_SIZE.z * ROLL_BODY_HITBOX_LINEAR_SCALE)) < 1e-9);
});
