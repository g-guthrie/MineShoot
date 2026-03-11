(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var STORAGE_KEY = 'demonic_display_fps_cap';
    var FPS_OPTIONS = [30, 60, 120, 144, 240, 0];
    var targetFps = 60;

    function storage() {
        try {
            return window.localStorage || null;
        } catch (err) {
            return null;
        }
    }

    function normalizeFps(value) {
        if (value === null || value === undefined || String(value).trim() === '') return 60;
        var numeric = Math.max(0, Math.floor(Number(value || 0)));
        return FPS_OPTIONS.indexOf(numeric) >= 0 ? numeric : 60;
    }

    function load() {
        var store = storage();
        if (!store) return targetFps;
        var raw = store.getItem(STORAGE_KEY);
        targetFps = normalizeFps(raw);
        return targetFps;
    }

    function persist() {
        var store = storage();
        if (!store) return targetFps;
        store.setItem(STORAGE_KEY, String(targetFps));
        return targetFps;
    }

    load();

    demonicRuntime.DisplaySettings = {
        getFpsOptions: function () {
            return FPS_OPTIONS.slice();
        },
        getTargetFps: function () {
            return targetFps;
        },
        setTargetFps: function (value) {
            targetFps = normalizeFps(value);
            persist();
            return targetFps;
        },
        fpsLabel: function (value) {
            var fps = normalizeFps(value);
            return fps > 0 ? (String(fps) + ' FPS') : 'UNLIMITED';
        }
    };
})();
