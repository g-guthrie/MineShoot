import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

function createStorage(seed = {}) {
  const map = new Map(Object.entries(seed).map(([key, value]) => [String(key), String(value)]));
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

async function loadBindingsHarness(seed = {}) {
  const [bindingsCode, labelsCode] = await Promise.all([
    fs.readFile(new URL('../../js/core/input-bindings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/core/input-labels.js', import.meta.url), 'utf8')
  ]);
  const storage = createStorage(seed);
  const sandbox = {
    console,
    window: {
      localStorage: storage
    },
    __MAYHEM_RUNTIME: {},
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  sandbox.globalThis.window = sandbox.window;
  const context = vm.createContext(sandbox);
  vm.runInContext(bindingsCode, context);
  vm.runInContext(labelsCode, context);
  return {
    api: sandbox.__MAYHEM_RUNTIME.GameInputBindings,
    labels: sandbox.__MAYHEM_RUNTIME.GameInputLabels,
    storage
  };
}

function defaultBindings() {
  return {
    move_forward: 'KeyW',
    move_left: 'KeyA',
    move_backward: 'KeyS',
    move_right: 'KeyD',
    sprint: 'Shift',
    jump: 'Space',
    roll: 'KeyE',
    ads_key: 'Alt',
    reload: 'KeyR',
    weapon_slot_1: 'Digit1',
    weapon_slot_2: 'Digit2',
    throwable: 'KeyQ',
    open_manual: 'KeyI',
    inspect_player: 'KeyV',
    toggle_auto_fire: 'KeyG',
    toggle_debug: 'KeyH'
  };
}

test('input bindings expose the shipped defaults and normalize modifier labels', async () => {
  const { api, labels } = await loadBindingsHarness();

  assert.deepEqual(JSON.parse(JSON.stringify(api.getBindings())), defaultBindings());
  assert.equal(api.getDisplayLabel('ads_key'), 'ALT');
  assert.equal(labels.getBindingLabel('ads_key', 'Alt'), 'ALT');
  assert.equal(labels.getBindingLabel('missing_action', 'Fallback'), 'Fallback');
  assert.equal(api.getDisplayLabel('weapon_slot_1'), '1');
  assert.equal(api.getDisplayLabel('inspect_player'), 'V');
  assert.equal(api.tokenFromEvent({ code: 'ShiftRight' }), 'Shift');
  assert.equal(api.matches('ads_key', { code: 'AltLeft' }), true);
  assert.equal(api.matchesWithFallback('reload', { code: 'KeyR' }, 'KeyX'), true);
  assert.equal(labels.matchesBinding('reload', { code: 'KeyR' }, 'KeyX'), true);
  assert.equal(labels.matchesBinding('move_forward', { code: 'KeyW' }, 'ArrowUp'), true);
  // A bound action listens to its binding only: the hardcoded fallback must not
  // keep a second key alive, or rebound actions double-trigger on their old key.
  assert.equal(labels.matchesBinding('move_forward', { code: 'ArrowUp' }, 'ArrowUp'), false);
  assert.equal(labels.matchesBinding('unregistered_action', { code: 'F6' }, 'F6'), true);
});

test('rebound actions release their old key instead of double-triggering', async () => {
  const { api } = await loadBindingsHarness();
  // Swapping W/S: assigning KeyS to move_forward swaps move_backward onto KeyW.
  api.assign('move_forward', 'KeyS');
  assert.equal(api.getBinding('move_forward'), 'KeyS');
  assert.equal(api.getBinding('move_backward'), 'KeyW');

  // Pressing W must press backward only — never both directions at once.
  assert.equal(api.matchesWithFallback('move_forward', { code: 'KeyW' }, 'KeyW'), false);
  assert.equal(api.matchesWithFallback('move_backward', { code: 'KeyW' }, 'KeyS'), true);
  assert.equal(api.matchesWithFallback('move_forward', { code: 'KeyS' }, 'KeyW'), true);

  // An unregistered fallback-only action yields to tokens owned by real bindings.
  assert.equal(api.matchesWithFallback('camera_origin_tune', { code: 'F6' }, 'F6'), true);
  api.assign('toggle_debug', 'F6');
  assert.equal(api.matchesWithFallback('camera_origin_tune', { code: 'F6' }, 'F6'), false);
});

test('input bindings reject reserved targets', async () => {
  const { api } = await loadBindingsHarness();
  const outcome = api.assign('jump', 'Escape');

  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, 'reserved');
  assert.equal(api.getBinding('jump'), 'Space');
});

test('input bindings swap conflicting assignments and persist them', async () => {
  const { api, storage } = await loadBindingsHarness();
  const outcome = api.assign('sprint', 'KeyW');

  assert.equal(outcome.ok, true);
  assert.equal(outcome.swappedActionId, 'move_forward');
  assert.equal(api.getBinding('sprint'), 'KeyW');
  assert.equal(api.getBinding('move_forward'), 'Shift');

  const stored = JSON.parse(storage.getItem(api.storageKey));
  assert.equal(stored.sprint, 'KeyW');
  assert.equal(stored.move_forward, 'Shift');
});

test('input bindings load a valid stored map', async () => {
  const custom = defaultBindings();
  custom.move_forward = 'KeyI';
  custom.open_manual = 'KeyJ';
  custom.sprint = 'KeyC';
  custom.reload = 'KeyT';
  const { api } = await loadBindingsHarness({
    'mayhem.inputBindings.v1': JSON.stringify(custom)
  });

  assert.deepEqual(JSON.parse(JSON.stringify(api.getBindings())), custom);
  assert.equal(api.getDisplayLabel('open_manual'), 'J');
});

test('input bindings migrate the old E mapping to the new roll slot and drop the removed bind', async () => {
  const legacy = {
    move_forward: 'KeyW',
    move_left: 'KeyA',
    move_backward: 'KeyS',
    move_right: 'KeyD',
    sprint: 'Shift',
    jump: 'Space',
    ads_key: 'Alt',
    reload: 'KeyR',
    weapon_slot_1: 'Digit1',
    weapon_slot_2: 'Digit2',
    throwable: 'KeyQ',
    ability_1: 'KeyE',
    open_manual: 'KeyI',
    toggle_debug: 'KeyH'
  };
  const { api } = await loadBindingsHarness({
    'mayhem.inputBindings.v1': JSON.stringify(legacy)
  });

  assert.equal(api.getBinding('roll'), 'KeyE');
  assert.equal(api.getBinding('ability_1'), '');
  assert.equal(api.getBinding('move_forward'), 'KeyW');
});

test('input bindings fall back to defaults when stored data is malformed', async () => {
  const { api } = await loadBindingsHarness({
    'mayhem.inputBindings.v1': '{not-json'
  });

  assert.deepEqual(JSON.parse(JSON.stringify(api.getBindings())), defaultBindings());
});

test('input bindings fall back to defaults when stored data contains duplicates', async () => {
  const duplicated = defaultBindings();
  duplicated.sprint = 'KeyW';
  const { api } = await loadBindingsHarness({
    'mayhem.inputBindings.v1': JSON.stringify(duplicated)
  });

  assert.deepEqual(JSON.parse(JSON.stringify(api.getBindings())), defaultBindings());
});
