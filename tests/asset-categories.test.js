import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ASSET_CATEGORY_ORDER,
  ASSET_CATEGORY_DEFS,
  getAssetCategoryDef,
  getAssetCategoryDefs,
  isAssetCategory,
  normalizeAssetCategoryId
} from '../shared/asset-categories.js';

test('asset categories preserve the canonical HYTOPIA taxonomy order', () => {
  assert.deepEqual(ASSET_CATEGORY_ORDER, [
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
});

test('asset categories expose labels, example assets, and storage roots', () => {
  assert.deepEqual(getAssetCategoryDef('entity'), {
    id: 'entity',
    label: 'Entity',
    assetRoot: 'assets/models',
    summary: 'A non-block game object such as an NPC, an interactable chest, a door, or another gameplay object.',
    examples: ['Zombie', 'Pig', 'Chest', 'Door', 'Booster Pad', 'Portal']
  });

  assert.equal(ASSET_CATEGORY_DEFS.block.assetRoot, 'assets/blocks');
  assert.equal(ASSET_CATEGORY_DEFS.sound.assetRoot, 'assets/audio');
  assert.equal(ASSET_CATEGORY_DEFS.ui.assetRoot, 'assets/ui');
  assert.deepEqual(ASSET_CATEGORY_DEFS.structure.examples, ['Fences', 'Light Poles', 'Signs']);
});

test('asset categories normalize ids and reject unknown values', () => {
  assert.equal(normalizeAssetCategoryId(' UI '), 'ui');
  assert.equal(normalizeAssetCategoryId('Projectile'), 'projectile');
  assert.equal(normalizeAssetCategoryId('vehicle'), '');
  assert.equal(isAssetCategory('sound'), true);
  assert.equal(isAssetCategory('vehicles'), false);
  assert.equal(getAssetCategoryDef('vehicles'), null);
});

test('asset category list helper returns ordered definitions', () => {
  const defs = getAssetCategoryDefs();
  assert.equal(defs.length, ASSET_CATEGORY_ORDER.length);
  assert.deepEqual(
    defs.map((entry) => entry.id),
    ASSET_CATEGORY_ORDER
  );
});
