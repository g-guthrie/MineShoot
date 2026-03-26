import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadRemoteSync(remoteInterpolationTuning = null, runtimeOverrides = {}) {
  const interpCode = await fs.readFile(new URL('../../js/net/interpolation.js', import.meta.url), 'utf8');
  const code = await fs.readFile(new URL('../../js/net/remote-sync.js', import.meta.url), 'utf8');
  const baseGameplayTuning = remoteInterpolationTuning ? {
    network: {
      remoteInterpolation: remoteInterpolationTuning
    }
  } : null;
  const overrideGameplayTuning = runtimeOverrides.GameShared && runtimeOverrides.GameShared.gameplayTuning
    ? runtimeOverrides.GameShared.gameplayTuning
    : null;
  const mergedGameShared = {
    entityPoints: {},
    gameplayTuning: baseGameplayTuning && overrideGameplayTuning
      ? { ...baseGameplayTuning, ...overrideGameplayTuning }
      : (overrideGameplayTuning || baseGameplayTuning),
    getNetworkTuning() {
      return (this.gameplayTuning && this.gameplayTuning.network) || {};
    },
    getMovementTuning() {
      return (this.gameplayTuning && this.gameplayTuning.movement) || {};
    },
    ...(runtimeOverrides.GameShared || {})
  };
  var overrideNet = runtimeOverrides.GameNet || null;
  var normalizedNet = overrideNet;
  if (overrideNet && !overrideNet.timing) {
    normalizedNet = {
      ...overrideNet,
      timing: {
        getAuthoritativeNow: overrideNet.getAuthoritativeNow || (() => 0),
        toLocalTime: overrideNet.toLocalTime || ((value) => value)
      }
    };
  }
  const mergedRuntime = {
    ...runtimeOverrides,
    GameNet: normalizedNet,
    GameShared: mergedGameShared
  };
  const sandbox = {
    __MAYHEM_RUNTIME: {
      ...mergedRuntime
    },
    globalThis: null,
    console,
    Date,
    Math,
    Number,
    isFinite,
    Array
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(interpCode, ctx);
  vm.runInContext(code, ctx);
  return sandbox.__MAYHEM_RUNTIME.GameNetRemoteSync;
}

test('remote sync turns a grounded-to-airborne transition into a jump action trigger', async () => {
  const remoteSync = await loadRemoteSync();
  const calls = [];
  const render = {
    id: 'usr_remote',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: false,
    isGrounded: true,
    velocityY: 0,
    hookedUntil: 0,
    muzzleFlashUntil: 0,
    chokeState: null,
    actorVisual: null,
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation(_dt, animState) {
        calls.push({ kind: 'update', animState });
      },
      triggerAction(action, options) {
        calls.push({ kind: 'trigger', action, options });
      },
      setMuzzleVisible() {}
    }
  };
  const renderMap = new Map([['usr_remote', render]]);

  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });

  render.isGrounded = false;
  render.velocityY = 6;
  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });

  const jumpTriggers = calls.filter((entry) => entry.kind === 'trigger' && entry.action === 'jump');
  const latestUpdate = calls.filter((entry) => entry.kind === 'update').pop();

  assert.equal(jumpTriggers.length, 1);
  assert.equal(jumpTriggers[0].options.reverseLegTilt, false);
  assert.equal(latestUpdate.animState.airborne, true);
  assert.equal(latestUpdate.animState.movingForward, false);
  assert.equal(latestUpdate.animState.movingBackward, false);
});

test('remote sync forwards airborne movement intent to animation', async () => {
  const remoteSync = await loadRemoteSync();
  const calls = [];
  const render = {
    id: 'usr_remote',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0.7,
    sprinting: false,
    movingForward: false,
    movingBackward: true,
    movingLeft: true,
    movingRight: false,
    isGrounded: false,
    velocityY: 0,
    hookedUntil: 0,
    muzzleFlashUntil: 0,
    chokeState: null,
    actorVisual: null,
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation(_dt, animState) {
        calls.push(animState);
      },
      triggerAction() {},
      setMuzzleVisible() {}
    }
  };
  const renderMap = new Map([['usr_remote', render]]);

  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].movingForward, false);
  assert.equal(calls[0].movingBackward, true);
  assert.equal(calls[0].movingLeft, true);
  assert.equal(calls[0].movingRight, false);
});

