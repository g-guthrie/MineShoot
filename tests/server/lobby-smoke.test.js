import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

import { createFakeEnv } from '../helpers/fake-d1.js';
import { handleFriends } from '../../cloudflare/server/friends.js';
import { handleParty } from '../../cloudflare/server/party.js';
import { handlePrivateRoomLobby } from '../../cloudflare/server/private-room-lobby.js';
import { handleMatchmaking, clearRoomStateCache } from '../../cloudflare/server/matchmaking.js';
import { handleWsUpgrade } from '../../cloudflare/server/ws-upgrade.js';
import { assignActorToPrivateRoom } from '../../cloudflare/server/private-rooms.js';

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

function createRoomStateArena(stateByRoomId) {
  const states = stateByRoomId instanceof Map ? stateByRoomId : new Map();
  return {
    idFromName(name) {
      return String(name || '');
    },
    get(id) {
      return {
        async fetch(request) {
          const rawUrl = typeof request === 'string' ? request : (request && request.url) || 'https://room/state';
          const url = new URL(rawUrl);
          if (url.pathname === '/state') {
            const roomId = String(id || url.searchParams.get('roomId') || '');
            const state = states.get(roomId) || null;
            return new Response(JSON.stringify({
              ok: true,
              roomId,
              connectedPlayers: Math.max(0, Number(state && state.connectedPlayers) || 0),
              players: Math.max(0, Number(state && state.players) || 0),
              matchStarted: !!(state && state.matchStarted)
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      };
    }
  };
}

test('create room defaults to FFA and only places the creator into the room', async () => {
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
  assert.equal(body.state.room.memberCount, 1);
  assert.equal(body.movedCount, 1);
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

test('party direct invites support typed actor ids, dismissal, and accept flow', async () => {
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=ACTOR_INV_A&displayName=ALPHA&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=ACTOR_INV_B&displayName=BRAVO&activityState=menu', 'GET'));

  const invited = await jsonBody(await handleParty(env, request('/api/party', 'POST', {
    actorId: 'ACTOR_INV_A',
    displayName: 'ALPHA',
    activityState: 'menu',
    action: 'invite',
    targetId: 'ACTOR_INV_B'
  })));
  assert.equal(invited.ok, true);
  assert.equal(invited.state.directInvite.outgoing.actorId, 'ACTOR_INV_B');

  const recipientView = await jsonBody(await handleParty(env, request('/api/party?actorId=ACTOR_INV_B&displayName=BRAVO&activityState=menu', 'GET')));
  assert.equal(recipientView.state.directInvite.incoming.actorId, 'ACTOR_INV_A');

  const dismissed = await jsonBody(await handleParty(env, request('/api/party', 'POST', {
    actorId: 'ACTOR_INV_B',
    displayName: 'BRAVO',
    activityState: 'menu',
    action: 'dismiss_invite',
    targetId: 'ACTOR_INV_A'
  })));
  assert.equal(dismissed.ok, true);
  assert.equal(dismissed.state.directInvite.incoming, null);

  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'ACTOR_INV_A',
    displayName: 'ALPHA',
    activityState: 'menu',
    action: 'invite',
    targetId: 'ACTOR_INV_B'
  }));

  const accepted = await jsonBody(await handleParty(env, request('/api/party', 'POST', {
    actorId: 'ACTOR_INV_B',
    displayName: 'BRAVO',
    activityState: 'menu',
    action: 'accept_invite',
    targetId: 'ACTOR_INV_A'
  })));
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.party.memberCount, 2);
  assert.equal(accepted.state.directInvite.incoming, null);
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

test('friends support removing a saved friend', async () => {
  const env = createFakeEnv();
  const alpha = seedAccount(env, 'removealpha', 'ALPHA_REMOVE');
  const bravo = seedAccount(env, 'removebravo', 'BRAVO_REMOVE');

  await handleParty(env, authedRequest(alpha.sessionId, '/api/party?activityState=menu', 'GET'));
  await handleParty(env, authedRequest(bravo.sessionId, '/api/party?activityState=menu', 'GET'));

  await handleFriends(env, authedRequest(alpha.sessionId, '/api/friends', 'POST', {
    action: 'add',
    targetUserId: bravo.userId
  }));

  const removed = await jsonBody(await handleFriends(env, authedRequest(alpha.sessionId, '/api/friends', 'POST', {
    action: 'remove',
    targetUserId: bravo.userId
  })));

  assert.equal(removed.ok, true);
  assert.equal(removed.friends.friends.length, 0);
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
    actorId: 'ACTOR_B4',
    displayName: 'WING',
    activityState: 'menu',
    action: 'join',
    roomCode
  }));

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

test('private room supports selectable team counts up to four', async () => {
  const env = createFakeEnv();

  const created = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOM4_A',
    displayName: 'HOST',
    activityState: 'menu',
    action: 'create'
  })));

  const roomCode = created.state.room.roomCode;

  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOM4_B',
    displayName: 'B',
    activityState: 'menu',
    action: 'join',
    roomCode
  }));
  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOM4_C',
    displayName: 'C',
    activityState: 'menu',
    action: 'join',
    roomCode
  }));
  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOM4_D',
    displayName: 'D',
    activityState: 'menu',
    action: 'join',
    roomCode
  }));

  const updated = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOM4_A',
    displayName: 'HOST',
    activityState: 'private_room_lobby',
    action: 'set_team_count',
    teamCount: 4
  })));

  assert.equal(updated.ok, true);
  assert.equal(updated.state.room.teamCount, 4);
  assert.deepEqual(updated.state.room.teamIds, ['alpha', 'bravo', 'charlie', 'delta']);
});

