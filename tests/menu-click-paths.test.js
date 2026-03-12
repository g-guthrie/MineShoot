import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const HARNESS_MODULE_PATHS = [
  '../js/app/lobby-party-view.js',
  '../js/app/lobby-friends-view.js',
  '../js/app/lobby-private-room-view.js',
  '../js/app/menu-launch-orchestrator.js',
  '../js/app/lobby-clickables.js',
  '../js/app/lobby-controller-ui.js',
  '../js/app/lobby-session.js',
  '../js/app/lobby-controller.js'
];

let harnessModuleCodePromise = null;
const MAX_VISITED_STATES_PER_SEED = 24;

async function loadHarnessModuleCode() {
  if (!harnessModuleCodePromise) {
    harnessModuleCodePromise = Promise.all(
      HARNESS_MODULE_PATHS.map(async (modulePath) => ({
        modulePath,
        code: await fs.readFile(new URL(modulePath, import.meta.url), 'utf8')
      }))
    );
  }
  return harnessModuleCodePromise;
}

class FakeElement {
  constructor(tagName = 'div', id = '', registry = null) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.id = id || '';
    this.registry = registry;
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this.listeners = new Map();
    this.attributes = {};
    this.style = {};
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.title = '';
    this.value = '';
    this.type = '';
    this._classSet = new Set();
    this._className = '';
    this.classList = {
      add: (...tokens) => {
        for (let i = 0; i < tokens.length; i++) this._classSet.add(String(tokens[i] || ''));
        this._syncClassName();
      },
      remove: (...tokens) => {
        for (let i = 0; i < tokens.length; i++) this._classSet.delete(String(tokens[i] || ''));
        this._syncClassName();
      },
      toggle: (token, force) => {
        const next = String(token || '');
        const shouldAdd = force === undefined ? !this._classSet.has(next) : !!force;
        if (shouldAdd) this._classSet.add(next);
        else this._classSet.delete(next);
        this._syncClassName();
        return shouldAdd;
      },
      contains: (token) => this._classSet.has(String(token || ''))
    };
    Object.defineProperty(this, 'className', {
      get: () => this._className,
      set: (value) => {
        const next = String(value || '').trim();
        this._classSet = new Set(next ? next.split(/\s+/g) : []);
        this._syncClassName();
      }
    });
    Object.defineProperty(this, 'innerHTML', {
      get: () => '',
      set: (_value) => {
        this.children = [];
        this.childNodes = this.children;
        this.textContent = '';
      }
    });
    if (registry) registry.push(this);
  }

  _syncClassName() {
    this._className = Array.from(this._classSet).filter(Boolean).join(' ');
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

  click() {
    if (this.disabled || !this.isActuallyVisible()) return;
    const handlers = this.listeners.get('click') || [];
    for (let i = 0; i < handlers.length; i++) {
      handlers[i].call(this, {
        type: 'click',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {}
      });
    }
  }

  keydown(key) {
    if (this.disabled || !this.isActuallyVisible()) return;
    const handlers = this.listeners.get('keydown') || [];
    for (let i = 0; i < handlers.length; i++) {
      handlers[i].call(this, {
        type: 'keydown',
        key,
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {}
      });
    }
  }

  isActuallyVisible() {
    let node = this;
    while (node) {
      if (node.hidden) return false;
      if (String(node.style.display || '') === 'none') return false;
      node = node.parentNode;
    }
    return true;
  }
}

function createPartyMember(id, displayName, extra = {}) {
  return {
    id,
    displayName,
    isLeader: !!extra.isLeader,
    isAccount: !!extra.isAccount,
    accountUserId: extra.accountUserId || '',
    username: extra.username || ''
  };
}

function defaultPartyState(selfId, leaderId, members, joinLocked = false, privateRoom = null) {
  return {
    self: {
      id: selfId,
      displayName: selfId,
      username: selfId,
      isAccount: selfId.startsWith('usr_'),
      privateRoom
    },
    party: {
      id: 'pty_' + leaderId,
      leaderId,
      joinLocked,
      isLeader: selfId === leaderId,
      memberCount: members.length,
      members
    }
  };
}

function defaultFriendsState(selfId, friends = []) {
  return {
    self: {
      userId: selfId,
      username: selfId.replace(/^usr_/, ''),
      displayName: selfId.replace(/^usr_/, ''),
      friendCount: friends.length,
      incomingInviteCount: friends.filter((friend) => friend.incomingInvite).length
    },
    friends
  };
}

function defaultPrivateRoomState(actorId, isHost = true) {
  return {
    self: {
      actorId,
      displayName: actorId,
      isHost
    },
    room: {
      roomId: 'private-room1',
      roomCode: 'ROOM1',
      roomMode: 'tdm',
      roomPhase: 'lobby',
      hostActorId: isHost ? actorId : 'usr_host',
      memberCount: 2,
      teams: {
        alpha: [{ id: actorId, displayName: actorId, teamId: 'alpha', isHost }],
        bravo: [{ id: 'usr_friend', displayName: 'FRIEND', teamId: 'bravo', isHost: false }]
      },
      members: [
        { id: actorId, displayName: actorId, teamId: 'alpha', isHost },
        { id: 'usr_friend', displayName: 'FRIEND', teamId: 'bravo', isHost: false }
      ]
    }
  };
}