test('remote sync forwards fastBackpedal into animation updates', async () => {
  const remoteSync = await loadRemoteSync();
  const calls = [];
  const render = {
    id: 'usr_remote_backpedal',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0.8,
    sprinting: false,
    fastBackpedal: true,
    movingForward: false,
    movingBackward: true,
    movingLeft: false,
    movingRight: false,
    isGrounded: true,
    velocityY: 0,
    hookedUntil: 0,
    muzzleFlashUntil: 0,
    chokeState: null,
    actorVisual: null,
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation(_dt, animState) {
        calls.push(animState);
      },
      triggerAction() {},
      setMuzzleVisible() {}
    }
  };
  const renderMap = new Map([['usr_remote_backpedal', render]]);

  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sprinting, false);
  assert.equal(calls[0].fastBackpedal, true);
  assert.equal(calls[0].movingBackward, true);
});

test('remote sync uses weapon-adjusted run speed for horizontal animation speed', async () => {
  const remoteSync = await loadRemoteSync(null, {
    GameShared: {
      gameplayTuning: {
        movement: {
          runSpeed: 11
        },
        weaponStats: {
          sniper: {
            moveSpeedMultiplier: 0.85
          }
        }
      }
    }
  });
  const calls = [];
  const render = {
    id: 'usr_remote_speed',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 1,
    sprinting: false,
    movingForward: true,
    movingBackward: false,
    movingLeft: false,
    movingRight: false,
    isGrounded: true,
    velocityY: 0,
    hookedUntil: 0,
    muzzleFlashUntil: 0,
    chokeState: null,
    weaponId: 'sniper',
    actorVisual: null,
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation(_dt, animState) {
        calls.push(animState);
      },
      triggerAction() {},
      setMuzzleVisible() {}
    }
  };
  const renderMap = new Map([['usr_remote_speed', render]]);

  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });

  assert.equal(calls.length, 1);
  assert.ok(Math.abs(calls[0].horizontalSpeed - 9.35) < 0.000001);
  assert.equal(calls[0].worldSpeed, calls[0].horizontalSpeed);
});

test('remote sync applies authoritative rolling state to remote hitboxes', async () => {
  const remoteSync = await loadRemoteSync(null, {
    GameNet: {
      getAuthoritativeNow() {
        return 1000;
      }
    }
  });
  const hitboxStates = [];
  const transformStates = [];
  const render = {
    id: 'usr_remote_roll',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0.2,
    sprinting: false,
    movingForward: true,
    movingBackward: false,
    movingLeft: false,
    movingRight: false,
    isGrounded: true,
    velocityY: 0,
    hookedUntil: 0,
    muzzleFlashUntil: 0,
    chokeState: null,
    rollStartedAt: 900,
    rollUntil: 1300,
    rollInputState: {
      movingForward: true,
      movingBackward: false,
      movingLeft: false,
      movingRight: false
    },
    actorVisual: {
      setWorldTransform(_position, _yaw, hitboxState) {
        transformStates.push(hitboxState);
      },
      syncHitboxes(_position, hitboxState) {
        hitboxStates.push(hitboxState);
      },
      updateAnimation() {},
      triggerAction() {},
      setMuzzleVisible() {},
      setWeapon() {}
    },
    bodyHitbox: null,
    headHitbox: null,
    rigApi: null
  };
  const renderMap = new Map([['usr_remote_roll', render]]);

  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });

  assert.equal(transformStates.pop().rolling, true);
  assert.equal(hitboxStates.pop().rolling, true);
});

test('remote sync forwards yaw and derived turn rate into remote animation updates', async () => {
  const remoteSync = await loadRemoteSync();
  const calls = [];
  const render = {
    id: 'usr_remote_turn',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: false,
    movingLeft: false,
    movingRight: false,
    isGrounded: true,
    velocityY: 0,
    hookedUntil: 0,
    muzzleFlashUntil: 0,
    chokeState: null,
    actorVisual: null,
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation(_dt, animState) {
        calls.push(animState);
      },
      triggerAction() {},
      setMuzzleVisible() {}
    }
  };
  const renderMap = new Map([['usr_remote_turn', render]]);

  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });
  render.targetYaw = Math.PI * 0.25;
  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });

  assert.equal(calls[1].yaw, Math.PI * 0.25);
  assert.ok(calls[1].turnRate > 40);
});

