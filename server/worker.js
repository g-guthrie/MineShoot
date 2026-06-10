/**
 * worker.js - Cloudflare Worker entry. Routes WebSocket upgrades to the
 * arena Durable Object; static assets are served by Cloudflare Pages.
 */
import { GlobalArenaRoom } from './room.js';

export { GlobalArenaRoom };

function sanitizeRoomId(raw) {
  let id = String(raw || '').toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
  if (!id) return 'global';
  return id.slice(0, 32);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/ws') {
      const roomId = sanitizeRoomId(url.searchParams.get('room') || env.ROOM_NAME || 'global');
      const id = env.GLOBAL_ARENA.idFromName(roomId);
      return env.GLOBAL_ARENA.get(id).fetch(request);
    }

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, service: 'mineshoot' });
    }

    return new Response('Not found', { status: 404 });
  }
};
