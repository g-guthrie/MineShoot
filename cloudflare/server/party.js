import { getSessionFromRequest } from './auth.js';
import { json, normalizeOpaqueId, randomId, validUsername } from './transport.js';
import {
  getPrivateRoomById,
  getPrivateRoomMember,
  getPrivateRoomMembers,
  getPrivateRoomState,
  touchPrivateRoomById,
  assignActorToPrivateRoom,
  removeActorFromPrivateRoom,
  deletePrivateRoom,
  setPrivateRoomState
} from './private-rooms.js';
import {
  clearPrivateRoomInvite,
  clearPrivateRoomInvitesByRoom,
  clearPublicMatchAssignment,
  loadIncomingPrivateRoomInvite,
  loadOutgoingPrivateRoomInviteSummary,
  loadPublicMatchAssignment
} from './party-match-state.js';

const PARTY_MAX_MEMBERS = 16;
const ACTOR_ID_RE = /^[a-zA-Z0-9_-]{3,64}$/;
const ACTIVITY_MENU = 'menu';
const ACTIVITY_PRIVATE_ROOM_LOBBY = 'private_room_lobby';
const ACTIVITY_IN_MATCH = 'in_match';
const ACTIVITY_STALE_WINDOW_SEC = 15;
const ROOM_TEAM_IDS = ['alpha', 'bravo', 'charlie', 'delta'];

let ensurePresencePromise = null;
let ensurePartySchemaPromise = null;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

async function ensurePartySchema(env) {
  if (!env || !env.DB) return;
  if (!ensurePartySchemaPromise) {
    ensurePartySchemaPromise = env.DB.batch([
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS parties (
           id TEXT PRIMARY KEY,
           leader_id TEXT NOT NULL,
           join_locked INTEGER NOT NULL DEFAULT 0,
           created_at INTEGER NOT NULL,
           updated_at INTEGER NOT NULL
         )`
      ),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS party_members (
           member_id TEXT PRIMARY KEY,
           party_id TEXT NOT NULL,
           display_name TEXT NOT NULL,
           joined_at INTEGER NOT NULL
         )`
      ),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS party_direct_invites (
           inviter_actor_id TEXT NOT NULL,
           invitee_actor_id TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY(inviter_actor_id, invitee_actor_id)
         )`
      ),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_party_members_party_id ON party_members(party_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_parties_leader_id ON parties(leader_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_party_direct_invites_invitee_actor_id ON party_direct_invites(invitee_actor_id)')
    ]).catch((err) => {
      ensurePartySchemaPromise = null;
      throw err;
    });
  }
  await ensurePartySchemaPromise;
}

async function ensurePartyPresenceTable(env) {
  if (!env || !env.DB) return;
  await ensurePartySchema(env);
  if (!ensurePresencePromise) {
    ensurePresencePromise = env.DB.batch([
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS party_presence (
           actor_id TEXT PRIMARY KEY,
           display_name TEXT NOT NULL,
           last_menu_seen_at INTEGER NOT NULL,
           activity_state TEXT NOT NULL DEFAULT 'menu',
           last_seen_at INTEGER NOT NULL DEFAULT 0
         )`
      )
    ]).then(async () => {
      const columns = await env.DB.prepare('PRAGMA table_info(party_presence)').all();
      const resultRows = columns && Array.isArray(columns.results) ? columns.results : [];
      const present = {};
      for (let i = 0; i < resultRows.length; i++) {
        present[String(resultRows[i].name || '')] = true;
      }
      if (!present.activity_state) {
        await env.DB.prepare(
          "ALTER TABLE party_presence ADD COLUMN activity_state TEXT NOT NULL DEFAULT 'menu'"
        ).run();
      }
      if (!present.last_seen_at) {
        await env.DB.prepare(
          'ALTER TABLE party_presence ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0'
        ).run();
      }
    }).catch((err) => {
      ensurePresencePromise = null;
      throw err;
    });
  }
  await ensurePresencePromise;
}

function normalizeActorId(value) {
  const id = normalizeOpaqueId(value);
  return ACTOR_ID_RE.test(id) ? id : '';
}

function normalizeDisplayName(value) {
  const next = String(value || '').trim();
  if (!validUsername(next)) return '';
  return next.slice(0, 64);
}