test('private room keeps charlie and delta team assignments after four-team moves', async () => {
  const env = createFakeEnv();

  const created = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMX_A',
    displayName: 'HOST',
    activityState: 'menu',
    action: 'create'
  })));

  const roomCode = created.state.room.roomCode;

  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMX_B',
    displayName: 'B',
    activityState: 'menu',
    action: 'join',
    roomCode
  }));
  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMX_C',
    displayName: 'C',
    activityState: 'menu',
    action: 'join',
    roomCode
  }));
  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMX_D',
    displayName: 'D',
    activityState: 'menu',
    action: 'join',
    roomCode
  }));

  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMX_A',
    displayName: 'HOST',
    activityState: 'private_room_lobby',
    action: 'set_team_count',
    teamCount: 4
  }));

  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMX_A',
    displayName: 'HOST',
    activityState: 'private_room_lobby',
    action: 'move_member',
    targetId: 'ROOMX_C',
    teamId: 'charlie'
  }));
  const moved = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMX_A',
    displayName: 'HOST',
    activityState: 'private_room_lobby',
    action: 'move_member',
    targetId: 'ROOMX_D',
    teamId: 'delta'
  })));

  assert.equal(moved.ok, true);
  assert.equal(moved.state.room.teams.charlie.length, 1);
  assert.equal(moved.state.room.teams.charlie[0].id, 'ROOMX_C');
  assert.equal(moved.state.room.teams.delta.length, 1);
  assert.equal(moved.state.room.teams.delta[0].id, 'ROOMX_D');
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

test('empty private rooms are deleted when the last member leaves', async () => {
  const env = createFakeEnv();

  const created = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'SOLO900',
    displayName: 'SOLO900',
    activityState: 'menu',
    action: 'create'
  })));

  const roomCode = created.state.room.roomCode;
  const roomId = created.state.room.roomId;

  const left = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'SOLO900',
    displayName: 'SOLO900',
    activityState: 'private_room_lobby',
    action: 'leave'
  })));
  assert.equal(left.ok, true);
  assert.equal(left.state, null);

  const state = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room?actorId=SOLO900&displayName=SOLO900', 'GET')));
  assert.equal(state.ok, true);
  assert.equal(state.state, null);

  const rejoin = await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'INTRUDER9',
    displayName: 'INTRUDER9',
    activityState: 'menu',
    action: 'join',
    roomCode: roomCode
  }));
  const rejoinBody = await jsonBody(rejoin);
  assert.equal(rejoin.status, 404);
  assert.match(rejoinBody.error, /not found/i);

  assert.equal(env.__state.privateRooms.has(roomId), false);
  assert.equal(env.__state.privateRoomState.has(roomId), false);
});

