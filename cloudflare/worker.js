import { handleLogin, handleLogout, handleMe } from './server/auth.js';
import { handleMatchmaking } from './server/matchmaking.js';
import { handleParty } from './server/party.js';
import { handlePrivateRoomLobby } from './server/private-room-lobby.js';
import { handleFriends } from './server/friends.js';
import { handleProfileMe, handleProfileUpdate, handlePublicProfile } from './server/profile.js';
import { handleWsUpgrade } from './server/ws-upgrade.js';
import { handleWsLobbyUpgrade } from './server/ws-lobby-upgrade.js';
import { GlobalArenaRoom } from './server/room/GlobalArenaRoom.js';
import { gameplayTuning } from '../shared/gameplay-tuning.js';
import { protocol } from '../shared/protocol.js';

const GAMEPLAY_TUNING_WU = gameplayTuning;
const SHARED_PROTOCOL = protocol;
const AUTH_PATH = SHARED_PROTOCOL.authPath || {};
const PROFILE_PATH = SHARED_PROTOCOL.profilePath || {};
const WS_PATH = SHARED_PROTOCOL.wsPath || '/api/ws';
const WS_LOBBY_PATH = SHARED_PROTOCOL.wsLobbyPath || '/api/ws/lobby';
const MATCHMAKING_PATH = SHARED_PROTOCOL.matchmakingPath || '/api/matchmaking';
const PARTY_PATH = SHARED_PROTOCOL.partyPath || '/api/party';
const PRIVATE_ROOM_PATH = SHARED_PROTOCOL.privateRoomPath || '/api/private-room';
const FRIENDS_PATH = SHARED_PROTOCOL.friendsPath || '/api/friends';

const CLASS_PRESETS = GAMEPLAY_TUNING_WU.classPresets;

export { GlobalArenaRoom };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === (AUTH_PATH.login || '/api/auth/login')) {
      return handleLogin(env, request);
    }

    if (request.method === 'POST' && url.pathname === (AUTH_PATH.logout || '/api/auth/logout')) {
      return handleLogout(env, request);
    }

    if (request.method === 'GET' && url.pathname === (AUTH_PATH.me || '/api/me')) {
      return handleMe(env, request);
    }

    if (request.method === 'GET' && url.pathname === (PROFILE_PATH.me || '/api/profile/me')) {
      return handleProfileMe(env, request);
    }

    if (request.method === 'PATCH' && url.pathname === (PROFILE_PATH.me || '/api/profile/me')) {
      return handleProfileUpdate(env, request);
    }

    if (request.method === 'GET' && url.pathname === (PROFILE_PATH.public || '/api/profile')) {
      return handlePublicProfile(env, request);
    }

    if (request.method === 'POST' && url.pathname === MATCHMAKING_PATH) {
      return handleMatchmaking(env, request);
    }

    if ((request.method === 'GET' || request.method === 'POST') && url.pathname === PARTY_PATH) {
      return handleParty(env, request);
    }

    if ((request.method === 'GET' || request.method === 'POST') && url.pathname === PRIVATE_ROOM_PATH) {
      return handlePrivateRoomLobby(env, request);
    }

    if ((request.method === 'GET' || request.method === 'POST') && url.pathname === FRIENDS_PATH) {
      return handleFriends(env, request);
    }

    if (url.pathname === WS_LOBBY_PATH) {
      return handleWsLobbyUpgrade(env, request);
    }

    if (url.pathname === WS_PATH) {
      return handleWsUpgrade(env, request, CLASS_PRESETS);
    }

    return new Response('Not Found', { status: 404 });
  }
};
