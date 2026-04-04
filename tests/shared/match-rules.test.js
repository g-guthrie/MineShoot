import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MATCH_RESET_DELAY_MS,
  createMatchState,
  formatMatchHudCounter,
  formatWinnerLabel,
  targetProgressForGameMode
} from '../../shared/match-rules.js';

test('shared match rules centralize target progress and reset delay defaults', () => {
  assert.equal(targetProgressForGameMode('ffa'), 10);
  assert.equal(targetProgressForGameMode('tdm'), 10);
  assert.equal(MATCH_RESET_DELAY_MS, 5000);

  const tdmState = createMatchState('tdm');
  assert.equal(tdmState.gameMode, 'tdm');
  assert.equal(tdmState.targetProgress, 10);
  assert.deepEqual(tdmState.teamIds, ['alpha', 'bravo']);
});

test('shared match rules format ffa win progress and winner labels', () => {
  const matchState = {
    gameMode: 'ffa',
    started: true,
    ended: false,
    targetProgress: 10,
    leaderProgress: 6
  };
  const selfState = { id: 'u1', kills: 4, deaths: 1 };

  assert.equal(formatMatchHudCounter(matchState, selfState), 'Kills: 4 | Goal: 10 | Lead: 6');

  const ended = {
    gameMode: 'ffa',
    started: true,
    ended: true,
    resetAt: 14500,
    winnerId: 'u1'
  };
  assert.equal(formatWinnerLabel(ended, selfState), 'YOU');
});

test('shared match rules format tdm progress as team progress, not raw kills', () => {
  const matchState = {
    gameMode: 'tdm',
    started: true,
    ended: false,
    targetProgress: 10,
    teamProgress: {
      alpha: 4.5,
      bravo: 3
    }
  };
  const selfState = {
    id: 'u2',
    teamId: 'alpha',
    kills: 2,
    deaths: 3
  };

  assert.equal(
    formatMatchHudCounter(matchState, selfState),
    'Kills: 2 | Team: 4.5/10 | Opp: BRAVO 3'
  );
});

test('shared match rules use the leading opposing team in multi-team tdm summaries', () => {
  const matchState = {
    gameMode: 'tdm',
    started: true,
    ended: false,
    targetProgress: 10,
    teamIds: ['alpha', 'bravo', 'charlie', 'delta'],
    teamProgress: {
      alpha: 2,
      bravo: 3,
      charlie: 5,
      delta: 4
    }
  };
  const selfState = {
    id: 'u3',
    teamId: 'alpha',
    kills: 1,
    deaths: 2
  };

  assert.equal(
    formatMatchHudCounter(matchState, selfState),
    'Kills: 1 | Team: 2/10 | Opp: CHARLIE 5'
  );
});
