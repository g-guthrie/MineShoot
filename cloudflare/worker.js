import { handleLogin, handleLogout, handleMe } from './server/auth.js';
import { handleMatchmaking } from './server/matchmaking.js';
import { handleProfileMe, handleProfileUpdate, handlePublicProfile } from './server/profile.js';
import { handleWsUpgrade } from './server/ws-upgrade.js';
import { GlobalArenaRoom } from './server/room/GlobalArenaRoom.js';
import { getSharedTuningWu } from './lib/shared-tuning.js';
import { getSharedProtocol } from './lib/shared-protocol.js';

const GAMEPLAY_TUNING_WU = getSharedTuningWu();
const SHARED_PROTOCOL = getSharedProtocol();
const AUTH_PATH = SHARED_PROTOCOL.authPath || {};
const PROFILE_PATH = SHARED_PROTOCOL.profilePath || {};
const WS_PATH = SHARED_PROTOCOL.wsPath || '/api/ws';
const MATCHMAKING_PATH = SHARED_PROTOCOL.matchmakingPath || '/api/matchmaking';

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

    if (url.pathname === WS_PATH) {
      return handleWsUpgrade(env, request, CLASS_PRESETS);
    }

    return new Response('Not Found', { status: 404 });
  }
};
