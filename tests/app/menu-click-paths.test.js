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
    const normalized = String(name || '');
    const nextValue = String(value || '');
    this.attributes[normalized] = nextValue;
    if (normalized.indexOf('data-') === 0) {
      const key = normalized.slice(5).replace(/-([a-z])/g, (_match, chr) => chr.toUpperCase());
      this.dataset[key] = nextValue;
    }
  }

  removeAttribute(name) {
    const normalized = String(name || '');
    delete this.attributes[normalized];
    if (normalized.indexOf('data-') === 0) {
      const key = normalized.slice(5).replace(/-([a-z])/g, (_match, chr) => chr.toUpperCase());
      delete this.dataset[key];
    }
  }

  getAttribute(name) {
    const normalized = String(name || '');
    return Object.prototype.hasOwnProperty.call(this.attributes, normalized)
      ? this.attributes[normalized]
      : null;
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

  input(event = {}) {
    const handlers = this.listeners.get('input') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'input',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        ...event
      });
    }
  }

  dragstart(event = {}) {
    const handlers = this.listeners.get('dragstart') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'dragstart',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        ...event
      });
    }
  }

  dragover(event = {}) {
    const handlers = this.listeners.get('dragover') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'dragover',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        ...event
      });
    }
  }

  dragleave(event = {}) {
    const handlers = this.listeners.get('dragleave') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'dragleave',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        ...event
      });
    }
  }

  drop(event = {}) {
    const handlers = this.listeners.get('drop') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'drop',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        ...event
      });
    }
  }

  dragend(event = {}) {
    const handlers = this.listeners.get('dragend') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'dragend',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        ...event
      });
    }
  }
}

