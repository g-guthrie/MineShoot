import { buildReplayStepsFromPendingInputs } from '../../../shared/authoritative-reconciliation.js';
import { chooseSpawnPoint } from '../../../shared/spawn-logic.js';

const MAX_INPUT_QUEUE_SIZE = 96;

function cloneInputState(inputState, createMovementInputState) {
  const base = typeof createMovementInputState === 'function'
    ? (createMovementInputState() || {})
    : {};
  const source = inputState && typeof inputState === 'object' ? inputState : {};
  base.forward = !!source.forward;
  base.backward = !!source.backward;
  base.left = !!source.left;
  base.right = !!source.right;
  base.jump = !!source.jump;
  base.sprint = !!source.sprint;
  base.adsActive = !!source.adsActive;
  return base;
}

function normalizeInputSample(player, msg, deps) {
  deps = deps || {};
  const clamp = deps.clamp;
  const movementLocked = !!deps.movementLocked;
  const createMovementInputState = deps.createMovementInputState;
  const fallbackYaw = Number(player && player.yaw || 0);
  const fallbackPitch = Number(player && player.pitch || 0);
  const nextYaw = typeof msg.yaw !== 'number'
    ? fallbackYaw
    : Number(msg.yaw || 0);
  const nextPitch = typeof msg.pitch !== 'number'
    ? fallbackPitch
    : (clamp ? clamp(msg.pitch, -1.55, 1.55) : Number(msg.pitch || 0));
  return {
    seq: Math.max(0, Math.floor(Number(msg.seq || 0))),
    dtMs: Math.max(0, Number(msg.dtMs || 0)),
    yaw: nextYaw,
    pitch: nextPitch,
    movementLocked,
    inputState: cloneInputState({
      forward: !!msg.forward,
      backward: !!msg.backward,
      left: !!msg.left,
      right: !!msg.right,
      jump: !!msg.jump,
      sprint: !!msg.sprint,
      adsActive: !!msg.adsActive
    }, createMovementInputState)
  };
}

function ensureInputQueue(entity) {
  if (!entity) return [];
  if (!Array.isArray(entity.inputQueue)) entity.inputQueue = [];
  return entity.inputQueue;
}

function insertInputSample(queue, sample) {
  if (!Array.isArray(queue) || !sample || !(sample.seq > 0)) return false;
  for (let i = 0; i < queue.length; i++) {
    const queuedSeq = Math.max(0, Number(queue[i] && queue[i].seq || 0));
    if (queuedSeq === sample.seq) return false;
    if (queuedSeq > sample.seq) {
      queue.splice(i, 0, sample);
      while (queue.length > MAX_INPUT_QUEUE_SIZE) queue.shift();
      return true;
    }
  }
  queue.push(sample);
  while (queue.length > MAX_INPUT_QUEUE_SIZE) queue.shift();
  return true;
}

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

export function isEntityMatchEntryPending(entity, now = Date.now()) {
  if (!entity || entity.fixtureType === 'sim_player') return false;
  if (!entity.matchEntryPending) return false;
  return Number(entity.matchEntryUntil || 0) > Math.max(0, Number(now || 0));
}

function clearEntityInputState(entity) {
  if (!entity || !entity.inputState || typeof entity.inputState !== 'object') return;
  entity.inputState.forward = false;
  entity.inputState.backward = false;
  entity.inputState.left = false;
  entity.inputState.right = false;
  entity.inputState.jump = false;
  entity.inputState.sprint = false;
  entity.inputState.adsActive = false;
}

