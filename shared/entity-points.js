import {
  EYE_HEIGHT,
  BODY_HITBOX_CENTER_OFFSET_Y,
  HEAD_HITBOX_CENTER_OFFSET_Y
} from './entity-constants.js';

export const ENTITY_AIM_TARGET_OFFSET_Y = 1.0;
export const DAMAGE_POINT_OFFSET_Y = 1.06;
export const MARKER_POINT_OFFSET_Y = 2.25;
export const HITSCAN_ORIGIN_FORWARD_OFFSET = 0.35;

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
  entityFeetY,
  entityAimTargetY,
  entityBodyHitboxYFromFeet,
  entityHeadHitboxYFromFeet,
  entityBodyHitboxY,
  entityHeadHitboxY,
  entityDamagePointY,
  entityMarkerPointYFromFeet,
  entityMarkerPointY,
  logicalHitscanOriginFromEye
};
