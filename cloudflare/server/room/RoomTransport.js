import { sanitizeRoomId, json } from '../transport.js';
import {
  PUBLIC_ROOM_SOFT_TARGET,
  PUBLIC_ROOM_HARD_CAP
} from '../../../shared/matchmaking-config.js';

export function buildRoomStatePayload(room) {
  return {
    ok: true,
    roomId: room.roomName,
    gameMode: room.gameMode || '',
    matchStarted: !!(room.matchState && room.matchState.started),
    matchEnded: !!(room.matchState && room.matchState.ended),
    players: room.humanPlayerCount(),
    connectedPlayers: room.connectedHumanCount(),
    simPlayers: room.simulatedPlayerCount(),
    bots: room.bots.size,
    softTarget: PUBLIC_ROOM_SOFT_TARGET,
    hardCap: PUBLIC_ROOM_HARD_CAP
  };
}

export function findSocketForUserId(clients, userId, excludeWs = null) {
  for (const [clientWs, meta] of clients.entries()) {
    if (clientWs === excludeWs) continue;
    if (!meta || meta.userId !== userId) continue;
    return clientWs;
  }
  return null;
}

export function closeDuplicateSockets(clients, userId, keepWs) {
  for (const [clientWs, meta] of clients.entries()) {
    if (clientWs === keepWs) continue;
    if (!meta || meta.userId !== userId) continue;
    try {
      clientWs.close(4001, 'Superseded by a newer connection');
    } catch (_err) {
      // no-op
    }
  }
}

async function handleHttpRequest(room, request, url) {
  if (url.pathname === '/private-config' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    room.applyPrivateRoomConfig(body || {});
    return json({ ok: true, roomId: room.roomName, gameMode: room.gameMode || '' });
  }
  if (url.pathname === '/state') {
    return json(buildRoomStatePayload(room));
  }
  return new Response('Expected websocket upgrade', { status: 426 });
}

function handleWebSocketRequest(room, request, url) {
  room.syncRoomFixtures();

  const userId = url.searchParams.get('userId');
  const username = url.searchParams.get('username') || 'player';
  const classId = 'abilities';
  const actorId = String(url.searchParams.get('actorId') || request.headers.get('X-Actor-Id') || userId || '').trim();
  const actorName = String(url.searchParams.get('actorName') || request.headers.get('X-Actor-Name') || username || '').trim();

  if (!userId) {
    return new Response('Missing userId', { status: 400 });
  }
  if (room.privateRoomConfig && room.privateRoomConfig.teams.size > 0 && !room.privateRoomConfig.teams.has(actorId)) {
    return new Response('Private room access denied.', { status: 403 });
  }
  if (
    String(room.gameMode || '').toLowerCase() === 'lms' &&
    room.matchState &&
    room.matchState.started &&
    !room.matchState.ended &&
    !room.players.has(userId)
  ) {
    return new Response('LMS match already in progress.', { status: 409 });
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];

  room.ctx.acceptWebSocket(server);
  server.serializeAttachment({ userId, username, classId, actorId, actorName });

  room.ensurePlayer(userId, username, classId, actorId, actorName);
  room.clients.set(server, {
    userId,
    actorId,
    snapshotState: {
      entityStateById: new Map(),
      entityLastSentAtById: new Map()
    },
    snapshotBurstState: {
      untilAt: 0,
      lastSentAt: 0,
      entityIds: new Set()
    },
    lastProjectilesSerialized: '',
    lastFireZonesSerialized: ''
  });
  room.activeSocketByUserId.set(userId, server);
  closeDuplicateSockets(room.clients, userId, server);
  room.startPublicMatchIfReady();
  room.ensureTick();

  room.send(server, room.buildWelcomePayload(userId));
  room.broadcastSnapshot(true);

  return new Response(null, { status: 101, webSocket: client });
}

export async function handleRoomRequest(room, request) {
  const url = new URL(request.url);
  const nextRoomId = sanitizeRoomId(url.searchParams.get('roomId') || room.roomName || room.env.ROOM_NAME || 'global');
  const needsWorldRefresh =
    String(room.roomName || '') !== String(nextRoomId) ||
    !room.worldCollision ||
    !room.terrainSampler;
  room.roomName = nextRoomId;
  if (needsWorldRefresh) {
    room.refreshWorldMeta();
  }

  const upgradeHeader = String(request.headers.get('Upgrade') || '').trim().toLowerCase();
  if (upgradeHeader !== 'websocket') {
    return handleHttpRequest(room, request, url);
  }
  return handleWebSocketRequest(room, request, url);
}
