import { normalizeOpaqueId, parseCookies, validUsername } from './transport.js';

export const FRIENDLY_GUEST_ID_RE = /^[a-z]+-[a-z]+-\d{3}$/i;

const PLAYER_ID_RE = /^[a-zA-Z0-9_-]{6,64}$/;
const GUEST_ADJECTIVES = ['amber', 'brisk', 'calm', 'clever', 'crisp', 'daring', 'eager', 'ember', 'frozen', 'gentle', 'golden', 'grand', 'happy', 'icy', 'jolly', 'lucky', 'mellow', 'misty', 'nimble', 'nova', 'quiet', 'rapid', 'royal', 'sharp', 'silver', 'solar', 'steady', 'stormy', 'swift', 'tidy', 'vivid', 'wild'];
const GUEST_NOUNS = ['badger', 'bear', 'crow', 'drake', 'eagle', 'falcon', 'fox', 'gecko', 'harbor', 'hawk', 'jaguar', 'lynx', 'maple', 'meadow', 'moose', 'otter', 'owl', 'panda', 'pepper', 'pine', 'raven', 'river', 'rook', 'spruce', 'stone', 'tiger', 'valley', 'wave', 'willow', 'wolf', 'wren', 'yak'];

function readSearchParams(url) {
  if (url && url.searchParams) return url.searchParams;
  return new URL(String(url || 'https://example.invalid/')).searchParams;
}

function guestWord(list, randomFn) {
  const random = typeof randomFn === 'function' ? randomFn : Math.random;
  const index = Math.floor(random() * list.length);
  return String(list[index] || list[0] || 'guest');
}

export function randomGuestId(randomFn = Math.random) {
  return `${guestWord(GUEST_ADJECTIVES, randomFn)}-${guestWord(GUEST_NOUNS, randomFn)}-${String(Math.floor(randomFn() * 1000)).padStart(3, '0')}`;
}

export function guestDisplayName(id) {
  return String(id || '').trim().toUpperCase() || 'GUEST';
}

export function isValidRequestedPlayerId(value) {
  return PLAYER_ID_RE.test(String(value || '').trim());
}

function firstValidUsername(values) {
  for (let i = 0; i < values.length; i++) {
    const value = String(values[i] || '').trim();
    if (validUsername(value)) return value;
  }
  return '';
}

export function resolveWsActorIdentity({ session, url }) {
  const searchParams = readSearchParams(url);
  const requestedActorId = normalizeOpaqueId(searchParams.get('actorId') || '');
  const requestedActorName = String(searchParams.get('actorName') || '').trim();
  const isAuthenticated = !!(session && session.userId);
  const accountUserId = isAuthenticated ? String(session.userId || '') : '';
  const actorId = isAuthenticated ? normalizeOpaqueId(accountUserId) : requestedActorId;
  const actorName = isAuthenticated
    ? firstValidUsername([
      String(session.displayName || session.username || ''),
      requestedActorName
    ])
    : firstValidUsername([requestedActorName]);
  return {
    isAuthenticated,
    accountUserId,
    requestedActorId,
    requestedActorName,
    actorId,
    actorName
  };
}

function resolveGameplayGuestFallbackId(searchParams, randomFn) {
  const requestedPublicUserId = String(searchParams.get('uid') || '').trim();
  const normalizedGuestId = normalizeOpaqueId(requestedPublicUserId || '');
  if (FRIENDLY_GUEST_ID_RE.test(normalizedGuestId)) {
    return {
      requestedPublicUserId,
      guestFallbackPlayerId: normalizedGuestId,
      mintedGuestId: ''
    };
  }
  const mintedGuestId = randomGuestId(randomFn);
  return {
    requestedPublicUserId,
    guestFallbackPlayerId: mintedGuestId,
    mintedGuestId
  };
}

function resolveGameplayPlayerName({
  isAuthenticated,
  requestedPlayerName,
  requestedActorName,
  session,
  playerId,
  guestFallbackPlayerId
}) {
  const explicitName = firstValidUsername([requestedPlayerName]);
  if (explicitName) return explicitName;

  if (isAuthenticated) {
    const sessionName = firstValidUsername([
      String(session && session.username || ''),
      String(session && session.displayName || '')
    ]);
    if (sessionName) return sessionName;
  }

  const actorName = firstValidUsername([requestedActorName]);
  if (actorName) return actorName;

  if (playerId && playerId === guestFallbackPlayerId && FRIENDLY_GUEST_ID_RE.test(playerId)) {
    return guestDisplayName(playerId);
  }

  return 'PLAYER';
}

