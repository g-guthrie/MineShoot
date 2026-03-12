import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const matchmakingSource = fs.readFileSync(
  path.join(process.cwd(), 'cloudflare/server/matchmaking.js'),
  'utf8'
);

function loadHandleMatchmaking() {
  const transformed = matchmakingSource
    .replace(
      /^import\s+\{\s*json,\s*sanitizeRoomId\s*\}\s+from\s+'\.\/transport\.js';\s*/m,
      `function json(body, status = 200, headers = {}) { return { body, status, headers }; }
function sanitizeRoomId(raw) {
  let id = String(raw || '').toLowerCase().trim();
  id = id.replace(/[^a-z0-9-]/g, '');
  if (!id) return 'global';
  if (id.length > 32) id = id.slice(0, 32);
  return id;
}
`
    )
    .replace(/export\s+async\s+function\s+handleMatchmaking/, 'async function handleMatchmaking')
    .concat('\nglobalThis.__TEST_EXPORTS__ = { handleMatchmaking };');

  const context = {
    console,
    URL,
    Date,
    Math,
    Promise,
    globalThis: null
  };
  context.globalThis = context;
  vm.runInNewContext(transformed, context, { filename: 'matchmaking.js' });
  return context.__TEST_EXPORTS__.handleMatchmaking;
}

function createEnv(roomStates) {
  return {
    PUBLIC_ROOM_COUNT: 3,
    PUBLIC_ROOM_CAPACITY: 16,
    GLOBAL_ARENA: {
      idFromName(roomId) {
        return roomId;
      },
      get(roomId) {
        return {
          async fetch() {
            const state = roomStates[roomId];
            return {
              ok: true,
              async json() {
                return state || null;
              }
            };
          }
        };
      }
    }
  };
}

function createRequest(body, method = 'POST') {
  return {
    method,
    async json() {
      return body;
    }
  };
}

test('matchmaking prefers an active public FFA room when one has capacity', async () => {
  const handleMatchmaking = loadHandleMatchmaking();
  const env = createEnv({
    'ffa-01': { connectedPlayers: 5, players: 5, matchStarted: false },
    'ffa-02': { connectedPlayers: 0, players: 0, matchStarted: false },
    'ffa-03': { connectedPlayers: 11, players: 11, matchStarted: true }
  });

  const response = await handleMatchmaking(env, createRequest({ action: 'quick', gameMode: 'tdm' }));

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.modeId, 'cloud_multiplayer');
  assert.equal(response.body.privacy, 'public');
  assert.equal(response.body.gameMode, 'ffa');
  assert.equal(response.body.roomId, 'ffa-03');
});

test('matchmaking falls back to the fullest waiting room when no active room is available', async () => {
  const handleMatchmaking = loadHandleMatchmaking();
  const env = createEnv({
    'ffa-01': { connectedPlayers: 1, players: 1, matchStarted: false },
    'ffa-02': { connectedPlayers: 0, players: 0, matchStarted: false },
    'ffa-03': { connectedPlayers: 0, players: 0, matchStarted: false }
  });

  const response = await handleMatchmaking(env, createRequest({ action: 'quick' }));

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.roomId, 'ffa-01');
});

test('matchmaking rejects non-quick actions after the FFA scope freeze', async () => {
  const handleMatchmaking = loadHandleMatchmaking();
  const env = createEnv({});

  const response = await handleMatchmaking(env, createRequest({ action: 'private' }));

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.match(response.body.error, /only quick public ffa matchmaking is available/i);
});
