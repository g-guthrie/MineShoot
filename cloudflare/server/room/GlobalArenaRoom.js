import { DurableObject } from 'cloudflare:workers';
import {
  gameplayTuning,
  getDefaultAbilityLoadout,
  getDefaultWeaponLoadout,
  getSelectableWeaponIds,
  normalizeAbilityLoadout
} from '../../../shared/gameplay-tuning.js';
import {
  buildExpectedWorldMeta,
  cloneWorldFlags,
  normalizeThrowPayload,
  protocol
} from '../../../shared/protocol.js';
import { entityAimTargetY, logicalHitscanOriginFromEye } from '../../../shared/entity-points.js';
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
import { resolveHitscanShot } from '../../../shared/hitscan-authority.js';
import { buildWorldCollisionData } from '../../../shared/world-collision.js';
import { createTerrainSampler } from '../../../shared/terrain-sampler.js';
import { WORLD_MIN, WORLD_MAX } from '../../../shared/world-layout.js';
import { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS } from '../../../shared/entity-constants.js';
import {
  createMovementInputState,
  hasIntentInputMessage,
  stepAuthoritativeMovement
} from '../../../shared/authoritative-movement.js';
import { LMS_MODE_ID, lmsRules, buildLmsBeaconAnchors } from '../../../shared/lms-mode.js';
import {
  MATCH_GAME_MODE_FFA,
  MATCH_GAME_MODE_TDM,
  MATCH_RESET_DELAY_MS,
  createMatchState,
  targetProgressForGameMode
} from '../../../shared/match-rules.js';
import {
  PUBLIC_ROOM_START_THRESHOLD,
  PRIVATE_ROOM_ID_PREFIX
} from '../../../shared/matchmaking-config.js';

