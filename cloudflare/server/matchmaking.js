import { json, sanitizeRoomId } from './transport.js';

const PUBLIC_ROOM_PREFIX = {
  ffa: 'ffa',
  tdm: 'tdm'
};
const PRIVATE_ROOM_PREFIX = 'private';
const DEFAULT_PUBLIC_ROOM_COUNT = 8;
const PUBLIC_ROOM_START_THRESHOLD = 8;
const PUBLIC_ROOM_SOFT_TARGET = 12;
const DEFAULT_PUBLIC_ROOM_CAPACITY = 16;
const PRIVATE_ROOM_CODE_LENGTH = 6;

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
  return mode === 'tdm' ? 'tdm' : 'ffa';
}

function publicRoomId(gameMode, index) {
  const prefix = PUBLIC_ROOM_PREFIX[normalizePublicGameMode(gameMode)] || PUBLIC_ROOM_PREFIX.ffa;
  return sanitizeRoomId(`${prefix}-${String(index + 1).padStart(2, '0')}`);
}

function privateRoomIdFromCode(code) {
  return sanitizeRoomId(`${PRIVATE_ROOM_PREFIX}-${String(code || '').toLowerCase()}`);
}

function privateRoomCodeFromId(roomId) {
  const normalized = sanitizeRoomId(roomId);
  if (normalized.startsWith(`${PRIVATE_ROOM_PREFIX}-`)) {
    return normalized.slice(PRIVATE_ROOM_PREFIX.length + 1).toUpperCase();
  }
  return normalized.toUpperCase();
}

function normalizePrivateRoomId(raw) {
  const input = String(raw || '').trim().toLowerCase();
  if (!input) return '';
  if (input.startsWith(`${PRIVATE_ROOM_PREFIX}-`)) {
    return sanitizeRoomId(input);
  }
  const compact = input.replace(/[^a-z0-9]/g, '');
  if (!compact) return '';
  return privateRoomIdFromCode(compact);
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

async function allocateQuickMatch(env, requestedGameMode) {
  const gameMode = normalizePublicGameMode(requestedGameMode);
  const roomCount = clampInt(env.PUBLIC_ROOM_COUNT, 1, 24, DEFAULT_PUBLIC_ROOM_COUNT);
  const roomCapacity = clampInt(env.PUBLIC_ROOM_CAPACITY, PUBLIC_ROOM_SOFT_TARGET, 32, DEFAULT_PUBLIC_ROOM_CAPACITY);
  const roomIds = [];

  for (let i = 0; i < roomCount; i++) {
    roomIds.push(publicRoomId(gameMode, i));
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

  const selected =
    chooseBestRoom(stateEntries, (entry) => !entry.matchStarted && entry.connectedPlayers > 0 && entry.connectedPlayers < PUBLIC_ROOM_START_THRESHOLD) ||
    chooseBestRoom(stateEntries, (entry) => entry.matchStarted && entry.connectedPlayers < PUBLIC_ROOM_SOFT_TARGET) ||
    chooseBestRoom(stateEntries, (entry) => !entry.matchStarted && entry.connectedPlayers < PUBLIC_ROOM_START_THRESHOLD) ||
    chooseBestRoom(stateEntries, (entry) => entry.matchStarted && entry.connectedPlayers < roomCapacity);

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

function createPrivateRoom() {
  const roomId = privateRoomIdFromCode(randomToken(PRIVATE_ROOM_CODE_LENGTH));
  return buildRoomPayload(roomId, 'private');
}

function joinPrivateRoom(rawRoomCode) {
  const roomId = normalizePrivateRoomId(rawRoomCode);
  if (!roomId || roomId === 'global') {
    return null;
  }
  return buildRoomPayload(roomId, 'private');
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
    return json(createPrivateRoom());
  }

  if (action === 'join') {
    const payload = joinPrivateRoom(body.roomCode || body.roomId || '');
    if (!payload) {
      return json({ ok: false, error: 'Enter a valid private room code.' }, 400);
    }
    return json(payload);
  }

  return json({ ok: false, error: 'Unsupported matchmaking action.' }, 400);
}
