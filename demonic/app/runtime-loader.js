(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var GameRuntimeLoader = {};
    var gameplayPromise = null;

    GameRuntimeLoader.loadGameplayRuntime = function () {
        if (!gameplayPromise) {
            gameplayPromise = import('../runtime/modules.js')
                .then(function () {
                    return demonicRuntime.GameMain || null;
                });
        }
        return gameplayPromise;
    };

    GameRuntimeLoader.isGameplayRuntimeReady = function () {
        return !!(demonicRuntime.GameMain && demonicRuntime.GameMain.launchModeById);
    };

    demonicRuntime.GameRuntimeLoader = GameRuntimeLoader;
})();
