import { sanitizeRoomId } from './protocol.js';
import { PRIVATE_ROOM_PREFIX, PRIVATE_ROOM_ID_PREFIX } from './matchmaking-config.js';

export function privateRoomIdFromCode(code) {
  const compact = String(code || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!compact) return '';
  return sanitizeRoomId(`${PRIVATE_ROOM_PREFIX}-${compact}`);
}

export function privateRoomCodeFromId(roomId) {
  const raw = String(roomId || '').trim();
  if (!raw) return '';
  const normalized = sanitizeRoomId(raw);
  if (!normalized || normalized === 'global') return '';
  if (normalized.startsWith(PRIVATE_ROOM_ID_PREFIX)) {
    return normalized.slice(PRIVATE_ROOM_ID_PREFIX.length).toUpperCase();
  }
  return '';
}

export function normalizePrivateRoomId(raw) {
  const input = String(raw || '').trim().toLowerCase();
  if (!input) return '';
  if (input === 'global') return '';
  if (input.startsWith(PRIVATE_ROOM_ID_PREFIX)) {
    return input.length > PRIVATE_ROOM_ID_PREFIX.length ? sanitizeRoomId(input) : '';
  }
  const compact = input.replace(/[^a-z0-9]/g, '');
  if (!compact || compact === 'global') return '';
  return privateRoomIdFromCode(compact);
}

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.privateRoomCodes = {
  privateRoomIdFromCode,
  privateRoomCodeFromId,
  normalizePrivateRoomId
};
