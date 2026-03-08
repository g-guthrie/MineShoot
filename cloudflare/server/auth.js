import {
  nowMs,
  normalizeUsername,
  validPin,
  validUsername,
  randomId,
  json,
  parseCookies
} from './transport.js';

export async function getSessionFromRequest(env, request) {
  const cookieName = env.SESSION_COOKIE_NAME || 'mfa_session';
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sid = cookies[cookieName];
  if (!sid) return null;

  const now = Math.floor(nowMs() / 1000);
  const row = await env.DB.prepare(
    `SELECT s.id as session_id, s.user_id, s.expires_at,
            u.username, p.class_id, p.display_name, p.profile_enabled,
            p.kills, p.deaths, p.damage_done, p.damage_taken
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
    classId: row.class_id || 'abilities',
    displayName: row.display_name || null,
    profileEnabled: !!row.profile_enabled,
    kills: row.kills || 0,
    deaths: row.deaths || 0,
    damageDone: row.damage_done || 0,
    damageTaken: row.damage_taken || 0,
    expiresAt: row.expires_at
  };
}

export async function ensureProfileRow(env, userId, classId) {
  await env.DB.prepare(
    `INSERT INTO profiles (user_id, class_id) VALUES (?1, ?2)
     ON CONFLICT(user_id) DO NOTHING`
  ).bind(userId, classId || 'abilities').run();
}

export async function handleLogin(env, request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const usernameRaw = String(body.username || '').trim();
  const usernameNorm = normalizeUsername(usernameRaw);
  const pin = String(body.pin || '');

  if (!validUsername(usernameRaw)) {
    return json({ ok: false, error: 'Username must be unique, non-empty, and 64 characters or fewer.' }, 400);
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

    await ensureProfileRow(env, userId, 'abilities');

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
    'SELECT class_id, display_name, profile_enabled, kills, deaths, damage_done, damage_taken FROM profiles WHERE user_id = ?1'
  ).bind(user.id).first();

  const cookieName = env.SESSION_COOKIE_NAME || 'mfa_session';
  const setCookie = `${cookieName}=${encodeURIComponent(sessionId)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

  return json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      classId: (profile && profile.class_id) || 'abilities',
      displayName: (profile && profile.display_name) || null,
      profileEnabled: !!(profile && profile.profile_enabled),
      kills: (profile && profile.kills) || 0,
      deaths: (profile && profile.deaths) || 0,
      damageDone: (profile && profile.damage_done) || 0,
      damageTaken: (profile && profile.damage_taken) || 0
    },
    sessionExpiresAt: new Date(expiresAt * 1000).toISOString()
  }, 200, { 'Set-Cookie': setCookie });
}

export async function handleLogout(env, request) {
  const cookieName = env.SESSION_COOKIE_NAME || 'mfa_session';
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sid = cookies[cookieName];

  if (sid) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?1').bind(sid).run();
  }

  const clearCookie = `${cookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });
}

export async function handleMe(env, request) {
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
      displayName: session.displayName,
      profileEnabled: session.profileEnabled,
      kills: session.kills,
      deaths: session.deaths,
      damageDone: session.damageDone,
      damageTaken: session.damageTaken
    },
    sessionExpiresAt: new Date(session.expiresAt * 1000).toISOString()
  });
}
