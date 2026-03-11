(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create(context) {
        var state = {
            modeId: String(context && context.mode && context.mode.id || ''),
            roomId: String(context && context.context && context.context.roomId || ''),
            worldSeed: 'demonic-seed-a',
            groundHeight: 0,
            bounds: {
                min: 0,
                max: 100,
                centerX: 50,
                centerZ: 50
            }
        };

        return {
            update: function (_dt) {},
            getSnapshot: function () {
                return {
                    modeId: String(state.modeId || ''),
                    roomId: String(state.roomId || ''),
                    worldSeed: String(state.worldSeed || ''),
                    groundHeight: Number(state.groundHeight || 0),
                    bounds: {
                        min: Number(state.bounds.min || 0),
                        max: Number(state.bounds.max || 0),
                        centerX: Number(state.bounds.centerX || 0),
                        centerZ: Number(state.bounds.centerZ || 0)
                    }
                };
            }
        };
    }

    demonicRuntime.GameWorldRuntime = {
        create: create
    };
})();
