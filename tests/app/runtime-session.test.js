import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class FakeElement {
  constructor(id = '', doc = null) {
    this.id = id;
    this.ownerDocument = doc;
    this.hidden = false;
    this.textContent = '';
    this.style = {};
    this.attributes = {};
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
    const next = (this.listeners.get(key) || []).filter((fn) => fn !== handler);
    this.listeners.set(key, next);
  }

  focus() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }

  setAttribute(name, value) {
    this.attributes[String(name || '')] = String(value || '');
  }

  removeAttribute(name) {
    delete this.attributes[String(name || '')];
  }

  getAttribute(name) {
    return this.attributes[String(name || '')];
  }

  dispatch(type, event = {}) {
    const handlers = this.listeners.get(String(type || '')) || [];
    for (let i = 0; i < handlers.length; i++) {
      handlers[i].call(this, {
        type,
        target: this,
        currentTarget: this,
        button: 0,
        preventDefault() {},
        stopPropagation() {},
        ...event
      });
    }
  }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
    this.pointerLockElement = null;
    this.elements = {};
    this.activeElement = null;
    this.readyState = 'complete';
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const next = this.listeners.get(key) || [];
    next.push(handler);
    this.listeners.set(key, next);
  }

  removeEventListener(type, handler) {
    const key = String(type || '');
    const next = (this.listeners.get(key) || []).filter((fn) => fn !== handler);
    this.listeners.set(key, next);
  }

  getElementById(id) {
    return this.elements[String(id || '')] || null;
  }

  dispatch(type, event = {}) {
    const handlers = this.listeners.get(String(type || '')) || [];
    for (let i = 0; i < handlers.length; i++) {
      handlers[i].call(this, {
        type,
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        ...event
      });
    }
  }

  exitPointerLock() {
    this.pointerLockElement = null;
    this.dispatch('pointerlockchange');
  }
}

class FakeWindow {
  constructor() {
    this.listeners = new Map();
    this.events = [];
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const next = this.listeners.get(key) || [];
    next.push(handler);
    this.listeners.set(key, next);
  }

  removeEventListener(type, handler) {
    const key = String(type || '');
    const next = (this.listeners.get(key) || []).filter((fn) => fn !== handler);
    this.listeners.set(key, next);
  }

  dispatchEvent(event) {
    this.events.push(event);
    const handlers = this.listeners.get(String(event && event.type || '')) || [];
    for (let i = 0; i < handlers.length; i++) {
      handlers[i].call(this, event);
    }
    return true;
  }
}

