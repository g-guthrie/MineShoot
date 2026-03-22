import test from 'node:test';
import assert from 'node:assert/strict';

import { handleWsLobbyUpgrade } from '../../cloudflare/server/ws-lobby-upgrade.js';
import { createFakeEnv } from '../helpers/fake-d1.js';

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
