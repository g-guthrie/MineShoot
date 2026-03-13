import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

import { gameplayTuning, getDefaultAbilityLoadout, normalizeAbilityLoadout } from '../../shared/gameplay-tuning.js';

async function loadBoundary(runtimeOverrides = {}, globalOverrides = {}) {
  const code = await fs.readFile(new URL('../../js/combat/ability-boundary.js', import.meta.url), 'utf8');
  const runtime = {
    GameShared: {
      gameplayTuning,
      getDefaultAbilityLoadout,
      normalizeAbilityLoadout
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    window: {
      innerHeight: 900
    },
    document: {
      hasFocus() {
        return true;
      }
    },
    Date,
    ...globalOverrides
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameAbilityBoundary;
}

test('buildNetworkDeadeyeUiState centralizes network reticle shaping', async () => {
  const boundary = await loadBoundary();

  const state = boundary.buildNetworkDeadeyeUiState({
    targetIds: ['a', 'b'],
    lockCount: 1,
    maxLocks: 2,
    nextLockAt: 1200,
    lockEveryMs: 200
  }, function (targetId) {
    if (targetId === 'a') return { x: 1, y: 2, z: 3 };
    if (targetId === 'b') return { x: 4, y: 5, z: 6 };
    return null;
  }, 1100);

  assert.deepEqual(JSON.parse(JSON.stringify(state)), {
    targets: [
      { targetId: 'a', worldPos: { x: 1, y: 2, z: 3 }, progress: 1, locked: true },
      { targetId: 'b', worldPos: { x: 4, y: 5, z: 6 }, progress: 0.5, locked: false }
    ]
  });
});

test('buildNetworkDeadeyeUiState falls back to a screen-center reticle when markers are unavailable', async () => {
  const boundary = await loadBoundary();

  const state = boundary.buildNetworkDeadeyeUiState({
    targetIds: ['a'],
    lockCount: 0,
    maxLocks: 2,
    nextLockAt: 1200,
    lockEveryMs: 200
  }, function () {
    return null;
  }, 1100);

  assert.deepEqual(JSON.parse(JSON.stringify(state)), {
    targets: [
      { screenCenter: true, progress: 0, locked: false }
    ]
  });
});

test('buildNetworkHudState centralizes multiplayer ability HUD shaping', async () => {
  const boundary = await loadBoundary();

  const state = boundary.buildNetworkHudState(
    { slot1: 'choke', slot2: 'missile' },
    {
      slot1CooldownRemaining: 1.25,
      slot2CooldownRemaining: 5,
      deadeyeState: {
        lockCount: 1,
        maxLocks: 2
      }
    }
  );

  assert.deepEqual(JSON.parse(JSON.stringify(state)), {
    name: 'Abilities',
    slot1Name: 'Vader Choke',
    slot1Cooldown: 1.25,
    slot2Name: 'Missile',
    slot2Cooldown: 5,
    extra: 'DEADEYE 1/2'
  });
});
