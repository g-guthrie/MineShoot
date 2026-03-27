import { sanitizeRoomId, json } from '../transport.js';
import {
  PUBLIC_ROOM_SOFT_TARGET,
  PUBLIC_ROOM_HARD_CAP
} from '../../../shared/matchmaking-config.js';
import { isRegisteredPrivateRoomId } from '../private-rooms.js';

const ENABLED_RE = /^(1|true|yes|on)$/i;

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

function testFixturesEnabled(room) {
  return ENABLED_RE.test(String(room && room.env && room.env.ENABLE_TEST_FIXTURES || ''));
}

function resetFixtureInputState(entity) {
  if (!entity || !entity.inputState || typeof entity.inputState !== 'object') return;
  entity.inputState.forward = false;
  entity.inputState.backward = false;
  entity.inputState.left = false;
  entity.inputState.right = false;
  entity.inputState.jump = false;
  entity.inputState.sprint = false;
  entity.inputState.adsActive = false;
}

async function handleTestFixtureRequest(room, request) {
  if (!testFixturesEnabled(room)) {
    return new Response('Not Found', { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }
  if (!Array.isArray(body.players) || body.players.length === 0) {
    return json({ ok: false, error: 'Fixture players array is required.' }, 400);
  }

  const appliedPlayers = [];
  for (let i = 0; i < body.players.length; i++) {
    const fixture = body.players[i] || {};
    const userId = String(fixture.userId || '').trim();
    if (!userId) {
      return json({ ok: false, error: 'Fixture player userId is required.' }, 400);
    }

    const player = room.players.get(userId);
    if (!player) {
      return json({ ok: false, error: 'Fixture player not found.', userId }, 404);
    }

    const x = Number(fixture.x);
    const z = Number(fixture.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return json({ ok: false, error: 'Fixture player x/z must be finite numbers.', userId }, 400);
    }

    if (typeof room.applyEntitySpawnPoint === 'function') {
      room.applyEntitySpawnPoint(player, { x, z });
    } else {
      player.x = x;
      player.z = z;
    }

    if (Number.isFinite(Number(fixture.yaw))) player.yaw = Number(fixture.yaw);
    if (Number.isFinite(Number(fixture.pitch))) player.pitch = Number(fixture.pitch);
    if (String(fixture.weaponId || '').trim()) {
      player.weaponId = String(fixture.weaponId || '').trim();
    }
    if (fixture.clearSpawnShield) player.spawnShieldUntil = 0;

    player.velocityY = 0;
    player.isGrounded = true;
    player.jumpHoldTimer = 0;
    player.jumpHeldLast = false;
    player.disconnectedAt = 0;
    player.plannedSpawnPoint = null;
    if (Array.isArray(player.inputQueue)) player.inputQueue.length = 0;
    resetFixtureInputState(player);

    if (typeof room.seedEntityPoseHistory === 'function') {
      room.seedEntityPoseHistory(player);
    }

    appliedPlayers.push({
      userId: player.id,
      x: Number(player.x || 0),
      y: Number(player.y || 0),
      z: Number(player.z || 0),
      yaw: Number(player.yaw || 0),
      pitch: Number(player.pitch || 0),
      spawnShieldUntil: Number(player.spawnShieldUntil || 0),
      weaponId: String(player.weaponId || '')
    });
  }

  if (typeof room.broadcastSnapshot === 'function') {
    room.broadcastSnapshot(true);
  }

  return json({
    ok: true,
    roomId: room.roomName,
    players: appliedPlayers
  });
}

function handleLobbyWebSocketRequest(room, request, url) {
  const actorId = String(url.searchParams.get('actorId') || '').trim();
  if (!actorId) {
    return new Response('Missing actorId', { status: 400 });
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];

  room.ctx.acceptWebSocket(server);
  server.serializeAttachment({ actorId, isLobbyObserver: true });

  if (!room.lobbyObservers) room.lobbyObservers = new Map();
  room.lobbyObservers.set(server, { actorId });

  // Send current lobby state immediately
  if (room.buildLobbyBroadcastPayload) {
    room.send(server, room.buildLobbyBroadcastPayload());
  }

  return new Response(null, { status: 101, webSocket: client });
}

async function handleHttpRequest(room, request, url) {
  if (url.pathname === '/test-fixture' && request.method === 'POST') {
    return handleTestFixtureRequest(room, request);
  }
  if (url.pathname === '/private-config' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    room.applyPrivateRoomConfig(body || {});
    if (room.broadcastLobbyState) room.broadcastLobbyState();
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
  const classId = String(url.searchParams.get('classId') || request.headers.get('X-Class-Id') || 'ffa').trim() || 'ffa';
  const actorId = String(url.searchParams.get('actorId') || request.headers.get('X-Actor-Id') || userId || '').trim();
  const actorName = String(url.searchParams.get('actorName') || request.headers.get('X-Actor-Name') || username || '').trim();

  if (!userId) {
    return new Response('Missing userId', { status: 400 });
  }
  if (room.privateRoomConfig && room.privateRoomConfig.teams.size > 0 && !room.privateRoomConfig.teams.has(actorId)) {
    return new Response('Private room access denied.', { status: 403 });
  }

  const roomId = sanitizeRoomId(room.roomName || '');
  const isPrivate = isRegisteredPrivateRoomId(roomId);
  const isReconnect = room.players.has(userId);
  if (!isReconnect && !isPrivate) {
    const currentCount = room.connectedHumanCount();
    if (currentCount >= PUBLIC_ROOM_HARD_CAP) {
      return new Response('Room is full.', { status: 409 });
    }
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];

  room.ctx.acceptWebSocket(server);
  server.serializeAttachment({ userId, username, classId, actorId, actorName });

  room.ensurePlayer(userId, username, classId, actorId, actorName);
  if (!isPrivate && room.matchState && room.matchState.ended && typeof room.resetPublicRoomToIdle === 'function') {
    room.resetPublicRoomToIdle();
  }
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

function resolveRequestedRoomId(room, url) {
  const requestedRoomId = sanitizeRoomId(url.searchParams.get('roomId') || '');
  const currentRoomId = sanitizeRoomId(room.roomName || '');
  const defaultRoomId = sanitizeRoomId(room.env.ROOM_NAME || 'global');
  if (requestedRoomId && (!currentRoomId || currentRoomId === defaultRoomId)) {
    return requestedRoomId;
  }
  return currentRoomId || requestedRoomId || defaultRoomId;
}

export async function handleRoomRequest(room, request) {
  const url = new URL(request.url);
  const nextRoomId = resolveRequestedRoomId(room, url);
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
  if (url.pathname === '/lobby-connect') {
    return handleLobbyWebSocketRequest(room, request, url);
  }
  return handleWebSocketRequest(room, request, url);
}
