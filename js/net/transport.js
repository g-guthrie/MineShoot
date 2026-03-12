export function createNetTransport(options = {}) {
  let ws = null;
  let reconnectTimer = null;
  let closedByShutdown = false;

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function connect() {
    if (options.isActive && !options.isActive()) return;
    closedByShutdown = false;
    clearReconnectTimer();
    ws = new WebSocket(options.endpoint());

    ws.addEventListener('open', function onOpen() {
      if (options.onOpen) options.onOpen(ws);
    });

    ws.addEventListener('message', function onMessage(event) {
      if (options.onMessage) options.onMessage(event.data);
    });

    ws.addEventListener('close', function onClose() {
      ws = null;
      if (options.onClose) options.onClose();
      if (closedByShutdown) return;
      if (options.isActive && !options.isActive()) return;
      reconnectTimer = setTimeout(function reconnect() {
        connect();
      }, options.reconnectMs || 1200);
    });

    ws.addEventListener('error', function onError() {
      if (options.onError) options.onError();
    });
  }

  function send(message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(message));
    return true;
  }

  function shutdown() {
    closedByShutdown = true;
    clearReconnectTimer();
    if (ws) {
      try {
        ws.close();
      } catch (_err) {
        // no-op
      }
    }
    ws = null;
  }

  return {
    connect,
    send,
    shutdown
  };
}
