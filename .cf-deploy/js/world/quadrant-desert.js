/**
 * quadrant-desert.js - Desert biome quadrant builder.
 * Plug-and-play: call buildDesertQuadrant(bounds, place, ctx) to populate any quadrant.
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            mesa:        lib.getLambert({ color: 0xb07842 }),
            sandstone:   lib.getLambert({ color: 0xc49a5c }),
            darkRock:    lib.getLambert({ color: 0x8a6b4a }),
            cactus:      lib.getLambert({ color: 0x4f8a3d }),
            cactusDark:  lib.getLambert({ color: 0x3d7030 }),
            cactusSpine: lib.getLambert({ color: 0x8aaa6a }),
            flower:      lib.getLambert({ color: 0xd45a6a }),
            flowerYlw:   lib.getLambert({ color: 0xe8c84a }),
            dryBush:     lib.getLambert({ color: 0x7a8a3d }),
            dryBushDark: lib.getLambert({ color: 0x5a6a2d }),
            bone:        lib.getLambert({ color: 0xe8e0d0 }),
            bleachedWood:lib.getLambert({ color: 0xb0a080 }),
            sandDune:    lib.getLambert({ color: 0xdcc888 }),
            rubble:      lib.getLambert({ color: 0x9a7a50 }),
            tumbleweed:  lib.getLambert({ color: 0xa09060, transparent: true, opacity: 0.85 })
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

    function buildRidge(cx, cz, place, mats) {
        var segs = [
            { dx: -5.5, dz: -1.5, h: 2.6, w: 2.8, d: 2.4 },
            { dx: -2.8, dz: -0.5, h: 3.4, w: 3.0, d: 2.6 },
            { dx:  0.0, dz:  0.3, h: 4.0, w: 3.2, d: 2.8 },
            { dx:  2.8, dz:  1.0, h: 3.2, w: 2.9, d: 2.5 },
            { dx:  5.6, dz:  1.8, h: 2.4, w: 2.6, d: 2.2 }
        ];
        for (var i = 0; i < segs.length; i++) {
            var s = segs[i];
            place.addBlock(cx + s.dx, s.h * 0.5, cz + s.dz, s.w, s.h, s.d, mats.mesa, true);
        }
        // Scattered rubble at the base
        place.addBlock(cx - 6.5, 0.15, cz - 2.2, 0.8, 0.3, 0.6, mats.rubble, false);
        place.addBlock(cx + 6.8, 0.12, cz + 2.5, 0.6, 0.24, 0.5, mats.rubble, false);
        place.addBlock(cx - 3.0, 0.1, cz + 2.0, 0.5, 0.2, 0.4, mats.darkRock, false);
        place.addBlock(cx + 1.5, 0.1, cz - 1.5, 0.7, 0.2, 0.5, mats.darkRock, false);
    }

    function buildArch(cx, cz, place, mats) {
        // Pillars
        place.addBlock(cx - 3.0, 2.0, cz, 1.8, 4.0, 1.8, mats.sandstone, true);
        place.addBlock(cx + 3.0, 2.0, cz, 1.8, 4.0, 1.8, mats.sandstone, true);
        // Span
        place.addBlock(cx, 4.5, cz, 8.0, 1.2, 2.0, mats.sandstone, true);
        // Keystone accent
        place.addBlock(cx, 5.2, cz, 1.4, 0.5, 2.2, mats.darkRock, false);
        // Underside shadow
        place.addBlock(cx, 4.0, cz, 6.4, 0.6, 1.6, mats.darkRock, false);
        // Rubble at pillar bases
        place.addBlock(cx - 3.8, 0.15, cz + 1.2, 0.6, 0.3, 0.5, mats.rubble, false);
        place.addBlock(cx + 3.5, 0.12, cz - 1.0, 0.5, 0.24, 0.6, mats.rubble, false);
        place.addBlock(cx - 2.5, 0.1, cz - 1.3, 0.4, 0.2, 0.3, mats.rubble, false);
    }

    function addCactus(x, z, place, mats, tall, hasFlower) {
        var h = tall ? 3.0 : 2.2;
        // Main trunk (collidable)
        place.addBlock(x, h * 0.5, z, 0.5, h, 0.5, mats.cactus, true);

        if (tall) {
            // Right arm, higher up
            place.addBlock(x + 0.55, h * 0.6, z, 0.38, 0.12, 0.38, mats.cactusDark, false);
            place.addBlock(x + 0.85, h * 0.6, z, 0.12, 0.12, 0.32, mats.cactusDark, false);
            place.addBlock(x + 0.85, h * 0.75, z, 0.32, h * 0.3, 0.32, mats.cactus, false);

            // Left arm, lower
            place.addBlock(x - 0.55, h * 0.38, z, 0.38, 0.12, 0.38, mats.cactusDark, false);
            place.addBlock(x - 0.85, h * 0.38, z, 0.12, 0.12, 0.32, mats.cactusDark, false);
            place.addBlock(x - 0.85, h * 0.52, z, 0.32, h * 0.25, 0.32, mats.cactus, false);
        } else {
            // Single short arm
            place.addBlock(x + 0.5, h * 0.5, z, 0.35, 0.1, 0.3, mats.cactusDark, false);
            place.addBlock(x + 0.75, h * 0.6, z, 0.28, h * 0.22, 0.28, mats.cactus, false);
        }

        // Spine accents (tiny blocks sticking out)
        place.addBlock(x + 0.3, h * 0.85, z, 0.12, 0.06, 0.06, mats.cactusSpine, false);
        place.addBlock(x - 0.3, h * 0.65, z, 0.12, 0.06, 0.06, mats.cactusSpine, false);
        place.addBlock(x, h * 0.45, z + 0.3, 0.06, 0.06, 0.12, mats.cactusSpine, false);

        if (hasFlower) {
            var flMat = (x % 2 > 1) ? mats.flowerYlw : mats.flower;
            place.addBlock(x, h + 0.12, z, 0.2, 0.14, 0.2, flMat, false);
            place.addBlock(x, h + 0.22, z, 0.12, 0.06, 0.12, mats.flowerYlw, false);
        }
    }

    function addDryBush(x, z, place, mats) {
        place.addBlock(x, 0.25, z, 1.2, 0.5, 1.0, mats.dryBush, false);
        place.addBlock(x + 0.3, 0.35, z - 0.2, 0.6, 0.3, 0.5, mats.dryBushDark, false);
    }

    function addSmallMesa(x, z, place, mats) {
        place.addBlock(x, 1.0, z, 3.6, 2.0, 3.2, mats.mesa, true);
        place.addBlock(x, 2.2, z, 4.2, 0.4, 3.8, mats.sandstone, true);
        // Erosion detail
        place.addBlock(x + 1.2, 0.3, z + 1.8, 0.8, 0.6, 0.6, mats.rubble, false);
        place.addBlock(x - 1.5, 0.2, z - 1.6, 0.6, 0.4, 0.5, mats.darkRock, false);
    }

    function addSkull(x, z, place, mats) {
        place.addBlock(x, 0.12, z, 0.35, 0.24, 0.3, mats.bone, false);
        place.addBlock(x, 0.2, z - 0.08, 0.25, 0.18, 0.2, mats.bone, false);
        // Jaw
        place.addBlock(x, 0.04, z + 0.18, 0.22, 0.08, 0.1, mats.bone, false);
    }

    function addBones(x, z, place, mats) {
        place.addBlock(x, 0.04, z, 0.6, 0.06, 0.08, mats.bone, false);
        place.addBlock(x + 0.15, 0.04, z + 0.2, 0.08, 0.06, 0.4, mats.bone, false);
    }

    function addFencePost(x, z, place, mats, broken) {
        var h = broken ? 1.2 : 2.0;
        place.addBlock(x, h * 0.5, z, 0.15, h, 0.15, mats.bleachedWood, false);
        if (!broken) {
            place.addBlock(x, h + 0.05, z, 0.22, 0.1, 0.22, mats.bleachedWood, false);
        }
    }

    function addSandDune(x, z, w, d, place, mats) {
        place.addBlock(x, 0.12, z, w, 0.24, d, mats.sandDune, false);
        place.addBlock(x + w * 0.15, 0.22, z, w * 0.6, 0.12, d * 0.7, mats.sandDune, false);
    }

    function addTumbleweed(x, z, place, mats) {
        var geo = new THREE.SphereGeometry(0.5, 6, 5);
        place.addDecor(x, 0.5, z, geo, mats.tumbleweed);
    }

    function buildDesertQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var center = pt(bounds, 0.48, 0.50);

        buildRidge(center.x, center.z, place, mats);
        ctx.addExclusion(center.x, center.z, 7.0);

        var archPt = pt(bounds, 0.78, 0.28);
        buildArch(archPt.x, archPt.z, place, mats);
        ctx.addExclusion(archPt.x, archPt.z, 5.0);

        var mesaPts = [
            { u: 0.22, v: 0.22 },
            { u: 0.80, v: 0.75 }
        ];
        for (var m = 0; m < mesaPts.length; m++) {
            var mp = pt(bounds, mesaPts[m].u, mesaPts[m].v);
            addSmallMesa(mp.x, mp.z, place, mats);
            ctx.addExclusion(mp.x, mp.z, 3.0);
        }

        // Cacti with character -- arms, spines, flowers
        var cacti = [
            { u: 0.18, v: 0.50, tall: true,  flower: true },
            { u: 0.72, v: 0.26, tall: false, flower: false },
            { u: 0.15, v: 0.78, tall: true,  flower: false },
            { u: 0.82, v: 0.54, tall: false, flower: true },
            { u: 0.55, v: 0.15, tall: true,  flower: false },
            { u: 0.40, v: 0.85, tall: false, flower: false },
            { u: 0.90, v: 0.88, tall: true,  flower: true },
            { u: 0.35, v: 0.65, tall: false, flower: true },
            { u: 0.65, v: 0.42, tall: true,  flower: false }
        ];
        for (var c = 0; c < cacti.length; c++) {
            var cp = pt(bounds, cacti[c].u, cacti[c].v);
            addCactus(cp.x, cp.z, place, mats, cacti[c].tall, cacti[c].flower);
        }

        // Dry bushes with more variety
        var bushes = [
            { u: 0.30, v: 0.40 },
            { u: 0.60, v: 0.70 },
            { u: 0.45, v: 0.30 },
            { u: 0.70, v: 0.50 },
            { u: 0.25, v: 0.60 },
            { u: 0.85, v: 0.35 }
        ];
        for (var b = 0; b < bushes.length; b++) {
            var bp = pt(bounds, bushes[b].u, bushes[b].v);
            addDryBush(bp.x, bp.z, place, mats);
        }

        // Skull and bones (narrative detail)
        var skullPt = pt(bounds, 0.60, 0.58);
        addSkull(skullPt.x, skullPt.z, place, mats);
        var bonesPt = pt(bounds, 0.62, 0.60);
        addBones(bonesPt.x, bonesPt.z, place, mats);

        var bones2 = pt(bounds, 0.30, 0.18);
        addBones(bones2.x, bones2.z, place, mats);

        // Broken fence posts (abandoned outpost feel)
        var fp1 = pt(bounds, 0.12, 0.40);
        addFencePost(fp1.x, fp1.z, place, mats, false);
        var fp2 = pt(bounds, 0.12, 0.45);
        addFencePost(fp2.x, fp2.z, place, mats, true);
        var fp3 = pt(bounds, 0.12, 0.50);
        addFencePost(fp3.x, fp3.z, place, mats, false);
        // Crossbar between standing posts
        place.addBlock(fp1.x, 1.3, (fp1.z + fp3.z) * 0.5, 0.08, 0.08, fp3.z - fp1.z + 0.2, mats.bleachedWood, false);
        // Fallen crossbar on the ground
        place.addBlock(fp2.x + 0.4, 0.06, fp2.z, 0.08, 0.08, 2.0, mats.bleachedWood, false);

        // Sand dunes (break up the flat ground)
        var dune1 = pt(bounds, 0.50, 0.90);
        addSandDune(dune1.x, dune1.z, 6.0, 3.5, place, mats);
        var dune2 = pt(bounds, 0.88, 0.45);
        addSandDune(dune2.x, dune2.z, 4.0, 5.0, place, mats);
        var dune3 = pt(bounds, 0.15, 0.15);
        addSandDune(dune3.x, dune3.z, 3.5, 2.5, place, mats);

        // Tumbleweeds
        var tw1 = pt(bounds, 0.42, 0.20);
        addTumbleweed(tw1.x, tw1.z, place, mats);
        var tw2 = pt(bounds, 0.75, 0.65);
        addTumbleweed(tw2.x, tw2.z, place, mats);
        var tw3 = pt(bounds, 0.20, 0.88);
        addTumbleweed(tw3.x, tw3.z, place, mats);

        // Scattered ground rocks near features
        var rocks = [
            { u: 0.50, v: 0.42, w: 0.5, h: 0.3, d: 0.4 },
            { u: 0.46, v: 0.56, w: 0.4, h: 0.2, d: 0.35 },
            { u: 0.76, v: 0.30, w: 0.6, h: 0.25, d: 0.5 },
            { u: 0.24, v: 0.24, w: 0.35, h: 0.18, d: 0.3 },
            { u: 0.78, v: 0.78, w: 0.45, h: 0.22, d: 0.4 },
            { u: 0.55, v: 0.72, w: 0.3, h: 0.15, d: 0.25 }
        ];
        for (var ri = 0; ri < rocks.length; ri++) {
            var rk = rocks[ri];
            var rkp = pt(bounds, rk.u, rk.v);
            place.addBlock(rkp.x, rk.h * 0.5, rkp.z, rk.w, rk.h, rk.d, mats.darkRock, false);
        }

        return {
            rocks: rocks.length,
            cacti: cacti.length,
            ridges: 1,
            mesas: mesaPts.length
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.desert = buildDesertQuadrant;
})();
