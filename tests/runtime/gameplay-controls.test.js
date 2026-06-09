import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.id = '';
    this.className = '';
    this.hidden = false;
    this.innerHTML = '';
    this.parentNode = null;
    this.children = [];
    this.style = {};
    this.attributes = {};
    this.listeners = new Map();
    this.queryResults = new Map();
    this.classTokens = new Set();
    this.rect = { left: 0, top: 0, width: 104, height: 104 };
    this.classList = {
      toggle: (name, active) => {
        const key = String(name || '');
        if (!key) return false;
        const enabled = active === undefined ? !this.classTokens.has(key) : !!active;
        if (enabled) this.classTokens.add(key);
        else this.classTokens.delete(key);
        return enabled;
      },
      contains: (name) => this.classTokens.has(String(name || ''))
    };
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const list = this.listeners.get(key) || [];
    list.push(handler);
    this.listeners.set(key, list);
  }

  removeEventListener(type, handler) {
    const key = String(type || '');
    const list = this.listeners.get(key) || [];
    this.listeners.set(key, list.filter((entry) => entry !== handler));
  }

  appendChild(child) {
    if (child) {
      child.parentNode = this;
      this.children.push(child);
    }
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter((entry) => entry !== child);
    if (child) child.parentNode = null;
    return child;
  }

  setAttribute(name, value) {
    this.attributes[String(name || '')] = String(value || '');
  }

  getAttribute(name) {
    const key = String(name || '');
    return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null;
  }

  querySelector(selector) {
    const key = String(selector || '');
    if (!this.queryResults.has(key)) {
      this.queryResults.set(key, new FakeElement('button'));
    }
    return this.queryResults.get(key);
  }

  getBoundingClientRect() {
    return { ...this.rect };
  }

  setBoundingClientRect(rect) {
    this.rect = {
      left: Number(rect && rect.left || 0),
      top: Number(rect && rect.top || 0),
      width: Number(rect && rect.width || 0),
      height: Number(rect && rect.height || 0)
    };
  }

  setPointerCapture() {}

  dispatch(type, event = {}) {
    const list = this.listeners.get(String(type || '')) || [];
    for (const handler of list) handler(event);
  }
}

class FakeDocument {
  constructor(elements = {}) {
    this.listeners = new Map();
    this.elements = elements;
    this.body = new FakeElement('body');
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const list = this.listeners.get(key) || [];
    list.push(handler);
    this.listeners.set(key, list);
  }

  removeEventListener(type, handler) {
    const key = String(type || '');
    const list = this.listeners.get(key) || [];
    this.listeners.set(key, list.filter((entry) => entry !== handler));
  }

  getElementById(id) {
    return this.elements[String(id || '')] || null;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  dispatch(type, event) {
    const list = this.listeners.get(String(type || '')) || [];
    for (const handler of list) handler(event || {});
  }
}

class FakeButton {
  constructor() {
    this.textContent = '';
    this.attributes = {};
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const list = this.listeners.get(key) || [];
    list.push(handler);
    this.listeners.set(key, list);
  }

  removeEventListener(type, handler) {
    const key = String(type || '');
    const list = this.listeners.get(key) || [];
    this.listeners.set(key, list.filter((entry) => entry !== handler));
  }

  setAttribute(name, value) {
    this.attributes[String(name || '')] = String(value || '');
  }

  getAttribute(name) {
    const key = String(name || '');
    return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null;
  }

  click() {
    const handlers = this.listeners.get('click') || [];
    for (const handler of handlers) {
      handler({
        preventDefault() {},
        stopPropagation() {}
      });
    }
  }
}

class FakeWindow {
  constructor() {
    this.listeners = new Map();
    this.innerWidth = 1280;
    this.innerHeight = 720;
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const list = this.listeners.get(key) || [];
    list.push(handler);
    this.listeners.set(key, list);
  }

  removeEventListener(type, handler) {
    const key = String(type || '');
    const list = this.listeners.get(key) || [];
    this.listeners.set(key, list.filter((entry) => entry !== handler));
  }

