import { DurableObject } from 'cloudflare:workers';

const CLASS_PRESETS = {
  ninja: { armorMax: 80, wallhackRadius: 90 },
  jedi: { armorMax: 130, wallhackRadius: 85 },
  magician: { armorMax: 100, wallhackRadius: 100 },
  sharpshooter: { armorMax: 90, wallhackRadius: 115 },
  brawler: { armorMax: 150, wallhackRadius: 75 }
};

const WEAPON_STATS = {
  rifle: { cooldownMs: 190, bodyDamage: 36, headDamage: 68, maxRange: 120 },
  pistol: { cooldownMs: 280, bodyDamage: 30, headDamage: 56, maxRange: 92 },
  machinegun: { cooldownMs: 80, bodyDamage: 16, headDamage: 30, maxRange: 88 },
  shotgun: { cooldownMs: 820, bodyDamage: 14, headDamage: 22, maxRange: 42 },
  sniper: { cooldownMs: 1250, bodyDamage: 120, headDamage: 220, maxRange: 190 }
};

const ROOM_TICK_MS = 50;
const MAX_HP = 500;

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
      lastShotAt: {}
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

    if (typeof msg.x === 'number') player.x = clamp(msg.x, this.boundsMin, this.boundsMax);
    if (typeof msg.z === 'number') player.z = clamp(msg.z, this.boundsMin, this.boundsMax);
    if (typeof msg.y === 'number') player.y = clamp(msg.y, 0, 16);
    if (typeof msg.yaw === 'number') player.yaw = msg.yaw;
    if (typeof msg.pitch === 'number') player.pitch = clamp(msg.pitch, -1.55, 1.55);
    if (typeof msg.seq === 'number') player.seq = Math.max(player.seq, msg.seq);
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
    if (sinceDamageMs < 6000) return;

    entity.armor = Math.min(entity.armorMax, entity.armor + (12 * dtSec));
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

      this.regenArmor(bot, dtSec);
    }
  }

  tickPlayers(dtSec) {
    for (const player of this.players.values()) {
      this.respawnIfNeeded(player);
      this.regenArmor(player, dtSec);
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
      y: Number((entity.y || 1.6).toFixed(3)),
      z: Number(entity.z.toFixed(3)),
      yaw: Number((entity.yaw || 0).toFixed(4)),
      pitch: Number((entity.pitch || 0).toFixed(4)),
      hp: Number(entity.hp.toFixed(2)),
      hpMax: Number(entity.hpMax.toFixed(2)),
      armor: Number(entity.armor.toFixed(2)),
      armorMax: Number(entity.armorMax.toFixed(2)),
      wallhackRadius: entity.wallhackRadius,
      alive: !!entity.alive,
      visibleWallhack: true
    };
  }

  broadcastSnapshot() {
    const entities = [];
    for (const player of this.players.values()) entities.push(this.toEntityState(player));
    for (const bot of this.bots.values()) entities.push(this.toEntityState(bot));

    this.broadcast({
      t: 'snapshot',
      serverTime: nowMs(),
      entities
    });
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

    if (url.pathname === '/api/ws') {
      return handleWsUpgrade(env, request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
