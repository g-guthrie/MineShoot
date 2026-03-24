import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import { getWeaponPresentation } from '../../shared/gameplay-tuning.js';

async function loadAvatarRig(runtimeOverrides = {}, threeImpl = THREE) {
  const visualsCode = await fs.readFile(new URL('../../js/domain/weapons/visuals.js', import.meta.url), 'utf8');
  const weaponPresentationCode = await fs.readFile(new URL('../../js/presentation/weapon-presentation.js', import.meta.url), 'utf8');
  const code = await fs.readFile(new URL('../../js/actors/avatar-rig.js', import.meta.url), 'utf8');
  const runtime = {
    GameShared: {
      entityConstants: {},
      getWeaponPresentation
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE: threeImpl
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(visualsCode, context);
  vm.runInContext(weaponPresentationCode, context);
  vm.runInContext(code, context);
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

test('reload pose is available for every firearm and keeps the support hand on the original torso side', async () => {
  const avatarRig = await loadAvatarRig();
  const weaponIds = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper'];

  for (const weaponId of weaponIds) {
    const pose = avatarRig._test.getReloadPoseForWeapon(weaponId, 0.35);
    assert.ok(pose, weaponId + ' should produce a reload pose');
    assert.ok(pose.armX > 0.08 && pose.armX < 0.24, weaponId + ' should move the shoulder in a controlled range');
    assert.ok(pose.targetOffsetZ > 0, weaponId + ' should pull the support hand back toward the receiver');
    assert.notEqual(pose.gunRoll, 0, weaponId + ' should add reload wiggle');
    assert.equal(pose.phase, 'manipulate');
  }
});

test('reload animation keeps the left shoulder on its original torso side and the palm near the weapon support anchor', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });
  const baselineShoulderX = api.rig.armL.position.x;

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: false,
    aimPitch: 0,
    adsActive: false,
    reloading: true,
    reloadPct: 0.35
  });

  api.root.updateMatrixWorld(true);
  const support = new THREE.Vector3();
  const palm = new THREE.Vector3();
  api.rig.supportAnchor.getWorldPosition(support);
  api.rig.palmLeft.getWorldPosition(palm);

  assert.equal(api.rig.armL.position.x, baselineShoulderX);
  assert.ok(palm.distanceTo(support) > 0.25);
  assert.ok(api.rig.armL.rotation.x > 0.8);
});

test('reload action trigger applies the reload pose even before replicated reload state arrives', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });
  const baselineShoulderX = api.rig.armL.position.x;

  api.triggerAction('reload', { duration: 0.9 });
  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: false,
    aimPitch: 0,
    adsActive: false,
    reloading: false,
    reloadPct: 0
  });

  api.root.updateMatrixWorld(true);
  const support = new THREE.Vector3();
  const palm = new THREE.Vector3();
  api.rig.supportAnchor.getWorldPosition(support);
  api.rig.palmLeft.getWorldPosition(palm);

  assert.equal(api.rig.armL.position.x, baselineShoulderX);
  assert.ok(palm.distanceTo(support) > 0.2);
  assert.ok(api.rig.armL.rotation.x > 0.7);
});

test('reload animation does not allocate new Vector3 instances every frame', async () => {
  let vector3Count = 0;
  class CountingVector3 extends THREE.Vector3 {
    constructor(...args) {
      super(...args);
      vector3Count += 1;
    }
  }
  const countingThree = { ...THREE, Vector3: CountingVector3 };
  const avatarRig = await loadAvatarRig({}, countingThree);
  const api = avatarRig.create({ weaponId: 'rifle' });
  const countAfterCreate = vector3Count;

  for (let i = 0; i < 60; i += 1) {
    api.updateAnimation(0.016, {
      speedNorm: 0,
      sprinting: false,
      airborne: false,
      aimPitch: 0,
      adsActive: false,
      reloading: true,
      reloadPct: 0.35
    });
  }

  assert.equal(vector3Count, countAfterCreate);
});

