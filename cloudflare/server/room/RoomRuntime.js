import { chooseSpawnPoint } from '../../../shared/spawn-logic.js';

export function terrainFeetYAt(room, x, z) {
  if (room.worldFlags && room.worldFlags.terrainPhysicsV2 && room.terrainSampler && typeof room.terrainSampler.getGroundHeightAt === 'function') {
    return Number(room.terrainSampler.getGroundHeightAt(Number(x || 0), Number(z || 0)) || 0);
  }
  return 0;
}

export function terrainEyeYAt(room, x, z, deps) {
  deps = deps || {};
  return terrainFeetYAt(room, x, z) + Number(deps.playerEyeHeight || 0);
}

export function enforceEntityTerrainFloor(room, entity, deps) {
  if (!entity) return 0;
  const floorEyeY = terrainEyeYAt(room, entity.x, entity.z, deps);
  if (!Number.isFinite(entity.y) || entity.y < floorEyeY) {
    entity.y = floorEyeY;
  }
  return floorEyeY;
}

export function buildSpawnAvoidPoints(room, entity) {
  const avoidPoints = [];
  const selfId = entity && entity.id ? entity.id : '';
  const entities = room.getAliveEntities();
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

function isSpawnExcluded(room, x, z, padding = 0) {
  const zones = room && room.worldCollision && Array.isArray(room.worldCollision.spawnExclusionZones)
    ? room.worldCollision.spawnExclusionZones
    : [];
  const pad = Number(padding || 0);
  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    if (!zone) continue;
    const dx = Number(x || 0) - Number(zone.x || 0);
    const dz = Number(z || 0) - Number(zone.z || 0);
    const radius = Math.max(0, Number(zone.radius || 0)) + pad;
    if ((dx * dx) + (dz * dz) <= (radius * radius)) return true;
  }
  return false;
}

function isSpawnBlocked(room, x, z, padding = 0) {
  const boxes = room && room.worldCollision && Array.isArray(room.worldCollision.collidables)
    ? room.worldCollision.collidables
    : [];
  const pad = Number(padding || 0);
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (!box || !box.min || !box.max) continue;
    if (
      Number(x || 0) > (Number(box.min.x || 0) - pad) &&
      Number(x || 0) < (Number(box.max.x || 0) + pad) &&
      Number(z || 0) > (Number(box.min.z || 0) - pad) &&
      Number(z || 0) < (Number(box.max.z || 0) + pad)
    ) {
      return true;
    }
  }
  return false;
}

export function chooseEntitySpawnPoint(room, entity, deps) {
  deps = deps || {};
  return chooseSpawnPoint({
    boundsMin: room.boundsMin,
    boundsMax: room.boundsMax,
    padding: Number(deps.spawnPadding || 8),
    minGroundY: -0.15,
    minClearance: Number(deps.spawnMinClearance || 14),
    avoidPoints: buildSpawnAvoidPoints(room, entity),
    getGroundHeightAt: (x, z) => terrainFeetYAt(room, x, z),
    isExcluded: (x, z) => isSpawnExcluded(room, x, z, Number(deps.spawnExclusionPadding || 0.85)),
    isBlocked: (x, z) => isSpawnBlocked(room, x, z, Number(deps.spawnBlockPadding || 1.15))
  });
}

export function applyEntitySpawnPoint(room, entity, spawn, deps) {
  deps = deps || {};
  if (!entity || !spawn) return;
  entity.x = Number(spawn.x || 0);
  entity.z = Number(spawn.z || 0);
  if (entity.kind === 'player') {
    entity.y = terrainEyeYAt(room, entity.x, entity.z, deps);
    entity.velocityY = 0;
    entity.isGrounded = true;
    entity.jumpHoldTimer = 0;
    entity.jumpHeldLast = false;
  } else if (!Number.isFinite(entity.y)) {
    entity.y = Number(deps.playerEyeHeight || 0);
  }
}

export function spawnEntityRandomly(room, entity, deps) {
  if (!entity) return;
  const spawn = chooseEntitySpawnPoint(room, entity, deps);
  applyEntitySpawnPoint(room, entity, spawn, deps);
  entity.plannedSpawnPoint = null;
}

export function applySpawnShield(entity, deps) {
  deps = deps || {};
  if (!entity) return;
  entity.spawnShieldUntil = Number(deps.nowMs ? deps.nowMs() : 0) + Number(deps.playerSpawnShieldMs || 0);
}

export function planEntityRespawn(room, entity, deps) {
  if (!entity) return null;
  const spawn = chooseEntitySpawnPoint(room, entity, deps);
  entity.plannedSpawnPoint = {
    x: Number(spawn.x || 0),
    z: Number(spawn.z || 0)
  };
  return entity.plannedSpawnPoint;
}

export function buildPlayerEntity(room, userId, username, _classId, options, deps) {
  deps = deps || {};
  const createPlayerEntity = deps.createPlayerEntity;
  const createMovementInputState = deps.createMovementInputState;
  const createWeaponAmmoRuntime = deps.createWeaponAmmoRuntime;
  const opts = options || {};
  const player = createPlayerEntity({
    id: userId,
    username,
    actorId: String(opts.actorId || userId || ''),
    actorName: String(opts.actorName || username || userId || 'player'),
    fixtureType: opts.fixtureType || '',
    yaw: Number(opts.yaw || 0),
    pitch: Number(opts.pitch || 0),
    eyeHeight: Number(deps.playerEyeHeight || 0),
    createMovementInputState,
    createWeaponAmmoRuntime,
    createThrowableRuntime: () => room.createThrowableRuntime()
  });

  spawnEntityRandomly(room, player, deps);
  applySpawnShield(player, deps);
  return player;
}