test('remote sync triggers replicated fire animation when muzzle flash starts', async () => {
  const remoteSync = await loadRemoteSync(null, {
    GameNet: {
      getAuthoritativeNow() {
        return 900;
      }
    }
  });
  const calls = [];
  const render = {
    id: 'usr_remote',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: false,
    isGrounded: true,
    velocityY: 0,
    hookedUntil: 0,
    muzzleFlashUntil: 1000,
    chokeState: null,
    actorVisual: {
      setMuzzleVisible(visible) {
        calls.push({ kind: 'muzzle', visible });
      },
      updateAnimation() {},
      triggerAction(action, options) {
        calls.push({ kind: 'trigger', action, options });
      }
    },
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation() {},
      triggerAction() {}
    }
  };
  const renderMap = new Map([['usr_remote', render]]);

  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].kind, 'muzzle');
  assert.equal(calls[0].visible, true);
  assert.equal(calls[1].kind, 'trigger');
  assert.equal(calls[1].action, 'fire');
  assert.equal(calls[1].options.duration, 0.09);
  assert.equal(calls[1].options.strength, 1);
});

test('remote sync uses buffered movement state for animation, not just the latest snapshot flags', async () => {
  const remoteSync = await loadRemoteSync();
  let latestAnimState = null;
  const render = {
    id: 'usr_remote',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    snapshotHistory: [
      {
        serverTime: 800,
        receivedAt: 1000,
        x: 0,
        footY: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        moveSpeedNorm: 0.25,
        sprinting: false,
        movingForward: true,
        movingBackward: false,
        isGrounded: true,
        velocityY: 0,
        muzzleFlashUntil: 0
      },
      {
        serverTime: 900,
        receivedAt: 1010,
        x: 1,
        footY: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        moveSpeedNorm: 0.5,
        sprinting: true,
        movingForward: true,
        movingBackward: false,
        isGrounded: true,
        velocityY: 0,
        muzzleFlashUntil: 0
      }
    ],
    serverTimeOffsetMs: 100,
    snapshotIntervalMs: 100,
    snapshotJitterMs: 0,
    interpolationDelayMs: 180,
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 1,
    sprinting: false,
    movingForward: false,
    movingBackward: true,
    isGrounded: false,
    velocityY: 3,
    hookedUntil: 0,
    muzzleFlashUntil: 0,
    chokeState: null,
    actorVisual: null,
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation(_dt, animState) {
        latestAnimState = animState;
      },
      triggerAction() {},
      setMuzzleVisible() {}
    }
  };
  const renderMap = new Map([['usr_remote', render]]);
  const originalDateNow = Date.now;
  Date.now = () => 1000;
  try {
    remoteSync.updateRemoteEntities(0.016, renderMap, function () {
      return { lift: 0, startedAt: 0 };
    });
  } finally {
    Date.now = originalDateNow;
  }

  assert.equal(latestAnimState.sprinting, false);
  assert.equal(latestAnimState.movingBackward, false);
  assert.ok(latestAnimState.speedNorm < 0.4);
});

test('remote sync smooths animation-facing sprint and movement changes over a short transition', async () => {
  const remoteSync = await loadRemoteSync({
    animationStateBlendMs: 120
  });
  let latestAnimState = null;
  const render = {
    id: 'usr_remote_anim_blend',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    snapshotHistory: [
      {
        serverTime: 1000,
        receivedAt: 1000,
        x: 0,
        footY: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        moveSpeedNorm: 1,
        sprinting: true,
        movingForward: true,
        movingBackward: false,
        isGrounded: true,
        velocityY: 0,
        muzzleFlashUntil: 0
      }
    ],
    serverTimeOffsetMs: 0,
    snapshotIntervalMs: 50,
    snapshotJitterMs: 0,
    interpolationDelayMs: 1,
    _presentedSpeedNorm: 0,
    _presentedSprintBlend: 0,
    _presentedMovingForwardBlend: 0,
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: false,
    isGrounded: true,
    velocityY: 0,
    hookedUntil: 0,
    muzzleFlashUntil: 0,
    chokeState: null,
    actorVisual: null,
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation(_dt, animState) {
        latestAnimState = animState;
      },
      triggerAction() {},
      setMuzzleVisible() {}
    }
  };
  const renderMap = new Map([['usr_remote_anim_blend', render]]);
  const originalDateNow = Date.now;
  Date.now = () => 1000;
  try {
    remoteSync.updateRemoteEntities(0.016, renderMap, function () {
      return { lift: 0, startedAt: 0 };
    });
  } finally {
    Date.now = originalDateNow;
  }

  assert.equal(latestAnimState.sprinting, false);
  assert.equal(latestAnimState.movingForward, false);
  assert.equal(latestAnimState.speedNorm > 0 && latestAnimState.speedNorm < 1, true);
});

