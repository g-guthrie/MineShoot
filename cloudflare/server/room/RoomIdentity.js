import {
  MATCH_GAME_MODE_FFA,
  MATCH_GAME_MODE_TDM,
  createMatchState
} from '../../../shared/match-rules.js';
import { PRIVATE_ROOM_ID_PREFIX } from '../../../shared/matchmaking-config.js';

export const DEV_LOCAL_ROOM_NAME = 'dev-local';
export const LOCAL_SHARED_ROOM_NAME = 'local-shared';
export const SOLO_CLOUDFLARE_ROOM_PREFIX = 'cf-solo-';
export const PUBLIC_FFA_ROOM_PREFIX = 'ffa-';
export const PUBLIC_TDM_ROOM_PREFIX = 'tdm-';

export function detectGameMode(roomName) {
  const room = String(roomName || '');
  if (room.startsWith(PUBLIC_TDM_ROOM_PREFIX)) return MATCH_GAME_MODE_TDM;
  if (room.startsWith(PUBLIC_FFA_ROOM_PREFIX)) return MATCH_GAME_MODE_FFA;
  return '';
}

export function isPublicMatchRoom(roomName) {
  const mode = detectGameMode(roomName);
  return mode === MATCH_GAME_MODE_FFA || mode === MATCH_GAME_MODE_TDM;
}

export function isPrivateMatchRoom(roomName) {
  return String(roomName || '').startsWith(PRIVATE_ROOM_ID_PREFIX);
}

export function emptyMatchState(gameMode, deps = {}) {
  return createMatchState(gameMode || '', {
    teamAlpha: deps.teamAlpha || 'alpha',
    teamBravo: deps.teamBravo || 'bravo'
  });
}

export function createDefaultPrivateRoomConfig(deps = {}) {
  const roomPhaseActive = String(deps.roomPhaseActive || 'active');
  const teamOrder = Array.isArray(deps.teamOrder) && deps.teamOrder.length
    ? deps.teamOrder
    : ['alpha', 'bravo', 'charlie', 'delta'];
  const defaultTeamIds = teamOrder.slice(0, 2);
  return {
    roomMode: '',
    roomPhase: roomPhaseActive,
    hostActorId: '',
    teamCount: defaultTeamIds.length,
    teamIds: defaultTeamIds.slice(),
    teams: new Map()
  };
}

export function usesConfiguredBots(roomName) {
  const room = String(roomName || '');
  if (room === LOCAL_SHARED_ROOM_NAME) return true;
  if (room.startsWith(SOLO_CLOUDFLARE_ROOM_PREFIX)) return true;
  if (room === 'global') return false;
  if (room.startsWith(PUBLIC_FFA_ROOM_PREFIX)) return false;
  if (room.startsWith(PUBLIC_TDM_ROOM_PREFIX)) return false;
  if (isPrivateMatchRoom(room)) return false;
  return false;
}