export function resolveGameplayWsIdentity({ session, url, classPresets, randomFn = Math.random }) {
  const searchParams = readSearchParams(url);
  const actor = resolveWsActorIdentity({ session, url });
  const requestedPlayerId = String(searchParams.get('pid') || '').trim();
  const requestedPlayerName = String(searchParams.get('username') || '').trim();
  const requestedClassId = String(searchParams.get('classId') || '').trim();

  const guestFallback = actor.isAuthenticated
    ? { requestedPublicUserId: '', guestFallbackPlayerId: '', mintedGuestId: '' }
    : resolveGameplayGuestFallbackId(searchParams, randomFn);

  const playerId = actor.isAuthenticated
    ? actor.accountUserId
    : isValidRequestedPlayerId(requestedPlayerId)
      ? requestedPlayerId
      : guestFallback.guestFallbackPlayerId;

  const playerName = resolveGameplayPlayerName({
    isAuthenticated: actor.isAuthenticated,
    requestedPlayerName,
    requestedActorName: actor.requestedActorName,
    session,
    playerId,
    guestFallbackPlayerId: guestFallback.guestFallbackPlayerId
  });

  const playerClassId = classPresets && classPresets[requestedClassId]
    ? requestedClassId
    : actor.isAuthenticated
      ? String(session.classId || 'ffa')
      : 'ffa';

  return {
    ...actor,
    requestedPlayerId,
    requestedPlayerName,
    requestedClassId,
    requestedPublicUserId: guestFallback.requestedPublicUserId,
    guestFallbackPlayerId: guestFallback.guestFallbackPlayerId,
    mintedGuestId: guestFallback.mintedGuestId,
    playerId,
    playerName,
    playerClassId
  };
}

export function resolveLobbyWsIdentity({ session, url }) {
  return resolveWsActorIdentity({ session, url });
}

// --- Signed guest identity tokens ---------------------------------------
// Guest actor ids are minted client-side and historically were trusted
// verbatim, which let anyone impersonate a guest into private rooms and
// parties by learning their actorId. When a guest token secret is configured
// the server only honors a guest actorId for identity-sensitive checks when
// it arrives with a valid HMAC-SHA256 signature issued by the server.

const GUEST_TOKEN_VERSION = 'v1';

export const GUEST_TOKEN_COOKIE_DEFAULT = 'mfa_guest';
export const GUEST_TOKEN_PARAM = 'guestToken';

export function guestTokenSecret(env) {
  if (!env) return '';
  return String(env.GUEST_TOKEN_SECRET || env.SESSION_SECRET || '').trim();
}

export function guestTokenCookieName(env) {
  return String(env && env.GUEST_COOKIE_NAME || '').trim() || GUEST_TOKEN_COOKIE_DEFAULT;
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function guestHmacKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret || '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  );
}

function guestTokenPayload(actorId) {
  return new TextEncoder().encode(`${GUEST_TOKEN_VERSION}:guest:${actorId}`);
}

export async function mintGuestToken(secret, actorId) {
  const normalizedSecret = String(secret || '').trim();
  const normalizedActorId = normalizeOpaqueId(actorId);
  if (!normalizedSecret || !normalizedActorId) return '';
  const key = await guestHmacKey(normalizedSecret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, guestTokenPayload(normalizedActorId));
  return `${GUEST_TOKEN_VERSION}.${normalizedActorId}.${base64UrlEncode(new Uint8Array(signature))}`;
}

// Returns the verified actorId, or '' when the token is missing/invalid.
// Verification uses crypto.subtle.verify, which is constant-time.
export async function verifyGuestToken(secret, token) {
  const normalizedSecret = String(secret || '').trim();
  const raw = String(token || '').trim();
  if (!normalizedSecret || !raw) return '';
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== GUEST_TOKEN_VERSION) return '';
  const actorId = normalizeOpaqueId(parts[1]);
  if (!actorId) return '';
  let signature;
  try {
    signature = base64UrlDecode(parts[2]);
  } catch (_err) {
    return '';
  }
  if (!signature.length) return '';
  try {
    const key = await guestHmacKey(normalizedSecret, ['verify']);
    const valid = await crypto.subtle.verify('HMAC', key, signature, guestTokenPayload(actorId));
    return valid ? actorId : '';
  } catch (_err) {
    return '';
  }
}

export function readGuestTokenFromRequest(env, request, url) {
  const searchParams = url ? readSearchParams(url) : null;
  const queryToken = searchParams ? String(searchParams.get(GUEST_TOKEN_PARAM) || '').trim() : '';
  if (queryToken) return queryToken;
  if (!request || !request.headers) return '';
  const cookies = parseCookies(request.headers.get('Cookie'));
  return String(cookies[guestTokenCookieName(env)] || '').trim();
}

export function buildGuestTokenCookie(env, token, { secure = false, maxAgeSec = 31536000 } = {}) {
  const attrs = [
    `${guestTokenCookieName(env)}=${encodeURIComponent(String(token || ''))}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${Math.max(0, Number(maxAgeSec) || 0)}`
  ];
  if (secure) {
    attrs.splice(2, 0, 'Secure');
  }
  return attrs.join('; ');
}
