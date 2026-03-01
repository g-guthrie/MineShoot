(function (global) {
    'use strict';

    if (global.__GAME_WORLD_LAYOUT__) return;

    var PRIM = global.__GAME_PRIMITIVES__ || {};
    var WORLD_PRIM = PRIM.world || {};

    function num(value, fallback) {
        var n = Number(value);
        return isFinite(n) ? n : fallback;
    }

    function getConfig(overrides) {
        overrides = (overrides && typeof overrides === 'object') ? overrides : {};

        var baseWorldSize = num(overrides.baseWorldSize, num(WORLD_PRIM.base_world_size, 50));
        var areaScale = num(overrides.areaScale, num(WORLD_PRIM.area_scale, 5));
        var worldSize = num(overrides.worldSize, num(WORLD_PRIM.world_size, Math.round(baseWorldSize * Math.sqrt(areaScale))));
        var margin = num(overrides.margin, num(WORLD_PRIM.margin, 2));
        var min = num(overrides.min, margin);
        var max = num(overrides.max, worldSize - margin);
        var center = num(overrides.center, worldSize * 0.5);
        var seed = String(overrides.seed || WORLD_PRIM.seed_default || 'mineshoot-v1');
        var chunkSize = Math.max(4, Math.floor(num(overrides.chunkSize, num(WORLD_PRIM.chunk_size, 16))));
        var interestRadiusChunks = Math.max(1, Math.floor(num(overrides.interestRadiusChunks, num(WORLD_PRIM.interest_radius_chunks, 2))));

        return {
            baseWorldSize: baseWorldSize,
            areaScale: areaScale,
            worldSize: worldSize,
            margin: margin,
            min: min,
            max: max,
            center: center,
            seed: seed,
            chunkSize: chunkSize,
            interestRadiusChunks: interestRadiusChunks
        };
    }

    function scaleAxis(config, value) {
        return (Number(value) / config.baseWorldSize) * config.worldSize;
    }

    function scaleSpan(config, value) {
        return Math.max(1, (Number(value) / config.baseWorldSize) * config.worldSize);
    }

    function buildSolidSpecs(config) {
        var solids = [];
        var cfg = getConfig(config);

        function add(x, y, z, w, h, d, kind) {
            solids.push({
                x: Number(x.toFixed(3)),
                y: Number(y.toFixed(3)),
                z: Number(z.toFixed(3)),
                w: Number(w.toFixed(3)),
                h: Number(h.toFixed(3)),
                d: Number(d.toFixed(3)),
                kind: kind || 'cover'
            });
        }

        function px(value) { return scaleAxis(cfg, value); }
        function span(value) { return scaleSpan(cfg, value); }

        var coverLayout = Array.isArray(WORLD_PRIM.core_cover_layout) ? WORLD_PRIM.core_cover_layout : [];
        if (coverLayout.length > 0) {
            for (var i = 0; i < coverLayout.length; i++) {
                var c = coverLayout[i];
                add(px(c[0]), c[1], px(c[2]), span(c[3]), c[4], span(c[5]), 'core');
            }
        } else {
            add(px(25), 1.5, px(25), span(4), 3, span(1), 'core');
            add(px(25), 1.5, px(27), span(1), 3, span(3), 'core');
            add(px(25), 1.5, px(23), span(1), 3, span(3), 'core');
        }

        var edgeStep = Math.max(2, Math.round(cfg.worldSize / 30));
        var edge;
        for (edge = cfg.min + 1; edge <= cfg.max - 1; edge += edgeStep) {
            var northHeight = 2 + ((edge % (edgeStep * 3) === 0) ? 1 : 0) + ((edge % (edgeStep * 5) === 0) ? 1 : 0);
            var southHeight = 2 + ((edge % (edgeStep * 4) === 0) ? 1 : 0);
            add(edge, northHeight * 0.5, cfg.min + 0.8, edgeStep * 0.92, northHeight, 1.2, 'barrier');
            add(edge, southHeight * 0.5, cfg.max - 0.8, edgeStep * 0.92, southHeight, 1.2, 'barrier');
        }

        for (edge = cfg.min + 1; edge <= cfg.max - 1; edge += edgeStep) {
            var westHeight = 2 + ((edge % (edgeStep * 4) === 0) ? 1 : 0);
            var eastHeight = 2 + ((edge % (edgeStep * 3) === 0) ? 1 : 0);
            add(cfg.min + 0.8, westHeight * 0.5, edge, 1.2, westHeight, edgeStep * 0.92, 'barrier');
            add(cfg.max - 0.8, eastHeight * 0.5, edge, 1.2, eastHeight, edgeStep * 0.92, 'barrier');
        }

        return solids;
    }

    function getChunkCoord(value, chunkSize) {
        return Math.floor(Number(value) / Math.max(1, Number(chunkSize) || 1));
    }

    function makeChunkKey(cx, cz) {
        return String(cx) + ':' + String(cz);
    }

    function parseChunkKey(key) {
        var parts = String(key || '').split(':');
        if (parts.length !== 2) return null;
        var cx = Number(parts[0]);
        var cz = Number(parts[1]);
        if (!isFinite(cx) || !isFinite(cz)) return null;
        return { cx: cx, cz: cz };
    }

    function getChunkForPosition(x, z, chunkSize) {
        return {
            cx: getChunkCoord(x, chunkSize),
            cz: getChunkCoord(z, chunkSize)
        };
    }

    function getChunkBounds(cx, cz, chunkSize) {
        var size = Math.max(1, Number(chunkSize) || 1);
        var minX = cx * size;
        var minZ = cz * size;
        return {
            minX: minX,
            maxX: minX + size,
            minZ: minZ,
            maxZ: minZ + size
        };
    }

    function cloneSolid(solid) {
        return {
            x: solid.x,
            y: solid.y,
            z: solid.z,
            w: solid.w,
            h: solid.h,
            d: solid.d,
            kind: solid.kind || 'cover'
        };
    }

    function buildChunkIndex(solids, chunkSize) {
        var out = new Map();
        var size = Math.max(1, Number(chunkSize) || 1);
        var list = Array.isArray(solids) ? solids : [];

        for (var i = 0; i < list.length; i++) {
            var s = list[i];
            if (!s) continue;
            var minCx = getChunkCoord(s.x - (s.w * 0.5), size);
            var maxCx = getChunkCoord(s.x + (s.w * 0.5), size);
            var minCz = getChunkCoord(s.z - (s.d * 0.5), size);
            var maxCz = getChunkCoord(s.z + (s.d * 0.5), size);

            for (var cx = minCx; cx <= maxCx; cx++) {
                for (var cz = minCz; cz <= maxCz; cz++) {
                    var key = makeChunkKey(cx, cz);
                    var chunk = out.get(key);
                    if (!chunk) {
                        chunk = {
                            key: key,
                            version: 1,
                            solids: [],
                            decor: [],
                            blockers: [],
                            nav: []
                        };
                        out.set(key, chunk);
                    }
                    chunk.solids.push(cloneSolid(s));
                }
            }
        }

        return out;
    }

    function getChunksAround(index, centerChunkX, centerChunkZ, radius) {
        var out = [];
        var r = Math.max(0, Math.floor(Number(radius) || 0));
        var cx0 = Math.floor(Number(centerChunkX) || 0);
        var cz0 = Math.floor(Number(centerChunkZ) || 0);

        for (var dz = -r; dz <= r; dz++) {
            for (var dx = -r; dx <= r; dx++) {
                var key = makeChunkKey(cx0 + dx, cz0 + dz);
                var chunk = index.get(key);
                if (!chunk) continue;
                out.push({
                    key: chunk.key,
                    version: Number(chunk.version || 1),
                    solids: chunk.solids.slice(),
                    decor: Array.isArray(chunk.decor) ? chunk.decor.slice() : [],
                    blockers: Array.isArray(chunk.blockers) ? chunk.blockers.slice() : [],
                    nav: Array.isArray(chunk.nav) ? chunk.nav.slice() : []
                });
            }
        }

        return out;
    }

    function getBootstrapPayload(config, chunkIndex) {
        var cfg = getConfig(config);
        var center = getChunkForPosition(cfg.center, cfg.center, cfg.chunkSize);
        return {
            worldId: 'global-world',
            protocolVersion: 2,
            chunkSize: cfg.chunkSize,
            interestRadiusChunks: cfg.interestRadiusChunks,
            tickRate: 20,
            seed: cfg.seed,
            spawnRules: {
                feetY: 0,
                padding: 8
            },
            initialChunks: getChunksAround(chunkIndex, center.cx, center.cz, cfg.interestRadiusChunks)
        };
    }

    global.__GAME_WORLD_LAYOUT__ = {
        getConfig: getConfig,
        buildSolidSpecs: buildSolidSpecs,
        getChunkCoord: getChunkCoord,
        getChunkForPosition: getChunkForPosition,
        makeChunkKey: makeChunkKey,
        parseChunkKey: parseChunkKey,
        getChunkBounds: getChunkBounds,
        buildChunkIndex: buildChunkIndex,
        getChunksAround: getChunksAround,
        getBootstrapPayload: getBootstrapPayload
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