  dispatch(type, event) {
    const list = this.listeners.get(String(type || '')) || [];
    for (const handler of list) handler(event || {});
  }
}

async function loadControlsHarness(options = {}) {
  const [inputBindingsCode, inputLabelsCode, domUtilsCode, weaponSwapCode, controlsCode] = await Promise.all([
    fs.readFile(new URL('../../js/core/input-bindings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/core/input-labels.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/core/dom-utils.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/runtime/weapon-swap-input.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/runtime/gameplay-controls.js', import.meta.url), 'utf8')
  ]);
  const documentObj = new FakeDocument(options.documentElements || {});
  const windowObj = new FakeWindow();
  const localStorageValues = { ...(options.localStorageValues || {}) };
  const timeState = { now: 0 };
  let currentWeaponId = 'rifle';
  let inspectMode = false;
  const defaultWeaponOrder = ['rifle', 'sniper'];
  const calls = {
    clearTrajectoryPreview: 0,
    updateTrajectoryPreview: 0,
    updateTrackingReticle: [],
    tryPlayerFire: 0,
    docsToggle: 0,
    docsClose: 0,
    rolls: 0,
    abilityCasts: [],
    debugToggles: 0,
    reloads: 0,
    reloadMessages: [],
    rollMessages: [],
    throwMessages: [],
    throwPredicted: [],
    audioCalls: [],
    movementInputs: [],
    transientDebug: [],
    toggleWeaponCalls: [],
    appliedWeapons: [],
    localStorageWrites: [],
    inspectToggles: []
  };
  const runtime = {
    GameThrowables: {
      getSelectedThrowable() { return 'plasma'; },
      getPreviewType() { return 'trajectory'; },
      getState() { return { plasma: { charges: 2 } }; },
      buildClientThrowId() { return 'cthrow-test'; },
      buildThrowIntent() { return { aim: true }; },
      throwPredicted(type, _camera, clientThrowId, throwIntent) {
        calls.throwPredicted.push({
          type: String(type || ''),
          clientThrowId: String(clientThrowId || ''),
          throwIntent: JSON.parse(JSON.stringify(throwIntent || null))
        });
        return true;
      },
      clearTrajectoryPreview() { calls.clearTrajectoryPreview += 1; },
      updateTrajectoryPreview() { calls.updateTrajectoryPreview += 1; }
    },
    GameUI: {
      updateTrackingReticle(visible, hasTarget) {
        calls.updateTrackingReticle.push({ visible: !!visible, hasTarget: !!hasTarget });
      },
      updateAbilityInfo() {}
    },
    GameAudio: {
      play(name, payload) {
        calls.audioCalls.push({ name: String(name || ''), payload: JSON.parse(JSON.stringify(payload || {})) });
      }
    },
    GameHitscan: {
      getWeaponOrder() { return defaultWeaponOrder.slice(); },
      getCurrentWeapon() { return { id: currentWeaponId }; },
      reloadCurrentWeapon() {
        calls.reloads += 1;
        return true;
      },
      toggleWeapon() {
        var currentIdx = defaultWeaponOrder.indexOf(currentWeaponId);
        var nextWeaponId = currentIdx === 1
          ? defaultWeaponOrder[0]
          : (defaultWeaponOrder[1] || defaultWeaponOrder[0]);
        currentWeaponId = String(nextWeaponId || currentWeaponId || defaultWeaponOrder[0]);
        calls.toggleWeaponCalls.push(currentWeaponId);
        return { id: currentWeaponId };
      },
      cycleWeapon() { throw new Error('directional weapon path should not run'); },
      setWeapon(weaponId) {
        currentWeaponId = String(weaponId || currentWeaponId || defaultWeaponOrder[0]);
        return { id: currentWeaponId };
      }
    },
    GamePlayer: {
      getPosition() { return { x: 0, y: 0, z: 0 }; },
      getRotation() { return { yaw: 0, pitch: 0 }; },
      peekRollActionOptions() {
        return {
          movingForward: true,
          movingBackward: false,
          movingLeft: false,
          movingRight: false
        };
      },
      tryRoll() {
        calls.rolls += 1;
        return true;
      },
      isInspectModeActive() {
        return inspectMode;
      },
      toggleInspectMode() {
        inspectMode = !inspectMode;
        calls.inspectToggles.push(inspectMode);
        return inspectMode;
      },
      clearMovementInputState() {
        calls.movementInputs.push({
          forward: false,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false
        });
        return {};
      },
      setMovementInputState(nextState) {
        calls.movementInputs.push({
          forward: !!(nextState && nextState.forward),
          backward: !!(nextState && nextState.backward),
          left: !!(nextState && nextState.left),
          right: !!(nextState && nextState.right),
          jump: !!(nextState && nextState.jump),
          sprint: !!(nextState && nextState.sprint)
        });
        return nextState || {};
      }
    },
    GameAbilities: {
      getHudState() { return {}; },
      triggerAbility() {
        calls.abilityCasts.push(1);
        return { ok: true };
      }
    },
    GameRuntimeLoader: {
      toggleDocs() {
        calls.docsToggle += 1;
      },
      getLoadedDocsRuntime() {
        return {
          toggle() {
            calls.docsToggle += 1;
          },
          isOpen() {
            return !!options.docsOpen;
          },
          close() {
            calls.docsClose += 1;
          }
        };
      }
    },
    ...options.runtimeOverrides
  };

  if (options.touchDevice) {
    windowObj.ontouchstart = null;
    windowObj.matchMedia = function (query) {
      return { matches: String(query || '') === '(pointer: coarse)' };
    };
  }
  if (options.windowSize) {
    windowObj.innerWidth = Number(options.windowSize.width || windowObj.innerWidth);
    windowObj.innerHeight = Number(options.windowSize.height || windowObj.innerHeight);
  }

  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    document: documentObj,
    window: Object.assign(windowObj, {
      localStorage: {
        getItem(key) {
          if (Object.prototype.hasOwnProperty.call(localStorageValues, key)) {
            return localStorageValues[key];
          }
          return null;
        },
        setItem(key, value) {
          localStorageValues[String(key || '')] = String(value || '');
          calls.localStorageWrites.push({ key: String(key || ''), value: String(value || '') });
        },
        removeItem() {}
      }
    }),
    console,
    Date,
    navigator: options.touchDevice ? { maxTouchPoints: 5, platform: 'iPhone', userAgent: 'iPhone' } : { maxTouchPoints: 0 },
    performance: {
      now() { return timeState.now; }
    }
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(inputBindingsCode, context);
  vm.runInContext(inputLabelsCode, context);
  vm.runInContext(domUtilsCode, context);
  vm.runInContext(weaponSwapCode, context);
  vm.runInContext(controlsCode, context);
  const controls = sandbox.__MAYHEM_RUNTIME.GameGameplayControls.create({
    applyWeapon(weapon) { calls.appliedWeapons.push(weapon); },
    canUseLocalAction() { return true; },
    getCamera() { return { fov: 60, aspect: 16 / 9 }; },
    getMultiplayerMode() { return false; },
    handleEnemyHit() {},
    hasInputCapture() { return true; },
    setTransientDebug(text, ms) {
      calls.transientDebug.push({ text: String(text || ''), ms: Number(ms || 0) });
    },
    toggleDebugVisuals() {
      calls.debugToggles += 1;
      return false;
    },
    tryPlayerFire() { calls.tryPlayerFire += 1; },
    ...options.createOverrides
  });

  controls.bind();

  return {
    calls,
    controls,
    documentObj,
    runtime: sandbox.__MAYHEM_RUNTIME,
    timeState,
    windowObj
  };
}

function dispatchWheel(harness, timeMs, event = {}) {
  harness.timeState.now = Number(timeMs || 0);
  harness.documentObj.dispatch('wheel', {
    deltaMode: 0,
    deltaX: 0,
    deltaY: 0,
    preventDefault() {},
    ...event
  });
}

test('gameplay controls own throwable preview transient state', async () => {
  const harness = await loadControlsHarness();

  harness.documentObj.dispatch('keydown', {
    code: 'KeyQ',
    repeat: false
  });

  assert.equal(harness.controls.hasArmedThrowablePreview(), true);

  harness.controls.updateArmedThrowablePreview();

  assert.equal(harness.calls.updateTrajectoryPreview, 1);

  harness.controls.releaseTransientInput();

  assert.equal(harness.controls.hasArmedThrowablePreview(), false);
  assert.equal(harness.calls.clearTrajectoryPreview >= 1, true);
  assert.deepEqual(harness.calls.updateTrackingReticle.at(-1), {
    visible: false,
    hasTarget: false
  });
});

test('gameplay controls own held-fire transient state', async () => {
  const harness = await loadControlsHarness();

  harness.documentObj.dispatch('mousedown', {
    button: 0
  });
  assert.equal(harness.controls.isTriggerHeld(), true);
  assert.equal(harness.calls.tryPlayerFire, 1);

  harness.documentObj.dispatch('mouseup', {
    button: 0
  });
  assert.equal(harness.controls.isTriggerHeld(), false);
});

test('gameplay controls trigger reload on the bound key and forward multiplayer reload commands', async () => {
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameNet: {
        commands: {
          sendReload(weaponId) {
            harness.calls.reloadMessages.push(String(weaponId || ''));
            return true;
          }
        }
      }
    },
    createOverrides: {
      getMultiplayerMode() { return true; }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'KeyR',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.equal(harness.calls.reloads, 1);
  assert.deepEqual(harness.calls.reloadMessages, ['rifle']);
});

test('gameplay controls do not start multiplayer reload prediction when reload send fails', async () => {
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameNet: {
        commands: {
          sendReload(weaponId) {
            harness.calls.reloadMessages.push(String(weaponId || ''));
            return false;
          }
        }
      }
    },
    createOverrides: {
      getMultiplayerMode() { return true; }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'KeyR',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.equal(harness.calls.reloads, 0);
  assert.deepEqual(harness.calls.reloadMessages, ['rifle']);
  assert.deepEqual(harness.calls.transientDebug, [{
    text: 'Reload send failed.',
    ms: 700
  }]);
});

test('gameplay controls do not start multiplayer reload prediction when reload networking is unavailable', async () => {
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameNet: {}
    },
    createOverrides: {
      getMultiplayerMode() { return true; }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'KeyR',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.equal(harness.calls.reloads, 0);
  assert.deepEqual(harness.calls.reloadMessages, []);
  assert.deepEqual(harness.calls.transientDebug, [{
    text: 'Reload unavailable.',
    ms: 700
  }]);
});

test('gameplay controls do not start multiplayer throw prediction when throw send fails', async () => {
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameThrowables: {
        getSelectedThrowable() { return 'plasma'; },
        getPreviewType() { return 'none'; },
        getState() { return { plasma: { charges: 1 } }; },
        buildClientThrowId() { return 'cthrow-failed'; },
        buildThrowIntent() { return { aim: true }; },
        throwPredicted(type, _camera, clientThrowId, throwIntent) {
          harness.calls.throwPredicted.push({
            type: String(type || ''),
            clientThrowId: String(clientThrowId || ''),
            throwIntent: JSON.parse(JSON.stringify(throwIntent || null))
          });
          return true;
        }
      },
      GameNet: {
        commands: {
          sendThrow(type, clientThrowId, throwIntent) {
            harness.calls.throwMessages.push({
              type: String(type || ''),
              clientThrowId: String(clientThrowId || ''),
              throwIntent: JSON.parse(JSON.stringify(throwIntent || null))
            });
            return false;
          }
        }
      }
    },
    createOverrides: {
      getMultiplayerMode() { return true; }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'KeyQ',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.deepEqual(harness.calls.throwMessages, [{
    type: 'plasma',
    clientThrowId: 'cthrow-failed',
    throwIntent: { aim: true }
  }]);
  assert.deepEqual(harness.calls.throwPredicted, []);
  assert.deepEqual(harness.calls.audioCalls, []);
  assert.deepEqual(harness.calls.transientDebug, [{
    text: 'Throw send failed.',
    ms: 700
  }]);
});

test('gameplay controls do not fall back to local throw when multiplayer throw networking is unavailable', async () => {
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameThrowables: {
        getSelectedThrowable() { return 'plasma'; },
        getPreviewType() { return 'none'; },
        getState() { return { plasma: { charges: 1 } }; },
        buildClientThrowId() { return 'cthrow-unavailable'; },
        buildThrowIntent() { return { aim: true }; },
        throwPredicted(type, _camera, clientThrowId, throwIntent) {
          harness.calls.throwPredicted.push({
            type: String(type || ''),
            clientThrowId: String(clientThrowId || ''),
            throwIntent: JSON.parse(JSON.stringify(throwIntent || null))
          });
          return true;
        },
        throw(type) {
          harness.calls.throwMessages.push({ localOnly: true, type: String(type || '') });
          return { ok: true, state: {} };
        }
      },
      GameNet: {}
    },
    createOverrides: {
      getMultiplayerMode() { return true; }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'KeyQ',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.deepEqual(harness.calls.throwMessages, []);
  assert.deepEqual(harness.calls.throwPredicted, []);
  assert.deepEqual(harness.calls.audioCalls, []);
  assert.deepEqual(harness.calls.transientDebug, [{
    text: 'Throw unavailable.',
    ms: 700
  }]);
});

test('gameplay controls start multiplayer throw prediction after throw send succeeds', async () => {
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameThrowables: {
        getSelectedThrowable() { return 'plasma'; },
        getPreviewType() { return 'none'; },
        getState() { return { plasma: { charges: 1 } }; },
        buildClientThrowId() { return 'cthrow-ok'; },
        buildThrowIntent() { return { aim: true }; },
        throwPredicted(type, _camera, clientThrowId, throwIntent) {
          harness.calls.throwPredicted.push({
            type: String(type || ''),
            clientThrowId: String(clientThrowId || ''),
            throwIntent: JSON.parse(JSON.stringify(throwIntent || null))
          });
          return true;
        }
      },
      GameNet: {
        commands: {
          sendThrow(type, clientThrowId, throwIntent) {
            harness.calls.throwMessages.push({
              type: String(type || ''),
              clientThrowId: String(clientThrowId || ''),
              throwIntent: JSON.parse(JSON.stringify(throwIntent || null))
            });
            return true;
          }
        }
      }
    },
    createOverrides: {
      getMultiplayerMode() { return true; }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'KeyQ',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.deepEqual(harness.calls.throwMessages, [{
    type: 'plasma',
    clientThrowId: 'cthrow-ok',
    throwIntent: { aim: true }
  }]);
  assert.deepEqual(harness.calls.throwPredicted, [{
    type: 'plasma',
    clientThrowId: 'cthrow-ok',
    throwIntent: { aim: true }
  }]);
  assert.deepEqual(harness.calls.audioCalls, [{
    name: 'throw',
    payload: {
      throwable: 'plasma',
      projectileType: 'plasma'
    }
  }]);
});

test('gameplay controls do not switch weapons from wheel input without pointer lock', async () => {
  const harness = await loadControlsHarness({
    createOverrides: {
      hasInputCapture() { return false; }
    }
  });

  dispatchWheel(harness, 10, { deltaY: 120 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, []);
  assert.deepEqual(harness.calls.appliedWeapons, []);
});

test('gameplay controls unbind removes the wheel listener so relaunches do not stack toggles', async () => {
  const harness = await loadControlsHarness();

  harness.controls.unbind();
  dispatchWheel(harness, 10, { deltaY: 1, deltaMode: 1 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, []);
  assert.deepEqual(harness.calls.appliedWeapons, []);
});

test('gameplay controls clear wheel burst state when transient input is released', async () => {
  const harness = await loadControlsHarness();

  dispatchWheel(harness, 10, { deltaY: 12 });
  dispatchWheel(harness, 20, { deltaY: 12 });

  harness.controls.releaseTransientInput();

  dispatchWheel(harness, 30, { deltaY: 12 });
  dispatchWheel(harness, 1040, { deltaY: 12 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper', 'rifle']);
  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'sniper' }, { id: 'rifle' }]);
});

test('gameplay controls keep keyboard weapon slot switching intact', async () => {
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameHitscan: {
        getWeaponOrder() { return ['rifle', 'shotgun']; },
        getCurrentWeapon() { return { id: 'rifle' }; },
        reloadCurrentWeapon() { return true; },
        toggleWeapon() { throw new Error('toggle path should not run'); },
        setWeapon(weaponId) { return { id: weaponId }; }
      }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'Digit2'
  });

  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'shotgun' }]);
});

