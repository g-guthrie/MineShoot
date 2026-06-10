import { getSessionFromRequest } from './auth.js';
import { sanitizeRoomId } from './transport.js';
import { consumeRateLimit, getClientIp, rateLimitedJson } from './rate-limit.js';
import {
  getPrivateRoomById,
  getPrivateRoomMember,
  isRegisteredPrivateRoomId
} from './private-rooms.js';
import {
  guestTokenSecret,
  readGuestTokenFromRequest,
  resolveLobbyWsIdentity,
  verifyGuestToken
} from './ws-identity.js';

const WS_LOBBY_RATE_WINDOW_MS = 60_000;
const WS_LOBBY_RATE_LIMIT = 30;

export async function handleWsLobbyUpgrade(env, request) {
  const requestIp = getClientIp(request);
  const requestLimit = consumeRateLimit(env, `ws-lobby:${requestIp}`, {
    limit: WS_LOBBY_RATE_LIMIT,
    windowMs: WS_LOBBY_RATE_WINDOW_MS
  });
  if (!requestLimit.ok) {
    return rateLimitedJson(requestLimit.retryAfterSec);
  }

  const url = new URL(request.url);
  const roomId = sanitizeRoomId(url.searchParams.get('room') || '');

  if (!roomId || !isRegisteredPrivateRoomId(roomId)) {
    return new Response('Lobby WebSocket requires a valid private room ID.', { status: 400 });
  }

  const session = await getSessionFromRequest(env, request).catch(() => null);
  const identity = resolveLobbyWsIdentity({ session, url });

  // Guest actor ids are client-supplied. When a guest token secret is
  // configured, a guest actorId is only trusted for lobby observation when it
  // arrives with a valid server-issued HMAC token; otherwise the connection
  // is treated as a fresh anonymous guest (which cannot be a room member).
  const secret = guestTokenSecret(env);
  if (!identity.isAuthenticated && secret) {
    const verifiedGuestActorId = await verifyGuestToken(secret, readGuestTokenFromRequest(env, request, url));
    identity.actorId = verifiedGuestActorId || '';
  }

  if (!identity.actorId) {
    return new Response('Missing actor identity.', { status: 400 });
  }

  const room = await getPrivateRoomById(env, roomId);
  if (!room || !room.room_id) {
    return new Response('Private room not found.', { status: 404 });
  }

  const membership = await getPrivateRoomMember(env, identity.actorId);
  if (!membership || String(membership.room_id || '') !== String(room.room_id || '')) {
    return new Response('Not a member of this private room.', { status: 403 });
  }

  const lobbyBinding = env.PRIVATE_ROOM_LOBBY_HUB || env.GLOBAL_ARENA;
  const id = lobbyBinding.idFromName(roomId);
  const stub = lobbyBinding.get(id);

  const doUrl = new URL('https://private-room-lobby/connect');
  doUrl.searchParams.set('roomId', roomId);
  doUrl.searchParams.set('actorId', identity.actorId);
  if (identity.actorName) doUrl.searchParams.set('actorName', identity.actorName);

  const headers = new Headers(request.headers);
  headers.set('X-Actor-Id', identity.actorId);

  return stub.fetch(new Request(doUrl.toString(), {
    method: request.method,
    headers,
    body: request.body
  }));
}
