import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { handleLogin, handleLogout, handleMe } from '../../cloudflare/server/auth.js';
import { createFakeEnv } from '../helpers/fake-d1.js';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

function jsonRequest(url, body, headers) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {})
    },
    body: JSON.stringify(body || {})
  });
}

function cookieHeader(setCookie) {
  return String(setCookie || '').split(';')[0] || '';
}

test('login creates a session cookie that works over local http without Secure', async () => {
  const env = createFakeEnv();

  const loginResponse = await handleLogin(env, jsonRequest('http://127.0.0.1:8787/api/auth/login', {
    username: 'AlphaAuth',
    pin: '1234'
  }));
  const loginBody = await loginResponse.json();
  const setCookie = loginResponse.headers.get('Set-Cookie');

  assert.equal(loginResponse.status, 200);
  assert.equal(loginBody.ok, true);
  assert.match(String(setCookie || ''), /^mfa_session=ses_/);
  assert.doesNotMatch(String(setCookie || ''), /;\s*Secure(?:;|$)/i);

  const meResponse = await handleMe(env, new Request('http://127.0.0.1:8787/api/me', {
    headers: { Cookie: cookieHeader(setCookie) }
  }));
  const meBody = await meResponse.json();

  assert.equal(meResponse.status, 200);
  assert.equal(meBody.user.username, 'AlphaAuth');

  const logoutResponse = await handleLogout(env, new Request('http://127.0.0.1:8787/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookieHeader(setCookie) }
  }));

  assert.equal(logoutResponse.status, 200);
  assert.match(String(logoutResponse.headers.get('Set-Cookie') || ''), /Max-Age=0/);
  assert.doesNotMatch(String(logoutResponse.headers.get('Set-Cookie') || ''), /;\s*Secure(?:;|$)/i);

  const unauthorizedResponse = await handleMe(env, new Request('http://127.0.0.1:8787/api/me', {
    headers: { Cookie: cookieHeader(setCookie) }
  }));

  assert.equal(unauthorizedResponse.status, 401);
});

test('login marks the session cookie Secure for https requests and proxy-forwarded https', async () => {
  const directEnv = createFakeEnv();
  const directResponse = await handleLogin(directEnv, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'BravoAuth',
    pin: '5678'
  }));

  assert.match(String(directResponse.headers.get('Set-Cookie') || ''), /;\s*Secure(?:;|$)/i);

  const proxiedEnv = createFakeEnv();
  const proxiedResponse = await handleLogin(proxiedEnv, jsonRequest('http://internal-worker/api/auth/login', {
    username: 'CharlieAuth',
    pin: '2468'
  }, {
    'x-forwarded-proto': 'https'
  }));

  assert.match(String(proxiedResponse.headers.get('Set-Cookie') || ''), /;\s*Secure(?:;|$)/i);
});
