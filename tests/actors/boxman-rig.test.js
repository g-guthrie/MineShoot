import test from 'node:test';
import assert from 'node:assert/strict';

await import('../../js/actors/boxman-rig.js');

const boxmanRig = globalThis.__MAYHEM_RUNTIME.GameBoxmanRig;

test('boxman reverses locomotion playback for backward run and sprint clips', () => {
  const runPlayback = boxmanRig._test.resolveClipPlayback({
    movingForward: false,
    movingBackward: true
  }, 'run');
  const sprintPlayback = boxmanRig._test.resolveClipPlayback({
    movingForward: false,
    movingBackward: true
  }, 'sprint');

  assert.equal(runPlayback.reverse, true);
  assert.equal(runPlayback.timeScale, -1);
  assert.equal(sprintPlayback.reverse, true);
  assert.equal(sprintPlayback.timeScale, -1);
});

test('boxman keeps forward playback for non-backpedal states', () => {
  const forwardRun = boxmanRig._test.resolveClipPlayback({
    movingForward: true,
    movingBackward: false
  }, 'run');
  const strafeRun = boxmanRig._test.resolveClipPlayback({
    movingForward: false,
    movingBackward: false,
    movingLeft: true
  }, 'run');
  const jumpClip = boxmanRig._test.resolveClipPlayback({
    movingForward: false,
    movingBackward: true
  }, 'jump_running');

  assert.equal(forwardRun.reverse, false);
  assert.equal(forwardRun.timeScale, 1);
  assert.equal(strafeRun.reverse, false);
  assert.equal(strafeRun.timeScale, 1);
  assert.equal(jumpClip.reverse, false);
  assert.equal(jumpClip.timeScale, 1);
});

test('boxman slows the standing turn loop for gentler turns and speeds it up for stronger turns', () => {
  const gentleTurn = boxmanRig._test.resolveClipPlayback({
    turnRate: 25 * (Math.PI / 180)
  }, 'rotate_left');
  const strongTurn = boxmanRig._test.resolveClipPlayback({
    turnRate: 90 * (Math.PI / 180)
  }, 'rotate_left');

  assert.ok(gentleTurn.timeScale > 0.79);
  assert.ok(gentleTurn.timeScale < strongTurn.timeScale);
  assert.ok(strongTurn.timeScale > 1.25);
});

test('boxman skips the crouch lead-in on jump clips because gameplay is already airborne', () => {
  assert.equal(boxmanRig._test.clipStartFraction('jump_idle'), 0.24);
  assert.equal(boxmanRig._test.clipStartFraction('jump_running'), 0.24);
  assert.equal(boxmanRig._test.clipStartFraction('run'), 0);
});

test('boxman skips the built-in side start clips for pure strafes', () => {
  assert.equal(boxmanRig._test.movementStartClip({
    movingLeft: true,
    movingForward: false,
    movingBackward: false,
    movingRight: false
  }), '');
  assert.equal(boxmanRig._test.movementStartClip({
    movingRight: true,
    movingForward: false,
    movingBackward: false,
    movingLeft: false
  }), '');
});

test('boxman uses normal idle while standing still without idle_shoot clip routing', () => {
  const clip = boxmanRig._test.selectClip({
    airborne: false
  }, {
    wasGrounded: true,
    wasMoving: false,
    lockName: '',
    lockRemaining: 0,
    jumpTriggered: false,
    directional: {
      useTurnEntryClip: false,
      useTurnLoopClip: false,
      turnClipDirection: 0
    },
    turnEntryDirection: 0
  }, {
    idle_shoot: { getClip() { return { duration: 1 }; } }
  });

  assert.equal(clip, 'idle');
});

