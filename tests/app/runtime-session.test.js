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
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const next = this.listeners.get(key) || [];
    next.push(handler);
    this.listeners.set(key, next);
  }

  focus() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
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

  dispatchEvent(event) {
    this.events.push(event);
    const handlers = this.listeners.get(String(event && event.type || '')) || [];
    for (let i = 0; i < handlers.length; i++) {
      handlers[i].call(this, event);
    }
    return true;
  }
}

async function loadRuntimeSessionHarness() {
  const [domUtilsCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/core/dom-utils.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/app/runtime-session.js', import.meta.url), 'utf8')
  ]);

  let nowMs = 0;
  let perfNowMs = 0;
  let nextTimerId = 1;
  const intervalCallbacks = new Map();
  const suspendReasons = [];
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

  const session = sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeSession.create({
    isRuntimeReady() {
      return true;
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
      return 'FFA';
    },
    objectiveSummary() {
      return 'GOAL 0';
    },
    resultsSummary() {
      return 'Summary unavailable.';
    },
    formatSecondsRemaining() {
      return '0.0s';
    }
  });

  session.bindRuntimeControls();

  return {
    session,
    playBtn,
    backBtn,
    menuStage,
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

test('networked runtime session routes joined-ready handoff through the session strip instead of the launch overlay', async () => {
  const harness = await loadRuntimeSessionHarness();

  harness.session.showLaunchOverlay('joined_ready', {
    gameMode: 'ffa',
    roomId: 'ffa-01'
  });

  assert.equal(harness.launchFlow.hidden, true);
  assert.equal(harness.menuStage.hidden, false);
  assert.equal(harness.launchTitle.textContent, 'ENTER MATCH');
  assert.equal(harness.launchStatus.textContent, 'FFA READY.');
  assert.equal(harness.launchNote.textContent, 'Click ENTER MATCH to capture the mouse and drop into the arena.');
  assert.equal(harness.launchRoomLabel.hidden, true);
  assert.equal(harness.launchRoomLabel.textContent, 'ROOM FFA-01');
  assert.equal(harness.launchEnterBtn.hidden, true);
  assert.equal(harness.playBtn.style.display, 'inline-block');
  assert.equal(harness.playBtn.textContent, 'ENTER MATCH');
  assert.equal(harness.backBtn.style.display, 'inline-block');
  assert.equal(harness.backBtn.textContent, 'RETURN TO MENU');
});
