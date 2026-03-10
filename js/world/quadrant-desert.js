import { pointInBounds as pt } from './biome-utils.js';

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

    function buildRidge(cx, cz, place, mats) {
        var segs = [
            { dx: -7.2, dz: -2.4, h: 2.6, w: 3.0, d: 2.8 },
            { dx: -4.1, dz: -1.1, h: 4.0, w: 3.4, d: 3.0 },
            { dx: -0.8, dz:  0.2, h: 5.2, w: 3.8, d: 3.2 },
            { dx:  2.6, dz:  1.4, h: 4.4, w: 3.3, d: 2.9 },
            { dx:  5.8, dz:  2.7, h: 3.0, w: 2.9, d: 2.5 }
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

    function buildButte(cx, cz, place, mats) {
        var tiers = [
            { y: 1.4, w: 6.8, h: 2.8, d: 6.0, mat: mats.mesa },
            { y: 3.2, w: 5.0, h: 1.8, d: 4.6, mat: mats.mesa },
            { y: 4.35, w: 3.2, h: 0.9, d: 3.0, mat: mats.sandstone }
        ];
        for (var i = 0; i < tiers.length; i++) {
            var tier = tiers[i];
            place.addBlock(cx, tier.y, cz, tier.w, tier.h, tier.d, tier.mat, true);
        }
        place.addBlock(cx - 2.4, 0.42, cz + 2.0, 1.4, 0.84, 1.0, mats.rubble, true);
        place.addBlock(cx + 2.0, 0.35, cz - 2.2, 1.2, 0.7, 0.9, mats.darkRock, true);
        place.addRamp(cx + 3.1, 1.0, cz + 1.4, 1.0, 0.8, 2.6, mats.mesa, 0.85, -0.1, true);
    }

    function buildGateRuins(cx, cz, place, mats) {
        place.addBlock(cx - 3.2, 2.8, cz, 1.5, 5.6, 1.6, mats.sandstone, true);
        place.addBlock(cx + 3.0, 2.5, cz + 0.3, 1.4, 5.0, 1.5, mats.sandstone, true);
        place.addBlock(cx, 5.4, cz + 0.2, 8.4, 1.1, 1.7, mats.sandstone, true);
        place.addBlock(cx + 0.5, 6.15, cz + 0.2, 1.3, 0.42, 1.1, mats.darkRock, false);
        place.addBlock(cx - 4.0, 0.22, cz + 1.4, 0.9, 0.44, 0.8, mats.rubble, false);
        place.addBlock(cx + 3.8, 0.18, cz - 1.2, 0.8, 0.36, 0.7, mats.rubble, false);
        place.addRamp(cx - 1.8, 0.22, cz - 1.7, 0.8, 0.24, 2.4, mats.bleachedWood, 0.9, -0.15, false);
        place.addRamp(cx + 1.4, 0.18, cz + 1.9, 0.6, 0.18, 2.0, mats.bleachedWood, -0.55, -0.12, false);
    }

    function buildFossilRibs(cx, cz, place, mats) {
        var ribs = [
            { dx: -2.8, dz: -1.2, h: 2.4, tilt: 0.42, len: 2.8 },
            { dx: -1.2, dz: -0.5, h: 3.0, tilt: 0.52, len: 3.2 },
            { dx:  0.6, dz:  0.0, h: 3.4, tilt: 0.56, len: 3.4 },
            { dx:  2.0, dz:  0.7, h: 2.8, tilt: 0.45, len: 3.0 }
        ];
        for (var i = 0; i < ribs.length; i++) {
            var rib = ribs[i];
            place.addRamp(cx + rib.dx, rib.h * 0.5, cz + rib.dz, 0.28, rib.h, rib.len, mats.bone, 0.28, rib.tilt, false);
        }
        place.addBlock(cx - 3.8, 0.12, cz - 1.8, 0.8, 0.24, 0.6, mats.bone, false);
        place.addBlock(cx + 3.0, 0.10, cz + 1.6, 0.7, 0.2, 0.5, mats.bone, false);
        place.addBlock(cx, 0.18, cz + 0.6, 4.6, 0.22, 0.9, mats.bone, false);
    }

    function buildRockShelf(cx, cz, rotY, place, mats) {
        place.addRamp(cx, 0.9, cz, 3.8, 1.1, 5.6, mats.darkRock, rotY, -0.18, true);
        place.addBlock(cx - Math.sin(rotY) * 1.6, 1.45, cz - Math.cos(rotY) * 1.6, 2.2, 0.7, 2.0, mats.mesa, true);
        place.addBlock(cx + Math.sin(rotY) * 1.4, 0.28, cz + Math.cos(rotY) * 1.2, 0.9, 0.4, 0.7, mats.rubble, false);
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
        place.addBlock(x + 0.3, 0.39, z - 0.2, 0.6, 0.3, 0.5, mats.dryBushDark, false);
    }

    function addSmallMesa(x, z, place, mats) {
        place.addBlock(x, 1.0, z, 3.6, 2.0, 3.2, mats.mesa, true);
        place.addBlock(x, 2.24, z, 4.2, 0.4, 3.8, mats.sandstone, true);
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

    function addFencePost(x, z, place, mats, height, leanYaw, leanTilt, brokenTop) {
        var h = height || 2.0;
        var postYaw = leanYaw || 0;
        var postTilt = leanTilt || 0;
        if (postTilt) {
            place.addRamp(x, h * 0.5, z, 0.18, h, 0.18, mats.bleachedWood, postYaw, postTilt, false);
        } else {
            place.addBlock(x, h * 0.5, z, 0.18, h, 0.18, mats.bleachedWood, false);
        }
        if (brokenTop) {
            place.addRamp(x, h - 0.05, z, 0.28, 0.08, 0.16, mats.bleachedWood, postYaw + 0.45, 0.28, false);
            return;
        }
        place.addBlock(x, h + 0.05, z, 0.24, 0.1, 0.24, mats.bleachedWood, false);
    }

    function addFenceRail(x1, z1, x2, z2, y, thickness, place, mats) {
        var dx = x2 - x1;
        var dz = z2 - z1;
        var len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.1) return;
        place.addRamp(
            (x1 + x2) * 0.5,
            y,
            (z1 + z2) * 0.5,
            thickness,
            thickness,
            len + 0.18,
            mats.bleachedWood,
            Math.atan2(dx, dz),
            0,
            false
        );
    }

    function buildFenceRuins(x, z, place, mats) {
        var postA = { x: x - 0.95, z: z - 1.25, h: 2.3 };
        var postB = { x: x - 0.95, z: z + 1.05, h: 1.9 };
        var postC = { x: x + 0.9, z: z - 0.45, h: 1.65, yaw: 1.2, tilt: -0.24 };

        addFencePost(postA.x, postA.z, place, mats, postA.h, 0, 0, false);
        addFencePost(postB.x, postB.z, place, mats, postB.h, 0, 0, true);
        addFencePost(postC.x, postC.z, place, mats, postC.h, postC.yaw, postC.tilt, true);

        addFenceRail(postA.x, postA.z, postB.x, postB.z, 1.5, 0.1, place, mats);
        addFenceRail(postA.x, postA.z, postB.x, postB.z, 0.9, 0.08, place, mats);
        addFenceRail(postA.x, postA.z, x + 0.3, z - 0.8, 1.3, 0.08, place, mats);

        // Collapsed slats and debris so the silhouette reads as a ruined corral.
        addFenceRail(x - 0.15, z + 0.6, x + 1.15, z + 0.05, 0.08, 0.08, place, mats);
        place.addRamp(x + 0.55, 0.22, z - 0.1, 0.14, 0.14, 1.35, mats.bleachedWood, 0.95, -0.18, false);
        place.addBlock(x - 0.9, 0.14, z + 1.35, 0.55, 0.16, 0.35, mats.darkRock, false);
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
        var center = pt(bounds, 0.44, 0.56);

        buildRidge(center.x, center.z, place, mats);
        ctx.addExclusion(center.x - 0.8, center.z + 0.3, 8.4);

        var archPt = pt(bounds, 0.76, 0.24);
        buildGateRuins(archPt.x, archPt.z, place, mats);
        ctx.addExclusion(archPt.x, archPt.z, 6.0);

        var mesaPts = [
            { u: 0.20, v: 0.22, butte: true },
            { u: 0.78, v: 0.74, butte: false },
            { u: 0.54, v: 0.84, butte: false }
        ];
        for (var m = 0; m < mesaPts.length; m++) {
            var mp = pt(bounds, mesaPts[m].u, mesaPts[m].v);
            if (mesaPts[m].butte) {
                buildButte(mp.x, mp.z, place, mats);
                ctx.addExclusion(mp.x, mp.z, 4.8);
            } else {
                addSmallMesa(mp.x, mp.z, place, mats);
                ctx.addExclusion(mp.x, mp.z, 3.2);
            }
        }

        var fossilPt = pt(bounds, 0.20, 0.70);
        buildFossilRibs(fossilPt.x, fossilPt.z, place, mats);

        var shelfA = pt(bounds, 0.64, 0.44);
        buildRockShelf(shelfA.x, shelfA.z, 1.02, place, mats);
        ctx.addExclusion(shelfA.x, shelfA.z, 4.0);

        var shelfB = pt(bounds, 0.30, 0.36);
        buildRockShelf(shelfB.x, shelfB.z, -0.72, place, mats);
        ctx.addExclusion(shelfB.x, shelfB.z, 3.6);

        // Cacti with character -- arms, spines, flowers
        var cacti = [
            { u: 0.12, v: 0.50, tall: true,  flower: true },
            { u: 0.72, v: 0.18, tall: false, flower: false },
            { u: 0.14, v: 0.84, tall: true,  flower: false },
            { u: 0.86, v: 0.52, tall: false, flower: true },
            { u: 0.56, v: 0.12, tall: true,  flower: false },
            { u: 0.42, v: 0.88, tall: false, flower: false },
            { u: 0.90, v: 0.82, tall: true,  flower: true },
            { u: 0.36, v: 0.68, tall: false, flower: true },
            { u: 0.68, v: 0.40, tall: true,  flower: false },
            { u: 0.30, v: 0.54, tall: true, flower: false },
            { u: 0.58, v: 0.64, tall: false, flower: true }
        ];
        for (var c = 0; c < cacti.length; c++) {
            var cp = pt(bounds, cacti[c].u, cacti[c].v);
            addCactus(cp.x, cp.z, place, mats, cacti[c].tall, cacti[c].flower);
        }

        // Dry bushes with more variety
        var bushes = [
            { u: 0.30, v: 0.42 },
            { u: 0.60, v: 0.72 },
            { u: 0.46, v: 0.28 },
            { u: 0.72, v: 0.54 },
            { u: 0.24, v: 0.62 },
            { u: 0.85, v: 0.36 },
            { u: 0.18, v: 0.28 },
            { u: 0.54, v: 0.52 }
        ];
        for (var b = 0; b < bushes.length; b++) {
            var bp = pt(bounds, bushes[b].u, bushes[b].v);
            addDryBush(bp.x, bp.z, place, mats);
        }

        // Skull and bones (narrative detail)
        var skullPt = pt(bounds, 0.64, 0.60);
        addSkull(skullPt.x, skullPt.z, place, mats);
        var bonesPt = pt(bounds, 0.67, 0.62);
        addBones(bonesPt.x, bonesPt.z, place, mats);

        var bones2 = pt(bounds, 0.28, 0.20);
        addBones(bones2.x, bones2.z, place, mats);

        // Ruined fence/corral fragment instead of the old floating slats.
        var fencePt = pt(bounds, 0.10, 0.44);
        buildFenceRuins(fencePt.x, fencePt.z, place, mats);

        // Sand dune berms and shelves break the flat firing lines.
        var dune1 = pt(bounds, 0.52, 0.90);
        addSandDune(dune1.x, dune1.z, 7.2, 3.8, place, mats);
        var dune2 = pt(bounds, 0.88, 0.48);
        addSandDune(dune2.x, dune2.z, 4.6, 5.8, place, mats);
        var dune3 = pt(bounds, 0.14, 0.14);
        addSandDune(dune3.x, dune3.z, 4.2, 2.8, place, mats);
        var dune4 = pt(bounds, 0.44, 0.24);
        addSandDune(dune4.x, dune4.z, 5.4, 2.6, place, mats);
        var dune5 = pt(bounds, 0.72, 0.62);
        addSandDune(dune5.x, dune5.z, 3.8, 2.2, place, mats);

        // Tumbleweeds
        var tw1 = pt(bounds, 0.42, 0.20);
        addTumbleweed(tw1.x, tw1.z, place, mats);
        var tw2 = pt(bounds, 0.75, 0.65);
        addTumbleweed(tw2.x, tw2.z, place, mats);
        var tw3 = pt(bounds, 0.20, 0.88);
        addTumbleweed(tw3.x, tw3.z, place, mats);

        // Scattered ground rocks near features
        var rocks = [
            { u: 0.52, v: 0.42, w: 0.6, h: 0.34, d: 0.44 },
            { u: 0.46, v: 0.58, w: 0.44, h: 0.24, d: 0.38 },
            { u: 0.76, v: 0.30, w: 0.7, h: 0.3, d: 0.55 },
            { u: 0.24, v: 0.24, w: 0.42, h: 0.2, d: 0.34 },
            { u: 0.78, v: 0.78, w: 0.5, h: 0.25, d: 0.45 },
            { u: 0.55, v: 0.72, w: 0.36, h: 0.18, d: 0.28 },
            { u: 0.20, v: 0.68, w: 0.38, h: 0.2, d: 0.32 },
            { u: 0.66, v: 0.54, w: 0.34, h: 0.18, d: 0.3 }
        ];
        for (var ri = 0; ri < rocks.length; ri++) {
            var rk = rocks[ri];
            var rkp = pt(bounds, rk.u, rk.v);
            place.addBlock(rkp.x, rk.h * 0.5, rkp.z, rk.w, rk.h, rk.d, mats.darkRock, false);
        }

        return {
            rocks: rocks.length,
            cacti: cacti.length,
            ridges: 3,
            mesas: mesaPts.length + 2
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.desert = buildDesertQuadrant;
})();
