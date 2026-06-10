import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { handleLogin, hashPin, verifyPin } from '../../cloudflare/server/auth.js';
import {
  checkDurableLoginLimit,
  clearLoginFailures,
  recordLoginFailure
} from '../../cloudflare/server/rate-limit.js';
import { mintGuestToken, verifyGuestToken } from '../../cloudflare/server/ws-identity.js';
import { handleWsUpgrade } from '../../cloudflare/server/ws-upgrade.js';
import { handleWsLobbyUpgrade } from '../../cloudflare/server/ws-lobby-upgrade.js';
import { handleParty } from '../../cloudflare/server/party.js';
import { handleRoomRequest } from '../../cloudflare/server/room/RoomTransport.js';
import { createFakeEnv } from '../helpers/fake-d1.js';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const GUEST_SECRET = 'unit-test-guest-secret';

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

function seedLegacyUser(env, suffix, username, pin) {
  const userId = 'usr_' + suffix;
  const now = Math.floor(Date.now() / 1000);
  env.__state.users.set(userId, {
    id: userId,
    username,
    username_norm: String(username || '').toLowerCase(),
    pin_plain: String(pin || '1234'),
    created_at: now
  });
  return userId;
}

// --- Finding 1: PIN hashing ------------------------------------------------

test('hashPin/verifyPin round trip accepts the right PIN and rejects others', async () => {
  const { pinHash, pinSalt } = await hashPin('4321');

  assert.match(pinHash, /^pbkdf2-sha256\$100000\$/);
  assert.notEqual(pinHash.indexOf('4321'), 1, 'hash must not embed the PIN');
  assert.equal(await verifyPin('4321', pinHash, pinSalt), true);
  assert.equal(await verifyPin('4320', pinHash, pinSalt), false);
  assert.equal(await verifyPin('4321', pinHash, ''), false);
  assert.equal(await verifyPin('4321', '', pinSalt), false);
  assert.equal(await verifyPin('4321', 'not-base64!!$broken', pinSalt), false);

  const second = await hashPin('4321');
  assert.notEqual(second.pinSalt, pinSalt, 'salts must be random per hash');
  assert.notEqual(second.pinHash, pinHash, 'same PIN must hash differently per salt');
});

test('signup stores a PBKDF2 hash and never the plaintext PIN', async () => {
  const env = createFakeEnv();

  const signupResponse = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'HashedSignup',
    pin: '9876'
  }));
  assert.equal(signupResponse.status, 200);

  const row = Array.from(env.__state.users.values()).find((user) => user.username === 'HashedSignup');
  assert.ok(row, 'user row exists');
  assert.equal(row.pin_plain, '', 'plaintext PIN is not stored');
  assert.match(String(row.pin_hash || ''), /^pbkdf2-sha256\$/);
  assert.ok(String(row.pin_salt || '').length > 0);

  const goodLogin = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'HashedSignup',
    pin: '9876'
  }, { 'cf-connecting-ip': '203.0.113.10' }));
  assert.equal(goodLogin.status, 200);

  const badLogin = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'HashedSignup',
    pin: '0000'
  }, { 'cf-connecting-ip': '203.0.113.11' }));
  assert.equal(badLogin.status, 401);
});

test('legacy plaintext rows verify once and are upgraded to hashes in place', async () => {
  const env = createFakeEnv();
  const userId = seedLegacyUser(env, 'legacy_pin', 'LegacyPin', '1234');

  const wrongPin = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'LegacyPin',
    pin: '9999'
  }, { 'cf-connecting-ip': '203.0.113.20' }));
  assert.equal(wrongPin.status, 401);
  assert.equal(env.__state.users.get(userId).pin_plain, '1234', 'failed login must not upgrade');

  const goodLogin = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'LegacyPin',
    pin: '1234'
  }, { 'cf-connecting-ip': '203.0.113.21' }));
  assert.equal(goodLogin.status, 200);

  const upgraded = env.__state.users.get(userId);
  assert.equal(upgraded.pin_plain, '', 'plaintext PIN destroyed after upgrade');
  assert.match(String(upgraded.pin_hash || ''), /^pbkdf2-sha256\$/);
  assert.ok(String(upgraded.pin_salt || '').length > 0);

  const hashedLogin = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'LegacyPin',
    pin: '1234'
  }, { 'cf-connecting-ip': '203.0.113.22' }));
  assert.equal(hashedLogin.status, 200);

  const hashedReject = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'LegacyPin',
    pin: '4321'
  }, { 'cf-connecting-ip': '203.0.113.23' }));
  assert.equal(hashedReject.status, 401);
});

