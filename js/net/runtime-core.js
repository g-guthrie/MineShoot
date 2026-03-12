/**
 * runtime-core.js - Connection lifecycle and frame-update runtime for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetRuntimeCore
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};

        function cloneInputState(inputState) {
            return inputState ? {
                forward: !!inputState.forward,
                backward: !!inputState.backward,
                left: !!inputState.left,
                right: !!inputState.right,
                jump: !!inputState.jump,
                sprint: !!inputState.sprint,
                adsActive: !!inputState.adsActive
            } : null;
        }

        function clearReconnectTimer() {
            var transport = opts.getTransport();
            if (transport && transport.shutdown) {
                transport.shutdown();
                opts.setTransport(null);
            }
            var reconnectTimer = opts.getReconnectTimer();
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                opts.setReconnectTimer(null);
            }
        }

        function connectWs() {
            var socketIdentity = opts.getSocketIdentity();
            var attemptSeq = opts.nextConnectAttemptSeq();
            if (!opts.isActive() || !socketIdentity) return;
            clearReconnectTimer();

            function openConnection() {
                if (!opts.isActive() || attemptSeq !== opts.getConnectAttemptSeq()) return;

                var transportApi = opts.getTransportApi();
                if (transportApi && transportApi.create) {
                    opts.setTransport(transportApi.create({
                        endpoint: opts.wsEndpoint,
                        isActive: opts.isActive,
                        reconnectMs: 1200,
                        onOpen: function (socket) {
                            opts.setWs(socket);
                            opts.setConnected(true);
                        },
                        onMessage: opts.handleMessage,
                        onClose: function () {
                            opts.setConnected(false);
                            opts.setWs(null);
                        },
                        onSupersededClose: function () {
                            if (opts.handleSupersededIdentity) {
                                return opts.handleSupersededIdentity();
                            }
                            return null;
                        },
                        onError: function () {
                            opts.setConnected(false);
                        }
                    }));
                    opts.getTransport().connect();
                    return;
                }

                var endpoint = opts.wsEndpoint();
                var ws = new WebSocket(endpoint);
                opts.setWs(ws);

                ws.addEventListener('open', function () {
                    opts.setConnected(true);
                });

                ws.addEventListener('message', function (event) {
                    opts.handleMessage(event.data);
                });

                ws.addEventListener('close', function () {
                    opts.setConnected(false);
                    opts.setWs(null);
                    if (!opts.isActive()) return;
                    opts.setReconnectTimer(setTimeout(function () {
                        connectWs();
                    }, 1200));
                });

                ws.addEventListener('error', function () {
                    opts.setConnected(false);
                });
            }

            var ensureArenaIdentity = opts.ensureArenaIdentity();
            if (ensureArenaIdentity) {
                ensureArenaIdentity
                    .then(function () {
                        openConnection();
                    })
                    .catch(function () {
                        openConnection();
                    });
                return;
            }

            openConnection();
        }

        function wsSend(msg) {
            var transport = opts.getTransport();
            if (transport && transport.send) return transport.send(msg);
            var ws = opts.getWs();
            if (!ws || ws.readyState !== WebSocket.OPEN) return false;
            ws.send(JSON.stringify(msg));
            return true;
        }

        function update(dt, playerPos, rotation) {
            if (!opts.isActive()) return;

            var pendingRespawnInfo = opts.getPendingRespawnInfo();
            if (pendingRespawnInfo && pendingRespawnInfo.active && Date.now() >= Number(pendingRespawnInfo.respawnAt || 0)) {
                opts.setPendingRespawnInfo(null);
            }
            opts.applyPendingSpawnSync();

            var inputSendTimer = opts.getInputSendTimer() - dt;
            if (playerPos && rotation) {
                var framePlayerApi = opts.getPlayerApi();
                var frameInputState = (framePlayerApi && framePlayerApi.getNetworkInputState) ? framePlayerApi.getNetworkInputState() : null;
                if (opts.pushLocalPredictionSample) {
                    opts.pushLocalPredictionSample({
                        at: Date.now(),
                        dtMs: Math.max(1, Math.round(Math.max(0, Number(dt || 0)) * 1000)),
                        yaw: rotation.yaw || 0,
                        pitch: rotation.pitch || 0,
                        inputState: cloneInputState(frameInputState)
                    });
                }
            }
            if (inputSendTimer <= 0) {
                inputSendTimer = opts.getInputSendInterval();
                if (playerPos && rotation) {
                    var playerApi = opts.getPlayerApi();
                    var anim = (playerApi && playerApi.getAnimNetState) ? playerApi.getAnimNetState() : null;
                    var inputState = (playerApi && playerApi.getNetworkInputState) ? playerApi.getNetworkInputState() : null;
                    var seq = opts.nextInputSeq();
                    var sentAt = Date.now();
                    var inputSeqHistory = opts.getInputSeqHistory();
                    var previousSample = inputSeqHistory.length > 0 ? inputSeqHistory[inputSeqHistory.length - 1] : null;
                    var dtMs = previousSample ? Math.max(1, sentAt - Number(previousSample.at || sentAt)) : Math.round(opts.getInputSendInterval() * 1000);
                    opts.setLastInputSeqSent(seq);
                    inputSeqHistory.push({
                        seq: seq,
                        at: sentAt,
                        dtMs: dtMs,
                        yaw: rotation.yaw || 0,
                        pitch: rotation.pitch || 0,
                        inputState: cloneInputState(inputState)
                    });
                    if (inputSeqHistory.length > 96) inputSeqHistory.shift();
                    if (opts.clearLocalPredictionSamples) {
                        opts.clearLocalPredictionSamples();
                    }
                    wsSend({
                        t: opts.getInputMessageType(),
                        seq: seq,
                        dtMs: dtMs,
                        yaw: rotation.yaw || 0,
                        pitch: rotation.pitch || 0,
                        forward: !!(inputState && inputState.forward),
                        backward: !!(inputState && inputState.backward),
                        left: !!(inputState && inputState.left),
                        right: !!(inputState && inputState.right),
                        jump: !!(inputState && inputState.jump),
                        sprint: !!(inputState && inputState.sprint),
                        adsActive: !!(inputState && inputState.adsActive),
                        weaponId: (anim && anim.equippedWeaponId) ? anim.equippedWeaponId : 'rifle',
                        inputMode: 'intent'
                    });
                }
            }
            opts.setInputSendTimer(inputSendTimer);

            var remoteSyncApi = opts.getRemoteSyncApi();
            if (remoteSyncApi && remoteSyncApi.updateRemoteEntities) {
                remoteSyncApi.updateRemoteEntities(
                    dt,
                    opts.getRenderMap(),
                    opts.getChokeVictimStateForEntity
                );
            }
        }

        function shutdownConnection() {
            clearReconnectTimer();
            var ws = opts.getWs();
            if (ws) {
                try { ws.close(); } catch (_err) {}
                opts.setWs(null);
            }
            opts.setConnected(false);
        }

        return {
            clearReconnectTimer: clearReconnectTimer,
            connectWs: connectWs,
            wsSend: wsSend,
            update: update,
            shutdownConnection: shutdownConnection
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetRuntimeCore = {
        create: create
    };
})();
