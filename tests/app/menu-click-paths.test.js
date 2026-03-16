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

async function loadHarness({ localEnvironment = false } = {}) {
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
    ['div', 'menu-feedback'],
    ['div', 'menu-header-page-title'],
    ['button', 'menu-party-id-btn'],
    ['span', 'menu-party-id-label'],
    ['span', 'menu-party-id-value'],
    ['button', 'join-party-trigger-btn'],
    ['div', 'join-party-popover'],
    ['div', 'join-party-recent'],
    ['input', 'party-id-input'],
    ['button', 'join-party-btn'],
    ['button', 'open-party-btn'],
    ['button', 'party-back-btn'],
    ['button', 'account-toggle-btn'],
    ['button', 'utility-toggle-btn'],
    ['div', 'utility-overlay'],
    ['button', 'utility-close-btn'],
    ['div', 'utility-modal'],
    ['button', 'open-manual-btn'],
    ['button', 'controls-toggle'],
    ['button', 'sound-toggle-btn'],
    ['button', 'alt-mode-toggle'],
    ['div', 'dev-overlay'],
    ['button', 'dev-close-btn'],
    ['div', 'mode-buttons'],
    ['button', 'mode-local-multiplayer-btn'],
    ['section', 'menu-screen-mode'],
    ['section', 'menu-screen-party'],
    ['h1', 'mode-screen-title'],
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
    ['div', 'party-status'],
    ['button', 'party-join-lock-btn'],
    ['span', 'party-join-lock-icon'],
    ['span', 'party-join-lock-note'],
    ['button', 'leave-party-btn'],
    ['div', 'social-party-members'],
    ['div', 'private-room-status'],
    ['button', 'create-private-room-btn'],
    ['input', 'private-room-input'],
    ['button', 'join-private-room-btn'],
    ['div', 'room-share-panel'],
    ['div', 'room-share-code'],
    ['button', 'copy-room-code-btn'],
    ['div', 'private-room-view'],
    ['div', 'private-room-summary'],
    ['button', 'private-room-mode-ffa-btn'],
    ['button', 'private-room-mode-tdm-btn'],
    ['button', 'private-room-mode-lms-btn'],
    ['button', 'private-room-randomize-btn'],
    ['button', 'private-room-start-btn'],
    ['button', 'private-room-enter-btn'],
    ['div', 'private-room-unassigned'],
    ['div', 'private-room-team-alpha'],
    ['div', 'private-room-team-bravo'],
    ['input', 'friend-id-input'],
    ['button', 'add-friend-btn'],
    ['div', 'friends-status'],
    ['button', 'friends-filter-joinable-btn'],
    ['button', 'friends-filter-online-btn'],
    ['button', 'friends-filter-all-btn'],
    ['div', 'friends-preview'],
    ['button', 'refresh-friends-btn']
  ];

  for (const [tag, id] of ids) {
    documentObj.elements[id] = new FakeElement(tag, id, documentObj);
  }

  documentObj.elements['join-party-popover'].hidden = true;
  documentObj.elements['utility-overlay'].hidden = true;
  documentObj.elements['leave-confirm-overlay'].hidden = true;
  documentObj.elements['menu-screen-party'].hidden = true;
  documentObj.elements['room-share-panel'].hidden = true;
  documentObj.elements['private-room-view'].hidden = true;
  documentObj.elements['private-room-enter-btn'].hidden = true;
  documentObj.elements['menu-session-actions'].hidden = true;
  documentObj.elements['menu-header-page-title'].hidden = true;
  documentObj.elements['party-back-btn'].hidden = true;
  documentObj.elements['mode-local-multiplayer-btn'].dataset.modeId = 'single_dev_server';

  const runPartyActionCalls = [];
  const launchCalls = [];
  const matchmakingCalls = [];
  const sessionCallbacks = {};
  const partyState = {
    self: { id: 'usr_alpha', username: 'ALPHA' },
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
        return { id: 'usr_alpha', username: 'ALPHA', label: 'Player ID', kind: 'account' };
      },
      isLoggedIn() {
        return true;
      },
      getUser() {
        return { id: 'usr_alpha', username: 'ALPHA', displayName: 'ALPHA' };
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
              partyState.party.memberCount = 2;
              partyState.party.members.push({
                id: payload.targetId,
                displayName: payload.targetId,
                isLeader: false,
                isAccount: false,
                accountUserId: '',
                username: ''
              });
              callbacks.onPartyStateChanged(partyState);
            }
            return Promise.resolve(partyState);
          },
          performFriendAction() {
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
    launchCalls,
    matchmakingCalls,
    flush,
    emitPrivateRoomState() {
      sessionCallbacks.onPrivateRoomStateChanged(privateRoomState);
    },
    emitSessionState(detail) {
      windowObj.dispatchEvent({ type: 'mayhem-session-state', detail });
    }
  };
}

