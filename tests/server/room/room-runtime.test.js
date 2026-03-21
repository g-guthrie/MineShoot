import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPendingInputAck,
  applyEntitySpawnPoint,
  applySpawnShield,
  buildPlayerEntity,
  chooseEntitySpawnPoint,
  consumeQueuedAuthoritativeInputs,
  ensurePlayer,
  queueAuthoritativeInput,
  respawnIfNeeded,
  syncRoomFixtures,
  terrainFeetYAt,
  terrainEyeYAt
} from '../../../cloudflare/server/room/RoomRuntime.js';

function makeRoom() {
  return {
    roomName: 'global',
    boundsMin: 2,
    boundsMax: 110,
    worldFlags: { terrainPhysicsV2: true },
    terrainSampler: {
      getGroundHeightAt(x, z) {
        return x + z;
      }
    },
    players: new Map(),
    privateRoomConfig: { teams: new Map([['actor-a', 'bravo']]) },
    gameMode: 'tdm',
    matchState: { started: true, ended: false },
    getAliveEntities() { return []; },
    isDevLocalRoom() { return true; },
    isPublicMatchRoom() { return true; },
    createThrowableRuntime() { return { frag: { charges: 1 } }; },
    buildPlayerEntity(userId, username, classId, options) {
      return buildPlayerEntity(this, userId, username, classId, options, {
        createPlayerEntity(config) {
          return {
            id: config.id,
            username: config.username,
            actorId: config.actorId,
            actorName: config.actorName,
            fixtureType: config.fixtureType,
            kind: 'player',
            yaw: config.yaw,
            pitch: config.pitch,
            inputState: config.createMovementInputState(),
            weaponAmmo: config.createWeaponAmmoRuntime(['rifle']),
            throwables: config.createThrowableRuntime()
          };
        },
        createMovementInputState() { return { forward: false }; },
        createWeaponAmmoRuntime() { return { rifle: { ammoInMag: 30 } }; },
        playerEyeHeight: 1.7,
        spawnPadding: 8,
        spawnMinClearance: 14,
        nowMs: () => 500,
        playerSpawnShieldMs: 1000
      });
    },
    spawnEntityRandomly(entity) {
      entity.x = 10;
      entity.z = 11;
      entity.y = 12.7;
      entity.plannedSpawnPoint = null;
    },
    applyEntitySpawnPoint(entity, spawn) {
      return applyEntitySpawnPoint(this, entity, spawn, { playerEyeHeight: 1.7 });
    },
    applySpawnShield(entity) {
      return applySpawnShield(entity, { nowMs: () => 500, playerSpawnShieldMs: 1000 });
    },
    applyJoinBaselineCalls: 0,
    applyJoinBaseline(player) {
      this.applyJoinBaselineCalls += 1;
      player.teamId = player.teamId || 'alpha';
    },
    enforceEntityTerrainFloor(entity) {
      return applyEntitySpawnPoint(this, entity, { x: entity.x, z: entity.z }, { playerEyeHeight: 1.7 });
    },
    tickAuthoritativePlayerMovementCalls: 0,
    tickAuthoritativePlayerMovement() { this.tickAuthoritativePlayerMovementCalls += 1; },
    regenArmorCalls: 0,
    regenArmor() { this.regenArmorCalls += 1; },
    tickStreamStateCalls: 0,
    tickStreamState() { this.tickStreamStateCalls += 1; },
    tickThrowableRegenCalls: 0,
    tickThrowableRegen() { this.tickThrowableRegenCalls += 1; },
    respawnIfNeeded(entity) {
      return respawnIfNeeded(this, entity, {
        nowMs: () => 1000,
        resetEntityForRespawn(target) {
          target.alive = true;
          target.respawnAt = 0;
        },
        createWeaponAmmoRuntime() { return { rifle: { ammoInMag: 30 } }; },
        createMovementInputState() { return { forward: false }; }
      });
    }
  };
}

test('room runtime terrain and spawn helpers keep player positions grounded', () => {
  const room = makeRoom();
  assert.equal(terrainFeetYAt(room, 2, 3), 5);
  assert.equal(terrainEyeYAt(room, 2, 3, { playerEyeHeight: 1.7 }), 6.7);

  const player = { kind: 'player', x: 1, z: 2, y: 0 };
  applyEntitySpawnPoint(room, player, { x: 4, z: 5 }, { playerEyeHeight: 1.7 });
  assert.equal(player.x, 4);
  assert.equal(player.z, 5);
  assert.equal(player.y, 10.7);
  assert.equal(player.isGrounded, true);
});

test('room runtime keeps latest intent and applies the ack after authoritative movement', () => {
  const player = {
    seq: 4,
    pendingInputSeq: 4,
    lastProcessedInputSeq: 4,
    lastReceivedInputSeq: 4,
    yaw: 0,
    pitch: 0,
    inputState: {},
    inputQueue: []
  };

  queueAuthoritativeInput(player, {
    seq: 7,
    dtMs: 50,
    yaw: 0.25,
    pitch: 0.5,
    forward: true,
    jump: true,
    adsActive: false
  }, {
    movementLocked: false,
    canEntityUseWeapon() { return true; },
    clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
    createMovementInputState() { return {}; }
  });

  assert.equal(player.seq, 4);
  assert.equal(player.pendingInputSeq, 7);
  assert.equal(player.lastReceivedInputSeq, 7);
  assert.equal(player.lastProcessedInputSeq, 4);
  assert.equal(player.yaw, 0.25);
  assert.equal(player.inputState.forward, true);
  assert.equal(player.inputState.jump, true);
  assert.equal(player.inputQueue.length, 1);
  player.lastProcessedInputSeq = 7;
  applyPendingInputAck(player);

  assert.equal(player.seq, 7);
});

