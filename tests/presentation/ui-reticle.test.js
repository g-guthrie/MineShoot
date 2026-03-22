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

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    return child;
  }

  querySelectorAll() {
    return [];
  }
}

async function loadUiHarness() {
  const code = await fs.readFile(new URL('../../js/presentation/ui.js', import.meta.url), 'utf8');
  const elements = new Map();
  const spreadReticleState = {
    hideCalls: 0,
    updateCalls: []
  };

  function getElement(id) {
    const key = String(id || '');
    if (!elements.has(key)) elements.set(key, new FakeElement(key));
    return elements.get(key);
  }

  const runtime = {
    GameHitscan: {
      getSpreadMetrics(weaponId) {
        if (weaponId === 'pistol') {
          return {
            radiusPx: 95,
            radiusXpx: 95,
            radiusYpx: 95
          };
        }
        return {
          radiusPx: 0,
          radiusXpx: 0,
          radiusYpx: 0
        };
      }
    },
    GameSpreadReticle: {
      create(element) {
        return {
          hide() {
            spreadReticleState.hideCalls += 1;
            if (element) element.style.display = 'none';
          },
          setDebugEnabled() {},
          updateForWeapon(weapon, options) {
            spreadReticleState.updateCalls.push({
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
    spreadReticleState,
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
  assert.equal(harness.getElement('spread-reticle').style.display, 'none');
  assert.equal(harness.spreadReticleState.hideCalls, 1);

  harness.GameUI.updateReticle(
    { id: 'rifle' },
    null,
    { active: true, blend: 0.4, sniper: false }
  );

  assert.equal(harness.getElement('sniper-scope').style.display, 'none');
  assert.equal(harness.getElement('sniper-scope').style.opacity, '0');
  assert.equal(harness.getElement('crosshair').style.display, 'block');
  assert.equal(harness.getElement('shotgun-reticle').style.display, 'none');
  assert.equal(harness.getElement('spread-reticle').style.display, 'block');
  assert.deepEqual(harness.spreadReticleState.updateCalls.at(-1), {
    weaponId: 'rifle',
    options: {
      adsActive: true,
      scoped: false
    }
  });
});

test('reticle update keeps the circle reticle path for shotgun', async () => {
  const harness = await loadUiHarness();

  harness.GameUI.updateReticle(
    { id: 'shotgun' },
    { type: 'circle', size: 280 },
    { active: false, blend: 0, sniper: false }
  );

  assert.equal(harness.getElement('crosshair').style.display, 'none');
  assert.equal(harness.getElement('pistol-reticle').style.display, 'none');
  assert.equal(harness.getElement('shotgun-reticle').style.display, 'block');
  assert.equal(harness.getElement('shotgun-reticle').style.width, '280px');
  assert.equal(harness.getElement('shotgun-reticle').style.height, '280px');
  assert.equal(harness.getElement('spread-reticle').style.display, 'none');
});

test('reticle update shows pistol as a crosshair with a faint main-screen spread ring and keeps debug spread visuals', async () => {
  const harness = await loadUiHarness();

  harness.GameUI.setDebugVisuals(true);
  harness.GameUI.updateReticle(
    { id: 'pistol', pellets: 12 },
    null,
    { active: true, blend: 0, sniper: false }
  );

  assert.equal(harness.getElement('crosshair').style.display, 'block');
  assert.equal(harness.getElement('pistol-reticle').style.display, 'block');
  assert.equal(harness.getElement('pistol-reticle').style.width, '190px');
  assert.equal(harness.getElement('pistol-reticle').style.height, '190px');
  assert.equal(harness.getElement('shotgun-reticle').style.display, 'none');
  assert.equal(harness.getElement('spread-reticle').style.display, 'block');
  assert.deepEqual(harness.spreadReticleState.updateCalls.at(-1), {
    weaponId: 'pistol',
    options: {
      adsActive: true,
      scoped: false
    }
  });
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

test('plasma debug reticle shows the projected catch diameter only while active', async () => {
  const harness = await loadUiHarness();

  harness.GameUI.updatePlasmaState({
    visible: true,
    ringDiametersPx: [188]
  });

  assert.equal(harness.getElement('plasma-reticle').style.display, 'block');
  assert.equal(harness.getElement('plasma-reticle').children.length, 1);
  assert.equal(harness.getElement('plasma-reticle').children[0].style.width, '188px');
  assert.equal(harness.getElement('plasma-reticle').children[0].style.height, '188px');

  harness.GameUI.updatePlasmaState({ visible: false });
  assert.equal(harness.getElement('plasma-reticle').style.display, 'none');
});

test('damage numbers skip points behind the camera and kill count access stays safe', async () => {
  const harness = await loadUiHarness();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 200);
  camera.position.set(0, 1.6, 0);
  camera.lookAt(new THREE.Vector3(0, 1.6, -10));
  camera.updateProjectionMatrix();

  harness.GameUI.updateMatchStatus({ gameMode: 'ffa', started: true, targetProgress: 10, leaderProgress: 4 }, {
    kills: 3,
    deaths: 1
  });
  assert.equal(harness.GameUI.getKillCount(), 3);

  harness.GameUI.showDamageNumber(new THREE.Vector3(0, 1.6, 5), 25, false, camera, 'body');
  assert.equal(harness.getElement('damage-numbers').children.length, 0);

  harness.GameUI.showDamageNumber(new THREE.Vector3(0, 1.6, -5), 25, false, camera, 'body');
  assert.equal(harness.getElement('damage-numbers').children.length, 1);
});

test('combat radar keeps empty sectors quiet while making distant occupied sectors readable', async () => {
  const harness = await loadUiHarness();

  harness.GameUI.updateCombatRadar({
    segments: [0, 0.02, 0.6, 0, 0, 0, 0, 0],
    coreIntensity: 0.5
  });

  const radar = harness.getElement('combat-radar');
  const slices = harness.getElement('combat-radar-slices');
  const core = harness.getElement('combat-radar-core');

  assert.equal(radar.style.display, 'block');
  assert.match(slices.style.background, /rgba\(86, 193, 255, 0\.040\)/);
  assert.match(slices.style.background, /rgba\(86, 193, 255, 0\.153\)/);
  assert.match(slices.style.background, /rgba\(86, 193, 255, 0\.524\)/);
  assert.equal(core.style.background, 'rgba(255, 96, 96, 0.410)');
});

test('weapon info renders compact stacked lines for name, ammo, and meta', async () => {
  const harness = await loadUiHarness();

  harness.GameUI.updateWeaponInfo({
    id: 'machinegun',
    name: 'Machine Gun',
    magazineSize: 50,
    ammoInMag: 17,
    automatic: true,
    bodyDamage: 15,
    headDamage: 20
  });

  const weaponInfo = harness.getElement('weapon-info');
  assert.equal(weaponInfo.children.length, 3);
  assert.equal(weaponInfo.children[0].textContent, 'Machine Gun');
  assert.equal(weaponInfo.children[1].textContent, '17/50');
  assert.equal(weaponInfo.children[2].textContent, 'AUTO | 15/20 DMG');
  assert.equal(weaponInfo.children[0].className, 'weapon-line weapon-line-name');
  assert.equal(weaponInfo.children[1].className, 'weapon-line weapon-line-ammo');
  assert.equal(weaponInfo.children[2].className, 'weapon-line weapon-line-meta');
});
