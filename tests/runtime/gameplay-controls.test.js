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

  dispatch(type, event) {
    const list = this.listeners.get(String(type || '')) || [];
    for (const handler of list) handler(event || {});
  }
}

async function loadControlsHarness() {
  const code = await fs.readFile(new URL('../../js/runtime/gameplay-controls.js', import.meta.url), 'utf8');
  const documentObj = new FakeDocument();
  const windowObj = new FakeWindow();
  const calls = {
    clearTrajectoryPreview: 0,
    updateTrajectoryPreview: 0,
    updateTrackingReticle: [],
    tryPlayerFire: 0
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
      }
    },
    GameHitscan: {
      getWeaponOrder() { return ['rifle', 'sniper']; },
      cycleWeapon() { return { id: 'sniper' }; },
      setWeapon() { return { id: 'rifle' }; }
    },
    GamePlayer: {
      getPosition() { return { x: 0, y: 0, z: 0 }; },
      getRotation() { return { yaw: 0, pitch: 0 }; }
    },
    GameAbilities: {
      getHudState() { return {}; }
    }
  };

  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    document: documentObj,
    window: windowObj,
    console,
    Date,
    performance: {
      now() { return 0; }
    }
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  const controls = sandbox.__MAYHEM_RUNTIME.GameGameplayControls.create({
    applyWeapon() {},
    canUseLocalAction() { return true; },
    getCamera() { return { fov: 60, aspect: 16 / 9 }; },
    getMultiplayerMode() { return false; },
    handleEnemyHit() {},
    hasInputCapture() { return true; },
    setTransientDebug() {},
    toggleDebugVisuals() { return false; },
    tryPlayerFire() { calls.tryPlayerFire += 1; }
  });

  controls.bind();

  return {
    calls,
    controls,
    documentObj,
    windowObj
  };
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
