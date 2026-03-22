import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { handleAuthConfig, handleLogin, handleLogout, handleMe } from '../../cloudflare/server/auth.js';
import { handleFriends } from '../../cloudflare/server/friends.js';
import { handleParty } from '../../cloudflare/server/party.js';
import { handlePrivateRoomLobby } from '../../cloudflare/server/private-room-lobby.js';
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

function authedRequest(sessionId, path, method = 'GET', body = null) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (sessionId) headers.Cookie = `mfa_session=${encodeURIComponent(sessionId)}`;
  return new Request('https://example.test' + path, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
}

function seedAccount(env, suffix, username) {
  const userId = 'usr_' + suffix;
  const sessionId = 'ses_' + suffix;
  const now = Math.floor(Date.now() / 1000);
  env.__state.users.set(userId, {
    id: userId,
    username,
    username_norm: String(username || '').toLowerCase(),
    pin_plain: '1234',
    created_at: now
  });
  env.__state.profiles.set(userId, {
    user_id: userId,
    display_name: username,
    profile_enabled: 1,
    headline: null,
    bio: null,
    class_id: 'abilities',
    kills: 0,
    deaths: 0,
    damage_done: 0,
    damage_taken: 0,
    updated_at: now
  });
  env.__state.sessions.set(sessionId, {
    id: sessionId,
    user_id: userId,
    expires_at: now + 86400,
    created_at: now,
    last_seen_at: now
  });
  return { userId, sessionId, username };
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

test('auth config exposes Turnstile only when configured', async () => {
  const disabledEnv = createFakeEnv();
  const disabledResponse = await handleAuthConfig(disabledEnv);
  const disabledBody = await disabledResponse.json();

  assert.equal(disabledResponse.status, 200);
  assert.deepEqual(disabledBody.turnstile, {
    enabled: false,
    siteKey: ''
  });

  const enabledEnv = createFakeEnv();
  enabledEnv.TURNSTILE_SITE_KEY = 'site-key-demo';
  enabledEnv.TURNSTILE_SECRET_KEY = 'secret-demo';
  const enabledResponse = await handleAuthConfig(enabledEnv);
  const enabledBody = await enabledResponse.json();

  assert.equal(enabledResponse.status, 200);
  assert.deepEqual(enabledBody.turnstile, {
    enabled: true,
    siteKey: 'site-key-demo'
  });
});

test('login rate limits repeated attempts from the same IP and username', async () => {
  const env = createFakeEnv();
  const baseHeaders = { 'cf-connecting-ip': '198.51.100.7' };

  const first = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'RateLimited',
    pin: '1234'
  }, baseHeaders));
  assert.equal(first.status, 200);

  for (let i = 0; i < 5; i++) {
    const retry = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
      username: 'RateLimited',
      pin: '0000'
    }, baseHeaders));
    assert.equal(retry.status, 401);
  }

  const blocked = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'RateLimited',
    pin: '0000'
  }, baseHeaders));
  const blockedBody = await blocked.json();

  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('Retry-After') !== null, true);
  assert.equal(blockedBody.ok, false);
  assert.equal(typeof blockedBody.retryAfterSec, 'number');
});

