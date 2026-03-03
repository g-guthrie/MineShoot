import { DurableObject } from 'cloudflare:workers';
import { getSharedTuningWu } from '../../lib/shared-tuning.js';
import { getSharedProtocol } from '../../lib/shared-protocol.js';
import { createSharedTerrainSampler } from '../../lib/shared-terrain.js';
import {
  nowMs,
  safeJsonParse,
  sanitizeRoomId,
  randomId,
  json,
  distance3,
  normalize3,
  addScaled3,
  dot3,
  clamp
} from '../transport.js';
import { applyShotgunFalloffDamage } from '../sim/combat.js';
import { buildDeadeyeState, getAbilityCooldowns } from '../sim/abilities.js';
import { integrateProjectileMotion } from '../sim/projectiles.js';
import { getSeekProfileByWeaponId } from '../../../shared/seek-profiles.js';
import { selectSeekTarget, steerHomingVelocity } from '../../../shared/seek-core.js';

const GAMEPLAY_TUNING_WU = getSharedTuningWu();
const SHARED_PROTOCOL = getSharedProtocol();
const MSG_C2S = SHARED_PROTOCOL.msg.c2s;
const MSG_S2C = SHARED_PROTOCOL.msg.s2c;
const SHARED_WORLD_DEFAULTS = SHARED_PROTOCOL.world || {};

const WORLD_PROFILE_VERSION = Math.max(1, Number(SHARED_WORLD_DEFAULTS.profileVersion || 3));
const WORLD_SEED_PREFIX = String(SHARED_WORLD_DEFAULTS.seedPrefix || 'room-env-v3');
const WORLD_FLAGS = {
  envV2: !!(SHARED_WORLD_DEFAULTS.flags && SHARED_WORLD_DEFAULTS.flags.envV2),
  terrainPhysicsV2: (SHARED_WORLD_DEFAULTS.flags)
    ? !!SHARED_WORLD_DEFAULTS.flags.terrainPhysicsV2
    : true
};

const CLASS_PRESETS = GAMEPLAY_TUNING_WU.classPresets;
const WEAPON_STATS = GAMEPLAY_TUNING_WU.weaponStats;
const THROWABLE_STATS = GAMEPLAY_TUNING_WU.throwables;
const CLASS_ABILITY_STATS = GAMEPLAY_TUNING_WU.classAbilities;
const CLASS_DEFAULT_WEAPON = {
  abilities: 'rifle',
  ninja: 'pistol',
  jedi: 'shotgun',
  magician: 'rifle',
  sharpshooter: 'sniper',
  brawler: 'machinegun'
};

const ROOM_TICK_MS = 50;
const MAX_HP = 500;
const REMOTE_MUZZLE_FLASH_HOLD_MS = 90;
const PLAYER_EYE_HEIGHT_WU = 1.6;
const THROWABLE_SPAWN_FORWARD_WU = 0.55;
const THROWABLE_SPAWN_LEFT_WU = 0.34;
const THROWABLE_SPAWN_HEIGHT_WU = 1.0;
const THROWABLE_BOT_THROW_COOLDOWN_S = 2.8;
const THROW_INTENT_ORIGIN_MAX_OFFSET_WU = 1.2;
const THROW_INTENT_DIRECTION_MIN_DOT = -0.2;
const KNIFE_HEADSHOT_HEIGHT_DELTA_WU = 0.45;
const SHOTGUN_BURST_WINDOW_MS = 220;
const SHOTGUN_FALLOFF_FULL_DAMAGE_END_WU = 8;
const SHOTGUN_FALLOFF_MIN_DAMAGE_START_WU = 24;

