import { DurableObject } from 'cloudflare:workers';
import { getSharedTuningWu } from '../../lib/shared-tuning.js';
import { getSharedProtocol } from '../../lib/shared-protocol.js';
import { createSharedTerrainSampler } from '../../lib/shared-terrain.js';
import {
  nowMs,
  safeJsonParse,
  sanitizeRoomId,
  json,
  distance3,
  normalize3,
  addScaled3,
  dot3,
  clamp
} from '../transport.js';
import { getSeekProfileByWeaponId, resolveSeekAimProfile } from '../../../shared/seek-profiles.js';
import { selectSeekTarget } from '../../../shared/seek-core.js';
import { chooseSpawnPoint } from '../../../shared/spawn-logic.js';

import { toEntityState, toProjectileState, toFireZoneState } from './EntitySerializer.js';
import { ensureBots, tickBots } from './BotAI.js';
import {
  applyWeaponFalloff,
  applyDamageFromSource,
  broadcastDamageEvent,
  broadcastDeathRespawn
} from './CombatService.js';
import { tickProjectiles, tickFireZones } from './ProjectileService.js';
import { handleClassCast, tickClassAbilityState } from './AbilityService.js';

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

const CLASS_PRESETS = GAMEPLAY_TUNING_WU.classPresets;
const WEAPON_STATS = GAMEPLAY_TUNING_WU.weaponStats;
const THROWABLE_STATS = GAMEPLAY_TUNING_WU.throwables;
const ABILITY_CATALOG = GAMEPLAY_TUNING_WU.abilityCatalog || {};
const DEFAULT_ABILITY_LOADOUT = GAMEPLAY_TUNING_WU.defaultAbilityLoadout || { slot1: 'choke', slot2: 'deadeye' };
const CLASS_DEFAULT_WEAPON = {
  abilities: 'rifle'
};

const ROOM_SIM_TICK_MS = 33;
const ROOM_SNAPSHOT_TICK_MS = 33;
const ROOM_FULL_RESYNC_MS = 1000;
const DISCONNECT_GRACE_MS = 15000;
const MAX_HP = 500;
const REMOTE_MUZZLE_FLASH_HOLD_MS = 90;
const PLAYER_EYE_HEIGHT_WU = 1.6;
const THROWABLE_SPAWN_FORWARD_WU = 0.55;
const THROWABLE_SPAWN_LEFT_WU = 0.34;
const THROWABLE_SPAWN_HEIGHT_WU = 1.0;
const THROW_INTENT_ORIGIN_MAX_OFFSET_WU = 1.2;
const THROW_INTENT_DIRECTION_MIN_DOT = -0.2;
const SHOTGUN_BURST_WINDOW_MS = 220;
const DEV_LOCAL_ROOM_NAME = 'dev-local';
const LOCAL_SHARED_ROOM_NAME = 'local-shared';
const SOLO_CLOUDFLARE_ROOM_PREFIX = 'cf-solo-';
const PUBLIC_FFA_ROOM_PREFIX = 'ffa-';
const PUBLIC_TDM_ROOM_PREFIX = 'tdm-';
const PRIVATE_SHARE_ROOM_PREFIX = 'private-';
const DEV_LOCAL_BOT_COUNT = 2;
const DEV_LOCAL_SIM_PLAYER_IDS = ['sim-player-1', 'sim-player-2'];
const DEV_LOCAL_SIM_PLAYER_NAMES = ['SIM_PLAYER_1', 'SIM_PLAYER_2'];
const GAME_MODE_FFA = 'ffa';
const GAME_MODE_TDM = 'tdm';
const TDM_TEAM_A = 'alpha';
const TDM_TEAM_B = 'bravo';
const PUBLIC_ROOM_START_THRESHOLD = 8;
const PUBLIC_ROOM_SOFT_TARGET = 12;
const PUBLIC_ROOM_HARD_CAP = 16;
const FFA_TARGET_PROGRESS = 10;
const TDM_TARGET_PROGRESS = 10;
const MATCH_RESET_DELAY_MS = 5000;
const PLAYER_SPAWN_PADDING_WU = 8;
const PLAYER_SPAWN_MIN_CLEARANCE_WU = 14;
const PLAYER_SPAWN_SHIELD_MS = 1000;

function classPreset(classId) {
  return CLASS_PRESETS[classId] || CLASS_PRESETS.abilities;
}

function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
  };
}

function detectGameMode(roomName) {
  const room = String(roomName || '');
  if (room.startsWith(PUBLIC_TDM_ROOM_PREFIX)) return GAME_MODE_TDM;
  if (room.startsWith(PUBLIC_FFA_ROOM_PREFIX)) return GAME_MODE_FFA;
  return '';
}

function isPublicMatchRoom(roomName) {
  return detectGameMode(roomName) === GAME_MODE_FFA || detectGameMode(roomName) === GAME_MODE_TDM;
}

function emptyMatchState(gameMode) {
  return {
    gameMode: gameMode || '',
    started: false,
    ended: false,
    startedAt: 0,
    endedAt: 0,
    resetAt: 0,
    matchBaselinePlayerCount: 0,
    targetProgress: gameMode === GAME_MODE_TDM ? TDM_TARGET_PROGRESS : FFA_TARGET_PROGRESS,
    leaderProgress: 0,
    leaderId: '',
    winnerId: '',
    winnerTeam: '',
    teamProgress: {
      [TDM_TEAM_A]: 0,
      [TDM_TEAM_B]: 0
    },
    teamBaselineSize: {
      [TDM_TEAM_A]: 0,
      [TDM_TEAM_B]: 0
    }
  };
}

