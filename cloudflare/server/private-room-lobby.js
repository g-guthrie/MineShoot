import { json } from './transport.js';
import { resolveActor, loadEligiblePartyMembers } from './party.js';
import {
  createPrivateRoomRecord,
  getPrivateRoomById,
  touchPrivateRoomById,
  initializePrivateRoomState,
  getPrivateRoomState,
  setPrivateRoomState,
  assignActorToPrivateRoom,
  getPrivateRoomMembers,
  getPrivateRoomMember,
  removeActorFromPrivateRoom,
  moveActorToPrivateRoomTeam
} from './private-rooms.js';
import {
  privateRoomIdFromCode,
  privateRoomCodeFromId,
  normalizePrivateRoomId
} from '../../shared/private-room-codes.js';
import { PRIVATE_ROOM_CODE_LENGTH } from '../../shared/matchmaking-config.js';

const ROOM_MODE_FFA = 'ffa';
const ROOM_MODE_TDM = 'tdm';
const ROOM_MODE_LMS = 'lms';
const ROOM_PHASE_LOBBY = 'lobby';
const ROOM_PHASE_ACTIVE = 'active';
const TEAM_ALPHA = 'alpha';
const TEAM_BRAVO = 'bravo';
const ROOM_MEMBER_MAX = 16;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function normalizeRoomMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === ROOM_MODE_TDM) return ROOM_MODE_TDM;
  if (mode === ROOM_MODE_LMS) return ROOM_MODE_LMS;
  return ROOM_MODE_FFA;
}

function normalizeTeamId(value) {
  return String(value || '').trim().toLowerCase() === TEAM_BRAVO ? TEAM_BRAVO : TEAM_ALPHA;
}

function randomCode(length) {
  let out = '';
  while (out.length < length) out += Math.random().toString(36).slice(2);
  return out.slice(0, length).toUpperCase();
}

async function syncPrivateRoomDurableObject(env, roomId, syncMode = 'lobby_update') {
  const roomState = await getPrivateRoomState(env, roomId);
  const members = await getPrivateRoomMembers(env, roomId);
  if (!roomState) return null;
  const id = env.GLOBAL_ARENA.idFromName(roomId);
  const stub = env.GLOBAL_ARENA.get(id);
  const url = new URL('https://room/private-config');
  url.searchParams.set('roomId', roomId);
  await stub.fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomMode: roomState.room_mode,
      roomPhase: roomState.room_phase,
      hostActorId: roomState.host_actor_id,
      syncMode: String(syncMode || 'lobby_update'),
      teams: members.map((member) => ({
        actorId: String(member.actor_id || ''),
        teamId: normalizeTeamId(member.team_id)
      }))
    })
  }).catch(() => null);
  return roomState;
}

async function buildLobbyState(env, actor, roomId) {
  const room = await getPrivateRoomById(env, roomId);
  const roomState = await getPrivateRoomState(env, roomId);
  if (!room || !roomState) return null;
  const members = await getPrivateRoomMembers(env, roomId);
  const hostId = String(roomState.host_actor_id || '');
  const teams = { alpha: [], bravo: [] };
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const entry = {
      id: String(member.actor_id || ''),
      displayName: String(member.display_name || member.actor_id || 'PLAYER'),
      teamId: normalizeTeamId(member.team_id),
      isHost: String(member.actor_id || '') === hostId
    };
    teams[entry.teamId].push(entry);
  }
  return {
    self: {
      actorId: String(actor.id || ''),
      displayName: String(actor.displayName || actor.id || 'PLAYER'),
      isHost: String(actor.id || '') === hostId
    },
    room: {
      roomId: String(room.room_id || roomId || ''),
      roomCode: privateRoomCodeFromId(room.room_id || roomId || ''),
      roomMode: normalizeRoomMode(roomState.room_mode),
      roomPhase: String(roomState.room_phase || ROOM_PHASE_LOBBY) === ROOM_PHASE_ACTIVE ? ROOM_PHASE_ACTIVE : ROOM_PHASE_LOBBY,
      hostActorId: hostId,
      memberCount: members.length,
      teams: teams,
      members: members.map((member) => ({
        id: String(member.actor_id || ''),
        displayName: String(member.display_name || member.actor_id || 'PLAYER'),
        teamId: normalizeTeamId(member.team_id),
        isHost: String(member.actor_id || '') === hostId
      }))
    }
  };
}

async function ensureRoomCapacity(env, roomId, nextActorIds) {
  const currentMembers = await getPrivateRoomMembers(env, roomId);
  const seen = new Set(currentMembers.map((member) => String(member.actor_id || '')));
  for (let i = 0; i < nextActorIds.length; i++) {
    seen.add(String(nextActorIds[i] || ''));
  }
  return seen.size <= ROOM_MEMBER_MAX;
}

