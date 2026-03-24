import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadMatchViewHarness(overrides = {}) {
  const code = await fs.readFile(new URL('../../js/app/runtime-match-view.js', import.meta.url), 'utf8');
  const events = [];
  const runtime = {};
  const windowObj = {
    dispatchEvent(event) {
      events.push(event);
      return true;
    }
  };
  const sandbox = {
    window: windowObj,
    CustomEvent: class FakeCustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    globalThis: {
      __MAYHEM_RUNTIME: runtime
    }
  };

  vm.runInContext(code, vm.createContext(sandbox));
  const factory = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeMatchView;
  const api = factory.create({
    getCurrentMatchViewApi() {
      return overrides.matchViewApi || null;
    },
    getCurrentSelfCombatApi() {
      return overrides.selfCombatApi || null;
    },
    getSharedMatchRules() {
      return overrides.matchRules || null;
    },
    getRuntimeShell() {
      return overrides.runtimeShell || null;
    },
    getGameSession() {
      return overrides.gameSession || null;
    },
    getGameUiApi() {
      return overrides.gameUiApi || null;
    },
    isMultiplayerMode() {
      return overrides.multiplayerMode !== undefined ? !!overrides.multiplayerMode : true;
    },
    isRuntimeInitialized() {
      return overrides.runtimeInitialized !== undefined ? !!overrides.runtimeInitialized : true;
    },
    getNowMs() {
      return overrides.nowMs !== undefined ? Number(overrides.nowMs || 0) : 1000;
    }
  });

  return { api, events };
}

test('runtime match view reads authoritative match and self state from the injected match view api', async () => {
  const matchViewApi = {
    getMatchState() {
      return { started: true, gameMode: 'ffa' };
    },
    getAuthoritativeSelfState() {
      return { id: 'usr_test', alive: true, kills: 4 };
    },
    getPrivateRoomPhase() {
      return 'in_match';
    }
  };
  const harness = await loadMatchViewHarness({
    multiplayerMode: true,
    matchViewApi,
    selfCombatApi: {
      getRespawnState() {
        return { active: false, remainingMs: 0 };
      }
    }
  });

  const context = harness.api.readMatchContext();
  assert.equal(context.api, matchViewApi);
  assert.deepEqual(JSON.parse(JSON.stringify(context.matchState)), { started: true, gameMode: 'ffa' });
  assert.deepEqual(JSON.parse(JSON.stringify(context.selfState)), { id: 'usr_test', alive: true, kills: 4 });
  assert.deepEqual(JSON.parse(JSON.stringify(context.respawnState)), { active: false, remainingMs: 0 });
  assert.equal(context.privateRoomPhase, 'in_match');
});

test('runtime match view emits a structured paused match model for the menu shell', async () => {
  let resumeVisible = null;
  let updatedMatchStatus = null;
  const harness = await loadMatchViewHarness({
    nowMs: 1000,
    gameSession: {
      isPlaying() {
        return false;
      },
      getPauseState() {
        return { active: true, reason: 'idle' };
      },
      setResumeButtonsVisible(value) {
        resumeVisible = !!value;
      }
    },
    gameUiApi: {
      updateMatchStatus(matchState, selfState) {
        updatedMatchStatus = { matchState, selfState };
      }
    }
  });

  harness.api.syncMatchHud({
    matchState: { gameMode: 'ffa', started: true, ended: false },
    selfState: { id: 'usr_test', kills: 2, deaths: 1 }
  });

  assert.deepEqual(updatedMatchStatus, {
    matchState: { gameMode: 'ffa', started: true, ended: false },
    selfState: { id: 'usr_test', kills: 2, deaths: 1 }
  });
  assert.equal(resumeVisible, false);
  assert.equal(harness.events.length, 1);
  assert.equal(harness.events[0].type, 'mayhem-menu-match-model');
  assert.deepEqual(JSON.parse(JSON.stringify(harness.events[0].detail)), {
    ready: true,
    banner: {
      kind: 'critical',
      tone: 'critical',
      title: 'IDLE TIMEOUT',
      detail: 'Connection closed to limit Cloudflare traffic.'
    },
    modePill: { label: 'MODE', value: 'Free For All' },
    contextPill: { label: 'STATE', value: 'DISCONNECTED' },
    primaryPill: { label: 'STATUS', value: 'DISCONNECTED' },
    secondaryPill: { label: 'DETAIL', value: 'CLOUDFLARE LIMIT' }
  });
});

test('runtime match view uses last-man-standing language for FFA stock-mode summaries', async () => {
  const harness = await loadMatchViewHarness();

  assert.equal(harness.api.objectiveSummary({
    gameMode: 'ffa',
    stockMode: true,
    aliveCount: 1,
    targetProgress: 10
  }, {
    stocksRemaining: 2,
    maxStocks: 5
  }), 'LAST STANDING | ALIVE 1 | LIVES 2');
});

test('runtime match view menu model shows raw lives remaining instead of stock cap', async () => {
  let resumeVisible = null;
  const harness = await loadMatchViewHarness({
    nowMs: 1000,
    gameSession: {
      isPlaying() {
        return false;
      },
      getPauseState() {
        return { active: false };
      },
      canResumeGameplay() {
        return true;
      },
      setResumeButtonsVisible(value) {
        resumeVisible = !!value;
      }
    },
    gameUiApi: {
      updateMatchStatus() {}
    }
  });

  harness.api.syncMatchHud({
    matchState: { gameMode: 'ffa', started: true, ended: false, stockMode: true, aliveCount: 3 },
    selfState: { id: 'usr_test', stocksRemaining: 3, maxStocks: 5, extraLifeProgressPct: 40, kills: 0, deaths: 0 }
  });

  assert.equal(resumeVisible, true);
  assert.equal(harness.events.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.events[0].detail.primaryPill)), {
    label: 'LIVES',
    value: '3'
  });
});
