import { json, sanitizeRoomId } from './transport.js';
import { resolveActor } from './party.js';
import { handlePrivateRoomLobby } from './private-room-lobby.js';
import {
  PUBLIC_ROOM_PREFIX,
  DEFAULT_PUBLIC_ROOM_COUNT,
  DEFAULT_PUBLIC_OVERFLOW_ROOM_COUNT,
  PUBLIC_ROOM_START_THRESHOLD,
  publicRoomStartThresholdForMode,
  PUBLIC_ROOM_SOFT_TARGET,
  DEFAULT_PUBLIC_ROOM_CAPACITY
} from '../../shared/matchmaking-config.js';
import {
  privateRoomCodeFromId
} from '../../shared/private-room-codes.js';

function clampInt(value, min, max, fallback) {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, next));
}

function randomToken(length) {
  let out = '';
  while (out.length < length) {
    out += Math.random().toString(36).slice(2);
  }
  return out.slice(0, length).toLowerCase();
}

function normalizePublicGameMode(raw) {
  const mode = String(raw || 'ffa').trim().toLowerCase();
  if (mode === 'lms') return 'lms';
  return mode === 'tdm' ? 'tdm' : 'ffa';
}

function publicRoomId(gameMode, index) {
  const prefix = PUBLIC_ROOM_PREFIX[normalizePublicGameMode(gameMode)] || PUBLIC_ROOM_PREFIX.ffa;
  return sanitizeRoomId(`${prefix}-${String(index + 1).padStart(2, '0')}`);
}

function publicOverflowRoomId(gameMode, index) {
  const prefix = PUBLIC_ROOM_PREFIX[normalizePublicGameMode(gameMode)] || PUBLIC_ROOM_PREFIX.ffa;
  return sanitizeRoomId(`${prefix}-x${String(index + 1).padStart(2, '0')}`);
}

function buildRoomPayload(roomId, privacy, extras = null) {
  const payload = {
    ok: true,
    roomId,
    privacy,
    modeId: privacy === 'private' ? 'single_cloudflare' : 'cloud_multiplayer'
  };
  if (privacy === 'private') {
    payload.roomCode = privateRoomCodeFromId(roomId);
  }
  if (extras && typeof extras === 'object') {
    Object.assign(payload, extras);
  }
  return payload;
}

async function fetchRoomState(env, roomId) {
  const id = env.GLOBAL_ARENA.idFromName(roomId);
  const stub = env.GLOBAL_ARENA.get(id);
  const url = new URL('https://room/state');
  url.searchParams.set('roomId', roomId);

  try {
    const response = await stub.fetch(url.toString());
    if (!response.ok) return null;
    return await response.json();
  } catch (_err) {
    return null;
  }
}

function chooseBestRoom(entries, predicate) {
  const candidates = entries.filter(predicate).sort((a, b) => {
    if (b.connectedPlayers !== a.connectedPlayers) {
      return b.connectedPlayers - a.connectedPlayers;
    }
    return a.roomId.localeCompare(b.roomId);
  });
  return candidates.length ? candidates[0] : null;
}

function selectQuickMatchRoom(entries, gameMode, startThreshold, roomCapacity) {
  if (gameMode === 'lms') {
    return (
      chooseBestRoom(entries, (entry) => !entry.matchStarted && entry.connectedPlayers > 0 && entry.connectedPlayers < startThreshold) ||
      chooseBestRoom(entries, (entry) => !entry.matchStarted && entry.connectedPlayers < startThreshold)
    );
  }
  return (
    chooseBestRoom(entries, (entry) => !entry.matchStarted && entry.connectedPlayers > 0 && entry.connectedPlayers < startThreshold) ||
    chooseBestRoom(entries, (entry) => entry.matchStarted && entry.connectedPlayers < PUBLIC_ROOM_SOFT_TARGET) ||
    chooseBestRoom(entries, (entry) => !entry.matchStarted && entry.connectedPlayers < startThreshold) ||
    chooseBestRoom(entries, (entry) => entry.matchStarted && entry.connectedPlayers < roomCapacity)
  );
}

