import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadPlayerView(getCurrentWeaponState) {
  const code = await fs.readFile(new URL('../../js/actors/player-view.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {},
    globalThis: null,
    console,
    THREE,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GamePlayerView.create({
    getCurrentWeaponState
  });
}

function baseAnimState(overrides = {}) {
  return {
    actorVisual: null,
    avatarRigApi: null,
    runSpeed: 14,
    sprinting: false,
    isGrounded: true,
    pitch: 0,
    hooked: false,
    hookPullStartedAt: 0,
    choked: false,
    chokeStartedAt: 0,
    adsActive: false,
    movingForward: false,
    movingBackward: false,
    movingLeft: false,
    movingRight: false,
    ...overrides
  };
}

test('player view forwards reload state and progress into actor visuals', async () => {
  const calls = [];
  const view = await loadPlayerView(function () {
    return {
      reloading: true,
      reloadMs: 1000,
      reloadRemaining: 250
    };
  });

  view.updateAvatarAnimation(0.016, 0, baseAnimState({
    actorVisual: {
      updateAnimation(_dt, animState) {
        calls.push(animState);
      }
    }
  }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].reloading, true);
  assert.ok(Math.abs(calls[0].reloadPct - 0.75) < 0.000001);
});

test('player view falls back to the rig api when no actor visual wrapper is present', async () => {
  const calls = [];
  const view = await loadPlayerView(function () {
    return {
      reloading: true,
      reloadMs: 1200,
      reloadRemaining: 300
    };
  });

  view.updateAvatarAnimation(0.016, 0, baseAnimState({
    avatarRigApi: {
      updateAnimation(_dt, animState) {
        calls.push(animState);
      }
    }
  }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].reloading, true);
  assert.ok(Math.abs(calls[0].reloadPct - 0.75) < 0.000001);
});
