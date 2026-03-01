import { DurableObject } from 'cloudflare:workers';
import '../shared/game-primitives.js';
import '../shared/game-schema.js';

const PRIM = globalThis.__GAME_PRIMITIVES__ || {};
const SCHEMA = globalThis.__GAME_SCHEMA__ || {};
const COMBAT_PRIM = PRIM.combat || {};
const WORLD_PRIM = PRIM.world || {};
const ENTITY_PRIM = PRIM.entity || {};
const COORDS_PRIM = PRIM.coords || {};

const CLASS_PRESETS = COMBAT_PRIM.class_presets || {
  ninja: { armorMax: 80, wallhackRadius: 90 },
  jedi: { armorMax: 130, wallhackRadius: 85 },
  magician: { armorMax: 100, wallhackRadius: 100 },
  sharpshooter: { armorMax: 90, wallhackRadius: 115 },
  brawler: { armorMax: 150, wallhackRadius: 75 }
};

const WEAPON_STATS = (() => {
  const src = COMBAT_PRIM.weapon_stats || {};
  const keys = Object.keys(src);
  if (keys.length === 0) {
    return {
      rifle: { cooldownMs: 190, bodyDamage: 36, headDamage: 68, maxRange: 120 },
      pistol: { cooldownMs: 280, bodyDamage: 30, headDamage: 56, maxRange: 92 },
      machinegun: { cooldownMs: 80, bodyDamage: 16, headDamage: 30, maxRange: 88 },
      shotgun: { cooldownMs: 820, bodyDamage: 14, headDamage: 22, maxRange: 42 },
      sniper: { cooldownMs: 1250, bodyDamage: 120, headDamage: 220, maxRange: 190 },
      plasma: { cooldownMs: 100, bodyDamage: 15, headDamage: 15, maxRange: 24 }
    };
  }

  const out = {};
  for (let i = 0; i < keys.length; i++) {
    const id = keys[i];
    const s = src[id];
    out[id] = {
      cooldownMs: Number(s.cooldown_ms || 0),
      bodyDamage: Number(s.body_damage || 0),
      headDamage: Number(s.head_damage || 0),
      maxRange: Number(s.max_range || 0)
    };
  }
  return out;
})();

const ROOM_TICK_MS = 50;
const MAX_HP = Number(COMBAT_PRIM.max_hp || 500);
const ARMOR_REGEN_DELAY_MS = Number(COMBAT_PRIM.armor_regen_delay_sec || 6) * 1000;
const ARMOR_REGEN_PER_SEC = Number(COMBAT_PRIM.armor_regen_per_sec || 12);
const PLASMA_MAX_SUSTAIN_MS = Number((COMBAT_PRIM.plasma && COMBAT_PRIM.plasma.max_sustain_ms) || 2500);
const PLASMA_OVERHEAT_MS = Number((COMBAT_PRIM.plasma && COMBAT_PRIM.plasma.overheat_ms) || 1600);
const REMOTE_BEAM_HOLD_MS = Number((COMBAT_PRIM.plasma && COMBAT_PRIM.plasma.beam_hold_ms) || 180);
const VALID_ANIM_STATES = new Set(['idle', 'walk', 'run', 'sprint', 'airborne', 'strafe']);
const VALID_GRIP_MODES = new Set(['one_hand', 'two_hand']);

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
  const ay = ((typeof a.feetY === 'number') ? a.feetY : 0) + ENTITY_EYE_HEIGHT;
  const by = ((typeof b.feetY === 'number') ? b.feetY : 0) + ENTITY_EYE_HEIGHT;
  const dy = ay - by;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function inferGripMode(weaponId) {
  return weaponId === 'pistol' ? 'one_hand' : 'two_hand';
}

const BASE_WORLD_SIZE = Number(WORLD_PRIM.base_world_size || 50);
const WORLD_AREA_SCALE = Number(WORLD_PRIM.area_scale || 5);
const WORLD_SIZE = Number(WORLD_PRIM.world_size || Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE)));
const WORLD_MARGIN = Number(WORLD_PRIM.margin || 2);
const WORLD_MIN = Number(WORLD_PRIM.min || WORLD_MARGIN);
const WORLD_MAX = Number(WORLD_PRIM.max || (WORLD_SIZE - WORLD_MARGIN));
const WORLD_CENTER = Number(WORLD_PRIM.center || (WORLD_SIZE * 0.5));
const WORLD_SEED = String(WORLD_PRIM.seed_default || 'mineshoot-v1');
const ENTITY_EYE_HEIGHT = Number(COORDS_PRIM.eye_offset_y || 1.6);
const ENTITY_HEIGHT = Number(ENTITY_PRIM.capsule_height || 1.7);
const ENTITY_RADIUS = Number(ENTITY_PRIM.capsule_radius || 0.58);
const COLLISION_EPSILON = 0.001;

