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
    var BEACON_MIN_RANGE = awarenessTuning.beaconMinRange;
    var BEACON_MAX_COUNT = awarenessTuning.beaconMaxCount;

    function normalizeSectorIndex(idx, segCount) {
        return ((idx % segCount) + segCount) % segCount;
    }

    function collectTargets() {
        var out = [];
        var seen = {};
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
        if (RT.GameNet && RT.GameNet.getLockTargets) {
            appendTargets(RT.GameNet.getLockTargets() || []);
        }
        return out;
    }

    function buildState(playerPos, playerYaw) {
        var segments = new Array(SEGMENTS);
        for (var i = 0; i < SEGMENTS; i++) segments[i] = 0;
        var coreIntensity = 0;
        var targets = collectTargets();
        var buckets = {};
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

            if (dist > BEACON_MIN_RANGE) {
                var key = String(sector);
                if (!buckets[key]) {
                    buckets[key] = {
                        sector: sector,
                        angleRad: sector * sectorStep,
                        count: 0,
                        minDist: Infinity
                    };
                }
                buckets[key].count++;
                if (dist < buckets[key].minDist) buckets[key].minDist = dist;
            }
        }

        var beacons = [];
        for (var k in buckets) {
            if (!Object.prototype.hasOwnProperty.call(buckets, k)) continue;
            var b = buckets[k];
            var score = b.count * 2 + (1 / (1 + b.minDist * 0.04));
            beacons.push({
                angleRad: b.angleRad,
                intensity: Math.max(0.3, Math.min(1, 0.35 + b.count * 0.18)),
                score: score
            });
        }
        beacons.sort(function (a, b) { return b.score - a.score; });
        if (beacons.length > BEACON_MAX_COUNT) {
            beacons = beacons.slice(0, BEACON_MAX_COUNT);
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
