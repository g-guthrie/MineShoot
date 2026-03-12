import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';
import { GameMaterialLibrary } from './material-library.js';

const THREE = globalThis.THREE;

/**
 * quadrant-radar.js - Sensor yard with dishes, relay mast, and bunker cover.
 */
    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = GameMaterialLibrary;
        MATS = {
            base: lib.getLambert({ color: 0x8e9690 }),
            dark: lib.getLambert({ color: 0x576169 }),
            panel: lib.getLambert({ color: 0xcad6d0 }),
            support: lib.getLambert({ color: 0x71808a }),
            accent: lib.getLambert({ color: 0xadd8d6 }),
            glow: new THREE.MeshStandardMaterial({ color: 0xadd8d6, emissive: 0xadd8d6, emissiveIntensity: 0.55 })
        };
        return MATS;
    }

    function buildDish(cx, cz, size, place, mats) {
        place.addBlock(cx, 1.1, cz, 2.8 * size, 2.2, 2.8 * size, mats.support, true);
        place.addBlock(cx, 2.5, cz, 4.2 * size, 0.3, 4.2 * size, mats.panel, false);
        place.addBlock(cx, 2.9, cz, 3.2 * size, 0.22, 3.2 * size, mats.base, false);
        place.addBlock(cx, 3.35, cz, 1.3 * size, 0.7, 1.3 * size, mats.support, true);
        place.addBlock(cx + 0.8 * size, 3.8, cz - 0.3 * size, 1.4 * size, 0.16, 0.16, mats.panel, false);
    }

    export function buildRadarQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var mast = pt(bounds, 0.5, 0.48);

        place.addBlock(mast.x, 0.45, mast.z, 12.8, 0.9, 12.8, mats.dark, true);
        place.addBlock(mast.x, 3.5, mast.z, 1.0, 7.0, 1.0, mats.support, true);
        place.addBlock(mast.x, 7.3, mast.z, 4.8, 0.18, 0.18, mats.panel, false);
        place.addBlock(mast.x, 7.3, mast.z, 0.18, 0.18, 4.8, mats.panel, false);
        place.addBlock(mast.x, 8.6, mast.z, 0.38, 0.26, 0.38, mats.accent, false);
        ctx.addExclusion(mast.x, mast.z, 4.6);

        var dishA = pt(bounds, 0.2, 0.2);
        var dishB = pt(bounds, 0.78, 0.28);
        buildDish(dishA.x, dishA.z, 1.0, place, mats);
        buildDish(dishB.x, dishB.z, 0.9, place, mats);
        ctx.addExclusion(dishA.x, dishA.z, 3.0);
        ctx.addExclusion(dishB.x, dishB.z, 2.8);

        var bunkerA = pt(bounds, 0.18, 0.78);
        var bunkerB = pt(bounds, 0.78, 0.78);
        place.addBlock(bunkerA.x, 1.6, bunkerA.z, 8.4, 3.2, 5.6, mats.base, true);
        place.addBlock(bunkerA.x, 3.3, bunkerA.z, 9.0, 0.18, 6.2, mats.panel, false);
        place.addRamp(bunkerA.x + 3.8, 0.9, bunkerA.z + 0.8, 2.4, 0.7, 4.4, mats.base, 1.1, -0.18, true);
        place.addBlock(bunkerB.x, 1.3, bunkerB.z, 6.6, 2.6, 4.8, mats.base, true);
        place.addBlock(bunkerB.x, 2.72, bunkerB.z, 7.0, 0.16, 5.2, mats.panel, false);

        place.addBlock(mast.x - 11.0, 0.26, mast.z, 3.0, 0.52, 16.0, mats.dark, true);
        place.addBlock(mast.x + 11.0, 0.26, mast.z, 3.0, 0.52, 16.0, mats.dark, true);
        place.addBlock(mast.x, 0.18, mast.z - 11.2, 17.2, 0.36, 2.8, mats.dark, true);

        var beaconA = place.addBlock(dishA.x, 4.2, dishA.z, 0.24, 0.18, 0.24, cloneMaterial(mats.glow), false);
        var beaconB = place.addBlock(dishB.x, 4.0, dishB.z, 0.24, 0.18, 0.24, cloneMaterial(mats.glow), false);
        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({ material: beaconA.material, freq: 3.1, phase: 1.1 });
            ctx.addFlicker({ material: beaconB.material, freq: 2.5, phase: 2.9 });
        }

        return {
            dishes: 2,
            bunkers: 2,
            masts: 1
        };
    }
