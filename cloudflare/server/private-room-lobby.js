import { json } from './transport.js';
import { resolveActor, loadCurrentPartyMembers } from './party.js';
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
  deletePrivateRoom,
  removeActorFromPrivateRoom,
  moveActorToPrivateRoomTeam
} from './private-rooms.js';
import { clearPrivateRoomInvitesByRoom, clearPublicMatchAssignment, upsertPrivateRoomInvite } from './party-match-state.js';
import {
  privateRoomIdFromCode,
  privateRoomCodeFromId,
  normalizePrivateRoomId
} from '../../shared/private-room-codes.js';
import { PRIVATE_ROOM_CODE_LENGTH } from '../../shared/matchmaking-config.js';

const ROOM_MODE_FFA = 'ffa';
const ROOM_MODE_TDM = 'tdm';
const ROOM_PHASE_LOBBY = 'lobby';
const ROOM_PHASE_ACTIVE = 'active';
const TEAM_ALPHA = 'alpha';
const TEAM_BRAVO = 'bravo';
const TEAM_CHARLIE = 'charlie';
const TEAM_DELTA = 'delta';
const ROOM_TEAM_IDS = [TEAM_ALPHA, TEAM_BRAVO, TEAM_CHARLIE, TEAM_DELTA];
const ROOM_MEMBER_MAX = 16;
const SYNC_MODE_LOBBY = 'lobby_update';
const SYNC_MODE_HYDRATE = 'hydrate';
const JOIN_RATE_CACHE_MAX = 5000;

// Rate limiting for join attempts (per-IP, in-memory)
const JOIN_RATE_WINDOW_MS = 60_000;
const JOIN_RATE_MAX = 10;
const joinAttempts = new Map();

function checkJoinRateLimit(ip) {
  const now = Date.now();
  const key = String(ip || 'unknown');
  let entry = joinAttempts.get(key);
  if (!entry || (now - entry.windowStart) > JOIN_RATE_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    joinAttempts.set(key, entry);
  }
  entry.count += 1;
  // Evict stale entries periodically
  if (joinAttempts.size > JOIN_RATE_CACHE_MAX) {
    for (const [k, v] of joinAttempts) {
      if ((now - v.windowStart) > JOIN_RATE_WINDOW_MS) joinAttempts.delete(k);
    }
  }
  return entry.count <= JOIN_RATE_MAX;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function normalizeRoomMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === ROOM_MODE_TDM) return ROOM_MODE_TDM;
  return ROOM_MODE_FFA;
}

function normalizeTeamCount(value) {
  const parsed = Math.round(Number(value) || 2);
  return Math.max(2, Math.min(4, parsed));
}

function activeTeamIds(teamCount) {
  return ROOM_TEAM_IDS.slice(0, normalizeTeamCount(teamCount));
}

function normalizeTeamId(value, teamCount = 2) {
  const normalized = String(value || '').trim().toLowerCase();
  const allowed = activeTeamIds(teamCount);
  return allowed.indexOf(normalized) >= 0 ? normalized : TEAM_ALPHA;
}