test('quick matchmaking reuses deterministic overflow shards before minting emergency room ids', async () => {
  clearRoomStateCache();
  const env = createFakeEnv();
  env.PUBLIC_ROOM_COUNT = '2';
  env.PUBLIC_OVERFLOW_ROOM_COUNT = '2';
  env.GLOBAL_ARENA = createRoomStateArena(new Map([
    ['ffa-01', { connectedPlayers: 16, players: 16, matchStarted: true }],
    ['ffa-02', { connectedPlayers: 16, players: 16, matchStarted: true }],
    ['ffa-x01', { connectedPlayers: 6, players: 6, matchStarted: true }],
    ['ffa-x02', { connectedPlayers: 0, players: 0, matchStarted: false }]
  ]));

  const response = await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'ffa'
  }));
  const body = await jsonBody(response);

  assert.equal(body.ok, true);
  assert.equal(body.roomId, 'ffa-x01');
  assert.equal(body.players, 6);
});

test('quick matchmaking falls back to an emergency unique room after stable public shards fill up', async () => {
  clearRoomStateCache();
  const env = createFakeEnv();
  env.PUBLIC_ROOM_COUNT = '2';
  env.PUBLIC_OVERFLOW_ROOM_COUNT = '2';
  env.GLOBAL_ARENA = createRoomStateArena(new Map([
    ['ffa-01', { connectedPlayers: 16, players: 16, matchStarted: true }],
    ['ffa-02', { connectedPlayers: 16, players: 16, matchStarted: true }],
    ['ffa-x01', { connectedPlayers: 16, players: 16, matchStarted: true }],
    ['ffa-x02', { connectedPlayers: 16, players: 16, matchStarted: true }]
  ]));

  const response = await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'ffa'
  }));
  const body = await jsonBody(response);

  assert.equal(body.ok, true);
  assert.equal(/^(ffa-01|ffa-02|ffa-x01|ffa-x02)$/.test(body.roomId), false);
  assert.equal(/^ffa-[a-z0-9]{4}-[a-z0-9]{2}$/.test(body.roomId), true);
});

test('public quick matchmaking assigns one room to the whole ready party when the leader queues', async () => {
  clearRoomStateCache();
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=QUEUE_A&displayName=LEAD&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=QUEUE_B&displayName=WING&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'QUEUE_B',
    displayName: 'WING',
    activityState: 'menu',
    action: 'join',
    targetId: 'QUEUE_A'
  }));

  const response = await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'tdm',
    actorId: 'QUEUE_A',
    displayName: 'LEAD'
  }));
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(env.__state.publicMatchAssignments.get('QUEUE_A').room_id, body.roomId);
  assert.equal(env.__state.publicMatchAssignments.get('QUEUE_B').room_id, body.roomId);

  const wingState = await jsonBody(await handleParty(env, request('/api/party?actorId=QUEUE_B&displayName=WING&activityState=menu', 'GET')));
  assert.equal(wingState.state.self.publicMatch.roomId, body.roomId);
  assert.equal(wingState.state.self.publicMatch.gameMode, 'tdm');
});

