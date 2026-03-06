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
import { getSeekProfileByWeaponId } from '../../../shared/seek-profiles.js';
import { selectSeekTarget } from '../../../shared/seek-core.js';

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

const ROOM_TICK_MS = 50;
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
const DEV_LOCAL_BOT_COUNT = 2;
const DEV_LOCAL_SIM_PLAYER_IDS = ['sim-player-1', 'sim-player-2'];
const DEV_LOCAL_SIM_PLAYER_NAMES = ['SIM_PLAYER_1', 'SIM_PLAYER_2'];

function classPreset(classId) {
  return CLASS_PRESETS[classId] || CLASS_PRESETS.abilities;
}

function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
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
  }

  refreshWorldMeta() {
    this.roomName = sanitizeRoomId(this.roomName || this.env.ROOM_NAME || 'global');
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
      tickRate: Math.round(1000 / ROOM_TICK_MS),
      worldSeed: this.worldSeed,
      worldProfileVersion: this.worldProfileVersion,
      worldFlags: cloneWorldFlags(this.worldFlags)
    };
  }

  ensureTick() {
    if (this.tickHandle) return;
    this.lastTickAt = nowMs();
    this.tickHandle = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error('tick error', err);
      }
    }, ROOM_TICK_MS);
  }

  stopTickIfEmpty() {
    if (this.clients.size > 0) return;
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    this.roomName = sanitizeRoomId(url.searchParams.get('roomId') || this.roomName || this.env.ROOM_NAME || 'global');
    this.refreshWorldMeta();
    this.syncRoomFixtures();

    if (request.headers.get('Upgrade') !== 'websocket') {
      if (url.pathname === '/state') {
        return json({
          ok: true,
          players: this.humanPlayerCount(),
          connectedPlayers: this.connectedHumanCount(),
          simPlayers: this.simulatedPlayerCount(),
          bots: this.bots.size
        });
      }
      return new Response('Expected websocket upgrade', { status: 426 });
    }

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
    this.ensureTick();

    this.send(server, this.buildWelcomePayload(userId));

    this.broadcastSnapshot();

    return new Response(null, { status: 101, webSocket: client });
  }

  isDevLocalRoom() {
    return this.roomName === DEV_LOCAL_ROOM_NAME;
  }

  desiredBotCount() {
    if (this.isDevLocalRoom()) return DEV_LOCAL_BOT_COUNT;
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
    entity.x = 15 + Math.random() * 80;
    entity.z = 15 + Math.random() * 80;
    if (entity.kind === 'player') {
      entity.y = this.terrainEyeYAt(entity.x, entity.z);
    } else if (!Number.isFinite(entity.y)) {
      entity.y = PLAYER_EYE_HEIGHT_WU;
    }
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
      abilityCooldownUntil: 0,
      ultimateCooldownUntil: 0,
      stunUntil: 0,
      slowUntil: 0,
      slowMultiplier: 1,
      deadeye: null,
      chokeState: null
    };

    this.spawnEntityRandomly(p);
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
      this.enforceEntityTerrainFloor(p);
      return p;
    }

    const p = this.buildPlayerEntity(userId, username, classId);
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
      if (!e || !e.alive || e.id === projectile.ownerId) continue;
      const dx = e.x - projectile.x;
      const dz = e.z - projectile.z;
      const d = Math.sqrt(dx * dx + dz * dz);
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
    let slowMult = 1;
    if (!stunned) {
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
    if (typeof msg.yaw === 'number') player.yaw = msg.yaw;
    if (typeof msg.pitch === 'number') player.pitch = clamp(msg.pitch, -1.55, 1.55);
    if (typeof msg.seq === 'number') player.seq = Math.max(player.seq, msg.seq);
    if (typeof msg.weaponId === 'string' && WEAPON_STATS[msg.weaponId]) player.weaponId = msg.weaponId;
    if (!stunned) {
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
      if (!e || e.id === player.id) continue;
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
      if (!e || !e.alive) continue;
      if (excludeId && e.id === excludeId) continue;
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

  closestHostileInRange(player, range, minDot) {
    const hits = this.hostilesInCone(player, range, minDot);
    return hits.length > 0 ? hits[0].entity : null;
  }

  resolveLockedHostile(player, lockTargetId, range, minDot) {
    if (!player || !player.alive || !lockTargetId) return null;
    const target = this.getEntityById(String(lockTargetId));
    if (!target || !target.alive || target.id === player.id) return null;
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
    if (!target || !target.alive || target.id === player.id) return;

    const dist = distance3(player, target);
    if (dist > stats.maxRange) return;

    let damage = hitType === 'head' ? stats.headDamage : stats.bodyDamage;
    damage = applyWeaponFalloff(weaponId, damage, dist);
    const out = applyDamageFromSource(player, target, damage, {
      hitType,
      weaponId,
      sourceKind: 'weapon'
    });
    if (!out) return;

    broadcastDamageEvent(this, player.id, target, out, hitType);

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
      if (!e || !e.alive || e.id === player.id) continue;
      out.push({
        id: e.id,
        ownerType: e.kind || 'entity',
        corePos: this.entityAimTargetPosition(e),
        alive: true
      });
    }
    return out;
  }

  resolveSeekLock(player, preferredTargetId, profile) {
    if (!player || !player.alive || !profile) return null;
    const candidates = this.buildSeekCandidates(player);
    if (!candidates.length) return null;
    const preferred = String(preferredTargetId || '');
    const shortlist = preferred ? candidates.filter((c) => c.id === preferred) : candidates;
    const lock = selectSeekTarget({
      origin: this.entityAimTargetPosition(player),
      forward: this.entityForward(player),
      candidates: shortlist.length ? shortlist : candidates,
      maxRange: Number(profile.maxRange || 24),
      coneHalfAngleDeg: Number(profile.coneHalfAngleDeg || 35)
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

    const requestedWeaponId = String(msg && msg.weaponId ? msg.weaponId : 'seekergun');
    const weaponId = requestedWeaponId === 'plasma' ? 'plasma' : 'seekergun';
    const profile = getSeekProfileByWeaponId(weaponId) || getSeekProfileByWeaponId('seekergun');
    if (!profile) {
      if (ws) this.send(ws, { t: MSG_S2C.SEEKER_REJECT, weaponId, reason: 'invalid' });
      return;
    }
    const stats = WEAPON_STATS[weaponId] || WEAPON_STATS.seekergun || { cooldownMs: 320, maxRange: 24 };
    const cooldownMs = Math.max(1, Number(profile.cooldownMs || stats.cooldownMs || 320));
    const now = nowMs();
    const shotKey = weaponId === 'plasma' ? 'plasma' : 'seekergun';
    const prev = player.lastShotAt[shotKey] || 0;
    if ((now - prev) < cooldownMs) {
      if (ws) this.send(ws, { t: MSG_S2C.SEEKER_REJECT, weaponId, reason: 'cooldown' });
      return;
    }

    if (weaponId === 'plasma' && now < (player.streamOverheatedUntil || 0)) {
      if (ws) this.send(ws, { t: MSG_S2C.SEEKER_REJECT, weaponId: 'plasma', reason: 'overheated' });
      return;
    }

    player.lastShotAt[shotKey] = now;
    player.weaponId = weaponId;
    player.muzzleFlashUntil = now + REMOTE_MUZZLE_FLASH_HOLD_MS;

    const rawClientShotId = String(msg && msg.clientShotId ? msg.clientShotId : '');
    const clientShotId = /^[a-zA-Z0-9_-]{3,96}$/.test(rawClientShotId) ? rawClientShotId : '';
    const rawLockTargetId = String(msg && msg.lockTargetId ? msg.lockTargetId : '');
    const locked = this.resolveSeekLock(player, rawLockTargetId, profile);

    if (weaponId === 'plasma') {
      const overheatedNow = this.applyPlasmaStreamHeat(player, profile, now);
      if (overheatedNow && ws) {
        this.send(ws, { t: MSG_S2C.SEEKER_REJECT, weaponId: 'plasma', reason: 'overheated' });
      }
    }

    const projectileType = String(profile.projectileType || (weaponId === 'plasma' ? 'plasma_stream' : 'seekershot'));
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
    if (slot1 && ABILITY_CATALOG[slot1]) {
      const def = ABILITY_CATALOG[slot1];
      if (def.slot === 'ability' || def.slot === 'either') {
        player.abilityLoadout = player.abilityLoadout || {};
        player.abilityLoadout.slot1 = slot1;
      }
    }
    if (slot2 && ABILITY_CATALOG[slot2]) {
      const def = ABILITY_CATALOG[slot2];
      if (def.slot === 'ultimate' || def.slot === 'either') {
        player.abilityLoadout = player.abilityLoadout || {};
        player.abilityLoadout.slot2 = slot2;
      }
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
      // Keep player entity for short reconnect window by marking disconnected only via snapshots.
      // For v1 we keep them alive and visible until room restart.
    }

    this.stopTickIfEmpty();
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
    this.spawnEntityRandomly(entity);
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

  broadcastSnapshot() {
    const entities = [];
    for (const player of this.players.values()) entities.push(toEntityState(player));
    for (const bot of this.bots.values()) entities.push(toEntityState(bot));
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
      entities,
      projectiles,
      fireZones
    });
  }

  tick() {
    const now = nowMs();
    const dtSec = Math.max(0.001, Math.min(0.2, (now - this.lastTickAt) / 1000));
    this.lastTickAt = now;

    this.syncRoomFixtures();
    this.tickPlayers(dtSec);
    tickBots(this, dtSec);
    tickProjectiles(this, dtSec);
    tickFireZones(this, dtSec);
    this.broadcastSnapshot();
  }
}
