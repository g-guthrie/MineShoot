/**
 * shared/entity-constants.js - Canonical entity dimensions and defaults.
 * Used by client (player, enemy, network) and server.
 */

export var EYE_HEIGHT = 1.6;
export var PLAYER_RADIUS = 0.35;

export var DEFAULT_HP = 500;
export var DEFAULT_HP_MAX = 500;
export var DEFAULT_ARMOR = 90;
export var DEFAULT_ARMOR_MAX = 90;
export var ENEMY_HP = 500;
export var ENEMY_HP_MAX = 500;
export var ENEMY_ARMOR = 100;
export var ENEMY_ARMOR_MAX = 100;

export var HEAD_HITBOX_LINEAR_SCALE = Math.cbrt(0.7);
export var HEAD_HITBOX_SIZE = {
  x: 1.55 * HEAD_HITBOX_LINEAR_SCALE,
  y: 0.95 * HEAD_HITBOX_LINEAR_SCALE,
  z: 1.55 * HEAD_HITBOX_LINEAR_SCALE
};
export var BODY_HITBOX_SIZE = { x: 2.7, y: 1.525, z: 2.7 };
export var BODY_HITBOX_CENTER_OFFSET_Y = 0.7625;
export var HEAD_HITBOX_CENTER_OFFSET_Y = 2.0;

var runtime = (typeof globalThis !== 'undefined') ? globalThis : {};
runtime.__MAYHEM_RUNTIME = runtime.__MAYHEM_RUNTIME || {};
runtime.__MAYHEM_RUNTIME.GameShared = runtime.__MAYHEM_RUNTIME.GameShared || {};
runtime.__MAYHEM_RUNTIME.GameShared.entityConstants = {
  EYE_HEIGHT: EYE_HEIGHT,
  PLAYER_RADIUS: PLAYER_RADIUS,
  DEFAULT_HP: DEFAULT_HP,
  DEFAULT_HP_MAX: DEFAULT_HP_MAX,
  DEFAULT_ARMOR: DEFAULT_ARMOR,
  DEFAULT_ARMOR_MAX: DEFAULT_ARMOR_MAX,
  HEAD_HITBOX_LINEAR_SCALE: HEAD_HITBOX_LINEAR_SCALE,
  HEAD_HITBOX_SIZE: HEAD_HITBOX_SIZE,
  BODY_HITBOX_SIZE: BODY_HITBOX_SIZE,
  BODY_HITBOX_CENTER_OFFSET_Y: BODY_HITBOX_CENTER_OFFSET_Y,
  HEAD_HITBOX_CENTER_OFFSET_Y: HEAD_HITBOX_CENTER_OFFSET_Y
};
