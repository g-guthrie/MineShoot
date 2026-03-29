/**
 * runtime-shell.js - App-owned runtime launch and activity shell.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeShell
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameRuntimeShell = {};

    GameRuntimeShell.create = function (opts) {
        opts = opts || {};

        var activeRuntimeMode = null;
        var startupDebugNotice = '';

        function netApi() {
            return opts.getNetApi ? opts.getNetApi() : (runtime.GameNet || null);
        }

        function launchModeById(modeId, options) {
            options = options || {};
            var runtimeProfile = opts.getRuntimeProfile ? opts.getRuntimeProfile() : null;
            var authApi = opts.getAuthApi ? opts.getAuthApi() : null;
            var selectedMode = runtimeProfile && runtimeProfile.selectMode
                ? runtimeProfile.selectMode(modeId)
                : (runtimeProfile && runtimeProfile.getMode ? runtimeProfile.getMode(modeId) : null);
            if (!selectedMode) {
                return { ok: false, error: 'Unknown runtime mode.' };
            }

            if (options.roomId) selectedMode.roomId = String(options.roomId);
            if (options.gameMode) selectedMode.gameMode = String(options.gameMode);

            activeRuntimeMode = selectedMode;
            var requiresNetwork = selectedMode.authorityMode === 'networked';

            if (requiresNetwork && authApi && authApi.setAuthVisible) {
                authApi.setAuthVisible(false);
            }
            if (requiresNetwork && opts.setRoomId) {
                opts.setRoomId(selectedMode.roomId || 'global');
            }

            var runtimeModeUi = opts.getRuntimeModeUi ? opts.getRuntimeModeUi() : null;
            startupDebugNotice = options.notice || (runtimeModeUi && runtimeModeUi.startupNoticeForMode
                ? runtimeModeUi.startupNoticeForMode(selectedMode)
                : '');
            var joinPromise = null;
            if (requiresNetwork) {
                var currentNetApi = netApi();
                if (!currentNetApi || !currentNetApi.beginJoinAttempt) {
                    activeRuntimeMode = null;
                    startupDebugNotice = '';
                    return { ok: false, error: 'Network room join unavailable.' };
                }
                var e2eJoinTimeoutMs = globalThis.__MAYHEM_E2E && globalThis.__MAYHEM_E2E.active ? 15000 : 5000;
                joinPromise = currentNetApi.beginJoinAttempt({
                    expectedRoomId: selectedMode.roomId || 'global',
                    timeoutMs: e2eJoinTimeoutMs
                });
            }

            return Promise.resolve()
                .then(function () {
                    return opts.startRuntime ? opts.startRuntime({
                        activeRuntimeMode: activeRuntimeMode,
                        startupDebugNotice: startupDebugNotice
                    }) : null;
                })
                .then(function () {
                    return joinPromise || null;
                })
                .then(function () {
                    return {
                        ok: true,
                        mode: selectedMode
                    };
                })
                .catch(function (err) {
                    var msg = (err && err.message) ? err.message : String(err || 'Unknown startup error');
                    if (requiresNetwork) {
                        var failedNetApi = netApi();
                        if (failedNetApi && failedNetApi.resetJoinAttempt) {
                            failedNetApi.resetJoinAttempt();
                        }
                        if (failedNetApi && failedNetApi.shutdown) {
                            failedNetApi.shutdown();
                        }
                        if (opts.onNetworkLaunchFailure) {
                            opts.onNetworkLaunchFailure(msg, err);
                        } else if (opts.onLaunchError) {
                            opts.onLaunchError(msg, err);
                        }
                    } else if (opts.onLaunchError) {
                        opts.onLaunchError(msg, err);
                    }
                    activeRuntimeMode = null;
                    startupDebugNotice = '';
                    if (runtimeProfile && runtimeProfile.clearSelectedMode) {
                        runtimeProfile.clearSelectedMode();
                    }
                    return { ok: false, error: msg };
                });
        }

        function getActivityState() {
            if (!activeRuntimeMode || !(opts.isRuntimeReady && opts.isRuntimeReady())) return 'menu';
            var matchContext = opts.readMatchContext ? opts.readMatchContext() : null;
            if (matchContext && String(matchContext.privateRoomPhase || '') === 'lobby') {
                return 'private_room_lobby';
            }
            return 'in_match';
        }

        return {
            launchModeById: launchModeById,
            getActivityState: getActivityState,
            getActiveRuntimeMode: function () { return activeRuntimeMode; },
            getStartupDebugNotice: function () { return startupDebugNotice; }
        };
    };

    runtime.GameRuntimeShell = GameRuntimeShell;
})();
