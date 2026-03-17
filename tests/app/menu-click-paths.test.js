import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class FakeElement {
  constructor(tagName = 'div', id = '', ownerDocument = null) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.id = id || '';
    this.ownerDocument = ownerDocument;
    this.hidden = false;
    this.disabled = false;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.value = '';
    this.title = '';
    this.textContent = '';
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this.listeners = new Map();
    this.draggable = false;
    this._classSet = new Set();
    this.classList = {
      add: (...tokens) => tokens.forEach((token) => this._classSet.add(String(token || ''))),
      remove: (...tokens) => tokens.forEach((token) => this._classSet.delete(String(token || ''))),
      toggle: (token, force) => {
        const normalized = String(token || '');
        const next = force === undefined ? !this._classSet.has(normalized) : !!force;
        if (next) this._classSet.add(normalized);
        else this._classSet.delete(normalized);
        return next;
      },
      contains: (token) => this._classSet.has(String(token || ''))
    };
    Object.defineProperty(this, 'innerHTML', {
      get: () => '',
      set: () => {
        this.children = [];
        this.childNodes = this.children;
        this.textContent = '';
      }
    });
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    this.childNodes = this.children;
    return child;
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const next = this.listeners.get(key) || [];
    next.push(handler);
    this.listeners.set(key, next);
  }

  setAttribute(name, value) {
    this.attributes[String(name || '')] = String(value || '');
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
    return true;
  }

  click() {
    const handlers = this.listeners.get('click') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'click',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {}
      });
    }
  }

  keydown(event = {}) {
    const handlers = this.listeners.get('keydown') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'keydown',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        ...event
      });
    }
  }
}

