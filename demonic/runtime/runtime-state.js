(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var currentRuntime = null;

    demonicRuntime.GameRuntimeState = {
        setCurrentRuntime: function (runtimeInstance) {
            currentRuntime = runtimeInstance || null;
        },
        clearCurrentRuntime: function () {
            currentRuntime = null;
        },
        getCurrentRuntime: function () {
            return currentRuntime;
        }
    };
})();
