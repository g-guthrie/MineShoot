import { pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-citadel.js - Central hero landmark with stacked walkways and a climbable spire.
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            stone: lib.getLambert({ color: 0x726c64 }),
            darkStone: lib.getLambert({ color: 0x4b4740 }),
            lightStone: lib.getLambert({ color: 0x958d83 }),
            bronze: lib.getLambert({ color: 0xb38c46 }),
            glow: new THREE.MeshStandardMaterial({ color: 0xe4cf85, emissive: 0xe4cf85, emissiveIntensity: 0.65 })
        };
        return MATS;
    }

    function buildApproachStair(cx, cz, rotY, place, mats) {
        for (var i = 0; i < 4; i++) {
            place.addRamp(
                cx + Math.sin(rotY) * (i * 0.8),
                0.18 + (i * 0.24),
                cz + Math.cos(rotY) * (i * 0.8),
                4.2,
                0.36,
                1.0,
                mats.stone,
                rotY,
                -0.16,
                true
            );
        }
    }

    function buildCitadelQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var center = pt(bounds, 0.5, 0.5);

        place.addBlock(center.x, 0.7, center.z, 30.0, 1.4, 30.0, mats.darkStone, true);
        place.addBlock(center.x, 1.75, center.z, 24.8, 0.7, 24.8, mats.stone, true);
        place.addBlock(center.x, 2.75, center.z, 18.8, 1.3, 18.8, mats.darkStone, true);
        place.addBlock(center.x, 3.7, center.z, 13.4, 0.9, 13.4, mats.lightStone, true);

        buildApproachStair(center.x, center.z - 14.0, 0, place, mats);
        buildApproachStair(center.x + 14.0, center.z, Math.PI * 0.5, place, mats);
        buildApproachStair(center.x, center.z + 14.0, Math.PI, place, mats);
        buildApproachStair(center.x - 14.0, center.z, -Math.PI * 0.5, place, mats);

        place.addBlock(center.x, 6.3, center.z, 9.2, 5.2, 9.2, mats.stone, true);
        place.addBlock(center.x, 9.7, center.z, 6.8, 1.5, 6.8, mats.lightStone, true);
        place.addBlock(center.x, 12.0, center.z, 4.2, 3.0, 4.2, mats.lightStone, true);
        place.addBlock(center.x, 14.3, center.z, 2.2, 1.6, 2.2, mats.bronze, true);

        place.addBlock(center.x, 7.8, center.z - 6.0, 12.0, 0.24, 0.8, mats.bronze, false);
        place.addBlock(center.x, 7.8, center.z + 6.0, 12.0, 0.24, 0.8, mats.bronze, false);
        place.addBlock(center.x - 6.0, 7.8, center.z, 0.8, 0.24, 12.0, mats.bronze, false);
        place.addBlock(center.x + 6.0, 7.8, center.z, 0.8, 0.24, 12.0, mats.bronze, false);

        place.addRamp(center.x - 7.0, 4.3, center.z, 4.0, 0.9, 8.2, mats.stone, Math.PI * 0.5, -0.2, true);
        place.addRamp(center.x + 7.0, 4.3, center.z, 4.0, 0.9, 8.2, mats.stone, -Math.PI * 0.5, -0.2, true);
        place.addRamp(center.x, 4.3, center.z - 7.0, 8.2, 0.9, 4.0, mats.stone, 0, -0.2, true);
        place.addRamp(center.x, 4.3, center.z + 7.0, 8.2, 0.9, 4.0, mats.stone, Math.PI, -0.2, true);

        place.addBlock(center.x - 7.0, 3.0, center.z - 7.0, 2.6, 4.2, 2.6, mats.stone, true);
        place.addBlock(center.x + 7.0, 3.0, center.z - 7.0, 2.6, 4.2, 2.6, mats.stone, true);
        place.addBlock(center.x - 7.0, 3.0, center.z + 7.0, 2.6, 4.2, 2.6, mats.stone, true);
        place.addBlock(center.x + 7.0, 3.0, center.z + 7.0, 2.6, 4.2, 2.6, mats.stone, true);
        place.addBlock(center.x - 7.0, 5.45, center.z - 7.0, 3.2, 0.26, 3.2, mats.lightStone, false);
        place.addBlock(center.x + 7.0, 5.45, center.z - 7.0, 3.2, 0.26, 3.2, mats.lightStone, false);
        place.addBlock(center.x - 7.0, 5.45, center.z + 7.0, 3.2, 0.26, 3.2, mats.lightStone, false);
        place.addBlock(center.x + 7.0, 5.45, center.z + 7.0, 3.2, 0.26, 3.2, mats.lightStone, false);

        place.addRamp(center.x - 4.9, 5.2, center.z, 3.4, 0.9, 6.8, mats.stone, Math.PI * 0.5, -0.2, true);
        place.addRamp(center.x + 4.9, 5.2, center.z, 3.4, 0.9, 6.8, mats.stone, -Math.PI * 0.5, -0.2, true);
        place.addRamp(center.x, 5.2, center.z - 4.9, 6.8, 0.9, 3.4, mats.stone, 0, -0.2, true);
        place.addRamp(center.x, 5.2, center.z + 4.9, 6.8, 0.9, 3.4, mats.stone, Math.PI, -0.2, true);

        place.addBlock(center.x - 1.6, 10.8, center.z, 0.8, 2.0, 0.8, mats.lightStone, true);
        place.addBlock(center.x + 1.6, 10.8, center.z, 0.8, 2.0, 0.8, mats.lightStone, true);
        place.addBlock(center.x, 10.8, center.z - 1.6, 0.8, 2.0, 0.8, mats.lightStone, true);
        place.addBlock(center.x, 10.8, center.z + 1.6, 0.8, 2.0, 0.8, mats.lightStone, true);

        var beacon = place.addBlock(center.x, 15.7, center.z, 0.46, 0.24, 0.46, mats.glow, false);
        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({ material: beacon.material, freq: 2.1, phase: 0.8 });
        }

        ctx.addExclusion(center.x, center.z, 8.6);

        return {
            towers: 5,
            rings: 3,
            stairs: 4
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.citadel = buildCitadelQuadrant;
})();
