import { pointInBounds as pt } from './biome-utils.js';
import { GameMaterialLibrary } from './material-library.js';

const THREE = globalThis.THREE;

/**
 * quadrant-urban.js - Urban / skatepark biome quadrant builder.
 * Plug-and-play: call buildUrbanQuadrant(bounds, place, ctx) to populate any quadrant.
 */
    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = GameMaterialLibrary;
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

        // One continuous handrail reads much cleaner than stacked floating segments.
        var railX = cx + 2.2;
        var railStartY = 0.62;
        var railEndY = 1.68;
        var railSpan = 5.2;
        place.addRamp(
            railX,
            (railStartY + railEndY) * 0.5,
            cz + (railSpan * dir * 0.5),
            0.08,
            0.08,
            railSpan + 0.35,
            mats.railShiny,
            0,
            dir > 0 ? -0.2 : 0.2,
            false
        );

        // Rail posts sit just off the rail centerline to avoid surface fighting.
        var railPostX = railX - 0.06;
        place.addBlock(railPostX, 0.35, cz, 0.08, 0.7, 0.08, mats.rail, false);
        place.addBlock(railPostX, 0.84, cz + 2.6 * dir, 0.08, 1.0, 0.08, mats.rail, false);
        place.addBlock(railPostX, 0.94, cz + 5.0 * dir, 0.08, 1.48, 0.08, mats.rail, false);
        place.addRamp(
            railPostX,
            0.86,
            cz + (railSpan * dir * 0.5),
            0.06,
            0.06,
            railSpan,
            mats.rail,
            0,
            dir > 0 ? -0.16 : 0.16,
            false
        );
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
        place.addBlock(cx, 2.165, cz + 2.3, 5.5, 0.1, 0.1, mats.railShiny, false);
    }

    function buildFlatLedge(cx, cz, place, mats, rotated) {
        var w = rotated ? 2.0 : 6.0;
        var d = rotated ? 6.0 : 2.0;
        place.addBlock(cx, 0.4, cz, w, 0.8, d, mats.concreteDark, true);
        place.addBlock(cx, 0.9, cz, w * 0.92, 0.1, d * 0.92, mats.railShiny, false);
    }

    function buildKicker(cx, cz, place, mats, rotY) {
        place.addRamp(cx, 0.5, cz, 2.8, 0.8, 2.0, mats.concrete, rotY, -0.35, true);
        place.addBlock(cx, 0.04, cz, 2.8, 0.08, 2.0, mats.asphalt, true);
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

    function buildSunkenPlaza(cx, cz, place, mats) {
        // Outer ring and retaining walls.
        place.addBlock(cx, 0.6, cz, 12.8, 1.2, 10.8, mats.concreteDark, true);
        place.addBlock(cx, 0.22, cz, 9.4, 0.44, 7.6, mats.asphalt, false);
        place.addBlock(cx, 1.1, cz - 4.6, 9.8, 1.0, 0.9, mats.concrete, true);
        place.addBlock(cx, 1.1, cz + 4.6, 9.8, 1.0, 0.9, mats.concrete, true);
        place.addBlock(cx - 5.6, 1.1, cz, 0.9, 1.0, 8.8, mats.concrete, true);
        place.addBlock(cx + 5.6, 1.1, cz, 0.9, 1.0, 8.8, mats.concrete, true);

        // Interior islands and bowl steps.
        place.addBlock(cx, 0.36, cz, 4.2, 0.72, 2.8, mats.concreteLight, true);
        place.addBlock(cx, 0.82, cz - 0.2, 2.6, 0.22, 1.4, mats.railShiny, false);
        place.addRamp(cx, 0.32, cz - 3.0, 4.4, 0.42, 2.6, mats.concrete, 0, -0.22, true);
        place.addRamp(cx, 0.32, cz + 3.0, 4.4, 0.42, 2.6, mats.concrete, Math.PI, -0.22, true);
        place.addRamp(cx - 3.8, 0.32, cz, 2.8, 0.42, 2.2, mats.concrete, Math.PI * 0.5, -0.22, true);
        place.addRamp(cx + 3.8, 0.32, cz, 2.8, 0.42, 2.2, mats.concrete, -Math.PI * 0.5, -0.22, true);

        // Side descents.
        place.addBlock(cx - 4.2, 0.18, cz - 2.6, 1.6, 0.36, 1.0, mats.concreteLight, true);
        place.addBlock(cx - 4.2, 0.36, cz - 1.5, 1.6, 0.24, 1.0, mats.concrete, true);
        place.addBlock(cx - 4.2, 0.54, cz - 0.4, 1.6, 0.18, 1.0, mats.concreteDark, true);
        place.addBlock(cx + 4.1, 0.18, cz + 2.6, 1.6, 0.36, 1.0, mats.concreteLight, true);
        place.addBlock(cx + 4.1, 0.36, cz + 1.5, 1.6, 0.24, 1.0, mats.concrete, true);
        place.addBlock(cx + 4.1, 0.54, cz + 0.4, 1.6, 0.18, 1.0, mats.concreteDark, true);
    }

    function buildBillboardFrame(cx, cz, place, mats) {
        place.addBlock(cx - 2.8, 5.0, cz, 0.5, 10.0, 0.5, mats.rail, true);
        place.addBlock(cx + 2.8, 4.7, cz + 0.4, 0.5, 9.4, 0.5, mats.rail, true);
        place.addBlock(cx, 9.1, cz + 0.2, 6.6, 0.5, 0.7, mats.railShiny, true);
        place.addBlock(cx, 6.2, cz + 0.55, 6.0, 4.8, 0.22, mats.concreteDark, true);
        addGraffitiStripe(cx - 1.8, cz + 0.72, 0.28, 1.6, place, mats.paintYellow, 6.5);
        addGraffitiStripe(cx - 0.4, cz + 0.72, 0.28, 2.2, place, mats.paintBlue, 6.2);
        addGraffitiStripe(cx + 1.1, cz + 0.72, 0.28, 1.4, place, mats.paint, 6.7);
        place.addRamp(cx - 2.8, 1.5, cz - 1.2, 0.24, 0.24, 3.2, mats.rail, 0.24, 0.4, false);
        place.addRamp(cx + 2.8, 1.3, cz - 1.1, 0.24, 0.24, 2.8, mats.rail, -0.18, 0.38, false);
    }

    function buildShelter(cx, cz, place, mats) {
        place.addBlock(cx, 2.2, cz, 5.8, 0.4, 4.0, mats.concreteDark, true);
        place.addBlock(cx - 2.2, 1.1, cz - 1.3, 0.36, 2.2, 0.36, mats.rail, true);
        place.addBlock(cx + 2.2, 1.1, cz - 1.3, 0.36, 2.2, 0.36, mats.rail, true);
        place.addBlock(cx - 2.0, 1.1, cz + 1.3, 0.36, 2.2, 0.36, mats.rail, true);
        place.addBlock(cx + 2.0, 1.1, cz + 1.3, 0.36, 2.2, 0.36, mats.rail, true);
        place.addBlock(cx, 0.5, cz, 4.8, 1.0, 2.8, mats.concreteLight, true);
        place.addBlock(cx, 1.35, cz, 4.2, 0.12, 2.2, mats.railShiny, false);
        addGraffitiStripe(cx - 2.1, cz - 0.7, 0.15, 1.1, place, mats.paintBlue, 1.0);
        addGraffitiStripe(cx + 2.1, cz + 0.6, 0.15, 0.9, place, mats.paintYellow, 1.2);
    }

    function buildOverpassFragment(cx, cz, place, mats) {
        place.addBlock(cx, 3.0, cz, 8.2, 0.8, 3.2, mats.concrete, true);
        place.addBlock(cx - 3.1, 1.5, cz - 0.8, 0.8, 3.0, 1.2, mats.concreteDark, true);
        place.addBlock(cx + 2.7, 1.4, cz + 0.7, 0.8, 2.8, 1.2, mats.concreteDark, true);
        place.addRamp(cx + 4.2, 1.3, cz + 0.6, 2.6, 0.8, 4.8, mats.concrete, 1.12, -0.22, true);
        place.addBlock(cx - 1.2, 3.55, cz, 3.4, 0.12, 0.18, mats.paintWhite, false);
        place.addBlock(cx + 2.0, 3.55, cz, 1.4, 0.12, 0.18, mats.paintYellow, false);
    }

    export function buildUrbanQuadrant(bounds, place, ctx) {
        var mats = ensureMats();

        var centerPt = pt(bounds, 0.52, 0.52);
        buildSunkenPlaza(centerPt.x, centerPt.z, place, mats);
        ctx.addExclusion(centerPt.x, centerPt.z, 6.4);

        var billboardPt = pt(bounds, 0.80, 0.18);
        buildBillboardFrame(billboardPt.x, billboardPt.z, place, mats);
        ctx.addExclusion(billboardPt.x, billboardPt.z, 4.4);

        var shelterPt = pt(bounds, 0.20, 0.74);
        buildShelter(shelterPt.x, shelterPt.z, place, mats);
        ctx.addExclusion(shelterPt.x, shelterPt.z, 4.0);

        var overpassPt = pt(bounds, 0.22, 0.26);
        buildOverpassFragment(overpassPt.x, overpassPt.z, place, mats);
        ctx.addExclusion(overpassPt.x, overpassPt.z, 4.4);

        // Keep skate DNA, but cluster it around the larger brutalist masses.
        var stairPt = pt(bounds, 0.62, 0.32);
        buildStairSet(stairPt.x, stairPt.z, place, mats, true);
        ctx.addExclusion(stairPt.x, stairPt.z + 2.3, 4.0);

        var qpPt = pt(bounds, 0.74, 0.70);
        buildQuarterPipe(qpPt.x, qpPt.z, place, mats);
        ctx.addExclusion(qpPt.x, qpPt.z + 1.0, 3.6);

        var qp2 = pt(bounds, 0.38, 0.80);
        place.addRamp(qp2.x, 0.15, qp2.z, 5.5, 0.3, 1.0, mats.concrete, Math.PI, 0, true);
        place.addRamp(qp2.x, 0.4, qp2.z - 0.7, 5.5, 0.35, 1.0, mats.concrete, Math.PI, 0.08, true);
        place.addRamp(qp2.x, 0.75, qp2.z - 1.3, 5.5, 0.45, 1.0, mats.concrete, Math.PI, 0.18, true);
        place.addRamp(qp2.x, 1.2, qp2.z - 1.8, 5.5, 0.55, 1.0, mats.concrete, Math.PI, 0.30, true);
        place.addBlock(qp2.x, 1.47, qp2.z - 2.0, 5.5, 0.1, 0.1, mats.railShiny, false);

        var sidePt = pt(bounds, 0.84, 0.52);
        buildFlatLedge(sidePt.x, sidePt.z, place, mats, true);

        var centerLedge = pt(bounds, 0.60, 0.58);
        buildFlatLedge(centerLedge.x, centerLedge.z, place, mats, false);

        var kickA = pt(bounds, 0.47, 0.34);
        buildKicker(kickA.x, kickA.z, place, mats, 0);
        var kickB = pt(bounds, 0.68, 0.64);
        buildKicker(kickB.x, kickB.z, place, mats, Math.PI * 0.5);

        var manPt = pt(bounds, 0.78, 0.42);
        place.addBlock(manPt.x, 0.12, manPt.z, 3.7, 0.24, 2.1, mats.concreteLight, true);
        place.addBlock(manPt.x, 0.262, manPt.z, 3.5, 0.02, 0.08, mats.paintWhite, false);

        // Graffiti walls and blocker slabs.
        var wallA = pt(bounds, 0.10, 0.52);
        place.addBlock(wallA.x, 1.8, wallA.z, 0.7, 3.6, 6.2, mats.concrete, true);
        addGraffitiStripe(wallA.x - 0.37, wallA.z - 1.2, 0.15, 1.0, place, mats.paint, 2.0);
        addGraffitiStripe(wallA.x - 0.37, wallA.z + 0.4, 0.15, 0.7, place, mats.paintBlue, 1.5);
        addGraffitiStripe(wallA.x - 0.37, wallA.z + 1.9, 0.15, 1.4, place, mats.paintYellow, 2.1);

        var wallB = pt(bounds, 0.92, 0.58);
        place.addBlock(wallB.x, 1.8, wallB.z, 0.7, 3.6, 6.0, mats.concrete, true);
        addGraffitiStripe(wallB.x + 0.36, wallB.z + 1.0, 0.15, 0.8, place, mats.paintBlue, 1.8);
        addGraffitiStripe(wallB.x + 0.36, wallB.z - 0.8, 0.15, 1.2, place, mats.paint, 2.0);
        addGraffitiStripe(wallB.x + 0.36, wallB.z + 0.1, 0.15, 0.5, place, mats.paintYellow, 2.5);

        var slabA = pt(bounds, 0.34, 0.46);
        place.addBlock(slabA.x, 0.55, slabA.z, 3.0, 1.1, 1.3, mats.concreteDark, true);
        place.addBlock(slabA.x, 1.14, slabA.z, 2.5, 0.12, 1.0, mats.railShiny, false);
        var slabB = pt(bounds, 0.70, 0.18);
        place.addBlock(slabB.x, 0.6, slabB.z, 2.6, 1.2, 1.1, mats.concreteDark, true);
        place.addBlock(slabB.x, 1.24, slabB.z, 2.0, 0.12, 0.9, mats.railShiny, false);

        // Benches and lamps for readable street dressing.
        var benchA = pt(bounds, 0.14, 0.18);
        buildBench(benchA.x, benchA.z, place, mats);
        var benchB = pt(bounds, 0.88, 0.84);
        buildBench(benchB.x, benchB.z, place, mats);
        var benchC = pt(bounds, 0.54, 0.18);
        buildBench(benchC.x, benchC.z, place, mats);

        var lampA = pt(bounds, 0.16, 0.34);
        buildStreetLamp(lampA.x, lampA.z, place, mats, ctx);
        var lampB = pt(bounds, 0.86, 0.62);
        buildStreetLamp(lampB.x, lampB.z, place, mats, ctx);
        var lampC = pt(bounds, 0.58, 0.12);
        buildStreetLamp(lampC.x, lampC.z, place, mats, ctx);

        return {};
    }