test('public quick matchmaking blocks overlapping requests for the same party and reuses the assigned room', async () => {
  clearRoomStateCache();
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=QUEUE_R1&displayName=LEAD&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=QUEUE_R2&displayName=WING&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'QUEUE_R2',
    displayName: 'WING',
    activityState: 'menu',
    action: 'join',
    targetId: 'QUEUE_R1'
  }));

  let releaseFetch = null;
  const roomStateResponse = new Response(JSON.stringify({
    ok: true,
    connectedPlayers: 0,
    players: 0,
    matchStarted: false
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  env.GLOBAL_ARENA = {
    idFromName(name) {
      return String(name || '');
    },
    get(id) {
      return {
        async fetch(request) {
          const rawUrl = typeof request === 'string' ? request : (request && request.url) || 'https://room/state';
          const url = new URL(rawUrl);
          if (url.pathname === '/state') {
            if (!releaseFetch) {
              return new Promise((resolve) => {
                releaseFetch = () => resolve(roomStateResponse.clone());
              });
            }
            return roomStateResponse.clone();
          }
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      };
    }
  };

  const firstRequest = handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'ffa',
    actorId: 'QUEUE_R1',
    displayName: 'LEAD'
  }));

  for (let i = 0; i < 120 && env.__state.publicMatchQueueLocks.size === 0; i++) {
    await Promise.resolve();
  }
  assert.equal(env.__state.publicMatchQueueLocks.size > 0, true, 'expected the first matchmaking request to acquire the queue lock');

  const secondResponse = await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'ffa',
    actorId: 'QUEUE_R1',
    displayName: 'LEAD'
  }));
  const secondBody = await jsonBody(secondResponse);

  assert.equal(secondResponse.status, 409);
  assert.match(secondBody.error, /starting/i);

  releaseFetch();
  const firstBody = await jsonBody(await firstRequest);

  assert.equal(firstBody.ok, true);
  assert.equal(env.__state.publicMatchAssignments.get('QUEUE_R1').room_id, firstBody.roomId);
  assert.equal(env.__state.publicMatchAssignments.get('QUEUE_R2').room_id, firstBody.roomId);
  assert.equal(env.__state.publicMatchQueueLocks.size, 0);

  const retryBody = await jsonBody(await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'ffa',
    actorId: 'QUEUE_R1',
    displayName: 'LEAD'
  })));

  assert.equal(retryBody.ok, true);
  assert.equal(retryBody.roomId, firstBody.roomId);
});

test('public quick matchmaking repairs missing party assignments when reusing an existing room', async () => {
  clearRoomStateCache();
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=QUEUE_M1&displayName=LEAD&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=QUEUE_M2&displayName=WING&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'QUEUE_M2',
    displayName: 'WING',
    activityState: 'menu',
    action: 'join',
    targetId: 'QUEUE_M1'
  }));

  const queued = await jsonBody(await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'tdm',
    actorId: 'QUEUE_M1',
    displayName: 'LEAD'
  })));

  env.__state.publicMatchAssignments.delete('QUEUE_M2');

  const retried = await jsonBody(await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'tdm',
    actorId: 'QUEUE_M1',
    displayName: 'LEAD'
  })));

  assert.equal(retried.ok, true);
  assert.equal(retried.roomId, queued.roomId);
  assert.equal(env.__state.publicMatchAssignments.get('QUEUE_M1').room_id, queued.roomId);
  assert.equal(env.__state.publicMatchAssignments.get('QUEUE_M2').room_id, queued.roomId);
});

test('public quick matchmaking keeps valid assignments when room state is temporarily unavailable', async () => {
  clearRoomStateCache();
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=QUEUE_S1&displayName=LEAD&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=QUEUE_S2&displayName=WING&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'QUEUE_S2',
    displayName: 'WING',
    activityState: 'menu',
    action: 'join',
    targetId: 'QUEUE_S1'
  }));

  const queued = await jsonBody(await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'ffa',
    actorId: 'QUEUE_S1',
    displayName: 'LEAD'
  })));

  env.GLOBAL_ARENA = {
    idFromName(name) {
      return String(name || '');
    },
    get() {
      return {
        async fetch(request) {
          const rawUrl = typeof request === 'string' ? request : (request && request.url) || 'https://room/state';
          const url = new URL(rawUrl);
          if (url.pathname === '/state') {
            return new Response('temporary failure', { status: 503 });
          }
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      };
    }
  };

  const retried = await jsonBody(await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'ffa',
    actorId: 'QUEUE_S1',
    displayName: 'LEAD'
  })));

  assert.equal(retried.ok, true);
  assert.equal(retried.roomId, queued.roomId);
  assert.equal(env.__state.publicMatchAssignments.get('QUEUE_S1').room_id, queued.roomId);
  assert.equal(env.__state.publicMatchAssignments.get('QUEUE_S2').room_id, queued.roomId);
});

