import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadViewModel() {
  const code = await fs.readFile(new URL('../../js/app/lobby-view-model.js', import.meta.url), 'utf8');
  const sandbox = {
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameLobbyViewModel;
}

function baseState(patch = {}) {
  return {
    activeSurface: 'main',
    paused: false,
    modeListOpen: false,
    socialToolsOpen: false,
    utilityOpen: false,
    confirmLeaveOpen: false,
    launch: {
      selectedMode: 'ffa',
      phase: 'idle',
      activityState: 'menu'
    },
    party: null,
    privateRoom: null,
    utilities: { isLoggedIn: false },
    ...patch
  };
}

test('menu view model keeps the default main menu minimal', async () => {
  const viewModel = await loadViewModel();
  const view = viewModel.build(baseState(), {
    normalizeMode(modeId) {
      return String(modeId || '').toLowerCase();
    }
  });

  assert.equal(view.menuContext, 'menu');
  assert.equal(view.headerVariant, 'home');
  assert.equal(view.header.accountToggleVisible, true);
  assert.equal(view.header.partyIdVisible, true);
  assert.equal(view.controls.socialToolsVisible, true);
  assert.equal(view.surfaces.mainScreenVisible, true);
  assert.equal(view.heroes.homeVisible, true);
  assert.equal(view.heroes.socialVisible, false);
  assert.equal(view.heroes.partyVisible, false);
  assert.equal(view.heroes.count, 1);
});

test('menu view model expands social and party heroes from explicit state only', async () => {
  const viewModel = await loadViewModel();
  const view = viewModel.build(baseState({
    socialToolsOpen: true,
    utilities: { isLoggedIn: true },
    party: {
      party: {
        members: [{ id: 'self' }, { id: 'friend' }]
      }
    }
  }));

  assert.equal(view.header.accountToggleVisible, false);
  assert.equal(view.controls.socialToolsVisible, true);
  assert.equal(view.showSocialTools, true);
  assert.equal(view.heroes.homeVisible, true);
  assert.equal(view.heroes.socialVisible, true);
  assert.equal(view.heroes.partyVisible, true);
  assert.equal(view.heroes.count, 3);
});

test('menu view model makes private room flow a distinct room surface', async () => {
  const viewModel = await loadViewModel();
  const view = viewModel.build(baseState({
    activeSurface: 'room',
    launch: {
      selectedMode: 'tdm',
      phase: 'idle',
      activityState: 'private_room_lobby'
    },
    privateRoom: {
      room: { roomId: 'private-room1' }
    }
  }));

  assert.equal(view.headerVariant, 'room');
  assert.equal(view.header.partyBackVisible, true);
  assert.equal(view.header.roomActionVisible, false);
  assert.equal(view.surfaces.menuBodyVisible, true);
  assert.equal(view.surfaces.mainScreenVisible, false);
  assert.equal(view.surfaces.roomScreenVisible, true);
  assert.equal(view.phoneLandscapeRequired, true);
});

test('menu view model collapses regular screens for active match shell', async () => {
  const viewModel = await loadViewModel();
  const view = viewModel.build(baseState({
    paused: true,
    launch: {
      selectedMode: 'ffa',
      phase: 'paused',
      activityState: 'paused'
    }
  }));

  assert.equal(view.menuContext, 'active-match');
  assert.equal(view.headerVariant, 'pause');
  assert.equal(view.header.partyIdVisible, false);
  assert.equal(view.controls.primaryLaunchDisabled, true);
  assert.equal(view.surfaces.menuBodyVisible, false);
  assert.equal(view.surfaces.loadoutBandVisible, true);
  assert.equal(view.session.visible, true);
  assert.equal(view.session.phase, 'paused');
  assert.equal(view.phoneLandscapeRequired, true);
});

test('menu view model forces invite surfaces visible without showing the social toggle', async () => {
  const viewModel = await loadViewModel();
  const view = viewModel.build(baseState({
    party: {
      directInvite: {
        incoming: { actorId: 'friend-1' }
      }
    }
  }));

  assert.equal(view.socialMustShow, true);
  assert.equal(view.showSocialTools, true);
  assert.equal(view.controls.socialToolsVisible, false);
  assert.equal(view.heroes.socialVisible, true);
  assert.equal(view.heroes.count, 2);
});