async function loadHarness({
  localEnvironment = false,
  loggedIn = true,
  loadoutValidation = { ok: true, message: '' },
  lobbyApiOverride = null,
  modalOpen = false
} = {}) {
  const viewCode = await fs.readFile(new URL('../../js/app/lobby-private-room-view.js', import.meta.url), 'utf8');
  const rendererCode = await fs.readFile(new URL('../../js/app/lobby-renderer.js', import.meta.url), 'utf8');
  const actionsCode = await fs.readFile(new URL('../../js/app/lobby-actions.js', import.meta.url), 'utf8');
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
    ['div', 'overlay'],
    ['div', 'menu-header'],
    ['div', 'menu-surface'],
    ['div', 'menu-inline-toast'],
    ['div', 'menu-feedback'],
    ['button', 'menu-return-btn'],
    ['button', 'menu-party-id-btn'],
    ['span', 'menu-party-id-label'],
    ['span', 'menu-party-id-value'],
    ['div', 'active-match-friend-bar'],
    ['input', 'active-match-friend-id-input'],
    ['button', 'active-match-invite-friend-btn'],
    ['button', 'active-match-join-friend-btn'],
    ['div', 'active-match-header-feedback'],
    ['div', 'active-match-primary-banner'],
    ['div', 'active-match-primary-banner-copy'],
    ['div', 'active-match-primary-banner-actions'],
    ['button', 'active-match-primary-banner-accept-btn'],
    ['button', 'active-match-primary-banner-dismiss-btn'],
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
    ['div', 'menu-body'],
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
    ['button', 'sandbox-mode-btn'],
    ['div', 'room-access-status'],
    ['button', 'loadout-start-btn'],
    ['button', 'continue-loadout-btn'],
    ['div', 'active-match-shell'],
    ['div', 'active-match-pill-grid'],
    ['div', 'active-match-mode-pill'],
    ['div', 'active-match-context-pill'],
    ['div', 'active-match-primary-stat-pill'],
    ['div', 'active-match-secondary-stat-pill'],
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
    ['div', 'room-social-feedback'],
    ['div', 'room-social-invite-banner'],
    ['div', 'room-social-invite-copy'],
    ['div', 'room-social-invite-actions'],
    ['button', 'room-social-invite-accept-btn'],
    ['button', 'room-social-invite-dismiss-btn'],
    ['div', 'room-share-panel'],
    ['div', 'room-share-code'],
    ['button', 'copy-room-code-btn'],
    ['div', 'private-room-view'],
    ['div', 'private-room-summary'],
    ['button', 'private-room-mode-ffa-btn'],
    ['button', 'private-room-mode-tdm-btn'],
    ['button', 'private-room-teams-2-btn'],
    ['button', 'private-room-teams-3-btn'],
    ['button', 'private-room-teams-4-btn'],
    ['button', 'private-room-randomize-btn'],
    ['button', 'private-room-start-btn'],
    ['button', 'private-room-enter-btn'],
    ['div', 'private-room-unassigned-wrap'],
    ['div', 'private-room-unassigned'],
    ['div', 'private-room-roster-grid']
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
  documentObj.elements['active-match-shell'].hidden = true;
  documentObj.elements['menu-return-btn'].hidden = true;
  documentObj.elements['party-back-btn'].hidden = true;
  documentObj.elements['menu-party-hero'].hidden = true;
  documentObj.elements['active-match-friend-bar'].hidden = true;
  documentObj.elements['active-match-header-feedback'].hidden = true;
  documentObj.elements['active-match-primary-banner'].hidden = true;
  documentObj.elements['active-match-primary-banner-actions'].hidden = true;
  documentObj.elements['room-social-invite-banner'].hidden = true;
  documentObj.elements['room-social-invite-actions'].hidden = true;
  documentObj.elements['social-direct-invite-banner'].hidden = true;
  documentObj.elements['menu-social-friends-pane'].hidden = !loggedIn;
  documentObj.elements['menu-inline-toast'].hidden = true;
  documentObj.elements['mode-local-multiplayer-btn'].dataset.modeId = 'single_dev_server';

  const runPartyActionCalls = [];
  const friendActionCalls = [];
  const launchCalls = [];
  const matchmakingCalls = [];
  const resumeGameplayCalls = [];
  const modalState = { open: !!modalOpen };
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
      teamCount: 2,
      teamIds: ['alpha', 'bravo'],
      memberCount: 1,
      teams: {
        alpha: [{ id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true }],
        bravo: [],
        charlie: [],
        delta: []
      },
      members: [{ id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true }]
    }
  };

  function activePrivateRoomTeamIds() {
    return Array.isArray(privateRoomState.room.teamIds) && privateRoomState.room.teamIds.length
      ? privateRoomState.room.teamIds.slice()
      : ['alpha', 'bravo'];
  }

  function rebuildPrivateRoomMembers() {
    const teamIds = activePrivateRoomTeamIds();
    const all = [];
    for (const teamId of ['alpha', 'bravo', 'charlie', 'delta']) {
      const entries = Array.isArray(privateRoomState.room.teams[teamId]) ? privateRoomState.room.teams[teamId] : [];
      for (const entry of entries) {
        if (!entry) continue;
        all.push({
          ...entry,
          teamId: teamId
        });
      }
    }
    privateRoomState.room.members = all.filter((entry, index, list) =>
      list.findIndex((candidate) => candidate && candidate.id === entry.id) === index
    );
    privateRoomState.room.memberCount = privateRoomState.room.members.length;
    privateRoomState.room.teamCount = teamIds.length;
    privateRoomState.room.teamIds = teamIds;
  }

  function rebalancePrivateRoomTeams() {
    const teamIds = activePrivateRoomTeamIds();
    const members = privateRoomState.room.members.slice().sort((left, right) => String(left.id || '').localeCompare(String(right.id || '')));
    for (const teamId of ['alpha', 'bravo', 'charlie', 'delta']) {
      privateRoomState.room.teams[teamId] = [];
    }
    const counts = {};
    for (const teamId of teamIds) counts[teamId] = 0;
    for (const member of members) {
      let bestTeamId = teamIds[0];
      let bestCount = Number.MAX_SAFE_INTEGER;
      for (const teamId of teamIds) {
        const nextCount = Number(counts[teamId] || 0);
        if (nextCount < bestCount) {
          bestCount = nextCount;
          bestTeamId = teamId;
        }
      }
      member.teamId = bestTeamId;
      privateRoomState.room.teams[bestTeamId].push(member);
      counts[bestTeamId] += 1;
    }
    rebuildPrivateRoomMembers();
  }

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
    GameLobbyApi: lobbyApiOverride || {
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
          : { id: 'amber-otter-314', username: 'AMBER-OTTER-314', label: 'Player ID', kind: 'guest' };
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
          selectedAbilityId: 'choke',
          selectedThrowableId: 'frag'
        };
      },
      validateSelections() {
        return {
          ok: !!(loadoutValidation && loadoutValidation.ok),
          message: String(loadoutValidation && loadoutValidation.message || '')
        };
      },
      subscribe() {
        return function () {};
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
              partyMemberCount: partyState.party.members.length,
              canTogglePartyJoinLock: true,
              partyJoinLocked: !!partyState.party.joinLocked,
              partyJoinLockTitle: 'Toggle party privacy.',
              partyJoinLockNote: partyState.party.joinLocked ? 'Party Closed' : 'Party Open',
              canLeaveParty: partyState.party.members.length > 1,
              hasPrivateRoom: !!room,
              privateRoomPhase: room ? room.roomPhase : '',
              privateRoomMode: room ? room.roomMode : '',
              privateRoomInviteLocked: false,
              canTogglePrivateRoomInviteLock: !!room,
              canInvitePartyToPrivateRoom: !!room,
              canEditPrivateRoom: !!(room && room.roomPhase === 'lobby'),
              canRandomizeTeams: !!(room && room.roomPhase === 'lobby' && room.roomMode === 'tdm'),
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
          setPrivateRoomTeamCount(teamCount) {
            privateRoomState.room.teamCount = Number(teamCount || 2);
            privateRoomState.room.teamIds = ['alpha', 'bravo', 'charlie', 'delta'].slice(0, privateRoomState.room.teamCount);
            rebalancePrivateRoomTeams();
            callbacks.onPrivateRoomStateChanged(privateRoomState);
            return Promise.resolve({ state: privateRoomState });
          },
          randomizePrivateRoomTeams() {
            rebalancePrivateRoomTeams();
            callbacks.onPrivateRoomStateChanged(privateRoomState);
            return Promise.resolve({ state: privateRoomState });
          },
          startPrivateRoomMatch() {
            privateRoomState.room.roomPhase = 'active';
            callbacks.onPrivateRoomStateChanged(privateRoomState);
            return Promise.resolve({ state: privateRoomState });
          },
          movePrivateRoomMember(memberId, nextTeamId) {
            const teamIds = activePrivateRoomTeamIds();
            const all = privateRoomState.room.members.slice();
            const member = all.find((entry) => entry.id === memberId);
            if (member) {
              for (const teamId of ['alpha', 'bravo', 'charlie', 'delta']) {
                privateRoomState.room.teams[teamId] = privateRoomState.room.teams[teamId].filter((entry) => entry.id !== memberId);
              }
              member.teamId = teamIds.includes(nextTeamId) ? nextTeamId : teamIds[0];
              privateRoomState.room.teams[member.teamId].push(member);
              rebuildPrivateRoomMembers();
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
    GameModalManager: {
      isOpen() {
        return !!modalState.open;
      },
      register() {
        return true;
      },
      close() {
        modalState.open = false;
        return true;
      },
      open() {
        modalState.open = true;
        return true;
      }
    },
    GameSession: {
      prepareLaunch() {},
      startGameplayFromMenu(event) {
        resumeGameplayCalls.push({ source: 'start', event });
        return Promise.resolve({ ok: true, entered: false, error: 'Pointer lock denied.' });
      },
      resumeGameplay(event) {
        resumeGameplayCalls.push({ source: 'resume', event });
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

  const context = vm.createContext(sandbox);
  vm.runInContext(viewCode, context);
  vm.runInContext(rendererCode, context);
  vm.runInContext(actionsCode, context);
  vm.runInContext(code, context);

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
    privateRoomState,
    storageMap,
    runPartyActionCalls,
    friendActionCalls,
    launchCalls,
    matchmakingCalls,
    resumeGameplayCalls,
    setModalOpen(value) {
      modalState.open = !!value;
    },
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
    },
    emitMatchMenuModel(detail) {
      windowObj.dispatchEvent({ type: 'mayhem-menu-match-model', detail });
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
  assert.equal(elements['active-match-friend-bar'].hidden, true);
  assert.equal(elements['invite-friend-btn'].hidden, false);
  assert.equal(elements['join-friend-btn'].hidden, false);
  assert.equal(elements['menu-social-friends-pane'].hidden, false);
});

test('main screen markup keeps create room with the inline social actions', async () => {
  const html = await fs.readFile(new URL('../../index.html', import.meta.url), 'utf8');

  const socialStart = html.indexOf('id="menu-social-hero"');
  const partyHeroStart = html.indexOf('<div id="menu-party-hero"', socialStart);
  const modeActionsStart = html.indexOf('<div id="mode-screen-actions">', socialStart);

  assert.notEqual(html.indexOf('id="menu-main-heroes"'), -1);
  assert.notEqual(socialStart, -1);
  assert.equal(html.indexOf('id="party-id-input"', socialStart) < modeActionsStart, true);
  assert.equal(html.indexOf('id="invite-friend-btn"', socialStart) < modeActionsStart, true);
  assert.equal(html.indexOf('id="join-friend-btn"', socialStart) < modeActionsStart, true);
  assert.equal(html.indexOf('id="room-code-input"', socialStart) < modeActionsStart, true);
  assert.equal(html.indexOf('id="join-room-btn"', socialStart) < modeActionsStart, true);
  assert.equal(html.indexOf('id="continue-loadout-btn"', socialStart) < modeActionsStart, true);
  assert.equal(html.indexOf('id="social-add-friend-btn"', socialStart), -1);
  assert.equal(partyHeroStart > socialStart, true);
  assert.equal(html.indexOf('id="party-hero-members"', partyHeroStart) < modeActionsStart, true);
});

test('logged-out home header shows login and guest id together', async () => {
  const harness = await loadHarness({ loggedIn: false });
  const { elements } = harness;

  assert.equal(elements['account-toggle-btn'].hidden, false);
  assert.equal(elements['menu-party-id-label'].textContent, 'Player ID');
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

test('home with party hero still shows visible validation feedback for empty friend actions', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  elements['party-id-input'].value = 'usr_bravo';
  elements['join-friend-btn'].click();
  elements['party-id-input'].value = '';
  elements['party-id-input'].input();
  elements['invite-friend-btn'].click();

  assert.equal(elements['menu-party-hero'].hidden, false);
  assert.equal(elements['social-hero-status'].hidden, false);
  assert.equal(elements['social-hero-status'].textContent, 'Enter a friend ID.');
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

test('room surface shows the room invite banner and hides the home invite slot', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  harness.emitPrivateRoomState();
  await harness.flush();
  elements['continue-loadout-btn'].click();
  await harness.flush();

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

  assert.equal(elements['room-social-invite-banner'].hidden, false);
  assert.equal(elements['room-social-invite-copy'].textContent, 'BRAVO invited you to room ROOM1.');
  assert.equal(elements['social-direct-invite-banner'].hidden, true);
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
  assert.equal(elements['menu-body'].hidden, true);
  assert.equal(elements['active-match-shell'].hidden, false);
  assert.equal(elements['active-match-mode-pill'].textContent, 'TDM');
  assert.equal(elements['active-match-context-pill'].textContent, 'READY');
  assert.equal(elements['active-match-primary-stat-pill'].textContent, 'Pointer lock denied.');
  assert.equal(elements['menu-screen-mode'].hidden, true);
  assert.equal(elements['menu-home-hero'].hidden, true);
  assert.equal(elements['menu-social-hero'].hidden, true);
  assert.equal(elements['menu-party-hero'].hidden, true);
  assert.equal(elements['continue-loadout-btn'].hidden, true);
  assert.equal(elements['active-match-friend-bar'].hidden, false);
  assert.equal(elements['room-access-status'].hidden, true);
});

test('sandbox mode launches the offline sandbox without requesting matchmaking', async () => {
  const harness = await loadHarness();
  const { elements, matchmakingCalls, launchCalls } = harness;

  elements['game-modes-toggle-btn'].click();
  assert.equal(elements['play-mode-options'].hidden, false);

  elements['sandbox-mode-btn'].click();
  assert.equal(elements['play-mode-options'].hidden, true);
  assert.equal(elements['primary-launch-btn'].textContent, 'Play Sandbox');

  elements['primary-launch-btn'].click();
  await harness.flush();

  assert.equal(matchmakingCalls.length, 0);
  assert.equal(launchCalls.length, 1);
  assert.equal(launchCalls[0].modeId, 'single_full_sandbox');
  assert.equal(launchCalls[0].options.gameMode, 'ffa');
  assert.equal(elements['active-match-mode-pill'].textContent, 'SANDBOX');
  assert.equal(elements['active-match-context-pill'].textContent, 'READY');
  assert.equal(elements['active-match-primary-stat-pill'].textContent, 'Pointer lock denied.');
});

test('main room action creates a room and opens the party surface', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  elements['game-modes-toggle-btn'].click();
  elements['play-mode-tdm-btn'].click();
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

test('private room team board grows and shrinks lanes as team count changes', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  harness.emitPrivateRoomState();
  await harness.flush();
  elements['continue-loadout-btn'].click();
  await harness.flush();
  assert.equal(elements['private-room-roster-grid'].children.length, 2);
  assert.equal(elements['private-room-roster-grid'].children[0].dataset.teamId, 'alpha');
  assert.equal(elements['private-room-roster-grid'].children[1].dataset.teamId, 'bravo');
  assert.equal(elements['private-room-roster-grid'].children[0].children[1].attributes['data-rounded-role'], 'container');

  elements['private-room-teams-4-btn'].click();
  await harness.flush();
  assert.equal(elements['private-room-roster-grid'].children.length, 4);
  assert.equal(elements['private-room-roster-grid'].children[2].dataset.teamId, 'charlie');
  assert.equal(elements['private-room-roster-grid'].children[3].dataset.teamId, 'delta');

  elements['private-room-teams-3-btn'].click();
  await harness.flush();
  assert.equal(elements['private-room-roster-grid'].children.length, 3);
  assert.equal(elements['private-room-roster-grid'].children[2].dataset.teamId, 'charlie');
});

test('private room drag-and-drop moves player pills between generated team lanes', async () => {
  const harness = await loadHarness();
  const { elements, privateRoomState } = harness;

  privateRoomState.room.teamCount = 3;
  privateRoomState.room.teamIds = ['alpha', 'bravo', 'charlie'];
  privateRoomState.room.teams = {
    alpha: [
      { id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true },
      { id: 'usr_bravo', displayName: 'BRAVO', teamId: 'alpha', isHost: false }
    ],
    bravo: [],
    charlie: [],
    delta: []
  };
  privateRoomState.room.members = [
    { id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true },
    { id: 'usr_bravo', displayName: 'BRAVO', teamId: 'alpha', isHost: false }
  ];
  privateRoomState.room.memberCount = 2;
  harness.emitPrivateRoomState();
  await harness.flush();

  elements['continue-loadout-btn'].click();
  await harness.flush();

  const alphaTray = elements['private-room-roster-grid'].children[0].children[1];
  const charlieTray = elements['private-room-roster-grid'].children[2].children[1];
  const bravoPill = alphaTray.children[1];
  assert.equal(bravoPill.attributes['data-rounded-role'], 'container');
  const dataTransfer = {
    _values: {},
    setData(type, value) {
      this._values[type] = value;
    },
    getData(type) {
      return this._values[type] || '';
    }
  };

  bravoPill.dragstart({ dataTransfer });
  charlieTray.dragover({ dataTransfer });
  charlieTray.drop({ dataTransfer });
  await harness.flush();

  assert.equal(privateRoomState.room.teams.alpha.length, 1);
  assert.equal(privateRoomState.room.teams.charlie.length, 1);
  assert.equal(privateRoomState.room.teams.charlie[0].id, 'usr_bravo');
});

test('private room drag end clears drag-over highlighting', async () => {
  const harness = await loadHarness();
  const { elements, privateRoomState } = harness;

  privateRoomState.room.teamCount = 3;
  privateRoomState.room.teamIds = ['alpha', 'bravo', 'charlie'];
  privateRoomState.room.teams = {
    alpha: [
      { id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true },
      { id: 'usr_bravo', displayName: 'BRAVO', teamId: 'alpha', isHost: false }
    ],
    bravo: [],
    charlie: [],
    delta: []
  };
  privateRoomState.room.members = [
    { id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true },
    { id: 'usr_bravo', displayName: 'BRAVO', teamId: 'alpha', isHost: false }
  ];
  privateRoomState.room.memberCount = 2;
  harness.emitPrivateRoomState();
  await harness.flush();

  elements['continue-loadout-btn'].click();
  await harness.flush();

  const alphaTray = elements['private-room-roster-grid'].children[0].children[1];
  const charlieTray = elements['private-room-roster-grid'].children[2].children[1];
  const bravoPill = alphaTray.children[1];
  const dataTransfer = {
    _values: {},
    setData(type, value) {
      this._values[type] = value;
    },
    getData(type) {
      return this._values[type] || '';
    }
  };

  bravoPill.dragstart({ dataTransfer });
  charlieTray.dragover({ dataTransfer });
  assert.equal(charlieTray.classList.contains('drag-over'), true);
  bravoPill.dragend({ dataTransfer });
  assert.equal(charlieTray.classList.contains('drag-over'), false);
});

test('private room tap fallback reveals destination pills and moves the selected player', async () => {
  const harness = await loadHarness();
  const { elements, privateRoomState } = harness;

  privateRoomState.room.teams = {
    alpha: [
      { id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true },
      { id: 'usr_bravo', displayName: 'BRAVO', teamId: 'alpha', isHost: false }
    ],
    bravo: [],
    charlie: [],
    delta: []
  };
  privateRoomState.room.members = [
    { id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true },
    { id: 'usr_bravo', displayName: 'BRAVO', teamId: 'alpha', isHost: false }
  ];
  privateRoomState.room.memberCount = 2;
  harness.emitPrivateRoomState();
  await harness.flush();

  elements['continue-loadout-btn'].click();
  await harness.flush();

  const alphaTray = elements['private-room-roster-grid'].children[0].children[1];
  const bravoPill = alphaTray.children[1];
  bravoPill.click();

  const refreshedBravoPill = elements['private-room-roster-grid'].children[0].children[1].children[1];
  const moveRail = refreshedBravoPill.children[2];
  assert.equal(moveRail.children.length > 0, true);
  moveRail.children[0].click();
  await harness.flush();

  assert.equal(privateRoomState.room.teams.bravo.length, 1);
  assert.equal(privateRoomState.room.teams.bravo[0].id, 'usr_bravo');
});

test('private room auto assign rebalances all members across active teams', async () => {
  const harness = await loadHarness();
  const { elements, privateRoomState } = harness;

  privateRoomState.room.teamCount = 4;
  privateRoomState.room.teamIds = ['alpha', 'bravo', 'charlie', 'delta'];
  privateRoomState.room.teams = {
    alpha: [
      { id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true },
      { id: 'usr_bravo', displayName: 'BRAVO', teamId: 'alpha', isHost: false },
      { id: 'usr_charlie', displayName: 'CHARLIE', teamId: 'alpha', isHost: false },
      { id: 'usr_delta', displayName: 'DELTA', teamId: 'alpha', isHost: false }
    ],
    bravo: [],
    charlie: [],
    delta: []
  };
  privateRoomState.room.members = [
    { id: 'usr_alpha', displayName: 'ALPHA', teamId: 'alpha', isHost: true },
    { id: 'usr_bravo', displayName: 'BRAVO', teamId: 'alpha', isHost: false },
    { id: 'usr_charlie', displayName: 'CHARLIE', teamId: 'alpha', isHost: false },
    { id: 'usr_delta', displayName: 'DELTA', teamId: 'alpha', isHost: false }
  ];
  privateRoomState.room.memberCount = 4;
  harness.emitPrivateRoomState();

  elements['continue-loadout-btn'].click();
  await harness.flush();
  elements['private-room-randomize-btn'].click();
  await harness.flush();

  assert.equal(privateRoomState.room.teams.alpha.length, 1);
  assert.equal(privateRoomState.room.teams.bravo.length, 1);
  assert.equal(privateRoomState.room.teams.charlie.length, 1);
  assert.equal(privateRoomState.room.teams.delta.length, 1);
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

test('party hero stays hidden when memberCount is stale but the roster only has one member', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

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
        { id: 'usr_alpha', displayName: 'ALPHA', isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' }
      ]
    }
  });

  assert.equal(elements['menu-party-hero'].hidden, true);
  assert.equal(elements['party-hero-members'].children.length, 0);
  assert.equal(elements['menu-main-heroes'].attributes['data-columns'], '2');
});

test('launch validation failure stays promise-compatible and shows the validation message', async () => {
  const harness = await loadHarness({
    loadoutValidation: { ok: false, message: 'Choose an ability first.' }
  });
  const { elements, matchmakingCalls } = harness;

  elements['primary-launch-btn'].click();
  await harness.flush();

  assert.equal(matchmakingCalls.length, 0);
  assert.equal(elements['room-access-status'].hidden, false);
  assert.equal(elements['room-access-status'].textContent, 'Choose an ability first.');
});

test('missing matchmaking api surfaces a controlled launch error instead of crashing', async () => {
  const harness = await loadHarness({
    lobbyApiOverride: {}
  });
  const { elements, launchCalls } = harness;

  elements['primary-launch-btn'].click();
  await harness.flush();

  assert.equal(launchCalls.length, 0);
  assert.equal(elements['room-access-status'].hidden, false);
  assert.equal(elements['room-access-status'].textContent, 'Matchmaking unavailable.');
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

  assert.equal(elements['menu-body'].hidden, true);
  assert.equal(elements['menu-screen-mode'].hidden, true);
  assert.equal(elements['menu-home-hero'].hidden, true);
  assert.equal(elements['menu-social-hero'].hidden, true);
  assert.equal(elements['menu-party-hero'].hidden, true);
  assert.equal(elements['active-match-shell'].hidden, false);
  assert.equal(elements['active-match-mode-pill'].textContent, 'FFA');
  assert.equal(elements['active-match-context-pill'].textContent, 'LIVE');
  assert.equal(elements['active-match-primary-stat-pill'].textContent, 'Change loadout or return to the match.');
  assert.equal(elements['menu-return-btn'].hidden, true);
  assert.equal(elements['continue-loadout-btn'].hidden, true);
  assert.equal(elements['active-match-friend-bar'].hidden, false);
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

  assert.equal(elements['menu-body'].hidden, true);
  assert.equal(elements['menu-screen-mode'].hidden, true);
  assert.equal(elements['menu-home-hero'].hidden, true);
  assert.equal(elements['menu-screen-room'].hidden, true);
  assert.equal(elements['menu-social-hero'].hidden, true);
  assert.equal(elements['active-match-shell'].hidden, false);
  assert.equal(elements['active-match-mode-pill'].textContent, 'FFA');
  assert.equal(elements['active-match-context-pill'].textContent, 'PAUSED');
  assert.equal(elements['menu-return-btn'].hidden, true);
  assert.equal(elements['menu-party-hero'].hidden, true);
  assert.equal(elements['party-back-btn'].hidden, true);
  assert.equal(elements['continue-loadout-btn'].hidden, true);
  assert.equal(elements['active-match-friend-bar'].hidden, false);
});

test('clicking the dimmed paused background resumes gameplay but clicking the menu surface does not', async () => {
  const harness = await loadHarness();
  const { elements, resumeGameplayCalls } = harness;

  harness.emitSessionState({
    runtimeReady: true,
    inMatch: false,
    awaitingInputCapture: false,
    canResume: true,
    activityState: 'paused',
    launchContext: {}
  });

  elements['menu-surface'].click();
  assert.equal(resumeGameplayCalls.length, 0);

  elements['overlay'].click();
  assert.equal(resumeGameplayCalls.length, 1);
  assert.equal(resumeGameplayCalls[0].source, 'resume');
});

test('active-match header friend controls mirror the home friend id and reuse the same party actions', async () => {
  const harness = await loadHarness();
  const { elements, runPartyActionCalls } = harness;

  harness.emitSessionState({
    runtimeReady: true,
    inMatch: false,
    awaitingInputCapture: false,
    canResume: true,
    activityState: 'paused',
    launchContext: {}
  });

  elements['active-match-friend-id-input'].value = 'usr_delta';
  elements['active-match-friend-id-input'].input();
  elements['active-match-invite-friend-btn'].click();
  elements['active-match-join-friend-btn'].click();

  assert.equal(elements['party-id-input'].value, 'usr_delta');
  assert.equal(runPartyActionCalls[0].action, 'invite');
  assert.equal(runPartyActionCalls[0].payload.targetId, 'usr_delta');
  assert.equal(runPartyActionCalls[1].action, 'join');
  assert.equal(runPartyActionCalls[1].payload.targetId, 'usr_delta');
});

test('active-match header surfaces visible friend errors and incoming invite actions', async () => {
  const harness = await loadHarness();
  const { elements, runPartyActionCalls } = harness;

  harness.emitSessionState({
    runtimeReady: true,
    inMatch: false,
    awaitingInputCapture: false,
    canResume: true,
    activityState: 'paused',
    launchContext: {}
  });

  elements['active-match-invite-friend-btn'].click();
  assert.equal(elements['active-match-header-feedback'].hidden, false);
  assert.equal(elements['active-match-header-feedback'].textContent, 'Enter a friend ID.');

  harness.emitPartyState({
    self: { id: 'usr_alpha', username: 'ALPHA' },
    directInvite: { incoming: { actorId: 'usr_bravo', displayName: 'BRAVO' }, outgoing: null },
    roomInvite: { incoming: null, outgoing: null },
    party: {
      id: 'pty_alpha',
      leaderId: 'usr_alpha',
      joinLocked: false,
      isLeader: true,
      memberCount: 1,
      members: [{ id: 'usr_alpha', displayName: 'ALPHA', isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' }]
    }
  });

  assert.equal(elements['active-match-primary-banner'].hidden, false);
  assert.equal(elements['active-match-primary-banner-accept-btn'].textContent, 'Accept Invite');
  elements['active-match-primary-banner-accept-btn'].click();
  assert.equal(runPartyActionCalls.at(-1).action, 'accept_invite');
});

test('structured active-match model fills the menu with live mode-aware pills', async () => {
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
  harness.emitMatchMenuModel({
    ready: true,
    banner: null,
    modePill: { label: 'MODE', value: 'TDM' },
    contextPill: { label: 'LEAD', value: '7' },
    primaryPill: { label: 'KILLS', value: '12' },
    secondaryPill: { label: 'DEATHS', value: '3' }
  });

  assert.equal(elements['active-match-mode-pill'].attributes['data-session-label'], 'MODE');
  assert.equal(elements['active-match-mode-pill'].textContent, 'TDM');
  assert.equal(elements['active-match-context-pill'].attributes['data-session-label'], 'LEAD');
  assert.equal(elements['active-match-context-pill'].textContent, '7');
  assert.equal(elements['active-match-primary-stat-pill'].attributes['data-session-label'], 'KILLS');
  assert.equal(elements['active-match-primary-stat-pill'].textContent, '12');
  assert.equal(elements['active-match-secondary-stat-pill'].attributes['data-session-label'], 'DEATHS');
  assert.equal(elements['active-match-secondary-stat-pill'].textContent, '3');
});

test('hidden menu caches structured match model and applies it when the active shell opens', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  harness.emitMatchMenuModel({
    ready: true,
    banner: null,
    modePill: { label: 'MODE', value: 'TDM' },
    contextPill: { label: 'STATE', value: 'WAITING' },
    primaryPill: { label: 'KILLS', value: '2' },
    secondaryPill: { label: 'DEATHS', value: '1' }
  });

  assert.equal(elements['active-match-shell'].hidden, true);

  harness.emitSessionState({
    runtimeReady: true,
    inMatch: false,
    awaitingInputCapture: false,
    canResume: true,
    activityState: 'paused',
    launchContext: {}
  });

  assert.equal(elements['active-match-mode-pill'].textContent, 'TDM');
  assert.equal(elements['active-match-context-pill'].textContent, 'WAITING');
  assert.equal(elements['active-match-primary-stat-pill'].textContent, '2');
  assert.equal(elements['active-match-secondary-stat-pill'].textContent, '1');
});

test('paused fallback hides the empty optional stat slot while keeping the stats shell visible', async () => {
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

  assert.equal(elements['active-match-pill-grid'].hidden, false);
  assert.equal(elements['active-match-mode-pill'].hidden, false);
  assert.equal(elements['active-match-context-pill'].hidden, false);
  assert.equal(elements['active-match-primary-stat-pill'].hidden, false);
  assert.equal(elements['active-match-secondary-stat-pill'].hidden, true);
});

test('active-match hides the stats shell when the structured model has no visible pills', async () => {
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
  harness.emitMatchMenuModel({
    ready: true,
    banner: null,
    modePill: null,
    contextPill: null,
    primaryPill: null,
    secondaryPill: null
  });

  assert.equal(elements['active-match-shell'].hidden, false);
  assert.equal(elements['active-match-pill-grid'].hidden, true);
  assert.equal(elements['active-match-mode-pill'].hidden, true);
  assert.equal(elements['active-match-context-pill'].hidden, true);
  assert.equal(elements['active-match-primary-stat-pill'].hidden, true);
  assert.equal(elements['active-match-secondary-stat-pill'].hidden, true);
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
  assert.equal(elements['active-match-shell'].hidden, false);
});

test('paused escape defers to the active modal instead of refocusing the pause rail', async () => {
  const harness = await loadHarness({ modalOpen: true });
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

  assert.equal(doc.activeElement, null);
  assert.equal(elements['active-match-shell'].hidden, false);
});

test('session-state updates preserve the selected launch mode', async () => {
  const harness = await loadHarness();
  const { elements } = harness;

  elements['game-modes-toggle-btn'].click();
  elements['play-mode-tdm-btn'].click();
  assert.equal(elements['primary-launch-btn'].textContent, 'Play TDM');

  harness.emitSessionState({
    runtimeReady: true,
    inMatch: false,
    awaitingInputCapture: false,
    canResume: true,
    activityState: 'paused',
    launchContext: {}
  });
  harness.emitSessionState({
    runtimeReady: false,
    inMatch: false,
    awaitingInputCapture: false,
    canResume: false,
    activityState: 'menu',
    launchContext: {}
  });

  assert.equal(elements['primary-launch-btn'].textContent, 'Play TDM');
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