export class GlobalArenaRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.clients = new Map();
    this.players = new Map();
    this.bots = new Map();
    this.tickHandle = null;
    this.lastTickAt = nowMs();
    this.lastSnapshotAt = 0;
    this.lastFullSnapshotAt = 0;
    this.lastBroadcastEntityState = new Map();
    this.roomName = env.ROOM_NAME || 'global';
    this.worldSeed = '';
    this.worldProfileVersion = WORLD_PROFILE_VERSION;
    this.worldFlags = cloneWorldFlags(WORLD_FLAGS);
    this.refreshWorldMeta();
    this.boundsMin = 2;
    this.boundsMax = 110;
    this.projectiles = new Map();
    this.fireZones = new Map();
    this.nextProjectileSeq = 1;
    this.nextFireZoneSeq = 1;
    this.gameMode = detectGameMode(this.roomName);
    this.matchState = emptyMatchState(this.gameMode);
  }

  refreshWorldMeta() {
    this.roomName = sanitizeRoomId(this.roomName || this.env.ROOM_NAME || 'global');
    this.gameMode = detectGameMode(this.roomName);
    if (!this.matchState || this.matchState.gameMode !== this.gameMode) {
      this.matchState = emptyMatchState(this.gameMode);
    }
    this.worldSeed = `${WORLD_SEED_PREFIX}-${this.roomName}`;
    this.worldProfileVersion = WORLD_PROFILE_VERSION;
    this.worldFlags = cloneWorldFlags(WORLD_FLAGS);
    this.terrainSampler = createSharedTerrainSampler({
      worldSeed: this.worldSeed,
      worldProfileVersion: this.worldProfileVersion,
      worldFlags: cloneWorldFlags(this.worldFlags)
    });
  }

  buildWelcomePayload(selfId) {
    return {
      t: MSG_S2C.WELCOME,
      selfId,
      roomId: this.roomName,
      gameMode: this.gameMode || '',
      matchState: this.serializeMatchState(),
      tickRate: Math.round(1000 / ROOM_SIM_TICK_MS),
      worldSeed: this.worldSeed,
      worldProfileVersion: this.worldProfileVersion,
      worldFlags: cloneWorldFlags(this.worldFlags)
    };
  }

  ensureTick() {
    if (this.tickHandle) return;
    this.lastTickAt = nowMs();
    this.lastSnapshotAt = 0;
    this.lastFullSnapshotAt = 0;
    this.tickHandle = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error('tick error', err);
      }
    }, ROOM_SIM_TICK_MS);
  }

  stopTickIfEmpty() {
    if (this.clients.size > 0) return;
    for (const player of this.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      return;
    }
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    this.roomName = sanitizeRoomId(url.searchParams.get('roomId') || this.roomName || this.env.ROOM_NAME || 'global');
    this.refreshWorldMeta();

    if (request.headers.get('Upgrade') !== 'websocket') {
      if (url.pathname === '/state') {
        return json({
          ok: true,
          roomId: this.roomName,
          gameMode: this.gameMode || '',
          matchStarted: !!(this.matchState && this.matchState.started),
          matchEnded: !!(this.matchState && this.matchState.ended),
          players: this.humanPlayerCount(),
          connectedPlayers: this.connectedHumanCount(),
          simPlayers: this.simulatedPlayerCount(),
          bots: this.bots.size,
          softTarget: PUBLIC_ROOM_SOFT_TARGET,
          hardCap: PUBLIC_ROOM_HARD_CAP
        });
      }
      return new Response('Expected websocket upgrade', { status: 426 });
    }

    this.syncRoomFixtures();

    const userId = url.searchParams.get('userId');
    const username = url.searchParams.get('username') || 'player';
    const classId = 'abilities';

    if (!userId) {
      return new Response('Missing userId', { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, username, classId });

    this.ensurePlayer(userId, username, classId);
    this.clients.set(server, { userId });
    this.startPublicMatchIfReady();
    this.ensureTick();

    this.send(server, this.buildWelcomePayload(userId));

    this.broadcastSnapshot(true);

    return new Response(null, { status: 101, webSocket: client });
  }

  isDevLocalRoom() {
    return this.roomName === DEV_LOCAL_ROOM_NAME;
  }

  usesConfiguredBots() {
    if (this.roomName === LOCAL_SHARED_ROOM_NAME) return true;
    if (this.roomName.startsWith(SOLO_CLOUDFLARE_ROOM_PREFIX)) return true;
    if (this.roomName === 'global') return false;
    if (this.roomName.startsWith(PUBLIC_FFA_ROOM_PREFIX)) return false;
    if (this.roomName.startsWith(PUBLIC_TDM_ROOM_PREFIX)) return false;
    if (this.roomName.startsWith(PRIVATE_SHARE_ROOM_PREFIX)) return false;
    return false;
  }

  isPublicMatchRoom() {
    return isPublicMatchRoom(this.roomName);
  }

  serializeMatchState() {
    const match = this.matchState || emptyMatchState(this.gameMode);
    return {
      gameMode: match.gameMode || '',
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
      winnerTeam: match.winnerTeam || '',
      teamProgress: {
        [TDM_TEAM_A]: Number((match.teamProgress && match.teamProgress[TDM_TEAM_A]) || 0),
        [TDM_TEAM_B]: Number((match.teamProgress && match.teamProgress[TDM_TEAM_B]) || 0)
      },
      teamBaselineSize: {
        [TDM_TEAM_A]: Number((match.teamBaselineSize && match.teamBaselineSize[TDM_TEAM_A]) || 0),
        [TDM_TEAM_B]: Number((match.teamBaselineSize && match.teamBaselineSize[TDM_TEAM_B]) || 0)
      }
    };
  }

  connectedHumanIds() {
    const ids = [];
    for (const meta of this.clients.values()) {
      if (!meta || !meta.userId) continue;
      const player = this.players.get(meta.userId);
      if (!player || player.fixtureType === 'sim_player') continue;
      ids.push(player.id);
    }
    return ids;
  }

  currentFfaAverageProgress() {
    const connectedIds = this.connectedHumanIds();
    if (!connectedIds.length) return 0;
    let total = 0;
    for (let i = 0; i < connectedIds.length; i++) {
      const player = this.players.get(connectedIds[i]);
      total += Number((player && player.progressScore) || 0);
    }
    return total / connectedIds.length;
  }

  assignPlayerToCurrentTeam(player) {
    if (!player) return '';
    const progress = (this.matchState && this.matchState.teamProgress) || {};
    let alphaCount = 0;
    let bravoCount = 0;
    for (const p of this.players.values()) {
      if (!p || p.fixtureType === 'sim_player' || p.id === player.id) continue;
      if (p.teamId === TDM_TEAM_A) alphaCount++;
      else if (p.teamId === TDM_TEAM_B) bravoCount++;
    }
    let teamId = TDM_TEAM_A;
    if (alphaCount > bravoCount) {
      teamId = TDM_TEAM_B;
    } else if (alphaCount === bravoCount) {
      const alphaProgress = Number(progress[TDM_TEAM_A] || 0);
      const bravoProgress = Number(progress[TDM_TEAM_B] || 0);
      teamId = alphaProgress <= bravoProgress ? TDM_TEAM_A : TDM_TEAM_B;
    }
    player.teamId = teamId;
    return teamId;
  }

  applyJoinBaseline(player) {
    if (!player || !this.isPublicMatchRoom()) return;
    if (this.gameMode === GAME_MODE_FFA) {
      player.teamId = '';
      player.progressScore = 0;
      return;
    }
    if (this.gameMode === GAME_MODE_TDM) {
      const teamId = this.assignPlayerToCurrentTeam(player);
      const teamProgress = (this.matchState && this.matchState.teamProgress)
        ? Number(this.matchState.teamProgress[teamId] || 0)
        : 0;
      player.progressScore = Number(teamProgress.toFixed(3));
    }
  }

  startPublicMatchIfReady() {
    if (!this.isPublicMatchRoom()) return false;
    if (!this.matchState) this.matchState = emptyMatchState(this.gameMode);
    if (this.matchState.started || this.matchState.ended) return false;
    const connectedCount = this.connectedHumanCount();
    if (connectedCount < PUBLIC_ROOM_START_THRESHOLD) return false;
    const now = nowMs();
    this.matchState.started = true;
    this.matchState.ended = false;
    this.matchState.startedAt = now;
    this.matchState.endedAt = 0;
    this.matchState.resetAt = 0;
    this.matchState.winnerId = '';
    this.matchState.winnerTeam = '';
    this.matchState.targetProgress = this.gameMode === GAME_MODE_TDM ? TDM_TARGET_PROGRESS : FFA_TARGET_PROGRESS;
    this.matchState.matchBaselinePlayerCount = connectedCount;
    this.matchState.teamProgress = {
      [TDM_TEAM_A]: 0,
      [TDM_TEAM_B]: 0
    };
    this.matchState.teamBaselineSize = {
      [TDM_TEAM_A]: 0,
      [TDM_TEAM_B]: 0
    };

    if (this.gameMode === GAME_MODE_FFA) {
      for (const player of this.players.values()) {
        if (!player || player.fixtureType === 'sim_player') continue;
        player.teamId = '';
        player.progressScore = Math.max(0, Number(player.kills || 0));
      }
    } else if (this.gameMode === GAME_MODE_TDM) {
      for (const player of this.players.values()) {
        if (!player || player.fixtureType === 'sim_player') continue;
        this.assignPlayerToCurrentTeam(player);
      }
      let alphaSize = 0;
      let bravoSize = 0;
      for (const player of this.players.values()) {
        if (!player || player.fixtureType === 'sim_player') continue;
        if (player.teamId === TDM_TEAM_A) alphaSize++;
        else if (player.teamId === TDM_TEAM_B) bravoSize++;
      }
      this.matchState.teamBaselineSize[TDM_TEAM_A] = Math.max(1, alphaSize);
      this.matchState.teamBaselineSize[TDM_TEAM_B] = Math.max(1, bravoSize);
      for (const player of this.players.values()) {
        if (!player || player.fixtureType === 'sim_player') continue;
        player.progressScore = 0;
      }
    }
    return true;
  }

  maybeResetPublicMatch() {
    if (!this.isPublicMatchRoom() || !this.matchState || !this.matchState.ended) return false;
    if ((this.matchState.resetAt || 0) > nowMs()) return false;
    this.matchState = emptyMatchState(this.gameMode);
    for (const player of this.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      player.progressScore = 0;
      player.teamId = '';
      player.kills = 0;
      player.deaths = 0;
      player.plannedSpawnPoint = null;
    }
    this.startPublicMatchIfReady();
    return true;
  }

  updateLeaderProgress() {
    if (!this.matchState) return;
    if (this.gameMode === GAME_MODE_FFA) {
      let leaderId = '';
      let leaderProgress = 0;
      for (const player of this.players.values()) {
        if (!player || player.fixtureType === 'sim_player') continue;
        const progress = Number(player.progressScore || 0);
        if (progress >= leaderProgress) {
          leaderProgress = progress;
          leaderId = player.id;
        }
      }
      this.matchState.leaderId = leaderId;
      this.matchState.leaderProgress = Number(leaderProgress.toFixed(3));
      return;
    }
    const alpha = Number((this.matchState.teamProgress && this.matchState.teamProgress[TDM_TEAM_A]) || 0);
    const bravo = Number((this.matchState.teamProgress && this.matchState.teamProgress[TDM_TEAM_B]) || 0);
    this.matchState.leaderId = '';
    this.matchState.leaderProgress = Number(Math.max(alpha, bravo).toFixed(3));
  }

  finishPublicMatch(winnerId, winnerTeam) {
    if (!this.isPublicMatchRoom() || !this.matchState || this.matchState.ended) return false;
    const now = nowMs();
    this.matchState.ended = true;
    this.matchState.endedAt = now;
    this.matchState.resetAt = now + MATCH_RESET_DELAY_MS;
    this.matchState.winnerId = winnerId || '';
    this.matchState.winnerTeam = winnerTeam || '';
    return true;
  }

  recordElimination(sourceId, targetId) {
    if (!this.isPublicMatchRoom() || !this.matchState || !this.matchState.started || this.matchState.ended) return;
    const source = this.getEntityById(sourceId);
    const target = this.getEntityById(targetId);
    if (!source || !target || source.id === target.id) return;
    if (source.fixtureType === 'sim_player' || target.fixtureType === 'sim_player') return;
    source.kills = Math.max(0, Number(source.kills || 0)) + 1;
    target.deaths = Math.max(0, Number(target.deaths || 0)) + 1;

    if (this.gameMode === GAME_MODE_FFA) {
      source.progressScore = Math.max(0, Number(source.kills || 0));
      this.updateLeaderProgress();
      if (Number(source.kills || 0) >= Number(this.matchState.targetProgress || FFA_TARGET_PROGRESS)) {
        this.finishPublicMatch(source.id, '');
      }
      return;
    }

    if (this.gameMode === GAME_MODE_TDM) {
      const teamId = source.teamId || this.assignPlayerToCurrentTeam(source);
      if (!teamId) return;
      const baseline = Math.max(1, Number((this.matchState.teamBaselineSize && this.matchState.teamBaselineSize[teamId]) || 1));
      const nextProgress = Number(((this.matchState.teamProgress && this.matchState.teamProgress[teamId]) || 0) + (1 / baseline));
      this.matchState.teamProgress[teamId] = Number(nextProgress.toFixed(3));
      for (const player of this.players.values()) {
        if (!player || player.fixtureType === 'sim_player') continue;
        if (player.teamId === teamId) {
          player.progressScore = this.matchState.teamProgress[teamId];
        }
      }
      this.updateLeaderProgress();
      if (this.matchState.teamProgress[teamId] >= Number(this.matchState.targetProgress || TDM_TARGET_PROGRESS)) {
        this.finishPublicMatch('', teamId);
      }
    }
  }

  desiredBotCount() {
    if (this.isDevLocalRoom()) return DEV_LOCAL_BOT_COUNT;
    if (!this.usesConfiguredBots()) return 0;
    return Math.max(0, Number(this.env.BOT_COUNT || '6'));
  }

  humanPlayerCount() {
    let count = 0;
    for (const player of this.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      count++;
    }
    return count;
  }

  connectedHumanCount() {
    let count = 0;
    for (const meta of this.clients.values()) {
      if (!meta || !meta.userId) continue;
      const player = this.players.get(meta.userId);
      if (!player || player.fixtureType === 'sim_player') continue;
      count++;
    }
    return count;
  }

  simulatedPlayerCount() {
    let count = 0;
    for (const player of this.players.values()) {
      if (player && player.fixtureType === 'sim_player') count++;
    }
    return count;
  }

  spawnEntityRandomly(entity) {
    if (!entity) return;
    const spawn = this.chooseEntitySpawnPoint(entity);
    this.applyEntitySpawnPoint(entity, spawn);
    entity.plannedSpawnPoint = null;
  }

  buildSpawnAvoidPoints(entity) {
    const avoidPoints = [];
    const selfId = entity && entity.id ? entity.id : '';
    const entities = this.getAliveEntities();
    for (let i = 0; i < entities.length; i++) {
      const other = entities[i];
      if (!other || !other.alive || other.id === selfId) continue;
      avoidPoints.push({
        x: Number(other.x || 0),
        z: Number(other.z || 0)
      });
    }
    return avoidPoints;
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
    if (!entity || !spawn) return;
    entity.x = Number(spawn.x || 0);
    entity.z = Number(spawn.z || 0);
    if (entity.kind === 'player') {
      entity.y = this.terrainEyeYAt(entity.x, entity.z);
    } else if (!Number.isFinite(entity.y)) {
      entity.y = PLAYER_EYE_HEIGHT_WU;
    }
  }

  applySpawnShield(entity) {
    if (!entity) return;
    entity.spawnShieldUntil = nowMs() + PLAYER_SPAWN_SHIELD_MS;
  }

  planEntityRespawn(entity) {
    if (!entity) return null;
    const spawn = this.chooseEntitySpawnPoint(entity);
    entity.plannedSpawnPoint = {
      x: Number(spawn.x || 0),
      z: Number(spawn.z || 0)
    };
    return entity.plannedSpawnPoint;
  }

  buildPlayerEntity(userId, username, classId, options = null) {
    const opts = options || {};
    const nextClassId = 'abilities';
    const preset = classPreset(nextClassId);
    const p = {
      id: userId,
      kind: 'player',
      username,
      classId: nextClassId,
      fixtureType: opts.fixtureType || '',
      abilityLoadout: { slot1: DEFAULT_ABILITY_LOADOUT.slot1, slot2: DEFAULT_ABILITY_LOADOUT.slot2 },
      x: 0,
      y: PLAYER_EYE_HEIGHT_WU,
      z: 0,
      yaw: Number(opts.yaw || 0),
      pitch: Number(opts.pitch || 0),
      hp: MAX_HP,
      hpMax: MAX_HP,
      armor: preset.armorMax,
      armorMax: preset.armorMax,
      wallhackRadius: preset.wallhackRadius,
      alive: true,
      respawnAt: 0,
      plannedSpawnPoint: null,
      spawnShieldUntil: 0,
      lastDamageAt: 0,
      seq: 0,
      lastShotAt: {},
      shotBurstState: {},
      weaponId: 'rifle',
      moveSpeedNorm: 0,
      sprinting: false,
      streamHeat: 0,
      streamOverheatedUntil: 0,
      muzzleFlashUntil: 0,
      throwables: this.createThrowableRuntime(),
      lastThrowAt: 0,
      kills: 0,
      deaths: 0,
      progressScore: 0,
      teamId: '',
      disconnectedAt: 0,
      abilityCooldownUntil: 0,
      ultimateCooldownUntil: 0,
      stunUntil: 0,
      slowUntil: 0,
      slowMultiplier: 1,
      deadeye: null,
      chokeState: null,
      chokeVictimState: null,
      hookState: null,
      hookPullState: null,
      healState: null
    };

    this.spawnEntityRandomly(p);
    this.applySpawnShield(p);
    return p;
  }

  syncSimulatedPlayers() {
    const allowed = {};
    for (let i = 0; i < DEV_LOCAL_SIM_PLAYER_IDS.length; i++) {
      allowed[DEV_LOCAL_SIM_PLAYER_IDS[i]] = true;
    }

    if (!this.isDevLocalRoom()) {
      const toRemove = [];
      for (const player of this.players.values()) {
        if (player && player.fixtureType === 'sim_player') toRemove.push(player.id);
      }
      for (let i = 0; i < toRemove.length; i++) {
        this.players.delete(toRemove[i]);
      }
      return;
    }

    for (let i = 0; i < DEV_LOCAL_SIM_PLAYER_IDS.length; i++) {
      const id = DEV_LOCAL_SIM_PLAYER_IDS[i];
      const username = DEV_LOCAL_SIM_PLAYER_NAMES[i];
      if (!this.players.has(id)) {
        this.players.set(id, this.buildPlayerEntity(id, username, 'abilities', { fixtureType: 'sim_player' }));
        continue;
      }
      const player = this.players.get(id);
      player.fixtureType = 'sim_player';
      player.kind = 'player';
      player.username = username;
      player.classId = 'abilities';
      player.moveSpeedNorm = 0;
      player.sprinting = false;
      player.yaw = 0;
      player.pitch = 0;
      this.enforceEntityTerrainFloor(player);
    }

    const extra = [];
    for (const player of this.players.values()) {
      if (!player || player.fixtureType !== 'sim_player') continue;
      if (!allowed[player.id]) extra.push(player.id);
    }
    for (let i = 0; i < extra.length; i++) {
      this.players.delete(extra[i]);
    }
  }

  syncRoomFixtures() {
    this.syncSimulatedPlayers();
    ensureBots(this);
  }

  ensurePlayer(userId, username, classId) {
    if (this.players.has(userId)) {
      const p = this.players.get(userId);
      p.username = username || p.username;
      p.disconnectedAt = 0;
      this.enforceEntityTerrainFloor(p);
      if (this.isPublicMatchRoom() && this.gameMode === GAME_MODE_TDM && !p.teamId) {
        this.applyJoinBaseline(p);
      }
      return p;
    }

    const p = this.buildPlayerEntity(userId, username, classId);
    p.disconnectedAt = 0;
    this.applyJoinBaseline(p);
    this.players.set(userId, p);
    return p;
  }

  send(ws, obj) {
    if (!ws) return;
    try {
      ws.send(JSON.stringify(obj));
    } catch (err) {
      // noop
    }
  }

  broadcast(obj) {
    const all = this.ctx.getWebSockets();
    const payload = JSON.stringify(obj);
    for (let i = 0; i < all.length; i++) {
      try {
        all[i].send(payload);
      } catch (err) {
        // noop
      }
    }
  }

  createThrowableRuntime() {
    const out = {};
    const order = THROWABLE_STATS.order || [];
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const def = THROWABLE_STATS[id];
      if (!def) continue;
      out[id] = {
        charges: 1,
        maxCharges: 1,
        cooldownRemaining: 0
      };
    }
    return out;
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
    if (!entity) return 0;
    const floorEyeY = this.terrainEyeYAt(entity.x, entity.z);
    if (!Number.isFinite(entity.y) || entity.y < floorEyeY) {
      entity.y = floorEyeY;
    }
    return floorEyeY;
  }

  tickThrowableRegen(entity, dtSec) {
    if (!entity || !entity.throwables) return;
    const order = THROWABLE_STATS.order || [];
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const def = THROWABLE_STATS[id];
      const inv = entity.throwables[id];
      if (!def || !inv) continue;
      if (inv.charges >= inv.maxCharges) continue;
      inv.cooldownRemaining -= dtSec;
      if (inv.cooldownRemaining <= 0) {
        inv.charges++;
        if (inv.charges < inv.maxCharges) inv.cooldownRemaining += def.regen;
        else inv.cooldownRemaining = 0;
      }
    }
  }

  consumeThrowCharge(entity, throwableId) {
    if (!entity || !entity.throwables) return false;
    const inv = entity.throwables[throwableId];
    const def = THROWABLE_STATS[throwableId];
    if (!inv || !def || inv.charges <= 0) return false;
    inv.charges--;
    if (inv.charges < inv.maxCharges && inv.cooldownRemaining <= 0) {
      inv.cooldownRemaining = def.regen;
    }
    return true;
  }

  entityCorePosition(entity) {
    return {
      x: entity.x,
      y: (entity.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + THROWABLE_SPAWN_HEIGHT_WU,
      z: entity.z
    };
  }

  entityForward(entity) {
    const yaw = entity && typeof entity.yaw === 'number' ? entity.yaw : 0;
    const pitch = entity && typeof entity.pitch === 'number' ? entity.pitch : 0;
    const x = -Math.sin(yaw) * Math.cos(pitch);
    const y = Math.sin(-pitch);
    const z = -Math.cos(yaw) * Math.cos(pitch);
    return normalize3(x, y, z);
  }

  entityRight(entity) {
    const yaw = entity && typeof entity.yaw === 'number' ? entity.yaw : 0;
    return normalize3(Math.cos(yaw), 0, -Math.sin(yaw));
  }

  buildDefaultThrowOriginAndDirection(player) {
    const originCore = this.entityCorePosition(player);
    const forward = this.entityForward(player);
    const right = this.entityRight(player);
    let origin = addScaled3(originCore, forward, THROWABLE_SPAWN_FORWARD_WU);
    origin = addScaled3(origin, right, -THROWABLE_SPAWN_LEFT_WU);
    return { origin, direction: forward };
  }

  validateThrowIntent(player, rawIntent) {
    const fallback = this.buildDefaultThrowOriginAndDirection(player);
    if (!rawIntent || typeof rawIntent !== 'object') return fallback;
    if (!rawIntent.origin || !rawIntent.direction) return fallback;

    const origin = {
      x: Number(rawIntent.origin.x || 0),
      y: Number(rawIntent.origin.y || 0),
      z: Number(rawIntent.origin.z || 0)
    };
    const directionRaw = {
      x: Number(rawIntent.direction.x || 0),
      y: Number(rawIntent.direction.y || 0),
      z: Number(rawIntent.direction.z || 0)
    };
    if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z)) return fallback;
    if (!Number.isFinite(directionRaw.x) || !Number.isFinite(directionRaw.y) || !Number.isFinite(directionRaw.z)) return fallback;

    const direction = normalize3(directionRaw.x, directionRaw.y, directionRaw.z);
    const expectedOrigin = fallback.origin;
    const originDelta = distance3(origin, expectedOrigin);
    if (originDelta > THROW_INTENT_ORIGIN_MAX_OFFSET_WU) return fallback;

    const forward = this.entityForward(player);
    if (dot3(direction, forward) < THROW_INTENT_DIRECTION_MIN_DOT) return fallback;

    return { origin, direction };
  }

  spawnProjectile(player, throwableId, clientThrowId, throwIntent, options = null) {
    const def = THROWABLE_STATS[throwableId];
    if (!def) return null;
    const intent = this.validateThrowIntent(player, throwIntent);
    const forward = intent.direction;
    const origin = intent.origin;
    const velocity = {
      x: forward.x * def.speed,
      y: (forward.y * def.speed) + def.upward,
      z: forward.z * def.speed
    };
    const id = `proj_${this.nextProjectileSeq++}`;
    const now = nowMs();
    const projectile = {
      id,
      type: throwableId,
      ownerId: player.id,
      clientThrowId: clientThrowId || '',
      x: origin.x,
      y: origin.y,
      z: origin.z,
      vx: velocity.x,
      vy: velocity.y,
      vz: velocity.z,
      alive: true,
      age: 0,
      bounces: 0,
      fuseSec: typeof def.fuse === 'number' ? def.fuse : (typeof def.life === 'number' ? def.life : 0),
      lifeSec: typeof def.life === 'number' ? def.life : 0,
      createdAt: now,
      lockTargetId: options && options.lockTargetId ? String(options.lockTargetId) : '',
      launchDirX: forward.x,
      launchDirY: forward.y,
      launchDirZ: forward.z,
      hitRadius: Number(def.hitRadius || 1.2),
      stickyDelaySec: (typeof def.stickExplodeDelay === 'number' ? def.stickExplodeDelay : 0),
      stickyUntil: 0,
      stuckToTargetId: '',
      stuckOffsetX: 0,
      stuckOffsetY: 0,
      stuckOffsetZ: 0
    };
    this.projectiles.set(projectile.id, projectile);
    return projectile;
  }

  nearestTargetForProjectile(projectile, maxRange) {
    if (!projectile) return null;
    let nearest = null;
    let nearestDist = maxRange;
    const entities = [];
    for (const p of this.players.values()) entities.push(p);
    for (const b of this.bots.values()) entities.push(b);
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!this.canTargetEntity(e, projectile.ownerId)) continue;
      const targetPos = this.entityAimTargetPosition(e);
      const dx = targetPos.x - projectile.x;
      const dy = targetPos.y - projectile.y;
      const dz = targetPos.z - projectile.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }
    return nearest;
  }

  handleInput(player, msg) {
    if (!player || !player.alive) return;

    const now = nowMs();
    const stunned = (player.stunUntil || 0) > now;
    const hookPulling = !!player.hookPullState;
    const choked = this.isEntityChoked(player, now);
    const actionLocked = stunned || hookPulling || choked;
    let slowMult = 1;
    if (!actionLocked) {
      slowMult = (player.slowUntil || 0) > now
        ? clamp(Number(player.slowMultiplier || 1), 0.1, 1)
        : 1;
      if (typeof msg.x === 'number') {
        const targetX = clamp(msg.x, this.boundsMin, this.boundsMax);
        player.x = player.x + ((targetX - player.x) * slowMult);
      }
      if (typeof msg.z === 'number') {
        const targetZ = clamp(msg.z, this.boundsMin, this.boundsMax);
        player.z = player.z + ((targetZ - player.z) * slowMult);
      }
      if (typeof msg.y === 'number') {
        const floorEyeY = this.terrainEyeYAt(player.x, player.z);
        const targetY = clamp(msg.y, floorEyeY, 16);
        player.y = player.y + ((targetY - player.y) * slowMult);
      }
    }
    if (!actionLocked && typeof msg.yaw === 'number') player.yaw = msg.yaw;
    if (!actionLocked && typeof msg.pitch === 'number') player.pitch = clamp(msg.pitch, -1.55, 1.55);
    if (typeof msg.seq === 'number') player.seq = Math.max(player.seq, msg.seq);
    if (typeof msg.weaponId === 'string' && WEAPON_STATS[msg.weaponId]) player.weaponId = msg.weaponId;
    if (!actionLocked) {
      if (typeof msg.moveSpeedNorm === 'number') player.moveSpeedNorm = clamp(msg.moveSpeedNorm, 0, 1.4);
      if (typeof msg.sprinting === 'boolean') player.sprinting = msg.sprinting;
      if (typeof msg.sprint === 'boolean') player.sprinting = msg.sprint;
    } else {
      player.moveSpeedNorm = 0;
      player.sprinting = false;
    }
    this.enforceEntityTerrainFloor(player);
  }

  getEntityById(entityId) {
    if (this.players.has(entityId)) return this.players.get(entityId);
    if (this.bots.has(entityId)) return this.bots.get(entityId);
    return null;
  }

  getAliveEntities() {
    const out = [];
    for (const p of this.players.values()) if (p && p.alive) out.push(p);
    for (const b of this.bots.values()) if (b && b.alive) out.push(b);
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

  isEntityChoked(entity, now = nowMs()) {
    return !!(entity && entity.alive && entity.chokeVictimState && (entity.chokeVictimState.endsAt || 0) > now);
  }

  isEntityActionLocked(entity, now = nowMs()) {
    if (!entity || !entity.alive) return false;
    return ((entity.stunUntil || 0) > now) || !!entity.hookPullState || this.isEntityChoked(entity, now);
  }

  entityAimTargetPosition(entity) {
    return {
      x: entity.x,
      y: (entity.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0,
      z: entity.z
    };
  }

  hostilesInCone(player, range, minDot) {
    if (!player || !player.alive) return [];
    const forward = this.entityForward(player);
    const entities = this.getAliveEntities();
    const out = [];
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!this.canTargetEntity(e, player.id)) continue;
      const to = normalize3(e.x - player.x, ((e.y || PLAYER_EYE_HEIGHT_WU) - player.y), e.z - player.z);
      if (dot3(to, forward) < minDot) continue;
      const d = distance3(player, e);
      if (d > range) continue;
      out.push({ entity: e, dist: d });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }

  hostilesInRadius(center, radius, excludeId) {
    if (!center) return [];
    const entities = this.getAliveEntities();
    const out = [];
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!this.canTargetEntity(e, excludeId || '')) continue;
      const d = distance3(e, center);
      if (d > radius) continue;
      out.push({ entity: e, dist: d });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }

  applyTimedStun(target, durationSec) {
    if (!target || !target.alive) return;
    const until = nowMs() + Math.max(0, Math.round(durationSec * 1000));
    target.stunUntil = Math.max(target.stunUntil || 0, until);
  }

  applyTimedSlow(target, durationSec, multiplier) {
    if (!target || !target.alive) return;
    const until = nowMs() + Math.max(0, Math.round(durationSec * 1000));
    target.slowUntil = Math.max(target.slowUntil || 0, until);
    target.slowMultiplier = Math.max(0.1, Math.min(1, Number(multiplier || 1)));
  }

  pullEntityToward(player, target, pullDistance, pullSpeed) {
    if (!player || !target || !player.alive || !target.alive) return false;
    const dx = player.x - target.x;
    const dz = player.z - target.z;
    const currentDist = Math.sqrt((dx * dx) + (dz * dz));
    const desiredDist = Math.max(1.5, Number(pullDistance || 3.2));
    const travelDist = Math.max(0, currentDist - desiredDist);
    const speed = Math.max(8, Number(pullSpeed || 26));
    const durationMs = Math.max(120, Math.round((travelDist / speed) * 1000));
    target.hookPullState = {
      sourceId: player.id,
      pullDistance: desiredDist,
      pullSpeed: speed,
      startedAt: nowMs(),
      endsAt: nowMs() + durationMs,
      facingYaw: Math.atan2(player.x - target.x, player.z - target.z) + Math.PI
    };
    this.applyTimedStun(target, 1.0);
    return true;
  }

  closestHostileInRange(player, range, minDot) {
    const hits = this.hostilesInCone(player, range, minDot);
    return hits.length > 0 ? hits[0].entity : null;
  }

  resolveLockedHostile(player, lockTargetId, range, minDot) {
    if (!player || !player.alive || !lockTargetId) return null;
    const target = this.getEntityById(String(lockTargetId));
    if (!this.canTargetEntity(target, player.id)) return null;
    if (distance3(player, target) > Math.max(0.5, Number(range || 0))) return null;

    const forward = this.entityForward(player);
    const to = normalize3(
      target.x - player.x,
      ((target.y || PLAYER_EYE_HEIGHT_WU) - player.y),
      target.z - player.z
    );
    if (dot3(to, forward) < Number(minDot || -1)) return null;
    return target;
  }

  deadeyeCandidates(player, range, minDot, maxTargets) {
    const hits = this.hostilesInCone(player, range, minDot);
    return hits.slice(0, Math.max(1, maxTargets || 1)).map((hit) => ({
      id: hit.entity.id,
      dist: hit.dist
    }));
  }

  resolveClassAimPoint(player, msg, maxRange) {
    const range = Math.max(1, Number(maxRange || 24));
    const forward = this.entityForward(player);
    const eye = this.entityAimTargetPosition(player);
    const fallback = addScaled3(eye, forward, range);
    const raw = msg && msg.aimPoint;
    if (!raw || typeof raw !== 'object') return fallback;

    const point = {
      x: Number(raw.x),
      y: Number(raw.y),
      z: Number(raw.z)
    };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return fallback;
    if (distance3(player, point) > (range + 1.5)) return fallback;

    const to = normalize3(point.x - player.x, point.y - player.y, point.z - player.z);
    if (dot3(to, forward) < -0.2) return fallback;
    return point;
  }

  handleFire(player, msg) {
    if (!player || !player.alive) return;
    if (this.isEntityActionLocked(player)) return;
    if (player.deadeye) return;

    const weaponId = String(msg.weaponId || 'rifle');
    const stats = WEAPON_STATS[weaponId];
    if (!stats) return;
    if (weaponId === 'plasma') return;
    player.weaponId = weaponId;

    const now = nowMs();
    const prev = player.lastShotAt[weaponId] || 0;
    const shotToken = String(msg.shotToken || '');
    let acceptedByCooldown = false;
    if (weaponId === 'shotgun') {
      const maxPellets = Math.max(1, Number(stats.pellets || 12));
      const hasToken = /^[a-zA-Z0-9_-]{6,96}$/.test(shotToken);
      let burst = (player.shotBurstState && player.shotBurstState.shotgun) || null;
      if (hasToken && burst && burst.token === shotToken && now <= burst.expiresAt && burst.count < maxPellets) {
        burst.count += 1;
        acceptedByCooldown = true;
      } else if ((now - prev) >= stats.cooldownMs) {
        player.lastShotAt[weaponId] = now;
        if (!player.shotBurstState) player.shotBurstState = {};
        player.shotBurstState.shotgun = {
          token: hasToken ? shotToken : '',
          count: 1,
          expiresAt: now + SHOTGUN_BURST_WINDOW_MS
        };
        acceptedByCooldown = true;
      }
    } else {
      if ((now - prev) < stats.cooldownMs) return;
      player.lastShotAt[weaponId] = now;
      acceptedByCooldown = true;
    }
    if (!acceptedByCooldown) return;
    player.muzzleFlashUntil = now + REMOTE_MUZZLE_FLASH_HOLD_MS;

    const targetId = String(msg.targetId || '');
    const hitType = msg.hitType === 'head' ? 'head' : 'body';
    if (!targetId) return;

    const target = this.getEntityById(targetId);
    if (!this.canTargetEntity(target, player.id)) return;

    const dist = distance3(player, target);
    var effectiveMaxRange = Number(stats.maxRange || 0);
    if (stats.infiniteRange) {
      effectiveMaxRange = Infinity;
    } else if (msg && msg.adsActive) {
      effectiveMaxRange *= Math.max(1, Number(stats.adsHitscanRangeMultiplier || 1));
    }
    if (dist > effectiveMaxRange) return;

    let damage = hitType === 'head' ? stats.headDamage : stats.bodyDamage;
    damage = applyWeaponFalloff(weaponId, damage, dist);
    const out = applyDamageFromSource(player, target, damage, {
      hitType,
      weaponId,
      sourceKind: 'weapon'
    });
    if (!out) return;

    broadcastDamageEvent(this, player.id, target, out, hitType, weaponId);

    if (out.killed) {
      broadcastDeathRespawn(this, target);
    }
  }

  handleEquipWeapon(player, msg) {
    if (!player) return;
    const weaponId = String(msg.weaponId || '');
    if (!WEAPON_STATS[weaponId]) return;
    player.weaponId = weaponId;
    if (weaponId !== 'plasma') {
      player.streamHeat = 0;
      player.streamOverheatedUntil = 0;
    }
  }

  buildSeekCandidates(player) {
    const out = [];
    if (!player) return out;
    const entities = this.getAliveEntities();
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!this.canTargetEntity(e, player.id)) continue;
      out.push({
        id: e.id,
        ownerType: e.kind || 'entity',
        corePos: this.entityAimTargetPosition(e),
        alive: true
      });
    }
    return out;
  }

  resolveSeekLock(player, preferredTargetId, profile, adsActive = false) {
    if (!player || !player.alive || !profile) return null;
    const resolved = resolveSeekAimProfile(profile, adsActive) || {};
    const candidates = this.buildSeekCandidates(player);
    if (!candidates.length) return null;
    const preferred = String(preferredTargetId || '');
    const shortlist = preferred ? candidates.filter((c) => c.id === preferred) : candidates;
    const lock = selectSeekTarget({
      origin: this.entityAimTargetPosition(player),
      forward: this.entityForward(player),
      candidates: shortlist.length ? shortlist : candidates,
      maxRange: Number(resolved.maxRange || profile.maxRange || 24),
      coneHalfAngleDeg: Number(resolved.coneHalfAngleDeg || profile.coneHalfAngleDeg || 35)
    });
    if (!lock || !lock.hasLock || !lock.lockTargetId) return null;
    const target = this.getEntityById(lock.lockTargetId);
    if (!target || !target.alive || target.id === player.id) return null;
    return target;
  }

  applyPlasmaStreamHeat(player, profile, now) {
    if (!player || !profile) return false;
    const sustainMs = Math.max(500, Number(profile.overheatMaxSustainMs || 2500));
    const tickMs = Math.max(1, Number(profile.tickIntervalMs || profile.cooldownMs || 100));
    player.streamHeat = clamp((player.streamHeat || 0) + (tickMs / sustainMs), 0, 1);
    if (player.streamHeat >= 1) {
      player.streamHeat = 1;
      player.streamOverheatedUntil = now + Math.max(100, Number(profile.overheatLockoutMs || 1600));
      return true;
    }
    return false;
  }

  handleSeekerShot(player, msg, ws) {
    if (!player || !player.alive) return;

    const weaponId = 'seekergun';
    const profile = getSeekProfileByWeaponId('seekergun');
    if (!profile) {
      if (ws) this.send(ws, { t: MSG_S2C.SEEKER_REJECT, weaponId, reason: 'invalid' });
      return;
    }
    const stats = WEAPON_STATS.seekergun || { cooldownMs: 320, maxRange: 24 };
    const cooldownMs = Math.max(1, Number(profile.cooldownMs || stats.cooldownMs || 320));
    const now = nowMs();
    const shotKey = 'seekergun';
    const prev = player.lastShotAt[shotKey] || 0;
    if ((now - prev) < cooldownMs) {
      if (ws) this.send(ws, { t: MSG_S2C.SEEKER_REJECT, weaponId, reason: 'cooldown' });
      return;
    }

    player.lastShotAt[shotKey] = now;
    player.weaponId = weaponId;
    player.muzzleFlashUntil = now + REMOTE_MUZZLE_FLASH_HOLD_MS;

    const rawClientShotId = String(msg && msg.clientShotId ? msg.clientShotId : '');
    const clientShotId = /^[a-zA-Z0-9_-]{3,96}$/.test(rawClientShotId) ? rawClientShotId : '';
    const rawLockTargetId = String(msg && msg.lockTargetId ? msg.lockTargetId : '');
    const adsActive = !!(msg && msg.adsActive);
    const locked = this.resolveSeekLock(player, rawLockTargetId, profile, adsActive);
    const projectileType = String(profile.projectileType || 'seekershot');
    const projectile = this.spawnProjectile(
      player,
      projectileType,
      clientShotId,
      msg && msg.throwIntent ? msg.throwIntent : null,
      { lockTargetId: locked ? locked.id : '' }
    );
    if (!projectile) {
      if (ws) this.send(ws, { t: MSG_S2C.SEEKER_REJECT, weaponId, reason: 'invalid' });
      return;
    }

    this.broadcast({
      t: MSG_S2C.THROW_SPAWN,
      projectileId: projectile.id,
      ownerId: projectile.ownerId,
      clientThrowId: projectile.clientThrowId || '',
      throwableId: projectile.type
    });
  }

  applyClassNow(entity, classId) {
    if (!entity || !CLASS_PRESETS[classId]) return false;
    entity.classId = classId;

    const preset = classPreset(classId);
    entity.armorMax = preset.armorMax;
    entity.armor = Math.max(0, Math.min(Number(entity.armor || 0), preset.armorMax));
    entity.wallhackRadius = preset.wallhackRadius;

    entity.abilityCooldownUntil = 0;
    entity.ultimateCooldownUntil = 0;
    entity.deadeye = null;
    entity.chokeState = null;

    const defaultWeapon = CLASS_DEFAULT_WEAPON[classId] || 'rifle';
    if (WEAPON_STATS[defaultWeapon]) entity.weaponId = defaultWeapon;
    entity.streamHeat = 0;
    entity.streamOverheatedUntil = 0;
    return true;
  }

  handleClassQueue(player, msg, ws) {
    if (!player) return;
    const slot1 = String(msg && msg.slot1 || '');
    const slot2 = String(msg && msg.slot2 || '');
    player.abilityLoadout = player.abilityLoadout || {};
    if (!slot1) {
      player.abilityLoadout.slot1 = '';
    } else if (ABILITY_CATALOG[slot1]) {
      player.abilityLoadout.slot1 = slot1;
    }
    if (!slot2) {
      player.abilityLoadout.slot2 = '';
    } else if (ABILITY_CATALOG[slot2]) {
      player.abilityLoadout.slot2 = slot2;
    }
    this.send(ws, {
      t: MSG_S2C.CLASS_CHANGED,
      classId: 'abilities',
      weaponId: player.weaponId || 'rifle',
      abilityLoadout: player.abilityLoadout || DEFAULT_ABILITY_LOADOUT
    });
  }

  handleThrow(player, msg, ws) {
    if (!player || !player.alive) return;
    if (this.isEntityActionLocked(player)) return;
    const throwableId = String(msg.throwableId || '');
    const clientThrowId = String(msg.clientThrowId || '');
    const def = THROWABLE_STATS[throwableId];
    if (!def) return;
    if (!this.consumeThrowCharge(player, throwableId)) {
      this.send(ws, { t: MSG_S2C.THROW_REJECT, throwableId, clientThrowId, reason: 'cooldown_or_empty' });
      return;
    }
    const projectile = this.spawnProjectile(player, throwableId, clientThrowId, msg.throwIntent || null);
    if (!projectile) {
      const inv = player.throwables && player.throwables[throwableId];
      if (inv) inv.charges = Math.min(inv.maxCharges, inv.charges + 1);
      this.send(ws, { t: MSG_S2C.THROW_REJECT, throwableId, clientThrowId, reason: 'spawn_failed' });
      return;
    }
    player.lastThrowAt = nowMs();
    player.muzzleFlashUntil = player.lastThrowAt + REMOTE_MUZZLE_FLASH_HOLD_MS;
    this.broadcast({
      t: MSG_S2C.THROW_SPAWN,
      projectileId: projectile.id,
      ownerId: projectile.ownerId,
      clientThrowId: projectile.clientThrowId || '',
      throwableId: projectile.type
    });
  }

  spawnAbilityProjectile(player, projectileDef) {
    if (!player || !projectileDef) return null;
    const forward = this.entityForward(player);
    const right = this.entityRight(player);
    const core = this.entityCorePosition(player);
    let origin = addScaled3(core, forward, THROWABLE_SPAWN_FORWARD_WU);
    origin = addScaled3(origin, right, -THROWABLE_SPAWN_LEFT_WU);
    const now = nowMs();
    const id = `proj_${this.nextProjectileSeq++}`;
    const projectile = {
      id,
      ownerId: player.id,
      clientThrowId: '',
      x: origin.x,
      y: origin.y,
      z: origin.z,
      vx: projectileDef.vx,
      vy: projectileDef.vy,
      vz: projectileDef.vz,
      age: 0,
      alive: true,
      bounces: 0,
      type: projectileDef.type,
      hitRadius: projectileDef.hitRadius || 1.2,
      lifeSec: projectileDef.lifeSec || 1.2,
      damageBody: projectileDef.damageBody || 80,
      damageHead: projectileDef.damageHead || projectileDef.damageBody || 80,
      returnToOwner: !!projectileDef.returnToOwner,
      returnSpeed: projectileDef.returnSpeed || 0,
      maxDistance: projectileDef.maxDistance || 0,
      traveled: 0,
      phase: 'outbound',
      phaseHits: {},
      createdAt: now
    };
    this.projectiles.set(projectile.id, projectile);
    return projectile;
  }

  webSocketMessage(ws, message) {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    const msg = safeJsonParse(text);
    if (!msg || typeof msg !== 'object') return;

    const meta = this.clients.get(ws) || ws.deserializeAttachment();
    if (!meta || !meta.userId) return;

    const player = this.players.get(meta.userId);
    if (!player) return;

    const type = String(msg.t || '');
    if (type === MSG_C2S.JOIN_ROOM) {
      this.send(ws, this.buildWelcomePayload(player.id));
      return;
    }
    if (type === MSG_C2S.INPUT) {
      this.handleInput(player, msg);
      return;
    }
    if (type === MSG_C2S.FIRE) {
      this.handleFire(player, msg);
      return;
    }
    if (type === MSG_C2S.EQUIP_WEAPON) {
      this.handleEquipWeapon(player, msg);
      return;
    }
    if (type === MSG_C2S.SEEKER_SHOT) {
      this.handleSeekerShot(player, msg, ws);
      return;
    }
    if (type === MSG_C2S.THROW) {
      this.handleThrow(player, msg, ws);
      return;
    }
    if (type === MSG_C2S.CLASS_QUEUE) {
      this.handleClassQueue(player, msg, ws);
      return;
    }
    if (type === MSG_C2S.CLASS_CAST) {
      handleClassCast(this, player, msg, ws);
      return;
    }
    if (type === MSG_C2S.PING) {
      this.send(ws, { t: MSG_S2C.PONG, clientTime: msg.clientTime || 0, serverTime: nowMs() });
    }
  }

  webSocketClose(ws) {
    const meta = this.clients.get(ws) || ws.deserializeAttachment();
    this.clients.delete(ws);

    if (meta && meta.userId) {
      const player = this.players.get(meta.userId);
      if (player) {
        player.disconnectedAt = nowMs();
      }
    }

    this.stopTickIfEmpty();
  }

  cleanupDisconnectedPlayers(now) {
    const removeIds = [];
    for (const player of this.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      if (!player.disconnectedAt) continue;
      if ((now - player.disconnectedAt) < DISCONNECT_GRACE_MS) continue;
      removeIds.push(player.id);
    }
    for (let i = 0; i < removeIds.length; i++) {
      this.players.delete(removeIds[i]);
    }
  }

  regenArmor(entity, dtSec) {
    if (!entity.alive) return;
    if (entity.armor >= entity.armorMax) return;

    const sinceDamageMs = nowMs() - (entity.lastDamageAt || 0);
    if (sinceDamageMs < 6000) return;

    entity.armor = Math.min(entity.armorMax, entity.armor + (12 * dtSec));
  }

  tickStreamState(entity, dtSec) {
    if (!entity) return;
    const now = nowMs();
    const overheated = now < (entity.streamOverheatedUntil || 0);
    const coolRate = overheated ? 0.35 : 0.55;
    entity.streamHeat = Math.max(0, (entity.streamHeat || 0) - (coolRate * dtSec));
    if (!overheated && entity.streamHeat < 0.95) {
      entity.streamOverheatedUntil = 0;
    }
  }

  respawnIfNeeded(entity) {
    if (entity.alive) return;
    if ((entity.respawnAt || 0) > nowMs()) return;

    entity.hp = entity.hpMax;
    entity.armor = entity.armorMax;
    entity.alive = true;
    entity.respawnAt = 0;
    entity.lastDamageAt = 0;
    if (entity.plannedSpawnPoint) {
      this.applyEntitySpawnPoint(entity, entity.plannedSpawnPoint);
      entity.plannedSpawnPoint = null;
    } else {
      this.spawnEntityRandomly(entity);
    }
    this.applySpawnShield(entity);
    entity.streamHeat = 0;
    entity.streamOverheatedUntil = 0;
    entity.lastShotAt = {};
    entity.shotBurstState = {};
    entity.muzzleFlashUntil = 0;
    entity.throwables = this.createThrowableRuntime();
    entity.lastThrowAt = 0;
    entity.abilityCooldownUntil = 0;
    entity.ultimateCooldownUntil = 0;
    entity.stunUntil = 0;
    entity.slowUntil = 0;
    entity.slowMultiplier = 1;
    entity.deadeye = null;
    entity.chokeState = null;
    entity.chokeVictimState = null;
    entity.hookState = null;
    entity.hookPullState = null;
    entity.healState = null;
    if (entity.fixtureType === 'sim_player') {
      entity.moveSpeedNorm = 0;
      entity.sprinting = false;
      entity.yaw = 0;
      entity.pitch = 0;
    }
  }

  tickPlayers(dtSec) {
    for (const player of this.players.values()) {
      this.respawnIfNeeded(player);
      this.regenArmor(player, dtSec);
      this.tickStreamState(player, dtSec);
      this.tickThrowableRegen(player, dtSec);
      tickClassAbilityState(this, player);
    }
  }

  broadcastSnapshot(forceFull = false) {
    const entities = [];
    for (const player of this.players.values()) entities.push(toEntityState(player));
    for (const bot of this.bots.values()) entities.push(toEntityState(bot));
    const nextEntityState = new Map();
    const changedEntities = [];
    const removedEntityIds = [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const serialized = JSON.stringify(entity);
      nextEntityState.set(entity.id, serialized);
      if (forceFull || this.lastBroadcastEntityState.get(entity.id) !== serialized) {
        changedEntities.push(entity);
      }
    }
    this.lastBroadcastEntityState.forEach((_state, entityId) => {
      if (!nextEntityState.has(entityId)) {
        removedEntityIds.push(entityId);
      }
    });
    this.lastBroadcastEntityState = nextEntityState;
    const projectiles = [];
    this.projectiles.forEach((p) => {
      if (!p || !p.alive) return;
      projectiles.push(toProjectileState(p));
    });
    const fireZones = [];
    this.fireZones.forEach((z) => {
      fireZones.push(toFireZoneState(z));
    });

    this.broadcast({
      t: MSG_S2C.SNAPSHOT,
      serverTime: nowMs(),
      delta: !forceFull,
      gameMode: this.gameMode || '',
      matchState: this.serializeMatchState(),
      entities: forceFull ? entities : changedEntities,
      removedEntityIds,
      projectiles,
      fireZones
    });
  }

  tick() {
    const now = nowMs();
    const dtSec = Math.max(0.001, Math.min(0.2, (now - this.lastTickAt) / 1000));
    this.lastTickAt = now;

    this.cleanupDisconnectedPlayers(now);
    this.maybeResetPublicMatch();
    this.syncRoomFixtures();
    this.startPublicMatchIfReady();
    this.tickPlayers(dtSec);
    tickBots(this, dtSec);
    tickProjectiles(this, dtSec);
    tickFireZones(this, dtSec);
    this.updateLeaderProgress();
    if ((now - this.lastSnapshotAt) >= ROOM_SNAPSHOT_TICK_MS) {
      const forceFull = (now - this.lastFullSnapshotAt) >= ROOM_FULL_RESYNC_MS;
      this.broadcastSnapshot(forceFull);
      this.lastSnapshotAt = now;
      if (forceFull) this.lastFullSnapshotAt = now;
    }

    this.stopTickIfEmpty();
  }
}
