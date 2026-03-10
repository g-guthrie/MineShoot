import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

import { createFakeEnv } from './fake-d1.js';
import { handleFriends } from '../cloudflare/server/friends.js';
import { handleParty } from '../cloudflare/server/party.js';
import { handlePrivateRoomLobby } from '../cloudflare/server/private-room-lobby.js';
import { handleMatchmaking } from '../cloudflare/server/matchmaking.js';
import { handleWsUpgrade } from '../cloudflare/server/ws-upgrade.js';
import { assignActorToPrivateRoom } from '../cloudflare/server/private-rooms.js';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

function request(path, method, body) {
  return new Request('https://example.test' + path, {
    method: method || 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
}

function authedRequest(sessionId, path, method, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (sessionId) headers.Cookie = `mfa_session=${encodeURIComponent(sessionId)}`;
  return new Request('https://example.test' + path, {
    method: method || 'GET',
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
}

function seedAccount(env, suffix, username) {
  const userId = 'usr_' + suffix;
  const sessionId = 'ses_' + suffix;
  env.__state.users.set(userId, {
    id: userId,
    username: username,
    username_norm: String(username || '').toLowerCase(),
    pin_plain: '1234',
    created_at: 1
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
    updated_at: 1
  });
  env.__state.sessions.set(sessionId, {
    id: sessionId,
    user_id: userId,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    created_at: 1,
    last_seen_at: 1
  });
  return { userId, sessionId, username };
}

async function jsonBody(response) {
  return await response.json();
}

test('create room defaults to FFA and carries menu-idle party members', async () => {
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=ACTOR_A1&displayName=ALPHA&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=ACTOR_B1&displayName=BRAVO&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'ACTOR_B1',
    displayName: 'BRAVO',
    activityState: 'menu',
    action: 'join',
    targetId: 'ACTOR_A1'
  }));

  const response = await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ACTOR_A1',
    displayName: 'ALPHA',
    activityState: 'menu',
    action: 'create'
  }));
  const body = await jsonBody(response);

  assert.equal(body.ok, true);
  assert.equal(body.state.room.roomMode, 'ffa');
  assert.equal(body.state.room.memberCount, 2);
  assert.equal(body.movedCount, 2);
});

test('party state bootstraps on a fresh local schema', async () => {
  const env = createFakeEnv();

  const response = await handleParty(env, request('/api/party?actorId=BOOT100&displayName=BOOT100&activityState=menu', 'GET'));
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.state.party.memberCount, 1);
  assert.equal(body.state.party.isLeader, true);
});

test('create room supports LMS mode and starts active', async () => {
  const env = createFakeEnv();

  const response = await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ACTOR_LMS1',
    displayName: 'SURVIVOR',
    activityState: 'menu',
    action: 'create',
    roomMode: 'lms'
  }));
  const body = await jsonBody(response);

  assert.equal(body.ok, true);
  assert.equal(body.state.room.roomMode, 'lms');
  assert.equal(body.state.room.roomPhase, 'active');
});

test('party join lock blocks new joiners until the leader unlocks it', async () => {
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=LEAD900&displayName=LEAD900&activityState=menu', 'GET'));
  const lockResponse = await handleParty(env, request('/api/party', 'POST', {
    actorId: 'LEAD900',
    displayName: 'LEAD900',
    activityState: 'menu',
    action: 'lock',
    locked: true
  }));
  const locked = await jsonBody(lockResponse);

  assert.equal(locked.ok, true);
  assert.equal(locked.state.party.joinLocked, true);

  await handleParty(env, request('/api/party?actorId=JOIN900&displayName=JOIN900&activityState=menu', 'GET'));
  const deniedJoin = await handleParty(env, request('/api/party', 'POST', {
    actorId: 'JOIN900',
    displayName: 'JOIN900',
    activityState: 'menu',
    action: 'join',
    targetId: 'LEAD900'
  }));
  const deniedBody = await jsonBody(deniedJoin);

  assert.equal(deniedJoin.status, 423);
  assert.match(deniedBody.error, /locked/i);

  const unlockResponse = await handleParty(env, request('/api/party', 'POST', {
    actorId: 'LEAD900',
    displayName: 'LEAD900',
    activityState: 'menu',
    action: 'lock',
    locked: false
  }));
  const unlocked = await jsonBody(unlockResponse);

  assert.equal(unlocked.ok, true);
  assert.equal(unlocked.state.party.joinLocked, false);

  const allowedJoin = await handleParty(env, request('/api/party', 'POST', {
    actorId: 'JOIN900',
    displayName: 'JOIN900',
    activityState: 'menu',
    action: 'join',
    targetId: 'LEAD900'
  }));
  const allowedBody = await jsonBody(allowedJoin);

  assert.equal(allowedBody.ok, true);
  assert.equal(allowedBody.state.party.memberCount, 2);
});