// --- Finding 2: durable login lockout ---------------------------------------

test('durable login limit primitives track failures across windows', async () => {
  const env = createFakeEnv();
  const key = 'login:user:durable';

  let check = await checkDurableLoginLimit(env, key, { limit: 3, windowSec: 600, nowSec: 1000 });
  assert.equal(check.ok, true);

  for (let i = 0; i < 3; i++) {
    await recordLoginFailure(env, key, { windowSec: 600, nowSec: 1000 + i });
  }

  check = await checkDurableLoginLimit(env, key, { limit: 3, windowSec: 600, nowSec: 1010 });
  assert.equal(check.ok, false);
  assert.ok(check.retryAfterSec >= 1);

  // A fresh window clears the lockout even without an explicit reset.
  check = await checkDurableLoginLimit(env, key, { limit: 3, windowSec: 600, nowSec: 1000 + 600 });
  assert.equal(check.ok, true);

  // A success-side reset clears it immediately.
  await recordLoginFailure(env, key, { windowSec: 600, nowSec: 2000 });
  await clearLoginFailures(env, key);
  check = await checkDurableLoginLimit(env, key, { limit: 1, windowSec: 600, nowSec: 2001 });
  assert.equal(check.ok, true);
});

test('login locks out after repeated failures even when each attempt uses a new IP', async () => {
  const env = createFakeEnv();
  seedLegacyUser(env, 'lockout', 'LockoutUser', '1234');

  // Distinct IPs keep the per-isolate in-memory limiter quiet, proving the
  // D1-backed limiter is what blocks the attack.
  for (let i = 0; i < 6; i++) {
    const failed = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
      username: 'LockoutUser',
      pin: '0000'
    }, { 'cf-connecting-ip': `198.51.100.${i + 1}` }));
    assert.equal(failed.status, 401);
  }

  const blocked = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'LockoutUser',
    pin: '1234'
  }, { 'cf-connecting-ip': '198.51.100.99' }));
  const blockedBody = await blocked.json();

  assert.equal(blocked.status, 429);
  assert.equal(blockedBody.ok, false);
  assert.ok(Number(blockedBody.retryAfterSec) >= 1);

  // Other usernames are unaffected by the lockout key.
  const other = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'SomeoneElse',
    pin: '1234'
  }, { 'cf-connecting-ip': '198.51.100.100' }));
  assert.equal(other.status, 200);
});

test('successful login clears the durable failure counter', async () => {
  const env = createFakeEnv();
  seedLegacyUser(env, 'reset', 'ResetUser', '1234');

  for (let i = 0; i < 5; i++) {
    const failed = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
      username: 'ResetUser',
      pin: '0000'
    }, { 'cf-connecting-ip': `192.0.2.${i + 1}` }));
    assert.equal(failed.status, 401);
  }

  const success = await handleLogin(env, jsonRequest('https://mayhem.example/api/auth/login', {
    username: 'ResetUser',
    pin: '1234'
  }, { 'cf-connecting-ip': '192.0.2.50' }));
  assert.equal(success.status, 200);
  assert.equal(env.__state.loginAttempts.size, 0, 'durable counter cleared on success');
});

// --- Finding 3: signed guest identity ---------------------------------------

test('guest tokens verify only with the right secret and untampered payload', async () => {
  const token = await mintGuestToken(GUEST_SECRET, 'amber-otter-314');
  assert.ok(token.startsWith('v1.amber-otter-314.'));

  assert.equal(await verifyGuestToken(GUEST_SECRET, token), 'amber-otter-314');
  assert.equal(await verifyGuestToken('other-secret', token), '');
  assert.equal(await verifyGuestToken(GUEST_SECRET, ''), '');
  assert.equal(await verifyGuestToken(GUEST_SECRET, 'v1.amber-otter-314.bogus-signature'), '');

  // Swapping the actorId inside a valid token must fail verification.
  const swapped = token.replace('amber-otter-314', 'amber-otter-315');
  assert.equal(await verifyGuestToken(GUEST_SECRET, swapped), '');

  // No secret configured -> tokens can be neither minted nor verified.
  assert.equal(await mintGuestToken('', 'amber-otter-314'), '');
  assert.equal(await verifyGuestToken('', token), '');
});

