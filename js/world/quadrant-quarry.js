import { pointInBounds as pt } from './biome-utils.js';
import { GameMaterialLibrary } from './material-library.js';

const THREE = globalThis.THREE;

/**
 * quadrant-quarry.js - Terraced excavation zone with crane lane breaks and raised catwalks.
 */
    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = GameMaterialLibrary;
        MATS = {
            rock: lib.getLambert({ color: 0x816e61 }),
            darkRock: lib.getLambert({ color: 0x5b4b42 }),
            dust: lib.getLambert({ color: 0xb59d88 }),
            steel: lib.getLambert({ color: 0x61696f }),
            stripe: lib.getLambert({ color: 0xc99543 }),
            ore: lib.getLambert({ color: 0x6b868a })
        };
        return MATS;
    }

    export function buildQuarryQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var center = pt(bounds, 0.42, 0.56);

        place.addBlock(center.x, 0.28, center.z, 22.0, 0.56, 18.0, mats.darkRock, true);
        place.addBlock(center.x - 1.0, 0.7, center.z - 0.8, 17.0, 0.84, 13.0, mats.rock, true);
        place.addBlock(center.x - 1.4, 1.2, center.z - 1.1, 12.0, 0.9, 9.0, mats.dust, true);
        place.addBlock(center.x - 2.0, 1.6, center.z - 1.4, 7.8, 0.76, 5.6, mats.darkRock, true);
        place.addBlock(center.x - 2.0, 2.2, center.z - 1.4, 4.2, 0.4, 2.6, mats.ore, true);

        place.addRamp(center.x + 7.6, 1.4, center.z + 4.1, 3.2, 0.8, 7.4, mats.rock, 1.0, -0.22, true);
        place.addRamp(center.x + 5.8, 0.7, center.z - 4.8, 2.6, 0.6, 6.0, mats.rock, -0.82, -0.18, true);
        place.addRamp(center.x - 7.2, 1.0, center.z + 5.2, 2.8, 0.7, 6.6, mats.darkRock, -1.08, -0.2, true);

        var crane = pt(bounds, 0.76, 0.22);
        place.addBlock(crane.x - 2.8, 4.2, crane.z, 0.8, 8.4, 0.8, mats.steel, true);
        place.addBlock(crane.x + 2.8, 3.6, crane.z + 0.4, 0.8, 7.2, 0.8, mats.steel, true);
        place.addBlock(crane.x, 7.3, crane.z + 0.2, 8.2, 0.5, 0.8, mats.steel, true);
        place.addBlock(crane.x + 1.8, 6.1, crane.z + 1.4, 0.16, 2.2, 0.16, mats.steel, false);
        place.addBlock(crane.x + 1.8, 4.8, crane.z + 1.4, 1.6, 0.32, 1.6, mats.ore, true);
        ctx.addExclusion(crane.x, crane.z, 4.4);

        var catwalk = pt(bounds, 0.66, 0.72);
        place.addBlock(catwalk.x, 2.5, catwalk.z, 10.8, 0.24, 1.6, mats.steel, true);
        place.addBlock(catwalk.x - 4.9, 1.25, catwalk.z - 0.2, 0.3, 2.5, 0.3, mats.steel, true);
        place.addBlock(catwalk.x + 4.9, 1.25, catwalk.z + 0.2, 0.3, 2.5, 0.3, mats.steel, true);
        place.addRamp(catwalk.x - 6.8, 1.2, catwalk.z - 0.2, 2.2, 0.6, 4.8, mats.steel, 1.1, -0.22, true);
        place.addRamp(catwalk.x + 6.6, 1.1, catwalk.z + 0.2, 2.2, 0.6, 4.4, mats.steel, -1.02, -0.22, true);

        var drill = pt(bounds, 0.18, 0.22);
        place.addBlock(drill.x, 0.42, drill.z, 5.0, 0.84, 5.0, mats.darkRock, true);
        place.addBlock(drill.x, 2.4, drill.z, 0.8, 4.0, 0.8, mats.steel, true);
        place.addBlock(drill.x, 4.3, drill.z, 2.6, 0.24, 2.6, mats.stripe, false);
        place.addRamp(drill.x, 1.05, drill.z + 2.8, 2.4, 0.5, 3.8, mats.rock, Math.PI, -0.18, true);
        ctx.addExclusion(drill.x, drill.z, 3.8);

        var ridgeA = pt(bounds, 0.1, 0.86);
        var ridgeB = pt(bounds, 0.88, 0.86);
        place.addBlock(ridgeA.x, 0.38, ridgeA.z, 4.0, 0.76, 3.0, mats.rock, true);
        place.addBlock(ridgeB.x, 0.46, ridgeB.z, 5.4, 0.92, 3.6, mats.darkRock, true);

        return {
            pits: 1,
            cranes: 1,
            catwalks: 1
        };
    }