export function syncSimulatedPlayers(room, deps) {
  deps = deps || {};
  const simPlayerIds = deps.simPlayerIds || [];
  const simPlayerNames = deps.simPlayerNames || [];
  const allowed = {};
  for (let i = 0; i < simPlayerIds.length; i++) {
    allowed[simPlayerIds[i]] = true;
  }

  if (!room.isDevLocalRoom()) {
    const toRemove = [];
    for (const player of room.players.values()) {
      if (player && player.fixtureType === 'sim_player') toRemove.push(player.id);
    }
    for (let i = 0; i < toRemove.length; i++) {
      room.players.delete(toRemove[i]);
    }
    return;
  }

  for (let i = 0; i < simPlayerIds.length; i++) {
    const id = simPlayerIds[i];
    const username = simPlayerNames[i];
    if (!room.players.has(id)) {
      room.players.set(id, room.buildPlayerEntity(id, username, 'abilities', { fixtureType: 'sim_player' }));
      continue;
    }
    const player = room.players.get(id);
    player.fixtureType = 'sim_player';
    player.kind = 'player';
    player.username = username;
    player.classId = 'abilities';
    player.moveSpeedNorm = 0;
    player.sprinting = false;
    player.yaw = 0;
    player.pitch = 0;
    room.enforceEntityTerrainFloor(player);
  }

  const extra = [];
  for (const player of room.players.values()) {
    if (!player || player.fixtureType !== 'sim_player') continue;
    if (!allowed[player.id]) extra.push(player.id);
  }
  for (let i = 0; i < extra.length; i++) {
    room.players.delete(extra[i]);
  }
}

export function syncRoomFixtures(room, deps) {
  deps = deps || {};
  syncSimulatedPlayers(room, deps);
  if (deps.ensureBots) deps.ensureBots(room);
}

export function ensurePlayer(room, userId, username, classId, actorId, actorName, deps) {
  deps = deps || {};
  const isPrivateMatchRoom = deps.isPrivateMatchRoom;
  const teamAlpha = deps.teamAlpha || 'alpha';
  const gameModeTdm = deps.gameModeTdm || 'tdm';
  const gameModeLms = deps.gameModeLms || 'lms';
  const lmsRules = deps.lmsRules || {};

  if (room.players.has(userId)) {
    const player = room.players.get(userId);
    player.username = username || player.username;
    player.actorId = String(actorId || player.actorId || player.id || '');
    player.actorName = String(actorName || player.actorName || username || player.username || player.id || 'player');
    player.disconnectedAt = 0;
    room.enforceEntityTerrainFloor(player);
    if (isPrivateMatchRoom && isPrivateMatchRoom(room.roomName) && room.privateRoomConfig && room.privateRoomConfig.teams) {
      player.teamId = String(room.privateRoomConfig.teams.get(player.actorId || player.id) || teamAlpha);
    }
    if (room.isPublicMatchRoom() && room.gameMode === gameModeTdm && !player.teamId) {
      room.applyJoinBaseline(player);
    }
    return player;
  }

  const player = room.buildPlayerEntity(userId, username, classId, {
    actorId,
    actorName
  });
  player.disconnectedAt = 0;
  if (isPrivateMatchRoom && isPrivateMatchRoom(room.roomName) && room.privateRoomConfig && room.privateRoomConfig.teams) {
    player.teamId = String(room.privateRoomConfig.teams.get(player.actorId || player.id) || teamAlpha);
  }
  room.applyJoinBaseline(player);
  room.players.set(userId, player);
  return player;
}

export function respawnIfNeeded(room, entity, deps) {
  deps = deps || {};
  const nowMs = deps.nowMs;
  const gameModeLms = deps.gameModeLms || 'lms';
  const resetEntityForRespawn = deps.resetEntityForRespawn;
  const createWeaponAmmoRuntime = deps.createWeaponAmmoRuntime;
  const createMovementInputState = deps.createMovementInputState;
  if (entity.alive) return;
  if (room.gameMode === gameModeLms && Number(entity.lmsLives || 0) <= 0) return;
  if ((entity.respawnAt || 0) > nowMs()) return;

  if (entity.plannedSpawnPoint) {
    room.applyEntitySpawnPoint(entity, entity.plannedSpawnPoint);
    entity.plannedSpawnPoint = null;
  } else {
    room.spawnEntityRandomly(entity);
  }
  room.applySpawnShield(entity);
  resetEntityForRespawn(entity, {
    createThrowableRuntime: () => room.createThrowableRuntime(),
    createWeaponAmmoRuntime,
    createMovementInputState,
    zeroAim: entity.fixtureType === 'sim_player'
  });
}

export function tickPlayers(room, dtSec, deps) {
  deps = deps || {};
  for (const player of room.players.values()) {
    room.respawnIfNeeded(player);
    room.tickAuthoritativePlayerMovement(player, dtSec);
    room.regenArmor(player, dtSec);
    room.tickStreamState(player, dtSec);
    room.tickThrowableRegen(player, dtSec);
    if (deps.tickClassAbilityState) deps.tickClassAbilityState(room, player);
  }
}
