import test from 'node:test';
import assert from 'node:assert/strict';

import { handlePrivateRoomLobby } from '../../cloudflare/server/private-room-lobby.js';
import { createFakeEnv } from '../helpers/fake-d1.js';

function seedRoomWithHost(env, roomId, hostActorId, phase) {
  const now = Math.floor(Date.now() / 1000);
  env.__state.privateRooms.set(roomId, {
    room_id: roomId,
    room_code: roomId.toUpperCase(),
    creator_user_id: hostActorId,
    created_at: now,
    last_used_at: now
  });
  env.__state.privateRoomState.set(roomId, {
    room_id: roomId,
    room_mode: 'ffa',
    room_phase: phase,
    host_actor_id: hostActorId,
    invite_locked: 0,
    created_at: now,
    updated_at: now,
    team_count: 2
  });
  env.__state.privateRoomMembers.set(hostActorId, {
    actor_id: hostActorId,
    room_id: roomId,
    display_name: 'HOST',
    team_id: 'alpha',
    joined_at: now
  });
  env.__state.privateRoomMembers.set('actor_member', {
    actor_id: 'actor_member',
    room_id: roomId,
    display_name: 'MEMBER',
    team_id: 'bravo',
    joined_at: now + 1
  });
}

function lobbyRequest(body) {
  return new Request('https://internal.test/api/private-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('set_mode is rejected when the match is active', async () => {
  const env = createFakeEnv();
  seedRoomWithHost(env, 'private-test1', 'actor_host', 'active');

  const response = await handlePrivateRoomLobby(env, lobbyRequest({
    action: 'set_mode',
    actorId: 'actor_host',
    displayName: 'HOST',
    roomMode: 'tdm'
  }));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.ok(body.error.includes('active'));
});

test('set_mode succeeds in lobby phase', async () => {
  const env = createFakeEnv();
  seedRoomWithHost(env, 'private-test2', 'actor_host', 'lobby');

  const response = await handlePrivateRoomLobby(env, lobbyRequest({
    action: 'set_mode',
    actorId: 'actor_host',
    displayName: 'HOST',
    roomMode: 'tdm'
  }));
  const body = await response.json();

  assert.equal(body.ok, true);
});

test('set_team_count is rejected when the match is active', async () => {
  const env = createFakeEnv();
  seedRoomWithHost(env, 'private-test3', 'actor_host', 'active');

  const response = await handlePrivateRoomLobby(env, lobbyRequest({
    action: 'set_team_count',
    actorId: 'actor_host',
    displayName: 'HOST',
    teamCount: 4
  }));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.ok(body.error.includes('active'));
});

test('randomize is rejected when the match is active', async () => {
  const env = createFakeEnv();
  seedRoomWithHost(env, 'private-test4', 'actor_host', 'active');

  const response = await handlePrivateRoomLobby(env, lobbyRequest({
    action: 'randomize',
    actorId: 'actor_host',
    displayName: 'HOST'
  }));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.ok(body.error.includes('active'));
});

test('move_member is rejected when the match is active', async () => {
  const env = createFakeEnv();
  seedRoomWithHost(env, 'private-test5', 'actor_host', 'active');

  const response = await handlePrivateRoomLobby(env, lobbyRequest({
    action: 'move_member',
    actorId: 'actor_host',
    displayName: 'HOST',
    targetId: 'actor_member',
    teamId: 'alpha'
  }));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.ok(body.error.includes('active'));
});
