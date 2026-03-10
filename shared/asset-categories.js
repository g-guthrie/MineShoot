/**
 * shared/asset-categories.js - Canonical asset taxonomy for importable tooling/UI use.
 * Mirrors HYTOPIA asset terminology while fitting this repo's shared-module style.
 */

export const ASSET_CATEGORY_ORDER = [
  'entity',
  'misc',
  'item',
  'block',
  'sound',
  'particle',
  'projectile',
  'environment',
  'structure',
  'ui'
];

export const ASSET_CATEGORY_DEFS = {
  entity: {
    id: 'entity',
    label: 'Entity',
    assetRoot: 'assets/models',
    summary: 'A non-block game object such as an NPC, an interactable chest, a door, or another gameplay object.',
    examples: ['Zombie', 'Pig', 'Chest', 'Door', 'Booster Pad', 'Portal']
  },
  misc: {
    id: 'misc',
    label: 'Misc',
    assetRoot: 'assets/models',
    summary: 'A misc. asset that falls outside the bounds of the other categories.',
    examples: ['Muzzle Flash', 'Footstep Marks', 'Bullet Hole']
  },
  item: {
    id: 'item',
    label: 'Item',
    assetRoot: 'assets/models',
    summary: 'A player-held object.',
    examples: ['Sword', 'Axe', 'Pickaxe', 'Shield', 'Fishing Rod', 'Potion']
  },
  block: {
    id: 'block',
    label: 'Block',
    assetRoot: 'assets/blocks',
    summary: 'A voxel cube that makes up the world terrain.',
    examples: ['Dirt', 'Wood', 'Sand', 'Grass', 'Stone', 'Iron', 'Gold']
  },
  sound: {
    id: 'sound',
    label: 'Sound',
    assetRoot: 'assets/audio',
    summary: 'Any sound-related asset such as music and sound effects.',
    examples: ['Theme Song', 'Sword Clash', 'Punch Hit', 'Level Up Noise', 'Ambient Weather']
  },
  particle: {
    id: 'particle',
    label: 'Particle',
    assetRoot: 'assets/models',
    summary: 'A 2D or, more rarely, 3D asset intended to be used as a particle effect.',
    examples: ['Smoke', 'Dust', 'Sparks', 'Fire']
  },
  projectile: {
    id: 'projectile',
    label: 'Projectile',
    assetRoot: 'assets/models',
    summary: 'A 2D or 3D asset intended to be used as a projectile.',
    examples: ['Arrows', 'Lasers', 'Fireballs', 'Bullets', 'Flying Rocks']
  },
  environment: {
    id: 'environment',
    label: 'Environment',
    assetRoot: 'assets/models',
    summary: 'An asset intended for environmental detail or visual enhancement.',
    examples: ['Rocks', 'Grasses', 'Flowers', 'Swarms of Bugs', 'Rubble']
  },
  structure: {
    id: 'structure',
    label: 'Structure',
    assetRoot: 'assets/models',
    summary: 'A non-block asset that makes up structures within the environment.',
    examples: ['Fences', 'Light Poles', 'Signs']
  },
  ui: {
    id: 'ui',
    label: 'UI',
    assetRoot: 'assets/ui',
    summary: 'Any asset intended to be used in the UI.',
    examples: ['Icons', 'Images', 'Backgrounds', 'Fonts']
  }
};

export const assetCategories = {
  order: ASSET_CATEGORY_ORDER,
  definitions: ASSET_CATEGORY_DEFS
};

export function normalizeAssetCategoryId(raw) {
  const categoryId = String(raw || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ASSET_CATEGORY_DEFS, categoryId) ? categoryId : '';
}

export function isAssetCategory(raw) {
  return !!normalizeAssetCategoryId(raw);
}

export function getAssetCategoryDef(categoryId) {
  const normalized = normalizeAssetCategoryId(categoryId);
  return normalized ? ASSET_CATEGORY_DEFS[normalized] : null;
}

export function getAssetCategoryDefs() {
  return ASSET_CATEGORY_ORDER.map((categoryId) => ASSET_CATEGORY_DEFS[categoryId]);
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.assetCategories = assetCategories;
