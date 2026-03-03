import { DEFAULT_ROOM_ID, sanitizeRoomId as sanitizeProtocolRoomId } from '../../shared/protocol.js';

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

export function sanitizeRoomId(raw) {
  const sanitized = sanitizeProtocolRoomId(raw);
  return sanitized || DEFAULT_ROOM_ID;
}

export function validPin(pin) {
  return /^\d{4}$/.test(String(pin || ''));
}

export function validUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(String(username || '').trim());
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
    out[k] = decodeURIComponent(v);
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
