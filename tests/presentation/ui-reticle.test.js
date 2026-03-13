import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.style = {};
    this.children = [];
    this.textContent = '';
    this.className = '';
    this.innerHTML = '';
    this.classList = {
      add() {},
      remove() {},
      toggle() {}
    };
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelectorAll() {
    return [];
  }
}

async function loadUiHarness() {
  const code = await fs.readFile(new URL('../../js/presentation/ui.js', import.meta.url), 'utf8');
  const elements = new Map();
  const bloomState = {
    hideCalls: 0,
    updateCalls: []
  };

  function getElement(id) {
    const key = String(id || '');
    if (!elements.has(key)) elements.set(key, new FakeElement(key));
    return elements.get(key);
  }

  const runtime = {
    GameBloomReticle: {
      create(element) {
        return {
          hide() {
            bloomState.hideCalls += 1;
            if (element) element.style.display = 'none';
          },
          setDebugEnabled() {},
          updateForWeapon(weapon, options) {
            bloomState.updateCalls.push({
              weaponId: weapon && weapon.id,
              options: { ...options }
            });
            if (element) element.style.display = 'block';
          }
        };
      }
    }
  };

  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    THREE,
    console,
    document: {
      getElementById(id) {
        return getElement(id);
      },
      createElement(tagName) {
        return new FakeElement(tagName);
      }
    },
    window: {
      innerWidth: 1280,
      innerHeight: 720
    },
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  sandbox.__MAYHEM_RUNTIME.GameUI.init();

  return {
    GameUI: sandbox.__MAYHEM_RUNTIME.GameUI,
    bloomState,
    getElement
  };
}

test('reticle update owns sniper ADS overlay without a separate scope pass', async () => {
  const harness = await loadUiHarness();

  harness.GameUI.updateReticle(
    { id: 'sniper' },
    null,
    { active: true, blend: 0.4, sniper: true }
  );

  assert.equal(harness.getElement('sniper-scope').style.display, 'block');
  assert.equal(harness.getElement('sniper-scope').style.opacity, '0.400');
  assert.equal(harness.getElement('crosshair').style.display, 'none');
  assert.equal(harness.getElement('shotgun-reticle').style.display, 'none');
  assert.equal(harness.getElement('bloom-reticle').style.display, 'none');
  assert.equal(harness.bloomState.hideCalls, 1);

  harness.GameUI.updateReticle(
    { id: 'rifle' },
    null,
    { active: true, blend: 0.4, sniper: false }
  );

  assert.equal(harness.getElement('sniper-scope').style.display, 'none');
  assert.equal(harness.getElement('sniper-scope').style.opacity, '0');
  assert.equal(harness.getElement('crosshair').style.display, 'block');
  assert.equal(harness.getElement('shotgun-reticle').style.display, 'none');
  assert.equal(harness.getElement('bloom-reticle').style.display, 'block');
  assert.deepEqual(harness.bloomState.updateCalls.at(-1), {
    weaponId: 'rifle',
    options: {
      adsActive: true,
      scoped: false
    }
  });
});

test('reticle update reuses the circle reticle path for shotgun and pistol', async () => {
  const harness = await loadUiHarness();

  harness.GameUI.updateReticle(
    { id: 'shotgun' },
    { type: 'circle', size: 280 },
    { active: false, blend: 0, sniper: false }
  );

  assert.equal(harness.getElement('crosshair').style.display, 'none');
  assert.equal(harness.getElement('shotgun-reticle').style.display, 'block');
  assert.equal(harness.getElement('shotgun-reticle').style.width, '280px');
  assert.equal(harness.getElement('shotgun-reticle').style.height, '280px');
  assert.equal(harness.getElement('bloom-reticle').style.display, 'none');

  harness.GameUI.setDebugVisuals(true);
  harness.GameUI.updateReticle(
    { id: 'pistol', pellets: 12 },
    { type: 'circle', size: 190 },
    { active: true, blend: 0, sniper: false }
  );

  assert.equal(harness.getElement('crosshair').style.display, 'none');
  assert.equal(harness.getElement('shotgun-reticle').style.display, 'block');
  assert.equal(harness.getElement('shotgun-reticle').style.width, '190px');
  assert.equal(harness.getElement('shotgun-reticle').style.height, '190px');
  assert.equal(harness.getElement('bloom-reticle').style.display, 'none');
  assert.equal(harness.bloomState.hideCalls >= 2, true);
});

test('sprint effects stay peripheral and hide while scoped or stationary', async () => {
  const harness = await loadUiHarness();

  harness.GameUI.updateSprintEffects({
    intensity: 0.72,
    adsActive: false,
    scopeActive: false,
    sniper: false
  });

  assert.equal(harness.getElement('sprint-speed-lines').style.display, 'block');
  assert.equal(harness.getElement('sprint-speed-lines').children.length, 8);
  assert.notEqual(harness.getElement('sprint-speed-lines').style.opacity, '0');

  harness.GameUI.updateSprintEffects({
    intensity: 0.72,
    adsActive: true,
    scopeActive: true,
    sniper: true
  });

  assert.equal(harness.getElement('sprint-speed-lines').style.display, 'none');
  assert.equal(harness.getElement('sprint-speed-lines').style.opacity, '0');
});
