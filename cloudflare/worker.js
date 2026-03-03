import { DurableObject } from 'cloudflare:workers';

const GAMEPLAY_TUNING_WU = {
  classPresets: {
    ninja: { armorMax: 80, wallhackRadius: 90 },
    jedi: { armorMax: 130, wallhackRadius: 85 },
    magician: { armorMax: 100, wallhackRadius: 100 },
    sharpshooter: { armorMax: 90, wallhackRadius: 115 },
    brawler: { armorMax: 150, wallhackRadius: 75 }
  },
  weaponStats: {
    rifle: { cooldownMs: 190, bodyDamage: 36, headDamage: 68, maxRange: 120 },
    pistol: { cooldownMs: 280, bodyDamage: 30, headDamage: 56, maxRange: 92 },
    machinegun: { cooldownMs: 80, bodyDamage: 16, headDamage: 30, maxRange: 88 },
    shotgun: { cooldownMs: 820, bodyDamage: 14, headDamage: 22, maxRange: 42 },
    sniper: { cooldownMs: 1250, bodyDamage: 120, headDamage: 220, maxRange: 190 },
    plasma: { cooldownMs: 100, bodyDamage: 15, headDamage: 15, maxRange: 24 }
  },
  throwables: {
    order: ['frag', 'seeker', 'molotov', 'knife'],
    frag: {
      id: 'frag', speed: 16, upward: 5.2, gravity: 19, fuse: 2.2, radius: 5.4, damage: 125, regen: 10, bounce: true,
      bounceVelocityDamping: 0.4,
      bounceVerticalDamping: 0.42,
      bounceMaxCount: 2,
      bounceStopSpeedSq: 2.5
    },
    seeker: {
      id: 'seeker', speed: 14, upward: 4.4, gravity: 12, fuse: 3.4, radius: 5.0, damage: 110, regen: 15,
      homingBoost: 2.0, homingLerp: 4.8, acquireRange: 22
    },
    molotov: {
      id: 'molotov', speed: 15, upward: 4.8, gravity: 21, fuse: 3.0, fireRadius: 3.2,
      fireDuration: 5.5, fireTickDamage: 18, fireTickRate: 0.35, regen: 14
    },
    knife: {
      id: 'knife', speed: 28, upward: 1.4, gravity: 7, life: 1.8, bodyDamage: 100, headDamage: 250, regen: 8
    }
  },
  classAbilities: {
    jedi: {
      choke: { boxPx: 190, range: 24, duration: 1.55, liftHeight: 1.0, tickRate: 0.25, dotPerTick: 0 },
      saberThrow: { speed: 34, maxDistance: 22, returnSpeed: 42, hitRadius: 1.3, bodyDamage: 175, headDamage: 240, life: 2.1 }
    },
    ninja: {
      stars: { count: 3, spreadDeg: 16, speed: 44, life: 0.85, hitRadius: 1.35, bodyDamage: 120, headDamage: 170 },
      shadowDash: { steps: 4, stepDuration: 0.12 }
    },
    sharpshooter: {
      deadeye: { boxPx: 220, range: 80, lockTimePerTarget: 0.42, maxTargets: 4, damage: 260 }
    }
  }
};

const CLASS_PRESETS = GAMEPLAY_TUNING_WU.classPresets;
const WEAPON_STATS = GAMEPLAY_TUNING_WU.weaponStats;
const THROWABLE_STATS = GAMEPLAY_TUNING_WU.throwables;
const CLASS_ABILITY_STATS = GAMEPLAY_TUNING_WU.classAbilities;

const ROOM_TICK_MS = 50;
const MAX_HP = 500;
const PLASMA_MAX_SUSTAIN_MS = 2500;
const PLASMA_OVERHEAT_MS = 1600;
const REMOTE_BEAM_HOLD_MS = 180;
const REMOTE_MUZZLE_FLASH_HOLD_MS = 90;
const PLAYER_EYE_HEIGHT_WU = 1.6;
const THROWABLE_SPAWN_FORWARD_WU = 0.55;
const THROWABLE_SPAWN_LEFT_WU = 0.34;
const THROWABLE_SPAWN_HEIGHT_WU = 1.0;
const THROWABLE_BOT_THROW_COOLDOWN_S = 2.8;
const THROW_INTENT_ORIGIN_MAX_OFFSET_WU = 1.2;
const THROW_INTENT_DIRECTION_MIN_DOT = -0.2;
const KNIFE_HEADSHOT_HEIGHT_DELTA_WU = 0.45;

function nowMs() {
  return Date.now();
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (err) {
    return null;
  }
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function validPin(pin) {
  return /^\d{4}$/.test(String(pin || ''));
}

function validUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(String(username || '').trim());
}

