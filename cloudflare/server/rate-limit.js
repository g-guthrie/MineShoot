import { json } from './transport.js';

const DEFAULT_CACHE_MAX = 20000;

function rateLimitStore(env) {
  if (!env) return new Map();
  if (!Object.prototype.hasOwnProperty.call(env, '__mayhemRateLimits')) {
    Object.defineProperty(env, '__mayhemRateLimits', {
      value: new Map(),
      configurable: true,
      enumerable: false,
      writable: false
    });
  }
  return env.__mayhemRateLimits;
}

function pruneStore(store, nowMs, windowMs, cacheMax) {
  if (!(store instanceof Map) || store.size <= cacheMax) return;
  for (const [key, entry] of store.entries()) {
    if (!entry || (nowMs - Number(entry.windowStartedAt || 0)) > windowMs) {
      store.delete(key);
    }
  }
  if (store.size <= cacheMax) return;
  const orderedKeys = Array.from(store.keys());
  for (let i = 0; i < orderedKeys.length && store.size > cacheMax; i++) {
    store.delete(orderedKeys[i]);
  }
}

export function getClientIp(request) {
  if (!request || !request.headers) return 'unknown';
  const cfIp = String(request.headers.get('cf-connecting-ip') || '').trim();
  if (cfIp) return cfIp;
  const forwarded = String(request.headers.get('x-forwarded-for') || '').trim();
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = String(request.headers.get('x-real-ip') || '').trim();
  if (realIp) return realIp;
  return 'unknown';
}

export function consumeRateLimit(env, key, options = {}) {
  const limit = Math.max(1, Number(options.limit || 1));
  const windowMs = Math.max(1000, Number(options.windowMs || 60000));
  const now = Math.max(0, Number(options.nowMs || Date.now()));
  const cacheMax = Math.max(1000, Number(options.cacheMax || DEFAULT_CACHE_MAX));
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return { ok: true, retryAfterSec: 0, count: 0 };

  const store = rateLimitStore(env);
  let entry = store.get(normalizedKey);
  if (!entry || (now - Number(entry.windowStartedAt || 0)) >= windowMs) {
    entry = {
      windowStartedAt: now,
      count: 0
    };
    store.set(normalizedKey, entry);
  }

  entry.count = Math.max(0, Number(entry.count || 0)) + 1;
  store.set(normalizedKey, entry);
  pruneStore(store, now, windowMs, cacheMax);

  if (entry.count <= limit) {
    return {
      ok: true,
      retryAfterSec: 0,
      count: entry.count
    };
  }

  const retryAfterSec = Math.max(1, Math.ceil((windowMs - Math.max(0, now - entry.windowStartedAt)) / 1000));
  return {
    ok: false,
    retryAfterSec,
    count: entry.count
  };
}

const loginAttemptsEnsuredByEnv = new WeakMap();

async function ensureLoginAttemptsTable(env) {
  if (!env || !env.DB) return;
  let promise = loginAttemptsEnsuredByEnv.get(env);
  if (!promise) {
    promise = env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS login_attempts (
         attempt_key TEXT PRIMARY KEY,
         fail_count INTEGER NOT NULL DEFAULT 0,
         window_started_at INTEGER NOT NULL DEFAULT 0
       )`
    ).run().catch((err) => {
      loginAttemptsEnsuredByEnv.delete(env);
      throw err;
    });
    loginAttemptsEnsuredByEnv.set(env, promise);
  }
  await promise;
}

function durableNowSec(options) {
  const explicit = Number(options && options.nowSec);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  return Math.floor(Date.now() / 1000);
}

/**
 * Durable (D1-backed) failure limiter for the login route. Unlike
 * consumeRateLimit, this survives isolate recycling so it cannot be bypassed
 * by spraying requests across colos/isolates. Failures are recorded with
 * recordLoginFailure and cleared with clearLoginFailures; this check blocks
 * once `limit` failures landed inside the current window.
 */
export async function checkDurableLoginLimit(env, key, options = {}) {
  const normalizedKey = String(key || '').trim();
  if (!env || !env.DB || !normalizedKey) return { ok: true, retryAfterSec: 0, failCount: 0 };
  const limit = Math.max(1, Number(options.limit || 1));
  const windowSec = Math.max(1, Number(options.windowSec || 600));
  const now = durableNowSec(options);

  try {
    await ensureLoginAttemptsTable(env);
    const row = await env.DB.prepare(
      'SELECT attempt_key, fail_count, window_started_at FROM login_attempts WHERE attempt_key = ?1'
    ).bind(normalizedKey).first();
    if (!row) return { ok: true, retryAfterSec: 0, failCount: 0 };

    const windowStartedAt = Math.max(0, Number(row.window_started_at || 0));
    const failCount = Math.max(0, Number(row.fail_count || 0));
    if ((now - windowStartedAt) >= windowSec) {
      return { ok: true, retryAfterSec: 0, failCount: 0 };
    }
    if (failCount < limit) {
      return { ok: true, retryAfterSec: 0, failCount };
    }
    const retryAfterSec = Math.max(1, windowSec - Math.max(0, now - windowStartedAt));
    return { ok: false, retryAfterSec, failCount };
  } catch (_err) {
    // Fail open: a storage error must not lock everyone out of login.
    return { ok: true, retryAfterSec: 0, failCount: 0 };
  }
}

export async function recordLoginFailure(env, key, options = {}) {
  const normalizedKey = String(key || '').trim();
  if (!env || !env.DB || !normalizedKey) return;
  const windowSec = Math.max(1, Number(options.windowSec || 600));
  const now = durableNowSec(options);

  try {
    await ensureLoginAttemptsTable(env);
    const row = await env.DB.prepare(
      'SELECT attempt_key, fail_count, window_started_at FROM login_attempts WHERE attempt_key = ?1'
    ).bind(normalizedKey).first();

    const stale = !row || (now - Math.max(0, Number(row.window_started_at || 0))) >= windowSec;
    const nextCount = stale ? 1 : Math.max(0, Number(row.fail_count || 0)) + 1;
    const nextWindowStartedAt = stale ? now : Math.max(0, Number(row.window_started_at || 0));

    await env.DB.prepare(
      `INSERT INTO login_attempts (attempt_key, fail_count, window_started_at)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(attempt_key) DO UPDATE SET
         fail_count = excluded.fail_count,
         window_started_at = excluded.window_started_at`
    ).bind(normalizedKey, nextCount, nextWindowStartedAt).run();
  } catch (_err) {
    // Best effort: failure tracking must not break the login flow itself.
  }
}

export async function clearLoginFailures(env, key) {
  const normalizedKey = String(key || '').trim();
  if (!env || !env.DB || !normalizedKey) return;
  try {
    await ensureLoginAttemptsTable(env);
    await env.DB.prepare(
      'DELETE FROM login_attempts WHERE attempt_key = ?1'
    ).bind(normalizedKey).run();
  } catch (_err) {
    // Best effort.
  }
}

export function rateLimitedJson(retryAfterSec, message = 'Rate limited.') {
  const retry = Math.max(1, Number(retryAfterSec || 1));
  return json({
    ok: false,
    error: String(message || 'Rate limited.'),
    retryAfterSec: retry
  }, 429, {
    'Retry-After': String(retry)
  });
}