test('remote sync keeps replicated reload bookkeeping out of remote animation payloads', async () => {
  const remoteSync = await loadRemoteSync(null, {
    GameShared: {
      entityPoints: {},
      gameplayTuning: {
        weaponStats: {
          rifle: { reloadMs: 1500 }
        }
      }
    },
    GameNet: {
      getAuthoritativeNow() {
        return 1000;
      }
    }
  });
  let latestAnimState = null;
  const render = {
    id: 'usr_remote',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: false,
    isGrounded: true,
    velocityY: 0,
    hookedUntil: 0,
    muzzleFlashUntil: 0,
    chokeState: null,
    weaponId: 'rifle',
    weaponAmmo: {
      rifle: {
        ammoInMag: 0,
        reloading: true,
        reloadRemainingMs: 1000,
        reloadedFlashRemainingMs: 0
      }
    },
    weaponAmmoServerTimeMs: 900,
    actorVisual: null,
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation(_dt, animState) {
        latestAnimState = animState;
      },
      triggerAction() {},
      setMuzzleVisible() {}
    }
  };
  const renderMap = new Map([['usr_remote', render]]);

  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });

  assert.equal(!!latestAnimState, true);
  assert.equal(Object.prototype.hasOwnProperty.call(latestAnimState, 'reloading'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(latestAnimState, 'reloadPct'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(latestAnimState, 'reloadPhase'), false);
});

test('remote sync flips jump leg tilt when backward input starts the jump', async () => {
  const remoteSync = await loadRemoteSync();
  const calls = [];
  const render = {
    id: 'usr_remote',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: true,
    isGrounded: true,
    velocityY: 0,
    hookedUntil: 0,
    muzzleFlashUntil: 0,
    chokeState: null,
    actorVisual: null,
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation() {},
      triggerAction(action, options) {
        calls.push({ action, options });
      },
      setMuzzleVisible() {}
    }
  };
  const renderMap = new Map([['usr_remote', render]]);

  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });

  render.isGrounded = false;
  render.velocityY = 6;
  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 0, startedAt: 0 };
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'jump');
  assert.equal(calls[0].options.reverseLegTilt, true);
});

test('remote sync does not force the reveal ghost on for choked victims', async () => {
  const remoteSync = await loadRemoteSync();
  const revealCalls = [];
  const render = {
    id: 'usr_remote',
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: false,
    isGrounded: true,
    velocityY: 0,
    hookedUntil: 0,
    muzzleFlashUntil: 0,
    chokeState: null,
    deadeyeMark: { locked: true, progress: 1 },
    actorVisual: {
      updateAnimation() {},
      setMuzzleVisible() {},
      setRevealGhostState(visible, opacity, colorHex) {
        revealCalls.push({ visible, opacity, colorHex });
      }
    },
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation() {},
      triggerAction() {},
      setMuzzleVisible() {}
    }
  };
  const renderMap = new Map([['usr_remote', render]]);

  remoteSync.updateRemoteEntities(0.016, renderMap, function () {
    return { lift: 1.2, startedAt: 1000 };
  });

  assert.equal(revealCalls.length > 0, true);
  assert.equal(revealCalls.at(-1).visible, false);
});