function randomCode(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function syncPrivateRoomDurableObject(env, roomId, syncMode = SYNC_MODE_LOBBY) {
  const roomState = await getPrivateRoomState(env, roomId);
  const members = await getPrivateRoomMembers(env, roomId);
  if (!roomState) return null;
  const teamCount = normalizeTeamCount(roomState.team_count);
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
      teamCount,
      syncMode: String(syncMode || 'lobby_update'),
      teams: members.map((member) => ({
        actorId: String(member.actor_id || ''),
        teamId: normalizeTeamId(member.team_id, teamCount),
        displayName: String(member.display_name || member.actor_id || 'PLAYER'),
        isHost: String(member.actor_id || '') === String(roomState.host_actor_id || '')
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
  const teamCount = normalizeTeamCount(roomState.team_count);
  const teams = {
    alpha: [],
    bravo: [],
    charlie: [],
    delta: []
  };
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const entry = {
      id: String(member.actor_id || ''),
      displayName: String(member.display_name || member.actor_id || 'PLAYER'),
      teamId: normalizeTeamId(member.team_id, teamCount),
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
      teamCount,
      teamIds: activeTeamIds(teamCount),
      inviteLocked: !!Number(roomState.invite_locked || 0),
      hostActorId: hostId,
      canToggleInviteLock: String(actor.id || '') === hostId,
      canInviteParty: String(actor.id || '') === hostId || !Number(roomState.invite_locked || 0),
      memberCount: members.length,
      teams: teams,
      members: members.map((member) => ({
        id: String(member.actor_id || ''),
        displayName: String(member.display_name || member.actor_id || 'PLAYER'),
        teamId: normalizeTeamId(member.team_id, teamCount),
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
  if (remaining.length === 0) {
    await Promise.all([
      clearPrivateRoomInvitesByRoom(env, roomId),
      deletePrivateRoom(env, roomId)
    ]);
    return roomId;
  }
  const roomState = await getPrivateRoomState(env, roomId);
  if (roomState && String(roomState.host_actor_id || '') === String(actorId || '')) {
    await setPrivateRoomState(env, roomId, { hostActorId: remaining.length > 0 ? String(remaining[0].actor_id || '') : '' });
  }
  await syncPrivateRoomDurableObject(env, roomId, SYNC_MODE_LOBBY);
  return roomId;
}

async function ensureActorOwnsRoom(env, actor) {
  const existing = await getPrivateRoomMember(env, actor.id);
  return existing ? String(existing.room_id || '') : '';
}

async function createPrivateRoomWithMode(env, request, actor, roomMode) {
  const normalizedMode = normalizeRoomMode(roomMode);
  await clearPublicMatchAssignment(env, actor.id);
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
        ROOM_PHASE_LOBBY
      );
      await assignActorToPrivateRoom(env, roomId, actor.id, actor.displayName, TEAM_ALPHA);
      await touchPrivateRoomById(env, roomId);
      await syncPrivateRoomDurableObject(env, roomId, SYNC_MODE_LOBBY);
      const state = await buildLobbyState(env, actor, roomId);
      return {
        ok: true,
        state,
        movedCount: 1,
        skippedCount: 0,
        autoStart: false
      };
    } catch (_err) {
      // retry collision
    }
  }
  throw new Error('Private room creation failed.');
}

function countMembersPerTeam(members, allowed) {
  const counts = {};
  for (let i = 0; i < allowed.length; i++) counts[allowed[i]] = 0;
  for (let i = 0; i < members.length; i++) {
    const teamId = String(members[i] && members[i].team_id || '').trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(counts, teamId)) counts[teamId] += 1;
  }
  return counts;
}

function pickBalancedTeamId(members, allowed) {
  const counts = countMembersPerTeam(members, allowed);
  let bestTeamId = allowed[0] || TEAM_ALPHA;
  let bestCount = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < allowed.length; i++) {
    const teamId = allowed[i];
    const nextCount = Math.max(0, Number(counts[teamId] || 0));
    if (nextCount < bestCount) {
      bestCount = nextCount;
      bestTeamId = teamId;
    }
  }
  return bestTeamId;
}

async function joinPrivateRoomSolo(env, actor, rawRoomCode) {
  const roomId = normalizePrivateRoomId(rawRoomCode);
  if (!roomId || roomId === 'global') {
    return { ok: false, status: 400, error: 'Enter a valid private room code.' };
  }
  const room = await getPrivateRoomById(env, roomId);
  const roomState = await getPrivateRoomState(env, roomId);
  if (!room || !roomState) {
    return { ok: false, status: 404, error: 'Private room code not found.' };
  }
  const actorIds = [String(actor.id || '')];
  const canFit = await ensureRoomCapacity(env, roomId, actorIds);
  if (!canFit) {
    return {
      ok: false,
      status: 409,
      error: 'That private room is full.',
      skippedCount: actorIds.length
    };
  }
  await clearPublicMatchAssignment(env, actor.id);
  await detachActorFromPrivateRoom(env, actor.id);
  const members = await getPrivateRoomMembers(env, roomId);
  const allowed = activeTeamIds(roomState.team_count);
  await assignActorToPrivateRoom(env, roomId, actor.id, actor.displayName, pickBalancedTeamId(members, allowed));
  await touchPrivateRoomById(env, roomId);
  await syncPrivateRoomDurableObject(env, roomId, SYNC_MODE_LOBBY);
  const state = await buildLobbyState(env, actor, roomId);
  return {
    ok: true,
    state,
    movedCount: 1,
    skippedCount: 0,
    autoStart: false
  };
}

async function invitePartyToPrivateRoom(env, actor, roomId, roomState) {
  const isHost = String(roomState.host_actor_id || '') === String(actor.id || '');
  const inviteLocked = !!Number(roomState.invite_locked || 0);
  if (!isHost && inviteLocked) {
    return { ok: false, status: 403, error: 'Only the room host can invite parties while room invites are locked.' };
  }
  const partyMembers = await loadCurrentPartyMembers(env, actor);
  const roomMembers = await getPrivateRoomMembers(env, roomId);
  const roomMemberIds = new Set(roomMembers.map((member) => String(member.actor_id || '')));
  let invitedCount = 0;
  for (let i = 0; i < partyMembers.length; i++) {
    const member = partyMembers[i];
    const memberId = String(member && member.id || '');
    if (!memberId || memberId === String(actor.id || '') || roomMemberIds.has(memberId)) continue;
    await upsertPrivateRoomInvite(env, roomId, actor.id, memberId);
    invitedCount += 1;
  }
  await touchPrivateRoomById(env, roomId);
  const state = await buildLobbyState(env, actor, roomId);
  return {
    ok: true,
    state,
    invitedCount
  };
}

async function normalizeMemberTeams(env, roomId, teamCount) {
  const members = await getPrivateRoomMembers(env, roomId);
  const allowed = activeTeamIds(teamCount);
  const counts = countMembersPerTeam(members, allowed);
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (allowed.indexOf(String(member.team_id || '').toLowerCase()) >= 0) continue;
    let bestTeamId = allowed[0];
    let bestCount = Number.MAX_SAFE_INTEGER;
    for (let j = 0; j < allowed.length; j++) {
      const teamId = allowed[j];
      const nextCount = Math.max(0, Number(counts[teamId] || 0));
      if (nextCount < bestCount) {
        bestCount = nextCount;
        bestTeamId = teamId;
      }
    }
    await moveActorToPrivateRoomTeam(env, member.actor_id, bestTeamId);
    counts[bestTeamId] = Math.max(0, Number(counts[bestTeamId] || 0)) + 1;
  }
}

function shuffleArray(arr) {
  const bytes = crypto.getRandomValues(new Uint8Array(arr.length));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

async function randomizeTeams(env, roomId, teamCount) {
  const members = await getPrivateRoomMembers(env, roomId);
  const allowed = activeTeamIds(teamCount);
  shuffleArray(members);
  const counts = {};
  for (let i = 0; i < allowed.length; i++) counts[allowed[i]] = 0;
  for (let i = 0; i < members.length; i++) {
    let bestTeamId = allowed[0];
    let bestCount = Number.MAX_SAFE_INTEGER;
    for (let j = 0; j < allowed.length; j++) {
      const teamId = allowed[j];
      const nextCount = Math.max(0, Number(counts[teamId] || 0));
      if (nextCount < bestCount) {
        bestCount = nextCount;
        bestTeamId = teamId;
      }
    }
    await moveActorToPrivateRoomTeam(env, members[i].actor_id, bestTeamId);
    counts[bestTeamId] += 1;
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
    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
    if (!checkJoinRateLimit(clientIp)) {
      return json({ ok: false, error: 'Too many join attempts. Try again in a minute.' }, 429);
    }
    const result = await joinPrivateRoomSolo(env, actor, body.roomCode || body.roomId || '');
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
      roomPhase: ROOM_PHASE_LOBBY
    });
    await normalizeMemberTeams(env, currentRoomId, Number(currentState.team_count || 2));
    await syncPrivateRoomDurableObject(env, currentRoomId, SYNC_MODE_LOBBY);
    const state = await buildLobbyState(env, actor, currentRoomId);
    return json({ ok: true, state });
  }

  if (action === 'set_team_count') {
    if (!isHost) return json({ ok: false, error: 'Only the room host can change team count.' }, 403);
    const teamCount = normalizeTeamCount(body.teamCount || 2);
    await setPrivateRoomState(env, currentRoomId, { teamCount });
    await normalizeMemberTeams(env, currentRoomId, teamCount);
    await syncPrivateRoomDurableObject(env, currentRoomId, SYNC_MODE_LOBBY);
    const state = await buildLobbyState(env, actor, currentRoomId);
    return json({ ok: true, state });
  }

  if (action === 'set_invite_lock') {
    if (!isHost) return json({ ok: false, error: 'Only the room host can change room invite access.' }, 403);
    await setPrivateRoomState(env, currentRoomId, {
      inviteLocked: !!body.locked
    });
    const state = await buildLobbyState(env, actor, currentRoomId);
    return json({ ok: true, state });
  }

  if (action === 'invite_party') {
    const result = await invitePartyToPrivateRoom(env, actor, currentRoomId, currentState);
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.status || 400);
    }
    return json({ ok: true, state: result.state, invitedCount: Number(result.invitedCount || 0) });
  }

  if (action === 'randomize') {
    if (!isHost) return json({ ok: false, error: 'Only the room host can randomize teams.' }, 403);
    await randomizeTeams(env, currentRoomId, Number(currentState.team_count || 2));
    await syncPrivateRoomDurableObject(env, currentRoomId, SYNC_MODE_LOBBY);
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
    await moveActorToPrivateRoomTeam(env, targetId, normalizeTeamId(body.teamId || TEAM_ALPHA, Number(currentState.team_count || 2)));
    await syncPrivateRoomDurableObject(env, currentRoomId, SYNC_MODE_LOBBY);
    const state = await buildLobbyState(env, actor, currentRoomId);
    return json({ ok: true, state });
  }

  if (action === 'self_pick_team') {
    if (String(currentState.room_phase || '') !== ROOM_PHASE_LOBBY) {
      return json({ ok: false, error: 'Team changes are locked while the match is active.' }, 403);
    }
    const teamCount = Number(currentState.team_count || 2);
    const allowed = activeTeamIds(teamCount);
    const requestedTeam = String(body.teamId || '').trim().toLowerCase();
    if (allowed.indexOf(requestedTeam) < 0) {
      return json({ ok: false, error: 'Invalid team.' }, 400);
    }
    const selfMember = await getPrivateRoomMember(env, actor.id);
    if (!selfMember || String(selfMember.room_id || '') !== currentRoomId) {
      return json({ ok: false, error: 'You are not in this room.' }, 404);
    }
    await moveActorToPrivateRoomTeam(env, actor.id, requestedTeam);
    await syncPrivateRoomDurableObject(env, currentRoomId, SYNC_MODE_LOBBY);
    const state = await buildLobbyState(env, actor, currentRoomId);
    return json({ ok: true, state });
  }

  if (action === 'start') {
    if (!isHost) return json({ ok: false, error: 'Only the room host can start the match.' }, 403);
    const startMembers = await getPrivateRoomMembers(env, currentRoomId);
    if (startMembers.length < 2) {
      return json({ ok: false, error: 'Need at least 2 players to start.' }, 400);
    }
    const startMode = normalizeRoomMode(currentState.room_mode);
    if (startMode === ROOM_MODE_TDM) {
      const teamCount = Number(currentState.team_count || 2);
      const allowed = activeTeamIds(teamCount);
      const teamCounts = countMembersPerTeam(startMembers, allowed);
      let teamsWithPlayers = 0;
      for (let i = 0; i < allowed.length; i++) {
        if (teamCounts[allowed[i]] > 0) teamsWithPlayers += 1;
      }
      if (teamsWithPlayers < 2) {
        return json({ ok: false, error: 'TDM requires at least 1 player on 2 or more teams.' }, 400);
      }
    }
    await setPrivateRoomState(env, currentRoomId, { roomPhase: ROOM_PHASE_ACTIVE });
    await syncPrivateRoomDurableObject(env, currentRoomId, SYNC_MODE_LOBBY);
    const state = await buildLobbyState(env, actor, currentRoomId);
    return json({ ok: true, state });
  }

  return json({ ok: false, error: 'Unsupported private-room action.' }, 400);
}

export async function primePrivateRoomDurableObject(env, roomId) {
  if (!roomId) return null;
  return syncPrivateRoomDurableObject(env, roomId, SYNC_MODE_HYDRATE);
}
