import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  applyWeaponArmLayer,
  createIdleArmSampler,
  createWeaponArmLayerState,
  resolveWeaponArmLayerProfile
} from '../../js/actors/boxman-weapon-arm-layer.js';

function bone(x = 1, y = 2, z = 3) {
  return {
    rotation: { x, y, z }
  };
}

function makeRig() {
  return {
    armUpperR: bone(),
    armLowerR: bone(),
    weaponRoot: bone(0.4, 0.5, 0.6),
    weaponRootBaseRot: { x: 0.1, y: -0.2, z: 0.3 }
  };
}

function makeObjectRig() {
  return {
    armUpperR: new THREE.Object3D(),
    armLowerR: new THREE.Object3D()
  };
}

function pureForwardState() {
  return {
    intent: {
      moving: true,
      pureForward: true
    }
  };
}

function idleState() {
  return {
    intent: {
      moving: false,
      pureForward: false
    }
  };
}

function strafeState() {
  return {
    intent: {
      moving: true,
      pureForward: false,
      pureStrafe: true
    }
  };
}

test('weapon arm layer state is always active posture state', () => {
  const state = createWeaponArmLayerState();
  assert.equal(Object.prototype.hasOwnProperty.call(state, 'enabled'), false);
  assert.equal(state.applied, false);
  assert.equal(state.profileName, '');
});

test('weapon arm layer profiles idle capture, forward movement, and stop settle only', () => {
  assert.equal(resolveWeaponArmLayerProfile({
    activeClipName: 'run',
    directionalState: strafeState()
  }), null);
  assert.equal(resolveWeaponArmLayerProfile({
    activeClipName: 'jump_running',
    directionalState: pureForwardState()
  }), null);
  assert.equal(resolveWeaponArmLayerProfile({
    activeClipName: 'run',
    directionalState: pureForwardState()
  }).name, 'forward_carry_lock');
  assert.equal(resolveWeaponArmLayerProfile({
    activeClipName: 'start_forward',
    directionalState: pureForwardState()
  }).name, 'forward_carry_lock');
  assert.equal(resolveWeaponArmLayerProfile({
    activeClipName: 'idle',
    directionalState: idleState()
  }).name, 'idle_capture');
  assert.equal(resolveWeaponArmLayerProfile({
    activeClipName: 'stop',
    directionalState: idleState(),
    stopDirectionalState: pureForwardState(),
    stopSettleWeight: 0.5
  }).name, 'forward_carry_lock');
  assert.equal(resolveWeaponArmLayerProfile({
    activeClipName: 'stop',
    directionalState: idleState(),
    stopDirectionalState: strafeState(),
    stopSettleWeight: 0.5
  }).name, 'forward_carry_lock');
  assert.equal(resolveWeaponArmLayerProfile({
    activeClipName: 'sprint',
    directionalState: pureForwardState()
  }), null);
});

test('weapon arm layer leaves current pose untouched when unprofiled', () => {
  const strafeRig = makeRig();
  const strafeBefore = JSON.parse(JSON.stringify(strafeRig));
  assert.deepEqual(applyWeaponArmLayer(strafeRig, {
    state: createWeaponArmLayerState(),
    activeClipName: 'run',
    directionalState: strafeState()
  }), { applied: false, profileName: '' });
  assert.deepEqual(strafeRig, strafeBefore);
});

test('weapon arm layer reuses the captured idle arm baseline for forward movement', () => {
  const idleRig = makeRig();
  idleRig.armUpperR.rotation = { x: 0.2, y: 0.3, z: 0.4 };
  idleRig.armLowerR.rotation = { x: -0.5, y: -0.1, z: 0.05 };
  const runRig = makeRig();
  const state = createWeaponArmLayerState();
  const idleBefore = JSON.parse(JSON.stringify(idleRig));
  const idleResult = applyWeaponArmLayer(idleRig, {
    state,
    activeClipName: 'idle',
    directionalState: idleState()
  });
  const runResult = applyWeaponArmLayer(runRig, {
    state,
    activeClipName: 'run',
    directionalState: pureForwardState()
  });

  assert.deepEqual(idleResult, { applied: false, profileName: 'idle_capture' });
  assert.deepEqual(idleRig, idleBefore);
  assert.deepEqual(runResult, { applied: true, profileName: 'forward_carry_lock' });
  assert.equal(state.profileName, 'forward_carry_lock');
  assert.deepEqual(runRig.armUpperR.rotation, idleRig.armUpperR.rotation);
  assert.deepEqual(runRig.armLowerR.rotation, idleRig.armLowerR.rotation);
  assert.deepEqual(runRig.weaponRoot.rotation, { x: 0.4, y: 0.5, z: 0.6 });
});

