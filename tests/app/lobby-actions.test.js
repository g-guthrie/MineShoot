import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadLobbyActionsHarness(options = {}) {
  const code = await fs.readFile(new URL('../../js/app/lobby-actions.js', import.meta.url), 'utf8');

  const state = {
    launch: { selectedMode: options.selectedMode || 'ffa', phase: '', message: '', error: false },
    loadout: {
      validation: options.validation || { ok: true, message: '' }
    }
  };
  const busyStates = [];

  const sandbox = {
    console,
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };

  vm.runInContext(code, vm.createContext(sandbox));

  const actions = sandbox.globalThis.__MAYHEM_RUNTIME.GameLobbyActions.create({
    getState() {
      return state;
    },
    setBusy(value) {
      busyStates.push(!!value);
    },
    render() {},
    normalizeMode(modeId) {
      return String(modeId || '');
    },
    modeLabel(modeId) {
      return String(modeId || '').toUpperCase();
    },
    currentPartyIdentity() {
      return { id: 'usr_alpha', username: 'ALPHA' };
    },
    setLaunchState(patch) {
      state.launch = { ...state.launch, ...(patch || {}) };
    },
    syncLoadoutState() {},
    launchModeById() {
      return { ok: true, mode: { roomId: 'ffa-01', gameMode: 'ffa' } };
    },
    getSessionApi() {
      return null;
    },
    roomCodeFromRoomId(roomId) {
      return String(roomId || '').toUpperCase();
    },
    lobbyApi: options.lobbyApi
  });

  return {
    actions,
    state,
    busyStates
  };
}

test('launchGame returns a thenable when validation fails', async () => {
  const harness = await loadLobbyActionsHarness({
    validation: { ok: false, message: 'Choose a primary weapon.' }
  });

  const result = harness.actions.launchGame('ffa');

  assert.equal(typeof result.then, 'function');
  await assert.doesNotReject(async () => {
    const resolved = await result.then(function (value) {
      return value;
    });
    assert.equal(resolved, false);
  });
  assert.equal(harness.state.launch.phase, 'error');
  assert.equal(harness.state.launch.message, 'Choose a primary weapon.');
});

test('launchGame handles missing matchmaking api without throwing', async () => {
  const harness = await loadLobbyActionsHarness({
    lobbyApi: {}
  });

  const resolved = await harness.actions.launchGame('ffa');

  assert.equal(resolved, false);
  assert.equal(harness.state.launch.phase, 'error');
  assert.equal(harness.state.launch.message, 'Matchmaking unavailable.');
  assert.deepEqual(harness.busyStates, [true, false]);
});
