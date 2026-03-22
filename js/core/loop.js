/**
 * loop.js - Frame loop helpers.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLoop
 */
(function () {
    'use strict';

    var GameLoop = {};

    GameLoop.requestFrame = function (cb) {
        return requestAnimationFrame(cb);
    };

    GameLoop.cancelFrame = function (handle) {
        if (!handle) return;
        cancelAnimationFrame(handle);
    };

    globalThis.__MAYHEM_RUNTIME.GameLoop = GameLoop;
})();