async function loadRuntimeSessionHarness(overrides = {}) {
  const [domUtilsCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/core/dom-utils.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/app/runtime-session.js', import.meta.url), 'utf8')
  ]);

  let nowMs = 0;
  let perfNowMs = 0;
  let runtimeReady = true;
  let nextTimerId = 1;
  const intervalCallbacks = new Map();
  const suspendReasons = [];
  const teardownReasons = [];
  const idleWarnings = [];
  const debugNotices = [];
  const modalState = { open: false };
  const document = new FakeDocument();
  const window = new FakeWindow();
  const overlay = new FakeElement('overlay', document);
  const playBtn = new FakeElement('play-btn', document);
  const backBtn = new FakeElement('back-mode-btn', document);
  const modeButtons = new FakeElement('mode-buttons', document);
  const menuStage = new FakeElement('menu-stage', document);
  const menuSurface = new FakeElement('menu-surface', document);
  const launchFlow = new FakeElement('launch-flow', document);
  const launchTitle = new FakeElement('launch-title', document);
  const launchStatus = new FakeElement('launch-status', document);
  const launchNote = new FakeElement('launch-note', document);
  const launchRoomLabel = new FakeElement('launch-room-label', document);
  const launchEnterBtn = new FakeElement('launch-enter-btn', document);
  const target = new FakeElement('renderer-canvas', document);

  document.elements.overlay = overlay;
  document.elements['play-btn'] = playBtn;
  document.elements['back-mode-btn'] = backBtn;
  document.elements['mode-buttons'] = modeButtons;
  document.elements['menu-stage'] = menuStage;
  document.elements['menu-surface'] = menuSurface;
  document.elements['launch-flow'] = launchFlow;
  document.elements['launch-title'] = launchTitle;
  document.elements['launch-status'] = launchStatus;
  document.elements['launch-note'] = launchNote;
  document.elements['launch-room-label'] = launchRoomLabel;
  document.elements['launch-enter-btn'] = launchEnterBtn;
  modeButtons.style.display = 'none';
  overlay.style.display = 'flex';
  launchFlow.hidden = true;
  launchRoomLabel.hidden = true;
  launchEnterBtn.hidden = true;

  target.requestPointerLock = function () {
    document.pointerLockElement = target;
    document.dispatch('pointerlockchange');
  };

  class FakeCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  class FakeDate extends Date {
    static now() {
      return nowMs;
    }
  }

  function setIntervalStub(handler) {
    const id = nextTimerId++;
    intervalCallbacks.set(id, handler);
    return id;
  }

  function clearIntervalStub(id) {
    intervalCallbacks.delete(id);
  }

  const sandbox = {
    Date: FakeDate,
    CustomEvent: FakeCustomEvent,
    clearInterval: clearIntervalStub,
    clearTimeout() {},
    document,
    performance: {
      now() {
        return perfNowMs;
      }
    },
    setInterval: setIntervalStub,
    setTimeout() {
      return nextTimerId++;
    },
    window,
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameModalManager: {
          isOpen() {
            return !!modalState.open;
          }
        }
      }
    }
  };
  sandbox.globalThis.window = window;
  sandbox.globalThis.document = document;
  sandbox.globalThis.CustomEvent = FakeCustomEvent;

  const context = vm.createContext(sandbox);
  vm.runInContext(domUtilsCode, context);
  vm.runInContext(code, context);

  const baseOptions = {
    isRuntimeReady() {
      return runtimeReady;
    },
    canResumeGameplay() {
      return true;
    },
    getActivityState() {
      return 'in_match';
    },
    isNetworkedRuntime() {
      return true;
    },
    suspendNetworkSession(reason) {
      suspendReasons.push(String(reason || ''));
      return true;
    },
    setIdleWarning(text) {
      idleWarnings.push(String(text || ''));
    },
    getPointerLockTarget() {
      return target;
    },
    validateLaunch() {
      return { ok: true };
    },
    setTransientDebug(text) {
      debugNotices.push(String(text || ''));
    },
    teardownRuntime(reason) {
      runtimeReady = false;
      teardownReasons.push(String(reason || ''));
    },
    returnToMenu() {},
    isPrivateRoomSession() {
      return false;
    },
    resolveWinnerLabel() {
      return 'PLAYER';
    },
    didSelfWin() {
      return false;
    },
    modeDisplayName() {
      return 'Free For All';
    },
    objectiveSummary() {
      return 'Goal 0';
    },
    resultsSummary() {
      return 'Summary unavailable.';
    },
    formatSecondsRemaining() {
      return '0.0s';
    }
  };

  const session = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeSession.create({
    ...baseOptions,
    ...overrides
  });

  session.bindRuntimeControls();

  return {
    session,
    playBtn,
    backBtn,
    menuStage,
    menuSurface,
    launchFlow,
    launchTitle,
    launchStatus,
    launchNote,
    launchRoomLabel,
    launchEnterBtn,
    document,
    target,
    window,
    suspendReasons,
    teardownReasons,
    idleWarnings,
    debugNotices,
    setModalOpen(value) {
      modalState.open = !!value;
    },
    advanceClock(nextNowMs) {
      nowMs = nextNowMs;
      perfNowMs = nextNowMs;
    },
    tickIdleMonitor() {
      const callback = intervalCallbacks.values().next().value;
      assert.equal(typeof callback, 'function');
      callback();
    }
  };
}

