import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';
import { GameMaterialLibrary } from './material-library.js';

const THREE = globalThis.THREE;

/**
 * quadrant-nuclear.js - Industrial reactor campus with climbable roof and cooling towers.
 */
    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = GameMaterialLibrary;
        MATS = {
            concrete: lib.getLambert({ color: 0x6f757b }),
            dark: lib.getLambert({ color: 0x4f565c }),
            panel: lib.getLambert({ color: 0xe8ecec }),
            accent: lib.getLambert({ color: 0xc4a13b }),
            stripe: lib.getLambert({ color: 0x2a2d30 }),
            pipe: lib.getLambert({ color: 0x7f5f3c }),
            glass: lib.getLambert({ color: 0xf5f7f7, transparent: true, opacity: 0.88 }),
            steam: lib.getLambert({ color: 0xd7dfdc, transparent: true, opacity: 0.18 }),
            beacon: new THREE.MeshStandardMaterial({ color: 0xf1dd8f, emissive: 0xf1dd8f, emissiveIntensity: 0.7 })
        };
        return MATS;
    }

    function addTileLogo(originX, originY, originZ, pattern, tileW, tileH, depth, place, mat) {
        var rows = Array.isArray(pattern) ? pattern.length : 0;
        if (!rows) return;
        var cols = String(pattern[0] || '').length;
        for (var row = 0; row < rows; row++) {
            var line = String(pattern[row] || '');
            for (var col = 0; col < cols; col++) {
                if (line.charAt(col) !== '1') continue;
                place.addBlock(
                    originX + (col * tileW),
                    originY - (row * tileH),
                    originZ,
                    tileW * 0.88,
                    tileH * 0.88,
                    depth,
                    mat,
                    false
                );
            }
        }
    }

    function buildCoolingTower(cx, cz, place, mats, ctx) {
        var scale = 1.34;
        var tiers = [
            { y: 1.3, w: 7.8 * scale, h: 2.6, d: 7.8 * scale },
            { y: 3.5, w: 6.8 * scale, h: 1.8, d: 6.8 * scale },
            { y: 5.2, w: 5.6 * scale, h: 1.55, d: 5.6 * scale },
            { y: 6.7, w: 4.8 * scale, h: 1.35, d: 4.8 * scale },
            { y: 8.2, w: 5.5 * scale, h: 1.6, d: 5.5 * scale },
            { y: 9.95, w: 6.6 * scale, h: 1.85, d: 6.6 * scale },
            { y: 11.7, w: 7.5 * scale, h: 1.55, d: 7.5 * scale }
        ];
        for (var i = 0; i < tiers.length; i++) {
            var tier = tiers[i];
            place.addBlock(cx, tier.y, cz, tier.w, tier.h, tier.d, (i % 2 === 0) ? mats.panel : mats.glass, true);
        }
        place.addBlock(cx, 12.95, cz, 8.35 * scale, 0.22, 8.35 * scale, mats.accent, false);

        var tiles = [];
        for (var col = 0; col < 5; col++) {
            for (var row = 0; row < 7; row++) {
                var phase = (col * 0.37) + (row * 0.18);
                var steamMat = cloneMaterial(mats.steam);
                var tile = place.addBlock(
                    cx - 2.0 + (col * 1.0),
                    13.2 + (row * 0.56),
                    cz - 0.8 + ((col % 2) * 0.45),
                    0.92,
                    0.48,
                    0.92,
                    steamMat,
                    false
                );
                tiles.push({
                    mesh: tile,
                    material: steamMat,
                    baseX: tile.position.x,
                    baseY: tile.position.y,
                    baseZ: tile.position.z,
                    phase: phase
                });
            }
        }
        if (ctx && typeof ctx.addSteamColumn === 'function') {
            ctx.addSteamColumn({
                tiles: tiles,
                cycle: 2.6,
                rise: 4.8,
                baseOpacity: 0.18,
                swayAmp: 0.28,
                depthAmp: 0.18,
                swayFreq: 0.9
            });
        }
    }

    function buildFireEscape(originX, originZ, place, mats) {
        var levels = [
            { x: originX, y: 1.1, z: originZ },
            { x: originX + 2.0, y: 2.8, z: originZ + 1.3 },
            { x: originX, y: 4.5, z: originZ + 2.6 },
            { x: originX + 2.0, y: 6.2, z: originZ + 3.9 },
            { x: originX, y: 7.9, z: originZ + 5.2 }
        ];
        for (var i = 0; i < levels.length; i++) {
            var lv = levels[i];
            place.addBlock(lv.x, lv.y, lv.z, 2.2, 0.18, 1.4, mats.dark, true);
            place.addBlock(lv.x - 0.9, lv.y + 0.6, lv.z, 0.1, 1.2, 0.1, mats.stripe, false);
            place.addBlock(lv.x + 0.9, lv.y + 0.6, lv.z, 0.1, 1.2, 0.1, mats.stripe, false);
        }
        for (var s = 0; s < levels.length - 1; s++) {
            var a = levels[s];
            var b = levels[s + 1];
            place.addRamp(
                (a.x + b.x) * 0.5,
                (a.y + b.y) * 0.5,
                (a.z + b.z) * 0.5,
                1.1,
                0.18,
                3.0,
                mats.dark,
                0.98,
                -0.28,
                true
            );
        }
    }

    function buildReactorCampus(bounds, place, mats, ctx) {
        var hub = pt(bounds, 0.48, 0.55);
        place.addBlock(hub.x, 0.4, hub.z, 22.0, 0.8, 18.0, mats.dark, true);
        place.addBlock(hub.x, 4.0, hub.z, 18.4, 7.2, 13.8, mats.concrete, true);
        place.addBlock(hub.x - 4.8, 7.2, hub.z - 0.6, 6.2, 1.4, 5.2, mats.panel, true);
        place.addBlock(hub.x + 4.8, 6.7, hub.z + 0.8, 5.4, 1.0, 4.0, mats.panel, true);
        place.addBlock(hub.x, 8.1, hub.z, 10.5, 0.32, 8.2, mats.accent, false);
        place.addBlock(hub.x, 8.5, hub.z, 4.0, 0.5, 2.8, mats.dark, true);
        place.addBlock(hub.x, 2.0, hub.z - 7.2, 6.6, 3.2, 0.8, mats.glass, false);
        place.addBlock(hub.x - 7.4, 1.6, hub.z - 5.6, 2.6, 2.8, 2.6, mats.dark, true);
        place.addBlock(hub.x + 7.1, 1.4, hub.z + 5.0, 2.8, 2.4, 2.2, mats.dark, true);
        place.addBlock(hub.x - 8.4, 0.8, hub.z + 0.5, 1.0, 1.6, 10.8, mats.pipe, true);
        place.addBlock(hub.x + 8.6, 0.9, hub.z - 0.8, 1.0, 1.8, 9.6, mats.pipe, true);

        buildFireEscape(hub.x + 10.0, hub.z - 4.6, place, mats);
        ctx.addExclusion(hub.x, hub.z, 8.8);

        place.addBlock(hub.x - 4.2, 0.95, hub.z + 10.1, 7.4, 1.9, 2.4, mats.panel, true);
        place.addRamp(hub.x + 5.6, 1.1, hub.z + 8.9, 5.2, 0.8, 4.8, mats.concrete, 1.12, -0.18, true);

        var roofRailY = 8.65;
        place.addBlock(hub.x, roofRailY, hub.z - 6.1, 12.4, 0.12, 0.12, mats.stripe, false);
        place.addBlock(hub.x, roofRailY, hub.z + 6.1, 12.4, 0.12, 0.12, mats.stripe, false);
        place.addBlock(hub.x - 6.1, roofRailY, hub.z, 0.12, 0.12, 12.0, mats.stripe, false);
        place.addBlock(hub.x + 6.1, roofRailY, hub.z, 0.12, 0.12, 12.0, mats.stripe, false);

        var signTile = 0.42;
        var signBackZ = hub.z - 7.66;
        var signFrontZ = hub.z - 7.76;
        place.addBlock(hub.x - 0.12, 4.55, signBackZ, 7.3, 7.3, 0.08, mats.stripe, false);
        addTileLogo(
            hub.x - 3.22,
            6.82,
            signFrontZ,
            [
                '00011111',
                '00111111',
                '01111111',
                '11111111',
                '11111110',
                '11111100',
                '11111000',
                '11110000'
            ],
            signTile,
            signTile,
            0.08,
            place,
            mats.accent
        );
        addTileLogo(
            hub.x + 0.28,
            6.82,
            signFrontZ,
            [
                '11111000',
                '11111100',
                '11111110',
                '11111111',
                '01111111',
                '00111111',
                '00011111',
                '00001111'
            ],
            signTile,
            signTile,
            0.08,
            place,
            mats.accent
        );
        addTileLogo(
            hub.x - 1.47,
            4.52,
            signFrontZ,
            [
                '00011000',
                '00011000',
                '00111100',
                '00111100',
                '01111110',
                '11111111',
                '11111111',
                '01111110'
            ],
            signTile,
            signTile,
            0.08,
            place,
            mats.accent
        );
        addTileLogo(
            hub.x - 1.26,
            5.82,
            signFrontZ,
            [
                '0011100',
                '0111110',
                '1111111',
                '1111111',
                '1111111',
                '0111110',
                '0011100'
            ],
            signTile,
            signTile,
            0.08,
            place,
            mats.accent
        );

        var beaconA = place.addBlock(hub.x - 4.4, 9.15, hub.z - 3.8, 0.3, 0.2, 0.3, cloneMaterial(mats.beacon), false);
        var beaconB = place.addBlock(hub.x + 4.6, 9.15, hub.z + 3.8, 0.3, 0.2, 0.3, cloneMaterial(mats.beacon), false);
        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({ material: beaconA.material, freq: 2.4, phase: 1.2 });
            ctx.addFlicker({ material: beaconB.material, freq: 2.7, phase: 2.5 });
        }

        return hub;
    }

    export function buildNuclearQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var hub = buildReactorCampus(bounds, place, mats, ctx);

        var towerA = pt(bounds, 0.2, 0.26);
        var towerB = pt(bounds, 0.82, 0.3);
        buildCoolingTower(towerA.x, towerA.z, place, mats, ctx);
        buildCoolingTower(towerB.x, towerB.z, place, mats, ctx);
        ctx.addExclusion(towerA.x, towerA.z, 5.8);
        ctx.addExclusion(towerB.x, towerB.z, 5.8);

        var controlYard = pt(bounds, 0.74, 0.78);
        place.addBlock(controlYard.x, 0.34, controlYard.z, 9.0, 0.68, 6.0, mats.dark, true);
        place.addBlock(controlYard.x, 1.0, controlYard.z, 5.4, 0.22, 3.4, mats.panel, true);
        place.addBlock(controlYard.x - 2.8, 1.8, controlYard.z - 1.2, 2.0, 1.6, 1.8, mats.concrete, true);
        place.addBlock(controlYard.x + 2.4, 1.5, controlYard.z + 1.1, 1.8, 1.2, 1.6, mats.concrete, true);
        place.addBlock(controlYard.x, 0.18, controlYard.z, 7.8, 0.08, 0.12, mats.accent, false);

        place.addBlock(hub.x, 0.2, bounds.minZ + 3.4, 18.0, 0.4, 1.2, mats.accent, false);
        place.addBlock(bounds.minX + 4.2, 0.22, hub.z + 10.2, 1.4, 0.44, 8.8, mats.dark, true);
        place.addBlock(bounds.maxX - 4.0, 0.22, hub.z - 9.8, 1.4, 0.44, 8.0, mats.dark, true);

        return {
            structures: 4,
            towers: 2,
            steamColumns: 2
        };
    }
