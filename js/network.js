/**
 * network.js - Backward-compatible GameNet entrypoint.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNet
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var runtimeFactory = runtime.GameNetRuntime;
    if (!runtimeFactory || !runtimeFactory.create) {
        throw new Error('GameNetRuntime is required before GameNet initialization.');
    }

    runtime.GameNet = runtimeFactory.create();
})();