function seedPrivateRoom(env, roomId, hostActorId, memberActorIds) {
  const now = Math.floor(Date.now() / 1000);
  env.__state.privateRooms.set(roomId, {
    room_id: roomId,
    room_code: 'CODE66',
    creator_user_id: '',
    created_at: now,
    last_used_at: now
  });
  env.__state.privateRoomState.set(roomId, {
    room_id: roomId,
    room_mode: 'ffa',
    room_phase: 'lobby',
    host_actor_id: hostActorId,
    invite_locked: 1,
    created_at: now,
    updated_at: now,
    team_count: 2
  });
  for (const actorId of memberActorIds) {
    env.__state.privateRoomMembers.set(actorId, {
      actor_id: actorId,
      room_id: roomId,
      display_name: actorId.toUpperCase(),
      team_id: 'alpha',
      joined_at: now
    });
  }
}

function arenaCapture(env) {
  const captured = { url: '', headers: null };
  env.GLOBAL_ARENA = {
    idFromName(roomId) { return 'room:' + String(roomId || ''); },
    get() {
      return {
        fetch(request) {
          captured.url = request.url;
          captured.headers = request.headers;
          return Promise.resolve(new Response(null, { status: 200 }));
        }
      };
    }
  };
  return captured;
}

test('private-room ws admission requires a valid guest token when a secret is configured', async () => {
  const env = createFakeEnv();
  env.GUEST_TOKEN_SECRET = GUEST_SECRET;
  const roomId = 'private-tokenroom';
  seedPrivateRoom(env, roomId, 'amber-otter-314', ['amber-otter-314']);
  const captured = arenaCapture(env);

  // Impersonation attempt: knows the victim's actorId but has no token.
  const denied = await handleWsUpgrade(env, new Request(
    `https://example.test/api/ws?room=${roomId}&actorId=amber-otter-314&pid=amber-otter-314&username=EVIL`,
    { method: 'GET', headers: { Upgrade: 'websocket' } }
  ), { ffa: {} });
  assert.equal(denied.status, 403);

  // Same actorId with a valid server-issued token is admitted.
  const token = await mintGuestToken(GUEST_SECRET, 'amber-otter-314');
  const admitted = await handleWsUpgrade(env, new Request(
    `https://example.test/api/ws?room=${roomId}&actorId=amber-otter-314&pid=amber-otter-314&username=ALPHA&guestToken=${encodeURIComponent(token)}`,
    { method: 'GET', headers: { Upgrade: 'websocket' } }
  ), { ffa: {} });
  assert.equal(admitted.status, 200);
  assert.ok(captured.url.includes('actorId=' + encodeURIComponent('amber-otter-314')));

  // The token also works when delivered via the guest cookie.
  const cookieAdmitted = await handleWsUpgrade(env, new Request(
    `https://example.test/api/ws?room=${roomId}&actorId=amber-otter-314&pid=amber-otter-314&username=ALPHA`,
    {
      method: 'GET',
      headers: {
        Upgrade: 'websocket',
        Cookie: `mfa_guest=${encodeURIComponent(token)}`
      }
    }
  ), { ffa: {} });
  assert.equal(cookieAdmitted.status, 200);

  // A token for a different guest does not grant access to the member's room.
  const wrongToken = await mintGuestToken(GUEST_SECRET, 'frozen-wolf-001');
  const wrongGuest = await handleWsUpgrade(env, new Request(
    `https://example.test/api/ws?room=${roomId}&actorId=amber-otter-314&username=EVIL&guestToken=${encodeURIComponent(wrongToken)}`,
    { method: 'GET', headers: { Upgrade: 'websocket' } }
  ), { ffa: {} });
  assert.equal(wrongGuest.status, 403);
});

test('public arena guest play still works without a guest token', async () => {
  const env = createFakeEnv();
  env.GUEST_TOKEN_SECRET = GUEST_SECRET;
  const captured = arenaCapture(env);

  const response = await handleWsUpgrade(env, new Request(
    'https://example.test/api/ws?room=global&pid=usr_guest_socket_01&uid=amber-otter-314&username=ALPHA',
    { method: 'GET', headers: { Upgrade: 'websocket' } }
  ), { ffa: {} });

  assert.equal(response.status, 200);
  assert.ok(captured.url.includes('userId=' + encodeURIComponent('usr_guest_socket_01')));
  // The unverified actorId is not forwarded as a trusted identity.
  assert.ok(!captured.url.includes('actorId='));
});

