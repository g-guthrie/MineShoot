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
            waterfall:  lib.getLambert({ color: 0x6abaca, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
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

    function pt(bounds, u, v) {
        u = Math.max(0, Math.min(1, u));
        v = Math.max(0, Math.min(1, v));
        return {
            x: bounds.minX + (bounds.maxX - bounds.minX) * u,
            z: bounds.minZ + (bounds.maxZ - bounds.minZ) * v
        };
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
            place.addBlock(x + 0.08, 0.42, z - 0.05, 0.06, 0.04, 0.06, mats.mushSpot, false);
            place.addBlock(x - 0.06, 0.42, z + 0.08, 0.05, 0.04, 0.05, mats.mushSpot, false);
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
        // Taller rock face
        place.addBlock(cx, 2.5, cz, 4.2, 5.0, 2.2, mats.stone, true);
        // Stepped shelf at top (pour-over lip)
        place.addBlock(cx, 5.2, cz + 0.4, 4.8, 0.5, 2.8, mats.mossy, true);
        place.addBlock(cx, 5.6, cz - 0.2, 3.6, 0.35, 2.0, mats.stone, false);

        // Rocks framing the pour-over (asymmetric)
        place.addBlock(cx - 1.6, 5.4, cz + 0.8, 1.0, 0.6, 0.8, mats.mossy, false);
        place.addBlock(cx + 1.4, 5.3, cz + 0.6, 0.8, 0.5, 0.7, mats.stone, false);
        place.addBlock(cx + 0.3, 5.5, cz + 0.9, 0.6, 0.4, 0.5, mats.mossy, false);

        // Side rocks creating a natural channel
        place.addBlock(cx - 2.4, 2.0, cz + 0.5, 1.2, 2.5, 1.0, mats.stone, true);
        place.addBlock(cx + 2.2, 1.6, cz + 0.3, 1.0, 2.0, 0.9, mats.stone, true);
        place.addBlock(cx - 2.4, 3.4, cz + 0.5, 1.4, 0.3, 1.2, mats.mossy, false);
        place.addBlock(cx + 2.2, 2.8, cz + 0.3, 1.2, 0.25, 1.0, mats.mossy, false);

        // 3 overlapping waterfall sheets at different offsets, speeds, phases
        var sheetConfigs = [
            { xOff:  0.0, w: 2.4, h: 4.8, speed: 0.126, wobbleFreq: 0.42, wobbleAmp: 0.02, phase: 1.23, opacity: 0.42 },
            { xOff:  0.35, w: 1.8, h: 4.6, speed: 0.168, wobbleFreq: 0.35, wobbleAmp: 0.03, phase: 3.5,  opacity: 0.30 },
            { xOff: -0.25, w: 2.0, h: 4.4, speed: 0.098, wobbleFreq: 0.49, wobbleAmp: 0.02, phase: 5.1,  opacity: 0.25 }
        ];
        for (var si = 0; si < sheetConfigs.length; si++) {
            var cfg = sheetConfigs[si];
            var sheetGeo = new THREE.PlaneGeometry(cfg.w, cfg.h);
            var sheetMat = mats.waterfall.clone();
            sheetMat.opacity = cfg.opacity;
            var sheet = new THREE.Mesh(sheetGeo, sheetMat);
            sheet.position.set(cx + cfg.xOff, 2.8, cz + 1.15);
            ctx.scene.add(sheet);
            ctx.addWaterfallSheet({
                mesh: sheet, material: sheetMat, baseX: cx + cfg.xOff,
                offset: 0, speed: cfg.speed, wobbleFreq: cfg.wobbleFreq,
                wobbleAmp: cfg.wobbleAmp, phase: cfg.phase, baseOpacity: cfg.opacity
            });
        }

        // Basin pool (wider)
        place.addBlock(cx, -0.04, cz + 3.0, 4.0, 0.08, 3.0, mats.water, false);
        // Spray blocks at basin edges
        place.addBlock(cx - 1.2, 0.06, cz + 3.8, 0.6, 0.08, 0.4, mats.water, false);
        place.addBlock(cx + 1.0, 0.05, cz + 4.0, 0.5, 0.06, 0.35, mats.water, false);

        // Splash rocks in basin
        place.addBlock(cx - 0.9, 0.1, cz + 3.4, 0.5, 0.2, 0.4, mats.stone, false);
        place.addBlock(cx + 0.7, 0.08, cz + 3.7, 0.4, 0.16, 0.3, mats.mossy, false);
        place.addBlock(cx + 0.1, 0.06, cz + 4.2, 0.3, 0.12, 0.25, mats.stone, false);

        // 3 mist cards at different angles and phases
        var mistConfigs = [
            { x: cx,       z: cz + 3.0, y: 0.6, w: 3.2, h: 1.4, rotX: -0.3, phase: 2.45, opacity: 0.18 },
            { x: cx - 0.8, z: cz + 3.5, y: 0.4, w: 2.0, h: 1.0, rotX: -0.15, phase: 4.1, opacity: 0.12 },
            { x: cx + 0.6, z: cz + 3.8, y: 0.5, w: 1.8, h: 0.8, rotX: -0.4, phase: 0.8, opacity: 0.10 }
        ];
        for (var mi = 0; mi < mistConfigs.length; mi++) {
            var mc = mistConfigs[mi];
            var mistGeo = new THREE.PlaneGeometry(mc.w, mc.h);
            var mistMat = mats.mist.clone();
            mistMat.opacity = mc.opacity;
            var mistMesh = new THREE.Mesh(mistGeo, mistMat);
            mistMesh.position.set(mc.x, mc.y, mc.z);
            mistMesh.rotation.x = mc.rotX;
            ctx.scene.add(mistMesh);
            ctx.addMistCard({ mesh: mistMesh, baseOpacity: mc.opacity, phase: mc.phase });
        }

        ctx.addExclusion(cx, cz, 4.0);
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

        // Rope uprights every ~2 units
        var postSpacing = Math.max(3, Math.round(spanLen / 2.0));
        for (var p = 1; p < postSpacing; p++) {
            var pt2 = p / postSpacing;
            var ux = aX + spanDx * pt2;
            var uz = aZ + spanDz * pt2;
            var postH = 0.7;
            place.addBlock(ux + perpX * ropeOffset, bridgeY + postH * 0.5 + 0.07, uz + perpZ * ropeOffset, 0.07, postH, 0.07, mats.rope, false);
            place.addBlock(ux - perpX * ropeOffset, bridgeY + postH * 0.5 + 0.07, uz - perpZ * ropeOffset, 0.07, postH, 0.07, mats.rope, false);
        }

        // Rope rails (segmented sag)
        var railSegs = Math.max(4, Math.round(spanLen / 3.0));
        var sagAmt = spanLen * 0.015;
        var railY = bridgeY + 0.75;
        for (var r = 0; r < railSegs; r++) {
            var mt = ((r + 0.5) / railSegs);
            var sag = Math.sin(mt * Math.PI) * sagAmt;
            var rx = aX + spanDx * mt;
            var rz = aZ + spanDz * mt;
            var segLen = spanLen / railSegs;
            place.addRamp(rx + perpX * ropeOffset, railY - sag, rz + perpZ * ropeOffset, 0.06, 0.06, segLen, mats.rope, bridgeRotY, 0, false);
            place.addRamp(rx - perpX * ropeOffset, railY - sag, rz - perpZ * ropeOffset, 0.06, 0.06, segLen, mats.rope, bridgeRotY, 0, false);
        }

        // Crossbars at each anchor
        place.addRamp(aX, bridgeY + 0.75, aZ, 0.08, 0.08, bridgeWidth, mats.rope, bridgeRotY + Math.PI * 0.5, 0, false);
        place.addRamp(bX, bridgeY + 0.75, bZ, 0.08, 0.08, bridgeWidth, mats.rope, bridgeRotY + Math.PI * 0.5, 0, false);
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

    function buildJungleQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var center = pt(bounds, 0.50, 0.48);

        buildShrine(center.x, center.z, place, mats, ctx);

        var wfPt = pt(bounds, 0.20, 0.35);
        buildWaterfall(wfPt.x, wfPt.z, place, mats, ctx);

        // ============================================================
        // TREES -- 4 types, dramatic height variation, dense edges
        // ============================================================

        // Type D: Giant ancient trees (towering pillars of the forest)
        var giants = [
            { u: 0.12, v: 0.12, s: 1.15 },
            { u: 0.88, v: 0.85, s: 1.05 },
            { u: 0.85, v: 0.12, s: 1.1 }
        ];
        for (var gi = 0; gi < giants.length; gi++) {
            var gp = pt(bounds, giants[gi].u, giants[gi].v);
            addGiantTree(gp.x, gp.z, giants[gi].s, place, mats, ctx);
            ctx.addExclusion(gp.x, gp.z, 2.5);
        }

        // Type A: Canopy trees -- wide scale range for dramatic height contrast
        var canopyTrees = [
            // Tall sentinels (s >= 1.6)
            { u: 0.08, v: 0.45, s: 1.9 },
            { u: 0.92, v: 0.55, s: 1.8 },
            { u: 0.50, v: 0.08, s: 1.7 },
            // Medium canopy (s 1.0-1.5)
            { u: 0.18, v: 0.14, s: 1.3 },
            { u: 0.14, v: 0.80, s: 1.4 },
            { u: 0.58, v: 0.90, s: 1.2 },
            { u: 0.72, v: 0.30, s: 1.1 },
            { u: 0.30, v: 0.70, s: 1.0 },
            { u: 0.82, v: 0.68, s: 1.3 },
            // Short canopy (s 0.7-0.9) -- understory layer
            { u: 0.25, v: 0.18, s: 0.8 },
            { u: 0.75, v: 0.82, s: 0.7 },
            { u: 0.65, v: 0.15, s: 0.75 },
            { u: 0.15, v: 0.65, s: 0.85 }
        ];
        for (var t = 0; t < canopyTrees.length; t++) {
            var tp = pt(bounds, canopyTrees[t].u, canopyTrees[t].v);
            addCanopyTree(tp.x, tp.z, canopyTrees[t].s, place, mats, ctx);
        }

        // Type B: Bushy trees -- more of them, wider scale range
        var bushyTrees = [
            { u: 0.34, v: 0.12, s: 1.1 },
            { u: 0.62, v: 0.14, s: 0.8 },
            { u: 0.32, v: 0.88, s: 0.9 },
            { u: 0.84, v: 0.82, s: 0.7 },
            { u: 0.42, v: 0.72, s: 1.0 },
            // Waterfall cluster
            { u: 0.15, v: 0.28, s: 0.8 },
            { u: 0.25, v: 0.30, s: 1.2 },
            { u: 0.18, v: 0.42, s: 0.6 },
            // Additional edge density
            { u: 0.06, v: 0.70, s: 1.3 },
            { u: 0.94, v: 0.30, s: 0.9 },
            { u: 0.50, v: 0.92, s: 1.1 },
            { u: 0.70, v: 0.08, s: 0.7 }
        ];
        for (var bt = 0; bt < bushyTrees.length; bt++) {
            var btp = pt(bounds, bushyTrees[bt].u, bushyTrees[bt].v);
            addBushyTree(btp.x, btp.z, bushyTrees[bt].s, place, mats, ctx);
        }

        // Type C: Saplings -- fill gaps, especially mid-zone
        var saplings = [
            { u: 0.26, v: 0.24 }, { u: 0.74, v: 0.22 },
            { u: 0.22, v: 0.72 }, { u: 0.78, v: 0.74 },
            { u: 0.48, v: 0.84 },
            { u: 0.38, v: 0.35 }, { u: 0.62, v: 0.65 },
            { u: 0.12, v: 0.55 }, { u: 0.88, v: 0.45 },
            { u: 0.40, v: 0.15 }
        ];
        for (var sp = 0; sp < saplings.length; sp++) {
            var spp = pt(bounds, saplings[sp].u, saplings[sp].v);
            addSapling(spp.x, spp.z, place, mats);
        }

        // ============================================================
        // UNDERGROWTH -- dense fern layer
        // ============================================================
        var ferns = [
            { u: 0.20, v: 0.28 }, { u: 0.40, v: 0.18 }, { u: 0.60, v: 0.22 },
            { u: 0.75, v: 0.40 }, { u: 0.80, v: 0.70 }, { u: 0.25, v: 0.65 },
            { u: 0.55, v: 0.75 }, { u: 0.35, v: 0.55 }, { u: 0.65, v: 0.60 },
            { u: 0.15, v: 0.42 }, { u: 0.88, v: 0.38 }, { u: 0.45, v: 0.40 },
            // Additional density
            { u: 0.10, v: 0.20 }, { u: 0.90, v: 0.80 }, { u: 0.30, v: 0.15 },
            { u: 0.70, v: 0.85 }, { u: 0.08, v: 0.60 }, { u: 0.92, v: 0.40 },
            { u: 0.42, v: 0.28 }, { u: 0.58, v: 0.72 }
        ];
        for (var f = 0; f < ferns.length; f++) {
            var fp = pt(bounds, ferns[f].u, ferns[f].v);
            addFern(fp.x, fp.z, place, mats);
        }

        // ============================================================
        // LOGS
        // ============================================================
        var logs = [
            { u: 0.26, v: 0.50, ax: true },
            { u: 0.74, v: 0.48, ax: false },
            { u: 0.50, v: 0.35, ax: true },
            { u: 0.52, v: 0.76, ax: false },
            { u: 0.38, v: 0.62, ax: true }
        ];
        for (var l = 0; l < logs.length; l++) {
            var lp = pt(bounds, logs[l].u, logs[l].v);
            addLog(lp.x, lp.z, logs[l].ax, place, mats);
        }

        // ============================================================
        // MUSHROOMS
        // ============================================================
        var mushrooms = [
            { u: 0.27, v: 0.51, red: true },
            { u: 0.25, v: 0.49, red: false },
            { u: 0.73, v: 0.47, red: true },
            { u: 0.51, v: 0.23, red: false },
            { u: 0.53, v: 0.77, red: true },
            { u: 0.37, v: 0.61, red: false },
            { u: 0.60, v: 0.65, red: true },
            { u: 0.30, v: 0.38, red: false }
        ];
        for (var mi = 0; mi < mushrooms.length; mi++) {
            var mp = pt(bounds, mushrooms[mi].u, mushrooms[mi].v);
            addMushroom(mp.x, mp.z, place, mats, mushrooms[mi].red);
        }

        // ============================================================
        // ROPE BRIDGE -- anchored between giant tree (0.12,0.12) and sentinel (0.50,0.08)
        // ============================================================
        var bridgePosA = pt(bounds, giants[0].u, giants[0].v);
        var bridgePosB = pt(bounds, canopyTrees[2].u, canopyTrees[2].v);
        buildRopeBridge(bridgePosA, bridgePosB, 4.5, place, mats);

        // ============================================================
        // GROUND VINES -- snaking between trees at ground level
        // ============================================================
        var gv1a = pt(bounds, 0.18, 0.14);
        var gv1b = pt(bounds, 0.34, 0.12);
        addGroundVine(gv1a.x, gv1a.z, gv1b.x, gv1b.z, place, mats);

        var gv2a = pt(bounds, 0.14, 0.80);
        var gv2b = pt(bounds, 0.32, 0.88);
        addGroundVine(gv2a.x, gv2a.z, gv2b.x, gv2b.z, place, mats);

        var gv3a = pt(bounds, 0.82, 0.68);
        var gv3b = pt(bounds, 0.88, 0.85);
        addGroundVine(gv3a.x, gv3a.z, gv3b.x, gv3b.z, place, mats);

        var gv4a = pt(bounds, 0.60, 0.30);
        var gv4b = pt(bounds, 0.72, 0.38);
        addGroundVine(gv4a.x, gv4a.z, gv4b.x, gv4b.z, place, mats);

        // ============================================================
        // FIREFLIES -- near waterfall, shrine, and giant trees
        // ============================================================
        addFirefly(wfPt.x + 1.5, 1.2, wfPt.z + 2.0, place, mats, ctx);
        addFirefly(wfPt.x - 1.0, 0.8, wfPt.z + 3.5, place, mats, ctx);
        addFirefly(wfPt.x + 0.3, 2.0, wfPt.z + 1.0, place, mats, ctx);
        addFirefly(center.x + 2.0, 1.5, center.z - 1.0, place, mats, ctx);
        addFirefly(center.x - 1.5, 1.8, center.z + 2.0, place, mats, ctx);
        addFirefly(center.x + 0.5, 2.5, center.z, place, mats, ctx);
        // Near giant trees
        var g0 = pt(bounds, giants[0].u, giants[0].v);
        addFirefly(g0.x + 2.0, 3.0, g0.z + 1.5, place, mats, ctx);
        var g1 = pt(bounds, giants[1].u, giants[1].v);
        addFirefly(g1.x - 1.5, 2.5, g1.z - 1.0, place, mats, ctx);
        var g2 = pt(bounds, giants[2].u, giants[2].v);
        addFirefly(g2.x + 1.0, 3.5, g2.z + 0.5, place, mats, ctx);

        // ============================================================
        // FALLEN PILLAR near shrine (toppled column)
        // ============================================================
        place.addRamp(center.x + 6.0, 0.35, center.z - 2.5, 0.7, 0.7, 4.0, mats.stone, 0.3, 0.08, false);
        place.addBlock(center.x + 7.8, 0.15, center.z - 2.8, 0.9, 0.3, 0.9, mats.mossy, false);
        place.addBlock(center.x + 4.2, 0.5, center.z - 2.2, 0.8, 0.4, 0.8, mats.stone, false);

        // ============================================================
        // MOSS PATCHES on ground
        // ============================================================
        place.addBlock(wfPt.x + 2.0, 0.02, wfPt.z + 1.5, 1.5, 0.04, 1.2, mats.mossy, false);
        place.addBlock(wfPt.x - 1.5, 0.02, wfPt.z + 3.0, 1.2, 0.04, 0.9, mats.fern, false);
        place.addBlock(center.x - 3.0, 0.02, center.z + 3.5, 1.8, 0.04, 1.4, mats.mossy, false);
        place.addBlock(center.x + 4.0, 0.02, center.z - 1.5, 1.0, 0.04, 1.6, mats.fern, false);

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