test('room runtime input samples do not rewind weapon selection from stale client anim state', () => {
  const player = {
    alive: true,
    weaponId: 'sniper',
    pendingInputSeq: 0,
    lastProcessedInputSeq: 0,
    lastReceivedInputSeq: 0,
    inputState: {},
    inputQueue: []
  };

  queueAuthoritativeInput(player, {
    seq: 3,
    weaponId: 'rifle',
    forward: true
  }, {
    movementLocked: false,
    canEntityUseWeapon() { return true; },
    clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
    createMovementInputState() { return {}; }
  });

  assert.equal(player.weaponId, 'sniper');
  assert.equal(player.pendingInputSeq, 3);
  assert.equal(player.inputState.forward, true);
});

test('room runtime preserves look updates while movement is locked', () => {
  const player = {
    alive: true,
    yaw: 0.1,
    pitch: 0.2,
    pendingInputSeq: 0,
    lastProcessedInputSeq: 0,
    lastReceivedInputSeq: 0,
    inputState: {},
    inputQueue: []
  };

  queueAuthoritativeInput(player, {
    seq: 2,
    yaw: 0.75,
    pitch: -0.5
  }, {
    movementLocked: true,
    clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
    createMovementInputState() { return {}; }
  });

  assert.equal(player.yaw, 0.75);
  assert.equal(player.pitch, -0.5);
  assert.equal(player.inputQueue[0].movementLocked, true);
});

test('room runtime consumes queued input samples in sequence and weights their tick share by dt', () => {
  const player = {
    seq: 0,
    pendingInputSeq: 0,
    lastProcessedInputSeq: 0,
    lastReceivedInputSeq: 0,
    yaw: 0,
    pitch: 0,
    inputState: {},
    inputQueue: []
  };
  const deps = {
    movementLocked: false,
    canEntityUseWeapon() { return true; },
    clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
    createMovementInputState() { return {}; }
  };

  queueAuthoritativeInput(player, {
    seq: 9,
    dtMs: 40,
    yaw: 0.9,
    forward: true
  }, deps);
  queueAuthoritativeInput(player, {
    seq: 7,
    dtMs: 20,
    yaw: 0.7,
    left: true
  }, deps);
  queueAuthoritativeInput(player, {
    seq: 9,
    dtMs: 40,
    yaw: 0.9,
    forward: true
  }, deps);

  const movementPlan = consumeQueuedAuthoritativeInputs(player, 0.09, {
    createMovementInputState() { return {}; }
  });

  assert.deepEqual(movementPlan.steps.map((step) => step.seq), [7, 9]);
  assert.ok(Math.abs(movementPlan.steps[0].dtSec - 0.03) < 0.000001);
  assert.ok(Math.abs(movementPlan.steps[1].dtSec - 0.06) < 0.000001);
  assert.equal(movementPlan.steps[0].inputState.left, true);
  assert.equal(movementPlan.steps[1].inputState.forward, true);
  assert.equal(movementPlan.processedSeq, 9);
  assert.equal(player.inputQueue.length, 0);
});

test('room runtime ack only advances to the last processed input seq', () => {
  const player = {
    seq: 4,
    pendingInputSeq: 7,
    lastProcessedInputSeq: 5
  };

  applyPendingInputAck(player);

  assert.equal(player.seq, 5);
});

test('room runtime ensures players and simulated fixtures through one boundary', () => {
  const room = makeRoom();
  const player = ensurePlayer(room, 'u1', 'ALPHA', 'abilities', 'actor-a', 'ALPHA', {
    isPrivateMatchRoom: () => true,
    teamAlpha: 'alpha',
    gameModeTdm: 'tdm'
  });

  assert.equal(room.players.get('u1'), player);
  assert.equal(player.teamId, 'bravo');
  assert.equal(room.applyJoinBaselineCalls, 1);

  syncRoomFixtures(room, {
    simPlayerIds: ['sim-1'],
    simPlayerNames: ['SIM ONE'],
    ensureBots(targetRoom) {
      targetRoom.botsEnsured = true;
    }
  });

  assert.equal(room.players.has('sim-1'), true);
  assert.equal(room.players.get('sim-1').fixtureType, 'sim_player');
  assert.equal(room.botsEnsured, true);
});

test('room runtime respawns dead entities and ticks live players through shared helpers', () => {
  const room = makeRoom();
  const player = {
    id: 'u2',
    kind: 'player',
    fixtureType: '',
    alive: false,
    respawnAt: 0,
    plannedSpawnPoint: { x: 7, z: 8 }
  };
  room.players.set('u2', player);

  room.respawnIfNeeded(player);
  assert.equal(player.alive, true);
  assert.equal(player.spawnShieldUntil, 1500);
  assert.equal(player.x, 7);
  assert.equal(player.z, 8);
});

test('authoritative spawn selection avoids blocked boxes and exclusion zones', () => {
  const room = makeRoom();
  room.boundsMin = 0;
  room.boundsMax = 100;
  room.worldCollision = {
    collidables: [
      {
        min: { x: 5, y: 0, z: 5 },
        max: { x: 35, y: 8, z: 35 }
      }
    ],
    spawnExclusionZones: [
      { x: 82, z: 82, radius: 6 }
    ]
  };

  const spawn = chooseEntitySpawnPoint(room, { id: 'u3', alive: true }, {
    spawnPadding: 8,
    spawnMinClearance: 14
  });

  assert.ok(spawn, 'expected a spawn point');
  assert.equal(spawn.x > 5 && spawn.x < 35 && spawn.z > 5 && spawn.z < 35, false);
  assert.equal(((spawn.x - 82) ** 2) + ((spawn.z - 82) ** 2) <= ((6.85) ** 2), false);
});
