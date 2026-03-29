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
  logout: '/api/auth/logout',
  config: '/api/auth/config'
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

export function cloneSnapshotValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneSnapshotValue);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      out[key] = cloneSnapshotValue(value[key]);
    }
    return out;
  }
  return value;
}

function snapshotValueEqual(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
      if (!snapshotValueEqual(left[i], right[i])) return false;
    }
    return true;
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    for (let i = 0; i < leftKeys.length; i++) {
      const key = leftKeys[i];
      if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
      if (!snapshotValueEqual(left[key], right[key])) return false;
    }
    return true;
  }
  return false;
}

export function buildSnapshotEntityPatch(entity, baseEntity) {
  const nextEntity = entity && typeof entity === 'object' ? entity : null;
  if (!nextEntity || !nextEntity.id) return null;
  const base = baseEntity && typeof baseEntity === 'object' ? baseEntity : null;
  const patch = { id: String(nextEntity.id) };
  let changed = !base;
  const keys = new Set(Object.keys(nextEntity));
  if (base) {
    Object.keys(base).forEach((key) => keys.add(key));
  }
  keys.delete('id');
  keys.forEach((key) => {
    const nextValue = nextEntity[key];
    const priorValue = base ? base[key] : undefined;
    if (!base || !snapshotValueEqual(nextValue, priorValue)) {
      patch[key] = cloneSnapshotValue(nextValue);
      changed = true;
    }
  });
  return changed ? patch : null;
}

export function applySnapshotEntityPatch(baseEntity, patch) {
  const nextPatch = patch && typeof patch === 'object' ? patch : null;
  if (!nextPatch || !nextPatch.id) return null;
  const nextEntity = cloneSnapshotValue(baseEntity && typeof baseEntity === 'object' ? baseEntity : {});
  nextEntity.id = String(nextPatch.id);
  for (const key in nextPatch) {
    if (!Object.prototype.hasOwnProperty.call(nextPatch, key) || key === 'id') continue;
    nextEntity[key] = cloneSnapshotValue(nextPatch[key]);
  }
  return nextEntity;
}

export function normalizeWeaponLoadoutPayload(slot1, slot2) {
  const first = String(slot1 || '');
  const second = String(slot2 || '');
  if (first === 'sniper' && second !== 'sniper') {
    return {
      slot1: second,
      slot2: first
    };
  }
  return {
    slot1: first,
    slot2: second
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

export const MSG_C2S = {
  ENTER_MATCH: 'enter_match',
  INPUT: 'input',
  ROLL: 'roll',
  FIRE: 'fire',
  RELOAD: 'reload',
  EQUIP_WEAPON: 'equip_weapon',
  WEAPON_LOADOUT: 'weapon_loadout',
  THROW: 'throw',
  PING: 'ping',
  LOBBY_PING: 'lobby_ping'
};

export const MSG_S2C = {
  WELCOME: 'welcome',
  SNAPSHOT: 'snapshot',
  SHOT_EFFECT: 'shot_effect',
  SHOT_REJECT: 'shot_reject',
  THROW_SPAWN: 'throw_spawn',
  THROW_REJECT: 'throw_reject',
  THROW_IMPACT: 'throw_impact',
  THROW_EXPLODE: 'throw_explode',
  AOE_END: 'aoe_end',
  DAMAGE_EVENT: 'damage_event',
  DEATH_RESPAWN: 'death_respawn',
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
  cloneSnapshotValue,
  buildSnapshotEntityPatch,
  applySnapshotEntityPatch,
  normalizeVec3,
  normalizeThrowIntent,
  normalizeWeaponLoadoutPayload,
  normalizeThrowPayload,
  normalizeReloadPayload
};

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.protocol = protocol;
