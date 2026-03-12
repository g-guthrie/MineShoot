import { handleMatchmaking } from './server/matchmaking.js';
import { handleWsUpgrade } from './server/ws-upgrade.js';
import { GlobalArenaRoom } from './server/room/GlobalArenaRoom.js';
import { getSharedTuningWu } from './lib/shared-tuning.js';
import { getSharedProtocol } from './lib/shared-protocol.js';

const GAMEPLAY_TUNING_WU = getSharedTuningWu();
const SHARED_PROTOCOL = getSharedProtocol();
const WS_PATH = SHARED_PROTOCOL.wsPath || '/api/ws';
const MATCHMAKING_PATH = SHARED_PROTOCOL.matchmakingPath || '/api/matchmaking';

const CLASS_PRESETS = GAMEPLAY_TUNING_WU.classPresets;

export { GlobalArenaRoom };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === MATCHMAKING_PATH) {
      return handleMatchmaking(env, request);
    }

    if (url.pathname === WS_PATH) {
      return handleWsUpgrade(env, request, CLASS_PRESETS);
    }

    return new Response('Not Found', { status: 404 });
  }
};