import { toEntityState, toProjectileState, toFireZoneState } from './EntitySerializer.js';
import { ensureBots, tickBots } from './BotAI.js';
import {
  createPlayerEntity,
  resetEntityForLmsRound,
  resetEntityForRespawn
} from './EntityLifecycle.js';
import {
  applyDamageFromSource,
  broadcastDamageEvent,
  broadcastDeathRespawn
} from './CombatService.js';
import { tickProjectiles, tickFireZones } from './ProjectileService.js';
import { handleClassCast, tickClassAbilityState } from './AbilityService.js';
import { handleRoomRequest, findSocketForUserId } from './RoomTransport.js';
import { handleRoomSocketMessage, handleRoomSocketClose } from './RoomSocket.js';
import {
  buildViewerEntitySnapshot,
  buildSnapshotPayload,
  buildWelcomePayload as buildRoomWelcomePayload
} from './RoomState.js';
import {
  buildRewoundTargetEntity,
  clampRewindShotTime,
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
  recordElimination as recordRoomElimination,
  startPublicMatchIfReady as startRoomPublicMatchIfReady,
  syncPrivateRoomMatchState as syncRoomPrivateRoomMatchState,
  updateLeaderProgress as updateRoomLeaderProgress
} from './RoomMatch.js';
import {
  configureLmsBeaconAnchors as configureRoomLmsBeaconAnchors,
  currentLmsBeacon as currentRoomLmsBeacon,
  ensureLmsStartedState as ensureRoomLmsStartedState,
  initializeLmsMatchState as initializeRoomLmsMatchState,
  lmsMatchEntities as roomLmsMatchEntities,
  lmsRemainingPlayers as roomLmsRemainingPlayers,
  lmsWinnerId as roomLmsWinnerId,
  maybeRotateLmsBeacon as maybeRotateRoomLmsBeacon,
  rotateLmsBeacon as rotateRoomLmsBeacon,
  syncLmsPublicState as syncRoomLmsPublicState,
  tickLmsMode as tickRoomLmsMode
} from './RoomLms.js';
import {
  applyEntitySpawnPoint as applyRoomEntitySpawnPoint,
  applySpawnShield as applyRoomSpawnShield,
  buildPlayerEntity as buildRoomPlayerEntity,
  chooseEntitySpawnPoint as chooseRoomEntitySpawnPoint,
  enforceEntityTerrainFloor as enforceRoomEntityTerrainFloor,
  ensurePlayer as ensureRoomPlayer,
  planEntityRespawn as planRoomEntityRespawn,
  queueAuthoritativeInput,
  respawnIfNeeded as respawnRoomEntityIfNeeded,
  spawnEntityRandomly as spawnRoomEntityRandomly,
  syncRoomFixtures as syncRoomRuntimeFixtures,
  syncSimulatedPlayers as syncRoomSimulatedPlayers,
  terrainEyeYAt as roomTerrainEyeYAt,
  terrainFeetYAt as roomTerrainFeetYAt,
  tickPlayers as tickRoomPlayers
} from './RoomRuntime.js';
import {
  applyJustBeenHooked as applyCombatJustBeenHooked,
  applyPlasmaStreamHeat as applyCombatPlasmaStreamHeat,
  applyTimedSlow as applyCombatTimedSlow,
  applyTimedStun as applyCombatTimedStun,
  canEntityUseAbility as canCombatEntityUseAbility,
  canEntityUseThrowable as canCombatEntityUseThrowable,
  canEntityUseWeapon as canCombatEntityUseWeapon,
  canTargetEntity as canCombatTargetEntity,
  clampWorldAimPoint as clampCombatWorldAimPoint,
  closestHostileInRange as closestCombatHostileInRange,
  consumeThrowCharge as consumeCombatThrowCharge,
  consumeWeaponAmmo as consumeCombatWeaponAmmo,
  deadeyeCandidates as deadeyeCombatCandidates,
  entityAimTargetPosition as combatEntityAimTargetPosition,
  entityCorePosition as combatEntityCorePosition,
  entityForward as combatEntityForward,
  entityRight as combatEntityRight,
  firstWorldHitDistance as combatFirstWorldHitDistance,
  handleClassQueue as handleCombatClassQueue,
  handleEquipWeapon as handleCombatEquipWeapon,
  handleFire as handleCombatFire,
  handleReload as handleCombatReload,
  handleThrow as handleCombatThrow,
  handleWeaponLoadout as handleCombatWeaponLoadout,
  hasWorldLineOfSight as combatHasWorldLineOfSight,
  hostilesInCone as combatHostilesInCone,
  hostilesInRadius as combatHostilesInRadius,
  isEntityActionLocked as isCombatEntityActionLocked,
  isEntityActionRestricted as isCombatEntityActionRestricted,
  isEntityChoked as isCombatEntityChoked,
  isEntityJustBeenHooked as isCombatEntityJustBeenHooked,
  isEntityMovementLocked as isCombatEntityMovementLocked,
  isEntitySpawnShielded as isCombatEntitySpawnShielded,
  nearestTargetForProjectile as nearestCombatTargetForProjectile,
  pullEntityToward as pullCombatEntityToward,
  readClassAimPoint as readCombatClassAimPoint,
  reloadRemainingForWeapon as reloadRemainingCombatWeapon,
  resolveClassAimPoint as resolveCombatClassAimPoint,
  resolveLockedHostile as resolveCombatLockedHostile,
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
const ABILITY_CATALOG = GAMEPLAY_TUNING_WU.abilityCatalog || {};
const DEFAULT_ABILITY_LOADOUT = getDefaultAbilityLoadout();
const DEFAULT_WEAPON_LOADOUT = getDefaultWeaponLoadout();

const ROOM_SIM_TICK_MS = 1000 / 60;
const ROOM_SNAPSHOT_TICK_MS = 1000 / 60;
const ROOM_INPUT_SEND_HZ = 30;
const DISCONNECT_GRACE_MS = 15000;
const REMOTE_MUZZLE_FLASH_HOLD_MS = 90;
const SNAPSHOT_ENGAGEMENT_TTL_MS = Math.max(1, Number(NETWORK_COMBAT_PRIORITY.engagementTtlMs || 1800));
const SNAPSHOT_ENGAGEMENT_RANGE_WU = 52;
const SNAPSHOT_ENGAGEMENT_MIN_DOT = 0.78;
const SNAPSHOT_ENGAGEMENT_MAX_TARGETS = Math.max(1, Number(NETWORK_COMBAT_PRIORITY.maxBurstTargets || 4));
const SNAPSHOT_BURST_CADENCE_MS = Math.max(1, Number(NETWORK_COMBAT_PRIORITY.burstCadenceMs || 16));
const SNAPSHOT_BURST_WINDOW_MS = Math.max(1, Number(NETWORK_COMBAT_PRIORITY.burstWindowMs || 250));
const COMBAT_BURST_SNAPSHOTS = NETWORK_FLAGS.combatBurstSnapshots !== false;
const SHOT_TOKEN_DAMAGE_AGGREGATION = NETWORK_FLAGS.shotTokenDamageAggregation !== false;
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
const GAME_MODE_FFA = MATCH_GAME_MODE_FFA;
const GAME_MODE_TDM = MATCH_GAME_MODE_TDM;
const GAME_MODE_LMS = LMS_MODE_ID;
const ROOM_PHASE_ACTIVE = 'active';
const TDM_TEAM_A = 'alpha';
const TDM_TEAM_B = 'bravo';
const TDM_TEAM_ORDER = [TDM_TEAM_A, TDM_TEAM_B, 'charlie', 'delta'];
const FFA_TARGET_PROGRESS = targetProgressForGameMode(MATCH_GAME_MODE_FFA);
const TDM_TARGET_PROGRESS = targetProgressForGameMode(MATCH_GAME_MODE_TDM);
const PLAYER_SPAWN_PADDING_WU = 8;
const PLAYER_SPAWN_MIN_CLEARANCE_WU = 14;
const PLAYER_SPAWN_SHIELD_MS = 1000;
const WORLD_RAY_EPSILON = 0.001;
const RELOADED_FLASH_HOLD_MS = 900;
const HITSCAN_REWIND_HISTORY_MS = DEFAULT_REWIND_HISTORY_MS;
const HITSCAN_MAX_REWIND_MS = DEFAULT_MAX_REWIND_MS;
const HITSCAN_AIM_ORIGIN_MAX_OFFSET_WU = 0.9;

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
  return createMatchState(gameMode || '', {
    teamAlpha: TDM_TEAM_A,
    teamBravo: TDM_TEAM_B
  });
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

function createWeaponAmmoRuntime(loadout) {
  const ammo = {};
  const ids = Array.isArray(loadout) ? loadout : DEFAULT_WEAPON_LOADOUT;
  for (let i = 0; i < ids.length; i++) {
    const weaponId = String(ids[i] || '');
    const stats = WEAPON_STATS[weaponId];
    if (!stats || !(Number(stats.magazineSize || 0) > 0)) continue;
    ammo[weaponId] = {
      ammoInMag: Math.max(0, Number(stats.magazineSize || 0)),
      reloadUntil: 0,
      reloadedFlashUntil: 0
    };
  }
  return ammo;
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
    this.gameMode = detectGameMode(this.roomName);
    this.matchState = emptyMatchState(this.gameMode);
    this.lmsBeaconAnchors = [];
    this.privateRoomConfig = {
      roomMode: '',
      roomPhase: ROOM_PHASE_ACTIVE,
      hostActorId: '',
      teamCount: 2,
      teamIds: TDM_TEAM_ORDER.slice(0, 2),
      teams: new Map()
    };
    this.configureLmsBeaconAnchors();
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
    this.configureLmsBeaconAnchors();
    if (!isPrivateMatchRoom(this.roomName)) {
      this.privateRoomConfig = {
        roomMode: '',
        roomPhase: ROOM_PHASE_ACTIVE,
        hostActorId: '',
        teamCount: 2,
        teamIds: TDM_TEAM_ORDER.slice(0, 2),
        teams: new Map()
      };
    }
  }

  configureLmsBeaconAnchors() {
    return configureRoomLmsBeaconAnchors(this, {
      buildLmsBeaconAnchors
    });
  }

  modeEntities() {
    const out = [];
    for (const player of this.players.values()) {
      if (player && !this.isEntityDisconnected(player)) out.push(player);
    }
    for (const bot of this.bots.values()) {
      if (bot) out.push(bot);
    }
    return out;
  }

  lmsMatchEntities() {
    return roomLmsMatchEntities(this);
  }

  currentLmsBeacon() {
    return currentRoomLmsBeacon(this);
  }

  syncLmsPublicState() {
    return syncRoomLmsPublicState(this, {
      nowMs,
      lmsRules
    });
  }

  initializeLmsMatchState(now = nowMs()) {
    return initializeRoomLmsMatchState(this, {
      nowMs,
      lmsRules,
      resetEntityForLmsRound,
      createWeaponAmmoRuntime,
      createMovementInputState,
      gameModeLms: GAME_MODE_LMS
    }, now);
  }

  ensureLmsStartedState() {
    return ensureRoomLmsStartedState(this, {
      gameModeLms: GAME_MODE_LMS,
      nowMs
    });
  }

  lmsRemainingPlayers() {
    return roomLmsRemainingPlayers(this);
  }

  lmsWinnerId() {
    return roomLmsWinnerId(this);
  }

  maybeRotateLmsBeacon(now = nowMs()) {
    return maybeRotateRoomLmsBeacon(this, { nowMs }, now);
  }

  rotateLmsBeacon(now = nowMs()) {
    return rotateRoomLmsBeacon(this, { nowMs, lmsRules }, now);
  }

  syncPrivateRoomMatchState() {
    return syncRoomPrivateRoomMatchState(this, {
      isPrivateMatchRoom,
      emptyMatchState,
      nowMs,
      gameModeFfa: GAME_MODE_FFA,
      gameModeTdm: GAME_MODE_TDM,
      gameModeLms: GAME_MODE_LMS,
      teamAlpha: TDM_TEAM_A
    });
  }

  privateConfigEquals(nextConfig) {
    const currentTeams = (this.privateRoomConfig && this.privateRoomConfig.teams) || new Map();
    const nextTeams = (nextConfig && nextConfig.teams) || new Map();
    if (String((this.privateRoomConfig && this.privateRoomConfig.roomMode) || '') !== String((nextConfig && nextConfig.roomMode) || '')) return false;
    if (String((this.privateRoomConfig && this.privateRoomConfig.roomPhase) || '') !== String((nextConfig && nextConfig.roomPhase) || '')) return false;
    if (String((this.privateRoomConfig && this.privateRoomConfig.hostActorId) || '') !== String((nextConfig && nextConfig.hostActorId) || '')) return false;
    if (Number((this.privateRoomConfig && this.privateRoomConfig.teamCount) || 2) !== Number((nextConfig && nextConfig.teamCount) || 2)) return false;
    if (currentTeams.size !== nextTeams.size) return false;
    for (const [actorId, teamId] of nextTeams.entries()) {
      if (String(currentTeams.get(actorId) || '') !== String(teamId || '')) return false;
    }
    return true;
  }

  applyPrivateRoomConfig(config) {
    if (!config || !isPrivateMatchRoom(this.roomName)) return;
    const teamCount = Math.max(2, Math.min(4, Math.round(Number(config.teamCount || 2) || 2)));
    const teamIds = TDM_TEAM_ORDER.slice(0, teamCount);
    const teams = new Map();
    const teamEntries = Array.isArray(config.teams) ? config.teams : [];
    for (let i = 0; i < teamEntries.length; i++) {
      const entry = teamEntries[i];
      if (!entry || !entry.actorId) continue;
      const normalizedTeamId = String(entry.teamId || '').trim().toLowerCase();
      teams.set(String(entry.actorId), teamIds.indexOf(normalizedTeamId) >= 0 ? normalizedTeamId : teamIds[0]);
    }
    const nextConfig = {
      roomMode: String(config.roomMode || GAME_MODE_FFA) === GAME_MODE_TDM
        ? GAME_MODE_TDM
        : (String(config.roomMode || GAME_MODE_FFA) === GAME_MODE_LMS ? GAME_MODE_LMS : GAME_MODE_FFA),
      roomPhase: String(config.roomPhase || 'lobby') === 'active' ? 'active' : 'lobby',
      hostActorId: String(config.hostActorId || ''),
      teamCount,
      teamIds: teamIds.slice(),
      teams
    };
    const syncMode = String(config.syncMode || 'lobby_update') === 'hydrate' ? 'hydrate' : 'lobby_update';
    const changed = !this.privateConfigEquals(nextConfig);
    this.privateRoomConfig = nextConfig;
    if (!changed) {
      for (const player of this.players.values()) {
        if (!player || player.fixtureType === 'sim_player') continue;
        player.teamId = String(teams.get(player.actorId || player.id) || nextConfig.teamIds[0] || TDM_TEAM_A);
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
        player.teamId = String(teams.get(player.actorId || player.id) || nextConfig.teamIds[0] || TDM_TEAM_A);
      }
      return;
    }
    this.syncPrivateRoomMatchState();
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
    if (this.tickHandle) return;
    this.lastTickAt = nowMs();
    this.lastSnapshotAt = 0;
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
    return handleRoomRequest(this, request);
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
      gameModeLms: GAME_MODE_LMS,
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    });
  }

  startPublicMatchIfReady() {
    return startRoomPublicMatchIfReady(this, {
      emptyMatchState,
      nowMs,
      publicRoomStartThreshold: PUBLIC_ROOM_START_THRESHOLD,
      ffaTargetProgress: FFA_TARGET_PROGRESS,
      tdmTargetProgress: TDM_TARGET_PROGRESS,
      gameModeFfa: GAME_MODE_FFA,
      gameModeTdm: GAME_MODE_TDM,
      gameModeLms: GAME_MODE_LMS,
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    });
  }

  maybeResetPublicMatch() {
    return maybeResetRoomPublicMatch(this, {
      emptyMatchState,
      isPrivateMatchRoom,
      nowMs,
      roomPhaseActive: ROOM_PHASE_ACTIVE,
      gameModeLms: GAME_MODE_LMS
    });
  }

  updateLeaderProgress() {
    return updateRoomLeaderProgress(this, {
      gameModeFfa: GAME_MODE_FFA,
      gameModeLms: GAME_MODE_LMS,
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    });
  }

  finishPublicMatch(winnerId, winnerTeam) {
    return finishRoomPublicMatch(this, {
      nowMs,
      matchResetDelayMs: MATCH_RESET_DELAY_MS,
      gameModeFfa: GAME_MODE_FFA,
      gameModeTdm: GAME_MODE_TDM,
      gameModeLms: GAME_MODE_LMS
    }, winnerId, winnerTeam);
  }

  recordElimination(sourceId, targetId) {
    return recordRoomElimination(this, {
      nowMs,
      lmsRules,
      ffaTargetProgress: FFA_TARGET_PROGRESS,
      tdmTargetProgress: TDM_TARGET_PROGRESS,
      gameModeFfa: GAME_MODE_FFA,
      gameModeTdm: GAME_MODE_TDM,
      gameModeLms: GAME_MODE_LMS
    }, sourceId, targetId);
  }

  desiredBotCount() {
    return 0;
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
      nowMs,
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
      nowMs,
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
      simPlayerNames: DEV_LOCAL_SIM_PLAYER_NAMES,
      ensureBots
    });
  }

  ensurePlayer(userId, username, classId, actorId = '', actorName = '') {
    return ensureRoomPlayer(this, userId, username, classId, actorId, actorName, {
      isPrivateMatchRoom,
      teamAlpha: TDM_TEAM_A,
      gameModeTdm: GAME_MODE_TDM,
      gameModeLms: GAME_MODE_LMS,
      lmsRules
    });
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
    const payload = JSON.stringify(obj);
    for (const [ws, meta] of this.clients.entries()) {
      if (!meta || this.activeSocketByUserId.get(meta.userId) !== ws) continue;
      try {
        ws.send(payload);
      } catch (err) {
        // noop
      }
    }
  }

  ensureClientSnapshotState(meta) {
    if (!meta.snapshotState) {
      meta.snapshotState = {
        entityStateById: new Map(),
        entityLastSentAtById: new Map()
      };
    }
    return meta.snapshotState;
  }

  ensureSnapshotBurstState(meta) {
    if (!meta.snapshotBurstState) {
      meta.snapshotBurstState = {
        untilAt: 0,
        lastSentAt: 0,
        entityIds: new Set()
      };
    }
    if (!(meta.snapshotBurstState.entityIds instanceof Set)) {
      meta.snapshotBurstState.entityIds = new Set();
    }
    return meta.snapshotBurstState;
  }

  collectSnapshotFrame(now = nowMs()) {
    const entities = [];
    for (const player of this.players.values()) {
      if (!player || this.isEntityDisconnected(player)) continue;
      this.materializeTrackedWeaponAmmo(player, now);
      entities.push(toEntityState(player));
    }
    for (const bot of this.bots.values()) {
      if (!bot) continue;
      this.materializeTrackedWeaponAmmo(bot, now);
      entities.push(toEntityState(bot));
    }
    const serializedById = new Map();
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity || !entity.id) continue;
      serializedById.set(entity.id, JSON.stringify(entity));
    }
    const projectiles = [];
    this.projectiles.forEach((p) => {
      if (!p || !p.alive) return;
      projectiles.push(toProjectileState(p));
    });
    const fireZones = [];
    this.fireZones.forEach((z) => {
      fireZones.push(toFireZoneState(z));
    });
    return {
      now,
      entities,
      serializedById,
      projectiles,
      fireZones,
      projectilesSerialized: JSON.stringify(projectiles),
      fireZonesSerialized: JSON.stringify(fireZones)
    };
  }

  sendSnapshotToClient(ws, meta, frame, options = {}) {
    if (!meta || !meta.userId) return false;
    if (this.activeSocketByUserId.get(meta.userId) !== ws) return false;
    const viewer = this.players.get(meta.userId) || null;
    this.ensureClientSnapshotState(meta);
    const selection = buildViewerEntitySnapshot(frame.entities, viewer, meta.snapshotState, {
      forceFull: !!options.forceFull,
      nowMs: frame.now,
      serializedById: frame.serializedById,
      distanceBetween: distance3,
      isEngaged: (_viewer, entity, stamp) => this.isEntityEngagedForViewer(viewer, entity && entity.id ? entity.id : '', stamp),
      priorityEntityIds: options.priorityEntityIds instanceof Set
        ? options.priorityEntityIds
        : new Set(Array.isArray(options.priorityEntityIds) ? options.priorityEntityIds : [])
    });
    meta.snapshotState = selection.snapshotState;

    const includeProjectiles = options.includeProjectiles !== false;
    const includeFireZones = options.includeFireZones !== false;
    const projectileChanged = includeProjectiles && (!!options.forceFull || meta.lastProjectilesSerialized !== frame.projectilesSerialized);
    const fireZonesChanged = includeFireZones && (!!options.forceFull || meta.lastFireZonesSerialized !== frame.fireZonesSerialized);
    if (!options.forceFull && selection.entities.length === 0 && selection.removedEntityIds.length === 0 && !projectileChanged && !fireZonesChanged) {
      return false;
    }

    if (projectileChanged) meta.lastProjectilesSerialized = frame.projectilesSerialized;
    if (fireZonesChanged) meta.lastFireZonesSerialized = frame.fireZonesSerialized;
    this.send(ws, buildSnapshotPayload(this, {
      forceFull: !!options.forceFull,
      entities: frame.entities,
      changedEntities: selection.entities,
      removedEntityIds: selection.removedEntityIds,
      projectiles: projectileChanged ? frame.projectiles : undefined,
      fireZones: fireZonesChanged ? frame.fireZones : undefined
    }, {
      msgType: MSG_S2C.SNAPSHOT,
      nowMs: () => frame.now,
      isPrivateMatchRoom,
      roomPhaseActive: ROOM_PHASE_ACTIVE,
      emptyMatchState,
      teamAlpha: TDM_TEAM_A,
      teamBravo: TDM_TEAM_B
    }));
    return true;
  }

  markSnapshotBurst(viewerIds, entityIds, now = nowMs(), ttlMs = SNAPSHOT_BURST_WINDOW_MS) {
    if (!COMBAT_BURST_SNAPSHOTS) return false;
    const viewerList = Array.isArray(viewerIds) ? viewerIds : [viewerIds];
    const entityList = Array.isArray(entityIds) ? entityIds : [entityIds];
    const normalizedEntityIds = [];
    for (let i = 0; i < entityList.length; i++) {
      const entityId = String(entityList[i] || '');
      if (!entityId) continue;
      normalizedEntityIds.push(entityId);
    }
    if (normalizedEntityIds.length === 0) return false;

    const frame = this.collectSnapshotFrame(now);
    let sentAny = false;
    for (let i = 0; i < viewerList.length; i++) {
      const viewerId = String(viewerList[i] || '');
      if (!viewerId) continue;
      const ws = this.activeSocketByUserId.get(viewerId);
      if (!ws) continue;
      const meta = this.clients.get(ws);
      if (!meta) continue;
      const burstState = this.ensureSnapshotBurstState(meta);
      if (Number(burstState.untilAt || 0) <= now) {
        burstState.entityIds.clear();
      }
      burstState.untilAt = Math.max(Number(burstState.untilAt || 0), now + Math.max(1, Number(ttlMs || SNAPSHOT_BURST_WINDOW_MS)));
      burstState.entityIds.add(viewerId);
      for (let r = 0; r < normalizedEntityIds.length; r++) {
        burstState.entityIds.add(normalizedEntityIds[r]);
      }
      if ((now - Number(burstState.lastSentAt || 0)) < SNAPSHOT_BURST_CADENCE_MS) continue;
      if (this.sendSnapshotToClient(ws, meta, frame, {
        priorityEntityIds: burstState.entityIds,
        includeProjectiles: false,
        includeFireZones: false
      })) {
        burstState.lastSentAt = now;
        sentAny = true;
      }
    }
    return sentAny;
  }

  markEntityEngaged(sourceId, targetId, ttlMs = SNAPSHOT_ENGAGEMENT_TTL_MS, now = nowMs()) {
    const source = this.getEntityById(sourceId);
    const target = this.getEntityById(targetId);
    const until = Math.max(0, Number(now || 0)) + Math.max(1, Number(ttlMs || SNAPSHOT_ENGAGEMENT_TTL_MS));
    if (!source || !target || source.id === target.id) return false;
    if (!source.snapshotEngagements) source.snapshotEngagements = new Map();
    if (!target.snapshotEngagements) target.snapshotEngagements = new Map();
    source.snapshotEngagements.set(target.id, until);
    target.snapshotEngagements.set(source.id, until);
    return true;
  }

  isEntityEngagedForViewer(viewerEntity, entityId, now = nowMs()) {
    if (!viewerEntity || !entityId) return false;
    const engagements = viewerEntity.snapshotEngagements;
    if (!(engagements instanceof Map)) return false;
    const until = Number(engagements.get(entityId) || 0);
    if (until <= Math.max(0, Number(now || 0))) {
      if (until > 0) engagements.delete(entityId);
      return false;
    }
    return true;
  }

  markFireEngagement(player, msg, now = nowMs()) {
    if (!player || !player.alive) return [];
    let aimForward = this.entityForward(player);
    if (msg && msg.aimForward && typeof msg.aimForward === 'object') {
      const rawX = Number(msg.aimForward.x || 0);
      const rawY = Number(msg.aimForward.y || 0);
      const rawZ = Number(msg.aimForward.z || 0);
      const len = Math.sqrt((rawX * rawX) + (rawY * rawY) + (rawZ * rawZ));
      if (Number.isFinite(len) && len > 0.000001) {
        const normalized = { x: rawX / len, y: rawY / len, z: rawZ / len };
        const authoritativeForward = this.entityForward(player);
        if (dot3(normalized, authoritativeForward) >= 0.1) {
          aimForward = normalized;
        }
      }
    }

    const candidates = [];
    const entities = this.getAliveEntities();
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!this.canTargetEntity(entity, player.id)) continue;
      const dist = distance3(player, entity);
      if (!Number.isFinite(dist) || dist > SNAPSHOT_ENGAGEMENT_RANGE_WU) continue;
      const toTarget = normalize3(
        Number(entity.x || 0) - Number(player.x || 0),
        Number((entity.y || PLAYER_EYE_HEIGHT_WU) - (player.y || PLAYER_EYE_HEIGHT_WU)),
        Number(entity.z || 0) - Number(player.z || 0)
      );
      const alignment = dot3(aimForward, toTarget);
      if (alignment < SNAPSHOT_ENGAGEMENT_MIN_DOT) continue;
      candidates.push({ entity, alignment, dist });
    }

    candidates.sort((a, b) => {
      if (Math.abs(Number(b.alignment || 0) - Number(a.alignment || 0)) > 0.0001) {
        return Number(b.alignment || 0) - Number(a.alignment || 0);
      }
      return Number(a.dist || 0) - Number(b.dist || 0);
    });

    const engagedIds = [];
    for (let i = 0; i < candidates.length && engagedIds.length < SNAPSHOT_ENGAGEMENT_MAX_TARGETS; i++) {
      const target = candidates[i].entity;
      if (!target) continue;
      if (this.markEntityEngaged(player.id, target.id, SNAPSHOT_ENGAGEMENT_TTL_MS, now)) {
        engagedIds.push(target.id);
      }
    }
    return engagedIds;
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

  recordAliveEntityPoseHistories(now = nowMs()) {
    for (const player of this.players.values()) {
      if (!player || !player.alive || this.isEntityDisconnected(player)) continue;
      this.recordEntityPoseHistory(player, now);
    }
    for (const bot of this.bots.values()) {
      if (!bot || !bot.alive) continue;
      this.recordEntityPoseHistory(bot, now);
    }
  }

  resolveHitscanShotTime(msg, now = nowMs()) {
    return clampRewindShotTime(msg && msg.estimatedServerShotTime, now, {
      maxRewindMs: HITSCAN_MAX_REWIND_MS
    });
  }

  buildRewoundHitscanTarget(entity, requestedShotTime, now = nowMs()) {
    return buildRewoundTargetEntity(entity, requestedShotTime, now, {
      maxRewindMs: HITSCAN_MAX_REWIND_MS
    });
  }

  authoritativeHitscanOrigin(player, requestedShotTime = 0, now = nowMs()) {
    if (!player) return { x: 0, y: PLAYER_EYE_HEIGHT_WU, z: 0 };
    const rewoundPose = Number(requestedShotTime || 0) > 0
      ? rewindEntityPose(player, requestedShotTime, now, {
          maxRewindMs: HITSCAN_MAX_REWIND_MS
        })
      : null;
    const pose = rewoundPose || readCurrentPose(player, now) || {};
    const forward = combatEntityForward(rewoundPose || player, { normalize3 });
    const logicalOrigin = logicalHitscanOriginFromEye({
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
    const rewoundPose = Number(requestedShotTime || 0) > 0
      ? rewindEntityPose(player, requestedShotTime, now, {
          maxRewindMs: HITSCAN_MAX_REWIND_MS
        })
      : null;
    return combatEntityForward(rewoundPose || player, { normalize3 });
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
    queueAuthoritativeInput(player, msg, {
      clamp,
      createMovementInputState,
      hasIntentInputMessage,
      movementLocked: this.isEntityMovementLocked(player, now)
    });
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
    for (const p of this.players.values()) if (p && p.alive && !this.isEntityDisconnected(p)) out.push(p);
    for (const b of this.bots.values()) if (b && b.alive) out.push(b);
    return out;
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

  readClassAimPoint(player, rawAimPoint, maxRange) {
    return readCombatClassAimPoint(this, player, rawAimPoint, maxRange, {
      distance3,
      normalize3,
      dot3,
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU
    });
  }

  clampWorldAimPoint(origin, desiredPoint, maxRange) {
    return clampCombatWorldAimPoint(this, origin, desiredPoint, maxRange, {
      normalize3,
      worldRayEpsilon: WORLD_RAY_EPSILON
    });
  }

  isEntityChoked(entity, now = nowMs()) {
    return isCombatEntityChoked(entity, now);
  }

  isEntityJustBeenHooked(entity, now = nowMs()) {
    return isCombatEntityJustBeenHooked(entity, now);
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

  canEntityUseAbility(entity, now = nowMs()) {
    return canCombatEntityUseAbility(this, entity, now);
  }

  isEntityMovementLocked(entity, now = nowMs()) {
    return isCombatEntityMovementLocked(this, entity, now);
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

  applyJustBeenHooked(target, durationSec) {
    return applyCombatJustBeenHooked(target, durationSec, { nowMs });
  }

  pullEntityToward(player, target, pullDistance, pullSpeed, stunDuration = 1.0) {
    return pullCombatEntityToward(player, target, pullDistance, pullSpeed, stunDuration, { nowMs });
  }

  closestHostileInRange(player, range, minDot) {
    return closestCombatHostileInRange(this, player, range, minDot);
  }

  resolveLockedHostile(player, lockTargetId, range, minDot, options = null) {
    return resolveCombatLockedHostile(this, player, lockTargetId, range, minDot, options, {
      distance3,
      normalize3,
      dot3,
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU
    });
  }

  deadeyeCandidates(player, range, minDot, maxTargets) {
    return deadeyeCombatCandidates(this, player, range, minDot, maxTargets);
  }

  resolveClassAimPoint(player, msg, maxRange) {
    return resolveCombatClassAimPoint(this, player, msg, maxRange, { addScaled3 });
  }

  handleFire(player, msg) {
    return handleCombatFire(this, player, msg, {
      nowMs,
      weaponStats: WEAPON_STATS,
      weaponFalloff: WEAPON_FALLOFF,
      resolveHitscanShot,
      applyDamageFromSource,
      broadcastDamageEvent,
      broadcastDeathRespawn,
      canEquipWeaponId: canEntityUseWeapon,
      markFireEngagement: (firingPlayer, fireMsg, stamp) => this.markFireEngagement(firingPlayer, fireMsg, stamp),
      markSnapshotBurst: (viewerIds, entityIds, stamp, ttlMs) => this.markSnapshotBurst(viewerIds, entityIds, stamp, ttlMs),
      resolveHitscanShotTime: (fireMsg, stamp) => this.resolveHitscanShotTime(fireMsg, stamp),
      buildRewoundHitscanTarget: (entity, requestedShotTime, stamp) => this.buildRewoundHitscanTarget(entity, requestedShotTime, stamp),
      authoritativeHitscanOrigin: (entity, requestedShotTime, stamp) => this.authoritativeHitscanOrigin(entity, requestedShotTime, stamp),
      authoritativeHitscanForward: (entity, requestedShotTime, stamp) => this.authoritativeHitscanForward(entity, requestedShotTime, stamp),
      shotTokenDamageAggregation: SHOT_TOKEN_DAMAGE_AGGREGATION,
      hitscanAimOriginMaxOffset: HITSCAN_AIM_ORIGIN_MAX_OFFSET_WU,
      playerEyeHeight: PLAYER_EYE_HEIGHT_WU,
      remoteMuzzleFlashHoldMs: REMOTE_MUZZLE_FLASH_HOLD_MS
    });
  }

  handleWeaponLoadout(player, msg) {
    return handleCombatWeaponLoadout(this, player, msg, {
      normalizeWeaponLoadout,
      entityWeaponLoadout,
      createWeaponAmmoRuntime,
      canEquipWeaponId: canEntityUseWeapon
    });
  }

  handleEquipWeapon(player, msg) {
    return handleCombatEquipWeapon(this, player, msg, {
      weaponStats: WEAPON_STATS,
      canEquipWeaponId: canEntityUseWeapon
    });
  }

  handleReload(player, msg) {
    return handleCombatReload(this, player, msg, {
      nowMs,
      weaponStats: WEAPON_STATS,
      canEquipWeaponId: canEntityUseWeapon
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

  handleClassQueue(player, msg, ws) {
    return handleCombatClassQueue(this, player, msg, ws, {
      normalizeAbilityLoadout,
      msgClassChanged: MSG_S2C.CLASS_CHANGED,
      defaultAbilityLoadout: DEFAULT_ABILITY_LOADOUT
    });
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
      findSocketForUserId,
      safeJsonParse,
      nowMs,
      handleClassCast,
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
    return tickRoomLmsMode(this, {
      nowMs,
      lmsRules,
      gameModeLms: GAME_MODE_LMS
    }, now);
  }

  respawnIfNeeded(entity) {
    return respawnRoomEntityIfNeeded(this, entity, {
      nowMs,
      gameModeLms: GAME_MODE_LMS,
      resetEntityForRespawn,
      createWeaponAmmoRuntime,
      createMovementInputState
    });
  }

  tickPlayers(dtSec) {
    return tickRoomPlayers(this, dtSec, {
      tickClassAbilityState
    });
  }

  broadcastSnapshot(forceFull = false) {
    const frame = this.collectSnapshotFrame(nowMs());

    for (const [ws, meta] of this.clients.entries()) {
      if (!meta || !meta.userId) continue;
      this.sendSnapshotToClient(ws, meta, frame, {
        forceFull,
        includeProjectiles: true,
        includeFireZones: true
      });
    }
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
    this.recordAliveEntityPoseHistories(now);
    this.tickLmsMode(now);
    tickProjectiles(this, dtSec);
    tickFireZones(this, dtSec);
    this.updateLeaderProgress();
    if ((now - this.lastSnapshotAt) >= ROOM_SNAPSHOT_TICK_MS) {
      this.broadcastSnapshot(false);
      this.lastSnapshotAt = now;
    }

    this.stopTickIfEmpty();
  }
}
