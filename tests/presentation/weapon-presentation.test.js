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
    assert.ok(entry.platform.mount);
    assert.ok(Array.isArray(entry.platform.mount.insertion.position));
    assert.ok(Array.isArray(entry.platform.mount.insertion.rotationDeg));
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

test('weapon platforms point at the Toon Shooter pack meshes with explicit muzzle origins', async () => {
  const harness = await loadWeaponPresentation();
  const weaponIds = ['pistol', 'rifle', 'machinegun', 'shotgun', 'sniper'];

  for (const weaponId of weaponIds) {
    const asset = harness.visuals.get(weaponId).platform.asset;
    assert.equal(asset.type, 'gltf');
    assert.match(asset.url, /^\/assets\/weapons\/toon-shooter\/.+\.gltf$/);
    assert.equal(asset.textureUrl, '');
    assert.ok(asset.scale > 0);
    assert.equal(asset.rotationDeg[0], 0);
    assert.equal(asset.rotationDeg[1], -90);
    assert.equal(asset.rotationDeg[2], 0);
    assert.ok(Array.isArray(asset.sourceMuzzle));
    assert.ok(asset.sourceMuzzle[0] < 0);
  }
});

test('weapon Toon Shooter meshes are scaled ten percent above the calibrated source size', async () => {
  const harness = await loadWeaponPresentation();
  const expectedScales = {
    pistol: 0.682,
    rifle: 0.792,
    machinegun: 0.99,
    shotgun: 0.792,
    sniper: 0.902
  };

  for (const [weaponId, expectedScale] of Object.entries(expectedScales)) {
    const asset = harness.visuals.get(weaponId).platform.asset;
    assert.equal(asset.scale, expectedScale, weaponId + ' should keep the 10% size bump');
  }
});

test('scout and sniper rifle mesh assignments keep the longer gun on sniper', async () => {
  const harness = await loadWeaponPresentation();
  const scout = harness.visuals.get('rifle').platform.asset;
  const sniper = harness.visuals.get('sniper').platform.asset;

  assert.match(scout.url, /scout-rifle\.gltf$/);
  assert.match(sniper.url, /sniper\.gltf$/);
  assert.ok(Math.abs(sniper.sourceMuzzle[0]) > Math.abs(scout.sourceMuzzle[0]));
});

test('weapon platforms use only explicit local mount data for hand placement', async () => {
  const harness = await loadWeaponPresentation();

  for (const weaponId of ['pistol', 'rifle', 'machinegun', 'shotgun', 'sniper']) {
    const platform = harness.visuals.get(weaponId).platform;
    assert.equal(platform.toonAttachment, undefined);
    assert.ok(Array.isArray(platform.mount.position));
    assert.ok(Array.isArray(platform.mount.rotationDeg));
    assert.ok(Array.isArray(platform.mount.insertion.position));
  }
});

function distance(a, b) {
  const dx = Number(a[0] || 0) - Number(b[0] || 0);
  const dy = Number(a[1] || 0) - Number(b[1] || 0);
  const dz = Number(a[2] || 0) - Number(b[2] || 0);
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

test('weapon hand insertion keeps grip contact semantic instead of exact tuning coordinates', async () => {
  const harness = await loadWeaponPresentation();
  const weaponIds = ['rifle', 'machinegun', 'shotgun', 'sniper'];

  for (const weaponId of weaponIds) {
    const platform = harness.visuals.get(weaponId).platform;
    const handleToGrip = distance(platform.zones.handleBack, platform.parts.grip.position);
    const handleToStock = distance(platform.zones.handleBack, platform.parts.stock.position);
    const insertionPosition = platform.mount.insertion.position;
    const insertionRotation = platform.mount.insertion.rotationDeg;

    assert.ok(handleToGrip < handleToStock, weaponId + ' hand contact should stay closer to grip than stock');
    assert.ok(platform.parts.stock.position[2] > platform.parts.grip.position[2], weaponId + ' stock should sit behind the grip');
    assert.ok(platform.zones.muzzle[2] < platform.zones.handleBack[2], weaponId + ' muzzle should be forward of the hand contact');
    assert.ok(insertionPosition.every((value) => Math.abs(Number(value || 0)) <= 0.35), weaponId + ' insertion offset should stay bounded');
    assert.ok(insertionRotation.every((value) => Math.abs(Number(value || 0)) <= 8), weaponId + ' insertion rotation should stay a small correction');
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

test('weapon grips stay readable below the receiver after chunky sizing changes', async () => {
  const harness = await loadWeaponPresentation();
  const weaponIds = ['pistol', 'rifle', 'machinegun', 'shotgun', 'sniper'];

  for (const weaponId of weaponIds) {
    const platform = harness.visuals.get(weaponId).platform;
    const receiver = platform.parts.receiver;
    const grip = platform.parts.grip;
    const receiverBottom = receiver.position[1] - (receiver.size[1] * 0.5);
    const gripTop = grip.position[1] + (grip.size[1] * 0.5);
    const gripBottom = grip.position[1] - (grip.size[1] * 0.5);
    const overlap = Math.max(0, gripTop - receiverBottom);

    assert.ok(overlap <= 0.03, weaponId + ' grip should not disappear into the receiver');
    assert.ok(gripBottom < receiverBottom, weaponId + ' grip should extend below the receiver');
  }
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