async function loadHarness({ localEnvironment = false, loggedIn = true } = {}) {
  const code = await fs.readFile(new URL('../../js/app/lobby-controller.js', import.meta.url), 'utf8');

  const storageMap = new Map();
  const documentObj = {
    activeElement: null,
    elements: {},
    listeners: new Map(),
    getElementById(id) {
      return this.elements[String(id || '')] || null;
    },
    createElement(tagName) {
      return new FakeElement(tagName, '', this);
    },
    querySelectorAll(selector) {
      if (selector === '#mode-buttons .mode-btn[data-mode-id]') {
        return [this.elements['mode-local-multiplayer-btn']].filter(Boolean);
      }
      return [];
    },
    addEventListener(type, handler) {
      const key = String(type || '');
      const next = this.listeners.get(key) || [];
      next.push(handler);
      this.listeners.set(key, next);
    },
    dispatch(type, event = {}) {
      const handlers = this.listeners.get(String(type || '')) || [];
      for (const handler of handlers) {
        handler.call(this, {
          type,
          target: this,
          currentTarget: this,
          preventDefault() {},
          stopPropagation() {},
          ...event
        });
      }
    }
  };

  const ids = [
    ['div', 'menu-header'],
    ['div', 'menu-inline-toast'],
    ['div', 'menu-feedback'],
    ['button', 'menu-return-btn'],
    ['button', 'menu-party-id-btn'],
    ['span', 'menu-party-id-label'],
    ['span', 'menu-party-id-value'],
    ['input', 'party-id-input'],
    ['button', 'invite-friend-btn'],
    ['button', 'join-friend-btn'],
    ['div', 'social-hero-status'],
    ['div', 'social-direct-invite-banner'],
    ['div', 'social-direct-invite-copy'],
    ['button', 'social-direct-invite-accept-btn'],
    ['button', 'social-direct-invite-dismiss-btn'],
    ['div', 'menu-social-layout'],
    ['div', 'menu-social-friends-pane'],
    ['div', 'social-friends-list'],
    ['input', 'room-code-input'],
    ['button', 'join-room-btn'],
    ['button', 'party-back-btn'],
    ['button', 'account-toggle-btn'],
    ['button', 'utility-toggle-btn'],
    ['div', 'utility-overlay'],
    ['button', 'utility-close-btn'],
    ['div', 'utility-modal'],
    ['button', 'settings-account-btn'],
    ['button', 'open-manual-btn'],
    ['button', 'controls-toggle'],
    ['button', 'sound-toggle-btn'],
    ['button', 'alt-mode-toggle'],
    ['div', 'dev-overlay'],
    ['button', 'dev-close-btn'],
    ['div', 'mode-buttons'],
    ['button', 'mode-local-multiplayer-btn'],
    ['section', 'menu-screen-mode'],
    ['section', 'menu-screen-room'],
    ['div', 'menu-main-heroes'],
    ['div', 'menu-home-hero'],
    ['div', 'menu-social-hero'],
    ['div', 'menu-party-hero'],
    ['div', 'party-hero-members'],
    ['div', 'menu-social-actions'],
    ['div', 'menu-party-actions'],
    ['h1', 'mode-screen-title'],
    ['button', 'primary-launch-btn'],
    ['button', 'game-modes-toggle-btn'],
    ['div', 'play-mode-options'],
    ['button', 'play-mode-ffa-btn'],
    ['button', 'play-mode-tdm-btn'],
    ['button', 'play-mode-lms-btn'],
    ['button', 'practice-mode-btn'],
    ['div', 'room-access-status'],
    ['button', 'loadout-start-btn'],
    ['button', 'continue-loadout-btn'],
    ['div', 'menu-session-actions'],
    ['div', 'menu-session-stats'],
    ['div', 'menu-session-status'],
    ['div', 'menu-session-kd'],
    ['button', 'play-btn'],
    ['button', 'back-mode-btn'],
    ['div', 'leave-confirm-overlay'],
    ['button', 'leave-confirm-cancel-btn'],
    ['button', 'leave-confirm-accept-btn'],
    ['section', 'party-current-section'],
    ['section', 'party-room-section'],
    ['section', 'party-friends-section'],
    ['div', 'party-support-stack'],
    ['div', 'party-status'],
    ['button', 'party-join-lock-btn'],
    ['span', 'party-join-lock-icon'],
    ['span', 'party-join-lock-note'],
    ['button', 'party-hero-lock-btn'],
    ['button', 'party-hero-leave-btn'],
    ['div', 'private-room-status'],
    ['div', 'room-share-panel'],
    ['div', 'room-share-code'],
    ['button', 'copy-room-code-btn'],
    ['div', 'private-room-view'],
    ['div', 'private-room-summary'],
    ['button', 'private-room-mode-ffa-btn'],
    ['button', 'private-room-mode-tdm-btn'],
    ['button', 'private-room-mode-lms-btn'],
    ['button', 'private-room-teams-2-btn'],
    ['button', 'private-room-teams-3-btn'],
    ['button', 'private-room-teams-4-btn'],
    ['button', 'private-room-randomize-btn'],
    ['button', 'private-room-start-btn'],
    ['button', 'private-room-enter-btn'],
    ['div', 'private-room-unassigned'],
    ['div', 'private-room-team-alpha'],
    ['div', 'private-room-team-bravo'],
    ['div', 'private-room-team-charlie-wrap'],
    ['div', 'private-room-team-delta-wrap'],
    ['div', 'private-room-team-charlie'],
    ['div', 'private-room-team-delta']
  ];

  for (const [tag, id] of ids) {
    documentObj.elements[id] = new FakeElement(tag, id, documentObj);
  }

  documentObj.elements['utility-overlay'].hidden = true;
  documentObj.elements['leave-confirm-overlay'].hidden = true;
  documentObj.elements['menu-screen-room'].hidden = true;
  documentObj.elements['play-mode-options'].hidden = true;
  documentObj.elements['room-share-panel'].hidden = true;
  documentObj.elements['private-room-view'].hidden = true;
  documentObj.elements['private-room-enter-btn'].hidden = true;
  documentObj.elements['menu-session-actions'].hidden = true;
  documentObj.elements['menu-return-btn'].hidden = true;
  documentObj.elements['party-back-btn'].hidden = true;
  documentObj.elements['menu-party-hero'].hidden = true;
  documentObj.elements['social-direct-invite-banner'].hidden = true;
  documentObj.elements['menu-social-friends-pane'].hidden = !loggedIn;
  documentObj.elements['menu-inline-toast'].hidden = true;
  documentObj.elements['mode-local-multiplayer-btn'].dataset.modeId = 'single_dev_server';

  const runPartyActionCalls = [];
  const friendActionCalls = [];
  const launchCalls = [];
  const matchmakingCalls = [];
  const sessionCallbacks = {};
  const partyState = {
    self: { id: 'usr_alpha', username: 'ALPHA' },
    directInvite: {
      incoming: null,
      outgoing: null
    },
    party: {
      id: 'pty_alpha',
      leaderId: 'usr_alpha',
      joinLocked: false,
      isLeader: true,
      memberCount: 1,
      members: [{
        id: 'usr_alpha',
        displayName: 'ALPHA',
        isLeader: true,
        isAccount: true,
        accountUserId: 'usr_alpha',
        username: 'ALPHA'
      }]
    }
  };
  const friendsState = {
    friends: [{
      userId: 'usr_bravo',
      username: 'BRAVO',
      displayName: 'BRAVO',
      online: true,
      incomingInvite: false,
      outgoingInvite: false,
      joinLocked: false,
      sameParty: false,
      canJoin: true,
      canInvite: true,
      isMutual: true,
      activityState: 'menu'
    }]
  };
  const privateRoomState = {
    self: { actorId: 'usr_alpha', displayName: 'ALPHA', isHost: true },
    room: {
      roomId: 'private-room1',
      roomCode: 'ROOM1',
      roomMode: 'tdm',
      roomPhase: 'lobby',
      hostActorId: 'usr_alpha',
      memberCount: 1,
      teams: {
        alpha: [{ id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true }],
        bravo: []
      },
      members: [{ id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true }]
    }
  };

  const windowObj = {
    listeners: new Map(),
    localStorage: {
      getItem(key) {
        return storageMap.has(String(key || '')) ? storageMap.get(String(key || '')) : null;
      },
      setItem(key, value) {
        storageMap.set(String(key || ''), String(value || ''));
      },
      removeItem(key) {
        storageMap.delete(String(key || ''));
      }
    },
    sessionStorage: {
      getItem(key) {
        return storageMap.has('session:' + String(key || '')) ? storageMap.get('session:' + String(key || '')) : null;
      },
      setItem(key, value) {
        storageMap.set('session:' + String(key || ''), String(value || ''));
      },
      removeItem(key) {
        storageMap.delete('session:' + String(key || ''));
      }
    },
    addEventListener(type, handler) {
      const key = String(type || '');
      const next = this.listeners.get(key) || [];
      next.push(handler);
      this.listeners.set(key, next);
    },
    dispatchEvent(event) {
      const handlers = this.listeners.get(String(event && event.type || '')) || [];
      for (const handler of handlers) handler(event);
      return true;
    }
  };

  const runtime = {
    GameMenuState: {
      createStore(initialState) {
        let state = JSON.parse(JSON.stringify(initialState));
        return {
          getState() {
            return JSON.parse(JSON.stringify(state));
          },
          patchState(patch) {
            function merge(base, extra) {
              for (const key of Object.keys(extra || {})) {
                if (extra[key] && typeof extra[key] === 'object' && !Array.isArray(extra[key])) {
                  base[key] = merge(base[key] ? { ...base[key] } : {}, extra[key]);
                } else {
                  base[key] = extra[key];
                }
              }
              return base;
            }
            state = merge({ ...state }, patch || {});
          }
        };
      }
    },
    GameLobbyApi: {
      matchmakingPath() {
        return '/api/matchmaking';
      },
      requestJson(path, options) {
        matchmakingCalls.push({
          path: String(path || ''),
          body: options && options.body ? JSON.parse(String(options.body)) : null
        });
        return Promise.resolve({ roomId: 'ffa-01', gameMode: 'tdm', modeId: 'cloud_multiplayer' });
      }
    },
    GameNetAuth: {
      getPartyIdentity() {
        return loggedIn
          ? { id: 'usr_alpha', username: 'ALPHA', label: 'Player ID', kind: 'account' }
          : { id: 'gst_alpha', username: 'GUEST', label: 'Guest ID', kind: 'guest' };
      },
      isLoggedIn() {
        return !!loggedIn;
      },
      getUser() {
        return loggedIn ? { id: 'usr_alpha', username: 'ALPHA', displayName: 'ALPHA' } : null;
      }
    },
    GameMenuLoadout: {
      getRuntimeSnapshot() {
        return {
          weaponSlots: ['machinegun', 'shotgun'],
          abilityLoadout: { slot1: 'choke', slot2: 'missile' },
          selectedThrowableId: 'frag'
        };
      },
      validateSelections() {
        return { ok: true, message: '' };
      },
      subscribe() {
        return function () {};
      }
    },
    GameLobbyPrivateRoomView: {
      create(ctx) {
        return {
          applyState(nextState) {
            const room = nextState && nextState.room ? nextState.room : null;
            ctx.privateRoomSummaryEl.textContent = room ? `Room ${room.roomCode}` : '';
          }
        };
      }
    },
    GameLobbySession: {
      create(callbacks) {
        Object.assign(sessionCallbacks, callbacks);
        return {
          start() {},
          isBusy() {
            return false;
          },
          getCapabilities() {
            const room = privateRoomState.room;
            return {
              hasParty: true,
              partyMemberCount: partyState.party.memberCount,
              canTogglePartyJoinLock: true,
              partyJoinLocked: !!partyState.party.joinLocked,
              partyJoinLockTitle: 'Toggle party privacy.',
              partyJoinLockNote: partyState.party.joinLocked ? 'Party Closed' : 'Party Open',
              canLeaveParty: partyState.party.memberCount > 1,
              hasPrivateRoom: !!room,
              privateRoomPhase: room ? room.roomPhase : '',
              privateRoomMode: room ? room.roomMode : '',
              canEditPrivateRoom: !!room,
              canRandomizeTeams: !!room,
              canStartPrivateRoom: !!(room && room.roomPhase === 'lobby')
            };
          },
          runPartyAction(action, payload) {
            runPartyActionCalls.push({ action, payload: payload || {} });
            if (action === 'join') {
              const isAccount = String(payload.targetId || '').startsWith('usr_');
              partyState.party.memberCount = 2;
              partyState.party.members.push({
                id: payload.targetId,
                displayName: payload.targetId,
                isLeader: false,
                isAccount,
                accountUserId: isAccount ? String(payload.targetId) : '',
                username: isAccount ? String(payload.targetId).replace(/^usr_/, '').toUpperCase() : ''
              });
              partyState.directInvite.incoming = null;
              partyState.directInvite.outgoing = null;
              callbacks.onPartyStateChanged(partyState);
            } else if (action === 'invite') {
              partyState.directInvite.outgoing = {
                actorId: String(payload.targetId || ''),
                displayName: String(payload.targetId || '').toUpperCase()
              };
              callbacks.onPartyStateChanged(partyState);
            } else if (action === 'accept_invite') {
              partyState.party.memberCount = 2;
              partyState.party.members.push({
                id: payload.targetId,
                displayName: String(payload.targetId || '').toUpperCase(),
                isLeader: false,
                isAccount: false,
                accountUserId: '',
                username: ''
              });
              partyState.directInvite.incoming = null;
              callbacks.onPartyStateChanged(partyState);
            } else if (action === 'dismiss_invite') {
              partyState.directInvite.incoming = null;
              callbacks.onPartyStateChanged(partyState);
            } else if (action === 'lock') {
              partyState.party.joinLocked = !!payload.locked;
              callbacks.onPartyStateChanged(partyState);
            } else if (action === 'leave') {
              partyState.party.memberCount = 1;
              partyState.party.members = partyState.party.members.slice(0, 1);
              callbacks.onPartyStateChanged(partyState);
            }
            return Promise.resolve(partyState);
          },
          performFriendAction(action, targetUserId) {
            friendActionCalls.push({ action, targetUserId });
            return Promise.resolve({ friends: friendsState.friends });
          },
          refreshFriendsState() {
            callbacks.onFriendsStateChanged(friendsState);
            return Promise.resolve(friendsState);
          },
          createPrivateRoom() {
            callbacks.onPrivateRoomStateChanged(privateRoomState);
            return Promise.resolve({ state: privateRoomState });
          },
          joinPrivateRoom() {
            callbacks.onPrivateRoomStateChanged(privateRoomState);
            return Promise.resolve({ state: privateRoomState });
          },
          setPrivateRoomMode(roomMode) {
            privateRoomState.room.roomMode = roomMode;
            callbacks.onPrivateRoomStateChanged(privateRoomState);
            return Promise.resolve({ state: privateRoomState });
          },
          randomizePrivateRoomTeams() {
            return Promise.resolve({ state: privateRoomState });
          },
          startPrivateRoomMatch() {
            privateRoomState.room.roomPhase = 'active';
            callbacks.onPrivateRoomStateChanged(privateRoomState);
            return Promise.resolve({ state: privateRoomState });
          },
          movePrivateRoomMember(memberId, nextTeamId) {
            const all = [...privateRoomState.room.teams.alpha, ...privateRoomState.room.teams.bravo];
            const member = all.find((entry) => entry.id === memberId);
            if (member) {
              privateRoomState.room.teams.alpha = privateRoomState.room.teams.alpha.filter((entry) => entry.id !== memberId);
              privateRoomState.room.teams.bravo = privateRoomState.room.teams.bravo.filter((entry) => entry.id !== memberId);
              member.teamId = nextTeamId;
              privateRoomState.room.teams[nextTeamId].push(member);
            }
            callbacks.onPrivateRoomStateChanged(privateRoomState);
            return Promise.resolve({ state: privateRoomState });
          }
        };
      }
    },
    GameRuntimeProfile: {
      isLocalEnvironment() {
        return !!localEnvironment;
      }
    },
    GameRuntimeModeUi: {
      roomCodeFromRoomId(roomId) {
        return String(roomId || '').toUpperCase();
      }
    },
    GameSession: {
      prepareLaunch() {},
      startGameplayFromMenu() {
        return Promise.resolve({ ok: true, entered: false, error: 'Pointer lock denied.' });
      },
      resumeGameplay() {
        return Promise.resolve({ ok: true, entered: false, error: 'Pointer lock denied.' });
      },
      returnToMenu() {}
    }
  };

  const sandbox = {
    console,
    navigator: { clipboard: null },
    window: windowObj,
    document: documentObj,
    CustomEvent: class FakeCustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    __MAYHEM_RUNTIME: runtime,
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  sandbox.globalThis.window = windowObj;
  sandbox.globalThis.document = documentObj;
  sandbox.globalThis.navigator = sandbox.navigator;
  sandbox.globalThis.CustomEvent = sandbox.CustomEvent;

  vm.runInContext(code, vm.createContext(sandbox));

  sandbox.__MAYHEM_RUNTIME.GameLobbyController.init({
    prepareMenu() {},
    launchModeById(modeId, options) {
      launchCalls.push({ modeId, options });
      return Promise.resolve({
        ok: true,
        mode: {
          id: modeId,
          roomId: options && options.roomId ? options.roomId : 'ffa-01',
          gameMode: options && options.gameMode ? options.gameMode : 'ffa'
        }
      });
    }
  });

  sessionCallbacks.onPartyStateChanged(partyState);
  sessionCallbacks.onFriendsStateChanged(friendsState);

  async function flush() {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve();
    }
  }

  return {
    elements: documentObj.elements,
    storageMap,
    runPartyActionCalls,
    friendActionCalls,
    launchCalls,
    matchmakingCalls,
    flush,
    emitPartyUnavailable(message) {
      sessionCallbacks.onPartyUnavailable(message);
    },
    emitPartyState(nextState) {
      sessionCallbacks.onPartyStateChanged(nextState || partyState);
    },
    emitPrivateRoomState() {
      sessionCallbacks.onPrivateRoomStateChanged(privateRoomState);
    },
    emitSessionState(detail) {
      windowObj.dispatchEvent({ type: 'mayhem-session-state', detail });
    }
  };
}