test('boxman idle aim pose tracks vertical look on the right arm only', () => {
  const rig = {
    armUpperR: { rotation: { x: 0, y: 1, z: 2 } },
    armLowerR: { rotation: { x: 0, y: 3, z: 4 } }
  };

  const applied = boxmanRig._test.applyIdleAimPose(rig, {
    currentPitch: boxmanRig._test.idleAimTargetPitch({
      aimPitch: 0.5,
      airborne: false
    }),
    currentYaw: boxmanRig._test.idleAimTargetYaw({
      facingYaw: Math.PI * 0.25
    })
  });

  assert.equal(applied, true);
  assert.ok(rig.armUpperR.rotation.x < -1.35);
  assert.ok(rig.armLowerR.rotation.x < -0.45);
  assert.ok(rig.armUpperR.rotation.y > 1);
  assert.equal(rig.armUpperR.rotation.z, 2);
  assert.ok(rig.armLowerR.rotation.y > 3);
  assert.equal(rig.armLowerR.rotation.z, 4);
});

test('boxman keeps the same right-arm aim target in run as in idle', () => {
  const idleNeutral = boxmanRig._test.idleAimTargetPitch({
    aimPitch: 0,
    airborne: false
  }, 'idle');
  const runNeutral = boxmanRig._test.idleAimTargetPitch({
    aimPitch: 0,
    airborne: false
  }, 'run');
  const idleResponse = boxmanRig._test.idleAimTargetPitch({
    aimPitch: 0.5,
    airborne: false
  }, 'idle');
  const runResponse = boxmanRig._test.idleAimTargetPitch({
    aimPitch: 0.5,
    airborne: false
  }, 'run');

  assert.ok(Math.abs(runNeutral - idleNeutral) < 0.000001);
  assert.ok(Math.abs(runResponse - idleResponse) < 0.000001);
});

test('boxman overrides the run clip right arm with the idle base pose', () => {
  const rig = {
    armUpperR: { rotation: { x: 9, y: 8, z: 7 } },
    armLowerR: { rotation: { x: 6, y: 5, z: 4 } }
  };

  const applied = boxmanRig._test.applyRunRightArmIdleBasePose(rig, 'run', {
    time: 0.25,
    getClip() {
      return { duration: 1 };
    }
  });

  assert.equal(applied, true);
  assert.ok(Math.abs(rig.armUpperR.rotation.x - (((21.02 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -2.2)) + (6 * (Math.PI / 180)))) < 0.000001);
  assert.ok(Math.abs(rig.armUpperR.rotation.y - (-7.92 * (Math.PI / 180))) < 0.000001);
  assert.ok(Math.abs(rig.armUpperR.rotation.z - (11.86 * (Math.PI / 180))) < 0.000001);
  assert.ok(Math.abs(rig.armLowerR.rotation.x - (((-33.6 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -0.8)) + (Math.sin((Math.PI * 0.5) + 0.35) * (2.4 * (Math.PI / 180))))) < 0.000001);
  assert.equal(rig.armLowerR.rotation.y, 0);
  assert.equal(rig.armLowerR.rotation.z, 0);
});

test('boxman suppresses right-arm run swing while fire recoil is active', () => {
  const rig = {
    armUpperR: { rotation: { x: 0, y: 0, z: 0 } },
    armLowerR: { rotation: { x: 0, y: 0, z: 0 } },
    fireRecoilState: {
      shoulderPitch: -0.1,
      lowerArmPitch: -0.2,
      weaponKick: -0.05
    }
  };

  const applied = boxmanRig._test.applyRunRightArmIdleBasePose(rig, 'run', {
    time: 0.25,
    getClip() {
      return { duration: 1 };
    }
  });

  assert.equal(applied, true);
  assert.ok(Math.abs(rig.armUpperR.rotation.x - ((21.02 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -2.2))) < 0.000001);
  assert.ok(Math.abs(rig.armLowerR.rotation.x - ((-33.6 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -0.8))) < 0.000001);
});

