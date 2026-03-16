import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadWeaponSwapHarness(options = {}) {
  const code = await fs.readFile(new URL('../../js/runtime/weapon-swap-input.js', import.meta.url), 'utf8');
  const timeState = { now: 0 };
  let currentWeaponId = String(options.initialWeaponId || 'rifle');
  const weaponOrder = Array.isArray(options.weaponOrder) && options.weaponOrder.length
    ? options.weaponOrder.slice(0, 2)
    : ['rifle', 'sniper'];
  const calls = {
    appliedWeapons: [],
    toggleWeaponCalls: []
  };

  const sandbox = {
    __MAYHEM_RUNTIME: {},
    globalThis: null,
    window: {
      innerWidth: 1280,
      innerHeight: 720
    },
    performance: {
      now() { return timeState.now; }
    },
    Date,
    console
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  const api = sandbox.__MAYHEM_RUNTIME.GameWeaponSwapInput.create({
    applyWeapon(weapon) {
      calls.appliedWeapons.push({ id: String(weapon && weapon.id || '') });
    },
    hasInputCapture() {
      return options.hasInputCapture !== false;
    },
    toggleWeapon() {
      const currentIdx = weaponOrder.indexOf(currentWeaponId);
      const nextWeaponId = currentIdx === 1
        ? weaponOrder[0]
        : (weaponOrder[1] || weaponOrder[0]);
      currentWeaponId = String(nextWeaponId || currentWeaponId || weaponOrder[0]);
      calls.toggleWeaponCalls.push(currentWeaponId);
      return { id: currentWeaponId };
    },
    ...(options.createOverrides || {})
  });

  return {
    api,
    calls,
    timeState
  };
}

function dispatchWheel(harness, timeMs, event = {}) {
  harness.timeState.now = Number(timeMs || 0);
  return harness.api.handleWheel({
    deltaMode: 0,
    deltaX: 0,
    deltaY: 0,
    preventDefault() {},
    ...event
  });
}

test('weapon swap input toggles once for a discrete wheel notch', async () => {
  const harness = await loadWeaponSwapHarness();

  const result = dispatchWheel(harness, 10, { deltaY: 1, deltaMode: 1 });

  assert.equal(result.toggled, true);
  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
});

test('weapon swap input swallows duplicate same-notch wheel events', async () => {
  const harness = await loadWeaponSwapHarness();

  dispatchWheel(harness, 10, { deltaY: 1, deltaMode: 1 });
  const result = dispatchWheel(harness, 60, { deltaY: 1, deltaMode: 1 });

  assert.equal(result.reason, 'lockout');
  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
});

test('weapon swap input swallows opposite-direction wheel events during lockout', async () => {
  const harness = await loadWeaponSwapHarness();

  dispatchWheel(harness, 10, { deltaY: 1, deltaMode: 1 });
  const result = dispatchWheel(harness, 60, { deltaY: -1, deltaMode: 1 });

  assert.equal(result.reason, 'lockout');
  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
});

test('weapon swap input allows a later wheel event after lockout', async () => {
  const harness = await loadWeaponSwapHarness();

  dispatchWheel(harness, 10, { deltaY: 1, deltaMode: 1 });
  dispatchWheel(harness, 200, { deltaY: -1, deltaMode: 1 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper', 'rifle']);
});

test('weapon swap input toggles once after a touchpad burst crosses threshold', async () => {
  const harness = await loadWeaponSwapHarness();

  dispatchWheel(harness, 10, { deltaY: 12 });
  const result = dispatchWheel(harness, 20, { deltaY: 12 });

  assert.equal(result.toggled, true);
  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
});

test('weapon swap input keeps delayed momentum packets from retriggering', async () => {
  const harness = await loadWeaponSwapHarness();

  dispatchWheel(harness, 10, { deltaY: 12 });
  dispatchWheel(harness, 20, { deltaY: 12 });
  const result = dispatchWheel(harness, 230, { deltaY: 12 });

  assert.equal(result.reason, 'blocked');
  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
});

test('weapon swap input toggles again after a quiet release packet', async () => {
  const harness = await loadWeaponSwapHarness();

  dispatchWheel(harness, 10, { deltaY: 12 });
  dispatchWheel(harness, 20, { deltaY: 12 });
  dispatchWheel(harness, 55, { deltaY: 2 });
  dispatchWheel(harness, 70, { deltaY: -12 });
  dispatchWheel(harness, 80, { deltaY: -12 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper', 'rifle']);
});

test('weapon swap input recovers after the gesture timeout without a quiet release packet', async () => {
  const harness = await loadWeaponSwapHarness();

  dispatchWheel(harness, 10, { deltaY: 12 });
  dispatchWheel(harness, 20, { deltaY: 12 });
  dispatchWheel(harness, 520, { deltaY: 12 });
  dispatchWheel(harness, 530, { deltaY: 12 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper', 'rifle']);
});

test('weapon swap input counts horizontal-dominant swipe bursts', async () => {
  const harness = await loadWeaponSwapHarness();

  dispatchWheel(harness, 10, { deltaX: 14, deltaY: 6 });
  dispatchWheel(harness, 20, { deltaX: 14, deltaY: 6 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper']);
});

test('weapon swap input test helpers can override capture and clear internal state', async () => {
  const harness = await loadWeaponSwapHarness({ hasInputCapture: false });

  assert.equal(dispatchWheel(harness, 10, { deltaY: 1, deltaMode: 1 }).handled, false);

  harness.api.setInputCaptureOverride(true);
  dispatchWheel(harness, 20, { deltaY: 1, deltaMode: 1 });
  harness.api.resetState();
  dispatchWheel(harness, 30, { deltaY: 1, deltaMode: 1 });

  assert.deepEqual(harness.calls.toggleWeaponCalls, ['sniper', 'rifle']);
  assert.equal(harness.api.readState().inputCaptureOverride, true);
});
