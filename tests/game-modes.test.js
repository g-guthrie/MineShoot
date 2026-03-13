import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getGameModeCatalog,
  getQuickPlayGameModes,
  getDefaultGameMode,
  normalizeGameMode
} from '../shared/game-modes.js';

test('game mode catalog exposes the shipped rule sets in a stable order', () => {
  const modes = getGameModeCatalog();
  assert.deepEqual(modes.map((mode) => mode.id), ['ffa', 'tdm', 'lms']);
  assert.equal(modes[0].primaryQuickPlay, true);
});

test('quick-play exposes the shipped playable modes', () => {
  const quickModes = getQuickPlayGameModes();

  assert.deepEqual(quickModes.map((mode) => mode.id), ['ffa', 'tdm', 'lms']);
});

test('game mode normalization preserves supported ids and falls back safely', () => {
  assert.equal(getDefaultGameMode(), 'ffa');
  assert.equal(normalizeGameMode('tdm'), 'tdm');
  assert.equal(normalizeGameMode('lms'), 'lms');
  assert.equal(normalizeGameMode('unknown'), 'ffa');
});
