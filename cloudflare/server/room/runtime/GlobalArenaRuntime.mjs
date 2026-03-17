import { getSharedTuningWu } from '../../../lib/shared-tuning.js';
import { getSharedProtocol } from '../../../lib/shared-protocol.js';
import { createSharedTerrainSampler } from '../../../lib/shared-terrain.js';
import { WORLD_MIN, WORLD_MAX } from '../../../../shared/world-layout.js';
import { nowMs, clamp, sanitizeRoomId } from '../../transport.js';
import { chooseSpawnPoint } from '../../../../shared/spawn-logic.js';
import { getRateConfig } from '../../../../shared/rate-presets.js';
import { DEFAULT_HP_MAX, DEFAULT_ARMOR_MAX } from '../../../../shared/entity-constants.js';

import {
  recordHistorySample,
} from './lag-compensation.mjs';
import { getHeadlessWorldColliders } from './headless-world-colliders.mjs';
import {
  buildPlayerEntity as buildRoomPlayerEntity,
  buildSpawnAvoidPoints as buildRoomSpawnAvoidPoints,
  applySpawnPoint as applyRoomSpawnPoint,
  applySpawnShield as applyRoomSpawnShield,
  planEntityRespawn as planRoomEntityRespawn,
  spawnEntityRandomly as spawnRoomEntityRandomly,
  enforceTerrainFloor as enforceRoomTerrainFloor,
  applyInput as applyRoomInput,
  simulateMovement as simulateRoomPlayerMovement,
  regenArmor as regenRoomArmor,
  respawnIfNeeded as respawnRoomEntityIfNeeded
} from './RoomPlayerMotor.mjs';
import {
  emptyMatchState,
  serializeMatchState as serializeMatchStateService,
  startPublicMatchIfReady as startPublicMatchIfReadyService,
  maybeResetPublicMatch as maybeResetPublicMatchService,
  updateLeaderProgress as updateLeaderProgressService,
  finishPublicMatch as finishPublicMatchService,
  recordElimination as recordEliminationService
} from './services/match-state-service.mjs';
import {
  getPlayerResult as getPlayerResultService,
  ensurePlayerResult as ensurePlayerResultService,
  applyResultToPlayer as applyResultToPlayerService,
  syncPlayerResultFromEntity as syncPlayerResultFromEntityService,
  connectedHumanIds as connectedHumanIdsService,
  humanPlayerCount as humanPlayerCountService,
  connectedHumanCount as connectedHumanCountService,
  ensurePlayer as ensurePlayerService,
  disconnectPlayer as disconnectPlayerService
} from './services/player-state-service.mjs';
import {
  buildShotResult as buildShotResultService,
  handleFire as handleFireService
} from './services/shot-service.mjs';
import {
  getLastProcessedInputSeq as getLastProcessedInputSeqService,
  tickPlayers as tickPlayersService,
  buildSnapshot as buildSnapshotService,
  tick as tickService
} from './services/simulation-service.mjs';

const GAMEPLAY_TUNING_WU = getSharedTuningWu();
const SHARED_PROTOCOL = getSharedProtocol();
const MSG_C2S = SHARED_PROTOCOL.msg.c2s;
const MSG_S2C = SHARED_PROTOCOL.msg.s2c;
const SHARED_WORLD_DEFAULTS = SHARED_PROTOCOL.world || {};

const WORLD_PROFILE_VERSION = Math.max(1, Number(SHARED_WORLD_DEFAULTS.profileVersion || 6));
const WORLD_SEED_PREFIX = String(SHARED_WORLD_DEFAULTS.seedPrefix || 'room-env-v6-static');
const WORLD_FLAGS = {
  envV2: !!(SHARED_WORLD_DEFAULTS.flags && SHARED_WORLD_DEFAULTS.flags.envV2),
  terrainPhysicsV2: (SHARED_WORLD_DEFAULTS.flags)
    ? !!SHARED_WORLD_DEFAULTS.flags.terrainPhysicsV2
    : true
};

const WEAPON_STATS = GAMEPLAY_TUNING_WU.weaponStats || {};
const CLASS_PRESETS = GAMEPLAY_TUNING_WU.classPresets || {};

