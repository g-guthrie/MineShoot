import test from 'node:test';
import assert from 'node:assert/strict';

import { createMovementInputState } from '../../../shared/authoritative-movement.js';
import { createPlayerEntity } from '../../../cloudflare/server/room/EntityLifecycle.js';
import {
  PUBLIC_BOT_FIXTURE_TYPE,
  publicBotCount,
  publicParticipantCount,
  syncPublicMatchBots,
  tickPublicMatchBots
} from '../../../cloudflare/server/room/RoomBotRuntime.js';

function createFakeRoom(options = {}) {
  let now = Number(options.now || 1000);
  const connectedIds = new Set(options.connectedIds || ['u1']);
  const room = {
    roomName: 'ffa-01',
    gameMode: 'ffa',
    players: new Map(),
    projectiles: new Map(),
    fireZones: new Map(),
    activeSocketByUserId: new Map(),
    matchState: { started: false, ended: false },
    inputCalls: [],
    fireCalls: [],
    throwCalls: [],
    rollCalls: [],
    equipCalls: [],
    reloadCalls: [],
    now(value) { now = value; },
    currentNowMs() { return now; },
    isPublicMatchRoom() { return true; },
    connectedHumanCount() { return connectedIds.size; },
    buildPlayerEntity(userId, username, _classId, buildOptions) {
      const entity = createPlayerEntity({
        id: userId,
        username,
        actorId: buildOptions && buildOptions.actorId,
        actorName: buildOptions && buildOptions.actorName,
        fixtureType: buildOptions && buildOptions.fixtureType,
        eyeHeight: 1.62,
        createMovementInputState,
        createWeaponAmmoRuntime: (loadout) => this.createWeaponAmmoRuntime(loadout),
        createThrowableRuntime: () => this.createThrowableRuntime()
      });
      entity.x = Number(options.spawnX || 0);
      entity.y = 1.62;
      entity.z = Number(options.spawnZ || 0);
      return entity;
    },
    createWeaponAmmoRuntime(loadout) {
      const out = {};
      for (const weaponId of loadout || ['machinegun']) {
        out[weaponId] = {
          ammoInMag: 30,
          reloadUntil: 0,
          reloadStartedAt: 0,
          reloadSourceAmmo: 0,
          autoReloadAt: 0,
          reloadedFlashUntil: 0
        };
      }
      return out;
    },
    createThrowableRuntime() {
      return {
        frag: { charges: 1, maxCharges: 1, cooldownRemaining: 0 },
        plasma: { charges: 1, maxCharges: 1, cooldownRemaining: 0 },
        molotov: { charges: 1, maxCharges: 1, cooldownRemaining: 0 },
        knife: { charges: 1, maxCharges: 1, cooldownRemaining: 0 }
      };
    },
    applyJoinBaseline(player) {
      player.progressScore = 0;
    },
    getAliveEntities() {
      return Array.from(this.players.values()).filter((entity) => entity && entity.alive !== false);
    },
    isEntityDisconnected() { return false; },
    isEntityMatchEntryPending() { return false; },
    canTargetEntity(entity, sourceId) {
      if (!entity || entity.id === sourceId) return false;
      if (!options.allowBotTargets && entity.fixtureType === PUBLIC_BOT_FIXTURE_TYPE) return false;
      return true;
    },
    entityAimTargetPosition(entity) {
      return { x: entity.x, y: entity.y, z: entity.z };
    },
    authoritativeHitscanOrigin(entity) {
      return { x: entity.x, y: entity.y, z: entity.z };
    },
    hasWorldLineOfSight() { return true; },
    handleInput(player, msg) {
      this.inputCalls.push({ playerId: player.id, msg });
      player.yaw = msg.yaw;
      player.pitch = msg.pitch;
      player.inputState = {
        forward: !!msg.forward,
        backward: !!msg.backward,
        left: !!msg.left,
        right: !!msg.right,
        jump: !!msg.jump,
        sprint: !!msg.sprint,
        adsActive: !!msg.adsActive
      };
      player.lastReceivedInputSeq = msg.seq;
    },
    handleEquipWeapon(player, msg) {
      this.equipCalls.push({ playerId: player.id, msg });
      player.weaponId = msg.weaponId;
    },
    syncWeaponAmmoState(player, weaponId) {
      if (!player.weaponAmmo) player.weaponAmmo = {};
      if (!player.weaponAmmo[weaponId]) player.weaponAmmo[weaponId] = { ammoInMag: 30, reloadUntil: 0 };
      return player.weaponAmmo[weaponId];
    },
    handleReload(player, msg) {
      this.reloadCalls.push({ playerId: player.id, msg });
    },
    handleFire(player, msg) {
      this.fireCalls.push({ playerId: player.id, msg });
    },
    buildDefaultThrowOriginAndDirection(player) {
      return {
        origin: { x: player.x, y: player.y, z: player.z },
        direction: { x: 0, y: 0, z: -1 }
      };
    },
    handleThrow(player, msg) {
      this.throwCalls.push({ playerId: player.id, msg });
    },
    handleRoll(player, msg) {
      this.rollCalls.push({ playerId: player.id, msg });
    }
  };

  const human = createPlayerEntity({
    id: 'u1',
    username: 'Human',
    eyeHeight: 1.62,
    createMovementInputState,
    createWeaponAmmoRuntime: (loadout) => room.createWeaponAmmoRuntime(loadout),
    createThrowableRuntime: () => room.createThrowableRuntime()
  });
  human.x = Number(options.humanX || 0);
  human.y = 1.62;
  human.z = Number(options.humanZ || -22);
  room.players.set(human.id, human);
  return room;
}

