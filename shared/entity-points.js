import {
  EYE_HEIGHT,
  BODY_HITBOX_SIZE,
  HEAD_HITBOX_SIZE,
  BODY_HITBOX_CENTER_OFFSET_Y,
  HEAD_HITBOX_CENTER_OFFSET_Y
} from './entity-constants.js';

export const ENTITY_AIM_TARGET_OFFSET_Y = 1.0;
export const DAMAGE_POINT_OFFSET_Y = 1.06;
export const MARKER_POINT_OFFSET_Y = 2.25;
export const HITSCAN_ORIGIN_FORWARD_OFFSET = 0.35;
export const ROLL_BODY_HITBOX_VOLUME_SCALE = 0.1875;
export const ROLL_BODY_HITBOX_LINEAR_SCALE = Math.cbrt(ROLL_BODY_HITBOX_VOLUME_SCALE);

export function entityFeetY(entityY) {
  return Number(entityY || EYE_HEIGHT) - EYE_HEIGHT;
}

export function entityAimTargetY(entityY) {
  return entityFeetY(entityY) + ENTITY_AIM_TARGET_OFFSET_Y;
}

export function entityBodyHitboxYFromFeet(feetY) {
  return Number(feetY || 0) + BODY_HITBOX_CENTER_OFFSET_Y;
}

export function entityHeadHitboxYFromFeet(feetY) {
  return Number(feetY || 0) + HEAD_HITBOX_CENTER_OFFSET_Y;
}

export function entityBodyHitboxY(entityY) {
  return entityBodyHitboxYFromFeet(entityFeetY(entityY));
}

export function entityHeadHitboxY(entityY) {
  return entityHeadHitboxYFromFeet(entityFeetY(entityY));
}

export function entityDamagePointY(entityY) {
  return entityFeetY(entityY) + DAMAGE_POINT_OFFSET_Y;
}

export function entityMarkerPointYFromFeet(feetY) {
  return Number(feetY || 0) + MARKER_POINT_OFFSET_Y;
}

export function entityMarkerPointY(entityY) {
  return entityMarkerPointYFromFeet(entityFeetY(entityY));
}

export function isRollStateActive(state, nowMs = Date.now()) {
  const startedAt = Math.max(0, Number(state && state.rollStartedAt || 0));
  const until = Math.max(0, Number(state && state.rollUntil || 0));
  const stamp = Math.max(0, Number(nowMs || 0));
  if (!(until > 0)) return false;
  if (startedAt > 0 && stamp < startedAt) return false;
  return until > stamp;
}

export function buildCombatHitboxesFromFeetPosition(x, feetY, z, options = {}) {
  const rolling = !!options.rolling;
  const bodyHalfX = (BODY_HITBOX_SIZE.x * 0.5) * (rolling ? ROLL_BODY_HITBOX_LINEAR_SCALE : 1);
  const bodyHalfY = (BODY_HITBOX_SIZE.y * 0.5) * (rolling ? ROLL_BODY_HITBOX_LINEAR_SCALE : 1);
  const bodyHalfZ = (BODY_HITBOX_SIZE.z * 0.5) * (rolling ? ROLL_BODY_HITBOX_LINEAR_SCALE : 1);
  const bodyBaseCenterY = entityBodyHitboxYFromFeet(feetY);
  const bodyBaseMinY = bodyBaseCenterY - (BODY_HITBOX_SIZE.y * 0.5);
  const bodyCenterY = bodyBaseMinY + bodyHalfY;
  const bodyBox = {
    min: { x: Number(x || 0) - bodyHalfX, y: bodyCenterY - bodyHalfY, z: Number(z || 0) - bodyHalfZ },
    max: { x: Number(x || 0) + bodyHalfX, y: bodyCenterY + bodyHalfY, z: Number(z || 0) + bodyHalfZ }
  };
  if (rolling) {
    return {
      bodyBox,
      headBox: null
    };
  }
  const headHalfX = HEAD_HITBOX_SIZE.x * 0.5;
  const headHalfY = HEAD_HITBOX_SIZE.y * 0.5;
  const headHalfZ = HEAD_HITBOX_SIZE.z * 0.5;
  const headCenterY = entityHeadHitboxYFromFeet(feetY);
  return {
    bodyBox,
    headBox: {
      min: { x: Number(x || 0) - headHalfX, y: headCenterY - headHalfY, z: Number(z || 0) - headHalfZ },
      max: { x: Number(x || 0) + headHalfX, y: headCenterY + headHalfY, z: Number(z || 0) + headHalfZ }
    }
  };
}

export function buildCombatHitboxesFromEntityPosition(entity, options = {}) {
  const source = entity && typeof entity === 'object' ? entity : {};
  const nowMs = Object.prototype.hasOwnProperty.call(options, 'nowMs') ? Number(options.nowMs || 0) : Date.now();
  const rolling = Object.prototype.hasOwnProperty.call(options, 'rolling')
    ? !!options.rolling
    : isRollStateActive(source, nowMs);
  return buildCombatHitboxesFromFeetPosition(
    Number(source.x || 0),
    entityFeetY(Number(source.y || EYE_HEIGHT)),
    Number(source.z || 0),
    { rolling }
  );
}

export function logicalHitscanOriginFromEye(eyePos, forward) {
  if (!eyePos || !forward) return null;
  return {
    x: Number(eyePos.x || 0) + (Number(forward.x || 0) * HITSCAN_ORIGIN_FORWARD_OFFSET),
    y: Number(eyePos.y || 0) + (Number(forward.y || 0) * HITSCAN_ORIGIN_FORWARD_OFFSET),
    z: Number(eyePos.z || 0) + (Number(forward.z || 0) * HITSCAN_ORIGIN_FORWARD_OFFSET)
  };
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.entityPoints = {
  ENTITY_AIM_TARGET_OFFSET_Y,
  DAMAGE_POINT_OFFSET_Y,
  MARKER_POINT_OFFSET_Y,
  HITSCAN_ORIGIN_FORWARD_OFFSET,
  ROLL_BODY_HITBOX_VOLUME_SCALE,
  ROLL_BODY_HITBOX_LINEAR_SCALE,
  entityFeetY,
  entityAimTargetY,
  entityBodyHitboxYFromFeet,
  entityHeadHitboxYFromFeet,
  entityBodyHitboxY,
  entityHeadHitboxY,
  entityDamagePointY,
  entityMarkerPointYFromFeet,
  entityMarkerPointY,
  isRollStateActive,
  buildCombatHitboxesFromFeetPosition,
  buildCombatHitboxesFromEntityPosition,
  logicalHitscanOriginFromEye
};