function normalizeActivityState(value) {
  const next = String(value || '').trim().toLowerCase();
  if (next === ACTIVITY_PRIVATE_ROOM_LOBBY) return ACTIVITY_PRIVATE_ROOM_LOBBY;
  if (next === ACTIVITY_IN_MATCH) return ACTIVITY_IN_MATCH;
  return ACTIVITY_MENU;
}

export async function resolveActor(env, request, body = null) {
  const session = await getSessionFromRequest(env, request).catch(() => null);
  if (session) {
    return {
      id: String(session.userId || ''),
      displayName: String(session.displayName || session.username || session.userId || 'PLAYER'),
      username: String(session.username || session.userId || 'PLAYER'),
      isAccount: true
    };
  }

  const url = new URL(request.url);
  const source = body && typeof body === 'object' ? body : {};
  const actorId = normalizeActorId(source.actorId || url.searchParams.get('actorId') || '');
  const displayName = normalizeDisplayName(source.displayName || url.searchParams.get('displayName') || '');
  if (!actorId || !displayName) return null;

  return {
    id: actorId,
    displayName,
    username: displayName,
    isAccount: false
  };
}

export async function touchPartyPresence(env, actor, activityState = ACTIVITY_MENU) {
  if (!actor || !actor.id) return;
  await ensurePartyPresenceTable(env);
  const now = nowSec();
  await env.DB.prepare(
    `INSERT INTO party_presence (actor_id, display_name, last_menu_seen_at, activity_state, last_seen_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(actor_id) DO UPDATE SET
       display_name = excluded.display_name,
       last_menu_seen_at = excluded.last_menu_seen_at,
       activity_state = excluded.activity_state,
       last_seen_at = excluded.last_seen_at`
  ).bind(
    String(actor.id || ''),
    String(actor.displayName || actor.username || actor.id || 'PLAYER'),
    activityState === ACTIVITY_MENU ? now : 0,
    normalizeActivityState(activityState),
    now
  ).run();
}

export async function loadEligiblePartyMembers(env, actor) {
  if (!actor || !actor.id) return [];
  await ensurePartyPresenceTable(env);
  const party = await loadPartyMetaByMember(env, actor.id);
  if (!party) return [actor];
  const result = await env.DB.prepare(
    `SELECT pm.member_id, pm.display_name
     FROM party_members pm
     JOIN party_presence pp ON pp.actor_id = pm.member_id
     WHERE pm.party_id = ?1
       AND pp.activity_state = ?2
       AND pp.last_seen_at >= ?3
     ORDER BY CASE WHEN pm.member_id = ?4 THEN 0 ELSE 1 END, pm.joined_at ASC, pm.member_id ASC`
  ).bind(party.id, ACTIVITY_MENU, nowSec() - ACTIVITY_STALE_WINDOW_SEC, actor.id).all();
  return result && Array.isArray(result.results)
    ? result.results.map((row) => ({
        id: String(row.member_id || ''),
        displayName: String(row.display_name || row.member_id || 'PLAYER')
      }))
    : [{ id: actor.id, displayName: actor.displayName }];
}

async function loadPartyMetaByMember(env, memberId) {
  await ensurePartySchema(env);
  return env.DB.prepare(
    `SELECT p.id, p.leader_id, p.join_locked, p.created_at, p.updated_at
     FROM party_members pm
     JOIN parties p ON p.id = pm.party_id
     WHERE pm.member_id = ?1`
  ).bind(memberId).first();
}

async function loadPartyMembers(env, partyId, leaderId) {
  await ensurePartySchema(env);
  const result = await env.DB.prepare(
    `SELECT member_id, display_name, joined_at
     FROM party_members
     WHERE party_id = ?1
     ORDER BY CASE WHEN member_id = ?2 THEN 0 ELSE 1 END, joined_at ASC, member_id ASC`
  ).bind(partyId, leaderId).all();
  return result && Array.isArray(result.results) ? result.results : [];
}