test('menu boots on the main screen with play ffa as the default launch action', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  assert.equal(elements['menu-screen-mode'].hidden, false);
  assert.equal(elements['menu-social-hero'].hidden, false);
  assert.equal(elements['menu-party-hero'].hidden, true);
  assert.equal(elements['menu-screen-room'].hidden, true);
  assert.equal(elements['loadout-start-btn'].hidden, true);
  assert.equal(elements['primary-launch-btn'].textContent, 'Play FFA');
  assert.equal(elements['play-mode-options'].hidden, true);
  assert.equal(elements['room-access-status'].hidden, true);
  assert.equal(elements['menu-feedback'].hidden, true);
  assert.equal(elements['menu-party-id-value'].textContent.includes('USR_'), true);
  assert.equal(elements['account-toggle-btn'].hidden, true);
  assert.equal(elements['continue-loadout-btn'].hidden, false);
  assert.equal(elements['invite-friend-btn'].hidden, false);
  assert.equal(elements['join-friend-btn'].hidden, false);
  assert.equal(elements['menu-social-friends-pane'].hidden, false);
});

test('main screen markup keeps create room in the header and uses inline social actions', async () => {
  const html = await fs.readFile(new URL('../../index.html', import.meta.url), 'utf8');

  const headerStart = html.indexOf('<div id="menu-header-leading">');
  const headerEnd = html.indexOf('<div id="menu-header-actions">', headerStart);
  const socialStart = html.indexOf('<div id="menu-social-hero" class="menu-panel-shell menu-panel-hero">');
  const partyHeroStart = html.indexOf('<div id="menu-party-hero"', socialStart);
  const modeActionsStart = html.indexOf('<div id="mode-screen-actions">', socialStart);

  assert.notEqual(html.indexOf('<div id="menu-main-heroes" class="menu-panel-grid" data-columns="2">'), -1);
  assert.notEqual(socialStart, -1);
  assert.equal(html.slice(headerStart, headerEnd).includes('id="continue-loadout-btn"'), true);
  assert.equal(html.slice(headerStart, headerEnd).includes('ROOM #'), false);
  assert.equal(html.indexOf('id="party-id-input"', socialStart) < modeActionsStart, true);
  assert.equal(html.indexOf('id="invite-friend-btn"', socialStart) < modeActionsStart, true);
  assert.equal(html.indexOf('id="join-friend-btn"', socialStart) < modeActionsStart, true);
  assert.equal(html.indexOf('id="room-code-input"', socialStart) < modeActionsStart, true);
  assert.equal(html.indexOf('id="join-room-btn"', socialStart) < modeActionsStart, true);
  assert.equal(html.indexOf('id="social-add-friend-btn"', socialStart), -1);
  assert.equal(partyHeroStart > socialStart, true);
  assert.equal(html.indexOf('id="party-hero-members"', partyHeroStart) < modeActionsStart, true);
});

