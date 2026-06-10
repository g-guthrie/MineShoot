import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class FakeElement {
  constructor(tagName = 'div', id = '', ownerDocument = null) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.id = id || '';
    this.ownerDocument = ownerDocument;
    this.hidden = false;
    this.disabled = false;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.value = '';
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this.listeners = new Map();
    this._classSet = new Set();
    this.classList = {
      add: (...tokens) => {
        for (const token of tokens) this._classSet.add(String(token || ''));
      },
      remove: (...tokens) => {
        for (const token of tokens) this._classSet.delete(String(token || ''));
      },
      toggle: (token, force) => {
        const normalized = String(token || '');
        const next = force === undefined ? !this._classSet.has(normalized) : !!force;
        if (next) this._classSet.add(normalized);
        else this._classSet.delete(normalized);
        return next;
      },
      contains: (token) => this._classSet.has(String(token || ''))
    };
    Object.defineProperty(this, 'innerHTML', {
      get: () => '',
      set: () => {
        this.children = [];
        this.childNodes = this.children;
        this.textContent = '';
      }
    });
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
    if (this.hidden || this.disabled) return;
    const handlers = this.listeners.get('click') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'click',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {}
      });
    }
  }
}

function findByDataset(root, key, value) {
  if (!root) return null;
  if (root.dataset && root.dataset[key] === value) return root;
  const children = Array.isArray(root.children) ? root.children : [];
  for (const child of children) {
    const found = findByDataset(child, key, value);
    if (found) return found;
  }
  return null;
}

function classTokens(element) {
  return element && element._classSet ? Array.from(element._classSet) : [];
}

async function loadMenuLoadoutHarness({ storageMap, deferShared = false, autoInit = true, sharedOverride = null } = {}) {
  const [inputLabelsCode, loadoutStateCode, loadoutRuntimeCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/core/input-labels.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/app/loadout-state.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/app/loadout-runtime-sync.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/app/menu-loadout.js', import.meta.url), 'utf8')
  ]);
  const store = storageMap || new Map();
  const weaponOrderCalls = [];
  const playerLoadoutCalls = [];
  const netWeaponLoadoutCalls = [];
  const throwableSelectionCalls = [];
  const abilityLoadoutCalls = [];
  const netAbilityLoadoutCalls = [];
  const abilityHudCalls = [];

  const documentObj = {
    activeElement: null,
    elements: {},
    getElementById(id) {
      return this.elements[String(id || '')] || null;
    },
    createElement(tagName) {
      return new FakeElement(tagName, '', this);
    }
  };

  const ids = [
    ['div', 'menu-loadout-band'],
    ['div', 'loadout-row'],
    ['div', 'weapon-slot-panel'],
    ['div', 'weapon-slot-title'],
    ['div', 'weapon-slot-buttons'],
    ['button', 'weapon-slot-primary'],
    ['button', 'weapon-slot-secondary'],
    ['div', 'weapon-choice-grid'],
    ['div', 'throwable-slot-panel'],
    ['div', 'throwable-slot-title'],
    ['div', 'throwable-choice-grid']
  ];

  for (const [tagName, id] of ids) {
    documentObj.elements[id] = new FakeElement(tagName, id, documentObj);
  }

  documentObj.elements['weapon-slot-panel'].hidden = true;
  documentObj.elements['throwable-slot-panel'].hidden = true;

  const windowObj = {
    localStorage: {
      getItem(key) {
        return store.has(String(key || '')) ? store.get(String(key || '')) : null;
      },
      setItem(key, value) {
        store.set(String(key || ''), String(value || ''));
      },
      removeItem(key) {
        store.delete(String(key || ''));
      }
    }
  };

  const shared = sharedOverride || {
    gameplayTuning: {
      weaponStats: {
        machinegun: { name: 'Machinegun' },
        shotgun: { name: 'Shotgun' },
        rifle: { name: 'Rifle' }
      },
      throwables: {
        order: ['frag', 'plasma'],
        frag: { id: 'frag', label: 'Frag', previewType: 'trajectory' },
        plasma: { id: 'plasma', label: 'Plasma', previewType: 'none' }
      }
    },
    getSelectableWeaponIds() {
      return ['machinegun', 'shotgun', 'rifle'];
    },
    getDefaultWeaponLoadout() {
      return ['rifle', 'shotgun'];
    },
    getDefaultThrowableId() {
      return 'frag';
    },
    normalizeThrowableId(throwableId) {
      return String(throwableId || 'frag');
    }
  };

  const sandbox = {
    console,
    window: windowObj,
    document: documentObj,
    __MAYHEM_RUNTIME: {
      GameShared: deferShared ? null : shared,
      GameHitscan: {
        setWeaponOrder(slots) {
          weaponOrderCalls.push(Array.from(slots || []));
        }
      },
      GamePlayer: {
        setLoadout(loadout) {
          playerLoadoutCalls.push(JSON.parse(JSON.stringify(loadout || null)));
        }
      },
      GameNet: {
        commands: {
          sendWeaponLoadout(primaryId, secondaryId) {
            netWeaponLoadoutCalls.push([String(primaryId || ''), String(secondaryId || '')]);
            return true;
          },
          sendAbilityLoadout(abilityId) {
            netAbilityLoadoutCalls.push(String(abilityId || ''));
          }
        }
      },
      GameThrowables: {
        setSelectedThrowable(throwableId) {
          throwableSelectionCalls.push(String(throwableId || ''));
        }
      },
      GameAbilities: {
        setLoadout(abilityId) {
          abilityLoadoutCalls.push(String(abilityId || ''));
        },
        getHudState() {
          return {};
        }
      },
      GameUI: {
        updateAbilityInfo(payload) {
          abilityHudCalls.push(payload || null);
        }
      }
    },
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  sandbox.globalThis.window = windowObj;
  sandbox.globalThis.document = documentObj;

  const context = vm.createContext(sandbox);
  vm.runInContext(inputLabelsCode, context);
  vm.runInContext(loadoutStateCode, context);
  vm.runInContext(loadoutRuntimeCode, context);
  vm.runInContext(code, context);
  if (autoInit) sandbox.__MAYHEM_RUNTIME.GameMenuLoadout.init();

  return {
    runtime: sandbox.__MAYHEM_RUNTIME,
    shared,
    elements: documentObj.elements,
    storage: store,
    weaponOrderCalls,
    playerLoadoutCalls,
    netWeaponLoadoutCalls,
    throwableSelectionCalls,
    abilityLoadoutCalls,
    netAbilityLoadoutCalls,
    abilityHudCalls
  };
}