export async function loadCurrentPartyContext(env, actor) {
  if (!actor || !actor.id) {
    return { party: null, members: [] };
  }

  const party = await loadPartyMetaByMember(env, actor.id);
  if (!party) {
    return {
      party: null,
      members: [{
        id: String(actor.id || ''),
        displayName: String(actor.displayName || actor.id || 'PLAYER'),
        isLeader: true
      }]
    };
  }

  const members = await loadPartyMembers(env, party.id, party.leader_id);
  return {
    party: {
      id: String(party.id || ''),
      leaderId: String(party.leader_id || ''),
      joinLocked: !!Number(party.join_locked || 0),
      createdAt: Number(party.created_at || 0),
      updatedAt: Number(party.updated_at || 0)
    },
    members: members.map((member) => ({
      id: String(member.member_id || ''),
      displayName: String(member.display_name || member.member_id || 'PLAYER'),
      isLeader: String(member.member_id || '') === String(party.leader_id || '')
    }))
  };
}

export async function loadCurrentPartyMembers(env, actor) {
  const context = await loadCurrentPartyContext(env, actor);
  return context.members;
}

async function loadPresenceByActorId(env, actorId) {
  await ensurePartyPresenceTable(env);
  return env.DB.prepare(
    `SELECT actor_id, display_name, activity_state, last_seen_at
     FROM party_presence
     WHERE actor_id = ?1`
  ).bind(actorId).first();
}

async function loadResolvedPresence(env, actorId) {
  const candidates = [];
  const normalized = normalizeActorId(actorId);
  if (normalized) candidates.push(normalized);
  const lowered = String(actorId || '').trim().toLowerCase();
  const uppered = String(actorId || '').trim().toUpperCase();
  if (lowered && candidates.indexOf(lowered) === -1) candidates.push(lowered);
  if (uppered && candidates.indexOf(uppered) === -1) candidates.push(uppered);
  for (let i = 0; i < candidates.length; i++) {
    const row = await loadPresenceByActorId(env, candidates[i]);
    if (row && row.actor_id) return row;
  }
  return null;
}

async function loadLatestDirectInviteIncoming(env, actorId) {
  await ensurePartySchema(env);
  const result = await env.DB.prepare(
    `SELECT inviter_actor_id, created_at
     FROM party_direct_invites
     WHERE invitee_actor_id = ?1
     ORDER BY created_at DESC, inviter_actor_id ASC`
  ).bind(actorId).all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  if (!rows.length) return null;
  const invite = rows[0];
  const inviter = await loadResolvedPresence(env, invite.inviter_actor_id);
  return {
    actorId: String(invite.inviter_actor_id || ''),
    displayName: String(inviter && inviter.display_name || invite.inviter_actor_id || 'PLAYER'),
    createdAt: Number(invite.created_at || 0)
  };
}

async function loadLatestDirectInviteOutgoing(env, actorId) {
  await ensurePartySchema(env);
  const result = await env.DB.prepare(
    `SELECT invitee_actor_id, created_at
     FROM party_direct_invites
     WHERE inviter_actor_id = ?1
     ORDER BY created_at DESC, invitee_actor_id ASC`
  ).bind(actorId).all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  if (!rows.length) return null;
  const invite = rows[0];
  const invitee = await loadResolvedPresence(env, invite.invitee_actor_id);
  return {
    actorId: String(invite.invitee_actor_id || ''),
    displayName: String(invitee && invitee.display_name || invite.invitee_actor_id || 'PLAYER'),
    createdAt: Number(invite.created_at || 0)
  };
}

async function upsertDirectInvite(env, inviterActorId, inviteeActorId) {
  await ensurePartySchema(env);
  await env.DB.prepare(
    `INSERT INTO party_direct_invites (inviter_actor_id, invitee_actor_id, created_at)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(inviter_actor_id, invitee_actor_id) DO UPDATE SET
       created_at = excluded.created_at`
  ).bind(inviterActorId, inviteeActorId, nowSec()).run();
}

async function clearDirectInvite(env, inviterActorId, inviteeActorId) {
  await ensurePartySchema(env);
  await env.DB.prepare(
    'DELETE FROM party_direct_invites WHERE inviter_actor_id = ?1 AND invitee_actor_id = ?2'
  ).bind(inviterActorId, inviteeActorId).run();
}

async function clearDirectInvitePair(env, actorIdA, actorIdB) {
  await ensurePartySchema(env);
  await env.DB.prepare(
    `DELETE FROM party_direct_invites
     WHERE (inviter_actor_id = ?1 AND invitee_actor_id = ?2)
        OR (inviter_actor_id = ?2 AND invitee_actor_id = ?1)`
  ).bind(actorIdA, actorIdB).run();
}

