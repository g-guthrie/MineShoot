/**
 * intersection-builder.js - Grid seam and junction builders for the authored biome map.
 * Keeps separator logic separate from cell-local biome modules.
 */
(function () {
    'use strict';

    var runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
    var ns = (runtime.WorldIntersections = runtime.WorldIntersections || {});

    function lerp(a, b, t) {
        return a + ((b - a) * t);
    }

    function createSeamSpec(overrides) {
        var spec = overrides || {};
        var armWidth = Number(spec.armWidth);
        var height = Number(spec.height);
        var tintMix = Number(spec.tintMix);
        var tintThreshold = Number(spec.tintThreshold);
        if (!(armWidth > 0)) armWidth = 0.36;
        if (!(height > 0)) height = 0.08;
        if (!(tintMix >= 0)) tintMix = 0.12;
        if (!(tintThreshold > 0)) tintThreshold = 0.22;
        return {
            armWidth: armWidth,
            halfWidth: armWidth * 0.5,
            height: height,
            tintMix: tintMix,
            tintThreshold: tintThreshold
        };
    }

    function getCellEntry(biomeMap, row, col) {
        if (!Array.isArray(biomeMap)) return null;
        for (var i = 0; i < biomeMap.length; i++) {
            var entry = biomeMap[i];
            if (!entry) continue;
            if (Number(entry.row) === row && Number(entry.col) === col) return entry;
        }
        return null;
    }

    function pointOnEdge(bounds, edge, progress, inset) {
        var t = Math.max(0, Math.min(1, Number(progress || 0)));
        var edgeInset = Number(inset || 0);
        if (edge === 'east') {
            return { x: bounds.maxX - edgeInset, z: lerp(bounds.minZ, bounds.maxZ, t) };
        }
        if (edge === 'west') {
            return { x: bounds.minX + edgeInset, z: lerp(bounds.minZ, bounds.maxZ, t) };
        }
        if (edge === 'north') {
            return { x: lerp(bounds.minX, bounds.maxX, t), z: bounds.minZ + edgeInset };
        }
        return { x: lerp(bounds.minX, bounds.maxX, t), z: bounds.maxZ - edgeInset };
    }

    function seamAxis(edge) {
        return (edge === 'east' || edge === 'west') ? 'vertical' : 'horizontal';
    }

    function buildPalette(materialLibrary, biomeId) {
        var matLib = materialLibrary;
        if (biomeId === 'arctic') {
            return {
                base: matLib.getLambert({ color: 0xd7edf8 }),
                accent: matLib.getLambert({ color: 0xa8dff5, transparent: true, opacity: 0.8 }),
                detail: matLib.getLambert({ color: 0x7cbad6 })
            };
        }
        if (biomeId === 'desert') {
            return {
                base: matLib.getLambert({ color: 0xc79a5a }),
                accent: matLib.getLambert({ color: 0xb97842 }),
                detail: matLib.getLambert({ color: 0x8d6b4d })
            };
        }
        if (biomeId === 'jungle') {
            return {
                base: matLib.getLambert({ color: 0x4a5742 }),
                accent: matLib.getLambert({ color: 0x2f6a30 }),
                detail: matLib.getLambert({ color: 0x1f4a1f })
            };
        }
        if (biomeId === 'nuclear') {
            return {
                base: matLib.getLambert({ color: 0x6d747b }),
                accent: matLib.getLambert({ color: 0xd7b03c }),
                detail: matLib.getLambert({ color: 0x49525a })
            };
        }
        if (biomeId === 'citadel') {
            return {
                base: matLib.getLambert({ color: 0x74706a }),
                accent: matLib.getLambert({ color: 0x999289 }),
                detail: matLib.getLambert({ color: 0x4a463f })
            };
        }
        if (biomeId === 'quarry') {
            return {
                base: matLib.getLambert({ color: 0x806c5e }),
                accent: matLib.getLambert({ color: 0xbaa18b }),
                detail: matLib.getLambert({ color: 0x5c4a3e })
            };
        }
        if (biomeId === 'basin') {
            return {
                base: matLib.getLambert({ color: 0x65737a }),
                accent: matLib.getLambert({ color: 0x67a8ba }),
                detail: matLib.getLambert({ color: 0x385d68 })
            };
        }
        if (biomeId === 'radar') {
            return {
                base: matLib.getLambert({ color: 0x8e958d }),
                accent: matLib.getLambert({ color: 0xc6d4d0 }),
                detail: matLib.getLambert({ color: 0x4c5860 })
            };
        }
        return {
            base: matLib.getLambert({ color: 0x727980 }),
            accent: matLib.getLambert({ color: 0x8a939a }),
            detail: matLib.getLambert({ color: 0x44505a })
        };
    }

    function addStrip(ctx, center, width, height, depth, material, solid) {
        ctx.place.addBlock(center.x, height * 0.5, center.z, width, height, depth, material, solid === true);
    }

    function buildArcticEdge(ctx) {
        var p0 = pointOnEdge(ctx.bounds, ctx.edge, 0.22, 0.8);
        var p1 = pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.65);
        var p2 = pointOnEdge(ctx.bounds, ctx.edge, 0.78, 0.8);
        ctx.place.addBlock(p0.x, 0.38, p0.z, 0.95, 0.76, 0.85, ctx.palette.base, false);
        ctx.place.addBlock(p1.x, 0.55, p1.z, 1.2, 1.1, 0.95, ctx.palette.accent, false);
        ctx.place.addBlock(p2.x, 0.34, p2.z, 0.85, 0.68, 0.78, ctx.palette.base, false);
    }

    function buildUrbanEdge(ctx) {
        if (seamAxis(ctx.edge) === 'vertical') {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.45), 0.55, 0.26, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.66, ctx.palette.base, false);
            ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.2, 0.9).x, 0.7, pointOnEdge(ctx.bounds, ctx.edge, 0.2, 0.9).z, 0.22, 1.4, 0.22, ctx.palette.detail, false);
            ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.8, 0.9).x, 0.7, pointOnEdge(ctx.bounds, ctx.edge, 0.8, 0.9).z, 0.22, 1.4, 0.22, ctx.palette.detail, false);
        } else {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.45), (ctx.bounds.maxX - ctx.bounds.minX) * 0.66, 0.26, 0.55, ctx.palette.base, false);
            ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.2, 0.9).x, 0.7, pointOnEdge(ctx.bounds, ctx.edge, 0.2, 0.9).z, 0.22, 1.4, 0.22, ctx.palette.detail, false);
            ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.8, 0.9).x, 0.7, pointOnEdge(ctx.bounds, ctx.edge, 0.8, 0.9).z, 0.22, 1.4, 0.22, ctx.palette.detail, false);
        }
        ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.45).x, 0.14, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.45).z, seamAxis(ctx.edge) === 'vertical' ? 0.08 : 4.8, 0.08, seamAxis(ctx.edge) === 'vertical' ? 4.8 : 0.08, ctx.palette.accent, false);
    }

    function buildDesertEdge(ctx) {
        if (seamAxis(ctx.edge) === 'vertical') {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.75), 1.25, 0.28, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.74, ctx.palette.base, false);
        } else {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.75), (ctx.bounds.maxX - ctx.bounds.minX) * 0.74, 0.28, 1.25, ctx.palette.base, false);
        }
        ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.3, 0.95).x, 0.22, pointOnEdge(ctx.bounds, ctx.edge, 0.3, 0.95).z, 0.5, 0.44, 0.42, ctx.palette.detail, false);
        ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.7, 1.0).x, 0.18, pointOnEdge(ctx.bounds, ctx.edge, 0.7, 1.0).z, 0.42, 0.36, 0.36, ctx.palette.detail, false);
    }

    function buildJungleEdge(ctx) {
        if (seamAxis(ctx.edge) === 'vertical') {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.72), 0.92, 0.18, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.7, ctx.palette.base, false);
        } else {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.72), (ctx.bounds.maxX - ctx.bounds.minX) * 0.7, 0.18, 0.92, ctx.palette.base, false);
        }
        var vineA = pointOnEdge(ctx.bounds, ctx.edge, 0.28, 1.05);
        var vineB = pointOnEdge(ctx.bounds, ctx.edge, 0.74, 1.05);
        ctx.place.addBlock(vineA.x, 0.8, vineA.z, 0.18, 1.6, 0.18, ctx.palette.accent, false);
        ctx.place.addBlock(vineB.x, 0.58, vineB.z, 0.16, 1.16, 0.16, ctx.palette.accent, false);
    }

    function buildNuclearEdge(ctx) {
        if (seamAxis(ctx.edge) === 'vertical') {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48), 0.7, 0.32, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.72, ctx.palette.base, false);
            ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48).x, 0.16, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48).z, 0.12, 0.12, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.64, ctx.palette.accent, false);
        } else {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48), (ctx.bounds.maxX - ctx.bounds.minX) * 0.72, 0.32, 0.7, ctx.palette.base, false);
            ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48).x, 0.16, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.48).z, (ctx.bounds.maxX - ctx.bounds.minX) * 0.64, 0.12, 0.12, ctx.palette.accent, false);
        }
        var postA = pointOnEdge(ctx.bounds, ctx.edge, 0.18, 0.82);
        var postB = pointOnEdge(ctx.bounds, ctx.edge, 0.82, 0.82);
        ctx.place.addBlock(postA.x, 0.78, postA.z, 0.24, 1.56, 0.24, ctx.palette.detail, false);
        ctx.place.addBlock(postB.x, 0.78, postB.z, 0.24, 1.56, 0.24, ctx.palette.detail, false);
    }

    function buildCitadelEdge(ctx) {
        if (seamAxis(ctx.edge) === 'vertical') {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.55), 1.1, 0.44, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.62, ctx.palette.base, false);
        } else {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.55), (ctx.bounds.maxX - ctx.bounds.minX) * 0.62, 0.44, 1.1, ctx.palette.base, false);
        }
        var crenelA = pointOnEdge(ctx.bounds, ctx.edge, 0.32, 0.88);
        var crenelB = pointOnEdge(ctx.bounds, ctx.edge, 0.68, 0.88);
        ctx.place.addBlock(crenelA.x, 0.84, crenelA.z, 0.8, 0.72, 0.8, ctx.palette.accent, false);
        ctx.place.addBlock(crenelB.x, 0.84, crenelB.z, 0.8, 0.72, 0.8, ctx.palette.accent, false);
    }

    function buildQuarryEdge(ctx) {
        if (seamAxis(ctx.edge) === 'vertical') {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.72), 1.45, 0.36, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.72, ctx.palette.base, false);
        } else {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.72), (ctx.bounds.maxX - ctx.bounds.minX) * 0.72, 0.36, 1.45, ctx.palette.base, false);
        }
        ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.24, 1.0).x, 0.3, pointOnEdge(ctx.bounds, ctx.edge, 0.24, 1.0).z, 0.62, 0.6, 0.54, ctx.palette.detail, false);
        ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.74, 0.96).x, 0.42, pointOnEdge(ctx.bounds, ctx.edge, 0.74, 0.96).z, 0.9, 0.84, 0.72, ctx.palette.accent, false);
    }

    function buildBasinEdge(ctx) {
        if (seamAxis(ctx.edge) === 'vertical') {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6), 0.9, 0.24, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.76, ctx.palette.base, false);
            ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6).x, 0.08, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6).z, 0.5, 0.08, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.62, ctx.palette.accent, false);
        } else {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6), (ctx.bounds.maxX - ctx.bounds.minX) * 0.76, 0.24, 0.9, ctx.palette.base, false);
            ctx.place.addBlock(pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6).x, 0.08, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.6).z, (ctx.bounds.maxX - ctx.bounds.minX) * 0.62, 0.08, 0.5, ctx.palette.accent, false);
        }
    }

    function buildRadarEdge(ctx) {
        if (seamAxis(ctx.edge) === 'vertical') {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.45), 0.64, 0.26, (ctx.bounds.maxZ - ctx.bounds.minZ) * 0.66, ctx.palette.base, false);
        } else {
            addStrip(ctx, pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.45), (ctx.bounds.maxX - ctx.bounds.minX) * 0.66, 0.26, 0.64, ctx.palette.base, false);
        }
        var mast = pointOnEdge(ctx.bounds, ctx.edge, 0.5, 0.9);
        ctx.place.addBlock(mast.x, 1.0, mast.z, 0.18, 2.0, 0.18, ctx.palette.detail, false);
        ctx.place.addBlock(mast.x, 1.82, mast.z, 0.8, 0.08, 0.08, ctx.palette.accent, false);
        ctx.place.addBlock(mast.x, 1.46, mast.z, 0.08, 0.08, 0.8, ctx.palette.accent, false);
    }

    function defaultBiomeEdgeKit(ctx) {
        if (ctx.biome === 'arctic') return buildArcticEdge(ctx);
        if (ctx.biome === 'urban') return buildUrbanEdge(ctx);
        if (ctx.biome === 'desert') return buildDesertEdge(ctx);
        if (ctx.biome === 'jungle') return buildJungleEdge(ctx);
        if (ctx.biome === 'nuclear') return buildNuclearEdge(ctx);
        if (ctx.biome === 'citadel') return buildCitadelEdge(ctx);
        if (ctx.biome === 'quarry') return buildQuarryEdge(ctx);
        if (ctx.biome === 'basin') return buildBasinEdge(ctx);
        if (ctx.biome === 'radar') return buildRadarEdge(ctx);
        return buildUrbanEdge(ctx);
    }

    function addJunctionFace(place, centerX, centerZ, offsetX, offsetZ, biomeId, palette) {
        place.addBlock(centerX + offsetX, 0.52, centerZ + offsetZ, 2.1, 1.04, 2.1, palette.base, true);
        if (biomeId === 'arctic') {
            place.addBlock(centerX + offsetX, 1.55, centerZ + offsetZ, 0.95, 1.1, 0.95, palette.accent, false);
            return;
        }
        if (biomeId === 'desert' || biomeId === 'quarry') {
            place.addBlock(centerX + offsetX, 1.22, centerZ + offsetZ, 1.4, 0.4, 1.4, palette.accent, false);
            place.addBlock(centerX + offsetX, 1.7, centerZ + offsetZ, 0.8, 0.56, 0.8, palette.detail, false);
            return;
        }
        if (biomeId === 'jungle') {
            place.addBlock(centerX + offsetX, 1.12, centerZ + offsetZ, 1.1, 1.2, 1.1, palette.accent, false);
            place.addBlock(centerX + offsetX + 0.34, 1.9, centerZ + offsetZ - 0.24, 0.14, 0.8, 0.14, palette.detail, false);
            return;
        }
        if (biomeId === 'nuclear') {
            place.addBlock(centerX + offsetX, 1.02, centerZ + offsetZ, 1.6, 0.3, 1.6, palette.accent, false);
            place.addBlock(centerX + offsetX, 2.0, centerZ + offsetZ, 0.42, 1.6, 0.42, palette.detail, false);
            return;
        }
        if (biomeId === 'radar') {
            place.addBlock(centerX + offsetX, 1.6, centerZ + offsetZ, 0.22, 1.8, 0.22, palette.detail, false);
            place.addBlock(centerX + offsetX, 2.3, centerZ + offsetZ, 0.9, 0.08, 0.08, palette.accent, false);
            return;
        }
        place.addBlock(centerX + offsetX, 1.18, centerZ + offsetZ, 1.35, 0.36, 1.35, palette.accent, false);
    }

    function buildHybridPylon(ctx) {
        var centerX = Number(ctx.centerX || 0);
        var centerZ = Number(ctx.centerZ || 0);
        var place = ctx.place;
        var matLib = ctx.materialLibrary;
        var seamSpec = createSeamSpec(ctx.seamSpec);
        var coreBase = matLib.getLambert({ color: 0x5f625f });
        var coreAccent = matLib.getLambert({ color: 0x8a8f87 });
        var lightMat = matLib.getLambert({ color: 0xd3c373, emissive: 0xd3c373, emissiveIntensity: 0.45 });

        place.addBlock(centerX, seamSpec.height * 0.5, centerZ, 7.2, seamSpec.height, 7.2, coreBase, false);
        place.addBlock(centerX, 0.46, centerZ, 6.0, 0.84, 6.0, coreBase, true);
        place.addBlock(centerX, 1.3, centerZ, 4.2, 0.54, 4.2, coreAccent, true);

        var neighbors = ctx.neighbors || {};
        addJunctionFace(place, centerX, centerZ, -2.15, -2.15, neighbors.nw && neighbors.nw.biome, buildPalette(matLib, neighbors.nw && neighbors.nw.biome));
        addJunctionFace(place, centerX, centerZ, 2.15, -2.15, neighbors.ne && neighbors.ne.biome, buildPalette(matLib, neighbors.ne && neighbors.ne.biome));
        addJunctionFace(place, centerX, centerZ, -2.15, 2.15, neighbors.sw && neighbors.sw.biome, buildPalette(matLib, neighbors.sw && neighbors.sw.biome));
        addJunctionFace(place, centerX, centerZ, 2.15, 2.15, neighbors.se && neighbors.se.biome, buildPalette(matLib, neighbors.se && neighbors.se.biome));

        place.addBlock(centerX, 3.0, centerZ, 2.8, 3.4, 2.8, coreBase, true);
        place.addBlock(centerX, 5.8, centerZ, 1.9, 2.2, 1.9, coreAccent, true);
        place.addBlock(centerX, 7.9, centerZ, 1.0, 2.0, 1.0, coreAccent, true);
        place.addBlock(centerX, 9.0, centerZ, 0.46, 0.18, 0.46, lightMat, false);

        place.addBlock(centerX - 4.1, 0.42, centerZ, 1.8, 0.84, 1.2, coreBase, true);
        place.addBlock(centerX + 4.1, 0.42, centerZ, 1.8, 0.84, 1.2, coreBase, true);
        place.addBlock(centerX, 0.42, centerZ - 4.1, 1.2, 0.84, 1.8, coreBase, true);
        place.addBlock(centerX, 0.42, centerZ + 4.1, 1.2, 0.84, 1.8, coreBase, true);

        if (ctx.fx && typeof ctx.fx.addFlicker === 'function') {
            ctx.fx.addFlicker({ material: lightMat, freq: 2.8, phase: centerX * 0.21 + centerZ * 0.13 });
        }

        return {
            id: 'hybrid_pylon',
            peakHeight: 9.0
        };
    }

    function buildGridDecor(ctx) {
        if (!ctx || !ctx.place || !ctx.materialLibrary || !ctx.layout) return null;

        var place = ctx.place;
        var layout = ctx.layout;
        var biomeMap = Array.isArray(ctx.biomeMap) ? ctx.biomeMap : [];
        var seamSpec = createSeamSpec(ctx.seamSpec);
        var seamMaterial = ctx.seamMaterial || ctx.materialLibrary.getLambert({ color: 0x58605d });
        var seamLinesX = Array.isArray(ctx.seamLinesX) ? ctx.seamLinesX : (layout.BIOME_GRID_LINE_X || []);
        var seamLinesZ = Array.isArray(ctx.seamLinesZ) ? ctx.seamLinesZ : (layout.BIOME_GRID_LINE_Z || []);
        var worldMin = Number(layout.WORLD_MIN || 0);
        var worldMax = Number(layout.WORLD_MAX || 0);
        var gridRows = Number(layout.BIOME_GRID_ROWS || 0);
        var gridCols = Number(layout.BIOME_GRID_COLS || 0);
        var junctionBuilderId = ctx.junctionBuilderId || 'hybrid_pylon';
        var junctionBuilder = ns.junctionBuilders && ns.junctionBuilders[junctionBuilderId];
        if (typeof junctionBuilder !== 'function') junctionBuilder = buildHybridPylon;

        for (var xi = 0; xi < seamLinesX.length; xi++) {
            var seamX = Number(seamLinesX[xi] || 0);
            for (var row = 0; row < gridRows; row++) {
                var leftBounds = layout.cellBounds({ row: row, col: xi }, 0);
                var rightBounds = layout.cellBounds({ row: row, col: xi + 1 }, 0);
                var segmentCenterZ = (leftBounds.minZ + leftBounds.maxZ) * 0.5;
                var segmentDepth = leftBounds.maxZ - leftBounds.minZ;
                place.addBlock(seamX, seamSpec.height * 0.5, segmentCenterZ, seamSpec.armWidth, seamSpec.height, segmentDepth, seamMaterial, false);

                var westEntry = getCellEntry(biomeMap, row, xi);
                var eastEntry = getCellEntry(biomeMap, row, xi + 1);
                if (westEntry) {
                    var westEdgeCtx = {
                        biome: westEntry.biome,
                        edge: 'east',
                        bounds: leftBounds,
                        place: place,
                        materialLibrary: ctx.materialLibrary,
                        seamSpec: seamSpec,
                        palette: buildPalette(ctx.materialLibrary, westEntry.biome)
                    };
                    (ns.edgeKits[westEntry.biome] || ns.edgeKits.default)(westEdgeCtx);
                }
                if (eastEntry) {
                    var eastEdgeCtx = {
                        biome: eastEntry.biome,
                        edge: 'west',
                        bounds: rightBounds,
                        place: place,
                        materialLibrary: ctx.materialLibrary,
                        seamSpec: seamSpec,
                        palette: buildPalette(ctx.materialLibrary, eastEntry.biome)
                    };
                    (ns.edgeKits[eastEntry.biome] || ns.edgeKits.default)(eastEdgeCtx);
                }
            }
        }

        for (var zi = 0; zi < seamLinesZ.length; zi++) {
            var seamZ = Number(seamLinesZ[zi] || 0);
            for (var col = 0; col < gridCols; col++) {
                var topBounds = layout.cellBounds({ row: zi, col: col }, 0);
                var bottomBounds = layout.cellBounds({ row: zi + 1, col: col }, 0);
                var segmentCenterX = (topBounds.minX + topBounds.maxX) * 0.5;
                var segmentWidth = topBounds.maxX - topBounds.minX;
                place.addBlock(segmentCenterX, seamSpec.height * 0.5, seamZ, segmentWidth, seamSpec.height, seamSpec.armWidth, seamMaterial, false);

                var northEntry = getCellEntry(biomeMap, zi, col);
                var southEntry = getCellEntry(biomeMap, zi + 1, col);
                if (northEntry) {
                    var northEdgeCtx = {
                        biome: northEntry.biome,
                        edge: 'south',
                        bounds: topBounds,
                        place: place,
                        materialLibrary: ctx.materialLibrary,
                        seamSpec: seamSpec,
                        palette: buildPalette(ctx.materialLibrary, northEntry.biome)
                    };
                    (ns.edgeKits[northEntry.biome] || ns.edgeKits.default)(northEdgeCtx);
                }
                if (southEntry) {
                    var southEdgeCtx = {
                        biome: southEntry.biome,
                        edge: 'north',
                        bounds: bottomBounds,
                        place: place,
                        materialLibrary: ctx.materialLibrary,
                        seamSpec: seamSpec,
                        palette: buildPalette(ctx.materialLibrary, southEntry.biome)
                    };
                    (ns.edgeKits[southEntry.biome] || ns.edgeKits.default)(southEdgeCtx);
                }
            }
        }

        for (var jx = 0; jx < seamLinesX.length; jx++) {
            for (var jz = 0; jz < seamLinesZ.length; jz++) {
                junctionBuilder({
                    centerX: seamLinesX[jx],
                    centerZ: seamLinesZ[jz],
                    seamSpec: seamSpec,
                    place: place,
                    materialLibrary: ctx.materialLibrary,
                    fx: ctx.fx || null,
                    neighbors: {
                        nw: getCellEntry(biomeMap, jz, jx),
                        ne: getCellEntry(biomeMap, jz, jx + 1),
                        sw: getCellEntry(biomeMap, jz + 1, jx),
                        se: getCellEntry(biomeMap, jz + 1, jx + 1)
                    }
                });
            }
        }

        return {
            seamSpec: seamSpec,
            seamCount: (seamLinesX.length * gridRows) + (seamLinesZ.length * gridCols),
            junctionCount: seamLinesX.length * seamLinesZ.length,
            worldMin: worldMin,
            worldMax: worldMax
        };
    }

    function stampIntersection(ctx) {
        if (!ctx || !ctx.place || !ctx.materialLibrary) return null;
        var seamSpec = createSeamSpec(ctx.seamSpec);
        var seamMaterial = ctx.seamMaterial || ctx.materialLibrary.getLambert({ color: 0x58605d });
        ctx.place.addBlock(ctx.centerX, seamSpec.height * 0.5, ctx.centerZ, seamSpec.armWidth, seamSpec.height, Number(ctx.span || 0), seamMaterial, false);
        ctx.place.addBlock(ctx.centerX, seamSpec.height * 0.5, ctx.centerZ, Number(ctx.span || 0), seamSpec.height, seamSpec.armWidth, seamMaterial, false);
        var builder = ctx.builder;
        if (typeof builder !== 'function') builder = buildHybridPylon;
        return builder({
            centerX: ctx.centerX,
            centerZ: ctx.centerZ,
            seamSpec: seamSpec,
            place: ctx.place,
            materialLibrary: ctx.materialLibrary,
            fx: ctx.fx || null,
            neighbors: ctx.neighbors || null
        });
    }

    ns.edgeKits = ns.edgeKits || {};
    ns.junctionBuilders = ns.junctionBuilders || {};
    ns.registerEdgeKit = function (biomeId, builder) {
        if (!biomeId || typeof builder !== 'function') return;
        ns.edgeKits[String(biomeId)] = builder;
    };
    ns.registerJunctionBuilder = function (builderId, builder) {
        if (!builderId || typeof builder !== 'function') return;
        ns.junctionBuilders[String(builderId)] = builder;
    };
    ns.createSeamSpec = createSeamSpec;
    ns.buildGridDecor = buildGridDecor;
    ns.stampIntersection = stampIntersection;
    ns.edgeKits.default = defaultBiomeEdgeKit;
    ns.registerEdgeKit('arctic', buildArcticEdge);
    ns.registerEdgeKit('urban', buildUrbanEdge);
    ns.registerEdgeKit('desert', buildDesertEdge);
    ns.registerEdgeKit('jungle', buildJungleEdge);
    ns.registerEdgeKit('nuclear', buildNuclearEdge);
    ns.registerEdgeKit('citadel', buildCitadelEdge);
    ns.registerEdgeKit('quarry', buildQuarryEdge);
    ns.registerEdgeKit('basin', buildBasinEdge);
    ns.registerEdgeKit('radar', buildRadarEdge);
    ns.registerJunctionBuilder('hybrid_pylon', buildHybridPylon);
})();
