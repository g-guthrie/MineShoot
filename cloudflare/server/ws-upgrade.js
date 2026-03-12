import { randomId, sanitizeRoomId } from './transport.js';

export async function handleWsUpgrade(env, request, classPresets) {
  const url = new URL(request.url);
  const roomId = sanitizeRoomId(url.searchParams.get('room') || env.ROOM_NAME || 'global');
  const session = {
    userId: randomId('gst'),
    username: `Guest_${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    classId: classPresets && classPresets.ffa ? 'ffa' : 'ffa'
  };

  const id = env.GLOBAL_ARENA.idFromName(roomId);
  const stub = env.GLOBAL_ARENA.get(id);

  const doUrl = new URL('https://room/connect');
  doUrl.searchParams.set('userId', session.userId);
  doUrl.searchParams.set('username', session.username);
  doUrl.searchParams.set('classId', session.classId || 'ffa');
  doUrl.searchParams.set('roomId', roomId);

  const headers = new Headers(request.headers);
  headers.set('X-User-Id', session.userId);

  return stub.fetch(new Request(doUrl.toString(), {
    method: request.method,
    headers,
    body: request.body
  }));
}