async function loadAccountMetaByMemberIds(env, memberIds) {
  const unique = [];
  const seen = new Set();
  for (let i = 0; i < memberIds.length; i++) {
    const memberId = String(memberIds[i] || '');
    if (!memberId || seen.has(memberId)) continue;
    seen.add(memberId);
    unique.push(memberId);
  }
  const out = {};
  await Promise.all(unique.map(async (memberId) => {
    const row = await env.DB.prepare(
      `SELECT u.id, u.username, p.display_name
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ?1`
    ).bind(memberId).first().catch(() => null);
    if (!row || !row.id) return;
    out[String(row.id)] = {
      accountUserId: String(row.id || ''),
      username: String(row.username || ''),
      displayName: String(row.display_name || row.username || row.id || 'PLAYER'),
      isAccount: true
    };
  }));
  return out;
}

async function countPartyMembers(env, partyId) {
  await ensurePartySchema(env);
  const row = await env.DB.prepare(
    'SELECT COUNT(*) as total FROM party_members WHERE party_id = ?1'
  ).bind(partyId).first();
  return Math.max(0, Number(row && row.total) || 0);
}

async function updateMemberDisplayName(env, memberId, displayName) {
  await ensurePartySchema(env);
  await env.DB.prepare(
    'UPDATE party_members SET display_name = ?2 WHERE member_id = ?1'
  ).bind(memberId, displayName).run();
}

async function createPartyForLeader(env, actor, locked = 0) {
  await ensurePartySchema(env);
  const now = nowSec();
  const partyId = randomId('pty');
  await env.DB.prepare(
    'INSERT INTO parties (id, leader_id, join_locked, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)'
  ).bind(partyId, actor.id, locked ? 1 : 0, now, now).run();
  await env.DB.prepare(
    'INSERT INTO party_members (member_id, party_id, display_name, joined_at) VALUES (?1, ?2, ?3, ?4)'
  ).bind(actor.id, partyId, actor.displayName, now).run();
  return partyId;
}

async function ensureActorParty(env, actor) {
  let party = await loadPartyMetaByMember(env, actor.id);
  if (!party) {
    await createPartyForLeader(env, actor, 0);
    party = await loadPartyMetaByMember(env, actor.id);
  } else {
    await updateMemberDisplayName(env, actor.id, actor.displayName);
  }
  return party;
}

async function deletePartyIfEmpty(env, partyId) {
  const remaining = await countPartyMembers(env, partyId);
  if (remaining > 0) return false;
  await env.DB.prepare('DELETE FROM parties WHERE id = ?1').bind(partyId).run();
  return true;
}

async function removeActorFromCurrentParty(env, actorId) {
  await ensurePartySchema(env);
  const party = await loadPartyMetaByMember(env, actorId);
  if (!party) return null;

  await env.DB.prepare('DELETE FROM party_members WHERE member_id = ?1').bind(actorId).run();
  const removedParty = await deletePartyIfEmpty(env, party.id);
  if (removedParty) return party;

  if (String(party.leader_id || '') === String(actorId)) {
    const replacement = await env.DB.prepare(
      'SELECT member_id FROM party_members WHERE party_id = ?1 ORDER BY joined_at ASC, member_id ASC LIMIT 1'
    ).bind(party.id).first();
    if (replacement && replacement.member_id) {
      await env.DB.prepare(
        'UPDATE parties SET leader_id = ?2, updated_at = ?3 WHERE id = ?1'
      ).bind(party.id, replacement.member_id, nowSec()).run();
    }
  } else {
    await env.DB.prepare(
      'UPDATE parties SET updated_at = ?2 WHERE id = ?1'
    ).bind(party.id, nowSec()).run();
  }
  return party;
}

async function addActorToParty(env, partyId, actor) {
  await ensurePartySchema(env);
  const now = nowSec();
  await env.DB.prepare(
    `INSERT INTO party_members (member_id, party_id, display_name, joined_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(member_id) DO UPDATE SET
       party_id = excluded.party_id,
       display_name = excluded.display_name,
       joined_at = excluded.joined_at`
  ).bind(actor.id, partyId, actor.displayName, now).run();
  await env.DB.prepare(
    'UPDATE parties SET updated_at = ?2 WHERE id = ?1'
  ).bind(partyId, now).run();
}

function normalizeRoomTeamId(value) {
  const next = String(value || '').trim().toLowerCase();
  return ROOM_TEAM_IDS.indexOf(next) >= 0 ? next : 'alpha';
}