function classPreset(classId) {
  return CLASS_PRESETS[classId] || CLASS_PRESETS.sharpshooter;
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
    this.ensureBots();
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

  ensureBots() {
    const desired = Math.max(0, Number(this.env.BOT_COUNT || '6'));
    for (let i = 0; i < desired; i++) {
      const id = `bot-${i + 1}`;
      if (this.bots.has(id)) continue;
      const classId = 'abilities';
      const preset = classPreset(classId);
      this.bots.set(id, {
        id,
        kind: 'bot',
        username: `BOT_${i + 1}`,
        classId,
        queuedClassId: null,
        x: 10 + Math.random() * 90,
        y: 1.6,
        z: 10 + Math.random() * 90,
        yaw: Math.random() * Math.PI * 2,
        pitch: 0,
        hp: MAX_HP,
        hpMax: MAX_HP,
        armor: preset.armorMax,
        armorMax: preset.armorMax,
        wallhackRadius: preset.wallhackRadius,
        alive: true,
        respawnAt: 0,
        lastDamageAt: 0,
        weaponId: 'rifle',
        lastShotAt: {},
        shotBurstState: {},
        moveSpeedNorm: 0,
        sprinting: false,
        streamHeat: 0,
        streamOverheatedUntil: 0,
        muzzleFlashUntil: 0,
        throwables: this.createThrowableRuntime(),
        lastThrowAt: 0,
        abilityCooldownUntil: 0,
        ultimateCooldownUntil: 0,
        focusShots: 0,
        focusUntil: 0,
        rageUntil: 0,
        rageNextTickAt: 0,
        stunUntil: 0,
        slowUntil: 0,
        slowMultiplier: 1,
        shadowDashUntil: 0,
        deadeye: null,
        chokeState: null,
        aiDirX: Math.cos(Math.random() * Math.PI * 2),
        aiDirZ: Math.sin(Math.random() * Math.PI * 2),
        aiSpeed: 2.2,
        aiTurnTimer: 1 + Math.random() * 3
      });
    }
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

    if (request.headers.get('Upgrade') !== 'websocket') {
      if (url.pathname === '/state') {
        return json({ ok: true, players: this.players.size, bots: this.bots.size });
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

  ensurePlayer(userId, username, classId) {
    if (this.players.has(userId)) {
      const p = this.players.get(userId);
      p.username = username || p.username;
      this.enforceEntityTerrainFloor(p);
      return p;
    }

    classId = 'abilities';
    const preset = classPreset(classId);
    const spawnX = 15 + Math.random() * 80;
    const spawnZ = 15 + Math.random() * 80;
    const spawnY = this.terrainEyeYAt(spawnX, spawnZ);
    const p = {
      id: userId,
      kind: 'player',
      username,
      classId,
      queuedClassId: null,
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      yaw: 0,
      pitch: 0,
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
      focusShots: 0,
      focusUntil: 0,
      rageUntil: 0,
      rageNextTickAt: 0,
      stunUntil: 0,
      slowUntil: 0,
      slowMultiplier: 1,
      shadowDashUntil: 0,
      deadeye: null,
      chokeState: null
    };

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

  projectileDamageHit(projectile, target, hitType) {
    const def = THROWABLE_STATS[projectile.type];
    if (!def || !target) return;
    const owner = this.getEntityById(projectile.ownerId);
    const damage = hitType === 'head'
      ? (def.headDamage || def.damage || 1)
      : (def.bodyDamage || def.damage || 1);
    const out = this.applyDamageFromSource(owner, target, damage, {
      hitType,
      weaponId: projectile.type || 'knife',
      sourceKind: 'throwable',
      applyOutgoing: false
    });
    if (!out) return;
    this.broadcastDamageEvent(projectile.ownerId, target, out, hitType);
    if (out.killed) {
      this.broadcast({
        t: MSG_S2C.DEATH_RESPAWN,
        entityId: target.id,
        respawnAt: target.respawnAt,
        classApplied: target.classId
      });
    }
  }

  explodeProjectile(projectile, x, y, z) {
    const def = THROWABLE_STATS[projectile.type];
    if (!def) return;
    if (projectile.type === 'molotov') {
      const zoneId = `zone_${this.nextFireZoneSeq++}`;
      this.fireZones.set(zoneId, {
        id: zoneId,
        ownerId: projectile.ownerId,
        x,
        y,
        z,
        radius: def.fireRadius,
        life: def.fireDuration,
        tickTimer: 0
      });
      this.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: projectile.id, impactType: 'molotov', x, y, z });
      return;
    }
    const radius = def.radius || 0;
    const damage = def.damage || 0;
    const owner = this.getEntityById(projectile.ownerId);
    const entities = [];
    for (const p of this.players.values()) entities.push(p);
    for (const b of this.bots.values()) entities.push(b);
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e || !e.alive || e.id === projectile.ownerId) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > radius) continue;
      const falloff = 1 - (dist / Math.max(0.001, radius));
      const blastDamage = Math.max(20, Math.round(damage * falloff));
      const out = this.applyDamageFromSource(owner, e, blastDamage, {
        hitType: 'body',
        weaponId: projectile.type || 'frag',
        sourceKind: 'throwable',
        applyOutgoing: false
      });
      if (!out) continue;
      this.broadcastDamageEvent(projectile.ownerId, e, out, 'body');
      if (out.killed) {
        this.broadcast({
          t: MSG_S2C.DEATH_RESPAWN,
          entityId: e.id,
          respawnAt: e.respawnAt,
          classApplied: e.classId
        });
      }
    }
    this.broadcast({ t: MSG_S2C.THROW_EXPLODE, projectileId: projectile.id, x, y, z, radius });
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

  getClassAbilityCfg(classId) {
    return CLASS_ABILITY_STATS[classId] || CLASS_ABILITY_STATS.sharpshooter || {};
  }

  applyShotgunFalloff(baseDamage, distance) {
    return applyShotgunFalloffDamage(
      baseDamage,
      distance,
      SHOTGUN_FALLOFF_FULL_DAMAGE_END_WU,
      SHOTGUN_FALLOFF_MIN_DAMAGE_START_WU
    );
  }

  applyIncomingDamageModifier(target, damage) {
    let out = Math.max(1, Math.round(damage));
    if (target && target.classId === 'brawler') {
      out = Math.max(1, Math.round(out * 0.85));
    } else if (target && target.classId === 'jedi') {
      out = Math.max(1, Math.round(out * 0.9));
    }
    return out;
  }

  applyOutgoingDamageModifier(source, damage, hitType, weaponId, sourceKind) {
    let out = Math.max(1, Math.round(damage));
    if (!source || sourceKind !== 'weapon') return out;

    const classId = source.classId || 'sharpshooter';
    const now = nowMs();

    if (classId === 'sharpshooter') {
      if ((source.focusShots || 0) > 0 && (source.focusUntil || 0) > now) {
        source.focusShots = Math.max(0, (source.focusShots || 0) - 1);
        if (source.focusShots <= 0) source.focusUntil = 0;
        const cfg = this.getClassAbilityCfg('sharpshooter');
        const focusCfg = cfg.focus || {};
        const boost = weaponId === 'sniper'
          ? Number(focusCfg.sniperBoost || 1.8)
          : Number(focusCfg.defaultBoost || 1.55);
        out = Math.max(1, Math.round(out * boost));
      } else if ((source.focusUntil || 0) <= now) {
        source.focusShots = 0;
        source.focusUntil = 0;
      }
    }

    if (classId === 'ninja' && hitType === 'head') {
      out = Math.max(1, Math.round(out * 1.18));
    }

    if (classId === 'magician' && weaponId === 'shotgun') {
      out = Math.max(1, Math.round(out * 0.92));
    }

    return out;
  }

  applyDamageFromSource(source, target, baseDamage, opts = {}) {
    if (!target || !target.alive) return null;
    const hitType = opts.hitType === 'head' ? 'head' : 'body';
    const weaponId = String(opts.weaponId || '');
    const sourceKind = String(opts.sourceKind || 'weapon');
    let damage = Math.max(1, Math.round(baseDamage));

    if (opts.applyOutgoing !== false) {
      damage = this.applyOutgoingDamageModifier(source, damage, hitType, weaponId, sourceKind);
    }
    if (opts.applyIncoming !== false) {
      damage = this.applyIncomingDamageModifier(target, damage);
    }

    return this.applyDamage(target, damage);
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

  applyDamage(target, damage) {
    if (!target || !target.alive) return null;

    const now = nowMs();
    target.lastDamageAt = now;

    const hpBefore = target.hp;
    const armorBefore = target.armor;
    let remaining = Math.max(1, Math.round(damage));
    if (target.armor > 0) {
      const absorbed = Math.min(target.armor, remaining);
      target.armor -= absorbed;
      remaining -= absorbed;
    }

    if (remaining > 0) {
      target.hp = Math.max(0, target.hp - remaining);
    }

    let killed = false;
    if (target.hp <= 0 && target.alive) {
      killed = true;
      target.alive = false;
      target.respawnAt = now + 2200;
    }

    return {
      id: target.id,
      hp: target.hp,
      armor: target.armor,
      armorDamage: Math.max(0, armorBefore - target.armor),
      healthDamage: Math.max(0, hpBefore - target.hp),
      damageApplied: Math.max(0, (armorBefore - target.armor) + (hpBefore - target.hp)),
      killed
    };
  }

  broadcastDamageEvent(sourceId, target, out, hitType) {
    if (!target || !out) return;
    this.broadcast({
      t: MSG_S2C.DAMAGE_EVENT,
      targetId: target.id,
      sourceId: sourceId,
      health: out.hp,
      armor: out.armor,
      hitType: hitType === 'head' ? 'head' : 'body',
      damage: out.damageApplied || 0,
      killed: !!out.killed
    });
  }

  handleFire(player, msg) {
    if (!player || !player.alive) return;

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
    if (weaponId === 'shotgun') {
      damage = this.applyShotgunFalloff(damage, dist);
    }
    const out = this.applyDamageFromSource(player, target, damage, {
      hitType,
      weaponId,
      sourceKind: 'weapon'
    });
    if (!out) return;

    this.broadcastDamageEvent(player.id, target, out, hitType);

    if (out.killed) {
      this.broadcast({
        t: MSG_S2C.DEATH_RESPAWN,
        entityId: target.id,
        respawnAt: target.respawnAt,
        classApplied: target.classId
      });
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

    if (weaponId === 'plasma' && locked) {
      const tickDamage = Math.max(1, Math.round(Number(profile.tickDamage || stats.bodyDamage || 15)));
      const out = this.applyDamageFromSource(player, locked, tickDamage, {
        hitType: 'body',
        weaponId: 'plasma',
        sourceKind: 'weapon',
        applyOutgoing: false
      });
      if (out) {
        this.broadcastDamageEvent(player.id, locked, out, 'body');
        if (out.killed) {
          this.broadcast({
            t: MSG_S2C.DEATH_RESPAWN,
            entityId: locked.id,
            respawnAt: locked.respawnAt,
            classApplied: locked.classId
          });
        }
      }
    }

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
    entity.queuedClassId = null;

    const preset = classPreset(classId);
    entity.armorMax = preset.armorMax;
    entity.armor = Math.max(0, Math.min(Number(entity.armor || 0), preset.armorMax));
    entity.wallhackRadius = preset.wallhackRadius;

    entity.abilityCooldownUntil = 0;
    entity.ultimateCooldownUntil = 0;
    entity.focusShots = 0;
    entity.focusUntil = 0;
    entity.rageUntil = 0;
    entity.rageNextTickAt = 0;
    entity.shadowDashUntil = 0;
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
    this.send(ws, {
      t: MSG_S2C.CLASS_CHANGED,
      classId: 'abilities',
      weaponId: player.weaponId || 'rifle'
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

  fireDeadeyeLocks(player) {
    if (!player || !player.deadeye) return { fired: false, landed: 0 };
    const d = player.deadeye;
    const ids = Array.isArray(d.queue) ? d.queue : [];
    const lockCount = Math.max(0, Math.min(ids.length, Number(d.lockIndex || 0)));
    let landed = 0;
    for (let i = 0; i < lockCount; i++) {
      const target = this.getEntityById(ids[i]);
      if (!target || !target.alive || target.id === player.id) continue;
      const out = this.applyDamageFromSource(player, target, d.damage || 260, {
        hitType: 'body',
        sourceKind: 'ability',
        applyOutgoing: false
      });
      if (!out) continue;
      landed++;
      this.broadcastDamageEvent(player.id, target, out, 'body');
      if (out.killed) {
        this.broadcast({
          t: MSG_S2C.DEATH_RESPAWN,
          entityId: target.id,
          respawnAt: target.respawnAt,
          classApplied: target.classId
        });
      }
    }
    player.deadeye = null;
    return { fired: true, landed };
  }

  applyChokeTick(owner, targetId, damagePerTick) {
    if (!owner || !targetId) return;
    const target = this.getEntityById(targetId);
    if (!target || !target.alive || target.id === owner.id) return;
    if (damagePerTick <= 0) return;
    const out = this.applyDamageFromSource(owner, target, damagePerTick, {
      hitType: 'body',
      sourceKind: 'ability',
      applyOutgoing: false
    });
    if (!out) return;
    this.broadcastDamageEvent(owner.id, target, out, 'body');
    if (out.killed) {
      this.broadcast({
        t: MSG_S2C.DEATH_RESPAWN,
        entityId: target.id,
        respawnAt: target.respawnAt,
        classApplied: target.classId
      });
    }
  }

  handleClassCast(player, msg, ws) {
    if (!player || !player.alive) return;
    const slot = Number(msg.slot || 0);
    if (slot !== 1 && slot !== 2) return;
    const now = nowMs();
    const chokeSource = this.getClassAbilityCfg('jedi') || {};
    const deadeyeSource = this.getClassAbilityCfg('sharpshooter') || {};
    const chokeCfg = chokeSource.choke || {};
    const deadeyeCfg = deadeyeSource.deadeye || {};
    const cooldowns = getAbilityCooldowns({
      abilityCooldownMs: chokeSource.abilityCooldownMs || 8000,
      ultimateCooldownMs: deadeyeSource.ultimateCooldownMs || 22000
    });
    const abilityCooldownMs = cooldowns.abilityCooldownMs;
    const ultimateCooldownMs = cooldowns.ultimateCooldownMs;

    if (slot === 2 && player.deadeye) {
      const release = this.fireDeadeyeLocks(player);
      this.send(ws, {
        t: MSG_S2C.CLASS_CAST_OK,
        slot,
        classId: 'abilities',
        kind: 'deadeye_release',
        landed: release.landed || 0
      });
      return;
    }

    if (slot === 1 && now < (player.abilityCooldownUntil || 0)) {
      this.send(ws, { t: MSG_S2C.CLASS_CAST_REJECT, reason: 'ability_cooldown' });
      return;
    }
    if (slot === 2 && now < (player.ultimateCooldownUntil || 0)) {
      this.send(ws, { t: MSG_S2C.CLASS_CAST_REJECT, reason: 'ultimate_cooldown' });
      return;
    }

    let ok = false;
    let kind = '';
    const payload = {};

    if (slot === 1) {
      const lockedTargetId = String(msg && msg.lockTargetId ? msg.lockTargetId : '');
      let target = this.resolveLockedHostile(player, lockedTargetId, chokeCfg.range || 24, chokeCfg.minDot || 0.05);
      if (!target) {
        target = this.closestHostileInRange(player, chokeCfg.range || 24, chokeCfg.minDot || 0.05);
      }
      if (target) {
        const castOut = this.applyDamageFromSource(player, target, chokeCfg.castDamage || 95, {
          hitType: 'body',
          sourceKind: 'ability',
          applyOutgoing: false
        });
        if (castOut) {
          this.broadcastDamageEvent(player.id, target, castOut, 'body');
          if (castOut.killed) {
            this.broadcast({
              t: MSG_S2C.DEATH_RESPAWN,
              entityId: target.id,
              respawnAt: target.respawnAt,
              classApplied: target.classId
            });
          }
        }
        this.applyTimedStun(target, chokeCfg.duration || 1.6);
        player.chokeState = {
          targetId: target.id,
          endsAt: now + Math.round((chokeCfg.duration || 1.6) * 1000),
          nextTickAt: now + Math.round((chokeCfg.tickRate || 0.25) * 1000),
          tickRateMs: Math.round((chokeCfg.tickRate || 0.25) * 1000),
          dotPerTick: Math.max(0, Math.round(chokeCfg.dotPerTick || 0)),
          liftHeight: chokeCfg.liftHeight || 1.0
        };
        ok = true;
      }
      if (ok) {
        player.abilityCooldownUntil = now + abilityCooldownMs;
        kind = 'ability_choke';
        payload.targetId = target ? target.id : '';
      }
    } else if (slot === 2) {
      const maxTargets = Math.max(1, Math.round(deadeyeCfg.maxTargets || 6));
      const picks = this.deadeyeCandidates(player, deadeyeCfg.range || 80, deadeyeCfg.minDot || 0.18, maxTargets);
      if (picks.length > 0) {
        player.deadeye = buildDeadeyeState(deadeyeCfg, picks, now);
        player.ultimateCooldownUntil = now + ultimateCooldownMs;
        ok = true;
        kind = 'ability_deadeye_start';
        payload.targetCount = picks.length;
      }
    }

    if (ok) {
      this.send(ws, {
        t: MSG_S2C.CLASS_CAST_OK,
        slot,
        classId: 'abilities',
        kind,
        ...payload
      });
      return;
    }

    if (!ok) {
      this.send(ws, { t: MSG_S2C.CLASS_CAST_REJECT, reason: 'cast_failed', slot, classId: 'abilities' });
    }
  }

  tickProjectiles(dtSec) {
    if (this.projectiles.size === 0) return;
    const now = nowMs();
    const toRemove = [];
    const entities = [];
    for (const p of this.players.values()) entities.push(p);
    for (const b of this.bots.values()) entities.push(b);
    const stickProjectile = (proj, targetEntity, x, y, z) => {
      if (!proj) return false;
      const delaySec = Math.max(0.1, Number(proj.stickyDelaySec || 0.65));
      proj.vx = 0;
      proj.vy = 0;
      proj.vz = 0;
      proj.x = Number(x || proj.x);
      proj.y = Number(y || proj.y);
      proj.z = Number(z || proj.z);
      proj.stickyUntil = now + Math.round(delaySec * 1000);
      proj.stuckToTargetId = targetEntity ? targetEntity.id : '';
      if (targetEntity) {
        proj.stuckOffsetX = proj.x - targetEntity.x;
        proj.stuckOffsetY = proj.y - ((targetEntity.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0);
        proj.stuckOffsetZ = proj.z - targetEntity.z;
      } else {
        proj.stuckOffsetX = 0;
        proj.stuckOffsetY = 0;
        proj.stuckOffsetZ = 0;
      }
      return true;
    };

    this.projectiles.forEach((p) => {
      const def = THROWABLE_STATS[p.type];
      const isAbilityProj = (p.type === 'ninjastar' || p.type === 'lightsaber');
      if ((!def && !isAbilityProj) || !p.alive) {
        toRemove.push(p.id);
        return;
      }

      p.age += dtSec;
      if (p.stickyUntil && p.stickyUntil > 0) {
        if (p.stuckToTargetId) {
          const stuckTarget = this.getEntityById(p.stuckToTargetId);
          if (stuckTarget && stuckTarget.alive) {
            p.x = stuckTarget.x + (p.stuckOffsetX || 0);
            p.y = ((stuckTarget.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0) + (p.stuckOffsetY || 0);
            p.z = stuckTarget.z + (p.stuckOffsetZ || 0);
          }
        }
        if (now >= p.stickyUntil) {
          this.explodeProjectile(p, p.x, p.y, p.z);
          toRemove.push(p.id);
        }
        return;
      }

      if ((p.lifeSec > 0 && p.age >= p.lifeSec) || (p.fuseSec > 0 && p.age >= p.fuseSec)) {
        if (p.type === 'knife' || p.type === 'ninjastar' || p.type === 'lightsaber' || p.type === 'plasma_stream') {
          this.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'despawn', x: p.x, y: p.y, z: p.z });
        } else {
          this.explodeProjectile(p, p.x, p.y, p.z);
        }
        toRemove.push(p.id);
        return;
      }

      const isSeekerLike = (p.type === 'seeker' || p.type === 'seekershot' || p.type === 'plasma_stream');
      if (isSeekerLike) {
        const acquireRange = Number(def.acquireRange || 24);
        let target = null;
        if (p.lockTargetId) {
          const locked = this.getEntityById(p.lockTargetId);
          if (locked && locked.alive && locked.id !== p.ownerId && distance3(locked, p) <= acquireRange) {
            target = locked;
          }
        }
        if (!target) {
          target = this.nearestTargetForProjectile(p, acquireRange);
        }
        if (target) {
          const toTarget = normalize3(
            target.x - p.x,
            ((target.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0) - p.y,
            target.z - p.z
          );
          const velSq = (p.vx * p.vx) + (p.vy * p.vy) + (p.vz * p.vz);
          const baseDir = velSq > 0.0001
            ? normalize3(p.vx, p.vy, p.vz)
            : normalize3(p.launchDirX || 0, p.launchDirY || 0, p.launchDirZ || -1);
          const halfAngleDeg = Number(
            (p.type === 'seekershot' || p.type === 'plasma_stream')
              ? (def.lockHalfAngleDeg || 30)
              : (def.acquireHalfAngleDeg || 35)
          );
          const cosLimit = Math.cos((halfAngleDeg * Math.PI) / 180);
          if (dot3(baseDir, toTarget) >= cosLimit) {
            const nextVel = steerHomingVelocity({
              projectilePos: { x: p.x, y: p.y, z: p.z },
              targetPos: {
                x: target.x,
                y: ((target.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0),
                z: target.z
              },
              velocity: { x: p.vx, y: p.vy, z: p.vz },
              speed: Number(def.speed || 14),
              boost: Number(def.homingBoost || 2),
              lerp: Number(def.homingLerp || 3.2),
              dt: dtSec
            });
            p.vx = Number(nextVel.x || 0);
            p.vy = Number(nextVel.y || 0);
            p.vz = Number(nextVel.z || 0);
          }
        }
      }

      if (isAbilityProj && p.type === 'lightsaber' && p.returnToOwner) {
        if (!p.returning && p.maxDistance > 0 && p.traveled >= p.maxDistance) {
          p.returning = true;
          p.phase = 'return';
        }
        if (p.returning) {
          const owner = this.getEntityById(p.ownerId);
          if (!owner || !owner.alive) {
            toRemove.push(p.id);
            return;
          }
          const ownerPos = this.entityAimTargetPosition(owner);
          const toOwner = normalize3(ownerPos.x - p.x, ownerPos.y - p.y, ownerPos.z - p.z);
          const speed = p.returnSpeed || 42;
          p.vx = toOwner.x * speed;
          p.vy = toOwner.y * speed;
          p.vz = toOwner.z * speed;
          if (distance3(p, ownerPos) <= Math.max(0.65, p.hitRadius || 1.1)) {
            this.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'despawn', x: p.x, y: p.y, z: p.z });
            toRemove.push(p.id);
            return;
          }
        }
      }
      p.gravity = isAbilityProj ? 0 : Number(def.gravity || 0);
      integrateProjectileMotion(p, dtSec, !isAbilityProj);
      if (isAbilityProj) {
        const speed = Math.sqrt((p.vx * p.vx) + (p.vy * p.vy) + (p.vz * p.vz));
        p.traveled = (p.traveled || 0) + (speed * dtSec);
      }
      const groundY = this.terrainFeetYAt(p.x, p.z);

      if (p.type === 'frag' && p.y <= (groundY + 0.05)) {
        if (p.bounces < (def.bounceMaxCount || 2) && Math.abs(p.vy) > 1.2) {
          p.y = groundY + 0.05;
          p.vy = Math.abs(p.vy) * (def.bounceVerticalDamping || 0.42);
          p.vx *= (def.bounceVelocityDamping || 0.4);
          p.vz *= (def.bounceVelocityDamping || 0.4);
          p.bounces++;
          if (((p.vx * p.vx) + (p.vy * p.vy) + (p.vz * p.vz)) < (def.bounceStopSpeedSq || 2.5)) {
            p.vx = 0;
            p.vy = 0;
            p.vz = 0;
          }
        } else {
          p.y = groundY + 0.05;
          p.vx *= 0.92;
          p.vz *= 0.92;
        }
      } else if (p.y <= groundY && !isAbilityProj) {
        if (p.type === 'knife' || p.type === 'plasma_stream') {
          this.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'world', x: p.x, y: groundY, z: p.z });
          toRemove.push(p.id);
          return;
        }
        if (p.type === 'seeker') {
          p.y = groundY;
          if (stickProjectile(p, null, p.x, p.y, p.z)) {
            this.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'world', x: p.x, y: p.y, z: p.z });
            return;
          }
        }
        this.explodeProjectile(p, p.x, groundY, p.z);
        toRemove.push(p.id);
        return;
      }

      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (!e || !e.alive || e.id === p.ownerId) continue;
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const dy = ((e.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0) - p.y;
        const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
        const hitRadius = isAbilityProj ? Math.max(0.45, p.hitRadius || 1.2) : 1.35;
        if (d > hitRadius) continue;
        if (p.type === 'seeker') {
          if (stickProjectile(p, e, p.x, p.y, p.z)) {
            this.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: e.id });
            return;
          }
        }
        if (p.type === 'plasma_stream') {
          this.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: e.id });
          toRemove.push(p.id);
          return;
        }
        if (p.type === 'knife' || p.type === 'ninjastar' || p.type === 'lightsaber') {
          if (isAbilityProj) {
            let canHitAbilityProj = true;
            if (p.type === 'lightsaber') {
              const phase = p.returning ? 'r' : 'o';
              const key = `${phase}:${e.id}`;
              if (p.phaseHits && p.phaseHits[key]) canHitAbilityProj = false;
              else {
                if (!p.phaseHits) p.phaseHits = {};
                p.phaseHits[key] = true;
              }
            }
            if (canHitAbilityProj) {
              const owner = this.getEntityById(p.ownerId);
              const hitType = dy > KNIFE_HEADSHOT_HEIGHT_DELTA_WU ? 'head' : 'body';
              const damage = hitType === 'head'
                ? Math.max(1, Math.round(p.damageHead || p.damageBody || 100))
                : Math.max(1, Math.round(p.damageBody || 100));
              const out = this.applyDamageFromSource(owner, e, damage, {
                hitType,
                weaponId: p.type || 'ability_projectile',
                sourceKind: 'ability',
                applyOutgoing: false
              });
              if (out) {
                this.broadcastDamageEvent(p.ownerId, e, out, hitType);
                if (out.killed) {
                  this.broadcast({
                    t: MSG_S2C.DEATH_RESPAWN,
                    entityId: e.id,
                    respawnAt: e.respawnAt,
                    classApplied: e.classId
                  });
                }
              }
            }
          } else {
            const isHead = dy > KNIFE_HEADSHOT_HEIGHT_DELTA_WU;
            this.projectileDamageHit(p, e, isHead ? 'head' : 'body');
          }
          this.broadcast({ t: MSG_S2C.THROW_IMPACT, projectileId: p.id, impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: e.id });
          if (p.type !== 'lightsaber') {
            toRemove.push(p.id);
          }
          return;
        }
        this.explodeProjectile(p, p.x, p.y, p.z);
        toRemove.push(p.id);
        return;
      }

      p.updatedAt = now;
    });

    for (let i = 0; i < toRemove.length; i++) {
      this.projectiles.delete(toRemove[i]);
    }
  }

  tickFireZones(dtSec) {
    if (this.fireZones.size === 0) return;
    const toRemove = [];
    const entities = [];
    for (const p of this.players.values()) entities.push(p);
    for (const b of this.bots.values()) entities.push(b);

    this.fireZones.forEach((z) => {
      z.life -= dtSec;
      z.tickTimer -= dtSec;
      if (z.tickTimer <= 0) {
        z.tickTimer += THROWABLE_STATS.molotov.fireTickRate;
        for (let i = 0; i < entities.length; i++) {
          const e = entities[i];
          if (!e || !e.alive || e.id === z.ownerId) continue;
          const dx = e.x - z.x;
          const dz = e.z - z.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d > z.radius) continue;
          const owner = this.getEntityById(z.ownerId);
          const out = this.applyDamageFromSource(owner, e, THROWABLE_STATS.molotov.fireTickDamage, {
            hitType: 'body',
            weaponId: 'molotov',
            sourceKind: 'throwable',
            applyOutgoing: false
          });
          if (!out) continue;
          this.broadcastDamageEvent(z.ownerId, e, out, 'body');
          if (out.killed) {
            this.broadcast({
              t: MSG_S2C.DEATH_RESPAWN,
              entityId: e.id,
              respawnAt: e.respawnAt,
              classApplied: e.classId
            });
          }
        }
      }
      if (z.life <= 0) toRemove.push(z.id);
    });

    for (let i = 0; i < toRemove.length; i++) {
      const id = toRemove[i];
      this.fireZones.delete(id);
      this.broadcast({ t: MSG_S2C.AOE_END, zoneId: id });
    }
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
      this.handleClassCast(player, msg, ws);
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

  applyQueuedClassIfNeeded(entity) {
    if (!entity.queuedClassId) return;
    this.applyClassNow(entity, entity.queuedClassId);
    entity.armor = entity.armorMax;
  }

  respawnIfNeeded(entity) {
    if (entity.alive) return;
    if ((entity.respawnAt || 0) > nowMs()) return;

    this.applyQueuedClassIfNeeded(entity);
    entity.hp = entity.hpMax;
    entity.armor = entity.armorMax;
    entity.alive = true;
    entity.respawnAt = 0;
    entity.lastDamageAt = 0;
    entity.x = 10 + Math.random() * 90;
    entity.z = 10 + Math.random() * 90;
    if (entity.kind === 'player') {
      entity.y = this.terrainEyeYAt(entity.x, entity.z);
    } else if (!Number.isFinite(entity.y)) {
      entity.y = PLAYER_EYE_HEIGHT_WU;
    }
    entity.streamHeat = 0;
    entity.streamOverheatedUntil = 0;
    entity.lastShotAt = {};
    entity.shotBurstState = {};
    entity.muzzleFlashUntil = 0;
    entity.throwables = this.createThrowableRuntime();
    entity.lastThrowAt = 0;
    entity.abilityCooldownUntil = 0;
    entity.ultimateCooldownUntil = 0;
    entity.focusShots = 0;
    entity.focusUntil = 0;
    entity.rageUntil = 0;
    entity.rageNextTickAt = 0;
    entity.stunUntil = 0;
    entity.slowUntil = 0;
    entity.slowMultiplier = 1;
    entity.shadowDashUntil = 0;
    entity.deadeye = null;
    entity.chokeState = null;
  }

  tickBots(dtSec) {
    const players = Array.from(this.players.values()).filter((p) => p.alive);
    for (const bot of this.bots.values()) {
      this.respawnIfNeeded(bot);
      if (!bot.alive) continue;
      const now = nowMs();

      bot.aiTurnTimer -= dtSec;
      if (bot.aiTurnTimer <= 0) {
        bot.aiTurnTimer = 1 + Math.random() * 3;
        const angle = Math.random() * Math.PI * 2;
        bot.aiDirX = Math.cos(angle);
        bot.aiDirZ = Math.sin(angle);
        bot.aiSpeed = 1.8 + Math.random() * 1.2;
      }

      if (players.length > 0 && Math.random() < 0.015) {
        const target = players[Math.floor(Math.random() * players.length)];
        const dx = target.x - bot.x;
        const dz = target.z - bot.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        bot.aiDirX = dx / len;
        bot.aiDirZ = dz / len;
      }

      const stunned = now < (bot.stunUntil || 0);
      if (stunned) {
        bot.moveSpeedNorm = 0;
        bot.sprinting = false;
      } else {
        const slowMult = now < (bot.slowUntil || 0)
          ? clamp(Number(bot.slowMultiplier || 1), 0.1, 1)
          : 1;
        bot.x = clamp(bot.x + bot.aiDirX * bot.aiSpeed * slowMult * dtSec, this.boundsMin, this.boundsMax);
        bot.z = clamp(bot.z + bot.aiDirZ * bot.aiSpeed * slowMult * dtSec, this.boundsMin, this.boundsMax);
        bot.yaw = Math.atan2(bot.aiDirX, bot.aiDirZ);
        bot.pitch = 0;
        bot.moveSpeedNorm = clamp((bot.aiSpeed * slowMult) / 3.2, 0, 1.4);
        bot.sprinting = (bot.aiSpeed * slowMult) > 2.5;
      }

      this.regenArmor(bot, dtSec);
      this.tickStreamState(bot, dtSec);
      this.tickThrowableRegen(bot, dtSec);
      this.tickClassAbilityState(bot);

      if ((nowMs() - (bot.lastThrowAt || 0)) > (THROWABLE_BOT_THROW_COOLDOWN_S * 1000) && players.length > 0 && Math.random() < 0.02) {
        const throwableId = THROWABLE_STATS.order[Math.floor(Math.random() * THROWABLE_STATS.order.length)];
        this.handleThrow(bot, { throwableId, clientThrowId: '' }, null);
      }
    }
  }

  tickPlayers(dtSec) {
    for (const player of this.players.values()) {
      this.respawnIfNeeded(player);
      this.regenArmor(player, dtSec);
      this.tickStreamState(player, dtSec);
      this.tickThrowableRegen(player, dtSec);
      this.tickClassAbilityState(player);
    }
  }

  tickClassAbilityState(entity) {
    if (!entity || !entity.alive) return;
    const now = nowMs();

    if ((entity.focusShots || 0) > 0 && now >= (entity.focusUntil || 0)) {
      entity.focusShots = 0;
      entity.focusUntil = 0;
    }
    if ((entity.slowUntil || 0) > 0 && now >= (entity.slowUntil || 0)) {
      entity.slowUntil = 0;
      entity.slowMultiplier = 1;
    }

    if ((entity.rageUntil || 0) > now) {
      const rageCfg = (this.getClassAbilityCfg('brawler') || {}).rage || {};
      if (now >= (entity.rageNextTickAt || 0)) {
        const targets = this.hostilesInRadius(entity, rageCfg.radius || 5.2, entity.id);
        for (let i = 0; i < targets.length; i++) {
          const target = targets[i].entity;
          const out = this.applyDamageFromSource(entity, target, rageCfg.tickDamage || 75, {
            hitType: 'body',
            sourceKind: 'ability',
            applyOutgoing: false
          });
          if (!out) continue;
          this.broadcastDamageEvent(entity.id, target, out, 'body');
          if (out.killed) {
            this.broadcast({
              t: MSG_S2C.DEATH_RESPAWN,
              entityId: target.id,
              respawnAt: target.respawnAt,
              classApplied: target.classId
            });
          }
        }
        entity.rageNextTickAt = now + Math.round((rageCfg.tickEvery || 0.45) * 1000);
      }
    } else {
      entity.rageUntil = 0;
      entity.rageNextTickAt = 0;
    }

    if (entity.chokeState) {
      const state = entity.chokeState;
      if (!state.targetId || now >= (state.endsAt || 0)) {
        entity.chokeState = null;
      } else {
        if (now >= (state.nextTickAt || 0)) {
          this.applyChokeTick(entity, state.targetId, state.dotPerTick || 0);
          state.nextTickAt = now + (state.tickRateMs || 250);
        }
        const target = this.getEntityById(state.targetId);
        if (!target || !target.alive) {
          entity.chokeState = null;
        }
      }
    }

    if (entity.deadeye) {
      const d = entity.deadeye;
      if (!d.queue || !d.queue.length) {
        entity.deadeye = null;
      } else {
        const lockEveryMs = Math.max(1, Math.round(d.lockEveryMs || 420));
        while ((d.lockIndex || 0) < d.queue.length && now >= (d.nextLockAt || 0)) {
          d.lockIndex = Math.min(d.queue.length, (d.lockIndex || 0) + 1);
          d.nextLockAt = (d.nextLockAt || now) + lockEveryMs;
        }
        if (now >= (d.endsAt || 0)) {
          this.fireDeadeyeLocks(entity);
        }
      }
    }
  }

  toEntityState(entity) {
    const throwables = {};
    const order = THROWABLE_STATS.order || [];
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const inv = entity.throwables && entity.throwables[id];
      if (!inv) continue;
      throwables[id] = {
        charges: inv.charges,
        maxCharges: inv.maxCharges,
        cooldownRemaining: Number((inv.cooldownRemaining || 0).toFixed(3))
      };
    }
    return {
      id: entity.id,
      kind: entity.kind,
      username: entity.username,
      classId: entity.classId,
      queuedClassId: entity.queuedClassId || null,
      x: Number(entity.x.toFixed(3)),
      y: Number((entity.y || 1.6).toFixed(3)),
      z: Number(entity.z.toFixed(3)),
      yaw: Number((entity.yaw || 0).toFixed(4)),
      pitch: Number((entity.pitch || 0).toFixed(4)),
      weaponId: entity.weaponId || 'rifle',
      moveSpeedNorm: Number((entity.moveSpeedNorm || 0).toFixed(3)),
      sprinting: !!entity.sprinting,
      hp: Number(entity.hp.toFixed(2)),
      hpMax: Number(entity.hpMax.toFixed(2)),
      armor: Number(entity.armor.toFixed(2)),
      armorMax: Number(entity.armorMax.toFixed(2)),
      wallhackRadius: entity.wallhackRadius,
      alive: !!entity.alive,
      streamHeat: Number((entity.streamHeat || 0).toFixed(3)),
      streamOverheatedUntil: entity.streamOverheatedUntil || 0,
      muzzleFlashUntil: entity.muzzleFlashUntil || 0,
      abilityCooldownRemaining: Math.max(0, ((entity.abilityCooldownUntil || 0) - nowMs()) / 1000),
      ultimateCooldownRemaining: Math.max(0, ((entity.ultimateCooldownUntil || 0) - nowMs()) / 1000),
      focusShots: Math.max(0, Math.round(entity.focusShots || 0)),
      focusUntil: entity.focusUntil || 0,
      rageUntil: entity.rageUntil || 0,
      shadowDashUntil: entity.shadowDashUntil || 0,
      stunUntil: entity.stunUntil || 0,
      slowUntil: entity.slowUntil || 0,
      chokeState: entity.chokeState ? {
        targetId: entity.chokeState.targetId || '',
        endsAt: entity.chokeState.endsAt || 0,
        liftHeight: entity.chokeState.liftHeight || 1.0
      } : null,
      deadeyeState: entity.deadeye ? {
        lockCount: entity.deadeye.lockIndex || 0,
        maxLocks: entity.deadeye.maxLocks || (entity.deadeye.queue ? entity.deadeye.queue.length : 0),
        nextLockAt: entity.deadeye.nextLockAt || 0,
        lockEveryMs: entity.deadeye.lockEveryMs || 0,
        endsAt: entity.deadeye.endsAt || 0,
        targetIds: entity.deadeye.queue ? entity.deadeye.queue.slice(0) : []
      } : null,
      throwables,
      visibleWallhack: true
    };
  }

  toProjectileState(projectile) {
    return {
      id: projectile.id,
      type: projectile.type,
      ownerId: projectile.ownerId,
      clientThrowId: projectile.clientThrowId || '',
      x: Number(projectile.x.toFixed(3)),
      y: Number(projectile.y.toFixed(3)),
      z: Number(projectile.z.toFixed(3)),
      vx: Number(projectile.vx.toFixed(3)),
      vy: Number(projectile.vy.toFixed(3)),
      vz: Number(projectile.vz.toFixed(3)),
      age: Number(projectile.age.toFixed(3))
    };
  }

  toFireZoneState(zone) {
    return {
      id: zone.id,
      ownerId: zone.ownerId,
      x: Number(zone.x.toFixed(3)),
      y: Number(zone.y.toFixed(3)),
      z: Number(zone.z.toFixed(3)),
      radius: Number(zone.radius.toFixed(3)),
      life: Number(zone.life.toFixed(3))
    };
  }

  broadcastSnapshot() {
    const entities = [];
    for (const player of this.players.values()) entities.push(this.toEntityState(player));
    for (const bot of this.bots.values()) entities.push(this.toEntityState(bot));
    const projectiles = [];
    this.projectiles.forEach((p) => {
      if (!p || !p.alive) return;
      projectiles.push(this.toProjectileState(p));
    });
    const fireZones = [];
    this.fireZones.forEach((z) => {
      fireZones.push(this.toFireZoneState(z));
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

    this.tickPlayers(dtSec);
    this.tickBots(dtSec);
    this.tickProjectiles(dtSec);
    this.tickFireZones(dtSec);
    this.broadcastSnapshot();
  }
}
