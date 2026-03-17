import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

function createStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(String(key || '')) ? map.get(String(key || '')) : null;
    },
    setItem(key, value) {
      map.set(String(key || ''), String(value || ''));
    },
    removeItem(key) {
      map.delete(String(key || ''));
    }
  };
}

class FakeDocument {
  constructor() {
    this.hidden = false;
    this.visibilityState = 'visible';
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const next = this.listeners.get(key) || [];
    next.push(handler);
    this.listeners.set(key, next);
  }

  removeEventListener(type, handler) {
    const key = String(type || '');
    const next = this.listeners.get(key) || [];
    this.listeners.set(key, next.filter((entry) => entry !== handler));
  }

  dispatch(type) {
    const handlers = this.listeners.get(String(type || '')) || [];
    for (let i = 0; i < handlers.length; i++) {
      handlers[i]({ type, target: this, currentTarget: this });
    }
  }
}

async function loadLobbySessionHarness(options = {}) {
  const code = await fs.readFile(new URL('../../js/app/lobby-session.js', import.meta.url), 'utf8');

  let activityState = 'paused';
  let nextIntervalId = 1;
  const intervalCallbacks = new Map();
  const intervalDelays = new Map();
  const requestCalls = [];
  const partyStatuses = [];
  const friendsStatuses = [];
  const privateRoomStatuses = [];
  const launchAssignedMatches = [];
  const warnCalls = [];
  const document = new FakeDocument();
  const storage = options.storage || createStorage();
  const windowListeners = new Map();

  const window = {
    location: {
      origin: 'https://mayhem.test'
    },
    localStorage: storage,
    setInterval(handler, delay) {
      const id = nextIntervalId++;
      intervalCallbacks.set(id, handler);
      intervalDelays.set(id, Number(delay) || 0);
      return id;
    },
    clearInterval(id) {
      intervalCallbacks.delete(id);
      intervalDelays.delete(id);
    },
    addEventListener(type, handler) {
      const key = String(type || '');
      const next = windowListeners.get(key) || [];
      next.push(handler);
      windowListeners.set(key, next);
    },
    dispatchEvent(event) {
      const payload = event || {};
      const handlers = windowListeners.get(String(payload.type || '')) || [];
      for (let i = 0; i < handlers.length; i++) {
        handlers[i](payload);
      }
      return true;
    },
    removeEventListener(type, handler) {
      const key = String(type || '');
      const next = windowListeners.get(key) || [];
      windowListeners.set(key, next.filter((entry) => entry !== handler));
    }
  };

  const sandbox = {
    Blob,
    URL,
    console: {
      warn(...args) {
        warnCalls.push(args);
      }
    },
    document,
    navigator: {
      sendBeacon() {
        return true;
      }
    },
    window,
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  sandbox.globalThis.window = window;
  sandbox.globalThis.navigator = sandbox.navigator;
  sandbox.globalThis.URL = URL;
  sandbox.globalThis.Blob = Blob;
  sandbox.globalThis.document = document;

  vm.runInContext(code, vm.createContext(sandbox));

  function parseJsonBody(rawBody) {
    if (typeof rawBody !== 'string' || !rawBody.trim()) return null;
    try {
      return JSON.parse(rawBody);
    } catch (_err) {
      return null;
    }
  }

  const session = sandbox.globalThis.__MAYHEM_RUNTIME.GameLobbySession.create({
    lobbyApi: {
      partyPath() {
        return '/api/party';
      },
      privateRoomPath() {
        return '/api/private-room';
      },
      friendsPath() {
        return '/api/friends';
      },
      resolveApiUrl(path) {
        return path;
      },
      requestJson(path, requestOptions) {
        const method = String(requestOptions && requestOptions.method || 'GET').toUpperCase();
        const parsedUrl = new URL(String(path || ''), window.location.origin);
        requestCalls.push({
          method,
          path: String(path || ''),
          url: parsedUrl.toString(),
          pathname: parsedUrl.pathname,
          searchParams: {
            actorId: parsedUrl.searchParams.get('actorId'),
            displayName: parsedUrl.searchParams.get('displayName'),
            activityState: parsedUrl.searchParams.get('activityState')
          },
          body: parseJsonBody(requestOptions && requestOptions.body)
        });
        if (typeof options.requestJson === 'function') {
          return options.requestJson(path, requestOptions);
        }
        return Promise.resolve({ state: null });
      }
    },
    authApi: {
      getPartyIdentity() {
        return { id: 'amber-otter-314', username: 'AMBER-OTTER-314', label: 'Player ID', kind: 'guest' };
      },
      isLoggedIn() {
        return false;
      },
      getUser() {
        return null;
      }
    },
    getActivityState() {
      return activityState;
    },
    setPartyStatus(text, isErr) {
      partyStatuses.push({ text: String(text || ''), isErr: !!isErr });
    },
    setFriendsStatus(text, isErr) {
      friendsStatuses.push({ text: String(text || ''), isErr: !!isErr });
    },
    setPrivateRoomStatus(text, isErr) {
      privateRoomStatuses.push({ text: String(text || ''), isErr: !!isErr });
    },
    launchAssignedMatch(state) {
      launchAssignedMatches.push(state || null);
    }
  });

  return {
    session,
    requestCalls,
    partyStatuses,
    friendsStatuses,
    privateRoomStatuses,
    launchAssignedMatches,
    warnCalls,
    setActivityState(nextState) {
      activityState = String(nextState || 'menu');
    },
    setHidden(hidden) {
      document.hidden = !!hidden;
      document.visibilityState = hidden ? 'hidden' : 'visible';
    },
    dispatchVisibilityChange() {
      document.dispatch('visibilitychange');
    },
    dispatchSessionState(detail) {
      window.dispatchEvent({ type: 'mayhem-session-state', detail });
    },
    getPartyRequestCalls() {
      return requestCalls.filter((call) => call && call.pathname === '/api/party');
    },
    resetRequestCalls() {
      requestCalls.length = 0;
    },
    async flush() {
      await Promise.resolve();
      await Promise.resolve();
    },
    getIntervalDelays() {
      return Array.from(intervalDelays.values());
    },
    runIntervalPass() {
      for (const callback of intervalCallbacks.values()) {
        callback();
      }
    }
  };
}

test('lobby session skips background polling while gameplay is active or paused', async () => {
  const harness = await loadLobbySessionHarness();
  harness.session.start();

  harness.runIntervalPass();
  assert.equal(harness.requestCalls.length, 0);

  harness.setActivityState('menu');
  harness.runIntervalPass();
  assert.equal(harness.requestCalls.length > 0, true);
});

test('lobby session does not poll from hidden menu tabs and resumes when visible again', async () => {
  const harness = await loadLobbySessionHarness();
  harness.setActivityState('menu');
  harness.setHidden(true);
  harness.session.start();

  harness.runIntervalPass();
  assert.equal(harness.requestCalls.length, 0);

  harness.setHidden(false);
  harness.dispatchVisibilityChange();
  assert.equal(harness.requestCalls.length > 0, true);
});

test('lobby session allows only one visible tab to own background polling at a time', async () => {
  const sharedStorage = createStorage();
  const primary = await loadLobbySessionHarness({ storage: sharedStorage });
  const secondary = await loadLobbySessionHarness({ storage: sharedStorage });

  primary.setActivityState('menu');
  secondary.setActivityState('menu');
  primary.session.start();
  secondary.session.start();

  primary.runIntervalPass();
  secondary.runIntervalPass();

  assert.equal(primary.requestCalls.length > 0, true);
  assert.equal(secondary.requestCalls.length, 0);

  primary.setHidden(true);
  primary.dispatchVisibilityChange();
  secondary.runIntervalPass();

  assert.equal(secondary.requestCalls.length > 0, true);
});

test('lobby session refreshBackgroundState is a no-op outside menu and private room lobby states', async () => {
  const harness = await loadLobbySessionHarness();

  harness.session.refreshBackgroundState();
  assert.equal(harness.requestCalls.length, 0);

  harness.setActivityState('private_room_lobby');
  harness.session.refreshBackgroundState();
  assert.equal(harness.requestCalls.length > 0, true);
});

test('lobby session registers responsive visible-menu polling cadences', async () => {
  const harness = await loadLobbySessionHarness();
  harness.session.start();

  assert.deepEqual(
    harness.getIntervalDelays().sort((a, b) => a - b),
    [3000, 3000, 15000]
  );
});

test('lobby session keeps silent background party failures off the visible UI and console', async () => {
  const harness = await loadLobbySessionHarness({
    requestJson() {
      return Promise.reject({ message: 'HTTP 500 at /api/party', status: 500, url: '/api/party' });
    }
  });
  harness.setActivityState('menu');

  await harness.session.refreshPartyState(true);

  assert.equal(harness.partyStatuses.length, 0);
  assert.equal(harness.warnCalls.length, 0);
});

test('lobby session still surfaces manual party failures through status and warning hooks', async () => {
  const harness = await loadLobbySessionHarness({
    requestJson() {
      return Promise.reject({ message: 'HTTP 500 at /api/party', status: 500, url: '/api/party' });
    }
  });
  harness.setActivityState('menu');

  await harness.session.refreshPartyState(false);

  assert.equal(harness.partyStatuses.at(-1).isErr, true);
  assert.match(harness.partyStatuses.at(-1).text, /PARTY SERVICE UNAVAILABLE/i);
  assert.equal(harness.warnCalls.length, 1);
});

test('lobby session sends one silent in-match party sync when gameplay starts', async () => {
  const harness = await loadLobbySessionHarness();
  harness.setActivityState('menu');
  harness.session.start();

  harness.dispatchSessionState({ activityState: 'in_match' });
  await harness.flush();

  const partyCalls = harness.getPartyRequestCalls();
  assert.equal(partyCalls.length, 1);
  assert.equal(partyCalls[0].method, 'GET');
  assert.equal(partyCalls[0].searchParams.activityState, 'in_match');
});

test('lobby session normalizes paused and awaiting-input-capture transitions to in-match without duplicates', async () => {
  const harness = await loadLobbySessionHarness();
  harness.setActivityState('menu');
  harness.session.start();

  harness.dispatchSessionState({ activityState: 'paused' });
  await harness.flush();
  assert.equal(harness.getPartyRequestCalls().length, 1);
  assert.equal(harness.getPartyRequestCalls()[0].searchParams.activityState, 'in_match');

  harness.dispatchSessionState({ activityState: 'awaiting_input_capture' });
  await harness.flush();
  assert.equal(harness.getPartyRequestCalls().length, 1);
});

test('lobby session sends immediate one-shot syncs when gameplay returns to menu or private room lobby', async () => {
  const harness = await loadLobbySessionHarness();
  harness.setActivityState('in_match');
  harness.session.start();

  harness.dispatchSessionState({ activityState: 'menu' });
  await harness.flush();
  assert.equal(harness.getPartyRequestCalls().length, 1);
  assert.equal(harness.getPartyRequestCalls()[0].searchParams.activityState, 'menu');

  harness.resetRequestCalls();
  harness.dispatchSessionState({ activityState: 'private_room_lobby' });
  await harness.flush();
  assert.equal(harness.getPartyRequestCalls().length, 1);
  assert.equal(harness.getPartyRequestCalls()[0].searchParams.activityState, 'private_room_lobby');
});

test('lobby session keeps transition-triggered silent party failures off the visible UI and console', async () => {
  const harness = await loadLobbySessionHarness({
    requestJson() {
      return Promise.reject({ message: 'HTTP 500 at /api/party', status: 500, url: '/api/party' });
    }
  });
  harness.setActivityState('menu');
  harness.session.start();

  harness.dispatchSessionState({ activityState: 'in_match' });
  await harness.flush();

  assert.equal(harness.partyStatuses.length, 0);
  assert.equal(harness.warnCalls.length, 0);
});

test('lobby session triggers auto-launch callback when party state receives a public match assignment', async () => {
  const harness = await loadLobbySessionHarness({
    requestJson() {
      return Promise.resolve({
        state: {
          self: {
            id: 'amber-otter-314',
            username: 'AMBER-OTTER-314',
            publicMatch: {
              roomId: 'tdm-01',
              gameMode: 'tdm',
              assignedByActorId: 'ember-wolf-219',
              assignedAt: 1
            },
            privateRoom: null
          },
          directInvite: { incoming: null, outgoing: null },
          roomInvite: { incoming: null, outgoing: null },
          party: {
            id: 'pty_01',
            leaderId: 'amber-otter-314',
            joinLocked: false,
            isLeader: true,
            memberCount: 1,
            members: [{ id: 'amber-otter-314', displayName: 'AMBER-OTTER-314', isLeader: true }]
          }
        }
      });
    }
  });
  harness.setActivityState('menu');

  await harness.session.refreshPartyState(false);

  assert.equal(harness.launchAssignedMatches.length, 1);
  assert.equal(harness.launchAssignedMatches[0].self.publicMatch.roomId, 'tdm-01');
});
