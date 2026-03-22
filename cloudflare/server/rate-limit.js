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