function createScenario(seed) {
  const baseAccountFriend = {
    userId: 'usr_friend',
    username: 'FRIEND',
    displayName: 'FRIEND',
    isMutual: true,
    online: true,
    activityState: 'menu',
    partyId: 'pty_usr_friend',
    partyLeaderId: 'usr_friend',
    joinLocked: false,
    sameParty: false,
    incomingInvite: false,
    outgoingInvite: false,
    canInvite: true,
    canJoin: true
  };

  const scenarios = {
    guest_idle: {
      identity: { id: 'gst_guest1', username: 'GUEST1', label: 'GUEST ID', kind: 'guest' },
      partyState: defaultPartyState('gst_guest1', 'gst_guest1', [createPartyMember('gst_guest1', 'GUEST1', { isLeader: true })]),
      friendsState: null,
      privateRoomState: null
    },
    guest_party_locked: {
      identity: { id: 'gst_guest2', username: 'GUEST2', label: 'GUEST ID', kind: 'guest' },
      partyState: defaultPartyState('gst_guest2', 'gst_guest2', [
        createPartyMember('gst_guest2', 'GUEST2', { isLeader: true }),
        createPartyMember('gst_guest3', 'WING')
      ], true),
      friendsState: null,
      privateRoomState: null
    },
    guest_private_room_host: {
      identity: { id: 'gst_roomhost', username: 'ROOMHOST', label: 'GUEST ID', kind: 'guest' },
      partyState: defaultPartyState('gst_roomhost', 'gst_roomhost', [createPartyMember('gst_roomhost', 'ROOMHOST', { isLeader: true })], false, {
        roomId: 'private-room1',
        roomMode: 'tdm',
        roomPhase: 'lobby',
        teamId: 'alpha',
        isHost: true
      }),
      friendsState: null,
      privateRoomState: defaultPrivateRoomState('gst_roomhost', true)
    },
    account_idle: {
      identity: { id: 'usr_alpha', username: 'ALPHA', label: 'PLAYER ID', kind: 'account' },
      accountUser: { id: 'usr_alpha', username: 'ALPHA', displayName: 'ALPHA' },
      partyState: defaultPartyState('usr_alpha', 'usr_alpha', [createPartyMember('usr_alpha', 'ALPHA', { isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' })]),
      friendsState: defaultFriendsState('usr_alpha', []),
      privateRoomState: null
    },
    account_friendable_party: {
      identity: { id: 'usr_alpha', username: 'ALPHA', label: 'PLAYER ID', kind: 'account' },
      accountUser: { id: 'usr_alpha', username: 'ALPHA', displayName: 'ALPHA' },
      partyState: defaultPartyState('usr_alpha', 'usr_alpha', [
        createPartyMember('usr_alpha', 'ALPHA', { isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' }),
        createPartyMember('usr_bravo', 'BRAVO', { isAccount: true, accountUserId: 'usr_bravo', username: 'BRAVO' }),
        createPartyMember('gst_delta', 'DELTA')
      ]),
      friendsState: defaultFriendsState('usr_alpha', []),
      privateRoomState: null
    },
    account_friends_mixed: {
      identity: { id: 'usr_alpha', username: 'ALPHA', label: 'PLAYER ID', kind: 'account' },
      accountUser: { id: 'usr_alpha', username: 'ALPHA', displayName: 'ALPHA' },
      partyState: defaultPartyState('usr_alpha', 'usr_alpha', [createPartyMember('usr_alpha', 'ALPHA', { isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' })]),
      friendsState: defaultFriendsState('usr_alpha', [
        { ...baseAccountFriend },
        { ...baseAccountFriend, userId: 'usr_charlie', username: 'CHARLIE', displayName: 'CHARLIE', incomingInvite: true, canJoin: false },
        { ...baseAccountFriend, userId: 'usr_echo', username: 'ECHO', displayName: 'ECHO', online: false, canJoin: false }
      ]),
      privateRoomState: null
    },
    account_party_locked: {
      identity: { id: 'usr_alpha', username: 'ALPHA', label: 'PLAYER ID', kind: 'account' },
      accountUser: { id: 'usr_alpha', username: 'ALPHA', displayName: 'ALPHA' },
      partyState: defaultPartyState('usr_alpha', 'usr_alpha', [
        createPartyMember('usr_alpha', 'ALPHA', { isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' }),
        createPartyMember('usr_bravo', 'BRAVO', { isAccount: true, accountUserId: 'usr_bravo', username: 'BRAVO' })
      ], true),
      friendsState: defaultFriendsState('usr_alpha', [{ ...baseAccountFriend, joinLocked: true, canJoin: false }]),
      privateRoomState: null
    },
    account_private_room_host: {
      identity: { id: 'usr_alpha', username: 'ALPHA', label: 'PLAYER ID', kind: 'account' },
      accountUser: { id: 'usr_alpha', username: 'ALPHA', displayName: 'ALPHA' },
      partyState: defaultPartyState('usr_alpha', 'usr_alpha', [
        createPartyMember('usr_alpha', 'ALPHA', { isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' }),
        createPartyMember('usr_friend', 'FRIEND', { isAccount: true, accountUserId: 'usr_friend', username: 'FRIEND' })
      ], false, {
        roomId: 'private-room1',
        roomMode: 'tdm',
        roomPhase: 'lobby',
        teamId: 'alpha',
        isHost: true
      }),
      friendsState: defaultFriendsState('usr_alpha', [{ ...baseAccountFriend, sameParty: true, canJoin: false }]),
      privateRoomState: defaultPrivateRoomState('usr_alpha', true)
    },
    account_private_room_member: {
      identity: { id: 'usr_member', username: 'MEMBER', label: 'PLAYER ID', kind: 'account' },
      accountUser: { id: 'usr_member', username: 'MEMBER', displayName: 'MEMBER' },
      partyState: defaultPartyState('usr_member', 'usr_host', [
        createPartyMember('usr_host', 'HOST', { isLeader: true, isAccount: true, accountUserId: 'usr_host', username: 'HOST' }),
        createPartyMember('usr_member', 'MEMBER', { isAccount: true, accountUserId: 'usr_member', username: 'MEMBER' })
      ], false, {
        roomId: 'private-room1',
        roomMode: 'tdm',
        roomPhase: 'lobby',
        teamId: 'bravo',
        isHost: false
      }),
      friendsState: defaultFriendsState('usr_member', [{ ...baseAccountFriend, userId: 'usr_host', username: 'HOST', displayName: 'HOST', sameParty: true, canJoin: false }]),
      privateRoomState: defaultPrivateRoomState('usr_member', false)
    },
    account_incoming_invite: {
      identity: { id: 'usr_alpha', username: 'ALPHA', label: 'PLAYER ID', kind: 'account' },
      accountUser: { id: 'usr_alpha', username: 'ALPHA', displayName: 'ALPHA' },
      partyState: defaultPartyState('usr_alpha', 'usr_alpha', [createPartyMember('usr_alpha', 'ALPHA', { isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' })]),
      friendsState: defaultFriendsState('usr_alpha', [{ ...baseAccountFriend, incomingInvite: true, canJoin: false }]),
      privateRoomState: null
    },
    account_outgoing_invite: {
      identity: { id: 'usr_alpha', username: 'ALPHA', label: 'PLAYER ID', kind: 'account' },
      accountUser: { id: 'usr_alpha', username: 'ALPHA', displayName: 'ALPHA' },
      partyState: defaultPartyState('usr_alpha', 'usr_alpha', [createPartyMember('usr_alpha', 'ALPHA', { isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' })]),
      friendsState: defaultFriendsState('usr_alpha', [{ ...baseAccountFriend, outgoingInvite: true, canJoin: false }]),
      privateRoomState: null
    },
    account_large_party: {
      identity: { id: 'usr_alpha', username: 'ALPHA', label: 'PLAYER ID', kind: 'account' },
      accountUser: { id: 'usr_alpha', username: 'ALPHA', displayName: 'ALPHA' },
      partyState: defaultPartyState('usr_alpha', 'usr_alpha', [
        createPartyMember('usr_alpha', 'ALPHA', { isLeader: true, isAccount: true, accountUserId: 'usr_alpha', username: 'ALPHA' }),
        createPartyMember('usr_b1', 'B1', { isAccount: true, accountUserId: 'usr_b1', username: 'B1' }),
        createPartyMember('usr_b2', 'B2', { isAccount: true, accountUserId: 'usr_b2', username: 'B2' }),
        createPartyMember('usr_b3', 'B3', { isAccount: true, accountUserId: 'usr_b3', username: 'B3' }),
        createPartyMember('usr_b4', 'B4', { isAccount: true, accountUserId: 'usr_b4', username: 'B4' })
      ]),
      friendsState: defaultFriendsState('usr_alpha', []),
      privateRoomState: null
    }
  };
  return JSON.parse(JSON.stringify(scenarios[seed]));
}

async function createHarness(seedName, options = {}) {
  const registry = [];
  const seed = createScenario(seedName);
  const ids = [
    'mode-buttons', 'alt-mode-toggle', 'controls-menu', 'controls-toggle', 'primary-play-btn', 'tdm-play-btn', 'lms-play-btn',
    'create-private-room-btn', 'private-room-input',
    'join-private-room-btn', 'room-access-status', 'room-share-panel', 'room-share-code', 'copy-room-code-btn', 'room-code-badge',
    'room-code-badge-value', 'mode-subtitle', 'menu-party-id-btn', 'menu-party-id-label', 'menu-party-id-value', 'party-join-lock-btn',
    'party-join-lock-icon', 'party-join-lock-note', 'social-tab-party-btn', 'social-tab-friends-btn', 'social-tab-room-btn',
    'party-panel-subtitle', 'party-id-input', 'join-party-btn', 'party-status', 'party-roster-preview-shell', 'party-roster-preview', 'view-party-btn', 'leave-party-btn',
    'party-social-view', 'friends-social-view', 'friends-status', 'friends-preview', 'view-friends-btn', 'refresh-friends-btn',
    'friends-overlay', 'friends-close-btn', 'friends-modal-content', 'party-roster-overlay', 'party-roster-modal-content',
    'party-roster-close-btn', 'party-link-view', 'private-room-view', 'private-room-status', 'private-room-summary',
    'private-room-mode-ffa-btn', 'private-room-mode-tdm-btn', 'private-room-mode-lms-btn', 'private-room-randomize-btn',
    'private-room-start-btn', 'private-room-team-alpha', 'private-room-team-bravo', 'menu-session-actions'
  ];
  const elements = {};
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const tagName = id.includes('input') ? 'input' : (id.includes('btn') ? 'button' : 'div');
    elements[id] = new FakeElement(tagName, id, registry);
  }
  elements['mode-buttons'].hidden = true;
  elements['controls-menu'].hidden = true;
  elements['party-roster-overlay'].hidden = true;
  elements['friends-overlay'].hidden = true;
  elements['friends-social-view'].hidden = true;
  elements['private-room-view'].hidden = true;
  elements['social-tab-room-btn'].hidden = true;

  const modeButtons = [
    new FakeElement('button', 'mode-single-cloudflare-btn', registry),
    new FakeElement('button', 'mode-single-dev-server-btn', registry)
  ];
  modeButtons[0].className = 'mode-btn';
  modeButtons[0].dataset.modeId = 'single_cloudflare';
  modeButtons[1].className = 'mode-btn';
  modeButtons[1].dataset.modeId = 'single_dev_server';
  elements['mode-buttons'].appendChild(modeButtons[0]);
  elements['mode-buttons'].appendChild(modeButtons[1]);

  const document = {
    head: new FakeElement('head', 'head', registry),
    body: new FakeElement('body', 'body', registry),
    getElementById(id) {
      return elements[id] || null;
    },
    createElement(tagName) {
      return new FakeElement(tagName, '', registry);
    },
    querySelectorAll(selector) {
      if (selector === '#mode-buttons .mode-btn[data-mode-id]') return modeButtons;
      const classes = String(selector || '').split(',').map((part) => part.trim().replace(/^\./, '')).filter(Boolean);
      if (!classes.length) return [];
      return registry.filter((element) => {
        if (!element.className) return false;
        const tokens = String(element.className || '').split(/\s+/g);
        for (let i = 0; i < classes.length; i++) {
          if (tokens.includes(classes[i])) return true;
        }
        return false;
      });
    }
  };

  const windowListeners = new Map();
  let nextTimerId = 1;
  const timeoutQueue = [];
  const windowObj = {
    location: { origin: 'http://menu.test', search: '' },
    setTimeout(handler) {
      const id = nextTimerId++;
      timeoutQueue.push({ id, handler });
      return id;
    },
    clearTimeout(id) {
      const idx = timeoutQueue.findIndex((entry) => entry.id === id);
      if (idx >= 0) timeoutQueue.splice(idx, 1);
    },
    setInterval() { return 1; },
    clearInterval() {},
    addEventListener(type, handler) {
      const list = windowListeners.get(type) || [];
      list.push(handler);
      windowListeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = windowListeners.get(type) || [];
      const next = list.filter((entry) => entry !== handler);
      if (next.length) windowListeners.set(type, next);
      else windowListeners.delete(type);
    },
    dispatchEvent(event) {
      const type = event && event.type ? event.type : '';
      const list = windowListeners.get(type) || [];
      for (let i = 0; i < list.length; i++) list[i](event);
    },
    navigator: {
      sendBeacon() { return true; },
      clipboard: { writeText() { return Promise.resolve(); } }
    }
  };

  const backend = {
    seed,
    quickCounter: 0,
    privateRoomGetCount: 0,
    refreshFriends() {
      if (this.seed.friendsState && this.seed.accountUser) {
        this.seed.friendsState.self.friendCount = this.seed.friendsState.friends.length;
        this.seed.friendsState.self.incomingInviteCount = this.seed.friendsState.friends.filter((friend) => friend.incomingInvite).length;
      }
    },
    makePartyState() {
      return JSON.parse(JSON.stringify(this.seed.partyState));
    },
    makeFriendsState() {
      this.refreshFriends();
      return this.seed.friendsState ? JSON.parse(JSON.stringify(this.seed.friendsState)) : null;
    },
    makePrivateRoomState() {
      return this.seed.privateRoomState ? JSON.parse(JSON.stringify(this.seed.privateRoomState)) : null;
    },
    partyPost(payload) {
      const action = String(payload.action || '');
      const previousState = this.makePartyState();
      if (action === 'lock') {
        this.seed.partyState.party.joinLocked = !!payload.locked;
      } else if (action === 'leave') {
        this.seed.partyState.party.members = [this.seed.partyState.party.members[0]];
        this.seed.partyState.party.memberCount = 1;
      } else if (action === 'join') {
        const targetId = String(payload.targetId || '').trim();
        if (targetId && !this.seed.partyState.party.members.find((member) => String(member.id) === targetId)) {
          this.seed.partyState.party.members.push(createPartyMember(targetId, targetId));
          this.seed.partyState.party.memberCount = this.seed.partyState.party.members.length;
        }
      }
      if (action === 'lock' && optionsArg.staleLockPostResponse) {
        return { state: previousState };
      }
      return { state: this.makePartyState() };
    },
    friendsPost(payload) {
      if (!this.seed.friendsState) return { friends: null };
      const action = String(payload.action || '');
      const targetUserId = String(payload.targetUserId || '').trim();
      if (action === 'add' && targetUserId) {
        if (!this.seed.friendsState.friends.find((friend) => friend.userId === targetUserId)) {
          this.seed.friendsState.friends.push({
            userId: targetUserId,
            username: targetUserId.replace(/^usr_/, ''),
            displayName: targetUserId.replace(/^usr_/, ''),
            isMutual: false,
            online: true,
            activityState: 'menu',
            partyId: '',
            partyLeaderId: '',
            joinLocked: false,
            sameParty: false,
            incomingInvite: false,
            outgoingInvite: false,
            canInvite: true,
            canJoin: false
          });
        }
      } else if (action === 'invite' && targetUserId) {
        const friend = this.seed.friendsState.friends.find((entry) => entry.userId === targetUserId);
        if (friend) friend.outgoingInvite = true;
      } else if (action === 'dismiss_invite' && targetUserId) {
        const friend = this.seed.friendsState.friends.find((entry) => entry.userId === targetUserId);
        if (friend) friend.incomingInvite = false;
      } else if ((action === 'accept_invite' || action === 'join') && targetUserId) {
        const friend = this.seed.friendsState.friends.find((entry) => entry.userId === targetUserId);
        if (friend) {
          friend.incomingInvite = false;
          friend.sameParty = true;
          friend.canJoin = false;
        }
        this.seed.partyState.party.members.push(createPartyMember(targetUserId, targetUserId.replace(/^usr_/, ''), {
          isAccount: true,
          accountUserId: targetUserId,
          username: targetUserId.replace(/^usr_/, '')
        }));
        this.seed.partyState.party.memberCount = this.seed.partyState.party.members.length;
      }
      return {
        friends: this.makeFriendsState(),
        state: action === 'accept_invite' || action === 'join' ? this.makePartyState() : undefined
      };
    },
    privateRoomPost(payload) {
      const action = String(payload.action || '');
      if (action === 'create' || action === 'join') {
        this.seed.privateRoomState = defaultPrivateRoomState(this.seed.identity.id, true);
        this.seed.partyState.self.privateRoom = {
          roomId: 'private-room1',
          roomMode: 'tdm',
          roomPhase: 'lobby',
          teamId: 'alpha',
          isHost: true
        };
        if (optionsArg.stalePrivateRoomJoinPostResponse) {
          const staleState = this.makePrivateRoomState();
          staleState.room.roomMode = 'ffa';
          staleState.room.roomPhase = 'active';
          return { state: staleState, movedCount: 1, skippedCount: 0 };
        }
        return { state: this.makePrivateRoomState(), movedCount: 1, skippedCount: 0 };
      }
      if (!this.seed.privateRoomState) this.seed.privateRoomState = defaultPrivateRoomState(this.seed.identity.id, true);
      if (action === 'set_mode') {
        this.seed.privateRoomState.room.roomMode = String(payload.roomMode || 'ffa');
      } else if (action === 'start') {
        this.seed.privateRoomState.room.roomPhase = 'active';
      } else if (action === 'move_member') {
        const targetId = String(payload.targetId || '');
        const teamId = String(payload.teamId || 'alpha');
        const teams = this.seed.privateRoomState.room.teams;
        teams.alpha = teams.alpha.filter((member) => String(member.id) !== targetId);
        teams.bravo = teams.bravo.filter((member) => String(member.id) !== targetId);
        teams[teamId].push({ id: targetId, displayName: targetId, teamId, isHost: false });
      }
      return { state: this.makePrivateRoomState(), movedCount: 0, skippedCount: 0 };
    },
    requestJson(path, options = {}) {
      const url = new URL(String(path || ''), 'http://menu.test');
      const method = String(options.method || 'GET').toUpperCase();
      const body = options.body ? JSON.parse(options.body) : null;
      if (url.pathname === '/api/party' && method === 'GET' && optionsArg.failPartyGet) return Promise.reject(Object.assign(new Error('party offline'), { status: 404, url: url.pathname }));
      if (url.pathname === '/api/friends' && method === 'GET' && optionsArg.failFriendsGet) return Promise.reject(Object.assign(new Error('friends offline'), { status: 404, url: url.pathname }));
      if (url.pathname === '/api/private-room' && method === 'GET' && optionsArg.failPrivateRoomGet) return Promise.reject(Object.assign(new Error('private room offline'), { status: 404, url: url.pathname }));
      if (url.pathname === '/api/party' && method === 'GET') return Promise.resolve({ state: this.makePartyState() });
      if (url.pathname === '/api/party' && method === 'POST') return Promise.resolve(this.partyPost(body || {}));
      if (url.pathname === '/api/friends' && method === 'GET') return Promise.resolve({ friends: this.makeFriendsState() });
      if (url.pathname === '/api/friends' && method === 'POST') return Promise.resolve(this.friendsPost(body || {}));
      if (url.pathname === '/api/private-room' && method === 'GET') {
        this.privateRoomGetCount += 1;
        return Promise.resolve({ state: this.makePrivateRoomState() });
      }
      if (url.pathname === '/api/private-room' && method === 'POST') return Promise.resolve(this.privateRoomPost(body || {}));
      if (url.pathname === '/api/matchmaking' && method === 'POST') {
        const action = String(body && body.action || '');
        if (action === 'quick') {
          this.quickCounter += 1;
          return Promise.resolve({
            ok: true,
            roomId: String(body && body.gameMode || 'ffa') + '-' + String(this.quickCounter).padStart(2, '0'),
            privacy: 'public',
            modeId: 'cloud_multiplayer',
            gameMode: String(body && body.gameMode || 'ffa')
          });
        }
      }
      return Promise.resolve({ ok: true, state: null });
    }
  };

  let gameplayPromptCount = 0;
  let startGameplayCount = 0;
  let prepareLaunchCount = 0;
  let inputCapturePromptCount = 0;
  let returnToMenuCount = 0;
  const runtime = {
    GameLobbyApi: {
      resolveApiUrl(path) { return path; },
      partyPath() { return '/api/party'; },
      privateRoomPath() { return '/api/private-room'; },
      matchmakingPath() { return '/api/matchmaking'; },
      friendsPath() { return '/api/friends'; },
      requestJson(path, options) { return backend.requestJson(path, options); }
    },
    GameNetAuth: {
      getPartyIdentity() { return JSON.parse(JSON.stringify(seed.identity)); },
      isLoggedIn() { return !!seed.accountUser; },
      getUser() { return seed.accountUser ? JSON.parse(JSON.stringify(seed.accountUser)) : null; },
      getOwnProfile() { return seed.accountUser ? { displayName: seed.accountUser.displayName } : null; }
    },
    GameSession: {
      prepareLaunch() {
        prepareLaunchCount += 1;
      },
      enterGameplay() {
        startGameplayCount += 1;
        return Promise.resolve({
          ok: true,
          entered: optionsArg.enterGameplayEntered !== false
        });
      },
      resumeGameplay() {
        startGameplayCount += 1;
        return Promise.resolve({
          ok: true,
          entered: optionsArg.enterGameplayEntered !== false
        });
      },
      showInputCapturePrompt() {
        inputCapturePromptCount += 1;
      },
      hideInputCapturePrompt() {},
      returnToMenu() {
        returnToMenuCount += 1;
      },
      startGameplayFromMenu() {},
      showGameplayPrompt() {
        gameplayPromptCount += 1;
      }
    }
  };

  const optionsArg = options || {};
  const sandbox = {
    globalThis: { __MAYHEM_RUNTIME: runtime },
    window: windowObj,
    document,
    navigator: windowObj.navigator,
    console,
    URL,
    CustomEvent: class { constructor(type) { this.type = type; } },
    Blob: class {},
    setTimeout,
    clearTimeout,
    Promise
  };
  const context = vm.createContext(sandbox);
  const moduleSources = await loadHarnessModuleCode();
  for (let i = 0; i < moduleSources.length; i++) {
    vm.runInContext(moduleSources[i].code, context);
  }
  sandbox.globalThis.__MAYHEM_RUNTIME.GameLobbyController.init({
    prepareMenu() {},
    launchModeById(modeId, launchOptions) {
      return {
        ok: true,
        mode: {
          id: modeId,
          roomId: launchOptions && launchOptions.roomId ? launchOptions.roomId : '',
          gameMode: launchOptions && launchOptions.gameMode ? launchOptions.gameMode : ''
        }
      };
    },
    setRuntimeIndicator() {},
    getActivityState() { return 'menu'; }
  });

  async function drainMicrotasks(rounds = 20) {
    for (let i = 0; i < rounds; i++) {
      await Promise.resolve();
    }
  }

  async function flush() {
    await drainMicrotasks();
    while (timeoutQueue.length) {
      const batch = timeoutQueue.splice(0, timeoutQueue.length);
      for (let i = 0; i < batch.length; i++) {
        const handler = batch[i] && batch[i].handler;
        if (typeof handler === 'function') handler();
      }
      await drainMicrotasks();
    }
    await drainMicrotasks();
  }

  await flush();

  function snapshot() {
    const keys = [
      'mode-buttons', 'controls-menu', 'party-social-view', 'friends-social-view', 'private-room-view',
      'party-roster-overlay', 'friends-overlay', 'social-tab-room-btn', 'mode-subtitle', 'menu-party-id-value', 'party-join-lock-note',
      'party-roster-preview-shell', 'party-join-lock-btn', 'view-party-btn', 'leave-party-btn',
      'view-friends-btn', 'refresh-friends-btn', 'private-room-mode-ffa-btn', 'private-room-mode-tdm-btn',
      'private-room-mode-lms-btn', 'private-room-randomize-btn', 'private-room-start-btn', 'private-room-summary',
      'room-access-status', 'party-status', 'friends-status', 'private-room-status', 'menu-session-actions'
    ];
    const dom = {};
    for (let i = 0; i < keys.length; i++) {
      const el = elements[keys[i]];
      dom[keys[i]] = {
        hidden: !!el.hidden,
        disabled: !!el.disabled,
        display: String(el.style.display || ''),
        text: String(el.textContent || '')
      };
    }
    return JSON.stringify({
      seed: seedName,
      dom,
      partyCount: backend.seed.partyState && backend.seed.partyState.party ? backend.seed.partyState.party.memberCount : 0,
      partyLocked: !!(backend.seed.partyState && backend.seed.partyState.party && backend.seed.partyState.party.joinLocked),
      friendCount: backend.seed.friendsState && Array.isArray(backend.seed.friendsState.friends) ? backend.seed.friendsState.friends.length : 0,
      privateRoom: backend.seed.privateRoomState ? {
        mode: backend.seed.privateRoomState.room.roomMode,
        phase: backend.seed.privateRoomState.room.roomPhase
      } : null
    });
  }

  function visibleButtons() {
    return registry.filter((element) => element.tagName === 'BUTTON' && element.isActuallyVisible() && !element.disabled);
  }

  function actions() {
    const out = [];
    const buttons = visibleButtons();
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      if (!button.id) continue;
      if (button.id === 'join-party-btn') {
        out.push({
          name: 'join-party-empty',
          run: async () => {
            elements['party-id-input'].value = '';
            button.click();
            await flush();
          }
        });
        out.push({
          name: 'join-party-filled',
          run: async () => {
            elements['party-id-input'].value = 'usr_target';
            button.click();
            await flush();
          }
        });
        continue;
      }
      if (button.id === 'join-private-room-btn') {
        out.push({
          name: 'join-room-empty',
          run: async () => {
            elements['private-room-input'].value = '';
            button.click();
            await flush();
          }
        });
        out.push({
          name: 'join-room-filled',
          run: async () => {
            elements['private-room-input'].value = 'ROOM1';
            button.click();
            await flush();
          }
        });
        continue;
      }
      out.push({
        name: button.id,
        run: async () => {
          button.click();
          await flush();
        }
      });
    }
    if (elements['party-id-input'].isActuallyVisible() && !elements['party-id-input'].disabled) {
      out.push({
        name: 'party-enter',
        run: async () => {
          elements['party-id-input'].value = 'usr_target';
          elements['party-id-input'].keydown('Enter');
          await flush();
        }
      });
    }
    if (elements['private-room-input'].isActuallyVisible() && !elements['private-room-input'].disabled) {
      out.push({
        name: 'room-enter',
        run: async () => {
          elements['private-room-input'].value = 'ROOM1';
          elements['private-room-input'].keydown('Enter');
          await flush();
        }
      });
    }
    return out;
  }

  async function dispatchWindow(type) {
    windowObj.dispatchEvent({ type: String(type || '') });
    await flush();
  }

  return {
    snapshot,
    actions,
    dispatchWindow,
    privateRoomGetCount() { return backend.privateRoomGetCount; },
    gameplayPromptCount() { return gameplayPromptCount; },
    startGameplayCount() { return startGameplayCount; },
    prepareLaunchCount() { return prepareLaunchCount; },
    inputCapturePromptCount() { return inputCapturePromptCount; },
    returnToMenuCount() { return returnToMenuCount; }
  };
}

async function traverseSeed(seedName) {
  const harness = await createHarness(seedName);
  const queue = [{ history: [], snapshot: harness.snapshot(), harness }];
  const seen = new Set();
  let visitedStates = 0;

  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current.snapshot)) continue;
    seen.add(current.snapshot);
    visitedStates += 1;
    if (visitedStates > MAX_VISITED_STATES_PER_SEED) break;
    const currentActions = current.harness.actions();
    for (let i = 0; i < currentActions.length; i++) {
      const nextHarness = await createHarness(seedName);
      const replay = current.history.concat(currentActions[i].name);
      try {
        for (let j = 0; j < replay.length; j++) {
          const available = nextHarness.actions();
          const step = available.find((action) => action.name === replay[j]);
          if (!step) break;
          await step.run();
        }
      } catch (err) {
        throw new Error(seedName + ' path failed on ' + replay.join(' -> ') + ': ' + (err && err.stack ? err.stack : err));
      }
      queue.push({
        history: replay,
        snapshot: nextHarness.snapshot(),
        harness: nextHarness
      });
    }
  }

  return visitedStates;
}

test('menu click traversal covers 12 seeded menu states without controller crashes', async () => {
  const seeds = [
    'guest_idle',
    'guest_party_locked',
    'guest_private_room_host',
    'account_idle',
    'account_friendable_party',
    'account_friends_mixed',
    'account_party_locked',
    'account_private_room_host',
    'account_private_room_member',
    'account_incoming_invite',
    'account_outgoing_invite',
    'account_large_party'
  ];

  let totalStates = 0;
  for (let i = 0; i < seeds.length; i++) {
    totalStates += await traverseSeed(seeds[i]);
  }
  assert.ok(totalStates >= seeds.length, 'Expected traversal to visit at least one state per seed');
});

test('party preview shell remains visible when party data exists, including solo parties', async () => {
  const soloHarness = await createHarness('guest_idle');
  const soloSnapshot = JSON.parse(soloHarness.snapshot());
  assert.equal(soloSnapshot.dom['party-roster-preview-shell'].hidden, false);

  const partyHarness = await createHarness('account_large_party');
  const partySnapshot = JSON.parse(partyHarness.snapshot());
  assert.equal(partySnapshot.dom['party-roster-preview-shell'].hidden, false);
});

test('controller keeps leader lock and private-room controls interactive from a single state owner', async () => {
  const leaderHarness = await createHarness('guest_idle');
  let snap = JSON.parse(leaderHarness.snapshot());
  assert.equal(snap.dom['party-join-lock-btn'].disabled, false);
  assert.equal(snap.dom['view-party-btn'].disabled, true);
  assert.equal(snap.dom['leave-party-btn'].disabled, true);
  assert.equal(snap.dom['social-tab-room-btn'].hidden, true);

  const toggleLock = leaderHarness.actions().find((action) => action.name === 'party-join-lock-btn');
  assert.ok(toggleLock, 'Expected party lock action');
  await toggleLock.run();

  snap = JSON.parse(leaderHarness.snapshot());
  assert.equal(snap.partyLocked, true);
  assert.equal(snap.dom['party-join-lock-note'].text, 'PARTY CLOSED');
  assert.equal(snap.dom['party-join-lock-btn'].disabled, false);

  const hostHarness = await createHarness('account_private_room_host');
  snap = JSON.parse(hostHarness.snapshot());
  assert.equal(snap.dom['social-tab-room-btn'].hidden, false);
  assert.equal(snap.dom['private-room-view'].hidden, false);
  assert.equal(snap.dom['private-room-mode-ffa-btn'].disabled, false);
  assert.equal(snap.dom['private-room-mode-tdm-btn'].disabled, false);
  assert.equal(snap.dom['private-room-mode-lms-btn'].disabled, false);
  assert.equal(snap.dom['private-room-randomize-btn'].disabled, false);
  assert.equal(snap.dom['private-room-start-btn'].disabled, false);
});

test('silent party sync failures surface an offline state instead of collapsing to a blank shell', async () => {
  const harness = await createHarness('guest_idle', { failPartyGet: true, failFriendsGet: true });
  let snap = JSON.parse(harness.snapshot());
  assert.match(snap.dom['party-status'].text, /PARTY .*RETRYING/);
  assert.equal(snap.dom['friends-status'].text, '');
  assert.equal(snap.dom['party-roster-preview-shell'].hidden, false);

  await harness.dispatchWindow('focus');

  snap = JSON.parse(harness.snapshot());
  assert.match(snap.dom['party-status'].text, /PARTY .*RETRYING/);
  assert.equal(snap.dom['friends-status'].text, '');
  assert.equal(snap.dom['party-roster-preview-shell'].hidden, false);
});

test('silent private room sync failures keep the room surface visible and marked unavailable', async () => {
  const harness = await createHarness('account_private_room_host', { failPrivateRoomGet: true });
  let snap = JSON.parse(harness.snapshot());
  assert.equal(snap.dom['social-tab-room-btn'].hidden, false);
  assert.equal(snap.dom['private-room-view'].hidden, false);
  assert.match(snap.dom['private-room-status'].text, /PRIVATE ROOM .*RETRYING/);

  await harness.dispatchWindow('focus');

  snap = JSON.parse(harness.snapshot());
  assert.equal(snap.dom['social-tab-room-btn'].hidden, false);
  assert.equal(snap.dom['private-room-view'].hidden, false);
  assert.match(snap.dom['private-room-status'].text, /PRIVATE ROOM .*RETRYING/);
});

test('focus refresh does not double-fetch private room state', async () => {
  const harness = await createHarness('account_private_room_host');
  const initialCount = harness.privateRoomGetCount();

  await harness.dispatchWindow('focus');

  assert.equal(harness.privateRoomGetCount(), initialCount + 1);
});

test('party lock action reconciles stale post payloads against canonical party state', async () => {
  const harness = await createHarness('account_friendable_party', { staleLockPostResponse: true });
  const toggleLock = harness.actions().find((action) => action.name === 'party-join-lock-btn');
  assert.ok(toggleLock, 'Expected party lock action');

  await toggleLock.run();

  const snap = JSON.parse(harness.snapshot());
  assert.equal(snap.partyLocked, true);
  assert.equal(snap.dom['party-join-lock-note'].text, 'PARTY CLOSED');
  assert.equal(snap.dom['party-status'].text, 'Party locked.');
});

test('private room join reconciles stale post payloads against canonical room state', async () => {
  const harness = await createHarness('guest_idle', { stalePrivateRoomJoinPostResponse: true });
  const joinRoom = harness.actions().find((action) => action.name === 'join-room-filled');
  assert.ok(joinRoom, 'Expected private room join action');

  await joinRoom.run();

  const snap = JSON.parse(harness.snapshot());
  assert.equal(snap.privateRoom && snap.privateRoom.mode, 'tdm');
  assert.match(snap.dom['private-room-summary'].text, /MODE TDM/);
});

test('quick match launch preps the prompt and immediately starts gameplay after room allocation', async () => {
  const harness = await createHarness('guest_idle');
  const launchQuickMatch = harness.actions().find((action) => action.name === 'primary-play-btn');
  assert.ok(launchQuickMatch, 'Expected quick match action');
  await launchQuickMatch.run();

  assert.equal(harness.prepareLaunchCount(), 1);
  assert.equal(harness.startGameplayCount(), 1);
  assert.equal(harness.inputCapturePromptCount(), 0);
});

test('launch flow falls back to explicit input capture prompt when gameplay entry is blocked', async () => {
  const harness = await createHarness('guest_idle', { enterGameplayEntered: false });
  const launchQuickMatch = harness.actions().find((action) => action.name === 'primary-play-btn');
  assert.ok(launchQuickMatch, 'Expected quick match action');
  await launchQuickMatch.run();

  const snap = JSON.parse(harness.snapshot());
  assert.equal(harness.prepareLaunchCount(), 1);
  assert.equal(harness.startGameplayCount(), 1);
  assert.equal(harness.inputCapturePromptCount(), 1);
  assert.equal(snap.dom['room-access-status'].text, 'Match ready. Click ENTER MATCH.');
  assert.equal(snap.dom['menu-session-actions'].hidden, false);
});
