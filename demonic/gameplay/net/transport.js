(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create(options) {
        options = options || {};

        var socket = null;
        var reconnectTimer = null;
        var closedByShutdown = false;

        function clearReconnectTimer() {
            if (!reconnectTimer) return;
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        function shouldReconnect() {
            return typeof options.shouldReconnect === 'function' ? !!options.shouldReconnect() : true;
        }

        function bindSocket(nextSocket) {
            socket = nextSocket;
            if (!socket || typeof socket.addEventListener !== 'function') return;

            socket.addEventListener('open', function () {
                if (typeof options.onOpen === 'function') options.onOpen(socket);
            });
            socket.addEventListener('message', function (event) {
                if (typeof options.onMessage === 'function') options.onMessage(event && event.data);
            });
            socket.addEventListener('close', function () {
                socket = null;
                if (typeof options.onClose === 'function') options.onClose();
                if (closedByShutdown || !shouldReconnect()) return;
                reconnectTimer = setTimeout(connect, Math.max(100, Number(options.reconnectMs || 1200)));
            });
            socket.addEventListener('error', function (err) {
                if (typeof options.onError === 'function') options.onError(err || null);
            });
        }

        function connect() {
            clearReconnectTimer();
            closedByShutdown = false;
            if (!shouldReconnect()) return;

            if (typeof options.createSocket === 'function') {
                bindSocket(options.createSocket());
                return;
            }

            if (typeof WebSocket !== 'function') {
                throw new Error('WebSocket unavailable.');
            }
            bindSocket(new WebSocket(options.endpoint()));
        }

        function send(payload) {
            if (!socket || socket.readyState !== 1) return false;
            socket.send(JSON.stringify(payload));
            return true;
        }

        function shutdown() {
            closedByShutdown = true;
            clearReconnectTimer();
            if (socket) {
                try { socket.close(); } catch (_err) {}
            }
            socket = null;
        }

        return {
            connect: connect,
            send: send,
            shutdown: shutdown
        };
    }

    demonicRuntime.GameNetTransport = {
        create: create
    };
})();
