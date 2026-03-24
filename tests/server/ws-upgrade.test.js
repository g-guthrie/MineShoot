import test from 'node:test';
import assert from 'node:assert/strict';

import { handleWsUpgrade } from '../../cloudflare/server/ws-upgrade.js';
import { createFakeEnv } from '../helpers/fake-d1.js';

function seedSession(env, suffix, username) {
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
  return { userId, sessionId };
}

test('authenticated websocket upgrade ignores client-supplied pid overrides', async () => {
  const env = createFakeEnv();
  const { userId, sessionId } = seedSession(env, 'ws_player', 'WSPlayer');
  let forwardedUrl = '';
  let forwardedHeaders = null;

  env.GLOBAL_ARENA = {
    idFromName(roomId) {
      return 'room:' + String(roomId || '');
    },
    get() {
      return {
        fetch(request) {
          forwardedUrl = request.url;
          forwardedHeaders = request.headers;
          return Promise.resolve(new Response(null, { status: 200 }));
        }
      };
    }
  };

  const response = await handleWsUpgrade(env, new Request(
    'https://example.test/api/ws?room=global&pid=ply_override_1&username=ALPHA',
    {
      method: 'GET',
      headers: {
        Upgrade: 'websocket',
        Cookie: `mfa_session=${encodeURIComponent(sessionId)}`
      }
    }
  ), {});

  assert.equal(response.status, 200);
  assert.ok(forwardedUrl.includes('userId=' + encodeURIComponent(userId)));
  assert.equal(forwardedHeaders.get('X-User-Id'), userId);
  assert.equal(forwardedHeaders.get('X-Account-User-Id'), userId);
});

test('guest websocket upgrade preserves a valid client-supplied pid', async () => {
  const env = createFakeEnv();
  let forwardedUrl = '';
  let forwardedHeaders = null;

  env.GLOBAL_ARENA = {
    idFromName(roomId) {
      return 'room:' + String(roomId || '');
    },
    get() {
      return {
        fetch(request) {
          forwardedUrl = request.url;
          forwardedHeaders = request.headers;
          return Promise.resolve(new Response(null, { status: 200 }));
        }
      };
    }
  };

  const response = await handleWsUpgrade(env, new Request(
    'https://example.test/api/ws?room=global&pid=usr_guest_socket_01&uid=amber-otter-314&username=ALPHA',
    {
      method: 'GET',
      headers: {
        Upgrade: 'websocket'
      }
    }
  ), { abilities: {} });

  assert.equal(response.status, 200);
  assert.ok(forwardedUrl.includes('userId=' + encodeURIComponent('usr_guest_socket_01')));
  assert.ok(forwardedUrl.includes('username=' + encodeURIComponent('ALPHA')));
  assert.equal(forwardedHeaders.get('X-User-Id'), 'usr_guest_socket_01');
  assert.equal(forwardedHeaders.get('X-Account-User-Id'), null);
});