test('remote sync uses authoritative network time for remote ability timers', async () => {
  const originalDateNow = Date.now;
  Date.now = () => 1200;
  try {
    const remoteSync = await loadRemoteSync(null, {
      GameNet: {
        getAuthoritativeNow() {
          return 900;
        }
      }
    });
    const calls = [];
    const render = {
      id: 'usr_remote',
      group: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 }
      },
      targetX: 0,
      targetFootY: 0,
      targetZ: 0,
      targetYaw: 0,
      targetPitch: 0,
      moveSpeedNorm: 0,
      sprinting: false,
      movingForward: false,
      movingBackward: false,
      isGrounded: true,
      velocityY: 0,
      hookedUntil: 1000,
      muzzleFlashUntil: 1000,
      chokeState: { endsAt: 1000 },
      spawnShieldUntil: 1000,
      actorVisual: {
        updateAnimation(_dt, animState) {
          calls.push({ kind: 'update', animState });
        },
        setMuzzleVisible(visible) {
          calls.push({ kind: 'muzzle', visible });
        },
        setSpawnShield(visible) {
          calls.push({ kind: 'shield', visible });
        },
        setRevealGhostState() {}
      },
      bodyHitbox: null,
      headHitbox: null,
      rigApi: {
        setWeapon() {},
        updateAnimation() {},
        triggerAction(action, options) {
          calls.push({ kind: 'trigger', action, options });
        },
        setMuzzleVisible() {}
      }
    };
    const renderMap = new Map([['usr_remote', render]]);

    remoteSync.updateRemoteEntities(0.016, renderMap, function () {
      return { lift: 0, startedAt: 0 };
    });

    assert.equal(calls.some((entry) => entry.kind === 'update' && Object.prototype.hasOwnProperty.call(entry.animState, 'hooked')), false);
    assert.equal(calls.some((entry) => entry.kind === 'muzzle' && entry.visible === true), true);
    assert.equal(calls.some((entry) => entry.kind === 'shield' && entry.visible === true), true);
    assert.equal(calls.some((entry) => entry.kind === 'trigger' && entry.action === 'choke_grip'), true);
  } finally {
    Date.now = originalDateNow;
  }
});

test('remote sync still shows a short muzzle flash when presentation delay would otherwise miss it', async () => {
  const originalDateNow = Date.now;
  Date.now = () => 1200;
  try {
    const remoteSync = await loadRemoteSync({
      muzzleFlashPresentationMs: 70
    }, {
      GameNet: {
        getAuthoritativeNow() {
          return 1200;
        }
      }
    });
    const calls = [];
    const render = {
      id: 'usr_remote_flash_delay',
      group: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 }
      },
      snapshotHistory: [
        {
          serverTime: 1200,
          receivedAt: 1200,
          x: 0,
          footY: 0,
          z: 0,
          yaw: 0,
          pitch: 0,
          moveSpeedNorm: 0,
          sprinting: false,
          movingForward: false,
          movingBackward: false,
          isGrounded: true,
          velocityY: 0,
          muzzleFlashUntil: 1000
        }
      ],
      interpolationDelayMs: 180,
      serverTimeOffsetMs: 0,
      snapshotIntervalMs: 50,
      snapshotJitterMs: 0,
      moveSpeedNorm: 0,
      sprinting: false,
      movingForward: false,
      movingBackward: false,
      isGrounded: true,
      velocityY: 0,
      hookedUntil: 0,
      muzzleFlashUntil: 1000,
      chokeState: null,
      actorVisual: {
        setMuzzleVisible(visible) {
          calls.push({ kind: 'muzzle', visible });
        },
        updateAnimation() {},
        triggerAction(action) {
          calls.push({ kind: 'trigger', action });
        }
      },
      bodyHitbox: null,
      headHitbox: null,
      rigApi: {
        setWeapon() {},
        updateAnimation() {},
        triggerAction() {}
      }
    };
    const renderMap = new Map([['usr_remote_flash_delay', render]]);

    remoteSync.updateRemoteEntities(0.016, renderMap, function () {
      return { lift: 0, startedAt: 0 };
    });

    assert.equal(calls.some((entry) => entry.kind === 'muzzle' && entry.visible === true), true);
    assert.equal(calls.some((entry) => entry.kind === 'trigger' && entry.action === 'fire'), true);
  } finally {
    Date.now = originalDateNow;
  }
});

