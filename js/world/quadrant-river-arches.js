import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-river-arches.js - Natural river arch biome occupying the south-center slot.
 * The slot replaces the old toon-finance / Toontown direction with water, stone,
 * grass, reeds, and climbable-looking cliff forms.
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            grass: lib.getLambert({ color: 0x5f9b55 }),
            meadow: lib.getLambert({ color: 0x79ad63 }),
            moss: lib.getLambert({ color: 0x4f7f3e }),
            mossDark: lib.getLambert({ color: 0x355a2f }),
            sand: lib.getLambert({ color: 0xd7c48a }),
            wetSand: lib.getLambert({ color: 0xb99f69 }),
            limestone: lib.getLambert({ color: 0xc5b17c }),
            limestoneLight: lib.getLambert({ color: 0xe0d39a }),
            limestoneDark: lib.getLambert({ color: 0x917c55 }),
            shale: lib.getLambert({ color: 0x696f66 }),
            river: lib.getLambert({ color: 0x3f9bb0, transparent: true, opacity: 0.66 }),
            riverDeep: lib.getLambert({ color: 0x206f88, transparent: true, opacity: 0.72 }),
            foam: lib.getLambert({ color: 0xc9f2ec, transparent: true, opacity: 0.58 }),
            reed: lib.getLambert({ color: 0x779443 }),
            reedDark: lib.getLambert({ color: 0x526c34 }),
            trunk: lib.getLambert({ color: 0x6b4a2d }),
            driftwood: lib.getLambert({ color: 0x8a6a46 }),
            canopy: lib.getLambert({ color: 0x3f7f46 }),
            canopyLight: lib.getLambert({ color: 0x68a05a }),
            wildflowerYellow: lib.getLambert({ color: 0xe2bf4f }),
            wildflowerBlue: lib.getLambert({ color: 0x6ca7c8 }),
            mist: lib.getLambert({ color: 0xd9f1ee, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
            caveShadow: lib.getLambert({ color: 0x2f352f })
        };
        return MATS;
    }

    function tb(place, role, meta, x, y, z, w, h, d, material, isSolid) {
        var mesh = place.addBlock(x, y, z, w, h, d, material, isSolid);
        if (mesh) {
            mesh.userData = mesh.userData || {};
            mesh.userData.role = role;
            if (meta) {
                for (var key in meta) mesh.userData[key] = meta[key];
            }
        }
        return mesh;
    }

    function addWaterTile(place, x, y, z, w, h, d, material) {
        return tb(place, 'river-water', null, x, y, z, w, h, d, cloneMaterial(material), false);
    }

    function addSwayBlock(place, ctx, x, y, z, w, h, d, material, phase, amp) {
        var mesh = tb(place, 'canopy', null, x, y, z, w, h, d, material, false);
        if (ctx && typeof ctx.addLeafSway === 'function') {
            ctx.addLeafSway({
                mesh: mesh,
                baseRotY: 0,
                freq: 0.72 + ((phase || 0) % 0.4),
                phase: Number(phase || 0),
                amp: Number(amp || 0.012)
            });
        }
        return mesh;
    }

    function addWaterfallMist(place, ctx, x, z, mats) {
        if (!ctx || !ctx.scene || typeof ctx.scene.add !== 'function') return 0;
        var configs = [
            { y: 1.45, w: 8.4, h: 2.0, dx: 0, dz: -0.5, phase: 0.4, opacity: 0.16 },
            { y: 1.0, w: 5.6, h: 1.4, dx: -1.6, dz: -0.8, phase: 1.7, opacity: 0.11 },
            { y: 1.1, w: 4.8, h: 1.3, dx: 1.7, dz: -0.75, phase: 2.5, opacity: 0.1 }
        ];
        for (var i = 0; i < configs.length; i++) {
            var cfg = configs[i];
            var mistMat = cloneMaterial(mats.mist);
            mistMat.opacity = cfg.opacity;
            var mistGeo = new THREE.PlaneGeometry(cfg.w, cfg.h);
            var mesh = new THREE.Mesh(mistGeo, mistMat);
            mesh.position.set(x + cfg.dx, cfg.y, z + cfg.dz);
            mesh.rotation.x = -0.26;
            ctx.scene.add(mesh);
            if (typeof ctx.addMistCard === 'function') {
                ctx.addMistCard({ mesh: mesh, baseOpacity: cfg.opacity, phase: cfg.phase });
            }
        }
        return configs.length;
    }

    function buildRiverChannel(bounds, place, mats) {
        var segments = [
            { u: 0.48, v: 0.11, w: 10.8, d: 9.2 },
            { u: 0.44, v: 0.18, w: 12.4, d: 10.8 },
            { u: 0.50, v: 0.31, w: 13.8, d: 11.2 },
            { u: 0.57, v: 0.44, w: 12.8, d: 10.4 },
            { u: 0.52, v: 0.57, w: 14.2, d: 11.0 },
            { u: 0.45, v: 0.70, w: 12.6, d: 10.2 },
            { u: 0.50, v: 0.83, w: 13.4, d: 10.8 },
            { u: 0.50, v: 0.90, w: 11.8, d: 5.4 }
        ];

        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            var pos = pt(bounds, seg.u, seg.v);
            tb(place, 'shore-sand', { index: i }, pos.x, 0.025, pos.z, seg.w + 3.4, 0.05, seg.d + 2.5, mats.wetSand, false);
            tb(place, 'shore-sand', { index: i, dry: true }, pos.x + ((i % 2 === 0) ? -0.9 : 0.9), 0.04, pos.z, seg.w + 1.1, 0.05, seg.d + 0.8, mats.sand, false);
            addWaterTile(place, pos.x, 0.075, pos.z, seg.w, 0.08, seg.d, mats.river);
            addWaterTile(place, pos.x, 0.115, pos.z, seg.w * 0.54, 0.06, seg.d * 0.56, mats.riverDeep);
        }

        return segments.length;
    }

    function buildSouthCliff(bounds, place, mats, ctx) {
        var centerX = (bounds.minX + bounds.maxX) * 0.5;
        var southZ = bounds.maxZ - 2.7;
        var frontZ = southZ - 2.34;
        var waterfallTiles = [];

        tb(place, 'south-cliff', { part: 'left-foot' }, centerX - 17.2, 4.35, southZ - 0.2, 13.6, 8.7, 4.9, mats.limestoneDark, true);
        tb(place, 'south-cliff', { part: 'middle-foot' }, centerX, 5.15, southZ - 0.55, 17.8, 10.3, 5.3, mats.limestoneDark, true);
        tb(place, 'south-cliff', { part: 'right-foot' }, centerX + 17.0, 4.75, southZ + 0.05, 13.8, 9.5, 4.7, mats.limestoneDark, true);
        tb(place, 'south-cliff', { part: 'front-left-buttress' }, centerX - 23.2, 2.4, frontZ - 0.3, 4.2, 4.8, 2.0, mats.limestone, true);
        tb(place, 'south-cliff', { part: 'front-right-buttress' }, centerX + 23.0, 2.7, frontZ - 0.1, 4.4, 5.4, 2.1, mats.limestone, true);
        tb(place, 'south-cliff', { part: 'left-stack' }, centerX - 14.8, 9.2, southZ - 0.55, 15.0, 8.4, 5.6, mats.limestone, true);
        tb(place, 'south-cliff', { part: 'right-stack' }, centerX + 15.2, 8.6, southZ - 0.35, 14.2, 7.2, 5.2, mats.limestone, true);
        tb(place, 'south-cliff', { part: 'crown' }, centerX, 12.9, southZ - 0.1, 23.0, 5.2, 4.0, mats.limestoneLight, true);
        tb(place, 'south-cliff', { part: 'moss-left' }, centerX - 15.0, 13.55, southZ - 1.0, 12.2, 0.34, 3.4, mats.moss, false);
        tb(place, 'south-cliff', { part: 'moss-right' }, centerX + 14.7, 12.55, southZ - 0.9, 11.0, 0.34, 3.2, mats.moss, false);
        tb(place, 'south-cliff', { part: 'moss-crown' }, centerX, 15.7, southZ - 0.6, 15.5, 0.3, 2.8, mats.mossDark, false);
        tb(place, 'south-cliff', { part: 'grotto-shadow' }, centerX, 3.1, frontZ - 0.1, 7.4, 4.8, 0.18, mats.caveShadow, false);
        tb(place, 'south-cliff', { part: 'left-strata-a' }, centerX - 15.2, 6.4, frontZ - 0.22, 10.6, 0.26, 0.2, mats.limestoneLight, false);
        tb(place, 'south-cliff', { part: 'left-strata-b' }, centerX - 18.2, 3.8, frontZ - 0.25, 8.2, 0.22, 0.2, mats.sand, false);
        tb(place, 'south-cliff', { part: 'right-strata-a' }, centerX + 15.0, 6.8, frontZ - 0.2, 11.4, 0.26, 0.2, mats.limestoneLight, false);
        tb(place, 'south-cliff', { part: 'right-strata-b' }, centerX + 18.2, 4.2, frontZ - 0.24, 8.6, 0.22, 0.2, mats.sand, false);
        tb(place, 'south-cliff', { part: 'center-ledge' }, centerX, 7.5, frontZ - 0.45, 9.2, 0.7, 1.2, mats.limestoneLight, true);
        tb(place, 'south-cliff', { part: 'center-ledge-moss' }, centerX, 7.95, frontZ - 0.52, 7.4, 0.16, 0.82, mats.moss, false);

        for (var row = 0; row < 16; row++) {
            var tileMat = cloneMaterial(row % 2 === 0 ? mats.river : mats.foam);
            tileMat.opacity = row % 2 === 0 ? 0.72 : 0.58;
            var tile = tb(
                place,
                'waterfall',
                { row: row },
                centerX + ((row % 3) - 1) * 0.16,
                10.0 - (row * 0.54),
                frontZ - 0.16,
                3.4,
                0.48,
                0.14,
                tileMat,
                false
            );
            waterfallTiles.push({ mesh: tile, material: tileMat, column: row % 3, row: row });
        }

        if (ctx && typeof ctx.addWaterfallSheet === 'function') {
            ctx.addWaterfallSheet({
                tiles: waterfallTiles,
                stepInterval: 0.64,
                rowDirection: 1,
                darkColor: 0x3f9bb0,
                lightColor: 0xc9f2ec,
                rowCount: 16,
                pulseInterval: 4.4,
                pulseDuration: 1.4,
                pulseWidth: 1.2,
                pulseColumnSkew: 0.28,
                pulseLightColor: 0xe1fff7
            });
        }

        addWaterfallMist(place, ctx, centerX, frontZ - 0.2, mats);
        tb(place, 'waterfall-pool', null, centerX, 0.09, frontZ - 2.9, 10.4, 0.1, 5.0, mats.river, false);
        tb(place, 'waterfall-foam', null, centerX, 0.16, frontZ - 4.1, 6.8, 0.08, 1.6, mats.foam, false);

        return {
            cliffPeakHeight: 15.85,
            waterfallTiles: waterfallTiles.length
        };
    }

    function buildStoneArch(place, x, z, width, depth, height, mats, id) {
        var pillarW = 2.35;
        var leftX = x - (width * 0.5);
        var rightX = x + (width * 0.5);
        tb(place, 'stone-arch', { id: id, part: 'left-pillar' }, leftX, height * 0.5, z, pillarW, height, depth, mats.limestone, true);
        tb(place, 'stone-arch', { id: id, part: 'right-pillar' }, rightX, height * 0.5, z, pillarW, height, depth, mats.limestoneDark, true);
        tb(place, 'stone-arch', { id: id, part: 'cap' }, x, height + 0.75, z, width + pillarW + 1.4, 1.5, depth, mats.limestoneLight, true);
        tb(place, 'stone-arch', { id: id, part: 'crown-moss' }, x, height + 1.62, z - 0.2, width + pillarW, 0.24, depth * 0.74, mats.moss, false);
        tb(place, 'stone-arch', { id: id, part: 'under-shadow' }, x, height * 0.55, z - (depth * 0.5) - 0.08, width - 1.2, height * 0.62, 0.16, mats.caveShadow, false);
    }

    function buildCliffShelf(spec, place, mats) {
        var p = pt(spec.bounds, spec.u, spec.v);
        var mat = spec.dark ? mats.limestoneDark : spec.light ? mats.limestoneLight : mats.limestone;
        tb(place, 'cliff-shelf', { id: spec.id }, p.x, spec.h * 0.5, p.z, spec.w, spec.h, spec.d, mat, true);
        tb(place, 'cliff-shelf-cap', { id: spec.id }, p.x + (spec.capDx || 0), spec.h + 0.16, p.z + (spec.capDz || 0), spec.w * 0.78, 0.32, spec.d * 0.72, mats.moss, false);
        if (spec.ramp) {
            place.addRamp(p.x + spec.ramp.dx, spec.ramp.y, p.z + spec.ramp.dz, spec.ramp.w, spec.ramp.h, spec.ramp.d, mats.limestone, spec.ramp.rotY, spec.ramp.tiltX, true);
        }
    }

    function buildCliffShelves(bounds, place, mats) {
        var specs = [
            { id: 'northwest-bank', bounds: bounds, u: 0.18, v: 0.20, w: 10.6, h: 5.4, d: 8.2, capDx: -0.5, dark: true },
            { id: 'west-middle-bank', bounds: bounds, u: 0.20, v: 0.48, w: 8.8, h: 4.2, d: 9.8, capDx: 0.4 },
            { id: 'west-south-bank', bounds: bounds, u: 0.22, v: 0.72, w: 9.8, h: 5.0, d: 8.4, capDz: -0.4, ramp: { dx: 3.4, dz: -2.2, y: 1.2, w: 6.0, h: 0.9, d: 3.0, rotY: -0.5, tiltX: -0.12 } },
            { id: 'northeast-bank', bounds: bounds, u: 0.82, v: 0.24, w: 10.0, h: 5.0, d: 8.0, light: true },
            { id: 'east-middle-bank', bounds: bounds, u: 0.79, v: 0.50, w: 8.8, h: 4.6, d: 9.4, capDx: -0.3 },
            { id: 'east-south-bank', bounds: bounds, u: 0.78, v: 0.73, w: 9.8, h: 5.2, d: 7.8, dark: true, ramp: { dx: -3.5, dz: -1.8, y: 1.15, w: 6.2, h: 0.86, d: 3.0, rotY: 0.48, tiltX: -0.12 } }
        ];
        for (var i = 0; i < specs.length; i++) buildCliffShelf(specs[i], place, mats);
        return specs.length;
    }

    function addSteppingStone(place, x, z, w, d, mats, index) {
        tb(place, 'stepping-stone', { index: index }, x, 0.24, z, w, 0.34, d, index % 2 === 0 ? mats.limestoneLight : mats.shale, true);
        tb(place, 'stepping-stone-moss', { index: index }, x - 0.08, 0.43, z + 0.04, w * 0.58, 0.08, d * 0.46, mats.moss, false);
    }

    function buildCrossings(bounds, place, mats) {
        var center = pt(bounds, 0.50, 0.49);
        var south = pt(bounds, 0.50, 0.73);
        var north = pt(bounds, 0.47, 0.25);
        buildStoneArch(place, center.x, center.z, 8.4, 5.4, 6.4, mats, 'middle-river-arch');
        buildStoneArch(place, south.x + 2.2, south.z, 7.4, 4.8, 5.4, mats, 'south-side-arch');
        buildStoneArch(place, north.x - 1.8, north.z, 6.6, 4.4, 4.6, mats, 'north-brook-arch');

        var stones = [
            pt(bounds, 0.49, 0.36),
            pt(bounds, 0.53, 0.39),
            pt(bounds, 0.47, 0.42),
            pt(bounds, 0.56, 0.61),
            pt(bounds, 0.51, 0.65),
            pt(bounds, 0.45, 0.68)
        ];
        for (var i = 0; i < stones.length; i++) {
            addSteppingStone(place, stones[i].x, stones[i].z, 2.5 - (i % 2) * 0.4, 1.55 + (i % 3) * 0.2, mats, i);
        }

        return {
            arches: 3,
            steppingStones: stones.length
        };
    }

    function buildLowCover(bounds, place, mats) {
        var covers = [
            { u: 0.34, v: 0.18, w: 2.8, d: 1.4 },
            { u: 0.65, v: 0.28, w: 2.4, d: 1.6 },
            { u: 0.32, v: 0.58, w: 2.8, d: 1.5 },
            { u: 0.68, v: 0.62, w: 2.6, d: 1.5 },
            { u: 0.40, v: 0.82, w: 3.1, d: 1.6 },
            { u: 0.62, v: 0.84, w: 2.8, d: 1.4 }
        ];
        for (var i = 0; i < covers.length; i++) {
            var pos = pt(bounds, covers[i].u, covers[i].v);
            tb(place, 'river-rock-cover', { index: i }, pos.x, 0.62, pos.z, covers[i].w, 1.24, covers[i].d, i % 2 ? mats.shale : mats.limestoneDark, true);
            tb(place, 'river-rock-cover-moss', { index: i }, pos.x, 1.28, pos.z, covers[i].w * 0.62, 0.12, covers[i].d * 0.64, mats.moss, false);
        }

        var logs = [
            { u: 0.29, v: 0.36, w: 4.4, d: 0.7 },
            { u: 0.71, v: 0.42, w: 4.0, d: 0.7 },
            { u: 0.30, v: 0.79, w: 4.2, d: 0.8 },
            { u: 0.70, v: 0.78, w: 4.0, d: 0.8 }
        ];
        for (var j = 0; j < logs.length; j++) {
            var logPos = pt(bounds, logs[j].u, logs[j].v);
            var alongX = j % 2 === 0;
            tb(place, 'fallen-log', { index: j }, logPos.x, 0.48, logPos.z, alongX ? logs[j].w : logs[j].d, 0.62, alongX ? logs[j].d : logs[j].w, mats.driftwood, true);
            tb(place, 'fallen-log-moss', { index: j }, logPos.x + 0.1, 0.82, logPos.z - 0.08, alongX ? logs[j].w * 0.55 : 0.36, 0.08, alongX ? 0.36 : logs[j].w * 0.55, mats.mossDark, false);
        }

        return covers.length + logs.length;
    }

    function addTree(bounds, place, ctx, mats, u, v, scale, index) {
        var pos = pt(bounds, u, v);
        var trunkH = 2.6 * scale;
        var trunkW = 0.55 * scale;
        tb(place, 'river-tree', { index: index, part: 'trunk' }, pos.x, trunkH * 0.5, pos.z, trunkW, trunkH, trunkW, mats.trunk, true);
        addSwayBlock(place, ctx, pos.x, trunkH + 0.7 * scale, pos.z, 2.8 * scale, 1.25 * scale, 2.6 * scale, index % 2 ? mats.canopyLight : mats.canopy, index * 0.72, 0.014);
        addSwayBlock(place, ctx, pos.x - 0.9 * scale, trunkH + 0.2 * scale, pos.z + 0.35 * scale, 1.9 * scale, 0.95 * scale, 1.7 * scale, mats.canopy, index * 1.1, 0.012);
        addSwayBlock(place, ctx, pos.x + 0.75 * scale, trunkH + 0.15 * scale, pos.z - 0.4 * scale, 1.7 * scale, 0.82 * scale, 1.5 * scale, mats.canopyLight, index * 1.34, 0.01);
    }

    function addReedPatch(bounds, place, mats, u, v, index) {
        var pos = pt(bounds, u, v);
        var stems = [
            { dx: -0.28, dz: -0.12, h: 0.9 },
            { dx: 0.04, dz: 0.1, h: 1.2 },
            { dx: 0.32, dz: -0.04, h: 0.75 },
            { dx: -0.02, dz: 0.34, h: 1.0 }
        ];
        for (var i = 0; i < stems.length; i++) {
            var stem = stems[i];
            tb(place, 'reed', { patch: index, stem: i }, pos.x + stem.dx, stem.h * 0.5, pos.z + stem.dz, 0.14, stem.h, 0.12, i % 2 ? mats.reedDark : mats.reed, false);
        }
        tb(place, 'reed-flower', { patch: index }, pos.x + 0.12, 1.12, pos.z + 0.05, 0.18, 0.18, 0.18, index % 2 ? mats.wildflowerBlue : mats.wildflowerYellow, false);
    }

    function buildGroves(bounds, place, mats, ctx) {
        var trees = [
            { u: 0.12, v: 0.13, s: 1.12 },
            { u: 0.88, v: 0.15, s: 0.96 },
            { u: 0.12, v: 0.39, s: 1.0 },
            { u: 0.89, v: 0.55, s: 1.08 },
            { u: 0.14, v: 0.86, s: 0.92 },
            { u: 0.88, v: 0.86, s: 1.0 }
        ];
        for (var i = 0; i < trees.length; i++) {
            addTree(bounds, place, ctx, mats, trees[i].u, trees[i].v, trees[i].s, i);
        }

        var reeds = [
            { u: 0.38, v: 0.14 },
            { u: 0.60, v: 0.20 },
            { u: 0.37, v: 0.43 },
            { u: 0.63, v: 0.53 },
            { u: 0.39, v: 0.66 },
            { u: 0.60, v: 0.72 },
            { u: 0.42, v: 0.90 },
            { u: 0.57, v: 0.92 }
        ];
        for (var r = 0; r < reeds.length; r++) {
            addReedPatch(bounds, place, mats, reeds[r].u, reeds[r].v, r);
        }

        var flowers = [
            { u: 0.23, v: 0.13, mat: mats.wildflowerYellow },
            { u: 0.76, v: 0.16, mat: mats.wildflowerBlue },
            { u: 0.18, v: 0.55, mat: mats.wildflowerBlue },
            { u: 0.82, v: 0.66, mat: mats.wildflowerYellow },
            { u: 0.27, v: 0.88, mat: mats.wildflowerYellow },
            { u: 0.73, v: 0.88, mat: mats.wildflowerBlue }
        ];
        for (var f = 0; f < flowers.length; f++) {
            var fp = pt(bounds, flowers[f].u, flowers[f].v);
            tb(place, 'wildflower-patch', { index: f }, fp.x, 0.13, fp.z, 1.4, 0.12, 0.75, flowers[f].mat, false);
            tb(place, 'wildflower-leaves', { index: f }, fp.x + 0.12, 0.11, fp.z - 0.08, 1.0, 0.1, 0.52, mats.meadow, false);
        }

        return {
            trees: trees.length,
            reedPatches: reeds.length,
            flowerPatches: flowers.length
        };
    }

    function addExclusions(bounds, ctx) {
        if (!ctx || typeof ctx.addExclusion !== 'function') return 0;
        var zones = [
            { u: 0.50, v: 0.92, r: 9.6 },
            { u: 0.18, v: 0.20, r: 5.6 },
            { u: 0.82, v: 0.24, r: 5.2 },
            { u: 0.20, v: 0.72, r: 5.2 },
            { u: 0.78, v: 0.73, r: 5.0 },
            { u: 0.50, v: 0.49, r: 4.8 }
        ];
        for (var i = 0; i < zones.length; i++) {
            var pos = pt(bounds, zones[i].u, zones[i].v);
            ctx.addExclusion(pos.x, pos.z, zones[i].r);
        }
        return zones.length;
    }

    function buildRiverArchesQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var centerX = (bounds.minX + bounds.maxX) * 0.5;
        var centerZ = (bounds.minZ + bounds.maxZ) * 0.5;

        tb(place, 'river-meadow-base', null, centerX, 0.035, centerZ, (bounds.maxX - bounds.minX) - 1.2, 0.07, (bounds.maxZ - bounds.minZ) - 1.2, mats.meadow, false);

        var riverSegments = buildRiverChannel(bounds, place, mats);
        var cliffStats = buildSouthCliff(bounds, place, mats, ctx);
        var shelfCount = buildCliffShelves(bounds, place, mats);
        var crossingStats = buildCrossings(bounds, place, mats);
        var coverCount = buildLowCover(bounds, place, mats);
        var groveStats = buildGroves(bounds, place, mats, ctx);
        var exclusionCount = addExclusions(bounds, ctx);

        return {
            riverSegments: riverSegments,
            naturalArches: crossingStats.arches,
            steppingStones: crossingStats.steppingStones,
            cliffShelves: shelfCount,
            cliffPeakHeight: cliffStats.cliffPeakHeight,
            waterfallTiles: cliffStats.waterfallTiles,
            cover: coverCount,
            trees: groveStats.trees,
            reedPatches: groveStats.reedPatches,
            flowerPatches: groveStats.flowerPatches,
            spawnExclusions: exclusionCount,
            financeBlocks: 0,
            tickerBoards: 0,
            vaultDoors: 0,
            towerPeakHeight: 0
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns['river-arches'] = buildRiverArchesQuadrant;
})();