async function detachActorFromPrivateRoom(env, actorId) {
  const existing = await getPrivateRoomMember(env, actorId);
  if (!existing) return null;
  const roomId = String(existing.room_id || '');
  await removeActorFromPrivateRoom(env, actorId);
  const remaining = await getPrivateRoomMembers(env, roomId);
  const roomState = await getPrivateRoomState(env, roomId);
  if (roomState && String(roomState.host_actor_id || '') === String(actorId || '')) {
    await setPrivateRoomState(env, roomId, { hostActorId: remaining.length > 0 ? String(remaining[0].actor_id || '') : '' });
  }
  await syncPrivateRoomDurableObject(env, roomId, 'lobby_update');
  return roomId;
}

async function pullEligiblePartyIntoRoom(env, roomId, actor, initialTeamId) {
  const eligible = await loadEligiblePartyMembers(env, actor);
  const actorIds = eligible.map((member) => String(member.id || ''));
  const canFit = await ensureRoomCapacity(env, roomId, actorIds);
  if (!canFit) {
    return { movedCount: 0, skippedCount: eligible.length, movedIds: [], skippedIds: actorIds };
  }

  const movedIds = [];
  for (let i = 0; i < eligible.length; i++) {
    const member = eligible[i];
    await detachActorFromPrivateRoom(env, member.id);
    await assignActorToPrivateRoom(env, roomId, member.id, member.displayName, initialTeamId);
    movedIds.push(String(member.id || ''));
  }

  return {
    movedCount: movedIds.length,
    skippedCount: 0,
    movedIds,
    skippedIds: []
  };
}

async function loadEligiblePartyMove(env, roomId, actor) {
  const eligible = await loadEligiblePartyMembers(env, actor);
  const actorIds = eligible.map((member) => String(member.id || ''));
  const canFit = await ensureRoomCapacity(env, roomId, actorIds);
  return { eligible, actorIds, canFit };
}

async function moveEligiblePartyIntoRoom(env, roomId, eligible, initialTeamId) {
  const movedIds = [];
  for (let i = 0; i < eligible.length; i++) {
    const member = eligible[i];
    await detachActorFromPrivateRoom(env, member.id);
    await assignActorToPrivateRoom(env, roomId, member.id, member.displayName, initialTeamId);
    movedIds.push(String(member.id || ''));
  }
  return {
    movedCount: movedIds.length,
    skippedCount: 0,
    movedIds,
    skippedIds: []
  };
}

async function ensureActorOwnsRoom(env, actor) {
  const existing = await getPrivateRoomMember(env, actor.id);
  return existing ? String(existing.room_id || '') : '';
}

async function createPrivateRoomWithMode(env, request, actor, roomMode) {
  const normalizedMode = normalizeRoomMode(roomMode);
  await detachActorFromPrivateRoom(env, actor.id);
  for (let attempt = 0; attempt < 12; attempt++) {
    const roomCode = randomCode(PRIVATE_ROOM_CODE_LENGTH);
    const roomId = privateRoomIdFromCode(roomCode);
    try {
      await createPrivateRoomRecord(env, roomId, roomCode, actor.id);
      await initializePrivateRoomState(
        env,
        roomId,
        normalizedMode,
        actor.id,
        normalizedMode === ROOM_MODE_TDM ? ROOM_PHASE_LOBBY : ROOM_PHASE_ACTIVE
      );
      const pull = await pullEligiblePartyIntoRoom(env, roomId, actor, TEAM_ALPHA);
      await touchPrivateRoomById(env, roomId);
      await syncPrivateRoomDurableObject(env, roomId, 'lobby_update');
      const state = await buildLobbyState(env, actor, roomId);
      return {
        ok: true,
        state,
        movedCount: pull.movedCount,
        skippedCount: pull.skippedCount,
        autoStart: normalizedMode !== ROOM_MODE_TDM
      };
    } catch (_err) {
      // retry collision
    }
  }
  throw new Error('Private room creation failed.');
}

async function joinPrivateRoomWithParty(env, actor, rawRoomCode) {
  const roomId = normalizePrivateRoomId(rawRoomCode);
  if (!roomId || roomId === 'global') {
    return { ok: false, status: 400, error: 'Enter a valid private room code.' };
  }
  const room = await getPrivateRoomById(env, roomId);
  const roomState = await getPrivateRoomState(env, roomId);
  if (!room || !roomState) {
    return { ok: false, status: 404, error: 'Private room code not found.' };
  }
  const eligibility = await loadEligiblePartyMove(env, roomId, actor);
  if (!eligibility.canFit) {
    return {
      ok: false,
      status: 409,
      error: 'That private room is full.',
      skippedCount: eligibility.actorIds.length
    };
  }
  const pull = await moveEligiblePartyIntoRoom(env, roomId, eligibility.eligible, TEAM_ALPHA);
  await touchPrivateRoomById(env, roomId);
  await syncPrivateRoomDurableObject(env, roomId, 'lobby_update');
  const state = await buildLobbyState(env, actor, roomId);
  return {
    ok: true,
    state,
    movedCount: pull.movedCount,
    skippedCount: pull.skippedCount,
    autoStart: normalizeRoomMode(roomState.room_mode) !== ROOM_MODE_TDM
  };
}

