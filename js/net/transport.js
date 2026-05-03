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
        var reconnectAttempt = 0;

        function baseReconnectMs() {
            return Math.max(100, Number(opts.reconnectMs || 1200));
        }

        function maxReconnectMs() {
            return Math.max(baseReconnectMs(), Number(opts.maxReconnectMs || 10000));
        }

        function maxReconnectAttempts() {
            return Math.max(1, Math.floor(Number(opts.maxReconnectAttempts || 8)));
        }

        function reconnectJitterMs() {
            return Math.max(0, Number(opts.reconnectJitterMs || 0));
        }

        function random() {
            return typeof opts.random === 'function' ? Number(opts.random() || 0) : Math.random();
        }

        function nextReconnectDelayMs() {
            var base = baseReconnectMs();
            var uncapped = base * Math.pow(2, reconnectAttempt);
            var jitter = reconnectJitterMs();
            var jitterValue = jitter > 0 ? Math.floor(Math.max(0, Math.min(1, random())) * jitter) : 0;
            return Math.min(maxReconnectMs(), uncapped) + jitterValue;
        }

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
            var socketRef = ws;

            ws.addEventListener('open', function () {
                if (ws !== socketRef) return;
                reconnectAttempt = 0;
                if (opts.onOpen) opts.onOpen(socketRef);
            });

            ws.addEventListener('message', function (event) {
                if (ws !== socketRef) return;
                if (opts.onMessage) opts.onMessage(event.data);
            });

            function scheduleReconnect() {
                if (closedByShutdown) return;
                if (opts.isActive && !opts.isActive()) return;
                if (reconnectAttempt >= maxReconnectAttempts()) {
                    if (typeof opts.onPermanentClose === 'function') opts.onPermanentClose();
                    return;
                }
                var delayMs = nextReconnectDelayMs();
                reconnectAttempt += 1;
                reconnectTimer = setTimeout(function () {
                    if (closedByShutdown) return;
                    if (opts.isActive && !opts.isActive()) return;
                    connect();
                }, delayMs);
            }

            ws.addEventListener('close', function (event) {
                if (ws !== socketRef) return;
                ws = null;
                if (opts.onClose) opts.onClose(event);
                if (closedByShutdown) return;
                if (opts.isActive && !opts.isActive()) return;
                if (event && Number(event.code || 0) === 4001 && typeof opts.onSupersededClose === 'function') {
                    var recovery = opts.onSupersededClose(event);
                    if (recovery && typeof recovery.then === 'function') {
                        recovery.finally(function () {
                            if (closedByShutdown) return;
                            if (opts.isActive && !opts.isActive()) return;
                            scheduleReconnect();
                        });
                        return;
                    }
                }
                scheduleReconnect();
            });

            ws.addEventListener('error', function () {
                if (ws !== socketRef) return;
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
            reconnectAttempt = 0;
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