async function syncPrivateRoomDurableObject(env, roomId, syncMode = 'lobby_update') {
  if (!env || !env.GLOBAL_ARENA || !roomId) return null;
  const roomState = await getPrivateRoomState(env, roomId);
  const members = await getPrivateRoomMembers(env, roomId);
  if (!roomState) return null;
  const teamCount = Math.max(2, Math.min(4, Math.round(Number(roomState.team_count || 2) || 2)));
  const allowedTeamIds = ROOM_TEAM_IDS.slice(0, teamCount);
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
        teamId: allowedTeamIds.indexOf(normalizeRoomTeamId(member.team_id)) >= 0
          ? normalizeRoomTeamId(member.team_id)
          : allowedTeamIds[0]
      }))
    })
  }).catch(() => null);
  return roomState;
}

async function detachActorFromPrivateRoom(env, actorId) {
  const existing = await getPrivateRoomMember(env, actorId);
  if (!existing) return null;
  const roomId = String(existing.room_id || '');
  await removeActorFromPrivateRoom(env, actorId);
  const remaining = await getPrivateRoomMembers(env, roomId);
  if (!remaining.length) {
    await clearPrivateRoomInvitesByRoom(env, roomId);
    await deletePrivateRoom(env, roomId);
    return roomId;
  }
  const roomState = await getPrivateRoomState(env, roomId);
  if (roomState && String(roomState.host_actor_id || '') === String(actorId || '')) {
    await setPrivateRoomState(env, roomId, {
      hostActorId: String(remaining[0].actor_id || '')
    });
  }
  await syncPrivateRoomDurableObject(env, roomId, 'lobby_update');
  return roomId;
}

async function ensurePrivateRoomCapacity(env, roomId, actorIds) {
  const currentMembers = await getPrivateRoomMembers(env, roomId);
  const seen = new Set(currentMembers.map((member) => String(member.actor_id || '')));
  for (let i = 0; i < actorIds.length; i++) {
    seen.add(String(actorIds[i] || ''));
  }
  return seen.size <= PARTY_MAX_MEMBERS;
}

async function joinPrivateRoomFromInvite(env, actor, roomId) {
  const room = await getPrivateRoomById(env, roomId);
  const roomState = await getPrivateRoomState(env, roomId);
  if (!room || !roomState) {
    return { ok: false, status: 404, error: 'Private room code not found.' };
  }
  const actorIds = [String(actor.id || '')];
  const canFit = await ensurePrivateRoomCapacity(env, roomId, actorIds);
  if (!canFit) {
    return { ok: false, status: 409, error: 'That private room is full.' };
  }
  await clearPublicMatchAssignment(env, actor.id);
  await detachActorFromPrivateRoom(env, actor.id);
  await assignActorToPrivateRoom(env, roomId, actor.id, actor.displayName, 'alpha');
  await touchPrivateRoomById(env, roomId);
  await syncPrivateRoomDurableObject(env, roomId, 'lobby_update');
  return { ok: true, status: 200 };
}