test('logged-out home header shows login and guest id together', async () => {
  const harness = await loadHarness({ loggedIn: false });
  const { elements } = harness;

  assert.equal(elements['account-toggle-btn'].hidden, false);
  assert.equal(elements['menu-party-id-label'].textContent, 'Guest ID');
  assert.equal(elements['continue-loadout-btn'].hidden, false);
  assert.equal(elements['menu-social-friends-pane'].hidden, true);
});

test('local home routes service unavailable noise to the top feedback strip instead of the social hero', async () => {
  const harness = await loadHarness({ localEnvironment: true });
  const { elements } = harness;

  harness.emitPartyUnavailable('PARTY SERVICE UNAVAILABLE. RETRYING...');

  assert.equal(elements['social-hero-status'].hidden, true);
  assert.equal(elements['social-hero-status'].textContent, '');
  assert.equal(elements['menu-feedback'].hidden, false);
  assert.equal(elements['menu-feedback'].textContent, 'Local social backend offline. Start the worker/API server.');
});

test('logged-in home shows the split social hero with a friends pane', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  assert.equal(elements['menu-social-friends-pane'].hidden, false);
  assert.equal(elements['social-friends-list'].children.length > 0, true);
});

test('join friend uses the shared social input and joins in place', async () => {
  const harness = await loadHarness();
  const { elements, runPartyActionCalls } = harness;

  elements['party-id-input'].value = 'usr_bravo';
  elements['join-friend-btn'].click();

  assert.equal(runPartyActionCalls.length, 1);
  assert.equal(runPartyActionCalls[0].action, 'join');
  assert.equal(runPartyActionCalls[0].payload.targetId, 'usr_bravo');
  assert.equal(elements['menu-screen-mode'].hidden, false);
  assert.equal(elements['menu-screen-room'].hidden, true);
});

