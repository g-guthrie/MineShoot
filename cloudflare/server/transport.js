import { DEFAULT_ROOM_ID, sanitizeRoomId as sanitizeProtocolRoomId } from '../../shared/protocol.js';

const FRIENDLY_GUEST_ADJECTIVES = ['amber', 'brisk', 'calm', 'clever', 'crisp', 'daring', 'eager', 'ember', 'frozen', 'gentle', 'golden', 'grand', 'happy', 'icy', 'jolly', 'lucky', 'mellow', 'misty', 'nimble', 'nova', 'quiet', 'rapid', 'royal', 'sharp', 'silver', 'solar', 'steady', 'stormy', 'swift', 'tidy', 'vivid', 'wild'];
const FRIENDLY_GUEST_NOUNS = ['badger', 'bear', 'crow', 'drake', 'eagle', 'falcon', 'fox', 'gecko', 'harbor', 'hawk', 'jaguar', 'lynx', 'maple', 'meadow', 'moose', 'otter', 'owl', 'panda', 'pepper', 'pine', 'raven', 'river', 'rook', 'spruce', 'stone', 'tiger', 'valley', 'wave', 'willow', 'wolf', 'wren', 'yak'];

export function nowMs() {
  return Date.now();
}

export function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (_err) {
    return null;
  }
}

export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function normalizeFriendlyGuestId(value) {
  const compact = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const match = /^([a-z]+)(\d{3})$/.exec(compact);
  if (!match) return '';
  const words = match[1];
  const suffix = match[2];
  for (let i = 0; i < FRIENDLY_GUEST_ADJECTIVES.length; i++) {
    const adjective = FRIENDLY_GUEST_ADJECTIVES[i];
    if (!words.startsWith(adjective)) continue;
    const noun = words.slice(adjective.length);
    if (!noun) continue;
    if (FRIENDLY_GUEST_NOUNS.indexOf(noun) < 0) continue;
    return `${adjective}-${noun}-${suffix}`;
  }
  return '';
}

export function normalizeOpaqueId(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^(usr_|gst_|ses_|pty_|ply_|pub_|private-)/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const normalizedGuestId = normalizeFriendlyGuestId(trimmed);
  if (normalizedGuestId) return normalizedGuestId;
  return trimmed;
}

export function sanitizeRoomId(raw) {
  const sanitized = sanitizeProtocolRoomId(raw);
  return sanitized || DEFAULT_ROOM_ID;
}

export function validPin(pin) {
  return /^\d{4}$/.test(String(pin || ''));
}

export function validUsername(username) {
  const value = String(username || '').trim();
  if (!value) return false;
  if (value.length > 64) return false;
  return !/[\u0000-\u001f\u007f]/.test(value);
}

export function randomId(prefix) {
  return prefix + '_' + crypto.randomUUID().replace(/-/g, '');
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}

export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  const chunks = cookieHeader.split(';');
  for (let i = 0; i < chunks.length; i++) {
    const part = chunks[i].trim();
    if (!part) continue;
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch (_err) {
      // Ignore malformed cookie segments rather than failing the whole request.
    }
  }
  return out;
}

export function distance3(a, b) {
  const dx = a.x - b.x;
  const dy = (a.y || 0) - (b.y || 0);
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function normalize3(x, y, z) {
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

export function addScaled3(a, b, scale) {
  return {
    x: a.x + b.x * scale,
    y: a.y + b.y * scale,
    z: a.z + b.z * scale
  };
}

export function dot3(a, b) {
  return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