test('networked runtime session warns at 5 seconds remaining and pauses after 30 seconds idle', async () => {
  const harness = await loadRuntimeSessionHarness();
  harness.advanceClock(500);

  await harness.session.enterGameplay({
    button: 0,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.equal(harness.session.isPlaying(), true);

  harness.advanceClock(25501);
  harness.tickIdleMonitor();
  assert.equal(harness.idleWarnings.at(-1), 'Inactive. Returning to pause menu in 5...');

  harness.advanceClock(30501);
  harness.tickIdleMonitor();

  assert.deepEqual(harness.suspendReasons, ['idle']);
  assert.equal(harness.session.getActivityState(), 'paused');
  assert.equal(harness.playBtn.style.display, 'none');
  assert.equal(harness.backBtn.style.display, 'inline-block');
  assert.equal(harness.idleWarnings.at(-1), '');
  assert.equal(harness.debugNotices.at(-1), 'Idle timeout reached. Match connection closed.');
});

test('networked runtime session keeps the match resumable when pointer lock is released into the pause menu', async () => {
  const harness = await loadRuntimeSessionHarness();
  harness.advanceClock(500);

  await harness.session.enterGameplay({
    button: 0,
    preventDefault() {},
    stopPropagation() {}
  });

  harness.advanceClock(900);
  harness.document.exitPointerLock();

  assert.deepEqual(harness.suspendReasons, []);
  assert.equal(harness.session.getActivityState(), 'in_match');
  assert.equal(harness.playBtn.style.display, 'inline-block');
  assert.equal(harness.backBtn.style.display, 'inline-block');
  assert.equal(harness.debugNotices.length, 0);
});

test('networked runtime session toggles out of and back into gameplay with Escape', async () => {
  const harness = await loadRuntimeSessionHarness();
  harness.advanceClock(500);

  await harness.session.enterGameplay({
    button: 0,
    preventDefault() {},
    stopPropagation() {}
  });

  harness.document.dispatch('keydown', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });

  assert.equal(harness.session.isPlaying(), false);
  assert.equal(harness.document.pointerLockElement, null);
  assert.equal(harness.playBtn.style.display, 'inline-block');
  assert.equal(harness.backBtn.style.display, 'inline-block');

  harness.document.dispatch('keyup', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });
  await Promise.resolve();

  assert.equal(harness.session.isPlaying(), false);
  assert.equal(harness.document.pointerLockElement, null);
  assert.equal(harness.playBtn.style.display, 'inline-block');
  assert.equal(harness.backBtn.style.display, 'inline-block');

  harness.document.dispatch('keydown', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });
  await Promise.resolve();

  assert.equal(harness.session.isPlaying(), true);
  assert.equal(harness.document.pointerLockElement !== null, true);
  assert.equal(harness.playBtn.style.display, 'none');
  assert.equal(harness.backBtn.style.display, 'none');
  assert.deepEqual(harness.teardownReasons, []);
});

test('networked runtime session requires a fresh Escape press before resuming', async () => {
  const harness = await loadRuntimeSessionHarness();
  harness.advanceClock(500);

  await harness.session.enterGameplay({
    button: 0,
    preventDefault() {},
    stopPropagation() {}
  });

  harness.document.dispatch('keydown', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });

  harness.document.dispatch('keydown', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });
  await Promise.resolve();

  assert.equal(harness.session.isPlaying(), false);
  assert.equal(harness.document.pointerLockElement, null);
  assert.equal(harness.playBtn.style.display, 'inline-block');
  assert.equal(harness.backBtn.style.display, 'inline-block');
});

