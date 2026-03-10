import { DurableObject } from 'cloudflare:workers';
import { getSharedTuningWu } from '../../lib/shared-tuning.js';
import { getSharedProtocol } from '../../lib/shared-protocol.js';
import { createSharedTerrainSampler } from '../../lib/shared-terrain.js';
import { getDefaultWeaponLoadout } from '../../../shared/gameplay-tuning.js';
import { getSelectableWeaponIds } from '../../../shared/gameplay-tuning.js';
import { entityAimTargetY } from '../../../shared/entity-points.js';
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
import { resolveHitscanShot } from '../../../shared/hitscan-authority.js';
import { buildWorldCollisionData } from '../../../shared/world-collision.js';
import { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS } from '../../../shared/entity-constants.js';
import {
  createMovementInputState,
  hasIntentInputMessage,
  stepAuthoritativeMovement
} from '../../../shared/authoritative-movement.js';
import { LMS_MODE_ID, lmsRules, buildLmsBeaconAnchors } from '../../../shared/lms-mode.js';
import {
  PUBLIC_ROOM_START_THRESHOLD,
  PUBLIC_ROOM_SOFT_TARGET,
  PUBLIC_ROOM_HARD_CAP,
  PRIVATE_ROOM_ID_PREFIX
} from '../../../shared/matchmaking-config.js';

