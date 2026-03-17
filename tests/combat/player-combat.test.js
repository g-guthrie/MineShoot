import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadPlayerCombatHarness(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../../js/combat/player-combat.js', import.meta.url), 'utf8');
  let clearTransientCalls = 0;
  const timeState = { now: 1000 };
  const runtime = {
    GameShared: {
      damage: null,
      gameplayTuning: {
        weaponStats: {
          rifle: { name: 'Rifle', cooldownMs: 100, reloadMs: 1200, magazineSize: 30, automatic: false, bodyDamage: 48, headDamage: 110, pellets: 1 },
          sniper: { name: 'Sniper', cooldownMs: 900, reloadMs: 1800, magazineSize: 5, automatic: false, bodyDamage: 140, headDamage: 240, pellets: 1 }
        }
      },
      getWeaponStats(weaponId) {
        return this.gameplayTuning.weaponStats[weaponId] || null;
      },
      getDefaultWeaponLoadout() {
        return ['rifle', 'sniper'];
      },
      getSelectableWeaponIds() {
        return ['rifle', 'sniper'];
      }
    },
    GameUI: {
      updateHealth() {},
      updateArmor() {},
      updateDamageEffects() {},
      updateAbilityInfo() {},
      showDirectionalDamage() {}
    },
    GamePlayer: {
      respawnRandom() {},
      getPosition() { return { x: 0, y: 0, z: 0 }; },
      getRotation() { return { yaw: 0 }; }
    },
    GameAbilities: {
      clearTransientState() {
        clearTransientCalls += 1;
      },
      getHudState() { return {}; }
    },
    GameAudio: {
      play() {}
    },
    GameEvents: {
      PLAYER_DAMAGED: 'player.damaged',
      emit() {}
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    Date: {
      now() {
        return timeState.now;
      }
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return {
    GamePlayerCombat: sandbox.__MAYHEM_RUNTIME.GamePlayerCombat,
    getClearTransientCalls() {
      return clearTransientCalls;
    },
    timeState
  };
}

test('player combat clears transient ability effects when death forces a respawn', async () => {
  const harness = await loadPlayerCombatHarness();
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return false; }
  });

  harness.GamePlayerCombat.consumeDamage(999, 'body', null);

  assert.equal(harness.getClearTransientCalls(), 2);
});

test('player combat defers offline respawn when local match owns the respawn flow', async () => {
  let localMatchDeaths = 0;
  const harness = await loadPlayerCombatHarness({
    GameLocalMatch: {
      isActive() { return true; },
      onSelfKilled() {
        localMatchDeaths += 1;
        return { useManagedRespawn: true };
      }
    }
  });
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return false; }
  });

  harness.GamePlayerCombat.consumeDamage(999, 'body', null);

  assert.equal(localMatchDeaths, 1);
  assert.equal(harness.GamePlayerCombat.isAlive(), false);
  assert.equal(harness.getClearTransientCalls(), 1);
});

test('player combat exposes survivability state and preserves respawn countdown until the server revives the player', async () => {
  const harness = await loadPlayerCombatHarness();
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return true; }
  });

  harness.GamePlayerCombat.syncAuthoritativeState({
    hp: 320,
    hpMax: 500,
    armor: 45,
    armorMax: 90,
    alive: false,
    spawnShieldUntil: 1400
  });
  harness.GamePlayerCombat.syncRespawnState({
    active: true,
    respawnAt: 1800
  });

  assert.deepEqual(JSON.parse(JSON.stringify(harness.GamePlayerCombat.getState(1000))), {
    hp: 320,
    hpMax: 500,
    armor: 45,
    armorMax: 90,
    alive: false,
    invulnerable: true,
    spawnShieldUntil: 1400,
    respawn: {
      active: true,
      respawnAt: 1800,
      remainingMs: 800
    }
  });
  assert.equal(harness.GamePlayerCombat.canUseGameplayActions(1000), false);

  harness.timeState.now = 1900;
  assert.deepEqual(JSON.parse(JSON.stringify(harness.GamePlayerCombat.getRespawnState())), {
    active: true,
    respawnAt: 1800,
    remainingMs: 0
  });

  harness.GamePlayerCombat.syncAuthoritativeState({
    hp: 500,
    hpMax: 500,
    armor: 90,
    armorMax: 90,
    alive: true,
    spawnShieldUntil: 0
  });

  assert.equal(harness.GamePlayerCombat.getRespawnState(1900), null);
  assert.equal(harness.GamePlayerCombat.canUseGameplayActions(1900), true);
});

