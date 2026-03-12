(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function wrapAngleRad(rad) {
        while (rad > Math.PI) rad -= Math.PI * 2;
        while (rad < -Math.PI) rad += Math.PI * 2;
        return rad;
    }

    function create(options) {
        options = options || {};
        var sectorTimers = new Array(12);
        for (var i = 0; i < sectorTimers.length; i++) sectorTimers[i] = 0;
        var flashLevel = 0;

        function playerSnapshot() {
            return options.getPlayerSnapshot ? options.getPlayerSnapshot() : {};
        }

        function trigger(sourcePos, damage) {
            var player = playerSnapshot();
            if (!sourcePos) {
                flashLevel = Math.max(flashLevel, 0.22 + Math.min(0.38, Number(damage || 0) / 120));
                return;
            }
            var toX = Number(sourcePos.x || 0) - Number(player.x || 0);
            var toZ = Number(sourcePos.z || 0) - Number(player.z || 0);
            var len = Math.sqrt(toX * toX + toZ * toZ);
            if (len <= 0.001) return;

            var nx = toX / len;
            var nz = toZ / len;
            var yaw = Number(player.yaw || 0);
            var forwardX = -Math.sin(yaw);
            var forwardZ = -Math.cos(yaw);
            var rightX = Math.cos(yaw);
            var rightZ = -Math.sin(yaw);
            var frontDot = nx * forwardX + nz * forwardZ;
            var rightDot = nx * rightX + nz * rightZ;
            var angle = wrapAngleRad(Math.atan2(rightDot, frontDot));
            var sector = Math.round(angle / (Math.PI / 6));
            sector = ((sector % 12) + 12) % 12;

            var duration = 1.15 + Math.min(0.65, Number(damage || 0) / 90);
            sectorTimers[sector] = Math.max(sectorTimers[sector], duration);
            sectorTimers[(sector + 1) % 12] = Math.max(sectorTimers[(sector + 1) % 12], duration * 0.62);
            sectorTimers[(sector + 11) % 12] = Math.max(sectorTimers[(sector + 11) % 12], duration * 0.62);
            flashLevel = Math.max(flashLevel, 0.28 + Math.min(0.42, Number(damage || 0) / 120));
        }

        return {
            update: function (dt) {
                for (var i = 0; i < sectorTimers.length; i++) {
                    if (sectorTimers[i] > 0) {
                        sectorTimers[i] -= dt;
                        if (sectorTimers[i] < 0) sectorTimers[i] = 0;
                    }
                }
                if (flashLevel > 0) {
                    flashLevel -= dt * 1.05;
                    if (flashLevel < 0) flashLevel = 0;
                }
            },
            trigger: trigger,
            getSnapshot: function () {
                return {
                    sectors: sectorTimers.slice(),
                    flashLevel: Number(flashLevel || 0)
                };
            }
        };
    }

    demonicRuntime.GameDamageFeedbackRuntime = {
        create: create
    };
})();
