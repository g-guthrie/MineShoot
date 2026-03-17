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

async function loadMenuLoadoutHarness({ storageMap } = {}) {
  const code = await fs.readFile(new URL('../../js/app/menu-loadout.js', import.meta.url), 'utf8');
  const store = storageMap || new Map();

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
    ['div', 'loadout-band-actions'],
    ['div', 'loadout-expanded-shell'],
    ['button', 'loadout-collapse-btn'],
    ['div', 'loadout-row'],
    ['div', 'loadout-collapsed-row'],
    ['button', 'weapon-slot-summary'],
    ['div', 'weapon-slot-panel'],
    ['div', 'weapon-slot-title'],
    ['div', 'weapon-slot-buttons'],
    ['button', 'weapon-slot-primary'],
    ['button', 'weapon-slot-secondary'],
    ['div', 'weapon-choice-grid'],
    ['div', 'weapon-slot-note'],
    ['button', 'throwable-slot-summary'],
    ['div', 'throwable-slot-panel'],
    ['div', 'throwable-slot-title'],
    ['div', 'throwable-category-tabs'],
    ['div', 'throwable-choice-grid'],
    ['div', 'throwable-slot-note'],
    ['button', 'ability-slot-summary'],
    ['div', 'ability-slot-panel'],
    ['div', 'ability-slot-title'],
    ['div', 'ability-slot-buttons'],
    ['button', 'ability-slot-primary'],
    ['button', 'ability-slot-secondary'],
    ['div', 'ability-choice-grid'],
    ['div', 'ability-slot-note']
  ];

  for (const [tagName, id] of ids) {
    documentObj.elements[id] = new FakeElement(tagName, id, documentObj);
  }

  documentObj.elements['weapon-slot-panel'].hidden = true;
  documentObj.elements['throwable-slot-panel'].hidden = true;
  documentObj.elements['ability-slot-panel'].hidden = true;
  documentObj.elements['loadout-collapsed-row'].hidden = true;

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

  const sandbox = {
    console,
    window: windowObj,
    document: documentObj,
    __MAYHEM_RUNTIME: {
      GameShared: {
        gameplayTuning: {
          weaponStats: {
            machinegun: { name: 'Machinegun' },
            shotgun: { name: 'Shotgun' },
            rifle: { name: 'Rifle' }
          },
          throwableCategories: {
            grenade: { label: 'Grenades', items: ['frag', 'plasma'] }
          },
          throwables: {
            frag: { label: 'Frag' },
            plasma: { label: 'Plasma' }
          },
          abilityCatalog: {
            choke: { id: 'choke', name: 'Choke' },
            missile: { id: 'missile', name: 'Missile' },
            hook: { id: 'hook', name: 'Hook' }
          },
          defaultAbilityLoadout: { slot1: 'choke', slot2: 'missile' }
        },
        getSelectableWeaponIds() {
          return ['machinegun', 'shotgun', 'rifle'];
        },
        getDefaultWeaponLoadout() {
          return ['machinegun', 'shotgun'];
        },
        getDefaultAbilityLoadout() {
          return { slot1: 'choke', slot2: 'missile' };
        },
        normalizeAbilityLoadout(slot1, slot2) {
          return {
            slot1: String(slot1 || 'choke'),
            slot2: String(slot2 || 'missile')
          };
        }
      },
      GameThrowables: {
        setSelectedThrowable() {}
      },
      GameAbilities: {
        setLoadoutSlot() {},
        getHudState() {
          return {};
        }
      },
      GameUI: {
        updateAbilityInfo() {}
      }
    },
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  sandbox.globalThis.window = windowObj;
  sandbox.globalThis.document = documentObj;

  vm.runInContext(code, vm.createContext(sandbox));
  sandbox.__MAYHEM_RUNTIME.GameMenuLoadout.init();

  return {
    runtime: sandbox.__MAYHEM_RUNTIME,
    elements: documentObj.elements,
    storage: store
  };
}

