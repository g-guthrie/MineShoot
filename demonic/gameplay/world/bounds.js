(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function numeric(value, fallback) {
        var out = Number(value);
        return Number.isFinite(out) ? out : fallback;
    }

    function create(initialState) {
        var state = initialState || {};

        function currentBounds() {
            var bounds = state.bounds || {};
            var min = numeric(bounds.min, 0);
            var max = numeric(bounds.max, 100);
            return {
                min: min,
                max: max,
                minX: numeric(bounds.minX, min),
                maxX: numeric(bounds.maxX, max),
                minZ: numeric(bounds.minZ, min),
                maxZ: numeric(bounds.maxZ, max),
                centerX: numeric(bounds.centerX, (numeric(bounds.minX, min) + numeric(bounds.maxX, max)) * 0.5),
                centerZ: numeric(bounds.centerZ, (numeric(bounds.minZ, min) + numeric(bounds.maxZ, max)) * 0.5)
            };
        }

        return {
            getBounds: currentBounds,
            clampXZ: function (x, z, padding) {
                var bounds = currentBounds();
                var pad = Math.max(0, numeric(padding, 0));
                return {
                    x: Math.max(bounds.minX + pad, Math.min(bounds.maxX - pad, numeric(x, bounds.centerX))),
                    z: Math.max(bounds.minZ + pad, Math.min(bounds.maxZ - pad, numeric(z, bounds.centerZ)))
                };
            },
            getDefaultSpawnPoint: function () {
                var bounds = currentBounds();
                var z = Math.min(bounds.maxZ - 4, bounds.centerZ + Math.max(6, (bounds.maxZ - bounds.minZ) * 0.34));
                return {
                    x: bounds.centerX,
                    z: z
                };
            }
        };
    }

    demonicRuntime.GameWorldBounds = {
        create: create
    };
})();
