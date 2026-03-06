/**
 * quadrant-urban.js - Urban / skatepark biome quadrant builder.
 * Plug-and-play: call buildUrbanQuadrant(bounds, place, ctx) to populate any quadrant.
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            concrete:      lib.getLambert({ color: 0x7f868d }),
            concreteDark:  lib.getLambert({ color: 0x5a6068 }),
            concreteLight: lib.getLambert({ color: 0x969da4 }),
            asphalt:       lib.getLambert({ color: 0x484e54 }),
            rail:          lib.getLambert({ color: 0x595f66 }),
            railShiny:     lib.getLambert({ color: 0x8a9098 }),
            paint:         lib.getLambert({ color: 0x8a4444 }),
            paintBlue:     lib.getLambert({ color: 0x3a6a8a }),
            paintYellow:   lib.getLambert({ color: 0xc4a832 }),
            paintWhite:    lib.getLambert({ color: 0xd0d4d8 }),
            wood:          lib.getLambert({ color: 0x6a5030 }),
            lamp:          lib.getLambert({ color: 0x3a3a3a }),
            // Animated emissive -- unique instance, not shared
            lampGlow:      new THREE.MeshStandardMaterial({ color: 0xffe8a0, emissive: 0xffe8a0, emissiveIntensity: 0.6 })
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

    function buildStairSet(cx, cz, place, mats, facingZ) {
        var dir = facingZ ? 1 : -1;
        var steps = [
            { dy: 0.2,  dz: 0,     h: 0.4, w: 4.0, d: 1.2 },
            { dy: 0.5,  dz: 1.3,   h: 0.4, w: 4.0, d: 1.2 },
            { dy: 0.8,  dz: 2.6,   h: 0.4, w: 4.0, d: 1.2 },
            { dy: 1.1,  dz: 3.9,   h: 0.4, w: 4.0, d: 1.2 }
        ];
        for (var i = 0; i < steps.length; i++) {
            var s = steps[i];
            place.addBlock(cx, s.dy, cz + s.dz * dir, s.w, s.h, s.d, mats.concrete, true);
        }
        // Landing platform at top
        place.addBlock(cx, 1.1, cz + 5.0 * dir, 4.0, 0.4, 1.0, mats.concreteDark, true);

        // Handrail running diagonally alongside the stairs
        var railStartY = 0.6;
        var railEndY = 1.7;
        var railLen = 6.0;
        for (var r = 0; r < 5; r++) {
            var t = r / 4;
            var ry = railStartY + (railEndY - railStartY) * t;
            var rz = cz + (5.2 * dir * t);
            place.addBlock(cx + 2.2, ry, rz, 0.08, 0.08, 1.3, mats.railShiny, false);
        }
        // Rail posts
        place.addBlock(cx + 2.2, 0.35, cz, 0.08, 0.7, 0.08, mats.rail, false);
        place.addBlock(cx + 2.2, 1.0, cz + 5.0 * dir, 0.08, 1.0, 0.08, mats.rail, false);
    }

    function buildQuarterPipe(cx, cz, place, mats) {
        var slices = [
            { dz: 0,    y: 0.15, h: 0.3, tilt: 0 },
            { dz: 0.7,  y: 0.4,  h: 0.35, tilt: -0.08 },
            { dz: 1.3,  y: 0.75, h: 0.45, tilt: -0.18 },
            { dz: 1.8,  y: 1.2,  h: 0.55, tilt: -0.30 },
            { dz: 2.1,  y: 1.8,  h: 0.65, tilt: -0.45 }
        ];
        for (var i = 0; i < slices.length; i++) {
            var s = slices[i];
            place.addRamp(cx, s.y, cz + s.dz, 5.5, s.h, 1.0, mats.concrete, 0, s.tilt, true);
        }
        // Coping rail at the lip
        place.addBlock(cx, 2.25, cz + 2.3, 5.5, 0.1, 0.1, mats.railShiny, false);
    }

    function buildFlatLedge(cx, cz, place, mats, rotated) {
        var w = rotated ? 2.0 : 6.0;
        var d = rotated ? 6.0 : 2.0;
        place.addBlock(cx, 0.4, cz, w, 0.8, d, mats.concreteDark, true);
        place.addBlock(cx, 0.9, cz, w * 0.92, 0.1, d * 0.92, mats.railShiny, true);
    }

    function buildKicker(cx, cz, place, mats, rotY) {
        place.addRamp(cx, 0.5, cz, 2.8, 0.8, 2.0, mats.concrete, rotY, -0.35, true);
        place.addBlock(cx, 0.1, cz, 2.8, 0.2, 2.0, mats.asphalt, true);
    }

    function buildBench(cx, cz, place, mats) {
        place.addBlock(cx, 0.3, cz, 1.8, 0.1, 0.6, mats.wood, false);
        place.addBlock(cx - 0.7, 0.15, cz, 0.12, 0.3, 0.5, mats.rail, false);
        place.addBlock(cx + 0.7, 0.15, cz, 0.12, 0.3, 0.5, mats.rail, false);
        place.addBlock(cx, 0.55, cz + 0.28, 1.8, 0.5, 0.08, mats.wood, false);
    }

    function buildStreetLamp(cx, cz, place, mats, ctx) {
        place.addBlock(cx, 2.5, cz, 0.12, 5.0, 0.12, mats.lamp, false);
        place.addBlock(cx, 4.9, cz + 0.4, 0.1, 0.1, 0.8, mats.lamp, false);
        var glowMesh = place.addBlock(cx, 4.75, cz + 0.8, 0.3, 0.15, 0.3, mats.lampGlow, false);
        ctx.addFlicker({ material: mats.lampGlow, freq: 3.5, phase: cx * 1.7 });
        return glowMesh;
    }

    function addGraffitiStripe(cx, cz, w, h, place, mat, offsetY) {
        place.addBlock(cx, offsetY, cz, w, h, 0.15, mat, false);
    }

    function buildUrbanQuadrant(bounds, place, ctx) {
        var mats = ensureMats();

        // Stair set with handrail (the iconic skate element)
        var stairPt = pt(bounds, 0.30, 0.28);
        buildStairSet(stairPt.x, stairPt.z, place, mats, true);
        ctx.addExclusion(stairPt.x, stairPt.z + 2.5, 4.0);

        // Quarter pipe along one edge
        var qpPt = pt(bounds, 0.72, 0.20);
        buildQuarterPipe(qpPt.x, qpPt.z, place, mats);
        ctx.addExclusion(qpPt.x, qpPt.z + 1.0, 3.5);

        // Opposing quarter pipe
        var qp2 = pt(bounds, 0.28, 0.78);
        place.addRamp(qp2.x, 0.15, qp2.z, 5.5, 0.3, 1.0, mats.concrete, Math.PI, 0, true);
        place.addRamp(qp2.x, 0.4, qp2.z - 0.7, 5.5, 0.35, 1.0, mats.concrete, Math.PI, 0.08, true);
        place.addRamp(qp2.x, 0.75, qp2.z - 1.3, 5.5, 0.45, 1.0, mats.concrete, Math.PI, 0.18, true);
        place.addRamp(qp2.x, 1.2, qp2.z - 1.8, 5.5, 0.55, 1.0, mats.concrete, Math.PI, 0.30, true);
        place.addBlock(qp2.x, 1.55, qp2.z - 2.0, 5.5, 0.1, 0.1, mats.railShiny, false);

        // Center flat ledge (the grind box)
        var centerPt = pt(bounds, 0.50, 0.50);
        buildFlatLedge(centerPt.x, centerPt.z, place, mats, false);

        // Side ledge (rotated)
        var sidePt = pt(bounds, 0.82, 0.55);
        buildFlatLedge(sidePt.x, sidePt.z, place, mats, true);

        // Kicker ramps
        var kickA = pt(bounds, 0.55, 0.30);
        buildKicker(kickA.x, kickA.z, place, mats, 0);
        var kickB = pt(bounds, 0.45, 0.72);
        buildKicker(kickB.x, kickB.z, place, mats, Math.PI);

        // Manual pad (low flat box for manuals)
        var manPt = pt(bounds, 0.65, 0.68);
        place.addBlock(manPt.x, 0.12, manPt.z, 3.5, 0.24, 2.0, mats.concreteLight, true);
        // Painted line on the pad
        place.addBlock(manPt.x, 0.25, manPt.z, 3.3, 0.02, 0.08, mats.paintWhite, false);

        // Graffiti walls
        var wallA = pt(bounds, 0.08, 0.50);
        place.addBlock(wallA.x, 1.4, wallA.z, 0.6, 2.8, 5.5, mats.concrete, true);
        addGraffitiStripe(wallA.x - 0.32, wallA.z - 1.0, 0.15, 0.8, place, mats.paint, 1.6);
        addGraffitiStripe(wallA.x - 0.32, wallA.z + 0.5, 0.15, 0.5, place, mats.paintBlue, 1.2);
        addGraffitiStripe(wallA.x - 0.32, wallA.z + 1.8, 0.15, 1.2, place, mats.paintYellow, 1.8);
        addGraffitiStripe(wallA.x - 0.32, wallA.z - 0.3, 0.15, 0.3, place, mats.paintWhite, 2.2);

        var wallB = pt(bounds, 0.92, 0.50);
        place.addBlock(wallB.x, 1.4, wallB.z, 0.6, 2.8, 5.5, mats.concrete, true);
        addGraffitiStripe(wallB.x + 0.32, wallB.z + 1.2, 0.15, 0.6, place, mats.paintBlue, 1.4);
        addGraffitiStripe(wallB.x + 0.32, wallB.z - 0.8, 0.15, 1.0, place, mats.paint, 1.9);
        addGraffitiStripe(wallB.x + 0.32, wallB.z + 0.2, 0.15, 0.4, place, mats.paintYellow, 2.4);

        // Benches
        var benchA = pt(bounds, 0.15, 0.22);
        buildBench(benchA.x, benchA.z, place, mats);
        var benchB = pt(bounds, 0.85, 0.82);
        buildBench(benchB.x, benchB.z, place, mats);

        // Street lamps for vertical interest
        var lampA = pt(bounds, 0.12, 0.35);
        buildStreetLamp(lampA.x, lampA.z, place, mats, ctx);
        var lampB = pt(bounds, 0.88, 0.65);
        buildStreetLamp(lampB.x, lampB.z, place, mats, ctx);

        // Concrete barriers (jersey barriers)
        var barrA = pt(bounds, 0.38, 0.15);
        place.addBlock(barrA.x, 0.35, barrA.z, 2.4, 0.7, 0.6, mats.concreteDark, true);
        place.addBlock(barrA.x, 0.35, barrA.z, 2.0, 0.5, 0.4, mats.concreteLight, false);

        var barrB = pt(bounds, 0.62, 0.85);
        place.addBlock(barrB.x, 0.35, barrB.z, 2.4, 0.7, 0.6, mats.concreteDark, true);
        place.addBlock(barrB.x, 0.35, barrB.z, 2.0, 0.5, 0.4, mats.concreteLight, false);

        // Ground markings (painted lines on the asphalt)
        var gm = pt(bounds, 0.50, 0.50);
        place.addBlock(gm.x - 8, 0.01, gm.z, 0.08, 0.02, 20, mats.paintWhite, false);
        place.addBlock(gm.x + 8, 0.01, gm.z, 0.08, 0.02, 20, mats.paintWhite, false);

        return {};
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.urban = buildUrbanQuadrant;
})();