test('party join accepts copied uppercase actor ids from the menu header', async () => {
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=leadcopy1&displayName=LEADCOPY&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=joincopy1&displayName=JOINCOPY&activityState=menu', 'GET'));

  const response = await handleParty(env, request('/api/party', 'POST', {
    actorId: 'joincopy1',
    displayName: 'JOINCOPY',
    activityState: 'menu',
    action: 'join',
    targetId: 'LEADCOPY1'
  }));
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.state.party.memberCount, 2);
});

test('friends persist for accounts, support invites, and allow one-click mutual joins', async () => {
  const env = createFakeEnv();
  const alpha = seedAccount(env, 'alpha', 'ALPHA');
  const bravo = seedAccount(env, 'bravo', 'BRAVO');

  await handleParty(env, authedRequest(alpha.sessionId, '/api/party?activityState=menu', 'GET'));
  await handleParty(env, authedRequest(bravo.sessionId, '/api/party?activityState=menu', 'GET'));

  const addAlpha = await jsonBody(await handleFriends(env, authedRequest(alpha.sessionId, '/api/friends', 'POST', {
    action: 'add',
    targetUserId: bravo.userId
  })));
  assert.equal(addAlpha.ok, true);
  assert.equal(addAlpha.friends.friends.length, 1);
  assert.equal(addAlpha.friends.friends[0].isMutual, false);

  await handleFriends(env, authedRequest(bravo.sessionId, '/api/friends', 'POST', {
    action: 'add',
    targetUserId: alpha.userId
  }));

  const mutual = await jsonBody(await handleFriends(env, authedRequest(alpha.sessionId, '/api/friends', 'GET')));
  assert.equal(mutual.friends.friends[0].isMutual, true);
  assert.equal(mutual.friends.friends[0].canJoin, true);

  const invite = await jsonBody(await handleFriends(env, authedRequest(alpha.sessionId, '/api/friends', 'POST', {
    action: 'invite',
    targetUserId: bravo.userId
  })));
  assert.equal(invite.ok, true);

  const bravoView = await jsonBody(await handleFriends(env, authedRequest(bravo.sessionId, '/api/friends', 'GET')));
  assert.equal(bravoView.friends.friends[0].incomingInvite, true);

  const joined = await jsonBody(await handleFriends(env, authedRequest(bravo.sessionId, '/api/friends', 'POST', {
    action: 'accept_invite',
    targetUserId: alpha.userId
  })));
  assert.equal(joined.ok, true);
  assert.equal(joined.state.party.memberCount, 2);

  const relisted = await jsonBody(await handleFriends(env, authedRequest(bravo.sessionId, '/api/friends', 'GET')));
  assert.equal(relisted.friends.friends[0].incomingInvite, false);
  assert.equal(relisted.friends.friends[0].sameParty, true);
});

test('friend actions accept uppercase copied user ids', async () => {
  const env = createFakeEnv();
  const alpha = seedAccount(env, 'upperalpha', 'ALPHAUP');
  const bravo = seedAccount(env, 'upperbravo', 'BRAVOUP');

  await handleParty(env, authedRequest(alpha.sessionId, '/api/party?activityState=menu', 'GET'));
  await handleParty(env, authedRequest(bravo.sessionId, '/api/party?activityState=menu', 'GET'));

  const addAlpha = await jsonBody(await handleFriends(env, authedRequest(alpha.sessionId, '/api/friends', 'POST', {
    action: 'add',
    targetUserId: String(bravo.userId).toUpperCase()
  })));
  assert.equal(addAlpha.ok, true);
  assert.equal(addAlpha.friends.friends.length, 1);

  await handleFriends(env, authedRequest(bravo.sessionId, '/api/friends', 'POST', {
    action: 'add',
    targetUserId: String(alpha.userId).toUpperCase()
  }));

  const invite = await jsonBody(await handleFriends(env, authedRequest(alpha.sessionId, '/api/friends', 'POST', {
    action: 'invite',
    targetUserId: String(bravo.userId).toUpperCase()
  })));
  assert.equal(invite.ok, true);

  const joined = await jsonBody(await handleFriends(env, authedRequest(bravo.sessionId, '/api/friends', 'POST', {
    action: 'accept_invite',
    targetUserId: String(alpha.userId).toUpperCase()
  })));
  assert.equal(joined.ok, true);
  assert.equal(joined.state.party.memberCount, 2);
});

