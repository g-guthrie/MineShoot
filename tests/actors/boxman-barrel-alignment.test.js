import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  applyBarrelCrosshairAlignment,
  cameraForwardFromAnimState
} from '../../js/actors/boxman-barrel-alignment.js';

function makeAlignmentRig() {
  const root = new THREE.Group();
  const eyeAnchor = new THREE.Object3D();
  eyeAnchor.position.set(0, 1.6, 0);
  root.add(eyeAnchor);

  const armLowerR = new THREE.Object3D();
  armLowerR.position.set(0.5, 1.3, 0);
  root.add(armLowerR);

  const weaponRoot = new THREE.Object3D();
  armLowerR.add(weaponRoot);

  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.position.set(0, 0.1, -0.5);
  weaponRoot.add(muzzleAnchor);

  root.updateMatrixWorld(true);
  return { root, eyeAnchor, armLowerR, weaponRoot, muzzleAnchor };
}

function barrelWorldForward(rig) {
  rig.root.updateMatrixWorld(true);
  const q = new THREE.Quaternion();
  rig.muzzleAnchor.getWorldQuaternion(q);
  return new THREE.Vector3(0, 0, -1).applyQuaternion(q).normalize();
}

function desiredWorldForward(rig, animState) {
  const eye = new THREE.Vector3();
  const muzzle = new THREE.Vector3();
  const forward = cameraForwardFromAnimState(animState, new THREE.Vector3());
  rig.eyeAnchor.getWorldPosition(eye);
  rig.muzzleAnchor.getWorldPosition(muzzle);
  return eye.addScaledVector(forward, 96).sub(muzzle).normalize();
}

test('barrel alignment rotates weapon root toward the crosshair ray', () => {
  const rig = makeAlignmentRig();
  const animState = {
    yaw: 0,
    aimPitch: 18 * Math.PI / 180
  };
  const desired = desiredWorldForward(rig, animState);
  const before = barrelWorldForward(rig).dot(desired);

  assert.equal(applyBarrelCrosshairAlignment(rig, animState, {
    targetDistance: 96,
    maxCorrectionRad: Math.PI,
    weight: 1
  }), true);

  const after = barrelWorldForward(rig).dot(desired);
  assert.ok(after > before);
  assert.ok(after > 0.999);
});

test('barrel alignment honors correction limit', () => {
  const rig = makeAlignmentRig();
  const animState = {
    yaw: 0,
    aimPitch: 45 * Math.PI / 180
  };
  const before = barrelWorldForward(rig);

  assert.equal(applyBarrelCrosshairAlignment(rig, animState, {
    targetDistance: 96,
    maxCorrectionRad: 5 * Math.PI / 180,
    weight: 1
  }), true);

  const after = barrelWorldForward(rig);
  assert.ok(before.angleTo(after) <= (5.01 * Math.PI / 180));
});
