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
            { dx: 0.0, dz: 0.0, y: 1.2, w: 26, h: 2.4, d: 22, mat: mats.rock },
            { dx: -1.0, dz: 0.8, y: 2.8, w: 21.5, h: 2.0, d: 18.5, mat: mats.rock },
            { dx: -1.6, dz: 1.5, y: 4.2, w: 18.5, h: 1.8, d: 15.8, mat: mats.frost },
            { dx: -0.8, dz: 2.0, y: 5.4, w: 15.2, h: 1.6, d: 12.8, mat: mats.frost },
            { dx: 0.4, dz: 1.0, y: 6.6, w: 11.8, h: 1.5, d: 10.2, mat: mats.snow },
            { dx: 0.9, dz: 0.4, y: 7.8, w: 8.4, h: 1.3, d: 7.2, mat: mats.snow },
            { dx: 1.1, dz: -0.2, y: 8.8, w: 5.6, h: 1.1, d: 4.9, mat: mats.snow }
        ];
        for (var t = 0; t < tiers.length; t++) {
            var tier = tiers[t];
            place.addBlock(cx + tier.dx, tier.y, cz + tier.dz, tier.w, tier.h, tier.d, tier.mat, true);
        }

        // Broken shelves and overhang-like side masses.
        place.addBlock(cx + 7.2, 4.6, cz - 2.0, 7.4, 1.6, 3.6, mats.snow, true);
        place.addBlock(cx - 7.5, 5.9, cz + 3.0, 6.0, 1.2, 3.2, mats.snow, true);
        place.addBlock(cx + 4.9, 6.8, cz - 4.6, 4.8, 1.0, 2.0, mats.frost, true);
        place.addRamp(cx + 4.4, 3.0, cz + 7.3, 6.6, 1.3, 4.0, mats.rock, Math.PI * 0.56, -0.28, true);
        place.addRamp(cx - 4.8, 4.0, cz - 6.4, 6.0, 1.2, 3.7, mats.snow, Math.PI * 1.08, -0.24, true);

        // Summit and broken icy crown.
        place.addBlock(cx + 1.2, 9.8, cz - 0.2, 3.6, 1.6, 3.2, mats.snow, true);
        place.addBlock(cx + 1.5, 11.0, cz - 0.6, 2.0, 0.9, 1.8, mats.ice, false);
        place.addBlock(cx + 0.1, 10.8, cz + 0.7, 1.2, 0.7, 1.0, mats.frost, false);

        // Crevasse slashes.
        place.addBlock(cx + 5.7, 3.0, cz + 0.8, 0.35, 2.8, 4.0, mats.crevasse, false);
        place.addBlock(cx - 4.8, 4.2, cz - 1.3, 3.6, 1.8, 0.35, mats.crevasse, false);
        place.addBlock(cx + 1.6, 5.6, cz - 4.0, 2.4, 1.2, 0.3, mats.crevasse, false);

        // Frozen waterfall on the taller face.
        var fallGeo = new THREE.PlaneGeometry(3.2, 6.6);
        place.addDecor(cx + 8.6, 4.8, cz + 0.3, fallGeo, mats.frozenFall, 0, 0, 0);
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
    }

    function buildIceShelf(cx, cz, place, mats, ctx) {
        place.addBlock(cx, 0.35, cz, 5.8, 0.7, 3.0, mats.frost, true);
        place.addBlock(cx + 0.4, 0.74, cz - 0.1, 4.6, 0.16, 2.1, mats.ice, false);

        addIceSpire(cx - 1.9, cz + 0.8, 2.8, place, mats, ctx);
        addIceSpire(cx + 2.1, cz - 0.6, 2.4, place, mats, ctx);
        place.addBlock(cx + 2.8, 0.24, cz + 0.9, 0.7, 0.48, 0.6, mats.darkRock, false);
    }

    function buildIceOverhang(cx, cz, place, mats, ctx) {
        addIceSpire(cx - 3.8, cz + 0.4, 5.0, place, mats, ctx);
        addIceSpire(cx + 3.2, cz - 0.3, 4.6, place, mats, ctx);
        place.addBlock(cx - 0.2, 4.4, cz, 8.8, 0.7, 1.3, mats.iceDeep, true);
        place.addBlock(cx + 0.8, 5.0, cz - 0.2, 5.0, 0.4, 1.0, mats.frost, false);
        place.addRamp(cx + 2.0, 2.0, cz + 1.6, 3.0, 0.9, 4.2, mats.frost, 0.92, -0.2, true);
        place.addBlock(cx - 1.8, 0.4, cz - 1.4, 2.6, 0.8, 1.7, mats.darkRock, true);
        place.addBlock(cx + 3.1, 0.28, cz + 1.2, 0.8, 0.56, 0.7, mats.darkRock, false);
    }

    function buildArcticQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var center = pt(bounds, 0.46, 0.46);

        buildMountain(center.x, center.z, place, mats);
        ctx.addExclusion(center.x, center.z, 12.5);

        var overhangPt = pt(bounds, 0.76, 0.28);
        buildIceOverhang(overhangPt.x, overhangPt.z, place, mats, ctx);
        ctx.addExclusion(overhangPt.x, overhangPt.z, 5.2);

        // Grouped ice spires instead of evenly spaced isolated columns.
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

        // Ice arch on the southern side to create a lower secondary landmark.
        var archPt = pt(bounds, 0.34, 0.72);
        buildIceArch(archPt.x, archPt.z, place, mats, ctx);
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
        buildIceShelf(shelfPt.x, shelfPt.z, place, mats, ctx);
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
            { u: 0.68, v: 0.28, w: 0.52, h: 0.24, d: 0.36 }
        ];
        for (var fi = 0; fi < fragments.length; fi++) {
            var fr = fragments[fi];
            var frp = pt(bounds, fr.u, fr.v);
            place.addBlock(frp.x, fr.h * 0.5, frp.z, fr.w, fr.h, fr.d, mats.ice, false);
        }

        return {
            crystals: spires.length + 7,
            drifts: drifts.length,
            foothillCrystals: fragments.length,
            foothillDrifts: 0
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.arctic = buildArcticQuadrant;
})();
