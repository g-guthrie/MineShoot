import test from 'node:test';
import assert from 'node:assert/strict';

import { ASSET_RECIPES } from '../../shared/asset-recipes.js';

test('asset recipes cover every requested category with concrete example assets', () => {
  assert.deepEqual(Object.keys(ASSET_RECIPES), [
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
  ]);

  assert.deepEqual(Object.keys(ASSET_RECIPES.entity), ['zombie', 'pig', 'chest', 'door', 'boosterPad', 'portal']);
  assert.deepEqual(Object.keys(ASSET_RECIPES.misc), ['muzzleFlash', 'footstepMarks', 'bulletHole']);
  assert.deepEqual(Object.keys(ASSET_RECIPES.item), ['sword', 'axe', 'pickaxe', 'shield', 'fishingRod', 'potion']);
  assert.deepEqual(Object.keys(ASSET_RECIPES.block), ['dirt', 'wood', 'sand', 'grass', 'stone', 'iron', 'gold']);
  assert.deepEqual(Object.keys(ASSET_RECIPES.sound), ['themeSong', 'swordClash', 'punchHit', 'levelUpNoise', 'ambientWeather']);
  assert.deepEqual(Object.keys(ASSET_RECIPES.particle), ['smoke', 'dust', 'sparks', 'fire']);
  assert.deepEqual(Object.keys(ASSET_RECIPES.projectile), ['arrow', 'laser', 'fireball', 'bullet', 'flyingRock']);
  assert.deepEqual(Object.keys(ASSET_RECIPES.environment).slice(0, 5), ['rocks', 'grasses', 'flowers', 'swarmOfBugs', 'rubble']);
  assert.equal(Object.keys(ASSET_RECIPES.environment).length, 5);
  assert.deepEqual(Object.keys(ASSET_RECIPES.structure), ['fence', 'lightPole', 'sign']);
  assert.deepEqual(Object.keys(ASSET_RECIPES.ui), ['icon', 'image', 'background', 'font']);
  assert.deepEqual(ASSET_RECIPES.projectile.laser, {
    id: 'laser',
    label: 'Laser',
    referenceFamily: 'energy'
  });
  assert.equal(ASSET_RECIPES.particle.steam, undefined);
  assert.equal(ASSET_RECIPES.vehicle, undefined);
  assert.equal(Object.keys(ASSET_RECIPES.structure).length, 3);
});
