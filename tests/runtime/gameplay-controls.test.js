import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class FakeDocument {
  constructor() {
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

  getElementById() {
    return null;
  }

  dispatch(type, event) {
    const list = this.listeners.get(String(type || '')) || [];
    for (const handler of list) handler(event || {});
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
  const [weaponSwapCode, controlsCode] = await Promise.all([
    fs.readFile(new URL('../../js/runtime/weapon-swap-input.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/runtime/gameplay-controls.js', import.meta.url), 'utf8')
  ]);
  const documentObj = new FakeDocument();
  const windowObj = new FakeWindow();
  const timeState = { now: 0 };
  let currentWeaponId = 'rifle';
  const defaultWeaponOrder = ['rifle', 'sniper'];
  const calls = {
    clearTrajectoryPreview: 0,
    updateTrajectoryPreview: 0,
    updateTrackingReticle: [],
    tryPlayerFire: 0,
    docsToggle: 0,
    abilityCasts: [],
    debugToggles: 0,
    reloads: 0,
    reloadMessages: [],
    transientDebug: [],
    toggleWeaponCalls: [],
    appliedWeapons: []
  };

  const runtime = {
    GameThrowables: {
      getSelectedThrowable() { return 'plasma'; },
      getPreviewType() { return 'trajectory'; },
      clearTrajectoryPreview() { calls.clearTrajectoryPreview += 1; },
      updateTrajectoryPreview() { calls.updateTrajectoryPreview += 1; }
    },
    GameUI: {
      updateTrackingReticle(visible, hasTarget) {
        calls.updateTrackingReticle.push({ visible: !!visible, hasTarget: !!hasTarget });
      },
      updateAbilityInfo() {}
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
      getRotation() { return { yaw: 0, pitch: 0 }; }
    },
    GameAbilities: {
      getHudState() { return {}; },
      triggerAbility(slotIndex) {
        calls.abilityCasts.push(Number(slotIndex || 0));
        return { ok: true };
      }
    },
    GameDocs: {
      toggle() {
        calls.docsToggle += 1;
      }
    },
    ...options.runtimeOverrides
  };

  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    document: documentObj,
    window: windowObj,
    console,
    Date,
    performance: {
      now() { return timeState.now; }
    }
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
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
        sendReload(weaponId) {
          harness.calls.reloadMessages.push(String(weaponId || ''));
          return true;
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
        sendReload(weaponId) {
          harness.calls.reloadMessages.push(String(weaponId || ''));
          return false;
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

test('gameplay controls toggle weapons once for a single mouse-wheel notch', async () => {
  const harness = await loadControlsHarness();

  dispatchWheel(harness, 10, { deltaY: 1, deltaMode: 1 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'sniper' }]);
});

test('gameplay controls debounce duplicate mouse-wheel line events from the same notch', async () => {
  const harness = await loadControlsHarness();

  dispatchWheel(harness, 10, { deltaY: 1, deltaMode: 1 });
  dispatchWheel(harness, 60, { deltaY: 1, deltaMode: 1 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'sniper' }]);
});

test('gameplay controls ignore opposite-direction mouse-wheel input during the notch lockout', async () => {
  const harness = await loadControlsHarness();

  dispatchWheel(harness, 10, { deltaY: 1, deltaMode: 1 });
  dispatchWheel(harness, 60, { deltaY: -1, deltaMode: 1 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'sniper' }]);
});

test('gameplay controls let the mouse wheel toggle again after the one-second switch lockout expires', async () => {
  const harness = await loadControlsHarness();

  dispatchWheel(harness, 10, { deltaY: 1, deltaMode: 1 });
  dispatchWheel(harness, 1200, { deltaY: -1, deltaMode: 1 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper', 'rifle']);
  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'sniper' }, { id: 'rifle' }]);
});

test('gameplay controls keep swipe bursts locked briefly even after a quiet release packet', async () => {
  const harness = await loadControlsHarness();

  dispatchWheel(harness, 10, { deltaY: 10 });
  dispatchWheel(harness, 20, { deltaY: 10 });
  dispatchWheel(harness, 30, { deltaY: 10 });
  dispatchWheel(harness, 40, { deltaY: 10 });
  dispatchWheel(harness, 55, { deltaY: 2 });
  dispatchWheel(harness, 70, { deltaY: 12 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'sniper' }]);
});

