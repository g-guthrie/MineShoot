import { getSharedTuningWu } from '../../../lib/shared-tuning.js';
import { getSharedProtocol } from '../../../lib/shared-protocol.js';
import { createSharedTerrainSampler } from '../../../lib/shared-terrain.js';
import { nowMs, distance3, clamp, sanitizeRoomId } from '../../transport.js';
import { chooseSpawnPoint } from '../../../../shared/spawn-logic.js';

import { toEntityState } from '../EntitySerializer.js';
import {
  applyWeaponFalloff,
  applyDamageFromSource,
  broadcastDamageEvent,
  broadcastDeathRespawn
} from '../CombatService.js';
import {
  buildPlayerEntity as buildRoomPlayerEntity,
  buildSpawnAvoidPoints as buildRoomSpawnAvoidPoints,
  applySpawnPoint as applyRoomSpawnPoint,
  applySpawnShield as applyRoomSpawnShield,
  planEntityRespawn as planRoomEntityRespawn,
  spawnEntityRandomly as spawnRoomEntityRandomly,
  enforceTerrainFloor as enforceRoomTerrainFloor,
  applyInput as applyRoomInput,
  regenArmor as regenRoomArmor,
  respawnIfNeeded as respawnRoomEntityIfNeeded
} from './RoomPlayerMotor.mjs';
import { buildSnapshotPayload } from './RoomSimulation.mjs';

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
const ROOM_SIM_TICK_MS = 33;
const ROOM_SNAPSHOT_TICK_MS = 33;
const ROOM_FULL_RESYNC_MS = 1000;
const DISCONNECT_GRACE_MS = 15000;
const MAX_HP = 500;
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
  return CLASS_PRESETS.ffa || { armorMax: 90, wallhackRadius: 90 };
}

function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
  };
}

function emptyMatchState() {
  return {
    gameMode: GAME_MODE_FFA,
    started: false,
    ended: false,
    startedAt: 0,
    endedAt: 0,
    resetAt: 0,
    matchBaselinePlayerCount: 0,
    targetProgress: FFA_TARGET_PROGRESS,
    leaderProgress: 0,
    leaderId: '',
    winnerId: '',
    winnerTeam: ''
  };
}

export class GlobalArenaRuntime {
  constructor(options = {}) {
    this.players = new Map();
    this.lastTickAt = nowMs();
    this.lastSnapshotAt = 0;
    this.lastFullSnapshotAt = 0;
    this.lastBroadcastEntityState = new Map();
    this.matchState = emptyMatchState();
    this.roomName = options.roomName || 'global';
    this.worldSeed = '';
    this.worldProfileVersion = WORLD_PROFILE_VERSION;
    this.worldFlags = cloneWorldFlags(WORLD_FLAGS);
    this.boundsMin = 2;
    this.boundsMax = 110;
    this.broadcastFn = typeof options.broadcast === 'function' ? options.broadcast : function noop() {};
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
  }

  serializeMatchState() {
    const match = this.matchState || emptyMatchState();
    return {
      gameMode: GAME_MODE_FFA,
      started: !!match.started,
      ended: !!match.ended,
      startedAt: match.startedAt || 0,
      endedAt: match.endedAt || 0,
      resetAt: match.resetAt || 0,
      matchBaselinePlayerCount: match.matchBaselinePlayerCount || 0,
      targetProgress: Number(match.targetProgress || 0),
      leaderProgress: Number(match.leaderProgress || 0),
      leaderId: match.leaderId || '',
      winnerId: match.winnerId || '',
      winnerTeam: ''
    };
  }