export function beginEntityMatchEntry(room, entity, deps) {
  deps = deps || {};
  const now = Number(deps.nowMs ? deps.nowMs() : Date.now());
  const entryWindowMs = Math.max(0, Number(deps.matchEntryWindowMs || 0));
  const shieldMs = Math.max(0, Number(deps.playerSpawnShieldMs || 0));
  if (!entity || entity.fixtureType === 'sim_player') return false;

  entity.matchEntryPending = entryWindowMs > 0;
  entity.matchEntryStartedAt = entity.matchEntryPending ? now : 0;
  entity.matchEntryUntil = entity.matchEntryPending ? (now + entryWindowMs) : 0;
  entity.velocityY = 0;
  entity.isGrounded = true;
  entity.jumpHoldTimer = 0;
  entity.jumpHeldLast = false;
  if (Array.isArray(entity.inputQueue)) entity.inputQueue.length = 0;
  clearEntityInputState(entity);

  if (entity.matchEntryPending) {
    entity.spawnShieldUntil = entity.matchEntryUntil + shieldMs;
  } else if (shieldMs > 0) {
    entity.spawnShieldUntil = now + shieldMs;
  }
  return true;
}

export function activateEntityMatchEntry(room, entity, deps) {
  deps = deps || {};
  if (!entity || entity.fixtureType === 'sim_player') return false;
  if (!entity.matchEntryPending && !(Number(entity.matchEntryUntil || 0) > 0)) return false;
  entity.matchEntryPending = false;
  entity.matchEntryStartedAt = 0;
  entity.matchEntryUntil = 0;
  if (Number(deps.playerSpawnShieldMs || 0) > 0) {
    applySpawnShield(entity, deps);
  }
  return true;
}

export function tickEntityMatchEntries(room, deps) {
  deps = deps || {};
  const now = Number(deps.nowMs ? deps.nowMs() : Date.now());
  let changed = false;
  for (const player of room.players.values()) {
    if (!player || player.fixtureType === 'sim_player' || !player.matchEntryPending) continue;
    if (now < Number(player.matchEntryUntil || 0)) continue;
    if (activateEntityMatchEntry(room, player, deps)) changed = true;
  }
  return changed;
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

  player.seq = Math.max(0, Number(player.seq || 0));
  player.lastProcessedInputSeq = Math.max(0, Number(player.lastProcessedInputSeq || player.seq || 0));
  player.lastReceivedInputSeq = Math.max(
    player.lastProcessedInputSeq,
    Number(player.lastReceivedInputSeq || player.pendingInputSeq || player.seq || 0)
  );
  player.pendingInputSeq = Math.max(player.lastReceivedInputSeq, Number(player.pendingInputSeq || 0));
  player.inputState = player.inputState || (createMovementInputState ? createMovementInputState() : null) || {};
  player.inputQueue = ensureInputQueue(player);

  spawnEntityRandomly(room, player, deps);
  applySpawnShield(player, deps);
  if (room && typeof room.seedEntityPoseHistory === 'function') {
    room.seedEntityPoseHistory(player);
  }
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
      room.players.set(id, room.buildPlayerEntity(id, username, 'ffa', { fixtureType: 'sim_player' }));
      continue;
    }
    const player = room.players.get(id);
    player.fixtureType = 'sim_player';
    player.kind = 'player';
    player.username = username;
    player.classId = 'ffa';
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

  if (room.players.has(userId)) {
    const player = room.players.get(userId);
    player.username = username || player.username;
    player.actorId = String(actorId || player.actorId || player.id || '');
    player.actorName = String(actorName || player.actorName || username || player.username || player.id || 'player');
    player.disconnectedAt = 0;
    beginEntityMatchEntry(room, player, deps);
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
  beginEntityMatchEntry(room, player, deps);
  if (isPrivateMatchRoom && isPrivateMatchRoom(room.roomName) && room.privateRoomConfig && room.privateRoomConfig.teams) {
    player.teamId = String(room.privateRoomConfig.teams.get(player.actorId || player.id) || teamAlpha);
  }
  room.applyJoinBaseline(player);
  room.players.set(userId, player);
  return player;
}