test('player combat clears respawn countdown when a network snapshot marks the player out of round', async () => {
  const harness = await loadPlayerCombatHarness();
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return true; }
  });

  harness.GamePlayerCombat.syncFromNetwork({
    hp: 0,
    hpMax: 500,
    armor: 0,
    armorMax: 90,
    alive: false,
    outOfRound: false,
    spawnShieldUntil: 0
  }, {
    respawnState: {
      active: true,
      respawnAt: 1800
    }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(harness.GamePlayerCombat.getRespawnState(1000))), {
    active: true,
    respawnAt: 1800,
    remainingMs: 800
  });

  harness.GamePlayerCombat.syncFromNetwork({
    hp: 0,
    hpMax: 500,
    armor: 0,
    armorMax: 90,
    alive: false,
    outOfRound: true,
    spawnShieldUntil: 0
  }, {
    respawnState: {
      active: true,
      respawnAt: 1800
    }
  });

  assert.equal(harness.GamePlayerCombat.getRespawnState(1000), null);
});

test('player combat owns weapon presentation state and repairs it from authoritative snapshots', async () => {
  const harness = await loadPlayerCombatHarness();
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return true; }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(harness.GamePlayerCombat.getWeaponLoadout())), {
    slots: ['rifle', 'sniper']
  });

  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'sniper',
    weaponLoadout: ['sniper', 'rifle'],
    weaponAmmo: {
      sniper: {
        ammoInMag: 1,
        reloading: false,
        reloadRemaining: 0,
        reloadedFlashRemaining: 0
      }
    }
  }, 1000);

  assert.equal(harness.GamePlayerCombat.getEquippedWeaponId(), 'sniper');
  assert.deepEqual(JSON.parse(JSON.stringify(harness.GamePlayerCombat.getCurrentWeaponState(1000))), {
    id: 'sniper',
    name: 'Sniper',
    automatic: false,
    cooldown: 900,
    reloadMs: 1800,
    magazineSize: 5,
    ammoInMag: 1,
    reloading: false,
    reloadRemaining: 0,
    reloadedFlashRemaining: 0,
    reloadPct: 1,
    reloadPhase: 'ready',
    reloadPhasePct: 1,
    bodyDamage: 140,
    headDamage: 240,
    pellets: 1
  });

  harness.GamePlayerCombat.recordWeaponFire('sniper', 1050);

  assert.deepEqual(JSON.parse(JSON.stringify(harness.GamePlayerCombat.getWeaponHudState(1050))), {
    status: 'reloading',
    ready: false,
    pct: 0,
    phase: 'raise'
  });
  assert.equal(harness.GamePlayerCombat.getCurrentWeaponState(1050).reloading, true);
  assert.equal(harness.GamePlayerCombat.getCurrentWeaponState(1050).reloadPhase, 'raise');

  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'sniper',
    weaponLoadout: ['sniper', 'rifle'],
    weaponAmmo: {
      sniper: {
        ammoInMag: 5,
        reloading: false,
        reloadRemaining: 0,
        reloadedFlashRemaining: 0.9
      }
    }
  }, 2200);

  assert.equal(harness.GamePlayerCombat.getCurrentWeaponState(2200).ammoInMag, 5);
  assert.equal(harness.GamePlayerCombat.getCurrentWeaponState(2200).reloading, false);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.GamePlayerCombat.getWeaponHudState(2200))), {
    status: 'reloaded',
    ready: true,
    pct: 1,
    phase: 'complete'
  });
});