test('reload animation does not accumulate right-arm twist or leave the gun stuck rotated afterward', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: false,
    aimPitch: 0,
    adsActive: false,
    reloading: false,
    reloadPct: 0
  });
  api.root.updateMatrixWorld(true);

  const baselineGunQuat = new THREE.Quaternion();
  api.rig.gun.getWorldQuaternion(baselineGunQuat);

  for (let i = 0; i < 60; i += 1) {
    api.updateAnimation(0.016, {
      speedNorm: 0,
      sprinting: false,
      airborne: false,
      aimPitch: 0,
      adsActive: false,
      reloading: true,
      reloadPct: 0.35
    });
  }

  assert.ok(Math.abs(api.rig.armR.rotation.y) < 0.1);

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: false,
    aimPitch: 0,
    adsActive: false,
    reloading: false,
    reloadPct: 0
  });
  api.root.updateMatrixWorld(true);

  const finalGunQuat = new THREE.Quaternion();
  api.rig.gun.getWorldQuaternion(finalGunQuat);

  assert.ok(Math.abs(api.rig.armR.rotation.y) < 0.000001);
  assert.ok(baselineGunQuat.angleTo(finalGunQuat) < 0.000001);
});

test('avatar rig dispose releases mesh resources and is safe to call twice', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });
  let bodyGeometryDisposals = 0;
  let bodyMaterialDisposals = 0;
  let gunMaterialDisposals = 0;

  const originalBodyGeometryDispose = api.rig.bodyMesh.geometry.dispose.bind(api.rig.bodyMesh.geometry);
  api.rig.bodyMesh.geometry.dispose = function () {
    bodyGeometryDisposals += 1;
    return originalBodyGeometryDispose();
  };
  const originalBodyMaterialDispose = api.rig.bodyMesh.material.dispose.bind(api.rig.bodyMesh.material);
  api.rig.bodyMesh.material.dispose = function () {
    bodyMaterialDisposals += 1;
    return originalBodyMaterialDispose();
  };
  const originalGunMaterialDispose = api.rig.gunBody.material.dispose.bind(api.rig.gunBody.material);
  api.rig.gunBody.material.dispose = function () {
    gunMaterialDisposals += 1;
    return originalGunMaterialDispose();
  };

  api.dispose();
  api.dispose();

  assert.equal(bodyGeometryDisposals, 1);
  assert.equal(bodyMaterialDisposals, 1);
  assert.equal(gunMaterialDisposals, 1);
});

test('built-in weapon visuals keep the sniper support anchor tucked under the fore-end', async () => {
  const avatarRig = await loadAvatarRig();
  const sniperEntry = avatarRig._test.resolveWeaponEntry('sniper');

  assert.equal(sniperEntry.platform.holdClass, 'twoHandPrecision');
  assert.equal(sniperEntry.platform.stockClass, 'precision');
  assert.deepEqual(Array.from(sniperEntry.platform.zones.supportZone), [-0.055, -0.055, -0.42]);
  assert.deepEqual(Array.from(sniperEntry.platform.zones.handleBack), [0, -0.11, 0.11]);
});

test('built-in weapon visuals expose semantic hold and stock metadata for pistol and machinegun', async () => {
  const avatarRig = await loadAvatarRig();
  const pistolEntry = avatarRig._test.resolveWeaponEntry('pistol');
  const machinegunEntry = avatarRig._test.resolveWeaponEntry('machinegun');

  assert.equal(pistolEntry.platform.holdClass, 'oneHandCompact');
  assert.equal(pistolEntry.platform.stockClass, 'none');
  assert.ok(pistolEntry.platform.parts.receiver);
  assert.ok(pistolEntry.platform.parts.grip);

  assert.equal(machinegunEntry.platform.holdClass, 'oneHandLarge');
  assert.equal(machinegunEntry.platform.stockClass, 'short');
  assert.ok(machinegunEntry.platform.parts.receiver);
  assert.ok(machinegunEntry.platform.parts.stock);
});

test('weapon handle-back anchors line up with the right hand mount contract', async () => {
  const avatarRig = await loadAvatarRig();
  const weaponIds = ['pistol', 'rifle', 'machinegun', 'shotgun', 'sniper'];

  for (const weaponId of weaponIds) {
    const api = avatarRig.create({ weaponId });
    api.root.updateMatrixWorld(true);
    const handle = new THREE.Vector3();
    const palm = new THREE.Vector3();
    api.rig.gun.getObjectByName('weaponHandleAnchor').getWorldPosition(handle);
    api.rig.palmRight.getWorldPosition(palm);
    assert.ok(handle.distanceTo(palm) < 0.000001, weaponId + ' should align the handle-back anchor to the right hand mount');
  }
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

test('jump action can reverse the takeoff leg tilt for backward jumps', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0
  });
  const baselineLegRotation = api.rig.legL.rotation.x;

  api.triggerAction('jump', { reverseLegTilt: true });
  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0
  });

  assert.ok(api.rig.legL.rotation.x > baselineLegRotation);
  assert.ok(api.rig.legR.rotation.x > baselineLegRotation);
});

