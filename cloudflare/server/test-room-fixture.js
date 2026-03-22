import { sanitizeRoomId, json } from './transport.js';

const ENABLED_RE = /^(1|true|yes|on)$/i;

export function roomFixturesEnabled(env) {
  return ENABLED_RE.test(String(env && env.ENABLE_TEST_FIXTURES || ''));
}

export async function handleTestRoomFixture(env, request) {
  if (!roomFixturesEnabled(env)) {
    return new Response('Not Found', { status: 404 });
  }
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' }
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const roomId = sanitizeRoomId(body.roomId || env.ROOM_NAME || 'global');
  const players = Array.isArray(body.players) ? body.players : null;
  if (!players) {
    return json({ ok: false, error: 'Fixture players array is required.' }, 400);
  }

  const id = env.GLOBAL_ARENA.idFromName(roomId);
  const stub = env.GLOBAL_ARENA.get(id);
  const doUrl = new URL('https://room/test-fixture');
  doUrl.searchParams.set('roomId', roomId);

  return stub.fetch(new Request(doUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ players })
  }));
}
