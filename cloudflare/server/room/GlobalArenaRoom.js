import { DurableObject } from 'cloudflare:workers';
import {
  gameplayTuning,
  getDefaultWeaponLoadout,
  getSelectableWeaponIds
} from '../../../shared/gameplay-tuning.js';
import { PLAYER_SPAWN_SHIELD_MS } from '../../../shared/combat-timings.js';
import {
  ARMOR_REGEN_DELAY_MS,
  regenArmorFromLastDamage
} from '../../../shared/survivability.js';
import {
  buildExpectedWorldMeta,
  cloneWorldFlags,
  normalizeThrowPayload,
  protocol
} from '../../../shared/protocol.js';
import { entityAimTargetY, logicalHitscanOriginFromEye, logicalMuzzleOriginFromEye } from '../../../shared/entity-points.js';
import {
  nowMs,
  safeJsonParse,
  sanitizeRoomId,
  distance3,
  normalize3,
  addScaled3,
  dot3,
  clamp
} from '../transport.js';
import { resolveHitscanShot, resolveHitscanTrace } from '../../../shared/hitscan-authority.js';
import { buildWorldCollisionData } from '../../../shared/world-collision.js';
import { createTerrainSampler } from '../../../shared/terrain-sampler.js';
import { WORLD_MIN, WORLD_MAX } from '../../../shared/world-layout.js';
import { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS, ROLL_CONTACT_CYLINDER_HEIGHT_SCALE } from '../../../shared/entity-constants.js';
import {
  createMovementInputState,
  hasIntentInputMessage
} from '../../../shared/authoritative-movement.js';
import {
  MATCH_GAME_MODE_FFA,
  MATCH_GAME_MODE_TDM,
  MATCH_TEAM_IDS,
  MATCH_RESET_DELAY_MS,
  targetProgressForGameMode
} from '../../../shared/match-rules.js';
import { PUBLIC_ROOM_START_THRESHOLD } from '../../../shared/matchmaking-config.js';

import {
  createPlayerEntity,
  resetEntityForRespawn
} from './EntityLifecycle.js';
import {
  applyDamageFromSource,
  broadcastDamageEvent,
  broadcastDeathRespawn
} from './CombatService.js';
import { tickProjectiles, tickFireZones } from './ProjectileService.js';
import { handleRoomRequest, findSocketForUserId } from './RoomTransport.js';
import { handleRoomSocketMessage, handleRoomSocketClose } from './RoomSocket.js';
import {
  buildWelcomePayload as buildRoomWelcomePayload
} from './RoomState.js';
import {
  broadcastRoomMessage,
  broadcastRoomShotEffect,
  broadcastRoomShotReject,
  sendRoomMessage
} from './RoomBroadcast.js';
import {
  broadcastLobbyState as broadcastRoomLobbyState,
  buildLobbyBroadcastPayload as buildRoomLobbyBroadcastPayload,
  restoreLobbyObserver as restoreRoomLobbyObserver
} from './RoomLobbyState.js';
import {
  currentRoomNowMs,
  ensureRoomTick,
  stopRoomTickIfEmpty,
  tickRoom
} from './RoomTick.js';
import {
  broadcastSnapshot as broadcastRoomSnapshot,
  collectSnapshotFrame as collectRoomSnapshotFrame,
  ensureClientSnapshotState as ensureRoomClientSnapshotState,
  ensureSnapshotBurstState as ensureRoomSnapshotBurstState,
  isEntityEngagedForViewer as isRoomEntityEngagedForViewer,
  markEntityEngaged as markRoomEntityEngaged,
  markFireEngagement as markRoomFireEngagement,
  markSnapshotBurst as markRoomSnapshotBurst,
  sendSnapshotToClient as sendRoomSnapshotToClient
} from './RoomSnapshotRuntime.js';
import {
  buildRewoundTargetEntity,
  clampRewindShotTime,
  computeAdaptiveMaxRewindMs,
  readCurrentPose,
  rewindEntityPose,
  recordEntityPoseHistory,
  seedEntityPoseHistory,
  DEFAULT_MAX_REWIND_MS,
  DEFAULT_REWIND_HISTORY_MS
} from './RoomRewind.js';
import {
  applyJoinBaseline as applyRoomJoinBaseline,
  assignPlayerToCurrentTeam as assignRoomPlayerToCurrentTeam,
  finishPublicMatch as finishRoomPublicMatch,
  maybeResetPublicMatch as maybeResetRoomPublicMatch,
  resetPublicRoomToIdle as resetRoomPublicRoomToIdle,
  recordElimination as recordRoomElimination,
  startPublicMatchIfReady as startRoomPublicMatchIfReady,
  syncPrivateRoomMatchState as syncRoomPrivateRoomMatchState,
  updateLeaderProgress as updateRoomLeaderProgress
} from './RoomMatch.js';
import {
  DEV_LOCAL_ROOM_NAME,
  createDefaultPrivateRoomConfig,
  detectGameMode,
  emptyMatchState as buildRoomMatchState,
  isPrivateMatchRoom,
  isPublicMatchRoom
} from './RoomIdentity.js';
import { applyPrivateRoomConfig as applyRoomPrivateConfig } from './RoomPrivateConfig.js';
import { setPrivateRoomState } from '../private-rooms.js';
import { notifyPrivateRoomLobbyHub } from '../private-room-lobby-hub-sync.js';
import {
  applyEntitySpawnPoint as applyRoomEntitySpawnPoint,
  activateEntityMatchEntry as activateRoomEntityMatchEntry,
  applySpawnShield as applyRoomSpawnShield,
  beginEntityMatchEntry as beginRoomEntityMatchEntry,
  buildPlayerEntity as buildRoomPlayerEntity,
  chooseEntitySpawnPoint as chooseRoomEntitySpawnPoint,
  enforceEntityTerrainFloor as enforceRoomEntityTerrainFloor,
  ensurePlayer as ensureRoomPlayer,
  isEntityMatchEntryPending as isRoomEntityMatchEntryPending,
  planEntityRespawn as planRoomEntityRespawn,
  queueAuthoritativeInput,
  respawnIfNeeded as respawnRoomEntityIfNeeded,
  spawnEntityRandomly as spawnRoomEntityRandomly,
  syncRoomFixtures as syncRoomRuntimeFixtures,
  syncSimulatedPlayers as syncRoomSimulatedPlayers,
  terrainEyeYAt as roomTerrainEyeYAt,
  terrainFeetYAt as roomTerrainFeetYAt,
  tickAuthoritativePlayerMovement as tickRoomAuthoritativePlayerMovement,
  tickEntityMatchEntries as tickRoomEntityMatchEntries,
  tickPlayers as tickRoomPlayers
} from './RoomRuntime.js';
import {
  canEntityEquipWeaponId,
  createThrowableRuntime as buildThrowableRuntime,
  createWeaponAmmoRuntime as buildWeaponAmmoRuntime,
  entityWeaponLoadout as resolveEntityWeaponLoadout,
  normalizeWeaponLoadout as normalizeRoomWeaponLoadout
} from './RoomLoadout.js';
import {
  applyPlasmaStreamHeat as applyCombatPlasmaStreamHeat,
  applyTimedSlow as applyCombatTimedSlow,
  applyTimedStun as applyCombatTimedStun,
  canEntityUseThrowable as canCombatEntityUseThrowable,
  canEntityUseWeapon as canCombatEntityUseWeapon,
  canTargetEntity as canCombatTargetEntity,
  clampWorldAimPoint as clampCombatWorldAimPoint,
  closestHostileInRange as closestCombatHostileInRange,
  consumeThrowCharge as consumeCombatThrowCharge,
  consumeWeaponAmmo as consumeCombatWeaponAmmo,
  entityAimTargetPosition as combatEntityAimTargetPosition,
  entityCorePosition as combatEntityCorePosition,
  entityForward as combatEntityForward,
  entityRight as combatEntityRight,
  firstWorldHitDistance as combatFirstWorldHitDistance,
  handleEquipWeapon as handleCombatEquipWeapon,
  handleFire as handleCombatFire,
  handleReload as handleCombatReload,
  handleRoll as handleCombatRoll,
  handleThrow as handleCombatThrow,
  handleWeaponLoadout as handleCombatWeaponLoadout,
  hasWorldLineOfSight as combatHasWorldLineOfSight,
  hostilesInCone as combatHostilesInCone,
  hostilesInRadius as combatHostilesInRadius,
  isEntityActionLocked as isCombatEntityActionLocked,
  isEntityActionRestricted as isCombatEntityActionRestricted,
  isEntityMovementLocked as isCombatEntityMovementLocked,
  isEntityRolling as isCombatEntityRolling,
  isEntitySpawnShielded as isCombatEntitySpawnShielded,
  nearestTargetForProjectile as nearestCombatTargetForProjectile,
  reloadRemainingForWeapon as reloadRemainingCombatWeapon,
  spawnProjectile as spawnCombatProjectile,
  syncWeaponAmmoState as syncCombatWeaponAmmoState,
  tickThrowableRegen as tickCombatThrowableRegen,
  validateThrowIntent as validateCombatThrowIntent,
  worldCollidables as combatWorldCollidables,
  beginWeaponReload as beginCombatWeaponReload,
  buildDefaultThrowOriginAndDirection as buildCombatDefaultThrowOriginAndDirection
} from './RoomCombatRuntime.js';

