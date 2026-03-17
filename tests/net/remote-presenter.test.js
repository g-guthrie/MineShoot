import test from 'node:test';
import assert from 'node:assert/strict';

import { updateRemotePresentation } from '../../js/net/remote-presenter.mjs';

test('remote presenter forwards reload progress through the current animation api', () => {
  globalThis.__MAYHEM_RUNTIME = {
    GameShared: {
      gameplayTuning: {
        weaponStats: {
          rifle: { reloadMs: 1500 }
        }
      }
    }
  };

  let latestAnimState = null;
  const render = {
    id: 'usr_remote',
    alive: true,
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetY: 1.6,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: false,
    isGrounded: true,
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
    muzzleFlashUntil: 0,
    actorVisual: null,
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation(_dt, animState) {
        latestAnimState = animState;
      },
      setMuzzleVisible() {}
    }
  };
  const entitiesApi = {
    getRenderMap() {
      return new Map([['usr_remote', render]]);
    }
  };

  updateRemotePresentation({
    runtime: {
      getEstimatedServerTime() { return 1000; },
      getRateConfig() { return { renderHz: 60, interpolationDelayMs: 0 }; }
    },
    entitiesApi,
    dt: 0.016,
    nowMs() { return 1000; }
  });

  assert.equal(!!latestAnimState, true);
  assert.equal(latestAnimState.reloading, true);
  assert.ok(Math.abs(latestAnimState.reloadPct - 0.4) < 0.000001);
});

test('remote presenter evaluates reload progress against the delayed render clock', () => {
  globalThis.__MAYHEM_RUNTIME = {
    GameShared: {
      gameplayTuning: {
        weaponStats: {
          rifle: { reloadMs: 1500 }
        }
      }
    }
  };

  let latestAnimState = null;
  const render = {
    id: 'usr_remote',
    alive: true,
    group: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 }
    },
    targetX: 0,
    targetY: 1.6,
    targetZ: 0,
    targetYaw: 0,
    targetPitch: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: false,
    isGrounded: true,
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
    muzzleFlashUntil: 0,
    actorVisual: null,
    bodyHitbox: null,
    headHitbox: null,
    rigApi: {
      setWeapon() {},
      updateAnimation(_dt, animState) {
        latestAnimState = animState;
      },
      setMuzzleVisible() {}
    }
  };
  const entitiesApi = {
    getRenderMap() {
      return new Map([['usr_remote', render]]);
    }
  };

  updateRemotePresentation({
    runtime: {
      getEstimatedServerTime() { return 1000; },
      getRateConfig() { return { renderHz: 60, interpolationDelayMs: 100 }; }
    },
    entitiesApi,
    dt: 0.016,
    nowMs() { return 1000; }
  });

  assert.equal(!!latestAnimState, true);
  assert.equal(latestAnimState.reloading, true);
  assert.ok(Math.abs(latestAnimState.reloadPct - (1 / 3)) < 0.000001);
});