const GAME_MODE_FFA = 'ffa';
const ROOM_FULL_RESYNC_MS = 1000;
const MAX_SIM_CATCH_UP_STEPS = 5;
const MAX_HP = DEFAULT_HP_MAX;
const REMOTE_MUZZLE_FLASH_HOLD_MS = 90;
const PLAYER_EYE_HEIGHT_WU = 1.6;
const PUBLIC_ROOM_START_THRESHOLD = 2;
const PUBLIC_ROOM_SOFT_TARGET = 12;
const PUBLIC_ROOM_HARD_CAP = 16;
const FFA_TARGET_PROGRESS = 10;
const MATCH_RESET_DELAY_MS = 5000;
const PLAYER_SPAWN_PADDING_WU = 8;
const PLAYER_SPAWN_MIN_CLEARANCE_WU = 14;
const PLAYER_SPAWN_SHIELD_MS = 1000;

function classPreset() {
  return CLASS_PRESETS.ffa || CLASS_PRESETS.abilities || { armorMax: DEFAULT_ARMOR_MAX, wallhackRadius: 90 };
}

function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
  };
}

export class GlobalArenaRuntime {
  constructor(options = {}) {
    this.nowMs = typeof options.nowMs === 'function' ? options.nowMs : nowMs;
    this.rateConfig = getRateConfig(options.ratePreset);
    this.overrideWorldColliders = Array.isArray(options.worldColliders) ? options.worldColliders.slice() : null;
    this.players = new Map();
    this.playerResults = new Map();
    this.lastTickAt = this.nowMs() - this.rateConfig.simIntervalMs;
    this.lastSnapshotAt = 0;
    this.lastFullSnapshotAt = 0;
    this.lastBroadcastEntityState = new Map();
    this.gameMode = GAME_MODE_FFA;
    this.MSG_C2S = MSG_C2S;
    this.MSG_S2C = MSG_S2C;
    this.matchState = emptyMatchState(this.gameMode, FFA_TARGET_PROGRESS);
    this.roomName = options.roomName || 'global';
    this.worldSeed = '';
    this.worldProfileVersion = WORLD_PROFILE_VERSION;
    this.worldFlags = cloneWorldFlags(WORLD_FLAGS);
    this.boundsMin = Number(WORLD_MIN || 2);
    this.boundsMax = Number(WORLD_MAX || 110);
    this.worldColliders = [];
    this.broadcastFn = typeof options.broadcast === 'function' ? options.broadcast : function noop() {};
    this.simAccumulatorMs = 0;
    this.snapshotAccumulatorMs = 0;
    this.refreshWorldMeta(this.roomName);
  }

  broadcast(payload) {
    this.broadcastFn(payload);
  }

  refreshWorldMeta(roomName) {
    this.roomName = sanitizeRoomId(roomName || this.roomName || 'global');
    this.matchState.gameMode = GAME_MODE_FFA;
    this.worldSeed = `${WORLD_SEED_PREFIX}-${this.roomName}`;
    this.worldProfileVersion = WORLD_PROFILE_VERSION;
    this.worldFlags = cloneWorldFlags(WORLD_FLAGS);
    this.terrainSampler = createSharedTerrainSampler({
      worldSeed: this.worldSeed,
      worldProfileVersion: this.worldProfileVersion,
      worldFlags: cloneWorldFlags(this.worldFlags)
    });
    this.worldColliders = this.overrideWorldColliders
      ? this.overrideWorldColliders.slice()
      : (getHeadlessWorldColliders({
          worldSeed: this.worldSeed,
          worldProfileVersion: this.worldProfileVersion,
          worldFlags: cloneWorldFlags(this.worldFlags)
        }).colliders || []);
  }

  serializeMatchState() {
    return serializeMatchStateService(this.matchState, this.gameMode, FFA_TARGET_PROGRESS);
  }

  buildWelcomePayload(selfId) {
    const player = selfId ? this.players.get(String(selfId || '')) : null;
    return {
      t: MSG_S2C.WELCOME,
      selfId,
      serverTime: this.nowMs(),
      ratePreset: this.rateConfig.preset,
      renderHz: this.rateConfig.renderHz,
      simHz: this.rateConfig.simHz,
      snapshotHz: this.rateConfig.snapshotHz,
      roomId: this.roomName,
      gameMode: GAME_MODE_FFA,
      matchState: this.serializeMatchState(),
      tickRate: this.rateConfig.simHz,
      lastProcessedInputSeq: player ? Math.max(0, Number(player.lastProcessedInputSeq || 0)) : 0,
      worldSeed: this.worldSeed,
      worldProfileVersion: this.worldProfileVersion,
      worldFlags: cloneWorldFlags(this.worldFlags)
    };
  }

  buildRoomState(connectedUserIds) {
    return {
      ok: true,
      roomId: this.roomName,
      gameMode: GAME_MODE_FFA,
      matchStarted: !!(this.matchState && this.matchState.started),
      matchEnded: !!(this.matchState && this.matchState.ended),
      players: this.humanPlayerCount(),
      connectedPlayers: this.connectedHumanCount(connectedUserIds),
      simPlayers: 0,
      bots: 0,
      softTarget: PUBLIC_ROOM_SOFT_TARGET,
      hardCap: PUBLIC_ROOM_HARD_CAP
    };
  }