test('gameplay controls ignore held or duplicate keyboard weapon slot switches', async () => {
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameHitscan: {
        getWeaponOrder() { return ['rifle', 'shotgun']; },
        getCurrentWeapon() { return { id: 'rifle' }; },
        reloadCurrentWeapon() { return true; },
        toggleWeapon() { throw new Error('toggle path should not run'); },
        setWeapon(weaponId) { return { id: weaponId }; }
      }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'Digit1',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });
  harness.documentObj.dispatch('keydown', {
    code: 'Digit2',
    repeat: true,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.deepEqual(harness.calls.appliedWeapons, []);
});

test('gameplay controls require gameplay capture for keyboard weapon slots', async () => {
  const harness = await loadControlsHarness({
    createOverrides: {
      hasInputCapture() { return false; }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'Digit2',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.deepEqual(harness.calls.appliedWeapons, []);
});

test('gameplay controls trigger roll on E while leaving G available for auto-fire toggle', async () => {
  const harness = await loadControlsHarness();

  harness.documentObj.dispatch('keydown', {
    code: 'KeyE',
    repeat: false,
    preventDefault() {}
  });
  harness.documentObj.dispatch('keydown', {
    code: 'KeyG',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.equal(harness.calls.rolls, 1);
  assert.deepEqual(harness.calls.abilityCasts, []);
});

test('gameplay controls toggle inspect orbit on V and suppress gameplay actions while active', async () => {
  const harness = await loadControlsHarness();

  harness.documentObj.dispatch('keydown', {
    code: 'KeyV',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.deepEqual(harness.calls.inspectToggles, [true]);
  assert.deepEqual(harness.calls.transientDebug.at(-1), {
    text: 'Inspect orbit: ON',
    ms: 1000
  });

  harness.documentObj.dispatch('mousedown', { button: 0 });
  dispatchWheel(harness, 10, { deltaY: 120 });
  harness.documentObj.dispatch('keydown', {
    code: 'KeyR',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });
  harness.documentObj.dispatch('keydown', {
    code: 'KeyQ',
    repeat: false
  });
  harness.documentObj.dispatch('keydown', {
    code: 'KeyE',
    repeat: false,
    preventDefault() {}
  });

  assert.equal(harness.controls.isTriggerHeld(), false);
  assert.equal(harness.calls.tryPlayerFire, 0);
  assert.deepEqual(harness.calls.toggleWeaponCalls, []);
  assert.deepEqual(harness.calls.appliedWeapons, []);
  assert.equal(harness.calls.reloads, 0);
  assert.equal(harness.controls.hasArmedThrowablePreview(), false);
  assert.equal(harness.calls.rolls, 0);

  harness.documentObj.dispatch('keydown', {
    code: 'KeyV',
    repeat: false,
    preventDefault() {},
    stopPropagation() {}
  });

  assert.deepEqual(harness.calls.inspectToggles, [true, false]);
  assert.deepEqual(harness.calls.transientDebug.at(-1), {
    text: 'Inspect orbit: OFF',
    ms: 1000
  });
});

test('gameplay controls honor remapped throwable, roll, debug, and manual keys while ignoring removed binds', async () => {
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameInputBindings: {
        matches(actionId, event) {
          return (
            (actionId === 'throwable' && event.code === 'KeyC') ||
            (actionId === 'roll' && event.code === 'KeyV') ||
            (actionId === 'toggle_debug' && event.code === 'KeyB') ||
            (actionId === 'open_manual' && event.code === 'KeyJ')
          );
        }
      }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'KeyQ',
    repeat: false
  });
  assert.equal(harness.controls.hasArmedThrowablePreview(), false);

  harness.documentObj.dispatch('keydown', {
    code: 'KeyC',
    repeat: false
  });
  assert.equal(harness.controls.hasArmedThrowablePreview(), true);

  harness.documentObj.dispatch('keydown', {
    code: 'KeyV',
    repeat: false,
    preventDefault() {}
  });
  harness.documentObj.dispatch('keydown', {
    code: 'KeyG',
    repeat: false
  });
  harness.documentObj.dispatch('keydown', {
    code: 'KeyB',
    repeat: false
  });
  harness.documentObj.dispatch('keydown', {
    code: 'KeyJ',
    repeat: false,
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });

  assert.equal(harness.calls.rolls, 1);
  assert.deepEqual(harness.calls.abilityCasts, []);
  assert.equal(harness.calls.debugToggles, 1);
  // Docs toggle is handled by menu-shell.js, not gameplay-controls
  assert.equal(harness.calls.docsToggle, 0);
});

test('gameplay controls no longer bind Y to the canonical weapon arm posture', async () => {
  const harness = await loadControlsHarness();
  const events = [];

  harness.documentObj.dispatch('keydown', {
    code: 'KeyY',
    repeat: false,
    preventDefault() { events.push('preventDefault'); },
    stopPropagation() { events.push('stopPropagation'); }
  });

  assert.deepEqual(events, []);
  assert.equal(harness.calls.transientDebug.some((entry) => entry.text.indexOf('Weapon arm layer') >= 0), false);
});

test('gameplay controls send roll direction to the network in multiplayer', async () => {
  const rollMessages = [];
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameNet: {
        commands: {
          sendRoll(payload) {
            rollMessages.push(payload);
            return true;
          }
        }
      }
    },
    createOverrides: {
      getMultiplayerMode() { return true; }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'KeyE',
    repeat: false,
    preventDefault() {}
  });

  assert.equal(harness.calls.rolls, 1);
  assert.deepEqual(rollMessages, [{
    movingForward: true,
    movingBackward: false,
    movingLeft: false,
    movingRight: false
  }]);
});

test('gameplay controls do not start multiplayer roll prediction when roll send fails', async () => {
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameNet: {
        commands: {
          sendRoll(payload) {
            harness.calls.rollMessages.push(payload);
            return false;
          }
        }
      }
    },
    createOverrides: {
      getMultiplayerMode() { return true; }
    }
  });

  harness.documentObj.dispatch('keydown', {
    code: 'KeyE',
    repeat: false,
    preventDefault() {}
  });

  assert.equal(harness.calls.rolls, 0);
  assert.deepEqual(harness.calls.rollMessages, [{
    movingForward: true,
    movingBackward: false,
    movingLeft: false,
    movingRight: false
  }]);
  assert.deepEqual(harness.calls.transientDebug, [{
    text: 'Roll send failed.',
    ms: 700
  }]);
});

