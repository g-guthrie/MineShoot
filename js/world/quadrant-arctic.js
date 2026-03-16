import { pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-arctic.js - Arctic / ice biome quadrant builder.
 * Plug-and-play: call buildArcticQuadrant(bounds, place, ctx) to populate any quadrant.
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            rock:      lib.getLambert({ color: 0x6b8299 }),
            darkRock:  lib.getLambert({ color: 0x556677 }),
            snow:      lib.getLambert({ color: 0xe8f4ff }),
            snowDrift: lib.getLambert({ color: 0xdce8f2 }),
            ice:       lib.getLambert({ color: 0x9ad4f0, transparent: true, opacity: 0.85 }),
            iceDeep:   lib.getLambert({ color: 0x6ab8e0, transparent: true, opacity: 0.75 }),
            frost:     lib.getLambert({ color: 0xc8e8f8 }),
            crevasse:  lib.getLambert({ color: 0x1a2a3a }),
            aurora1:   lib.getBasic({ color: 0x44cc88, transparent: true, opacity: 0.06, side: THREE.DoubleSide }),
            aurora2:   lib.getBasic({ color: 0x4488cc, transparent: true, opacity: 0.05, side: THREE.DoubleSide }),
            frozenFall:lib.getLambert({ color: 0x88ccee, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
        };
        return MATS;
    }

    function buildMountain(cx, cz, place, mats) {
        var tiers = [
            { dx: 0.0, dz: 0.0, w: 26.0, h: 2.7, d: 22.0, mat: mats.rock },
            { dx: -0.6, dz: 0.7, w: 23.2, h: 2.5, d: 19.6, mat: mats.rock },
            { dx: -1.1, dz: 1.2, w: 20.8, h: 2.4, d: 17.5, mat: mats.frost },
            { dx: -0.9, dz: 1.8, w: 18.6, h: 2.3, d: 15.8, mat: mats.frost },
            { dx: -0.2, dz: 1.2, w: 16.4, h: 2.4, d: 14.0, mat: mats.snow },
            { dx: 0.3, dz: 0.8, w: 14.2, h: 2.2, d: 12.1, mat: mats.snow },
            { dx: 0.6, dz: 0.4, w: 12.0, h: 2.0, d: 10.0, mat: mats.snow },
            { dx: 0.9, dz: 0.1, w: 10.0, h: 1.8, d: 8.2, mat: mats.frost },
            { dx: 1.1, dz: -0.2, w: 8.1, h: 1.6, d: 6.6, mat: mats.frost },
            { dx: 1.2, dz: -0.4, w: 6.2, h: 1.4, d: 5.0, mat: mats.snow },
            { dx: 1.1, dz: -0.4, w: 4.6, h: 1.2, d: 3.6, mat: mats.snow },
            { dx: 1.0, dz: -0.3, w: 2.4, h: 1.0, d: 1.8, mat: mats.frost }
        ];
        var currentBaseY = 0;
        var peakHeight = 0;

        function markPeak(centerY, height) {
            peakHeight = Math.max(peakHeight, centerY + (height * 0.5));
        }

        for (var t = 0; t < tiers.length; t++) {
            var tier = tiers[t];
            var centerY = currentBaseY + (tier.h * 0.5);
            place.addBlock(cx + tier.dx, centerY, cz + tier.dz, tier.w, tier.h, tier.d, tier.mat, true);
            currentBaseY += tier.h;
            markPeak(centerY, tier.h);
        }

        // Broken shelves and hard-to-follow approach route.
        place.addBlock(cx + 7.0, 5.2, cz - 2.1, 7.0, 1.8, 3.6, mats.snow, true);
        place.addBlock(cx - 7.2, 6.4, cz + 3.4, 6.4, 1.4, 3.6, mats.snow, true);
        place.addBlock(cx + 5.3, 7.4, cz - 4.7, 4.8, 1.1, 2.1, mats.frost, true);
        place.addRamp(cx + 4.8, 3.7, cz + 7.6, 6.8, 1.4, 4.1, mats.rock, Math.PI * 0.56, -0.28, true);
        place.addRamp(cx - 5.1, 4.6, cz - 6.7, 6.2, 1.3, 3.8, mats.snow, Math.PI * 1.08, -0.24, true);

        // A single narrow summit route and exposed summit pocket.
        place.addBlock(cx - 5.6, 9.0, cz + 4.8, 4.6, 1.0, 2.4, mats.snow, true);
        place.addRamp(cx - 3.4, 11.2, cz + 2.4, 4.2, 0.9, 2.6, mats.frost, Math.PI * 0.84, -0.22, true);
        place.addBlock(cx - 1.2, 13.6, cz + 0.8, 3.2, 0.9, 2.0, mats.snow, true);
        place.addRamp(cx + 0.6, 16.0, cz - 0.8, 3.0, 0.8, 2.4, mats.frost, Math.PI * 0.76, -0.2, true);
        place.addBlock(cx + 1.3, 18.6, cz - 1.2, 2.2, 0.8, 1.5, mats.snow, true);
        place.addBlock(cx + 1.2, 23.2, cz - 0.2, 1.9, 0.8, 1.4, mats.frost, true);

        // Summit texture so the peak stays solid but not featureless.
        place.addBlock(cx + 1.6, 24.1, cz - 0.5, 1.1, 1.2, 0.9, mats.ice, true);
        place.addBlock(cx + 0.4, 23.8, cz + 0.2, 0.8, 0.8, 0.7, mats.frost, true);
        markPeak(24.1, 1.2);
        markPeak(23.8, 0.8);

        // Crevasse slashes.
        place.addBlock(cx + 5.8, 3.8, cz + 0.8, 0.35, 3.2, 4.4, mats.crevasse, false);
        place.addBlock(cx - 4.9, 5.2, cz - 1.4, 3.8, 1.9, 0.35, mats.crevasse, false);
        place.addBlock(cx + 1.8, 7.2, cz - 4.1, 2.6, 1.3, 0.3, mats.crevasse, false);

        // Frozen waterfall stretched along the eastern face, but shorter than the old summit.
        place.addBlock(cx + 8.7, 8.8, cz + 0.1, 1.1, 12.0, 2.2, mats.ice, false);
        var fallGeo = new THREE.PlaneGeometry(4.0, 13.8);
        place.addDecor(cx + 8.9, 9.1, cz + 0.3, fallGeo, mats.frozenFall, 0, 0, 0);

        return {
            peakHeight: peakHeight,
            baseWidth: tiers[0].w,
            baseDepth: tiers[0].d,
            summitWidth: 1.9
        };
    }

    function addIceSpire(x, z, h, place, mats, ctx) {
        var height = Math.max(2.0, h);
        // Tapered: 3 stacked segments of decreasing width
        var baseW = 1.1;
        var seg1H = height * 0.45;
        var seg2H = height * 0.32;
        var seg3H = height * 0.23;

        place.addBlock(x, seg1H * 0.5, z, baseW, seg1H, baseW, mats.iceDeep, true);
        place.addBlock(x, seg1H + seg2H * 0.5, z, baseW * 0.7, seg2H, baseW * 0.7, mats.ice, false);
        var topMesh = place.addBlock(x, seg1H + seg2H + seg3H * 0.5, z, baseW * 0.4, seg3H, baseW * 0.4, mats.frost, false);

        // Shimmer on the top segment
        ctx.addIceShimmer({ material: mats.ice, baseOpacity: 0.85, phase: x * 1.7 + z * 2.3 });

        return topMesh;
    }

    function addGlacierPatch(cx, cz, width, depth, spires, place, mats, ctx) {
        var safeWidth = Math.max(2.2, Number(width || 0));
        var safeDepth = Math.max(1.8, Number(depth || 0));
        var items = Array.isArray(spires) ? spires : [];
        place.addBlock(cx, 0.16, cz, safeWidth, 0.32, safeDepth, mats.iceDeep, false);
        place.addBlock(cx + (safeWidth * 0.04), 0.28, cz - (safeDepth * 0.05), safeWidth * 0.66, 0.12, safeDepth * 0.6, mats.frost, false);

        for (var i = 0; i < items.length; i++) {
            var spire = items[i];
            addIceSpire(cx + Number(spire.dx || 0), cz + Number(spire.dz || 0), spire.h, place, mats, ctx);
        }

        return items.length;
    }

    function addIceBoulder(x, z, place, mats) {
        place.addBlock(x, 0.7, z, 2.2, 1.4, 1.8, mats.rock, true);
        place.addBlock(x + 0.2, 1.5, z - 0.1, 1.4, 0.6, 1.2, mats.frost, false);
        // Snow cap on top
        place.addBlock(x, 1.92, z, 1.8, 0.2, 1.5, mats.snow, false);
    }

    function addFrozenPool(x, z, place, mats) {
        place.addBlock(x, -0.08, z, 5.0, 0.16, 4.0, mats.ice, false);
        // Frost ring around the pool edge
        place.addBlock(x, 0.04, z, 5.6, 0.04, 4.6, mats.frost, false);
    }

    function addSnowDrift(x, z, w, d, place, mats) {
        place.addBlock(x, 0.12, z, w, 0.24, d, mats.snowDrift, false);
        place.addBlock(x + w * 0.12, 0.22, z - d * 0.1, w * 0.6, 0.14, d * 0.5, mats.snow, false);
    }

    function buildIceArch(cx, cz, place, mats, ctx) {
        // Two tapered spires with a connecting ice bridge
        addIceSpire(cx - 2.5, cz, 4.2, place, mats, ctx);
        addIceSpire(cx + 2.5, cz, 3.8, place, mats, ctx);
        // Horizontal ice bridge connecting the tops
        place.addBlock(cx, 3.5, cz, 5.5, 0.5, 0.8, mats.ice, false);
        place.addBlock(cx, 3.82, cz, 4.0, 0.2, 0.5, mats.frost, false);
        return 2;
    }

    function buildIceShelf(cx, cz, place, mats, ctx) {
        place.addBlock(cx, 0.35, cz, 5.8, 0.7, 3.0, mats.frost, true);
        place.addBlock(cx + 0.4, 0.74, cz - 0.1, 4.6, 0.16, 2.1, mats.ice, false);

        addIceSpire(cx - 1.9, cz + 0.8, 2.8, place, mats, ctx);
        addIceSpire(cx + 2.1, cz - 0.6, 2.4, place, mats, ctx);
        place.addBlock(cx + 2.8, 0.24, cz + 0.9, 0.7, 0.48, 0.6, mats.darkRock, false);
        return 2;
    }

    function buildIceOverhang(cx, cz, place, mats, ctx) {
        addIceSpire(cx - 3.8, cz + 0.4, 5.0, place, mats, ctx);
        addIceSpire(cx + 3.2, cz - 0.3, 4.6, place, mats, ctx);
        place.addBlock(cx - 0.2, 4.4, cz, 8.8, 0.7, 1.3, mats.iceDeep, true);
        place.addBlock(cx + 0.8, 5.0, cz - 0.2, 5.0, 0.4, 1.0, mats.frost, false);
        place.addRamp(cx + 2.0, 2.0, cz + 1.6, 3.0, 0.9, 4.2, mats.frost, 0.92, -0.2, true);
        place.addBlock(cx - 1.8, 0.4, cz - 1.4, 2.6, 0.8, 1.7, mats.darkRock, true);
        place.addBlock(cx + 3.1, 0.28, cz + 1.2, 0.8, 0.56, 0.7, mats.darkRock, false);
        return 2;
    }

    function buildArcticQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var rawBounds = (ctx && ctx.rawBounds) ? ctx.rawBounds : bounds;
        var center = pt(bounds, 0.46, 0.46);
        var crystalCount = 0;
        var groundSpireCount = 0;

        var mountain = buildMountain(center.x, center.z, place, mats);
        ctx.addExclusion(center.x, center.z, 12.5);

        var overhangPt = pt(bounds, 0.76, 0.28);
        crystalCount += buildIceOverhang(overhangPt.x, overhangPt.z, place, mats, ctx);
        ctx.addExclusion(overhangPt.x, overhangPt.z, 5.2);

        var glacierPatches = [
            {
                u: 0.10, v: 0.16, w: 3.8, d: 2.6,
                spires: [
                    { dx: -1.0, dz: -0.4, h: 3.0 },
                    { dx: 0.2, dz: 0.2, h: 4.1 },
                    { dx: 1.2, dz: -0.6, h: 2.5 }
                ]
            },
            {
                u: 0.14, v: 0.82, w: 3.6, d: 2.8,
                spires: [
                    { dx: -0.8, dz: 0.4, h: 3.6 },
                    { dx: 0.4, dz: -0.2, h: 4.0 },
                    { dx: 1.3, dz: 0.8, h: 2.7 }
                ]
            },
            {
                u: 0.88, v: 0.68, w: 4.0, d: 3.0,
                spires: [
                    { dx: -1.0, dz: -0.2, h: 3.2 },
                    { dx: 0.3, dz: 0.4, h: 3.8 },
                    { dx: 1.2, dz: -0.8, h: 2.9 }
                ]
            },
            {
                u: 0.62, v: 0.12, w: 3.4, d: 2.4,
                spires: [
                    { dx: -0.8, dz: 0.1, h: 2.6 },
                    { dx: 0.7, dz: -0.2, h: 3.2 }
                ]
            }
        ];
        for (var gp = 0; gp < glacierPatches.length; gp++) {
            var glacier = glacierPatches[gp];
            var glacierPt = pt(rawBounds, glacier.u, glacier.v);
            var patchCount = addGlacierPatch(glacierPt.x, glacierPt.z, glacier.w, glacier.d, glacier.spires, place, mats, ctx);
            crystalCount += patchCount;
            groundSpireCount += patchCount;
        }

        // Stand-alone ice teeth keep the biome readable between the larger glacier patches.
        var spires = [
            { u: 0.18, v: 0.18, h: 4.3 },
            { u: 0.24, v: 0.24, h: 3.2 },
            { u: 0.12, v: 0.78, h: 4.2 },
            { u: 0.20, v: 0.84, h: 3.1 },
            { u: 0.84, v: 0.74, h: 3.8 },
            { u: 0.88, v: 0.66, h: 2.9 }
        ];
        for (var i = 0; i < spires.length; i++) {
            var s = spires[i];
            var p = pt(bounds, s.u, s.v);
            addIceSpire(p.x, p.z, s.h, place, mats, ctx);
        }
        crystalCount += spires.length;
        groundSpireCount += spires.length;

        // Ice arch on the southern side to create a lower secondary landmark.
        var archPt = pt(bounds, 0.34, 0.72);
        crystalCount += buildIceArch(archPt.x, archPt.z, place, mats, ctx);
        ctx.addExclusion(archPt.x, archPt.z, 4.0);

        // Snow-capped boulders
        var boulders = [
            { u: 0.28, v: 0.36 },
            { u: 0.74, v: 0.58 },
            { u: 0.42, v: 0.80 },
            { u: 0.62, v: 0.18 },
            { u: 0.56, v: 0.68 }
        ];
        for (var b = 0; b < boulders.length; b++) {
            var bp = pt(bounds, boulders[b].u, boulders[b].v);
            addIceBoulder(bp.x, bp.z, place, mats);
        }

        // Frozen pool with frost ring
        var poolPt = pt(bounds, 0.70, 0.78);
        addFrozenPool(poolPt.x, poolPt.z, place, mats);

        // Wind-carved ice shelf gives the biome a lower landmark, not just tall forms.
        var shelfPt = pt(bounds, 0.26, 0.28);
        crystalCount += buildIceShelf(shelfPt.x, shelfPt.z, place, mats, ctx);
        ctx.addExclusion(shelfPt.x, shelfPt.z, 4.2);

        // Snow drifts and shelves create grouped approach paths.
        var drifts = [
            { u: 0.18, v: 0.46, w: 4.0, d: 2.2 },
            { u: 0.80, v: 0.42, w: 4.8, d: 2.8 },
            { u: 0.42, v: 0.12, w: 3.8, d: 2.0 },
            { u: 0.60, v: 0.88, w: 4.0, d: 2.4 },
            { u: 0.12, v: 0.64, w: 3.1, d: 3.2 },
            { u: 0.86, v: 0.54, w: 3.4, d: 2.2 },
            { u: 0.50, v: 0.92, w: 5.2, d: 2.1 },
            { u: 0.58, v: 0.08, w: 3.4, d: 1.6 }
        ];
        for (var d = 0; d < drifts.length; d++) {
            var dp = pt(bounds, drifts[d].u, drifts[d].v);
            addSnowDrift(dp.x, dp.z, drifts[d].w, drifts[d].d, place, mats);
        }

        // Aurora planes (high above, very transparent, suggesting northern lights)
        var auroraGeo1 = new THREE.PlaneGeometry(30, 6);
        place.addDecor(center.x - 5, 22, center.z - 8, auroraGeo1, mats.aurora1, 0.3, -0.8, 0.1);

        var auroraGeo2 = new THREE.PlaneGeometry(25, 5);
        place.addDecor(center.x + 8, 25, center.z + 5, auroraGeo2, mats.aurora2, -0.2, -0.6, -0.15);

        // Small scattered ice fragments near clusters
        var fragments = [
            { u: 0.16, v: 0.22, w: 0.5, h: 0.3, d: 0.4 },
            { u: 0.84, v: 0.22, w: 0.5, h: 0.28, d: 0.36 },
            { u: 0.13, v: 0.84, w: 0.6, h: 0.2, d: 0.45 },
            { u: 0.87, v: 0.74, w: 0.42, h: 0.24, d: 0.32 },
            { u: 0.28, v: 0.14, w: 0.55, h: 0.2, d: 0.4 },
            { u: 0.72, v: 0.86, w: 0.44, h: 0.22, d: 0.34 },
            { u: 0.68, v: 0.28, w: 0.52, h: 0.24, d: 0.36 },
            { u: 0.08, v: 0.22, w: 0.46, h: 0.18, d: 0.34, raw: true },
            { u: 0.18, v: 0.88, w: 0.48, h: 0.2, d: 0.36, raw: true },
            { u: 0.90, v: 0.60, w: 0.5, h: 0.2, d: 0.36, raw: true },
            { u: 0.66, v: 0.08, w: 0.44, h: 0.18, d: 0.32, raw: true }
        ];
        for (var fi = 0; fi < fragments.length; fi++) {
            var fr = fragments[fi];
            var frp = pt(fr.raw ? rawBounds : bounds, fr.u, fr.v);
            place.addBlock(frp.x, fr.h * 0.5, frp.z, fr.w, fr.h, fr.d, mats.ice, false);
        }

        return {
            crystals: crystalCount,
            drifts: drifts.length,
            foothillCrystals: fragments.length,
            foothillDrifts: 0,
            groundSpires: groundSpireCount,
            glacierPatches: glacierPatches.length,
            peakHeight: mountain.peakHeight,
            mountainBaseWidth: mountain.baseWidth,
            mountainBaseDepth: mountain.baseDepth,
            summitWidth: mountain.summitWidth
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.arctic = buildArcticQuadrant;
})();
