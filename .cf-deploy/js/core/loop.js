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

    globalThis.__MAYHEM_RUNTIME.GameLoop = GameLoop;
})();