test('touch jump releases on pointer up so mobile jump height stays graduated', async () => {
  const harness = await loadControlsHarness({
    touchDevice: true,
    windowSize: { width: 844, height: 390 }
  });

  assert.equal(harness.controls.activateTouchCapture(), true);
  const touchRoot = harness.documentObj.body.children.find((child) => child.id === 'touch-controls');
  const actionCluster = touchRoot.children.find((child) => child.className === 'touch-action-cluster');
  const jumpButton = actionCluster.querySelector('[data-touch-action="jump"]');

  jumpButton.dispatch('pointerdown', {
    pointerId: 9,
    preventDefault() {}
  });
  assert.equal(harness.calls.movementInputs.at(-1).jump, true);

  jumpButton.dispatch('pointerup', {
    pointerId: 9,
    preventDefault() {}
  });
  assert.equal(harness.calls.movementInputs.at(-1).jump, false);
});

test('touch movement sprints only in the outer forward wedge', async () => {
  const harness = await loadControlsHarness({
    touchDevice: true,
    windowSize: { width: 844, height: 390 }
  });

  assert.equal(harness.controls.activateTouchCapture(), true);
  const touchRoot = harness.documentObj.body.children.find((child) => child.id === 'touch-controls');
  const moveStick = touchRoot.children.find((child) => child.className === 'touch-stick touch-stick-left');
  const ring = moveStick.querySelector('.touch-stick-ring');
  const knob = moveStick.querySelector('.touch-stick-knob');
  moveStick.setBoundingClientRect({ left: 0, top: 0, width: 332, height: 332 });
  ring.setBoundingClientRect({ left: 46, top: 46, width: 240, height: 240 });
  knob.setBoundingClientRect({ left: 140, top: 140, width: 52, height: 52 });

  moveStick.dispatch('pointerdown', {
    pointerId: 12,
    clientX: 166,
    clientY: 166,
    preventDefault() {}
  });

  moveStick.dispatch('pointermove', {
    pointerId: 12,
    clientX: 166,
    clientY: 78,
    preventDefault() {}
  });
  assert.equal(harness.calls.movementInputs.at(-1).forward, true);
  assert.equal(harness.calls.movementInputs.at(-1).sprint, false);
  assert.equal(moveStick.classList.contains('sprinting'), false);

  moveStick.dispatch('pointermove', {
    pointerId: 12,
    clientX: 166,
    clientY: 42,
    preventDefault() {}
  });
  assert.equal(harness.calls.movementInputs.at(-1).forward, true);
  assert.equal(harness.calls.movementInputs.at(-1).sprint, true);
  assert.equal(moveStick.classList.contains('sprinting'), true);

  moveStick.dispatch('pointermove', {
    pointerId: 12,
    clientX: 294,
    clientY: 166,
    preventDefault() {}
  });
  assert.equal(harness.calls.movementInputs.at(-1).right, true);
  assert.equal(harness.calls.movementInputs.at(-1).sprint, false);
  assert.equal(moveStick.classList.contains('sprinting'), false);
});

