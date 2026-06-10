import { getSessionFromRequest } from './auth.js';
import { sanitizeRoomId } from './transport.js';
import { consumeRateLimit, getClientIp, rateLimitedJson } from './rate-limit.js';
import {
  getPrivateRoomById,
  getPrivateRoomMember,
  isRegisteredPrivateRoomId,
  touchPrivateRoomById
} from './private-rooms.js';
import { consumePublicMatchAssignment } from './party-match-state.js';
import {
  guestTokenSecret,
  readGuestTokenFromRequest,
  resolveGameplayWsIdentity,
  verifyGuestToken
} from './ws-identity.js';
const WS_RATE_WINDOW_MS = 60_000;
const WS_RATE_LIMIT = 45;

export async function handleWsUpgrade(env, request, classPresets) {
  const requestIp = getClientIp(request);
  const requestLimit = consumeRateLimit(env, `ws:${requestIp}`, {
    limit: WS_RATE_LIMIT,
    windowMs: WS_RATE_WINDOW_MS
  });
  if (!requestLimit.ok) {
    return rateLimitedJson(requestLimit.retryAfterSec);
  }

  const url = new URL(request.url);
  const roomId = sanitizeRoomId(url.searchParams.get('room') || env.ROOM_NAME || 'global');
  const session = await getSessionFromRequest(env, request);
  const identity = resolveGameplayWsIdentity({
    session,
    url,
    classPresets
  });

  // Guest actor ids are client-supplied. When a guest token secret is
  // configured, a guest actorId is only trusted for identity-sensitive checks
  // (private-room admission, match assignments) when it arrives with a valid
  // server-issued HMAC token; otherwise the guest is treated as anonymous.
  // Public arena play continues to work without a token.
  const secret = guestTokenSecret(env);
  if (!identity.isAuthenticated && secret) {
    const verifiedGuestActorId = await verifyGuestToken(secret, readGuestTokenFromRequest(env, request, url));
    identity.actorId = verifiedGuestActorId || '';
  }

  if (isRegisteredPrivateRoomId(roomId)) {
    const room = await getPrivateRoomById(env, roomId);
    if (!room || !room.room_id) {
      return new Response('Private room not found.', { status: 404 });
    }
    if (!identity.actorId) {
      return new Response('Private room admission requires a verified actor identity.', { status: 403 });
    }
    const membership = await getPrivateRoomMember(env, identity.actorId);
    if (!membership || String(membership.room_id || '') !== String(room.room_id || '')) {
      return new Response('Private room access denied.', { status: 403 });
    }
    await touchPrivateRoomById(env, room.room_id);
  }

  const id = env.GLOBAL_ARENA.idFromName(roomId);
  const stub = env.GLOBAL_ARENA.get(id);

  const doUrl = new URL('https://room/connect');
  doUrl.searchParams.set('userId', identity.playerId);
  doUrl.searchParams.set('username', identity.playerName);
  doUrl.searchParams.set('classId', identity.playerClassId);
  doUrl.searchParams.set('roomId', roomId);
  if (identity.actorId) doUrl.searchParams.set('actorId', identity.actorId);
  if (identity.actorName) doUrl.searchParams.set('actorName', identity.actorName);

  const headers = new Headers(request.headers);
  headers.set('X-User-Id', identity.playerId);
  if (identity.accountUserId) headers.set('X-Account-User-Id', identity.accountUserId);
  if (identity.actorId) headers.set('X-Actor-Id', identity.actorId);
  if (identity.actorName) headers.set('X-Actor-Name', identity.actorName);

  const response = await stub.fetch(new Request(doUrl.toString(), {
    method: request.method,
    headers,
    body: request.body
  }));
  if (!isRegisteredPrivateRoomId(roomId) && identity.actorId && response && Number(response.status || 0) < 400) {
    await consumePublicMatchAssignment(env, identity.actorId, roomId).catch(() => null);
  }
  return response;
}
