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
    removeEventListener(type, handler) {
      const key = String(type || '');
      const next = windowListeners.get(key) || [];
      windowListeners.set(key, next.filter((entry) => entry !== handler));
    }
  };

  const sandbox = {
    Blob,
    URL,
    console,
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
      requestJson(path) {
        requestCalls.push(String(path || ''));
        return Promise.resolve({ state: null });
      }
    },
    authApi: {
      getPartyIdentity() {
        return { id: 'guest_01', username: 'Guest 01', kind: 'guest' };
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
    }
  });

  return {
    session,
    requestCalls,
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