import { toEntityState, toProjectileState, toFireZoneState } from './EntitySerializer.js';
import { ensureBots, tickBots } from './BotAI.js';
import {
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
const WEAPON_FALLOFF = GAMEPLAY_TUNING_WU.weaponFalloff || {};
const THROWABLE_STATS = GAMEPLAY_TUNING_WU.throwables;
const ABILITY_CATALOG = GAMEPLAY_TUNING_WU.abilityCatalog || {};
const DEFAULT_ABILITY_LOADOUT = GAMEPLAY_TUNING_WU.defaultAbilityLoadout || { slot1: 'choke', slot2: 'deadeye' };
const DEFAULT_WEAPON_LOADOUT = getDefaultWeaponLoadout();
const CLASS_DEFAULT_WEAPON = {
  abilities: 'rifle'
};

const ROOM_SIM_TICK_MS = 33;
const ROOM_SNAPSHOT_TICK_MS = 33;
const ROOM_FULL_RESYNC_MS = 1000;
const DISCONNECT_GRACE_MS = 15000;
const MAX_HP = 500;
const REMOTE_MUZZLE_FLASH_HOLD_MS = 90;
const PLAYER_EYE_HEIGHT_WU = EYE_HEIGHT;
const PLAYER_HEIGHT_WU = PLAYER_HEIGHT;
const PLAYER_RADIUS_WU = PLAYER_RADIUS;
const THROWABLE_SPAWN_FORWARD_WU = 0.55;
const THROWABLE_SPAWN_LEFT_WU = 0.34;
const THROWABLE_SPAWN_HEIGHT_WU = 1.0;
const THROW_INTENT_ORIGIN_MAX_OFFSET_WU = 1.2;
const THROW_INTENT_DIRECTION_MIN_DOT = -0.2;
const DEV_LOCAL_ROOM_NAME = 'dev-local';
const LOCAL_SHARED_ROOM_NAME = 'local-shared';
const SOLO_CLOUDFLARE_ROOM_PREFIX = 'cf-solo-';
const PUBLIC_FFA_ROOM_PREFIX = 'ffa-';
const PUBLIC_TDM_ROOM_PREFIX = 'tdm-';
const PUBLIC_LMS_ROOM_PREFIX = 'lms-';
const PRIVATE_SHARE_ROOM_PREFIX = PRIVATE_ROOM_ID_PREFIX;
const DEV_LOCAL_BOT_COUNT = 2;
const DEV_LOCAL_SIM_PLAYER_IDS = ['sim-player-1', 'sim-player-2'];
const DEV_LOCAL_SIM_PLAYER_NAMES = ['SIM_PLAYER_1', 'SIM_PLAYER_2'];
const GAME_MODE_FFA = 'ffa';
const GAME_MODE_TDM = 'tdm';
const GAME_MODE_LMS = LMS_MODE_ID;
const ROOM_PHASE_ACTIVE = 'active';
const TDM_TEAM_A = 'alpha';
const TDM_TEAM_B = 'bravo';
const FFA_TARGET_PROGRESS = 10;
const TDM_TARGET_PROGRESS = 10;
const MATCH_RESET_DELAY_MS = 5000;
const PLAYER_SPAWN_PADDING_WU = 8;
const PLAYER_SPAWN_MIN_CLEARANCE_WU = 14;
const PLAYER_SPAWN_SHIELD_MS = 1000;
const WORLD_RAY_EPSILON = 0.001;

function intersectRayAabb(origin, dir, box, maxDistance) {
  if (!box || !box.min || !box.max) return null;
  let tmin = -Infinity;
  let tmax = Infinity;
  const axes = ['x', 'y', 'z'];
  for (let i = 0; i < axes.length; i++) {
    const axis = axes[i];
    const o = Number(origin && origin[axis] || 0);
    const d = Number(dir && dir[axis] || 0);
    const min = Number(box.min[axis] || 0);
    const max = Number(box.max[axis] || 0);
    if (Math.abs(d) < 0.000001) {
      if (o < min || o > max) return null;
      continue;
    }
    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  const hitDistance = tmin >= 0 ? tmin : tmax;
  if (hitDistance < 0 || hitDistance > maxDistance) return null;
  return hitDistance;
}

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
  if (room.startsWith(PUBLIC_LMS_ROOM_PREFIX)) return GAME_MODE_LMS;
  if (room.startsWith(PUBLIC_FFA_ROOM_PREFIX)) return GAME_MODE_FFA;
  return '';
}

function isPublicMatchRoom(roomName) {
  const mode = detectGameMode(roomName);
  return mode === GAME_MODE_FFA || mode === GAME_MODE_TDM || mode === GAME_MODE_LMS;
}

function isPrivateMatchRoom(roomName) {
  return String(roomName || '').startsWith(PRIVATE_SHARE_ROOM_PREFIX);
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
    targetProgress: gameMode === GAME_MODE_TDM ? TDM_TARGET_PROGRESS : (gameMode === GAME_MODE_FFA ? FFA_TARGET_PROGRESS : 0),
    leaderProgress: 0,
    leaderId: '',
    winnerId: '',
    winnerTeam: '',
    lms: gameMode === GAME_MODE_LMS ? {
      startingLives: lmsRules.startingLives,
      maxLives: lmsRules.maxLives,
      chargePerExtraLife: lmsRules.chargePerExtraLife,
      remainingPlayers: 0,
      finalBankingCutoffRemaining: lmsRules.finalBankingCutoffRemaining,
      bankingEnabled: false,
      warmupEndsAt: 0,
      nextRotateAt: 0,
      activeBeacon: null
    } : null,
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

function isSelectableWeaponId(weaponId) {
  const id = String(weaponId || '');
  const selectable = getSelectableWeaponIds();
  return selectable.indexOf(id) !== -1 && !!WEAPON_STATS[id];
}

function normalizeWeaponLoadout(rawSlots, fallbackSlots) {
  const fallback = Array.isArray(fallbackSlots) && fallbackSlots.length ? fallbackSlots : DEFAULT_WEAPON_LOADOUT;
  const next = [];
  const seen = {};
  const combined = Array.isArray(rawSlots) ? rawSlots.slice(0) : [];
  for (let i = 0; i < fallback.length; i++) combined.push(fallback[i]);
  for (let i = 0; i < combined.length && next.length < 2; i++) {
    const id = String(combined[i] || '');
    if (!isSelectableWeaponId(id) || seen[id]) continue;
    seen[id] = true;
    next.push(id);
  }
  return next.length ? next : DEFAULT_WEAPON_LOADOUT.slice();
}

function entityWeaponLoadout(entity) {
  if (!entity) return DEFAULT_WEAPON_LOADOUT.slice();
  entity.weaponLoadout = normalizeWeaponLoadout(entity.weaponLoadout, DEFAULT_WEAPON_LOADOUT);
  return entity.weaponLoadout;
}

function canEntityUseWeapon(entity, weaponId) {
  const id = String(weaponId || '');
  if (!isSelectableWeaponId(id)) return false;
  const loadout = entityWeaponLoadout(entity);
  for (let i = 0; i < loadout.length; i++) {
    if (loadout[i] === id) return true;
  }
  return false;
}

export class GlobalArenaRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.clients = new Map();
    this.activeSocketByUserId = new Map();
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
    this.worldCollision = null;
    this.refreshWorldMeta();
    this.boundsMin = 2;
    this.boundsMax = 110;
    this.projectiles = new Map();
    this.fireZones = new Map();
    this.nextProjectileSeq = 1;
    this.nextFireZoneSeq = 1;
    this.gameMode = detectGameMode(this.roomName);
    this.matchState = emptyMatchState(this.gameMode);
    this.lmsBeaconAnchors = [];
    this.privateRoomConfig = {
      roomMode: '',
      roomPhase: ROOM_PHASE_ACTIVE,
      hostActorId: '',
      teams: new Map()
    };
    this.configureLmsBeaconAnchors();
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
    this.worldCollision = buildWorldCollisionData({
      worldSeed: this.worldSeed,
      worldProfileVersion: this.worldProfileVersion,
      worldFlags: cloneWorldFlags(this.worldFlags)
    });
    this.configureLmsBeaconAnchors();
    if (!isPrivateMatchRoom(this.roomName)) {
      this.privateRoomConfig = {
        roomMode: '',
        roomPhase: ROOM_PHASE_ACTIVE,
        hostActorId: '',
        teams: new Map()
      };
    }
  }

  configureLmsBeaconAnchors() {
    this.lmsBeaconAnchors = buildLmsBeaconAnchors({
      boundsMin: this.boundsMin || 2,
      boundsMax: this.boundsMax || 110
    });
  }

  modeEntities() {
    const out = [];
    for (const player of this.players.values()) {
      if (player) out.push(player);
    }
    for (const bot of this.bots.values()) {
      if (bot) out.push(bot);
    }
    return out;
  }

  lmsMatchEntities() {
    return this.modeEntities().filter((entity) => !!entity);
  }

  currentLmsBeacon() {
    if (!this.matchState || !this.matchState.lms) return null;
    const index = Number(this.matchState.lms.activeBeaconIndex || 0);
    if (!this.lmsBeaconAnchors.length) return null;
    return this.lmsBeaconAnchors[Math.max(0, Math.min(this.lmsBeaconAnchors.length - 1, index))] || null;
  }

  syncLmsPublicState() {
    if (!this.matchState || !this.matchState.lms) return;
    const lms = this.matchState.lms;
    const beacon = this.currentLmsBeacon();
    lms.activeBeacon = beacon ? {
      id: beacon.id,
      label: beacon.label,
      x: Number(beacon.x.toFixed(3)),
      z: Number(beacon.z.toFixed(3))
    } : null;
    lms.remainingPlayers = this.lmsRemainingPlayers();
    lms.bankingEnabled = !!(lms.warmupEndsAt && nowMs() >= lms.warmupEndsAt) &&
      lms.remainingPlayers > Number(lms.finalBankingCutoffRemaining || lmsRules.finalBankingCutoffRemaining);
  }

  initializeLmsMatchState(now = nowMs()) {
    if (this.gameMode !== GAME_MODE_LMS || !this.matchState) return;
    const entities = this.lmsMatchEntities();
    this.matchState.lms = {
      startingLives: lmsRules.startingLives,
      maxLives: lmsRules.maxLives,
      chargePerExtraLife: lmsRules.chargePerExtraLife,
      remainingPlayers: 0,
      finalBankingCutoffRemaining: lmsRules.finalBankingCutoffRemaining,
      warmupEndsAt: now + lmsRules.beaconWarmupMs,
      nextRotateAt: now + lmsRules.beaconRotateMs,
      activeBeaconIndex: this.lmsBeaconAnchors.length ? 0 : -1,
      activeBeacon: null,
      bankingEnabled: false
    };
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      entity.teamId = '';
      entity.progressScore = lmsRules.startingLives;
      entity.lmsLives = lmsRules.startingLives;
      entity.lmsCharge = 0;
      entity.lmsBankState = null;
      entity.hp = entity.hpMax;
      entity.armor = entity.armorMax;
      entity.alive = true;
      entity.respawnAt = 0;
      entity.lastDamageAt = 0;
      entity.chokeState = null;
      entity.chokeVictimState = null;
      entity.justBeenHookedState = null;
      entity.hookState = null;
      entity.hookPullState = null;
      entity.healState = null;
      entity.slot1CooldownUntil = 0;
      entity.slot2CooldownUntil = 0;
      entity.abilityCooldownUntil = 0;
      entity.ultimateCooldownUntil = 0;
      entity.lastShotAt = {};
      entity.lastShotTokenByWeapon = {};
      entity.throwables = this.createThrowableRuntime();
      entity.lastThrowAt = 0;
      this.spawnEntityRandomly(entity);
      this.applySpawnShield(entity);
    }
    this.syncLmsPublicState();
  }

  ensureLmsStartedState() {
    if (this.gameMode !== GAME_MODE_LMS || !this.matchState || !this.matchState.started || this.matchState.ended) return;
    if (!this.matchState.lms || !this.matchState.lms.activeBeacon) {
      this.initializeLmsMatchState(this.matchState.startedAt || nowMs());
    }
  }

  lmsRemainingPlayers() {
    let remaining = 0;
    const entities = this.lmsMatchEntities();
    for (let i = 0; i < entities.length; i++) {
      if (Number(entities[i].lmsLives || 0) > 0) remaining++;
    }
    return remaining;
  }

  lmsWinnerId() {
    const entities = this.lmsMatchEntities();
    for (let i = 0; i < entities.length; i++) {
      if (Number(entities[i].lmsLives || 0) > 0) return entities[i].id;
    }
    return '';
  }

  maybeRotateLmsBeacon(now = nowMs()) {
    if (!this.matchState || !this.matchState.lms || !this.lmsBeaconAnchors.length) return;
    const lms = this.matchState.lms;
    if (now < Number(lms.nextRotateAt || 0)) return;
    this.rotateLmsBeacon(now);
  }

  rotateLmsBeacon(now = nowMs()) {
    if (!this.matchState || !this.matchState.lms || !this.lmsBeaconAnchors.length) return;
    const lms = this.matchState.lms;
    const nextIndex = (Number(lms.activeBeaconIndex || 0) + 1) % this.lmsBeaconAnchors.length;
    lms.activeBeaconIndex = nextIndex;
    lms.nextRotateAt = now + lmsRules.beaconRotateMs;
    for (const entity of this.lmsMatchEntities()) {
      if (entity) entity.lmsBankState = null;
    }
    this.syncLmsPublicState();
  }

  syncPrivateRoomMatchState() {
    if (!isPrivateMatchRoom(this.roomName)) return;
    const requestedMode = String((this.privateRoomConfig && this.privateRoomConfig.roomMode) || '');
    const nextMode = requestedMode === GAME_MODE_TDM
      ? GAME_MODE_TDM
      : (requestedMode === GAME_MODE_LMS ? GAME_MODE_LMS : GAME_MODE_FFA);
    this.gameMode = nextMode;
    this.matchState = emptyMatchState(this.gameMode);
    this.matchState.started = String((this.privateRoomConfig && this.privateRoomConfig.roomPhase) || '') === 'active';
    this.matchState.startedAt = this.matchState.started ? nowMs() : 0;
    const teams = (this.privateRoomConfig && this.privateRoomConfig.teams) || new Map();
    for (const player of this.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      player.teamId = this.gameMode === GAME_MODE_TDM
        ? String(teams.get(player.actorId || player.id) || TDM_TEAM_A)
        : '';
      player.progressScore = 0;
    }
  }

  privateConfigEquals(nextConfig) {
    const currentTeams = (this.privateRoomConfig && this.privateRoomConfig.teams) || new Map();
    const nextTeams = (nextConfig && nextConfig.teams) || new Map();
    if (String((this.privateRoomConfig && this.privateRoomConfig.roomMode) || '') !== String((nextConfig && nextConfig.roomMode) || '')) return false;
    if (String((this.privateRoomConfig && this.privateRoomConfig.roomPhase) || '') !== String((nextConfig && nextConfig.roomPhase) || '')) return false;
    if (String((this.privateRoomConfig && this.privateRoomConfig.hostActorId) || '') !== String((nextConfig && nextConfig.hostActorId) || '')) return false;
    if (currentTeams.size !== nextTeams.size) return false;
    for (const [actorId, teamId] of nextTeams.entries()) {
      if (String(currentTeams.get(actorId) || '') !== String(teamId || '')) return false;
    }
    return true;
  }

  applyPrivateRoomConfig(config) {
    if (!config || !isPrivateMatchRoom(this.roomName)) return;
    const teams = new Map();
    const teamEntries = Array.isArray(config.teams) ? config.teams : [];
    for (let i = 0; i < teamEntries.length; i++) {
      const entry = teamEntries[i];
      if (!entry || !entry.actorId) continue;
      teams.set(String(entry.actorId), String(entry.teamId || TDM_TEAM_A) === TDM_TEAM_B ? TDM_TEAM_B : TDM_TEAM_A);
    }
    const nextConfig = {
      roomMode: String(config.roomMode || GAME_MODE_FFA) === GAME_MODE_TDM
        ? GAME_MODE_TDM
        : (String(config.roomMode || GAME_MODE_FFA) === GAME_MODE_LMS ? GAME_MODE_LMS : GAME_MODE_FFA),
      roomPhase: String(config.roomPhase || 'lobby') === 'active' ? 'active' : 'lobby',
      hostActorId: String(config.hostActorId || ''),
      teams
    };
    const syncMode = String(config.syncMode || 'lobby_update') === 'hydrate' ? 'hydrate' : 'lobby_update';
    const changed = !this.privateConfigEquals(nextConfig);
    this.privateRoomConfig = nextConfig;
    if (!changed) {
      for (const player of this.players.values()) {
        if (!player || player.fixtureType === 'sim_player') continue;
        player.teamId = String(teams.get(player.actorId || player.id) || TDM_TEAM_A);
      }
      return;
    }
    if (
      syncMode === 'hydrate' &&
      this.matchState &&
      this.gameMode === nextConfig.roomMode &&
      this.matchState.started === (nextConfig.roomPhase === 'active')
    ) {
      for (const player of this.players.values()) {
        if (!player || player.fixtureType === 'sim_player') continue;
        player.teamId = String(teams.get(player.actorId || player.id) || TDM_TEAM_A);
      }
      return;
    }
    this.syncPrivateRoomMatchState();
  }

  buildWelcomePayload(selfId) {
    return {
      t: MSG_S2C.WELCOME,
      selfId,
      roomId: this.roomName,
      gameMode: this.gameMode || '',
      privateRoomPhase: isPrivateMatchRoom(this.roomName) ? String((this.privateRoomConfig && this.privateRoomConfig.roomPhase) || ROOM_PHASE_ACTIVE) : '',
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

  socketForUserId(userId, excludeWs = null) {
    for (const [clientWs, meta] of this.clients.entries()) {
      if (clientWs === excludeWs) continue;
      if (!meta || meta.userId !== userId) continue;
      return clientWs;
    }
    return null;
  }

  closeDuplicateSockets(userId, keepWs) {
    for (const [clientWs, meta] of this.clients.entries()) {
      if (clientWs === keepWs) continue;
      if (!meta || meta.userId !== userId) continue;
      try {
        clientWs.close(4001, 'Superseded by a newer connection');
      } catch (_err) {
        // no-op
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    this.roomName = sanitizeRoomId(url.searchParams.get('roomId') || this.roomName || this.env.ROOM_NAME || 'global');
    this.refreshWorldMeta();

    if (request.headers.get('Upgrade') !== 'websocket') {
      if (url.pathname === '/private-config' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        this.applyPrivateRoomConfig(body || {});
        return json({ ok: true, roomId: this.roomName, gameMode: this.gameMode || '' });
      }
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
    const actorId = String(url.searchParams.get('actorId') || request.headers.get('X-Actor-Id') || userId || '').trim();
    const actorName = String(url.searchParams.get('actorName') || request.headers.get('X-Actor-Name') || username || '').trim();

    if (!userId) {
      return new Response('Missing userId', { status: 400 });
    }
    if (isPrivateMatchRoom(this.roomName) && this.privateRoomConfig && this.privateRoomConfig.teams.size > 0 && !this.privateRoomConfig.teams.has(actorId)) {
      return new Response('Private room access denied.', { status: 403 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, username, classId, actorId, actorName });

    this.ensurePlayer(userId, username, classId, actorId, actorName);
    this.clients.set(server, { userId, actorId });
    this.activeSocketByUserId.set(userId, server);
    this.closeDuplicateSockets(userId, server);
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
    if (this.roomName.startsWith(PUBLIC_LMS_ROOM_PREFIX)) return false;
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
      lms: match.lms ? {
        startingLives: Number(match.lms.startingLives || lmsRules.startingLives),
        maxLives: Number(match.lms.maxLives || lmsRules.maxLives),
        chargePerExtraLife: Number(match.lms.chargePerExtraLife || lmsRules.chargePerExtraLife),
        remainingPlayers: Number(match.lms.remainingPlayers || 0),
        finalBankingCutoffRemaining: Number(match.lms.finalBankingCutoffRemaining || lmsRules.finalBankingCutoffRemaining),
        warmupEndsAt: Number(match.lms.warmupEndsAt || 0),
        nextRotateAt: Number(match.lms.nextRotateAt || 0),
        bankingEnabled: !!match.lms.bankingEnabled,
        activeBeacon: match.lms.activeBeacon ? { ...match.lms.activeBeacon } : null
      } : null,
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
    const seen = new Set();
    for (const meta of this.clients.values()) {
      if (!meta || !meta.userId) continue;
      const player = this.players.get(meta.userId);
      if (!player || player.fixtureType === 'sim_player') continue;
      if (seen.has(player.id)) continue;
      seen.add(player.id);
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
    if (this.gameMode === GAME_MODE_LMS) {
      player.teamId = '';
      player.progressScore = Number(player.lmsLives || 0);
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
    this.matchState.targetProgress = this.gameMode === GAME_MODE_TDM ? TDM_TARGET_PROGRESS : (this.gameMode === GAME_MODE_FFA ? FFA_TARGET_PROGRESS : 0);
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
    } else if (this.gameMode === GAME_MODE_LMS) {
      this.initializeLmsMatchState(now);
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
    if (!this.matchState || !this.matchState.ended) return false;
    if ((this.matchState.resetAt || 0) > nowMs()) return false;
    const shouldAutoStartPrivate = isPrivateMatchRoom(this.roomName) &&
      String((this.privateRoomConfig && this.privateRoomConfig.roomPhase) || '') === ROOM_PHASE_ACTIVE;
    this.matchState = emptyMatchState(this.gameMode);
    if (shouldAutoStartPrivate) {
      this.matchState.started = true;
      this.matchState.startedAt = nowMs();
    }
    for (const player of this.players.values()) {
      if (!player || player.fixtureType === 'sim_player') continue;
      player.progressScore = 0;
      player.teamId = '';
      player.kills = 0;
      player.deaths = 0;
      player.plannedSpawnPoint = null;
      player.lmsLives = 0;
      player.lmsCharge = 0;
      player.lmsBankState = null;
    }
    if (shouldAutoStartPrivate) {
      this.syncPrivateRoomMatchState();
      if (this.gameMode === GAME_MODE_LMS) {
        this.initializeLmsMatchState(this.matchState.startedAt || nowMs());
      }
    } else {
      this.startPublicMatchIfReady();
    }
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
    if (this.gameMode === GAME_MODE_LMS) {
      let leaderId = '';
      let leaderProgress = 0;
      const entities = this.lmsMatchEntities();
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const lives = Math.max(0, Number(entity.lmsLives || 0));
        const charge = Math.max(0, Number(entity.lmsCharge || 0));
        const progress = lives + (charge * 0.01);
        if (progress >= leaderProgress) {
          leaderProgress = progress;
          leaderId = entity.id;
        }
      }
      this.syncLmsPublicState();
      this.matchState.leaderId = leaderId;
      this.matchState.leaderProgress = Number(leaderProgress.toFixed(2));
      return;
    }
    const alpha = Number((this.matchState.teamProgress && this.matchState.teamProgress[TDM_TEAM_A]) || 0);
    const bravo = Number((this.matchState.teamProgress && this.matchState.teamProgress[TDM_TEAM_B]) || 0);
    this.matchState.leaderId = '';
    this.matchState.leaderProgress = Number(Math.max(alpha, bravo).toFixed(3));
  }

  finishPublicMatch(winnerId, winnerTeam) {
    if (!this.matchState || this.matchState.ended) return false;
    if (this.gameMode !== GAME_MODE_FFA && this.gameMode !== GAME_MODE_TDM && this.gameMode !== GAME_MODE_LMS) return false;
    const now = nowMs();
    this.matchState.ended = true;
    this.matchState.endedAt = now;
    this.matchState.resetAt = now + MATCH_RESET_DELAY_MS;
    this.matchState.winnerId = winnerId || '';
    this.matchState.winnerTeam = winnerTeam || '';
    return true;
  }

  recordElimination(sourceId, targetId) {
    if (!this.matchState || !this.matchState.started || this.matchState.ended) return;
    if (this.gameMode !== GAME_MODE_FFA && this.gameMode !== GAME_MODE_TDM && this.gameMode !== GAME_MODE_LMS) return;
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

    if (this.gameMode === GAME_MODE_LMS) {
      target.lmsLives = Math.max(0, Number(target.lmsLives || lmsRules.startingLives) - 1);
      target.lmsCharge = 0;
      target.lmsBankState = null;
      target.progressScore = target.lmsLives;
      source.lmsCharge = Math.min(
        lmsRules.chargePerExtraLife,
        Math.max(0, Number(source.lmsCharge || 0)) + lmsRules.chargePerElimination
      );
      source.progressScore = Math.max(0, Number(source.lmsLives || 0));
      if (target.lmsLives <= 0) {
        target.respawnAt = 0;
      } else {
        target.respawnAt = nowMs() + lmsRules.respawnDelayMs;
      }
      this.syncLmsPublicState();
      this.updateLeaderProgress();
      if (this.lmsRemainingPlayers() <= 1) {
        this.finishPublicMatch(this.lmsWinnerId(), '');
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
    return this.connectedHumanIds().length;
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
      entity.velocityY = 0;
      entity.isGrounded = true;
      entity.jumpHoldTimer = 0;
      entity.jumpHeldLast = false;
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
      actorId: String(opts.actorId || userId || ''),
      actorName: String(opts.actorName || username || userId || 'player'),
      kind: 'player',
      username,
      classId: nextClassId,
      fixtureType: opts.fixtureType || '',
      abilityLoadout: { slot1: DEFAULT_ABILITY_LOADOUT.slot1, slot2: DEFAULT_ABILITY_LOADOUT.slot2 },
      weaponLoadout: DEFAULT_WEAPON_LOADOUT.slice(),
      x: 0,
      y: PLAYER_EYE_HEIGHT_WU,
      z: 0,
      yaw: Number(opts.yaw || 0),
      pitch: Number(opts.pitch || 0),
      cameraMode: 'third',
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
      inputMode: 'intent',
      inputState: createMovementInputState(),
      lastShotAt: {},
      lastShotTokenByWeapon: {},
      weaponId: DEFAULT_WEAPON_LOADOUT[0],
      moveSpeedNorm: 0,
      sprinting: false,
      velocityY: 0,
      isGrounded: true,
      jumpHoldTimer: 0,
      jumpHeldLast: false,
      streamHeat: 0,
      streamOverheatedUntil: 0,
      muzzleFlashUntil: 0,
      throwables: this.createThrowableRuntime(),
      lastThrowAt: 0,
      kills: 0,
      deaths: 0,
      progressScore: 0,
      lmsLives: 0,
      lmsCharge: 0,
      lmsBankState: null,
      teamId: '',
      disconnectedAt: 0,
      slot1CooldownUntil: 0,
      slot2CooldownUntil: 0,
      abilityCooldownUntil: 0,
      ultimateCooldownUntil: 0,
      weaponLockUntil: 0,
      throwableLockUntil: 0,
      abilityLockUntil: 0,
      stunUntil: 0,
      slowUntil: 0,
      slowMultiplier: 1,
      deadeye: null,
      chokeState: null,
      chokeVictimState: null,
      justBeenHookedState: null,
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

  ensurePlayer(userId, username, classId, actorId = '', actorName = '') {
    if (this.players.has(userId)) {
      const p = this.players.get(userId);
      p.username = username || p.username;
      p.actorId = String(actorId || p.actorId || p.id || '');
      p.actorName = String(actorName || p.actorName || username || p.username || p.id || 'player');
      p.disconnectedAt = 0;
      this.enforceEntityTerrainFloor(p);
      if (isPrivateMatchRoom(this.roomName) && this.privateRoomConfig && this.privateRoomConfig.teams) {
        p.teamId = String(this.privateRoomConfig.teams.get(p.actorId || p.id) || TDM_TEAM_A);
      }
      if (this.isPublicMatchRoom() && this.gameMode === GAME_MODE_TDM && !p.teamId) {
        this.applyJoinBaseline(p);
      }
      if (this.gameMode === GAME_MODE_LMS && this.matchState && this.matchState.started && !this.matchState.ended && Number(p.lmsLives || 0) <= 0) {
        p.lmsLives = lmsRules.startingLives;
        p.progressScore = p.lmsLives;
      }
      return p;
    }

    const p = this.buildPlayerEntity(userId, username, classId, {
      actorId,
      actorName
    });
    p.disconnectedAt = 0;
    if (isPrivateMatchRoom(this.roomName) && this.privateRoomConfig && this.privateRoomConfig.teams) {
      p.teamId = String(this.privateRoomConfig.teams.get(p.actorId || p.id) || TDM_TEAM_A);
    }
    this.applyJoinBaseline(p);
    if (this.gameMode === GAME_MODE_LMS && this.matchState && this.matchState.started && !this.matchState.ended) {
      p.lmsLives = lmsRules.startingLives;
      p.progressScore = p.lmsLives;
    }
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
    const movementLocked = this.isEntityMovementLocked(player, now);
    if (!movementLocked && typeof msg.yaw === 'number') player.yaw = msg.yaw;
    if (!movementLocked && typeof msg.pitch === 'number') player.pitch = clamp(msg.pitch, -1.55, 1.55);
    if (typeof msg.cameraMode === 'string') player.cameraMode = String(msg.cameraMode).toLowerCase() === 'first' ? 'first' : 'third';
    if (typeof msg.seq === 'number') player.seq = Math.max(player.seq, msg.seq);
    if (typeof msg.weaponId === 'string' && canEntityUseWeapon(player, msg.weaponId)) player.weaponId = msg.weaponId;

    if (!hasIntentInputMessage(msg) && String(msg.inputMode || '') !== 'intent') return;

    player.inputMode = 'intent';
    player.inputState = player.inputState || createMovementInputState();
    player.inputState.forward = !!msg.forward;
    player.inputState.backward = !!msg.backward;
    player.inputState.left = !!msg.left;
    player.inputState.right = !!msg.right;
    player.inputState.jump = !!msg.jump;
    player.inputState.sprint = !!msg.sprint;
    player.inputState.adsActive = !!msg.adsActive;
    player.inputState.cameraMode = player.cameraMode;
  }

  tickAuthoritativePlayerMovement(player, dtSec) {
    if (!player || !player.alive) return;

    const now = nowMs();
    const slowMult = (player.slowUntil || 0) > now
      ? clamp(Number(player.slowMultiplier || 1), 0.1, 1)
      : 1;
    const boundsPad = PLAYER_RADIUS_WU;
    stepAuthoritativeMovement(player, player.inputState || createMovementInputState(), {
      dtSec: Math.max(0, Number(dtSec || 0)) * slowMult,
      bounds: {
        minX: this.boundsMin,
        maxX: this.boundsMax,
        minZ: this.boundsMin,
        maxZ: this.boundsMax
      },
      collisionBoxes: this.worldCollidables(),
      getGroundHeightAt: (x, z) => this.terrainFeetYAt(x, z),
      movementLocked: this.isEntityMovementLocked(player, now),
      eyeHeight: PLAYER_EYE_HEIGHT_WU,
      playerHeight: PLAYER_HEIGHT_WU,
      playerRadius: boundsPad,
      epsilon: WORLD_RAY_EPSILON
    });
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

  worldCollidables() {
    return this.worldCollision && Array.isArray(this.worldCollision.collidables)
      ? this.worldCollision.collidables
      : [];
  }

  firstWorldHitDistance(origin, dir, maxDistance) {
    const boxes = this.worldCollidables();
    let nearest = Number(maxDistance);
    for (let i = 0; i < boxes.length; i++) {
      const hitDistance = intersectRayAabb(origin, dir, boxes[i], nearest);
      if (hitDistance != null && hitDistance < nearest) {
        nearest = hitDistance;
      }
    }
    return Number.isFinite(nearest) ? nearest : Number(maxDistance);
  }

  hasWorldLineOfSight(origin, targetPos, maxRange = Infinity) {
    if (!origin || !targetPos) return false;
    const dx = Number(targetPos.x || 0) - Number(origin.x || 0);
    const dy = Number(targetPos.y || 0) - Number(origin.y || 0);
    const dz = Number(targetPos.z || 0) - Number(origin.z || 0);
    const distance = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
    if (distance <= WORLD_RAY_EPSILON || distance > Number(maxRange || Infinity)) return false;
    const dir = normalize3(dx, dy, dz);
    const worldHitDistance = this.firstWorldHitDistance(origin, dir, distance);
    return worldHitDistance >= (distance - 0.02);
  }

  readClassAimPoint(player, rawAimPoint, maxRange) {
    if (!player || !rawAimPoint || typeof rawAimPoint !== 'object') return null;
    const range = Math.max(1, Number(maxRange || 24));
    const point = {
      x: Number(rawAimPoint.x),
      y: Number(rawAimPoint.y),
      z: Number(rawAimPoint.z)
    };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return null;
    if (distance3(player, point) > (range + 1.5)) return null;
    const forward = this.entityForward(player);
    const to = normalize3(point.x - player.x, point.y - player.y, point.z - player.z);
    if (dot3(to, forward) < -0.2) return null;
    return point;
  }

  clampWorldAimPoint(origin, desiredPoint, maxRange) {
    if (!origin || !desiredPoint) return desiredPoint;
    const dx = Number(desiredPoint.x || 0) - Number(origin.x || 0);
    const dy = Number(desiredPoint.y || 0) - Number(origin.y || 0);
    const dz = Number(desiredPoint.z || 0) - Number(origin.z || 0);
    const distance = Math.min(
      Math.max(0, Math.sqrt((dx * dx) + (dy * dy) + (dz * dz))),
      Math.max(0, Number(maxRange || 0))
    );
    if (distance <= WORLD_RAY_EPSILON) return desiredPoint;
    const dir = normalize3(dx, dy, dz);
    const worldHitDistance = this.firstWorldHitDistance(origin, dir, distance);
    const hitBlocked = worldHitDistance < (distance - 0.02);
    const clampedDistance = hitBlocked
      ? Math.max(0, worldHitDistance - 0.05)
      : distance;
    return {
      x: origin.x + (dir.x * clampedDistance),
      y: origin.y + (dir.y * clampedDistance),
      z: origin.z + (dir.z * clampedDistance)
    };
  }

  isEntityChoked(entity, now = nowMs()) {
    return !!(entity && entity.alive && entity.chokeVictimState && (entity.chokeVictimState.endsAt || 0) > now);
  }

  isEntityJustBeenHooked(entity, now = nowMs()) {
    return !!(entity && entity.alive && entity.justBeenHookedState && (entity.justBeenHookedState.endsAt || 0) > now);
  }

  isEntityActionRestricted(entity, actionType, now = nowMs()) {
    if (!entity || !entity.alive) return false;
    if (actionType === 'weapon') return Number(entity.weaponLockUntil || 0) > now;
    if (actionType === 'throwable') return Number(entity.throwableLockUntil || 0) > now;
    if (actionType === 'ability') return Number(entity.abilityLockUntil || 0) > now;
    return false;
  }

  canEntityUseWeapon(entity, now = nowMs()) {
    return !!(entity && entity.alive) && !this.isEntityMovementLocked(entity, now) && !this.isEntityActionRestricted(entity, 'weapon', now);
  }

  canEntityUseThrowable(entity, now = nowMs()) {
    return !!(entity && entity.alive) && !this.isEntityMovementLocked(entity, now) && !this.isEntityActionRestricted(entity, 'throwable', now);
  }

  canEntityUseAbility(entity, now = nowMs()) {
    return !!(entity && entity.alive) && !this.isEntityMovementLocked(entity, now) && !this.isEntityActionRestricted(entity, 'ability', now);
  }

  isEntityMovementLocked(entity, now = nowMs()) {
    if (!entity || !entity.alive) return false;
    return ((entity.stunUntil || 0) > now) ||
      !!entity.hookPullState ||
      this.isEntityChoked(entity, now) ||
      this.isEntityJustBeenHooked(entity, now);
  }

  isEntityActionLocked(entity, now = nowMs()) {
    if (!entity || !entity.alive) return false;
    return this.isEntityMovementLocked(entity, now) ||
      this.isEntityActionRestricted(entity, 'weapon', now) ||
      this.isEntityActionRestricted(entity, 'throwable', now) ||
      this.isEntityActionRestricted(entity, 'ability', now);
  }

  entityAimTargetPosition(entity) {
    return {
      x: entity.x,
      y: entityAimTargetY(entity && entity.y),
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

  applyJustBeenHooked(target, durationSec) {
    if (!target || !target.alive) return;
    const startedAt = nowMs();
    const endsAt = startedAt + Math.max(0, Math.round(Number(durationSec || 0) * 1000));
    target.justBeenHookedState = {
      startedAt,
      endsAt
    };
    target.stunUntil = Math.max(target.stunUntil || 0, endsAt);
  }

  pullEntityToward(player, target, pullDistance, pullSpeed, stunDuration = 1.0) {
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
      postHookStunDuration: Math.max(0, Number(stunDuration || 0)),
      startedAt: nowMs(),
      endsAt: nowMs() + durationMs,
      facingYaw: Math.atan2(player.x - target.x, player.z - target.z) + Math.PI
    };
    return true;
  }

  closestHostileInRange(player, range, minDot) {
    const hits = this.hostilesInCone(player, range, minDot);
    return hits.length > 0 ? hits[0].entity : null;
  }

  resolveLockedHostile(player, lockTargetId, range, minDot, options = null) {
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
    const opts = options || {};
    if (opts.requireLos) {
      const origin = this.entityAimTargetPosition(player);
      const targetPos = this.entityAimTargetPosition(target);
      if (!this.hasWorldLineOfSight(origin, targetPos, Number(range || 0))) return null;
    }
    if (opts.aimPoint && Number(opts.targetTolerance || 0) > 0) {
      const aimPoint = this.readClassAimPoint(player, opts.aimPoint, range);
      if (!aimPoint) return null;
      const targetPos = this.entityAimTargetPosition(target);
      if (distance3(targetPos, aimPoint) > Number(opts.targetTolerance || 0)) return null;
    }
    return target;
  }

  deadeyeCandidates(player, range, minDot, maxTargets) {
    const hits = this.hostilesInCone(player, range, minDot);
    const origin = this.entityAimTargetPosition(player);
    const out = [];
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      const targetPos = this.entityAimTargetPosition(hit.entity);
      if (!this.hasWorldLineOfSight(origin, targetPos, range)) continue;
      out.push({
        id: hit.entity.id,
        dist: hit.dist
      });
      if (out.length >= Math.max(1, maxTargets || 1)) break;
    }
    return out;
  }

  resolveClassAimPoint(player, msg, maxRange) {
    const range = Math.max(1, Number(maxRange || 24));
    const forward = this.entityForward(player);
    const eye = this.entityAimTargetPosition(player);
    const fallback = addScaled3(eye, forward, range);
    const point = this.readClassAimPoint(player, msg && msg.aimPoint, range);
    return point || fallback;
  }

  handleFire(player, msg) {
    if (!player || !player.alive) return;
    if (!this.canEntityUseWeapon(player)) return;
    if (player.deadeye) return;

    const weaponId = String(msg.weaponId || 'rifle');
    const stats = WEAPON_STATS[weaponId];
    if (!stats) return;
    if (weaponId === 'plasma') return;
    if (!canEntityUseWeapon(player, weaponId)) return;
    if (weaponId === 'sniper' && !(msg && msg.adsActive)) return;
    player.weaponId = weaponId;

    const now = nowMs();
    const prev = player.lastShotAt[weaponId] || 0;
    const shotToken = String(msg.shotToken || '');
    if (!player.lastShotTokenByWeapon) player.lastShotTokenByWeapon = {};
    if (shotToken && player.lastShotTokenByWeapon && player.lastShotTokenByWeapon[weaponId] === shotToken) return;
    if ((now - prev) < stats.cooldownMs) return;
    player.lastShotAt[weaponId] = now;
    if (shotToken) player.lastShotTokenByWeapon[weaponId] = shotToken;
    player.muzzleFlashUntil = now + REMOTE_MUZZLE_FLASH_HOLD_MS;
    const shots = resolveHitscanShot({
      origin: {
        x: Number(player.x || 0),
        y: Number(player.y || PLAYER_EYE_HEIGHT_WU),
        z: Number(player.z || 0)
      },
      forward: this.entityForward(player),
      weaponStats: { ...stats, id: weaponId },
      falloffBands: WEAPON_FALLOFF[weaponId] || [],
      adsActive: !!(msg && msg.adsActive),
      shotToken,
      targets: this.getAliveEntities().filter((entity) => this.canTargetEntity(entity, player.id)),
      worldBoxes: this.worldCollidables()
    });
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const target = shot ? shot.target : null;
      if (!this.canTargetEntity(target, player.id)) continue;
      const out = applyDamageFromSource(player, target, shot.damage, {
        hitType: shot.hitType === 'head' ? 'head' : 'body',
        weaponId,
        sourceKind: 'weapon'
      });
      if (!out) continue;
      broadcastDamageEvent(this, player.id, target, out, shot.hitType === 'head' ? 'head' : 'body', weaponId);
      if (out.killed) {
        broadcastDeathRespawn(this, target);
      }
    }
  }

  handleWeaponLoadout(player, msg) {
    if (!player) return;
    const nextLoadout = normalizeWeaponLoadout([msg && msg.slot1, msg && msg.slot2], entityWeaponLoadout(player));
    player.weaponLoadout = nextLoadout;
    if (!canEntityUseWeapon(player, player.weaponId)) {
      player.weaponId = nextLoadout[0];
    }
  }

  handleEquipWeapon(player, msg) {
    if (!player) return;
    const weaponId = String(msg.weaponId || '');
    if (!WEAPON_STATS[weaponId]) return;
    if (!canEntityUseWeapon(player, weaponId)) return;
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
    if (!this.canEntityUseWeapon(player)) return;

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

    entity.slot1CooldownUntil = 0;
    entity.slot2CooldownUntil = 0;
    entity.abilityCooldownUntil = 0;
    entity.ultimateCooldownUntil = 0;
    entity.weaponLockUntil = 0;
    entity.throwableLockUntil = 0;
    entity.abilityLockUntil = 0;
    entity.deadeye = null;
    entity.chokeState = null;

    const defaultWeapon = CLASS_DEFAULT_WEAPON[classId] || 'rifle';
    entity.weaponLoadout = normalizeWeaponLoadout(entity.weaponLoadout, DEFAULT_WEAPON_LOADOUT);
    if (WEAPON_STATS[defaultWeapon] && canEntityUseWeapon(entity, defaultWeapon)) {
      entity.weaponId = defaultWeapon;
    } else {
      entity.weaponId = entity.weaponLoadout[0];
    }
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
    if (!this.canEntityUseThrowable(player)) return;
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
    if (this.activeSocketByUserId.get(meta.userId) !== ws) return;

    const player = this.players.get(meta.userId);
    if (!player) return;

    const type = String(msg.t || '');
    const privateLobbyLocked = isPrivateMatchRoom(this.roomName) &&
      String((this.privateRoomConfig && this.privateRoomConfig.roomPhase) || ROOM_PHASE_ACTIVE) !== ROOM_PHASE_ACTIVE;
    if (type === MSG_C2S.JOIN_ROOM) {
      this.send(ws, this.buildWelcomePayload(player.id));
      return;
    }
    if (type === MSG_C2S.INPUT) {
      if (privateLobbyLocked) return;
      this.handleInput(player, msg);
      return;
    }
    if (type === MSG_C2S.FIRE) {
      if (privateLobbyLocked) return;
      this.handleFire(player, msg);
      return;
    }
    if (type === MSG_C2S.EQUIP_WEAPON) {
      this.handleEquipWeapon(player, msg);
      return;
    }
    if (type === MSG_C2S.WEAPON_LOADOUT) {
      this.handleWeaponLoadout(player, msg);
      return;
    }
    if (type === MSG_C2S.SEEKER_SHOT) {
      if (privateLobbyLocked) return;
      this.handleSeekerShot(player, msg, ws);
      return;
    }
    if (type === MSG_C2S.THROW) {
      if (privateLobbyLocked) return;
      this.handleThrow(player, msg, ws);
      return;
    }
    if (type === MSG_C2S.CLASS_QUEUE) {
      this.handleClassQueue(player, msg, ws);
      return;
    }
    if (type === MSG_C2S.CLASS_CAST) {
      if (privateLobbyLocked) return;
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
      if (this.activeSocketByUserId.get(meta.userId) === ws) {
        const replacement = this.socketForUserId(meta.userId, ws);
        if (replacement) {
          this.activeSocketByUserId.set(meta.userId, replacement);
          const player = this.players.get(meta.userId);
          if (player) player.disconnectedAt = 0;
        } else {
          this.activeSocketByUserId.delete(meta.userId);
          const player = this.players.get(meta.userId);
          if (player) {
            player.disconnectedAt = nowMs();
          }
        }
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

  tickLmsMode(now = nowMs()) {
    if (this.gameMode !== GAME_MODE_LMS || !this.matchState || !this.matchState.started || this.matchState.ended) return;
    this.ensureLmsStartedState();
    this.maybeRotateLmsBeacon(now);
    this.syncLmsPublicState();
    if (this.lmsRemainingPlayers() <= 1) {
      this.finishPublicMatch(this.lmsWinnerId(), '');
      return;
    }
    const beacon = this.currentLmsBeacon();
    const lms = this.matchState.lms;
    if (!beacon || !lms) return;

    for (const entity of this.lmsMatchEntities()) {
      if (!entity || !entity.alive || Number(entity.lmsLives || 0) <= 0) {
        if (entity) entity.lmsBankState = null;
        continue;
      }
      const hasCharge = Number(entity.lmsCharge || 0) >= lmsRules.chargePerExtraLife;
      const canGainLife = Number(entity.lmsLives || 0) < lmsRules.startingLives;
      const dx = Number(entity.x || 0) - beacon.x;
      const dz = Number(entity.z || 0) - beacon.z;
      const inRange = Math.sqrt((dx * dx) + (dz * dz)) <= lmsRules.beaconBankRadius;
      const interrupted = entity.lmsBankState && Number(entity.lastDamageAt || 0) > Number(entity.lmsBankState.startedAt || 0);
      if (!lms.bankingEnabled || !hasCharge || !canGainLife || !inRange || interrupted) {
        entity.lmsBankState = null;
        continue;
      }
      if (!entity.lmsBankState || entity.lmsBankState.beaconId !== beacon.id) {
        entity.lmsBankState = {
          beaconId: beacon.id,
          startedAt: now,
          endsAt: now + lmsRules.beaconChannelMs
        };
        continue;
      }
      if (now < Number(entity.lmsBankState.endsAt || 0)) continue;
      entity.lmsCharge = Math.max(0, Number(entity.lmsCharge || 0) - lmsRules.chargePerExtraLife);
      entity.lmsLives = Math.min(lmsRules.startingLives, Number(entity.lmsLives || 0) + 1);
      entity.progressScore = entity.lmsLives;
      entity.lmsBankState = null;
      this.rotateLmsBeacon(now);
      break;
    }
    this.updateLeaderProgress();
  }

  respawnIfNeeded(entity) {
    if (entity.alive) return;
    if (this.gameMode === GAME_MODE_LMS && Number(entity.lmsLives || 0) <= 0) return;
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
    entity.lastShotTokenByWeapon = {};
    entity.muzzleFlashUntil = 0;
    entity.lmsBankState = null;
    entity.throwables = this.createThrowableRuntime();
    entity.lastThrowAt = 0;
    entity.inputState = createMovementInputState();
    entity.velocityY = 0;
    entity.isGrounded = true;
    entity.jumpHoldTimer = 0;
    entity.jumpHeldLast = false;
    entity.slot1CooldownUntil = 0;
    entity.slot2CooldownUntil = 0;
    entity.abilityCooldownUntil = 0;
    entity.ultimateCooldownUntil = 0;
    entity.weaponLockUntil = 0;
    entity.throwableLockUntil = 0;
    entity.abilityLockUntil = 0;
    entity.stunUntil = 0;
    entity.slowUntil = 0;
    entity.slowMultiplier = 1;
    entity.deadeye = null;
    entity.chokeState = null;
    entity.chokeVictimState = null;
    entity.justBeenHookedState = null;
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
      this.tickAuthoritativePlayerMovement(player, dtSec);
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
      privateRoomPhase: isPrivateMatchRoom(this.roomName) ? String((this.privateRoomConfig && this.privateRoomConfig.roomPhase) || ROOM_PHASE_ACTIVE) : '',
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
    this.tickLmsMode(now);
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
