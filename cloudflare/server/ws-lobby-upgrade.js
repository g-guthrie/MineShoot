import { getSessionFromRequest } from './auth.js';
import { normalizeOpaqueId, sanitizeRoomId } from './transport.js';
import {
  getPrivateRoomById,
  getPrivateRoomMember,
  isRegisteredPrivateRoomId
} from './private-rooms.js';

export async function handleWsLobbyUpgrade(env, request) {
  const url = new URL(request.url);
  const roomId = sanitizeRoomId(url.searchParams.get('room') || '');

  if (!roomId || !isRegisteredPrivateRoomId(roomId)) {
    return new Response('Lobby WebSocket requires a valid private room ID.', { status: 400 });
  }

  // Resolve actor identity from session or query params
  const session = await getSessionFromRequest(env, request).catch(() => null);
  const actorId = session && session.userId
    ? normalizeOpaqueId(session.userId || '')
    : normalizeOpaqueId(url.searchParams.get('actorId') || '');

  if (!actorId) {
    return new Response('Missing actor identity.', { status: 400 });
  }

  // Validate room exists and actor is a member
  const room = await getPrivateRoomById(env, roomId);
  if (!room || !room.room_id) {
    return new Response('Private room not found.', { status: 404 });
  }

  const membership = await getPrivateRoomMember(env, actorId);
  if (!membership || String(membership.room_id || '') !== String(room.room_id || '')) {
    return new Response('Not a member of this private room.', { status: 403 });
  }

  // Forward WebSocket upgrade to the Durable Object
  const id = env.GLOBAL_ARENA.idFromName(roomId);
  const stub = env.GLOBAL_ARENA.get(id);

  const doUrl = new URL('https://room/lobby-connect');
  doUrl.searchParams.set('roomId', roomId);
  doUrl.searchParams.set('actorId', actorId);

  const headers = new Headers(request.headers);
  headers.set('X-Actor-Id', actorId);

  return stub.fetch(new Request(doUrl.toString(), {
    method: request.method,
    headers,
    body: request.body
  }));
}