  connectedHumanIds(connectedUserIds) {
    return connectedHumanIdsService(this, connectedUserIds);
  }

  humanPlayerCount() {
    return humanPlayerCountService(this);
  }

  connectedHumanCount(connectedUserIds) {
    return connectedHumanCountService(this, connectedUserIds);
  }

  getPlayerResult(userId) {
    return getPlayerResultService(this, userId);
  }

  ensurePlayerResult(userId, username) {
    return ensurePlayerResultService(this, userId, username);
  }

  applyResultToPlayer(player, result) {
    return applyResultToPlayerService(this, player, result);
  }

  syncPlayerResultFromEntity(player) {
    return syncPlayerResultFromEntityService(this, player);
  }

  startPublicMatchIfReady(connectedUserIds) {
    return startPublicMatchIfReadyService(this, connectedUserIds, {
      startThreshold: PUBLIC_ROOM_START_THRESHOLD,
      targetProgress: FFA_TARGET_PROGRESS
    });
  }

  maybeResetPublicMatch(connectedUserIds) {
    return maybeResetPublicMatchService(this, connectedUserIds, {
      gameMode: this.gameMode,
      targetProgress: FFA_TARGET_PROGRESS,
      startThreshold: PUBLIC_ROOM_START_THRESHOLD
    });
  }

  updateLeaderProgress() {
    return updateLeaderProgressService(this);
  }

  finishPublicMatch(winnerId) {
    return finishPublicMatchService(this, winnerId, MATCH_RESET_DELAY_MS);
  }

  recordElimination(sourceId, targetId) {
    return recordEliminationService(this, sourceId, targetId, {
      targetProgress: FFA_TARGET_PROGRESS,
      resetDelayMs: MATCH_RESET_DELAY_MS
    });
  }

  spawnEntityRandomly(entity) {
    if (!entity) return null;
    return spawnRoomEntityRandomly({
      entity,
      chooseSpawnPoint: (nextEntity) => this.chooseEntitySpawnPoint(nextEntity),
      terrainEyeYAt: (x, z) => this.terrainEyeYAt(x, z)
    });
  }

  buildSpawnAvoidPoints(entity) {
    return buildRoomSpawnAvoidPoints(entity, this.getAliveEntities());
  }

  chooseEntitySpawnPoint(entity) {
    return chooseSpawnPoint({
      boundsMin: this.boundsMin,
      boundsMax: this.boundsMax,
      padding: PLAYER_SPAWN_PADDING_WU,
      minGroundY: -0.15,
      minClearance: PLAYER_SPAWN_MIN_CLEARANCE_WU,
      avoidPoints: this.buildSpawnAvoidPoints(entity),
      getGroundHeightAt: (x, z) => this.terrainFeetYAt(x, z)
    });
  }

  applyEntitySpawnPoint(entity, spawn) {
    applyRoomSpawnPoint(entity, spawn, (x, z) => this.terrainEyeYAt(x, z));
  }

  applySpawnShield(entity) {
    applyRoomSpawnShield(entity, this.nowMs(), PLAYER_SPAWN_SHIELD_MS);
  }

  planEntityRespawn(entity) {
    return planRoomEntityRespawn({
      entity,
      chooseSpawnPoint: (nextEntity) => this.chooseEntitySpawnPoint(nextEntity)
    });
  }

  buildPlayerEntity(userId, username) {
    return buildRoomPlayerEntity({
      userId,
      username,
      classId: 'ffa',
      eyeHeight: PLAYER_EYE_HEIGHT_WU,
      maxHp: MAX_HP,
      preset: classPreset(),
      now: this.nowMs(),
      spawnShieldMs: PLAYER_SPAWN_SHIELD_MS,
      chooseSpawnPoint: (entity) => this.chooseEntitySpawnPoint(entity),
      terrainEyeYAt: (x, z) => this.terrainEyeYAt(x, z)
    });
  }

  terrainFeetYAt(x, z) {
    if (this.worldFlags && this.worldFlags.terrainPhysicsV2 && this.terrainSampler && typeof this.terrainSampler.getGroundHeightAt === 'function') {
      return Number(this.terrainSampler.getGroundHeightAt(Number(x || 0), Number(z || 0)) || 0);
    }
    return 0;
  }

