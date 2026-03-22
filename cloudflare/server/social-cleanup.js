import { nowMs, normalizeOpaqueId } from './transport.js';
import {
  deletePrivateRoom,
  getPrivateRoomMembers,
  getPrivateRoomMember,
  getPrivateRoomState,
  removeActorFromPrivateRoom,
  setPrivateRoomState
} from './private-rooms.js';
import {
  clearPrivateRoomInvitesByActor,
  clearPrivateRoomInvitesByRoom,
  clearPublicMatchAssignment
} from './party-match-state.js';
import { notifyPrivateRoomLobbyHub } from './private-room-lobby-hub-sync.js';

let ensurePartySocialSchemaPromise = null;
const ROOM_TEAM_IDS = ['alpha', 'bravo', 'charlie', 'delta'];

function nowSec() {
  return Math.floor(nowMs() / 1000);
}

function normalizeTeamId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ROOM_TEAM_IDS.indexOf(normalized) >= 0 ? normalized : 'alpha';
}

async function ensurePartySocialSchema(env) {
  if (!env || !env.DB) return;
  if (!ensurePartySocialSchemaPromise) {
    ensurePartySocialSchemaPromise = env.DB.batch([
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
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_party_members_party_id ON party_members(party_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_parties_leader_id ON parties(leader_id)'),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS party_presence (
           actor_id TEXT PRIMARY KEY,
           display_name TEXT NOT NULL,
           last_menu_seen_at INTEGER NOT NULL,
           activity_state TEXT NOT NULL DEFAULT 'menu',
           last_seen_at INTEGER NOT NULL DEFAULT 0
         )`
      )
    ]).catch((err) => {
      ensurePartySocialSchemaPromise = null;
      throw err;
    });
  }
  await ensurePartySocialSchemaPromise;
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
  if (!stub || typeof stub.fetch !== 'function') return roomState;

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
        teamId: allowedTeamIds.indexOf(normalizeTeamId(member.team_id)) >= 0
          ? normalizeTeamId(member.team_id)
          : allowedTeamIds[0]
      }))
    })
  }).catch(() => null);
  await notifyPrivateRoomLobbyHub(env, roomId);

  return roomState;
}

async function loadPartyMetaByMember(env, memberId) {
  await ensurePartySocialSchema(env);
  return env.DB.prepare(
    `SELECT p.id, p.leader_id, p.join_locked, p.created_at, p.updated_at
     FROM party_members pm
     JOIN parties p ON p.id = pm.party_id
     WHERE pm.member_id = ?1`
  ).bind(memberId).first();
}

async function countPartyMembers(env, partyId) {
  await ensurePartySocialSchema(env);
  const row = await env.DB.prepare(
    'SELECT COUNT(*) as total FROM party_members WHERE party_id = ?1'
  ).bind(partyId).first();
  return Math.max(0, Number(row && row.total) || 0);
}

async function deletePartyIfEmpty(env, partyId) {
  if (!partyId) return false;
  const remaining = await countPartyMembers(env, partyId);
  if (remaining > 0) return false;
  await env.DB.prepare('DELETE FROM parties WHERE id = ?1').bind(partyId).run();
  return true;
}

async function cleanupActorPrivateRoom(env, actorId) {
  const existing = await getPrivateRoomMember(env, actorId);
  if (!existing) return null;

  const roomId = String(existing.room_id || '');
  await removeActorFromPrivateRoom(env, actorId);

  const remaining = await getPrivateRoomMembers(env, roomId);
  if (!remaining.length) {
    await clearPrivateRoomInvitesByRoom(env, roomId);
    await deletePrivateRoom(env, roomId);
    await notifyPrivateRoomLobbyHub(env, roomId);
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

async function cleanupActorParty(env, actorId) {
  const party = await loadPartyMetaByMember(env, actorId);
  if (!party) return null;

  await env.DB.prepare('DELETE FROM party_members WHERE member_id = ?1').bind(actorId).run();
  const removedParty = await deletePartyIfEmpty(env, party.id);
  if (removedParty) return party.id;

  if (String(party.leader_id || '') === String(actorId || '')) {
    const replacement = await env.DB.prepare(
      'SELECT member_id FROM party_members WHERE party_id = ?1 ORDER BY joined_at ASC, member_id ASC LIMIT 1'
    ).bind(party.id).first();
    if (replacement && replacement.member_id) {
      await env.DB.prepare(
        'UPDATE parties SET leader_id = ?2, updated_at = ?3 WHERE id = ?1'
      ).bind(party.id, replacement.member_id, nowSec()).run();
    }
    return party.id;
  }

  await env.DB.prepare(
    'UPDATE parties SET updated_at = ?2 WHERE id = ?1'
  ).bind(party.id, nowSec()).run();
  return party.id;
}

async function clearActorPresence(env, actorId) {
  await ensurePartySocialSchema(env);
  await env.DB.prepare('DELETE FROM party_presence WHERE actor_id = ?1').bind(actorId).run();
}

async function cleanupActorAssignments(env, actorId) {
  await clearPublicMatchAssignment(env, actorId);
  await clearPrivateRoomInvitesByActor(env, actorId);
}

export async function cleanupAccountSocialState(env, actorId) {
  const normalizedActorId = normalizeOpaqueId(actorId);
  if (!normalizedActorId) return { actorId: '', errors: [] };

  const errors = [];

  try {
    await cleanupActorPrivateRoom(env, normalizedActorId);
  } catch (err) {
    errors.push({ scope: 'private-room', error: err });
  }

  try {
    await cleanupActorParty(env, normalizedActorId);
  } catch (err) {
    errors.push({ scope: 'party', error: err });
  }

  try {
    await clearActorPresence(env, normalizedActorId);
  } catch (err) {
    errors.push({ scope: 'presence', error: err });
  }

  try {
    await cleanupActorAssignments(env, normalizedActorId);
  } catch (err) {
    errors.push({ scope: 'assignments', error: err });
  }

  if (errors.length) {
    const err = new Error('Account social cleanup failed.');
    err.details = errors;
    throw err;
  }

  return {
    actorId: normalizedActorId,
    errors: []
  };
}