test('public bot sync fills public FFA to the target and counts participants separately from humans', () => {
  const room = createFakeRoom();

  const changed = syncPublicMatchBots(room, {
    targetPlayers: 4,
    selectableWeaponIds: ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'],
    defaultWeaponLoadout: ['machinegun', 'shotgun'],
    throwableIds: ['frag', 'plasma', 'molotov', 'knife'],
    nowMs: () => room.currentNowMs(),
    random: () => 0.25
  });

  assert.equal(changed, 3);
  assert.equal(publicBotCount(room), 3);
  assert.equal(publicParticipantCount(room), 4);
  for (const player of room.players.values()) {
    if (player.id === 'u1') continue;
    assert.equal(player.fixtureType, PUBLIC_BOT_FIXTURE_TYPE);
    assert.ok(player.weaponLoadout.length >= 1);
    assert.equal(player.disconnectedAt, 0);
  }
});

test('public bot sync gives index zero the boss profile', () => {
  const room = createFakeRoom();

  syncPublicMatchBots(room, {
    targetPlayers: 3,
    selectableWeaponIds: ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'],
    defaultWeaponLoadout: ['machinegun', 'shotgun'],
    throwableIds: ['frag', 'plasma', 'molotov', 'knife'],
    nowMs: () => room.currentNowMs(),
    random: () => 0.25
  });

  const boss = room.players.get('public-bot-01');
  assert.ok(boss);
  assert.equal(boss.botRole, 'boss');
  assert.equal(boss.username, 'BOT BOSS Quartz');
  assert.ok(boss.botDifficulty > 0.9);
  assert.deepEqual(boss.weaponLoadout, ['rifle', 'shotgun']);
});

test('public bot sync removes bots when humans leave the public room', () => {
  const room = createFakeRoom({ connectedIds: ['u1'] });
  syncPublicMatchBots(room, {
    targetPlayers: 4,
    nowMs: () => room.currentNowMs(),
    random: () => 0.25
  });
  assert.equal(publicBotCount(room), 3);

  room.connectedHumanCount = () => 0;
  const removed = syncPublicMatchBots(room, {
    targetPlayers: 4,
    nowMs: () => room.currentNowMs(),
    random: () => 0.25
  });

  assert.equal(removed, 3);
  assert.equal(publicBotCount(room), 0);
});

test('public bot tick drives canonical input, weapon, fire, throw, and roll hooks', () => {
  const room = createFakeRoom({ humanZ: -20 });
  syncPublicMatchBots(room, {
    targetPlayers: 2,
    selectableWeaponIds: ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'],
    defaultWeaponLoadout: ['machinegun', 'shotgun'],
    throwableIds: ['frag', 'plasma', 'molotov', 'knife'],
    nowMs: () => room.currentNowMs(),
    random: () => 0
  });
  const bot = Array.from(room.players.values()).find((player) => player.fixtureType === PUBLIC_BOT_FIXTURE_TYPE);
  assert.ok(bot);
  bot.botAi.nextThinkAt = 0;
  bot.botAi.nextFireAt = 0;
  bot.botAi.nextThrowAt = 0;
  bot.botAi.nextRollAt = 0;

  room.now(5000);
  const ticked = tickPublicMatchBots(room, 1 / 60, {
    targetPlayers: 2,
    selectableWeaponIds: ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'],
    defaultWeaponLoadout: ['machinegun', 'shotgun'],
    throwableIds: ['frag', 'plasma', 'molotov', 'knife'],
    weaponStats: {
      machinegun: { cooldownMs: 133 },
      shotgun: { cooldownMs: 900 },
      rifle: { cooldownMs: 320 },
      pistol: { cooldownMs: 430 },
      sniper: { cooldownMs: 1800 }
    },
    nowMs: () => room.currentNowMs(),
    random: () => 0
  });

  assert.equal(ticked, 1);
  assert.equal(room.inputCalls.length, 1);
  assert.equal(room.fireCalls.length, 1);
  assert.equal(room.throwCalls.length, 1);
  assert.equal(room.rollCalls.length, 1);
  assert.equal(room.inputCalls[0].playerId, bot.id);
  assert.equal(room.fireCalls[0].playerId, bot.id);
  assert.ok(room.fireCalls[0].msg.shotToken.startsWith('bot-'));
  assert.equal(room.throwCalls[0].msg.throwableId, 'frag');
});