async function randomizeTeams(env, roomId) {
  const members = await getPrivateRoomMembers(env, roomId);
  const sorted = members.slice().sort((a, b) => String(a.actor_id || '').localeCompare(String(b.actor_id || '')));
  const splitAt = Math.ceil(sorted.length / 2);
  for (let i = 0; i < sorted.length; i++) {
    await moveActorToPrivateRoomTeam(env, sorted[i].actor_id, i < splitAt ? TEAM_ALPHA : TEAM_BRAVO);
  }
}

async function leavePrivateRoom(env, actor) {
  return detachActorFromPrivateRoom(env, actor.id);
}

export async function handlePrivateRoomLobby(env, request) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
  }

  if (request.method === 'GET') {
    const actor = await resolveActor(env, request, null);
    if (!actor) return json({ ok: false, error: 'Missing actor identity.' }, 400);
    const roomId = await ensureActorOwnsRoom(env, actor);
    if (!roomId) {
      return json({ ok: true, state: null });
    }
    const state = await buildLobbyState(env, actor, roomId);
    return json({ ok: true, state });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }
  const actor = await resolveActor(env, request, body);
  if (!actor) return json({ ok: false, error: 'Missing actor identity.' }, 400);

  const action = String(body.action || '').trim().toLowerCase();

  if (action === 'create') {
    const result = await createPrivateRoomWithMode(env, request, actor, body.roomMode || ROOM_MODE_FFA);
    return json(result);
  }

  if (action === 'join') {
    const result = await joinPrivateRoomWithParty(env, actor, body.roomCode || body.roomId || '');
    if (!result.ok) return json({ ok: false, error: result.error }, result.status || 400);
    return json(result);
  }

  const currentRoomId = await ensureActorOwnsRoom(env, actor);
  if (!currentRoomId) {
    return json({ ok: false, error: 'You are not in a private room.' }, 400);
  }
  const currentState = await getPrivateRoomState(env, currentRoomId);
  if (!currentState) {
    return json({ ok: false, error: 'Private room state missing.' }, 404);
  }
  const isHost = String(currentState.host_actor_id || '') === String(actor.id || '');

  if (action === 'state') {
    const state = await buildLobbyState(env, actor, currentRoomId);
    return json({ ok: true, state });
  }

  if (action === 'leave') {
    await leavePrivateRoom(env, actor);
    return json({ ok: true, state: null });
  }

  if (action === 'set_mode') {
    if (!isHost) return json({ ok: false, error: 'Only the room host can change mode.' }, 403);
    const nextMode = normalizeRoomMode(body.roomMode || ROOM_MODE_FFA);
    await setPrivateRoomState(env, currentRoomId, {
      roomMode: nextMode,
      roomPhase: nextMode === ROOM_MODE_TDM ? ROOM_PHASE_LOBBY : ROOM_PHASE_ACTIVE
    });
    await syncPrivateRoomDurableObject(env, currentRoomId, 'lobby_update');
    const state = await buildLobbyState(env, actor, currentRoomId);
    return json({ ok: true, state });
  }

  if (action === 'randomize') {
    if (!isHost) return json({ ok: false, error: 'Only the room host can randomize teams.' }, 403);
    await randomizeTeams(env, currentRoomId);
    await syncPrivateRoomDurableObject(env, currentRoomId, 'lobby_update');
    const state = await buildLobbyState(env, actor, currentRoomId);
    return json({ ok: true, state });
  }

  if (action === 'move_member') {
    if (!isHost) return json({ ok: false, error: 'Only the room host can move players.' }, 403);
    const targetId = String(body.targetId || '');
    const member = await getPrivateRoomMember(env, targetId);
    if (!member || String(member.room_id || '') !== currentRoomId) {
      return json({ ok: false, error: 'That player is not in this room.' }, 404);
    }
    await moveActorToPrivateRoomTeam(env, targetId, normalizeTeamId(body.teamId || TEAM_ALPHA));
    await syncPrivateRoomDurableObject(env, currentRoomId, 'lobby_update');
    const state = await buildLobbyState(env, actor, currentRoomId);
    return json({ ok: true, state });
  }

  if (action === 'start') {
    if (!isHost) return json({ ok: false, error: 'Only the room host can start the match.' }, 403);
    await setPrivateRoomState(env, currentRoomId, { roomPhase: ROOM_PHASE_ACTIVE });
    await syncPrivateRoomDurableObject(env, currentRoomId, 'lobby_update');
    const state = await buildLobbyState(env, actor, currentRoomId);
    return json({ ok: true, state });
  }

  return json({ ok: false, error: 'Unsupported private-room action.' }, 400);
}

export async function primePrivateRoomDurableObject(env, roomId) {
  if (!roomId) return null;
  return syncPrivateRoomDurableObject(env, roomId, 'hydrate');
}
