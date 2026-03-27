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
                if (opts.onTransportConnectStart) opts.onTransportConnectStart();

                var transportApi = opts.getTransportApi();
                if (transportApi && transportApi.create) {
                    opts.setTransport(transportApi.create({
                        endpoint: opts.wsEndpoint,
                        isActive: opts.isActive,
                        reconnectMs: 1200,
                        onOpen: function (socket) {
                            opts.setWs(socket);
                            opts.setConnected(true);
                            if (opts.onTransportOpen) opts.onTransportOpen(socket);
                        },
                        onMessage: opts.handleMessage,
                        onClose: function () {
                            opts.setConnected(false);
                            opts.setWs(null);
                            if (opts.onTransportClose) opts.onTransportClose();
                        },
                        onSupersededClose: function () {
                            if (opts.handleSupersededIdentity) {
                                return opts.handleSupersededIdentity();
                            }
                            return null;
                        },
                        onError: function () {
                            opts.setConnected(false);
                            if (opts.onTransportError) opts.onTransportError();
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
                    if (opts.onTransportOpen) opts.onTransportOpen(ws);
                });

                ws.addEventListener('message', function (event) {
                    opts.handleMessage(event.data);
                });

                ws.addEventListener('close', function () {
                    opts.setConnected(false);
                    opts.setWs(null);
                    if (opts.onTransportClose) opts.onTransportClose();
                    if (!opts.isActive()) return;
                    opts.setReconnectTimer(setTimeout(function () {
                        connectWs();
                    }, 1200));
                });

                ws.addEventListener('error', function () {
                    opts.setConnected(false);
                    if (opts.onTransportError) opts.onTransportError();
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

        function hasMovementIntent(inputState) {
            return !!(inputState && (
                inputState.forward ||
                inputState.backward ||
                inputState.left ||
                inputState.right
            ));
        }

        function shouldFlushInputImmediately(inputState, lastSentInputSample) {
            if (!lastSentInputSample) return false;
            var priorInputState = lastSentInputSample.inputState || null;
            if (!!(inputState && inputState.jump) && !(priorInputState && priorInputState.jump)) return true;
            if (!!(inputState && inputState.adsActive) !== !!(priorInputState && priorInputState.adsActive)) return true;
            if (!!(inputState && inputState.sprint) !== !!(priorInputState && priorInputState.sprint)) return true;
            return hasMovementIntent(inputState) !== hasMovementIntent(priorInputState);
        }

        function sendInputSample(inputState, rotation, anim, inputSendInterval) {
            var seq = opts.nextInputSeq();
            var sentAt = Date.now();
            var inputSeqHistory = opts.getInputSeqHistory();
            var previousSample = inputSeqHistory.length > 0
                ? inputSeqHistory[inputSeqHistory.length - 1]
                : (opts.getLastSentInputSample ? opts.getLastSentInputSample() : null);
            var dtMs = previousSample ? Math.max(1, sentAt - Number(previousSample.at || sentAt)) : Math.round(inputSendInterval * 1000);
            var sentSample = {
                seq: seq,
                at: sentAt,
                dtMs: dtMs,
                yaw: rotation.yaw || 0,
                pitch: rotation.pitch || 0,
                inputState: cloneInputState(inputState)
            };
            if (wsSend({
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
            })) {
                opts.setLastInputSeqSent(seq);
                if (opts.setLastSentInputSample) {
                    opts.setLastSentInputSample(sentSample);
                }
                inputSeqHistory.push(sentSample);
                if (inputSeqHistory.length > 96) inputSeqHistory.shift();
            }
        }

        function update(dt, playerPos, rotation) {
            if (!opts.isActive()) return;

            var pendingRespawnInfo = opts.getPendingRespawnInfo();
            if (pendingRespawnInfo && pendingRespawnInfo.active && pendingRespawnInfo.needsClockTranslation && opts.getConnectionTimingState && opts.toLocalClockTime) {
                var timingState = opts.getConnectionTimingState();
                if (timingState && timingState.snapshot) {
                    var translatedRespawnAt = Number(opts.toLocalClockTime(pendingRespawnInfo.serverRespawnAt || 0) || 0);
                    var localRespawnAt = translatedRespawnAt > 0 ? Math.max(Date.now(), translatedRespawnAt) : 0;
                    if (localRespawnAt > 0 && opts.setPendingSpawnSync && typeof pendingRespawnInfo.spawnX === 'number' && typeof pendingRespawnInfo.spawnZ === 'number') {
                        opts.setPendingSpawnSync({
                            x: Number(pendingRespawnInfo.spawnX || 0),
                            z: Number(pendingRespawnInfo.spawnZ || 0),
                            executeAt: localRespawnAt,
                            kind: 'respawn'
                        });
                    }
                    pendingRespawnInfo = Object.assign({}, pendingRespawnInfo, {
                        localRespawnAt: localRespawnAt,
                        respawnAt: localRespawnAt,
                        needsClockTranslation: false
                    });
                    opts.setPendingRespawnInfo(pendingRespawnInfo);
                }
            }
            if (pendingRespawnInfo && pendingRespawnInfo.active && Date.now() >= Number(pendingRespawnInfo.localRespawnAt || pendingRespawnInfo.respawnAt || 0)) {
                opts.setPendingRespawnInfo(null);
            }
            opts.applyPendingSpawnSync();

            var pingCadenceSec = Math.max(0.1, Number(opts.getPingCadenceSeconds ? opts.getPingCadenceSeconds() : 0.5));
            var pingSendTimer = Number(opts.getPingSendTimer ? opts.getPingSendTimer() : pingCadenceSec) - dt;
            if (opts.isConnected && opts.isConnected()) {
                if (pingSendTimer <= 0) {
                    pingSendTimer = pingCadenceSec;
                    wsSend({
                        t: opts.getPingMessageType ? opts.getPingMessageType() : 'ping',
                        clientTime: Date.now()
                    });
                }
            } else {
                pingSendTimer = pingCadenceSec;
            }
            if (opts.setPingSendTimer) {
                opts.setPingSendTimer(pingSendTimer);
            }

            var inputSendTimer = opts.getInputSendTimer() - dt;
            var inputSendInterval = Math.max(0.001, Number(opts.getInputSendInterval() || 0));
            var playerApi = opts.getPlayerApi();
            var anim = (playerApi && playerApi.getAnimNetState) ? playerApi.getAnimNetState() : null;
            var inputState = (playerApi && playerApi.getNetworkInputState) ? playerApi.getNetworkInputState() : null;
            var sendDue = inputSendTimer <= 0;
            var canSendInput = playerPos && rotation && (!opts.isConnected || opts.isConnected());
            var forceImmediate = canSendInput && shouldFlushInputImmediately(
                inputState,
                opts.getLastSentInputSample ? opts.getLastSentInputSample() : null
            );
            if (sendDue || forceImmediate) {
                inputSendTimer = sendDue ? (inputSendTimer + inputSendInterval) : inputSendInterval;
                if (canSendInput) {
                    sendInputSample(inputState, rotation, anim, inputSendInterval);
                }
            }
            opts.setInputSendTimer(inputSendTimer);

            var remoteSyncApi = opts.getRemoteSyncApi();
            if (remoteSyncApi && remoteSyncApi.updateRemoteEntities) {
                remoteSyncApi.updateRemoteEntities(
                    dt,
                    opts.getRenderMap()
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
