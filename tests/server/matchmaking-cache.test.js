import test from 'node:test';
import assert from 'node:assert/strict';

import { handleMatchmaking, clearRoomStateCache } from '../../cloudflare/server/matchmaking.js';
import { createFakeEnv } from '../helpers/fake-d1.js';

function createRoomStateArena(roomStates) {
  return {
    idFromName(roomId) { return 'room:' + String(roomId || ''); },
    get() {
      return {
        async fetch(url) {
          const parsed = new URL(url);
          const roomId = parsed.searchParams.get('roomId') || '';
          const state = roomStates.get(roomId);
          if (!state) return new Response(JSON.stringify({ ok: true, connectedPlayers: 0, players: 0, matchStarted: false }), { status: 200 });
          return new Response(JSON.stringify({ ok: true, ...state }), { status: 200 });
        }
      };
    }
  };
}

function countingArena(roomStates) {
  let fetchCount = 0;
  return {
    get fetchCount() { return fetchCount; },
    arena: {
      idFromName(roomId) { return 'room:' + String(roomId || ''); },
      get() {
        return {
          async fetch(url) {
            fetchCount++;
            const parsed = new URL(url);
            const roomId = parsed.searchParams.get('roomId') || '';
            const state = roomStates.get(roomId);
            if (!state) return new Response(JSON.stringify({ ok: true, connectedPlayers: 0, players: 0, matchStarted: false }), { status: 200 });
            return new Response(JSON.stringify({ ok: true, ...state }), { status: 200 });
          }
        };
      }
    }
  };
}

function request(body) {
  return new Request('https://example.test/api/matchmaking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('matchmaking cache reduces DO fetches on rapid successive requests', async () => {
  clearRoomStateCache();
  const counter = countingArena(new Map([
    ['ffa-01', { connectedPlayers: 4, players: 4, matchStarted: true }]
  ]));
  const env = createFakeEnv();
  env.PUBLIC_ROOM_COUNT = '1';
  env.PUBLIC_OVERFLOW_ROOM_COUNT = '0';
  env.GLOBAL_ARENA = counter.arena;

  const r1 = await handleMatchmaking(env, request({ action: 'quick', gameMode: 'ffa' }));
  const b1 = await r1.json();
  const fetchesAfterFirst = counter.fetchCount;

  const r2 = await handleMatchmaking(env, request({ action: 'quick', gameMode: 'ffa' }));
  const b2 = await r2.json();
  const fetchesAfterSecond = counter.fetchCount;

  assert.equal(b1.ok, true);
  assert.equal(b2.ok, true);
  assert.equal(fetchesAfterFirst, 1);
  assert.equal(fetchesAfterSecond, 1, 'second request should use cached state');
});

test('matchmaking relaxed fallback avoids dynamic overflow room when rooms are below hard cap', async () => {
  clearRoomStateCache();
  const env = createFakeEnv();
  env.PUBLIC_ROOM_COUNT = '2';
  env.PUBLIC_OVERFLOW_ROOM_COUNT = '0';
  env.GLOBAL_ARENA = createRoomStateArena(new Map([
    ['ffa-01', { connectedPlayers: 14, players: 14, matchStarted: true }],
    ['ffa-02', { connectedPlayers: 15, players: 15, matchStarted: true }]
  ]));

  const response = await handleMatchmaking(env, request({ action: 'quick', gameMode: 'ffa' }));
  const body = await response.json();

  assert.equal(body.ok, true);
  assert.ok(/^ffa-0[12]$/.test(body.roomId), 'should reuse existing room below hard cap instead of creating dynamic overflow');
});