function randomId(prefix) {
  return prefix + '_' + crypto.randomUUID().replace(/-/g, '');
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  const chunks = cookieHeader.split(';');
  for (let i = 0; i < chunks.length; i++) {
    const part = chunks[i].trim();
    if (!part) continue;
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function classPreset(classId) {
  return CLASS_PRESETS[classId] || CLASS_PRESETS.sharpshooter;
}

async function getSessionFromRequest(env, request) {
  const cookieName = env.SESSION_COOKIE_NAME || 'mfa_session';
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sid = cookies[cookieName];
  if (!sid) return null;

  const now = Math.floor(nowMs() / 1000);
  const row = await env.DB.prepare(
    `SELECT s.id as session_id, s.user_id, s.expires_at,
            u.username, p.class_id, p.kills, p.deaths, p.damage_done, p.damage_taken
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN profiles p ON p.user_id = s.user_id
     WHERE s.id = ?1`
  ).bind(sid).first();

  if (!row) return null;
  if (row.expires_at <= now) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?1').bind(sid).run();
    return null;
  }

  await env.DB.prepare('UPDATE sessions SET last_seen_at = ?2 WHERE id = ?1').bind(sid, now).run();

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    username: row.username,
    classId: row.class_id || 'sharpshooter',
    kills: row.kills || 0,
    deaths: row.deaths || 0,
    damageDone: row.damage_done || 0,
    damageTaken: row.damage_taken || 0,
    expiresAt: row.expires_at
  };
}

async function upsertProfileIfMissing(env, userId, classId) {
  await env.DB.prepare(
    `INSERT INTO profiles (user_id, class_id) VALUES (?1, ?2)
     ON CONFLICT(user_id) DO NOTHING`
  ).bind(userId, classId || 'sharpshooter').run();
}

async function handleLogin(env, request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const usernameRaw = String(body.username || '').trim();
  const usernameNorm = normalizeUsername(usernameRaw);
  const pin = String(body.pin || '');

  if (!validUsername(usernameRaw)) {
    return json({ ok: false, error: 'Username must be 3-20 chars (letters, numbers, underscore).' }, 400);
  }
  if (!validPin(pin)) {
    return json({ ok: false, error: 'PIN must be exactly 4 digits.' }, 400);
  }

  const now = Math.floor(nowMs() / 1000);
  let user = await env.DB.prepare(
    'SELECT id, username, pin_plain FROM users WHERE username_norm = ?1'
  ).bind(usernameNorm).first();

  if (!user) {
    const userId = randomId('usr');
    await env.DB.prepare(
      'INSERT INTO users (id, username, username_norm, pin_plain, created_at) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind(userId, usernameRaw, usernameNorm, pin, now).run();

    await upsertProfileIfMissing(env, userId, 'sharpshooter');

    user = { id: userId, username: usernameRaw, pin_plain: pin };
  } else if (user.pin_plain !== pin) {
    return json({ ok: false, error: 'Incorrect PIN.' }, 401);
  }

  const sessionId = randomId('ses');
  const sessionDays = Number(env.SESSION_DAYS || '30');
  const maxAge = Math.max(1, Math.floor(sessionDays * 86400));
  const expiresAt = now + maxAge;

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?5)'
  ).bind(sessionId, user.id, expiresAt, now, now).run();

  const profile = await env.DB.prepare(
    'SELECT class_id, kills, deaths, damage_done, damage_taken FROM profiles WHERE user_id = ?1'
  ).bind(user.id).first();

  const cookieName = env.SESSION_COOKIE_NAME || 'mfa_session';
  const setCookie = `${cookieName}=${encodeURIComponent(sessionId)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

  return json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      classId: (profile && profile.class_id) || 'sharpshooter',
      kills: (profile && profile.kills) || 0,
      deaths: (profile && profile.deaths) || 0,
      damageDone: (profile && profile.damage_done) || 0,
      damageTaken: (profile && profile.damage_taken) || 0
    },
    sessionExpiresAt: new Date(expiresAt * 1000).toISOString()
  }, 200, { 'Set-Cookie': setCookie });
}

async function handleLogout(env, request) {
  const cookieName = env.SESSION_COOKIE_NAME || 'mfa_session';
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sid = cookies[cookieName];

  if (sid) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?1').bind(sid).run();
  }

  const clearCookie = `${cookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });
}

async function handleMe(env, request) {
  const session = await getSessionFromRequest(env, request);
  if (!session) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  return json({
    ok: true,
    user: {
      id: session.userId,
      username: session.username,
      classId: session.classId,
      kills: session.kills,
      deaths: session.deaths,
      damageDone: session.damageDone,
      damageTaken: session.damageTaken
    },
    sessionExpiresAt: new Date(session.expiresAt * 1000).toISOString()
  });
}

