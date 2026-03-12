(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function numeric(value, fallback) {
        var out = Number(value);
        return Number.isFinite(out) ? out : fallback;
    }

    function create(options) {
        options = options || {};
        var playerRadius = Math.max(0, numeric(options.playerRadius, 0.35));
        var playerHeight = Math.max(playerRadius, numeric(options.playerHeight, 1.7));
        var epsilon = Math.max(0.000001, numeric(options.epsilon, 0.001));

        function boundsApi() {
            return options.getBoundsApi ? options.getBoundsApi() : null;
        }

        function groundHeightAt(_x, _z) {
            return numeric(options.getGroundHeightAt ? options.getGroundHeightAt(_x, _z) : 0, 0);
        }

        return {
            getGroundHeightAt: groundHeightAt,
            clampHorizontalPosition: function (x, z) {
                var bounds = boundsApi();
                if (!bounds || !bounds.clampXZ) return { x: numeric(x, 0), z: numeric(z, 0) };
                return bounds.clampXZ(x, z, playerRadius);
            },
            isBlockedAt: function (_x, _z, _feetY) {
                return false;
            },
            findLandingSurfaceY: function (x, z, _currentFeetY, _nextFeetY) {
                return groundHeightAt(x, z);
            },
            findCeilingY: function (_x, _z, _currentHeadY, _nextHeadY) {
                return null;
            },
            getPlayerRadius: function () {
                return playerRadius;
            },
            getPlayerHeight: function () {
                return playerHeight;
            },
            getEpsilon: function () {
                return epsilon;
            }
        };
    }

    demonicRuntime.GameWorldCollision = {
        create: create
    };
})();
