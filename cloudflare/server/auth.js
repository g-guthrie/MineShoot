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
import {
  checkDurableLoginLimit,
  clearLoginFailures,
  consumeRateLimit,
  getClientIp,
  rateLimitedJson,
  recordLoginFailure
} from './rate-limit.js';
import { authConfigJson, verifyTurnstile } from './turnstile.js';

const SESSION_TOUCH_INTERVAL_SEC = 300;
const SESSION_NEAR_EXPIRY_SEC = 3600;
const LOGIN_IP_WINDOW_MS = 60_000;
const LOGIN_IP_LIMIT = 12;
const LOGIN_USER_WINDOW_MS = 10 * 60_000;
const LOGIN_USER_LIMIT = 6;
const PIN_PBKDF2_ITERATIONS = 100_000;
const PIN_PBKDF2_HASH_BITS = 256;
const PIN_SALT_BYTES = 16;

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function constantTimeEqualBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function constantTimeEqualStrings(a, b) {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(String(a || ''));
  const bBytes = encoder.encode(String(b || ''));
  if (aBytes.length !== bBytes.length) return false;
  return constantTimeEqualBytes(aBytes, bBytes);
}

async function derivePinBits(pin, saltBytes, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(pin || '')),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations: Math.max(1, Number(iterations) || PIN_PBKDF2_ITERATIONS)
    },
    key,
    PIN_PBKDF2_HASH_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(PIN_SALT_BYTES));
  const derived = await derivePinBits(pin, salt, PIN_PBKDF2_ITERATIONS);
  return {
    pinHash: `pbkdf2-sha256$${PIN_PBKDF2_ITERATIONS}$${bytesToBase64(derived)}`,
    pinSalt: bytesToBase64(salt)
  };
}

export async function verifyPin(pin, pinHash, pinSalt) {
  const hashValue = String(pinHash || '');
  const saltValue = String(pinSalt || '');
  if (!hashValue || !saltValue) return false;

  let iterations = PIN_PBKDF2_ITERATIONS;
  let encodedHash = hashValue;
  const parts = hashValue.split('$');
  if (parts.length === 3) {
    if (parts[0] !== 'pbkdf2-sha256') return false;
    iterations = Math.max(1, Number(parts[1]) || PIN_PBKDF2_ITERATIONS);
    encodedHash = parts[2];
  } else if (parts.length !== 1) {
    return false;
  }

  let expected;
  let salt;
  try {
    expected = base64ToBytes(encodedHash);
    salt = base64ToBytes(saltValue);
  } catch (_err) {
    return false;
  }
  if (!expected.length || !salt.length) return false;

  const derived = await derivePinBits(pin, salt, iterations);
  return constantTimeEqualBytes(derived, expected);
}

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

  // Durable (D1-backed) lockout: the in-memory limiter above is per-isolate
  // and resets whenever a new isolate spins up, so it can be bypassed.
  const durableLoginKey = `login:user:${usernameNorm}`;
  const durableLoginWindowSec = Math.floor(LOGIN_USER_WINDOW_MS / 1000);
  const durableLimit = await checkDurableLoginLimit(env, durableLoginKey, {
    limit: LOGIN_USER_LIMIT,
    windowSec: durableLoginWindowSec
  });
  if (!durableLimit.ok) {
    return rateLimitedJson(durableLimit.retryAfterSec, 'Too many failed login attempts. Try again later.');
  }

  const turnstileCheck = await verifyTurnstile(env, request, body.turnstileToken || '');
  if (!turnstileCheck.ok) {
    return json({ ok: false, error: turnstileCheck.error || 'Security check failed.' }, 400);
  }

  const now = Math.floor(nowMs() / 1000);
  let user = await env.DB.prepare(
    'SELECT id, username, pin_plain, pin_hash, pin_salt FROM users WHERE username_norm = ?1'
  ).bind(usernameNorm).first();

  if (!user) {
    const userId = randomId('usr');
    const { pinHash, pinSalt } = await hashPin(pin);
    await env.DB.prepare(
      'INSERT INTO users (id, username, username_norm, pin_plain, pin_hash, pin_salt, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
    ).bind(userId, usernameRaw, usernameNorm, '', pinHash, pinSalt, now).run();

    await ensureProfileRow(env, userId, 'ffa');

    user = { id: userId, username: usernameRaw, pin_hash: pinHash, pin_salt: pinSalt };
  } else {
    let pinValid = false;
    if (user.pin_hash && user.pin_salt) {
      pinValid = await verifyPin(pin, user.pin_hash, user.pin_salt);
    } else if (typeof user.pin_plain === 'string' && user.pin_plain.length) {
      // Legacy row: verify against the plaintext PIN, then upgrade in place so
      // the plaintext copy is destroyed on the first successful login.
      pinValid = constantTimeEqualStrings(user.pin_plain, pin);
      if (pinValid) {
        const { pinHash, pinSalt } = await hashPin(pin);
        await env.DB.prepare(
          "UPDATE users SET pin_hash = ?2, pin_salt = ?3, pin_plain = '' WHERE id = ?1"
        ).bind(user.id, pinHash, pinSalt).run();
      }
    }
    if (!pinValid) {
      await recordLoginFailure(env, durableLoginKey, { windowSec: durableLoginWindowSec });
      return json({ ok: false, error: 'Incorrect PIN.' }, 401);
    }
  }

  await clearLoginFailures(env, durableLoginKey);

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