test('player combat manual reload ignores full magazines and starts once rounds are missing', async () => {
  const harness = await loadPlayerCombatHarness();
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return false; }
  });

  assert.equal(harness.GamePlayerCombat.beginWeaponReload('rifle', 1000), false);

  harness.GamePlayerCombat.recordWeaponFire('rifle', 1050);

  assert.equal(harness.GamePlayerCombat.beginWeaponReload('rifle', 1100), true);
  assert.equal(harness.GamePlayerCombat.getCurrentWeaponState(1100).reloading, true);
});

test('player combat keeps a local multiplayer reload alive until authoritative ammo catches up', async () => {
  const harness = await loadPlayerCombatHarness();
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return true; }
  });

  harness.GamePlayerCombat.recordWeaponFire('rifle', 1050);
  assert.equal(harness.GamePlayerCombat.beginWeaponReload('rifle', 1100), true);
  assert.equal(harness.GamePlayerCombat.getCurrentWeaponState(1100).reloading, true);

  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'rifle',
    weaponLoadout: ['rifle', 'sniper'],
    weaponAmmo: {
      rifle: {
        ammoInMag: 29,
        reloading: false,
        reloadRemaining: 0,
        reloadedFlashRemaining: 0
      }
    }
  }, 1120);

  assert.equal(harness.GamePlayerCombat.getCurrentWeaponState(1120).reloading, true);

  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'rifle',
    weaponLoadout: ['rifle', 'sniper'],
    weaponAmmo: {
      rifle: {
        ammoInMag: 30,
        reloading: false,
        reloadRemaining: 0,
        reloadedFlashRemaining: 0.2
      }
    }
  }, 2400);

  assert.equal(harness.GamePlayerCombat.getCurrentWeaponState(2400).reloading, false);
  assert.equal(harness.GamePlayerCombat.getCurrentWeaponState(2400).ammoInMag, 30);
});

test('player combat ignores stale zero-ammo snapshots while multiplayer reload prediction is pending', async () => {
  const weaponStats = {
    rifle: { name: 'Rifle', cooldownMs: 100, reloadMs: 1200, magazineSize: 1, automatic: false, bodyDamage: 48, headDamage: 110, pellets: 1 },
    sniper: { name: 'Sniper', cooldownMs: 900, reloadMs: 1800, magazineSize: 5, automatic: false, bodyDamage: 140, headDamage: 240, pellets: 1 }
  };
  const harness = await loadPlayerCombatHarness({
    GameShared: {
      damage: null,
      gameplayTuning: { weaponStats },
      getWeaponStats(weaponId) {
        return this.gameplayTuning.weaponStats[weaponId] || null;
      },
      getDefaultWeaponLoadout() {
        return ['rifle', 'sniper'];
      },
      getSelectableWeaponIds() {
        return ['rifle', 'sniper'];
      }
    }
  });
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return true; }
  });

  harness.GamePlayerCombat.recordWeaponFire('rifle', 1000);
  assert.equal(harness.GamePlayerCombat.getCurrentWeaponState(1000).reloading, true);

  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'rifle',
    weaponLoadout: ['rifle', 'sniper'],
    weaponAmmo: {
      rifle: {
        ammoInMag: 0,
        reloading: false,
        reloadRemaining: 0,
        reloadedFlashRemaining: 0
      }
    }
  }, 1020);

  const currentWeapon = harness.GamePlayerCombat.getCurrentWeaponState(1020);
  assert.equal(currentWeapon.reloading, true);
  assert.equal(currentWeapon.ammoInMag, 0);
});

test('player combat keeps completed multiplayer reloads stable through the local grace window', async () => {
  const harness = await loadPlayerCombatHarness();
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return true; }
  });

  harness.GamePlayerCombat.recordWeaponFire('rifle', 1050);
  assert.equal(harness.GamePlayerCombat.beginWeaponReload('rifle', 1100), true);

  const completedState = harness.GamePlayerCombat.getCurrentWeaponState(2300);
  assert.equal(completedState.reloading, false);
  assert.equal(completedState.ammoInMag, 30);

  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'rifle',
    weaponLoadout: ['rifle', 'sniper'],
    weaponAmmo: {
      rifle: {
        ammoInMag: 29,
        reloading: false,
        reloadRemaining: 0,
        reloadedFlashRemaining: 0
      }
    }
  }, 2400);

  const stabilizedState = harness.GamePlayerCombat.getCurrentWeaponState(2400);
  assert.equal(stabilizedState.reloading, false);
  assert.equal(stabilizedState.ammoInMag, 30);
});