  buildWelcomePayload(selfId) {
    return {
      t: MSG_S2C.WELCOME,
      selfId,
      roomId: this.roomName,
      gameMode: GAME_MODE_FFA,
      matchState: this.serializeMatchState(),
      tickRate: Math.round(1000 / ROOM_SIM_TICK_MS),
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
    const out = [];
    const source = Array.isArray(connectedUserIds) ? connectedUserIds : [];
    for (let i = 0; i < source.length; i++) {
      const player = this.players.get(source[i]);
      if (!player) continue;
      out.push(player.id);
    }
    return out;
  }

  humanPlayerCount() {
    return this.players.size;
  }

  connectedHumanCount(connectedUserIds) {
    return this.connectedHumanIds(connectedUserIds).length;
  }

  startPublicMatchIfReady(connectedUserIds) {
    if (this.matchState.started || this.matchState.ended) return false;
    const connectedCount = this.connectedHumanCount(connectedUserIds);
    if (connectedCount < PUBLIC_ROOM_START_THRESHOLD) return false;

    const now = nowMs();
    this.matchState.started = true;
    this.matchState.ended = false;
    this.matchState.startedAt = now;
    this.matchState.endedAt = 0;
    this.matchState.resetAt = 0;
    this.matchState.winnerId = '';
    this.matchState.leaderId = '';
    this.matchState.leaderProgress = 0;
    this.matchState.matchBaselinePlayerCount = connectedCount;
    this.matchState.targetProgress = FFA_TARGET_PROGRESS;

    for (const player of this.players.values()) {
      if (!player) continue;
      player.progressScore = Math.max(0, Number(player.kills || 0));
    }
    this.updateLeaderProgress();
    return true;
  }

  maybeResetPublicMatch(connectedUserIds) {
    if (!this.matchState || !this.matchState.ended) return false;
    if ((this.matchState.resetAt || 0) > nowMs()) return false;

    this.matchState = emptyMatchState();
    for (const player of this.players.values()) {
      if (!player) continue;
      player.progressScore = 0;
      player.kills = 0;
      player.deaths = 0;
      player.plannedSpawnPoint = null;
    }
    this.startPublicMatchIfReady(connectedUserIds);
    return true;
  }

  updateLeaderProgress() {
    let leaderId = '';
    let leaderProgress = 0;
    for (const player of this.players.values()) {
      if (!player) continue;
      const progress = Number(player.progressScore || 0);
      if (progress >= leaderProgress) {
        leaderProgress = progress;
        leaderId = player.id;
      }
    }
    this.matchState.leaderId = leaderId;
    this.matchState.leaderProgress = Number(leaderProgress.toFixed(3));
  }

  finishPublicMatch(winnerId) {
    if (!this.matchState || this.matchState.ended) return false;
    const now = nowMs();
    this.matchState.ended = true;
    this.matchState.endedAt = now;
    this.matchState.resetAt = now + MATCH_RESET_DELAY_MS;
    this.matchState.winnerId = winnerId || '';
    return true;
  }

  recordElimination(sourceId, targetId) {
    if (!this.matchState || !this.matchState.started || this.matchState.ended) return;
    const source = this.getEntityById(sourceId);
    const target = this.getEntityById(targetId);
    if (!source || !target || source.id === target.id) return;

    source.kills = Math.max(0, Number(source.kills || 0)) + 1;
    target.deaths = Math.max(0, Number(target.deaths || 0)) + 1;
    source.progressScore = Math.max(0, Number(source.kills || 0));
    this.updateLeaderProgress();

    if (Number(source.kills || 0) >= Number(this.matchState.targetProgress || FFA_TARGET_PROGRESS)) {
      this.finishPublicMatch(source.id);
    }
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
    applyRoomSpawnShield(entity, nowMs(), PLAYER_SPAWN_SHIELD_MS);
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
      now: nowMs(),
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
    if (this.players.has(userId)) {
      const player = this.players.get(userId);
      player.username = username || player.username;
      player.disconnectedAt = 0;
      player.weaponId = 'rifle';
      this.enforceEntityTerrainFloor(player);
      return player;
    }

    const player = this.buildPlayerEntity(userId, username);
    this.players.set(userId, player);
    return player;
  }

  handleInput(player, message) {
    applyRoomInput({
      entity: player,
      message,
      now: nowMs(),
      boundsMin: this.boundsMin,
      boundsMax: this.boundsMax,
      terrainEyeYAt: (x, z) => this.terrainEyeYAt(x, z),
      clamp
    });
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

  isEntitySpawnShielded(entity) {
    return !!(entity && entity.alive && (entity.spawnShieldUntil || 0) > nowMs());
  }

  canTargetEntity(entity, sourceId = '') {
    if (!entity || !entity.alive) return false;
    if (sourceId && entity.id === sourceId) return false;
    return !this.isEntitySpawnShielded(entity);
  }

  isEntityActionLocked(entity, now = nowMs()) {
    if (!entity || !entity.alive) return false;
    return (entity.stunUntil || 0) > now;
  }

  handleFire(player, message) {
    if (!player || !player.alive) return;
    if (this.isEntityActionLocked(player)) return;

    const weaponId = 'rifle';
    const stats = WEAPON_STATS[weaponId];
    if (!stats) return;

    const now = nowMs();
    const previousShotAt = player.lastShotAt[weaponId] || 0;
    if ((now - previousShotAt) < stats.cooldownMs) return;
    player.lastShotAt[weaponId] = now;
    player.weaponId = weaponId;
    player.muzzleFlashUntil = now + REMOTE_MUZZLE_FLASH_HOLD_MS;

    const targetId = String(message.targetId || '');
    const hitType = message.hitType === 'head' ? 'head' : 'body';
    const shotToken = String(message.shotToken || '');
    if (!targetId) return;

    const target = this.getEntityById(targetId);
    if (!this.canTargetEntity(target, player.id)) return;

    const distance = distance3(player, target);
    let effectiveMaxRange = Number(stats.maxRange || 0);
    if (stats.infiniteRange) {
      effectiveMaxRange = Infinity;
    } else if (message && message.adsActive) {
      effectiveMaxRange *= Math.max(1, Number(stats.adsHitscanRangeMultiplier || 1));
    }
    if (distance > effectiveMaxRange) return;

    let damage = hitType === 'head' ? stats.headDamage : stats.bodyDamage;
    damage = applyWeaponFalloff(weaponId, damage, distance);
    const out = applyDamageFromSource(player, target, damage, {
      hitType,
      weaponId,
      sourceKind: 'weapon'
    });
    if (!out) return;

    broadcastDamageEvent(this, player.id, target, out, hitType, weaponId, shotToken);
    if (out.killed) {
      broadcastDeathRespawn(this, target);
    }
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
      this.handleFire(player, message);
      return null;
    }
    if (type === MSG_C2S.PING) {
      return { t: MSG_S2C.PONG, clientTime: message.clientTime || 0, serverTime: nowMs() };
    }
    return null;
  }

  disconnectPlayer(userId) {
    const player = this.players.get(userId);
    if (player) {
      player.disconnectedAt = nowMs();
    }
  }

  cleanupDisconnectedPlayers(now) {
    const removeIds = [];
    for (const player of this.players.values()) {
      if (!player) continue;
      if (!player.disconnectedAt) continue;
      if ((now - player.disconnectedAt) < DISCONNECT_GRACE_MS) continue;
      removeIds.push(player.id);
    }
    for (let i = 0; i < removeIds.length; i++) {
      this.players.delete(removeIds[i]);
    }
  }

  regenArmor(entity, dtSec) {
    regenRoomArmor({
      entity,
      dtSec,
      now: nowMs(),
      regenDelayMs: 6000,
      regenPerSec: 12
    });
  }

  respawnIfNeeded(entity) {
    respawnRoomEntityIfNeeded({
      entity,
      now: nowMs(),
      spawnShieldMs: PLAYER_SPAWN_SHIELD_MS,
      chooseSpawnPoint: (nextEntity) => this.chooseEntitySpawnPoint(nextEntity),
      terrainEyeYAt: (x, z) => this.terrainEyeYAt(x, z)
    });
  }

  tickPlayers(dtSec) {
    for (const player of this.players.values()) {
      this.respawnIfNeeded(player);
      this.regenArmor(player, dtSec);
    }
  }

  buildSnapshot(forceFull = false) {
    const entities = [];
    for (const player of this.players.values()) {
      entities.push(player);
    }

    const snapshot = buildSnapshotPayload({
      messageType: MSG_S2C.SNAPSHOT,
      serverTime: nowMs(),
      gameMode: GAME_MODE_FFA,
      matchState: this.serializeMatchState(),
      entities,
      toEntityState,
      previousState: this.lastBroadcastEntityState,
      forceFull
    });

    this.lastBroadcastEntityState = snapshot.nextEntityState;
    return snapshot.payload;
  }

  tick(connectedUserIds) {
    const now = nowMs();
    const dtSec = Math.max(0.001, Math.min(0.2, (now - this.lastTickAt) / 1000));
    this.lastTickAt = now;

    this.cleanupDisconnectedPlayers(now);
    this.maybeResetPublicMatch(connectedUserIds);
    this.startPublicMatchIfReady(connectedUserIds);
    this.tickPlayers(dtSec);
    this.updateLeaderProgress();

    if ((now - this.lastSnapshotAt) >= ROOM_SNAPSHOT_TICK_MS) {
      const forceFull = (now - this.lastFullSnapshotAt) >= ROOM_FULL_RESYNC_MS;
      const payload = this.buildSnapshot(forceFull);
      this.lastSnapshotAt = now;
      if (forceFull) this.lastFullSnapshotAt = now;
      return payload;
    }

    return null;
  }

  canStopTick(connectedCount, now = nowMs()) {
    if (connectedCount > 0) return false;
    for (const player of this.players.values()) {
      if (!player) continue;
      if (!player.disconnectedAt) return false;
      if ((now - player.disconnectedAt) < DISCONNECT_GRACE_MS) return false;
    }
    return true;
  }
}
