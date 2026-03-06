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

    function pt(bounds, u, v) {
        u = Math.max(0, Math.min(1, u));
        v = Math.max(0, Math.min(1, v));
        return {
            x: bounds.minX + (bounds.maxX - bounds.minX) * u,
            z: bounds.minZ + (bounds.maxZ - bounds.minZ) * v
        };
    }

    function buildMountain(cx, cz, place, mats) {
        var tierW = [24, 21, 18, 15.2, 12.6, 10.2, 8.0, 6.2, 4.6];
        var tierH = [2.0, 1.9, 1.8, 1.7, 1.5, 1.35, 1.2, 1.1, 0.9];
        var y = 0;
        for (var t = 0; t < tierW.length; t++) {
            var h = tierH[t];
            var mat = t >= 5 ? mats.snow : (t >= 3 ? mats.frost : mats.rock);
            place.addBlock(cx, y + h * 0.5, cz, tierW[t], h, tierW[t], mat, true);
            y += h * 0.6;
        }

        // Snow ledges
        place.addBlock(cx + 6.5, 5.0, cz - 3.0, 6.0, 1.2, 3.2, mats.snow, true);
        place.addBlock(cx - 6.0, 6.2, cz + 2.5, 5.4, 1.1, 2.8, mats.snow, true);

        // Access ramps
        place.addRamp(cx + 3.0, 2.8, cz + 6.5, 6.0, 1.2, 3.5, mats.rock, Math.PI * 0.5, -0.24, true);
        place.addRamp(cx - 3.2, 3.6, cz - 5.8, 5.4, 1.1, 3.2, mats.snow, Math.PI * 1.12, -0.2, true);

        // Summit
        place.addBlock(cx, y + 0.6, cz, 3.0, 1.8, 3.0, mats.snow, true);
        place.addBlock(cx + 0.3, y + 1.8, cz - 0.2, 1.6, 1.2, 1.6, mats.ice, false);

        // Crevasse on the mountain face (dark recessed slit suggesting depth)
        place.addBlock(cx + 5.0, 2.5, cz + 0.5, 0.3, 2.0, 3.0, mats.crevasse, false);
        place.addBlock(cx - 4.5, 3.5, cz - 1.0, 3.0, 1.5, 0.3, mats.crevasse, false);

        // Frozen waterfall on one face
        var fallGeo = new THREE.PlaneGeometry(2.5, 4.0);
        place.addDecor(cx + 8.0, 3.0, cz, fallGeo, mats.frozenFall, 0, 0, 0);
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
        place.addBlock(x, 1.9, z, 1.8, 0.2, 1.5, mats.snow, false);
    }

    function addFrozenPool(x, z, place, mats) {
        place.addBlock(x, -0.08, z, 5.0, 0.16, 4.0, mats.ice, false);
        // Frost ring around the pool edge
        place.addBlock(x, 0.02, z, 5.6, 0.04, 4.6, mats.frost, false);
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
        place.addBlock(cx, 3.8, cz, 4.0, 0.2, 0.5, mats.frost, false);
    }

    function buildArcticQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var center = pt(bounds, 0.50, 0.50);

        buildMountain(center.x, center.z, place, mats);
        ctx.addExclusion(center.x, center.z, 11.0);

        // Tapered ice spires (upgraded from uniform columns)
        var spires = [
            { u: 0.15, v: 0.20, h: 3.8 },
            { u: 0.85, v: 0.18, h: 3.2 },
            { u: 0.12, v: 0.82, h: 4.0 },
            { u: 0.88, v: 0.80, h: 3.5 },
            { u: 0.30, v: 0.12, h: 2.8 },
            { u: 0.70, v: 0.88, h: 3.0 }
        ];
        for (var i = 0; i < spires.length; i++) {
            var s = spires[i];
            var p = pt(bounds, s.u, s.v);
            addIceSpire(p.x, p.z, s.h, place, mats, ctx);
        }

        // Ice arch (wind-carved bridge between two spires)
        var archPt = pt(bounds, 0.22, 0.65);
        buildIceArch(archPt.x, archPt.z, place, mats, ctx);
        ctx.addExclusion(archPt.x, archPt.z, 3.5);

        // Snow-capped boulders
        var boulders = [
            { u: 0.25, v: 0.35 },
            { u: 0.75, v: 0.65 },
            { u: 0.35, v: 0.78 },
            { u: 0.65, v: 0.22 }
        ];
        for (var b = 0; b < boulders.length; b++) {
            var bp = pt(bounds, boulders[b].u, boulders[b].v);
            addIceBoulder(bp.x, bp.z, place, mats);
        }

        // Frozen pool with frost ring
        var poolPt = pt(bounds, 0.72, 0.72);
        addFrozenPool(poolPt.x, poolPt.z, place, mats);

        // Snow drifts (break up the flat ground)
        var drifts = [
            { u: 0.18, v: 0.45, w: 3.5, d: 2.0 },
            { u: 0.82, v: 0.40, w: 4.0, d: 2.5 },
            { u: 0.40, v: 0.15, w: 3.0, d: 1.8 },
            { u: 0.60, v: 0.85, w: 3.5, d: 2.2 },
            { u: 0.15, v: 0.60, w: 2.5, d: 3.0 },
            { u: 0.85, v: 0.55, w: 2.8, d: 2.0 },
            { u: 0.45, v: 0.90, w: 4.5, d: 2.0 },
            { u: 0.55, v: 0.10, w: 3.0, d: 1.5 }
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

        // Small scattered ice fragments near spires
        var fragments = [
            { u: 0.16, v: 0.22, w: 0.5, h: 0.3, d: 0.4 },
            { u: 0.84, v: 0.17, w: 0.4, h: 0.25, d: 0.35 },
            { u: 0.13, v: 0.84, w: 0.6, h: 0.2, d: 0.45 },
            { u: 0.87, v: 0.78, w: 0.35, h: 0.22, d: 0.3 },
            { u: 0.28, v: 0.14, w: 0.45, h: 0.18, d: 0.35 },
            { u: 0.72, v: 0.86, w: 0.4, h: 0.2, d: 0.3 }
        ];
        for (var fi = 0; fi < fragments.length; fi++) {
            var fr = fragments[fi];
            var frp = pt(bounds, fr.u, fr.v);
            place.addBlock(frp.x, fr.h * 0.5, frp.z, fr.w, fr.h, fr.d, mats.ice, false);
        }

        return {
            crystals: spires.length + 2,
            drifts: drifts.length,
            foothillCrystals: fragments.length,
            foothillDrifts: 0
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.arctic = buildArcticQuadrant;
})();