async function buildPartyState(env, actor, ensureExists = true) {
  let party = await loadPartyMetaByMember(env, actor.id);
  if (!party && ensureExists) {
    party = await ensureActorParty(env, actor);
  }
  if (!party) return null;
  const members = await loadPartyMembers(env, party.id, party.leader_id);
  const accountMeta = await loadAccountMetaByMemberIds(env, members.map((member) => String(member.member_id || '')));
  const roomAssignment = await getPrivateRoomMember(env, actor.id);
  const roomState = roomAssignment ? await getPrivateRoomState(env, roomAssignment.room_id) : null;
  const publicMatchAssignment = await loadPublicMatchAssignment(env, actor.id);
  const directInviteIncoming = await loadLatestDirectInviteIncoming(env, actor.id);
  const directInviteOutgoing = await loadLatestDirectInviteOutgoing(env, actor.id);
  const roomInviteIncomingRaw = await loadIncomingPrivateRoomInvite(env, actor.id);
  const roomInviteOutgoingRaw = await loadOutgoingPrivateRoomInviteSummary(env, actor.id);
  const roomInviteInviter = roomInviteIncomingRaw
    ? await loadResolvedPresence(env, roomInviteIncomingRaw.inviterActorId)
    : null;
  return {
    self: {
      id: actor.id,
      displayName: actor.displayName,
      username: actor.username,
      isAccount: !!actor.isAccount,
      publicMatch: publicMatchAssignment ? {
        roomId: String(publicMatchAssignment.room_id || ''),
        gameMode: String(publicMatchAssignment.game_mode || 'ffa'),
        assignedByActorId: String(publicMatchAssignment.assigned_by_actor_id || ''),
        assignedAt: Number(publicMatchAssignment.assigned_at || 0)
      } : null,
      privateRoom: roomAssignment && roomState ? {
        roomId: String(roomAssignment.room_id || ''),
        roomMode: String(roomState.room_mode || 'ffa'),
        roomPhase: String(roomState.room_phase || 'lobby'),
        teamId: String(roomAssignment.team_id || 'alpha'),
        isHost: String(roomState.host_actor_id || '') === String(actor.id || '')
      } : null
    },
    directInvite: {
      incoming: directInviteIncoming,
      outgoing: directInviteOutgoing
    },
    roomInvite: {
      incoming: roomInviteIncomingRaw ? {
        roomId: String(roomInviteIncomingRaw.roomId || ''),
        roomCode: String(roomInviteIncomingRaw.roomCode || ''),
        roomMode: String(roomInviteIncomingRaw.roomMode || 'ffa'),
        roomPhase: String(roomInviteIncomingRaw.roomPhase || 'lobby'),
        inviterActorId: String(roomInviteIncomingRaw.inviterActorId || ''),
        inviterDisplayName: String(roomInviteInviter && roomInviteInviter.display_name || roomInviteIncomingRaw.inviterActorId || 'PLAYER'),
        createdAt: Number(roomInviteIncomingRaw.createdAt || 0)
      } : null,
      outgoing: roomInviteOutgoingRaw ? {
        roomId: String(roomInviteOutgoingRaw.roomId || ''),
        roomCode: String(roomInviteOutgoingRaw.roomCode || ''),
        roomMode: String(roomInviteOutgoingRaw.roomMode || 'ffa'),
        roomPhase: String(roomInviteOutgoingRaw.roomPhase || 'lobby'),
        invitedCount: Number(roomInviteOutgoingRaw.invitedCount || 0),
        createdAt: Number(roomInviteOutgoingRaw.createdAt || 0)
      } : null
    },
    party: {
      id: String(party.id || ''),
      leaderId: String(party.leader_id || ''),
      joinLocked: !!Number(party.join_locked || 0),
      isLeader: String(party.leader_id || '') === String(actor.id || ''),
      memberCount: members.length,
      members: members.map((member) => ({
        id: String(member.member_id || ''),
        displayName: String(member.display_name || member.member_id || 'PLAYER'),
        isLeader: String(member.member_id || '') === String(party.leader_id || ''),
        accountUserId: accountMeta[String(member.member_id || '')]
          ? String(accountMeta[String(member.member_id || '')].accountUserId || '')
          : '',
        username: accountMeta[String(member.member_id || '')]
          ? String(accountMeta[String(member.member_id || '')].username || '')
          : '',
        isAccount: !!accountMeta[String(member.member_id || '')]
      }))
    }
  };
}

export async function handleJoinParty(env, actor, targetId, options = null) {
  const normalizedTargetId = normalizeActorId(targetId);
  if (!normalizedTargetId) {
    return { status: 400, body: { ok: false, error: 'Enter a valid friend ID.' } };
  }

  if (normalizedTargetId === actor.id) {
    const state = await buildPartyState(env, actor, true);
    return { status: 200, body: { ok: true, state } };
  }

  const targetParty =
    await loadPartyMetaByMember(env, normalizedTargetId) ||
    await loadPartyMetaByMember(env, normalizedTargetId.toLowerCase()) ||
    await loadPartyMetaByMember(env, normalizedTargetId.toUpperCase());
  if (!targetParty) {
    return { status: 404, body: { ok: false, error: 'That player is not available for party join.' } };
  }

  const targetMemberCount = await countPartyMembers(env, targetParty.id);
  const actorParty = await loadPartyMetaByMember(env, actor.id);
  if ((!actorParty || actorParty.id !== targetParty.id) && targetMemberCount >= PARTY_MAX_MEMBERS) {
    return { status: 409, body: { ok: false, error: 'That party is full.' } };
  }

  const allowLocked = !!(options && options.allowLocked);
  if (!allowLocked && Number(targetParty.join_locked || 0) && actor.id !== String(targetParty.leader_id || '')) {
    return { status: 423, body: { ok: false, error: 'That party is locked.' } };
  }

  await clearPublicMatchAssignment(env, actor.id);
  if (!actorParty || actorParty.id !== targetParty.id) {
    await removeActorFromCurrentParty(env, actor.id);
    await addActorToParty(env, targetParty.id, actor);
  } else {
    await updateMemberDisplayName(env, actor.id, actor.displayName);
  }

  await clearDirectInvitePair(env, actor.id, normalizedTargetId);

  const state = await buildPartyState(env, actor, true);
  return { status: 200, body: { ok: true, state } };
}

