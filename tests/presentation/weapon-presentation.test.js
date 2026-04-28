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

test('weapon platforms preserve the Toon Shooter character hand attachment transforms', async () => {
  const harness = await loadWeaponPresentation();
  const rifle = harness.visuals.get('rifle').platform.toonAttachment;
  const pistol = harness.visuals.get('pistol').platform.toonAttachment;
  const shotgun = harness.visuals.get('shotgun').platform.toonAttachment;

  assert.equal(rifle.sourceUrl, '/assets/characters/toon-shooter/Character_Enemy.gltf');
  assert.equal(rifle.parentNode, 'Index1.R');
  assert.equal(rifle.weaponNode, 'Sniper_2');
  assert.equal(pistol.weaponNode, 'Revolver');
  assert.equal(shotgun.weaponNode, 'Shotgun');
  assert.equal(rifle.useMountOffset, false);
  assert.equal(pistol.useMountOffset, true);
  assert.equal(shotgun.useMountOffset, true);
  assert.equal(pistol.translation.length, 3);
  assert.equal(pistol.rotation.length, 4);
  assert.equal(pistol.scale.length, 3);
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
