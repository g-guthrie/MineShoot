import { nowMs, sanitizeRoomId } from './transport.js';
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