test('gameplay controls toggle weapons again after quiet release once the one-second switch lockout expires', async () => {
  const harness = await loadControlsHarness();

  dispatchWheel(harness, 10, { deltaY: 10 });
  dispatchWheel(harness, 20, { deltaY: 10 });
  dispatchWheel(harness, 30, { deltaY: 10 });
  dispatchWheel(harness, 40, { deltaY: 10 });
  dispatchWheel(harness, 55, { deltaY: 2 });
  dispatchWheel(harness, 1100, { deltaY: 12 });
  dispatchWheel(harness, 1110, { deltaY: 12 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper', 'rifle']);
  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'sniper' }, { id: 'rifle' }]);
});

test('gameplay controls keep delayed touchpad momentum from retriggering weapon switching', async () => {
  const harness = await loadControlsHarness();

  dispatchWheel(harness, 10, { deltaY: 12 });
  dispatchWheel(harness, 20, { deltaY: 12 });
  dispatchWheel(harness, 230, { deltaY: 12 });
  dispatchWheel(harness, 240, { deltaY: 12 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'sniper' }]);
});

test('gameplay controls toggle weapons again after the one-second switch lockout expires even if the sign flips', async () => {
  const harness = await loadControlsHarness();

  dispatchWheel(harness, 10, { deltaY: 12 });
  dispatchWheel(harness, 20, { deltaY: 12 });
  dispatchWheel(harness, 55, { deltaY: 2 });
  dispatchWheel(harness, 1100, { deltaY: -12 });
  dispatchWheel(harness, 1110, { deltaY: -12 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper', 'rifle']);
  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'sniper' }, { id: 'rifle' }]);
});

test('gameplay controls recover after the one-second switch lockout even when the device never sends a quiet release packet', async () => {
  const harness = await loadControlsHarness();

  dispatchWheel(harness, 10, { deltaY: 12 });
  dispatchWheel(harness, 20, { deltaY: 12 });
  dispatchWheel(harness, 1100, { deltaY: 12 });
  dispatchWheel(harness, 1110, { deltaY: 12 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper', 'rifle']);
  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'sniper' }, { id: 'rifle' }]);
});

test('gameplay controls toggle weapons from horizontal touchpad swipes and ignore tiny jitter', async () => {
  const harness = await loadControlsHarness();

  dispatchWheel(harness, 10, { deltaX: 14, deltaY: 6 });
  dispatchWheel(harness, 20, { deltaX: 14, deltaY: 6 });
  dispatchWheel(harness, 30, { deltaY: 7 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
  assert.deepEqual(harness.calls.appliedWeapons, [{ id: 'sniper' }]);
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

test('gameplay controls expose a test handle that can force input capture and reset swap state', async () => {
  const harness = await loadControlsHarness({
    createOverrides: {
      hasInputCapture() { return false; }
    }
  });

  const handle = harness.runtime.GameGameplayControls._test.getActiveHandle();
  assert.ok(handle);

  handle.setInputCaptureOverride(true);
  dispatchWheel(harness, 10, { deltaY: 1, deltaMode: 1 });
  dispatchWheel(harness, 20, { deltaY: 1, deltaMode: 1 });

  handle.resetState();
  dispatchWheel(harness, 30, { deltaY: 1, deltaMode: 1 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper', 'rifle']);
  assert.equal(handle.readState().inputCaptureOverride, true);
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

test('gameplay controls honor remapped throwable, ability, debug, and manual keys', async () => {
  const harness = await loadControlsHarness({
    runtimeOverrides: {
      GameInputBindings: {
        matches(actionId, event) {
          return (
            (actionId === 'throwable' && event.code === 'KeyC') ||
            (actionId === 'ability_1' && event.code === 'KeyG') ||
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

  assert.deepEqual(harness.calls.abilityCasts, [1]);
  assert.equal(harness.calls.debugToggles, 1);
  assert.equal(harness.calls.docsToggle, 1);
});