test('only menu-idle party members are eligible for carry-in', async () => {
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=ACTOR_A2&displayName=LEAD&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=ACTOR_B2&displayName=FIGHTER&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'ACTOR_B2',
    displayName: 'FIGHTER',
    activityState: 'menu',
    action: 'join',
    targetId: 'ACTOR_A2'
  }));
  await handleParty(env, request('/api/party?actorId=ACTOR_B2&displayName=FIGHTER&activityState=in_match', 'GET'));

  const response = await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ACTOR_A2',
    displayName: 'LEAD',
    activityState: 'menu',
    action: 'create'
  }));
  const body = await jsonBody(response);

  assert.equal(body.ok, true);
  assert.equal(body.movedCount, 1);
  assert.equal(body.state.room.memberCount, 1);
});

test('creating a new room while attached to an old one moves the creator cleanly', async () => {
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=ACTOR_A3&displayName=OWNER&activityState=menu', 'GET'));
  const first = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ACTOR_A3',
    displayName: 'OWNER',
    activityState: 'menu',
    action: 'create'
  })));
  const firstRoomId = first.state.room.roomId;

  const second = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ACTOR_A3',
    displayName: 'OWNER',
    activityState: 'menu',
    action: 'create'
  })));
  const secondRoomId = second.state.room.roomId;

  assert.notEqual(firstRoomId, secondRoomId);

  const roomState = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room?actorId=ACTOR_A3&displayName=OWNER', 'GET')));
  assert.equal(roomState.state.room.roomId, secondRoomId);
});

test('team layout persists across FFA/TDM mode switching', async () => {
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=ACTOR_A4&displayName=LEAD&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=ACTOR_B4&displayName=WING&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'ACTOR_B4',
    displayName: 'WING',
    activityState: 'menu',
    action: 'join',
    targetId: 'ACTOR_A4'
  }));

  const created = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ACTOR_A4',
    displayName: 'LEAD',
    activityState: 'menu',
    action: 'create'
  })));
  const roomCode = created.state.room.roomCode;

  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ACTOR_A4',
    displayName: 'LEAD',
    activityState: 'private_room_lobby',
    action: 'move_member',
    targetId: 'ACTOR_B4',
    teamId: 'bravo'
  }));
  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ACTOR_A4',
    displayName: 'LEAD',
    activityState: 'private_room_lobby',
    action: 'set_mode',
    roomMode: 'tdm'
  }));
  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ACTOR_A4',
    displayName: 'LEAD',
    activityState: 'private_room_lobby',
    action: 'set_mode',
    roomMode: 'ffa'
  }));
  const finalState = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ACTOR_A4',
    displayName: 'LEAD',
    activityState: 'private_room_lobby',
    action: 'set_mode',
    roomMode: 'tdm'
  })));

  assert.equal(finalState.ok, true);
  assert.equal(finalState.state.room.roomCode, roomCode);
  assert.equal(finalState.state.room.teams.bravo.length, 1);
  assert.equal(finalState.state.room.teams.bravo[0].id, 'ACTOR_B4');
});

test('joining a full private room fails without ejecting the caller from their current room', async () => {
  const env = createFakeEnv();

  const sourceRoom = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'JOIN900',
    displayName: 'JOIN900',
    activityState: 'menu',
    action: 'create'
  })));
  const sourceRoomId = sourceRoom.state.room.roomId;

  const targetRoom = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'HOST900',
    displayName: 'HOST900',
    activityState: 'menu',
    action: 'create'
  })));
  const targetRoomId = targetRoom.state.room.roomId;

  for (let i = 2; i <= 16; i++) {
    const actorId = `FULL${String(i).padStart(3, '0')}`;
    await assignActorToPrivateRoom(env, targetRoomId, actorId, actorId, 'alpha');
  }

  const response = await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'JOIN900',
    displayName: 'JOIN900',
    activityState: 'menu',
    action: 'join',
    roomCode: targetRoom.state.room.roomCode
  }));
  const body = await jsonBody(response);

  assert.equal(response.status, 409);
  assert.equal(body.ok, false);
  assert.match(body.error, /full/i);

  const state = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room?actorId=JOIN900&displayName=JOIN900', 'GET')));
  assert.equal(state.state.room.roomId, sourceRoomId);
});

