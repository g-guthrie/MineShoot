import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

import {
  gameplayTuning,
  getSelectableWeaponIds,
  getWeaponFalloffProfile,
  getWeaponPresentation,
  resolveWeaponAimProfile
} from '../../shared/gameplay-tuning.js';

async function loadToggleHarness(loadout = ['rifle', 'sniper'], equippedWeaponId = loadout[0]) {
  const code = await fs.readFile(new URL('../../js/combat/hitscan.js', import.meta.url), 'utf8');
  let currentEquippedWeaponId = String(equippedWeaponId || loadout[0] || 'rifle');

  const runtime = {
    GameShared: {
      gameplayTuning,
      getSelectableWeaponIds,
      getWeaponFalloffProfile,
      getWeaponPresentation,
      resolveWeaponAimProfile,
      damage: null
    },
    GameEnemy: {
      getLockTargets() { return []; },
      getHitboxArray() { return []; }
    },
    GameNet: {
      getLockTargets() { return []; },
      getHitboxArray() { return []; }
    },
    GameWorld: {
      getCollidables() { return []; }
    },
    GamePlayer: {
      getAdsState() { return { active: false, weaponId: currentEquippedWeaponId }; },
      setAdsEnabled() {}
    },
    GamePlayerCombat: {
      getWeaponLoadout() { return { slots: loadout.slice() }; },
      getEquippedWeaponId() { return currentEquippedWeaponId; },
      equipWeapon(weaponId) {
        currentEquippedWeaponId = String(weaponId || currentEquippedWeaponId);
        return { id: currentEquippedWeaponId };
      }
    }
  };

  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    THREE,
    window: {
      innerWidth: 1280,
      innerHeight: 720
    },
    performance: {
      now() { return 1000; }
    },
    console
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));

  return {
    GameHitscan: sandbox.__MAYHEM_RUNTIME.GameHitscan,
    getEquippedWeaponId() {
      return currentEquippedWeaponId;
    }
  };
}

test('GameHitscan.toggleWeapon swaps between the active two-slot loadout weapons', async () => {
  const harness = await loadToggleHarness(['rifle', 'sniper'], 'rifle');

  assert.equal(harness.GameHitscan.toggleWeapon().id, 'sniper');
  assert.equal(harness.getEquippedWeaponId(), 'sniper');
  assert.equal(harness.GameHitscan.toggleWeapon().id, 'rifle');
  assert.equal(harness.getEquippedWeaponId(), 'rifle');
});

test('GameHitscan.toggleWeapon keeps a single-slot loadout selected', async () => {
  const harness = await loadToggleHarness(['rifle'], 'rifle');

  assert.equal(harness.GameHitscan.toggleWeapon().id, 'rifle');
  assert.equal(harness.getEquippedWeaponId(), 'rifle');
});

test('GameHitscan.toggleWeapon repairs a stale equipped weapon by choosing the first active slot', async () => {
  const harness = await loadToggleHarness(['rifle', 'sniper'], 'shotgun');

  assert.equal(harness.GameHitscan.toggleWeapon().id, 'rifle');
  assert.equal(harness.getEquippedWeaponId(), 'rifle');
});
