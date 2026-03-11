import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadRemoteSync() {
  const code = await fs.readFile(new URL('../js/net/remote-sync.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        entityPoints: {}
      }
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
      triggerAction(action) {
        calls.push({ kind: 'trigger', action });
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