test('remote sync can lead remote combat hitboxes slightly ahead of the rendered model', async () => {
  const remoteSync = await loadRemoteSync({
    hitboxLeadMs: 24
  });
  const hitboxPositions = [];
  const originalDateNow = Date.now;
  Date.now = () => 1000;
  try {
    const render = {
      id: 'usr_remote',
      group: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 }
      },
      targetX: 20,
      targetFootY: 0,
      targetZ: 0,
      targetYaw: 0.8,
      targetPitch: 0.2,
      snapshotHistory: [
        { serverTime: 800, receivedAt: 800, x: 0, footY: 0, z: 0, yaw: 0, pitch: 0 },
        { serverTime: 900, receivedAt: 900, x: 10, footY: 1, z: -2, yaw: 0.4, pitch: 0.1 },
        { serverTime: 1000, receivedAt: 1000, x: 20, footY: 2, z: -4, yaw: 0.8, pitch: 0.2 }
      ],
      snapshotIntervalMs: 50,
      interpolationDelayMs: 90,
      serverTimeOffsetMs: 0,
      moveSpeedNorm: 0,
      sprinting: false,
      movingForward: false,
      movingBackward: false,
      isGrounded: true,
      velocityY: 0,
      hookedUntil: 0,
      muzzleFlashUntil: 0,
      chokeState: null,
      actorVisual: {
        syncHitboxes(pos) {
          hitboxPositions.push({ ...pos });
        }
      },
      rigApi: null
    };
    const renderMap = new Map([['usr_remote', render]]);

    remoteSync.updateRemoteEntities(0.016, renderMap, function () {
      return { lift: 0, startedAt: 0 };
    });

    assert.equal(hitboxPositions.length, 1);
    assert.equal(render.group.position.x > 10 && render.group.position.x < 12, true);
    assert.equal(hitboxPositions[0].x > render.group.position.x, true);
    assert.equal(hitboxPositions[0].x < 15, true);
  } finally {
    Date.now = originalDateNow;
  }
});

test('remote sync renders from buffered snapshot history instead of chasing the newest target', async () => {
  const remoteSync = await loadRemoteSync();
  const originalDateNow = Date.now;
  Date.now = () => 1000;
  try {
    const render = {
      id: 'usr_remote',
      group: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 }
      },
      targetX: 20,
      targetFootY: 0,
      targetZ: 0,
      targetYaw: 1.4,
      targetPitch: 0.2,
      snapshotHistory: [
        { serverTime: 800, receivedAt: 800, x: 0, footY: 0, z: 0, yaw: 0, pitch: 0 },
        { serverTime: 900, receivedAt: 900, x: 10, footY: 1, z: -2, yaw: 0.4, pitch: 0.1 },
        { serverTime: 1000, receivedAt: 1000, x: 20, footY: 2, z: -4, yaw: 0.8, pitch: 0.2 }
      ],
      snapshotIntervalMs: 50,
      interpolationDelayMs: 90,
      serverTimeOffsetMs: 0,
      moveSpeedNorm: 0,
      sprinting: false,
      movingForward: false,
      movingBackward: false,
      isGrounded: true,
      velocityY: 0,
      hookedUntil: 0,
      muzzleFlashUntil: 0,
      chokeState: null,
      actorVisual: null,
      bodyHitbox: null,
      headHitbox: null,
      rigApi: {
        setWeapon() {},
        updateAnimation() {},
        triggerAction() {},
        setMuzzleVisible() {}
      }
    };
    const renderMap = new Map([['usr_remote', render]]);

    remoteSync.updateRemoteEntities(0.016, renderMap, function () {
      return { lift: 0, startedAt: 0 };
    });

    // With interpolationDelayMs=90, renderServerTime = 1000 - 0 - 90 = 910
    // t = (910-900)/(1000-900) = 0.1, so x = 10 + 10*0.1 = 11
    assert.equal(Number(render.group.position.x.toFixed(2)), 11);
    assert.equal(Number(render.group.position.y.toFixed(2)), 1.1);
    assert.equal(Number(render.group.position.z.toFixed(2)), -2.2);
    assert.equal(Number(render.group.rotation.y.toFixed(2)), 0.44);
  } finally {
    Date.now = originalDateNow;
  }
});