async function handleInviteParty(env, actor, targetId) {
  const targetPresence = await loadResolvedPresence(env, targetId);
  if (!targetPresence || !targetPresence.actor_id) {
    return { status: 404, body: { ok: false, error: 'That player is not available for invites.' } };
  }
  const inviteeActorId = normalizeActorId(targetPresence.actor_id || '');
  if (!inviteeActorId) {
    return { status: 404, body: { ok: false, error: 'That player is not available for invites.' } };
  }
  if (inviteeActorId === actor.id) {
    return { status: 400, body: { ok: false, error: 'Pick another friend ID.' } };
  }

  const actorState = await buildPartyState(env, actor, true);
  if (actorState && actorState.party) {
    const members = Array.isArray(actorState.party.members) ? actorState.party.members : [];
    for (let i = 0; i < members.length; i++) {
      if (String(members[i].id || '') === inviteeActorId) {
        return { status: 409, body: { ok: false, error: 'That player is already in your party.' } };
      }
    }
  }

  await upsertDirectInvite(env, actor.id, inviteeActorId);
  const state = await buildPartyState(env, actor, true);
  return { status: 200, body: { ok: true, state } };
}

async function handleAcceptInvite(env, actor, targetId) {
  const inviterPresence = await loadResolvedPresence(env, targetId);
  const inviterActorId = normalizeActorId(inviterPresence && inviterPresence.actor_id || targetId || '');
  if (!inviterActorId) {
    return { status: 404, body: { ok: false, error: 'Invite not found.' } };
  }

  const incoming = await loadLatestDirectInviteIncoming(env, actor.id);
  if (!incoming || String(incoming.actorId || '') !== inviterActorId) {
    return { status: 404, body: { ok: false, error: 'Invite not found.' } };
  }

  const joined = await handleJoinParty(env, actor, inviterActorId, { allowLocked: true });
  if (joined.status >= 400) return joined;
  await clearDirectInvite(env, inviterActorId, actor.id);
  const state = await buildPartyState(env, actor, true);
  return { status: 200, body: { ok: true, state } };
}

async function handleDismissInvite(env, actor, targetId) {
  const inviterPresence = await loadResolvedPresence(env, targetId);
  const inviterActorId = normalizeActorId(inviterPresence && inviterPresence.actor_id || targetId || '');
  if (!inviterActorId) {
    return { status: 404, body: { ok: false, error: 'Invite not found.' } };
  }
  await clearDirectInvite(env, inviterActorId, actor.id);
  const state = await buildPartyState(env, actor, true);
  return { status: 200, body: { ok: true, state } };
}

async function handleLockParty(env, actor, locked) {
  const state = await buildPartyState(env, actor, true);
  if (!state || !state.party) {
    return { status: 500, body: { ok: false, error: 'Party state unavailable.' } };
  }
  if (!state.party.isLeader) {
    return { status: 403, body: { ok: false, error: 'Only the party lead can change the join lock.' } };
  }
  await env.DB.prepare(
    'UPDATE parties SET join_locked = ?2, updated_at = ?3 WHERE id = ?1'
  ).bind(state.party.id, locked ? 1 : 0, nowSec()).run();
  const nextState = await buildPartyState(env, actor, true);
  return { status: 200, body: { ok: true, state: nextState } };
}

async function handleLeaveParty(env, actor) {
  const currentState = await buildPartyState(env, actor, true);
  if (currentState && currentState.party && currentState.party.memberCount > 1) {
    await removeActorFromCurrentParty(env, actor.id);
  }
  await clearPublicMatchAssignment(env, actor.id);
  const nextState = await buildPartyState(env, actor, true);
  return { status: 200, body: { ok: true, state: nextState } };
}

