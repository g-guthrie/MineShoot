import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.hidden = false;
    this.disabled = false;
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

  dispatch(type, extra = {}) {
    const handlers = this.listeners.get(String(type || '')) || [];
    for (let i = 0; i < handlers.length; i++) {
      handlers[i]({
        type,
        currentTarget: this,
        target: this,
        button: 0,
        preventDefault() {},
        stopPropagation() {},
        ...extra
      });
    }
  }

  click() {
    this.dispatch('click');
  }
}

async function createMainHarness() {
  const code = await fs.readFile(new URL('../../js/runtime/main.js', import.meta.url), 'utf8');
  const elements = new Map();
  const documentListeners = new Map();
  const sessionValues = new Map();
  let clearSelectedModeCount = 0;
  let shutdownCount = 0;
  let resolveJoin = null;
  let rejectJoin = null;
  let selectedRoomId = '';
  let perfNow = 0;

  function element(id) {
    if (!elements.has(id)) elements.set(id, new FakeElement(id));
    return elements.get(id);
  }

  const document = {
    pointerLockElement: null,
    body: { classList: { remove() {} } },
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector() {
      return null;
    },
    addEventListener(type, handler) {
      const key = String(type || '');
      const next = documentListeners.get(key) || [];
      next.push(handler);
      documentListeners.set(key, next);
    },
    dispatch(type) {
      const handlers = documentListeners.get(String(type || '')) || [];
      for (let i = 0; i < handlers.length; i++) handlers[i]({ type });
    },
    exitPointerLock() {
      this.pointerLockElement = null;
      this.dispatch('pointerlockchange');
    }
  };

  const overlay = element('overlay');
  const launchFlow = element('launch-flow');
  launchFlow.hidden = true;
  const launchEnterBtn = element('launch-enter-btn');
  launchEnterBtn.hidden = true;
  element('launch-kicker');
  element('launch-title');
  element('launch-status');
  element('launch-room-label').hidden = true;
  element('launch-note');
  element('menu-stage');
  element('menu-session-stats').hidden = true;
  element('menu-session-status');
  element('menu-session-kd');
  element('play-btn').style.display = 'none';
  element('back-mode-btn').style.display = 'none';
  element('mode-buttons').style.display = '';
  element('postgame-flow').hidden = true;
  element('postgame-celebration').hidden = true;
  element('postgame-results').hidden = true;
  element('postgame-continue-btn');
  element('debug-info');

  const camera = {
    position: { x: 0, y: 0, z: 0 },
    layers: { set() {} }
  };
  const rendererDom = {
    requestPointerLock() {
      document.pointerLockElement = rendererDom;
      document.dispatch('pointerlockchange');
    }
  };

  const runtime = {
    GameMenuLoadout: {
      validateSelections() { return { ok: true }; },
      syncToRuntime() {},
      getWeaponSlots() { return ['rifle', 'shotgun']; }
    },
    GameRuntimeProfile: {
      selectMode(modeId) {
        return {
          id: String(modeId || ''),
          label: 'Public Lobby',
          backendLabel: 'CLOUDFLARE PROD',
          authorityMode: 'networked',
          roomId: 'global',
          roomStrategy: 'global',
          gameMode: 'ffa'
        };
      },
      clearSelectedMode() {
        clearSelectedModeCount += 1;
      }
    },
    GameRuntimeModeUi: {
      runtimeRoomLabel(mode) {
        return String(mode && mode.gameMode || 'ffa').toUpperCase() + ' ROOM ' + String(mode && mode.roomId || '').toUpperCase();
      },
      startupNoticeForMode(mode) {
        return 'Public Lobby: room ' + String(mode && mode.roomId || '').toUpperCase() + '.';
      },
      setRuntimeIndicator() {}
    },
    GameGameplayRuntimeBootstrap: {
      start() {
        return Promise.resolve({
          renderer: {
            domElement: rendererDom,
            render() {}
          },
          scene: {},
          clock: {
            getDelta() { return 0.016; }
          },
          camera,
          controlsApi: {
            bind() {},
            releaseTransientInput() {}
          },
          multiplayerMode: true,
          startupDebugNotice: ''
        });
      }
    },
    GameNet: {
      beginJoinAttempt() {
        return new Promise((resolve, reject) => {
          resolveJoin = resolve;
          rejectJoin = reject;
        });
      },
      setRoomId(roomId) {
        selectedRoomId = String(roomId || '');
      },
      failJoin() {},
      shutdown() {
        shutdownCount += 1;
      },
      update() {},
      consumeNotice() { return ''; },
      getMatchState() { return null; },
      getSelfState() { return null; },
      getRespawnState() { return null; },
      getPrivateRoomPhase() { return ''; },
      sendEquipWeapon() {},
      setHitboxVisibility() {}
    },
    GamePlayer: {
      update() {},
      getPosition() { return { x: 0, y: 0, z: 0 }; },
      getRotation() { return { yaw: 0, pitch: 0 }; },
      isSprinting() { return false; },
      setWeaponModel() {}
    },
    GamePlayerCombat: {
      tickInvulnTimer() {},
      tickArmorRegen() {}
    },
    GameHitscan: {
      setWeapon(id) { return { id, name: id.toUpperCase() }; },
      getCurrentWeapon() { return null; },
      getReticleSpec() { return {}; },
      tick() {},
      updateTracers() {},
      peekCenterTarget() { return null; },
      peekAutoLockTarget() { return null; }
    },
    GameUI: {
      updateWeaponInfo() {},
      updateReticle() {},
      setDebugInfo() {}
    },
    GameOverhead: {
      update() {}
    },
    GameLoop: {
      requestFrame() {}
    }
  };

  const sandbox = {
    console,
    Date,
    Map,
    Promise,
    performance: { now: () => { perfNow += 200; return perfNow; } },
    requestAnimationFrame() {},
    setTimeout,
    clearTimeout,
    document,
    window: {
      location: {
        pathname: '/',
        href: 'https://preview.example/'
      },
      sessionStorage: {
        getItem(key) { return sessionValues.has(key) ? sessionValues.get(key) : null; },
        setItem(key, value) { sessionValues.set(String(key), String(value)); },
        removeItem(key) { sessionValues.delete(String(key)); }
      }
    },
    globalThis: {
      __MAYHEM_RUNTIME: runtime
    }
  };

  vm.runInContext(code, vm.createContext(sandbox));

  return {
    launch(modeId, options) {
      return sandbox.globalThis.__MAYHEM_RUNTIME.GameMain.launchModeById(modeId, options);
    },
    resolveJoin() {
      resolveJoin({ roomId: selectedRoomId, selfId: 'user-1' });
    },
    rejectJoin(message) {
      rejectJoin(new Error(message));
    },
    clickEnter() {
      launchEnterBtn.click();
    },
    element,
    document,
    sessionValues,
    location: sandbox.window.location,
    clearSelectedModeCount() { return clearSelectedModeCount; },
    shutdownCount() { return shutdownCount; }
  };
}

