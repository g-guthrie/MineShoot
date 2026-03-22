import { json, sanitizeRoomId } from './transport.js';
import { consumeRateLimit, getClientIp, rateLimitedJson } from './rate-limit.js';
import { loadCurrentPartyContext, loadEligiblePartyMembers, resolveActor } from './party.js';
import { handlePrivateRoomLobby } from './private-room-lobby.js';
import {
  acquirePublicMatchQueueLock,
  assignPublicMatchToActors,
  loadPublicMatchAssignment,
  releasePublicMatchQueueLock
} from './party-match-state.js';
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

const MATCHMAKING_RATE_WINDOW_MS = 60_000;
const MATCHMAKING_RATE_LIMIT = 30;

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

function buildPartyMatchQueueKey(actor, partyContext) {
  if (partyContext && partyContext.party && partyContext.party.id) {
    return `party:${String(partyContext.party.id || '').trim().toLowerCase()}`;
  }
  return `solo:${String(actor && actor.id ? actor.id : '').trim().toLowerCase()}`;
}

function buildPartyMemberSnapshot(memberIds) {
  return memberIds
    .map((memberId) => String(memberId || '').trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
}

async function loadAssignedRoomForParty(env, memberIds) {
  const ids = Array.isArray(memberIds) ? memberIds.map((memberId) => String(memberId || '').trim()).filter(Boolean) : [];
  if (!ids.length) return null;
  const assignments = await Promise.all(ids.map((memberId) => loadPublicMatchAssignment(env, memberId)));
  const present = [];
  const missingActorIds = [];
  for (let i = 0; i < ids.length; i++) {
    const assignment = assignments[i];
    if (assignment && assignment.room_id) {
      present.push(assignment);
    } else {
      missingActorIds.push(ids[i]);
    }
  }
  if (!present.length) return null;
  const first = present[0];
  const roomId = String(first.room_id || '');
  const gameMode = String(first.game_mode || 'ffa');
  const allMatch = present.every((assignment) => (
    String(assignment.room_id || '') === roomId &&
    String(assignment.game_mode || 'ffa') === gameMode
  ));
  if (!allMatch) {
    return {
      conflict: true
    };
  }
  const roomState = await fetchRoomState(env, roomId);
  const out = {
    roomId,
    gameMode,
    assignedActorIds: present.map((assignment) => String(assignment.actor_id || '')).filter(Boolean),
    missingActorIds
  };
  if (roomState) {
    out.players = Math.max(0, Number(roomState.players) || 0);
    out.connectedPlayers = Math.max(0, Number(roomState.connectedPlayers) || 0);
  }
  return out;
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

function selectQuickMatchRoom(entries, gameMode, startThreshold, roomCapacity, groupSize) {
  const size = Math.max(1, Number(groupSize) || 1);
  return (
    chooseBestRoom(entries, (entry) => !entry.matchStarted && entry.connectedPlayers > 0 && (entry.connectedPlayers + size) <= startThreshold) ||
    chooseBestRoom(entries, (entry) => entry.matchStarted && (entry.connectedPlayers + size) <= PUBLIC_ROOM_SOFT_TARGET) ||
    chooseBestRoom(entries, (entry) => !entry.matchStarted && (entry.connectedPlayers + size) <= startThreshold) ||
    chooseBestRoom(entries, (entry) => entry.matchStarted && (entry.connectedPlayers + size) <= roomCapacity)
  );
}

async function allocateQuickMatch(env, requestedGameMode, groupSize = 1) {
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
    selectQuickMatchRoom(stateEntries, gameMode, startThreshold, roomCapacity, groupSize) ||
    selectQuickMatchRoom(overflowStateEntries, gameMode, startThreshold, roomCapacity, groupSize);

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

  const requestIp = getClientIp(request);
  const requestLimit = consumeRateLimit(env, `matchmaking:${requestIp}`, {
    limit: MATCHMAKING_RATE_LIMIT,
    windowMs: MATCHMAKING_RATE_WINDOW_MS
  });
  if (!requestLimit.ok) {
    return rateLimitedJson(requestLimit.retryAfterSec);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const action = String(body.action || '').trim().toLowerCase();

  if (action === 'quick') {
    const actor = await resolveActor(env, request, body).catch(() => null);
    if (!actor) {
      const legacyPayload = await allocateQuickMatch(env, body.gameMode || 'ffa', 1);
      return json(legacyPayload);
    }
    const partyContext = await loadCurrentPartyContext(env, actor);
    const currentPartyMembers = Array.isArray(partyContext.members) ? partyContext.members : [];
    const currentMemberIds = currentPartyMembers.map((member) => String(member.id || '')).filter(Boolean);
    const partySize = Math.max(1, currentMemberIds.length);
    const queueKey = buildPartyMatchQueueKey(actor, partyContext);
    const partySnapshot = buildPartyMemberSnapshot(currentMemberIds);

    if (partySize > 1) {
      const selfMember = currentPartyMembers.find((member) => String(member.id || '') === String(actor.id || ''));
      if (!selfMember || !selfMember.isLeader) {
        return json({ ok: false, error: 'Only the party leader can start public matchmaking.' }, 403);
      }
      const eligiblePartyMembers = await loadEligiblePartyMembers(env, actor);
      if (eligiblePartyMembers.length !== partySize) {
        return json({ ok: false, error: 'All party members must be in the menu to queue together.' }, 409);
      }
    }

    const existingAssignment = await loadAssignedRoomForParty(env, currentMemberIds);
    if (existingAssignment && existingAssignment.conflict) {
      return json({ ok: false, error: 'That party already has a different public match assignment.' }, 409);
    }
    if (existingAssignment && existingAssignment.roomId) {
      if (existingAssignment.missingActorIds && existingAssignment.missingActorIds.length) {
        await assignPublicMatchToActors(
          env,
          existingAssignment.missingActorIds,
          existingAssignment.roomId,
          existingAssignment.gameMode || body.gameMode || 'ffa',
          actor.id
        );
      }
      const payload = buildRoomPayload(existingAssignment.roomId, 'public', {
        gameMode: existingAssignment.gameMode || body.gameMode || 'ffa'
      });
      if (Number.isFinite(existingAssignment.players)) {
        payload.players = existingAssignment.players;
      }
      if (Number.isFinite(existingAssignment.connectedPlayers)) {
        payload.connectedPlayers = existingAssignment.connectedPlayers;
      }
      return json(payload);
    }

    const claimed = await acquirePublicMatchQueueLock(
      env,
      queueKey,
      actor.id,
      partyContext && partyContext.party ? partyContext.party.id : '',
      partySize,
      body.gameMode || 'ffa'
    );
    if (!claimed.ok) {
      if (claimed.pending) {
        return json({ ok: false, error: 'Public matchmaking is already starting for this party.' }, 409);
      }
      return json({ ok: false, error: claimed.error || 'Public matchmaking is unavailable.' }, claimed.status || 400);
    }

    let lockReleased = false;
    try {
      const lockedContext = await loadCurrentPartyContext(env, actor);
      const lockedMembers = Array.isArray(lockedContext.members) ? lockedContext.members : [];
      const lockedMemberIds = lockedMembers.map((member) => String(member.id || '')).filter(Boolean);
      const lockedQueueKey = buildPartyMatchQueueKey(actor, lockedContext);
      const lockedSnapshot = buildPartyMemberSnapshot(lockedMemberIds);
      if (lockedQueueKey !== queueKey || lockedSnapshot !== partySnapshot) {
        return json({ ok: false, error: 'Your party changed before matchmaking could start. Try again.' }, 409);
      }

      const payload = await allocateQuickMatch(env, body.gameMode || 'ffa', partySize);

      const postAllocContext = await loadCurrentPartyContext(env, actor);
      const postAllocMembers = Array.isArray(postAllocContext.members) ? postAllocContext.members : [];
      const postAllocMemberIds = postAllocMembers.map((member) => String(member.id || '')).filter(Boolean);
      const postAllocQueueKey = buildPartyMatchQueueKey(actor, postAllocContext);
      const postAllocSnapshot = buildPartyMemberSnapshot(postAllocMemberIds);
      if (postAllocQueueKey !== queueKey || postAllocSnapshot !== partySnapshot) {
        return json({ ok: false, error: 'Your party changed before matchmaking could finish. Try again.' }, 409);
      }

      const eligibleMembers = partySize > 1 ? await loadEligiblePartyMembers(env, actor) : currentPartyMembers;
      await assignPublicMatchToActors(
        env,
        eligibleMembers.map((member) => String(member.id || '')),
        payload.roomId,
        payload.gameMode || body.gameMode || 'ffa',
        actor.id
      );
      await releasePublicMatchQueueLock(env, queueKey);
      lockReleased = true;
      return json(payload);
    } finally {
      if (!lockReleased) {
        await releasePublicMatchQueueLock(env, queueKey).catch(() => null);
      }
    }
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