test('closing a modal with Escape does not arm gameplay resume', async () => {
  const harness = await loadRuntimeSessionHarness();
  harness.advanceClock(500);

  await harness.session.enterGameplay({
    button: 0,
    preventDefault() {},
    stopPropagation() {}
  });

  harness.document.dispatch('keydown', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });

  harness.setModalOpen(true);
  harness.document.dispatch('keydown', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });
  harness.setModalOpen(false);
  harness.document.dispatch('keyup', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });

  harness.document.dispatch('keydown', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });
  await Promise.resolve();

  assert.equal(harness.session.isPlaying(), false);
  assert.equal(harness.document.pointerLockElement, null);

  harness.document.dispatch('keyup', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });
  harness.document.dispatch('keydown', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });
  await Promise.resolve();

  assert.equal(harness.session.isPlaying(), true);
  assert.equal(harness.document.pointerLockElement !== null, true);
});

test('networked runtime session resumes from the pause rail button', async () => {
  const harness = await loadRuntimeSessionHarness();
  harness.advanceClock(500);

  await harness.session.enterGameplay({
    button: 0,
    preventDefault() {},
    stopPropagation() {}
  });

  harness.document.dispatch('keydown', {
    key: 'Escape',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });

  harness.playBtn.dispatch('click');
  await Promise.resolve();

  assert.equal(harness.session.isPlaying(), true);
  assert.equal(harness.document.pointerLockElement !== null, true);
  assert.equal(harness.playBtn.style.display, 'none');
  assert.equal(harness.backBtn.style.display, 'none');
});

test('private room postgame completion emits a room-lobby session state instead of returning to main menu', async () => {
  let returnToMenuCalls = 0;
  const harness = await loadRuntimeSessionHarness({
    getActivityState() {
      return 'private_room_lobby';
    },
    isPrivateRoomSession() {
      return true;
    },
    returnToMenu() {
      returnToMenuCalls++;
    }
  });
  harness.advanceClock(500);

  await harness.session.enterGameplay({
    button: 0,
    preventDefault() {},
    stopPropagation() {}
  });

  harness.session.syncMatchState({
    matchState: {
      ended: true,
      endedAt: 1000,
      resetAt: 4000
    },
    selfState: {
      kills: 5,
      deaths: 2
    },
    privateRoomPhase: 'lobby'
  });

  harness.document.dispatch('keydown', {
    key: 'Enter',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });
  harness.document.dispatch('keydown', {
    key: 'Enter',
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });

  const sessionStates = harness.window.events
    .filter((event) => event && event.type === 'mayhem-session-state')
    .map((event) => event.detail);

  assert.equal(returnToMenuCalls, 0);
  assert.deepEqual(harness.teardownReasons, ['postgame_private_room']);
  assert.equal(harness.session.isPlaying(), false);
  assert.equal(sessionStates.at(-1).activityState, 'private_room_lobby');
  assert.equal(sessionStates.at(-1).inMatch, false);
  assert.equal(sessionStates.at(-1).runtimeReady, false);
  assert.equal(sessionStates.at(-1).canResume, false);
});

test('private room returnToMenu tears down the runtime and stays in the room lobby', async () => {
  let returnToMenuCalls = 0;
  const harness = await loadRuntimeSessionHarness({
    getActivityState() {
      return 'private_room_lobby';
    },
    isPrivateRoomSession() {
      return true;
    },
    returnToMenu() {
      returnToMenuCalls++;
    }
  });

  harness.session.returnToMenu();

  const sessionStates = harness.window.events
    .filter((event) => event && event.type === 'mayhem-session-state')
    .map((event) => event.detail);

  assert.equal(returnToMenuCalls, 0);
  assert.deepEqual(harness.teardownReasons, ['return_to_room_lobby']);
  assert.equal(sessionStates.at(-1).activityState, 'private_room_lobby');
  assert.equal(sessionStates.at(-1).runtimeReady, false);
  assert.equal(sessionStates.at(-1).canResume, false);
});

