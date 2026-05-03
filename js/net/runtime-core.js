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
                        maxReconnectMs: 10000,
                        maxReconnectAttempts: 8,
                        reconnectJitterMs: 250,
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
                        },
                        onPermanentClose: function () {
                            opts.setConnected(false);
                            opts.setWs(null);
                            if (opts.onTransportPermanentClose) opts.onTransportPermanentClose();
                        }
                    }));
                    opts.getTransport().connect();
                    return;
                }

                var endpoint = opts.wsEndpoint();
                var ws = new WebSocket(endpoint);
                opts.setWs(ws);
                var socketRef = ws;

                ws.addEventListener('open', function () {
                    if (opts.getWs && opts.getWs() !== socketRef) return;
                    opts.setConnected(true);
                    if (opts.onTransportOpen) opts.onTransportOpen(ws);
                });

                ws.addEventListener('message', function (event) {
                    if (opts.getWs && opts.getWs() !== socketRef) return;
                    opts.handleMessage(event.data);
                });

                ws.addEventListener('close', function () {
                    if (opts.getWs && opts.getWs() !== socketRef) return;
                    opts.setConnected(false);
                    opts.setWs(null);
                    if (opts.onTransportClose) opts.onTransportClose();
                    if (!opts.isActive()) return;
                    opts.setReconnectTimer(setTimeout(function () {
                        connectWs();
                    }, 1200));
                });

                ws.addEventListener('error', function () {
                    if (opts.getWs && opts.getWs() !== socketRef) return;
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

        function inputStatesEqual(a, b) {
            var left = cloneInputState(a);
            var right = cloneInputState(b);
            if (!left && !right) return true;
            if (!left || !right) return false;
            return left.forward === right.forward &&
                left.backward === right.backward &&
                left.left === right.left &&
                left.right === right.right &&
                left.jump === right.jump &&
                left.sprint === right.sprint &&
                left.adsActive === right.adsActive;
        }

        function normalizeAngle(rad) {
            var value = Number(rad || 0);
            while (value > Math.PI) value -= Math.PI * 2;
            while (value < -Math.PI) value += Math.PI * 2;
            return value;
        }

        function getLinkMetrics() {
            var timing = opts.getConnectionTimingState ? (opts.getConnectionTimingState() || null) : null;
            return {
                snapshotAckSeq: Math.max(0, Number(opts.getSnapshotAckSeq ? opts.getSnapshotAckSeq() : 0)),
                linkRttMs: timing ? Math.max(0, Number(timing.rttMs || 0)) : 0,
                linkJitterMs: timing ? Math.max(0, Number(timing.rttJitterMs || 0)) : 0
            };
        }

        function serializeInputSample(sample) {
            var entry = sample && typeof sample === 'object' ? sample : null;
            return {
                seq: Math.max(0, Number(entry && entry.seq || 0)),
                dtMs: Math.max(1, Number(entry && entry.dtMs || 0)),
                yaw: Number(entry && entry.yaw || 0),
                pitch: Number(entry && entry.pitch || 0),
                weaponId: String(entry && entry.weaponId || 'rifle'),
                inputMode: 'intent',
                forward: !!(entry && entry.inputState && entry.inputState.forward),
                backward: !!(entry && entry.inputState && entry.inputState.backward),
                left: !!(entry && entry.inputState && entry.inputState.left),
                right: !!(entry && entry.inputState && entry.inputState.right),
                jump: !!(entry && entry.inputState && entry.inputState.jump),
                sprint: !!(entry && entry.inputState && entry.inputState.sprint),
                adsActive: !!(entry && entry.inputState && entry.inputState.adsActive)
            };
        }

        function immediateInputFlushReason(inputState, rotation, lastSentInputSample) {
            if (!lastSentInputSample) return '';
            var priorInputState = lastSentInputSample.inputState || null;
            if (!!(inputState && inputState.jump) && !(priorInputState && priorInputState.jump)) return 'input';
            if (!inputStatesEqual(inputState, priorInputState)) return 'input';
            var lookDeltaThresholdRad = (0.25 * Math.PI) / 180;
            var yawDelta = Math.abs(normalizeAngle(Number(rotation && rotation.yaw || 0) - Number(lastSentInputSample.yaw || 0)));
            var pitchDelta = Math.abs(Number(rotation && rotation.pitch || 0) - Number(lastSentInputSample.pitch || 0));
            return yawDelta >= lookDeltaThresholdRad || pitchDelta >= lookDeltaThresholdRad || hasMovementIntent(inputState) !== hasMovementIntent(priorInputState)
                ? 'look'
                : '';
        }

        function canFlushRateLimitedImmediate(inputSendTimer, inputSendInterval, lastSentInputSample) {
            if (!lastSentInputSample) return true;
            var interval = Math.max(0.001, Number(inputSendInterval || 0));
            var minImmediateInterval = Math.min(interval, 1 / 120);
            var timer = Math.min(interval, Math.max(0, Number(inputSendTimer || 0)));
            var elapsedSinceLastSend = Math.max(0, interval - timer);
            return (elapsedSinceLastSend + 0.000001) >= minImmediateInterval;
        }

        function shouldFlushForAccumulatedDrift() {
            var positionThresholdWu = 0.05;
            var yawThresholdRad = (0.75 * Math.PI) / 180;
            var positionDriftWu = Math.max(0, Number(opts.getAccumulatedPositionDriftWu ? opts.getAccumulatedPositionDriftWu() : 0));
            var yawDriftRad = Math.max(0, Number(opts.getAccumulatedYawDriftRad ? opts.getAccumulatedYawDriftRad() : 0));
            return positionDriftWu >= positionThresholdWu || yawDriftRad >= yawThresholdRad;
        }

        function resetInputDriftTracking(position, rotation) {
            if (!opts.resetInputDriftTracking) return null;
            return opts.resetInputDriftTracking(position, rotation && rotation.yaw);
        }

        function updateInputDriftTracking(position, rotation) {
            if (!opts.updateInputDriftTracking) return null;
            return opts.updateInputDriftTracking(position, rotation && rotation.yaw);
        }

        function sendInputSample(inputState, rotation, anim, inputSendInterval, playerPos) {
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
                weaponId: (anim && anim.equippedWeaponId) ? String(anim.equippedWeaponId || '') : 'rifle',
                movementLocked: !!(opts.getPlayerApi && opts.getPlayerApi() && opts.getPlayerApi().isMovementLocked && opts.getPlayerApi().isMovementLocked()),
                inputState: cloneInputState(inputState)
            };
            var recentSamples = inputSeqHistory.slice(Math.max(0, inputSeqHistory.length - 3)).concat([sentSample]);
            var linkMetrics = getLinkMetrics();
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
                weaponId: sentSample.weaponId,
                inputMode: 'intent',
                inputs: recentSamples.slice(-4).map(serializeInputSample),
                snapshotAckSeq: linkMetrics.snapshotAckSeq,
                linkRttMs: linkMetrics.linkRttMs,
                linkJitterMs: linkMetrics.linkJitterMs
            })) {
                opts.setLastInputSeqSent(seq);
                if (opts.setLastSentInputSample) {
                    opts.setLastSentInputSample(sentSample);
                }
                inputSeqHistory.push(sentSample);
                if (inputSeqHistory.length > 96) inputSeqHistory.shift();
                resetInputDriftTracking(playerPos, rotation);
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
            var spawnSynced = opts.applyPendingSpawnSync ? !!opts.applyPendingSpawnSync() : false;
            if (spawnSynced) {
                resetInputDriftTracking(playerPos, rotation);
            }

            var pingCadenceSec = Math.max(0.1, Number(opts.getPingCadenceSeconds ? opts.getPingCadenceSeconds() : 0.5));
            var pingSendTimer = Number(opts.getPingSendTimer ? opts.getPingSendTimer() : pingCadenceSec) - dt;
            if (opts.isConnected && opts.isConnected()) {
                if (pingSendTimer <= 0) {
                    pingSendTimer = pingCadenceSec;
                    var linkMetrics = getLinkMetrics();
                    wsSend({
                        t: opts.getPingMessageType ? opts.getPingMessageType() : 'ping',
                        clientTime: Date.now(),
                        snapshotAckSeq: linkMetrics.snapshotAckSeq,
                        linkRttMs: linkMetrics.linkRttMs,
                        linkJitterMs: linkMetrics.linkJitterMs
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
            updateInputDriftTracking(playerPos, rotation);
            var sendDue = inputSendTimer <= 0;
            var canSendInput = playerPos && rotation && (!opts.isConnected || opts.isConnected());
            var lastSentInputSample = opts.getLastSentInputSample ? opts.getLastSentInputSample() : null;
            var immediateReason = canSendInput ? immediateInputFlushReason(
                inputState,
                rotation,
                lastSentInputSample
            ) : '';
            var rateLimitedImmediateReady = canSendInput && canFlushRateLimitedImmediate(
                inputSendTimer,
                inputSendInterval,
                lastSentInputSample
            );
            var forceImmediate = immediateReason === 'input' || (immediateReason === 'look' && rateLimitedImmediateReady);
            var forceFromDrift = canSendInput && shouldFlushForAccumulatedDrift() && rateLimitedImmediateReady;
            if (sendDue || forceImmediate || forceFromDrift) {
                inputSendTimer = sendDue ? (inputSendTimer + inputSendInterval) : inputSendInterval;
                if (canSendInput) {
                    sendInputSample(inputState, rotation, anim, inputSendInterval, playerPos);
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
