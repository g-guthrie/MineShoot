import { getSessionFromRequest } from './auth.js';
import { normalizeOpaqueId, randomId, sanitizeRoomId, validUsername } from './transport.js';
import {
  getPrivateRoomById,
  getPrivateRoomMember,
  isRegisteredPrivateRoomId,
  touchPrivateRoomById
} from './private-rooms.js';

export async function handleWsUpgrade(env, request, classPresets) {
  const url = new URL(request.url);
  const roomId = sanitizeRoomId(url.searchParams.get('room') || env.ROOM_NAME || 'global');
  const requestedPlayerId = String(url.searchParams.get('pid') || '').trim();
  const requestedPlayerName = String(url.searchParams.get('username') || '').trim();
  const requestedClassId = String(url.searchParams.get('classId') || '').trim();
  const requestedActorId = normalizeOpaqueId(url.searchParams.get('actorId') || '');
  const requestedActorName = String(url.searchParams.get('actorName') || '').trim();
  let session = await getSessionFromRequest(env, request);
  const actorId = session && session.userId
    ? normalizeOpaqueId(session.userId || '')
    : requestedActorId;
  const actorName = validUsername(requestedActorName)
    ? requestedActorName
    : (session && (session.displayName || session.username)
      ? String(session.displayName || session.username)
      : '');
  if (isRegisteredPrivateRoomId(roomId)) {
    const room = await getPrivateRoomById(env, roomId);
    if (!room || !room.room_id) {
      return new Response('Private room not found.', { status: 404 });
    }
    if (!actorId) {
      return new Response('Private room admission requires an actor identity.', { status: 403 });
    }
    const membership = await getPrivateRoomMember(env, actorId);
    if (!membership || String(membership.room_id || '') !== String(room.room_id || '')) {
      return new Response('Private room access denied.', { status: 403 });
    }
    await touchPrivateRoomById(env, room.room_id);
  }

  if (!session) {
    const rawGuestId = String(url.searchParams.get('uid') || '').trim();
    const rawGuestName = requestedPlayerName;
    const rawGuestClassId = requestedClassId;

    const guestId = /^[a-zA-Z0-9_-]{6,64}$/.test(rawGuestId) ? rawGuestId : randomId('gst');
    const guestName = validUsername(rawGuestName)
      ? rawGuestName
      : `Guest_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const guestClassId = classPresets && classPresets[rawGuestClassId] ? rawGuestClassId : 'abilities';

    session = {
      userId: guestId,
      username: guestName,
      classId: guestClassId
    };
  }

  const playerId = /^[a-zA-Z0-9_-]{6,64}$/.test(requestedPlayerId)
    ? requestedPlayerId
    : session.userId;
  const playerName = validUsername(requestedPlayerName)
    ? requestedPlayerName
    : (session && session.username ? session.username : `Player_${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  const playerClassId = classPresets && classPresets[requestedClassId]
    ? requestedClassId
    : (session.classId || 'abilities');

  const id = env.GLOBAL_ARENA.idFromName(roomId);
  const stub = env.GLOBAL_ARENA.get(id);

  const doUrl = new URL('https://room/connect');
  doUrl.searchParams.set('userId', playerId);
  doUrl.searchParams.set('username', playerName);
  doUrl.searchParams.set('classId', playerClassId);
  doUrl.searchParams.set('roomId', roomId);
  if (actorId) doUrl.searchParams.set('actorId', actorId);
  if (actorName) doUrl.searchParams.set('actorName', actorName);

  const headers = new Headers(request.headers);
  headers.set('X-User-Id', playerId);
  headers.set('X-Account-User-Id', session.userId);
  if (actorId) headers.set('X-Actor-Id', actorId);
  if (actorName) headers.set('X-Actor-Name', actorName);

  return stub.fetch(new Request(doUrl.toString(), {
    method: request.method,
    headers,
    body: request.body
  }));
}
