import test from 'node:test';
import assert from 'node:assert/strict';

import { handleRoomRequest } from '../../../cloudflare/server/room/RoomTransport.js';
import { handleRoomSocketMessage } from '../../../cloudflare/server/room/RoomSocket.js';
import { buildWelcomePayload } from '../../../cloudflare/server/room/RoomState.js';
import { buildPlayerEntity, ensurePlayer } from '../../../cloudflare/server/room/RoomRuntime.js';
import {
  buildDefaultThrowOriginAndDirection,
  canEntityUseThrowable,
  consumeThrowCharge,
  entityCorePosition,
  entityForward,
  entityRight,
  handleThrow,
  validateThrowIntent,
  spawnProjectile
} from '../../../cloudflare/server/room/RoomCombatRuntime.js';

test('room helper stack interoperates across transport, state, runtime, socket, and throw flow', async () => {
  const originalResponse = globalThis.Response;
  const originalPair = globalThis.WebSocketPair;
  const accepted = [];
  const broadcasts = [];

  class FakeResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.webSocket = init.webSocket;
    }
  }

  function createSocket(label) {
    return {
      label,
      attachment: null,
      sent: [],
      serializeAttachment(value) { this.attachment = value; },
      deserializeAttachment() { return this.attachment; },
      send(payload) { this.sent.push(payload); }
    };
  }

  globalThis.Response = FakeResponse;
  globalThis.WebSocketPair = class {
    constructor() {
      this[0] = createSocket('client');
      this[1] = createSocket('server');
    }
  };

  try {
    const room = {
      env: { ROOM_NAME: 'global' },
      roomName: 'global',
      gameMode: 'ffa',
      worldSeed: 'seed-1',
      worldProfileVersion: 6,
      worldFlags: { envV2: true, terrainPhysicsV2: false },
      boundsMin: 2,
      boundsMax: 110,
      matchState: { gameMode: 'ffa', started: false, ended: false, teamProgress: { alpha: 0, bravo: 0 }, teamBaselineSize: { alpha: 0, bravo: 0 } },
      privateRoomConfig: { teams: new Map(), roomPhase: 'active' },
      players: new Map(),
      bots: new Map(),
      clients: new Map(),
      activeSocketByUserId: new Map(),
      projectiles: new Map(),
      nextProjectileSeq: 1,
      ctx: {
        acceptWebSocket(ws) { accepted.push(ws); },
        getWebSockets() { return accepted.slice(); }
      },
      refreshWorldMeta() {},
      syncRoomFixtures() {},
      humanPlayerCount() { return this.players.size; },
      connectedHumanCount() { return this.activeSocketByUserId.size; },
      simulatedPlayerCount() { return 0; },
      startPublicMatchIfReady() {},
      ensureTick() {},
      broadcastSnapshot() {},
      send(ws, payload) { ws.send(JSON.stringify(payload)); },
      broadcast(payload) { broadcasts.push(payload); },
      getAliveEntities() { return Array.from(this.players.values()).filter((player) => player.alive); },
      isPublicMatchRoom() { return true; },
      createThrowableRuntime() { return { frag: { charges: 1, maxCharges: 1, cooldownRemaining: 0 } }; },
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
              yaw: 0,
              pitch: 0,
              alive: true,
              inputState: config.createMovementInputState(),
              throwables: config.createThrowableRuntime(),
              weaponAmmo: config.createWeaponAmmoRuntime(['rifle']),
              lastShotAt: {}
            };
          },
          createMovementInputState() { return {}; },
          createWeaponAmmoRuntime() { return {}; },
          playerEyeHeight: 1.7,
          spawnPadding: 8,
          spawnMinClearance: 14,
          nowMs: () => 50,
          playerSpawnShieldMs: 1000
        });
      },
      spawnEntityRandomly(entity) {
        entity.x = 1;
        entity.z = 2;
        entity.y = 1.7;
        entity.alive = true;
        entity.plannedSpawnPoint = null;
      },
      applySpawnShield(entity) {
        entity.spawnShieldUntil = 1050;
      },
      applyJoinBaseline() {},
      enforceEntityTerrainFloor() {},
      ensurePlayer(userId, username, classId, actorId, actorName) {
        return ensurePlayer(this, userId, username, classId, actorId, actorName, {
          isPrivateMatchRoom: () => false,
          teamAlpha: 'alpha',
          gameModeTdm: 'tdm',
          gameModeLms: 'lms',
          lmsRules: { startingLives: 3 }
        });
      },
      buildWelcomePayload(userId) {
        return buildWelcomePayload(this, userId, {
          msgType: 'welcome',
          isPrivateMatchRoom: () => false,
          roomPhaseActive: 'active',
          emptyMatchState(gameMode) {
            return { gameMode, started: false, ended: false, teamProgress: { alpha: 0, bravo: 0 }, teamBaselineSize: { alpha: 0, bravo: 0 } };
          },
          roomSimTickMs: 33,
          teamAlpha: 'alpha',
          teamBravo: 'bravo'
        });
      },
      canEntityUseThrowable(entity) {
        return canEntityUseThrowable(this, entity, 100);
      },
      isEntityMovementLocked() { return false; },
      isEntityActionRestricted() { return false; },
      consumeThrowCharge(entity, throwableId) {
        return consumeThrowCharge(entity, throwableId, {
          throwableStats: { frag: { regen: 5 } }
        });
      },
      entityCorePosition(entity) {
        return entityCorePosition(entity, { playerEyeHeight: 1.7, throwableSpawnHeight: 1.0 });
      },
      entityForward(entity) {
        return entityForward(entity, { normalize3(x, y, z) { const len = Math.sqrt(x * x + y * y + z * z) || 1; return { x: x / len, y: y / len, z: z / len }; } });
      },
      entityRight(entity) {
        return entityRight(entity, { normalize3(x, y, z) { const len = Math.sqrt(x * x + y * y + z * z) || 1; return { x: x / len, y: y / len, z: z / len }; } });
      },
      buildDefaultThrowOriginAndDirection(player) {
        return buildDefaultThrowOriginAndDirection(this, player, {
          addScaled3(origin, dir, scale) {
            return { x: origin.x + (dir.x * scale), y: origin.y + (dir.y * scale), z: origin.z + (dir.z * scale) };
          },
          throwableSpawnForward: 0.55,
          throwableSpawnLeft: 0.34
        });
      },
      validateThrowIntent(player, intent) {
        return validateThrowIntent(this, player, intent, {
          normalize3(x, y, z) { const len = Math.sqrt(x * x + y * y + z * z) || 1; return { x: x / len, y: y / len, z: z / len }; },
          distance3(a, b) { const dx = a.x - b.x; const dy = a.y - b.y; const dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); },
          dot3(a, b) { return (a.x * b.x) + (a.y * b.y) + (a.z * b.z); },
          throwIntentOriginMaxOffset: 1.2,
          throwIntentDirectionMinDot: -0.2
        });
      },
      spawnProjectile(player, throwableId, clientThrowId, throwIntent) {
        return spawnProjectile(this, player, throwableId, clientThrowId, throwIntent, null, {
          throwableStats: { frag: { speed: 10, upward: 2, hitRadius: 1.2, life: 1 } },
          nowMs: () => 100
        });
      },
      handleThrow(player, msg, ws) {
        return handleThrow(this, player, msg, ws, {
          normalizeThrowPayload(throwableId, clientThrowId, throwIntent) {
            return { throwableId, clientThrowId, throwIntent };
          },
          throwableStats: { order: ['frag'], frag: { regen: 5, speed: 10, upward: 2, hitRadius: 1.2, life: 1 } },
          nowMs: () => 100,
          msgThrowReject: 'throw_reject',
          msgThrowSpawn: 'throw_spawn',
          remoteMuzzleFlashHoldMs: 90
        });
      }
    };

    const response = await handleRoomRequest(
      room,
      new Request('https://room/connect?roomId=global&userId=u1&username=ALPHA&actorId=actor-a', {
        headers: { Upgrade: 'websocket' }
      })
    );
    assert.equal(response.status, 101);
    assert.equal(accepted.length, 1);
    assert.equal(room.players.has('u1'), true);

    const ws = accepted[0];
    handleRoomSocketMessage(room, ws, JSON.stringify({
      t: 'throw',
      throwableId: 'frag',
      clientThrowId: 'c1',
      throwIntent: {
        origin: { x: 1, y: 1.1, z: 1.66 },
        direction: { x: 0, y: 0, z: -1 }
      }
    }), {
      safeJsonParse: JSON.parse,
      nowMs: () => 100,
      handleClassCast() {},
      isPrivateMatchRoom: () => false,
      roomPhaseActive: 'active',
      msgC2s: { THROW: 'throw' },
      msgS2c: { PONG: 'pong' }
    });

    assert.equal(room.projectiles.size, 1);
    assert.deepEqual(broadcasts, [{
      t: 'throw_spawn',
      projectileId: 'proj_1',
      ownerId: 'u1',
      clientThrowId: 'c1',
      throwableId: 'frag'
    }]);
  } finally {
    globalThis.Response = originalResponse;
    globalThis.WebSocketPair = originalPair;
  }
});
