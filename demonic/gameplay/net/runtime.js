(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var mayhemRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function clone(value) {
        return value ? JSON.parse(JSON.stringify(value)) : null;
    }

    function protocolApi() {
        return mayhemRuntime.GameShared && mayhemRuntime.GameShared.protocol
            ? mayhemRuntime.GameShared.protocol
            : null;
    }

    function normalizeInputState(raw) {
        var input = raw || {};
        return {
            moveForward: !!input.moveForward,
            moveBackward: !!input.moveBackward,
            moveLeft: !!input.moveLeft,
            moveRight: !!input.moveRight,
            sprint: !!input.sprint,
            ads: !!input.ads,
            jumpQueued: !!input.jumpQueued,
            triggerHeld: !!input.triggerHeld
        };
    }

    function getSocketIdentity(authApi) {
        if (authApi && typeof authApi.getSocketIdentity === 'function') return authApi.getSocketIdentity();
        if (authApi && typeof authApi.getUser === 'function') return authApi.getUser();
        return null;
    }

    function getPartyIdentity(authApi) {
        if (authApi && typeof authApi.getPartyIdentity === 'function') return authApi.getPartyIdentity();
        return null;
    }

    function buildWsEndpoint(profile, protocol, roomId, authApi) {
        if (!profile || typeof profile.resolveWsUrl !== 'function' || !protocol) return '';

        var endpoint = profile.resolveWsUrl(protocol.wsPath || '/api/ws');
        var params = new URLSearchParams();
        params.set('room', String(roomId || protocol.defaults && protocol.defaults.roomId || 'global'));

        if (authApi && typeof authApi.getSocketPlayerId === 'function') {
            params.set('pid', String(authApi.getSocketPlayerId() || ''));
        }

        var user = getSocketIdentity(authApi);
        if (user && user.id) {
            params.set('uid', String(user.id));
            params.set('username', String(user.username || user.id));
            params.set('classId', String(user.classId || 'abilities'));
        }

        var actor = getPartyIdentity(authApi);
        if (actor && actor.id) {
            params.set('actorId', String(actor.id));
            params.set('actorName', String(actor.username || actor.id));
        }

        return endpoint + '?' + params.toString();
    }

    function buildAuthoritativeSelfKey(selfState) {
        if (!selfState || typeof selfState !== 'object') return '';
        function precision(value) {
            return Math.round(Number(value || 0) * 1000);
        }
        return [
            Number(selfState.seq || 0),
            precision(selfState.x),
            precision(selfState.y),
            precision(selfState.z),
            precision(selfState.yaw),
            precision(selfState.pitch),
            precision(selfState.velocityY),
            selfState.isGrounded ? '1' : '0'
        ].join('|');
    }

    function create(context) {
        context = context || {};
        var inputHistoryApi = demonicRuntime.GameNetInputHistory || null;
        var stateViewApi = demonicRuntime.GameNetStateView || null;
        var transportApi = demonicRuntime.GameNetTransport || null;
        var mode = context.mode || null;
        var profile = mayhemRuntime.GameRuntimeProfile || globalThis.GameRuntimeProfile || null;
        var protocol = protocolApi();
        var authApi = mayhemRuntime.GameNetAuth || null;
        var roomId = String(
            context.context && context.context.roomId ||
            mode && mode.roomId ||
            protocol && protocol.defaults && protocol.defaults.roomId ||
            ''
        );
        var authorityMode = String(mode && mode.authorityMode || 'offline');
        var backendKind = String(mode && mode.backendKind || '');
        var apiBase = profile && profile.resolveApiUrl ? profile.resolveApiUrl('/api') : '';
        var wsBase = profile && profile.resolveWsUrl ? profile.resolveWsUrl('/api/room') : '';
        var inputHistory = inputHistoryApi && inputHistoryApi.create ? inputHistoryApi.create(context) : null;
        var stateView = stateViewApi && stateViewApi.create ? stateViewApi.create(context) : null;
        var transport = null;
        var connectPromise = null;
        var connected = false;
        var connectionState = authorityMode === 'networked' ? 'idle' : 'offline';
        var connectionError = '';
        var selfId = '';
        var tickRate = 0;
        var lastServerMessageAt = 0;
        var lastInputDispatchedAt = 0;
        var nextDispatchInSec = 0;
        var predictedSelfState = null;
        var localIntent = {
            inputState: normalizeInputState(null),
            yaw: 0,
            pitch: 0,
            weaponId: ''
        };
        var lastConsumedAuthoritativeKey = '';
        var lastConsumedReplayAckSeq = 0;

        function syncRoomState(patch) {
            if (!stateView || !stateView.setRoomState) return;
            stateView.setRoomState(Object.assign({
                roomId: roomId,
                authorityMode: authorityMode,
                backendKind: backendKind,
                authoritative: authorityMode === 'networked',
                selfId: selfId,
                tickRate: tickRate,
                connectionState: connectionState
            }, patch || {}));
        }

        function setConnectionState(nextState, err) {
            connectionState = String(nextState || connectionState || 'idle');
            connectionError = err ? String(err) : '';
            syncRoomState({ connectionState: connectionState });
        }

        function currentStateViewSnapshot() {
            return stateView && stateView.getSnapshot
                ? stateView.getSnapshot()
                : { roomState: null, selfState: null, matchState: null };
        }

        function handleMessage(raw) {
            var message = raw;
            if (typeof raw === 'string') {
                try {
                    message = JSON.parse(raw);
                } catch (_err) {
                    setConnectionState('error', 'Invalid room message.');
                    return;
                }
            }
            if (!message || typeof message !== 'object') return;
            lastServerMessageAt = Date.now();

            var s2c = protocol && protocol.msg && protocol.msg.s2c ? protocol.msg.s2c : {};

            if (message.t === s2c.WELCOME) {
                selfId = String(message.selfId || selfId || '');
                tickRate = Math.max(0, Number(message.tickRate || 0));
                roomId = String(message.roomId || roomId || '');
                if (stateView && stateView.setMatchState) {
                    stateView.setMatchState(message.matchState || null);
                }
                syncRoomState({
                    roomId: roomId,
                    selfId: selfId,
                    tickRate: tickRate,
                    gameMode: String(message.gameMode || ''),
                    privateRoomPhase: String(message.privateRoomPhase || ''),
                    worldSeed: String(message.worldSeed || ''),
                    worldProfileVersion: Math.max(0, Number(message.worldProfileVersion || 0)),
                    worldFlags: clone(message.worldFlags || null)
                });
                setConnectionState('connected');
                return;
            }

            if (message.t === s2c.SNAPSHOT) {
                if (stateView && stateView.setMatchState) {
                    stateView.setMatchState(message.matchState || null);
                }
                syncRoomState({
                    gameMode: String(message.gameMode || ''),
                    privateRoomPhase: String(message.privateRoomPhase || '')
                });

                var entities = Array.isArray(message.entities) ? message.entities : [];
                var remotes = [];
                for (var i = 0; i < entities.length; i++) {
                    var entity = entities[i];
                    if (!entity) continue;
                    if (selfId && String(entity.id || '') === selfId) {
                        if (stateView && stateView.setSelfState) stateView.setSelfState(entity);
                        if (inputHistory && typeof inputHistory.acknowledgeThrough === 'function') {
                            inputHistory.acknowledgeThrough(entity.seq);
                        }
                    } else {
                        remotes.push(entity);
                    }
                }
                if (stateView && stateView.setRemoteEntities) stateView.setRemoteEntities(remotes);
                setConnectionState('connected');
                return;
            }

            if (message.t === s2c.DAMAGE_EVENT) {
                var targetId = String(message.targetId || '');
                var sourceId = String(message.sourceId || '');
                var damageEvent = {
                    targetId: targetId,
                    sourceId: sourceId,
                    damage: Math.max(0, Number(message.damage || 0)),
                    hitType: message.hitType === 'head' ? 'head' : 'body',
                    weaponId: String(message.weaponId || ''),
                    killed: !!message.killed
                };

                var authority = currentStateViewSnapshot();
                var currentSelf = authority && authority.selfState ? clone(authority.selfState) : null;
                if (targetId && targetId === selfId) {
                    if (!currentSelf) currentSelf = { id: selfId };
                    if (typeof message.health === 'number') currentSelf.hp = Number(message.health || 0);
                    if (typeof message.armor === 'number') currentSelf.armor = Number(message.armor || 0);
                    if (message.killed) currentSelf.alive = false;
                    if (stateView && stateView.setSelfState) stateView.setSelfState(currentSelf);
                    if (stateView && stateView.setLastIncomingDamage) stateView.setLastIncomingDamage(damageEvent);
                }

                if (sourceId && sourceId === selfId && targetId && targetId !== selfId) {
                    if (stateView && stateView.setLastConfirmedHit) stateView.setLastConfirmedHit(damageEvent);
                }
                return;
            }

            if (message.t === s2c.DEATH_RESPAWN) {
                if (String(message.entityId || '') !== selfId) return;
                var nextRespawn = {
                    entityId: String(message.entityId || ''),
                    respawnAt: Math.max(Date.now(), Number(message.respawnAt || 0)),
                    x: typeof message.x === 'number' ? Number(message.x) : null,
                    z: typeof message.z === 'number' ? Number(message.z) : null,
                    classApplied: String(message.classApplied || '')
                };
                if (stateView && stateView.setRespawnState) stateView.setRespawnState(nextRespawn);
                var authoritySelf = currentStateViewSnapshot().selfState ? clone(currentStateViewSnapshot().selfState) : { id: selfId };
                authoritySelf.alive = false;
                if (stateView && stateView.setSelfState) stateView.setSelfState(authoritySelf);
                return;
            }

            if (message.t === s2c.ERROR) {
                setConnectionState('error', message.error || message.reason || 'Authoritative room error.');
            }
        }

        function ensureConnection() {
            if (authorityMode !== 'networked') return Promise.resolve(false);
            if (connected) return Promise.resolve(true);
            if (connectPromise) return connectPromise;
            if (!transportApi || typeof transportApi.create !== 'function') {
                setConnectionState('error', 'Network transport unavailable.');
                return Promise.resolve(false);
            }
            if (!profile || typeof profile.resolveWsUrl !== 'function' || !protocol) {
                setConnectionState('error', 'Runtime profile unavailable.');
                return Promise.resolve(false);
            }

            setConnectionState('connecting');
            connectPromise = Promise.resolve(
                authApi && typeof authApi.ensureArenaIdentity === 'function'
                    ? authApi.ensureArenaIdentity()
                    : null
            ).catch(function () {
                return null;
            }).then(function () {
                transport = transportApi.create({
                    endpoint: function () {
                        return buildWsEndpoint(profile, protocol, roomId, authApi);
                    },
                    shouldReconnect: function () {
                        return authorityMode === 'networked';
                    },
                    reconnectMs: 1200,
                    onOpen: function () {
                        connected = true;
                        setConnectionState('connected');
                    },
                    onMessage: handleMessage,
                    onClose: function () {
                        connected = false;
                        setConnectionState('reconnecting');
                    },
                    onError: function () {
                        connected = false;
                        setConnectionState('error', 'Socket transport error.');
                    }
                });
                transport.connect();
                return true;
            }).finally(function () {
                connectPromise = null;
            });
            return connectPromise;
        }

        function maybeDispatchInput(dt) {
            var elapsed = Math.max(0, Number(dt || 0));
            nextDispatchInSec -= elapsed;
            if (nextDispatchInSec > 0) return;

            var targetRate = tickRate > 0 ? tickRate : 30;
            nextDispatchInSec = 1 / targetRate;

            var now = Date.now();
            var dtMs = lastInputDispatchedAt > 0
                ? Math.max(1, now - lastInputDispatchedAt)
                : Math.round(nextDispatchInSec * 1000);
            lastInputDispatchedAt = now;

            var seq = inputHistory && inputHistory.recordSample
                ? inputHistory.recordSample(localIntent.inputState, dtMs, {
                    yaw: localIntent.yaw,
                    pitch: localIntent.pitch,
                    weaponId: localIntent.weaponId
                })
                : 0;

            if (!seq) return;
            if (inputHistory && inputHistory.markDispatched) {
                inputHistory.markDispatched(seq, now);
            }
            if (authorityMode !== 'networked') return;
            if (!connected || !transport || typeof transport.send !== 'function' || !protocol || !protocol.msg) return;

            transport.send({
                t: protocol.msg.c2s.INPUT,
                seq: seq,
                dtMs: dtMs,
                yaw: Number(localIntent.yaw || 0),
                pitch: Number(localIntent.pitch || 0),
                forward: !!localIntent.inputState.moveForward,
                backward: !!localIntent.inputState.moveBackward,
                left: !!localIntent.inputState.moveLeft,
                right: !!localIntent.inputState.moveRight,
                jump: !!localIntent.inputState.jumpQueued,
                sprint: !!localIntent.inputState.sprint,
                adsActive: !!localIntent.inputState.ads,
                weaponId: String(localIntent.weaponId || ''),
                inputMode: 'intent'
            });
        }

        syncRoomState();

        return {
            update: function (dt) {
                ensureConnection();
                maybeDispatchInput(dt);
            },
            recordLocalInput: function (inputState, dtMs, meta) {
                return inputHistory && inputHistory.recordSample
                    ? inputHistory.recordSample(inputState, dtMs, meta)
                    : 0;
            },
            acknowledgeInputSeq: function (seq) {
                return inputHistory && inputHistory.acknowledgeThrough
                    ? inputHistory.acknowledgeThrough(seq)
                    : 0;
            },
            captureLocalIntent: function (intent) {
                var next = intent || {};
                localIntent = {
                    inputState: normalizeInputState(next.inputState || next),
                    yaw: Number(next.yaw || 0),
                    pitch: Number(next.pitch || 0),
                    weaponId: String(next.weaponId || '')
                };
                return clone(localIntent);
            },
            setLocalSelfState: function (nextState) {
                predictedSelfState = clone(nextState);
                if (authorityMode !== 'networked' && stateView && stateView.setSelfState) {
                    stateView.setSelfState(nextState || null);
                }
            },
            setAuthoritativeSelfState: function (nextState) {
                if (stateView && stateView.setSelfState) stateView.setSelfState(nextState || null);
            },
            setAuthoritativeMatchState: function (nextState) {
                if (stateView && stateView.setMatchState) stateView.setMatchState(nextState || null);
            },
            sendFire: function (request) {
                var next = request || {};
                var payload = {
                    t: protocol && protocol.msg && protocol.msg.c2s ? protocol.msg.c2s.FIRE : 'fire',
                    weaponId: String(next.weaponId || ''),
                    shotToken: String(next.shotToken || ''),
                    adsActive: !!next.adsActive,
                    viewFovDeg: Number(next.viewFovDeg || 0),
                    aimOrigin: next.aimOrigin ? {
                        x: Number(next.aimOrigin.x || 0),
                        y: Number(next.aimOrigin.y || 0),
                        z: Number(next.aimOrigin.z || 0)
                    } : null,
                    aimForward: next.aimForward ? {
                        x: Number(next.aimForward.x || 0),
                        y: Number(next.aimForward.y || 0),
                        z: Number(next.aimForward.z || 0)
                    } : null
                };
                if (stateView && stateView.setLastOutgoingFire) {
                    stateView.setLastOutgoingFire({
                        weaponId: payload.weaponId,
                        shotToken: payload.shotToken,
                        adsActive: payload.adsActive,
                        viewFovDeg: payload.viewFovDeg
                    });
                }
                if (authorityMode !== 'networked' || !connected || !transport || typeof transport.send !== 'function') {
                    return false;
                }
                return transport.send(payload);
            },
            receiveMessage: handleMessage,
            consumeAuthoritativeMotionCorrection: function () {
                if (authorityMode !== 'networked') return null;
                var authority = currentStateViewSnapshot();
                var selfState = authority && authority.selfState ? authority.selfState : null;
                if (!selfState) return null;

                var inputSync = inputHistory && inputHistory.getSnapshot ? inputHistory.getSnapshot() : null;
                var pendingInputs = inputSync && Array.isArray(inputSync.pendingInputs) ? inputSync.pendingInputs : [];
                var currentKey = buildAuthoritativeSelfKey(selfState);
                var shouldReplay = protocolApi() && mayhemRuntime.GameShared && mayhemRuntime.GameShared.authoritativeReconciliation &&
                    mayhemRuntime.GameShared.authoritativeReconciliation.shouldReplayAuthoritativeCorrection
                    ? mayhemRuntime.GameShared.authoritativeReconciliation.shouldReplayAuthoritativeCorrection({
                        pendingInputCount: inputSync ? Number(inputSync.pendingInputCount || 0) : 0,
                        lastAckedSeq: inputSync ? Number(inputSync.lastAckedSeq || 0) : 0,
                        lastReplayAckSeq: Number(lastConsumedReplayAckSeq || 0)
                    })
                    : false;

                if (shouldReplay) {
                    lastConsumedReplayAckSeq = Math.max(lastConsumedReplayAckSeq, Number(inputSync && inputSync.lastAckedSeq || 0));
                    lastConsumedAuthoritativeKey = currentKey;
                    return {
                        type: 'replay',
                        selfState: clone(selfState),
                        pendingInputs: clone(pendingInputs),
                        lastAckedSeq: Number(inputSync && inputSync.lastAckedSeq || 0)
                    };
                }

                if (currentKey && currentKey !== lastConsumedAuthoritativeKey) {
                    lastConsumedAuthoritativeKey = currentKey;
                    return {
                        type: 'apply',
                        selfState: clone(selfState)
                    };
                }
                return null;
            },
            getSnapshot: function () {
                var authority = currentStateViewSnapshot();
                var inputSync = inputHistory && inputHistory.getSnapshot ? inputHistory.getSnapshot() : {
                    lastSentSeq: 0,
                    lastAckedSeq: 0,
                    pendingInputCount: 0,
                    latestPendingAgeMs: 0,
                    pendingInputs: []
                };
                return {
                    authorityMode: authorityMode,
                    backendKind: backendKind,
                    roomId: roomId,
                    authoritative: authorityMode === 'networked',
                    apiBase: String(apiBase || ''),
                    wsBase: String(wsBase || ''),
                    selfId: String(selfId || ''),
                    tickRate: Number(tickRate || 0),
                    connectionState: String(connectionState || ''),
                    connectionError: String(connectionError || ''),
                    lastServerMessageAt: Number(lastServerMessageAt || 0),
                    inputSync: inputSync,
                    selfState: authority.selfState,
                    predictedSelfState: clone(predictedSelfState),
                    matchState: authority.matchState,
                    remoteEntities: Array.isArray(authority.remoteEntities) ? clone(authority.remoteEntities) : [],
                    lastOutgoingFire: authority.lastOutgoingFire,
                    lastConfirmedHit: authority.lastConfirmedHit,
                    lastIncomingDamage: authority.lastIncomingDamage,
                    respawnState: authority.respawnState,
                    status: authorityMode === 'networked'
                        ? (connected
                            ? (authority.selfState ? 'authoritative cloudflare lane' : 'authoritative cloudflare lane awaiting self state')
                            : (connectionState === 'error'
                                ? 'authoritative cloudflare lane error'
                                : 'authoritative cloudflare lane connecting'))
                        : 'local fallback lane'
                };
            },
            destroy: function () {
                if (transport && typeof transport.shutdown === 'function') {
                    transport.shutdown();
                }
                transport = null;
                connected = false;
                setConnectionState(authorityMode === 'networked' ? 'stopped' : 'offline');
            }
        };
    }

    demonicRuntime.GameNetRuntime = {
        create: create
    };
})();
