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
            if (selectedMode.authorityMode !== 'networked') {
                return { ok: false, error: 'Only server-authoritative runtime modes are supported.' };
            }

            if (options.roomId) selectedMode.roomId = String(options.roomId);
            if (options.gameMode) selectedMode.gameMode = String(options.gameMode);

            activeRuntimeMode = selectedMode;

            if (authApi && authApi.setAuthVisible) {
                authApi.setAuthVisible(false);
            }
            if (opts.setRoomId) {
                opts.setRoomId(selectedMode.roomId || 'global');
            }

            var runtimeModeUi = opts.getRuntimeModeUi ? opts.getRuntimeModeUi() : null;
            startupDebugNotice = options.notice || (runtimeModeUi && runtimeModeUi.startupNoticeForMode
                ? runtimeModeUi.startupNoticeForMode(selectedMode)
                : '');

            return Promise.resolve()
                .then(function () {
                    return opts.startRuntime ? opts.startRuntime({
                        activeRuntimeMode: activeRuntimeMode,
                        startupDebugNotice: startupDebugNotice
                    }) : null;
                })
                .then(function () {
                    return {
                        ok: true,
                        mode: selectedMode
                    };
                })
                .catch(function (err) {
                    var msg = (err && err.message) ? err.message : String(err || 'Unknown startup error');
                    if (opts.onLaunchError) {
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