test('loadout starts expanded, collapses to summaries, and reopens on reload', async () => {
  const storage = new Map();
  const harness = await loadMenuLoadoutHarness({ storageMap: storage });
  const { elements, runtime } = harness;

  assert.equal(elements['loadout-expanded-shell'].hidden, false);
  assert.equal(elements['loadout-collapsed-row'].hidden, true);
  assert.equal(elements['weapon-slot-title'].textContent, 'Weapon Slots');
  assert.equal(elements['throwable-slot-title'].textContent, 'Throwables [Q]');
  assert.equal(elements['ability-slot-title'].textContent, 'Abilities');
  assert.equal(elements['loadout-collapse-btn'].textContent, 'Collapse');
  assert.equal(elements['loadout-collapse-btn'].attributes['aria-expanded'], 'true');
  assert.equal(runtime.GameMenuLoadout.getExpandedSection(), 'all');

  elements['loadout-collapse-btn'].click();

  assert.equal(elements['loadout-expanded-shell'].hidden, true);
  assert.equal(elements['loadout-collapsed-row'].hidden, false);
  assert.equal(elements['loadout-collapse-btn'].textContent, 'open loadout');
  assert.equal(elements['loadout-collapse-btn'].attributes['aria-expanded'], 'false');
  assert.match(elements['weapon-slot-summary'].textContent, /^Weapons:/);
  assert.match(elements['throwable-slot-summary'].textContent, /^Throwable:/);
  assert.match(elements['ability-slot-summary'].textContent, /^Abilities:/);
  assert.equal(runtime.GameMenuLoadout.getExpandedSection(), '');

  const persistedHarness = await loadMenuLoadoutHarness({ storageMap: storage });
  assert.equal(persistedHarness.elements['loadout-expanded-shell'].hidden, false);
  assert.equal(persistedHarness.elements['loadout-collapsed-row'].hidden, true);
  assert.equal(persistedHarness.elements['loadout-collapse-btn'].textContent, 'Collapse');

  persistedHarness.elements['loadout-collapse-btn'].click();
  assert.equal(persistedHarness.elements['loadout-expanded-shell'].hidden, true);
  assert.equal(persistedHarness.elements['loadout-collapse-btn'].textContent, 'open loadout');
  persistedHarness.elements['loadout-collapse-btn'].click();
  assert.equal(persistedHarness.elements['loadout-expanded-shell'].hidden, false);
  assert.equal(persistedHarness.elements['loadout-collapse-btn'].textContent, 'Collapse');
  persistedHarness.elements['loadout-collapse-btn'].click();
  persistedHarness.elements['weapon-slot-summary'].click();
  assert.equal(persistedHarness.elements['loadout-expanded-shell'].hidden, false);
  assert.equal(persistedHarness.elements['loadout-collapse-btn'].textContent, 'Collapse');
});

test('loadout updates collapsed summary pills after selections change', async () => {
  const harness = await loadMenuLoadoutHarness();
  const { elements, runtime } = harness;

  elements['weapon-slot-secondary'].click();
  elements['ability-slot-secondary'].click();
  const rifleChoice = findByDataset(elements['weapon-choice-grid'], 'weaponId', 'rifle');
  const plasmaChoice = findByDataset(elements['throwable-choice-grid'], 'throwableId', 'plasma');
  const hookChoice = findByDataset(elements['ability-choice-grid'], 'abilityId', 'hook');

  assert.ok(rifleChoice);
  assert.ok(plasmaChoice);
  assert.ok(hookChoice);

  rifleChoice.click();
  plasmaChoice.click();
  hookChoice.click();
  elements['loadout-collapse-btn'].click();

  const snapshot = runtime.GameMenuLoadout.getRuntimeSnapshot();

  assert.deepEqual(Array.from(snapshot.weaponSlots), ['machinegun', 'rifle']);
  assert.equal(snapshot.selectedThrowableId, 'plasma');
  assert.equal(snapshot.abilityLoadout.slot2, 'hook');
  assert.match(elements['weapon-slot-summary'].textContent, /Rifle/i);
  assert.match(elements['throwable-slot-summary'].textContent, /Plasma/i);
  assert.match(elements['ability-slot-summary'].textContent, /Hook/i);
});

