/**
 * Cloudflare Worker entrypoint. Static assets (the built client + game
 * assets) are served by the assets binding; /api/* runs here and routes
 * multiplayer rooms to ZombiesRoom Durable Objects.
 */
export { ZombiesRoom } from './room';

export interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace;
}

const ROOM_CODE_RE = /^[A-Z0-9]{1,16}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true });
    }

    // /api/room/:code/ws — WebSocket into the room's Durable Object.
    const roomMatch = url.pathname.match(/^\/api\/room\/([^/]+)\/ws$/);
    if (roomMatch) {
      const code = decodeURIComponent(roomMatch[1]!).toUpperCase();
      if (!ROOM_CODE_RE.test(code)) {
        return Response.json({ error: 'invalid room code' }, { status: 400 });
      }
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return Response.json({ error: 'expected websocket' }, { status: 426 });
      }
      const id = env.ROOMS.idFromName(code);
      return env.ROOMS.get(id).fetch(request);
    }

    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'not found' }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