test('legacy matchmaking private create requires actor identity instead of returning unusable success', async () => {
  const env = createFakeEnv();

  const response = await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'private'
  }));
  const body = await jsonBody(response);

  assert.equal(response.status, 400);
  assert.match(body.error, /actor identity/i);
});

test('legacy matchmaking private create delegates to private-room lobby when actor identity is present', async () => {
  const env = createFakeEnv();

  const response = await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'private',
    actorId: 'LEGACY01',
    displayName: 'LEGACY01',
    activityState: 'menu'
  }));
  const body = await jsonBody(response);

  assert.equal(body.ok, true);
  assert.equal(body.modeId, 'single_cloudflare');
  assert.ok(body.state && body.state.room);

  const state = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room?actorId=LEGACY01&displayName=LEGACY01', 'GET')));
  assert.equal(state.state.room.roomId, body.roomId);
});

test('quick matchmaking returns LMS public rooms when requested', async () => {
  const env = createFakeEnv();

  const response = await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'lms'
  }));
  const body = await jsonBody(response);

  assert.equal(body.ok, true);
  assert.equal(body.gameMode, 'lms');
  assert.match(body.roomId, /^lms-/);
});

test('websocket upgrade enforces private-room membership and forwards actor identity', async () => {
  const env = createFakeEnv();
  const forwarded = [];
  env.GLOBAL_ARENA = {
    idFromName(name) {
      return name;
    },
    get(_id) {
      return {
        fetch(req) {
          forwarded.push(req);
          return Promise.resolve(new Response('ok', { status: 200 }));
        }
      };
    }
  };

  const created = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ACTOR_WS1',
    displayName: 'ALPHA',
    activityState: 'menu',
    action: 'create'
  })));
  const roomId = created.state.room.roomId;
  forwarded.length = 0;

  const allowed = await handleWsUpgrade(
    env,
    request(`/api/ws?room=${roomId}&pid=ply_allow_1&uid=pub_allow_1&username=ALPHA&classId=abilities&actorId=ACTOR_WS1&actorName=ALPHA`, 'GET'),
    { abilities: {} }
  );
  assert.equal(allowed.status, 200);
  assert.equal(forwarded.length, 1);
  const forwardedUrl = new URL(forwarded[0].url);
  assert.equal(forwardedUrl.searchParams.get('userId'), 'ply_allow_1');
  assert.equal(forwardedUrl.searchParams.get('actorId'), 'ACTOR_WS1');

  const denied = await handleWsUpgrade(
    env,
    request(`/api/ws?room=${roomId}&pid=ply_deny_1&uid=pub_deny_1&username=BRAVO&classId=abilities&actorId=INTRUDER&actorName=BRAVO`, 'GET'),
    { abilities: {} }
  );
  assert.equal(denied.status, 403);
  assert.equal(forwarded.length, 1);
});

test('websocket upgrade accepts uppercase copied guest actor ids for private-room membership', async () => {
  const env = createFakeEnv();
  const forwarded = [];
  env.GLOBAL_ARENA = {
    idFromName(name) {
      return name;
    },
    get(_id) {
      return {
        fetch(req) {
          forwarded.push(req);
          return Promise.resolve(new Response('ok', { status: 200 }));
        }
      };
    }
  };

  const created = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'gst_casews1',
    displayName: 'CASEWS',
    activityState: 'menu',
    action: 'create'
  })));
  const roomId = created.state.room.roomId;
  forwarded.length = 0;

  const allowed = await handleWsUpgrade(
    env,
    request(`/api/ws?room=${roomId}&pid=ply_casews_1&uid=pub_casews_1&username=CASEWS&classId=abilities&actorId=GST_CASEWS1&actorName=CASEWS`, 'GET'),
    { abilities: {} }
  );
  assert.equal(allowed.status, 200);
  assert.equal(forwarded.length, 1);
  const forwardedUrl = new URL(forwarded[0].url);
  assert.equal(forwardedUrl.searchParams.get('actorId'), 'gst_casews1');
});

test('websocket upgrade path no longer reprimes private rooms', async () => {
  const source = await fs.readFile(new URL('../cloudflare/server/ws-upgrade.js', import.meta.url), 'utf8');
  assert.equal(source.includes('primePrivateRoomDurableObject'), false);
});