test('boxman no longer uses fake shoulder carry translation or yaw compensation', () => {
  const rig = {
    armUpperR: {
      rotation: { x: 0, y: 0.1, z: 0 },
      position: {
        x: 1,
        y: 2,
        z: 0,
        copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
      }
    },
    armUpperRBasePos: {
      x: 1,
      y: 2,
      z: 0,
      copy() { return this; },
      applyAxisAngle() { return { x: 0.955336489125606, y: 2, z: 0.29552020666133955 }; }
    },
    armLowerR: { rotation: { x: 0, y: 0.2, z: 0 } }
  };

  const applied = boxmanRig._test.applyTorsoCarryPose(rig, {
    bodyUpperAimYaw: 0.3,
    bodyLowerAimYaw: 0.2
  });

  assert.equal(applied, true);
  assert.equal(rig.armUpperR.rotation.y, 0.1);
  assert.equal(rig.armLowerR.rotation.y, 0.2);
  assert.equal(rig.armUpperR.position.x, 1);
  assert.equal(rig.armUpperR.position.z, 0);
});

test('boxman idle aim layer stays enabled for normal clips but disables for sprint and roll', () => {
  assert.equal(boxmanRig._test.idleAimAllowed({ airborne: false, sprinting: false }, 'idle'), true);
  assert.equal(boxmanRig._test.idleAimAllowed({ airborne: false, sprinting: false }, 'run'), true);
  assert.equal(boxmanRig._test.idleAimAllowed({ airborne: false, sprinting: false }, 'rotate_left'), true);
  assert.equal(boxmanRig._test.idleAimAllowed({ airborne: false, sprinting: false }, 'start_right'), true);
  assert.equal(boxmanRig._test.idleAimAllowed({ airborne: false, sprinting: true }, 'sprint'), false);
  assert.equal(boxmanRig._test.idleAimAllowed({ airborne: false, sprinting: false }, 'drop_running_roll'), false);
});

test('boxman idle aim target preserves the arm-out baseline and softens live response', () => {
  const neutral = boxmanRig._test.idleAimTargetPitch({
    aimPitch: 0,
    airborne: false
  }, 'idle');
  const lookDown = boxmanRig._test.idleAimTargetPitch({
    aimPitch: -0.5,
    airborne: false
  }, 'idle');

  assert.ok(neutral > 0.45);
  assert.ok(lookDown > 0);
  assert.ok(lookDown < neutral);
});

test('boxman idle aim target yaw counter-rotates against facing yaw and clamps', () => {
  const mild = boxmanRig._test.idleAimTargetYaw({ facingYaw: 10 * (Math.PI / 180) }, 'idle');
  const hard = boxmanRig._test.idleAimTargetYaw({ facingYaw: Math.PI }, 'idle');
  const runYaw = boxmanRig._test.idleAimTargetYaw({ facingYaw: Math.PI * 0.5 }, 'run');

  assert.ok(mild > 0);
  assert.ok(Math.abs(hard) <= (90 * (Math.PI / 180)));
  assert.ok(Math.abs(hard) > Math.abs(mild));
  assert.ok(Math.abs(runYaw - (Math.PI * 0.5)) < 0.000001);
});

test('boxman counter-rotates the gun only on the outward-opening side', () => {
  const rig = {
    weaponRoot: {
      rotation: {
        x: 0,
        y: 0,
        z: 0,
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
      }
    },
    weaponRootBaseRot: { x: 0.08, y: 0.22, z: 0 }
  };

  const outward = boxmanRig._test.applyWeaponOrientationCompensation(rig, { currentYaw: 0.5 });
  assert.equal(outward, true);
  assert.ok(rig.weaponRoot.rotation.y < 0.22);

  const inward = boxmanRig._test.applyWeaponOrientationCompensation(rig, { currentYaw: -0.5 });
  assert.equal(inward, false);
  assert.equal(rig.weaponRoot.rotation.y, 0.22);
});

test('boxman defines a tiny floating weapon cube mount off the right lower arm', () => {
  const mount = boxmanRig._test.weaponMount();

  assert.ok(mount.rootPos.x < 0);
  assert.ok(mount.rootPos.y > 0.5);
  assert.equal(mount.rootPos.z, -0.06);
  assert.ok(mount.rootRot.y > 0.2);
  assert.equal(mount.cubeSize.x, 0.28);
  assert.equal(mount.cubeSize.y, 0.28);
  assert.equal(mount.cubeSize.z, 0.5);
  assert.equal(mount.barrelPos.z, -0.28);
  assert.equal(mount.barrelSize.y, 0.24);
  assert.ok(mount.muzzlePos.z < 0);
});