test('airborne animation keeps one-handed guns on a simple fallback pose without shoulder drift', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });
  const baselineShoulderX = api.rig.armL.position.x;

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0
  });

  assert.equal(api.rig.armL.position.x, baselineShoulderX);
  assert.ok(api.rig.armL.rotation.z > 0.15);
  assert.ok(api.rig.armL.rotation.x >= 0);

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0,
    movingForward: true
  });

  assert.ok(api.rig.armL.rotation.x < 0);
  assert.equal(api.rig.armL.position.x, baselineShoulderX);

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0,
    movingBackward: true
  });

  assert.ok(api.rig.armL.rotation.x > 0.1);
  assert.equal(api.rig.armL.position.x, baselineShoulderX);
});

test('armed sprint animation reuses the walk-style firearm arm motion with a stronger support-arm swing', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });
  api.rig.gaitPhase = Math.PI * 0.5;

  api.updateAnimation(0, {
    speedNorm: 1.1,
    sprinting: false,
    airborne: false,
    aimPitch: 0
  });
  const walkLeftArmX = api.rig.armL.rotation.x;
  const walkRightArmX = api.rig.armR.rotation.x;
  const walkRightArmZ = api.rig.armR.rotation.z;
  const walkRightWristX = api.rig.palmRight.rotation.x;

  api.updateAnimation(0, {
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

test('forward locomotion tilts the torso and head together, with more lean while sprinting', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });

  assert.equal(api.rig.bodyMesh.parent, api.rig.upperBodyPivot);
  assert.equal(api.rig.headMesh.parent, api.rig.upperBodyPivot);

  api.updateAnimation(0.25, {
    speedNorm: 8 / 14,
    sprinting: false,
    airborne: false,
    aimPitch: 0,
    worldSpeed: 8,
    movingForward: true
  });
  const walkLean = api.rig.upperBodyPivot.rotation.x;

  assert.ok(walkLean < -0.045);
  assert.ok(walkLean > -0.07);

  api.updateAnimation(0.25, {
    speedNorm: 1,
    sprinting: true,
    airborne: false,
    aimPitch: 0,
    worldSpeed: 14,
    movingForward: true
  });
  const runLean = api.rig.upperBodyPivot.rotation.x;

  assert.ok(runLean < walkLean);
  assert.ok(runLean < -0.1);
  assert.ok(runLean > -0.12);
});

test('upper-body forward lean stays off while backpedaling or strafing', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });

  api.updateAnimation(0.25, {
    speedNorm: 8 / 14,
    sprinting: false,
    airborne: false,
    aimPitch: 0,
    worldSpeed: 8,
    movingBackward: true
  });
  assert.equal(api.rig.upperBodyPivot.rotation.x, 0);

  api.updateAnimation(0.25, {
    speedNorm: 8 / 14,
    sprinting: false,
    airborne: false,
    aimPitch: 0,
    worldSpeed: 8,
    movingRight: true
  });
  assert.equal(api.rig.upperBodyPivot.rotation.x, 0);
});

test('airborne forward and backward input tilts the torso to match the live jump arm sweep', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create({ weaponId: 'rifle' });

  api.updateAnimation(0.25, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0
  });
  assert.equal(api.rig.upperBodyPivot.rotation.x, 0);

  api.updateAnimation(0.25, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0,
    movingForward: true
  });
  const forwardAirLean = api.rig.upperBodyPivot.rotation.x;

  assert.ok(forwardAirLean < -0.03);
  assert.ok(forwardAirLean > -0.05);

  api.updateAnimation(0.25, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0,
    movingBackward: true
  });
  const backwardAirLean = api.rig.upperBodyPivot.rotation.x;

  assert.ok(backwardAirLean > 0.03);
  assert.ok(backwardAirLean < 0.05);
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
