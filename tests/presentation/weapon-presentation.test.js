import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadWeaponPresentation() {
  const visualsCode = await fs.readFile(new URL('../../js/domain/weapons/visuals.js', import.meta.url), 'utf8');
  const presentationCode = await fs.readFile(new URL('../../js/presentation/weapon-presentation.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {},
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(visualsCode, context);
  vm.runInContext(presentationCode, context);
  return {
    visuals: sandbox.__MAYHEM_RUNTIME.GameWeaponVisuals,
    presentation: sandbox.__MAYHEM_RUNTIME.GameWeaponPresentation
  };
}

test('weapon platforms expose semantic hold classes, stock classes, and required zones', async () => {
  const harness = await loadWeaponPresentation();
  const weaponIds = ['pistol', 'rifle', 'machinegun', 'shotgun', 'sniper'];

  for (const weaponId of weaponIds) {
    const entry = harness.visuals.get(weaponId);
    assert.ok(entry.platform);
    assert.ok(entry.platform.holdClass);
    assert.ok(entry.platform.stockClass);
    assert.ok(Array.isArray(entry.platform.zones.handleBack));
    assert.ok(Array.isArray(entry.platform.zones.muzzle));
    assert.ok(Array.isArray(entry.platform.zones.reloadZone));
    assert.ok(Array.isArray(entry.platform.zones.supportZone));
    assert.ok(Number(entry.platform.zones.rearExtent) > 0);
    assert.ok(entry.platform.parts.receiver);
    assert.ok(entry.platform.parts.grip);
    assert.ok(entry.platform.parts.barrel);
  }
});

test('one-handed guns never use precision stocks while sniper does', async () => {
  const harness = await loadWeaponPresentation();

  assert.equal(harness.visuals.get('pistol').platform.stockClass, 'none');
  assert.equal(harness.visuals.get('rifle').platform.stockClass, 'short');
  assert.equal(harness.visuals.get('machinegun').platform.stockClass, 'short');
  assert.equal(harness.visuals.get('shotgun').platform.stockClass, 'short');
  assert.equal(harness.visuals.get('sniper').platform.stockClass, 'precision');
});

test('weapon presentation resolves a single universal reload language', async () => {
  const harness = await loadWeaponPresentation();

  const present = harness.presentation.resolveReloadState({
    reloadMs: 1000,
    reloadRemaining: 900,
    reloadedFlashRemaining: 0
  }, null);
  const action = harness.presentation.resolveReloadState({
    reloadMs: 1000,
    reloadRemaining: 500,
    reloadedFlashRemaining: 0
  }, present);
  const recover = harness.presentation.resolveReloadState({
    reloadMs: 1000,
    reloadRemaining: 120,
    reloadedFlashRemaining: 0
  }, action);

  assert.equal(present.phase, 'present');
  assert.equal(action.phase, 'action');
  assert.equal(recover.phase, 'recover');
});
