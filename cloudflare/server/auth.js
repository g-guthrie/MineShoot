import {
  nowMs,
  normalizeUsername,
  validPin,
  validUsername,
  randomId,
  json,
  parseCookies
} from './transport.js';
import { cleanupAccountSocialState } from './social-cleanup.js';
import { consumeRateLimit, getClientIp, rateLimitedJson } from './rate-limit.js';
import { authConfigJson, verifyTurnstile } from './turnstile.js';

const SESSION_TOUCH_INTERVAL_SEC = 300;
const SESSION_NEAR_EXPIRY_SEC = 3600;
const LOGIN_IP_WINDOW_MS = 60_000;
const LOGIN_IP_LIMIT = 12;
const LOGIN_USER_WINDOW_MS = 10 * 60_000;
const LOGIN_USER_LIMIT = 6;

function forwardedProto(request) {
  if (!request || !request.headers) return '';

  const xForwardedProto = String(request.headers.get('x-forwarded-proto') || '').trim();
  if (xForwardedProto) {
    return xForwardedProto.split(',')[0].trim().toLowerCase();
  }

  const forwarded = String(request.headers.get('forwarded') || '').trim();
  if (forwarded) {
    const match = forwarded.match(/(?:^|[;,]\s*)proto=(?:"([^"]+)"|([^;,]+))/i);
    if (match) {
      return String(match[1] || match[2] || '').trim().toLowerCase();
    }
  }

  const cfVisitor = String(request.headers.get('cf-visitor') || '').trim();
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor);
      if (parsed && parsed.scheme) {
        return String(parsed.scheme).trim().toLowerCase();
      }
    } catch (_err) {
      // Ignore malformed proxy metadata and fall back to request.url.
    }
  }

  return '';
}

function secureRequest(request) {
  const proto = forwardedProto(request);
  if (proto === 'https') return true;
  if (proto === 'http') return false;

  try {
    return new URL(request.url).protocol === 'https:';
  } catch (_err) {
    return false;
  }
}

function buildSessionCookie(name, value, request, maxAge) {
  const attrs = [
    `${name}=${encodeURIComponent(String(value || ''))}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${Math.max(0, Number(maxAge) || 0)}`
  ];

  if (secureRequest(request)) {
    attrs.splice(2, 0, 'Secure');
  }

  return attrs.join('; ');
}

export async function getSessionFromRequest(env, request) {
  const cookieName = env.SESSION_COOKIE_NAME || 'mfa_session';
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sid = cookies[cookieName];
  if (!sid) return null;

  const now = Math.floor(nowMs() / 1000);
  const row = await env.DB.prepare(
    `SELECT s.id as session_id, s.user_id, s.expires_at, s.last_seen_at,
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

  const shouldTouchSession =
    Math.max(0, Number(row.last_seen_at || 0)) <= (now - SESSION_TOUCH_INTERVAL_SEC) ||
    (Number(row.expires_at || 0) - now) <= SESSION_NEAR_EXPIRY_SEC;
  if (shouldTouchSession) {
    await env.DB.prepare('UPDATE sessions SET last_seen_at = ?2 WHERE id = ?1').bind(sid, now).run();
  }

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    username: row.username,
    classId: row.class_id || 'ffa',
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
  ).bind(userId, classId || 'ffa').run();
}

export async function handleAuthConfig(env) {
  return authConfigJson(env);
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

  const clientIp = getClientIp(request);
  const ipLimit = consumeRateLimit(env, `auth:login:ip:${clientIp}`, {
    limit: LOGIN_IP_LIMIT,
    windowMs: LOGIN_IP_WINDOW_MS
  });
  if (!ipLimit.ok) {
    return rateLimitedJson(ipLimit.retryAfterSec);
  }
  const userLimit = consumeRateLimit(env, `auth:login:user:${clientIp}:${usernameNorm}`, {
    limit: LOGIN_USER_LIMIT,
    windowMs: LOGIN_USER_WINDOW_MS
  });
  if (!userLimit.ok) {
    return rateLimitedJson(userLimit.retryAfterSec);
  }

  const turnstileCheck = await verifyTurnstile(env, request, body.turnstileToken || '');
  if (!turnstileCheck.ok) {
    return json({ ok: false, error: turnstileCheck.error || 'Security check failed.' }, 400);
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

    await ensureProfileRow(env, userId, 'ffa');

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
  const setCookie = buildSessionCookie(cookieName, sessionId, request, maxAge);

  return json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      classId: (profile && profile.class_id) || 'ffa',
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
  let session = null;

  if (sid) {
    try {
      session = await getSessionFromRequest(env, request);
    } catch (err) {
      if (console && typeof console.warn === 'function') {
        console.warn('[auth] failed to resolve session during logout', {
          sessionId: sid,
          message: err && err.message ? err.message : ''
        });
      }
    }
  }

  if (session && session.userId) {
    try {
      await cleanupAccountSocialState(env, session.userId);
    } catch (err) {
      if (console && typeof console.warn === 'function') {
        console.warn('[auth] social cleanup failed during logout', {
          userId: String(session.userId || ''),
          details: Array.isArray(err && err.details)
            ? err.details.map((detail) => ({
                scope: detail && detail.scope ? detail.scope : '',
                message: detail && detail.error && detail.error.message ? detail.error.message : ''
              }))
            : []
        });
      }
    }
  }

  if (sid) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?1').bind(sid).run();
  }

  const clearCookie = buildSessionCookie(cookieName, '', request, 0);
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