test('loadout initializes the active weapons and throwable panels', async () => {
  const storage = new Map();
  const harness = await loadMenuLoadoutHarness({ storageMap: storage });
  const { elements, runtime } = harness;

  assert.equal(elements['weapon-slot-title'].textContent, 'Weapons');
  assert.equal(elements['throwable-slot-title'].textContent, 'Throwables');
  assert.equal(runtime.GameMenuLoadout.getExpandedSection(), 'all');
});

test('loadout runtime snapshot updates after weapon and throwable selections change', async () => {
  const harness = await loadMenuLoadoutHarness();
  const { elements, runtime, throwableSelectionCalls, abilityLoadoutCalls, netAbilityLoadoutCalls } = harness;

  const machinegunChoice = findByDataset(elements['weapon-choice-grid'], 'weaponId', 'machinegun');
  const rifleChoice = findByDataset(elements['weapon-choice-grid'], 'weaponId', 'rifle');
  const plasmaChoice = findByDataset(elements['throwable-choice-grid'], 'throwableId', 'plasma');

  assert.ok(machinegunChoice);
  assert.ok(rifleChoice);
  assert.ok(plasmaChoice);

  machinegunChoice.click();
  rifleChoice.click();
  plasmaChoice.click();

  const snapshot = runtime.GameMenuLoadout.getRuntimeSnapshot();

  assert.deepEqual(Array.from(snapshot.weaponSlots), ['machinegun', 'rifle']);
  assert.equal(snapshot.selectedThrowableId, 'plasma');
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'selectedAbilityId'), false);
  assert.equal(throwableSelectionCalls.at(-1), 'plasma');
  assert.deepEqual(abilityLoadoutCalls, []);
  assert.deepEqual(netAbilityLoadoutCalls, []);
});

