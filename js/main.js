/**
 * main.js - Backward-compatible GameMain entrypoint.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameMain
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var runtimeFactory = runtime.GameRuntimeCoordinator;
    if (!runtimeFactory || !runtimeFactory.create) {
        throw new Error('GameRuntimeCoordinator is required before GameMain initialization.');
    }

    runtime.GameMain = runtimeFactory.create();
})();
