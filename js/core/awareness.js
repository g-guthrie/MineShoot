/**
 * awareness.js - Radar/awareness system for combat proximity detection
 */
(function () {
    'use strict';

    var RT = globalThis.__MAYHEM_RUNTIME;

    var awarenessTuning = (RT.GameCombatTuning && RT.GameCombatTuning.getAwarenessTuning)
        ? RT.GameCombatTuning.getAwarenessTuning()
        : {
            segments: 8,
            radarRange: 35,
            coreRange: 10,
            beaconMinRange: 35,
            beaconMaxCount: 2
        };

    var SEGMENTS = awarenessTuning.segments;
    var RADAR_RANGE = awarenessTuning.radarRange;
    var CORE_RANGE = awarenessTuning.coreRange;

    function normalizeSectorIndex(idx, segCount) {
        return ((idx % segCount) + segCount) % segCount;
    }

    function quadrantIndexFromAngle(angle) {
        if (angle >= 0) {
            return angle < (Math.PI * 0.5) ? 0 : 1;
        }
        return angle >= (-Math.PI * 0.5) ? 3 : 2;
    }

    function collectTargets() {
        var out = [];
        var seen = {};
        var net = RT.GameNet || null;
        var netView = net && net.view ? net.view : net;
        function appendTargets(list) {
            if (!list || !list.length) return;
            for (var i = 0; i < list.length; i++) {
                var t = list[i];
                if (!t || t.alive === false || !t.worldPos) continue;
                var key = (t.targetId || '') + '|' + Number(t.worldPos.x).toFixed(2) + '|' + Number(t.worldPos.z).toFixed(2);
                if (seen[key]) continue;
                seen[key] = true;
                out.push({
                    targetId: t.targetId || '',
                    worldPos: t.worldPos.clone ? t.worldPos.clone() : t.worldPos
                });
            }
        }
        if (RT.GameEnemy && RT.GameEnemy.getLockTargets) {
            appendTargets(RT.GameEnemy.getLockTargets() || []);
        }
        if (netView && netView.getLockTargets) {
            appendTargets(netView.getLockTargets() || []);
        }
        return out;
    }

    function buildState(playerPos, playerYaw) {
        var segments = new Array(SEGMENTS);
        for (var i = 0; i < SEGMENTS; i++) segments[i] = 0;
        var coreIntensity = 0;
        var targets = collectTargets();
        var offRadarQuadrants = [
            { angleRad: Math.PI * 0.25, count: 0, minDist: Infinity },
            { angleRad: Math.PI * 0.75, count: 0, minDist: Infinity },
            { angleRad: -Math.PI * 0.75, count: 0, minDist: Infinity },
            { angleRad: -Math.PI * 0.25, count: 0, minDist: Infinity }
        ];
        var sectorStep = (Math.PI * 2) / SEGMENTS;
        var forwardX = -Math.sin(playerYaw || 0);
        var forwardZ = -Math.cos(playerYaw || 0);
        var rightX = Math.cos(playerYaw || 0);
        var rightZ = -Math.sin(playerYaw || 0);

        for (var n = 0; n < targets.length; n++) {
            var p = targets[n].worldPos;
            var dx = p.x - playerPos.x;
            var dz = p.z - playerPos.z;
            var dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= 0.001) continue;
            var nx = dx / dist;
            var nz = dz / dist;
            var frontDot = nx * forwardX + nz * forwardZ;
            var rightDot = nx * rightX + nz * rightZ;
            var angle = Math.atan2(rightDot, frontDot);
            var sector = normalizeSectorIndex(Math.round(angle / sectorStep), SEGMENTS);
            var nearIntensity = Math.max(0, 1 - (dist / RADAR_RANGE));
            segments[sector] = Math.max(segments[sector], nearIntensity);
            if (dist <= CORE_RANGE) {
                coreIntensity = Math.max(coreIntensity, Math.max(0, 1 - (dist / CORE_RANGE)));
            }
            if (dist > RADAR_RANGE) {
                var quadrant = offRadarQuadrants[quadrantIndexFromAngle(angle)];
                quadrant.count++;
                if (dist < quadrant.minDist) quadrant.minDist = dist;
            }
        }

        var beacons = [];
        for (var q = 0; q < offRadarQuadrants.length; q++) {
            var candidate = offRadarQuadrants[q];
            if (candidate.count <= 0) continue;
            beacons.push({
                angleRad: candidate.angleRad,
                intensity: Math.max(0.35, Math.min(1, candidate.count >= 4 ? 1 : (0.28 + candidate.count * 0.18))),
                count: candidate.count
            });
        }

        return {
            segments: segments,
            coreIntensity: coreIntensity,
            beacons: beacons
        };
    }

    RT.GameAwareness = {
        collectTargets: collectTargets,
        buildState: buildState
    };
})();