test('weapon draft stays local until the second pick commits the selected loadout', async () => {
  const harness = await loadMenuLoadoutHarness();
  const { elements, runtime, weaponOrderCalls, playerLoadoutCalls, netWeaponLoadoutCalls } = harness;

  const machinegunChoice = findByDataset(elements['weapon-choice-grid'], 'weaponId', 'machinegun');
  const rifleChoice = findByDataset(elements['weapon-choice-grid'], 'weaponId', 'rifle');

  assert.ok(machinegunChoice);
  assert.ok(rifleChoice);
  assert.deepEqual(Array.from(runtime.GameMenuLoadout.getWeaponSlots()), ['rifle', 'shotgun']);
  assert.deepEqual(Array.from(runtime.GameMenuLoadout.getDraftWeaponSlots()), ['rifle', 'shotgun']);
  assert.deepEqual(weaponOrderCalls, [['rifle', 'shotgun']]);
  assert.deepEqual(playerLoadoutCalls, [{ slots: ['rifle', 'shotgun'] }]);
  assert.deepEqual(netWeaponLoadoutCalls, []);

  machinegunChoice.click();

  assert.deepEqual(Array.from(runtime.GameMenuLoadout.getWeaponSlots()), ['rifle', 'shotgun']);
  assert.deepEqual(Array.from(runtime.GameMenuLoadout.getDraftWeaponSlots()), ['machinegun', '']);
  assert.deepEqual(weaponOrderCalls, [['rifle', 'shotgun']]);
  assert.deepEqual(playerLoadoutCalls, [{ slots: ['rifle', 'shotgun'] }]);
  assert.deepEqual(netWeaponLoadoutCalls, []);

  rifleChoice.click();

  assert.deepEqual(Array.from(runtime.GameMenuLoadout.getWeaponSlots()), ['machinegun', 'rifle']);
  assert.deepEqual(Array.from(runtime.GameMenuLoadout.getDraftWeaponSlots()), ['machinegun', 'rifle']);
  assert.deepEqual(weaponOrderCalls, [['rifle', 'shotgun'], ['machinegun', 'rifle']]);
  assert.deepEqual(playerLoadoutCalls, [{ slots: ['rifle', 'shotgun'] }, { slots: ['machinegun', 'rifle'] }]);
  assert.deepEqual(netWeaponLoadoutCalls, [['machinegun', 'rifle']]);
});

test('loadout runtime snapshot only exposes weapons and throwables', async () => {
  const harness = await loadMenuLoadoutHarness();
  const { elements, runtime } = harness;

  const snapshot = runtime.GameMenuLoadout.getRuntimeSnapshot();
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'selectedAbilityId'), false);
});

test('menu loadout resolves shared defaults after GameShared arrives post-load', async () => {
  const harness = await loadMenuLoadoutHarness({ deferShared: true, autoInit: false });
  harness.runtime.GameShared = harness.shared;

  harness.runtime.GameMenuLoadout.init();

  assert.deepEqual(Array.from(harness.runtime.GameMenuLoadout.getWeaponSlots()), ['rifle', 'shotgun']);
  assert.equal(Object.prototype.hasOwnProperty.call(harness.runtime.GameMenuLoadout.getRuntimeSnapshot(), 'selectedAbilityId'), false);
});

test('menu loadout normalizes the committed pair from remaining valid weapons when defaults are incomplete', async () => {
  const harness = await loadMenuLoadoutHarness({
    sharedOverride: {
      gameplayTuning: {
        weaponStats: {
          machinegun: { name: 'Machinegun' },
          rifle: { name: 'Rifle' }
        },
        throwables: {
          order: ['frag'],
          frag: { id: 'frag', label: 'Frag', previewType: 'trajectory' }
        },
        
      },
      getSelectableWeaponIds() {
        return ['machinegun', 'rifle'];
      },
      getDefaultWeaponLoadout() {
        return ['machinegun', 'shotgun'];
      },
      getDefaultThrowableId() {
        return 'frag';
      },
      normalizeThrowableId(throwableId) {
        return String(throwableId || 'frag');
      }
    }
  });

  assert.deepEqual(Array.from(harness.runtime.GameMenuLoadout.getWeaponSlots()), ['machinegun', 'rifle']);
  assert.deepEqual(Array.from(harness.runtime.GameMenuLoadout.getDraftWeaponSlots()), ['machinegun', 'rifle']);
  assert.deepEqual(harness.weaponOrderCalls, [['machinegun', 'rifle']]);
  assert.deepEqual(harness.playerLoadoutCalls, [{ slots: ['machinegun', 'rifle'] }]);
});

test('menu loadout skips weapon runtime sync when the selectable set cannot fill both slots', async () => {
  const harness = await loadMenuLoadoutHarness({
    sharedOverride: {
      gameplayTuning: {
        weaponStats: {
          machinegun: { name: 'Machinegun' }
        },
        throwables: {
          order: ['frag'],
          frag: { id: 'frag', label: 'Frag', previewType: 'trajectory' }
        },
        
      },
      getSelectableWeaponIds() {
        return ['machinegun'];
      },
      getDefaultWeaponLoadout() {
        return ['machinegun', 'shotgun'];
      },
      getDefaultThrowableId() {
        return 'frag';
      },
      normalizeThrowableId(throwableId) {
        return String(throwableId || 'frag');
      }
    }
  });

  assert.deepEqual(Array.from(harness.runtime.GameMenuLoadout.getWeaponSlots()), ['machinegun', '']);
  assert.deepEqual(harness.weaponOrderCalls, []);
  assert.deepEqual(harness.playerLoadoutCalls, []);
  assert.deepEqual(harness.netWeaponLoadoutCalls, []);
  assert.equal(harness.throwableSelectionCalls.at(-1), 'frag');
  assert.deepEqual(harness.abilityLoadoutCalls, []);
});