function distance3(a, b) {
  const dx = a.x - b.x;
  const dy = (a.y || 0) - (b.y || 0);
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function normalize3(x, y, z) {
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function addScaled3(a, b, scale) {
  return {
    x: a.x + b.x * scale,
    y: a.y + b.y * scale,
    z: a.z + b.z * scale
  };
}

function dot3(a, b) {
  return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
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
    this.boundsMin = 2;
    this.boundsMax = 110;
    this.projectiles = new Map();
    this.fireZones = new Map();
    this.nextProjectileSeq = 1;
    this.nextFireZoneSeq = 1;
    this.ensureBots();
  }

  ensureBots() {
    const desired = Math.max(0, Number(this.env.BOT_COUNT || '6'));
    for (let i = 0; i < desired; i++) {
      const id = `bot-${i + 1}`;
      if (this.bots.has(id)) continue;
      const classId = 'sharpshooter';
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
        moveSpeedNorm: 0,
        sprinting: false,
        beamTargetId: '',
        beamActiveUntil: 0,
        beamHeat: 0,
        beamOverheated: false,
        beamOverheatedUntil: 0,
        lastPlasmaTickAt: 0,
        muzzleFlashUntil: 0,
        throwables: this.createThrowableRuntime(),
        lastThrowAt: 0,
        abilityCooldownUntil: 0,
        ultimateCooldownUntil: 0,
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

    if (request.headers.get('Upgrade') !== 'websocket') {
      if (url.pathname === '/state') {
        return json({ ok: true, players: this.players.size, bots: this.bots.size });
      }
      return new Response('Expected websocket upgrade', { status: 426 });
    }

    const userId = url.searchParams.get('userId');
    const username = url.searchParams.get('username') || 'player';
    const classId = url.searchParams.get('classId') || 'sharpshooter';

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

    this.send(server, {
      t: 'welcome',
      selfId: userId,
      roomId: this.roomName,
      tickRate: Math.round(1000 / ROOM_TICK_MS)
    });

    this.broadcastSnapshot();

    return new Response(null, { status: 101, webSocket: client });
  }

  ensurePlayer(userId, username, classId) {
    if (this.players.has(userId)) {
      const p = this.players.get(userId);
      p.username = username || p.username;
      return p;
    }

    const preset = classPreset(classId);
    const p = {
      id: userId,
      kind: 'player',
      username,
      classId,
      queuedClassId: null,
      x: 15 + Math.random() * 80,
      y: 1.6,
      z: 15 + Math.random() * 80,
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
      weaponId: 'rifle',
      moveSpeedNorm: 0,
      sprinting: false,
      beamTargetId: '',
      beamActiveUntil: 0,
      beamHeat: 0,
      beamOverheated: false,
      beamOverheatedUntil: 0,
      lastPlasmaTickAt: 0,
      muzzleFlashUntil: 0,
      throwables: this.createThrowableRuntime(),
      lastThrowAt: 0,
      abilityCooldownUntil: 0,
      ultimateCooldownUntil: 0,
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

  spawnProjectile(player, throwableId, clientThrowId, throwIntent) {
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
      createdAt: now
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
    const damage = hitType === 'head'
      ? (def.headDamage || def.damage || 1)
      : (def.bodyDamage || def.damage || 1);
    const out = this.applyDamage(target, damage);
    if (!out) return;
    this.broadcast({
      t: 'damage_event',
      targetId: target.id,
      sourceId: projectile.ownerId,
      health: out.hp,
      armor: out.armor,
      hitType: hitType
    });
    if (out.killed) {
      this.broadcast({
        t: 'death_respawn',
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
        y: 0,
        z,
        radius: def.fireRadius,
        life: def.fireDuration,
        tickTimer: 0
      });
      this.broadcast({ t: 'throw_impact', projectileId: projectile.id, impactType: 'molotov', x, y, z });
      return;
    }
    const radius = def.radius || 0;
    const damage = def.damage || 0;
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
      const out = this.applyDamage(e, blastDamage);
      if (!out) continue;
      this.broadcast({
        t: 'damage_event',
        targetId: e.id,
        sourceId: projectile.ownerId,
        health: out.hp,
        armor: out.armor,
        hitType: 'body'
      });
      if (out.killed) {
        this.broadcast({
          t: 'death_respawn',
          entityId: e.id,
          respawnAt: e.respawnAt,
          classApplied: e.classId
        });
      }
    }
    this.broadcast({ t: 'throw_explode', projectileId: projectile.id, x, y, z, radius });
  }

  handleInput(player, msg) {
    if (!player || !player.alive) return;

    if (typeof msg.x === 'number') player.x = clamp(msg.x, this.boundsMin, this.boundsMax);
    if (typeof msg.z === 'number') player.z = clamp(msg.z, this.boundsMin, this.boundsMax);
    if (typeof msg.y === 'number') player.y = clamp(msg.y, 0, 16);
    if (typeof msg.yaw === 'number') player.yaw = msg.yaw;
    if (typeof msg.pitch === 'number') player.pitch = clamp(msg.pitch, -1.55, 1.55);
    if (typeof msg.seq === 'number') player.seq = Math.max(player.seq, msg.seq);
    if (typeof msg.weaponId === 'string' && WEAPON_STATS[msg.weaponId]) player.weaponId = msg.weaponId;
    if (typeof msg.moveSpeedNorm === 'number') player.moveSpeedNorm = clamp(msg.moveSpeedNorm, 0, 1.4);
    if (typeof msg.sprinting === 'boolean') player.sprinting = msg.sprinting;
    if (typeof msg.sprint === 'boolean') player.sprinting = msg.sprint;
  }

  getEntityById(entityId) {
    if (this.players.has(entityId)) return this.players.get(entityId);
    if (this.bots.has(entityId)) return this.bots.get(entityId);
    return null;
  }

  applyDamage(target, damage) {
    if (!target || !target.alive) return null;

    const now = nowMs();
    target.lastDamageAt = now;

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
      killed
    };
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
    if ((now - prev) < stats.cooldownMs) return;
    player.lastShotAt[weaponId] = now;
    player.muzzleFlashUntil = now + REMOTE_MUZZLE_FLASH_HOLD_MS;

    const targetId = String(msg.targetId || '');
    const hitType = msg.hitType === 'head' ? 'head' : 'body';
    if (!targetId) return;

    const target = this.getEntityById(targetId);
    if (!target || !target.alive || target.id === player.id) return;

    const dist = distance3(player, target);
    if (dist > stats.maxRange) return;

    const damage = hitType === 'head' ? stats.headDamage : stats.bodyDamage;
    const out = this.applyDamage(target, damage);
    if (!out) return;

    this.broadcast({
      t: 'damage_event',
      targetId: target.id,
      sourceId: player.id,
      health: out.hp,
      armor: out.armor,
      hitType
    });

    if (out.killed) {
      this.broadcast({
        t: 'death_respawn',
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
      player.beamTargetId = '';
      player.beamActiveUntil = 0;
    }
  }

  handlePlasmaTick(player, msg) {
    if (!player || !player.alive) return;
    if (player.weaponId !== 'plasma') return;

    const now = nowMs();
    if (player.beamOverheated && now < (player.beamOverheatedUntil || 0)) return;

    const stats = WEAPON_STATS.plasma;
    const prev = player.lastPlasmaTickAt || 0;
    if ((now - prev) < stats.cooldownMs) return;
    player.lastPlasmaTickAt = now;
    player.muzzleFlashUntil = now + REMOTE_MUZZLE_FLASH_HOLD_MS;

    const targetId = String(msg.targetId || '');
    if (!targetId) return;

    const target = this.getEntityById(targetId);
    if (!target || !target.alive || target.id === player.id) return;

    const dist = distance3(player, target);
    if (dist > stats.maxRange) return;

    player.beamTargetId = target.id;
    player.beamActiveUntil = now + REMOTE_BEAM_HOLD_MS;

    const out = this.applyDamage(target, stats.bodyDamage);
    if (!out) return;

    this.broadcast({
      t: 'damage_event',
      targetId: target.id,
      sourceId: player.id,
      health: out.hp,
      armor: out.armor,
      hitType: 'body'
    });

    if (out.killed) {
      this.broadcast({
        t: 'death_respawn',
        entityId: target.id,
        respawnAt: target.respawnAt,
        classApplied: target.classId
      });
    }

    player.beamHeat = clamp((player.beamHeat || 0) + (stats.cooldownMs / PLASMA_MAX_SUSTAIN_MS), 0, 1);
    if (player.beamHeat >= 1) {
      player.beamHeat = 1;
      player.beamOverheated = true;
      player.beamOverheatedUntil = now + PLASMA_OVERHEAT_MS;
      player.beamTargetId = '';
      player.beamActiveUntil = 0;
    }
  }

  handleClassQueue(player, msg, ws) {
    if (!player) return;
    const classId = String(msg.classId || '');
    if (!CLASS_PRESETS[classId]) return;

    player.queuedClassId = classId;
    this.send(ws, { t: 'class_queued', classId });
  }

  handleThrow(player, msg, ws) {
    if (!player || !player.alive) return;
    const throwableId = String(msg.throwableId || '');
    const clientThrowId = String(msg.clientThrowId || '');
    const def = THROWABLE_STATS[throwableId];
    if (!def) return;
    if (!this.consumeThrowCharge(player, throwableId)) {
      this.send(ws, { t: 'throw_reject', throwableId, clientThrowId, reason: 'cooldown_or_empty' });
      return;
    }
    const projectile = this.spawnProjectile(player, throwableId, clientThrowId, msg.throwIntent || null);
    if (!projectile) {
      const inv = player.throwables && player.throwables[throwableId];
      if (inv) inv.charges = Math.min(inv.maxCharges, inv.charges + 1);
      this.send(ws, { t: 'throw_reject', throwableId, clientThrowId, reason: 'spawn_failed' });
      return;
    }
    player.lastThrowAt = nowMs();
    player.muzzleFlashUntil = player.lastThrowAt + REMOTE_MUZZLE_FLASH_HOLD_MS;
    this.broadcast({
      t: 'throw_spawn',
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
      createdAt: now
    };
    this.projectiles.set(projectile.id, projectile);
    return projectile;
  }

  closestHostileInRange(player, range, minDot) {
    if (!player || !player.alive) return null;
    const forward = this.entityForward(player);
    const entities = this.getAliveEntities();
    let best = null;
    let bestDist = range;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e || e.id === player.id) continue;
      const to = normalize3(e.x - player.x, ((e.y || PLAYER_EYE_HEIGHT_WU) - player.y), e.z - player.z);
      if (dot3(to, forward) < minDot) continue;
      const d = distance3(player, e);
      if (d > range) continue;
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  deadeyeCandidates(player, range, minDot, maxTargets) {
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
      out.push({ id: e.id, dist: d });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out.slice(0, Math.max(1, maxTargets || 1));
  }

  applyChokeTick(owner, targetId, damagePerTick) {
    if (!owner || !targetId) return;
    const target = this.getEntityById(targetId);
    if (!target || !target.alive || target.id === owner.id) return;
    if (damagePerTick <= 0) return;
    const out = this.applyDamage(target, damagePerTick);
    if (!out) return;
    this.broadcast({
      t: 'damage_event',
      targetId: target.id,
      sourceId: owner.id,
      health: out.hp,
      armor: out.armor,
      hitType: 'body'
    });
    if (out.killed) {
      this.broadcast({
        t: 'death_respawn',
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
    const abilityCfg = CLASS_ABILITY_STATS[player.classId] || null;
    if (!abilityCfg) {
      this.send(ws, { t: 'class_cast_reject', reason: 'invalid_class' });
      return;
    }
    if (slot === 1 && now < (player.abilityCooldownUntil || 0)) {
      this.send(ws, { t: 'class_cast_reject', reason: 'ability_cooldown' });
      return;
    }
    if (slot === 2 && now < (player.ultimateCooldownUntil || 0)) {
      this.send(ws, { t: 'class_cast_reject', reason: 'ultimate_cooldown' });
      return;
    }

    let ok = false;
    if (player.classId === 'jedi' && slot === 1) {
      const chokeCfg = abilityCfg.choke || {};
      const target = this.closestHostileInRange(player, chokeCfg.range || 24, 0.86);
      if (target) {
        player.chokeState = {
          targetId: target.id,
          endsAt: now + Math.round((chokeCfg.duration || 1.5) * 1000),
          nextTickAt: now + Math.round((chokeCfg.tickRate || 0.25) * 1000),
          tickRateMs: Math.round((chokeCfg.tickRate || 0.25) * 1000),
          dotPerTick: Math.max(0, Math.round(chokeCfg.dotPerTick || 0)),
          liftHeight: chokeCfg.liftHeight || 1.0
        };
        ok = true;
      }
      if (ok) {
        player.abilityCooldownUntil = now + 8000;
        this.send(ws, { t: 'class_cast_ok', slot, classId: player.classId, kind: 'jedi_choke' });
      }
    } else if (player.classId === 'jedi' && slot === 2) {
      const saberCfg = abilityCfg.saberThrow || {};
      const forward = this.entityForward(player);
      this.spawnAbilityProjectile(player, {
        type: 'lightsaber',
        vx: forward.x * (saberCfg.speed || 34),
        vy: forward.y * (saberCfg.speed || 34),
        vz: forward.z * (saberCfg.speed || 34),
        hitRadius: saberCfg.hitRadius || 1.3,
        lifeSec: saberCfg.life || 2.1,
        damageBody: saberCfg.bodyDamage || 175,
        damageHead: saberCfg.headDamage || 240,
        returnToOwner: true,
        returnSpeed: saberCfg.returnSpeed || 42,
        maxDistance: saberCfg.maxDistance || 22
      });
      ok = true;
      player.ultimateCooldownUntil = now + 18000;
      this.send(ws, { t: 'class_cast_ok', slot, classId: player.classId, kind: 'jedi_saber' });
    } else if (player.classId === 'ninja' && slot === 1) {
      const starCfg = abilityCfg.stars || {};
      const spreadDeg = Number(starCfg.spreadDeg || 16);
      const count = Math.max(1, Number(starCfg.count || 3));
      for (let i = 0; i < count; i++) {
        const center = (count - 1) * 0.5;
        const offsetDeg = (i - center) * spreadDeg;
        const yaw = (player.yaw || 0) + (offsetDeg * Math.PI / 180);
        const pitch = player.pitch || 0;
        const dir = normalize3(
          -Math.sin(yaw) * Math.cos(pitch),
          Math.sin(-pitch),
          -Math.cos(yaw) * Math.cos(pitch)
        );
        const speed = starCfg.speed || 44;
        this.spawnAbilityProjectile(player, {
          type: 'ninjastar',
          vx: dir.x * speed,
          vy: dir.y * speed,
          vz: dir.z * speed,
          hitRadius: starCfg.hitRadius || 1.35,
          lifeSec: starCfg.life || 0.85,
          damageBody: starCfg.bodyDamage || 120,
          damageHead: starCfg.headDamage || 170
        });
      }
      ok = true;
      player.abilityCooldownUntil = now + 6000;
      this.send(ws, { t: 'class_cast_ok', slot, classId: player.classId, kind: 'ninja_stars' });
    } else if (player.classId === 'ninja' && slot === 2) {
      const dashCfg = abilityCfg.shadowDash || {};
      const durationMs = Math.round((dashCfg.steps || 4) * (dashCfg.stepDuration || 0.12) * 1000);
      player.shadowDashUntil = now + durationMs;
      ok = true;
      player.ultimateCooldownUntil = now + 20000;
      this.send(ws, { t: 'class_cast_ok', slot, classId: player.classId, kind: 'shadow_dash' });
    } else if (player.classId === 'sharpshooter' && slot === 2) {
      const deadeyeCfg = abilityCfg.deadeye || {};
      const picks = this.deadeyeCandidates(player, deadeyeCfg.range || 80, 0.82, deadeyeCfg.maxTargets || 4);
      if (picks.length > 0) {
        player.deadeye = {
          queue: picks.map((p) => p.id),
          nextLockAt: now + Math.round((deadeyeCfg.lockTimePerTarget || 0.42) * 1000),
          lockEveryMs: Math.round((deadeyeCfg.lockTimePerTarget || 0.42) * 1000),
          lockIndex: 0,
          damage: Math.max(1, Math.round(deadeyeCfg.damage || 260))
        };
        player.ultimateCooldownUntil = now + 22000;
        ok = true;
        this.send(ws, { t: 'class_cast_ok', slot, classId: player.classId, kind: 'deadeye_start', targetCount: picks.length });
      }
    }

    if (!ok) {
      this.send(ws, { t: 'class_cast_reject', reason: 'cast_failed', slot, classId: player.classId });
    }
  }

  tickProjectiles(dtSec) {
    if (this.projectiles.size === 0) return;
    const now = nowMs();
    const toRemove = [];
    const entities = [];
    for (const p of this.players.values()) entities.push(p);
    for (const b of this.bots.values()) entities.push(b);

    this.projectiles.forEach((p) => {
      const def = THROWABLE_STATS[p.type];
      const isAbilityProj = (p.type === 'ninjastar' || p.type === 'lightsaber');
      if ((!def && !isAbilityProj) || !p.alive) {
        toRemove.push(p.id);
        return;
      }

      p.age += dtSec;
      if ((p.lifeSec > 0 && p.age >= p.lifeSec) || (p.fuseSec > 0 && p.age >= p.fuseSec)) {
        if (p.type === 'knife' || p.type === 'ninjastar' || p.type === 'lightsaber') {
          this.broadcast({ t: 'throw_impact', projectileId: p.id, impactType: 'despawn', x: p.x, y: p.y, z: p.z });
        } else {
          this.explodeProjectile(p, p.x, p.y, p.z);
        }
        toRemove.push(p.id);
        return;
      }

      if (p.type === 'seeker') {
        const target = this.nearestTargetForProjectile(p, def.acquireRange || 22);
        if (target) {
          const toTarget = normalize3(target.x - p.x, ((target.y || PLAYER_EYE_HEIGHT_WU) - PLAYER_EYE_HEIGHT_WU + 1.0) - p.y, target.z - p.z);
          const speed = (def.speed || 14) + (def.homingBoost || 2);
          const goal = { x: toTarget.x * speed, y: toTarget.y * speed, z: toTarget.z * speed };
          const blend = Math.min(1, dtSec * (def.homingLerp || 3.2));
          p.vx += (goal.x - p.vx) * blend;
          p.vy += (goal.y - p.vy) * blend;
          p.vz += (goal.z - p.vz) * blend;
        }
      }

      if (!isAbilityProj) {
        p.vy -= (def.gravity || 0) * dtSec;
      } else if (p.type === 'lightsaber' && p.returnToOwner) {
        if (!p.returning && p.maxDistance > 0 && p.traveled >= p.maxDistance) {
          p.returning = true;
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
            this.broadcast({ t: 'throw_impact', projectileId: p.id, impactType: 'despawn', x: p.x, y: p.y, z: p.z });
            toRemove.push(p.id);
            return;
          }
        }
      }
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.z += p.vz * dtSec;
      if (isAbilityProj) {
        const speed = Math.sqrt((p.vx * p.vx) + (p.vy * p.vy) + (p.vz * p.vz));
        p.traveled = (p.traveled || 0) + (speed * dtSec);
      }

      if (p.type === 'frag' && p.y <= 0.05) {
        if (p.bounces < (def.bounceMaxCount || 2) && Math.abs(p.vy) > 1.2) {
          p.y = 0.05;
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
          p.y = 0.05;
          p.vx *= 0.92;
          p.vz *= 0.92;
        }
      } else if (p.y <= 0 && !isAbilityProj) {
        if (p.type === 'knife') {
          this.broadcast({ t: 'throw_impact', projectileId: p.id, impactType: 'world', x: p.x, y: 0, z: p.z });
          toRemove.push(p.id);
          return;
        }
        this.explodeProjectile(p, p.x, 0, p.z);
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
        if (p.type === 'knife' || p.type === 'ninjastar' || p.type === 'lightsaber') {
          if (isAbilityProj) {
            const out = this.applyDamage(e, p.damageBody || 100);
            if (out) {
              this.broadcast({
                t: 'damage_event',
                targetId: e.id,
                sourceId: p.ownerId,
                health: out.hp,
                armor: out.armor,
                hitType: 'body'
              });
              if (out.killed) {
                this.broadcast({
                  t: 'death_respawn',
                  entityId: e.id,
                  respawnAt: e.respawnAt,
                  classApplied: e.classId
                });
              }
            }
          } else {
            const isHead = dy > KNIFE_HEADSHOT_HEIGHT_DELTA_WU;
            this.projectileDamageHit(p, e, isHead ? 'head' : 'body');
          }
          this.broadcast({ t: 'throw_impact', projectileId: p.id, impactType: 'enemy', x: p.x, y: p.y, z: p.z, targetId: e.id });
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
          const out = this.applyDamage(e, THROWABLE_STATS.molotov.fireTickDamage);
          if (!out) continue;
          this.broadcast({
            t: 'damage_event',
            targetId: e.id,
            sourceId: z.ownerId,
            health: out.hp,
            armor: out.armor,
            hitType: 'body'
          });
          if (out.killed) {
            this.broadcast({
              t: 'death_respawn',
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
      this.broadcast({ t: 'aoe_end', zoneId: id });
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
    if (type === 'join_room') {
      this.send(ws, {
        t: 'welcome',
        selfId: player.id,
        roomId: this.roomName,
        tickRate: Math.round(1000 / ROOM_TICK_MS)
      });
      return;
    }
    if (type === 'input') {
      this.handleInput(player, msg);
      return;
    }
    if (type === 'fire') {
      this.handleFire(player, msg);
      return;
    }
    if (type === 'equip_weapon') {
      this.handleEquipWeapon(player, msg);
      return;
    }
    if (type === 'plasma_tick') {
      this.handlePlasmaTick(player, msg);
      return;
    }
    if (type === 'throw') {
      this.handleThrow(player, msg, ws);
      return;
    }
    if (type === 'class_queue') {
      this.handleClassQueue(player, msg, ws);
      return;
    }
    if (type === 'class_cast') {
      this.handleClassCast(player, msg, ws);
      return;
    }
    if (type === 'ping') {
      this.send(ws, { t: 'pong', clientTime: msg.clientTime || 0, serverTime: nowMs() });
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

  tickPlasmaState(entity, dtSec) {
    if (!entity) return;
    if (!entity.alive) {
      entity.beamTargetId = '';
      entity.beamActiveUntil = 0;
      return;
    }
    const now = nowMs();

    if ((entity.beamActiveUntil || 0) <= now) {
      entity.beamActiveUntil = 0;
      entity.beamTargetId = '';
    }

    const active = !!entity.beamTargetId && (entity.beamActiveUntil || 0) > now;
    const coolRate = entity.beamOverheated ? 0.35 : 0.55;
    if (!active) {
      entity.beamHeat = Math.max(0, (entity.beamHeat || 0) - (coolRate * dtSec));
    }

    if (entity.beamOverheated && now >= (entity.beamOverheatedUntil || 0) && entity.beamHeat <= 0.95) {
      entity.beamOverheated = false;
      entity.beamOverheatedUntil = 0;
    }
  }

  applyQueuedClassIfNeeded(entity) {
    if (!entity.queuedClassId) return;
    entity.classId = entity.queuedClassId;
    entity.queuedClassId = null;

    const preset = classPreset(entity.classId);
    entity.armorMax = preset.armorMax;
    entity.armor = preset.armorMax;
    entity.wallhackRadius = preset.wallhackRadius;
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
    entity.beamTargetId = '';
    entity.beamActiveUntil = 0;
    entity.beamHeat = 0;
    entity.beamOverheated = false;
    entity.beamOverheatedUntil = 0;
    entity.lastPlasmaTickAt = 0;
    entity.muzzleFlashUntil = 0;
    entity.throwables = this.createThrowableRuntime();
    entity.lastThrowAt = 0;
    entity.abilityCooldownUntil = 0;
    entity.ultimateCooldownUntil = 0;
    entity.shadowDashUntil = 0;
    entity.deadeye = null;
    entity.chokeState = null;
  }

  tickBots(dtSec) {
    const players = Array.from(this.players.values()).filter((p) => p.alive);
    for (const bot of this.bots.values()) {
      this.respawnIfNeeded(bot);
      if (!bot.alive) continue;

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

      bot.x = clamp(bot.x + bot.aiDirX * bot.aiSpeed * dtSec, this.boundsMin, this.boundsMax);
      bot.z = clamp(bot.z + bot.aiDirZ * bot.aiSpeed * dtSec, this.boundsMin, this.boundsMax);
      bot.yaw = Math.atan2(bot.aiDirX, bot.aiDirZ);
      bot.pitch = 0;
      bot.moveSpeedNorm = clamp(bot.aiSpeed / 3.2, 0, 1.4);
      bot.sprinting = bot.aiSpeed > 2.5;

      this.regenArmor(bot, dtSec);
      this.tickPlasmaState(bot, dtSec);
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
      this.tickPlasmaState(player, dtSec);
      this.tickThrowableRegen(player, dtSec);
      this.tickClassAbilityState(player);
    }
  }

  tickClassAbilityState(entity) {
    if (!entity || !entity.alive) return;
    const now = nowMs();
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
      } else if (now >= (d.nextLockAt || 0)) {
        d.lockIndex = Math.min(d.queue.length, (d.lockIndex || 0) + 1);
        d.nextLockAt = now + (d.lockEveryMs || 420);
        if (d.lockIndex >= d.queue.length) {
          for (let i = 0; i < d.queue.length; i++) {
            const target = this.getEntityById(d.queue[i]);
            if (!target || !target.alive || target.id === entity.id) continue;
            const out = this.applyDamage(target, d.damage || 260);
            if (!out) continue;
            this.broadcast({
              t: 'damage_event',
              targetId: target.id,
              sourceId: entity.id,
              health: out.hp,
              armor: out.armor,
              hitType: 'body'
            });
            if (out.killed) {
              this.broadcast({
                t: 'death_respawn',
                entityId: target.id,
                respawnAt: target.respawnAt,
                classApplied: target.classId
              });
            }
          }
          entity.deadeye = null;
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
      beamTargetId: entity.beamTargetId || '',
      beamActiveUntil: entity.beamActiveUntil || 0,
      beamHeat: Number((entity.beamHeat || 0).toFixed(3)),
      beamOverheated: !!entity.beamOverheated,
      muzzleFlashUntil: entity.muzzleFlashUntil || 0,
      abilityCooldownRemaining: Math.max(0, ((entity.abilityCooldownUntil || 0) - nowMs()) / 1000),
      ultimateCooldownRemaining: Math.max(0, ((entity.ultimateCooldownUntil || 0) - nowMs()) / 1000),
      shadowDashUntil: entity.shadowDashUntil || 0,
      chokeState: entity.chokeState ? {
        targetId: entity.chokeState.targetId || '',
        endsAt: entity.chokeState.endsAt || 0,
        liftHeight: entity.chokeState.liftHeight || 1.0
      } : null,
      deadeyeState: entity.deadeye ? {
        lockCount: entity.deadeye.lockIndex || 0,
        maxLocks: entity.deadeye.queue ? entity.deadeye.queue.length : 0,
        nextLockAt: entity.deadeye.nextLockAt || 0
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
      t: 'snapshot',
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

async function handleWsUpgrade(env, request) {
  const session = await getSessionFromRequest(env, request);
  if (!session) return new Response('Unauthorized', { status: 401 });

  const id = env.GLOBAL_ARENA.idFromName(env.ROOM_NAME || 'global');
  const stub = env.GLOBAL_ARENA.get(id);

  const doUrl = new URL('https://room/connect');
  doUrl.searchParams.set('userId', session.userId);
  doUrl.searchParams.set('username', session.username);
  doUrl.searchParams.set('classId', session.classId || 'sharpshooter');

  const headers = new Headers(request.headers);
  headers.set('X-User-Id', session.userId);

  return stub.fetch(new Request(doUrl.toString(), {
    method: request.method,
    headers,
    body: request.body
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      return handleLogin(env, request);
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      return handleLogout(env, request);
    }

    if (request.method === 'GET' && url.pathname === '/api/me') {
      return handleMe(env, request);
    }

    if (url.pathname === '/api/ws') {
      return handleWsUpgrade(env, request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
