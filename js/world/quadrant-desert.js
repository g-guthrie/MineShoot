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
        place.addBlock(cx, 3.56, cz, 6.0, 0.28, 1.4, mats.darkRock, false);
        // Rubble at pillar bases
        place.addBlock(cx - 3.8, 0.15, cz + 1.2, 0.6, 0.3, 0.5, mats.rubble, false);
        place.addBlock(cx + 3.5, 0.12, cz - 1.0, 0.5, 0.24, 0.6, mats.rubble, false);
        place.addBlock(cx - 2.5, 0.1, cz - 1.3, 0.4, 0.2, 0.3, mats.rubble, false);

        return {
            peakHeight: 5.45,
            spanWidth: 8.0
        };
    }

    function buildGrandSpanArch(cx, cz, place, mats) {
        // Mid-scale hero arch that seeds a center fight without competing with the corner mesa.
        place.addBlock(cx - 4.2, 3.3, cz + 0.1, 2.4, 6.6, 2.8, mats.darkRock, true);
        place.addBlock(cx + 4.0, 3.0, cz - 0.2, 2.2, 6.0, 2.6, mats.mesa, true);
        place.addBlock(cx, 7.1, cz, 11.8, 1.4, 3.0, mats.sandstone, true);
        place.addBlock(cx - 0.4, 8.2, cz - 0.1, 7.2, 0.56, 2.1, mats.mesa, true);
        place.addBlock(cx + 0.6, 8.8, cz + 0.2, 3.8, 0.42, 1.4, mats.sandstone, false);
        place.addBlock(cx - 0.3, 5.92, cz, 7.8, 0.24, 1.8, mats.darkRock, false);
        place.addBlock(cx - 1.4, 7.9, cz - 1.2, 2.8, 0.36, 1.1, mats.sandstone, false);
        place.addBlock(cx + 2.1, 8.4, cz + 1.1, 2.1, 0.3, 0.9, mats.darkRock, false);
        place.addBlock(cx - 5.1, 1.2, cz + 1.0, 2.0, 2.4, 1.7, mats.darkRock, true);
        place.addBlock(cx + 5.0, 1.1, cz - 0.9, 1.8, 2.2, 1.6, mats.mesa, true);
        place.addBlock(cx - 3.3, 4.8, cz + 0.9, 1.5, 0.58, 2.1, mats.sandstone, true);
        place.addBlock(cx + 3.0, 5.8, cz + 1.2, 0.9, 0.32, 0.8, mats.sandstone, false);
        place.addBlock(cx - 4.0, 5.4, cz - 1.1, 1.1, 0.28, 0.7, mats.darkRock, false);
        place.addRamp(cx + 3.4, 3.1, cz - 1.2, 2.8, 0.9, 4.6, mats.darkRock, Math.PI * 0.5, -0.18, true);
        place.addRamp(cx - 5.6, 1.0, cz + 2.0, 3.2, 0.8, 4.4, mats.mesa, 1.02, -0.16, true);
        addRubbleCluster(cx - 5.6, cz + 2.6, 0.95, place, mats);
        addRubbleCluster(cx + 4.8, cz - 2.0, 0.88, place, mats);
        addRubbleCluster(cx + 0.4, cz + 3.0, 0.92, place, mats);

        return {
            peakHeight: 9.01,
            spanWidth: 11.8,
            clearWidth: 5.9
        };
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

    function addRubbleCluster(x, z, scale, place, mats) {
        var s = Math.max(0.7, scale || 1.0);
        place.addBlock(x, 0.35 * s, z, 2.4 * s, 0.7 * s, 1.9 * s, mats.rubble, true);
        place.addBlock(x - 0.8 * s, 0.62 * s, z + 0.35 * s, 1.1 * s, 0.55 * s, 0.95 * s, mats.darkRock, true);
        place.addBlock(x + 0.7 * s, 0.42 * s, z - 0.4 * s, 0.9 * s, 0.38 * s, 0.8 * s, mats.mesa, false);
    }

    function addGapFiller(x, z, h, w, d, place, mats, cap) {
        var height = Math.max(3.0, h || 4.0);
        var width = Math.max(0.28, w || 0.42);
        var depth = Math.max(1.2, d || 2.0);
        place.addBlock(x, height * 0.5, z, width, height, depth, mats.darkRock, true);
        if (cap) {
            place.addBlock(x - 0.08, height + 0.14, z, width * 1.6, 0.28, depth * 0.66, mats.sandstone, false);
        }
    }

    function buildMesaGapFillers(bounds, place, mats) {
        var fillers = [
            { x: bounds.maxX - 5.1, z: bounds.minZ + 4.8, h: 8.8, w: 0.48, d: 5.6, cap: false },
            { x: bounds.maxX - 7.4, z: bounds.minZ + 7.4, h: 12.6, w: 0.62, d: 4.2, cap: true },
            { x: bounds.maxX - 9.1, z: bounds.minZ + 10.6, h: 6.4, w: 0.38, d: 3.4, cap: false },
            { x: bounds.maxX - 11.6, z: bounds.minZ + 5.2, h: 14.2, w: 0.55, d: 4.8, cap: true },
            { x: bounds.maxX - 12.8, z: bounds.minZ + 9.6, h: 7.2, w: 0.34, d: 2.8, cap: false },
            { x: bounds.maxX - 4.2, z: bounds.minZ + 12.4, h: 10.4, w: 0.52, d: 4.0, cap: true },
            { x: bounds.maxX - 6.4, z: bounds.minZ + 15.0, h: 5.4, w: 0.32, d: 2.4, cap: false }
        ];
        for (var i = 0; i < fillers.length; i++) {
            var f = fillers[i];
            addGapFiller(f.x, f.z, f.h, f.w, f.d, place, mats, f.cap);
        }
    }

    function buildInteriorRockOutcrop(cx, cz, place, mats) {
        place.addBlock(cx, 1.2, cz, 7.8, 2.4, 5.6, mats.darkRock, true);
        place.addBlock(cx - 1.2, 2.5, cz - 0.4, 4.8, 1.2, 3.8, mats.mesa, true);
        place.addBlock(cx + 1.8, 3.0, cz + 0.6, 2.6, 1.8, 2.2, mats.darkRock, true);
        place.addBlock(cx - 2.0, 3.35, cz - 0.2, 1.6, 0.5, 1.4, mats.sandstone, true);
        addCactus(cx + 1.8, cz + 0.6, place, mats, false, false);
        addRubbleCluster(cx - 3.8, cz + 1.8, 0.9, place, mats);
    }

    function buildCornerMesaCrown(bounds, place, mats) {
        var mainBaseW = 8.8;
        var mainBaseD = 9.8;
        var mainBase = {
            x: bounds.maxX - (mainBaseW * 0.5),
            z: bounds.minZ + (mainBaseD * 0.5)
        };
        place.addBlock(mainBase.x, 3.6, mainBase.z, mainBaseW, 7.2, mainBaseD, mats.darkRock, true);

        var northSpineW = 4.9;
        var northSpineD = 6.6;
        var northSpine = {
            x: bounds.maxX - 8.6 - (northSpineW * 0.5),
            z: bounds.minZ + (northSpineD * 0.5)
        };
        place.addBlock(northSpine.x, 7.0, northSpine.z, northSpineW, 14.0, northSpineD, mats.mesa, true);
        place.addBlock(northSpine.x - 0.8, 14.2, northSpine.z + 0.5, 3.2, 4.4, 3.6, mats.sandstone, true);

        var eastSpireW = 4.6;
        var eastSpireD = 4.8;
        var eastSpire = {
            x: bounds.maxX - (eastSpireW * 0.5),
            z: bounds.minZ + 7.8 + (eastSpireD * 0.5)
        };
        place.addBlock(eastSpire.x, 8.8, eastSpire.z, eastSpireW, 17.6, eastSpireD, mats.mesa, true);
        place.addBlock(eastSpire.x - 0.1, 17.1, eastSpire.z - 0.4, 2.4, 3.0, 2.6, mats.darkRock, true);
        place.addBlock(eastSpire.x - 0.5, 21.0, eastSpire.z - 0.4, 1.5, 1.2, 1.8, mats.sandstone, false);

        var saddleW = 6.0;
        var saddleD = 4.4;
        var saddle = {
            x: bounds.maxX - 4.6 - (saddleW * 0.5),
            z: bounds.minZ + 6.4 + (saddleD * 0.5)
        };
        place.addBlock(saddle.x, 4.9, saddle.z, saddleW, 9.8, saddleD, mats.mesa, true);

        var brokenNeedleW = 2.8;
        var brokenNeedleD = 3.6;
        var brokenNeedle = {
            x: bounds.maxX - 12.6 - (brokenNeedleW * 0.5),
            z: bounds.minZ + 1.8 + (brokenNeedleD * 0.5)
        };
        place.addBlock(brokenNeedle.x, 6.6, brokenNeedle.z, brokenNeedleW, 13.2, brokenNeedleD, mats.darkRock, true);
        place.addBlock(brokenNeedle.x + 0.2, 12.9, brokenNeedle.z + 0.2, 1.5, 1.4, 1.8, mats.sandstone, false);

        // Playable shelves exist only on the inner faces.
        place.addBlock(bounds.maxX - 8.6, 6.8, bounds.minZ + 10.8, 3.8, 0.8, 3.2, mats.sandstone, true);
        place.addBlock(bounds.maxX - 12.2, 10.4, bounds.minZ + 9.6, 3.0, 0.7, 2.4, mats.sandstone, true);
        place.addRamp(bounds.maxX - 11.8, 2.0, bounds.minZ + 12.4, 4.0, 1.2, 6.4, mats.darkRock, 1.02, -0.18, true);
        place.addRamp(bounds.maxX - 9.2, 4.5, bounds.minZ + 12.6, 2.8, 1.0, 4.2, mats.mesa, 0.88, -0.16, true);

        // Inner buttresses and toe rubble create the readable transition into the biome.
        place.addRamp(bounds.maxX - 4.8, 2.0, bounds.minZ + 14.6, 5.8, 1.3, 4.8, mats.darkRock, Math.PI, -0.18, true);
        place.addRamp(bounds.maxX - 9.8, 1.8, bounds.minZ + 14.2, 4.6, 1.0, 4.0, mats.mesa, Math.PI * 1.04, -0.18, true);
        addRubbleCluster(bounds.maxX - 13.6, bounds.minZ + 15.6, 0.98, place, mats);
        addRubbleCluster(bounds.maxX - 9.6, bounds.minZ + 16.4, 0.82, place, mats);
        addRubbleCluster(bounds.maxX - 5.0, bounds.minZ + 15.8, 0.84, place, mats);

        // Fracture lines and cutouts to stop the silhouette from reading as one monolith.
        place.addBlock(bounds.maxX - 4.8, 9.0, bounds.minZ + 4.6, 0.45, 6.6, 6.2, mats.darkRock, false);
        place.addBlock(bounds.maxX - 8.8, 6.4, bounds.minZ + 9.4, 3.0, 0.9, 0.42, mats.darkRock, false);
        place.addBlock(bounds.maxX - 12.0, 6.0, bounds.minZ + 4.0, 0.4, 3.8, 3.2, mats.darkRock, false);

        buildMesaGapFillers(bounds, place, mats);
    }

    function buildEastShelfBand(bounds, place, mats) {
        var segments = [
            { v: 0.30, w: 4.8, h: 15.0, d: 5.0, shelfY: 6.2, cut: 1.8 },
            { v: 0.46, w: 5.6, h: 18.0, d: 5.8, shelfY: 7.8, cut: 1.6 },
            { v: 0.64, w: 4.6, h: 11.0, d: 5.0, shelfY: 5.8, cut: 2.1 },
            { v: 0.82, w: 3.8, h: 8.4, d: 4.2, shelfY: 4.2, cut: 1.4 }
        ];
        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            var z = pt(bounds, 0.0, seg.v).z;
            var x = bounds.maxX - (seg.w * 0.5);
            place.addBlock(x, seg.h * 0.5, z, seg.w, seg.h, seg.d, mats.mesa, true);
            place.addBlock(bounds.maxX - (seg.cut * 0.5), seg.h * 0.52, z - (seg.d * 0.18), seg.cut, seg.h * 0.54, seg.d * 0.7, mats.darkRock, false);
            place.addBlock(bounds.maxX - 4.0, seg.shelfY, z + 0.2, 3.4, 0.7, 2.6, mats.sandstone, true);
            place.addRamp(bounds.maxX - 5.6, 1.6 + (i * 0.35), z + 0.9, 3.2, 1.0, 4.2, mats.darkRock, Math.PI * 0.5, -0.18, true);
            place.addBlock(bounds.maxX - 1.8, seg.h + 0.18, z, 1.9, 0.36, seg.d * 0.74, mats.sandstone, true);
            if (i < 3) addGapFiller(bounds.maxX - 3.0, z - 1.0, 5.0 + (i * 2.0), 0.34, 2.2 + i, place, mats, i % 2 === 0);
        }
    }

    function buildNorthCrumbleBand(bounds, place, mats) {
        var segments = [
            { u: 0.20, w: 5.2, h: 10.5, d: 5.8 },
            { u: 0.34, w: 4.2, h: 13.0, d: 4.4 },
            { u: 0.50, w: 6.0, h: 16.0, d: 5.2 },
            { u: 0.66, w: 4.8, h: 11.6, d: 4.6 },
            { u: 0.78, w: 5.6, h: 9.4, d: 4.0 }
        ];
        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            var x = pt(bounds, seg.u, 0.0).x;
            var z = bounds.minZ + (seg.d * 0.5);
            place.addBlock(x, seg.h * 0.5, z, seg.w, seg.h, seg.d, mats.mesa, true);
            place.addBlock(x + 0.2, seg.h + 0.16, z, seg.w * 0.68, 0.32, seg.d * 0.72, mats.sandstone, true);
            place.addBlock(x - (seg.w * 0.16), seg.h * 0.56, z + (seg.d * 0.12), 0.45, seg.h * 0.46, seg.d * 0.84, mats.darkRock, false);
        }

        // Break the wall with a readable ruined notch instead of a clean continuous line.
        var notch = pt(bounds, 0.36, 0.24);
        buildArch(notch.x, notch.z, place, mats);
        addRubbleCluster(notch.x - 3.2, notch.z + 2.3, 0.85, place, mats);
        addRubbleCluster(notch.x + 3.0, notch.z + 1.8, 0.75, place, mats);
    }

    function buildDesertQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var wallBounds = (ctx && ctx.rawBounds) ? ctx.rawBounds : bounds;
        var centerHero = pt(bounds, 0.52, 0.54);
        buildCornerMesaCrown(wallBounds, place, mats);
        ctx.addExclusion(wallBounds.maxX - 7.4, wallBounds.minZ + 8.8, 12.0);

        buildEastShelfBand(wallBounds, place, mats);
        ctx.addExclusion(wallBounds.maxX - 4.6, pt(wallBounds, 0.0, 0.30).z, 4.8);
        ctx.addExclusion(wallBounds.maxX - 4.8, pt(wallBounds, 0.0, 0.46).z, 5.2);
        ctx.addExclusion(wallBounds.maxX - 4.4, pt(wallBounds, 0.0, 0.64).z, 4.2);

        buildNorthCrumbleBand(wallBounds, place, mats);
        ctx.addExclusion(pt(wallBounds, 0.54, 0.0).x, wallBounds.minZ + 2.8, 5.2);

        var fossilPt = pt(bounds, 0.18, 0.72);
        buildFossilRibs(fossilPt.x, fossilPt.z, place, mats);

        var shelfA = pt(bounds, 0.66, 0.58);
        buildRockShelf(shelfA.x, shelfA.z, 0.84, place, mats);
        ctx.addExclusion(shelfA.x, shelfA.z, 4.0);

        var shelfB = pt(bounds, 0.30, 0.42);
        buildRockShelf(shelfB.x, shelfB.z, -0.88, place, mats);
        ctx.addExclusion(shelfB.x, shelfB.z, 3.8);

        var centerArchStats = buildGrandSpanArch(centerHero.x, centerHero.z, place, mats);
        ctx.addExclusion(centerHero.x, centerHero.z, 6.1);

        var centerButte = pt(bounds, 0.42, 0.56);
        buildButte(centerButte.x, centerButte.z, place, mats);
        ctx.addExclusion(centerButte.x, centerButte.z, 3.8);

        var centerFence = pt(bounds, 0.64, 0.50);
        buildFenceRuins(centerFence.x, centerFence.z, place, mats);

        place.addBlock(centerHero.x - 0.3, 0.46, centerHero.z + 3.6, 6.2, 0.92, 1.7, mats.rubble, true);
        place.addBlock(centerHero.x + 0.6, 0.92, centerHero.z + 3.8, 3.8, 0.24, 1.1, mats.darkRock, false);
        place.addBlock(centerHero.x + 0.4, 0.7, centerHero.z - 3.2, 5.4, 1.4, 1.9, mats.mesa, true);
        place.addBlock(centerHero.x + 1.1, 1.48, centerHero.z - 3.4, 3.1, 0.42, 1.2, mats.sandstone, false);

        var westArch = pt(bounds, 0.12, 0.52);
        var westArchStats = buildArch(westArch.x, westArch.z, place, mats);
        ctx.addExclusion(westArch.x, westArch.z, 4.8);

        var southOutcrop = pt(bounds, 0.56, 0.88);
        buildInteriorRockOutcrop(southOutcrop.x, southOutcrop.z, place, mats);
        ctx.addExclusion(southOutcrop.x, southOutcrop.z, 5.2);

        // Cacti with character -- arms, spines, flowers
        var cacti = [
            { u: 0.18, v: 0.46, tall: true,  flower: true },
            { u: 0.20, v: 0.86, tall: true,  flower: false },
            { u: 0.34, v: 0.66, tall: false, flower: true },
            { u: 0.46, v: 0.78, tall: true,  flower: false },
            { u: 0.58, v: 0.70, tall: false, flower: false },
            { u: 0.76, v: 0.46, tall: true,  flower: false },
            { u: 0.78, v: 0.64, tall: false, flower: true },
            { u: 0.84, v: 0.86, tall: true,  flower: true }
        ];
        for (var c = 0; c < cacti.length; c++) {
            var cp = pt(bounds, cacti[c].u, cacti[c].v);
            addCactus(cp.x, cp.z, place, mats, cacti[c].tall, cacti[c].flower);
        }

        // Dry bushes with more variety
        var bushes = [
            { u: 0.34, v: 0.60 },
            { u: 0.58, v: 0.62 },
            { u: 0.74, v: 0.56 }
        ];
        for (var b = 0; b < bushes.length; b++) {
            var bp = pt(bounds, bushes[b].u, bushes[b].v);
            addDryBush(bp.x, bp.z, place, mats);
        }

        // Skull and bones (narrative detail)
        var skullPt = pt(bounds, 0.72, 0.62);
        addSkull(skullPt.x, skullPt.z, place, mats);
        var bonesPt = pt(bounds, 0.78, 0.66);
        addBones(bonesPt.x, bonesPt.z, place, mats);

        var bones2 = pt(bounds, 0.24, 0.24);
        addBones(bones2.x, bones2.z, place, mats);

        // Sand dune berms and shelves break the flat firing lines.
        var dune1 = pt(bounds, 0.40, 0.90);
        addSandDune(dune1.x, dune1.z, 5.8, 3.2, place, mats);
        var dune2 = pt(bounds, 0.16, 0.16);
        addSandDune(dune2.x, dune2.z, 4.2, 2.6, place, mats);
        var dune3 = pt(bounds, 0.40, 0.22);
        addSandDune(dune3.x, dune3.z, 4.2, 2.2, place, mats);

        // Tumbleweeds
        var tw1 = pt(bounds, 0.32, 0.18);
        addTumbleweed(tw1.x, tw1.z, place, mats);
        var tw2 = pt(bounds, 0.24, 0.86);
        addTumbleweed(tw2.x, tw2.z, place, mats);

        // Scattered ground rocks near features
        var rocks = [
            { u: 0.26, v: 0.26, w: 0.42, h: 0.2, d: 0.34 },
            { u: 0.46, v: 0.48, w: 0.6, h: 0.34, d: 0.44 },
            { u: 0.62, v: 0.58, w: 0.44, h: 0.24, d: 0.38 },
            { u: 0.72, v: 0.34, w: 0.7, h: 0.3, d: 0.55 },
            { u: 0.20, v: 0.70, w: 0.38, h: 0.2, d: 0.32 }
        ];
        for (var ri = 0; ri < rocks.length; ri++) {
            var rk = rocks[ri];
            var rkp = pt(bounds, rk.u, rk.v);
            place.addBlock(rkp.x, rk.h * 0.5, rkp.z, rk.w, rk.h, rk.d, mats.darkRock, false);
        }

        return {
            rocks: rocks.length,
            cacti: cacti.length,
            cover: 2,
            cliffs: 3,
            mesas: 5,
            centerHeroArchX: centerHero.x,
            centerHeroArchZ: centerHero.z,
            centerHeroArchHeight: centerArchStats.peakHeight,
            centerHeroArchSpan: centerArchStats.spanWidth,
            centerHeroArchClearWidth: centerArchStats.clearWidth,
            centerSupportCount: 4,
            westArchPeakHeight: westArchStats.peakHeight,
            westArchSpan: westArchStats.spanWidth
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.desert = buildDesertQuadrant;
})();
