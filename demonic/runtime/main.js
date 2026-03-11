(function () {
    'use strict';

    var sharedRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function runtimeProfile() {
        return sharedRuntime.GameRuntimeProfile || null;
    }

    function modeUi() {
        return sharedRuntime.GameRuntimeModeUi || null;
    }

    function cloneMode(mode) {
        if (!mode) return null;
        return {
            id: String(mode.id || ''),
            label: String(mode.label || ''),
            backendLabel: String(mode.backendLabel || ''),
            authorityMode: String(mode.authorityMode || ''),
            roomId: String(mode.roomId || ''),
            gameMode: String(mode.gameMode || '')
        };
    }

    function resolveMode(modeId, options) {
        var runtime = runtimeProfile();
        var selectedMode = runtime && runtime.selectMode
            ? runtime.selectMode(modeId)
            : (runtime && runtime.getMode ? runtime.getMode(modeId) : null);

        if (!selectedMode) return null;
        if (options && options.roomId) selectedMode.roomId = String(options.roomId);
        if (options && options.gameMode) selectedMode.gameMode = String(options.gameMode);
        return selectedMode;
    }

    function startupNoticeForMode(mode) {
        var ui = modeUi();
        return ui && ui.startupNoticeForMode ? ui.startupNoticeForMode(mode) : '';
    }

    function currentRuntimeStateApi() {
        return demonicRuntime.GameRuntimeState || null;
    }

    function currentMatchRuntimeApi() {
        return demonicRuntime.GameMatchRuntime || null;
    }

    demonicRuntime.GameMain = {
        launchModeById: function (modeId, options) {
            var launchOptions = options || {};
            var mode = resolveMode(modeId, launchOptions);
            if (!mode) return Promise.resolve({ ok: false, error: 'Unknown runtime mode.' });

            var session = demonicRuntime.GameSession || null;
            var context = {
                modeId: mode.id,
                roomId: String(mode.roomId || ''),
                gameMode: String(mode.gameMode || ''),
                notice: String(launchOptions.notice || startupNoticeForMode(mode) || '')
            };

            if (session && session.prepareLaunch) session.prepareLaunch(context);
            if (!session || !session.enterGameplay) {
                return Promise.resolve({ ok: false, error: 'Demonic session unavailable.' });
            }

            var runtimeState = currentRuntimeStateApi();
            var previousRuntime = runtimeState && runtimeState.getCurrentRuntime ? runtimeState.getCurrentRuntime() : null;
            if (previousRuntime && previousRuntime.stop) previousRuntime.stop();

            var matchRuntimeApi = currentMatchRuntimeApi();
            if (!matchRuntimeApi || !matchRuntimeApi.create) {
                return Promise.resolve({ ok: false, error: 'Demonic match runtime unavailable.' });
            }

            var runtimeInstance = matchRuntimeApi.create({
                mode: cloneMode(mode),
                context: context
            });
            var runtimeSnapshot = runtimeInstance && runtimeInstance.start ? runtimeInstance.start() : null;
            if (runtimeState && runtimeState.setCurrentRuntime) {
                runtimeState.setCurrentRuntime(runtimeInstance || null);
            }

            return session.enterGameplay(null, cloneMode(mode), context, runtimeSnapshot)
                .then(function (result) {
                    if (!result || result.ok === false) {
                        return { ok: false, error: (result && result.error) ? result.error : 'Demonic launch failed.' };
                    }
                    if (session && session.syncRuntimeSnapshot && runtimeInstance && runtimeInstance.getSnapshot) {
                        session.syncRuntimeSnapshot(runtimeInstance.getSnapshot());
                    }
                    return {
                        ok: true,
                        mode: cloneMode(mode),
                        session: session && session.getState ? session.getState() : (result.snapshot || null)
                    };
                });
        },
        getActivityState: function () {
            var session = demonicRuntime.GameSession || null;
            var state = session && session.getState ? session.getState() : null;
            return state && state.phase === 'in_match' ? 'in_match' : 'menu';
        },
        returnToMenu: function () {
            var runtimeState = currentRuntimeStateApi();
            var runtimeInstance = runtimeState && runtimeState.getCurrentRuntime ? runtimeState.getCurrentRuntime() : null;
            if (runtimeInstance && runtimeInstance.stop) runtimeInstance.stop();
            if (runtimeState && runtimeState.clearCurrentRuntime) runtimeState.clearCurrentRuntime();

            var session = demonicRuntime.GameSession || null;
            return session && session.returnToMenu ? session.returnToMenu() : null;
        }
    };
})();
