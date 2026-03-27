import test from 'node:test';
import assert from 'node:assert/strict';

import { handleWsLobbyUpgrade } from '../../cloudflare/server/ws-lobby-upgrade.js';
import { createFakeEnv } from '../helpers/fake-d1.js';

function seedSession(env, suffix, username, displayName = null) {
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
  env.__state.sessions.set(sessionId, {
    id: sessionId,
    user_id: userId,
    expires_at: now + 86400,
    created_at: now,
    last_seen_at: now
  });
  env.__state.profiles.set(userId, {
    user_id: userId,
    display_name: displayName,
    profile_enabled: 0,
    headline: null,
    bio: null,
    class_id: 'ffa',
    kills: 0,
    deaths: 0,
    damage_done: 0,
    damage_taken: 0,
    updated_at: now
  });
  return { userId, sessionId };
}

test('ws lobby upgrade forwards validated private-room observers to the lobby hub binding', async () => {
  const env = createFakeEnv();
  env.__state.privateRooms.set('private-abcd', {
    room_id: 'private-abcd',
    room_code: 'ABCD',
    creator_user_id: 'actor-1',
    created_at: 1,
    last_used_at: 1
  });
  env.__state.privateRoomMembers.set('actor-1', {
    actor_id: 'actor-1',
    room_id: 'private-abcd',
    display_name: 'ALPHA',
    team_id: 'alpha',
    joined_at: 1
  });

  const seen = [];
  env.PRIVATE_ROOM_LOBBY_HUB = {
    idFromName(name) {
      return String(name || '');
    },
    get() {
      return {
        async fetch(request) {
          seen.push(String(request.url || request));
          return { status: 101 };
        }
      };
    }
  };

  const response = await handleWsLobbyUpgrade(env, new Request('https://example.test/api/ws/lobby?room=private-abcd&actorId=actor-1', {
    headers: {
      Upgrade: 'websocket'
    }
  }));

  assert.equal(response.status, 101);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /https:\/\/private-room-lobby\/connect\?roomId=private-abcd&actorId=actor-1/);
});

test('ws lobby upgrade uses the authenticated actor id and display name when present', async () => {
  const env = createFakeEnv();
  const { userId, sessionId } = seedSession(env, 'lobby_alpha', 'ALPHA', 'Alpha Prime');
  env.__state.privateRooms.set('private-abcd', {
    room_id: 'private-abcd',
    room_code: 'ABCD',
    creator_user_id: userId,
    created_at: 1,
    last_used_at: 1
  });
  env.__state.privateRoomMembers.set(userId, {
    actor_id: userId,
    room_id: 'private-abcd',
    display_name: 'Alpha Prime',
    team_id: 'alpha',
    joined_at: 1
  });

  const seen = [];
  env.PRIVATE_ROOM_LOBBY_HUB = {
    idFromName(name) {
      return String(name || '');
    },
    get() {
      return {
        async fetch(request) {
          seen.push(String(request.url || request));
          return { status: 101 };
        }
      };
    }
  };

  const response = await handleWsLobbyUpgrade(env, new Request('https://example.test/api/ws/lobby?room=private-abcd&actorId=actor-override&actorName=REQUESTED', {
    headers: {
      Upgrade: 'websocket',
      Cookie: `mfa_session=${encodeURIComponent(sessionId)}`
    }
  }));

  assert.equal(response.status, 101);
  assert.equal(seen.length, 1);
  assert.match(seen[0], new RegExp(`actorId=${encodeURIComponent(userId)}`));
  assert.match(seen[0], /actorName=REQUESTED/);
});

test('ws lobby upgrade rejects requests without any actor identity', async () => {
  const env = createFakeEnv();
  env.__state.privateRooms.set('private-abcd', {
    room_id: 'private-abcd',
    room_code: 'ABCD',
    creator_user_id: 'actor-1',
    created_at: 1,
    last_used_at: 1
  });

  const response = await handleWsLobbyUpgrade(env, new Request('https://example.test/api/ws/lobby?room=private-abcd', {
    headers: {
      Upgrade: 'websocket'
    }
  }));

  assert.equal(response.status, 400);
});
