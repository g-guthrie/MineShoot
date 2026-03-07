export const DEFAULT_ROOM_ID = 'global';
export const WS_PATH = '/api/ws';
export const MATCHMAKING_PATH = '/api/matchmaking';
export const AUTH_PATH = {
  me: '/api/me',
  login: '/api/auth/login',
  logout: '/api/auth/logout'
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

export const MSG_C2S = {
  JOIN_ROOM: 'join_room',
  INPUT: 'input',
  FIRE: 'fire',
  EQUIP_WEAPON: 'equip_weapon',
  SEEKER_SHOT: 'seeker_shot',
  THROW: 'throw',
  CLASS_QUEUE: 'class_queue',
  CLASS_CAST: 'class_cast',
  PING: 'ping'
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
  SEEKER_REJECT: 'seeker_reject',
  DEATH_RESPAWN: 'death_respawn',
  CLASS_CAST_OK: 'class_cast_ok',
  CLASS_CAST_REJECT: 'class_cast_reject',
  CLASS_CHANGED: 'class_changed',
  CLASS_QUEUED: 'class_queued',
  ERROR: 'error',
  PONG: 'pong'
};

export const protocol = {
  defaults: {
    roomId: DEFAULT_ROOM_ID
  },
  world: WORLD_DEFAULTS,
  wsPath: WS_PATH,
  matchmakingPath: MATCHMAKING_PATH,
  authPath: AUTH_PATH,
  msg: {
    c2s: MSG_C2S,
    s2c: MSG_S2C
  },
  sanitizeRoomId
};

const runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
runtime.GameShared = runtime.GameShared || {};
runtime.GameShared.protocol = protocol;