test('weapons swap ownership and use slot-specific classes in the shared grid', async () => {
  const harness = await loadMenuLoadoutHarness();
  const { elements, runtime } = harness;

  const machinegunChoice = findByDataset(elements['weapon-choice-grid'], 'weaponId', 'machinegun');
  const shotgunChoice = findByDataset(elements['weapon-choice-grid'], 'weaponId', 'shotgun');

  assert.ok(machinegunChoice);
  assert.ok(shotgunChoice);
  assert.deepEqual(Array.from(runtime.GameMenuLoadout.getWeaponSlots()), ['machinegun', 'shotgun']);
  assert.ok(classTokens(machinegunChoice).includes('slot-1'));
  assert.ok(classTokens(machinegunChoice).includes('active'));
  assert.ok(classTokens(shotgunChoice).includes('slot-2'));
  assert.ok(!classTokens(shotgunChoice).includes('owned-other'));

  elements['weapon-slot-secondary'].click();
  const swappedMachinegunChoice = findByDataset(elements['weapon-choice-grid'], 'weaponId', 'machinegun');
  swappedMachinegunChoice.click();

  const snapshot = runtime.GameMenuLoadout.getRuntimeSnapshot();
  const machinegunAfter = findByDataset(elements['weapon-choice-grid'], 'weaponId', 'machinegun');
  const shotgunAfter = findByDataset(elements['weapon-choice-grid'], 'weaponId', 'shotgun');

  assert.deepEqual(Array.from(snapshot.weaponSlots), ['shotgun', 'machinegun']);
  assert.ok(classTokens(machinegunAfter).includes('slot-2'));
  assert.ok(classTokens(machinegunAfter).includes('active'));
  assert.ok(classTokens(shotgunAfter).includes('slot-1'));
  assert.ok(!classTokens(machinegunAfter).includes('owned-other'));
});

test('abilities swap ownership and use slot-specific classes in the shared grid', async () => {
  const harness = await loadMenuLoadoutHarness();
  const { elements, runtime } = harness;

  const chokeChoice = findByDataset(elements['ability-choice-grid'], 'abilityId', 'choke');
  const missileChoice = findByDataset(elements['ability-choice-grid'], 'abilityId', 'missile');

  assert.ok(chokeChoice);
  assert.ok(missileChoice);
  assert.equal(runtime.GameMenuLoadout.getAbilityLoadout().slot1, 'choke');
  assert.equal(runtime.GameMenuLoadout.getAbilityLoadout().slot2, 'missile');
  assert.ok(classTokens(chokeChoice).includes('slot-1'));
  assert.ok(classTokens(chokeChoice).includes('active'));
  assert.ok(classTokens(missileChoice).includes('slot-2'));
  assert.ok(!classTokens(missileChoice).includes('owned-other'));

  elements['ability-slot-secondary'].click();
  const swappedChokeChoice = findByDataset(elements['ability-choice-grid'], 'abilityId', 'choke');
  swappedChokeChoice.click();

  const loadout = runtime.GameMenuLoadout.getAbilityLoadout();
  const chokeAfter = findByDataset(elements['ability-choice-grid'], 'abilityId', 'choke');
  const missileAfter = findByDataset(elements['ability-choice-grid'], 'abilityId', 'missile');

  assert.equal(loadout.slot1, 'missile');
  assert.equal(loadout.slot2, 'choke');
  assert.ok(classTokens(chokeAfter).includes('slot-2'));
  assert.ok(classTokens(chokeAfter).includes('active'));
  assert.ok(classTokens(missileAfter).includes('slot-1'));
  assert.ok(!classTokens(chokeAfter).includes('owned-other'));
});