test('public quick matchmaking rejects non-leader party queue attempts', async () => {
  clearRoomStateCache();
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=QUEUE_C&displayName=LEAD&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=QUEUE_D&displayName=WING&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'QUEUE_D',
    displayName: 'WING',
    activityState: 'menu',
    action: 'join',
    targetId: 'QUEUE_C'
  }));

  const response = await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'ffa',
    actorId: 'QUEUE_D',
    displayName: 'WING'
  }));
  const body = await jsonBody(response);

  assert.equal(response.status, 403);
  assert.match(body.error, /leader/i);
});

test('public quick matchmaking blocks until the full party is menu-ready', async () => {
  clearRoomStateCache();
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=QUEUE_E&displayName=LEAD&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=QUEUE_F&displayName=WING&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'QUEUE_F',
    displayName: 'WING',
    activityState: 'menu',
    action: 'join',
    targetId: 'QUEUE_E'
  }));
  await handleParty(env, request('/api/party?actorId=QUEUE_F&displayName=WING&activityState=in_match', 'GET'));

  const response = await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'ffa',
    actorId: 'QUEUE_E',
    displayName: 'LEAD'
  }));
  const body = await jsonBody(response);

  assert.equal(response.status, 409);
  assert.match(body.error, /menu/i);
});

test('private room invite defaults to host-only, can be dismissed, and accepting keeps the party intact', async () => {
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=ROOMINV_A&displayName=HOST&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=ROOMINV_B&displayName=WING&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'ROOMINV_B',
    displayName: 'WING',
    activityState: 'menu',
    action: 'join',
    targetId: 'ROOMINV_A'
  }));

  const created = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMINV_A',
    displayName: 'HOST',
    activityState: 'menu',
    action: 'create'
  })));

  assert.equal(created.state.room.inviteLocked, true);

  const invited = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMINV_A',
    displayName: 'HOST',
    activityState: 'private_room_lobby',
    action: 'invite_party'
  })));
  assert.equal(invited.invitedCount, 1);

  const recipientView = await jsonBody(await handleParty(env, request('/api/party?actorId=ROOMINV_B&displayName=WING&activityState=menu', 'GET')));
  assert.equal(recipientView.state.roomInvite.incoming.roomCode, created.state.room.roomCode);

  const dismissed = await jsonBody(await handleParty(env, request('/api/party', 'POST', {
    actorId: 'ROOMINV_B',
    displayName: 'WING',
    activityState: 'menu',
    action: 'dismiss_room_invite'
  })));
  assert.equal(dismissed.state.roomInvite.incoming, null);

  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMINV_A',
    displayName: 'HOST',
    activityState: 'private_room_lobby',
    action: 'invite_party'
  }));
  const accepted = await jsonBody(await handleParty(env, request('/api/party', 'POST', {
    actorId: 'ROOMINV_B',
    displayName: 'WING',
    activityState: 'menu',
    action: 'accept_room_invite'
  })));

  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.party.memberCount, 2);
  assert.equal(env.__state.privateRoomMembers.get('ROOMINV_B').room_id, created.state.room.roomId);
});

test('unlocked private rooms allow any room member to invite their own party', async () => {
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=ROOMINV_H&displayName=HOST&activityState=menu', 'GET'));
  const created = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMINV_H',
    displayName: 'HOST',
    activityState: 'menu',
    action: 'create'
  })));

  await handleParty(env, request('/api/party?actorId=ROOMINV_M&displayName=MEMBER&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=ROOMINV_X&displayName=EXTRA&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'ROOMINV_X',
    displayName: 'EXTRA',
    activityState: 'menu',
    action: 'join',
    targetId: 'ROOMINV_M'
  }));

  await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMINV_M',
    displayName: 'MEMBER',
    activityState: 'menu',
    action: 'join',
    roomCode: created.state.room.roomCode
  }));

  const denied = await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMINV_M',
    displayName: 'MEMBER',
    activityState: 'private_room_lobby',
    action: 'invite_party'
  }));
  assert.equal(denied.status, 403);

  const unlocked = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMINV_H',
    displayName: 'HOST',
    activityState: 'private_room_lobby',
    action: 'set_invite_lock',
    locked: false
  })));
  assert.equal(unlocked.state.room.inviteLocked, false);

  const invited = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'ROOMINV_M',
    displayName: 'MEMBER',
    activityState: 'private_room_lobby',
    action: 'invite_party'
  })));
  assert.equal(invited.invitedCount, 1);

  const extraState = await jsonBody(await handleParty(env, request('/api/party?actorId=ROOMINV_X&displayName=EXTRA&activityState=menu', 'GET')));
  assert.equal(extraState.state.roomInvite.incoming.roomCode, created.state.room.roomCode);
});

