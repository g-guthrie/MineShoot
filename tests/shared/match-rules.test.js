import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MATCH_RESET_DELAY_MS,
  createMatchState,
  formatMatchHudCounter,
  formatMenuMatchStats,
  formatMenuMatchStatus,
  formatWinnerLabel,
  targetProgressForGameMode
} from '../../shared/match-rules.js';

test('shared match rules centralize target progress and reset delay defaults', () => {
  assert.equal(targetProgressForGameMode('ffa'), 10);
  assert.equal(targetProgressForGameMode('tdm'), 10);
  assert.equal(targetProgressForGameMode('lms'), 0);
  assert.equal(MATCH_RESET_DELAY_MS, 5000);

  const lmsState = createMatchState('lms');
  assert.equal(lmsState.gameMode, 'lms');
  assert.equal(lmsState.targetProgress, 0);
  assert.equal(typeof lmsState.lms, 'object');
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
  assert.equal(formatMenuMatchStats(matchState, selfState), 'KILLS 4 | DEATHS 1');

  const ended = {
    gameMode: 'ffa',
    started: true,
    ended: true,
    resetAt: 14500,
    winnerId: 'u1'
  };
  assert.equal(formatWinnerLabel(ended, selfState), 'YOU');
  assert.equal(
    formatMenuMatchStatus(ended, selfState, { nowMs: () => 9500 }),
    'YOU WON | RESET 5.0s'
  );
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
    'Kills: 2 | Team: 4.5/10 | Enemy: 3'
  );
  assert.equal(
    formatMenuMatchStatus(matchState, selfState),
    'TDM TEAM 4.5 / 10 | ENEMY 3'
  );
});

test('shared match rules format lms lives, charge, and beacon state', () => {
  const matchState = {
    gameMode: 'lms',
    started: true,
    ended: false,
    lms: {
      chargePerExtraLife: 2,
      remainingPlayers: 3,
      activeBeacon: { label: 'B2' },
      nextRotateAt: 12000
    }
  };
  const selfState = {
    id: 'u3',
    lmsLives: 1,
    lmsCharge: 1
  };

  assert.equal(
    formatMatchHudCounter(matchState, selfState),
    'Lives: 1 | Charge: 1/2 | Left: 3'
  );
  assert.equal(
    formatMenuMatchStatus(matchState, selfState, { nowMs: () => 7000 }),
    'LMS 1 LIFE | CHARGE 1/2 | LEFT 3 | BEACON B2 5.0s'
  );

  const outState = {
    id: 'u3',
    lmsLives: 0,
    lmsCharge: 0,
    outOfRound: true
  };
  assert.equal(
    formatMatchHudCounter(matchState, outState),
    'OUT | Left: 3'
  );
  assert.equal(
    formatMenuMatchStatus(matchState, outState, { nowMs: () => 7000 }),
    'OUT OF ROUND | LEFT 3'
  );
});