test('invite friend uses the shared social input and shows the outgoing status', async () => {
  const harness = await loadHarness();
  const { elements, runPartyActionCalls } = harness;

  elements['party-id-input'].value = 'friend-123';
  elements['invite-friend-btn'].click();

  assert.equal(runPartyActionCalls.length, 1);
  assert.equal(runPartyActionCalls[0].action, 'invite');
  assert.equal(runPartyActionCalls[0].payload.targetId, 'friend-123');
  assert.equal(elements['social-hero-status'].textContent, 'Invite pending for FRIEND-123.');
});

test('direct invite banner accepts and dismisses inline from the social hero', async () => {
  const harness = await loadHarness();
  const { elements, runPartyActionCalls } = harness;

  harness.emitPartyState({
    self: { id: 'usr_alpha', username: 'ALPHA' },
    directInvite: {
      incoming: { actorId: 'usr_bravo', displayName: 'BRAVO' },
      outgoing: null
    },
    party: {
      id: 'pty_alpha',
      leaderId: 'usr_alpha',
      joinLocked: false,
      isLeader: true,
      memberCount: 1,
      members: [{ id: 'usr_alpha', displayName: 'ALPHA', isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' }]
    }
  });

  assert.equal(elements['social-direct-invite-banner'].hidden, false);
  assert.equal(elements['social-direct-invite-copy'].textContent, 'BRAVO invited you to join.');

  elements['social-direct-invite-dismiss-btn'].click();
  assert.equal(runPartyActionCalls[0].action, 'dismiss_invite');

  harness.emitPartyState({
    self: { id: 'usr_alpha', username: 'ALPHA' },
    directInvite: {
      incoming: { actorId: 'usr_bravo', displayName: 'BRAVO' },
      outgoing: null
    },
    party: {
      id: 'pty_alpha',
      leaderId: 'usr_alpha',
      joinLocked: false,
      isLeader: true,
      memberCount: 1,
      members: [{ id: 'usr_alpha', displayName: 'ALPHA', isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' }]
    }
  });
  elements['social-direct-invite-accept-btn'].click();
  assert.equal(runPartyActionCalls[1].action, 'accept_invite');
});

test('room invite banner uses the shared invite controls with room-specific actions', async () => {
  const harness = await loadHarness();
  const { elements, runPartyActionCalls } = harness;

  harness.emitPartyState({
    self: { id: 'usr_alpha', username: 'ALPHA' },
    directInvite: { incoming: null, outgoing: null },
    roomInvite: {
      incoming: {
        roomId: 'private-room1',
        roomCode: 'ROOM1',
        roomMode: 'ffa',
        roomPhase: 'lobby',
        inviterActorId: 'usr_bravo',
        inviterDisplayName: 'BRAVO',
        createdAt: 1
      },
      outgoing: null
    },
    party: {
      id: 'pty_alpha',
      leaderId: 'usr_alpha',
      joinLocked: false,
      isLeader: true,
      memberCount: 1,
      members: [{ id: 'usr_alpha', displayName: 'ALPHA', isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' }]
    }
  });

  assert.equal(elements['social-direct-invite-banner'].hidden, false);
  assert.equal(elements['social-direct-invite-copy'].textContent, 'BRAVO invited you to room ROOM1.');
  assert.equal(elements['social-direct-invite-accept-btn'].textContent, 'Join Room');

  elements['social-direct-invite-dismiss-btn'].click();
  assert.equal(runPartyActionCalls[0].action, 'dismiss_room_invite');

  harness.emitPartyState({
    self: { id: 'usr_alpha', username: 'ALPHA' },
    directInvite: { incoming: null, outgoing: null },
    roomInvite: {
      incoming: {
        roomId: 'private-room1',
        roomCode: 'ROOM1',
        roomMode: 'ffa',
        roomPhase: 'lobby',
        inviterActorId: 'usr_bravo',
        inviterDisplayName: 'BRAVO',
        createdAt: 1
      },
      outgoing: null
    },
    party: {
      id: 'pty_alpha',
      leaderId: 'usr_alpha',
      joinLocked: false,
      isLeader: true,
      memberCount: 1,
      members: [{ id: 'usr_alpha', displayName: 'ALPHA', isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' }]
    }
  });
  elements['social-direct-invite-accept-btn'].click();
  assert.equal(runPartyActionCalls[1].action, 'accept_room_invite');
});

test('game modes reveal below the launch row and the primary launch pill starts the selected mode', async () => {
  const harness = await loadHarness();
  const { elements, matchmakingCalls, launchCalls } = harness;

  elements['game-modes-toggle-btn'].click();
  assert.equal(elements['play-mode-options'].hidden, false);

  elements['play-mode-tdm-btn'].click();
  assert.equal(elements['play-mode-options'].hidden, true);
  assert.equal(elements['primary-launch-btn'].textContent, 'Play TDM');

  elements['primary-launch-btn'].click();
  await harness.flush();

  assert.equal(matchmakingCalls.length, 1);
  assert.equal(matchmakingCalls[0].body.gameMode, 'tdm');
  assert.equal(launchCalls.length, 1);
  assert.equal(launchCalls[0].modeId, 'cloud_multiplayer');
  assert.equal(launchCalls[0].options.gameMode, 'tdm');
  assert.equal(elements['menu-feedback'].hidden, true);
  assert.equal(elements['room-access-status'].hidden, false);
  assert.equal(elements['room-access-status'].textContent, 'Pointer lock denied.');
});

test('main room action creates a room and opens the party surface', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  elements['game-modes-toggle-btn'].click();
  elements['play-mode-lms-btn'].click();
  elements['continue-loadout-btn'].click();
  await harness.flush();

  assert.equal(elements['menu-screen-mode'].hidden, true);
  assert.equal(elements['menu-screen-room'].hidden, false);
  assert.equal(elements['party-back-btn'].hidden, false);
  assert.equal(elements['private-room-view'].hidden, false);
});

test('existing private room changes the room action label to open room', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  harness.emitPrivateRoomState();
  await harness.flush();

  assert.equal(elements['continue-loadout-btn'].textContent, 'ROOM #ROOM1');
});

test('party hero appears only after the party grows beyond one member', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  assert.equal(elements['menu-party-hero'].hidden, true);

  elements['party-id-input'].value = 'usr_bravo';
  elements['join-friend-btn'].click();

  assert.equal(elements['menu-party-hero'].hidden, false);
  assert.equal(elements['party-hero-members'].children.length > 0, true);
  assert.equal(elements['menu-main-heroes'].attributes['data-columns'], '3');
});

test('party hero shows roster actions and leave party', async () => {
  const harness = await loadHarness();
  const { elements, runPartyActionCalls, friendActionCalls } = harness;

  harness.emitPartyState({
    self: { id: 'usr_alpha', username: 'ALPHA' },
    directInvite: { incoming: null, outgoing: null },
    party: {
      id: 'pty_alpha',
      leaderId: 'usr_alpha',
      joinLocked: false,
      isLeader: true,
      memberCount: 2,
      members: [
        { id: 'usr_alpha', displayName: 'ALPHA', isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' },
        { id: 'usr_charlie', displayName: 'usr_charlie', isLeader: false, isAccount: true, accountUserId: 'usr_charlie', username: 'CHARLIE' }
      ]
    }
  });
  const memberCard = elements['party-hero-members'].children[1];
  const memberBtn = memberCard.children[0];
  memberBtn.click();
  const expandedCard = elements['party-hero-members'].children[1];
  const actions = expandedCard.children[1];
  actions.children[0].click();
  assert.equal(friendActionCalls[0].action, 'add');

  actions.children[1].click();
  elements['party-hero-leave-btn'].click();

  assert.equal(runPartyActionCalls[0].action, 'kick');
  assert.equal(runPartyActionCalls[1].action, 'leave');
});

test('resumable runtime uses the session rail as the only return path', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  elements['party-id-input'].value = 'usr_bravo';
  elements['join-friend-btn'].click();
  harness.emitSessionState({
    runtimeReady: true,
    inMatch: false,
    awaitingInputCapture: false,
    canResume: true,
    activityState: 'in_match',
    launchContext: {}
  });

  assert.equal(elements['menu-screen-mode'].hidden, false);
  assert.equal(elements['menu-home-hero'].hidden, true);
  assert.equal(elements['menu-party-hero'].hidden, false);
  assert.equal(elements['menu-session-actions'].hidden, false);
  assert.equal(elements['menu-session-status'].textContent, 'Resume Match');
  assert.equal(elements['menu-session-kd'].textContent, 'Change loadout or return to the match.');
  assert.equal(elements['menu-return-btn'].hidden, true);
});

test('paused runtime hides the duplicate header return, shows the session rail, and keeps party back behavior', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  elements['party-id-input'].value = 'friend-123';
  elements['join-friend-btn'].click();
  harness.emitSessionState({
    runtimeReady: true,
    inMatch: false,
    awaitingInputCapture: false,
    canResume: true,
    activityState: 'paused',
    launchContext: {}
  });

  assert.equal(elements['menu-screen-mode'].hidden, false);
  assert.equal(elements['menu-home-hero'].hidden, true);
  assert.equal(elements['menu-screen-room'].hidden, true);
  assert.equal(elements['menu-session-actions'].hidden, false);
  assert.equal(elements['menu-session-status'].textContent, 'Paused');
  assert.equal(elements['menu-return-btn'].hidden, true);
  assert.equal(elements['menu-party-hero'].hidden, false);
  assert.equal(elements['party-back-btn'].hidden, true);
});

test('paused escape keeps focus on the pause rail instead of trying to resume directly', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  harness.emitSessionState({
    runtimeReady: true,
    inMatch: false,
    awaitingInputCapture: false,
    canResume: true,
    activityState: 'paused',
    launchContext: {}
  });

  const doc = elements['play-btn'].ownerDocument;
  doc.dispatch('keydown', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });

  assert.equal(doc.activeElement, elements['play-btn']);
  assert.equal(elements['menu-session-actions'].hidden, false);
});

test('room screen outside pause reduces the left header to back and id', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  harness.emitPrivateRoomState();
  await harness.flush();
  elements['continue-loadout-btn'].click();

  assert.equal(elements['party-back-btn'].hidden, false);
  assert.equal(elements['continue-loadout-btn'].hidden, true);
  assert.equal(elements['menu-screen-room'].hidden, false);
});