  terrainEyeYAt(x, z) {
    return this.terrainFeetYAt(x, z) + PLAYER_EYE_HEIGHT_WU;
  }

  enforceEntityTerrainFloor(entity) {
    return enforceRoomTerrainFloor({
      entity,
      terrainEyeYAt: (x, z) => this.terrainEyeYAt(x, z)
    });
  }

  ensurePlayer(userId, username) {
    return ensurePlayerService(this, userId, username);
  }

  handleInput(player, message) {
    applyRoomInput({
      entity: player,
      message,
      now: this.nowMs(),
      clamp
    });
    this.recordEntityHistory(player, this.nowMs());
  }

  getEntityById(entityId) {
    return this.players.get(entityId) || null;
  }

  getAliveEntities() {
    const out = [];
    for (const player of this.players.values()) {
      if (player && player.alive) out.push(player);
    }
    return out;
  }

  isEntitySpawnShielded(entity, timeMs = this.nowMs()) {
    return !!(entity && entity.alive && (entity.spawnShieldUntil || 0) > timeMs);
  }

  canTargetEntity(entity, sourceId = '') {
    if (!entity || !entity.alive) return false;
    if (sourceId && entity.id === sourceId) return false;
    return !this.isEntitySpawnShielded(entity);
  }

  isEntityActionLocked(entity, now = this.nowMs()) {
    if (!entity || !entity.alive) return false;
    return (entity.stunUntil || 0) > now;
  }

  recordEntityHistory(entity, timeMs = this.nowMs()) {
    return recordHistorySample(entity, timeMs);
  }

  recordAllEntityHistory(timeMs = this.nowMs()) {
    for (const player of this.players.values()) {
      this.recordEntityHistory(player, timeMs);
    }
  }

  buildShotResult(message, accepted, reason, extra = {}) {
    return buildShotResultService(this, message, accepted, reason, extra);
  }

  handleFire(player, message) {
    return handleFireService(this, player, message, {
      weaponStats: WEAPON_STATS,
      muzzleFlashHoldMs: REMOTE_MUZZLE_FLASH_HOLD_MS
    });
  }

  handleClientMessage(userId, message) {
    const player = this.players.get(userId);
    if (!player || !message || typeof message !== 'object') return null;

    const type = String(message.t || '');
    if (type === MSG_C2S.JOIN_ROOM) {
      return this.buildWelcomePayload(player.id);
    }
    if (type === MSG_C2S.INPUT) {
      this.handleInput(player, message);
      return null;
    }
    if (type === MSG_C2S.FIRE) {
      return this.handleFire(player, message);
    }
    if (type === MSG_C2S.PING) {
      return { t: MSG_S2C.PONG, clientTime: message.clientTime || 0, serverTime: this.nowMs() };
    }
    return null;
  }

  disconnectPlayer(userId) {
    return disconnectPlayerService(this, userId);
  }

  cleanupDisconnectedPlayers(_now) {
    return 0;
  }

  getLastProcessedInputSeq(userId) {
    return getLastProcessedInputSeqService(this, userId);
  }

  regenArmor(entity, dtSec) {
    regenRoomArmor({
      entity,
      dtSec,
      now: this.nowMs(),
      regenDelayMs: 6000,
      regenPerSec: 12
    });
  }

  respawnIfNeeded(entity) {
    respawnRoomEntityIfNeeded({
      entity,
      now: this.nowMs(),
      spawnShieldMs: PLAYER_SPAWN_SHIELD_MS,
      chooseSpawnPoint: (nextEntity) => this.chooseEntitySpawnPoint(nextEntity),
      terrainEyeYAt: (x, z) => this.terrainEyeYAt(x, z)
    });
  }

  simulatePlayerMovement(player, dtSec) {
    simulateRoomPlayerMovement({
      entity: player,
      dtSec,
      now: this.nowMs(),
      boundsMin: this.boundsMin,
      boundsMax: this.boundsMax,
      terrainEyeYAt: (x, z) => this.terrainEyeYAt(x, z),
      worldColliders: this.worldColliders,
      clamp
    });
  }

  tickPlayers(dtSec) {
    return tickPlayersService(this, dtSec);
  }

  buildSnapshot(forceFull = false) {
    return buildSnapshotService(this, forceFull);
  }

  tick(connectedUserIds) {
    return tickService(this, connectedUserIds, {
      maxCatchUpSteps: MAX_SIM_CATCH_UP_STEPS,
      fullResyncMs: ROOM_FULL_RESYNC_MS
    });
  }

  canStopTick(connectedCount, now = this.nowMs()) {
    void now;
    return connectedCount <= 0 && this.players.size === 0;
  }
}
