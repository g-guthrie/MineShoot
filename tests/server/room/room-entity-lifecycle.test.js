import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBotEntity,
  createPlayerEntity,
  resetEntityForRespawn
} from '../../../cloudflare/server/room/EntityLifecycle.js';

function createMovementInputState() {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    adsActive: false
  };
}

function createThrowableRuntime() {
  return {
    frag: {
      charges: 1,
      maxCharges: 1,
      cooldownRemaining: 0
    }
  };
}

function createWeaponAmmoRuntime(loadout) {
  const ammo = {};
  for (let i = 0; i < loadout.length; i++) {
    ammo[loadout[i]] = {
      ammoInMag: i + 1,
      reloadUntil: 0,
      reloadedFlashUntil: 0
    };
  }
  return ammo;
}

test('createPlayerEntity centralizes default runtime state', () => {
  const player = createPlayerEntity({
    id: 'usr_1',
    username: 'ALPHA',
    actorId: 'act_1',
    actorName: 'ALPHA_ACTOR',
    fixtureType: 'sim_player',
    yaw: 1.25,
    pitch: -0.5,
    eyeHeight: 1.6,
    createMovementInputState,
    createThrowableRuntime,
    createWeaponAmmoRuntime
  });

  assert.equal(player.id, 'usr_1');
  assert.equal(player.username, 'ALPHA');
  assert.equal(player.actorId, 'act_1');
  assert.equal(player.actorName, 'ALPHA_ACTOR');
  assert.equal(player.classId, 'abilities');
  assert.equal(player.weaponId, 'machinegun');
  assert.deepEqual(player.abilityLoadout, { slot1: 'choke', slot2: 'missile' });
  assert.deepEqual(player.weaponLoadout, ['machinegun', 'shotgun']);
  assert.deepEqual(player.throwables, createThrowableRuntime());
  assert.deepEqual(player.inputState, createMovementInputState());
  assert.deepEqual(Object.keys(player.weaponAmmo), ['machinegun', 'shotgun']);
  assert.equal(player.slot1CooldownUntil, 0);
  assert.equal(player.weaponLockUntil, 0);
  assert.equal(player.healState, null);
});

test('createBotEntity keeps bot defaults aligned with shared room lifecycle state', () => {
  const bot = createBotEntity(1, {
    eyeHeight: 1.6,
    createThrowableRuntime
  });

  assert.equal(bot.id, 'bot-2');
  assert.equal(bot.username, 'BOT_2');
  assert.equal(bot.classId, 'abilities');
  assert.deepEqual(bot.abilityLoadout, { slot1: 'choke', slot2: 'missile' });
  assert.deepEqual(bot.weaponLoadout, ['machinegun', 'shotgun']);
  assert.deepEqual(bot.throwables, createThrowableRuntime());
  assert.equal(bot.slot2CooldownUntil, 0);
  assert.equal(bot.chokeVictimState, null);
  assert.equal(bot.hookPullState, null);
});

test('resetEntityForRespawn restores transient combat and movement state', () => {
  const player = createPlayerEntity({
    id: 'usr_2',
    username: 'BRAVO',
    eyeHeight: 1.6,
    createMovementInputState,
    createThrowableRuntime,
    createWeaponAmmoRuntime
  });

  const previousInput = player.inputState;
  player.hp = 10;
  player.armor = 3;
  player.alive = false;
  player.respawnAt = 999;
  player.streamHeat = 1;
  player.streamOverheatedUntil = 4000;
  player.lastShotAt = { rifle: 10 };
  player.lastShotTokenByWeapon = { rifle: 'dup' };
  player.muzzleFlashUntil = 200;
  player.throwables.frag.charges = 0;
  player.lastThrowAt = 22;
  player.slot1CooldownUntil = 100;
  player.weaponLockUntil = 100;
  player.stunUntil = 100;
  player.deadeye = { lockIndex: 2 };
  player.chokeVictimState = { sourceId: 'enemy' };
  player.justBeenHookedState = { startedAt: 5 };
  player.hookPullState = { sourceId: 'enemy' };
  player.healState = { endsAt: 10 };
  player.velocityY = 8;
  player.isGrounded = false;
  player.jumpHoldTimer = 1;
  player.jumpHeldLast = true;
  player.yaw = 1;
  player.pitch = -1;
  player.moveSpeedNorm = 0.8;
  player.sprinting = true;

  resetEntityForRespawn(player, {
    createMovementInputState,
    createThrowableRuntime,
    createWeaponAmmoRuntime,
    zeroAim: true
  });

  assert.equal(player.hp, player.hpMax);
  assert.equal(player.armor, player.armorMax);
  assert.equal(player.alive, true);
  assert.equal(player.respawnAt, 0);
  assert.equal(player.streamHeat, 0);
  assert.equal(player.streamOverheatedUntil, 0);
  assert.deepEqual(player.lastShotAt, {});
  assert.deepEqual(player.lastShotTokenByWeapon, {});
  assert.equal(player.muzzleFlashUntil, 0);
  assert.deepEqual(player.throwables, createThrowableRuntime());
  assert.equal(player.lastThrowAt, 0);
  assert.notEqual(player.inputState, previousInput);
  assert.deepEqual(player.inputState, createMovementInputState());
  assert.equal(player.slot1CooldownUntil, 0);
  assert.equal(player.weaponLockUntil, 0);
  assert.equal(player.stunUntil, 0);
  assert.equal(player.deadeye, null);
  assert.equal(player.chokeVictimState, null);
  assert.equal(player.justBeenHookedState, null);
  assert.equal(player.hookPullState, null);
  assert.equal(player.healState, null);
  assert.equal(player.yaw, 0);
  assert.equal(player.pitch, 0);
  assert.equal(player.moveSpeedNorm, 0);
  assert.equal(player.sprinting, false);
  assert.deepEqual(Object.keys(player.weaponAmmo), ['machinegun', 'shotgun']);
});
