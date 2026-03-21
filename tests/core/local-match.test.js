import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadLocalMatch(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../../js/core/local-match.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        matchRules: {
          teamAlpha: 'alpha',
          teamBravo: 'bravo',
          matchResetDelayMs: 5000,
          targetProgressForGameMode(mode) {
            return String(mode) === 'tdm' ? 10 : (String(mode) === 'ffa' ? 10 : 0);
          },
          createMatchState(gameMode) {
            return {
              gameMode,
              started: false,
              ended: false,
              startedAt: 0,
              endedAt: 0,
              resetAt: 0,
              matchBaselinePlayerCount: 0,
              targetProgress: String(gameMode) === 'tdm' ? 10 : (String(gameMode) === 'ffa' ? 10 : 0),
              leaderProgress: 0,
              leaderId: '',
              winnerId: '',
              winnerTeam: '',
              teamProgress: { alpha: 0, bravo: 0 },
              teamBaselineSize: { alpha: 0, bravo: 0 }
            };
          }
        }
      },
      ...runtimeOverrides
    },
    globalThis: null,
    console,
    Date,
    Map,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameLocalMatch;
}

test('local match supports basic tdm progression instead of collapsing to ffa', async () => {
  const localMatch = await loadLocalMatch();
  localMatch.init({ gameMode: 'tdm' });

  const enemyBravo = { index: 0, displayName: 'BRAVO_1' };
  const enemyAlpha = { index: 1, displayName: 'ALPHA_2' };
  localMatch.registerEnemy(enemyBravo);
  localMatch.registerEnemy(enemyAlpha);

  let state = localMatch.getMatchState();
  let self = localMatch.getSelfState();
  assert.equal(state.gameMode, 'tdm');
  assert.equal(self.teamId, 'alpha');
  assert.equal(state.teamBaselineSize.alpha, 2);
  assert.equal(state.teamBaselineSize.bravo, 1);

  localMatch.onEnemyKilled(enemyBravo);
  state = localMatch.getMatchState();
  self = localMatch.getSelfState();
  assert.equal(state.teamProgress.alpha, 0.5);
  assert.equal(self.progressScore, 0.5);

  localMatch.onSelfKilled(enemyBravo);
  state = localMatch.getMatchState();
  assert.equal(state.teamProgress.bravo, 1);
  assert.equal(state.ended, false);
});
