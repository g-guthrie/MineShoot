/**
 * lobby-launch-actions.js - Menu launch and room-entry action owner.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyLaunchActions
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameLobbyLaunchActions = {};

    function runtimeModeUi(ctx) {
        return ctx && typeof ctx.getRuntimeModeUi === 'function' ? (ctx.getRuntimeModeUi() || null) : null;
    }

    function lobbyUi(ctx) {
        return ctx && typeof ctx.getLobbyUi === 'function' ? (ctx.getLobbyUi() || null) : null;
    }

    function normalizeSandboxMode(mode) {
        return String(mode || '').toLowerCase() === 'lms' ? 'lms' : 'ffa';
    }

    function roomCodeFromRoomId(ctx, roomId) {
        if (ctx && typeof ctx.roomCodeFromRoomId === 'function') {
            return ctx.roomCodeFromRoomId(roomId);
        }
        return String(roomId || '').toUpperCase();
    }

    function readyStatusForMode(ctx, mode) {
        if (!mode) return 'Ready to enter match.';
        var roomId = String(mode.roomId || '').toUpperCase();
        if (mode.id === 'single_cloudflare') {
            return 'Ready to enter private room ' + roomCodeFromRoomId(ctx, mode.roomId) + '.';
        }
        return 'Ready to enter ' + String(mode.gameMode || 'ffa').toUpperCase() + ' room ' + roomId + '.';
    }

    function startupSubtitle(ctx, mode) {
        var modeUi = runtimeModeUi(ctx);
        return modeUi && modeUi.startupSubtitleForMode
            ? modeUi.startupSubtitleForMode(mode)
            : '';
    }

    GameLobbyLaunchActions.create = function (ctx) {
        ctx = ctx || {};

        var started = false;
        var startPending = false;
        var sandboxWarmPromise = null;
        var sandboxRuntimeReady = !(runtime.GameRuntimeLoader && runtime.GameRuntimeLoader.loadGameplayRuntime);
        var selectedSandboxMode = 'ffa';

        function syncLaunchStateUi() {
            var ui = lobbyUi(ctx);
            if (ui && ui.syncMenuControlState) {
                ui.syncMenuControlState();
            }
        }

        function setRoomAccessStatus(text, isErr) {
            if (typeof ctx.setRoomAccessStatus === 'function') {
                ctx.setRoomAccessStatus(text, isErr);
            }
        }

        function setPrivateRoomShare(roomId) {
            if (!ctx.roomSharePanel || !ctx.roomShareCode) return;
            if (!roomId) {
                ctx.roomSharePanel.hidden = true;
                ctx.roomShareCode.textContent = '------';
                if (ctx.roomCodeBadge && ctx.roomCodeBadgeValue) {
                    ctx.roomCodeBadge.hidden = true;
                    ctx.roomCodeBadgeValue.textContent = '------';
                }
                return;
            }
            var roomCode = roomCodeFromRoomId(ctx, roomId);
            ctx.roomShareCode.textContent = roomCode;
            ctx.roomSharePanel.hidden = false;
            if (ctx.roomCodeBadge && ctx.roomCodeBadgeValue) {
                ctx.roomCodeBadgeValue.textContent = roomCode;
                ctx.roomCodeBadge.hidden = false;
            }
        }

        function syncSandboxSelectionUi() {
            var mode = normalizeSandboxMode(selectedSandboxMode);
            if (ctx.sandboxPlayBtn) {
                ctx.sandboxPlayBtn.textContent = mode === 'lms' ? 'OFFLINE SANDBOX :: LMS' : 'OFFLINE SANDBOX :: FFA';
            }
            if (ctx.sandboxModeCycleBtn) {
                ctx.sandboxModeCycleBtn.title = mode === 'lms'
                    ? 'Sandbox selector. Current ruleset: LMS.'
                    : 'Sandbox selector. Current ruleset: FFA.';
            }
            if (ctx.sandboxFfaBtn) ctx.sandboxFfaBtn.classList.toggle('active', mode === 'ffa');
            if (ctx.sandboxLmsBtn) ctx.sandboxLmsBtn.classList.toggle('active', mode === 'lms');
        }

        function setSelectedSandboxMode(mode, silent) {
            selectedSandboxMode = normalizeSandboxMode(mode);
            syncSandboxSelectionUi();
            if (!silent) {
                setRoomAccessStatus(
                    selectedSandboxMode === 'lms' ? 'Sandbox ruleset set to LMS.' : 'Sandbox ruleset set to FFA.',
                    false
                );
            }
        }

        function warmSandboxRuntime() {
            var ui = lobbyUi(ctx);
            var loader = runtime.GameRuntimeLoader;
            if (!loader || !loader.loadGameplayRuntime) {
                sandboxRuntimeReady = true;
                if (ui && ui.syncMenuControlState) ui.syncMenuControlState();
                return Promise.resolve(null);
            }
            if (loader.isGameplayRuntimeReady && loader.isGameplayRuntimeReady()) {
                sandboxRuntimeReady = true;
                if (ui && ui.syncMenuControlState) ui.syncMenuControlState();
                return Promise.resolve(runtime.GameMain || null);
            }
            if (sandboxWarmPromise) return sandboxWarmPromise;

            sandboxRuntimeReady = false;
            if (ui && ui.syncMenuControlState) ui.syncMenuControlState();
            sandboxWarmPromise = loader.loadGameplayRuntime()
                .then(function (gameMain) {
                    sandboxRuntimeReady = !!(gameMain && gameMain.launchModeById);
                    if (ui && ui.syncMenuControlState) ui.syncMenuControlState();
                    return gameMain || null;
                })
                .catch(function (err) {
                    sandboxRuntimeReady = false;
                    if (ui && ui.syncMenuControlState) ui.syncMenuControlState();
                    throw err;
                })
                .finally(function () {
                    sandboxWarmPromise = null;
                });
            return sandboxWarmPromise;
        }

        function handleLaunchResult(result) {
            var ui = lobbyUi(ctx);
            startPending = false;
            syncLaunchStateUi();
            if (!result || !result.ok) {
                setRoomAccessStatus((result && result.error) ? result.error : 'Mode launch failed.', true);
                if (ui && ui.restoreStartUi) ui.restoreStartUi();
                return false;
            }
            started = true;
            if (ui && ui.hideStartUi) ui.hideStartUi();
            if (result.mode && result.mode.authorityMode === 'networked') {
                setRoomAccessStatus(readyStatusForMode(ctx, result.mode), false);
                if (runtime.GameSession && runtime.GameSession.showLaunchOverlay) {
                    runtime.GameSession.showLaunchOverlay('joined_ready', result.mode);
                }
            }
            if (ctx.modeSubtitle) {
                if (result.mode && result.mode.authorityMode === 'networked') {
                    ctx.modeSubtitle.textContent = readyStatusForMode(ctx, result.mode);
                } else {
                    ctx.modeSubtitle.textContent = startupSubtitle(ctx, result.mode);
                }
            }
            if (typeof ctx.setRuntimeIndicator === 'function') {
                ctx.setRuntimeIndicator(result.mode);
            }
            if (result.mode && result.mode.authorityMode !== 'networked' &&
                runtime.GameSession && runtime.GameSession.showGameplayPrompt) {
                runtime.GameSession.showGameplayPrompt();
            }
            return true;
        }

        function launchMode(modeId, launchOptions) {
            var ui = lobbyUi(ctx);
            if (started || startPending) return Promise.resolve(false);
            startPending = true;
            syncLaunchStateUi();
            var result = typeof ctx.launchModeById === 'function'
                ? ctx.launchModeById(modeId, launchOptions || {})
                : { ok: false, error: 'Launch unavailable.' };
            if (result && typeof result.then === 'function') {
                return result
                    .then(handleLaunchResult)
                    .catch(function (err) {
                        startPending = false;
                        syncLaunchStateUi();
                        setRoomAccessStatus((err && err.message) ? err.message : 'Mode launch failed.', true);
                        if (ui && ui.restoreStartUi) ui.restoreStartUi();
                        return false;
                    });
            }
            return Promise.resolve(handleLaunchResult(result));
        }

        function startAllocatedRoom(payload) {
            if (!payload || !payload.roomId) {
                setRoomAccessStatus('Room request failed.', true);
                return;
            }
            if (payload.privacy === 'private') {
                setPrivateRoomShare(payload.roomId);
                setRoomAccessStatus('Connecting to private room ' + roomCodeFromRoomId(ctx, payload.roomId) + '...', false);
            } else {
                setPrivateRoomShare('');
                setRoomAccessStatus('Connecting to ' + String((payload.gameMode || 'ffa')).toUpperCase() + ' room ' + String(payload.roomId).toUpperCase() + '...', false);
            }
            launchMode(payload.modeId || 'cloud_multiplayer', {
                roomId: payload.roomId,
                gameMode: payload.gameMode || 'ffa'
            });
        }

        function beginRoomAction(action, extra, pendingText) {
            var ui = lobbyUi(ctx);
            if ((ctx.isUiBusy && ctx.isUiBusy()) || started) return;
            if (ui && ui.setControllerBusy) ui.setControllerBusy(true, pendingText);
            Promise.resolve(ctx.requestMatchmaking ? ctx.requestMatchmaking(action, extra) : null)
                .then(function (payload) {
                    if (ui && ui.setControllerBusy) ui.setControllerBusy(false, '');
                    startAllocatedRoom(payload);
                })
                .catch(function (err) {
                    if (ui && ui.setControllerBusy) ui.setControllerBusy(false, '');
                    setRoomAccessStatus((err && err.message) ? err.message : 'Room request failed.', true);
                });
        }

        function handlePrivateRoomResult(result) {
            if (!result || !result.state || !result.state.room) {
                throw new Error('Private room response missing room state.');
            }
            var room = result.state.room;
            setPrivateRoomShare(room.roomId);
            setRoomAccessStatus('Connecting to private room ' + String(room.roomCode || '').toUpperCase() + '...', false);
            if (!started) {
                launchMode('single_cloudflare', {
                    roomId: room.roomId,
                    gameMode: room.roomMode || 'ffa'
                });
            }
        }

        function beginPrivateRoomCreate() {
            var session = ctx.getSession ? ctx.getSession() : null;
            if ((ctx.isUiBusy && ctx.isUiBusy()) || started || !session || !session.createPrivateRoom) return;
            setRoomAccessStatus('Creating room...', false);
            session.createPrivateRoom()
                .then(function (result) {
                    handlePrivateRoomResult(result);
                })
                .catch(function (err) {
                    setRoomAccessStatus((err && err.message) ? err.message : 'Private room creation failed.', true);
                });
        }

        function beginPrivateRoomJoin(roomCode) {
            var session = ctx.getSession ? ctx.getSession() : null;
            if ((ctx.isUiBusy && ctx.isUiBusy()) || started || !session || !session.joinPrivateRoom) return;
            setRoomAccessStatus('Joining private room...', false);
            session.joinPrivateRoom(roomCode)
                .then(function (result) {
                    handlePrivateRoomResult(result);
                })
                .catch(function (err) {
                    setRoomAccessStatus((err && err.message) ? err.message : 'Private room join failed.', true);
                });
        }

        function launchSandboxRuleset(gameMode, event) {
            var ui = lobbyUi(ctx);
            gameMode = normalizeSandboxMode(gameMode);
            if (started || startPending) return;
            if (!sandboxRuntimeReady) {
                setRoomAccessStatus('Preparing sandbox runtime...', false);
                warmSandboxRuntime()
                    .then(function () {
                        launchSandboxRuleset(gameMode, event);
                    })
                    .catch(function (err) {
                        setRoomAccessStatus((err && err.message) ? err.message : 'Sandbox failed to load.', true);
                    });
                return;
            }

            startPending = true;
            syncLaunchStateUi();
            var result = typeof ctx.launchModeById === 'function'
                ? ctx.launchModeById('single_full_sandbox', { gameMode: gameMode })
                : { ok: false, error: 'Launch unavailable.' };

            if (result && typeof result.then === 'function') {
                result
                    .then(function (payload) {
                        if (!handleLaunchResult(payload)) return;
                        if (runtime.GameSession && runtime.GameSession.startGameplayFromMenu) {
                            runtime.GameSession.startGameplayFromMenu(event);
                        }
                    })
                    .catch(function (err) {
                        startPending = false;
                        syncLaunchStateUi();
                        setRoomAccessStatus((err && err.message) ? err.message : 'Mode launch failed.', true);
                        if (ui && ui.restoreStartUi) ui.restoreStartUi();
                    });
                return;
            }

            if (!handleLaunchResult(result)) return;
            if (runtime.GameSession && runtime.GameSession.startGameplayFromMenu) {
                runtime.GameSession.startGameplayFromMenu(event);
            }
        }

        function launchSelectedSandbox(event) {
            launchSandboxRuleset(selectedSandboxMode, event);
        }

        function launchAssignedPrivateRoom(state) {
            if (started || !state || !state.self || !state.self.privateRoom) return;
            setRoomAccessStatus('Connecting to private room ' + roomCodeFromRoomId(ctx, state.self.privateRoom.roomId) + '...', false);
            launchMode('single_cloudflare', {
                roomId: state.self.privateRoom.roomId,
                gameMode: state.self.privateRoom.roomMode || 'ffa'
            });
        }

        return {
            isStarted: function () { return !!started; },
            isStartPending: function () { return !!startPending; },
            isSandboxRuntimeReady: function () { return !!sandboxRuntimeReady; },
            warmSandboxRuntime: warmSandboxRuntime,
            syncSandboxSelectionUi: syncSandboxSelectionUi,
            setSelectedSandboxMode: setSelectedSandboxMode,
            setPrivateRoomShare: setPrivateRoomShare,
            launchMode: launchMode,
            beginRoomAction: beginRoomAction,
            beginPrivateRoomCreate: beginPrivateRoomCreate,
            beginPrivateRoomJoin: beginPrivateRoomJoin,
            launchSandboxRuleset: launchSandboxRuleset,
            launchSelectedSandbox: launchSelectedSandbox,
            launchAssignedPrivateRoom: launchAssignedPrivateRoom
        };
    };

    runtime.GameLobbyLaunchActions = GameLobbyLaunchActions;
})();
