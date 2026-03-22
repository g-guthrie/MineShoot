import test from 'node:test';
import assert from 'node:assert/strict';

import { handleTestRoomFixture, roomFixturesEnabled } from '../../cloudflare/server/test-room-fixture.js';

test('test room fixture route stays disabled outside the e2e worker env', async () => {
  const response = await handleTestRoomFixture({
    ROOM_NAME: 'global'
  }, new Request('https://example.test/api/test/room-fixture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: 'itest-room',
      players: []
    })
  }));

  assert.equal(roomFixturesEnabled({ ROOM_NAME: 'global' }), false);
  assert.equal(response.status, 404);
});

test('test room fixture route proxies the requested room fixture into the durable object when enabled', async () => {
  const forwarded = [];
  const stub = {
    fetch(request) {
      forwarded.push(request);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
  const env = {
    ROOM_NAME: 'global',
    ENABLE_TEST_FIXTURES: '1',
    GLOBAL_ARENA: {
      idFromName(roomId) {
        return 'id:' + roomId;
      },
      get(id) {
        assert.equal(id, 'id:itestroom');
        return stub;
      }
    }
  };

  const response = await handleTestRoomFixture(env, new Request('https://example.test/api/test/room-fixture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: 'ITest Room',
      players: [{ userId: 'u1', x: 12, z: 18 }]
    })
  }));
  const body = await response.json();

  assert.equal(roomFixturesEnabled(env), true);
  assert.equal(body.ok, true);
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].url, 'https://room/test-fixture?roomId=itestroom');
  assert.deepEqual(await forwarded[0].json(), {
    players: [{ userId: 'u1', x: 12, z: 18 }]
  });
});