const GAMEPLAY_TUNING_WU = gameplayTuning;
const NETWORK_TUNING = GAMEPLAY_TUNING_WU.network || {};
const NETWORK_FLAGS = NETWORK_TUNING.flags || {};
const NETWORK_COMBAT_PRIORITY = NETWORK_TUNING.combatPriority || {};
const SHARED_PROTOCOL = protocol;
const MSG_C2S = SHARED_PROTOCOL.msg.c2s;
const MSG_S2C = SHARED_PROTOCOL.msg.s2c;

const WEAPON_STATS = GAMEPLAY_TUNING_WU.weaponStats;
const WEAPON_FALLOFF = GAMEPLAY_TUNING_WU.weaponFalloff || {};
const THROWABLE_STATS = GAMEPLAY_TUNING_WU.throwables;
const DEFAULT_WEAPON_LOADOUT = getDefaultWeaponLoadout();
const SELECTABLE_WEAPON_IDS = getSelectableWeaponIds();

const ROOM_SIM_TICK_MS = 1000 / 60;
const ROOM_SNAPSHOT_TICK_MS = 1000 / 60;
const ROOM_INPUT_SEND_HZ = 60;
const MAX_ROOM_TICK_FRAME_MS = 250;
const MAX_SIM_STEPS_PER_TICK = 6;
const DISCONNECT_GRACE_MS = 5000;
const REMOTE_MUZZLE_FLASH_HOLD_MS = 90;
const SNAPSHOT_ENGAGEMENT_TTL_MS = Math.max(1, Number(NETWORK_COMBAT_PRIORITY.engagementTtlMs || 1800));
const SNAPSHOT_ENGAGEMENT_RANGE_WU = 52;
const SNAPSHOT_ENGAGEMENT_MIN_DOT = 0.78;
const SNAPSHOT_ENGAGEMENT_MAX_TARGETS = Math.max(1, Number(NETWORK_COMBAT_PRIORITY.maxBurstTargets || 4));
const SNAPSHOT_BURST_CADENCE_MS = Math.max(1, Number(NETWORK_COMBAT_PRIORITY.burstCadenceMs || 16));
const SNAPSHOT_BURST_WINDOW_MS = Math.max(1, Number(NETWORK_COMBAT_PRIORITY.burstWindowMs || 250));
const COMBAT_BURST_SNAPSHOTS = NETWORK_FLAGS.combatBurstSnapshots !== false;
const SNAPSHOT_DELTA_COMPRESSION = NETWORK_FLAGS.snapshotDeltaCompression !== false;
const ADAPTIVE_SNAPSHOT_CADENCE = NETWORK_FLAGS.adaptiveSnapshotCadence !== false;
const SHOT_TOKEN_DAMAGE_AGGREGATION = NETWORK_FLAGS.shotTokenDamageAggregation !== false;
const PLAYER_EYE_HEIGHT_WU = EYE_HEIGHT;
const PLAYER_HEIGHT_WU = PLAYER_HEIGHT;
const PLAYER_RADIUS_WU = PLAYER_RADIUS;
const THROWABLE_SPAWN_FORWARD_WU = 0.55;
const THROWABLE_SPAWN_LEFT_WU = 0.34;
const THROWABLE_SPAWN_HEIGHT_WU = 1.0;
const THROW_INTENT_ORIGIN_MAX_OFFSET_WU = 1.2;
const THROW_INTENT_DIRECTION_MIN_DOT = -0.2;
const DEV_LOCAL_SIM_PLAYER_IDS = ['sim-player-1', 'sim-player-2'];
const DEV_LOCAL_SIM_PLAYER_NAMES = ['SIM_PLAYER_1', 'SIM_PLAYER_2'];
const GAME_MODE_FFA = MATCH_GAME_MODE_FFA;
const GAME_MODE_TDM = MATCH_GAME_MODE_TDM;
const ROOM_PHASE_ACTIVE = 'active';
const TDM_TEAM_A = 'alpha';
const TDM_TEAM_B = 'bravo';
const TDM_TEAM_ORDER = MATCH_TEAM_IDS.slice();
const FFA_TARGET_PROGRESS = targetProgressForGameMode(MATCH_GAME_MODE_FFA);
const TDM_TARGET_PROGRESS = targetProgressForGameMode(MATCH_GAME_MODE_TDM);
const PLAYER_SPAWN_PADDING_WU = 8;
const PLAYER_SPAWN_MIN_CLEARANCE_WU = 14;
const WORLD_RAY_EPSILON = 0.001;
const RELOADED_FLASH_HOLD_MS = 900;
const MATCH_ENTRY_WINDOW_MS = 20000;
const HITSCAN_REWIND_HISTORY_MS = DEFAULT_REWIND_HISTORY_MS;
const HITSCAN_MAX_REWIND_MS = DEFAULT_MAX_REWIND_MS;
const HITSCAN_AIM_ORIGIN_MAX_OFFSET_WU = 0.9;
const ROOM_LOADOUT_DEPS = {
  selectableWeaponIds: SELECTABLE_WEAPON_IDS,
  weaponStats: WEAPON_STATS,
  defaultWeaponLoadout: DEFAULT_WEAPON_LOADOUT
};

