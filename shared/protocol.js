export const DEFAULT_ROOM_ID = 'global';
export const WS_PATH = '/api/ws';
export const WS_LOBBY_PATH = '/api/ws/lobby';
export const MATCHMAKING_PATH = '/api/matchmaking';
export const PARTY_PATH = '/api/party';
export const PRIVATE_ROOM_PATH = '/api/private-room';
export const FRIENDS_PATH = '/api/friends';
export const AUTH_PATH = {
  me: '/api/me',
  login: '/api/auth/login',
  logout: '/api/auth/logout'
};
export const PROFILE_PATH = {
  me: '/api/profile/me',
  public: '/api/profile'
};

export const WORLD_DEFAULTS = {
  profileVersion: 6,
  seedPrefix: 'room-env-v6-static',
  flags: {
    envV2: true,
    terrainPhysicsV2: true
  }
};

export function sanitizeRoomId(raw) {
  let id = String(raw || '').toLowerCase().trim();
  id = id.replace(/[^a-z0-9-]/g, '');
  if (!id) return DEFAULT_ROOM_ID;
  if (id.length > 32) id = id.slice(0, 32);
  return id;
}

export function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
  };
}

export function buildExpectedWorldMeta(roomName, worldConfig = WORLD_DEFAULTS) {
  const profileVersion = Math.max(1, Math.round(Number(worldConfig && worldConfig.profileVersion) || WORLD_DEFAULTS.profileVersion));
  const prefix = String((worldConfig && worldConfig.seedPrefix) || WORLD_DEFAULTS.seedPrefix);
  const roomId = sanitizeRoomId(roomName);
  return {
    roomId,
    worldSeed: `${prefix}-${roomId}`,
    worldProfileVersion: profileVersion,
    worldFlags: cloneWorldFlags((worldConfig && worldConfig.flags) || WORLD_DEFAULTS.flags)
  };
}

export function normalizeVec3(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}

export function normalizeThrowIntent(rawIntent) {
  const origin = normalizeVec3(rawIntent && rawIntent.origin);
  const direction = normalizeVec3(rawIntent && rawIntent.direction);
  if (!origin || !direction) return null;
  return {
    origin,
    direction,
    aimPoint: normalizeVec3(rawIntent && rawIntent.aimPoint)
  };
}

export function normalizeWeaponLoadoutPayload(slot1, slot2) {
  return {
    slot1: String(slot1 || ''),
    slot2: String(slot2 || '')
  };
}

export function normalizeAbilityLoadoutPayload(abilityId) {
  return {
    t: MSG_C2S.CLASS_QUEUE,
    abilityId: String(abilityId || '')
  };
}

export function normalizeThrowPayload(throwableId, clientThrowId, throwIntent) {
  const payload = {
    t: MSG_C2S.THROW,
    throwableId: String(throwableId || ''),
    clientThrowId: String(clientThrowId || '')
  };
  const normalizedThrowIntent = normalizeThrowIntent(throwIntent);
  if (normalizedThrowIntent) payload.throwIntent = normalizedThrowIntent;
  return payload;
}

export function normalizeReloadPayload(weaponId) {
  return {
    t: MSG_C2S.RELOAD,
    weaponId: String(weaponId || '')
  };
}

export function normalizeClassCastPayload(slotOrCastData, maybeCastData) {
  const castData = maybeCastData !== undefined ? maybeCastData : slotOrCastData;
  const payload = {
    t: MSG_C2S.CLASS_CAST
  };
  const aimPoint = normalizeVec3(castData && castData.aimPoint);
  const projectileIntent = normalizeThrowIntent(castData && castData.projectileIntent);
  const lockTargetId = String(castData && castData.lockTargetId || '').trim();
  if (aimPoint) payload.aimPoint = aimPoint;
  if (projectileIntent) payload.projectileIntent = projectileIntent;
  if (lockTargetId) payload.lockTargetId = lockTargetId;
  return payload;
}

export const MSG_C2S = {
  INPUT: 'input',
  FIRE: 'fire',
  RELOAD: 'reload',
  EQUIP_WEAPON: 'equip_weapon',
  WEAPON_LOADOUT: 'weapon_loadout',
  THROW: 'throw',
  CLASS_QUEUE: 'class_queue',
  CLASS_CAST: 'class_cast',
  PING: 'ping',
  LOBBY_PING: 'lobby_ping'
};

export const MSG_S2C = {
  WELCOME: 'welcome',
  SNAPSHOT: 'snapshot',
  THROW_SPAWN: 'throw_spawn',
  THROW_REJECT: 'throw_reject',
  THROW_IMPACT: 'throw_impact',
  THROW_EXPLODE: 'throw_explode',
  AOE_END: 'aoe_end',
  DAMAGE_EVENT: 'damage_event',
  DEATH_RESPAWN: 'death_respawn',
  ABILITY_EVENT: 'ability_event',
  CLASS_CAST_OK: 'class_cast_ok',
  CLASS_CAST_REJECT: 'class_cast_reject',
  CLASS_CHANGED: 'class_changed',
  ERROR: 'error',
  PONG: 'pong',
  LOBBY_STATE: 'lobby_state'
};

export const protocol = {
  defaults: {
    roomId: DEFAULT_ROOM_ID
  },
  world: WORLD_DEFAULTS,
  wsPath: WS_PATH,
  wsLobbyPath: WS_LOBBY_PATH,
  matchmakingPath: MATCHMAKING_PATH,
  partyPath: PARTY_PATH,
  privateRoomPath: PRIVATE_ROOM_PATH,
  friendsPath: FRIENDS_PATH,
  authPath: AUTH_PATH,
  profilePath: PROFILE_PATH,
  msg: {
    c2s: MSG_C2S,
    s2c: MSG_S2C
  },
  sanitizeRoomId,
  cloneWorldFlags,
  buildExpectedWorldMeta,
  normalizeVec3,
  normalizeThrowIntent,
  normalizeWeaponLoadoutPayload,
  normalizeAbilityLoadoutPayload,
  normalizeThrowPayload,
  normalizeReloadPayload,
  normalizeClassCastPayload
};

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.protocol = protocol;
