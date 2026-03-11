(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function createStatusMarkup(snapshot) {
        var state = snapshot || {};
        return '' +
            '<div class="demonic-runtime-stage">' +
                '<div class="demonic-runtime-stage-head">' +
                    '<span>DEMONIC MATCH RUNTIME</span>' +
                    '<strong>' + String(state.phase || 'boot') + '</strong>' +
                '</div>' +
                '<pre>' +
                    'mode      :: ' + String(state.modeId || '') + '\n' +
                    'ruleset   :: ' + String(state.gameMode || '') + '\n' +
                    'room      :: ' + String(state.roomId || 'local') + '\n' +
                    'ticks     :: ' + String(state.tickCount || 0) + '\n' +
                    'elapsed   :: ' + String(Number(state.elapsedMs || 0).toFixed(0)) + 'ms\n' +
                    'status    :: ' + String(state.statusText || 'initializing') +
                '</pre>' +
            '</div>';
    }

    function create(options) {
        options = options || {};

        var bootstrap = demonicRuntime.GameBootstrap || null;
        var host = bootstrap && bootstrap.showRuntimeHost ? bootstrap.showRuntimeHost() : null;
        var frameHandle = 0;
        var running = false;
        var startedAt = 0;
        var lastFrameAt = 0;
        var tickCount = 0;
        var mode = options.mode || null;
        var context = options.context || {};
        var snapshot = {
            phase: 'booting',
            modeId: String(mode && mode.id || ''),
            gameMode: String(context && context.gameMode || ''),
            roomId: String(context && context.roomId || ''),
            tickCount: 0,
            elapsedMs: 0,
            statusText: 'bootstrapping coordinator'
        };

        function render() {
            if (!host) return;
            host.innerHTML = createStatusMarkup(snapshot);
        }

        function stopLoop() {
            if (!frameHandle) return;
            cancelAnimationFrame(frameHandle);
            frameHandle = 0;
        }

        function step(stamp) {
            if (!running) return;
            if (!startedAt) startedAt = stamp;
            if (!lastFrameAt) lastFrameAt = stamp;

            tickCount += 1;
            snapshot.phase = 'running';
            snapshot.tickCount = tickCount;
            snapshot.elapsedMs = stamp - startedAt;
            snapshot.statusText = tickCount < 3
                ? 'warming runtime lane'
                : 'runtime skeleton active';

            lastFrameAt = stamp;
            render();
            frameHandle = requestAnimationFrame(step);
        }

        function start() {
            running = true;
            startedAt = 0;
            lastFrameAt = 0;
            tickCount = 0;
            snapshot.phase = 'starting';
            snapshot.tickCount = 0;
            snapshot.elapsedMs = 0;
            snapshot.statusText = 'launch accepted';
            render();
            frameHandle = requestAnimationFrame(step);
            return getSnapshot();
        }

        function stop() {
            running = false;
            stopLoop();
            snapshot.phase = 'stopped';
            snapshot.statusText = 'runtime halted';
            render();
            if (bootstrap && bootstrap.hideRuntimeHost) bootstrap.hideRuntimeHost();
            if (bootstrap && bootstrap.clearRuntimeHost) bootstrap.clearRuntimeHost();
            return getSnapshot();
        }

        function getSnapshot() {
            return {
                phase: String(snapshot.phase || ''),
                modeId: String(snapshot.modeId || ''),
                gameMode: String(snapshot.gameMode || ''),
                roomId: String(snapshot.roomId || ''),
                tickCount: Number(snapshot.tickCount || 0),
                elapsedMs: Number(snapshot.elapsedMs || 0),
                statusText: String(snapshot.statusText || '')
            };
        }

        render();

        return {
            start: start,
            stop: stop,
            getSnapshot: getSnapshot
        };
    }

    demonicRuntime.GameMatchRuntime = {
        create: create
    };
})();