async function allocateQuickMatch(env, requestedGameMode) {
  const gameMode = normalizePublicGameMode(requestedGameMode);
  const startThreshold = publicRoomStartThresholdForMode(gameMode);
  const roomCount = clampInt(env.PUBLIC_ROOM_COUNT, 1, 24, DEFAULT_PUBLIC_ROOM_COUNT);
  const overflowRoomCount = clampInt(env.PUBLIC_OVERFLOW_ROOM_COUNT, 0, 24, DEFAULT_PUBLIC_OVERFLOW_ROOM_COUNT);
  const roomCapacity = clampInt(env.PUBLIC_ROOM_CAPACITY, PUBLIC_ROOM_SOFT_TARGET, 32, DEFAULT_PUBLIC_ROOM_CAPACITY);
  const roomIds = [];
  const overflowRoomIds = [];

  for (let i = 0; i < roomCount; i++) {
    roomIds.push(publicRoomId(gameMode, i));
  }
  for (let i = 0; i < overflowRoomCount; i++) {
    overflowRoomIds.push(publicOverflowRoomId(gameMode, i));
  }

  const stateEntries = await Promise.all(roomIds.map(async (roomId) => {
    const state = await fetchRoomState(env, roomId);
    const connectedPlayers = Math.max(0, Number(state && state.connectedPlayers) || 0);
    const players = Math.max(connectedPlayers, Number(state && state.players) || 0);
    const matchStarted = !!(state && state.matchStarted);
    return {
      roomId,
      connectedPlayers,
      players,
      matchStarted
    };
  }));
  const overflowStateEntries = await Promise.all(overflowRoomIds.map(async (roomId) => {
    const state = await fetchRoomState(env, roomId);
    const connectedPlayers = Math.max(0, Number(state && state.connectedPlayers) || 0);
    const players = Math.max(connectedPlayers, Number(state && state.players) || 0);
    const matchStarted = !!(state && state.matchStarted);
    return {
      roomId,
      connectedPlayers,
      players,
      matchStarted
    };
  }));

  const selected =
    selectQuickMatchRoom(stateEntries, gameMode, startThreshold, roomCapacity) ||
    selectQuickMatchRoom(overflowStateEntries, gameMode, startThreshold, roomCapacity);

  if (selected) {
    return buildRoomPayload(selected.roomId, 'public', {
      gameMode,
      players: selected.players,
      connectedPlayers: selected.connectedPlayers
    });
  }

  const overflowRoomId = sanitizeRoomId(
    `${PUBLIC_ROOM_PREFIX[gameMode]}-${Date.now().toString(36).slice(-4)}-${randomToken(2)}`
  );
  return buildRoomPayload(overflowRoomId, 'public', {
    gameMode,
    players: 0,
    connectedPlayers: 0
  });
}

async function delegatePrivateRoomAction(env, request, body, action) {
  const actor = await resolveActor(env, request, body).catch(() => null);
  if (!actor) {
    return {
      ok: false,
      status: 400,
      error: 'Private room requests require an actor identity.'
    };
  }
  const delegatedBody = {
    ...body,
    action,
    actorId: actor.id,
    displayName: actor.displayName
  };
  const delegatedRequest = new Request('https://internal.test/api/private-room', {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(delegatedBody)
  });
  const response = await handlePrivateRoomLobby(env, delegatedRequest);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !payload.ok) {
    return {
      ok: false,
      status: response.status || 400,
      error: (payload && payload.error) || 'Private room request failed.'
    };
  }
  const room = payload.state && payload.state.room ? payload.state.room : null;
  if (!room || !room.roomId) {
    return {
      ok: false,
      status: 502,
      error: 'Private room response missing room state.'
    };
  }
  return {
    ok: true,
    payload: buildRoomPayload(room.roomId, 'private', {
      roomCode: room.roomCode,
      gameMode: room.roomMode,
      roomPhase: room.roomPhase,
      state: payload.state,
      movedCount: Number(payload.movedCount || 0),
      skippedCount: Number(payload.skippedCount || 0)
    })
  };
}

export async function handleMatchmaking(env, request) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const action = String(body.action || '').trim().toLowerCase();

  if (action === 'quick') {
    const payload = await allocateQuickMatch(env, body.gameMode || 'ffa');
    return json(payload);
  }

  if (action === 'private') {
    const result = await delegatePrivateRoomAction(env, request, body, 'create');
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.status || 400);
    }
    return json(result.payload);
  }

  if (action === 'join') {
    const result = await delegatePrivateRoomAction(env, request, body, 'join');
    if (!result.ok) {
      if (result.status) {
        return json({ ok: false, error: result.error || 'Private room join failed.' }, result.status);
      }
      return json({ ok: false, error: 'Enter a valid private room code.' }, 400);
    }
    return json(result.payload);
  }

  return json({ ok: false, error: 'Unsupported matchmaking action.' }, 400);
}
