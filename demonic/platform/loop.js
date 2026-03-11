(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create(options) {
        options = options || {};

        var onFrame = typeof options.onFrame === 'function' ? options.onFrame : function () {};
        var running = false;
        var frameHandle = 0;
        var lastStamp = 0;

        function tick(stamp) {
            if (!running) return;
            if (!lastStamp) lastStamp = stamp;
            var dt = Math.min(0.05, Math.max(0, (stamp - lastStamp) / 1000));
            lastStamp = stamp;
            onFrame(dt, stamp);
            frameHandle = requestAnimationFrame(tick);
        }

        return {
            start: function () {
                if (running) return;
                running = true;
                lastStamp = 0;
                frameHandle = requestAnimationFrame(tick);
            },
            stop: function () {
                running = false;
                if (frameHandle) cancelAnimationFrame(frameHandle);
                frameHandle = 0;
            },
            isRunning: function () {
                return running;
            }
        };
    }

    demonicRuntime.GameLoop = {
        create: create
    };
})();