test('menu boots on the main screen with no selected mode and hidden start action', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  assert.equal(elements['menu-screen-mode'].hidden, false);
  assert.equal(elements['menu-screen-party'].hidden, true);
  assert.equal(elements['loadout-start-btn'].hidden, true);
  assert.equal(elements['menu-party-id-value'].textContent.includes('USR_'), true);
});

test('join friend opens a popover and joins in place', async () => {
  const harness = await loadHarness();
  const { elements, runPartyActionCalls, storageMap } = harness;

  elements['join-party-trigger-btn'].click();
  assert.equal(elements['join-party-popover'].hidden, false);

  elements['party-id-input'].value = 'friend-123';
  elements['join-party-btn'].click();

  assert.equal(runPartyActionCalls.length, 1);
  assert.equal(runPartyActionCalls[0].action, 'join');
  assert.equal(runPartyActionCalls[0].payload.targetId, 'friend-123');
  assert.equal(elements['menu-screen-mode'].hidden, false);
  assert.equal(elements['menu-screen-party'].hidden, true);
  assert.match(String(storageMap.get('mayhem.menu.recentJoinIds.v1') || ''), /friend-123/);
});

test('selecting a public mode reveals start match and launches directly from main', async () => {
  const harness = await loadHarness();
  const { elements, matchmakingCalls, launchCalls } = harness;

  elements['play-mode-tdm-btn'].click();
  assert.equal(elements['loadout-start-btn'].hidden, false);
  elements['loadout-start-btn'].click();
  await harness.flush();

  assert.equal(matchmakingCalls.length, 1);
  assert.equal(matchmakingCalls[0].body.gameMode, 'tdm');
  assert.equal(launchCalls.length, 1);
  assert.equal(launchCalls[0].modeId, 'cloud_multiplayer');
  assert.equal(launchCalls[0].options.gameMode, 'tdm');
});

test('main room action creates a room and opens the party surface', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  elements['play-mode-lms-btn'].click();
  elements['continue-loadout-btn'].click();
  await harness.flush();

  assert.equal(elements['menu-screen-mode'].hidden, true);
  assert.equal(elements['menu-screen-party'].hidden, false);
  assert.equal(elements['party-back-btn'].hidden, false);
  assert.equal(elements['private-room-view'].hidden, false);
  assert.equal(elements['party-room-section'].style.order, '0');
});

test('existing private room changes the room action label to open room', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  harness.emitPrivateRoomState();
  await harness.flush();

  assert.equal(elements['continue-loadout-btn'].textContent, 'Open Room');
});

test('paused runtime hides the main stage, shows the session rail, and keeps party back behavior', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  elements['open-party-btn'].click();
  harness.emitSessionState({
    runtimeReady: true,
    inMatch: false,
    awaitingInputCapture: false,
    canResume: true,
    activityState: 'paused',
    launchContext: {}
  });

  assert.equal(elements['menu-screen-mode'].hidden, true);
  assert.equal(elements['menu-screen-party'].hidden, false);
  assert.equal(elements['menu-session-actions'].hidden, false);

  elements['party-back-btn'].click();
  assert.equal(elements['menu-screen-party'].hidden, true);
});