function scaleAxis(value) {
  if (WORLD_PRIM.scale_axis) return WORLD_PRIM.scale_axis(value);
  return (value / BASE_WORLD_SIZE) * WORLD_SIZE;
}

function scaleSpan(value) {
  if (WORLD_PRIM.scale_span) return WORLD_PRIM.scale_span(value);
  return Math.max(1, (value / BASE_WORLD_SIZE) * WORLD_SIZE);
}

function makeAabb(cx, cy, cz, w, h, d) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const hd = d * 0.5;
  return {
    min: { x: cx - hw, y: cy - hh, z: cz - hd },
    max: { x: cx + hw, y: cy + hh, z: cz + hd }
  };
}

function buildServerWorldSolidSpecs() {
  const solids = [];
  const add = (x, y, z, w, h, d, kind) => {
    solids.push({
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
      z: Number(z.toFixed(3)),
      w: Number(w.toFixed(3)),
      h: Number(h.toFixed(3)),
      d: Number(d.toFixed(3)),
      kind: kind || 'cover'
    });
  };
  const px = (value) => scaleAxis(value);
  const span = (value) => scaleSpan(value);

  // Core divider/cover geometry mirrored from client world primitives.
  const coverLayout = WORLD_PRIM.core_cover_layout || [];
  if (coverLayout.length > 0) {
    for (let i = 0; i < coverLayout.length; i++) {
      const c = coverLayout[i];
      add(px(c[0]), c[1], px(c[2]), span(c[3]), c[4], span(c[5]), 'core');
    }
  } else {
    add(px(25), 1.5, px(25), span(4), 3, span(1), 'core');
    add(px(25), 1.5, px(27), span(1), 3, span(3), 'core');
    add(px(25), 1.5, px(23), span(1), 3, span(3), 'core');
  }

  const edgeStep = Math.max(2, Math.round(WORLD_SIZE / 30));
  for (let edge = WORLD_MIN + 1; edge <= WORLD_MAX - 1; edge += edgeStep) {
    const northHeight = 2 + ((edge % (edgeStep * 3) === 0) ? 1 : 0) + ((edge % (edgeStep * 5) === 0) ? 1 : 0);
    const southHeight = 2 + ((edge % (edgeStep * 4) === 0) ? 1 : 0);
    add(edge, northHeight * 0.5, WORLD_MIN + 0.8, edgeStep * 0.92, northHeight, 1.2, 'barrier');
    add(edge, southHeight * 0.5, WORLD_MAX - 0.8, edgeStep * 0.92, southHeight, 1.2, 'barrier');
  }

  for (let edge = WORLD_MIN + 1; edge <= WORLD_MAX - 1; edge += edgeStep) {
    const westHeight = 2 + ((edge % (edgeStep * 4) === 0) ? 1 : 0);
    const eastHeight = 2 + ((edge % (edgeStep * 3) === 0) ? 1 : 0);
    add(WORLD_MIN + 0.8, westHeight * 0.5, edge, 1.2, westHeight, edgeStep * 0.92, 'barrier');
    add(WORLD_MAX - 0.8, eastHeight * 0.5, edge, 1.2, eastHeight, edgeStep * 0.92, 'barrier');
  }

  return solids;
}

function buildServerWorldColliders(solids) {
  const colliders = [];
  const list = Array.isArray(solids) ? solids : [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    colliders.push(makeAabb(s.x, s.y, s.z, s.w, s.h, s.d));
  }
  return colliders;
}

const SERVER_WORLD_SOLIDS = buildServerWorldSolidSpecs();
const SERVER_WORLD_COLLIDERS = buildServerWorldColliders(SERVER_WORLD_SOLIDS);

function intersectsXZCircleAabb(x, z, radius, box) {
  const closestX = clamp(x, box.min.x, box.max.x);
  const closestZ = clamp(z, box.min.z, box.max.z);
  const dx = x - closestX;
  const dz = z - closestZ;
  return ((dx * dx + dz * dz) < (radius * radius));
}

function isBlockedAt(colliders, x, z, feetY, height = ENTITY_HEIGHT, radius = ENTITY_RADIUS) {
  if (!colliders || colliders.length === 0) return false;
  const headY = feetY + height;

  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    if (!box) continue;
    if (headY <= box.min.y + COLLISION_EPSILON || feetY >= box.max.y - COLLISION_EPSILON) continue;
    if (intersectsXZCircleAabb(x, z, radius, box)) return true;
  }
  return false;
}

