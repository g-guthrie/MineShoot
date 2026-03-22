import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getGameModeCatalog,
  getGameModeLabel,
  getQuickPlayGameModes,
  getDefaultGameMode,
  normalizeGameMode
} from '../shared/game-modes.js';

test('game mode catalog exposes the shipped rule sets in a stable order', () => {
  const modes = getGameModeCatalog();
  assert.deepEqual(modes.map((mode) => mode.id), ['ffa', 'tdm']);
  assert.equal(modes[0].primaryQuickPlay, true);
});

test('quick-play exposes the shipped playable modes', () => {
  const quickModes = getQuickPlayGameModes();

  assert.deepEqual(quickModes.map((mode) => mode.id), ['ffa', 'tdm']);
});

test('game mode normalization preserves supported ids and falls back safely', () => {
  assert.equal(getDefaultGameMode(), 'ffa');
  assert.equal(normalizeGameMode('tdm'), 'tdm');
  assert.equal(normalizeGameMode('unknown'), 'ffa');
  assert.equal(getGameModeLabel('ffa'), 'Free For All');
  assert.equal(getGameModeLabel('tdm'), 'Team Death Match');
});