test('boxman reveal clone helper detaches circular root userData during clone work', () => {
  const root = { userData: { rig: null } };
  root.userData.rig = { root };
  let sawDetachedUserData = false;

  const clone = boxmanRig._test.cloneWithDetachedRootUserData(root, function (target) {
    sawDetachedUserData = JSON.stringify(target.userData) === '{}';
    return { ok: true };
  });

  assert.equal(sawDetachedUserData, true);
  assert.equal(clone.ok, true);
  assert.equal(root.userData.rig.root, root);
});

test('boxman resolves live skeleton bones before falling back to wrapper node names', () => {
  const armLowerR = { name: 'arm_lowerR', marker: 'live-bone' };
  const fallbackRoot = { name: 'modelRoot' };
  const modelRoot = {
    getObjectByName(name) {
      if (name === 'arm_lower.R') return { name, marker: 'wrapper-node' };
      return null;
    }
  };
  const skinnedMesh = {
    skeleton: {
      bones: [armLowerR]
    }
  };

  const resolved = boxmanRig._test.resolveAnimatedBone(
    modelRoot,
    skinnedMesh,
    ['arm_lowerR', 'arm_lower.R'],
    fallbackRoot
  );

  assert.equal(resolved, armLowerR);
});

test('boxman falls back to alternate exported names when dotted blender-style names are requested', () => {
  const armUpperL = { name: 'arm_upperL', marker: 'live-bone' };
  const skinnedMesh = {
    skeleton: {
      bones: [armUpperL]
    }
  };

  const resolved = boxmanRig._test.resolveAnimatedBone(
    { getObjectByName() { return null; } },
    skinnedMesh,
    ['arm_upper.L', 'arm_upperL'],
    null
  );

  assert.equal(resolved, armUpperL);
});

test('boxman can resolve a distal arm-face center from mesh-space points', () => {
  const solved = boxmanRig._test.resolveDistalFaceCenter([
    { x: 0, y: 0.02, z: 0 },
    { x: 0.01, y: 0.19, z: 0.01 },
    { x: -0.01, y: 0.2, z: -0.01 },
    { x: 0.005, y: 0.18, z: 0 }
  ], 0.015);

  assert.equal(solved.axis, 'y');
  assert.equal(solved.sign, 1);
  assert.ok(solved.center.y > 0.19);
});

test('boxman only uses the landing roll after a real drop, not from a flat sprint jump', () => {
  assert.equal(boxmanRig._test.landingClip({
    lastLandingHorizontalSpeed: 10,
    lastLandingDropDistance: 0
  }, {
    movingForward: true
  }), 'drop_running');

  assert.equal(boxmanRig._test.landingClip({
    lastLandingHorizontalSpeed: 7.5,
    lastLandingDropDistance: 2.0
  }, {
    movingForward: true
  }), 'drop_running_roll');
});

test('boxman requires meaningful landing horizontal speed for rolls, including diagonals', () => {
  assert.equal(boxmanRig._test.landingClip({
    lastLandingHorizontalSpeed: 1.9,
    lastLandingDropDistance: 3.5
  }, {
    movingForward: true,
    movingRight: true
  }), 'drop_running');

  assert.equal(boxmanRig._test.landingClip({
    lastLandingHorizontalSpeed: 2.1,
    lastLandingDropDistance: 3.5
  }, {
    movingForward: true,
    movingRight: true
  }), 'drop_running_roll');
});

test('boxman turns the manual roll clip toward the current movement direction', () => {
  assert.ok(Math.abs(boxmanRig._test.resolveRollFacingYaw({
    movingForward: true
  })) < 1e-9);
  assert.ok(boxmanRig._test.resolveRollFacingYaw({
    movingRight: true
  }) < 0);
  assert.ok(Math.abs(Math.abs(boxmanRig._test.resolveRollFacingYaw({
    movingBackward: true
  })) - Math.PI) < 1e-6);
});

