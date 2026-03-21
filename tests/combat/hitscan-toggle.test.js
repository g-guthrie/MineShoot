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

async function loadToggleHarness(loadout = ['rifle', 'sniper'], equippedWeaponId = loadout[0], options = {}) {
  const [tracerCode, weaponRuntimeCode, shotRuntimeCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/combat/hitscan-tracer-runtime.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/combat/hitscan-weapon-runtime.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/combat/hitscan-shot-runtime.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/combat/hitscan.js', import.meta.url), 'utf8')
  ]);
  let currentEquippedWeaponId = String(equippedWeaponId || loadout[0] || 'rifle');
  const timeState = {
    perfNow: Number(options.perfNow != null ? options.perfNow : 1000),
    dateNow: Number(options.dateNow != null ? options.dateNow : 5000)
  };

  const runtime = {
    GameShared: options.initialGameShared !== undefined ? options.initialGameShared : {
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
    },
    ...(options.runtimeOverrides || {})
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
      now() { return timeState.perfNow; }
    },
    Date: {
      now() { return timeState.dateNow; }
    },
    console
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(tracerCode, context);
  vm.runInContext(weaponRuntimeCode, context);
  vm.runInContext(shotRuntimeCode, context);
  vm.runInContext(code, context);

  return {
    GameHitscan: sandbox.__MAYHEM_RUNTIME.GameHitscan,
    runtime: sandbox.__MAYHEM_RUNTIME,
    timeState,
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

test('GameHitscan refreshes shared weapon data that arrives after module evaluation', async () => {
  const harness = await loadToggleHarness(['rifle', 'sniper'], 'rifle', {
    initialGameShared: {}
  });

  harness.runtime.GameShared = {
    gameplayTuning,
    getSelectableWeaponIds,
    getWeaponFalloffProfile,
    getWeaponPresentation,
    resolveWeaponAimProfile,
    damage: null
  };

  assert.deepEqual(harness.GameHitscan.getAllWeaponIds(), getSelectableWeaponIds());
  assert.equal(harness.GameHitscan.setWeapon('sniper').id, 'sniper');
});

test('GameHitscan passes wall-clock timestamps into combat presentation APIs', async () => {
  const calls = [];
  const harness = await loadToggleHarness(['rifle', 'sniper'], 'rifle', {
    dateNow: 9100,
    perfNow: 1200,
    runtimeOverrides: {
      GamePlayerCombat: {
        getWeaponLoadout() { return { slots: ['rifle', 'sniper'] }; },
        getEquippedWeaponId() { return 'rifle'; },
        getCurrentWeaponState(now) {
          calls.push({ kind: 'weapon', now });
          return {
            id: 'rifle',
            name: 'Rifle',
            automatic: false,
            cooldown: 100,
            reloadMs: 1200,
            magazineSize: 30,
            ammoInMag: 30,
            reloading: false,
            reloadRemaining: 0,
            reloadedFlashRemaining: 0,
            reloadPct: 1,
            reloadPhase: 'ready',
            reloadPhasePct: 1,
            bodyDamage: 48,
            headDamage: 110,
            pellets: 1
          };
        },
        getWeaponHudState(now) {
          calls.push({ kind: 'hud', now });
          return { status: 'ready', pct: 1 };
        },
        equipWeapon(weaponId, now) {
          calls.push({ kind: 'equip', now });
          return { id: weaponId };
        }
      }
    }
  });

  harness.GameHitscan.getCurrentWeapon();
  harness.GameHitscan.getHudState();
  harness.GameHitscan.setWeapon('sniper');

  assert.deepEqual(calls, [
    { kind: 'weapon', now: 9100 },
    { kind: 'hud', now: 9100 },
    { kind: 'equip', now: 9100 },
    { kind: 'weapon', now: 9100 }
  ]);
});