test('login enforces Turnstile when configured and accepts verified tokens', async () => {
  const originalFetch = globalThis.fetch;
  const env = createFakeEnv();
  env.TURNSTILE_SITE_KEY = 'site-key-demo';
  env.TURNSTILE_SECRET_KEY = 'secret-demo';

  try {
    const missing = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
      username: 'TurnstileUser',
      pin: '1234'
    }));
    assert.equal(missing.status, 400);

    globalThis.fetch = async function mockFetch() {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const verified = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
      username: 'TurnstileUser',
      pin: '1234',
      turnstileToken: 'challenge-token'
    }));

    assert.equal(verified.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('logout removes solo party and private-room membership before revoking session', async () => {
  const env = createFakeEnv();
  const alpha = seedAccount(env, 'logoutsolo', 'ALPHA_SOLO');

  await handleParty(env, authedRequest(alpha.sessionId, '/api/party?activityState=menu', 'GET'));
  await handlePrivateRoomLobby(env, authedRequest(alpha.sessionId, '/api/private-room', 'POST', {
    action: 'create',
    activityState: 'menu'
  }));

  const logoutResponse = await handleLogout(env, authedRequest(alpha.sessionId, '/api/auth/logout', 'POST'));

  assert.equal(logoutResponse.status, 200);
  assert.equal(env.__state.sessions.size, 0);
  assert.equal(env.__state.partyMembers.size, 0);
  assert.equal(env.__state.privateRoomMembers.size, 0);
  assert.equal(env.__state.privateRooms.size, 0);
  assert.equal(env.__state.privateRoomState.size, 0);
  assert.equal(env.__state.partyPresence.size, 0);
});

test('logout reassigns party leadership when other members remain', async () => {
  const env = createFakeEnv();
  const alpha = seedAccount(env, 'leadalpha', 'ALPHA_LEAD');
  const bravo = seedAccount(env, 'leadbravo', 'BRAVO_MEMBER');

  await handleParty(env, authedRequest(alpha.sessionId, '/api/party?activityState=menu', 'GET'));
  await handleParty(env, authedRequest(bravo.sessionId, '/api/party?activityState=menu', 'GET'));
  await handleParty(env, authedRequest(bravo.sessionId, '/api/party', 'POST', {
    action: 'join',
    targetId: alpha.userId
  }));

  const partyId = env.__state.partyMembers.get(alpha.userId).party_id;
  await handleLogout(env, authedRequest(alpha.sessionId, '/api/auth/logout', 'POST'));

  assert.equal(env.__state.partyMembers.has(alpha.userId), false);
  assert.equal(env.__state.partyMembers.get(bravo.userId).party_id, partyId);
  assert.equal(env.__state.parties.get(partyId).leader_id, bravo.userId);
});

test('logout reassigns private-room host when other members remain', async () => {
  const env = createFakeEnv();
  const alpha = seedAccount(env, 'hostalpha', 'ALPHA_HOST');
  const bravo = seedAccount(env, 'hostbravo', 'BRAVO_GUEST');

  await handleParty(env, authedRequest(alpha.sessionId, '/api/party?activityState=menu', 'GET'));
  await handleParty(env, authedRequest(bravo.sessionId, '/api/party?activityState=menu', 'GET'));
  await handleParty(env, authedRequest(bravo.sessionId, '/api/party', 'POST', {
    action: 'join',
    targetId: alpha.userId
  }));

  const created = await handlePrivateRoomLobby(env, authedRequest(alpha.sessionId, '/api/private-room', 'POST', {
    action: 'create',
    activityState: 'menu'
  }));
  const createdBody = await created.json();
  await handlePrivateRoomLobby(env, authedRequest(bravo.sessionId, '/api/private-room', 'POST', {
    action: 'join',
    activityState: 'menu',
    roomCode: createdBody.state.room.roomCode
  }));

  const roomId = env.__state.privateRoomMembers.get(alpha.userId).room_id;
  await handleLogout(env, authedRequest(alpha.sessionId, '/api/auth/logout', 'POST'));

  assert.equal(env.__state.privateRoomMembers.has(alpha.userId), false);
  assert.equal(env.__state.privateRoomMembers.get(bravo.userId).room_id, roomId);
  assert.equal(env.__state.privateRoomState.get(roomId).host_actor_id, bravo.userId);
});

test('logout clears presence immediately so friends no longer see the actor as online or joinable', async () => {
  const env = createFakeEnv();
  const alpha = seedAccount(env, 'friendalpha', 'ALPHA_FRIEND');
  const bravo = seedAccount(env, 'friendbravo', 'BRAVO_FRIEND');

  await handleParty(env, authedRequest(alpha.sessionId, '/api/party?activityState=menu', 'GET'));
  await handleParty(env, authedRequest(bravo.sessionId, '/api/party?activityState=menu', 'GET'));
  await handleFriends(env, authedRequest(alpha.sessionId, '/api/friends', 'POST', {
    action: 'add',
    targetUserId: bravo.userId
  }));
  await handleFriends(env, authedRequest(bravo.sessionId, '/api/friends', 'POST', {
    action: 'add',
    targetUserId: alpha.userId
  }));

  const beforeLogout = await handleFriends(env, authedRequest(bravo.sessionId, '/api/friends', 'GET'));
  const beforeBody = await beforeLogout.json();
  assert.equal(beforeBody.friends.friends[0].online, true);
  assert.equal(beforeBody.friends.friends[0].canJoin, true);

  await handleLogout(env, authedRequest(alpha.sessionId, '/api/auth/logout', 'POST'));

  const afterLogout = await handleFriends(env, authedRequest(bravo.sessionId, '/api/friends', 'GET'));
  const afterBody = await afterLogout.json();
  assert.equal(afterBody.friends.friends[0].userId, alpha.userId);
  assert.equal(afterBody.friends.friends[0].online, false);
  assert.equal(afterBody.friends.friends[0].canJoin, false);
});
