import { DurableObject } from 'cloudflare:workers';
import '../shared/game-primitives.js';
import '../shared/world-layout.js';
import '../shared/game-schema.js';
import '../shared/aim-parity.js';

const PRIM = globalThis.__GAME_PRIMITIVES__ || {};
const WORLD_LAYOUT = globalThis.__GAME_WORLD_LAYOUT__ || {};
const SCHEMA = globalThis.__GAME_SCHEMA__ || {};
const AIM_PARITY = globalThis.__GAME_AIM_PARITY__ || {};
const COMBAT_PRIM = PRIM.combat || {};
const WORLD_PRIM = PRIM.world || {};
const ENTITY_PRIM = PRIM.entity || {};
const COORDS_PRIM = PRIM.coords || {};

const CLASS_PRESETS = COMBAT_PRIM.class_presets || {};

const WEAPON_STATS = (() => {
  const src = COMBAT_PRIM.weapon_stats || {};
  const keys = Object.keys(src);
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
const HITBOX_PRIM = PRIM.hitboxes || {};
const BODY_HITBOX_SIZE = (HITBOX_PRIM.body && HITBOX_PRIM.body.size) || [2.7, 2.0, 2.7];
const HEAD_HITBOX_SIZE = (HITBOX_PRIM.head && HITBOX_PRIM.head.size) || [1.55, 0.95, 1.55];
const BODY_HITBOX_OFFSET = Number(COORDS_PRIM.body_hitbox_offset_y || 1.0);
const HEAD_HITBOX_OFFSET = Number(COORDS_PRIM.head_hitbox_offset_y || 2.475);
const AIM_VIEWPORT = (AIM_PARITY && AIM_PARITY.getCanonicalViewport)
  ? AIM_PARITY.getCanonicalViewport()
  : { width: 1920, height: 1080 };

const MOVE_JOG_SPEED = 8;
const MOVE_RUN_SPEED = 11;
const MOVE_GRAVITY = 18;
const MOVE_JUMP_VELOCITY = 8.8;
const MOVE_JUMP_HOLD_ACCEL = 16;
const MOVE_MAX_JUMP_HOLD_SEC = 0.2;
const MOVE_JUMP_RELEASE_MULT = 0.42;
const COLLISION_STEP = Number(ENTITY_PRIM.collision_step_size || 0.6);

const THROWABLE_DEFS = {
  frag: {
    cooldownMs: 2400,
    fuseSec: 2.4,
    speed: 18,
    gravity: 18,
    radius: 5.4,
    damage: 160
  },
  seeker: {
    cooldownMs: 4200,
    fuseSec: 2.8,
    speed: 14,
    gravity: 14,
    radius: 4.8,
    damage: 130,
    seekStrength: 9.5
  },
  molotov: {
    cooldownMs: 4600,
    fuseSec: 1.2,
    speed: 16,
    gravity: 18,
    radius: 4.3,
    damage: 90,
    zoneDuration: 5.5,
    zoneTickRate: 0.25,
    zoneTickDamage: 16
  },
  knife: {
    cooldownMs: 1600,
    fuseSec: 1.5,
    speed: 29,
    gravity: 3,
    radius: 0.8,
    damageBody: 100,
    damageHead: 9999
  }
};

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
  if (CLASS_PRESETS[classId]) return CLASS_PRESETS[classId];
  if (CLASS_PRESETS.sharpshooter) return CLASS_PRESETS.sharpshooter;
  const keys = Object.keys(CLASS_PRESETS);
  if (keys.length > 0) return CLASS_PRESETS[keys[0]];
  return { armorMax: 90, wallhackRadius: 90 };
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
  const secureAttr = (new URL(request.url).protocol === 'https:') ? ' Secure;' : '';
  const setCookie = `${cookieName}=${encodeURIComponent(sessionId)}; HttpOnly;${secureAttr} SameSite=Lax; Path=/; Max-Age=${maxAge}`;

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

  const secureAttr = (new URL(request.url).protocol === 'https:') ? ' Secure;' : '';
  const clearCookie = `${cookieName}=; HttpOnly;${secureAttr} SameSite=Lax; Path=/; Max-Age=0`;
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

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function inferGripMode(weaponId) {
  return weaponId === 'pistol' ? 'one_hand' : 'two_hand';
}

function normalizeVec3(v) {
  const len = Math.sqrt((v.x * v.x) + (v.y * v.y) + (v.z * v.z)) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function resolveCameraMode(cameraMode) {
  return cameraMode === 'third' ? 'third' : 'first';
}

function directionFromYawPitch(yaw, pitch) {
  const cy = Math.cos(yaw || 0);
  const sy = Math.sin(yaw || 0);
  const cp = Math.cos(pitch || 0);
  const sp = Math.sin(pitch || 0);
  return normalizeVec3({
    x: -sy * cp,
    y: sp,
    z: -cy * cp
  });
}

function rayIntersectAabb(origin, dir, box, maxDistance) {
  let tmin = 0;
  let tmax = maxDistance;
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;
  const dx = dir.x;
  const dy = dir.y;
  const dz = dir.z;

  function axis(o, d, min, max) {
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return null;
      return { t0: -Infinity, t1: Infinity };
    }
    const inv = 1 / d;
    let t0 = (min - o) * inv;
    let t1 = (max - o) * inv;
    if (t0 > t1) {
      const tmp = t0;
      t0 = t1;
      t1 = tmp;
    }
    return { t0, t1 };
  }

  const ax = axis(ox, dx, box.min.x, box.max.x);
  if (!ax) return null;
  tmin = Math.max(tmin, ax.t0);
  tmax = Math.min(tmax, ax.t1);
  if (tmax < tmin) return null;

  const ay = axis(oy, dy, box.min.y, box.max.y);
  if (!ay) return null;
  tmin = Math.max(tmin, ay.t0);
  tmax = Math.min(tmax, ay.t1);
  if (tmax < tmin) return null;

  const az = axis(oz, dz, box.min.z, box.max.z);
  if (!az) return null;
  tmin = Math.max(tmin, az.t0);
  tmax = Math.min(tmax, az.t1);
  if (tmax < tmin) return null;

  if (tmin < 0 || tmin > maxDistance) return null;
  return tmin;
}

function toPoint3(x, y, z) {
  return { x: x || 0, y: y || 0, z: z || 0 };
}

function pointDistance(a, b) {
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function getCameraStateForEntity(entity) {
  const cameraMode = resolveCameraMode(entity && entity.cameraMode);
  if (AIM_PARITY && AIM_PARITY.getCameraState) {
    return AIM_PARITY.getCameraState({
      cameraMode,
      x: (entity && entity.x) || 0,
      z: (entity && entity.z) || 0,
      feetY: (entity && entity.feetY) || 0,
      yaw: (entity && entity.yaw) || 0,
      pitch: (entity && entity.pitch) || 0
    });
  }
  return {
    mode: cameraMode,
    cameraDistance: (cameraMode === 'third') ? 4.4 : 0,
    position: {
      x: (entity && entity.x) || 0,
      y: ((entity && entity.feetY) || 0) + ENTITY_EYE_HEIGHT,
      z: (entity && entity.z) || 0
    },
    basis: null
  };
}

function getReticleSizePx(kind, cameraMode, cameraDistance) {
  if (AIM_PARITY && AIM_PARITY.getReticleSizePx) {
    return Number(AIM_PARITY.getReticleSizePx(kind, cameraMode, cameraDistance) || 0);
  }
  if (kind === 'plasma') return 220;
  return 300;
}

function getShotgunPelletOffsets(cameraMode, cameraDistance) {
  if (AIM_PARITY && AIM_PARITY.getShotgunPelletOffsetsNdc) {
    return AIM_PARITY.getShotgunPelletOffsetsNdc(
      cameraMode,
      cameraDistance,
      AIM_VIEWPORT.width,
      AIM_VIEWPORT.height
    );
  }
  return [];
}

function shotgunFalloffDamage(baseDamage, distance) {
  if (distance <= 8) return baseDamage;
  if (distance >= 24) return Math.max(3, Math.round(baseDamage * 0.25));
  const t = (distance - 8) / 16;
  const scale = 1 - (t * 0.75);
  return Math.max(3, Math.round(baseDamage * scale));
}

function makeEntityBodyAabb(entity) {
  const hw = BODY_HITBOX_SIZE[0] * 0.5;
  const hh = BODY_HITBOX_SIZE[1] * 0.5;
  const hd = BODY_HITBOX_SIZE[2] * 0.5;
  const cy = (entity.feetY || 0) + BODY_HITBOX_OFFSET;
  return {
    min: { x: entity.x - hw, y: cy - hh, z: entity.z - hd },
    max: { x: entity.x + hw, y: cy + hh, z: entity.z + hd }
  };
}

function makeEntityHeadAabb(entity) {
  const hw = HEAD_HITBOX_SIZE[0] * 0.5;
  const hh = HEAD_HITBOX_SIZE[1] * 0.5;
  const hd = HEAD_HITBOX_SIZE[2] * 0.5;
  const cy = (entity.feetY || 0) + HEAD_HITBOX_OFFSET;
  return {
    min: { x: entity.x - hw, y: cy - hh, z: entity.z - hd },
    max: { x: entity.x + hw, y: cy + hh, z: entity.z + hd }
  };
}

function sphereIntersectsAabb(x, y, z, radius, box) {
  const cx = clamp(x, box.min.x, box.max.x);
  const cy = clamp(y, box.min.y, box.max.y);
  const cz = clamp(z, box.min.z, box.max.z);
  const dx = x - cx;
  const dy = y - cy;
  const dz = z - cz;
  return ((dx * dx) + (dy * dy) + (dz * dz)) <= (radius * radius);
}

function aabbTopAtXZ(x, z, box, radius) {
  if (!intersectsXZCircleAabb(x, z, radius, box)) return null;
  return box.max.y;
}

function aabbBottomAtXZ(x, z, box, radius) {
  if (!intersectsXZCircleAabb(x, z, radius, box)) return null;
  return box.min.y;
}

const WORLD_CONFIG = (WORLD_LAYOUT && WORLD_LAYOUT.getConfig)
  ? WORLD_LAYOUT.getConfig({})
  : {
      baseWorldSize: Number(WORLD_PRIM.base_world_size || 50),
      areaScale: Number(WORLD_PRIM.area_scale || 5),
      worldSize: Number(WORLD_PRIM.world_size || Math.round(Number(WORLD_PRIM.base_world_size || 50) * Math.sqrt(Number(WORLD_PRIM.area_scale || 5)))),
      margin: Number(WORLD_PRIM.margin || 2),
      min: Number(WORLD_PRIM.min || Number(WORLD_PRIM.margin || 2)),
      max: Number(WORLD_PRIM.max || (Number(WORLD_PRIM.world_size || 50) - Number(WORLD_PRIM.margin || 2))),
      center: Number(WORLD_PRIM.center || Number(WORLD_PRIM.world_size || 50) * 0.5),
      seed: String(WORLD_PRIM.seed_default || 'mineshoot-v1'),
      chunkSize: Math.max(4, Math.floor(Number(WORLD_PRIM.chunk_size || 16))),
      interestRadiusChunks: Math.max(1, Math.floor(Number(WORLD_PRIM.interest_radius_chunks || 2)))
    };
const BASE_WORLD_SIZE = Number(WORLD_CONFIG.baseWorldSize || 50);
const WORLD_AREA_SCALE = Number(WORLD_CONFIG.areaScale || 5);
const WORLD_SIZE = Number(WORLD_CONFIG.worldSize || Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE)));
const WORLD_MARGIN = Number(WORLD_CONFIG.margin || 2);
const WORLD_MIN = Number(WORLD_CONFIG.min || WORLD_MARGIN);
const WORLD_MAX = Number(WORLD_CONFIG.max || (WORLD_SIZE - WORLD_MARGIN));
const WORLD_CENTER = Number(WORLD_CONFIG.center || (WORLD_SIZE * 0.5));
const WORLD_SEED = String(WORLD_CONFIG.seed || 'mineshoot-v1');
const WORLD_CHUNK_SIZE = Math.max(4, Math.floor(Number(WORLD_CONFIG.chunkSize || 16)));
const WORLD_INTEREST_RADIUS_CHUNKS = Math.max(1, Math.floor(Number(WORLD_CONFIG.interestRadiusChunks || 2)));
const ENTITY_EYE_HEIGHT = Number(COORDS_PRIM.eye_offset_y || 1.6);
const ENTITY_HEIGHT = Number(ENTITY_PRIM.capsule_height || 1.7);
const ENTITY_RADIUS = Number(ENTITY_PRIM.capsule_radius || 0.58);
const COLLISION_EPSILON = 0.001;

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
  if (WORLD_LAYOUT && WORLD_LAYOUT.buildSolidSpecs) {
    return WORLD_LAYOUT.buildSolidSpecs({
      areaScale: WORLD_AREA_SCALE,
      worldSize: WORLD_SIZE,
      margin: WORLD_MARGIN,
      min: WORLD_MIN,
      max: WORLD_MAX,
      center: WORLD_CENTER,
      seed: WORLD_SEED,
      chunkSize: WORLD_CHUNK_SIZE,
      interestRadiusChunks: WORLD_INTEREST_RADIUS_CHUNKS
    });
  }
  return [];
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
const WORLD_CHUNK_INDEX = (WORLD_LAYOUT && WORLD_LAYOUT.buildChunkIndex)
  ? WORLD_LAYOUT.buildChunkIndex(SERVER_WORLD_SOLIDS, WORLD_CHUNK_SIZE)
  : new Map();

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
    this.playerSockets = new Map();
    this.players = new Map();
    this.bots = new Map();
    this.throwables = new Map();
    this.molotovZones = new Map();
    this.nextThrowableId = 1;
    this.hadThrowablesLastTick = false;
    this.tickHandle = null;
    this.lastTickAt = nowMs();
    this.roomName = env.ROOM_NAME || 'global';
    this.boundsMin = WORLD_MIN;
    this.boundsMax = WORLD_MAX;
    this.chunkSize = WORLD_CHUNK_SIZE;
    this.interestRadiusChunks = WORLD_INTEREST_RADIUS_CHUNKS;
    this.protocolVersion = 2;
    this.worldSolids = SERVER_WORLD_SOLIDS;
    this.worldColliders = SERVER_WORLD_COLLIDERS;
    this.worldChunkIndex = WORLD_CHUNK_INDEX;
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

  chunkKey(cx, cz) {
    if (WORLD_LAYOUT && WORLD_LAYOUT.makeChunkKey) return WORLD_LAYOUT.makeChunkKey(cx, cz);
    return `${cx}:${cz}`;
  }

  chunkForPosition(x, z) {
    if (WORLD_LAYOUT && WORLD_LAYOUT.getChunkForPosition) {
      return WORLD_LAYOUT.getChunkForPosition(x, z, this.chunkSize);
    }
    return {
      cx: Math.floor(x / this.chunkSize),
      cz: Math.floor(z / this.chunkSize)
    };
  }

  socketsForUser(userId) {
    if (!this.playerSockets.has(userId)) {
      this.playerSockets.set(userId, new Set());
    }
    return this.playerSockets.get(userId);
  }

  moveEntityHorizontalWithCollision(entity, desiredX, desiredZ, feetY) {
    if (!entity) return;
    const targetX = clamp(desiredX, this.boundsMin, this.boundsMax);
    const targetZ = clamp(desiredZ, this.boundsMin, this.boundsMax);
    const startFeetY = (typeof feetY === 'number') ? clamp(feetY, 0, 16) : (entity.feetY || 0);

    const startX = entity.x;
    const startZ = entity.z;
    const dx = targetX - startX;
    const dz = targetZ - startZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(1, Math.ceil(dist / COLLISION_STEP));
    let curX = startX;
    let curZ = startZ;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const nextX = startX + (dx * t);
      const nextZ = startZ + (dz * t);

      if (!isBlockedAt(this.worldColliders, nextX, curZ, startFeetY, ENTITY_HEIGHT, ENTITY_RADIUS)) {
        curX = nextX;
      }
      if (!isBlockedAt(this.worldColliders, curX, nextZ, startFeetY, ENTITY_HEIGHT, ENTITY_RADIUS)) {
        curZ = nextZ;
      }
    }

    entity.x = curX;
    entity.z = curZ;
  }

  findLandingSurfaceY(x, z, currentFeetY, nextFeetY) {
    let best = 0;
    for (let i = 0; i < this.worldColliders.length; i++) {
      const box = this.worldColliders[i];
      const top = aabbTopAtXZ(x, z, box, ENTITY_RADIUS * 0.9);
      if (top === null) continue;
      if (top <= currentFeetY + COLLISION_EPSILON && top >= nextFeetY - COLLISION_EPSILON) {
        if (top > best) best = top;
      }
    }
    return best;
  }

  findCeilingY(x, z, currentHeadY, nextHeadY) {
    let best = null;
    for (let i = 0; i < this.worldColliders.length; i++) {
      const box = this.worldColliders[i];
      const bottom = aabbBottomAtXZ(x, z, box, ENTITY_RADIUS * 0.9);
      if (bottom === null) continue;
      if (bottom >= currentHeadY - COLLISION_EPSILON && bottom <= nextHeadY + COLLISION_EPSILON) {
        if (best === null || bottom < best) best = bottom;
      }
    }
    return best;
  }

  sendChunkSnapshot(ws, chunk) {
    if (!chunk) return;
    this.send(ws, {
      t: 'chunk_snapshot',
      chunk: {
        key: chunk.key,
        version: Number(chunk.version || 1),
        solids: Array.isArray(chunk.solids) ? chunk.solids : [],
        decor: Array.isArray(chunk.decor) ? chunk.decor : [],
        blockers: Array.isArray(chunk.blockers) ? chunk.blockers : [],
        nav: Array.isArray(chunk.nav) ? chunk.nav : []
      }
    });
  }

  updateChunkInterest(player, force, explicitCenter) {
    if (!player) return;
    if (!player.chunkSubs) player.chunkSubs = new Set();
    const sockets = this.socketsForUser(player.id);
    if (sockets.size === 0) return;

    const center = explicitCenter || this.chunkForPosition(player.x, player.z);
    player.chunkCenterX = center.cx;
    player.chunkCenterZ = center.cz;

    const wanted = new Set();
    for (let dz = -this.interestRadiusChunks; dz <= this.interestRadiusChunks; dz++) {
      for (let dx = -this.interestRadiusChunks; dx <= this.interestRadiusChunks; dx++) {
        const cx = center.cx + dx;
        const cz = center.cz + dz;
        const key = this.chunkKey(cx, cz);
        wanted.add(key);
        if (force || !player.chunkSubs.has(key)) {
          const chunk = this.worldChunkIndex.get(key);
          if (!chunk) continue;
          for (const ws of sockets.values()) this.sendChunkSnapshot(ws, chunk);
        }
      }
    }

    for (const existingKey of player.chunkSubs.values()) {
      if (!wanted.has(existingKey)) {
        for (const ws of sockets.values()) {
          this.send(ws, { t: 'chunk_delta', key: existingKey, version: nowMs(), op: 'remove' });
        }
      }
    }
    player.chunkSubs = wanted;
  }

  ensurePlayerCoreFields(player) {
    if (!player.intent) {
      player.intent = {
        moveX: 0,
        moveZ: 0,
        jumpHeld: false,
        sprint: false,
        actions: []
      };
    }
    if (typeof player.velY !== 'number' || !Number.isFinite(player.velY)) player.velY = 0;
    if (typeof player.grounded !== 'boolean') player.grounded = true;
    if (typeof player.jumpHoldTimerSec !== 'number' || !Number.isFinite(player.jumpHoldTimerSec)) player.jumpHoldTimerSec = 0;
    if (typeof player.jumpHeldPrev !== 'boolean') player.jumpHeldPrev = false;
    if (!player.lastThrowAt || typeof player.lastThrowAt !== 'object') player.lastThrowAt = {};
    if (!player.lastShotAt || typeof player.lastShotAt !== 'object') player.lastShotAt = {};
    if (!player.chunkSubs) player.chunkSubs = new Set();
    player.cameraMode = resolveCameraMode(player.cameraMode);
  }

  simulatePlayerMovement(player, dtSec) {
    if (!player || !player.alive) return;
    this.ensurePlayerCoreFields(player);

    const moveX = clamp(Number(player.intent.moveX || 0), -1, 1);
    const moveZ = clamp(Number(player.intent.moveZ || 0), -1, 1);
    const sprint = !!player.intent.sprint;
    const jumpHeld = !!player.intent.jumpHeld;
    const jumpJustPressed = jumpHeld && !player.jumpHeldPrev;
    const jumpJustReleased = !jumpHeld && player.jumpHeldPrev;
    player.jumpHeldPrev = jumpHeld;

    if (jumpJustPressed && player.grounded) {
      player.velY = MOVE_JUMP_VELOCITY;
      player.grounded = false;
      player.jumpHoldTimerSec = MOVE_MAX_JUMP_HOLD_SEC;
    }
    if (jumpJustReleased && player.velY > 0) {
      player.velY *= MOVE_JUMP_RELEASE_MULT;
      player.jumpHoldTimerSec = 0;
    }
    if (jumpHeld && player.jumpHoldTimerSec > 0 && player.velY > 0) {
      player.velY += MOVE_JUMP_HOLD_ACCEL * dtSec;
      player.jumpHoldTimerSec = Math.max(0, player.jumpHoldTimerSec - dtSec);
    }

    const forwardX = -Math.sin(player.yaw || 0);
    const forwardZ = -Math.cos(player.yaw || 0);
    const rightX = Math.cos(player.yaw || 0);
    const rightZ = -Math.sin(player.yaw || 0);
    let worldMoveX = (rightX * moveX) + (forwardX * moveZ);
    let worldMoveZ = (rightZ * moveX) + (forwardZ * moveZ);
    const vecLen = Math.sqrt((worldMoveX * worldMoveX) + (worldMoveZ * worldMoveZ));
    const moving = vecLen > 0.0001;
    if (moving) {
      worldMoveX /= vecLen;
      worldMoveZ /= vecLen;
    }
    const speed = sprint ? MOVE_RUN_SPEED : MOVE_JOG_SPEED;
    const desiredX = player.x + (worldMoveX * speed * dtSec);
    const desiredZ = player.z + (worldMoveZ * speed * dtSec);
    this.moveEntityHorizontalWithCollision(player, desiredX, desiredZ, player.feetY);

    player.moveSpeedNorm = moving ? clamp(speed / MOVE_RUN_SPEED, 0, 1.4) : 0;
    player.sprinting = moving && sprint;
    if (!moving) player.animState = player.grounded ? 'idle' : 'airborne';
    else if (!player.grounded) player.animState = 'airborne';
    else player.animState = player.sprinting ? 'sprint' : (player.moveSpeedNorm > 0.45 ? 'run' : 'walk');

    player.velY -= MOVE_GRAVITY * dtSec;
    const currentFeetY = player.feetY || 0;
    let nextFeetY = currentFeetY + (player.velY * dtSec);

    if (player.velY <= 0) {
      const landingY = this.findLandingSurfaceY(player.x, player.z, currentFeetY, nextFeetY);
      if (nextFeetY <= landingY + COLLISION_EPSILON) {
        nextFeetY = landingY;
        player.velY = 0;
        player.grounded = true;
        player.jumpHoldTimerSec = 0;
      } else {
        player.grounded = false;
      }
    } else {
      const currentHeadY = currentFeetY + ENTITY_HEIGHT;
      const nextHeadY = nextFeetY + ENTITY_HEIGHT;
      const ceilingY = this.findCeilingY(player.x, player.z, currentHeadY, nextHeadY);
      if (ceilingY !== null && nextHeadY >= ceilingY - COLLISION_EPSILON) {
        nextFeetY = ceilingY - ENTITY_HEIGHT;
        player.velY = 0;
        player.jumpHoldTimerSec = 0;
      }
      player.grounded = false;
    }

    if (nextFeetY < 0) {
      nextFeetY = 0;
      player.velY = 0;
      player.grounded = true;
      player.jumpHoldTimerSec = 0;
    }
    player.feetY = clamp(nextFeetY, 0, 16);
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
        cameraMode: 'first',
        velY: 0,
        grounded: true,
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
        aiTurnTimer: 1 + Math.random() * 3,
        lastShotAt: {},
        lastThrowAt: {},
        chunkSubs: new Set()
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
    if (!userId) return new Response('Missing userId', { status: 400 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, username, classId });
    this.clients.set(server, { userId });
    this.socketsForUser(userId).add(server);

    const player = this.ensurePlayer(userId, username, classId);
    this.ensureTick();
    this.sendWelcome(server, player);
    this.updateChunkInterest(player, true);
    this.broadcastEntitySnapshot();
    this.broadcastThrowableSnapshot(true);

    return new Response(null, { status: 101, webSocket: client });
  }

  sendWelcome(ws, player) {
    this.send(ws, {
      t: 'welcome',
      selfId: player.id,
      roomId: this.roomName,
      protocolVersion: this.protocolVersion,
      tickRate: Math.round(1000 / ROOM_TICK_MS),
      chunkSize: this.chunkSize,
      interestRadiusChunks: this.interestRadiusChunks
    });
  }

  ensurePlayer(userId, username, classId) {
    if (this.players.has(userId)) {
      const p = this.players.get(userId);
      p.username = username || p.username;
      this.ensurePlayerCoreFields(p);
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
      cameraMode: 'first',
      velY: 0,
      grounded: true,
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
      lastThrowAt: {},
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
      jumpHoldTimerSec: 0,
      jumpHeldPrev: false,
      intent: {
        moveX: 0,
        moveZ: 0,
        jumpHeld: false,
        sprint: false,
        actions: []
      },
      chunkSubs: new Set()
    };
    this.players.set(userId, p);
    return p;
  }

  send(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch (_err) {
      // noop
    }
  }

  broadcast(obj) {
    const all = this.ctx.getWebSockets();
    const payload = JSON.stringify(obj);
    for (let i = 0; i < all.length; i++) {
      try {
        all[i].send(payload);
      } catch (_err) {
        // noop
      }
    }
  }

  handleInput(player, msg) {
    if (!player) return;
    this.ensurePlayerCoreFields(player);
    if (typeof msg.seq === 'number') player.seq = Math.max(player.seq, msg.seq);
    if (typeof msg.yaw === 'number') player.yaw = msg.yaw;
    if (typeof msg.pitch === 'number') player.pitch = clamp(msg.pitch, -1.55, 1.55);
    player.aimPitch = player.pitch;

    player.intent.moveX = clamp(Number(msg.moveX || 0), -1, 1);
    player.intent.moveZ = clamp(Number(msg.moveZ || 0), -1, 1);
    player.intent.jumpHeld = !!msg.jumpHeld;
    player.intent.sprint = !!msg.sprint;
    player.intent.actions = Array.isArray(msg.actions) ? msg.actions.slice(0, 16) : [];
    player.cameraMode = resolveCameraMode(msg.cameraMode);
    if (!VALID_GRIP_MODES.has(player.gripMode)) player.gripMode = inferGripMode(player.weaponId || 'rifle');
  }

  getEntityById(entityId) {
    if (this.players.has(entityId)) return this.players.get(entityId);
    if (this.bots.has(entityId)) return this.bots.get(entityId);
    return null;
  }

  eachCombatEntity(callback) {
    for (const player of this.players.values()) callback(player);
    for (const bot of this.bots.values()) callback(bot);
  }

  raycastWorldDistance(origin, dir, maxRange) {
    let best = Infinity;
    for (let i = 0; i < this.worldColliders.length; i++) {
      const hit = rayIntersectAabb(origin, dir, this.worldColliders[i], maxRange);
      if (hit !== null && hit < best) best = hit;
    }
    return best;
  }

  raycastEntityHit(shooter, origin, dir, maxRange) {
    let best = null;
    this.eachCombatEntity((target) => {
      if (!target || !target.alive || target.id === shooter.id) return;
      const bodyBox = makeEntityBodyAabb(target);
      const headBox = makeEntityHeadAabb(target);
      const bodyDist = rayIntersectAabb(origin, dir, bodyBox, maxRange);
      const headDist = rayIntersectAabb(origin, dir, headBox, maxRange);
      let hitDist = null;
      let hitType = 'body';
      if (headDist !== null && bodyDist !== null) {
        hitDist = Math.min(headDist, bodyDist);
        hitType = (headDist <= bodyDist) ? 'head' : 'body';
      } else if (headDist !== null) {
        hitDist = headDist;
        hitType = 'head';
      } else if (bodyDist !== null) {
        hitDist = bodyDist;
        hitType = 'body';
      }
      if (hitDist === null) return;
      if (!best || hitDist < best.distance) {
        best = { target, distance: hitDist, hitType };
      }
    });
    return best;
  }

  hasWorldLineOfSight(origin, targetPos, maxRange) {
    if (!origin || !targetPos) return false;
    const delta = {
      x: targetPos.x - origin.x,
      y: targetPos.y - origin.y,
      z: targetPos.z - origin.z
    };
    const dist = Math.sqrt((delta.x * delta.x) + (delta.y * delta.y) + (delta.z * delta.z)) || 0;
    if (dist <= 0.001) return false;
    if (typeof maxRange === 'number' && dist > maxRange) return false;
    const dir = {
      x: delta.x / dist,
      y: delta.y / dist,
      z: delta.z / dist
    };
    const blocker = this.raycastWorldDistance(origin, dir, Math.max(0, dist - 0.15));
    return blocker === Infinity;
  }

  overlapAreaWithReticle(cameraState, reticleRect, entity) {
    if (!AIM_PARITY || !AIM_PARITY.projectAabbToNdcRect || !AIM_PARITY.rectOverlapArea) return 0;
    let area = 0;
    const bodyRect = AIM_PARITY.projectAabbToNdcRect(cameraState, makeEntityBodyAabb(entity));
    if (bodyRect) area += AIM_PARITY.rectOverlapArea(bodyRect, reticleRect);
    const headRect = AIM_PARITY.projectAabbToNdcRect(cameraState, makeEntityHeadAabb(entity));
    if (headRect) area += AIM_PARITY.rectOverlapArea(headRect, reticleRect);
    return area;
  }

  selectPlasmaTarget(shooter, maxRange) {
    const cameraState = getCameraStateForEntity(shooter);
    const cameraMode = resolveCameraMode(shooter && shooter.cameraMode);
    const reticleSizePx = getReticleSizePx('plasma', cameraMode, cameraState.cameraDistance || 0);
    const reticleRect = (AIM_PARITY && AIM_PARITY.buildReticleRectNdc)
      ? AIM_PARITY.buildReticleRectNdc(reticleSizePx, AIM_VIEWPORT.width, AIM_VIEWPORT.height)
      : {
          minX: -0.12,
          maxX: 0.12,
          minY: -0.12,
          maxY: 0.12
        };

    let best = null;
    let bestArea = -1;
    let bestDist = Infinity;
    let candidateCount = 0;
    let overlapCount = 0;
    let anyInRangeOverlap = false;
    let anyOverlapNoLos = false;

    this.eachCombatEntity((target) => {
      if (!target || !target.alive || target.id === shooter.id) return;
      candidateCount++;

      const overlapArea = this.overlapAreaWithReticle(cameraState, reticleRect, target);
      if (overlapArea <= 0) return;
      overlapCount++;

      const corePos = toPoint3(
        target.x,
        (target.feetY || 0) + BODY_HITBOX_OFFSET,
        target.z
      );
      const dist = pointDistance(cameraState.position, corePos);
      if (dist > maxRange) return;
      anyInRangeOverlap = true;

      if (!this.hasWorldLineOfSight(cameraState.position, corePos, maxRange)) {
        anyOverlapNoLos = true;
        return;
      }

      if (overlapArea > bestArea || (Math.abs(overlapArea - bestArea) < 1e-8 && dist < bestDist)) {
        best = target;
        bestArea = overlapArea;
        bestDist = dist;
      }
    });

    if (best) {
      return {
        target: best,
        reason: 'locked',
        overlapArea: bestArea,
        candidateCount,
        overlapCount
      };
    }
    if (overlapCount === 0) {
      return {
        target: null,
        reason: 'searching',
        overlapArea: 0,
        candidateCount,
        overlapCount
      };
    }
    if (!anyInRangeOverlap) {
      return {
        target: null,
        reason: 'out_of_range',
        overlapArea: 0,
        candidateCount,
        overlapCount
      };
    }
    if (anyOverlapNoLos) {
      return {
        target: null,
        reason: 'no_los',
        overlapArea: 0,
        candidateCount,
        overlapCount
      };
    }
    return {
      target: null,
      reason: 'searching',
      overlapArea: 0,
      candidateCount,
      overlapCount
    };
  }

  getAimDirection(cameraState, yaw, pitch, ndcX, ndcY) {
    if (AIM_PARITY && AIM_PARITY.ndcOffsetToWorldDir) {
      return AIM_PARITY.ndcOffsetToWorldDir(
        cameraState,
        Number(ndcX || 0),
        Number(ndcY || 0)
      );
    }
    if (!ndcX && !ndcY) return directionFromYawPitch(yaw || 0, pitch || 0);
    return directionFromYawPitch((yaw || 0) - (ndcX * 0.08), (pitch || 0) + (ndcY * 0.08));
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
    if (remaining > 0) target.hp = Math.max(0, target.hp - remaining);

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

  emitDamage(sourceId, target, out, hitType) {
    this.broadcast({
      t: 'damage_event',
      targetId: target.id,
      sourceId: sourceId,
      health: out.hp,
      armor: out.armor,
      hitType: hitType || 'body'
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

  handleFireIntent(player, msg) {
    if (!player || !player.alive) return;
    const weaponId = String(msg.weaponId || player.weaponId || 'rifle');
    const stats = WEAPON_STATS[weaponId];
    if (!stats) return;
    player.weaponId = weaponId;
    player.gripMode = inferGripMode(weaponId);

    const now = nowMs();
    const prev = player.lastShotAt[weaponId] || 0;
    if ((now - prev) < stats.cooldownMs) return;
    player.lastShotAt[weaponId] = now;

    const cameraState = getCameraStateForEntity(player);
    const origin = cameraState.position || {
      x: player.x,
      y: (player.feetY || 0) + ENTITY_EYE_HEIGHT,
      z: player.z
    };
    const centerDir = this.getAimDirection(cameraState, player.yaw || 0, player.pitch || 0, 0, 0);

    if (weaponId === 'plasma') {
      if (player.beamOverheated && now < (player.beamOverheatedUntil || 0)) return;
      const selection = this.selectPlasmaTarget(player, stats.maxRange);
      const target = selection && selection.target ? selection.target : null;
      if (!target) {
        player.beamTargetId = '';
        player.beamActiveUntil = 0;
        return;
      }
      player.beamTargetId = target.id;
      player.beamActiveUntil = now + REMOTE_BEAM_HOLD_MS;
      const out = this.applyDamage(target, stats.bodyDamage);
      if (out) this.emitDamage(player.id, target, out, 'body');
      player.beamHeat = clamp((player.beamHeat || 0) + (stats.cooldownMs / PLASMA_MAX_SUSTAIN_MS), 0, 1);
      if (player.beamHeat >= 1) {
        player.beamHeat = 1;
        player.beamOverheated = true;
        player.beamOverheatedUntil = now + PLASMA_OVERHEAT_MS;
        player.beamTargetId = '';
        player.beamActiveUntil = 0;
      }
      return;
    }

    if (weaponId === 'shotgun') {
      const cameraMode = resolveCameraMode(player.cameraMode);
      const pelletOffsets = getShotgunPelletOffsets(cameraMode, cameraState.cameraDistance || 0);
      for (let i = 0; i < pelletOffsets.length; i++) {
        const p = pelletOffsets[i];
        const pelletDir = this.getAimDirection(cameraState, player.yaw || 0, player.pitch || 0, p.x, p.y);
        const entityHit = this.raycastEntityHit(player, origin, pelletDir, stats.maxRange);
        if (!entityHit || !entityHit.target) continue;
        const worldBlocker = this.raycastWorldDistance(origin, pelletDir, stats.maxRange);
        if (worldBlocker !== Infinity && worldBlocker < entityHit.distance - 0.03) continue;
        const baseDamage = entityHit.hitType === 'head' ? stats.headDamage : stats.bodyDamage;
        const pelletDamage = shotgunFalloffDamage(baseDamage, entityHit.distance);
        const out = this.applyDamage(entityHit.target, pelletDamage);
        if (out) this.emitDamage(player.id, entityHit.target, out, entityHit.hitType);
      }
      return;
    }

    const entityHit = this.raycastEntityHit(player, origin, centerDir, stats.maxRange);
    if (!entityHit || !entityHit.target) return;
    const worldBlocker = this.raycastWorldDistance(origin, centerDir, stats.maxRange);
    if (worldBlocker !== Infinity && worldBlocker < entityHit.distance - 0.03) return;
    const damage = entityHit.hitType === 'head' ? stats.headDamage : stats.bodyDamage;
    const out = this.applyDamage(entityHit.target, damage);
    if (out) this.emitDamage(player.id, entityHit.target, out, entityHit.hitType);
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

  spawnThrowable(player, throwableId) {
    const def = THROWABLE_DEFS[throwableId];
    if (!def) return null;
    const dir = directionFromYawPitch(player.yaw || 0, player.pitch || 0);
    const id = `thr_${this.nextThrowableId++}`;
    const start = {
      x: player.x + (dir.x * 0.7),
      y: (player.feetY || 0) + ENTITY_EYE_HEIGHT + (dir.y * 0.2),
      z: player.z + (dir.z * 0.7)
    };
    const velocityScale = def.speed;
    const throwable = {
      id,
      ownerId: player.id,
      type: throwableId,
      x: start.x,
      y: start.y,
      z: start.z,
      vx: dir.x * velocityScale,
      vy: (dir.y * velocityScale) + (throwableId === 'knife' ? 0.6 : 3.4),
      vz: dir.z * velocityScale,
      age: 0,
      fuse: def.fuseSec,
      state: 'flying'
    };
    this.throwables.set(id, throwable);
    this.broadcastThrowableEvent('spawn', {
      id,
      type: throwableId,
      x: throwable.x,
      y: throwable.y,
      z: throwable.z
    });
    return throwable;
  }

  handleThrowIntent(player, msg) {
    if (!player || !player.alive) return;
    const throwableId = String(msg.throwableId || '');
    const def = THROWABLE_DEFS[throwableId];
    if (!def) return;
    const now = nowMs();
    const prev = Number(player.lastThrowAt[throwableId] || 0);
    if ((now - prev) < def.cooldownMs) return;
    player.lastThrowAt[throwableId] = now;
    this.spawnThrowable(player, throwableId);
  }

  handleClassQueue(player, msg, ws) {
    if (!player) return;
    const classId = String(msg.classId || '');
    if (!CLASS_PRESETS[classId]) return;
    player.queuedClassId = classId;
    this.send(ws, { t: 'class_queued', classId });
  }

  handleChunkSubscribe(player, msg) {
    if (!player) return;
    const center = {
      cx: Math.floor(Number(msg.centerChunkX) || 0),
      cz: Math.floor(Number(msg.centerChunkZ) || 0)
    };
    this.updateChunkInterest(player, true, center);
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
      this.sendWelcome(ws, player);
      this.updateChunkInterest(player, true);
      return;
    }
    if (type === 'input') return this.handleInput(player, msg);
    if (type === 'fire_intent') return this.handleFireIntent(player, msg);
    if (type === 'throw_intent') return this.handleThrowIntent(player, msg);
    if (type === 'equip_weapon') return this.handleEquipWeapon(player, msg);
    if (type === 'class_queue') return this.handleClassQueue(player, msg, ws);
    if (type === 'chunk_subscribe') return this.handleChunkSubscribe(player, msg);
    if (type === 'ping') return this.send(ws, { t: 'pong', clientTime: msg.clientTime || 0, serverTime: nowMs() });
  }

  webSocketClose(ws) {
    const meta = this.clients.get(ws) || ws.deserializeAttachment();
    this.clients.delete(ws);
    if (meta && meta.userId) {
      const sockets = this.playerSockets.get(meta.userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) this.playerSockets.delete(meta.userId);
      }
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
    if (!active) entity.beamHeat = Math.max(0, (entity.beamHeat || 0) - (coolRate * dtSec));
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
    entity.velY = 0;
    entity.grounded = true;
    entity.jumpHeldPrev = false;
    entity.jumpHoldTimerSec = 0;
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
    if (entity.kind === 'player') this.updateChunkInterest(entity, true);
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

      this.moveEntityHorizontalWithCollision(
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
      bot.feetY = 0;
      bot.grounded = true;
      bot.velY = 0;
      this.regenArmor(bot, dtSec);
      this.tickPlasmaState(bot, dtSec);
    }
  }

  tickPlayers(dtSec) {
    for (const player of this.players.values()) {
      this.respawnIfNeeded(player);
      if (!player.alive) continue;
      this.simulatePlayerMovement(player, dtSec);
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
      this.updateChunkInterest(player, false);
    }
  }

  findNearestTargetForSeeker(ownerId, x, y, z, maxRange) {
    let best = null;
    this.eachCombatEntity((entity) => {
      if (!entity || !entity.alive || entity.id === ownerId) return;
      const tx = entity.x - x;
      const ty = ((entity.feetY || 0) + BODY_HITBOX_OFFSET) - y;
      const tz = entity.z - z;
      const dist = Math.sqrt((tx * tx) + (ty * ty) + (tz * tz));
      if (!isFinite(dist) || dist <= 0.001 || dist > maxRange) return;
      if (!best || dist < best.dist) {
        best = {
          entity,
          dist,
          dir: { x: tx / dist, y: ty / dist, z: tz / dist }
        };
      }
    });
    return best;
  }

  findThrowableEntityHit(ownerId, x, y, z, radius) {
    let best = null;
    this.eachCombatEntity((entity) => {
      if (!entity || !entity.alive || entity.id === ownerId) return;
      const body = makeEntityBodyAabb(entity);
      const head = makeEntityHeadAabb(entity);
      const bodyHit = sphereIntersectsAabb(x, y, z, radius, body);
      const headHit = sphereIntersectsAabb(x, y, z, radius, head);
      if (!bodyHit && !headHit) return;
      const dx = entity.x - x;
      const dy = ((entity.feetY || 0) + BODY_HITBOX_OFFSET) - y;
      const dz = entity.z - z;
      const dist = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
      if (!best || dist < best.distance) {
        best = {
          entity,
          hitType: headHit ? 'head' : 'body',
          distance: dist
        };
      }
    });
    return best;
  }

  explodeThrowable(throwable, def) {
    if (!throwable || !def) return;
    this.broadcastThrowableEvent('explode', {
      id: throwable.id,
      type: throwable.type,
      x: throwable.x,
      y: throwable.y,
      z: throwable.z,
      radius: Number(def.radius || 0),
      ttlMs: 220
    });
    if (throwable.type === 'molotov') {
      this.molotovZones.set(`mz_${throwable.id}`, {
        id: `mz_${throwable.id}`,
        ownerId: throwable.ownerId,
        x: throwable.x,
        z: throwable.z,
        radius: def.radius,
        lifeLeft: def.zoneDuration,
        tickTimer: 0
      });
      this.broadcastThrowableEvent('zone_create', {
        id: `mz_${throwable.id}`,
        type: 'molotov',
        x: throwable.x,
        y: 0,
        z: throwable.z,
        radius: Number(def.radius || 0),
        ttlMs: Math.max(0, Math.floor(Number(def.zoneDuration || 0) * 1000))
      });
    }
    const radius = Number(def.radius || 0);
    const baseDamage = Number(def.damage || 0);
    if (radius <= 0 || baseDamage <= 0) return;

    this.eachCombatEntity((target) => {
      if (!target || !target.alive) return;
      const coreY = (target.feetY || 0) + BODY_HITBOX_OFFSET;
      const dx = target.x - throwable.x;
      const dy = coreY - throwable.y;
      const dz = target.z - throwable.z;
      const dist = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
      if (dist > radius) return;
      const scale = 1 - (dist / radius);
      const damage = Math.max(1, Math.round(baseDamage * scale));
      const out = this.applyDamage(target, damage);
      if (out) this.emitDamage(throwable.ownerId, target, out, 'body');
    });
  }

  tickThrowables(dtSec) {
    if (this.throwables.size === 0 && this.molotovZones.size === 0) return;
    const toDelete = [];

    for (const throwable of this.throwables.values()) {
      const def = THROWABLE_DEFS[throwable.type];
      if (!def) {
        toDelete.push(throwable.id);
        continue;
      }

      throwable.age += dtSec;
      if (throwable.type === 'seeker') {
        const seek = this.findNearestTargetForSeeker(throwable.ownerId, throwable.x, throwable.y, throwable.z, 28);
        if (seek) {
          const seekAmt = Math.min(1, def.seekStrength * dtSec);
          const speed = Math.sqrt((throwable.vx * throwable.vx) + (throwable.vy * throwable.vy) + (throwable.vz * throwable.vz)) || def.speed;
          throwable.vx = (throwable.vx * (1 - seekAmt)) + (seek.dir.x * speed * seekAmt);
          throwable.vy = (throwable.vy * (1 - seekAmt)) + (seek.dir.y * speed * seekAmt);
          throwable.vz = (throwable.vz * (1 - seekAmt)) + (seek.dir.z * speed * seekAmt);
        }
      }

      throwable.vy -= Number(def.gravity || 0) * dtSec;
      const nextX = throwable.x + (throwable.vx * dtSec);
      const nextY = throwable.y + (throwable.vy * dtSec);
      const nextZ = throwable.z + (throwable.vz * dtSec);

      const sphereRadius = Number(def.radius || 0.5) * 0.16;
      let hitWorld = false;
      for (let i = 0; i < this.worldColliders.length; i++) {
        if (sphereIntersectsAabb(nextX, nextY, nextZ, sphereRadius, this.worldColliders[i])) {
          hitWorld = true;
          break;
        }
      }

      const hitEntity = this.findThrowableEntityHit(throwable.ownerId, nextX, nextY, nextZ, sphereRadius);
      throwable.x = nextX;
      throwable.y = nextY;
      throwable.z = nextZ;

      if (throwable.type === 'knife' && hitEntity && hitEntity.entity) {
        const damage = hitEntity.hitType === 'head' ? THROWABLE_DEFS.knife.damageHead : THROWABLE_DEFS.knife.damageBody;
        const out = this.applyDamage(hitEntity.entity, damage);
        if (out) this.emitDamage(throwable.ownerId, hitEntity.entity, out, hitEntity.hitType);
        toDelete.push(throwable.id);
        continue;
      }

      if (nextY <= 0 || hitWorld || throwable.age >= Number(def.fuse || 0)) {
        if (throwable.type !== 'knife') this.explodeThrowable(throwable, def);
        toDelete.push(throwable.id);
      }
    }

    for (let i = 0; i < toDelete.length; i++) this.throwables.delete(toDelete[i]);

    const zonesToDelete = [];
    for (const zone of this.molotovZones.values()) {
      zone.lifeLeft -= dtSec;
      if (zone.lifeLeft <= 0) {
        this.broadcastThrowableEvent('zone_end', {
          id: zone.id,
          type: 'molotov',
          x: zone.x,
          y: 0,
          z: zone.z,
          radius: zone.radius
        });
        zonesToDelete.push(zone.id);
        continue;
      }
      zone.tickTimer -= dtSec;
      while (zone.tickTimer <= 0) {
        zone.tickTimer += Number(THROWABLE_DEFS.molotov.zoneTickRate || 0.25);
        this.eachCombatEntity((target) => {
          if (!target || !target.alive) return;
          const dx = target.x - zone.x;
          const dz = target.z - zone.z;
          const dist = Math.sqrt((dx * dx) + (dz * dz));
          if (dist > zone.radius) return;
          const out = this.applyDamage(target, Number(THROWABLE_DEFS.molotov.zoneTickDamage || 16));
          if (out) this.emitDamage(zone.ownerId, target, out, 'body');
        });
      }
    }
    for (let i = 0; i < zonesToDelete.length; i++) this.molotovZones.delete(zonesToDelete[i]);
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
      velY: Number((entity.velY || 0).toFixed(4)),
      grounded: !!entity.grounded,
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

  toThrowableState(throwable) {
    const def = THROWABLE_DEFS[throwable.type] || {};
    return {
      id: throwable.id,
      ownerId: throwable.ownerId || '',
      type: throwable.type,
      x: Number((throwable.x || 0).toFixed(3)),
      y: Number((throwable.y || 0).toFixed(3)),
      z: Number((throwable.z || 0).toFixed(3)),
      vx: Number((throwable.vx || 0).toFixed(3)),
      vy: Number((throwable.vy || 0).toFixed(3)),
      vz: Number((throwable.vz || 0).toFixed(3)),
      fuse: Number((Math.max(0, Number(def.fuseSec || 0) - Number(throwable.age || 0))).toFixed(3)),
      state: 'flying'
    };
  }

  toZoneState(zone) {
    return {
      id: zone.id,
      type: 'molotov',
      x: Number((zone.x || 0).toFixed(3)),
      z: Number((zone.z || 0).toFixed(3)),
      radius: Number((zone.radius || 0).toFixed(3)),
      lifeLeft: Number((zone.lifeLeft || 0).toFixed(3))
    };
  }

  broadcastThrowableEvent(eventType, payload = {}) {
    const packet = {
      t: 'throwable_event',
      eventType: String(eventType || ''),
      id: String(payload.id || ''),
      type: payload.type !== undefined ? String(payload.type) : undefined,
      x: (typeof payload.x === 'number' && Number.isFinite(payload.x)) ? Number(payload.x.toFixed(3)) : undefined,
      y: (typeof payload.y === 'number' && Number.isFinite(payload.y)) ? Number(payload.y.toFixed(3)) : undefined,
      z: (typeof payload.z === 'number' && Number.isFinite(payload.z)) ? Number(payload.z.toFixed(3)) : undefined,
      radius: (typeof payload.radius === 'number' && Number.isFinite(payload.radius)) ? Number(payload.radius.toFixed(3)) : undefined,
      ttlMs: (typeof payload.ttlMs === 'number' && Number.isFinite(payload.ttlMs)) ? Math.max(0, Math.floor(payload.ttlMs)) : undefined
    };
    if (SCHEMA.validateThrowableEvent) {
      const checked = SCHEMA.validateThrowableEvent(packet);
      if (!checked.ok) return;
      this.broadcast(checked.value);
      return;
    }
    this.broadcast(packet);
  }

  broadcastThrowableSnapshot(force) {
    const throwables = [];
    const zones = [];
    for (const throwable of this.throwables.values()) {
      throwables.push(this.toThrowableState(throwable));
    }
    for (const zone of this.molotovZones.values()) {
      zones.push(this.toZoneState(zone));
    }

    const hasActive = (throwables.length > 0 || zones.length > 0);
    if (!force && !hasActive && !this.hadThrowablesLastTick) return;
    this.hadThrowablesLastTick = hasActive;

    const packet = {
      t: 'throwable_snapshot',
      serverTime: nowMs(),
      throwables,
      zones
    };
    if (SCHEMA.validateThrowableSnapshot) {
      const checked = SCHEMA.validateThrowableSnapshot(packet);
      if (!checked.ok) return;
      this.broadcast(checked.value);
      return;
    }
    this.broadcast(packet);
  }

  broadcastEntitySnapshot() {
    const entities = [];
    for (const player of this.players.values()) entities.push(this.toEntityState(player));
    for (const bot of this.bots.values()) entities.push(this.toEntityState(bot));
    const packet = {
      t: 'entity_snapshot',
      serverTime: nowMs(),
      entities
    };
    if (SCHEMA.validateServerEntitySnapshot) {
      const checked = SCHEMA.validateServerEntitySnapshot(packet);
      if (!checked.ok) {
        console.warn('entity_snapshot validation failed:', checked.errors[0]);
        return;
      }
      this.broadcast(checked.value);
      return;
    }
    this.broadcast(packet);
  }

  sendReconcile(player) {
    if (!player) return;
    const sockets = this.playerSockets.get(player.id);
    if (!sockets || sockets.size === 0) return;
    const reconcile = {
      t: 'server_reconcile',
      seq: Number(player.seq || 0),
      x: Number(player.x.toFixed(3)),
      feetY: Number((player.feetY || 0).toFixed(3)),
      z: Number(player.z.toFixed(3)),
      yaw: Number((player.yaw || 0).toFixed(4)),
      pitch: Number((player.pitch || 0).toFixed(4)),
      velY: Number((player.velY || 0).toFixed(4)),
      grounded: !!player.grounded
    };
    if (SCHEMA.validateServerReconcile) {
      const checked = SCHEMA.validateServerReconcile(reconcile);
      if (!checked.ok) return;
    }
    for (const ws of sockets.values()) this.send(ws, reconcile);
  }

  tick() {
    const now = nowMs();
    const dtSec = Math.max(0.001, Math.min(0.2, (now - this.lastTickAt) / 1000));
    this.lastTickAt = now;

    this.tickPlayers(dtSec);
    this.tickBots(dtSec);
    this.tickThrowables(dtSec);
    this.broadcastEntitySnapshot();
    this.broadcastThrowableSnapshot(false);
    for (const player of this.players.values()) this.sendReconcile(player);
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

    if (request.method === 'GET' && url.pathname === '/api/world/bootstrap') {
      const bootstrap = (WORLD_LAYOUT && WORLD_LAYOUT.getBootstrapPayload)
        ? WORLD_LAYOUT.getBootstrapPayload(WORLD_CONFIG, WORLD_CHUNK_INDEX)
        : {
            worldId: 'global-world',
            protocolVersion: 2,
            chunkSize: WORLD_CHUNK_SIZE,
            interestRadiusChunks: WORLD_INTEREST_RADIUS_CHUNKS,
            tickRate: Math.round(1000 / ROOM_TICK_MS),
            seed: String(env.WORLD_SEED || WORLD_SEED),
            spawnRules: { feetY: 0, padding: 8 },
            initialChunks: []
          };

      return json({
        ok: true,
        worldId: bootstrap.worldId,
        protocolVersion: bootstrap.protocolVersion,
        chunkSize: bootstrap.chunkSize,
        interestRadiusChunks: bootstrap.interestRadiusChunks,
        tickRate: bootstrap.tickRate,
        seed: bootstrap.seed,
        spawnRules: bootstrap.spawnRules,
        initialChunks: bootstrap.initialChunks,
        world: {
          version: 2,
          seed: String(env.WORLD_SEED || WORLD_SEED),
          size: WORLD_SIZE,
          center: WORLD_CENTER,
          margin: WORLD_MARGIN,
          min: WORLD_MIN,
          max: WORLD_MAX,
          areaScale: WORLD_AREA_SCALE,
          chunkStreaming: true,
          chunkSize: WORLD_CHUNK_SIZE,
          interestRadiusChunks: WORLD_INTEREST_RADIUS_CHUNKS,
          solidBoxes: [],
          initialChunks: bootstrap.initialChunks
        }
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/world') {
      return json({
        ok: true,
        world: {
          version: 2,
          seed: String(env.WORLD_SEED || WORLD_SEED),
          size: WORLD_SIZE,
          center: WORLD_CENTER,
          margin: WORLD_MARGIN,
          min: WORLD_MIN,
          max: WORLD_MAX,
          areaScale: WORLD_AREA_SCALE,
          chunkSize: WORLD_CHUNK_SIZE,
          interestRadiusChunks: WORLD_INTEREST_RADIUS_CHUNKS,
          chunkCount: WORLD_CHUNK_INDEX.size,
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
