import test from 'node:test';
import assert from 'node:assert/strict';

await import('../../js/actors/boxman-rig.js');

const boxmanRig = globalThis.__MAYHEM_RUNTIME.GameBoxmanRig;

test('boxman reverses locomotion playback for backward run and sprint clips', () => {
  const runPlayback = boxmanRig._test.resolveClipPlayback({
    movingForward: false,
    movingBackward: true,
    movingRight: true
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

test('boxman keeps plain reversed playback without the fastBackpedal flag', () => {
  const playback = boxmanRig._test.resolveClipPlayback({
    movingForward: false,
    movingBackward: true,
    movingLeft: false,
    movingRight: false,
    sprinting: true
  }, 'run');

  assert.equal(playback.reverse, true);
  assert.equal(playback.timeScale, -1);
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

test('boxman speeds up reversed run playback during fast backpedal', () => {
  const playback = boxmanRig._test.resolveClipPlayback({
    movingForward: false,
    movingBackward: true,
    fastBackpedal: true
  }, 'run');

  assert.equal(playback.reverse, true);
  assert.equal(playback.timeScale, -1.25);
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

test('boxman uses stop only after fast forward movement and skips it otherwise', () => {
  const fastForwardStop = boxmanRig._test.selectClip({
    movingForward: false,
    movingBackward: false,
    movingLeft: false,
    movingRight: false,
    airborne: false
  }, {
    wasGrounded: true,
    wasMoving: true,
    lastMoveForward: true,
    lastMoveBackward: false,
    lastMoveLeft: false,
    lastMoveRight: false,
    lastMoveIntent: {
      moving: true,
      forwardAxis: 1,
      rightAxis: 0,
      magnitude: 1,
      angle: 0,
      absAngle: 0,
      sideSign: 0,
      pureForward: true,
      pureBackpedal: false,
      pureStrafe: false,
      diagonal: false
    },
    lastMoveDirectionalSnapshot: {
      intent: {
        moving: true,
        forwardAxis: 1,
        rightAxis: 0,
        magnitude: 1,
        angle: 0,
        absAngle: 0,
        sideSign: 0,
        pureForward: true,
        pureBackpedal: false,
        pureStrafe: false,
        diagonal: false
      },
      profile: {
        facingYaw: 0,
        retreatLean: 0,
        fromLabel: 'forward',
        toLabel: 'forward',
        blend: 0,
        label: 'forward'
      },
      startRemaining: 0,
      facingYaw: 0,
      bodyLowerAimYaw: 0,
      bodyUpperAimYaw: 0,
      headAimYaw: 0,
      poseName: 'forward'
    },
    recentForwardStopRemaining: 0,
    recentForwardStopWeight: 0,
    stopSettleRemaining: 0,
    stopSettleDuration: 0.18,
    stopDirectionalSnapshot: null,
    lastGroundedSpeed: 0.95,
    lockName: '',
    lockRemaining: 0,
    jumpTriggered: false,
    directional: {
      useTurnEntryClip: false,
      useTurnLoopClip: false,
      turnClipDirection: 0
    },
    turnEntryDirection: 0
  }, {});
  const backwardStop = boxmanRig._test.selectClip({
    movingForward: false,
    movingBackward: false,
    movingLeft: false,
    movingRight: false,
    airborne: false
  }, {
    wasGrounded: true,
    wasMoving: true,
    lastMoveForward: false,
    lastMoveBackward: true,
    lastMoveLeft: false,
    lastMoveRight: false,
    lastMoveIntent: {
      moving: true,
      forwardAxis: -1,
      rightAxis: 0,
      magnitude: 1,
      angle: Math.PI,
      absAngle: Math.PI,
      sideSign: 1,
      pureForward: false,
      pureBackpedal: true,
      pureStrafe: false,
      diagonal: false
    },
    lastMoveDirectionalSnapshot: {
      intent: {
        moving: true,
        forwardAxis: -1,
        rightAxis: 0,
        magnitude: 1,
        angle: Math.PI,
        absAngle: Math.PI,
        sideSign: 1,
        pureForward: false,
        pureBackpedal: true,
        pureStrafe: false,
        diagonal: false
      },
      profile: {
        facingYaw: 0,
        retreatLean: 0.09,
        fromLabel: 'backpedal',
        toLabel: 'backpedal',
        blend: 1,
        label: 'backpedal'
      },
      startRemaining: 0,
      facingYaw: 0,
      bodyLowerAimYaw: 0,
      bodyUpperAimYaw: 0,
      headAimYaw: 0,
      poseName: 'backpedal'
    },
    recentForwardStopRemaining: 0,
    recentForwardStopWeight: 0,
    stopSettleRemaining: 0,
    stopSettleDuration: 0.18,
    stopDirectionalSnapshot: null,
    lastGroundedSpeed: 0.95,
    lockName: '',
    lockRemaining: 0,
    jumpTriggered: false,
    directional: {
      useTurnEntryClip: false,
      useTurnLoopClip: false,
      turnClipDirection: 0
    },
    turnEntryDirection: 0
  }, {});

  const slowForwardStop = boxmanRig._test.selectClip({
    movingForward: false,
    movingBackward: false,
    movingLeft: false,
    movingRight: false,
    airborne: false
  }, {
    wasGrounded: true,
    wasMoving: true,
    lastMoveForward: true,
    lastMoveBackward: false,
    lastMoveLeft: false,
    lastMoveRight: false,
    lastMoveIntent: {
      moving: true,
      forwardAxis: 1,
      rightAxis: 0,
      magnitude: 1,
      angle: 0,
      absAngle: 0,
      sideSign: 0,
      pureForward: true,
      pureBackpedal: false,
      pureStrafe: false,
      diagonal: false
    },
    lastMoveDirectionalSnapshot: {
      intent: {
        moving: true,
        forwardAxis: 1,
        rightAxis: 0,
        magnitude: 1,
        angle: 0,
        absAngle: 0,
        sideSign: 0,
        pureForward: true,
        pureBackpedal: false,
        pureStrafe: false,
        diagonal: false
      },
      profile: {
        facingYaw: 0,
        retreatLean: 0,
        fromLabel: 'forward',
        toLabel: 'forward',
        blend: 0,
        label: 'forward'
      },
      startRemaining: 0,
      facingYaw: 0,
      bodyLowerAimYaw: 0,
      bodyUpperAimYaw: 0,
      headAimYaw: 0,
      poseName: 'forward'
    },
    recentForwardStopRemaining: 0,
    recentForwardStopWeight: 0,
    stopSettleRemaining: 0,
    stopSettleDuration: 0.18,
    stopDirectionalSnapshot: null,
    lastGroundedSpeed: 0.55,
    lockName: '',
    lockRemaining: 0,
    jumpTriggered: false,
    directional: {
      useTurnEntryClip: false,
      useTurnLoopClip: false,
      turnClipDirection: 0
    },
    turnEntryDirection: 0
  }, {});

  assert.equal(fastForwardStop, 'stop');
  assert.equal(backwardStop, 'idle');
  assert.equal(slowForwardStop, 'idle');
});

test('boxman still triggers stop shortly after a fast forward run even if speed dipped before release', () => {
  const motionState = {
    wasGrounded: true,
    wasMoving: true,
    lastMoveForward: true,
    lastMoveBackward: false,
    lastMoveLeft: false,
    lastMoveRight: false,
    lastMoveIntent: {
      moving: true,
      forwardAxis: 1,
      rightAxis: 0,
      magnitude: 1,
      angle: 0,
      absAngle: 0,
      sideSign: 0,
      pureForward: true,
      pureBackpedal: false,
      pureStrafe: false,
      diagonal: false
    },
    lastMoveDirectionalSnapshot: {
      intent: {
        moving: true,
        forwardAxis: 1,
        rightAxis: 0,
        magnitude: 1,
        angle: 0,
        absAngle: 0,
        sideSign: 0,
        pureForward: true,
        pureBackpedal: false,
        pureStrafe: false,
        diagonal: false
      },
      profile: {
        facingYaw: 0,
        retreatLean: 0,
        fromLabel: 'forward',
        toLabel: 'forward',
        blend: 0,
        label: 'forward'
      },
      startRemaining: 0,
      facingYaw: 0,
      bodyLowerAimYaw: 0,
      bodyUpperAimYaw: 0,
      headAimYaw: 0,
      poseName: 'forward'
    },
    recentForwardStopRemaining: 0.08,
    recentForwardStopWeight: 1,
    stopSettleRemaining: 0,
    stopSettleDuration: 0.18,
    stopDirectionalSnapshot: null,
    lastGroundedSpeed: 0.55,
    lockName: '',
    lockRemaining: 0,
    jumpTriggered: false,
    directional: {
      useTurnEntryClip: false,
      useTurnLoopClip: false,
      turnClipDirection: 0
    },
    turnEntryDirection: 0
  };

  const clip = boxmanRig._test.selectClip({
    movingForward: false,
    movingBackward: false,
    movingLeft: false,
    movingRight: false,
    airborne: false
  }, motionState, {
    stop: { getClip() { return { duration: 0.18 }; } }
  });

  assert.equal(clip, 'stop');
  assert.ok(motionState.lockRemaining > 0);
  assert.ok(motionState.stopSettleRemaining > 0);
});

test('boxman gives pure strafe stops a short directional settle instead of snapping cold to idle', () => {
  const motionState = {
    wasGrounded: true,
    wasMoving: true,
    lastMoveForward: false,
    lastMoveBackward: false,
    lastMoveLeft: true,
    lastMoveRight: false,
    lastMoveIntent: {
      moving: true,
      forwardAxis: 0,
      rightAxis: -1,
      magnitude: 1,
      angle: -Math.PI * 0.5,
      absAngle: Math.PI * 0.5,
      sideSign: -1,
      pureForward: false,
      pureBackpedal: false,
      pureStrafe: true,
      diagonal: false
    },
    lastMoveDirectionalSnapshot: {
      intent: {
        moving: true,
        forwardAxis: 0,
        rightAxis: -1,
        magnitude: 1,
        angle: -Math.PI * 0.5,
        absAngle: Math.PI * 0.5,
        sideSign: -1,
        pureForward: false,
        pureBackpedal: false,
        pureStrafe: true,
        diagonal: false
      },
      profile: {
        facingYaw: Math.PI * 0.5,
        retreatLean: 0,
        fromLabel: 'strafe',
        toLabel: 'strafe',
        blend: 0,
        label: 'strafe'
      },
      startRemaining: 0,
      facingYaw: Math.PI * 0.5,
      bodyLowerAimYaw: -0.2,
      bodyUpperAimYaw: -0.25,
      headAimYaw: -0.35,
      poseName: 'strafe_left'
    },
    recentForwardStopRemaining: 0,
    recentForwardStopWeight: 0,
    stopSettleRemaining: 0,
    stopSettleDuration: 0.18,
    stopDirectionalSnapshot: null,
    lastGroundedSpeed: 0.95,
    lockName: '',
    lockRemaining: 0,
    jumpTriggered: false,
    directional: {
      useTurnEntryClip: false,
      useTurnLoopClip: false,
      turnClipDirection: 0
    },
    turnEntryDirection: 0
  };

  const clip = boxmanRig._test.selectClip({
    movingForward: false,
    movingBackward: false,
    movingLeft: false,
    movingRight: false,
    airborne: false
  }, motionState, {});

  assert.equal(clip, 'idle');
  assert.ok(motionState.stopSettleRemaining > 0);
  assert.ok(motionState.stopSettleDuration < 0.12);
  assert.equal(motionState.stopDirectionalSnapshot.poseName, 'strafe_left');
});

test('boxman lets forward input cut the stop immediately', () => {
  const motionState = {
    wasGrounded: true,
    wasMoving: false,
    lockName: 'stop',
    lockRemaining: 0.18,
    stopLockDuration: 0.18,
    stopSettleRemaining: 0.18,
    directional: {
      intent: {
        moving: true,
        forwardAxis: 1,
        rightAxis: 0,
        magnitude: 1,
        angle: 0,
        absAngle: 0,
        sideSign: 0,
        pureForward: true,
        pureBackpedal: false,
        pureStrafe: false,
        diagonal: false
      }
    }
  };

  const clip = boxmanRig._test.selectClip({
    movingForward: true,
    airborne: false,
    speedNorm: 0.8
  }, motionState, {});

  assert.equal(clip, 'start_forward');
  assert.equal(motionState.lockName, 'start_forward');
  assert.ok(motionState.lockRemaining > 0);
});

test('boxman holds the stop against backward input until the stop finishes', () => {
  const motionState = {
    wasGrounded: true,
    wasMoving: false,
    lockName: 'stop',
    lockRemaining: 0.18,
    stopLockDuration: 0.18,
    stopSettleRemaining: 0.18,
    directional: {
      intent: {
        moving: true,
        forwardAxis: -1,
        rightAxis: 0,
        magnitude: 1,
        angle: Math.PI,
        absAngle: Math.PI,
        sideSign: 1,
        pureForward: false,
        pureBackpedal: true,
        pureStrafe: false,
        diagonal: false
      }
    }
  };

  const clip = boxmanRig._test.selectClip({
    movingBackward: true,
    airborne: false,
    speedNorm: 0.8
  }, motionState, {});

  assert.equal(clip, 'stop');
  assert.equal(motionState.lockName, 'stop');
  assert.ok(motionState.lockRemaining > 0);
});

test('boxman holds the stop against pure strafe until enough of the stop has played', () => {
  const earlyMotionState = {
    wasGrounded: true,
    wasMoving: false,
    lockName: 'stop',
    lockRemaining: 0.15,
    stopLockDuration: 0.18,
    stopSettleRemaining: 0.18,
    directional: {
      intent: {
        moving: true,
        forwardAxis: 0,
        rightAxis: -1,
        magnitude: 1,
        angle: -Math.PI * 0.5,
        absAngle: Math.PI * 0.5,
        sideSign: -1,
        pureForward: false,
        pureBackpedal: false,
        pureStrafe: true,
        diagonal: false
      }
    }
  };
  const lateMotionState = {
    wasGrounded: true,
    wasMoving: false,
    lockName: 'stop',
    lockRemaining: 0.08,
    stopLockDuration: 0.18,
    stopSettleRemaining: 0.18,
    directional: {
      intent: {
        moving: true,
        forwardAxis: 0,
        rightAxis: -1,
        magnitude: 1,
        angle: -Math.PI * 0.5,
        absAngle: Math.PI * 0.5,
        sideSign: -1,
        pureForward: false,
        pureBackpedal: false,
        pureStrafe: true,
        diagonal: false
      }
    }
  };

  const earlyClip = boxmanRig._test.selectClip({
    movingLeft: true,
    airborne: false,
    speedNorm: 0.8
  }, earlyMotionState, {});
  const lateClip = boxmanRig._test.selectClip({
    movingLeft: true,
    airborne: false,
    speedNorm: 0.8
  }, lateMotionState, {});

  assert.equal(earlyClip, 'stop');
  assert.equal(lateClip, 'run');
  assert.equal(lateMotionState.lockName, '');
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

test('boxman shared locked aim base pose matches the run arm baseline before swing', () => {
  const rig = {
    armUpperR: { rotation: { x: 9, y: 8, z: 7 } },
    armLowerR: { rotation: { x: 6, y: 5, z: 4 } }
  };

  const applied = boxmanRig._test.applyLockedRightArmAimBasePose(rig);

  assert.equal(applied, true);
  assert.ok(Math.abs(rig.armUpperR.rotation.x - ((21.02 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -1.9))) < 0.000001);
  assert.ok(Math.abs(rig.armUpperR.rotation.y - (-7.92 * (Math.PI / 180))) < 0.000001);
  assert.ok(Math.abs(rig.armUpperR.rotation.z - (11.86 * (Math.PI / 180))) < 0.000001);
  assert.ok(Math.abs(rig.armLowerR.rotation.x - ((-33.6 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -0.65))) < 0.000001);
  assert.equal(rig.armLowerR.rotation.y, 0);
  assert.equal(rig.armLowerR.rotation.z, 0);
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
  assert.ok(Math.abs(rig.armUpperR.rotation.x - (((21.02 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -1.9)) + (6 * (Math.PI / 180)))) < 0.000001);
  assert.ok(Math.abs(rig.armUpperR.rotation.y - (-7.92 * (Math.PI / 180))) < 0.000001);
  assert.ok(Math.abs(rig.armUpperR.rotation.z - (11.86 * (Math.PI / 180))) < 0.000001);
  assert.ok(Math.abs(rig.armLowerR.rotation.x - (((-33.6 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -0.65)) + (Math.sin((Math.PI * 0.5) + 0.35) * (2.4 * (Math.PI / 180))))) < 0.000001);
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
  assert.ok(Math.abs(rig.armUpperR.rotation.x - ((21.02 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -1.9))) < 0.000001);
  assert.ok(Math.abs(rig.armLowerR.rotation.x - ((-33.6 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -0.65))) < 0.000001);
});

test('boxman locks the right arm to the aimed base pose for turn, jump, fall, and landing clips', () => {
  const clipNames = ['rotate_left', 'rotate_right', 'start_left', 'start_right', 'jump_idle', 'jump_running', 'falling', 'drop_idle', 'drop_running'];
  for (const clipName of clipNames) {
    assert.equal(boxmanRig._test.clipUsesLockedRightArmAimBasePose(clipName), true);
    const rig = {
      armUpperR: { rotation: { x: 9, y: 8, z: 7 } },
      armLowerR: { rotation: { x: 6, y: 5, z: 4 } },
      fireRecoilState: {
        shoulderPitch: -0.1,
        lowerArmPitch: -0.2,
        weaponKick: -0.05
      }
    };

    const applied = boxmanRig._test.applyLockedRightArmAimBasePose(rig);

    assert.equal(applied, true);
    assert.ok(Math.abs(rig.armUpperR.rotation.x - ((21.02 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -1.9))) < 0.000001);
    assert.ok(Math.abs(rig.armLowerR.rotation.x - ((-33.6 * (Math.PI / 180)) + ((28 * (Math.PI / 180)) * -0.65))) < 0.000001);
  }
});

test('boxman does not use the locked airborne right-arm base pose for ground locomotion and roll clips', () => {
  assert.equal(boxmanRig._test.clipUsesLockedRightArmAimBasePose('idle'), false);
  assert.equal(boxmanRig._test.clipUsesLockedRightArmAimBasePose('run'), false);
  assert.equal(boxmanRig._test.clipUsesLockedRightArmAimBasePose('sprint'), false);
  assert.equal(boxmanRig._test.clipUsesLockedRightArmAimBasePose('drop_running_roll'), false);
});

test('boxman blends the right arm toward the aimed run base during stop settle instead of popping up to idle', () => {
  const rig = {
    armUpperR: { rotation: { x: 0.9, y: 0.4, z: -0.2 } },
    armLowerR: { rotation: { x: 0.6, y: 0.2, z: 0.1 } }
  };

  const applied = boxmanRig._test.applyStopSettleRightArmRecoveryPose(rig, 0.5);

  assert.equal(applied, true);
  assert.ok(rig.armUpperR.rotation.x < 0.9);
  assert.ok(rig.armLowerR.rotation.x < 0.6);
  assert.ok(rig.armUpperR.rotation.y < 0.4);
  assert.ok(rig.armLowerR.rotation.y < 0.2);
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
  assert.equal(boxmanRig._test.idleAimAllowed({ airborne: true, sprinting: true }, 'jump_running'), true);
  assert.equal(boxmanRig._test.idleAimAllowed({ airborne: true, sprinting: true }, 'falling'), true);
  assert.equal(boxmanRig._test.idleAimAllowed({ airborne: false, sprinting: true }, 'drop_running'), true);
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

test('boxman locked airborne aim base still accepts the normal vertical look layer', () => {
  const rig = {
    armUpperR: { rotation: { x: 0, y: 0, z: 0 } },
    armLowerR: { rotation: { x: 0, y: 0, z: 0 } }
  };

  boxmanRig._test.applyLockedRightArmAimBasePose(rig);
  const beforeUpper = rig.armUpperR.rotation.x;
  const beforeLower = rig.armLowerR.rotation.x;
  const applied = boxmanRig._test.applyIdleAimPose(rig, {
    currentPitch: boxmanRig._test.idleAimTargetPitch({
      aimPitch: 0.5,
      airborne: true
    }, 'jump_running'),
    currentYaw: 0
  });

  assert.equal(applied, true);
  assert.ok(rig.armUpperR.rotation.x < beforeUpper);
  assert.ok(rig.armLowerR.rotation.x < beforeLower);
});

test('boxman idle aim target yaw counter-rotates against facing yaw and clamps', () => {
  const mild = boxmanRig._test.idleAimTargetYaw({ facingYaw: 10 * (Math.PI / 180) }, 'idle');
  const hard = boxmanRig._test.idleAimTargetYaw({ facingYaw: Math.PI }, 'idle');
  const runYaw = boxmanRig._test.idleAimTargetYaw({ facingYaw: Math.PI * 0.5 }, 'run');

  assert.ok(mild > 0);
  assert.ok(Math.abs(hard) <= (90 * (Math.PI / 180)));
  assert.ok(Math.abs(hard) > Math.abs(mild));
  assert.ok(Math.abs(runYaw - ((Math.PI * 0.5) * 0.88)) < 0.000001);
});

test('boxman keeps idle aim yaw tied to the visible stop-settle turn while recentering', () => {
  const liveYaw = boxmanRig._test.resolveIdleAimYawState({
    directional: { facingYaw: 0.25 },
    stopDirectionalSnapshot: { facingYaw: -0.9 }
  }, 0);
  const settleYaw = boxmanRig._test.resolveIdleAimYawState({
    directional: { facingYaw: 0.25 },
    stopDirectionalSnapshot: { facingYaw: -0.9 }
  }, 0.5);

  assert.ok(Math.abs(liveYaw.facingYaw - 0.25) < 0.000001);
  assert.ok(Math.abs(settleYaw.facingYaw - (-0.45)) < 0.000001);
  assert.ok(Math.abs(boxmanRig._test.idleAimTargetYaw(settleYaw, 'idle') - settleYaw.facingYaw) < 0.000001);
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

test('boxman keeps the weapon mount anchored off the right lower arm with the same forward baseline', () => {
  const mount = boxmanRig._test.weaponMount();

  assert.ok(mount.rootPos.x < 0);
  assert.ok(mount.rootPos.y > 0.5);
  assert.equal(mount.rootPos.z, -0.06);
  assert.ok(mount.rootRot.y > 0.2);
  assert.equal(mount.handleBack.z, 0.08);
  assert.equal(mount.receiverSize.x, 0.14);
  assert.equal(mount.receiverSize.y, 0.1);
  assert.equal(mount.receiverSize.z, 0.55);
  assert.equal(mount.barrelPos.z, -0.36);
  assert.equal(mount.barrelSize.z, 0.26);
  assert.ok(mount.muzzlePos.z < 0);
});

test('boxman can resolve the stored multi-part weapon visuals for rifle and pistol', () => {
  const rifle = boxmanRig._test.resolveWeaponVisualEntry('rifle');
  const pistol = boxmanRig._test.resolveWeaponVisualEntry('pistol');

  assert.equal(rifle.weaponId, 'rifle');
  assert.ok(rifle.platform.parts.receiver.size[2] > 0.5);
  assert.equal(pistol.weaponId, 'pistol');
  assert.ok(pistol.platform.parts.grip.size[1] > 0.15);
});

test('boxman applies procedural weapon parts using the current hand-forward mount baseline', () => {
  function createMeshStub() {
    return {
      visible: false,
      position: {
        x: 0, y: 0, z: 0,
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
      },
      scale: {
        x: 0, y: 0, z: 0,
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
      },
      material: {
        roughness: 0,
        metalness: 0,
        color: {
          hex: 0,
          setHex(value) { this.hex = value; }
        }
      }
    };
  }

  const rig = {
    weaponRoot: {},
    weaponModel: {
      position: {
        x: 0, y: 0, z: 0,
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
      },
      rotation: {
        x: 0, y: 0, z: 0,
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
      }
    },
    muzzleAnchor: {
      position: {
        x: 0, y: 0, z: 0,
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
      }
    },
    weaponBody: createMeshStub(),
    weaponGrip: createMeshStub(),
    weaponBarrel: createMeshStub(),
    weaponStock: createMeshStub(),
    weaponOpticRail: createMeshStub(),
    weaponOptic: createMeshStub(),
    weaponMuzzleDevice: createMeshStub(),
    weaponFeed: createMeshStub(),
    weaponUnderbarrel: createMeshStub(),
    weaponAccentA: createMeshStub(),
    weaponAccentB: createMeshStub()
  };

  const applied = boxmanRig._test.applyWeaponVisualState(rig, 'rifle');

  assert.equal(applied, true);
  assert.equal(rig.weaponId, 'rifle');
  assert.equal(rig.weaponBody.visible, true);
  assert.equal(rig.weaponGrip.visible, true);
  assert.equal(rig.weaponBarrel.visible, true);
  assert.equal(rig.weaponStock.visible, true);
  assert.ok(rig.weaponModel.position.y > 0);
  assert.ok(Math.abs(rig.weaponModel.position.z) < 0.000001);
  assert.ok(rig.weaponModel.rotation.x > ((Math.PI * 0.5) - (15 * (Math.PI / 180)) - 0.01));
  assert.ok(rig.weaponModel.rotation.x < ((Math.PI * 0.5) - (15 * (Math.PI / 180)) + 0.1));
  assert.ok(rig.weaponModel.rotation.y > 0);
  assert.ok(rig.weaponModel.rotation.y < 0.1);
  assert.ok(rig.weaponModel.rotation.z > (Math.PI - 0.05));
  assert.ok(rig.weaponModel.rotation.z < (Math.PI + 0.05));
  assert.ok(rig.weaponBody.scale.z > 0.5);
  assert.ok(rig.weaponBarrel.position.z < rig.weaponBody.position.z);
  assert.ok(rig.muzzleAnchor.position.z < rig.weaponBarrel.position.z);

  boxmanRig._test.applyWeaponVisualState(rig, 'sniper');
  assert.equal(rig.weaponOptic.visible, true);
  assert.ok(rig.muzzleAnchor.position.z < -1);
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
  assert.ok(rig.armLowerR.rotation.x > 0);
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
  assert.ok(rig.armLowerR.rotation.x > 0.01);
  assert.ok(recoilState.shoulderPitch > 0.03);
  assert.ok(recoilState.shoulderYaw > 0.015);
  assert.ok(recoilState.lowerArmPitch > 0.08);

  boxmanRig._test.decayFireRecoilState(recoilState, 0.2);
  assert.ok(recoilState.lowerArmPitch < 0.1);
});