test('public websocket connect consumes the actor public match assignment', async () => {
  const env = createFakeEnv();

  await handleParty(env, request('/api/party?actorId=QUEUE_G&displayName=LEAD&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party?actorId=QUEUE_H&displayName=WING&activityState=menu', 'GET'));
  await handleParty(env, request('/api/party', 'POST', {
    actorId: 'QUEUE_H',
    displayName: 'WING',
    activityState: 'menu',
    action: 'join',
    targetId: 'QUEUE_G'
  }));

  const queued = await jsonBody(await handleMatchmaking(env, request('/api/matchmaking', 'POST', {
    action: 'quick',
    gameMode: 'ffa',
    actorId: 'QUEUE_G',
    displayName: 'LEAD'
  })));

  const wsRequest = new Request(
    'https://example.test/api/ws?room=' + encodeURIComponent(queued.roomId) +
    '&actorId=QUEUE_H&actorName=WING&uid=guest_queue_h&username=WING',
    { method: 'GET' }
  );
  const response = await handleWsUpgrade(env, wsRequest, {});

  assert.equal(response.status, 200);
  assert.equal(env.__state.publicMatchAssignments.has('QUEUE_H'), false);
  assert.equal(env.__state.publicMatchAssignments.has('QUEUE_G'), true);
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

test('websocket upgrade mints readable guest ids when the client does not provide one', async () => {
  const env = createFakeEnv();
  let forwardedUrl = null;
  env.GLOBAL_ARENA = {
    idFromName() {
      return 'room-guest-friendly';
    },
    get() {
      return {
        async fetch(requestLike) {
          forwardedUrl = new URL(typeof requestLike === 'string' ? requestLike : requestLike.url);
          return new Response(null, { status: 200 });
        }
      };
    }
  };

  const response = await handleWsUpgrade(env, request('/api/ws?room=global&username=', 'GET'), {});

  assert.equal(response.status, 200);
  assert.match(String(forwardedUrl.searchParams.get('userId') || ''), /^[a-z]+-[a-z]+-\d{3}$/);
  assert.equal(forwardedUrl.searchParams.get('username'), String(forwardedUrl.searchParams.get('userId') || '').toUpperCase());
});

test('websocket upgrade accepts separator-free readable guest actor ids for private-room membership', async () => {
  const env = createFakeEnv();
  let forwardedUrl = null;
  const created = await jsonBody(await handlePrivateRoomLobby(env, request('/api/private-room', 'POST', {
    actorId: 'amber-otter-314',
    displayName: 'AMBER-OTTER-314',
    activityState: 'menu',
    action: 'create'
  })));
  const roomId = created.state.room.roomId;

  env.GLOBAL_ARENA = {
    idFromName() {
      return 'room-readable-guest';
    },
    get() {
      return {
        async fetch(requestLike) {
          forwardedUrl = new URL(typeof requestLike === 'string' ? requestLike : requestLike.url);
          return new Response(null, { status: 200 });
        }
      };
    }
  };

  const allowed = await handleWsUpgrade(
    env,
    request(`/api/ws?room=${roomId}&pid=ply_read_1&uid=pub_read_1&username=AMBEROTTER314&classId=abilities&actorId=AMBEROTTER314&actorName=AMBEROTTER314`, 'GET'),
    {}
  );

  assert.equal(allowed.status, 200);
  assert.equal(forwardedUrl.searchParams.get('actorId'), 'amber-otter-314');
});

test('websocket upgrade path no longer reprimes private rooms', async () => {
  const source = await fs.readFile(new URL('../../cloudflare/server/ws-upgrade.js', import.meta.url), 'utf8');
  assert.equal(source.includes('primePrivateRoomDurableObject'), false);
});
