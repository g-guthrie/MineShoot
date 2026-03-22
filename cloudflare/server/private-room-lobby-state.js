import {
  getPrivateRoomById,
  getPrivateRoomMembers,
  getPrivateRoomState
} from './private-rooms.js';
import { privateRoomCodeFromId } from '../../shared/private-room-codes.js';

const ROOM_MODE_FFA = 'ffa';
const ROOM_MODE_TDM = 'tdm';
const ROOM_PHASE_LOBBY = 'lobby';
const ROOM_PHASE_ACTIVE = 'active';
const TEAM_ALPHA = 'alpha';
const TEAM_BRAVO = 'bravo';
const TEAM_CHARLIE = 'charlie';
const TEAM_DELTA = 'delta';
const ROOM_TEAM_IDS = [TEAM_ALPHA, TEAM_BRAVO, TEAM_CHARLIE, TEAM_DELTA];

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

export async function buildPrivateRoomLobbyRoom(env, roomId) {
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
    roomId: String(room.room_id || roomId || ''),
    roomCode: privateRoomCodeFromId(room.room_id || roomId || ''),
    roomMode: normalizeRoomMode(roomState.room_mode),
    roomPhase: String(roomState.room_phase || ROOM_PHASE_LOBBY) === ROOM_PHASE_ACTIVE ? ROOM_PHASE_ACTIVE : ROOM_PHASE_LOBBY,
    teamCount,
    teamIds: activeTeamIds(teamCount),
    inviteLocked: !!Number(roomState.invite_locked || 0),
    hostActorId: hostId,
    memberCount: members.length,
    canToggleInviteLock: false,
    canInviteParty: false,
    teams,
    members: members.map((member) => ({
      id: String(member.actor_id || ''),
      displayName: String(member.display_name || member.actor_id || 'PLAYER'),
      teamId: normalizeTeamId(member.team_id, teamCount),
      isHost: String(member.actor_id || '') === hostId
    }))
  };
}

export async function buildPrivateRoomLobbyStateForActor(env, actor, roomId) {
  const room = await buildPrivateRoomLobbyRoom(env, roomId);
  if (!room) return null;
  const actorId = String(actor && actor.id || '');
  const actorDisplayName = String(actor && (actor.displayName || actor.id) || 'PLAYER');
  return {
    self: {
      actorId,
      displayName: actorDisplayName,
      isHost: actorId === String(room.hostActorId || '')
    },
    room: Object.assign({}, room, {
      canToggleInviteLock: actorId === String(room.hostActorId || ''),
      canInviteParty: actorId === String(room.hostActorId || '') || !room.inviteLocked
    })
  };
}

