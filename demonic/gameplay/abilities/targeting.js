(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function create(options) {
        options = options || {};

        function playerSnapshot() {
            return options.getPlayerSnapshot ? options.getPlayerSnapshot() : {};
        }

        function cameraSnapshot() {
            return options.getCameraSnapshot ? options.getCameraSnapshot() : {};
        }

        return {
            buildAimPoint: function (range) {
                var player = playerSnapshot();
                var camera = cameraSnapshot();
                var yaw = Number(player.yaw || 0);
                var pitch = Number(player.pitch || 0);
                var cosPitch = Math.cos(pitch);
                var forwardX = -Math.sin(yaw) * cosPitch;
                var forwardY = Math.sin(pitch);
                var forwardZ = -Math.cos(yaw) * cosPitch;
                var distance = Math.max(1, Number(range || 24));
                return {
                    x: Number(player.x || 0) + (forwardX * distance),
                    y: Number(player.y || 0) + (forwardY * distance) + (camera.scopeBlend > 0.5 ? 0.02 : 0),
                    z: Number(player.z || 0) + (forwardZ * distance)
                };
            }
        };
    }

    demonicRuntime.GameAbilityTargeting = {
        create: create
    };
})();