function randomSafeSpawn(colliders, options = {}) {
  const padding = (typeof options.padding === 'number') ? options.padding : 8;
  const tries = Math.max(1, Math.floor(options.tries || 80));
  const feetY = (typeof options.feetY === 'number') ? options.feetY : 0;
  const height = (typeof options.height === 'number') ? options.height : ENTITY_HEIGHT;
  const radius = (typeof options.radius === 'number') ? options.radius : ENTITY_RADIUS;
  const min = WORLD_MIN + padding;
  const max = WORLD_MAX - padding;

  for (let i = 0; i < tries; i++) {
    const x = min + Math.random() * (max - min);
    const z = min + Math.random() * (max - min);
    if (!isBlockedAt(colliders, x, z, feetY, height, radius)) {
      return { x, z };
    }
  }

  return {
    x: min + Math.random() * (max - min),
    z: min + Math.random() * (max - min)
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
    this.boundsMin = WORLD_MIN;
    this.boundsMax = WORLD_MAX;
    this.worldSolids = SERVER_WORLD_SOLIDS;
    this.worldColliders = SERVER_WORLD_COLLIDERS;
    this.ensureBots();
  }

  pickSafeSpawn(options = {}) {
    return randomSafeSpawn(this.worldColliders, {
      padding: (typeof options.padding === 'number') ? options.padding : 8,
      tries: (typeof options.tries === 'number') ? options.tries : 90,
      feetY: (typeof options.feetY === 'number') ? options.feetY : 0,
      height: (typeof options.height === 'number') ? options.height : ENTITY_HEIGHT,
      radius: (typeof options.radius === 'number') ? options.radius : ENTITY_RADIUS
    });
  }

  moveEntityWithCollision(entity, desiredX, desiredZ, desiredFeetY) {
    if (!entity) return;
    const targetX = clamp(desiredX, this.boundsMin, this.boundsMax);
    const targetZ = clamp(desiredZ, this.boundsMin, this.boundsMax);
    const targetFeetY = (typeof desiredFeetY === 'number') ? clamp(desiredFeetY, 0, 16) : (entity.feetY || 0);
    const feetY = targetFeetY;

    const startX = entity.x;
    const startZ = entity.z;
    const dx = targetX - startX;
    const dz = targetZ - startZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(1, Math.ceil(dist / 0.6));
    let curX = startX;
    let curZ = startZ;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const nextX = startX + (dx * t);
      const nextZ = startZ + (dz * t);

      if (!isBlockedAt(this.worldColliders, nextX, curZ, feetY, ENTITY_HEIGHT, ENTITY_RADIUS)) {
        curX = nextX;
      }
      if (!isBlockedAt(this.worldColliders, curX, nextZ, feetY, ENTITY_HEIGHT, ENTITY_RADIUS)) {
        curZ = nextZ;
      }
    }

    entity.x = curX;
    entity.z = curZ;
    entity.feetY = targetFeetY;
  }

  ensureBots() {
    const desired = Math.max(0, Number(this.env.BOT_COUNT || '6'));
    for (let i = 0; i < desired; i++) {
      const id = `bot-${i + 1}`;
      if (this.bots.has(id)) continue;
      const classId = 'sharpshooter';
      const preset = classPreset(classId);
      const spawn = this.pickSafeSpawn({ padding: 8, tries: 120, feetY: 0, height: ENTITY_HEIGHT, radius: ENTITY_RADIUS });
      this.bots.set(id, {
        id,
        kind: 'bot',
        username: `BOT_${i + 1}`,
        classId,
        queuedClassId: null,
        x: spawn.x,
        feetY: 0,
        z: spawn.z,
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
        animState: 'idle',
        animPhase: Math.random() * Math.PI * 2,
        gripMode: 'two_hand',
        aimPitch: 0,
        beamTargetId: '',
        beamActiveUntil: 0,
        beamHeat: 0,
        beamOverheated: false,
        beamOverheatedUntil: 0,
        lastPlasmaTickAt: 0,
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
      if (typeof p.feetY !== 'number') {
        p.feetY = 0;
      }
      if (typeof p.animState !== 'string') p.animState = 'idle';
      if (typeof p.animPhase !== 'number' || !Number.isFinite(p.animPhase)) p.animPhase = 0;
      if (!VALID_GRIP_MODES.has(p.gripMode)) p.gripMode = inferGripMode(p.weaponId || 'rifle');
      if (typeof p.aimPitch !== 'number' || !Number.isFinite(p.aimPitch)) p.aimPitch = p.pitch || 0;
      return p;
    }

    const preset = classPreset(classId);
    const spawn = this.pickSafeSpawn({ padding: 8, tries: 120, feetY: 0, height: ENTITY_HEIGHT, radius: ENTITY_RADIUS });
    const p = {
      id: userId,
      kind: 'player',
      username,
      classId,
      queuedClassId: null,
      x: spawn.x,
      feetY: 0,
      z: spawn.z,
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
      animState: 'idle',
      animPhase: Math.random() * Math.PI * 2,
      gripMode: 'two_hand',
      aimPitch: 0,
      beamTargetId: '',
      beamActiveUntil: 0,
      beamHeat: 0,
      beamOverheated: false,
      beamOverheatedUntil: 0,
      lastPlasmaTickAt: 0
    };

    this.players.set(userId, p);
    return p;
  }

  send(ws, obj) {
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

  handleInput(player, msg) {
    if (!player || !player.alive) return;

    const desiredX = (typeof msg.x === 'number') ? msg.x : player.x;
    const desiredZ = (typeof msg.z === 'number') ? msg.z : player.z;
    const desiredFeetY = (typeof msg.feetY === 'number') ? msg.feetY : player.feetY;
    this.moveEntityWithCollision(player, desiredX, desiredZ, desiredFeetY);

    if (typeof msg.yaw === 'number') player.yaw = msg.yaw;
    if (typeof msg.pitch === 'number') player.pitch = clamp(msg.pitch, -1.55, 1.55);
    if (typeof msg.aimPitch === 'number') player.aimPitch = clamp(msg.aimPitch, -1.55, 1.55);
    if (typeof msg.seq === 'number') player.seq = Math.max(player.seq, msg.seq);
    if (typeof msg.weaponId === 'string' && WEAPON_STATS[msg.weaponId]) {
      player.weaponId = msg.weaponId;
      if (!VALID_GRIP_MODES.has(player.gripMode)) {
        player.gripMode = inferGripMode(player.weaponId);
      }
    }
    if (typeof msg.moveSpeedNorm === 'number') player.moveSpeedNorm = clamp(msg.moveSpeedNorm, 0, 1.4);
    if (typeof msg.sprinting === 'boolean') player.sprinting = msg.sprinting;
    if (typeof msg.sprint === 'boolean') player.sprinting = msg.sprint;
    if (typeof msg.animState === 'string' && VALID_ANIM_STATES.has(msg.animState)) {
      player.animState = msg.animState;
    }
    if (typeof msg.animPhase === 'number' && Number.isFinite(msg.animPhase)) {
      player.animPhase = msg.animPhase;
    }
    if (typeof msg.gripMode === 'string' && VALID_GRIP_MODES.has(msg.gripMode)) {
      player.gripMode = msg.gripMode;
    } else if (!VALID_GRIP_MODES.has(player.gripMode)) {
      player.gripMode = inferGripMode(player.weaponId || 'rifle');
    }
    if (typeof player.aimPitch !== 'number' || !Number.isFinite(player.aimPitch)) {
      player.aimPitch = player.pitch;
    }
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
    player.gripMode = inferGripMode(weaponId);
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

  handleThrow(_player, _msg) {
    // v1 placeholder: type accepted and ignored; dedicated throwable simulation comes next.
  }

  webSocketMessage(ws, message) {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    const msg = safeJsonParse(text);
    if (!msg || typeof msg !== 'object') return;

    if (SCHEMA.validateWsClientMessage) {
      const checked = SCHEMA.validateWsClientMessage(msg);
      if (!checked.ok) {
        this.send(ws, {
          t: 'error',
          code: 'bad_message',
          message: checked.errors[0] || 'Invalid message payload'
        });
        return;
      }
    }

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
      this.handleThrow(player, msg);
      return;
    }
    if (type === 'class_queue') {
      this.handleClassQueue(player, msg, ws);
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
    if (sinceDamageMs < ARMOR_REGEN_DELAY_MS) return;

    entity.armor = Math.min(entity.armorMax, entity.armor + (ARMOR_REGEN_PER_SEC * dtSec));
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
    const spawn = this.pickSafeSpawn({ padding: 8, tries: 120, feetY: 0, height: ENTITY_HEIGHT, radius: ENTITY_RADIUS });
    entity.x = spawn.x;
    entity.z = spawn.z;
    entity.feetY = 0;
    entity.beamTargetId = '';
    entity.beamActiveUntil = 0;
    entity.beamHeat = 0;
    entity.beamOverheated = false;
    entity.beamOverheatedUntil = 0;
    entity.lastPlasmaTickAt = 0;
    entity.animState = 'idle';
    entity.animPhase = (typeof entity.animPhase === 'number' ? entity.animPhase : 0);
    entity.gripMode = inferGripMode(entity.weaponId || 'rifle');
    entity.aimPitch = 0;
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

      this.moveEntityWithCollision(
        bot,
        bot.x + (bot.aiDirX * bot.aiSpeed * dtSec),
        bot.z + (bot.aiDirZ * bot.aiSpeed * dtSec),
        bot.feetY
      );
      bot.yaw = Math.atan2(bot.aiDirX, bot.aiDirZ);
      bot.pitch = 0;
      bot.aimPitch = 0;
      bot.moveSpeedNorm = clamp(bot.aiSpeed / 3.2, 0, 1.4);
      bot.sprinting = bot.aiSpeed > 2.5;
      bot.animState = bot.sprinting ? 'sprint' : (bot.moveSpeedNorm > 0.45 ? 'run' : 'walk');
      bot.animPhase = (typeof bot.animPhase === 'number' ? bot.animPhase : 0) + (dtSec * (7 + (bot.moveSpeedNorm * 6)));
      bot.gripMode = inferGripMode(bot.weaponId || 'rifle');

      this.regenArmor(bot, dtSec);
      this.tickPlasmaState(bot, dtSec);
    }
  }

  tickPlayers(dtSec) {
    for (const player of this.players.values()) {
      this.respawnIfNeeded(player);
      if (typeof player.animPhase === 'number' && Number.isFinite(player.animPhase)) {
        if (player.moveSpeedNorm > 0.02) {
          const baseFreq = player.sprinting ? 14 : (player.moveSpeedNorm > 0.45 ? 11 : 8.2);
          player.animPhase += dtSec * (baseFreq * (0.32 + player.moveSpeedNorm));
        }
      } else {
        player.animPhase = 0;
      }
      this.regenArmor(player, dtSec);
      this.tickPlasmaState(player, dtSec);
    }
  }

  toEntityState(entity) {
    return {
      id: entity.id,
      kind: entity.kind,
      username: entity.username,
      classId: entity.classId,
      queuedClassId: entity.queuedClassId || null,
      x: Number(entity.x.toFixed(3)),
      feetY: Number((entity.feetY || 0).toFixed(3)),
      z: Number(entity.z.toFixed(3)),
      yaw: Number((entity.yaw || 0).toFixed(4)),
      pitch: Number((entity.pitch || 0).toFixed(4)),
      weaponId: entity.weaponId || 'rifle',
      moveSpeedNorm: Number((entity.moveSpeedNorm || 0).toFixed(3)),
      sprinting: !!entity.sprinting,
      animState: VALID_ANIM_STATES.has(entity.animState) ? entity.animState : 'idle',
      animPhase: Number((entity.animPhase || 0).toFixed(4)),
      gripMode: VALID_GRIP_MODES.has(entity.gripMode) ? entity.gripMode : inferGripMode(entity.weaponId || 'rifle'),
      aimPitch: Number((((typeof entity.aimPitch === 'number') ? entity.aimPitch : entity.pitch) || 0).toFixed(4)),
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
      visibleWallhack: true
    };
  }

  broadcastSnapshot() {
    const entities = [];
    for (const player of this.players.values()) entities.push(this.toEntityState(player));
    for (const bot of this.bots.values()) entities.push(this.toEntityState(bot));

    const packet = {
      t: 'snapshot',
      serverTime: nowMs(),
      entities
    };

    if (SCHEMA.validateServerSnapshot) {
      const checked = SCHEMA.validateServerSnapshot(packet);
      if (!checked.ok) {
        console.warn('snapshot validation failed:', checked.errors[0]);
        return;
      }
      this.broadcast(checked.value);
      return;
    }

    this.broadcast(packet);
  }

  tick() {
    const now = nowMs();
    const dtSec = Math.max(0.001, Math.min(0.2, (now - this.lastTickAt) / 1000));
    this.lastTickAt = now;

    this.tickPlayers(dtSec);
    this.tickBots(dtSec);
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

    if (request.method === 'GET' && url.pathname === '/api/world') {
      return json({
        ok: true,
        world: {
          version: 1,
          seed: String(env.WORLD_SEED || WORLD_SEED),
          size: WORLD_SIZE,
          center: WORLD_CENTER,
          margin: WORLD_MARGIN,
          min: WORLD_MIN,
          max: WORLD_MAX,
          areaScale: WORLD_AREA_SCALE,
          solidBoxes: SERVER_WORLD_SOLIDS
        }
      });
    }

    if (url.pathname === '/api/ws') {
      return handleWsUpgrade(env, request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