test('boss bot does not prefer a human leader over a closer bot target', () => {
  const room = createFakeRoom({ humanZ: -40, allowBotTargets: true });
  room.matchState = { started: true, ended: false, leaderId: 'u1' };
  const human = room.players.get('u1');
  human.kills = 9;
  human.progressScore = 9;

  syncPublicMatchBots(room, {
    targetPlayers: 3,
    selectableWeaponIds: ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'],
    defaultWeaponLoadout: ['machinegun', 'shotgun'],
    throwableIds: ['frag', 'plasma', 'molotov', 'knife'],
    nowMs: () => room.currentNowMs(),
    random: () => 0.5
  });

  const boss = room.players.get('public-bot-01');
  const closerBot = room.players.get('public-bot-02');
  boss.x = 0;
  boss.z = 0;
  closerBot.x = 0;
  closerBot.z = -5;
  boss.botAi.nextThinkAt = 0;
  boss.botAi.nextFireAt = 999999;
  boss.botAi.nextThrowAt = 999999;
  boss.botAi.nextRollAt = 999999;
  closerBot.botAi.nextThinkAt = 999999;

  room.now(5000);
  tickPublicMatchBots(room, 1 / 60, {
    targetPlayers: 3,
    weaponStats: { rifle: { cooldownMs: 320 }, machinegun: { cooldownMs: 133 } },
    nowMs: () => room.currentNowMs(),
    random: () => 0.5
  });

  assert.equal(boss.botAi.targetId, closerBot.id);
  assert.equal(room.inputCalls[0].playerId, boss.id);
});

test('low-health bot retreats from a healthy close target', () => {
  const room = createFakeRoom({ humanZ: -8 });
  syncPublicMatchBots(room, {
    targetPlayers: 2,
    selectableWeaponIds: ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'],
    defaultWeaponLoadout: ['machinegun', 'shotgun'],
    throwableIds: ['frag', 'plasma', 'molotov', 'knife'],
    nowMs: () => room.currentNowMs(),
    random: () => 0.5
  });

  const bot = room.players.get('public-bot-01');
  bot.hp = 20;
  bot.hpMax = 100;
  bot.botAi.nextThinkAt = 0;
  bot.botAi.nextFireAt = 999999;
  bot.botAi.nextThrowAt = 999999;
  bot.botAi.nextRollAt = 999999;

  room.now(5000);
  tickPublicMatchBots(room, 1 / 60, {
    targetPlayers: 2,
    weaponStats: { rifle: { cooldownMs: 320 }, shotgun: { cooldownMs: 900 } },
    nowMs: () => room.currentNowMs(),
    random: () => 0.5
  });

  assert.equal(room.inputCalls.length, 1);
  assert.equal(room.inputCalls[0].msg.backward, true);
  assert.equal(room.inputCalls[0].msg.forward, false);
  assert.equal(room.inputCalls[0].msg.sprint, true);
});

test('public bots wait while every connected human is still in match entry staging', () => {
  const room = createFakeRoom({ humanZ: -20 });
  room.connectedHumanIds = () => ['u1'];
  room.isEntityMatchEntryPending = (entity) => entity && entity.id === 'u1';
  syncPublicMatchBots(room, {
    targetPlayers: 2,
    nowMs: () => room.currentNowMs(),
    random: () => 0
  });

  const ticked = tickPublicMatchBots(room, 1 / 60, {
    targetPlayers: 2,
    weaponStats: { machinegun: { cooldownMs: 133 } },
    nowMs: () => room.currentNowMs(),
    random: () => 0
  });

  assert.equal(ticked, 1);
  assert.equal(room.inputCalls.length, 0);
  assert.equal(room.fireCalls.length, 0);
});