test('remote sync holds the latest buffered pose instead of over-extrapolating stale snapshots', async () => {
  const remoteSync = await loadRemoteSync();
  const originalDateNow = Date.now;
  Date.now = () => 1100;
  try {
    const render = {
      id: 'usr_remote',
      group: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 }
      },
      snapshotHistory: [
        { serverTime: 900, receivedAt: 900, x: 10, footY: 1, z: -2, yaw: 0.4, pitch: 0.1 },
        { serverTime: 1000, receivedAt: 1000, x: 20, footY: 2, z: -4, yaw: 0.8, pitch: 0.2 }
      ],
      snapshotIntervalMs: 50,
      interpolationDelayMs: 90,
      serverTimeOffsetMs: 0,
      moveSpeedNorm: 0,
      sprinting: false,
      movingForward: false,
      movingBackward: false,
      isGrounded: true,
      velocityY: 0,
      hookedUntil: 0,
      muzzleFlashUntil: 0,
      chokeState: null,
      actorVisual: null,
      bodyHitbox: null,
      headHitbox: null,
      rigApi: {
        setWeapon() {},
        updateAnimation() {},
        triggerAction() {},
        setMuzzleVisible() {}
      }
    };
    const renderMap = new Map([['usr_remote', render]]);

    remoteSync.updateRemoteEntities(0.016, renderMap, function () {
      return { lift: 0, startedAt: 0 };
    });

    assert.equal(Number(render.group.position.x.toFixed(2)), 20);
    assert.equal(Number(render.group.position.y.toFixed(2)), 2);
    assert.equal(Number(render.group.position.z.toFixed(2)), -4);
    assert.equal(Number(render.group.rotation.y.toFixed(2)), 0.8);
  } finally {
    Date.now = originalDateNow;
  }
});

test('remote sync fallback catch-up is effectively frame-rate independent', async () => {
  const remoteSync = await loadRemoteSync({
    fallbackCatchupRemainingPerSecond: 0.001
  });
  function makeRender() {
    return {
      id: 'usr_fallback',
      group: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 }
      },
      targetX: 12,
      targetFootY: 3,
      targetZ: -6,
      targetYaw: 1.2,
      targetPitch: 0.2,
      moveSpeedNorm: 0,
      sprinting: false,
      movingForward: false,
      movingBackward: false,
      isGrounded: true,
      velocityY: 0,
      hookedUntil: 0,
      muzzleFlashUntil: 0,
      chokeState: null,
      actorVisual: null,
      bodyHitbox: null,
      headHitbox: null,
      rigApi: {
        setWeapon() {},
        updateAnimation() {},
        triggerAction() {},
        setMuzzleVisible() {}
      }
    };
  }

  const render60 = makeRender();
  const render144 = makeRender();
  const map60 = new Map([['usr_fallback_60', render60]]);
  const map144 = new Map([['usr_fallback_144', render144]]);

  for (let i = 0; i < 60; i++) {
    remoteSync.updateRemoteEntities(1 / 60, map60, function () {
      return { lift: 0, startedAt: 0 };
    });
  }
  for (let i = 0; i < 144; i++) {
    remoteSync.updateRemoteEntities(1 / 144, map144, function () {
      return { lift: 0, startedAt: 0 };
    });
  }

  assert.ok(Math.abs(render60.group.position.x - render144.group.position.x) < 0.05);
  assert.ok(Math.abs(render60.group.position.y - render144.group.position.y) < 0.05);
  assert.ok(Math.abs(render60.group.position.z - render144.group.position.z) < 0.05);
  assert.ok(Math.abs(render60.group.rotation.y - render144.group.rotation.y) < 0.01);
});

test('remote sync holds the last presented pose instead of snapping to the newest stale snapshot', async () => {
  const remoteSync = await loadRemoteSync();
  const originalDateNow = Date.now;
  Date.now = () => 1200;
  try {
    const render = {
      id: 'usr_stale_hold',
      group: {
        position: { x: 18, y: 1.8, z: -3.6 },
        rotation: { y: 0.72 }
      },
      snapshotHistory: [
        { serverTime: 900, receivedAt: 900, x: 10, footY: 1, z: -2, yaw: 0.4, pitch: 0.1 },
        { serverTime: 1000, receivedAt: 1000, x: 20, footY: 2, z: -4, yaw: 0.8, pitch: 0.2 }
      ],
      snapshotIntervalMs: 50,
      interpolationDelayMs: 90,
      freezeGapMs: 80,
      serverTimeOffsetMs: 0,
      lastPresentedTransform: {
        x: 18,
        footY: 1.8,
        z: -3.6,
        yaw: 0.72,
        pitch: 0.18,
        moveSpeedNorm: 0.4,
        sprinting: false,
        movingForward: true,
        movingBackward: false,
        isGrounded: true,
        velocityY: 0,
        muzzleFlashUntil: 0
      },
      moveSpeedNorm: 0,
      sprinting: false,
      movingForward: false,
      movingBackward: false,
      isGrounded: true,
      velocityY: 0,
      hookedUntil: 0,
      muzzleFlashUntil: 0,
      chokeState: null,
      actorVisual: null,
      bodyHitbox: null,
      headHitbox: null,
      rigApi: {
        setWeapon() {},
        updateAnimation() {},
        triggerAction() {},
        setMuzzleVisible() {}
      }
    };
    const renderMap = new Map([['usr_stale_hold', render]]);

    remoteSync.updateRemoteEntities(0.016, renderMap, function () {
      return { lift: 0, startedAt: 0 };
    });

    assert.equal(Number(render.group.position.x.toFixed(2)), 18);
    assert.equal(Number(render.group.position.y.toFixed(2)), 1.8);
    assert.equal(Number(render.group.position.z.toFixed(2)), -3.6);
    assert.equal(Number(render.group.rotation.y.toFixed(2)), 0.72);
  } finally {
    Date.now = originalDateNow;
  }
});

