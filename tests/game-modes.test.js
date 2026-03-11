import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getGameModeCatalog,
  getQuickPlayGameModes,
  getSandboxGameModes,
  getDefaultGameMode,
  getDefaultSandboxGameMode,
  normalizeGameMode
} from '../shared/game-modes.js';

test('game mode catalog exposes the shipped rule sets in a stable order', () => {
  const modes = getGameModeCatalog();
  assert.deepEqual(modes.map((mode) => mode.id), ['ffa', 'tdm', 'lms']);
  assert.equal(modes[0].primaryQuickPlay, true);
});

test('quick-play and sandbox lists derive from the same catalog', () => {
  const quickModes = getQuickPlayGameModes();
  const sandboxModes = getSandboxGameModes();

  assert.deepEqual(quickModes.map((mode) => mode.id), ['ffa', 'tdm', 'lms']);
  assert.deepEqual(sandboxModes.map((mode) => mode.id), ['ffa', 'tdm', 'lms']);
});

test('game mode normalization preserves supported ids and falls back safely', () => {
  assert.equal(getDefaultGameMode(), 'ffa');
  assert.equal(getDefaultSandboxGameMode(), 'ffa');
  assert.equal(normalizeGameMode('tdm'), 'tdm');
  assert.equal(normalizeGameMode('lms', { allowSandboxOnly: true }), 'lms');
  assert.equal(normalizeGameMode('unknown'), 'ffa');
});
