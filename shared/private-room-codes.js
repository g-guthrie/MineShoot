import { sanitizeRoomId } from './protocol.js';
import { PRIVATE_ROOM_PREFIX, PRIVATE_ROOM_ID_PREFIX } from './matchmaking-config.js';

export function privateRoomIdFromCode(code) {
  return sanitizeRoomId(`${PRIVATE_ROOM_PREFIX}-${String(code || '').toLowerCase()}`);
}

export function privateRoomCodeFromId(roomId) {
  const normalized = sanitizeRoomId(roomId);
  if (normalized.startsWith(PRIVATE_ROOM_ID_PREFIX)) {
    return normalized.slice(PRIVATE_ROOM_ID_PREFIX.length).toUpperCase();
  }
  return normalized.toUpperCase();
}

export function normalizePrivateRoomId(raw) {
  const input = String(raw || '').trim().toLowerCase();
  if (!input) return '';
  if (input.startsWith(PRIVATE_ROOM_ID_PREFIX)) {
    return sanitizeRoomId(input);
  }
  const compact = input.replace(/[^a-z0-9]/g, '');
  if (!compact) return '';
  return privateRoomIdFromCode(compact);
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.privateRoomCodes = {
  privateRoomIdFromCode,
  privateRoomCodeFromId,
  normalizePrivateRoomId
};
