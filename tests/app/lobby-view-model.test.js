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
  assert.equal(view.feedback.menu, null);
  assert.equal(view.feedback.roomAccess, null);
  assert.equal(view.activeMatch, null);
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
  assert.equal(view.primaryBanner.kind, 'invite');
  assert.equal(view.primaryBanner.incomingInvite.actorId, 'friend-1');
});

test('menu view model owns visible status routing for room access and social feedback', async () => {
  const viewModel = await loadViewModel();
  const view = viewModel.build(baseState({
    roomStatus: { text: 'Room not found.', error: true },
    partyStatus: { text: 'Party joined.', error: false },
    party: {
      directInvite: {
        outgoing: { displayName: 'BRAVO' }
      }
    }
  }));

  assert.equal(view.feedback.menu, null);
  assert.equal(view.feedback.roomAccess.text, 'Room not found.');
  assert.equal(view.feedback.roomAccess.error, true);
  assert.equal(view.feedback.social.text, 'Joined friend.');
  assert.equal(view.feedback.social.error, false);
});

test('menu view model suppresses local-only social backend noise', async () => {
  const viewModel = await loadViewModel();
  const view = viewModel.build(baseState({
    friendsStatus: { text: 'Friends endpoint offline. Retrying...', error: true }
  }), {
    isLocalEnvironment: true
  });

  assert.equal(view.feedback.menu.text, 'Friends endpoint offline. Retrying...');
  assert.equal(view.feedback.menu.error, true);
  assert.equal(view.feedback.social, null);
});

test('menu view model builds active match pills and critical banners without renderer help', async () => {
  const viewModel = await loadViewModel();
  const view = viewModel.build(baseState({
    paused: true,
    launch: {
      selectedMode: 'tdm',
      phase: 'paused',
      activityState: 'paused'
    },
    matchMenu: {
      ready: true,
      banner: {
        kind: 'critical',
        title: 'Connection lost',
        detail: 'Reconnecting'
      },
      modePill: { label: 'MODE', value: 'Team Death Match' },
      contextPill: { label: 'LEAD', value: '7' },
      primaryPill: { label: 'KILLS', value: '12' },
      secondaryPill: { label: 'DEATHS', value: '3' }
    }
  }));

  assert.equal(view.primaryBanner.kind, 'critical');
  assert.equal(view.activeMatch.primaryBanner.title, 'Connection lost');
  assert.equal(view.activeMatch.modePill.label, 'MODE');
  assert.equal(view.activeMatch.modePill.value, 'Team Death Match');
  assert.equal(view.activeMatch.modePill.tone, 'default');
  assert.equal(view.activeMatch.secondaryPill.label, 'DEATHS');
  assert.equal(view.activeMatch.secondaryPill.value, '3');
  assert.equal(view.activeMatch.secondaryPill.tone, 'default');
});

test('menu view model does not let stale match banners hide live menu invites', async () => {
  const viewModel = await loadViewModel();
  const view = viewModel.build(baseState({
    matchMenu: {
      ready: true,
      banner: {
        kind: 'critical',
        title: 'Old match warning',
        detail: 'Stale'
      }
    },
    party: {
      roomInvite: {
        incoming: {
          roomId: 'room-1',
          roomCode: 'ABCD12'
        }
      }
    }
  }));

  assert.equal(view.activeMatch, null);
  assert.equal(view.primaryBanner.kind, 'invite');
  assert.equal(view.primaryBanner.incomingRoomInvite.roomCode, 'ABCD12');
});
