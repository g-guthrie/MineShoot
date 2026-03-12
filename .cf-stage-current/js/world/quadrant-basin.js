import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-basin.js - Flood-control basin with channels, pump house, and elevated catwalks.
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            concrete: lib.getLambert({ color: 0x6e7a81 }),
            dark: lib.getLambert({ color: 0x4f5a60 }),
            metal: lib.getLambert({ color: 0x8d9699 }),
            water: lib.getLambert({ color: 0x4d8ea5, transparent: true, opacity: 0.55 }),
            pipe: lib.getLambert({ color: 0x7c6848 }),
            accent: lib.getLambert({ color: 0xb7d9e3 }),
            glow: new THREE.MeshStandardMaterial({ color: 0xb7d9e3, emissive: 0xb7d9e3, emissiveIntensity: 0.55 })
        };
        return MATS;
    }

    function buildBasinQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var basin = pt(bounds, 0.46, 0.56);

        place.addBlock(basin.x, 0.5, basin.z, 22.0, 1.0, 18.0, mats.dark, true);
        place.addBlock(basin.x, 0.12, basin.z, 17.8, 0.24, 13.8, mats.water, false);
        place.addBlock(basin.x, 0.7, basin.z - 6.8, 18.2, 1.0, 1.2, mats.concrete, true);
        place.addBlock(basin.x, 0.7, basin.z + 6.8, 18.2, 1.0, 1.2, mats.concrete, true);
        place.addBlock(basin.x - 9.0, 0.7, basin.z, 1.2, 1.0, 12.6, mats.concrete, true);
        place.addBlock(basin.x + 9.0, 0.7, basin.z, 1.2, 1.0, 12.6, mats.concrete, true);

        place.addBlock(basin.x, 0.18, basin.z, 3.2, 0.08, 13.4, mats.metal, false);
        place.addBlock(basin.x, 0.18, basin.z, 17.0, 0.08, 2.8, mats.metal, false);

        var house = pt(bounds, 0.76, 0.28);
        place.addBlock(house.x, 2.4, house.z, 10.8, 4.8, 7.4, mats.concrete, true);
        place.addBlock(house.x, 4.9, house.z, 11.4, 0.24, 8.0, mats.metal, false);
        place.addBlock(house.x, 1.3, house.z - 3.1, 5.6, 2.2, 0.5, mats.accent, false);
        place.addBlock(house.x - 4.8, 2.8, house.z + 0.2, 0.5, 5.6, 0.5, mats.dark, true);
        place.addBlock(house.x + 4.8, 2.8, house.z - 0.2, 0.5, 5.6, 0.5, mats.dark, true);
        place.addBlock(house.x, 5.6, house.z, 8.4, 0.3, 0.9, mats.metal, true);
        place.addRamp(house.x - 5.8, 1.0, house.z + 1.2, 2.8, 0.6, 5.0, mats.concrete, 1.1, -0.2, true);
        ctx.addExclusion(house.x, house.z, 4.8);

        var catwalk = pt(bounds, 0.24, 0.24);
        place.addBlock(catwalk.x, 2.2, catwalk.z, 11.2, 0.24, 1.4, mats.metal, true);
        place.addBlock(catwalk.x - 5.0, 1.1, catwalk.z, 0.26, 2.2, 0.26, mats.dark, true);
        place.addBlock(catwalk.x + 5.0, 1.1, catwalk.z, 0.26, 2.2, 0.26, mats.dark, true);
        place.addBlock(catwalk.x, 2.7, catwalk.z, 11.0, 0.08, 0.08, mats.accent, false);

        place.addBlock(bounds.minX + 5.0, 0.7, basin.z + 8.8, 8.6, 1.4, 1.6, mats.pipe, true);
        place.addBlock(bounds.minX + 9.4, 1.7, basin.z + 8.8, 0.8, 1.0, 0.8, mats.pipe, true);
        place.addBlock(bounds.maxX - 5.0, 0.7, basin.z - 8.4, 9.2, 1.4, 1.6, mats.pipe, true);
        place.addBlock(bounds.maxX - 9.6, 1.7, basin.z - 8.4, 0.8, 1.0, 0.8, mats.pipe, true);

        var beacon = place.addBlock(house.x, 5.4, house.z - 2.4, 0.28, 0.18, 0.28, cloneMaterial(mats.glow), false);
        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({ material: beacon.material, freq: 2.9, phase: 1.7 });
        }

        return {
            basins: 1,
            channels: 2,
            catwalks: 1
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.basin = buildBasinQuadrant;
})();
