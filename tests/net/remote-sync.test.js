import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadRemoteSync(remoteInterpolationTuning = null, runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../../js/net/remote-sync.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        entityPoints: {},
        gameplayTuning: remoteInterpolationTuning ? {
          network: {
            remoteInterpolation: remoteInterpolationTuning
          }
        } : null
      },
      ...runtimeOverrides
    },
    globalThis: null,
    console,
    Date
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
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
});

test('remote sync forwards replicated reload progress to remote animation', async () => {
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
  assert.equal(latestAnimState.reloading, true);
  assert.ok(Math.abs(latestAnimState.reloadPct - 0.4) < 0.000001);
});

test('remote sync evaluates reload progress against the delayed presentation clock', async () => {
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
    interpolationDelayMs: 100,
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
  assert.equal(latestAnimState.reloading, true);
  assert.ok(Math.abs(latestAnimState.reloadPct - (1 / 3)) < 0.000001);
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
      healState: { endsAt: 1000 },
      spawnShieldUntil: 1000,
      actorVisual: {
        updateAnimation(_dt, animState) {
          calls.push({ kind: 'update', animState });
        },
        setMuzzleVisible(visible) {
          calls.push({ kind: 'muzzle', visible });
        },
        setHealFlash(visible) {
          calls.push({ kind: 'heal', visible });
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

    assert.equal(calls.some((entry) => entry.kind === 'update' && entry.animState.hooked === true), true);
    assert.equal(calls.some((entry) => entry.kind === 'muzzle' && entry.visible === true), true);
    assert.equal(calls.some((entry) => entry.kind === 'heal' && entry.visible === true), true);
    assert.equal(calls.some((entry) => entry.kind === 'shield' && entry.visible === true), true);
    assert.equal(calls.some((entry) => entry.kind === 'trigger' && entry.action === 'choke_grip'), true);
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

    assert.equal(Number(render.group.position.x.toFixed(2)), 10.5);
    assert.equal(Number(render.group.position.y.toFixed(2)), 1.05);
    assert.equal(Number(render.group.position.z.toFixed(2)), -2.1);
    assert.equal(Number(render.group.rotation.y.toFixed(2)), 0.42);
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
