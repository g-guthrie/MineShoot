import { pointInBounds as pt, cloneMaterial } from './biome-utils.js';

/**
 * quadrant-quarry.js - Terraced excavation zone with a timber derrick, conveyor line,
 * ore-cart rails, cut-stone piles, scaffolding and a tool shed.
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            rock: lib.getLambert({ color: 0x816e61 }),
            darkRock: lib.getLambert({ color: 0x5b4b42 }),
            dust: lib.getLambert({ color: 0xb59d88 }),
            steel: lib.getLambert({ color: 0x61696f }),
            stripe: lib.getLambert({ color: 0xc99543 }),
            ore: lib.getLambert({ color: 0x6b868a }),
            timber: lib.getLambert({ color: 0x7a5b3d }),
            plank: lib.getLambert({ color: 0x946f49 }),
            gravel: lib.getLambert({ color: 0x97887a }),
            strataWarm: lib.getLambert({ color: 0x9c8270 }),
            strataDeep: lib.getLambert({ color: 0x6e594c }),
            ironOre: lib.getLambert({ color: 0x9a5b3c }),
            coal: lib.getLambert({ color: 0x3a332e }),
            puddle: lib.getLambert({ color: 0x55707c, transparent: true, opacity: 0.5 }),
            lanternGlow: lib.getLambert({ color: 0xffc06a, emissive: 0xd98c2b, emissiveIntensity: 0.65 })
        };
        return MATS;
    }

    // --- terraced excavation detail: strata bands, ore veins, cut steps ---

    var STRATA = [
        // { dx, y, dz, w, h, d, mat }
        { dx: 1.50, y: 0.62, dz: 5.76, w: 9.0, h: 0.18, d: 0.34, mat: 'strataWarm' },
        { dx: 0.82, y: 0.92, dz: 5.72, w: 7.5, h: 0.14, d: 0.26, mat: 'strataDeep' },
        { dx: -0.48, y: 0.66, dz: -7.36, w: 13.0, h: 0.18, d: 0.34, mat: 'strataDeep' },
        { dx: -1.28, y: 0.95, dz: -7.34, w: 10.0, h: 0.14, d: 0.26, mat: 'dust' },
        { dx: 4.66, y: 1.05, dz: -1.10, w: 0.34, h: 0.18, d: 7.6, mat: 'strataWarm' },
        { dx: 4.64, y: 1.35, dz: -1.10, w: 0.26, h: 0.14, d: 6.4, mat: 'strataDeep' },
        { dx: -1.68, y: 1.18, dz: 3.46, w: 9.6, h: 0.16, d: 0.30, mat: 'dust' },
        { dx: -1.08, y: 1.22, dz: -5.66, w: 9.0, h: 0.16, d: 0.30, mat: 'strataWarm' }
    ];

    var VEINS = [
        // { dx, y, dz, axis, mat } - small accent blocks half-embedded in bench faces
        { dx: -6.18, y: 0.30, dz: -9.05, axis: 'z', mat: 'ore' },
        { dx: 2.32, y: 0.24, dz: -9.05, axis: 'z', mat: 'ironOre' },
        { dx: 6.82, y: 0.34, dz: -9.05, axis: 'z', mat: 'coal' },
        { dx: 11.05, y: 0.30, dz: -3.24, axis: 'x', mat: 'ironOre' },
        { dx: 11.05, y: 0.26, dz: 3.26, axis: 'x', mat: 'ore' },
        { dx: -8.18, y: 0.30, dz: 9.05, axis: 'z', mat: 'coal' },
        { dx: -3.68, y: 0.26, dz: 9.05, axis: 'z', mat: 'ore' },
        { dx: 7.55, y: 0.60, dz: -2.74, axis: 'x', mat: 'ore' },
        { dx: 7.55, y: 0.85, dz: 0.76, axis: 'x', mat: 'coal' },
        { dx: 7.55, y: 0.55, dz: 2.96, axis: 'x', mat: 'ironOre' },
        { dx: -9.55, y: 0.70, dz: -3.74, axis: 'x', mat: 'ironOre' },
        { dx: -9.55, y: 0.90, dz: 1.76, axis: 'x', mat: 'coal' },
        { dx: -7.45, y: 1.30, dz: -2.74, axis: 'x', mat: 'ore' },
        { dx: 1.95, y: 1.60, dz: -0.44, axis: 'x', mat: 'ironOre' },
        { dx: -2.18, y: 1.55, dz: 1.45, axis: 'z', mat: 'coal' },
        { dx: -5.95, y: 1.50, dz: -2.74, axis: 'x', mat: 'ore' }
    ];

    function buildTerraceDetail(center, place, mats) {
        var i;
        for (i = 0; i < STRATA.length; i++) {
            var s = STRATA[i];
            place.addBlock(center.x + s.dx, s.y, center.z + s.dz, s.w, s.h, s.d, mats[s.mat], false);
        }
        for (i = 0; i < VEINS.length; i++) {
            var v = VEINS[i];
            var vw = (v.axis === 'z') ? 0.5 : 0.3;
            var vd = (v.axis === 'z') ? 0.3 : 0.5;
            place.addBlock(center.x + v.dx, v.y, center.z + v.dz, vw, 0.34, vd, mats[v.mat], false);
        }
        // cut step blocks up the west side (risers <= 0.33, treads >= 1.4)
        place.addBlock(center.x - 11.68, 0.17, center.z - 0.74, 1.8, 0.30, 1.6, mats.rock, true);
        place.addBlock(center.x - 10.08, 0.70, center.z - 0.74, 1.5, 0.28, 1.4, mats.dust, true);
        place.addBlock(center.x - 7.73, 1.26, center.z - 0.74, 1.4, 0.28, 1.4, mats.rock, true);
        return { strata: STRATA.length, veins: VEINS.length, steps: 3 };
    }

    // --- timber derrick crane with jib, counterweight and hanging hook ---

    function buildDerrick(crane, place, ctx, mats) {
        place.addBlock(crane.x, 0.25, crane.z, 5.2, 0.5, 5.2, mats.plank, true);
        place.addBlock(crane.x - 1.84, 0.9, crane.z - 1.88, 0.4, 0.8, 0.4, mats.timber, true);
        place.addBlock(crane.x + 1.86, 0.9, crane.z - 1.88, 0.4, 0.8, 0.4, mats.timber, true);
        place.addBlock(crane.x - 1.84, 0.9, crane.z + 1.82, 0.4, 0.8, 0.4, mats.timber, true);
        place.addBlock(crane.x + 1.86, 0.9, crane.z + 1.82, 0.4, 0.8, 0.4, mats.timber, true);
        place.addBlock(crane.x, 3.6, crane.z, 0.9, 6.2, 0.9, mats.timber, true);
        place.addBlock(crane.x, 6.9, crane.z, 1.3, 0.4, 1.3, mats.darkRock, true);
        place.addBlock(crane.x + 1.9, 6.3, crane.z, 6.8, 0.5, 0.7, mats.timber, true);
        // stepped kick-braces from platform to mast (addRamp tiltX cannot
        // pitch an X-long member, so build the diagonals from stacked steps)
        place.addBlock(crane.x + 1.30, 0.72, crane.z, 0.28, 0.45, 0.28, mats.timber, false);
        place.addBlock(crane.x + 0.95, 1.10, crane.z, 0.28, 0.45, 0.28, mats.timber, false);
        place.addBlock(crane.x + 0.60, 1.48, crane.z, 0.28, 0.45, 0.28, mats.timber, false);
        place.addBlock(crane.x - 1.28, 0.72, crane.z, 0.28, 0.45, 0.28, mats.timber, false);
        place.addBlock(crane.x - 0.93, 1.10, crane.z, 0.28, 0.45, 0.28, mats.timber, false);
        place.addBlock(crane.x - 0.58, 1.48, crane.z, 0.28, 0.45, 0.28, mats.timber, false);
        place.addBlock(crane.x - 1.14, 6.0, crane.z, 0.12, 0.7, 0.12, mats.steel, false);
        place.addBlock(crane.x - 1.14, 5.15, crane.z, 1.3, 1.1, 1.1, mats.darkRock, true);
        place.addBlock(crane.x + 4.86, 4.95, crane.z, 0.12, 2.2, 0.12, mats.steel, false);
        place.addBlock(crane.x + 4.86, 3.4, crane.z, 1.0, 0.9, 1.0, mats.rock, true);
        place.addBlock(crane.x - 0.74, 0.9, crane.z + 1.12, 0.9, 0.8, 1.2, mats.steel, true);
        ctx.addExclusion(crane.x, crane.z, 4.2);
    }

    // --- conveyor line on trestles feeding the gravel heap ---

    function buildConveyor(bounds, place, mats) {
        var belt = pt(bounds, 0.670, 0.439);
        // belt runs along Z so tiltX gives a true pitch (+Z end rises)
        place.addRamp(belt.x, 1.75, belt.z, 2.0, 0.28, 7.4, mats.steel, 0, -0.24, true);
        // trestles
        place.addBlock(belt.x + 0.45, 0.5, belt.z - 1.95, 0.3, 1.0, 0.3, mats.timber, true);
        place.addBlock(belt.x - 0.05, 0.75, belt.z + 0.10, 0.3, 1.5, 0.3, mats.timber, true);
        place.addBlock(belt.x - 0.55, 1.0, belt.z + 2.05, 0.3, 2.0, 0.3, mats.timber, true);
        place.addBlock(belt.x + 0.45, 1.1, belt.z - 1.95, 1.7, 0.2, 0.5, mats.plank, false);
        place.addBlock(belt.x - 0.05, 1.6, belt.z + 0.10, 1.7, 0.2, 0.5, mats.plank, false);
        place.addBlock(belt.x - 0.55, 2.1, belt.z + 2.05, 1.7, 0.2, 0.5, mats.plank, false);
        // feed hopper at the low end
        place.addBlock(belt.x + 1.23, 1.01, belt.z - 3.78, 1.5, 0.9, 1.8, mats.steel, true);
        place.addBlock(belt.x + 1.23, 1.71, belt.z - 4.43, 1.7, 0.5, 0.3, mats.steel, false);
        place.addBlock(belt.x + 1.23, 1.71, belt.z - 3.13, 1.7, 0.5, 0.3, mats.steel, false);
        // head frame and spill chute at the high end
        place.addBlock(belt.x - 1.81, 1.3, belt.z + 3.72, 0.3, 2.6, 0.3, mats.timber, true);
        place.addBlock(belt.x - 0.01, 1.3, belt.z + 3.72, 0.3, 2.6, 0.3, mats.timber, true);
        place.addBlock(belt.x - 0.91, 2.72, belt.z + 3.72, 2.3, 0.24, 0.36, mats.timber, false);
        place.addRamp(belt.x - 0.81, 2.0, belt.z + 4.82, 1.6, 0.16, 1.4, mats.steel, 0, 0.5, false);
        // gravel heap under the spill chute
        var heap = { x: belt.x - 0.9, z: belt.z + 6.3 };
        place.addBlock(heap.x, 0.4, heap.z, 3.4, 0.8, 3.0, mats.gravel, true);
        place.addBlock(heap.x + 0.15, 1.15, heap.z + 0.1, 2.4, 0.7, 2.1, mats.gravel, true);
        place.addBlock(heap.x - 0.1, 1.8, heap.z - 0.1, 1.4, 0.6, 1.2, mats.gravel, true);
    }

    // --- ore cart on short rail strips ---

    function buildOreRail(bounds, place, mats) {
        var rail = pt(bounds, 0.287, 0.185);
        var rA = rail.x - 0.6;
        var rB = rail.x + 0.6;
        // rails staggered (tops 0.13 / 0.16) so strips never share a top plane
        place.addBlock(rA, 0.075, rail.z - 2.99, 0.18, 0.11, 5.6, mats.steel, false);
        place.addBlock(rA, 0.075, rail.z + 3.01, 0.18, 0.11, 5.6, mats.steel, false);
        place.addBlock(rB, 0.095, rail.z - 2.79, 0.18, 0.13, 5.6, mats.steel, false);
        place.addBlock(rB, 0.095, rail.z + 3.21, 0.18, 0.13, 5.6, mats.steel, false);
        var sleeperOffsets = [-5.09, -2.89, -0.69, 1.51, 3.71, 5.71];
        for (var i = 0; i < sleeperOffsets.length; i++) {
            place.addBlock(rail.x, 0.037, rail.z + sleeperOffsets[i], 2.0, 0.05, 0.5, mats.timber, false);
        }
        // end bumpers
        place.addBlock(rail.x, 0.25, rail.z - 6.1, 1.0, 0.5, 0.4, mats.timber, true);
        place.addBlock(rail.x, 0.25, rail.z + 6.4, 1.0, 0.5, 0.4, mats.timber, true);
        // ore cart
        place.addBlock(rA, 0.3, rail.z - 0.55, 0.5, 0.5, 0.5, mats.darkRock, false);
        place.addBlock(rA, 0.3, rail.z + 0.55, 0.5, 0.5, 0.5, mats.darkRock, false);
        place.addBlock(rB, 0.3, rail.z - 0.55, 0.5, 0.5, 0.5, mats.darkRock, false);
        place.addBlock(rB, 0.3, rail.z + 0.55, 0.5, 0.5, 0.5, mats.darkRock, false);
        place.addBlock(rail.x, 1.05, rail.z, 1.3, 1.0, 1.7, mats.steel, true);
        place.addBlock(rail.x, 1.62, rail.z, 1.0, 0.5, 1.3, mats.ore, false);
        place.addBlock(rail.x + 0.1, 1.95, rail.z - 0.2, 0.6, 0.4, 0.8, mats.ironOre, false);
    }

    // --- stacked cut-stone piles (FPS cover) ---

    var STONE_PILES = [
        { u: 0.900, v: 0.644, lean: 0.45 },
        { u: 0.493, v: 0.176, lean: 0 },
        { u: 0.341, v: 0.881, lean: 0 },
        { u: 0.731, v: 0.911, lean: -0.5 },
        { u: 0.067, v: 0.343, lean: 0 },
        { u: 0.885, v: 0.509, lean: 0 }
    ];

    function buildStonePiles(bounds, place, mats) {
        for (var i = 0; i < STONE_PILES.length; i++) {
            var p = STONE_PILES[i];
            var at = pt(bounds, p.u, p.v);
            place.addBlock(at.x, 0.35, at.z, 2.2, 0.7, 1.6, mats.dust, true);
            place.addBlock(at.x + 0.15, 1.0, at.z + 0.1, 1.6, 0.6, 1.2, mats.rock, true);
            place.addBlock(at.x - 0.1, 1.55, at.z - 0.1, 1.0, 0.5, 0.9, mats.dust, true);
            if (p.lean) {
                place.addRamp(at.x - 1.1, 0.5, at.z - 1.3, 1.4, 0.18, 1.1, mats.dust, p.lean, 0.85, false);
            }
        }
        return STONE_PILES.length;
    }

    // --- wooden scaffolding against the south bench face ---

    function buildScaffold(center, place, mats) {
        var px = [-3.88, -1.48, 0.92];
        var pz = [6.26, 7.66];
        for (var ix = 0; ix < px.length; ix++) {
            for (var iz = 0; iz < pz.length; iz++) {
                place.addBlock(center.x + px[ix], 1.7, center.z + pz[iz], 0.24, 2.6, 0.24, mats.timber, true);
            }
        }
        place.addBlock(center.x - 1.48, 1.32, center.z + 6.96, 5.4, 0.16, 1.5, mats.plank, true);
        place.addBlock(center.x - 1.48, 2.44, center.z + 6.96, 5.4, 0.16, 1.5, mats.plank, true);
        place.addBlock(center.x - 1.48, 1.06, center.z + 6.26, 5.2, 0.14, 0.14, mats.timber, false);
        place.addBlock(center.x - 1.48, 2.18, center.z + 7.66, 5.2, 0.14, 0.14, mats.timber, false);
        place.addRamp(center.x - 2.78, 1.7, center.z + 7.76, 0.2, 0.2, 2.6, mats.timber, 0, 0.9, false);
        place.addRamp(center.x - 0.18, 1.7, center.z + 6.16, 0.2, 0.2, 2.6, mats.timber, 0, -0.9, false);
    }

    // --- tool shed with flickering lantern ---

    function buildShed(bounds, place, ctx, mats) {
        var s = pt(bounds, 0.115, 0.685);
        place.addBlock(s.x, 0.10, s.z, 3.8, 0.16, 3.4, mats.plank, true);
        place.addBlock(s.x - 1.67, 1.28, s.z, 0.24, 2.2, 3.2, mats.timber, true);
        place.addBlock(s.x, 1.28, s.z - 1.47, 3.0, 2.2, 0.24, mats.timber, true);
        place.addBlock(s.x, 1.28, s.z + 1.49, 3.0, 2.2, 0.24, mats.timber, true);
        place.addBlock(s.x + 1.65, 1.28, s.z - 1.14, 0.24, 2.2, 0.9, mats.timber, true);
        place.addBlock(s.x + 1.65, 1.28, s.z + 1.16, 0.24, 2.2, 0.9, mats.timber, true);
        place.addBlock(s.x + 1.65, 2.13, s.z, 0.24, 0.5, 3.0, mats.timber, true);
        place.addBlock(s.x, 2.49, s.z, 4.4, 0.22, 4.0, mats.darkRock, true);
        place.addBlock(s.x, 2.69, s.z, 2.4, 0.18, 3.4, mats.rock, false);
        // lantern on a bracket arm by the door
        place.addBlock(s.x + 2.14, 2.0, s.z - 0.89, 0.9, 0.1, 0.12, mats.timber, false);
        var lampMat = cloneMaterial(mats.lanternGlow);
        place.addBlock(s.x + 2.54, 1.72, s.z - 0.89, 0.36, 0.36, 0.36, lampMat, false);
        place.addBlock(s.x + 2.54, 1.95, s.z - 0.89, 0.44, 0.1, 0.44, mats.coal, false);
        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({
                material: lampMat,
                freq: 2.2,
                phase: 0.6,
                baseIntensity: 0.65,
                amplitude: 0.3
            });
        }
        ctx.addExclusion(s.x, s.z, 2.4);
        // crates, barrel and timber stack outside
        place.addBlock(s.x + 2.7, 0.45, s.z + 2.8, 0.9, 0.9, 0.9, mats.plank, true);
        place.addBlock(s.x + 2.74, 1.25, s.z + 2.76, 0.7, 0.7, 0.7, mats.timber, true);
        place.addBlock(s.x + 1.6, 0.45, s.z + 3.45, 0.7, 0.9, 0.7, mats.darkRock, true);
        var logs = pt(bounds, 0.170, 0.789);
        var lx = [-0.62, 0, 0.62];
        for (var i = 0; i < lx.length; i++) {
            place.addBlock(logs.x + lx[i], 0.25, logs.z, 0.52, 0.5, 3.6, mats.timber, true);
        }
        place.addBlock(logs.x - 0.31, 0.75, logs.z, 0.52, 0.5, 3.6, mats.timber, true);
        place.addBlock(logs.x + 0.31, 0.75, logs.z, 0.52, 0.5, 3.6, mats.timber, true);
        place.addBlock(logs.x, 1.25, logs.z, 0.52, 0.5, 3.6, mats.timber, true);
    }

    // --- spoil heaps and scattered boulders ---

    var SPOIL = [
        { u: 0.222, v: 0.944, w: 5.4, h: 0.9, d: 3.2, cw: 3.2, ch: 0.5, cd: 2.0, cy: 1.05 },
        { u: 0.574, v: 0.959, w: 6.2, h: 1.1, d: 3.4, cw: 3.8, ch: 0.6, cd: 2.2, cy: 1.25 },
        { u: 0.435, v: 0.941, w: 4.6, h: 0.7, d: 2.6, cw: 2.6, ch: 0.5, cd: 1.6, cy: 0.85 }
    ];

    var BOULDERS = [
        { u: 0.137, v: 0.070, k: 'a' },
        { u: 0.417, v: 0.083, k: 'r', rot: 0.6 },
        { u: 0.843, v: 0.078, k: 'b' },
        { u: 0.948, v: 0.389, k: 'a' },
        { u: 0.937, v: 0.191, k: 'b' },
        { u: 0.056, v: 0.565, k: 'c' },
        { u: 0.122, v: 0.807, k: 'b' },
        { u: 0.522, v: 0.789, k: 'a' },
        { u: 0.307, v: 0.337, k: 'b' },
        { u: 0.639, v: 0.852, k: 'r', rot: -0.7 },
        { u: 0.907, v: 0.935, k: 'a' }
    ];

    function buildSpoilAndBoulders(bounds, place, mats) {
        var i;
        for (i = 0; i < SPOIL.length; i++) {
            var sp = SPOIL[i];
            var at = pt(bounds, sp.u, sp.v);
            place.addBlock(at.x, sp.h * 0.5, at.z, sp.w, sp.h, sp.d, mats.darkRock, true);
            place.addBlock(at.x + 0.2, sp.cy, at.z - 0.15, sp.cw, sp.ch, sp.cd, mats.gravel, true);
        }
        for (i = 0; i < BOULDERS.length; i++) {
            var b = BOULDERS[i];
            var bat = pt(bounds, b.u, b.v);
            if (b.k === 'a') {
                place.addBlock(bat.x, 0.45, bat.z, 1.2, 0.9, 1.0, mats.rock, true);
            } else if (b.k === 'b') {
                place.addBlock(bat.x, 0.35, bat.z, 0.9, 0.7, 0.8, mats.darkRock, true);
            } else if (b.k === 'c') {
                place.addBlock(bat.x, 0.5, bat.z, 1.5, 1.0, 1.2, mats.rock, true);
            } else {
                place.addRamp(bat.x, 0.5, bat.z, 1.5, 1.0, 1.2, mats.darkRock, b.rot, 0, true);
            }
        }
        return { spoil: SPOIL.length, boulders: BOULDERS.length };
    }

    // --- ground dressing: gravel patches, rock-dust decals, puddles ---

    var GRAVEL_SINGLES = [
        { u: 0.361, v: 0.269, k: 'A' },
        { u: 0.083, v: 0.769, k: 'B' },
        { u: 0.454, v: 0.806, k: 'A' },
        { u: 0.898, v: 0.750, k: 'B' },
        { u: 0.389, v: 0.343, k: 'B' },
        { u: 0.537, v: 0.120, k: 'A' },
        { u: 0.093, v: 0.148, k: 'B' },
        { u: 0.231, v: 0.881, k: 'A' },
        { u: 0.778, v: 0.778, k: 'B' },
        { u: 0.941, v: 0.583, k: 'A' },
        { u: 0.733, v: 0.478, k: 'B' },
        { u: 0.844, v: 0.385, k: 'B' },
        { u: 0.831, v: 0.480, k: 'B' }
    ];

    var GRAVEL_TRIOS = [
        { u: 0.185, v: 0.472 },
        { u: 0.676, v: 0.620 },
        { u: 0.787, v: 0.344 }
    ];

    var DUST_DECALS = [
        { u: 0.180, v: 0.133 },
        { u: 0.252, v: 0.241 },
        { u: 0.509, v: 0.222 },
        { u: 0.330, v: 0.833 },
        { u: 0.870, v: 0.693 },
        { u: 0.070, v: 0.293 },
        { u: 0.704, v: 0.556 },
        { u: 0.574, v: 0.904 }
    ];

    function buildGroundDressing(bounds, place, mats) {
        var i;
        var at;
        for (i = 0; i < GRAVEL_SINGLES.length; i++) {
            var g = GRAVEL_SINGLES[i];
            at = pt(bounds, g.u, g.v);
            if (g.k === 'A') {
                place.addBlock(at.x, 0.04, at.z, 2.8, 0.06, 2.2, mats.gravel, false);
            } else {
                place.addBlock(at.x, 0.04, at.z, 2.0, 0.06, 1.6, mats.gravel, false);
            }
        }
        // layered patches: staggered bottoms (0.01/0.03/0.06) and tops (0.06/0.09/0.12)
        for (i = 0; i < GRAVEL_TRIOS.length; i++) {
            at = pt(bounds, GRAVEL_TRIOS[i].u, GRAVEL_TRIOS[i].v);
            place.addBlock(at.x, 0.035, at.z, 2.6, 0.05, 2.0, mats.gravel, false);
            place.addBlock(at.x + 0.3, 0.06, at.z + 0.2, 1.9, 0.06, 1.5, mats.dust, false);
            place.addBlock(at.x - 0.2, 0.09, at.z + 0.3, 1.2, 0.06, 1.0, mats.strataDeep, false);
        }
        for (i = 0; i < DUST_DECALS.length; i++) {
            at = pt(bounds, DUST_DECALS[i].u, DUST_DECALS[i].v);
            place.addBlock(at.x, 0.05, at.z, 1.7, 0.06, 1.4, mats.dust, false);
        }
        // shallow puddles (non-solid, tops at 0.04 / 0.06)
        at = pt(bounds, 0.306, 0.769);
        place.addBlock(at.x, 0.025, at.z, 2.6, 0.03, 2.0, mats.puddle, false);
        at = pt(bounds, 0.685, 0.126);
        place.addBlock(at.x, 0.035, at.z, 3.0, 0.05, 2.3, mats.puddle, false);
        return (GRAVEL_SINGLES.length + (GRAVEL_TRIOS.length * 3) + DUST_DECALS.length + 2);
    }

    function buildQuarryQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var center = pt(bounds, 0.42, 0.56);

        // --- terraced excavation benches ---
        place.addBlock(center.x, 0.28, center.z, 22.0, 0.56, 18.0, mats.darkRock, true);
        place.addBlock(center.x - 1.0, 0.7, center.z - 0.8, 17.0, 0.84, 13.0, mats.rock, true);
        place.addBlock(center.x - 1.4, 1.2, center.z - 1.1, 12.0, 0.9, 9.0, mats.dust, true);
        place.addBlock(center.x - 2.0, 1.6, center.z - 1.4, 7.8, 0.76, 5.6, mats.darkRock, true);
        place.addBlock(center.x - 2.0, 2.2, center.z - 1.4, 4.2, 0.4, 2.6, mats.ore, true);

        place.addRamp(center.x + 7.6, 1.4, center.z + 4.1, 3.2, 0.8, 7.4, mats.rock, 1.0, -0.22, true);
        place.addRamp(center.x + 5.8, 0.7, center.z - 4.8, 2.6, 0.6, 6.0, mats.rock, -0.82, -0.18, true);
        place.addRamp(center.x - 7.2, 1.0, center.z + 5.2, 2.8, 0.7, 6.6, mats.darkRock, -1.08, -0.2, true);

        var detail = buildTerraceDetail(center, place, mats);

        // --- timber derrick crane ---
        var crane = pt(bounds, 0.76, 0.22);
        buildDerrick(crane, place, ctx, mats);

        // --- raised catwalk ---
        var catwalk = pt(bounds, 0.66, 0.72);
        place.addBlock(catwalk.x, 2.5, catwalk.z, 10.8, 0.24, 1.6, mats.steel, true);
        place.addBlock(catwalk.x - 4.9, 1.25, catwalk.z - 0.2, 0.3, 2.5, 0.3, mats.steel, true);
        place.addBlock(catwalk.x + 4.9, 1.25, catwalk.z + 0.2, 0.3, 2.5, 0.3, mats.steel, true);
        place.addRamp(catwalk.x - 6.8, 1.2, catwalk.z - 0.2, 2.2, 0.6, 4.8, mats.steel, 1.1, -0.22, true);
        place.addRamp(catwalk.x + 6.6, 1.1, catwalk.z + 0.2, 2.2, 0.6, 4.4, mats.steel, -1.02, -0.22, true);

        // --- drill pad ---
        var drill = pt(bounds, 0.18, 0.22);
        place.addBlock(drill.x, 0.42, drill.z, 5.0, 0.84, 5.0, mats.darkRock, true);
        place.addBlock(drill.x, 2.4, drill.z, 0.8, 4.0, 0.8, mats.steel, true);
        place.addBlock(drill.x, 4.3, drill.z, 2.6, 0.24, 2.6, mats.stripe, false);
        place.addRamp(drill.x, 1.05, drill.z + 2.8, 2.4, 0.5, 3.8, mats.rock, Math.PI, -0.18, true);

        // --- rim ridges ---
        var ridgeA = pt(bounds, 0.1, 0.86);
        var ridgeB = pt(bounds, 0.88, 0.86);
        place.addBlock(ridgeA.x, 0.38, ridgeA.z, 4.0, 0.76, 3.0, mats.rock, true);
        place.addBlock(ridgeB.x, 0.46, ridgeB.z, 5.4, 0.92, 3.6, mats.darkRock, true);

        // --- work-site props ---
        buildConveyor(bounds, place, mats);
        buildOreRail(bounds, place, mats);
        var pileCount = buildStonePiles(bounds, place, mats);
        buildScaffold(center, place, mats);
        buildShed(bounds, place, ctx, mats);
        var rough = buildSpoilAndBoulders(bounds, place, mats);
        var decals = buildGroundDressing(bounds, place, mats);

        return {
            pits: 1,
            cranes: 1,
            catwalks: 1,
            benches: 4,
            strataBands: detail.strata,
            oreVeins: detail.veins,
            conveyors: 1,
            carts: 1,
            stonePiles: pileCount,
            scaffolds: 1,
            sheds: 1,
            spoilHeaps: rough.spoil,
            boulders: rough.boulders,
            decals: decals
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.quarry = buildQuarryQuadrant;
})();
