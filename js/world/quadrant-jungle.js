import { pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-jungle.js - Jungle / forest biome quadrant builder.
 * Plug-and-play: call buildJungleQuadrant(bounds, place, ctx) to populate any quadrant.
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            trunk:      lib.getLambert({ color: 0x4a3520 }),
            trunkDark:  lib.getLambert({ color: 0x382818 }),
            trunkAncient: lib.getLambert({ color: 0x3a2a15 }),
            root:       lib.getLambert({ color: 0x4a3820 }),
            bark:       lib.getLambert({ color: 0x55402a }),
            leaf:       lib.getLambert({ color: 0x265e26 }),
            leafLight:  lib.getLambert({ color: 0x3a7a2e }),
            leafDark:   lib.getLambert({ color: 0x1a4a1a }),
            leafDeep:   lib.getLambert({ color: 0x143814 }),
            vine:       lib.getLambert({ color: 0x1e5a1e }),
            vineDark:   lib.getLambert({ color: 0x164a16 }),
            fern:       lib.getLambert({ color: 0x2d6a28 }),
            log:        lib.getLambert({ color: 0x5c3d1e }),
            stone:      lib.getLambert({ color: 0x4a5040 }),
            mossy:      lib.getLambert({ color: 0x3d4a32 }),
            shrine:     lib.getLambert({ color: 0x5a6a4a }),
            water:      lib.getLambert({ color: 0x3a7a8a, transparent: true, opacity: 0.55 }),
            mist:       lib.getLambert({ color: 0xc8ddd8, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
            mushStem:   lib.getLambert({ color: 0xc8b898 }),
            mushCapRed: lib.getLambert({ color: 0x8a3028 }),
            mushCapBrn: lib.getLambert({ color: 0x6a5030 }),
            mushSpot:   lib.getLambert({ color: 0xe8dcc8 }),
            rope:       lib.getLambert({ color: 0x5a4020 }),
            plank:      lib.getLambert({ color: 0x6a5030 }),
            // Animated emissive -- unique instance, not shared
            firefly:    new THREE.MeshStandardMaterial({ color: 0xeedd44, emissive: 0xeedd44, emissiveIntensity: 0.8, transparent: true, opacity: 0.7 })
        };
        return MATS;
    }

    // --- Buttress roots radiating from trunk base ---
    function addRoots(x, z, trunkW, place, mats) {
        var angles = [0.4, 1.6, 2.9, 4.3, 5.5];
        for (var i = 0; i < angles.length; i++) {
            var a = angles[i];
            var rLen = 0.8 + (i % 3) * 0.35;
            var rx = x + Math.cos(a) * (trunkW * 0.5 + rLen * 0.4);
            var rz = z + Math.sin(a) * (trunkW * 0.5 + rLen * 0.4);
            place.addRamp(rx, 0.12, rz, 0.3, 0.24, rLen, mats.root, a, -0.15, false);
        }
    }

    // --- Vines hanging from a given height ---
    function addVines(x, z, anchorY, canopyW, count, place, mats) {
        var offsets = [
            { dx:  0.35, dz:  0.0,  hf: 1.0 },
            { dx: -0.30, dz:  0.4,  hf: 0.7 },
            { dx:  0.15, dz: -0.35, hf: 0.85 },
            { dx: -0.40, dz: -0.2,  hf: 0.6 },
            { dx:  0.25, dz:  0.35, hf: 0.9 },
            { dx: -0.10, dz: -0.40, hf: 0.75 }
        ];
        var w = 0.2;
        for (var i = 0; i < count && i < offsets.length; i++) {
            var o = offsets[i];
            var vineH = (1.2 + i * 0.3) * o.hf;
            var vx = x + o.dx * canopyW;
            var vz = z + o.dz * canopyW;
            var vineMat = (i % 2 === 0) ? mats.vine : mats.vineDark;
            place.addBlock(vx, anchorY - vineH * 0.5, vz, w, vineH, w * 0.6, vineMat, false);
        }
    }

    // --- Tree type A: Canopy tree (wide scale range 0.7-2.0) ---
    function addCanopyTree(x, z, scale, place, mats, ctx) {
        var s = Math.max(0.7, Math.min(2.0, scale));
        var trunkH = 4.0 * s;
        var trunkW = 0.6 * s;
        place.addBlock(x, trunkH * 0.5, z, trunkW, trunkH, trunkW, mats.trunk, true);

        // Branch stubs on taller trees
        if (s >= 1.2) {
            place.addBlock(x + trunkW * 0.5 + 0.5 * s, trunkH * 0.55, z, 1.0 * s, 0.2, 0.2, mats.bark, false);
            place.addBlock(x - trunkW * 0.5 - 0.4 * s, trunkH * 0.7, z + 0.3, 0.8 * s, 0.18, 0.18, mats.bark, false);
        }

        // Main canopy
        var canopyW = 3.6 * s;
        var canopyH = 1.0 * s;
        var canopyMesh = place.addBlock(x, trunkH + canopyH * 0.3, z, canopyW, canopyH, canopyW, mats.leaf, true);
        ctx.addLeafSway({ mesh: canopyMesh, baseRotY: 0, freq: 0.8 + s * 0.2, phase: x * 2.1 + z * 1.3, amp: 0.015 });

        // Sub-canopy offset for asymmetry
        var offX = (s > 1.0) ? 1.2 * s : -1.0 * s;
        var subMesh = place.addBlock(x + offX, trunkH - 0.3, z + 0.8 * s, canopyW * 0.6, canopyH * 0.8, canopyW * 0.5, mats.leafLight, false);
        ctx.addLeafSway({ mesh: subMesh, baseRotY: 0, freq: 1.0, phase: x * 1.5 + z * 2.0, amp: 0.012 });

        // Lower canopy layer on tall trees for depth
        if (s >= 1.4) {
            var lowMesh = place.addBlock(x - offX * 0.5, trunkH * 0.75, z - 0.6 * s, canopyW * 0.4, canopyH * 0.6, canopyW * 0.35, mats.leafDark, false);
            ctx.addLeafSway({ mesh: lowMesh, baseRotY: 0, freq: 0.6, phase: x * 0.9 + z * 1.7, amp: 0.01 });
        }

        // Vines: 3-4 depending on size
        var vineCount = s >= 1.3 ? 4 : 3;
        addVines(x, z, trunkH, canopyW, vineCount, place, mats);

        // Roots on larger trees
        if (s >= 1.2) {
            addRoots(x, z, trunkW, place, mats);
        }
    }

    // --- Tree type B: Bushy tree (shorter, thicker, layered leaf clusters) ---
    function addBushyTree(x, z, scale, place, mats, ctx) {
        var s = Math.max(0.5, Math.min(1.4, scale));
        var trunkH = 2.4 * s;
        var trunkW = 0.9 * s;
        place.addBlock(x, trunkH * 0.5, z, trunkW, trunkH, trunkW, mats.trunkDark, true);

        var c1 = place.addBlock(x - 0.3 * s, trunkH * 0.7, z + 0.2 * s, 2.2 * s, 1.2 * s, 2.0 * s, mats.leaf, false);
        var c2 = place.addBlock(x + 0.4 * s, trunkH * 0.9, z - 0.3 * s, 2.0 * s, 1.0 * s, 1.8 * s, mats.leafLight, false);
        var c3 = place.addBlock(x, trunkH + 0.4 * s, z, 1.6 * s, 0.8 * s, 1.6 * s, mats.leafDark, true);

        ctx.addLeafSway({ mesh: c1, baseRotY: 0, freq: 0.9, phase: x * 1.8 + z, amp: 0.018 });
        ctx.addLeafSway({ mesh: c2, baseRotY: 0, freq: 1.1, phase: x + z * 1.6, amp: 0.014 });
        ctx.addLeafSway({ mesh: c3, baseRotY: 0, freq: 0.7, phase: x * 2.3 + z * 0.8, amp: 0.02 });

        // Vines on larger bushy trees
        if (s >= 0.9) {
            addVines(x, z, trunkH * 0.8, 1.5 * s, 2, place, mats);
        }
    }

    // --- Tree type C: Young sapling ---
    function addSapling(x, z, place, mats) {
        place.addBlock(x, 0.6, z, 0.2, 1.2, 0.2, mats.trunk, false);
        place.addBlock(x, 1.3, z, 0.8, 0.6, 0.8, mats.leafLight, false);
    }

    // --- Tree type D: Giant ancient tree ---
    function addGiantTree(x, z, scale, place, mats, ctx) {
        var s = Math.max(0.9, Math.min(1.2, scale));
        var trunkH = 8.0 * s;
        var trunkW = 1.3 * s;

        // Thick trunk
        place.addBlock(x, trunkH * 0.5, z, trunkW, trunkH, trunkW, mats.trunkAncient, true);

        // Buttress roots (5 radiating out)
        addRoots(x, z, trunkW, place, mats);
        // Extra thick visible roots for giants
        place.addRamp(x + trunkW * 0.3 + 0.6, 0.2, z + 0.5, 0.5, 0.4, 1.6, mats.root, 0.5, -0.12, false);
        place.addRamp(x - trunkW * 0.3 - 0.5, 0.2, z - 0.6, 0.5, 0.4, 1.4, mats.root, 2.8, -0.12, false);
        place.addRamp(x + 0.3, 0.18, z - trunkW * 0.3 - 0.5, 0.45, 0.36, 1.3, mats.root, 4.5, -0.1, false);

        // Branches at different heights
        var branchY1 = trunkH * 0.4;
        var branchY2 = trunkH * 0.6;
        var branchY3 = trunkH * 0.78;
        place.addBlock(x + trunkW * 0.5 + 1.2 * s, branchY1, z + 0.3, 2.4 * s, 0.28, 0.28, mats.bark, false);
        place.addBlock(x - trunkW * 0.5 - 1.0 * s, branchY2, z - 0.5, 2.0 * s, 0.25, 0.25, mats.bark, false);
        place.addBlock(x + 0.4, branchY3, z + trunkW * 0.5 + 0.8 * s, 0.25, 0.22, 1.8 * s, mats.bark, false);

        // Multi-layer canopy (3 overlapping layers at different heights and offsets)
        var cw = 5.0 * s;
        var ch = 1.2 * s;
        var top1 = place.addBlock(x, trunkH + ch * 0.2, z, cw, ch, cw, mats.leaf, true);
        var top2 = place.addBlock(x + 1.5 * s, trunkH - 0.5, z - 1.0 * s, cw * 0.7, ch * 0.9, cw * 0.6, mats.leafLight, false);
        var top3 = place.addBlock(x - 1.2 * s, trunkH + ch * 0.6, z + 0.8 * s, cw * 0.55, ch * 0.7, cw * 0.5, mats.leafDark, false);

        ctx.addLeafSway({ mesh: top1, baseRotY: 0, freq: 0.5, phase: x * 1.2 + z * 0.8, amp: 0.012 });
        ctx.addLeafSway({ mesh: top2, baseRotY: 0, freq: 0.7, phase: x * 0.7 + z * 1.4, amp: 0.015 });
        ctx.addLeafSway({ mesh: top3, baseRotY: 0, freq: 0.6, phase: x * 1.9 + z * 0.5, amp: 0.01 });

        // Leaf clusters on branches
        place.addBlock(x + trunkW * 0.5 + 2.0 * s, branchY1 + 0.4, z + 0.3, 1.6 * s, 0.8 * s, 1.4 * s, mats.leafDark, false);
        place.addBlock(x - trunkW * 0.5 - 1.6 * s, branchY2 + 0.3, z - 0.5, 1.4 * s, 0.7 * s, 1.2 * s, mats.leaf, false);

        // Heavy vines (5-6 hanging from canopy and branches)
        addVines(x, z, trunkH, cw, 5, place, mats);
        // Extra vine from a branch
        place.addBlock(x + trunkW * 0.5 + 1.8 * s, branchY1 - 1.0, z + 0.3, 0.22, 2.0, 0.14, mats.vine, false);
    }

    function addFern(x, z, place, mats) {
        place.addBlock(x, 0.18, z, 0.8, 0.36, 0.6, mats.fern, false);
        place.addBlock(x + 0.2, 0.22, z - 0.15, 0.5, 0.25, 0.4, mats.leafLight, false);
    }

    function addMushroom(x, z, place, mats, red) {
        place.addBlock(x, 0.15, z, 0.12, 0.3, 0.12, mats.mushStem, false);
        var capMat = red ? mats.mushCapRed : mats.mushCapBrn;
        place.addBlock(x, 0.35, z, 0.35, 0.12, 0.35, capMat, false);
        if (red) {
            place.addBlock(x + 0.08, 0.44, z - 0.05, 0.06, 0.04, 0.06, mats.mushSpot, false);
            place.addBlock(x - 0.06, 0.44, z + 0.08, 0.05, 0.04, 0.05, mats.mushSpot, false);
        }
    }

    function addLog(x, z, alongX, place, mats) {
        if (alongX) {
            place.addBlock(x, 0.32, z, 3.2, 0.64, 0.9, mats.log, true);
        } else {
            place.addBlock(x, 0.32, z, 0.9, 0.64, 3.2, mats.log, true);
        }
        place.addBlock(x + 0.1, 0.66, z - 0.1, 0.8, 0.06, 0.5, mats.mossy, false);
    }

    function buildShrine(cx, cz, place, mats, ctx) {
        place.addBlock(cx, 0.5, cz, 9.0, 1.0, 7.0, mats.stone, true);
        place.addBlock(cx, 1.2, cz, 4.6, 0.9, 3.2, mats.mossy, true);

        // Front steps make the shrine read more intentionally built.
        place.addBlock(cx, 0.22, cz + 4.1, 3.8, 0.16, 1.1, mats.stone, true);
        place.addBlock(cx, 0.36, cz + 3.55, 2.6, 0.12, 0.8, mats.mossy, false);

        place.addBlock(cx - 3.4, 2.0, cz - 2.6, 0.9, 4.0, 0.9, mats.stone, true);
        place.addBlock(cx + 3.4, 2.0, cz - 2.6, 0.9, 4.0, 0.9, mats.stone, true);
        place.addBlock(cx - 3.4, 2.0, cz + 2.6, 0.9, 4.0, 0.9, mats.stone, true);
        place.addBlock(cx + 3.4, 2.0, cz + 2.6, 0.9, 4.0, 0.9, mats.stone, true);

        place.addBlock(cx - 3.4, 0.8, cz - 2.6, 1.1, 0.6, 1.1, mats.mossy, false);
        place.addBlock(cx + 3.4, 1.2, cz + 2.6, 1.1, 0.8, 1.1, mats.mossy, false);
        place.addBlock(cx - 3.7, 2.5, cz - 2.6, 0.15, 2.0, 0.15, mats.vine, false);
        place.addBlock(cx + 3.7, 1.8, cz + 2.6, 0.15, 1.5, 0.15, mats.vine, false);
        place.addBlock(cx + 3.1, 3.0, cz - 2.6, 0.15, 1.2, 0.15, mats.vineDark, false);
        place.addBlock(cx - 3.1, 2.2, cz + 2.6, 0.15, 1.8, 0.15, mats.vineDark, false);

        place.addBlock(cx - 1.5, 1.6, cz, 0.9, 2.4, 2.8, mats.mossy, true);
        place.addBlock(cx + 1.5, 1.6, cz, 0.9, 2.4, 2.8, mats.mossy, true);

        place.addBlock(cx, 1.8, cz, 1.4, 0.6, 1.4, mats.shrine, false);
        place.addBlock(cx, 2.15, cz, 0.8, 0.2, 0.8, mats.stone, false);
        place.addBlock(cx, 2.3, cz, 0.5, 0.12, 0.5, mats.mossy, false);

        place.addBlock(cx + 4.8, 0.25, cz - 1.0, 1.0, 0.5, 0.8, mats.stone, false);
        place.addBlock(cx - 4.5, 0.18, cz + 1.5, 0.7, 0.36, 0.6, mats.stone, false);
        place.addBlock(cx + 5.2, 0.12, cz + 2.0, 0.5, 0.24, 0.4, mats.mossy, false);

        ctx.addExclusion(cx, cz, 5.2);
    }

    function buildWaterfall(cx, cz, place, mats, ctx) {
        var widthScale = 2.775;
        var heightScale = 4.625;
        var depthScale = 1.85;
        function sx(value) {
            return value * widthScale;
        }
        function sy(value) {
            return value * heightScale;
        }
        function sz(value) {
            return value * depthScale;
        }
        function addWallBlock(localX, y, localZ, w, h, d, material, solid) {
            return place.addBlock(
                cx + localZ,
                y,
                cz - localX,
                d,
                h,
                w,
                material,
                solid
            );
        }

        // Border-mounted hero waterfall rotated to face inward toward the jungle center.
        addWallBlock(0, sy(2.5), 0, sx(4.2), sy(5.0), sz(2.2), mats.stone, true);

        // Stepped top shelf and pour-over lip.
        addWallBlock(0, sy(5.2), sz(0.4), sx(4.8), sy(0.5), sz(2.8), mats.mossy, true);
        addWallBlock(0, sy(5.6), -sz(0.2), sx(3.6), sy(0.35), sz(2.0), mats.stone, false);

        // Framing rocks around the top lip.
        addWallBlock(-sx(1.6), sy(5.4), sz(0.8), sx(1.0), sy(0.6), sz(0.8), mats.mossy, false);
        addWallBlock(sx(1.4), sy(5.3), sz(0.6), sx(0.8), sy(0.5), sz(0.7), mats.stone, false);
        addWallBlock(sx(0.3), sy(5.5), sz(0.9), sx(0.6), sy(0.4), sz(0.5), mats.mossy, false);
        addWallBlock(-sx(2.2), sy(4.6), sz(0.2), sx(1.4), sy(0.55), sz(1.0), mats.stone, false);
        addWallBlock(sx(2.3), sy(4.8), sz(0.15), sx(1.3), sy(0.52), sz(0.95), mats.stone, false);

        // Side channel walls and lower buttresses scaled up from the original layout.
        addWallBlock(-sx(2.4), sy(2.0), sz(0.5), sx(1.2), sy(2.5), sz(1.0), mats.stone, true);
        addWallBlock(sx(2.2), sy(1.6), sz(0.3), sx(1.0), sy(2.0), sz(0.9), mats.stone, true);
        addWallBlock(-sx(2.4), sy(3.4), sz(0.5), sx(1.4), sy(0.3), sz(1.2), mats.mossy, false);
        addWallBlock(sx(2.2), sy(2.8), sz(0.3), sx(1.2), sy(0.25), sz(1.0), mats.mossy, false);
        addWallBlock(-sx(3.5), sy(1.1), sz(1.7), sx(1.2), sy(1.5), sz(1.1), mats.stone, true);
        addWallBlock(sx(3.3), sy(1.0), sz(1.6), sx(1.1), sy(1.4), sz(1.0), mats.stone, true);
        addWallBlock(-sx(4.15), sy(0.72), sz(2.25), sx(0.95), sy(0.44), sz(0.8), mats.stone, true);
        addWallBlock(sx(4.0), sy(0.66), sz(2.35), sx(0.88), sy(0.4), sz(0.74), mats.mossy, true);

        // Big blocky waterfall sheet with the older 80s palette stepping.
        var tileColumns = 9;
        var tileRows = 30;
        var tileW = 0.76;
        var tileH = 0.72;
        var tileGapY = 0.06;
        var columnSpacing = 0.82;
        var rowSpacing = tileH + tileGapY;
        var baseY = sy(4.82);
        var frontX = cx + sz(1.36);
        var baseZ = cz + ((((tileColumns - 1) * columnSpacing) * 0.5));
        var waterfallTiles = [];
        for (var col = 0; col < tileColumns; col++) {
            for (var row = 0; row < tileRows; row++) {
                var tileMat = mats.water.clone();
                tileMat.transparent = true;
                tileMat.opacity = 0.66;
                tileMat.color.setHex((row + col) % 2 === 0 ? 0x78e7ff : 0x279dff);
                var tile = place.addBlock(
                    frontX,
                    baseY - (row * rowSpacing),
                    baseZ - (col * columnSpacing),
                    0.18,
                    tileH,
                    tileW,
                    tileMat,
                    false
                );
                waterfallTiles.push({
                    mesh: tile,
                    material: tileMat,
                    column: col,
                    row: row
                });
            }
        }
        ctx.addWaterfallSheet({
            tiles: waterfallTiles,
            stepInterval: 0.72,
            rowDirection: -1,
            darkColor: 0x279dff,
            lightColor: 0x96f6ff,
            rowCount: tileRows,
            pulseInterval: 4.8,
            pulseDuration: 1.9765625,
            pulseWidth: 1.25,
            pulseColumnSkew: 0.38,
            pulseLightColor: 0xc8ffff
        });

        // Thin source lip so the tile sheet reads as water pouring over the cliff.
        addWallBlock(sx(0.02), sy(4.9), sz(1.12), sx(5.6), sy(0.08), sz(0.32), mats.water, false);

        // Pool and stepped outflow scaled to match the larger cliff.
        addWallBlock(0, -0.02, sz(4.9), sx(6.9), 0.1, sz(4.9), mats.water, false);
        addWallBlock(-sx(0.1), 0.03, sz(7.1), sx(5.4), 0.08, sz(2.6), mats.water, false);
        addWallBlock(-sx(2.2), 0.12, sz(5.5), sx(0.95), sy(0.05), sz(0.7), mats.stone, false);
        addWallBlock(sx(1.8), 0.1, sz(5.95), sx(0.84), sy(0.04), sz(0.6), mats.mossy, false);
        addWallBlock(sx(0.3), 0.08, sz(6.6), sx(0.8), sy(0.035), sz(0.55), mats.stone, false);
        addWallBlock(-sx(3.0), 0.16, sz(3.9), sx(0.9), sy(0.07), sz(0.85), mats.stone, false);
        addWallBlock(sx(3.2), 0.18, sz(4.2), sx(1.05), sy(0.08), sz(0.88), mats.mossy, false);
        addWallBlock(-sx(3.8), 0.22, sz(5.0), sx(1.2), sy(0.09), sz(1.0), mats.stone, false);
        addWallBlock(sx(4.1), 0.24, sz(5.3), sx(1.15), sy(0.1), sz(0.95), mats.stone, false);
        addWallBlock(-sx(2.6), 0.3, sz(6.0), sx(0.75), sy(0.12), sz(0.62), mats.mossy, false);
        addWallBlock(sx(2.5), 0.28, sz(6.35), sx(0.72), sy(0.11), sz(0.58), mats.stone, false);

        // Mist cards scaled up with the huge retro fall.
        var mistConfigs = [
            { x: cx + sz(4.8), z: cz,            y: 1.7, w: 8.2, h: 2.8, rotX: -0.34, phase: 2.45, opacity: 0.2 },
            { x: cx + sz(5.5), z: cz + sx(0.42), y: 1.25, w: 4.6, h: 1.8, rotX: -0.2, phase: 4.1, opacity: 0.13 },
            { x: cx + sz(6.0), z: cz - sx(0.34), y: 1.35, w: 4.0, h: 1.5, rotX: -0.4, phase: 0.8, opacity: 0.11 }
        ];
        for (var mi = 0; mi < mistConfigs.length; mi++) {
            var mc = mistConfigs[mi];
            var mistGeo = new THREE.PlaneGeometry(mc.w, mc.h);
            var mistMat = mats.mist.clone();
            mistMat.opacity = mc.opacity;
            var mistMesh = new THREE.Mesh(mistGeo, mistMat);
            mistMesh.position.set(mc.x, mc.y, mc.z);
            mistMesh.rotation.x = mc.rotX;
            mistMesh.rotation.y = -Math.PI * 0.5;
            ctx.scene.add(mistMesh);
            ctx.addMistCard({ mesh: mistMesh, baseOpacity: mc.opacity, phase: mc.phase });
        }

        ctx.addExclusion(cx + sz(4.6), cz, 9.4);
    }

    // --- Rope bridge: high overhead walkway between two trees ---
    function buildRopeBridge(posA, posB, bridgeY, place, mats) {
        var dx = posB.x - posA.x;
        var dz = posB.z - posA.z;
        var len = Math.sqrt(dx * dx + dz * dz);
        if (len < 2) return;
        var dirX = dx / len;
        var dirZ = dz / len;
        var perpX = -dirZ;
        var perpZ = dirX;
        var bridgeWidth = 1.2;
        var ropeOffset = bridgeWidth * 0.5;
        var bridgeRotY = Math.atan2(dx, dz);

        // Offset anchor points outward from trunks toward bridge center
        var anchorOff = 1.0;
        var aX = posA.x + dirX * anchorOff;
        var aZ = posA.z + dirZ * anchorOff;
        var bX = posB.x - dirX * anchorOff;
        var bZ = posB.z - dirZ * anchorOff;
        var spanDx = bX - aX;
        var spanDz = bZ - aZ;
        var spanLen = Math.sqrt(spanDx * spanDx + spanDz * spanDz);
        var midX = (aX + bX) * 0.5;
        var midZ = (aZ + bZ) * 0.5;

        // Anchor posts: visible against the trunk, not inside it
        place.addBlock(aX, bridgeY * 0.5, aZ, 0.35, bridgeY, 0.35, mats.rope, false);
        place.addBlock(bX, bridgeY * 0.5, bZ, 0.35, bridgeY, 0.35, mats.rope, false);

        // Landing platforms at each anchor
        place.addBlock(aX, bridgeY - 0.1, aZ, 1.4, 0.2, 1.4, mats.plank, false);
        place.addBlock(bX, bridgeY - 0.1, bZ, 1.4, 0.2, 1.4, mats.plank, false);

        // Diagonal braces from platform down to trunk
        var braceLen = 2.0;
        var braceY = bridgeY - 1.2;
        place.addRamp(posA.x + dirX * 0.5, braceY, posA.z + dirZ * 0.5, 0.18, 0.18, braceLen, mats.rope, bridgeRotY, 0.5, false);
        place.addRamp(posA.x + dirX * 0.5, braceY - 0.6, posA.z + dirZ * 0.5 + perpZ * 0.3, 0.14, 0.14, braceLen * 0.7, mats.rope, bridgeRotY + 0.4, 0.4, false);
        place.addRamp(posB.x - dirX * 0.5, braceY, posB.z - dirZ * 0.5, 0.18, 0.18, braceLen, mats.rope, bridgeRotY + Math.PI, 0.5, false);
        place.addRamp(posB.x - dirX * 0.5, braceY - 0.6, posB.z - dirZ * 0.5 - perpZ * 0.3, 0.14, 0.14, braceLen * 0.7, mats.rope, bridgeRotY + Math.PI - 0.4, 0.4, false);

        // Solid walkway spanning between anchor points
        place.addRamp(midX, bridgeY, midZ, bridgeWidth, 0.14, spanLen, mats.plank, bridgeRotY, 0, true);

        // Decorative plank lines on top
        var plankCount = Math.max(6, Math.round(spanLen / 1.0));
        for (var i = 1; i < plankCount; i++) {
            var t = i / plankCount;
            place.addRamp(aX + spanDx * t, bridgeY + 0.08, aZ + spanDz * t, bridgeWidth * 0.95, 0.02, 0.08, mats.rope, bridgeRotY, 0, false);
        }

        // Build the hand ropes and uprights off the same nodes so they actually meet.
        var railNodes = Math.max(4, Math.round(spanLen / 2.0));
        var railY = bridgeY + 0.78;
        var uprightBaseY = bridgeY + 0.08;
        var railOffset = ropeOffset - 0.03;
        var leftNodes = [];
        var rightNodes = [];

        for (var p = 0; p <= railNodes; p++) {
            var pt2 = p / railNodes;
            var ux = aX + spanDx * pt2;
            var uz = aZ + spanDz * pt2;
            var leftNode = {
                x: ux + perpX * railOffset,
                y: railY,
                z: uz + perpZ * railOffset
            };
            var rightNode = {
                x: ux - perpX * railOffset,
                y: railY,
                z: uz - perpZ * railOffset
            };
            var postW = (p === 0 || p === railNodes) ? 0.09 : 0.07;
            var postH = railY - uprightBaseY;

            leftNodes.push(leftNode);
            rightNodes.push(rightNode);
            place.addBlock(leftNode.x, uprightBaseY + postH * 0.5, leftNode.z, postW, postH, postW, mats.rope, false);
            place.addBlock(rightNode.x, uprightBaseY + postH * 0.5, rightNode.z, postW, postH, postW, mats.rope, false);
        }

        for (var r = 0; r < railNodes; r++) {
            var leftA = leftNodes[r];
            var leftB = leftNodes[r + 1];
            var rightA = rightNodes[r];
            var rightB = rightNodes[r + 1];
            var segLen = Math.sqrt(
                (leftB.x - leftA.x) * (leftB.x - leftA.x) +
                (leftB.z - leftA.z) * (leftB.z - leftA.z)
            );

            place.addRamp(
                (leftA.x + leftB.x) * 0.5,
                railY,
                (leftA.z + leftB.z) * 0.5,
                0.06,
                0.06,
                segLen + 0.03,
                mats.rope,
                bridgeRotY,
                0,
                false
            );
            place.addRamp(
                (rightA.x + rightB.x) * 0.5,
                railY,
                (rightA.z + rightB.z) * 0.5,
                0.06,
                0.06,
                segLen + 0.03,
                mats.rope,
                bridgeRotY,
                0,
                false
            );
        }

        for (var tie = 0; tie <= railNodes; tie++) {
            if (tie !== 0 && tie !== railNodes && (tie % 2 !== 0)) continue;
            var tx = aX + spanDx * (tie / railNodes);
            var tz = aZ + spanDz * (tie / railNodes);
            place.addRamp(tx, railY - 0.02, tz, 0.05, 0.05, bridgeWidth - 0.08, mats.rope, bridgeRotY + Math.PI * 0.5, 0, false);
        }
    }

    function addFirefly(x, y, z, place, mats, ctx) {
        var geo = new THREE.SphereGeometry(0.06, 4, 4);
        place.addDecor(x, y, z, geo, mats.firefly);
        ctx.addFlicker({ material: mats.firefly, freq: 2.0 + x * 0.3, phase: x * 3.1 + z * 2.7 });
    }

    // --- Ground vine trails snaking between trees ---
    function addGroundVine(x1, z1, x2, z2, place, mats) {
        var dx = x2 - x1;
        var dz = z2 - z1;
        var segs = 4;
        for (var i = 0; i < segs; i++) {
            var t = (i + 0.5) / segs;
            var vx = x1 + dx * t + ((i % 2 === 0) ? 0.3 : -0.3);
            var vz = z1 + dz * t + ((i % 2 === 0) ? -0.2 : 0.2);
            var segLen = Math.sqrt(dx * dx + dz * dz) / segs;
            place.addRamp(vx, 0.04, vz, 0.15, 0.06, segLen * 0.9, mats.vine, Math.atan2(dx, dz) + (i % 2) * 0.2, 0, false);
        }
    }

    function addEnvironmentAsset(assetId, x, y, z, rotY, scale, ctx, options) {
        var factory = globalThis.__MAYHEM_RUNTIME.GameAssetFactory;
        if (!factory || typeof factory.create !== 'function') return null;
        var asset = factory.create('environment', assetId, options || {});
        if (!asset) return null;
        asset.position.set(x, y, z);
        if (rotY) asset.rotation.y = rotY;
        if (scale != null) {
            asset.scale.set(scale, scale, scale);
        }
        ctx.scene.add(asset);
        return asset;
    }

    function buildJungleQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var center = pt(bounds, 0.67, 0.56);

        buildShrine(center.x, center.z, place, mats, ctx);

        var wfPt = {
            x: bounds.minX + 2.75,
            z: pt(bounds, 0, 0.34).z
        };
        buildWaterfall(wfPt.x, wfPt.z, place, mats, ctx);

        addEnvironmentAsset('waterfallCrownTree', bounds.minX + 1.55, 0, wfPt.z - 10.8, 0.18, 1, ctx);
        addEnvironmentAsset('waterfallBranchTree', bounds.minX + 1.6, 0, wfPt.z + 10.4, -0.24, 1, ctx);
        addEnvironmentAsset('waterfallWallTree', bounds.minX + 1.45, 0, wfPt.z - 19.5, 0.1, 0.96, ctx);
        addEnvironmentAsset('waterfallBranchTree', bounds.minX + 1.52, 0, wfPt.z + 24.8, -0.16, 0.94, ctx);
        addEnvironmentAsset('waterfallBranchTree', bounds.minX + 1.3, 0, bounds.maxZ - 4.6, Math.PI * 0.5, 0.94, ctx);
        addEnvironmentAsset('waterfallCrownTree', bounds.maxX - 2.4, 0, bounds.maxZ - 2.5, -0.34, 0.92, ctx);
        ctx.addExclusion(bounds.minX + 2.2, wfPt.z - 10.8, 4.6);
        ctx.addExclusion(bounds.minX + 2.2, wfPt.z + 10.4, 4.2);
        ctx.addExclusion(bounds.minX + 1.95, wfPt.z - 19.5, 3.8);
        ctx.addExclusion(bounds.minX + 2.0, wfPt.z + 24.8, 4.1);
        ctx.addExclusion(bounds.minX + 1.85, bounds.maxZ - 4.6, 4.1);
        ctx.addExclusion(bounds.maxX - 2.1, bounds.maxZ - 2.2, 4.3);

        // ============================================================
        // TREES -- 4 types, dramatic height variation, dense edges
        // ============================================================

        // Type D: Giant ancient trees (towering pillars of the forest)
        var giants = [
            { u: 0.18, v: 0.04, s: 1.18 },
            { u: 0.36, v: 0.14, s: 1.08 },
            { u: 0.62, v: 0.10, s: 1.02 },
            { u: 0.72, v: 0.34, s: 1.04 },
            { u: 0.72, v: 0.76, s: 1.06 },
            { u: 0.48, v: 0.90, s: 1.12 },
            { u: 0.98, v: 0.52, s: 1.02 },
            { u: 0.90, v: 0.92, s: 1.08 },
            { u: 0.84, v: 0.04, s: 1.1 }
        ];
        for (var gi = 0; gi < giants.length; gi++) {
            var gp = pt(bounds, giants[gi].u, giants[gi].v);
            addGiantTree(gp.x, gp.z, giants[gi].s, place, mats, ctx);
            ctx.addExclusion(gp.x, gp.z, 2.5);
        }

        // Type A: Canopy trees -- wide scale range for dramatic height contrast
        var canopyTrees = [
            // Outer layer pushed to the actual padded biome edges.
            { u: 0.12, v: 0.06, s: 1.55 },
            { u: 0.32, v: 0.04, s: 1.35 },
            { u: 0.54, v: 0.03, s: 1.6 },
            { u: 0.78, v: 0.05, s: 1.22 },
            { u: 0.96, v: 0.18, s: 1.22 },
            { u: 0.97, v: 0.40, s: 1.22 },
            { u: 0.95, v: 0.70, s: 1.35 },
            { u: 0.82, v: 0.96, s: 1.1 },
            { u: 0.56, v: 0.95, s: 1.22 },
            { u: 0.28, v: 0.94, s: 1.08 },
            { u: 0.10, v: 0.90, s: 1.18 },
            // Inner layer spread wider with fewer clumps.
            { u: 0.68, v: 0.26, s: 1.18 },
            { u: 0.34, v: 0.68, s: 1.1 }
        ];
        for (var t = 0; t < canopyTrees.length; t++) {
            var tp = pt(bounds, canopyTrees[t].u, canopyTrees[t].v);
            addCanopyTree(tp.x, tp.z, canopyTrees[t].s, place, mats, ctx);
        }

        // Type B: Bushy trees -- more of them, wider scale range
        var bushyTrees = [
            { u: 0.18, v: 0.16, s: 0.9 },
            { u: 0.90, v: 0.26, s: 0.95 },
            { u: 0.88, v: 0.60, s: 0.72 },
            { u: 0.70, v: 0.88, s: 1.05 },
            { u: 0.34, v: 0.90, s: 0.95 },
            { u: 0.56, v: 0.36, s: 0.92 },
            { u: 0.42, v: 0.76, s: 0.88 }
        ];
        for (var bt = 0; bt < bushyTrees.length; bt++) {
            var btp = pt(bounds, bushyTrees[bt].u, bushyTrees[bt].v);
            addBushyTree(btp.x, btp.z, bushyTrees[bt].s, place, mats, ctx);
        }

        // Type C: Saplings -- fill gaps, especially mid-zone
        var saplings = [
            { u: 0.92, v: 0.46 },
            { u: 0.16, v: 0.84 },
            { u: 0.62, v: 0.78 }
        ];
        for (var sp = 0; sp < saplings.length; sp++) {
            var spp = pt(bounds, saplings[sp].u, saplings[sp].v);
            addSapling(spp.x, spp.z, place, mats);
        }

        // ============================================================
        // UNDERGROWTH -- lighter fern layer so the floor reads cleaner
        // ============================================================
        var ferns = [
            { u: 0.18, v: 0.26 }, { u: 0.60, v: 0.22 }, { u: 0.75, v: 0.40 },
            { u: 0.80, v: 0.70 }, { u: 0.24, v: 0.66 }, { u: 0.56, v: 0.74 },
            { u: 0.88, v: 0.38 }, { u: 0.90, v: 0.82 }, { u: 0.30, v: 0.14 },
            { u: 0.70, v: 0.86 }, { u: 0.42, v: 0.28 }
        ];
        for (var f = 0; f < ferns.length; f++) {
            var fp = pt(bounds, ferns[f].u, ferns[f].v);
            addFern(fp.x, fp.z, place, mats);
        }

        // ============================================================
        // LOGS
        // ============================================================
        var logs = [
            { u: 0.28, v: 0.58, ax: true },
            { u: 0.74, v: 0.50, ax: false },
            { u: 0.54, v: 0.78, ax: false }
        ];
        for (var l = 0; l < logs.length; l++) {
            var lp = pt(bounds, logs[l].u, logs[l].v);
            addLog(lp.x, lp.z, logs[l].ax, place, mats);
        }

        // ============================================================
        // MUSHROOMS
        // ============================================================
        var mushrooms = [
            { u: 0.29, v: 0.59, red: true },
            { u: 0.26, v: 0.61, red: false },
            { u: 0.73, v: 0.49, red: true },
            { u: 0.76, v: 0.53, red: false },
            { u: 0.50, v: 0.23, red: false },
            { u: 0.54, v: 0.79, red: true },
            { u: 0.58, v: 0.77, red: false },
            { u: 0.86, v: 0.72, red: true }
        ];
        for (var mi = 0; mi < mushrooms.length; mi++) {
            var mp = pt(bounds, mushrooms[mi].u, mushrooms[mi].v);
            addMushroom(mp.x, mp.z, place, mats, mushrooms[mi].red);
        }

        // ============================================================
        // GROUND VINES -- snaking between trees at ground level
        // ============================================================
        var gv2a = pt(bounds, 0.16, 0.78);
        var gv2b = pt(bounds, 0.32, 0.86);
        addGroundVine(gv2a.x, gv2a.z, gv2b.x, gv2b.z, place, mats);

        var gv3a = pt(bounds, 0.78, 0.64);
        var gv3b = pt(bounds, 0.88, 0.82);
        addGroundVine(gv3a.x, gv3a.z, gv3b.x, gv3b.z, place, mats);

        // ============================================================
        // FALLEN PILLAR near shrine (toppled column)
        // ============================================================
        place.addRamp(center.x - 5.4, 0.42, center.z - 3.1, 0.9, 0.8, 4.8, mats.stone, 0.18, 0.08, false);
        place.addBlock(center.x - 3.1, 0.18, center.z - 3.5, 0.95, 0.34, 0.95, mats.mossy, false);
        place.addBlock(center.x - 6.8, 0.54, center.z - 2.8, 0.85, 0.44, 0.85, mats.stone, false);

        // Corridor blockers between shrine and waterfall so the jungle is not one open field.
        place.addBlock(center.x - 8.4, 0.7, center.z - 0.4, 1.6, 1.4, 1.2, mats.stone, true);
        place.addBlock(center.x - 10.4, 0.55, center.z + 1.2, 1.2, 1.1, 1.0, mats.mossy, true);
        place.addRamp(center.x - 6.4, 0.42, center.z + 2.4, 1.0, 0.7, 3.2, mats.log, 1.05, -0.06, true);

        // ============================================================
        // MOSS PATCHES on ground
        // ============================================================
        place.addBlock(wfPt.x + 2.2, 0.03, wfPt.z + 2.2, 1.9, 0.04, 1.5, mats.mossy, false);
        place.addBlock(wfPt.x - 2.0, 0.03, wfPt.z + 4.6, 1.6, 0.04, 1.2, mats.fern, false);
        place.addBlock(center.x - 3.4, 0.03, center.z + 3.1, 2.1, 0.04, 1.6, mats.mossy, false);
        place.addBlock(center.x + 3.6, 0.03, center.z - 1.7, 1.2, 0.04, 1.8, mats.fern, false);

        var totalTrees = giants.length + canopyTrees.length + bushyTrees.length + saplings.length;
        return {
            trees: totalTrees,
            bushes: ferns.length,
            logs: logs.length,
            artifacts: 1,
            borderTrees: 0
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.jungle = buildJungleQuadrant;
})();
