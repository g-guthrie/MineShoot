import { normalizeOpaqueId, nowMs, sanitizeRoomId } from './transport.js';
import { PRIVATE_ROOM_ID_PREFIX } from '../../shared/matchmaking-config.js';

let ensureTablePromise = null;

function isPrivateRoomId(roomId) {
  return String(roomId || '').startsWith(PRIVATE_ROOM_ID_PREFIX);
}

async function ensurePrivateRoomTable(env) {
  if (!env || !env.DB) return;
  if (!ensureTablePromise) {
    ensureTablePromise = env.DB.batch([
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS private_rooms (
           room_id TEXT PRIMARY KEY,
           room_code TEXT NOT NULL UNIQUE,
           creator_user_id TEXT,
           created_at INTEGER NOT NULL,
           last_used_at INTEGER NOT NULL
         )`
      ),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_private_rooms_last_used_at ON private_rooms(last_used_at)'
      ),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS private_room_state (
           room_id TEXT PRIMARY KEY,
           room_mode TEXT NOT NULL DEFAULT 'ffa',
           room_phase TEXT NOT NULL DEFAULT 'lobby',
           host_actor_id TEXT NOT NULL DEFAULT '',
           created_at INTEGER NOT NULL,
           updated_at INTEGER NOT NULL
         )`
      ),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS private_room_members (
           actor_id TEXT PRIMARY KEY,
           room_id TEXT NOT NULL,
           display_name TEXT NOT NULL,
           team_id TEXT NOT NULL DEFAULT 'alpha',
           joined_at INTEGER NOT NULL
         )`
      ),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_private_room_members_room_id ON private_room_members(room_id)'
      )
    ]).catch((err) => {
      ensureTablePromise = null;
      throw err;
    });
  }
  await ensureTablePromise;
}

function normalizeRoomCode(roomCode) {
  return String(roomCode || '').trim().toUpperCase();
}

export async function createPrivateRoomRecord(env, roomId, roomCode, creatorUserId = '') {
  await ensurePrivateRoomTable(env);
  const now = Math.floor(nowMs() / 1000);
  await env.DB.prepare(
    `INSERT INTO private_rooms (room_id, room_code, creator_user_id, created_at, last_used_at)
     VALUES (?1, ?2, ?3, ?4, ?4)`
  ).bind(
    sanitizeRoomId(roomId),
    normalizeRoomCode(roomCode),
    String(creatorUserId || ''),
    now
  ).run();
}

export async function initializePrivateRoomState(env, roomId, roomMode = 'ffa', hostActorId = '', roomPhase = 'lobby') {
  await ensurePrivateRoomTable(env);
  const now = Math.floor(nowMs() / 1000);
  await env.DB.prepare(
    `INSERT INTO private_room_state (room_id, room_mode, room_phase, host_actor_id, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5)
     ON CONFLICT(room_id) DO UPDATE SET
       room_mode = excluded.room_mode,
       room_phase = excluded.room_phase,
       host_actor_id = excluded.host_actor_id,
       updated_at = excluded.updated_at`
  ).bind(
    sanitizeRoomId(roomId),
    String(roomMode || 'ffa') === 'tdm' ? 'tdm' : (String(roomMode || 'ffa') === 'lms' ? 'lms' : 'ffa'),
    String(roomPhase || 'lobby') === 'active' ? 'active' : 'lobby',
    String(hostActorId || ''),
    now
  ).run();
}

export async function getPrivateRoomState(env, roomId) {
  if (!isPrivateRoomId(roomId)) return null;
  await ensurePrivateRoomTable(env);
  return env.DB.prepare(
    `SELECT room_id, room_mode, room_phase, host_actor_id, created_at, updated_at
     FROM private_room_state
     WHERE room_id = ?1`
  ).bind(sanitizeRoomId(roomId)).first();
}

export async function setPrivateRoomState(env, roomId, updates) {
  const current = await getPrivateRoomState(env, roomId);
  if (!current) return null;
  const rawMode = String((updates && updates.roomMode) || current.room_mode || 'ffa');
  const nextMode = rawMode === 'tdm' ? 'tdm' : (rawMode === 'lms' ? 'lms' : 'ffa');
  const nextPhase = String((updates && updates.roomPhase) || current.room_phase || 'lobby') === 'active' ? 'active' : 'lobby';
  const nextHost = String((updates && updates.hostActorId) || current.host_actor_id || '');
  const now = Math.floor(nowMs() / 1000);
  await env.DB.prepare(
    `UPDATE private_room_state
     SET room_mode = ?2,
         room_phase = ?3,
         host_actor_id = ?4,
         updated_at = ?5
     WHERE room_id = ?1`
  ).bind(sanitizeRoomId(roomId), nextMode, nextPhase, nextHost, now).run();
  return getPrivateRoomState(env, roomId);
}

export async function assignActorToPrivateRoom(env, roomId, actorId, displayName, teamId = 'alpha') {
  await ensurePrivateRoomTable(env);
  const now = Math.floor(nowMs() / 1000);
  const normalizedActorId = normalizeOpaqueId(actorId || '');
  await env.DB.prepare(
    `INSERT INTO private_room_members (actor_id, room_id, display_name, team_id, joined_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(actor_id) DO UPDATE SET
       room_id = excluded.room_id,
       display_name = excluded.display_name,
       team_id = excluded.team_id,
       joined_at = excluded.joined_at`
  ).bind(
    normalizedActorId,
    sanitizeRoomId(roomId),
    String(displayName || actorId || 'PLAYER'),
    String(teamId || 'alpha') === 'bravo' ? 'bravo' : 'alpha',
    now
  ).run();
}

export async function getPrivateRoomMember(env, actorId) {
  await ensurePrivateRoomTable(env);
  const normalizedActorId = normalizeOpaqueId(actorId || '');
  return env.DB.prepare(
    `SELECT actor_id, room_id, display_name, team_id, joined_at
     FROM private_room_members
     WHERE actor_id = ?1`
  ).bind(normalizedActorId).first();
}

export async function getPrivateRoomMembers(env, roomId) {
  await ensurePrivateRoomTable(env);
  const result = await env.DB.prepare(
    `SELECT actor_id, room_id, display_name, team_id, joined_at
     FROM private_room_members
     WHERE room_id = ?1
     ORDER BY joined_at ASC, actor_id ASC`
  ).bind(sanitizeRoomId(roomId)).all();
  return result && Array.isArray(result.results) ? result.results : [];
}

export async function removeActorFromPrivateRoom(env, actorId) {
  await ensurePrivateRoomTable(env);
  const normalizedActorId = normalizeOpaqueId(actorId || '');
  const existing = await getPrivateRoomMember(env, normalizedActorId);
  if (!existing) return null;
  await env.DB.prepare(
    'DELETE FROM private_room_members WHERE actor_id = ?1'
  ).bind(String(existing.actor_id || normalizedActorId)).run();
  return existing;
}

export async function moveActorToPrivateRoomTeam(env, actorId, teamId) {
  await ensurePrivateRoomTable(env);
  const existing = await getPrivateRoomMember(env, actorId);
  if (!existing) return;
  await env.DB.prepare(
    'UPDATE private_room_members SET team_id = ?2 WHERE actor_id = ?1'
  ).bind(String(existing.actor_id || ''), String(teamId || 'alpha') === 'bravo' ? 'bravo' : 'alpha').run();
}

export async function deletePrivateRoom(env, roomId) {
  if (!isPrivateRoomId(roomId)) return false;
  await ensurePrivateRoomTable(env);
  const normalizedRoomId = sanitizeRoomId(roomId);
  await env.DB.prepare(
    'DELETE FROM private_room_members WHERE room_id = ?1'
  ).bind(normalizedRoomId).run();
  await env.DB.prepare(
    'DELETE FROM private_room_state WHERE room_id = ?1'
  ).bind(normalizedRoomId).run();
  await env.DB.prepare(
    'DELETE FROM private_rooms WHERE room_id = ?1'
  ).bind(normalizedRoomId).run();
  return true;
}

export async function getPrivateRoomById(env, roomId) {
  if (!isPrivateRoomId(roomId)) return null;
  await ensurePrivateRoomTable(env);
  return env.DB.prepare(
    `SELECT room_id, room_code, creator_user_id, created_at, last_used_at
     FROM private_rooms
     WHERE room_id = ?1`
  ).bind(sanitizeRoomId(roomId)).first();
}

export async function touchPrivateRoomById(env, roomId) {
  if (!isPrivateRoomId(roomId)) return false;
  await ensurePrivateRoomTable(env);
  const now = Math.floor(nowMs() / 1000);
  await env.DB.prepare(
    'UPDATE private_rooms SET last_used_at = ?2 WHERE room_id = ?1'
  ).bind(sanitizeRoomId(roomId), now).run();
  return true;
}

export function isRegisteredPrivateRoomId(roomId) {
  return isPrivateRoomId(roomId);
}
