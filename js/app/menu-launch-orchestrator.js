/**
 * menu-launch-orchestrator.js - Explicit menu launch/session state machine.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameMenuLaunchOrchestrator
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameMenuLaunchOrchestrator = {};

    function normalizeGameMode(gameMode) {
        var shared = runtime.GameShared || {};
        if (shared.normalizeGameMode) {
            return String(shared.normalizeGameMode(gameMode) || 'ffa');
        }
        return String(gameMode || 'ffa').toLowerCase();
    }

    function cloneContext(context) {
        var source = context || {};
        return {
            launchKind: String(source.launchKind || ''),
            gameMode: String(source.gameMode || ''),
            roomId: String(source.roomId || ''),
            roomCode: String(source.roomCode || ''),
            roomPhase: String(source.roomPhase || ''),
            modeId: String(source.modeId || ''),
            requiresNetwork: !!source.requiresNetwork,
            canResume: !!source.canResume,
            error: String(source.error || '')
        };
    }

    function emptyContext() {
        return cloneContext(null);
    }

    function createSnapshot(phase, context, runtimeReady, activityState) {
        var nextContext = cloneContext(context);
        var nextActivity = String(activityState || 'menu');
        return {
            phase: String(phase || 'menu_idle'),
            context: nextContext,
            runtimeReady: !!runtimeReady,
            hasRuntime: !!runtimeReady,
            activityState: nextActivity,
            busy: (
                phase === 'quick_match_matchmaking' ||
                phase === 'private_room_creating' ||
                phase === 'private_room_joining' ||
                phase === 'runtime_loading'
            ),
            awaitingInputCapture: phase === 'awaiting_input_capture',
            inMatch: phase === 'in_match',
            inPrivateRoomLobby: phase === 'private_room_lobby',
            canResume: !!nextContext.canResume,
            error: String(nextContext.error || '')
        };
    }

    GameMenuLaunchOrchestrator.create = function (ctx) {
        ctx = ctx || {};

        var phase = 'menu_idle';
        var launchContext = emptyContext();
        var runtimeReady = false;
        var activityState = 'menu';
        var stateChange = typeof ctx.onStateChange === 'function' ? ctx.onStateChange : null;

        function snapshot() {
            return createSnapshot(phase, launchContext, runtimeReady, activityState);
        }

        function emit() {
            if (stateChange) stateChange(snapshot());
        }

        function setPhase(nextPhase, contextPatch) {
            phase = String(nextPhase || 'menu_idle');
            if (contextPatch) {
                launchContext = Object.assign(cloneContext(launchContext), cloneContext(contextPatch));
            }
            emit();
        }

        function resetToIdle() {
            phase = 'menu_idle';
            launchContext = emptyContext();
            runtimeReady = false;
            activityState = 'menu';
            if (ctx.hideInputCapturePrompt) ctx.hideInputCapturePrompt();
            emit();
        }

        function setError(message, contextPatch) {
            runtimeReady = false;
            activityState = 'menu';
            launchContext = Object.assign(cloneContext(launchContext), cloneContext(contextPatch), {
                error: String(message || 'Launch failed.')
            });
            if (ctx.hideInputCapturePrompt) ctx.hideInputCapturePrompt();
            phase = 'launch_error';
            emit();
        }

        function updateContext(contextPatch) {
            launchContext = Object.assign(cloneContext(launchContext), cloneContext(contextPatch));
            emit();
        }

        function syncSessionState(detail) {
            detail = detail || {};
            runtimeReady = !!detail.runtimeReady;
            activityState = String(detail.activityState || activityState || 'menu');
            launchContext.canResume = !!detail.canResume;

            if (detail.inMatch) {
                phase = 'in_match';
                if (ctx.hideInputCapturePrompt) ctx.hideInputCapturePrompt();
                emit();
                return;
            }

            if (detail.awaitingInputCapture) {
                phase = 'awaiting_input_capture';
                if (ctx.showInputCapturePrompt) ctx.showInputCapturePrompt(launchContext);
                emit();
                return;
            }

            if (activityState === 'private_room_lobby') {
                phase = 'private_room_lobby';
                if (ctx.hideInputCapturePrompt) ctx.hideInputCapturePrompt();
                emit();
                return;
            }

            if (!runtimeReady && (phase === 'private_room_lobby' || phase === 'awaiting_input_capture' || phase === 'in_match')) {
                resetToIdle();
                return;
            }

            emit();
        }

        function sessionApi() {
            return runtime.GameSession || null;
        }

        function prepareLaunch(contextPatch) {
            launchContext = Object.assign(emptyContext(), cloneContext(contextPatch));
            runtimeReady = false;
            activityState = 'menu';
            if (ctx.prepareLaunch) ctx.prepareLaunch(launchContext);
        }

        function updateContextFromMode(mode, extra) {
            var patch = extra || {};
            if (mode && typeof mode === 'object') {
                if (mode.id) patch.modeId = mode.id;
                if (mode.roomId) patch.roomId = mode.roomId;
                if (mode.gameMode) patch.gameMode = mode.gameMode;
            }
            launchContext = Object.assign(cloneContext(launchContext), cloneContext(patch));
        }

        function enterGameplay(triggerEvent) {
            var session = sessionApi();
            if (!session || !session.enterGameplay) {
                setPhase('awaiting_input_capture', { canResume: true });
                if (ctx.showInputCapturePrompt) ctx.showInputCapturePrompt(launchContext);
                return Promise.resolve(false);
            }
            return Promise.resolve(session.enterGameplay(triggerEvent, launchContext))
                .then(function (result) {
                    result = result || {};
                    launchContext.canResume = true;
                    if (result.entered) {
                        phase = 'in_match';
                        if (ctx.hideInputCapturePrompt) ctx.hideInputCapturePrompt();
                    } else {
                        phase = 'awaiting_input_capture';
                        if (ctx.showInputCapturePrompt) ctx.showInputCapturePrompt(launchContext);
                    }
                    emit();
                    return !!result.entered;
                })
                .catch(function (err) {
                    setError((err && err.message) ? err.message : 'Could not enter gameplay.');
                    return false;
                });
        }

        function launchRuntime(modeId, launchOptions, contextPatch, triggerEvent) {
            if (!ctx.launchMode) {
                setError('Gameplay launcher unavailable.');
                return Promise.resolve(false);
            }
            prepareLaunch(Object.assign({}, contextPatch, { modeId: modeId }));
            setPhase('runtime_loading');
            return Promise.resolve(ctx.launchMode(modeId, launchOptions || {}))
                .then(function (result) {
                    if (!result || !result.ok) {
                        setError((result && result.error) ? result.error : 'Mode launch failed.');
                        return false;
                    }
                    runtimeReady = true;
                    updateContextFromMode(result.mode || null, contextPatch);
                    if (launchContext.roomPhase === 'lobby') {
                        phase = 'private_room_lobby';
                        if (ctx.hideInputCapturePrompt) ctx.hideInputCapturePrompt();
                        emit();
                        return true;
                    }
                    return enterGameplay(triggerEvent);
                })
                .catch(function (err) {
                    setError((err && err.message) ? err.message : 'Mode launch failed.');
                    return false;
                });
        }

        function startQuickMatch(gameMode, triggerEvent) {
            var resolvedGameMode = normalizeGameMode(gameMode);
            if (!ctx.requestMatchmaking) {
                setError('Matchmaking unavailable.');
                return Promise.resolve(false);
            }
            launchContext = Object.assign(emptyContext(), cloneContext({
                launchKind: 'public_match',
                requiresNetwork: true,
                gameMode: resolvedGameMode
            }));
            runtimeReady = false;
            activityState = 'menu';
            if (ctx.hideInputCapturePrompt) ctx.hideInputCapturePrompt();
            setPhase('quick_match_matchmaking');
            return Promise.resolve(ctx.requestMatchmaking('quick', { gameMode: resolvedGameMode }))
                .then(function (payload) {
                    if (!payload || !payload.roomId) {
                        setError('Room request failed.');
                        return false;
                    }
                    return launchRuntime(payload.modeId || 'cloud_multiplayer', {
                        roomId: payload.roomId,
                        gameMode: normalizeGameMode(payload.gameMode || resolvedGameMode)
                    }, {
                        launchKind: 'public_match',
                        requiresNetwork: true,
                        roomId: payload.roomId,
                        roomCode: payload.roomCode || '',
                        roomPhase: payload.roomPhase || '',
                        gameMode: normalizeGameMode(payload.gameMode || resolvedGameMode)
                    }, triggerEvent);
                })
                .catch(function (err) {
                    setError((err && err.message) ? err.message : 'Room request failed.');
                    return false;
                });
        }

        function createPrivateRoom(triggerEvent) {
            if (!ctx.createPrivateRoom) {
                setError('Private room creation unavailable.');
                return Promise.resolve(false);
            }
            launchContext = Object.assign(emptyContext(), cloneContext({
                launchKind: 'private_room',
                requiresNetwork: true
            }));
            runtimeReady = false;
            activityState = 'menu';
            if (ctx.hideInputCapturePrompt) ctx.hideInputCapturePrompt();
            setPhase('private_room_creating');
            return Promise.resolve(ctx.createPrivateRoom())
                .then(function (result) {
                    var room = result && result.state ? result.state.room : null;
                    if (!room || !room.roomId) {
                        setError('Private room response missing room state.');
                        return false;
                    }
                    return launchRuntime('single_cloudflare', {
                        roomId: room.roomId,
                        gameMode: room.roomMode || 'ffa'
                    }, {
                        launchKind: 'private_room',
                        requiresNetwork: true,
                        roomId: room.roomId,
                        roomCode: room.roomCode || '',
                        roomPhase: room.roomPhase || '',
                        gameMode: room.roomMode || 'ffa'
                    }, triggerEvent);
                })
                .catch(function (err) {
                    setError((err && err.message) ? err.message : 'Private room creation failed.');
                    return false;
                });
        }

        function joinPrivateRoom(roomCode, triggerEvent) {
            if (!ctx.joinPrivateRoom) {
                setError('Private room join unavailable.');
                return Promise.resolve(false);
            }
            launchContext = Object.assign(emptyContext(), cloneContext({
                launchKind: 'private_room',
                requiresNetwork: true,
                roomCode: String(roomCode || '')
            }));
            runtimeReady = false;
            activityState = 'menu';
            if (ctx.hideInputCapturePrompt) ctx.hideInputCapturePrompt();
            setPhase('private_room_joining');
            return Promise.resolve(ctx.joinPrivateRoom(roomCode))
                .then(function (result) {
                    var room = result && result.state ? result.state.room : null;
                    if (!room || !room.roomId) {
                        setError('Private room response missing room state.');
                        return false;
                    }
                    return launchRuntime('single_cloudflare', {
                        roomId: room.roomId,
                        gameMode: room.roomMode || 'ffa'
                    }, {
                        launchKind: 'private_room',
                        requiresNetwork: true,
                        roomId: room.roomId,
                        roomCode: room.roomCode || '',
                        roomPhase: room.roomPhase || '',
                        gameMode: room.roomMode || 'ffa'
                    }, triggerEvent);
                })
                .catch(function (err) {
                    setError((err && err.message) ? err.message : 'Private room join failed.');
                    return false;
                });
        }

        function startDirectMode(modeId, triggerEvent) {
            var id = String(modeId || '');
            var launchKind = id === 'single_cloudflare' ? 'private_room' : 'dev_room';
            return launchRuntime(id, {}, {
                launchKind: launchKind,
                requiresNetwork: true
            }, triggerEvent);
        }

        function onPrivateRoomStateChanged(nextState, meta) {
            var room = nextState && nextState.room ? nextState.room : null;
            if (!room) return;
            var previousRoom = meta && meta.previousState ? meta.previousState.room : null;
            updateContext({
                roomId: room.roomId || launchContext.roomId,
                roomCode: room.roomCode || launchContext.roomCode,
                roomPhase: room.roomPhase || launchContext.roomPhase,
                gameMode: room.roomMode || launchContext.gameMode,
                requiresNetwork: true,
                launchKind: launchContext.launchKind || 'private_room'
            });
            if (phase === 'private_room_lobby' && previousRoom && String(previousRoom.roomPhase || '') === 'lobby' && String(room.roomPhase || '') !== 'lobby') {
                if (ctx.showInputCapturePrompt) ctx.showInputCapturePrompt(launchContext);
                phase = 'awaiting_input_capture';
                emit();
            }
        }

        function dispatch(action) {
            action = action || {};
            var type = String(action.type || '').toUpperCase();
            if (!type) return Promise.resolve(false);

            if (type === 'ENTER_MATCH' || type === 'RESUME_MATCH') {
                return enterGameplay(action.event);
            }
            if (type === 'RETURN_TO_MENU') {
                var session = sessionApi();
                if (session && session.returnToMenu) session.returnToMenu();
                return Promise.resolve(true);
            }
            if (type === 'LAUNCH_FAILED') {
                setError(action.error || 'Launch failed.');
                return Promise.resolve(false);
            }
            if (type === 'PRIVATE_ROOM_STATE_CHANGED') {
                onPrivateRoomStateChanged(action.state, action.meta);
                return Promise.resolve(true);
            }

            if (phase !== 'menu_idle' && phase !== 'launch_error' && phase !== 'private_room_lobby' && phase !== 'awaiting_input_capture' && phase !== 'in_match') {
                return Promise.resolve(false);
            }

            if (type === 'START_QUICK_MATCH') {
                return startQuickMatch(action.gameMode || 'ffa', action.event);
            }
            if (type === 'CREATE_PRIVATE_ROOM') {
                return createPrivateRoom(action.event);
            }
            if (type === 'JOIN_PRIVATE_ROOM') {
                return joinPrivateRoom(action.roomCode || '', action.event);
            }
            if (type === 'START_DIRECT_MODE') {
                return startDirectMode(action.modeId || '', action.event);
            }
            if (type === 'START_PRIVATE_ROOM_MATCH') {
                return enterGameplay(action.event);
            }
            return Promise.resolve(false);
        }

        emit();

        return {
            dispatch: dispatch,
            getState: snapshot,
            syncSessionState: syncSessionState
        };
    };

    runtime.GameMenuLaunchOrchestrator = GameMenuLaunchOrchestrator;
})();