test('boxman backward roll reuses the roll clip in reverse', () => {
  const playback = boxmanRig._test.resolveClipPlayback({
    manualRollReverse: true
  }, 'drop_running_roll');

  assert.equal(playback.reverse, true);
  assert.ok(playback.timeScale < 0);
});

test('boxman manual backward roll targets the backpedal origin instead of snapping sideways', () => {
  assert.equal(boxmanRig._test.isBackwardRollIntent({
    movingBackward: true,
    movingRight: true
  }), true);
  assert.ok(Math.abs(boxmanRig._test.resolveManualRollFacingYaw({
    movingBackward: true,
    movingRight: true
  }, Math.PI * 0.5) - (Math.PI * 0.5)) < 1e-9);
  assert.equal(boxmanRig._test.needsBackwardRollAlign(Math.PI * 0.5), true);
  assert.equal(boxmanRig._test.needsBackwardRollAlign(5 * (Math.PI / 180)), false);
});

test('boxman fire recoil layers on top of clip output and stacks across rapid shots', () => {
  const weaponRootBasePos = { x: 0.08, y: 0.65, z: -0.16 };
  const rig = {
    weaponRootBasePos,
    weaponRoot: {
      position: {
        x: weaponRootBasePos.x,
        y: weaponRootBasePos.y,
        z: weaponRootBasePos.z,
        copy(source) {
          this.x = source.x;
          this.y = source.y;
          this.z = source.z;
          return this;
        }
      }
    },
    armUpperR: { rotation: { x: 0, y: 0, z: 0 } },
    armLowerR: { rotation: { x: 0, y: 0, z: 0 } }
  };
  const recoilState = boxmanRig._test.createFireRecoilState();

  boxmanRig._test.triggerFireRecoil(recoilState, {
    weaponKick: -0.03,
    shoulderPitch: 0.02,
    shoulderYaw: 0.01,
    shoulderRoll: 0.004,
    lowerArmPitch: 0.05,
    side: 1
  });
  boxmanRig._test.applyFireRecoilPose(rig, recoilState);

  const firstWeaponKick = rig.weaponRoot.position.z;

  assert.ok(firstWeaponKick < weaponRootBasePos.z);
  assert.equal(rig.armUpperR.rotation.x, 0);
  assert.equal(rig.armUpperR.rotation.y, 0);
  assert.equal(rig.armLowerR.rotation.x, 0);
  assert.ok(recoilState.shoulderPitch > 0);
  assert.ok(recoilState.shoulderYaw > 0);
  assert.ok(recoilState.lowerArmPitch > 0);

  boxmanRig._test.triggerFireRecoil(recoilState, {
    weaponKick: -0.03,
    shoulderPitch: 0.02,
    shoulderYaw: 0.01,
    shoulderRoll: 0.004,
    lowerArmPitch: 0.05,
    side: 1
  });
  rig.armUpperR.rotation.x = 0;
  rig.armUpperR.rotation.y = 0;
  rig.armUpperR.rotation.z = 0;
  rig.armLowerR.rotation.x = 0;
  boxmanRig._test.applyFireRecoilPose(rig, recoilState);

  assert.ok(rig.weaponRoot.position.z < firstWeaponKick);
  assert.equal(rig.armUpperR.rotation.x, 0);
  assert.equal(rig.armUpperR.rotation.y, 0);
  assert.equal(rig.armLowerR.rotation.x, 0);
  assert.ok(recoilState.shoulderPitch > 0.03);
  assert.ok(recoilState.shoulderYaw > 0.015);
  assert.ok(recoilState.lowerArmPitch > 0.08);

  boxmanRig._test.decayFireRecoilState(recoilState, 0.2);
  assert.ok(recoilState.lowerArmPitch < 0.1);
});