test('remote sync blends back in after a stale-gap freeze instead of hard popping', async () => {
  const remoteSync = await loadRemoteSync({
    freezeRecoveryBlendMs: 40
  });
  const originalDateNow = Date.now;
  try {
    const render = {
      id: 'usr_freeze_recovery',
      group: {
        position: { x: 18, y: 1.8, z: -3.6 },
        rotation: { y: 0.72 }
      },
      snapshotHistory: [
        { serverTime: 1000, receivedAt: 1000, x: 10, footY: 1, z: -2, yaw: 0.4, pitch: 0.1 },
        { serverTime: 1100, receivedAt: 1100, x: 30, footY: 3, z: -6, yaw: 1.2, pitch: 0.3 }
      ],
      snapshotIntervalMs: 50,
      interpolationDelayMs: 1,
      serverTimeOffsetMs: 0,
      freezeBlendFrom: {
        x: 18,
        footY: 1.8,
        z: -3.6,
        yaw: 0.72,
        pitch: 0.18,
        moveSpeedNorm: 0.4,
        sprinting: false,
        movingForward: true,
        movingBackward: false,
        isGrounded: true,
        velocityY: 0,
        muzzleFlashUntil: 0
      },
      freezeBlendStartAt: 1000,
      freezeBlendDurationMs: 40,
      moveSpeedNorm: 0,
      sprinting: false,
      movingForward: false,
      movingBackward: false,
      isGrounded: true,
      velocityY: 0,
      hookedUntil: 0,
      muzzleFlashUntil: 0,
      chokeState: null,
      actorVisual: null,
      bodyHitbox: null,
      headHitbox: null,
      rigApi: {
        setWeapon() {},
        updateAnimation() {},
        triggerAction() {},
        setMuzzleVisible() {}
      }
    };
    const renderMap = new Map([['usr_freeze_recovery', render]]);

    Date.now = () => 1010;
    remoteSync.updateRemoteEntities(0.016, renderMap, function () {
      return { lift: 0, startedAt: 0 };
    });

    const firstX = render.group.position.x;
    const firstY = render.group.position.y;
    const firstYaw = render.group.rotation.y;

    assert.equal(firstX > 18 && firstX < 30, true);
    assert.equal(firstY > 1.8 && firstY < 3, true);
    assert.equal(firstYaw > 0.72 && firstYaw < 1.2, true);

    Date.now = () => 1050;
    remoteSync.updateRemoteEntities(0.016, renderMap, function () {
      return { lift: 0, startedAt: 0 };
    });

    assert.equal(render.group.position.x > firstX, true);
    assert.equal(render.group.position.y > firstY, true);
    assert.equal(render.group.rotation.y > firstYaw, true);
    assert.equal(Number(render.group.position.x.toFixed(2)) > 29.5, true);
    assert.equal(Number(render.group.position.y.toFixed(2)) > 2.95, true);
    assert.equal(Number(render.group.position.z.toFixed(2)) < -5.9, true);
    assert.equal(Number(render.group.rotation.y.toFixed(2)) > 1.18, true);
    assert.equal(render.freezeBlendFrom, null);
  } finally {
    Date.now = originalDateNow;
  }
});
