/**
 * main.js - Legacy compatibility facade for GameMain.
 * The shipped gameplay bundle now registers GameMain from the app-owned runtime stack.
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    if (runtime.GameMain && runtime.GameMain.launchModeById && runtime.GameMain.getActivityState) {
        return;
    }

    var coordinatorInstance = null;

    function ensureCoordinatorMain() {
        if (runtime.GameMain && runtime.GameMain !== facade &&
            runtime.GameMain.launchModeById && runtime.GameMain.getActivityState) {
            return runtime.GameMain;
        }
        if (coordinatorInstance) return coordinatorInstance;
        var coordinatorFactory = runtime.GameRuntimeCoordinator || null;
        if (!coordinatorFactory || !coordinatorFactory.create) {
            return null;
        }
        coordinatorInstance = coordinatorFactory.create();
        return coordinatorInstance;
    }

    var facade = {
        launchModeById: function (modeId, options) {
            var main = ensureCoordinatorMain();
            if (!main || !main.launchModeById) {
                return Promise.resolve({ ok: false, error: 'GameRuntimeCoordinator is unavailable.' });
            }
            return main.launchModeById(modeId, options || {});
        },
        getActivityState: function () {
            var main = ensureCoordinatorMain();
            if (!main || !main.getActivityState) return 'menu';
            return main.getActivityState();
        }
    };

    runtime.GameMain = facade;
})();
