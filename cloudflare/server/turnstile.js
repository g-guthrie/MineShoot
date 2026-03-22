import { json } from './transport.js';
import { getClientIp } from './rate-limit.js';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileEnabled(env) {
  return !!(
    env &&
    String(env.TURNSTILE_SECRET_KEY || '').trim() &&
    String(env.TURNSTILE_SITE_KEY || '').trim()
  );
}

export async function verifyTurnstile(env, request, token) {
  if (!turnstileEnabled(env)) {
    return { ok: true, enabled: false };
  }

  const responseToken = String(token || '').trim();
  if (!responseToken) {
    return { ok: false, enabled: true, error: 'Complete the security check.' };
  }

  const body = new URLSearchParams();
  body.set('secret', String(env.TURNSTILE_SECRET_KEY || '').trim());
  body.set('response', responseToken);
  const clientIp = getClientIp(request);
  if (clientIp && clientIp !== 'unknown') {
    body.set('remoteip', clientIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    const payload = await response.json().catch(() => null);
    if (payload && payload.success === true) {
      return { ok: true, enabled: true };
    }
  } catch (_err) {
    // Fall through to a generic failure result.
  }

  return { ok: false, enabled: true, error: 'Security check failed.' };
}

export function authConfigJson(env) {
  const enabled = turnstileEnabled(env);
  return json({
    ok: true,
    turnstile: {
      enabled,
      siteKey: enabled ? String(env.TURNSTILE_SITE_KEY || '').trim() : ''
    }
  });
}