test('networked runtime session routes joined-ready handoff through the session strip instead of the launch overlay', async () => {
  const harness = await loadRuntimeSessionHarness();

  harness.session.showLaunchOverlay('joined_ready', {
    gameMode: 'ffa',
    roomId: 'ffa-01'
  });

  assert.equal(harness.launchFlow.hidden, true);
  assert.equal(harness.menuStage.hidden, false);
  assert.equal(harness.launchTitle.textContent, 'Enter Match');
  assert.equal(harness.launchStatus.textContent, 'Free For All ready.');
  assert.equal(harness.launchNote.textContent, 'Click Enter Match to capture the mouse and drop into the arena.');
  assert.equal(harness.launchRoomLabel.hidden, true);
  assert.equal(harness.launchRoomLabel.textContent, 'Room FFA-01');
  assert.equal(harness.launchEnterBtn.hidden, true);
  assert.equal(harness.playBtn.style.display, 'inline-block');
  assert.equal(harness.playBtn.textContent, 'Enter Match');
  assert.equal(harness.backBtn.style.display, 'inline-block');
  assert.equal(harness.backBtn.textContent, 'Return to Menu');
});

test('phone joined-ready handoff requires a shooting acknowledgement before touch capture', async () => {
  let activateTouchCalls = 0;
  const harness = await loadRuntimeSessionHarness({
    isTouchGameplayEnabled() {
      return true;
    },
    activateTouchGameplayCapture() {
      activateTouchCalls += 1;
      return true;
    }
  });
  harness.advanceClock(500);

  harness.session.showLaunchOverlay('joined_ready', {
    gameMode: 'ffa',
    roomId: 'phone-01'
  });

  assert.equal(harness.launchFlow.hidden, false);
  assert.equal(harness.menuStage.hidden, true);
  assert.equal(harness.launchTitle.textContent, 'Phone Shooting');
  assert.equal(harness.launchStatus.textContent, 'There is no fire button.');
  assert.match(harness.launchNote.textContent, /re-engage/);
  assert.equal(harness.launchEnterBtn.hidden, false);
  assert.equal(harness.launchEnterBtn.textContent, 'I Understand');
  assert.equal(harness.playBtn.textContent, 'I Understand');

  const acknowledgement = await harness.session.enterGameplay({
    button: 0,
    type: 'click',
    preventDefault() {},
    stopPropagation() {}
  });

  assert.equal(acknowledgement.entered, false);
  assert.equal(acknowledgement.acknowledgedPhoneBriefing, true);
  assert.equal(activateTouchCalls, 0);
  assert.equal(harness.launchFlow.hidden, true);
  assert.equal(harness.menuStage.hidden, false);
  assert.equal(harness.launchTitle.textContent, 'Enter Match');
  assert.equal(harness.launchNote.textContent, 'Phones are landscape-only. Turn your phone sideways, then tap Enter Match.');
  assert.equal(harness.playBtn.textContent, 'Enter Match');

  harness.advanceClock(700);
  const entered = await harness.session.enterGameplay({
    button: 0,
    type: 'click',
    preventDefault() {},
    stopPropagation() {}
  });

  assert.equal(entered.entered, true);
  assert.equal(activateTouchCalls, 1);
  assert.equal(harness.session.isPlaying(), true);
});

test('unbindRuntimeControls removes every bound listener and supports a clean rebind', async () => {
  const harness = await loadRuntimeSessionHarness();
  const countListeners = (target) => {
    let count = 0;
    target.listeners.forEach((handlers) => {
      count += handlers.length;
    });
    return count;
  };

  assert.ok(countListeners(harness.document) > 0, 'document listeners bound');
  assert.ok(countListeners(harness.window) > 0, 'window listeners bound');
  assert.ok(countListeners(harness.playBtn) > 0, 'play button listeners bound');
  assert.ok(countListeners(harness.backBtn) > 0, 'back button listeners bound');

  harness.session.unbindRuntimeControls();

  assert.equal(countListeners(harness.document), 0);
  assert.equal(countListeners(harness.window), 0);
  assert.equal(countListeners(harness.playBtn), 0);
  assert.equal(countListeners(harness.backBtn), 0);

  // Unbound controls must no longer drive gameplay entry.
  harness.playBtn.dispatch('click');
  await Promise.resolve();
  assert.equal(harness.session.isPlaying(), false);
  assert.equal(harness.document.pointerLockElement, null);

  // Rebinding restores exactly one fresh set, and repeat binds do not stack.
  harness.session.bindRuntimeControls();
  const docListenersAfterRebind = countListeners(harness.document);
  assert.ok(docListenersAfterRebind > 0);
  harness.session.bindRuntimeControls();
  assert.equal(countListeners(harness.document), docListenersAfterRebind);
});

