import { normalizeOpaqueId } from './transport.js';
import { getPrivateRoomById, getPrivateRoomState } from './private-rooms.js';

let ensurePartyMatchStatePromise = null;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function normalizeActorKey(actorId) {
  return normalizeOpaqueId(actorId || '');
}

export function normalizePublicMatchMode(value) {
  const next = String(value || '').trim().toLowerCase();
  if (next === 'tdm') return 'tdm';
  if (next === 'lms') return 'lms';
  return 'ffa';
}

export async function ensurePartyMatchStateSchema(env) {
  if (!env || !env.DB) return;
  if (!ensurePartyMatchStatePromise) {
    ensurePartyMatchStatePromise = env.DB.batch([
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS public_match_assignments (
           actor_id TEXT PRIMARY KEY,
           room_id TEXT NOT NULL,
           game_mode TEXT NOT NULL,
           assigned_by_actor_id TEXT NOT NULL DEFAULT '',
           assigned_at INTEGER NOT NULL
         )`
      ),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_public_match_assignments_room_id ON public_match_assignments(room_id)'),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS private_room_invites (
           invitee_actor_id TEXT PRIMARY KEY,
           room_id TEXT NOT NULL,
           inviter_actor_id TEXT NOT NULL,
           created_at INTEGER NOT NULL
         )`
      ),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS public_match_queue_locks (
           queue_key TEXT PRIMARY KEY,
           actor_id TEXT NOT NULL,
           party_id TEXT NOT NULL DEFAULT '',
           party_size INTEGER NOT NULL,
           game_mode TEXT NOT NULL,
           lock_expires_at INTEGER NOT NULL,
           created_at INTEGER NOT NULL,
           updated_at INTEGER NOT NULL
         )`
      ),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_private_room_invites_room_id ON private_room_invites(room_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_private_room_invites_inviter_actor_id ON private_room_invites(inviter_actor_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_public_match_queue_locks_party_id ON public_match_queue_locks(party_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_public_match_queue_locks_actor_id ON public_match_queue_locks(actor_id)')
    ]).catch((err) => {
      ensurePartyMatchStatePromise = null;
      throw err;
    });
  }
  await ensurePartyMatchStatePromise;
}

export async function assignPublicMatchToActors(env, actorIds, roomId, gameMode, assignedByActorId = '') {
  await ensurePartyMatchStateSchema(env);
  const now = nowSec();
  const normalizedRoomId = String(roomId || '');
  const normalizedMode = normalizePublicMatchMode(gameMode);
  const assignedBy = normalizeActorKey(assignedByActorId);
  const writes = [];
  for (let i = 0; i < actorIds.length; i++) {
    const actorId = normalizeActorKey(actorIds[i]);
    if (!actorId) continue;
    writes.push(
      env.DB.prepare(
        `INSERT INTO public_match_assignments (actor_id, room_id, game_mode, assigned_by_actor_id, assigned_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(actor_id) DO UPDATE SET
           room_id = excluded.room_id,
           game_mode = excluded.game_mode,
           assigned_by_actor_id = excluded.assigned_by_actor_id,
           assigned_at = excluded.assigned_at`
      ).bind(actorId, normalizedRoomId, normalizedMode, assignedBy, now)
    );
  }
  if (writes.length) {
    await env.DB.batch(writes);
  }
}

export async function loadPublicMatchAssignment(env, actorId) {
  await ensurePartyMatchStateSchema(env);
  const normalizedActorId = normalizeActorKey(actorId);
  if (!normalizedActorId) return null;
  return env.DB.prepare(
    `SELECT actor_id, room_id, game_mode, assigned_by_actor_id, assigned_at
     FROM public_match_assignments
     WHERE actor_id = ?1`
  ).bind(normalizedActorId).first();
}

export async function clearPublicMatchAssignment(env, actorId) {
  await ensurePartyMatchStateSchema(env);
  const normalizedActorId = normalizeActorKey(actorId);
  if (!normalizedActorId) return;
  await env.DB.prepare(
    'DELETE FROM public_match_assignments WHERE actor_id = ?1'
  ).bind(normalizedActorId).run();
}

export async function clearPublicMatchAssignments(env, actorIds) {
  await ensurePartyMatchStateSchema(env);
  const writes = [];
  for (let i = 0; i < actorIds.length; i++) {
    const actorId = normalizeActorKey(actorIds[i]);
    if (!actorId) continue;
    writes.push(
      env.DB.prepare('DELETE FROM public_match_assignments WHERE actor_id = ?1').bind(actorId)
    );
  }
  if (writes.length) {
    await env.DB.batch(writes);
  }
}

export async function loadPublicMatchQueueLock(env, queueKey) {
  await ensurePartyMatchStateSchema(env);
  const normalizedQueueKey = String(queueKey || '').trim().toLowerCase();
  if (!normalizedQueueKey) return null;
  return env.DB.prepare(
    `SELECT queue_key, actor_id, party_id, party_size, game_mode, lock_expires_at, created_at, updated_at
     FROM public_match_queue_locks
     WHERE queue_key = ?1`
  ).bind(normalizedQueueKey).first();
}

export async function acquirePublicMatchQueueLock(env, queueKey, actorId, partyId, partySize, gameMode, ttlSeconds = 60) {
  await ensurePartyMatchStateSchema(env);
  const normalizedQueueKey = String(queueKey || '').trim().toLowerCase();
  const normalizedActorId = normalizeActorKey(actorId);
  const normalizedPartyId = normalizeOpaqueId(partyId || '');
  const normalizedMode = normalizePublicMatchMode(gameMode);
  const size = Math.max(1, Number(partySize) || 1);
  const ttl = Math.max(5, Math.round(Number(ttlSeconds) || 60));
  const now = nowSec();
  if (!normalizedQueueKey || !normalizedActorId) {
    return { ok: false, status: 400, error: 'Public match queue lock could not be created.' };
  }

  const existing = await loadPublicMatchQueueLock(env, normalizedQueueKey);
  if (existing && Number(existing.lock_expires_at || 0) > now) {
    return {
      ok: false,
      status: 409,
      pending: true,
      lock: existing
    };
  }

  if (existing) {
    await releasePublicMatchQueueLock(env, normalizedQueueKey);
  }

  async function insertLock() {
    await env.DB.prepare(
      `INSERT INTO public_match_queue_locks (
         queue_key,
         actor_id,
         party_id,
         party_size,
         game_mode,
         lock_expires_at,
         created_at,
         updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`
    ).bind(
      normalizedQueueKey,
      normalizedActorId,
      normalizedPartyId,
      size,
      normalizedMode,
      now + ttl,
      now
    ).run();
  }

  try {
    await insertLock();
  } catch (_err) {
    const conflicting = await loadPublicMatchQueueLock(env, normalizedQueueKey);
    if (conflicting && Number(conflicting.lock_expires_at || 0) > now) {
      return {
        ok: false,
        status: 409,
        pending: true,
        lock: conflicting
      };
    }
    if (conflicting) {
      await releasePublicMatchQueueLock(env, normalizedQueueKey);
    }
    try {
      await insertLock();
    } catch (retryErr) {
      const retryConflict = await loadPublicMatchQueueLock(env, normalizedQueueKey);
      if (retryConflict && Number(retryConflict.lock_expires_at || 0) > now) {
        return {
          ok: false,
          status: 409,
          pending: true,
          lock: retryConflict
        };
      }
      throw retryErr;
    }
  }

  return {
    ok: true,
    queueKey: normalizedQueueKey
  };
}

export async function releasePublicMatchQueueLock(env, queueKey) {
  await ensurePartyMatchStateSchema(env);
  const normalizedQueueKey = String(queueKey || '').trim().toLowerCase();
  if (!normalizedQueueKey) return;
  await env.DB.prepare(
    'DELETE FROM public_match_queue_locks WHERE queue_key = ?1'
  ).bind(normalizedQueueKey).run();
}

export async function consumePublicMatchAssignment(env, actorId, expectedRoomId = '') {
  const assignment = await loadPublicMatchAssignment(env, actorId);
  if (!assignment || !assignment.room_id) return null;
  if (expectedRoomId && String(assignment.room_id || '') !== String(expectedRoomId || '')) {
    return null;
  }
  await clearPublicMatchAssignment(env, actorId);
  return assignment;
}

export async function upsertPrivateRoomInvite(env, roomId, inviterActorId, inviteeActorId) {
  await ensurePartyMatchStateSchema(env);
  const normalizedInvitee = normalizeActorKey(inviteeActorId);
  const normalizedInviter = normalizeActorKey(inviterActorId);
  if (!normalizedInvitee || !normalizedInviter || !roomId) return;
  await env.DB.prepare(
    `INSERT INTO private_room_invites (invitee_actor_id, room_id, inviter_actor_id, created_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(invitee_actor_id) DO UPDATE SET
       room_id = excluded.room_id,
       inviter_actor_id = excluded.inviter_actor_id,
       created_at = excluded.created_at`
  ).bind(normalizedInvitee, String(roomId || ''), normalizedInviter, nowSec()).run();
}

export async function clearPrivateRoomInvite(env, inviteeActorId) {
  await ensurePartyMatchStateSchema(env);
  const normalizedInvitee = normalizeActorKey(inviteeActorId);
  if (!normalizedInvitee) return;
  await env.DB.prepare(
    'DELETE FROM private_room_invites WHERE invitee_actor_id = ?1'
  ).bind(normalizedInvitee).run();
}

export async function clearPrivateRoomInvitesByRoom(env, roomId) {
  await ensurePartyMatchStateSchema(env);
  if (!roomId) return;
  await env.DB.prepare(
    'DELETE FROM private_room_invites WHERE room_id = ?1'
  ).bind(String(roomId || '')).run();
}

export async function clearPrivateRoomInvitesByActor(env, actorId) {
  await ensurePartyMatchStateSchema(env);
  const normalizedActorId = normalizeActorKey(actorId);
  if (!normalizedActorId) return;
  await env.DB.prepare(
    `DELETE FROM private_room_invites
     WHERE invitee_actor_id = ?1 OR inviter_actor_id = ?1`
  ).bind(normalizedActorId).run();
}

export async function loadIncomingPrivateRoomInvite(env, inviteeActorId) {
  await ensurePartyMatchStateSchema(env);
  const normalizedInvitee = normalizeActorKey(inviteeActorId);
  if (!normalizedInvitee) return null;
  const invite = await env.DB.prepare(
    `SELECT invitee_actor_id, room_id, inviter_actor_id, created_at
     FROM private_room_invites
     WHERE invitee_actor_id = ?1`
  ).bind(normalizedInvitee).first();
  if (!invite || !invite.room_id) return null;
  const room = await getPrivateRoomById(env, invite.room_id);
  const roomState = await getPrivateRoomState(env, invite.room_id);
  if (!room || !roomState) {
    await clearPrivateRoomInvite(env, normalizedInvitee);
    return null;
  }
  return {
    inviteeActorId: normalizedInvitee,
    roomId: String(invite.room_id || ''),
    roomCode: String(room.room_code || ''),
    roomMode: String(roomState.room_mode || 'ffa'),
    roomPhase: String(roomState.room_phase || 'lobby'),
    inviterActorId: String(invite.inviter_actor_id || ''),
    createdAt: Number(invite.created_at || 0)
  };
}

export async function loadOutgoingPrivateRoomInviteSummary(env, inviterActorId) {
  await ensurePartyMatchStateSchema(env);
  const normalizedInviter = normalizeActorKey(inviterActorId);
  if (!normalizedInviter) return null;
  const result = await env.DB.prepare(
    `SELECT invitee_actor_id, room_id, created_at
     FROM private_room_invites
     WHERE inviter_actor_id = ?1
     ORDER BY created_at DESC, invitee_actor_id ASC`
  ).bind(normalizedInviter).all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  if (!rows.length) return null;
  const latestRoomId = String(rows[0].room_id || '');
  const room = await getPrivateRoomById(env, latestRoomId);
  const roomState = await getPrivateRoomState(env, latestRoomId);
  if (!room || !roomState) {
    await clearPrivateRoomInvitesByRoom(env, latestRoomId);
    return null;
  }
  let invitedCount = 0;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].room_id || '') === latestRoomId) invitedCount += 1;
  }
  return {
    roomId: latestRoomId,
    roomCode: String(room.room_code || ''),
    roomMode: String(roomState.room_mode || 'ffa'),
    roomPhase: String(roomState.room_phase || 'lobby'),
    invitedCount,
    createdAt: Number(rows[0].created_at || 0)
  };
}