test('networked launch waits for authoritative join before exposing the enter-match prompt', async () => {
  const harness = await createMainHarness();
  const launchPromise = harness.launch('cloud_multiplayer', {
    roomId: 'ffa-01',
    gameMode: 'ffa'
  });

  let settled = false;
  launchPromise.then(() => { settled = true; }, () => { settled = true; });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(harness.element('menu-stage').hidden, true);
  assert.equal(harness.element('launch-flow').hidden, false);
  assert.equal(harness.element('launch-enter-btn').hidden, true);

  harness.resolveJoin();
  const result = await launchPromise;
  assert.equal(result.ok, true);
  assert.equal(harness.element('menu-stage').hidden, true);
  assert.equal(harness.element('launch-flow').hidden, false);
  assert.equal(harness.element('launch-enter-btn').hidden, false);
  assert.match(harness.element('launch-status').textContent, /Ready to enter FFA room FFA-01\./);

  harness.clickEnter();
  assert.equal(harness.location.href, 'https://preview.example/');
  assert.equal(harness.element('menu-stage').hidden, false);
  assert.equal(harness.element('overlay').style.display, 'none');
});

test('failed authoritative join stores the error and hard-resets to menu', async () => {
  const harness = await createMainHarness();
  const launchPromise = harness.launch('cloud_multiplayer', {
    roomId: 'ffa-01',
    gameMode: 'ffa'
  });

  harness.rejectJoin('Timed out joining room FFA-01.');
  const result = await launchPromise;

  assert.equal(result.ok, false);
  assert.equal(result.error, 'Timed out joining room FFA-01.');
  assert.equal(harness.sessionValues.get('mayhem.launchError'), 'Timed out joining room FFA-01.');
  assert.equal(harness.location.href, '/');
  assert.equal(harness.shutdownCount(), 1);
  assert.equal(harness.clearSelectedModeCount(), 1);
});
