/**
 * shared/asset-recipes.js - Procedural asset recipe catalog based on the HYTOPIA example list.
 * Kept data-only so gameplay/UI runtimes can consume the same canonical ids.
 */

export const ASSET_RECIPES = {
  entity: {
    zombie: { id: 'zombie', label: 'Zombie', referenceFamily: 'npc' },
    pig: { id: 'pig', label: 'Pig', referenceFamily: 'pet' },
    chest: { id: 'chest', label: 'Chest', referenceFamily: 'interactable' },
    door: { id: 'door', label: 'Door', referenceFamily: 'interactable' },
    boosterPad: { id: 'boosterPad', label: 'Booster Pad', referenceFamily: 'utility' },
    portal: { id: 'portal', label: 'Portal', referenceFamily: 'utility' }
  },
  misc: {
    muzzleFlash: { id: 'muzzleFlash', label: 'Muzzle Flash', referenceFamily: 'fx' },
    footstepMarks: { id: 'footstepMarks', label: 'Footstep Marks', referenceFamily: 'decal' },
    bulletHole: { id: 'bulletHole', label: 'Bullet Hole', referenceFamily: 'decal' }
  },
  item: {
    sword: { id: 'sword', label: 'Sword', referenceFamily: 'weapon' },
    axe: { id: 'axe', label: 'Axe', referenceFamily: 'tool' },
    pickaxe: { id: 'pickaxe', label: 'Pickaxe', referenceFamily: 'tool' },
    shield: { id: 'shield', label: 'Shield', referenceFamily: 'defense' },
    fishingRod: { id: 'fishingRod', label: 'Fishing Rod', referenceFamily: 'tool' },
    potion: { id: 'potion', label: 'Potion', referenceFamily: 'consumable' }
  },
  block: {
    dirt: { id: 'dirt', label: 'Dirt', referenceFamily: 'terrain' },
    wood: { id: 'wood', label: 'Wood', referenceFamily: 'terrain' },
    sand: { id: 'sand', label: 'Sand', referenceFamily: 'terrain' },
    grass: { id: 'grass', label: 'Grass', referenceFamily: 'terrain' },
    stone: { id: 'stone', label: 'Stone', referenceFamily: 'terrain' },
    iron: { id: 'iron', label: 'Iron', referenceFamily: 'ore' },
    gold: { id: 'gold', label: 'Gold', referenceFamily: 'ore' }
  },
  sound: {
    themeSong: { id: 'themeSong', label: 'Theme Song', referenceFamily: 'music' },
    swordClash: { id: 'swordClash', label: 'Sword Clash', referenceFamily: 'sfx' },
    punchHit: { id: 'punchHit', label: 'Punch Hit', referenceFamily: 'sfx' },
    levelUpNoise: { id: 'levelUpNoise', label: 'Level Up Noise', referenceFamily: 'ui' },
    ambientWeather: { id: 'ambientWeather', label: 'Ambient Weather', referenceFamily: 'ambient' }
  },
  particle: {
    smoke: { id: 'smoke', label: 'Smoke', referenceFamily: 'fx' },
    dust: { id: 'dust', label: 'Dust', referenceFamily: 'fx' },
    sparks: { id: 'sparks', label: 'Sparks', referenceFamily: 'fx' },
    fire: { id: 'fire', label: 'Fire', referenceFamily: 'fx' }
  },
  projectile: {
    arrow: { id: 'arrow', label: 'Arrow', referenceFamily: 'ammo' },
    laser: { id: 'laser', label: 'Laser', referenceFamily: 'energy' },
    fireball: { id: 'fireball', label: 'Fireball', referenceFamily: 'magic' },
    bullet: { id: 'bullet', label: 'Bullet', referenceFamily: 'ammo' },
    flyingRock: { id: 'flyingRock', label: 'Flying Rock', referenceFamily: 'improvised' }
  },
  environment: {
    rocks: { id: 'rocks', label: 'Rocks', referenceFamily: 'set-dressing' },
    grasses: { id: 'grasses', label: 'Grasses', referenceFamily: 'set-dressing' },
    flowers: { id: 'flowers', label: 'Flowers', referenceFamily: 'set-dressing' },
    swarmOfBugs: { id: 'swarmOfBugs', label: 'Swarm of Bugs', referenceFamily: 'ambient-life' },
    rubble: { id: 'rubble', label: 'Rubble', referenceFamily: 'set-dressing' }
  },
  structure: {
    fence: { id: 'fence', label: 'Fence', referenceFamily: 'architecture' },
    lightPole: { id: 'lightPole', label: 'Light Pole', referenceFamily: 'architecture' },
    sign: { id: 'sign', label: 'Sign', referenceFamily: 'architecture' }
  },
  ui: {
    icon: { id: 'icon', label: 'Icon', referenceFamily: 'hud' },
    image: { id: 'image', label: 'Image', referenceFamily: 'hud' },
    background: { id: 'background', label: 'Background', referenceFamily: 'hud' },
    font: { id: 'font', label: 'Font', referenceFamily: 'hud' }
  }
};

export const assetRecipes = {
  definitions: ASSET_RECIPES
};

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.assetRecipes = assetRecipes;