test('gameplay controls close the loaded docs runtime on escape', async () => {
  const harness = await loadControlsHarness({
    docsOpen: true
  });

  harness.documentObj.dispatch('keydown', {
    code: 'Escape',
    repeat: false,
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault() {},
    stopPropagation() {}
  });

  assert.equal(harness.calls.docsClose, 1);
});

test('gameplay controls default desktop auto fire to off until the user enables it', async () => {
  const harness = await loadControlsHarness();

  assert.equal(harness.controls.isDesktopAutoFireEnabled(), false);
  assert.equal(harness.runtime.GameGameplayControls.isDesktopAutoFireEnabled(), false);
});

test('gameplay controls default camera view to over shoulder', async () => {
  const cameraButton = new FakeButton();
  const harness = await loadControlsHarness({
    documentElements: {
      'camera-view-toggle-btn': cameraButton
    }
  });

  assert.equal(harness.controls.isFirstPersonViewEnabled(), false);
  assert.equal(harness.runtime.GameGameplayControls.isFirstPersonViewEnabled(), false);
  assert.equal(cameraButton.textContent, 'CAMERA: OVER SHOULDER');
  assert.equal(cameraButton.getAttribute('aria-pressed'), 'false');
});

test('gameplay controls bind the camera view toggle and persist camera state', async () => {
  const cameraButton = new FakeButton();
  const harness = await loadControlsHarness({
    documentElements: {
      'camera-view-toggle-btn': cameraButton
    },
    localStorageValues: {
      'mayhem.cameraViewMode': 'over_shoulder'
    }
  });

  assert.equal(harness.controls.isFirstPersonViewEnabled(), false);
  assert.equal(harness.runtime.GameGameplayControls.isFirstPersonViewEnabled(), false);
  assert.equal(cameraButton.textContent, 'CAMERA: OVER SHOULDER');
  assert.equal(cameraButton.getAttribute('aria-pressed'), 'false');

  cameraButton.click();

  assert.equal(harness.controls.isFirstPersonViewEnabled(), true);
  assert.equal(harness.runtime.GameGameplayControls.isFirstPersonViewEnabled(), true);
  assert.equal(cameraButton.textContent, 'CAMERA: FPS');
  assert.equal(cameraButton.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(harness.calls.localStorageWrites.at(-1), {
    key: 'mayhem.cameraViewMode',
    value: 'fps'
  });
});

test('gameplay controls tune and persist the first-person camera origin from F6 mode', async () => {
  const events = [];
  const harness = await loadControlsHarness({
    localStorageValues: {
      'mayhem.cameraViewMode': 'over_shoulder'
    }
  });
  const dispatchKey = (code, patch = {}) => harness.documentObj.dispatch('keydown', {
    code,
    repeat: false,
    preventDefault() { events.push(`${code}:preventDefault`); },
    stopPropagation() { events.push(`${code}:stopPropagation`); },
    ...patch
  });

  dispatchKey('F6');

  assert.equal(harness.controls.isCameraOriginTuneModeEnabled(), true);
  assert.equal(harness.controls.isFirstPersonViewEnabled(), true);
  assert.equal(harness.runtime.GameGameplayControls.isCameraOriginTuneModeEnabled(), true);
  assert.deepEqual(harness.calls.localStorageWrites.at(-1), {
    key: 'mayhem.cameraViewMode',
    value: 'fps'
  });

  dispatchKey('ArrowUp');
  dispatchKey('ArrowRight');
  dispatchKey('PageUp', { shiftKey: true });

  assert.deepEqual(JSON.parse(JSON.stringify(harness.controls.getFirstPersonCameraOffset())), {
    x: 0.05,
    y: 0.01,
    z: 0.05
  });
  assert.deepEqual(JSON.parse(JSON.stringify(harness.runtime.GameGameplayControls.getFirstPersonCameraOffset())), {
    x: 0.05,
    y: 0.01,
    z: 0.05
  });
  assert.equal(harness.calls.localStorageWrites.at(-1).key, 'mayhem.firstPersonCameraOriginOffset.v1');
  assert.deepEqual(JSON.parse(harness.calls.localStorageWrites.at(-1).value), {
    x: 0.05,
    y: 0.01,
    z: 0.05
  });

  dispatchKey('Home');

  assert.deepEqual(JSON.parse(JSON.stringify(harness.controls.getFirstPersonCameraOffset())), {
    x: 0,
    y: 0,
    z: 0
  });
  assert.equal(events.includes('F6:preventDefault'), true);
  assert.equal(events.includes('ArrowUp:preventDefault'), true);
  assert.equal(events.includes('Home:preventDefault'), true);
  assert.equal(harness.calls.transientDebug.some((entry) => entry.text.includes('Camera origin tuning: ON')), true);
});