test('player combat keeps per-weapon reload progress alive while swapping away and back', async () => {
  const harness = await loadPlayerCombatHarness();
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return true; }
  });

  harness.GamePlayerCombat.recordWeaponFire('rifle', 1050);
  assert.equal(harness.GamePlayerCombat.beginWeaponReload('rifle', 1100), true);
  harness.GamePlayerCombat.equipWeapon('sniper');

  const rifleWhileAway = harness.GamePlayerCombat.getWeaponState('rifle', 1600);
  assert.equal(rifleWhileAway.reloading, true);
  assert.equal(rifleWhileAway.reloadPhase, 'manipulate');
  assert.ok(rifleWhileAway.reloadPct > 0.3);

  const rifleCompleted = harness.GamePlayerCombat.getWeaponState('rifle', 2400);
  assert.equal(rifleCompleted.reloading, false);
  assert.equal(rifleCompleted.ammoInMag, 30);
  assert.equal(rifleCompleted.reloadPhase, 'complete');

  harness.GamePlayerCombat.equipWeapon('rifle');
  const currentWeapon = harness.GamePlayerCombat.getCurrentWeaponState(2400);
  assert.equal(currentWeapon.id, 'rifle');
  assert.equal(currentWeapon.ammoInMag, 30);
  assert.equal(currentWeapon.reloading, false);
});

test('player combat preserves a recent local multiplayer equip through stale snapshots', async () => {
  const harness = await loadPlayerCombatHarness();
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return true; }
  });

  harness.GamePlayerCombat.equipWeapon('sniper');
  assert.equal(harness.GamePlayerCombat.getEquippedWeaponId(), 'sniper');

  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'rifle',
    weaponLoadout: ['rifle', 'sniper']
  }, 1000);
  assert.equal(harness.GamePlayerCombat.getEquippedWeaponId(), 'sniper');

  harness.timeState.now = 1500;
  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'rifle',
    weaponLoadout: ['rifle', 'sniper']
  }, 1500);
  assert.equal(harness.GamePlayerCombat.getEquippedWeaponId(), 'sniper');

  harness.timeState.now = 1900;
  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'rifle',
    weaponLoadout: ['rifle', 'sniper']
  }, 1900);
  assert.equal(harness.GamePlayerCombat.getEquippedWeaponId(), 'sniper');

  harness.timeState.now = 3600;
  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'rifle',
    weaponLoadout: ['rifle', 'sniper']
  }, 3600);
  assert.equal(harness.GamePlayerCombat.getEquippedWeaponId(), 'rifle');
});

test('player combat keeps multiplayer weapon prediction through stale snapshots even after the server catches up once', async () => {
  const harness = await loadPlayerCombatHarness();
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return true; }
  });

  harness.GamePlayerCombat.equipWeapon('sniper');

  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'rifle',
    weaponLoadout: ['rifle', 'sniper']
  }, 1000);
  assert.equal(harness.GamePlayerCombat.getEquippedWeaponId(), 'sniper');

  harness.timeState.now = 1100;
  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'sniper',
    weaponLoadout: ['rifle', 'sniper']
  }, 1100);
  assert.equal(harness.GamePlayerCombat.getEquippedWeaponId(), 'sniper');

  harness.timeState.now = 1500;
  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'rifle',
    weaponLoadout: ['rifle', 'sniper']
  }, 1500);
  assert.equal(harness.GamePlayerCombat.getEquippedWeaponId(), 'sniper');

  harness.timeState.now = 3800;
  harness.GamePlayerCombat.syncWeaponState({
    weaponId: 'rifle',
    weaponLoadout: ['rifle', 'sniper']
  }, 3800);
  assert.equal(harness.GamePlayerCombat.getEquippedWeaponId(), 'rifle');
});