function lobbyHubCapture(env) {
  const captured = { url: '', headers: null };
  env.PRIVATE_ROOM_LOBBY_HUB = {
    idFromName(roomId) { return 'lobby:' + String(roomId || ''); },
    get() {
      return {
        fetch(request) {
          captured.url = request.url;
          captured.headers = request.headers;
          return Promise.resolve(new Response(null, { status: 200 }));
        }
      };
    }
  };
  return captured;
}

test('lobby ws observation requires a valid guest token when a secret is configured', async () => {
  const env = createFakeEnv();
  env.GUEST_TOKEN_SECRET = GUEST_SECRET;
  const roomId = 'private-lobbyroom';
  seedPrivateRoom(env, roomId, 'amber-otter-314', ['amber-otter-314']);
  const captured = lobbyHubCapture(env);

  // Impersonation attempt: knows the member's actorId but has no token, so
  // the connection is treated as a fresh anonymous guest with no identity.
  const denied = await handleWsLobbyUpgrade(env, new Request(
    `https://example.test/api/ws-lobby?room=${roomId}&actorId=amber-otter-314`,
    { method: 'GET', headers: { Upgrade: 'websocket' } }
  ));
  assert.equal(denied.status, 400);

  // Same actorId with a valid server-issued token via query param is admitted.
  const token = await mintGuestToken(GUEST_SECRET, 'amber-otter-314');
  const admitted = await handleWsLobbyUpgrade(env, new Request(
    `https://example.test/api/ws-lobby?room=${roomId}&actorId=amber-otter-314&guestToken=${encodeURIComponent(token)}`,
    { method: 'GET', headers: { Upgrade: 'websocket' } }
  ));
  assert.equal(admitted.status, 200);
  assert.ok(captured.url.includes('actorId=' + encodeURIComponent('amber-otter-314')));

  // The token also works when delivered via the guest cookie.
  const cookieAdmitted = await handleWsLobbyUpgrade(env, new Request(
    `https://example.test/api/ws-lobby?room=${roomId}&actorId=amber-otter-314`,
    {
      method: 'GET',
      headers: {
        Upgrade: 'websocket',
        Cookie: `mfa_guest=${encodeURIComponent(token)}`
      }
    }
  ));
  assert.equal(cookieAdmitted.status, 200);

  // A valid token for a different guest does not grant access to the
  // member's lobby: the verified identity is not a member of the room.
  const wrongToken = await mintGuestToken(GUEST_SECRET, 'frozen-wolf-001');
  const wrongGuest = await handleWsLobbyUpgrade(env, new Request(
    `https://example.test/api/ws-lobby?room=${roomId}&actorId=amber-otter-314&guestToken=${encodeURIComponent(wrongToken)}`,
    { method: 'GET', headers: { Upgrade: 'websocket' } }
  ));
  assert.equal(wrongGuest.status, 403);
});

test('lobby ws keeps the legacy trust model when no secret is configured', async () => {
  const env = createFakeEnv();
  const roomId = 'private-lobbylegacy';
  seedPrivateRoom(env, roomId, 'amber-otter-314', ['amber-otter-314']);
  const captured = lobbyHubCapture(env);

  const response = await handleWsLobbyUpgrade(env, new Request(
    `https://example.test/api/ws-lobby?room=${roomId}&actorId=amber-otter-314`,
    { method: 'GET', headers: { Upgrade: 'websocket' } }
  ));
  assert.equal(response.status, 200);
  assert.ok(captured.url.includes('actorId=' + encodeURIComponent('amber-otter-314')));
});

