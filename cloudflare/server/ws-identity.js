import { normalizeOpaqueId, validUsername } from './transport.js';

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
  const actorName = firstValidUsername([
    requestedActorName,
    isAuthenticated ? String(session.displayName || session.username || '') : ''
  ]);
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
      ? String(session.classId || 'abilities')
      : 'abilities';

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
