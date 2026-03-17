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
    this.dataset = {};
    this.parentNode = null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }
}

async function loadOverheadHarness() {
  const code = await fs.readFile(new URL('../../js/presentation/overhead.js', import.meta.url), 'utf8');
  const elements = new Map();
  const markerCalls = [];
  let now = 1000;
  const localEnemies = [];
  const netEntities = [];

  function getElement(id) {
    const key = String(id || '');
    if (!elements.has(key)) elements.set(key, new FakeElement(key));
    return elements.get(key);
  }

  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        entityPoints: {
          entityMarkerPointYFromFeet(feetY) {
            markerCalls.push(Number(feetY || 0));
            return Number(feetY || 0) + 2.25;
          }
        }
      },
      GameEnemy: {
        getEnemies() {
          return localEnemies;
        }
      },
      GameNet: {
        view: {
          getEntityStateList() {
            return netEntities;
          }
        }
      }
    },
    globalThis: null,
    console,
    THREE,
    window: {
      innerWidth: 1280,
      innerHeight: 720
    },
    document: {
      getElementById(id) {
        return getElement(id);
      },
      createElement(tag) {
        return new FakeElement(tag);
      },
      body: {
        appendChild(node) {
          return node;
        }
      }
    },
    performance: {
      now() {
        return now;
      }
    }
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  sandbox.__MAYHEM_RUNTIME.GameOverhead.init();

  const camera = new THREE.PerspectiveCamera(75, 1280 / 720, 0.1, 1000);
  camera.position.set(0, 1.6, 0);
  camera.lookAt(0, 1.6, -10);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  function getEntryById(id) {
    const container = getElement('overhead-bars');
    return container.children.find((child) => child.dataset && child.dataset.id === id) || null;
  }

  return {
    GameOverhead: sandbox.__MAYHEM_RUNTIME.GameOverhead,
    localEnemies,
    netEntities,
    markerCalls,
    camera,
    getEntryById,
    setNow(value) {
      now = Number(value || 0);
    }
  };
}

test('overhead uses the shared marker helper for both local and network enemies', async () => {
  const harness = await loadOverheadHarness();

  harness.localEnemies.push({
    alive: true,
    index: 0,
    hp: 100,
    maxHp: 100,
    armor: 20,
    armorMax: 20,
    group: { position: new THREE.Vector3(-1, 0, -10) }
  });
  harness.netEntities.push({
    id: 'usr_remote',
    username: 'REMOTE',
    hp: 100,
    hpMax: 100,
    armor: 20,
    armorMax: 20,
    alive: true,
    worldPos: new THREE.Vector3(1, 0, -10),
    targetId: 'net:usr_remote'
  });

  harness.GameOverhead.revealTarget('net:usr_remote', 1500);
  harness.GameOverhead.update(harness.camera, { x: 0, y: 0, z: 0 }, 'enemy:0');

  const localEntry = harness.getEntryById('enemy:0');
  const netEntry = harness.getEntryById('net:usr_remote');

  assert.equal(localEntry.style.display, 'block');
  assert.equal(netEntry.style.display, 'block');
  assert.equal(localEntry.style.top, netEntry.style.top);
  assert.deepEqual(harness.markerCalls, [0, 0]);
});

test('overhead visibility is aim plus recent damage linger, not proximity', async () => {
  const harness = await loadOverheadHarness();

  harness.localEnemies.push({
    alive: true,
    index: 1,
    hp: 100,
    maxHp: 100,
    armor: 10,
    armorMax: 10,
    group: { position: new THREE.Vector3(0, 0, -10) }
  });

  harness.GameOverhead.update(harness.camera, { x: 0, y: 0, z: 0 }, '');
  const entry = harness.getEntryById('enemy:1');
  assert.equal(entry.style.display, 'none');

  harness.GameOverhead.revealTarget('enemy:1', 1500);
  harness.GameOverhead.update(harness.camera, { x: 0, y: 0, z: 0 }, '');
  assert.equal(entry.style.display, 'block');

  harness.setNow(2601);
  harness.GameOverhead.update(harness.camera, { x: 0, y: 0, z: 0 }, '');
  assert.equal(entry.style.display, 'none');
});
