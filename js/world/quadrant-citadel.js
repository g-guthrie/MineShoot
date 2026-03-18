import { pointInBounds as pt, cloneMaterial } from './biome-utils.js';

/**
 * quadrant-citadel.js - Broader Mount Olympus citadel with a marble court and a restrained summit torch.
 */
(function () {
    'use strict';

    var MATS = null;
    var FACE_DIRS = [
        { dx: 0, dz: -1, px: 1, pz: 0, axis: 'z' },
        { dx: 1, dz: 0, px: 0, pz: 1, axis: 'x' },
        { dx: 0, dz: 1, px: -1, pz: 0, axis: 'z' },
        { dx: -1, dz: 0, px: 0, pz: -1, axis: 'x' }
    ];

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            ivory: lib.getLambert({ color: 0xe9e4d8 }),
            marble: lib.getLambert({ color: 0xf8f4ec }),
            shadow: lib.getLambert({ color: 0xc9bfb0 }),
            warmShadow: lib.getLambert({ color: 0xb3a792 }),
            trim: lib.getLambert({ color: 0xcda555 }),
            trimSoft: lib.getLambert({ color: 0xe3c98e }),
            steam: lib.getLambert({ color: 0xf6fbff, transparent: true, opacity: 0.09 }),
            flameOuter: new THREE.MeshStandardMaterial({ color: 0xffc76a, emissive: 0xffc76a, emissiveIntensity: 0.92 }),
            flameMid: new THREE.MeshStandardMaterial({ color: 0xffefb5, emissive: 0xffefb5, emissiveIntensity: 1.02 }),
            flameCore: new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 1.12 })
        };
        return MATS;
    }

    function offset(center, dir, distance, lateral) {
        return {
            x: center.x + (dir.dx * distance) + (dir.px * lateral),
            z: center.z + (dir.dz * distance) + (dir.pz * lateral)
        };
    }

    function addFaceBlock(center, dir, distance, lateral, y, along, height, depth, material, solid, place) {
        var pos = offset(center, dir, distance, lateral);
        var width = dir.axis === 'z' ? along : depth;
        var length = dir.axis === 'z' ? depth : along;
        return place.addBlock(pos.x, y, pos.z, width, height, length, material, solid);
    }

    function addCenteredBlock(center, y, w, h, d, material, solid, place) {
        return place.addBlock(center.x, y, center.z, w, h, d, material, solid);
    }

    function addCornerBlocks(center, offsets, y, w, h, d, material, solid, place) {
        for (var i = 0; i < offsets.length; i++) {
            var off = offsets[i];
            place.addBlock(center.x + off.x, y, center.z + off.z, w, h, d, material, solid);
        }
    }

    function addPerimeterRing(center, y, w, d, band, h, material, solid, place) {
        place.addBlock(center.x, y, center.z - ((d * 0.5) - (band * 0.5)), w, h, band, material, solid);
        place.addBlock(center.x, y, center.z + ((d * 0.5) - (band * 0.5)), w, h, band, material, solid);
        place.addBlock(center.x - ((w * 0.5) - (band * 0.5)), y, center.z, band, h, d - (band * 2), material, solid);
        place.addBlock(center.x + ((w * 0.5) - (band * 0.5)), y, center.z, band, h, d - (band * 2), material, solid);
    }

    function buildMarbleCourt(bounds, center, place, mats) {
        var courtW = (bounds.maxX - bounds.minX) - 3.6;
        var courtD = (bounds.maxZ - bounds.minZ) - 3.6;
        addCenteredBlock(center, 0.16, courtW, 0.28, courtD, mats.marble, true, place);
        addCenteredBlock(center, 0.34, 15.2, 0.12, courtD - 4.8, mats.ivory, true, place);
        addCenteredBlock(center, 0.34, courtW - 4.8, 0.12, 15.2, mats.ivory, true, place);

        addPerimeterRing(center, 0.64, courtW - 5.2, courtD - 5.2, 1.0, 0.64, mats.shadow, true, place);

        addCornerBlocks(center, [
            { x: -18.0, z: -18.0 }, { x: 18.0, z: -18.0 }, { x: -18.0, z: 18.0 }, { x: 18.0, z: 18.0 }
        ], 0.62, 4.8, 0.76, 4.8, mats.warmShadow, true, place);

        addCenteredBlock(center, 0.46, 10.6, 0.12, 10.6, mats.trimSoft, false, place);
    }

    function buildGrandApproach(center, dir, place, mats) {
        var steps = [
            { y: 0.24, distance: 22.2, along: 16.2, depth: 2.8, h: 0.48 },
            { y: 0.70, distance: 19.5, along: 14.6, depth: 2.5, h: 0.48 },
            { y: 1.16, distance: 17.0, along: 13.0, depth: 2.2, h: 0.48 },
            { y: 1.62, distance: 14.8, along: 11.8, depth: 1.95, h: 0.48 },
            { y: 2.08, distance: 12.7, along: 10.6, depth: 1.75, h: 0.48 },
            { y: 2.54, distance: 10.8, along: 9.4, depth: 1.6, h: 0.48 }
        ];
        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            addFaceBlock(center, dir, step.distance, 0, step.y, step.along, step.h, step.depth, mats.ivory, true, place);
        }

        addFaceBlock(center, dir, 12.8, 8.8, 1.15, 2.6, 2.2, 2.6, mats.shadow, true, place);
        addFaceBlock(center, dir, 12.8, -8.8, 1.15, 2.6, 2.2, 2.6, mats.shadow, true, place);
        addFaceBlock(center, dir, 9.8, 6.8, 3.25, 2.8, 1.0, 2.8, mats.shadow, true, place);
        addFaceBlock(center, dir, 9.8, -6.8, 3.25, 2.8, 1.0, 2.8, mats.shadow, true, place);
    }

    function buildFlankClimbs(center, dir, place, mats) {
        var sides = [-8.6, 8.6];
        for (var si = 0; si < sides.length; si++) {
            var lateral = sides[si];
            var steps = [
                { y: 3.10, distance: 9.2, depth: 1.9, h: 0.64 },
                { y: 3.78, distance: 7.8, depth: 1.7, h: 0.64 },
                { y: 4.46, distance: 6.5, depth: 1.55, h: 0.64 },
                { y: 5.14, distance: 5.3, depth: 1.4, h: 0.64 },
                { y: 5.72, distance: 4.2, depth: 1.3, h: 0.52 }
            ];
            for (var i = 0; i < steps.length; i++) {
                var step = steps[i];
                addFaceBlock(center, dir, step.distance, lateral, step.y, 3.4, step.h, step.depth, mats.ivory, true, place);
            }
        }
    }

    function buildHallAscent(center, dir, place, mats) {
        var steps = [
            { y: 6.18, distance: 7.3, depth: 1.55, h: 0.72 },
            { y: 6.98, distance: 6.25, depth: 1.4, h: 0.78 },
            { y: 7.84, distance: 5.25, depth: 1.25, h: 0.82 },
            { y: 8.76, distance: 4.35, depth: 1.1, h: 0.86 },
            { y: 9.72, distance: 3.55, depth: 1.0, h: 0.9 },
            { y: 10.70, distance: 2.80, depth: 0.9, h: 0.92 }
        ];
        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            addFaceBlock(center, dir, step.distance, 0, step.y, 4.8, step.h, step.depth, mats.marble, true, place);
        }
    }

    function buildShrineAscent(center, dir, place, mats) {
        var steps = [
            { y: 11.94, distance: 4.2, depth: 1.05, h: 0.72 },
            { y: 12.78, distance: 3.55, depth: 0.94, h: 0.76 },
            { y: 13.66, distance: 2.95, depth: 0.86, h: 0.8 },
            { y: 14.58, distance: 2.40, depth: 0.78, h: 0.84 },
            { y: 15.46, distance: 1.92, depth: 0.72, h: 0.84 }
        ];
        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            addFaceBlock(center, dir, step.distance, 0, step.y, 3.8, step.h, step.depth, mats.marble, true, place);
        }

        addFaceBlock(center, dir, 1.55, 0, 16.22, 4.8, 0.28, 0.9, mats.trim, true, place);
        addFaceBlock(center, dir, 1.18, 0, 17.00, 3.6, 0.68, 0.7, mats.marble, true, place);
    }

    function buildMountainBands(center, place, mats) {
        for (var i = 0; i < FACE_DIRS.length; i++) {
            var dir = FACE_DIRS[i];
            addFaceBlock(center, dir, 14.4, 0, 2.36, 25.0, 1.08, 5.2, mats.shadow, true, place);
            addFaceBlock(center, dir, 10.7, 0, 3.72, 19.4, 1.36, 4.3, mats.ivory, true, place);
            addFaceBlock(center, dir, 7.8, 0, 5.18, 14.4, 1.24, 3.2, mats.marble, true, place);
            addFaceBlock(center, dir, 10.9, 9.0, 3.12, 5.6, 1.56, 5.8, mats.shadow, true, place);
            addFaceBlock(center, dir, 10.9, -9.0, 3.12, 5.6, 1.56, 5.8, mats.shadow, true, place);
        }
    }

    function buildMountainPavilions(center, place, mats) {
        var lower = [
            { x: -13.8, z: -7.2 }, { x: 13.8, z: -7.2 }, { x: -13.8, z: 7.2 }, { x: 13.8, z: 7.2 }
        ];
        var upper = [
            { x: -10.0, z: -5.2 }, { x: 10.0, z: -5.2 }, { x: -10.0, z: 5.2 }, { x: 10.0, z: 5.2 }
        ];
        var tower = [
            { x: -5.8, z: -5.8 }, { x: 5.8, z: -5.8 }, { x: -5.8, z: 5.8 }, { x: 5.8, z: 5.8 }
        ];

        addCornerBlocks(center, lower, 4.62, 7.2, 3.64, 9.2, mats.shadow, true, place);
        addCornerBlocks(center, lower, 6.84, 6.0, 0.6, 8.0, mats.marble, true, place);

        addCornerBlocks(center, upper, 8.14, 4.8, 3.88, 6.8, mats.ivory, true, place);
        addCornerBlocks(center, tower, 9.08, 2.0, 5.76, 2.0, mats.marble, true, place);
    }

    function buildSanctumWings(center, place, mats) {
        addCenteredBlock({ x: center.x - 10.6, z: center.z }, 7.78, 5.8, 4.36, 12.4, mats.shadow, true, place);
        addCenteredBlock({ x: center.x + 10.6, z: center.z }, 7.78, 5.8, 4.36, 12.4, mats.shadow, true, place);
        addCenteredBlock({ x: center.x - 10.6, z: center.z }, 10.16, 4.8, 0.4, 10.6, mats.trim, true, place);
        addCenteredBlock({ x: center.x + 10.6, z: center.z }, 10.16, 4.8, 0.4, 10.6, mats.trim, true, place);

        addPerimeterRing(center, 11.76, 15.8, 15.8, 0.84, 0.38, mats.trim, true, place);

        addCenteredBlock(center, 13.5, 10.2, 4.2, 10.2, mats.marble, true, place);
        addPerimeterRing(center, 15.92, 11.8, 11.8, 0.72, 0.32, mats.trim, true, place);

        addCenteredBlock(center, 17.72, 8.8, 0.84, 8.8, mats.marble, true, place);
        addCornerBlocks(center, [
            { x: -3.2, z: -3.2 }, { x: 3.2, z: -3.2 }, { x: -3.2, z: 3.2 }, { x: 3.2, z: 3.2 }
        ], 18.88, 1.1, 2.0, 1.1, mats.ivory, true, place);
        addCenteredBlock(center, 20.04, 10.2, 0.48, 10.2, mats.trim, true, place);
    }

    function buildTorchAndSteam(center, place, mats, ctx) {
        place.addBlock(center.x, 18.84, center.z, 6.6, 1.56, 6.6, mats.warmShadow, true);
        addPerimeterRing(center, 19.48, 7.4, 7.4, 0.52, 0.38, mats.trim, true, place);
        addCenteredBlock(center, 19.22, 5.4, 0.28, 5.4, mats.shadow, false, place);

        var flameOuter = place.addBlock(center.x, 20.35, center.z, 5.2, 1.4, 5.2, cloneMaterial(mats.flameOuter), false);
        var flameMid = place.addBlock(center.x, 21.45, center.z, 3.6, 1.8, 3.6, cloneMaterial(mats.flameMid), false);
        var flameCore = place.addBlock(center.x, 22.15, center.z, 2.0, 2.1, 2.0, cloneMaterial(mats.flameCore), false);

        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({ material: flameOuter.material, freq: 1.45, phase: 0.2, baseIntensity: 0.9, amplitude: 0.14 });
            ctx.addFlicker({ material: flameMid.material, freq: 1.85, phase: 0.9, baseIntensity: 0.98, amplitude: 0.12 });
            ctx.addFlicker({ material: flameCore.material, freq: 2.3, phase: 1.8, baseIntensity: 1.08, amplitude: 0.1 });
        }

        var steamTiles = [];
        for (var col = 0; col < 5; col++) {
            for (var row = 0; row < 5; row++) {
                var steamMat = cloneMaterial(mats.steam);
                var tile = place.addBlock(
                    center.x - 1.8 + (col * 0.9),
                    23.15 + (row * 0.78),
                    center.z - 0.22 + ((col % 2) * 0.22),
                    1.04,
                    0.68,
                    1.04,
                    steamMat,
                    false
                );
                steamTiles.push({
                    mesh: tile,
                    material: steamMat,
                    baseX: tile.position.x,
                    baseY: tile.position.y,
                    baseZ: tile.position.z,
                    phase: (col * 0.29) + (row * 0.17)
                });
            }
        }

        if (ctx && typeof ctx.addSteamColumn === 'function') {
            ctx.addSteamColumn({
                tiles: steamTiles,
                cycle: 2.8,
                rise: 2.6,
                baseOpacity: 0.08,
                swayAmp: 0.16,
                depthAmp: 0.08,
                swayFreq: 0.42
            });
        }

        return {
            flameTopHeight: 23.2,
            steamPeakHeight: 29.18,
            steamTileCount: steamTiles.length
        };
    }

    function buildCitadelQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var center = pt(bounds, 0.5, 0.5);

        buildMarbleCourt(bounds, center, place, mats);
        buildGrandApproach(center, FACE_DIRS[0], place, mats);
        buildGrandApproach(center, FACE_DIRS[1], place, mats);
        buildGrandApproach(center, FACE_DIRS[2], place, mats);
        buildGrandApproach(center, FACE_DIRS[3], place, mats);

        buildMountainBands(center, place, mats);
        buildMountainPavilions(center, place, mats);

        addCenteredBlock(center, 0.8, 40.0, 1.6, 40.0, mats.shadow, true, place);
        addCenteredBlock(center, 2.2, 32.0, 1.2, 32.0, mats.ivory, true, place);
        addCenteredBlock(center, 3.6, 24.0, 1.6, 24.0, mats.ivory, true, place);
        addCenteredBlock(center, 5.2, 18.0, 1.2, 18.0, mats.marble, true, place);

        for (var i = 0; i < FACE_DIRS.length; i++) {
            buildFlankClimbs(center, FACE_DIRS[i], place, mats);
            buildHallAscent(center, FACE_DIRS[i], place, mats);
            buildShrineAscent(center, FACE_DIRS[i], place, mats);
        }

        addCenteredBlock(center, 8.6, 14.0, 5.6, 14.0, mats.ivory, true, place);
        buildSanctumWings(center, place, mats);

        var fxStats = buildTorchAndSteam(center, place, mats, ctx);

        if (ctx && typeof ctx.addExclusion === 'function') {
            ctx.addExclusion(center.x, center.z, 16.5);
        }

        return {
            terraces: 5,
            stairs: 4,
            flameLayers: 3,
            steamTileCount: fxStats.steamTileCount,
            steamPeakHeight: fxStats.steamPeakHeight,
            flameTopHeight: fxStats.flameTopHeight
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.citadel = buildCitadelQuadrant;
})();