function emptyMatchState(gameMode) {
  return buildRoomMatchState(gameMode, {
    teamAlpha: TDM_TEAM_A,
    teamBravo: TDM_TEAM_B
  });
}

function defaultPrivateRoomConfig() {
  return createDefaultPrivateRoomConfig({
    roomPhaseActive: ROOM_PHASE_ACTIVE,
    teamOrder: TDM_TEAM_ORDER
  });
}

function normalizeWeaponLoadout(rawSlots, fallbackSlots) {
  return normalizeRoomWeaponLoadout(rawSlots, fallbackSlots, ROOM_LOADOUT_DEPS);
}

function entityWeaponLoadout(entity) {
  return resolveEntityWeaponLoadout(entity, ROOM_LOADOUT_DEPS);
}

function canEquipWeaponId(entity, weaponId) {
  return canEntityEquipWeaponId(entity, weaponId, ROOM_LOADOUT_DEPS);
}

function createWeaponAmmoRuntime(loadout) {
  return buildWeaponAmmoRuntime(loadout, ROOM_LOADOUT_DEPS);
}

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

export class GlobalArenaRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.clients = new Map();
    this.activeSocketByUserId = new Map();
    this.lobbyObservers = new Map();
    this.players = new Map();
    this.tickHandle = null;
    this.lastTickAt = nowMs();
    this.simulationNowMs = this.lastTickAt;
    this.inSimulationTick = false;
    this.simulationAccumulatorMs = 0;
    this.snapshotAccumulatorMs = 0;
    this.lastSnapshotAt = 0;
    this.roomName = env.ROOM_NAME || 'global';
    const initialWorldMeta = buildExpectedWorldMeta(this.roomName, SHARED_PROTOCOL.world);
    this.roomName = initialWorldMeta.roomId;
    this.worldSeed = initialWorldMeta.worldSeed;
    this.worldProfileVersion = initialWorldMeta.worldProfileVersion;
    this.worldFlags = cloneWorldFlags(initialWorldMeta.worldFlags);
    this.worldCollision = null;
    this.refreshWorldMeta();
    this.boundsMin = Number(WORLD_MIN || 2);
    this.boundsMax = Number(WORLD_MAX || 110);
    this.projectiles = new Map();
    this.fireZones = new Map();
    this.nextProjectileSeq = 1;
    this.nextFireZoneSeq = 1;
    this.nextSnapshotSeq = 1;
    this.gameMode = detectGameMode(this.roomName);
    this.matchState = emptyMatchState(this.gameMode);
    this.privateRoomConfig = defaultPrivateRoomConfig();
  }

  refreshWorldMeta() {
    this.roomName = sanitizeRoomId(this.roomName || this.env.ROOM_NAME || 'global');
    const worldMeta = buildExpectedWorldMeta(this.roomName, SHARED_PROTOCOL.world);
    this.roomName = worldMeta.roomId;
    this.gameMode = detectGameMode(this.roomName);
    if (!this.matchState || this.matchState.gameMode !== this.gameMode) {
      this.matchState = emptyMatchState(this.gameMode);
    }
    this.worldSeed = worldMeta.worldSeed;
    this.worldProfileVersion = worldMeta.worldProfileVersion;
    this.worldFlags = cloneWorldFlags(worldMeta.worldFlags);
    this.terrainSampler = createTerrainSampler({
      worldSeed: this.worldSeed,
      worldProfileVersion: this.worldProfileVersion,
      worldFlags: cloneWorldFlags(this.worldFlags)
    });
    this.worldCollision = buildWorldCollisionData({
      worldSeed: this.worldSeed,
      worldProfileVersion: this.worldProfileVersion,
      worldFlags: cloneWorldFlags(this.worldFlags)
    });
    if (!isPrivateMatchRoom(this.roomName)) {
      this.privateRoomConfig = defaultPrivateRoomConfig();
    }
  }

  modeEntities() {
    const out = [];
    for (const player of this.players.values()) {
      if (player && !this.isEntityDisconnected(player)) out.push(player);
    }
    return out;
  }

  syncPrivateRoomMatchState() {
    return syncRoomPrivateRoomMatchState(this, {
      isPrivateMatchRoom,
      emptyMatchState,
      nowMs,
      gameModeFfa: GAME_MODE_FFA,
      gameModeTdm: GAME_MODE_TDM,
      teamAlpha: TDM_TEAM_A
    });
  }

  applyPrivateRoomConfig(config) {
    return applyRoomPrivateConfig(this, config, {
      isPrivateMatchRoom,
      roomPhaseActive: ROOM_PHASE_ACTIVE,
      roomPhaseLobby: 'lobby',
      teamOrder: TDM_TEAM_ORDER
    });
  }

  syncPrivateRoomLobbyPhase(roomPhase) {
    if (!isPrivateMatchRoom(this.roomName)) return Promise.resolve(null);
    const nextPhase = String(roomPhase || '') === ROOM_PHASE_ACTIVE ? ROOM_PHASE_ACTIVE : 'lobby';
    const currentConfig = this.privateRoomConfig || defaultPrivateRoomConfig();
    if (String(currentConfig.roomPhase || '') !== nextPhase) {
      this.privateRoomConfig = Object.assign({}, currentConfig, {
        roomPhase: nextPhase
      });
    }
    this.broadcastLobbyState();
    return Promise.resolve(setPrivateRoomState(this.env, this.roomName, {
      roomPhase: nextPhase
    }))
      .then(() => notifyPrivateRoomLobbyHub(this.env, this.roomName))
      .catch(() => null);
  }

  buildWelcomePayload(selfId) {
    return buildRoomWelcomePayload(this, selfId, {
      msgType: MSG_S2C.WELCOME,
      isPrivateMatchRoom,
      roomPhaseActive: ROOM_PHASE_ACTIVE,
      emptyMatchState,
      roomSimTickMs: ROOM_SIM_TICK_MS,
      inputSendHz: ROOM_INPUT_SEND_HZ,
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    });
  }

  ensureTick() {
    return ensureRoomTick(this, {
      nowMs,
      tickMs: ROOM_SIM_TICK_MS
    });
  }

  stopTickIfEmpty() {
    return stopRoomTickIfEmpty(this);
  }

  currentNowMs() {
    return currentRoomNowMs(this, nowMs);
  }

  async fetch(request) {
    return handleRoomRequest(this, request);
  }

  isDevLocalRoom() {
    return this.roomName === DEV_LOCAL_ROOM_NAME;
  }

  isPublicMatchRoom() {
    return isPublicMatchRoom(this.roomName);
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

  assignPlayerToCurrentTeam(player) {
    return assignRoomPlayerToCurrentTeam(this, player, {
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    });
  }

  applyJoinBaseline(player) {
    return applyRoomJoinBaseline(this, player, {
      gameModeFfa: GAME_MODE_FFA,
      gameModeTdm: GAME_MODE_TDM,
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    });
  }

  startPublicMatchIfReady() {
    return startRoomPublicMatchIfReady(this, {
      emptyMatchState,
      nowMs: () => this.currentNowMs(),
      publicRoomStartThreshold: PUBLIC_ROOM_START_THRESHOLD,
      ffaTargetProgress: FFA_TARGET_PROGRESS,
      tdmTargetProgress: TDM_TARGET_PROGRESS,
      gameModeFfa: GAME_MODE_FFA,
      gameModeTdm: GAME_MODE_TDM,
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    });
  }

  maybeResetPublicMatch() {
    return maybeResetRoomPublicMatch(this, {
      emptyMatchState,
      isPrivateMatchRoom,
      nowMs: () => this.currentNowMs(),
      roomPhaseActive: ROOM_PHASE_ACTIVE
    });
  }

  resetPublicRoomToIdle() {
    return resetRoomPublicRoomToIdle(this, {
      emptyMatchState,
      isPrivateMatchRoom
    });
  }

  updateLeaderProgress() {
    return updateRoomLeaderProgress(this, {
      gameModeFfa: GAME_MODE_FFA,
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    });
  }

  finishPublicMatch(winnerId, winnerTeam) {
    const finished = finishRoomPublicMatch(this, {
      nowMs: () => this.currentNowMs(),
      matchResetDelayMs: MATCH_RESET_DELAY_MS,
      gameModeFfa: GAME_MODE_FFA,
      gameModeTdm: GAME_MODE_TDM
    }, winnerId, winnerTeam);
    if (finished && isPrivateMatchRoom(this.roomName)) {
      this.syncPrivateRoomLobbyPhase('lobby');
    }
    return finished;
  }

  recordElimination(sourceId, targetId) {
    return recordRoomElimination(this, {
      nowMs: () => this.currentNowMs(),
      ffaTargetProgress: FFA_TARGET_PROGRESS,
      tdmTargetProgress: TDM_TARGET_PROGRESS,
      gameModeFfa: GAME_MODE_FFA,
      gameModeTdm: GAME_MODE_TDM
    }, sourceId, targetId);
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
    return spawnRoomEntityRandomly(this, entity, {
      spawnPadding: PLAYER_SPAWN_PADDING_WU,
      spawnMinClearance: PLAYER_SPAWN_MIN_CLEARANCE_WU,
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU
    });
  }

  chooseEntitySpawnPoint(entity) {
    return chooseRoomEntitySpawnPoint(this, entity, {
      spawnPadding: PLAYER_SPAWN_PADDING_WU,
      spawnMinClearance: PLAYER_SPAWN_MIN_CLEARANCE_WU
    });
  }

  applyEntitySpawnPoint(entity, spawn) {
    return applyRoomEntitySpawnPoint(this, entity, spawn, {
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU
    });
  }

  applySpawnShield(entity) {
    return applyRoomSpawnShield(entity, {
      nowMs: () => this.currentNowMs(),
      playerSpawnShieldMs: PLAYER_SPAWN_SHIELD_MS
    });
  }

  planEntityRespawn(entity) {
    return planRoomEntityRespawn(this, entity, {
      spawnPadding: PLAYER_SPAWN_PADDING_WU,
      spawnMinClearance: PLAYER_SPAWN_MIN_CLEARANCE_WU
    });
  }

  buildPlayerEntity(userId, username, _classId, options = null) {
    return buildRoomPlayerEntity(this, userId, username, _classId, options, {
      createPlayerEntity,
      createMovementInputState,
      createWeaponAmmoRuntime,
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU,
      spawnPadding: PLAYER_SPAWN_PADDING_WU,
      spawnMinClearance: PLAYER_SPAWN_MIN_CLEARANCE_WU,
      nowMs: () => this.currentNowMs(),
      playerSpawnShieldMs: PLAYER_SPAWN_SHIELD_MS
    });
  }

  syncSimulatedPlayers() {
    return syncRoomSimulatedPlayers(this, {
      simPlayerIds: DEV_LOCAL_SIM_PLAYER_IDS,
      simPlayerNames: DEV_LOCAL_SIM_PLAYER_NAMES
    });
  }

  syncRoomFixtures() {
    return syncRoomRuntimeFixtures(this, {
      simPlayerIds: DEV_LOCAL_SIM_PLAYER_IDS,
      simPlayerNames: DEV_LOCAL_SIM_PLAYER_NAMES
    });
  }

  ensurePlayer(userId, username, classId, actorId = '', actorName = '') {
    return ensureRoomPlayer(this, userId, username, classId, actorId, actorName, {
      isPrivateMatchRoom,
      nowMs: () => this.currentNowMs(),
      playerSpawnShieldMs: PLAYER_SPAWN_SHIELD_MS,
      matchEntryWindowMs: MATCH_ENTRY_WINDOW_MS,
      teamAlpha: TDM_TEAM_A,
      gameModeTdm: GAME_MODE_TDM
    });
  }

  send(ws, obj) {
    return sendRoomMessage(ws, obj);
  }

  broadcast(obj) {
    return broadcastRoomMessage(this, obj);
  }

  broadcastShotEffect(effect) {
    return broadcastRoomShotEffect(this, effect, MSG_S2C.SHOT_EFFECT);
  }

  broadcastShotReject(player, rejection) {
    return broadcastRoomShotReject(this, player, rejection, MSG_S2C.SHOT_REJECT);
  }

  buildLobbyBroadcastPayload() {
    return buildRoomLobbyBroadcastPayload(this, MSG_S2C.LOBBY_STATE);
  }

  broadcastLobbyState() {
    return broadcastRoomLobbyState(this, MSG_S2C.LOBBY_STATE);
  }

  restoreLobbyObserver(ws, meta) {
    return restoreRoomLobbyObserver(this, ws, meta);
  }

  ensureClientSnapshotState(meta) {
    return ensureRoomClientSnapshotState(meta);
  }

  ensureSnapshotBurstState(meta) {
    return ensureRoomSnapshotBurstState(meta);
  }

  collectSnapshotFrame(now = this.currentNowMs()) {
    return collectRoomSnapshotFrame(this, now);
  }

  sendSnapshotToClient(ws, meta, frame, options = {}) {
    return sendRoomSnapshotToClient(this, ws, meta, frame, options, {
      msgType: MSG_S2C.SNAPSHOT,
      distanceBetween: distance3,
      isEntityEngagedForViewer: isRoomEntityEngagedForViewer,
      isPrivateMatchRoom,
      roomPhaseActive: ROOM_PHASE_ACTIVE,
      emptyMatchState,
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    });
  }

  markSnapshotBurst(viewerIds, entityIds, now = this.currentNowMs(), ttlMs = SNAPSHOT_BURST_WINDOW_MS) {
    return markRoomSnapshotBurst(this, viewerIds, entityIds, now, ttlMs, {
      combatBurstSnapshots: COMBAT_BURST_SNAPSHOTS,
      snapshotDeltaCompression: SNAPSHOT_DELTA_COMPRESSION,
      adaptiveSnapshotCadence: ADAPTIVE_SNAPSHOT_CADENCE,
      snapshotBurstCadenceMs: SNAPSHOT_BURST_CADENCE_MS,
      snapshotBurstWindowMs: SNAPSHOT_BURST_WINDOW_MS,
      msgType: MSG_S2C.SNAPSHOT,
      distanceBetween: distance3,
      isEntityEngagedForViewer: isRoomEntityEngagedForViewer,
      isPrivateMatchRoom,
      roomPhaseActive: ROOM_PHASE_ACTIVE,
      emptyMatchState,
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    });
  }

  markEntityEngaged(sourceId, targetId, ttlMs = SNAPSHOT_ENGAGEMENT_TTL_MS, now = nowMs()) {
    return markRoomEntityEngaged(this, sourceId, targetId, ttlMs, now);
  }

  isEntityEngagedForViewer(viewerEntity, entityId, now = nowMs()) {
    return isRoomEntityEngagedForViewer(viewerEntity, entityId, now);
  }

  markFireEngagement(player, msg, now = this.currentNowMs()) {
    return markRoomFireEngagement(this, player, msg, now, {
      distance3,
      normalize3,
      dot3,
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU,
      snapshotEngagementRangeWu: SNAPSHOT_ENGAGEMENT_RANGE_WU,
      snapshotEngagementMinDot: SNAPSHOT_ENGAGEMENT_MIN_DOT,
      snapshotEngagementMaxTargets: SNAPSHOT_ENGAGEMENT_MAX_TARGETS,
      snapshotEngagementTtlMs: SNAPSHOT_ENGAGEMENT_TTL_MS
    });
  }

  seedEntityPoseHistory(entity, now = nowMs()) {
    return seedEntityPoseHistory(entity, now, {
      maxHistoryMs: HITSCAN_REWIND_HISTORY_MS
    });
  }

  recordEntityPoseHistory(entity, now = nowMs()) {
    return recordEntityPoseHistory(entity, now, {
      maxHistoryMs: HITSCAN_REWIND_HISTORY_MS
    });
  }

  recordAliveEntityPoseHistories(now = this.currentNowMs()) {
    for (const player of this.players.values()) {
      if (!player || !player.alive || this.isEntityDisconnected(player)) continue;
      this.recordEntityPoseHistory(player, now);
    }
  }

  resolveHitscanShotTime(player, msg, now = nowMs()) {
    return clampRewindShotTime(msg && msg.estimatedServerShotTime, now, {
      maxRewindMs: this.adaptiveRewindBudgetMs(player)
    });
  }

  buildRewoundHitscanTarget(entity, requestedShotTime, now = nowMs()) {
    return buildRewoundTargetEntity(entity, requestedShotTime, now, {
      maxRewindMs: this.adaptiveRewindBudgetMs(entity)
    });
  }

  adaptiveRewindBudgetMs(player) {
    return computeAdaptiveMaxRewindMs(
      player && player.linkRttMs,
      player && player.linkJitterMs,
      { minRewindMs: 250, maxRewindMs: HITSCAN_MAX_REWIND_MS }
    );
  }

  authoritativeHitscanOrigin(player, requestedShotTime = 0, now = nowMs()) {
    if (!player) return { x: 0, y: PLAYER_EYE_HEIGHT_WU, z: 0 };
    const maxRewindMs = this.adaptiveRewindBudgetMs(player);
    const rewoundPose = Number(requestedShotTime || 0) > 0
      ? rewindEntityPose(player, requestedShotTime, now, {
          maxRewindMs
        })
      : null;
    const pose = rewoundPose || readCurrentPose(player, now) || {};
    const forward = combatEntityForward(rewoundPose || player, { normalize3 });
    const logicalOrigin = logicalMuzzleOriginFromEye({
      x: Number(pose.x || 0),
      y: Number(pose.y || PLAYER_EYE_HEIGHT_WU),
      z: Number(pose.z || 0)
    }, forward);
    if (logicalOrigin) return logicalOrigin;
    return {
      x: Number(pose.x || 0),
      y: Number(pose.y || PLAYER_EYE_HEIGHT_WU),
      z: Number(pose.z || 0)
    };
  }

  authoritativeHitscanForward(player, requestedShotTime = 0, now = nowMs()) {
    if (!player) return { x: 0, y: 0, z: -1 };
    const maxRewindMs = this.adaptiveRewindBudgetMs(player);
    const rewoundPose = Number(requestedShotTime || 0) > 0
      ? rewindEntityPose(player, requestedShotTime, now, {
          maxRewindMs
        })
      : null;
    return combatEntityForward(rewoundPose || player, { normalize3 });
  }

  createThrowableRuntime() {
    return buildThrowableRuntime({
      throwableStats: THROWABLE_STATS
    });
  }

  terrainFeetYAt(x, z) {
    return roomTerrainFeetYAt(this, x, z);
  }

  terrainEyeYAt(x, z) {
    return roomTerrainEyeYAt(this, x, z, {
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU
    });
  }

  enforceEntityTerrainFloor(entity) {
    return enforceRoomEntityTerrainFloor(this, entity, {
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU
    });
  }

  tickThrowableRegen(entity, dtSec) {
    return tickCombatThrowableRegen(entity, dtSec, {
      throwableStats: THROWABLE_STATS
    });
  }

  consumeThrowCharge(entity, throwableId) {
    return consumeCombatThrowCharge(entity, throwableId, {
      throwableStats: THROWABLE_STATS
    });
  }

  entityCorePosition(entity) {
    return combatEntityCorePosition(entity, {
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU,
      throwableSpawnHeight: THROWABLE_SPAWN_HEIGHT_WU
    });
  }

  entityForward(entity) {
    return combatEntityForward(entity, { normalize3 });
  }

  entityRight(entity) {
    return combatEntityRight(entity, { normalize3 });
  }

  buildDefaultThrowOriginAndDirection(player) {
    return buildCombatDefaultThrowOriginAndDirection(this, player, {
      addScaled3,
      throwableSpawnForward: THROWABLE_SPAWN_FORWARD_WU,
      throwableSpawnLeft: THROWABLE_SPAWN_LEFT_WU
    });
  }

  validateThrowIntent(player, rawIntent) {
    return validateCombatThrowIntent(this, player, rawIntent, {
      normalize3,
      distance3,
      dot3,
      throwIntentOriginMaxOffset: THROW_INTENT_ORIGIN_MAX_OFFSET_WU,
      throwIntentDirectionMinDot: THROW_INTENT_DIRECTION_MIN_DOT
    });
  }

  spawnProjectile(player, throwableId, clientThrowId, throwIntent, options = null) {
    return spawnCombatProjectile(this, player, throwableId, clientThrowId, throwIntent, options, {
      throwableStats: THROWABLE_STATS,
      nowMs
    });
  }

  nearestTargetForProjectile(projectile, maxRange) {
    return nearestCombatTargetForProjectile(this, projectile, maxRange);
  }

  handleInput(player, msg) {
    if (!player || !player.alive) return;

    const now = nowMs();
    const movementLocked = this.isEntityMovementLocked(player, now);

    // Weapon changes are authoritative through explicit equip/reload/fire flows.
    // Movement input can arrive stale and must not rewind player.weaponId.
    if (!hasIntentInputMessage(msg) && String(msg.inputMode || '') !== 'intent') return;

    queueAuthoritativeInput(player, msg, {
      movementLocked,
      clamp,
      createMovementInputState
    });
  }

  tickAuthoritativePlayerMovement(player, dtSec) {
    return tickRoomAuthoritativePlayerMovement(this, player, dtSec, {
      nowMs,
      createMovementInputState,
      clamp,
      weaponStats: WEAPON_STATS,
      movementTuning: GAMEPLAY_TUNING_WU.movement || {},
      playerRadius: PLAYER_RADIUS_WU,
      playerHeight: PLAYER_HEIGHT_WU,
      rollContactCylinderHeightScale: ROLL_CONTACT_CYLINDER_HEIGHT_SCALE,
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU,
      worldRayEpsilon: WORLD_RAY_EPSILON
    });
  }

  getEntityById(entityId) {
    if (this.players.has(entityId)) return this.players.get(entityId);
    return null;
  }

  isEntityDisconnected(entity) {
    return !!(
      entity &&
      entity.fixtureType !== 'sim_player' &&
      entity.kind === 'player' &&
      Number(entity.disconnectedAt || 0) > 0
    );
  }

  getAliveEntities() {
    const out = [];
    const now = nowMs();
    for (const p of this.players.values()) {
      if (!p || !p.alive || this.isEntityDisconnected(p) || this.isEntityMatchEntryPending(p, now)) continue;
      out.push(p);
    }
    return out;
  }

  isEntityMatchEntryPending(entity, now = nowMs()) {
    return isRoomEntityMatchEntryPending(entity, now);
  }

  beginEntityMatchEntry(entity) {
    return beginRoomEntityMatchEntry(this, entity, {
      nowMs,
      matchEntryWindowMs: MATCH_ENTRY_WINDOW_MS,
      playerSpawnShieldMs: PLAYER_SPAWN_SHIELD_MS
    });
  }

  activateEntityMatchEntry(entity) {
    return activateRoomEntityMatchEntry(this, entity, {
      nowMs,
      playerSpawnShieldMs: PLAYER_SPAWN_SHIELD_MS
    });
  }

  handleEnterMatch(player) {
    return this.activateEntityMatchEntry(player);
  }

  canViewerReceiveEntity(viewer, entity) {
    if (!entity) return false;
    if (viewer && entity.id === viewer.id) return true;
    return !this.isEntityMatchEntryPending(entity, nowMs());
  }

  isEntitySpawnShielded(entity) {
    return isCombatEntitySpawnShielded(entity, { nowMs });
  }

  canTargetEntity(entity, sourceId = '') {
    return canCombatTargetEntity(this, entity, sourceId);
  }

  worldCollidables() {
    return combatWorldCollidables(this);
  }

  firstWorldHitDistance(origin, dir, maxDistance) {
    return combatFirstWorldHitDistance(this, origin, dir, maxDistance, {
      intersectRayAabb
    });
  }

  hasWorldLineOfSight(origin, targetPos, maxRange = Infinity) {
    return combatHasWorldLineOfSight(this, origin, targetPos, maxRange, {
      normalize3,
      worldRayEpsilon: WORLD_RAY_EPSILON
    });
  }

  clampWorldAimPoint(origin, desiredPoint, maxRange) {
    return clampCombatWorldAimPoint(this, origin, desiredPoint, maxRange, {
      normalize3,
      worldRayEpsilon: WORLD_RAY_EPSILON
    });
  }

  isEntityActionRestricted(entity, actionType, now = nowMs()) {
    return isCombatEntityActionRestricted(entity, actionType, now);
  }

  canEntityUseWeapon(entity, now = nowMs()) {
    return canCombatEntityUseWeapon(this, entity, now);
  }

  canEntityUseThrowable(entity, now = nowMs()) {
    return canCombatEntityUseThrowable(this, entity, now);
  }

  isEntityMovementLocked(entity, now = nowMs()) {
    return isCombatEntityMovementLocked(this, entity, now);
  }

  isEntityRolling(entity, now = nowMs()) {
    return isCombatEntityRolling(entity, now);
  }

  isEntityActionLocked(entity, now = nowMs()) {
    return isCombatEntityActionLocked(this, entity, now);
  }

  entityAimTargetPosition(entity) {
    return combatEntityAimTargetPosition(entity, { entityAimTargetY });
  }

  hostilesInCone(player, range, minDot) {
    return combatHostilesInCone(this, player, range, minDot, {
      normalize3,
      dot3,
      distance3,
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU
    });
  }

  hostilesInRadius(center, radius, excludeId) {
    return combatHostilesInRadius(this, center, radius, excludeId, { distance3 });
  }

  applyTimedStun(target, durationSec) {
    return applyCombatTimedStun(target, durationSec, { nowMs });
  }

  applyTimedSlow(target, durationSec, multiplier) {
    return applyCombatTimedSlow(target, durationSec, multiplier, { nowMs });
  }

  closestHostileInRange(player, range, minDot) {
    return closestCombatHostileInRange(this, player, range, minDot);
  }

  handleFire(player, msg) {
    return handleCombatFire(this, player, msg, {
      nowMs: () => this.currentNowMs(),
      weaponStats: WEAPON_STATS,
      weaponFalloff: WEAPON_FALLOFF,
      resolveHitscanTrace,
      resolveHitscanShot,
      applyDamageFromSource,
      broadcastShotEffect: (arenaRoom, effect) => arenaRoom.broadcastShotEffect(effect),
      broadcastShotReject: (arenaRoom, firingPlayer, rejection) => arenaRoom.broadcastShotReject(firingPlayer, rejection),
      broadcastDamageEvent,
      broadcastDeathRespawn,
      canEquipWeaponId,
      markFireEngagement: (firingPlayer, fireMsg, stamp) => this.markFireEngagement(firingPlayer, fireMsg, stamp),
      markSnapshotBurst: (viewerIds, entityIds, stamp, ttlMs) => this.markSnapshotBurst(viewerIds, entityIds, stamp, ttlMs),
      resolveHitscanShotTime: (firingPlayer, fireMsg, stamp) => this.resolveHitscanShotTime(firingPlayer, fireMsg, stamp),
      buildRewoundHitscanTarget: (entity, requestedShotTime, stamp) => this.buildRewoundHitscanTarget(entity, requestedShotTime, stamp),
      authoritativeHitscanOrigin: (entity, requestedShotTime, stamp) => this.authoritativeHitscanOrigin(entity, requestedShotTime, stamp),
      authoritativeHitscanForward: (entity, requestedShotTime, stamp) => this.authoritativeHitscanForward(entity, requestedShotTime, stamp),
      shotTokenDamageAggregation: SHOT_TOKEN_DAMAGE_AGGREGATION,
      hitscanAimDirectionMinDot: 0.95,
      hitscanAimOriginMaxOffset: HITSCAN_AIM_ORIGIN_MAX_OFFSET_WU,
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU,
      remoteMuzzleFlashHoldMs: REMOTE_MUZZLE_FLASH_HOLD_MS
    });
  }

  handleRoll(player, msg) {
    return handleCombatRoll(this, player, msg, { nowMs: () => this.currentNowMs() });
  }

  handleWeaponLoadout(player, msg) {
    return handleCombatWeaponLoadout(this, player, msg, {
      normalizeWeaponLoadout,
      entityWeaponLoadout,
      createWeaponAmmoRuntime,
      canEquipWeaponId
    });
  }

  handleEquipWeapon(player, msg) {
    return handleCombatEquipWeapon(this, player, msg, {
      weaponStats: WEAPON_STATS,
      canEquipWeaponId
    });
  }

  handleReload(player, msg) {
    return handleCombatReload(this, player, msg, {
      nowMs: () => this.currentNowMs(),
      weaponStats: WEAPON_STATS,
      canEquipWeaponId
    });
  }

  syncWeaponAmmoState(entity, weaponId, now = nowMs()) {
    return syncCombatWeaponAmmoState(this, entity, weaponId, now, {
      weaponStats: WEAPON_STATS,
      createWeaponAmmoRuntime,
      defaultWeaponLoadout: DEFAULT_WEAPON_LOADOUT,
      reloadedFlashHoldMs: RELOADED_FLASH_HOLD_MS
    });
  }

  materializeTrackedWeaponAmmo(entity, now = nowMs()) {
    if (!entity || !entity.weaponAmmo || typeof entity.weaponAmmo !== 'object') return false;
    let changedAny = false;
    for (const weaponId in entity.weaponAmmo) {
      if (!Object.prototype.hasOwnProperty.call(entity.weaponAmmo, weaponId)) continue;
      if (this.syncWeaponAmmoState(entity, weaponId, now)) {
        changedAny = true;
      }
    }
    return changedAny;
  }

  reloadRemainingForWeapon(entity, weaponId, now = nowMs()) {
    return reloadRemainingCombatWeapon(this, entity, weaponId, now);
  }

  beginWeaponReload(entity, weaponId, now = nowMs()) {
    return beginCombatWeaponReload(this, entity, weaponId, now, {
      weaponStats: WEAPON_STATS
    });
  }

  consumeWeaponAmmo(entity, weaponId, now = nowMs()) {
    return consumeCombatWeaponAmmo(this, entity, weaponId, now, {
      weaponStats: WEAPON_STATS
    });
  }

  applyPlasmaStreamHeat(player, profile, now) {
    return applyCombatPlasmaStreamHeat(player, profile, now, { clamp });
  }

  handleThrow(player, msg, ws) {
    return handleCombatThrow(this, player, msg, ws, {
      normalizeThrowPayload,
      throwableStats: THROWABLE_STATS,
      nowMs,
      msgThrowReject: MSG_S2C.THROW_REJECT,
      msgThrowSpawn: MSG_S2C.THROW_SPAWN,
      remoteMuzzleFlashHoldMs: REMOTE_MUZZLE_FLASH_HOLD_MS
    });
  }

  webSocketMessage(ws, message) {
    return handleRoomSocketMessage(this, ws, message, {
      safeJsonParse,
      nowMs,
      isPrivateMatchRoom,
      roomPhaseActive: ROOM_PHASE_ACTIVE,
      msgC2s: MSG_C2S,
      msgS2c: MSG_S2C
    });
  }

  webSocketClose(ws) {
    return handleRoomSocketClose(this, ws, {
      findSocketForUserId,
      nowMs
    });
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
    regenArmorFromLastDamage(entity, dtSec, this.currentNowMs(), { regenDelayMs: ARMOR_REGEN_DELAY_MS });
  }

  tickStreamState(entity, dtSec) {
    if (!entity) return;
    const now = this.currentNowMs();
    const overheated = now < (entity.streamOverheatedUntil || 0);
    const coolRate = overheated ? 0.35 : 0.55;
    entity.streamHeat = Math.max(0, (entity.streamHeat || 0) - (coolRate * dtSec));
    if (!overheated && entity.streamHeat < 0.95) {
      entity.streamOverheatedUntil = 0;
    }
  }

  respawnIfNeeded(entity) {
    return respawnRoomEntityIfNeeded(this, entity, {
      nowMs: () => this.currentNowMs(),
      resetEntityForRespawn,
      createWeaponAmmoRuntime,
      createMovementInputState
    });
  }

  tickPlayers(dtSec) {
    return tickRoomPlayers(this, dtSec, {});
  }

  tickEntityMatchEntries() {
    return tickRoomEntityMatchEntries(this, {
      nowMs: () => this.currentNowMs(),
      playerSpawnShieldMs: PLAYER_SPAWN_SHIELD_MS
    });
  }

  broadcastSnapshot(forceFull = false) {
    return broadcastRoomSnapshot(this, forceFull, {
      nowMs,
      msgType: MSG_S2C.SNAPSHOT,
      snapshotDeltaCompression: SNAPSHOT_DELTA_COMPRESSION,
      adaptiveSnapshotCadence: ADAPTIVE_SNAPSHOT_CADENCE,
      distanceBetween: distance3,
      isEntityEngagedForViewer: isRoomEntityEngagedForViewer,
      isPrivateMatchRoom,
      roomPhaseActive: ROOM_PHASE_ACTIVE,
      emptyMatchState,
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    });
  }

  allocateSnapshotSeq() {
    const seq = Math.max(1, Number(this.nextSnapshotSeq || 1));
    this.nextSnapshotSeq = seq + 1;
    return seq;
  }

  tick() {
    return tickRoom(this, {
      nowMs,
      tickProjectiles,
      tickFireZones,
      simTickMs: ROOM_SIM_TICK_MS,
      snapshotTickMs: ROOM_SNAPSHOT_TICK_MS,
      maxFrameMs: MAX_ROOM_TICK_FRAME_MS,
      maxSteps: MAX_SIM_STEPS_PER_TICK
    });
  }
}
