import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadAvatarRig(runtimeOverrides = {}) {
  const visualsCode = await fs.readFile(new URL('../js/domain/weapons/visuals.js', import.meta.url), 'utf8');
  const code = await fs.readFile(new URL('../js/avatar-rig.js', import.meta.url), 'utf8');
  const runtime = {
    GameShared: {
      entityConstants: {}
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(visualsCode, vm.createContext(sandbox));
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameAvatarRig;
}

test('sniper support pose keeps the left arm tucked near the rifle fore-end', async () => {
  const avatarRig = await loadAvatarRig();
  const pose = avatarRig._test.getSupportPoseForWeapon('sniper', 0.1, 0.2, true);

  assert.ok(pose);
  assert.ok(pose.armX > 0.7 && pose.armX < 0.78);
  assert.ok(pose.armY < -0.27 && pose.armY > -0.34);
  assert.ok(pose.armZ < -0.3 && pose.armZ > -0.36);
  assert.ok(pose.palmY < -0.9 && pose.palmY > -0.98);
  assert.ok(pose.palmZ < -0.1 && pose.palmZ > -0.18);
  assert.ok(pose.targetX < 0.13);
  assert.ok(pose.targetY < -0.05);
});

test('reload pose is available for every firearm and keeps the support hand anchored near the weapon', async () => {
  const avatarRig = await loadAvatarRig();
  const weaponIds = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper'];

  for (const weaponId of weaponIds) {
    const pose = avatarRig._test.getReloadPoseForWeapon(weaponId, 0.35);
    assert.ok(pose, weaponId + ' should produce a reload pose');
    assert.ok(Math.abs(pose.armX) < 0.2, weaponId + ' should not throw the shoulder across the torso');
    assert.ok(pose.targetOffsetZ > 0, weaponId + ' should pull the support hand back toward the receiver');
    assert.notEqual(pose.gunRoll, 0, weaponId + ' should add reload wiggle');
  }
});

test('reload animation keeps the left shoulder on the weapon side instead of floating across the torso', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: false,
    aimPitch: 0,
    adsActive: false,
    reloading: true,
    reloadPct: 0.35
  });

  assert.ok(api.rig.armL.position.x < -0.2);
  assert.ok(api.rig.armL.position.x > -0.8);
});

test('built-in weapon visuals keep the sniper support anchor tucked under the fore-end', async () => {
  const avatarRig = await loadAvatarRig();
  const sniperEntry = avatarRig._test.resolveWeaponEntry('sniper');

  assert.deepEqual(Array.from(sniperEntry.visual.anchors.support), [-0.055, -0.055, -0.42]);
  assert.deepEqual(Array.from(sniperEntry.visual.anchors.handle), [0, -0.11, 0.11]);
});

test('built-in weapon visuals stay procedural for pistol and machinegun', async () => {
  const avatarRig = await loadAvatarRig();
  const pistolEntry = avatarRig._test.resolveWeaponEntry('pistol');
  const machinegunEntry = avatarRig._test.resolveWeaponEntry('machinegun');

  assert.deepEqual(Array.from(pistolEntry.visual.mount.position), [0, 0.03, 0.06]);
  assert.equal(pistolEntry.visual.parts.scope, false);

  assert.deepEqual(Array.from(machinegunEntry.visual.mount.position), [0, 0.02, 0.08]);
  assert.equal(machinegunEntry.visual.parts.coil, false);
  assert.equal(machinegunEntry.visual.parts.scope, false);
});

test('jump action trigger layers a takeoff pose on top of airborne animation', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0
  });
  const baselineLegRotation = api.rig.legL.rotation.x;
  const baselineArmX = api.rig.armL.position.x;

  api.triggerAction('jump');
  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0
  });

  assert.ok(api.rig.legL.rotation.x < baselineLegRotation);
  assert.equal(api.rig.armL.position.x, baselineArmX);
});

test('airborne animation keeps the left arm splayed and lets forward/back input sweep it live', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0
  });

  assert.ok(api.rig.armL.rotation.z < -0.2);
  assert.ok(api.rig.armL.rotation.z > -0.3);
  assert.equal(api.rig.armL.rotation.x, 0);

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0,
    movingForward: true
  });

  assert.ok(api.rig.armL.rotation.x < -0.24);
  assert.ok(api.rig.armL.rotation.x > -0.28);
  assert.ok(api.rig.armL.rotation.z < -0.2);

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0,
    movingBackward: true
  });

  assert.ok(api.rig.armL.rotation.x > 0.24);
  assert.ok(api.rig.armL.rotation.x < 0.28);
  assert.ok(api.rig.armL.rotation.z < -0.2);
});

test('armed sprint animation reuses the walk-style firearm arm motion with a stronger support-arm swing', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });

  api.updateAnimation(0.016, {
    speedNorm: 1.1,
    sprinting: false,
    airborne: false,
    aimPitch: 0
  });
  const walkLeftArmX = api.rig.armL.rotation.x;
  const walkRightArmX = api.rig.armR.rotation.x;
  const walkRightArmZ = api.rig.armR.rotation.z;
  const walkRightWristX = api.rig.palmRight.rotation.x;

  api.updateAnimation(0.016, {
    speedNorm: 1.1,
    sprinting: true,
    airborne: false,
    aimPitch: 0
  });

  assert.notEqual(api.rig.armR.rotation.x, walkRightArmX);
  assert.equal(api.rig.armR.rotation.z, walkRightArmZ);
  assert.notEqual(api.rig.palmRight.rotation.x, walkRightWristX);
  assert.ok(Math.abs(api.rig.armL.rotation.x) > Math.abs(walkLeftArmX) * 1.01);
});

test('weapon mount rotation can customize wrist pitch per weapon', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'pistol' });

  assert.ok(api.rig.gun.rotation.x > -1.2);
  assert.ok(api.rig.gun.rotation.x < -1.1);
  assert.ok(api.rig.gun.rotation.y > 0.04);
});

test('firearm aim pitch drives the barrel up and down enough to track the shot line', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });
  const barrelTip = api.rig.gun.getObjectByName('weaponBarrelTipAnchor');
  const quat = new THREE.Quaternion();
  const dir = new THREE.Vector3();

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: false,
    aimPitch: 0.8
  });
  barrelTip.getWorldQuaternion(quat);
  dir.set(0, 0, -1).applyQuaternion(quat);
  assert.ok(dir.y > 0.6);
  assert.ok(api.rig.armR.rotation.x > 1.8);
  assert.ok(api.rig.palmRight.rotation.x > 0.2);

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: false,
    aimPitch: -0.8
  });
  barrelTip.getWorldQuaternion(quat);
  dir.set(0, 0, -1).applyQuaternion(quat);
  assert.ok(dir.y < -0.6);
  assert.ok(api.rig.armR.rotation.x < 0.8);
  assert.ok(api.rig.palmRight.rotation.x < -0.2);
});
