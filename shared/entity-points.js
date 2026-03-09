import {
  EYE_HEIGHT,
  BODY_HITBOX_CENTER_OFFSET_Y,
  HEAD_HITBOX_CENTER_OFFSET_Y
} from './entity-constants.js';

export const ENTITY_AIM_TARGET_OFFSET_Y = 1.0;
export const DAMAGE_POINT_OFFSET_Y = 1.06;
export const MARKER_POINT_OFFSET_Y = 2.25;

export function entityFeetY(entityY) {
  return Number(entityY || EYE_HEIGHT) - EYE_HEIGHT;
}

export function entityAimTargetY(entityY) {
  return entityFeetY(entityY) + ENTITY_AIM_TARGET_OFFSET_Y;
}

export function entityBodyHitboxY(entityY) {
  return entityFeetY(entityY) + BODY_HITBOX_CENTER_OFFSET_Y;
}

export function entityHeadHitboxY(entityY) {
  return entityFeetY(entityY) + HEAD_HITBOX_CENTER_OFFSET_Y;
}

export function entityDamagePointY(entityY) {
  return entityFeetY(entityY) + DAMAGE_POINT_OFFSET_Y;
}

export function entityMarkerPointY(entityY) {
  return entityFeetY(entityY) + MARKER_POINT_OFFSET_Y;
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.entityPoints = {
  ENTITY_AIM_TARGET_OFFSET_Y,
  DAMAGE_POINT_OFFSET_Y,
  MARKER_POINT_OFFSET_Y,
  entityFeetY,
  entityAimTargetY,
  entityBodyHitboxY,
  entityHeadHitboxY,
  entityDamagePointY,
  entityMarkerPointY
};
