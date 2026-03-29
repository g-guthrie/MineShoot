import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadRemoteSyncHarness(runtimeOverrides = {}) {
  const interpolationCode = await fs.readFile(new URL('../../js/net/interpolation.js', import.meta.url), 'utf8');
  const remoteSyncCode = await fs.readFile(new URL('../../js/net/remote-sync.js', import.meta.url), 'utf8');
  const sandbox = {
    console,
    Date,
    Math,
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameShared: {
          getNetworkTuning() {
            return {
              remoteInterpolation: {
                minDelayMs: 1,
                maxDelayMs: 160,
                intervalDelayScale: 1.6,
                jitterDelayScale: 1.4,
                fallbackCatchupRemainingPerSecond: 0.001
              }
            };
          },
          getMovementTuning() {
            return {
              gravity: 18,
              runSpeed: 11
            };
          },
          getWeaponStats() {
            return {
              moveSpeedMultiplier: 1
            };
          }
        },
        GameNet: {
          timing: {
            getAuthoritativeNow() {
              return Date.now();
            }
          }
        }
      }
    }
  };
  Object.assign(sandbox.globalThis.__MAYHEM_RUNTIME, runtimeOverrides);
  const context = vm.createContext(sandbox);
  vm.runInContext(interpolationCode, context);
  vm.runInContext(remoteSyncCode, context);
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameNetRemoteSync;
}

function createRender(overrides = {}) {
  return Object.assign({
    id: 'usr_remote',
    weaponId: 'rifle',
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
        movingLeft: false,
        movingRight: false,
        isGrounded: true,
        velocityY: 0,
        muzzleFlashUntil: 0
      },
      {
        serverTime: 1100,
        receivedAt: 1100,
        x: 10,
        footY: 0,
        z: 0,
        yaw: 0.6,
        pitch: 0.1,
        moveSpeedNorm: 1,
        sprinting: true,
        movingForward: true,
        movingBackward: false,
        movingLeft: false,
        movingRight: false,
        isGrounded: true,
        velocityY: 0,
        muzzleFlashUntil: 0
      }
    ],
    snapshotIntervalMs: 50,
    snapshotJitterMs: 0,
    interpolationDelayMs: 50,
    serverTimeOffsetMs: 0,
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetFootY: 0,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0
  }, overrides);
}

test('remote sync advances the presented transform over frames using buffered history', async () => {
  const remoteSync = await loadRemoteSyncHarness();
  const render = createRender();
  const renderMap = new Map([[render.id, render]]);
  const originalNow = Date.now;
  let now = 1100;
  Date.now = () => now;
  try {
    remoteSync.updateRemoteEntities(1 / 60, renderMap);
    const firstX = Number(render.group.position.x || 0);
    const firstYaw = Number(render.group.rotation.y || 0);

    now = 1110;
    remoteSync.updateRemoteEntities(1 / 60, renderMap);
    const secondX = Number(render.group.position.x || 0);
    const secondYaw = Number(render.group.rotation.y || 0);

    assert.ok(firstX > 4.5 && firstX < 5.5, `expected first presented x near 5, saw ${firstX}`);
    assert.ok(secondX > firstX && secondX < 7, `expected second presented x to advance smoothly, saw ${secondX}`);
    assert.ok(firstYaw > 0.25 && firstYaw < 0.35, `expected first presented yaw near lerped midpoint, saw ${firstYaw}`);
    assert.ok(secondYaw > firstYaw && secondYaw < 0.5, `expected second presented yaw to continue advancing, saw ${secondYaw}`);
  } finally {
    Date.now = originalNow;
  }
});
