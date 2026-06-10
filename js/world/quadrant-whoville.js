import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-whoville.js — Whoville Christmas Village Biome
 *
 * A whimsical Dr. Seuss-inspired Christmas village with curvy,
 * cartoon-style buildings, candy-cane lamp posts, a town square
 * with a giant Christmas tree, and Mount Crumpit towering in
 * one corner with its signature curved peak.
 *
 * Uses addDecor() for cylinder/sphere primitives, addBlock() for boxes.
 * All box positions are center-based.
 */
(function () {
    'use strict';

    var MATS = null;
    var CYLINDER_SEGMENTS = 12;
    var THREE = globalThis.THREE;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            // Snow & ground
            snow:          lib.getLambert({ color: 0xf0f5ff }),
            snowShadow:    lib.getLambert({ color: 0xc8d8ee }),
            ice:           lib.getLambert({ color: 0xd0eeff, transparent: true, opacity: 0.7 }),
            cobble:        lib.getLambert({ color: 0x9090a0 }),
            cobbleDark:    lib.getLambert({ color: 0x707080 }),
            // Buildings — whimsical pastels
            wallPink:      lib.getLambert({ color: 0xe88ba8 }),
            wallYellow:    lib.getLambert({ color: 0xf5d86e }),
            wallBlue:      lib.getLambert({ color: 0x7bb8d4 }),
            wallGreen:     lib.getLambert({ color: 0x7cc88a }),
            wallLavender:  lib.getLambert({ color: 0xb89cd8 }),
            wallOrange:    lib.getLambert({ color: 0xf0a050 }),
            wallPeach:     lib.getLambert({ color: 0xf5c0a0 }),
            // Roofs
            roofRed:       lib.getLambert({ color: 0xcc3333 }),
            roofPurple:    lib.getLambert({ color: 0x8844aa }),
            roofGreen:     lib.getLambert({ color: 0x448844 }),
            roofBlue:      lib.getLambert({ color: 0x4466aa }),
            roofOrange:    lib.getLambert({ color: 0xcc6622 }),
            // Christmas details
            candyRed:      lib.getLambert({ color: 0xdd2222 }),
            candyWhite:    lib.getLambert({ color: 0xffffff }),
            ornamentGold:  lib.getLambert({ color: 0xffd700, emissive: 0x886600, emissiveIntensity: 0.3 }),
            ornamentRed:   lib.getLambert({ color: 0xee1111, emissive: 0x661100, emissiveIntensity: 0.2 }),
            ornamentBlue:  lib.getLambert({ color: 0x2255ee, emissive: 0x112266, emissiveIntensity: 0.2 }),
            starGold:      lib.getLambert({ color: 0xffdd00, emissive: 0xffaa00, emissiveIntensity: 0.8 }),
            lightWarm:     lib.getLambert({ color: 0xffee88, emissive: 0xffcc44, emissiveIntensity: 0.6 }),
            lightRed:      lib.getLambert({ color: 0xff4444, emissive: 0xff2222, emissiveIntensity: 0.5 }),
            lightGreen:    lib.getLambert({ color: 0x44ff44, emissive: 0x22cc22, emissiveIntensity: 0.5 }),
            lightBlue:     lib.getLambert({ color: 0x4488ff, emissive: 0x2244cc, emissiveIntensity: 0.5 }),
            treeDarkGreen: lib.getLambert({ color: 0x1a5c2a }),
            treeGreen:     lib.getLambert({ color: 0x2a7a3a }),
            treeTrunk:     lib.getLambert({ color: 0x6a4a2a }),
            // Mount Crumpit
            rockGrey:      lib.getLambert({ color: 0x5a6a5a }),
            rockDark:      lib.getLambert({ color: 0x3a4a3a }),
            rockLight:     lib.getLambert({ color: 0x7a8a7a }),
            snowCap:       lib.getLambert({ color: 0xe8f0ff }),
            caveDark:      lib.getLambert({ color: 0x2a2a2a }),
            // Doors & windows
            doorBrown:     lib.getLambert({ color: 0x8a5a3a }),
            windowPale:    lib.getLambert({ color: 0xfff8cc, emissive: 0xffee66, emissiveIntensity: 0.4 }),
            // Wreath & garland
            wreathGreen:   lib.getLambert({ color: 0x2a6a2a }),
            ribbon:        lib.getLambert({ color: 0xcc2222 }),
            // Chimney
            brick:         lib.getLambert({ color: 0x994433 }),
            brickDark:     lib.getLambert({ color: 0x773322 })
        };
        return MATS;
    }

    /* ── shorthand helpers ── */
    function tb(place, role, meta, x, y, z, w, h, d, material, isSolid) {
        var mesh = place.addBlock(x, y, z, w, h, d, material, isSolid);
        if (mesh) {
            mesh.userData = mesh.userData || {};
            mesh.userData.role = role;
            if (meta) { for (var k in meta) { mesh.userData[k] = meta[k]; } }
        }
        return mesh;
    }

    function td(place, role, meta, x, y, z, geometry, material, rotY, rotX, rotZ) {
        var mesh = place.addDecor(x, y, z, geometry, material, rotY || 0, rotX || 0, rotZ || 0);
        if (mesh) {
            mesh.userData = mesh.userData || {};
            mesh.userData.role = role;
            if (meta) { for (var k in meta) { mesh.userData[k] = meta[k]; } }
        }
        return mesh;
    }

    /* ══════════════════════════════════════════════════════ */
    /* ── ASSET BUILDERS                                   ── */
    /* ══════════════════════════════════════════════════════ */

    /* ── Mount Crumpit ── */
    function buildMountCrumpit(ox, oz, place, mats) {
        var mx = ox + 20;
        var mz = oz - 18;

        // Wide base (irregular, built from overlapping blocks).
        // Interleaved boxes use slightly different heights / inset faces so
        // no two coplanar same-facing faces overlap (z-fight prevention),
        // and everything stays clamped to the desert seam at x = maxX.
        tb(place, 'crumpit', { part: 'base-1' }, mx, 1.5, mz, 14, 3, 14, mats.rockDark, true);
        tb(place, 'crumpit', { part: 'base-2' }, mx + 0.95, 1.54, mz - 1, 11.9, 3.08, 10, mats.rockGrey, true);
        tb(place, 'crumpit', { part: 'base-3' }, mx - 3, 1, mz + 3, 8, 2, 8, mats.rockDark, true);
        tb(place, 'crumpit', { part: 'base-4' }, mx + 4, 1, mz - 4, 5.9, 2, 5.9, mats.rockGrey, true);

        // Snow on base edges (inset from the rock faces so nothing sits flush)
        tb(place, 'crumpit', { part: 'snow-base-1' }, mx - 5, 0.15, mz + 4.95, 6, 0.3, 4, mats.snow, false);
        tb(place, 'crumpit', { part: 'snow-base-2' }, mx + 4.8, 0.15, mz - 5, 3.8, 0.3, 5, mats.snow, false);

        // Tier 2
        tb(place, 'crumpit', { part: 'tier2-1' }, mx, 4.5, mz, 10, 3, 10, mats.rockGrey, true);
        tb(place, 'crumpit', { part: 'tier2-2' }, mx + 1, 4.5, mz - 1, 7.9, 3.1, 7.9, mats.rockDark, true);

        // Tier 3
        tb(place, 'crumpit', { part: 'tier3-1' }, mx, 7.5, mz, 7, 3, 7, mats.rockDark, true);
        tb(place, 'crumpit', { part: 'tier3-2' }, mx + 1, 7.5, mz, 4.9, 3.1, 6, mats.rockGrey, true);

        // Tier 4 — getting narrow
        tb(place, 'crumpit', { part: 'tier4' }, mx, 10.5, mz, 5, 3, 5, mats.rockGrey, true);

        // Tier 5 — upper spire
        tb(place, 'crumpit', { part: 'tier5' }, mx, 13, mz, 3.5, 2, 3.5, mats.rockDark, true);

        // Tier 6 — narrow peak
        tb(place, 'crumpit', { part: 'tier6' }, mx, 15, mz, 2.5, 2, 2.5, mats.rockGrey, true);

        // Curved top — the signature Seuss curl (built from tilted blocks)
        tb(place, 'crumpit', { part: 'curl-1' }, mx, 16.5, mz, 2, 1.5, 2, mats.rockLight, true);
        tb(place, 'crumpit', { part: 'curl-2' }, mx - 0.5, 17.5, mz + 0.3, 1.8, 1.2, 1.8, mats.rockGrey, true);
        tb(place, 'crumpit', { part: 'curl-3' }, mx - 1.2, 18.3, mz + 0.8, 1.5, 1, 1.5, mats.rockLight, true);
        tb(place, 'crumpit', { part: 'curl-4' }, mx - 2, 18.8, mz + 1.5, 1.2, 0.8, 1.2, mats.rockGrey, true);
        tb(place, 'crumpit', { part: 'curl-5' }, mx - 2.8, 19, mz + 2.2, 1, 0.7, 1, mats.rockLight, true);
        tb(place, 'crumpit', { part: 'curl-6' }, mx - 3.4, 18.8, mz + 2.8, 0.8, 0.6, 0.8, mats.rockGrey, true);
        tb(place, 'crumpit', { part: 'curl-7' }, mx - 3.8, 18.4, mz + 3.2, 0.6, 0.5, 0.6, mats.rockDark, true);

        // Snow cap on the curl
        tb(place, 'crumpit', { part: 'snow-curl-1' }, mx, 17.3, mz, 2.2, 0.15, 2.2, mats.snowCap, false);
        tb(place, 'crumpit', { part: 'snow-curl-2' }, mx - 1.2, 18.85, mz + 0.8, 1.7, 0.15, 1.7, mats.snowCap, false);
        tb(place, 'crumpit', { part: 'snow-curl-3' }, mx - 2.8, 19.35, mz + 2.2, 1.2, 0.1, 1.2, mats.snowCap, false);

        // Snow streaks on mountain sides
        tb(place, 'crumpit', { part: 'snow-side-1' }, mx - 3, 8.05, mz, 0.3, 3.9, 3, mats.snowCap, false);
        tb(place, 'crumpit', { part: 'snow-side-2' }, mx + 2, 11, mz - 1, 0.3, 3, 2, mats.snowCap, false);
        tb(place, 'crumpit', { part: 'snow-side-3' }, mx, 6, mz + 4, 3, 0.3, 0.3, mats.snowCap, false);

        // Grinch's cave entrance (dark opening near the top)
        tb(place, 'crumpit', { part: 'cave' }, mx + 2.5, 12.5, mz + 0.5, 1.5, 2, 0.3, mats.caveDark, false);
        tb(place, 'crumpit', { part: 'cave-frame-top' }, mx + 2.5, 13.7, mz + 0.6, 1.8, 0.3, 0.3, mats.rockDark, false);

        // Craggy outcrops
        tb(place, 'crumpit', { part: 'outcrop-1' }, mx - 5, 2, mz + 2, 3, 4, 2, mats.rockDark, true);
        tb(place, 'crumpit', { part: 'outcrop-2' }, mx + 5, 1.58, mz - 3, 2, 3.16, 3, mats.rockGrey, true);
        tb(place, 'crumpit', { part: 'outcrop-3' }, mx + 3, 2.5, mz + 5, 3, 2, 2, mats.rockDark, true);
    }

    /* ── Whimsical Who-Building ── */
    function buildWhoHouse(x, z, place, mats, style) {
        // Each house is slightly different — Dr. Seuss style
        var wallMats = [mats.wallPink, mats.wallYellow, mats.wallBlue,
                        mats.wallGreen, mats.wallLavender, mats.wallOrange, mats.wallPeach];
        var roofMats = [mats.roofRed, mats.roofPurple, mats.roofGreen, mats.roofBlue, mats.roofOrange];

        var wallMat = wallMats[style % wallMats.length];
        var roofMat = roofMats[style % roofMats.length];

        var baseW = 2.5 + (style % 3) * 0.5;
        var baseH = 3 + (style % 4) * 0.8;
        var baseD = 2.5 + ((style + 1) % 3) * 0.4;

        // Main body — slightly wobbly (offset tiers)
        var wobX = (style % 2 === 0) ? 0.2 : -0.2;
        var wobZ = (style % 3 === 0) ? 0.15 : -0.15;
        tb(place, 'house', { part: 'body', style: style }, x, baseH / 2, z, baseW, baseH, baseD, wallMat, true);

        // Upper section (narrower, offset for wobbly look)
        var upperH = 1.5 + (style % 3) * 0.5;
        tb(place, 'house', { part: 'upper', style: style },
            x + wobX, baseH + upperH / 2, z + wobZ,
            baseW * 0.75, upperH, baseD * 0.75, wallMat, true);

        // Roof — oversized and droopy
        var roofW = baseW * 1.1;
        var roofD = baseD * 1.1;
        var roofY = baseH + upperH;
        tb(place, 'house', { part: 'roof', style: style },
            x + wobX, roofY + 0.5, z + wobZ,
            roofW, 1, roofD, roofMat, false);
        // Pointy roof cap
        tb(place, 'house', { part: 'roof-cap', style: style },
            x + wobX * 1.5, roofY + 1.2, z + wobZ * 1.5,
            roofW * 0.5, 0.8, roofD * 0.5, roofMat, false);
        // Tippy top
        tb(place, 'house', { part: 'roof-tip', style: style },
            x + wobX * 2, roofY + 1.8, z + wobZ * 2,
            0.4, 0.6, 0.4, roofMat, false);

        // Door
        tb(place, 'house', { part: 'door', style: style },
            x, 0.9, z + baseD / 2 + 0.06, 0.8, 1.6, 0.1, mats.doorBrown, false);

        // Lit windows (warm glow)
        tb(place, 'house', { part: 'window-1', style: style },
            x - baseW / 2 - 0.06, baseH / 2 + 0.5, z, 0.1, 0.7, 0.7, mats.windowPale, false);
        tb(place, 'house', { part: 'window-2', style: style },
            x + baseW / 2 + 0.06, baseH / 2 + 0.5, z, 0.1, 0.7, 0.7, mats.windowPale, false);

        // Wreath above door
        tb(place, 'house', { part: 'wreath', style: style },
            x, 2.2, z + baseD / 2 + 0.1, 0.6, 0.6, 0.1, mats.wreathGreen, false);
        tb(place, 'house', { part: 'wreath-bow', style: style },
            x, 1.95, z + baseD / 2 + 0.12, 0.25, 0.2, 0.08, mats.ribbon, false);

        // Chimney
        var chimSide = (style % 2 === 0) ? -1 : 1;
        tb(place, 'house', { part: 'chimney', style: style },
            x + chimSide * (baseW * 0.3), roofY + 1.6, z,
            0.6, 1.8, 0.6, mats.brick, false);

        // Snow on roof
        tb(place, 'house', { part: 'snow-roof', style: style },
            x + wobX, roofY + 1.05, z + wobZ,
            roofW + 0.1, 0.15, roofD + 0.1, mats.snow, false);
    }

    /* ── Giant Christmas Tree (town center) ── */
    function buildChristmasTree(ox, oz, place, mats) {
        var tx = ox;
        var tz = oz + 4;

        // Trunk
        tb(place, 'xmas-tree', { part: 'trunk' }, tx, 1.2, tz, 1, 2.4, 1, mats.treeTrunk, true);

        // Tree tiers (widest at bottom, narrowing)
        tb(place, 'xmas-tree', { part: 'tier-1' }, tx, 3.5, tz, 6, 2.5, 6, mats.treeDarkGreen, true);
        tb(place, 'xmas-tree', { part: 'tier-2' }, tx, 5.5, tz, 5, 2, 5, mats.treeGreen, true);
        tb(place, 'xmas-tree', { part: 'tier-3' }, tx, 7.2, tz, 4, 1.8, 4, mats.treeDarkGreen, true);
        tb(place, 'xmas-tree', { part: 'tier-4' }, tx, 8.7, tz, 3, 1.5, 3, mats.treeGreen, true);
        tb(place, 'xmas-tree', { part: 'tier-5' }, tx, 9.9, tz, 2, 1.2, 2, mats.treeDarkGreen, true);
        tb(place, 'xmas-tree', { part: 'tip' }, tx, 10.9, tz, 1, 1, 1, mats.treeGreen, true);

        // Star on top
        tb(place, 'xmas-tree', { part: 'star' }, tx, 11.8, tz, 0.8, 0.8, 0.8, mats.starGold, false);

        // Ornaments scattered on tree faces
        var ornMats = [mats.ornamentGold, mats.ornamentRed, mats.ornamentBlue];
        var ornPos = [
            // tier 1
            [-2.5, 3.5, 0.06], [2.5, 3, 0.06], [0.06, 4, -2.5], [0.06, 3.2, 2.5],
            // tier 2
            [-2, 5.5, 0.06], [2, 5.8, 0.06], [0.06, 5.2, -2],
            // tier 3
            [-1.5, 7.5, 0.06], [1.5, 7, 0.06], [0.06, 7.3, 1.5],
            // tier 4
            [-1, 9, 0.06], [1, 8.5, 0.06]
        ];
        for (var oi = 0; oi < ornPos.length; oi++) {
            var op = ornPos[oi];
            var isOnX = Math.abs(op[0]) > 0.1;
            var ow = isOnX ? 0.12 : 0.4;
            var od = isOnX ? 0.4 : 0.12;
            tb(place, 'xmas-tree', { part: 'ornament-' + oi },
                tx + op[0] * (isOnX ? 1.02 : 1), op[1], tz + op[2] * (!isOnX ? 1.02 : 1),
                ow, 0.4, od, ornMats[oi % 3], false);
        }

        // Snow dusting on tree tiers
        tb(place, 'xmas-tree', { part: 'snow-1' }, tx, 4.8, tz, 6.1, 0.1, 6.1, mats.snow, false);
        tb(place, 'xmas-tree', { part: 'snow-2' }, tx, 6.55, tz, 5.1, 0.1, 5.1, mats.snow, false);
        tb(place, 'xmas-tree', { part: 'snow-3' }, tx, 8.15, tz, 4.1, 0.1, 4.1, mats.snow, false);
    }

    /* ── Candy Cane Lamp Post ── */
    function buildCandyCaneLamp(x, z, place, mats) {
        // Alternating red/white stripes
        for (var si = 0; si < 5; si++) {
            var stripeMat = (si % 2 === 0) ? mats.candyWhite : mats.candyRed;
            tb(place, 'lamp', { part: 'stripe-' + si },
                x, 0.4 + si * 0.8, z, 0.3, 0.8, 0.3, stripeMat, false);
        }
        // Curved top (hook shape)
        tb(place, 'lamp', { part: 'hook-1' }, x, 4.4, z, 0.3, 0.4, 0.3, mats.candyRed, false);
        tb(place, 'lamp', { part: 'hook-2' }, x - 0.3, 4.6, z, 0.3, 0.3, 0.3, mats.candyWhite, false);
        tb(place, 'lamp', { part: 'hook-3' }, x - 0.6, 4.5, z, 0.3, 0.3, 0.3, mats.candyRed, false);

        // Lantern hanging from hook
        tb(place, 'lamp', { part: 'lantern' }, x - 0.6, 4, z, 0.5, 0.5, 0.5, mats.lightWarm, false);
    }

    /* ── Snow-covered Small Tree ── */
    function buildSmallTree(x, z, place, mats, size) {
        var s = size || 1;
        tb(place, 'tree', { part: 'trunk' }, x, 0.4 * s, z, 0.3 * s, 0.8 * s, 0.3 * s, mats.treeTrunk, false);
        tb(place, 'tree', { part: 'foliage-1' }, x, 1.2 * s, z, 2 * s, 1 * s, 2 * s, mats.treeDarkGreen, false);
        tb(place, 'tree', { part: 'foliage-2' }, x, 2 * s, z, 1.4 * s, 0.8 * s, 1.4 * s, mats.treeGreen, false);
        tb(place, 'tree', { part: 'foliage-3' }, x, 2.6 * s, z, 0.8 * s, 0.6 * s, 0.8 * s, mats.treeDarkGreen, false);
        // Snow on top
        tb(place, 'tree', { part: 'snow' }, x, 3 * s, z, 1 * s, 0.12, 1 * s, mats.snow, false);
    }

    /* ── Present / Gift Box ── */
    function buildPresent(x, z, place, mats, colorIdx) {
        var colors = [mats.candyRed, mats.wallBlue, mats.wallGreen, mats.wallYellow, mats.wallLavender];
        var ribbons = [mats.ornamentGold, mats.candyWhite, mats.ribbon, mats.ornamentGold];
        var col = colors[colorIdx % colors.length];
        var rib = ribbons[colorIdx % ribbons.length];
        var s = 0.4 + (colorIdx % 3) * 0.15;

        tb(place, 'present', { part: 'box' }, x, s / 2, z, s, s, s, col, false);
        // Ribbon cross
        tb(place, 'present', { part: 'ribbon-x' }, x, s / 2, z, s + 0.02, 0.08, 0.12, rib, false);
        tb(place, 'present', { part: 'ribbon-z' }, x, s / 2, z, 0.12, 0.08, s + 0.02, rib, false);
        // Bow on top
        tb(place, 'present', { part: 'bow' }, x, s + 0.1, z, 0.25, 0.15, 0.25, rib, false);
    }

    /* ── Snowman ── */
    function buildSnowman(x, z, place, mats) {
        // Three tiers
        tb(place, 'snowman', { part: 'base' }, x, 0.6, z, 1.2, 1.2, 1.2, mats.snow, false);
        tb(place, 'snowman', { part: 'torso' }, x, 1.5, z, 0.9, 0.9, 0.9, mats.snow, false);
        tb(place, 'snowman', { part: 'head' }, x, 2.2, z, 0.6, 0.6, 0.6, mats.snow, false);
        // Carrot nose
        tb(place, 'snowman', { part: 'nose' }, x, 2.2, z + 0.35, 0.1, 0.1, 0.3, mats.wallOrange, false);
        // Scarf
        tb(place, 'snowman', { part: 'scarf' }, x, 1.9, z, 0.7, 0.15, 0.7, mats.candyRed, false);
        // Top hat
        tb(place, 'snowman', { part: 'hat-brim' }, x, 2.55, z, 0.7, 0.08, 0.7, mats.caveDark, false);
        tb(place, 'snowman', { part: 'hat-top' }, x, 2.85, z, 0.45, 0.5, 0.45, mats.caveDark, false);
        // Eyes
        tb(place, 'snowman', { part: 'eye-l' }, x - 0.12, 2.3, z + 0.31, 0.08, 0.08, 0.05, mats.caveDark, false);
        tb(place, 'snowman', { part: 'eye-r' }, x + 0.12, 2.3, z + 0.31, 0.08, 0.08, 0.05, mats.caveDark, false);
        // Stick arms
        tb(place, 'snowman', { part: 'arm-l' }, x - 0.8, 1.5, z, 0.8, 0.08, 0.08, mats.treeTrunk, false);
        tb(place, 'snowman', { part: 'arm-r' }, x + 0.8, 1.5, z, 0.8, 0.08, 0.08, mats.treeTrunk, false);
    }

    /* ── Town Square Gazebo ── */
    function buildGazebo(x, z, place, mats) {
        // Platform
        tb(place, 'gazebo', { part: 'platform' }, x, 0.2, z, 5, 0.4, 5, mats.cobble, true);
        // Posts (4 corners)
        var offsets = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
        for (var pi = 0; pi < offsets.length; pi++) {
            tb(place, 'gazebo', { part: 'post-' + pi },
                x + offsets[pi][0], 2, z + offsets[pi][1],
                0.3, 3.6, 0.3, mats.candyWhite, false);
        }
        // Roof
        tb(place, 'gazebo', { part: 'roof' }, x, 4, z, 5.5, 0.4, 5.5, mats.roofRed, false);
        tb(place, 'gazebo', { part: 'roof-cap' }, x, 4.6, z, 3, 0.5, 3, mats.roofRed, false);
        tb(place, 'gazebo', { part: 'roof-tip' }, x, 5.1, z, 1, 0.4, 1, mats.roofRed, false);
        // Snow on roof
        tb(place, 'gazebo', { part: 'snow-roof' }, x, 4.45, z, 5.6, 0.1, 5.6, mats.snow, false);
        // Garland along edges
        tb(place, 'gazebo', { part: 'garland-n' }, x, 3.6, z - 2.5, 4.5, 0.2, 0.15, mats.wreathGreen, false);
        tb(place, 'gazebo', { part: 'garland-s' }, x, 3.6, z + 2.5, 4.5, 0.2, 0.15, mats.wreathGreen, false);
    }

    /* ── Cobblestone Path ── */
    function buildPath(x1, z1, x2, z2, place, mats) {
        var dx = x2 - x1;
        var dz = z2 - z1;
        var len = Math.sqrt(dx * dx + dz * dz);
        var cx = (x1 + x2) / 2;
        var cz = (z1 + z2) / 2;

        // Edge strips are 0.06 shorter per end than the cobble slab so their
        // end faces never sit coplanar with the slab ends (z-fight prevention).
        var edgeLen = len - 0.12;
        if (Math.abs(dx) > Math.abs(dz)) {
            // Horizontal path
            tb(place, 'path', { part: 'cobble' }, cx, 0.06, cz, len, 0.08, 2, mats.cobble, false);
            tb(place, 'path', { part: 'edge-1' }, cx, 0.06, cz - 1, edgeLen, 0.06, 0.3, mats.cobbleDark, false);
            tb(place, 'path', { part: 'edge-2' }, cx, 0.06, cz + 1, edgeLen, 0.06, 0.3, mats.cobbleDark, false);
        } else {
            // Vertical path
            tb(place, 'path', { part: 'cobble' }, cx, 0.06, cz, 2, 0.08, len, mats.cobble, false);
            tb(place, 'path', { part: 'edge-1' }, cx - 1, 0.06, cz, 0.3, 0.06, edgeLen, mats.cobbleDark, false);
            tb(place, 'path', { part: 'edge-2' }, cx + 1, 0.06, cz, 0.3, 0.06, edgeLen, mats.cobbleDark, false);
        }
    }

    /* ── Snow Drifts ── */
    function buildSnowDrift(x, z, place, mats, w, d) {
        tb(place, 'drift', { part: 'base' }, x, 0.2, z, w, 0.4, d, mats.snow, false);
        tb(place, 'drift', { part: 'top' }, x + 0.2, 0.45, z, w * 0.6, 0.2, d * 0.7, mats.snow, false);
    }

    /* ── Swirly Snow Patch (thin overlapping decals, staggered tops) ── */
    function buildSnowSwirl(x, z, place, mats) {
        // Staggered top heights (0.06 / 0.08 / 0.10) and offset footprints so
        // overlapping decals never share a coplanar face. Bottoms stay >= 0.01.
        tb(place, 'swirl', { part: 'base' }, x, 0.035, z, 2.6, 0.05, 2, mats.snowShadow, false);
        tb(place, 'swirl', { part: 'mid' }, x + 0.5, 0.05, z + 0.3, 1.8, 0.06, 1.3, mats.snow, false);
        tb(place, 'swirl', { part: 'curl' }, x - 0.45, 0.065, z - 0.45, 1.1, 0.07, 0.9, mats.snowShadow, false);
    }

    /* ══════════════════════════════════════════════════════ */
    /* ── MAIN BUILDER                                     ── */
    /* ══════════════════════════════════════════════════════ */

    function buildWhovilleQuadrant(bounds, realPlace, ctx) {
        var mats = ensureMats();
        var ox = (bounds.minX + bounds.maxX) / 2;
        var oz = (bounds.minZ + bounds.maxZ) / 2;

        // Authored orientation keeps Mount Crumpit in the north-east corner:
        // north outer wall plus east/desert side in the current grid.
        var place = realPlace;

        /* ── Mount Crumpit — NE corner ── */
        buildMountCrumpit(ox, oz, place, mats);

        /* ── Town Square with gazebo and giant tree — center-south ── */
        buildGazebo(ox - 2, oz + 6, place, mats);
        buildChristmasTree(ox - 10, oz + 6, place, mats);

        /* ── Who houses — scattered around the village ── */
        // West side row
        buildWhoHouse(ox - 18, oz + 14, place, mats, 0);
        buildWhoHouse(ox - 18, oz + 8, place, mats, 1);
        buildWhoHouse(ox - 18, oz + 2, place, mats, 2);
        buildWhoHouse(ox - 18, oz - 4, place, mats, 3);

        // South row
        buildWhoHouse(ox - 12, oz + 18, place, mats, 4);
        buildWhoHouse(ox - 6, oz + 18, place, mats, 5);
        buildWhoHouse(ox + 2, oz + 18, place, mats, 6);

        // East side (near mountain)
        buildWhoHouse(ox + 8, oz + 14, place, mats, 2);
        buildWhoHouse(ox + 8, oz + 8, place, mats, 0);
        buildWhoHouse(ox + 14, oz + 12, place, mats, 5);

        // North side
        buildWhoHouse(ox - 14, oz - 10, place, mats, 1);
        buildWhoHouse(ox - 8, oz - 14, place, mats, 3);
        buildWhoHouse(ox + 2, oz - 10, place, mats, 6);

        // South-east corner (sparse spot below the mountain)
        buildWhoHouse(ox + 21, oz + 18, place, mats, 4);

        /* ── Candy cane lamp posts along paths ── */
        buildCandyCaneLamp(ox - 14, oz + 6, place, mats);
        buildCandyCaneLamp(ox - 6, oz + 6, place, mats);
        buildCandyCaneLamp(ox + 4, oz + 6, place, mats);
        buildCandyCaneLamp(ox - 2, oz + 14, place, mats);
        buildCandyCaneLamp(ox - 2, oz - 2, place, mats);
        buildCandyCaneLamp(ox + 10, oz + 2, place, mats);
        buildCandyCaneLamp(ox + 14, oz + 6, place, mats);
        buildCandyCaneLamp(ox - 2, oz + 18, place, mats);

        /* ── Cobblestone paths connecting everything ── */
        // Main east-west path through village
        buildPath(ox - 22, oz + 6, ox + 6, oz + 6, place, mats);
        // North-south path
        buildPath(ox - 2, oz - 6, ox - 2, oz + 20, place, mats);
        // Path toward mountain
        buildPath(ox + 6, oz + 6, ox + 16, oz + 6, place, mats);

        /* ── Small trees scattered around ── */
        buildSmallTree(ox - 22, oz - 6, place, mats, 1.2);
        buildSmallTree(ox - 24, oz + 2, place, mats, 0.8);
        buildSmallTree(ox + 14, oz + 2, place, mats, 1);
        buildSmallTree(ox + 6, oz - 6, place, mats, 1.1);
        buildSmallTree(ox - 10, oz - 16, place, mats, 1.3);
        buildSmallTree(ox - 22, oz - 14, place, mats, 0.9);
        buildSmallTree(ox + 4, oz + 22, place, mats, 1);
        buildSmallTree(ox - 14, oz + 22, place, mats, 0.7);

        /* ── Snowmen ── */
        buildSnowman(ox - 6, oz + 12, place, mats);
        buildSnowman(ox + 4, oz + 16, place, mats);

        /* ── Presents around the big tree ── */
        buildPresent(ox - 12, oz + 8, place, mats, 0);
        buildPresent(ox - 9, oz + 8.5, place, mats, 1);
        buildPresent(ox - 11.5, oz + 4.5, place, mats, 2);
        buildPresent(ox - 8.5, oz + 4, place, mats, 3);
        buildPresent(ox - 10.5, oz + 3.5, place, mats, 4);
        buildPresent(ox - 9.5, oz + 7, place, mats, 5);

        /* ── Snow drifts for terrain variation ── */
        buildSnowDrift(ox - 24, oz + 18, place, mats, 5, 3);
        buildSnowDrift(ox + 18, oz + 22, place, mats, 4, 3);
        buildSnowDrift(ox - 20, oz - 18, place, mats, 6, 4);
        buildSnowDrift(ox + 12, oz - 8, place, mats, 3, 5);
        buildSnowDrift(ox - 6, oz - 20, place, mats, 8, 3);

        /* ── Swirly snow patches (thin staggered decals) ── */
        buildSnowSwirl(ox - 24, oz + 10, place, mats);
        buildSnowSwirl(ox + 9, oz - 2, place, mats);
        buildSnowSwirl(ox - 14, oz - 2, place, mats);

        /* ── Spawn exclusion — tight present cluster by the big tree ── */
        // (non-solid props players should not spawn inside; mountain/houses
        // are solid so their colliders already block spawns)
        if (ctx && typeof ctx.addExclusion === 'function') {
            ctx.addExclusion(ox - 10.25, oz + 6, 3.2);
        }

        return {
            name: 'whoville',
            description: 'Whoville Christmas Village with Mount Crumpit',
            stats: {
                houses: 14,
                lampposts: 8,
                snowmen: 2,
                trees: 9,
                presents: 6,
                snowSwirls: 3
            }
        };
    }

    /* Register biome */
    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns['whoville'] = buildWhovilleQuadrant;
})();