test('preparing a fresh launch clears any leftover postgame flow', async () => {
  const harness = await loadRuntimeSessionHarness();
  const postgameFlow = new FakeElement('postgame-flow', harness.document);
  const postgameCelebration = new FakeElement('postgame-celebration', harness.document);
  const postgameResults = new FakeElement('postgame-results', harness.document);
  harness.document.elements['postgame-flow'] = postgameFlow;
  harness.document.elements['postgame-celebration'] = postgameCelebration;
  harness.document.elements['postgame-results'] = postgameResults;

  harness.session.syncMatchState({
    matchState: {
      ended: true,
      endedAt: 1000,
      resetAt: 4000
    },
    selfState: {
      id: 'usr_self',
      kills: 1,
      deaths: 2
    }
  });

  assert.equal(postgameFlow.hidden, false);

  harness.session.prepareLaunch({
    launchKind: 'menu_play',
    gameMode: 'ffa',
    requiresNetwork: true
  });

  assert.equal(postgameFlow.hidden, true);
  assert.equal(postgameCelebration.hidden, true);
  assert.equal(postgameResults.hidden, true);
  assert.equal(harness.launchFlow.hidden, true);
});

test('active postgame flow ignores later match updates until the player exits it', async () => {
  const harness = await loadRuntimeSessionHarness({
    resolveWinnerLabel(matchState) {
      return String(matchState && matchState.winnerId || 'PLAYER');
    },
    didSelfWin(matchState, selfState) {
      return String(matchState && matchState.winnerId || '') === String(selfState && selfState.id || '');
    }
  });
  const postgameFlow = new FakeElement('postgame-flow', harness.document);
  const postgameCelebration = new FakeElement('postgame-celebration', harness.document);
  const postgameResults = new FakeElement('postgame-results', harness.document);
  const winnerBanner = new FakeElement('postgame-winner-banner', harness.document);
  const resultBanner = new FakeElement('postgame-result-banner', harness.document);
  const celebrationNote = new FakeElement('postgame-celebration-note', harness.document);
  harness.document.elements['postgame-flow'] = postgameFlow;
  harness.document.elements['postgame-celebration'] = postgameCelebration;
  harness.document.elements['postgame-results'] = postgameResults;
  harness.document.elements['postgame-winner-banner'] = winnerBanner;
  harness.document.elements['postgame-result-banner'] = resultBanner;
  harness.document.elements['postgame-celebration-note'] = celebrationNote;

  harness.session.syncMatchState({
    matchState: {
      ended: true,
      endedAt: 1000,
      resetAt: 4000,
      winnerId: 'usr_self'
    },
    selfState: {
      id: 'usr_self',
      kills: 2,
      deaths: 1
    }
  });

  assert.equal(postgameFlow.hidden, false);
  assert.equal(winnerBanner.textContent, 'usr_self');
  assert.equal(resultBanner.textContent, 'Victory');

  harness.session.syncMatchState({
    matchState: {
      ended: true,
      endedAt: 2000,
      resetAt: 5000,
      winnerId: 'usr_other'
    },
    selfState: {
      id: 'usr_self',
      kills: 2,
      deaths: 2
    }
  });

  assert.equal(winnerBanner.textContent, 'usr_self');
  assert.equal(resultBanner.textContent, 'Victory');
});
