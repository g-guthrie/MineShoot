import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadAvatarRig() {
  const code = await fs.readFile(new URL('../js/avatar-rig.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        entityConstants: {}
      }
    },
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameAvatarRig;
}

test('sniper support pose drives the left arm across the rifle', async () => {
  const avatarRig = await loadAvatarRig();
  const pose = avatarRig._test.getSupportPoseForWeapon('sniper', 0.1, 0.2, true);

  assert.ok(pose);
  assert.ok(pose.armX > 1);
  assert.ok(pose.armY < -0.3);
  assert.ok(pose.armZ < -0.55);
  assert.ok(pose.palmZ < -0.18);
});

test('reload pose is available for every firearm and includes wiggle offsets', async () => {
  const avatarRig = await loadAvatarRig();
  const weaponIds = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper'];

  for (const weaponId of weaponIds) {
    const pose = avatarRig._test.getReloadPoseForWeapon(weaponId, 0.35);
    assert.ok(pose, weaponId + ' should produce a reload pose');
    assert.ok(pose.armX > 0.95, weaponId + ' should lift the left arm across the weapon');
    assert.notEqual(pose.gunRoll, 0, weaponId + ' should add reload wiggle');
  }
});
