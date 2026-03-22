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
    },
    privateRoom: options.privateRoom || null
  };
  const busyStates = [];
  const roomStatuses = [];
  const activeSurfaces = [];
  const returnStates = [];

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
    setRoomStatus(text, isErr) {
      roomStatuses.push({ text: String(text || ''), isErr: !!isErr });
    },
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
    getSession() {
      return options.session || null;
    },
    setActiveSurface(surfaceId) {
      activeSurfaces.push(String(surfaceId || ''));
    },
    writeReturnState(payload) {
      returnStates.push(payload || {});
    },
    roomCodeFromRoomId(roomId) {
      return String(roomId || '').toUpperCase();
    },
    lobbyApi: options.lobbyApi
  });

  return {
    actions,
    state,
    busyStates,
    roomStatuses,
    activeSurfaces,
    returnStates
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

test('launchAssignedMatch falls back to the current selected mode without throwing', async () => {
  const harness = await loadLobbyActionsHarness({
    selectedMode: 'tdm'
  });

  assert.doesNotThrow(() => {
    harness.actions.launchAssignedMatch({
      self: {
        publicMatch: {
          roomId: 'ffa-01',
          gameMode: ''
        }
      }
    });
  });

  assert.equal(harness.state.launch.phase, 'joining');
  assert.equal(harness.state.launch.selectedMode, 'ffa');
  assert.equal(harness.returnStates[0].activeSurface, 'main');
  assert.equal(harness.returnStates[0].selectedMode, 'ffa');
});

test('handleRoomAction keeps the menu on the main surface when room creation fails', async () => {
  const harness = await loadLobbyActionsHarness({
    session: {
      createPrivateRoom() {
        return Promise.reject(new Error('Create failed.'));
      }
    }
  });

  const result = await harness.actions.handleRoomAction();

  assert.equal(result, false);
  assert.deepEqual(harness.activeSurfaces, []);
  assert.deepEqual(harness.roomStatuses[harness.roomStatuses.length - 1], {
    text: 'Create failed.',
    isErr: true
  });
});

test('leavePrivateRoom keeps the room surface active when the leave request resolves false', async () => {
  const harness = await loadLobbyActionsHarness({
    privateRoom: {
      room: {
        roomId: 'room-1'
      }
    },
    session: {
      leavePrivateRoom() {
        return Promise.resolve(false);
      }
    }
  });

  const result = await harness.actions.leavePrivateRoom();

  assert.equal(result, false);
  assert.deepEqual(harness.activeSurfaces, []);
  assert.deepEqual(harness.roomStatuses[harness.roomStatuses.length - 1], {
    text: 'Leave failed.',
    isErr: true
  });
});