test('weapon arm layer samples the idle right-arm animation during pure forward movement', () => {
  const idleClip = new THREE.AnimationClip('idle', 1, [
    new THREE.VectorKeyframeTrack('arm_upperR.position', [0, 1], [1, 2, 3, 3, 4, 5]),
    new THREE.QuaternionKeyframeTrack(
      'arm_upperR.quaternion',
      [0, 1],
      [
        0, 0, 0, 1,
        0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)
      ]
    ),
    new THREE.QuaternionKeyframeTrack(
      'arm_lowerR.quaternion',
      [0, 1],
      [
        0, 0, 0, 1,
        Math.sin(Math.PI / 6), 0, 0, Math.cos(Math.PI / 6)
      ]
    )
  ]);
  const state = createWeaponArmLayerState({
    animations: [idleClip]
  });
  const idleRig = makeObjectRig();
  const runRig = makeObjectRig();

  applyWeaponArmLayer(idleRig, {
    state,
    activeClipName: 'idle',
    directionalState: idleState(),
    activeActionTime: 0.25
  });

  const result = applyWeaponArmLayer(runRig, {
    state,
    activeClipName: 'run',
    directionalState: pureForwardState(),
    deltaSec: 0.25
  });

  const expectedUpper = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
  const expectedLower = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 6);
  assert.deepEqual(result, { applied: true, profileName: 'forward_carry_lock' });
  assert.equal(createIdleArmSampler([idleClip]).duration, 1);
  assert.equal(runRig.armUpperR.position.x, 2);
  assert.equal(runRig.armUpperR.position.y, 3);
  assert.equal(runRig.armUpperR.position.z, 4);
  assert.ok(runRig.armUpperR.quaternion.angleTo(expectedUpper) < 0.00001);
  assert.ok(runRig.armLowerR.quaternion.angleTo(expectedLower) < 0.00001);
});

test('weapon arm layer does not invent a carry pose before idle has been sampled', () => {
  const rig = makeRig();
  const before = JSON.parse(JSON.stringify(rig));
  const result = applyWeaponArmLayer(rig, {
    state: createWeaponArmLayerState(),
    activeClipName: 'run',
    directionalState: pureForwardState()
  });

  assert.deepEqual(result, { applied: false, profileName: 'forward_carry_lock' });
  assert.deepEqual(rig, before);
});

test('weapon arm layer leaves sprint to the authored sprint animation', () => {
  const rig = makeRig();
  const before = JSON.parse(JSON.stringify(rig));
  const result = applyWeaponArmLayer(rig, {
    state: createWeaponArmLayerState(),
    activeClipName: 'sprint',
    directionalState: pureForwardState()
  });

  assert.deepEqual(result, { applied: false, profileName: '' });
  assert.deepEqual(rig, before);
});

test('weapon arm layer keeps pure-forward stop settle on the captured carry pose', () => {
  const state = createWeaponArmLayerState();
  const idleRig = makeRig();
  idleRig.armUpperR.rotation = { x: 0.2, y: 0.3, z: 0.4 };
  idleRig.armLowerR.rotation = { x: -0.5, y: -0.1, z: 0.05 };
  applyWeaponArmLayer(idleRig, {
    state,
    activeClipName: 'idle',
    directionalState: idleState()
  });

  const stopRig = makeRig();
  const result = applyWeaponArmLayer(stopRig, {
    state,
    activeClipName: 'stop',
    directionalState: idleState(),
    stopDirectionalState: pureForwardState(),
    stopSettleWeight: 0.6
  });

  assert.deepEqual(result, { applied: true, profileName: 'forward_carry_lock' });
  assert.deepEqual(stopRig.armUpperR.rotation, idleRig.armUpperR.rotation);
  assert.deepEqual(stopRig.armLowerR.rotation, idleRig.armLowerR.rotation);
});

test('weapon arm layer keeps pure-strafe stop settle on the captured carry pose', () => {
  const state = createWeaponArmLayerState();
  const idleRig = makeRig();
  idleRig.armUpperR.rotation = { x: 0.22, y: 0.32, z: 0.42 };
  idleRig.armLowerR.rotation = { x: -0.52, y: -0.12, z: 0.08 };
  applyWeaponArmLayer(idleRig, {
    state,
    activeClipName: 'idle',
    directionalState: idleState()
  });

  const stopRig = makeRig();
  const result = applyWeaponArmLayer(stopRig, {
    state,
    activeClipName: 'stop',
    directionalState: idleState(),
    stopDirectionalState: strafeState(),
    stopSettleWeight: 0.6
  });

  assert.deepEqual(result, { applied: true, profileName: 'forward_carry_lock' });
  assert.deepEqual(stopRig.armUpperR.rotation, idleRig.armUpperR.rotation);
  assert.deepEqual(stopRig.armLowerR.rotation, idleRig.armLowerR.rotation);
});
