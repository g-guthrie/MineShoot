(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function normalizeSectorIndex(idx, segCount) {
        return ((idx % segCount) + segCount) % segCount;
    }

    function quadrantIndexFromAngle(angle) {
        if (angle >= 0) {
            return angle < (Math.PI * 0.5) ? 0 : 1;
        }
        return angle >= (-Math.PI * 0.5) ? 3 : 2;
    }

    function create(options) {
        options = options || {};
        var tuning = {
            segments: 8,
            radarRange: 35,
            coreRange: 10
        };

        function playerSnapshot() {
            return options.getPlayerSnapshot ? options.getPlayerSnapshot() : {};
        }

        function worldSnapshot() {
            return options.getWorldSnapshot ? options.getWorldSnapshot() : {};
        }

        function buildThreatPoints() {
            var world = worldSnapshot();
            return Array.isArray(world.threatPoints) ? world.threatPoints.slice() : [];
        }

        return {
            update: function (_dt) {},
            getSnapshot: function () {
                var player = playerSnapshot();
                var threats = buildThreatPoints();
                var segments = new Array(tuning.segments);
                for (var i = 0; i < tuning.segments; i++) segments[i] = 0;
                var coreIntensity = 0;
                var beacons = [];
                var sectorStep = (Math.PI * 2) / tuning.segments;
                var offRadarQuadrants = [
                    { angleRad: Math.PI * 0.25, count: 0 },
                    { angleRad: Math.PI * 0.75, count: 0 },
                    { angleRad: -Math.PI * 0.75, count: 0 },
                    { angleRad: -Math.PI * 0.25, count: 0 }
                ];
                var forwardX = -Math.sin(Number(player.yaw || 0));
                var forwardZ = -Math.cos(Number(player.yaw || 0));
                var rightX = Math.cos(Number(player.yaw || 0));
                var rightZ = -Math.sin(Number(player.yaw || 0));

                for (var n = 0; n < threats.length; n++) {
                    var p = threats[n];
                    var dx = Number(p.x || 0) - Number(player.x || 0);
                    var dz = Number(p.z || 0) - Number(player.z || 0);
                    var dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist <= 0.001) continue;
                    var nx = dx / dist;
                    var nz = dz / dist;
                    var frontDot = nx * forwardX + nz * forwardZ;
                    var rightDot = nx * rightX + nz * rightZ;
                    var angle = Math.atan2(rightDot, frontDot);
                    var sector = normalizeSectorIndex(Math.round(angle / sectorStep), tuning.segments);
                    var nearIntensity = Math.max(0, 1 - (dist / tuning.radarRange));
                    segments[sector] = Math.max(segments[sector], nearIntensity);
                    if (dist <= tuning.coreRange) {
                        coreIntensity = Math.max(coreIntensity, Math.max(0, 1 - (dist / tuning.coreRange)));
                    }
                    if (dist > tuning.radarRange) {
                        offRadarQuadrants[quadrantIndexFromAngle(angle)].count += 1;
                    }
                }

                for (var q = 0; q < offRadarQuadrants.length; q++) {
                    var candidate = offRadarQuadrants[q];
                    if (candidate.count <= 0) continue;
                    beacons.push({
                        angleRad: candidate.angleRad,
                        intensity: Math.max(0.35, Math.min(1, 0.28 + candidate.count * 0.18)),
                        count: candidate.count
                    });
                }

                return {
                    segments: segments,
                    coreIntensity: coreIntensity,
                    beacons: beacons
                };
            }
        };
    }

    demonicRuntime.GameAwarenessRuntime = {
        create: create
    };
})();
