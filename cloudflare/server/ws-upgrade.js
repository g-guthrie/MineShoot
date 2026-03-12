import { getSessionFromRequest } from './auth.js';
import { randomId, sanitizeRoomId, validUsername } from './transport.js';

export async function handleWsUpgrade(env, request, classPresets) {
  const url = new URL(request.url);
  const roomId = sanitizeRoomId(url.searchParams.get('room') || env.ROOM_NAME || 'global');

  let session = await getSessionFromRequest(env, request);
  if (!session) {
    const rawGuestId = String(url.searchParams.get('uid') || '').trim();
    const rawGuestName = String(url.searchParams.get('username') || '').trim();
    const rawGuestClassId = String(url.searchParams.get('classId') || '').trim();

    const guestId = /^[a-zA-Z0-9_-]{6,64}$/.test(rawGuestId) ? rawGuestId : randomId('gst');
    const guestName = validUsername(rawGuestName)
      ? rawGuestName
      : `Guest_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const guestClassId = classPresets && classPresets[rawGuestClassId] ? rawGuestClassId : 'default';

    session = {
      userId: guestId,
      username: guestName,
      classId: guestClassId
    };
  }

  const id = env.GLOBAL_ARENA.idFromName(roomId);
  const stub = env.GLOBAL_ARENA.get(id);

  const doUrl = new URL('https://room/connect');
  doUrl.searchParams.set('userId', session.userId);
  doUrl.searchParams.set('username', session.username);
  doUrl.searchParams.set('classId', session.classId || 'default');
  doUrl.searchParams.set('roomId', roomId);

  const headers = new Headers(request.headers);
  headers.set('X-User-Id', session.userId);

  return stub.fetch(new Request(doUrl.toString(), {
    method: request.method,
    headers,
    body: request.body
  }));
}