test('party guest identity is bound to the issued token instead of the claimed actorId', async () => {
  const env = createFakeEnv();
  env.GUEST_TOKEN_SECRET = GUEST_SECRET;

  // First contact with an unclaimed actorId: accepted and a token cookie issued.
  const first = await handleParty(env, jsonRequest('https://mayhem.example/api/party', {
    action: 'leave',
    actorId: 'amber-otter-314',
    displayName: 'AMBER-OTTER-314'
  }));
  const firstBody = await first.json();
  const setCookie = String(first.headers.get('Set-Cookie') || '');

  assert.equal(first.status, 200);
  assert.equal(firstBody.state.self.id, 'amber-otter-314');
  assert.match(setCookie, /^mfa_guest=v1\.amber-otter-314\./);
  assert.match(setCookie, /HttpOnly/);

  const token = decodeURIComponent(setCookie.split(';')[0].split('=').slice(1).join('='));
  assert.equal(await verifyGuestToken(GUEST_SECRET, token), 'amber-otter-314');

  // An impersonator claiming the now-known actorId without the token is
  // treated as a brand-new anonymous guest with a different id.
  const impersonator = await handleParty(env, jsonRequest('https://mayhem.example/api/party', {
    action: 'leave',
    actorId: 'amber-otter-314',
    displayName: 'EVIL-TWIN'
  }));
  const impersonatorBody = await impersonator.json();
  assert.equal(impersonator.status, 200);
  assert.notEqual(impersonatorBody.state.self.id, 'amber-otter-314');

  // The legitimate guest keeps their identity by presenting the token cookie.
  const returning = await handleParty(env, new Request('https://mayhem.example/api/party?activityState=menu&actorId=amber-otter-314&displayName=AMBER-OTTER-314', {
    method: 'GET',
    headers: { Cookie: `mfa_guest=${encodeURIComponent(token)}` }
  }));
  const returningBody = await returning.json();
  assert.equal(returning.status, 200);
  assert.equal(returningBody.state.self.id, 'amber-otter-314');
});

test('party guest identity keeps the legacy trust model when no secret is configured', async () => {
  const env = createFakeEnv();

  const response = await handleParty(env, jsonRequest('https://mayhem.example/api/party', {
    action: 'leave',
    actorId: 'amber-otter-314',
    displayName: 'AMBER-OTTER-314'
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.state.self.id, 'amber-otter-314');
  assert.equal(response.headers.get('Set-Cookie'), null);
});

// --- Finding 4: /private-config ownership -----------------------------------

function makeConfigRoom(env, roomId) {
  const applied = [];
  return {
    applied,
    room: {
      env,
      roomName: roomId,
      gameMode: 'ffa',
      matchState: { started: false, ended: false },
      worldCollision: {},
      terrainSampler: {},
      refreshWorldMeta() {},
      applyPrivateRoomConfig(config) { applied.push(config); },
      humanPlayerCount() { return 0; },
      connectedHumanCount() { return 0; },
      simulatedPlayerCount() { return 0; }
    }
  };
}

test('private-config rejects payloads whose host does not match the registered room owner', async () => {
  const env = createFakeEnv();
  const roomId = 'private-cfgroom';
  seedPrivateRoom(env, roomId, 'host-actor-1', ['host-actor-1']);
  const { room, applied } = makeConfigRoom(env, roomId);

  const forged = await handleRoomRequest(room, new Request(`https://room/private-config?roomId=${roomId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomMode: 'tdm', hostActorId: 'attacker-actor' })
  }));
  assert.equal(forged.status, 403);
  assert.equal(applied.length, 0);

  const legit = await handleRoomRequest(room, new Request(`https://room/private-config?roomId=${roomId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomMode: 'tdm', hostActorId: 'host-actor-1' })
  }));
  const legitBody = await legit.json();
  assert.equal(legit.status, 200);
  assert.equal(legitBody.ok, true);
  assert.equal(applied.length, 1);
});

test('private-config rejects a forwarded requester that is not the room owner', async () => {
  const env = createFakeEnv();
  const roomId = 'private-cfgroomb';
  seedPrivateRoom(env, roomId, 'host-actor-1', ['host-actor-1', 'member-actor-2']);
  const { room, applied } = makeConfigRoom(env, roomId);

  const denied = await handleRoomRequest(room, new Request(`https://room/private-config?roomId=${roomId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requester-Actor-Id': 'member-actor-2'
    },
    body: JSON.stringify({ roomMode: 'tdm', hostActorId: 'host-actor-1' })
  }));
  assert.equal(denied.status, 403);
  assert.equal(applied.length, 0);

  const allowed = await handleRoomRequest(room, new Request(`https://room/private-config?roomId=${roomId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requester-Actor-Id': 'host-actor-1'
    },
    body: JSON.stringify({ roomMode: 'tdm', hostActorId: 'host-actor-1' })
  }));
  assert.equal(allowed.status, 200);
  assert.equal(applied.length, 1);
});

test('private-config rejects configs for unregistered private rooms', async () => {
  const env = createFakeEnv();
  const { room, applied } = makeConfigRoom(env, 'private-ghostroom');

  const response = await handleRoomRequest(room, new Request('https://room/private-config?roomId=private-ghostroom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomMode: 'tdm', hostActorId: 'anyone' })
  }));
  assert.equal(response.status, 403);
  assert.equal(applied.length, 0);
});