async function handleKickPartyMember(env, actor, targetId) {
  const currentState = await buildPartyState(env, actor, true);
  if (!currentState || !currentState.party) {
    return { status: 500, body: { ok: false, error: 'Party state unavailable.' } };
  }
  if (!currentState.party.isLeader) {
    return { status: 403, body: { ok: false, error: 'Only the party leader can remove members.' } };
  }
  const normalizedTargetId = normalizeActorId(targetId);
  if (!normalizedTargetId || normalizedTargetId === String(actor.id || '')) {
    return { status: 400, body: { ok: false, error: 'Pick another party member.' } };
  }
  const targetMember = currentState.party.members.find((member) => String(member.id || '') === normalizedTargetId);
  if (!targetMember) {
    return { status: 404, body: { ok: false, error: 'That player is not in your party.' } };
  }
  await removeActorFromCurrentParty(env, normalizedTargetId);
  await clearPublicMatchAssignment(env, normalizedTargetId);
  const nextState = await buildPartyState(env, actor, true);
  return { status: 200, body: { ok: true, state: nextState } };
}

async function handleAcceptRoomInvite(env, actor, activityState) {
  if (activityState !== ACTIVITY_MENU) {
    return { status: 409, body: { ok: false, error: 'Return to the menu before joining a room invite.' } };
  }
  const invite = await loadIncomingPrivateRoomInvite(env, actor.id);
  if (!invite || !invite.roomId) {
    return { status: 404, body: { ok: false, error: 'Room invite not found.' } };
  }
  const joined = await joinPrivateRoomFromInvite(env, actor, invite.roomId);
  if (!joined.ok) {
    return { status: joined.status || 400, body: { ok: false, error: joined.error || 'Private room join failed.' } };
  }
  await clearPrivateRoomInvite(env, actor.id);
  const state = await buildPartyState(env, actor, true);
  return { status: 200, body: { ok: true, state } };
}

async function handleDismissRoomInvite(env, actor) {
  const invite = await loadIncomingPrivateRoomInvite(env, actor.id);
  if (!invite || !invite.roomId) {
    return { status: 404, body: { ok: false, error: 'Room invite not found.' } };
  }
  await clearPrivateRoomInvite(env, actor.id);
  const state = await buildPartyState(env, actor, true);
  return { status: 200, body: { ok: true, state } };
}

export async function handleParty(env, request) {
  if (request.method === 'GET') {
    const actor = await resolveActor(env, request, null);
    if (!actor) {
      return json({ ok: false, error: 'Missing actor identity.' }, 400);
    }
    const url = new URL(request.url);
    await touchPartyPresence(env, actor, normalizeActivityState(url.searchParams.get('activityState') || ACTIVITY_MENU));
    const state = await buildPartyState(env, actor, true);
    return json({ ok: true, state });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const actor = await resolveActor(env, request, body);
  if (!actor) {
    return json({ ok: false, error: 'Missing actor identity.' }, 400);
  }
  const normalizedActivityState = normalizeActivityState(body.activityState || ACTIVITY_MENU);
  await touchPartyPresence(env, actor, normalizedActivityState);

  const action = String(body.action || '').trim().toLowerCase();
  let result = null;

  if (action === 'join') {
    result = await handleJoinParty(env, actor, body.targetId || '');
  } else if (action === 'invite') {
    result = await handleInviteParty(env, actor, body.targetId || '');
  } else if (action === 'accept_invite') {
    result = await handleAcceptInvite(env, actor, body.targetId || '');
  } else if (action === 'dismiss_invite') {
    result = await handleDismissInvite(env, actor, body.targetId || '');
  } else if (action === 'accept_room_invite') {
    result = await handleAcceptRoomInvite(env, actor, normalizedActivityState);
  } else if (action === 'dismiss_room_invite') {
    result = await handleDismissRoomInvite(env, actor);
  } else if (action === 'kick') {
    result = await handleKickPartyMember(env, actor, body.targetId || '');
  } else if (action === 'lock') {
    result = await handleLockParty(env, actor, !!body.locked);
  } else if (action === 'leave') {
    result = await handleLeaveParty(env, actor);
  } else {
    return json({ ok: false, error: 'Unsupported party action.' }, 400);
  }

  return json(result.body, result.status);
}
