/**
 * transport.js - WebSocket transport abstraction for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetTransport
 */
(function () {
    'use strict';

    var GameNetTransport = {};

    GameNetTransport.create = function (opts) {
        opts = opts || {};

        var ws = null;
        var reconnectTimer = null;
        var closedByShutdown = false;

        function clearReconnectTimer() {
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        }

        function connect() {
            if (opts.isActive && !opts.isActive()) return;
            closedByShutdown = false;
            clearReconnectTimer();
            ws = new WebSocket(opts.endpoint());

            ws.addEventListener('open', function () {
                if (opts.onOpen) opts.onOpen(ws);
            });

            ws.addEventListener('message', function (event) {
                if (opts.onMessage) opts.onMessage(event.data);
            });

            function scheduleReconnect() {
                reconnectTimer = setTimeout(function () {
                    connect();
                }, opts.reconnectMs || 1200);
            }

            ws.addEventListener('close', function (event) {
                ws = null;
                if (opts.onClose) opts.onClose(event);
                if (closedByShutdown) return;
                if (opts.isActive && !opts.isActive()) return;
                if (event && Number(event.code || 0) === 4001 && typeof opts.onSupersededClose === 'function') {
                    var recovery = opts.onSupersededClose(event);
                    if (recovery && typeof recovery.then === 'function') {
                        recovery.finally(scheduleReconnect);
                        return;
                    }
                }
                scheduleReconnect();
            });

            ws.addEventListener('error', function () {
                if (opts.onError) opts.onError();
            });
        }

        function send(msg) {
            if (!ws || ws.readyState !== WebSocket.OPEN) return false;
            ws.send(JSON.stringify(msg));
            return true;
        }

        function shutdown() {
            closedByShutdown = true;
            clearReconnectTimer();
            if (ws) {
                try { ws.close(); } catch (_err) {}
            }
            ws = null;
        }

        return {
            connect: connect,
            send: send,
            shutdown: shutdown
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameNetTransport = GameNetTransport;
})();
