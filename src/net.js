/**
 * net.js - WebSocket client. In dev, /api/ws is proxied by vite to the
 * wrangler dev worker; on Cloudflare Pages it falls back to the deployed
 * worker origin when the same-origin route isn't wired up.
 */
const FALLBACK_WORKER_ORIGIN = 'wss://mayhem.gguthrie-minecraft-fps.workers.dev';

function candidateUrls() {
  const params = new URLSearchParams(location.search);
  const room = params.get('room') || 'global';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const urls = [`${proto}//${location.host}/api/ws?room=${room}`];
  const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/.test(location.host);
  if (!isLocal) {
    urls.push(`${FALLBACK_WORKER_ORIGIN}/api/ws?room=${room}`);
  }
  return urls;
}

export function createNet() {
  const handlers = new Map();
  let ws = null;
  let openedOnce = false;

  function on(type, fn) {
    handlers.set(type, fn);
  }

  function emit(type, msg) {
    const fn = handlers.get(type);
    if (fn) fn(msg);
  }

  function connect({ onOpen, onError }) {
    const urls = candidateUrls();
    let attempt = 0;
    openedOnce = false;

    function tryNext() {
      if (attempt >= urls.length) {
        if (onError) onError('');
        return;
      }
      const url = urls[attempt++];
      let socket;
      try {
        socket = new WebSocket(url);
      } catch (err) {
        tryNext();
        return;
      }

      const failTimer = setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          try { socket.close(); } catch (err) { /* noop */ }
        }
      }, 5000);

      socket.addEventListener('open', () => {
        clearTimeout(failTimer);
        ws = socket;
        openedOnce = true;
        if (onOpen) onOpen();
      });

      socket.addEventListener('message', (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (err) {
          return;
        }
        if (msg && typeof msg.t === 'string') emit(msg.t, msg);
      });

      socket.addEventListener('close', () => {
        clearTimeout(failTimer);
        if (ws === socket) {
          ws = null;
          emit('disconnect', {});
        } else if (!openedOnce) {
          tryNext();
        }
      });

      socket.addEventListener('error', () => {
        clearTimeout(failTimer);
        if (!openedOnce && ws !== socket) {
          try { socket.close(); } catch (err) { /* noop */ }
        }
      });
    }

    tryNext();
  }

  function send(msg) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify(msg));
    } catch (err) { /* dropped */ }
  }

  return { on, send, connect, isConnected: () => !!ws && ws.readyState === WebSocket.OPEN };
}