export function queueAuthoritativeInput(player, msg, deps) {
  deps = deps || {};
  const clamp = deps.clamp;
  const createMovementInputState = deps.createMovementInputState;
  const movementLocked = !!deps.movementLocked;
  if (!player || !msg) return;

  player.seq = Math.max(0, Number(player.seq || 0));
  player.lastProcessedInputSeq = Math.max(0, Number(player.lastProcessedInputSeq || player.seq || 0));
  player.inputMode = 'intent';
  const sample = normalizeInputSample(player, msg, {
    clamp,
    movementLocked,
    createMovementInputState
  });

  player.pendingInputSeq = Math.max(Number(player.pendingInputSeq || 0), sample.seq);
  player.lastReceivedInputSeq = Math.max(Number(player.lastReceivedInputSeq || 0), sample.seq);
  player.inputState = cloneInputState(sample.inputState, createMovementInputState);
  player.yaw = sample.yaw;
  player.pitch = sample.pitch;

  if (sample.seq <= Math.max(0, Number(player.lastProcessedInputSeq || 0))) return;
  insertInputSample(ensureInputQueue(player), sample);
}

export function applyPendingInputAck(entity) {
  if (!entity) return 0;
  const pendingSeq = Math.max(
    0,
    Number(entity.lastProcessedInputSeq || 0),
    Number(entity.seq || 0)
  );
  const currentSeq = Number(entity.seq || 0);
  if (pendingSeq > currentSeq) {
    entity.seq = pendingSeq;
  }
  return Number(entity.seq || 0);
}

export function consumeQueuedAuthoritativeInputs(entity, dtSec, deps) {
  deps = deps || {};
  const createMovementInputState = deps.createMovementInputState;
  const totalDtSec = Math.max(0, Number(dtSec || 0));
  if (!entity || !(totalDtSec > 0)) {
    return { steps: [], processedSeq: 0 };
  }

  const queue = ensureInputQueue(entity);
  if (queue.length === 0) {
    return {
      steps: [{
        dtSec: totalDtSec,
        yaw: Number(entity.yaw || 0),
        pitch: Number(entity.pitch || 0),
        inputState: cloneInputState(entity.inputState, createMovementInputState)
      }],
      processedSeq: 0
    };
  }

  const samples = queue.slice();
  queue.length = 0;
  const replayPlan = buildReplayStepsFromPendingInputs(samples, {
    totalDtSec: totalDtSec,
    createMovementInputState,
    fallbackYaw: Number(entity.yaw || 0),
    fallbackPitch: Number(entity.pitch || 0)
  });
  if (replayPlan.steps.length === 0) {
    return {
      steps: [{
        dtSec: totalDtSec,
        yaw: Number(entity.yaw || 0),
        pitch: Number(entity.pitch || 0),
        inputState: cloneInputState(entity.inputState, createMovementInputState)
      }],
      processedSeq: 0
    };
  }

  return {
    steps: replayPlan.steps,
    processedSeq: replayPlan.processedSeq
  };
}

export function respawnIfNeeded(room, entity, deps) {
  deps = deps || {};
  const nowMs = deps.nowMs;
  const resetEntityForRespawn = deps.resetEntityForRespawn;
  const createWeaponAmmoRuntime = deps.createWeaponAmmoRuntime;
  const createMovementInputState = deps.createMovementInputState;
  if (entity.alive || entity.eliminated) return;
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
  entity.inputQueue = [];
  entity.lastProcessedInputSeq = Math.max(0, Number(entity.lastProcessedInputSeq || entity.seq || 0));
  entity.lastReceivedInputSeq = entity.lastProcessedInputSeq;
  entity.pendingInputSeq = entity.lastProcessedInputSeq;
  entity.seq = entity.lastProcessedInputSeq;
  if (typeof room.seedEntityPoseHistory === 'function') {
    room.seedEntityPoseHistory(entity, nowMs());
  }
}

export function tickPlayers(room, dtSec, deps) {
  deps = deps || {};
  for (const player of room.players.values()) {
    room.respawnIfNeeded(player);
    room.tickAuthoritativePlayerMovement(player, dtSec);
    applyPendingInputAck(player);
    room.regenArmor(player, dtSec);
    room.tickStreamState(player, dtSec);
    room.tickThrowableRegen(player, dtSec);
    if (deps.tickClassAbilityState) deps.tickClassAbilityState(room, player);
  }
}
