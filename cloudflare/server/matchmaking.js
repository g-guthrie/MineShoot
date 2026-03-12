import { json, sanitizeRoomId } from './transport.js';

const PUBLIC_ROOM_PREFIX = 'ffa';
const DEFAULT_PUBLIC_ROOM_COUNT = 8;
const PUBLIC_ROOM_START_THRESHOLD = 2;
const PUBLIC_ROOM_SOFT_TARGET = 12;
const DEFAULT_PUBLIC_ROOM_CAPACITY = 16;

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

function publicRoomId(index) {
  return sanitizeRoomId(`${PUBLIC_ROOM_PREFIX}-${String(index + 1).padStart(2, '0')}`);
}

function buildRoomPayload(roomId, extras = null) {
  const payload = {
    ok: true,
    roomId,
    privacy: 'public',
    modeId: 'cloud_multiplayer',
    gameMode: 'ffa'
  };
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

async function allocateQuickMatch(env) {
  const roomCount = clampInt(env.PUBLIC_ROOM_COUNT, 1, 24, DEFAULT_PUBLIC_ROOM_COUNT);
  const roomCapacity = clampInt(env.PUBLIC_ROOM_CAPACITY, PUBLIC_ROOM_SOFT_TARGET, 32, DEFAULT_PUBLIC_ROOM_CAPACITY);
  const roomIds = [];

  for (let i = 0; i < roomCount; i++) {
    roomIds.push(publicRoomId(i));
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
    chooseBestRoom(stateEntries, (entry) => entry.matchStarted && entry.connectedPlayers > 0 && entry.connectedPlayers < PUBLIC_ROOM_SOFT_TARGET) ||
    chooseBestRoom(stateEntries, (entry) => !entry.matchStarted && entry.connectedPlayers > 0 && entry.connectedPlayers < PUBLIC_ROOM_START_THRESHOLD) ||
    chooseBestRoom(stateEntries, (entry) => !entry.matchStarted && entry.connectedPlayers < PUBLIC_ROOM_START_THRESHOLD) ||
    chooseBestRoom(stateEntries, (entry) => entry.matchStarted && entry.connectedPlayers < roomCapacity);

  if (selected) {
    return buildRoomPayload(selected.roomId, {
      players: selected.players,
      connectedPlayers: selected.connectedPlayers
    });
  }

  const overflowRoomId = sanitizeRoomId(
    `${PUBLIC_ROOM_PREFIX}-${Date.now().toString(36).slice(-4)}-${randomToken(2)}`
  );
  return buildRoomPayload(overflowRoomId, {
    players: 0,
    connectedPlayers: 0
  });
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
  if (action !== 'quick') {
    return json({ ok: false, error: 'Only quick public FFA matchmaking is available.' }, 400);
  }

  const payload = await allocateQuickMatch(env);
  return json(payload);
}
