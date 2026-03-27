import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-pirate-cove.js - Pirate Ship & Dock Cove
 *
 * A pirate ship sitting in water connected to a wooden dock.
 * The hull is cut at the waterline — the bottom half is hidden beneath
 * a translucent water plane so it looks like the ship is floating.
 *
 * Uses addDecor() for cylinder/sphere primitives, addBlock() for boxes.
 * All box positions are center-based. Z-fight prevention: roofs embed 0.05
 * into walls, windows protrude 0.06.
 */
(function () {
    'use strict';

    var MATS = null;
    var CYLINDER_SEGMENTS = 12;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            // Water
            water:         lib.getLambert({ color: 0x145874 }),
            waterDeep:     lib.getLambert({ color: 0x0d4f6b }),
            // Hull
            hullDark:      lib.getLambert({ color: 0x4a2e1a }),
            hullMid:       lib.getLambert({ color: 0x5c3a22 }),
            hullLight:     lib.getLambert({ color: 0x6e4830 }),
            // Deck
            deckPlanks:    lib.getLambert({ color: 0x8B7355 }),
            deckTrim:      lib.getLambert({ color: 0x6B5335 }),
            // Mast & rigging
            mastWood:      lib.getLambert({ color: 0x5a3a1a }),
            sail:          lib.getLambert({ color: 0xE8DCC8 }),
            sailDark:      lib.getLambert({ color: 0xC8B8A0 }),
            rope:          lib.getLambert({ color: 0x8B7355 }),
            // Cabin
            cabinWall:     lib.getLambert({ color: 0x5c3a22 }),
            cabinRoof:     lib.getLambert({ color: 0x3a2210 }),
            cabinWindow:   lib.getLambert({ color: 0xAACC88, emissive: 0x446622 }),
            // Dock
            dockWood:      lib.getLambert({ color: 0x9B8565 }),
            dockPost:      lib.getLambert({ color: 0x6B5335 }),
            dockRope:      lib.getLambert({ color: 0xAA9966 }),
            // Flags & details
            flagRed:       lib.getLambert({ color: 0x222222 }),
            flagSkull:     lib.getLambert({ color: 0x111111 }),
            gold:          lib.getLambert({ color: 0xDAA520, emissive: 0x553300 }),
            iron:          lib.getLambert({ color: 0x666677 }),
            // Cannon
            cannonBlack:   lib.getLambert({ color: 0x2a2a2a }),
            cannonWheel:   lib.getLambert({ color: 0x5a3a1a }),
            // Environment
            sand:          lib.getLambert({ color: 0xC2B280 }),
            rock:          lib.getLambert({ color: 0x666655 }),
            rockDark:      lib.getLambert({ color: 0x4a4a3e }),
            palmTrunk:     lib.getLambert({ color: 0x7B5B3A }),
            palmLeaf:      lib.getLambert({ color: 0x2D8B2D }),
            palmLeafDark:  lib.getLambert({ color: 0x1D6B1D }),
            // Lantern
            lanternFrame:  lib.getLambert({ color: 0x444444 }),
            lanternGlow:   lib.getLambert({ color: 0xFFAA33, emissive: 0xCC7700 }),
            // Barrel
            barrel:        lib.getLambert({ color: 0x6B4226 }),
            barrelBand:    lib.getLambert({ color: 0x555555 }),
            // Crate
            crate:         lib.getLambert({ color: 0x8B7355 }),
            crateBand:     lib.getLambert({ color: 0x5a3a1a }),
            // Kraken
            krakenBody:    lib.getLambert({ color: 0x6B2D8B }),
            krakenDark:    lib.getLambert({ color: 0x4A1D6B }),
            krakenEye:     lib.getLambert({ color: 0x111111 }),
            krakenEyeWhite:lib.getLambert({ color: 0xDDDDCC })
        };
        return MATS;
    }

    /* ── shorthand helpers ── */
    function tb(place, role, meta, x, y, z, w, h, d, material, isSolid) {
        void isSolid;
        var mesh = place.addBlock(x, y, z, w, h, d, material, true);
        if (mesh) {
            mesh.userData = mesh.userData || {};
            mesh.userData.role = role;
            if (meta) { for (var k in meta) { mesh.userData[k] = meta[k]; } }
        }
        return mesh;
    }

    function td(place, role, meta, x, y, z, geometry, material, rotY, rotX, rotZ) {
        var mesh = place.addDecor(x, y, z, geometry, material, rotY || 0, rotX || 0, rotZ || 0);
        if (mesh) {
            mesh.userData = mesh.userData || {};
            mesh.userData.role = role;
            if (meta) { for (var k in meta) { mesh.userData[k] = meta[k]; } }
        }
        return mesh;
    }

    /* ══════════════════════════════════════════════════════ */
    /* ── ASSET BUILDERS                                   ── */
    /* ══════════════════════════════════════════════════════ */

    /* ── Water plane ── */
    function buildWater(cx, cz, sizeX, sizeZ, place, mats) {
        // Main water surface — top face at y=0.05, just below sand top (y=0.06)
        tb(place, 'water', null, cx, -0.05, cz, sizeX, 0.2, sizeZ, mats.water, false);
        // Dark bottom beneath water
        tb(place, 'seabed', null, cx, -1.5, cz, sizeX, 2.6, sizeZ, mats.waterDeep, false);
    }

    /* ── Ship Hull (above waterline only) ── */
    function buildHull(sx, sz, place, mats) {
        // Ship runs along Z axis (bow=north, stern=south)
        // sx,sz = center of ship at waterline

        var hullW = 8;    // width (X)
        var hullH = 4;    // height above water
        var hullL = 22;   // length (Z)

        // Main hull body — visible above waterline
        tb(place, 'hull', { part: 'body' }, sx, hullH / 2, sz, hullW, hullH, hullL, mats.hullDark, true);

        // Hull stripe — waterline trim
        tb(place, 'hull', { part: 'stripe' }, sx, 0.3, sz, hullW + 0.1, 0.6, hullL + 0.1, mats.hullLight, false);

        // Bow taper (north end) — narrowing blocks
        var bowZ = sz - hullL / 2;
        tb(place, 'hull', { part: 'bow-taper1' }, sx, hullH / 2, bowZ - 1.5, 6, hullH, 3, mats.hullMid, true);
        tb(place, 'hull', { part: 'bow-taper2' }, sx, hullH / 2, bowZ - 3.5, 4, hullH, 2, mats.hullMid, true);
        tb(place, 'hull', { part: 'bowsprit' }, sx, hullH / 2 + 0.5, bowZ - 5.5, 1.5, 1.5, 3, mats.hullDark, true);

        // Stern (south end) — flat back with slight raise
        var sternZ = sz + hullL / 2;
        tb(place, 'hull', { part: 'stern' }, sx, hullH / 2 + 1, sternZ + 0.5, hullW + 0.5, hullH + 2, 1.5, mats.hullDark, true);

        // Gunwale rails (top edge of hull)
        tb(place, 'hull', { part: 'rail-port' }, sx - hullW / 2 + 0.2, hullH + 0.3, sz, 0.4, 0.6, hullL, mats.hullLight, false);
        tb(place, 'hull', { part: 'rail-star' }, sx + hullW / 2 - 0.2, hullH + 0.3, sz, 0.4, 0.6, hullL, mats.hullLight, false);

        return { hullW: hullW, hullH: hullH, hullL: hullL, bowZ: bowZ, sternZ: sternZ };
    }

    /* ── Deck ── */
    function buildDeck(sx, sz, hull, place, mats) {
        // Main deck floor
        tb(place, 'deck', { part: 'main' }, sx, hull.hullH + 0.05, sz, hull.hullW - 0.4, 0.1, hull.hullL - 1, mats.deckPlanks, true);

        // Forecastle (raised bow deck)
        var fcY = hull.hullH + 1.2;
        var fcZ = sz - hull.hullL / 2 + 3;
        tb(place, 'deck', { part: 'forecastle' }, sx, fcY, fcZ, hull.hullW - 0.6, 0.15, 5, mats.deckPlanks, true);
        // Forecastle front wall
        tb(place, 'deck', { part: 'fc-wall' }, sx, hull.hullH + 0.6, fcZ + 2.6, hull.hullW - 0.6, 1.2, 0.3, mats.deckTrim, true);

        // Poop deck (raised stern)
        var pdY = hull.hullH + 2.2;
        var pdZ = sz + hull.hullL / 2 - 3;
        tb(place, 'deck', { part: 'poop' }, sx, pdY, pdZ, hull.hullW - 0.2, 0.15, 6, mats.deckPlanks, true);

        return { fcY: fcY, fcZ: fcZ, pdY: pdY, pdZ: pdZ };
    }

    /* ── Captain's Cabin (on poop deck) ── */
    function buildCabin(sx, sz, hull, deck, place, mats) {
        var cabY = deck.pdY;
        var cabZ = deck.pdZ + 1;
        var cabW = 6;
        var cabH = 3.5;
        var cabD = 4;

        // Walls
        tb(place, 'cabin', { part: 'walls' }, sx, cabY + cabH / 2, cabZ, cabW, cabH, cabD, mats.cabinWall, true);
        // Roof
        tb(place, 'cabin', { part: 'roof' }, sx, cabY + cabH + 0.15, cabZ, cabW + 0.6, 0.3, cabD + 0.6, mats.cabinRoof, false);

        // Windows — stern (south face), pushed out past stern hull
        for (var wi = -1; wi <= 1; wi++) {
            tb(place, 'cabin', { part: 'window' },
                sx + wi * 1.8, cabY + cabH / 2 + 0.3, cabZ + cabD / 2 + 0.15,
                1.0, 1.0, 0.12, mats.cabinWindow, false);
        }

        return { cabY: cabY, cabZ: cabZ, cabW: cabW, cabH: cabH };
    }

    /* ── Masts with sails ── */
    function buildMast(sx, sz, baseY, height, sailCount, place, mats) {
        // Mast pole
        var mastGeo = new THREE.CylinderGeometry(0.25, 0.3, height, CYLINDER_SEGMENTS);
        td(place, 'mast', { part: 'pole' }, sx, baseY + height / 2, sz, mastGeo, mats.mastWood);

        // Crow's nest at top
        var nestGeo = new THREE.CylinderGeometry(1.0, 0.8, 0.6, CYLINDER_SEGMENTS);
        td(place, 'mast', { part: 'crows-nest' }, sx, baseY + height - 1, sz, nestGeo, mats.hullLight);

        // Yardarms + sails
        for (var si = 0; si < sailCount; si++) {
            var sailY = baseY + 3 + si * 3.5;
            var yardW = 7 - si * 1;

            // Yardarm (horizontal beam)
            tb(place, 'mast', { part: 'yardarm' }, sx, sailY + 1.5, sz, yardW, 0.2, 0.2, mats.mastWood, false);

            // Sail (thin box)
            var sailH = 2.8 - si * 0.3;
            tb(place, 'sail', { mast: si }, sx, sailY, sz, yardW - 0.5, sailH, 0.08,
                si % 2 === 0 ? mats.sail : mats.sailDark, false);
        }

        return { height: height };
    }

    /* ── Cannon ── */
    function buildCannon(cx, cy, cz, rotY, place, mats) {
        // Barrel
        var barrelGeo = new THREE.CylinderGeometry(0.25, 0.3, 2.0, 8);
        td(place, 'cannon', { part: 'barrel' }, cx, cy + 0.5, cz, barrelGeo, mats.cannonBlack, 0, 0, Math.PI / 2);

        // Carriage (base block)
        tb(place, 'cannon', { part: 'carriage' }, cx, cy + 0.2, cz, 0.8, 0.4, 1.2, mats.cannonWheel, false);

        // Wheels
        var wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8);
        td(place, 'cannon', { part: 'wheel' }, cx - 0.5, cy + 0.15, cz - 0.3, wheelGeo, mats.cannonBlack, 0, 0, Math.PI / 2);
        td(place, 'cannon', { part: 'wheel' }, cx - 0.5, cy + 0.15, cz + 0.3, wheelGeo, mats.cannonBlack, 0, 0, Math.PI / 2);
        td(place, 'cannon', { part: 'wheel' }, cx + 0.5, cy + 0.15, cz - 0.3, wheelGeo, mats.cannonBlack, 0, 0, Math.PI / 2);
        td(place, 'cannon', { part: 'wheel' }, cx + 0.5, cy + 0.15, cz + 0.3, wheelGeo, mats.cannonBlack, 0, 0, Math.PI / 2);
    }

    /* ── Barrel (prop) ── */
    function buildBarrel(bx, by, bz, place, mats, scale) {
        var s = scale || 1;
        var barrelGeo = new THREE.CylinderGeometry(0.5 * s, 0.5 * s, 1.2 * s, 8);
        td(place, 'barrel', null, bx, by + 0.6 * s, bz, barrelGeo, mats.barrel);
        // Metal bands
        var bandGeo = new THREE.CylinderGeometry(0.52 * s, 0.52 * s, 0.08 * s, 8);
        td(place, 'barrel', { part: 'band' }, bx, by + 0.3 * s, bz, bandGeo, mats.barrelBand);
        td(place, 'barrel', { part: 'band' }, bx, by + 0.9 * s, bz, bandGeo, mats.barrelBand);
    }

    /* ── Crate (prop) ── */
    function buildCrate(cx, cy, cz, place, mats, w, h, d) {
        w = w || 1; h = h || 1; d = d || 1;
        tb(place, 'crate', null, cx, cy + h / 2, cz, w, h, d, mats.crate, true);
        // Cross bands
        tb(place, 'crate', { part: 'band-x' }, cx, cy + h / 2, cz, w + 0.05, 0.08, d + 0.05, mats.crateBand, false);
        tb(place, 'crate', { part: 'band-z' }, cx, cy + h / 2, cz, 0.08, h + 0.05, d + 0.05, mats.crateBand, false);
    }

    /* ── Lantern ── */
    function buildLantern(lx, ly, lz, place, mats) {
        // Post
        tb(place, 'lantern', { part: 'post' }, lx, ly + 1.0, lz, 0.15, 2.0, 0.15, mats.iron, false);
        // Lamp body
        tb(place, 'lantern', { part: 'body' }, lx, ly + 2.2, lz, 0.4, 0.5, 0.4, mats.lanternFrame, false);
        // Glow
        tb(place, 'lantern', { part: 'glow' }, lx, ly + 2.2, lz, 0.25, 0.35, 0.25, mats.lanternGlow, false);
    }

    /* ── Dock ── */
    function buildDock(dx, dz, dockLen, dockW, place, mats) {
        // Dock runs along X axis, connecting to the ship's port side
        var dockY = 3.42; // Low enough to jump onto

        // Main dock planking
        tb(place, 'dock', { part: 'surface' }, dx, dockY, dz, dockLen, 0.3, dockW, mats.dockWood, true);

        // Support posts (going down into water)
        var postSpacing = 3;
        var numPosts = Math.floor(dockLen / postSpacing);
        for (var pi = 0; pi <= numPosts; pi++) {
            var px = dx - dockLen / 2 + pi * postSpacing;
            // Port side posts
            var postGeo = new THREE.CylinderGeometry(0.25, 0.3, 6, 6);
            td(place, 'dock', { part: 'post' }, px, dockY - 3, dz - dockW / 2 + 0.3, postGeo, mats.dockPost);
            td(place, 'dock', { part: 'post' }, px, dockY - 3, dz + dockW / 2 - 0.3, postGeo, mats.dockPost);
        }

        // Cross braces under dock
        for (var bi = 0; bi < numPosts; bi++) {
            var bx = dx - dockLen / 2 + bi * postSpacing + postSpacing / 2;
            tb(place, 'dock', { part: 'brace' }, bx, dockY - 0.5, dz, postSpacing - 0.5, 0.2, 0.2, mats.dockPost, false);
        }

        // Mooring posts (bollards) at dock edge near ship
        var bollardGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.0, 6);
        td(place, 'dock', { part: 'bollard' }, dx + dockLen / 2 - 1, dockY + 0.5, dz - dockW / 2 + 0.5, bollardGeo, mats.dockPost);
        td(place, 'dock', { part: 'bollard' }, dx + dockLen / 2 - 1, dockY + 0.5, dz + dockW / 2 - 0.5, bollardGeo, mats.dockPost);
        td(place, 'dock', { part: 'bollard' }, dx - dockLen / 2 + 1, dockY + 0.5, dz - dockW / 2 + 0.5, bollardGeo, mats.dockPost);

        return { dockY: dockY, dockLen: dockLen, dockW: dockW };
    }

    /* ── Palm Tree ── */
    function buildPalmTree(tx, tz, place, mats, scale) {
        var s = scale || 1;
        var trunkH = 6 * s;

        // Trunk — slight lean via segments
        var trunkGeo = new THREE.CylinderGeometry(0.2 * s, 0.35 * s, trunkH, 6);
        td(place, 'palm', { part: 'trunk' }, tx, trunkH / 2, tz, trunkGeo, mats.palmTrunk);

        // Fronds (flat boxes fanning out)
        var topY = trunkH + 0.2;
        var frondCount = 6;
        for (var fi = 0; fi < frondCount; fi++) {
            var angle = (fi / frondCount) * Math.PI * 2;
            var frondLen = 3 * s;
            var fx = tx + Math.cos(angle) * frondLen * 0.5;
            var fz = tz + Math.sin(angle) * frondLen * 0.5;
            tb(place, 'palm', { part: 'frond' },
                fx, topY - 0.3, fz,
                0.6 * s, 0.08, frondLen,
                fi % 2 === 0 ? mats.palmLeaf : mats.palmLeafDark, false);
        }
        // Coconut cluster
        var cocoGeo = new THREE.SphereGeometry(0.2 * s, 6, 6);
        td(place, 'palm', { part: 'coconut' }, tx + 0.3, topY - 0.5, tz, cocoGeo, mats.barrel);
        td(place, 'palm', { part: 'coconut' }, tx - 0.2, topY - 0.6, tz + 0.2, cocoGeo, mats.barrel);
    }

    /* ── Rock cluster (small shore rocks) ── */
    function buildRocks(rx, rz, place, mats, scale) {
        var s = scale || 1;
        tb(place, 'rock', null, rx, 0.4 * s, rz, 1.5 * s, 0.8 * s, 1.2 * s, mats.rock, true);
        tb(place, 'rock', null, rx + 0.8 * s, 0.3 * s, rz + 0.5 * s, 1.0 * s, 0.6 * s, 0.8 * s, mats.rockDark, true);
        tb(place, 'rock', null, rx - 0.4 * s, 0.2 * s, rz - 0.6 * s, 0.7 * s, 0.4 * s, 0.9 * s, mats.rock, true);
    }

    /* ── Sea Rock (large asymmetric formation rising from water) ── */
    function buildSeaRock(rx, rz, place, mats) {
        // Big jagged rock formation — intentionally asymmetric, no two chunks alike
        // Main spire — tallest point, off-center
        tb(place, 'sea-rock', { part: 'spire' },     rx + 0.5, 4.0, rz - 0.8,   2.0, 8.0, 2.5, mats.rock, true);
        // Leaning slab against the spire (wider, shorter, offset)
        tb(place, 'sea-rock', { part: 'slab' },       rx - 1.8, 2.2, rz + 0.5,   3.0, 4.4, 2.0, mats.rockDark, true);
        // Squat boulder at base, sprawling out
        tb(place, 'sea-rock', { part: 'base-wide' },  rx - 0.3, 0.8, rz + 0.2,   5.5, 1.6, 5.0, mats.rock, true);
        // Stepped shelf — lower, jutting south
        tb(place, 'sea-rock', { part: 'shelf' },      rx + 1.5, 1.5, rz + 2.5,   2.5, 3.0, 2.0, mats.rockDark, true);
        // Narrow fin sticking up at an angle on the east side
        tb(place, 'sea-rock', { part: 'fin' },        rx + 3.0, 2.8, rz - 0.3,   1.0, 5.6, 1.5, mats.rock, true);
        // Small chunk broken off to the north
        tb(place, 'sea-rock', { part: 'chunk-n' },    rx - 0.5, 0.5, rz - 3.0,   1.8, 1.0, 1.4, mats.rockDark, true);
        // Tiny spur to the west
        tb(place, 'sea-rock', { part: 'spur-w' },     rx - 3.5, 0.9, rz - 0.5,   1.5, 1.8, 1.2, mats.rock, true);
        // Cap stone on top of main spire — wider than spire, overhang
        tb(place, 'sea-rock', { part: 'cap' },        rx + 0.3, 8.2, rz - 1.0,   2.8, 0.8, 3.0, mats.rockDark, true);
        // Wedge chunk mid-height, bridging spire and fin
        tb(place, 'sea-rock', { part: 'bridge' },     rx + 1.8, 4.5, rz - 0.5,   1.5, 1.2, 2.0, mats.rock, true);
        // Waterline barnacle ring — slightly wider than base, just above water
        tb(place, 'sea-rock', { part: 'barnacles' },  rx - 0.3, 0.1, rz + 0.2,   6.0, 0.3, 5.5, mats.rockDark, true);
    }

    /* ── Medium Sea Rock (beach-side formation) ── */
    function buildSeaRockMedium(rx, rz, place, mats) {
        // Chunky main mass
        tb(place, 'sea-rock-md', { part: 'main' },     rx, 2.8, rz,              2.5, 5.6, 3.0, mats.rock, true);
        // Shorter slab leaning against it from the south
        tb(place, 'sea-rock-md', { part: 'slab-s' },    rx - 1.0, 1.5, rz + 2.2, 2.8, 3.0, 1.8, mats.rockDark, true);
        // Tall narrow piece on the north side
        tb(place, 'sea-rock-md', { part: 'pillar' },    rx + 1.5, 3.2, rz - 1.5, 1.4, 6.4, 1.6, mats.rock, true);
        // Low sprawling base
        tb(place, 'sea-rock-md', { part: 'base' },      rx - 0.5, 0.5, rz + 0.3, 5.0, 1.0, 5.5, mats.rockDark, true);
        // Chunk broken off to the west
        tb(place, 'sea-rock-md', { part: 'chunk-w' },   rx - 3.2, 0.6, rz - 0.8, 1.5, 1.2, 1.8, mats.rock, true);
        // Small boulder to the east
        tb(place, 'sea-rock-md', { part: 'boulder-e' }, rx + 3.0, 0.5, rz + 1.0, 1.2, 1.0, 1.4, mats.rockDark, true);
        // Overhang cap — wider than pillar
        tb(place, 'sea-rock-md', { part: 'cap' },       rx + 1.3, 6.5, rz - 1.8, 2.2, 0.7, 2.4, mats.rockDark, true);
        // Wedge bridging main and pillar
        tb(place, 'sea-rock-md', { part: 'bridge' },    rx + 0.8, 4.0, rz - 0.6, 1.5, 1.0, 1.8, mats.rock, true);
    }

    /* ── Small Sea Rock (shorter asymmetric outcrop) ── */
    function buildSeaRockSmall(rx, rz, place, mats) {
        // Stubby main chunk
        tb(place, 'sea-rock-sm', { part: 'main' },    rx, 1.8, rz,             1.8, 3.6, 2.2, mats.rock, true);
        // Leaning piece to the side
        tb(place, 'sea-rock-sm', { part: 'lean' },     rx + 1.6, 1.0, rz - 0.7, 1.2, 2.0, 1.5, mats.rockDark, true);
        // Flat shelf at waterline
        tb(place, 'sea-rock-sm', { part: 'shelf' },    rx - 0.8, 0.4, rz + 1.0, 3.0, 0.8, 1.8, mats.rock, true);
        // Spur poking out
        tb(place, 'sea-rock-sm', { part: 'spur' },     rx - 2.0, 0.6, rz - 0.3, 1.0, 1.2, 0.8, mats.rockDark, true);
        // Pebble chunk
        tb(place, 'sea-rock-sm', { part: 'pebble' },   rx + 0.5, 0.3, rz + 2.0, 0.9, 0.6, 0.7, mats.rock, true);
        // Barnacle band
        tb(place, 'sea-rock-sm', { part: 'barnacles' },rx - 0.2, 0.08, rz + 0.2, 3.5, 0.2, 3.0, mats.rockDark, true);
    }

    function buildSeaRockSmallQuarterTurn(rx, rz, place, mats) {
        tb(place, 'sea-rock-sm', { part: 'main', variant: 'quarter-turn' },    rx, 1.8, rz,             2.2, 3.6, 1.8, mats.rock, true);
        tb(place, 'sea-rock-sm', { part: 'lean', variant: 'quarter-turn' },    rx + 0.7, 1.0, rz + 1.6, 1.5, 2.0, 1.2, mats.rockDark, true);
        tb(place, 'sea-rock-sm', { part: 'shelf', variant: 'quarter-turn' },   rx - 1.0, 0.4, rz - 0.8, 1.8, 0.8, 3.0, mats.rock, true);
        tb(place, 'sea-rock-sm', { part: 'spur', variant: 'quarter-turn' },    rx + 0.3, 0.6, rz - 2.0, 0.8, 1.2, 1.0, mats.rockDark, true);
        tb(place, 'sea-rock-sm', { part: 'pebble', variant: 'quarter-turn' },  rx - 2.0, 0.3, rz + 0.5, 0.7, 0.6, 0.9, mats.rock, true);
        tb(place, 'sea-rock-sm', { part: 'barnacles', variant: 'quarter-turn' }, rx - 0.2, 0.08, rz + 0.2, 3.0, 0.2, 3.5, mats.rockDark, true);
    }

    /* ── Cove Rock (large L-shaped formation wrapping around a corner) ── */
    function buildCoveRock(rx, rz, place, mats) {
        // Rotated 90° CW: old(dx,dz,w,d) → new(dz,-dx,d,w)
        // L wraps from south edge curving east, keeping it inside the biome

        // ── South wall (was east wall, now runs along X) ──
        tb(place, 'cove-rock', { part: 'e-wall-1' },   rx + 2, 3.5, rz - 2,      4.0, 7.0, 3.0, mats.rock, true);
        tb(place, 'cove-rock', { part: 'e-wall-2' },   rx + 6, 2.5, rz - 1,      3.0, 5.0, 3.5, mats.rockDark, true);
        tb(place, 'cove-rock', { part: 'e-wall-3' },   rx + 10, 1.8, rz - 2.5,   3.5, 3.6, 2.5, mats.rock, true);
        // Tall spire
        tb(place, 'cove-rock', { part: 'e-spire' },    rx + 3.5, 5.5, rz - 3,    2.0, 11.0, 1.8, mats.rockDark, true);

        // ── West wall (was north wall, now runs along Z) ──
        tb(place, 'cove-rock', { part: 'n-wall-1' },   rx, 3.0, rz + 2,          3.0, 6.0, 4.5, mats.rockDark, true);
        tb(place, 'cove-rock', { part: 'n-wall-2' },   rx - 0.5, 2.2, rz + 6,    2.5, 4.4, 3.5, mats.rock, true);
        tb(place, 'cove-rock', { part: 'n-wall-3' },   rx + 0.5, 1.5, rz + 10,   2.8, 3.0, 3.0, mats.rockDark, true);
        // Tapers off northward
        tb(place, 'cove-rock', { part: 'n-taper' },    rx + 0.2, 0.8, rz + 13,   2.0, 1.6, 2.5, mats.rock, true);

        // ── Corner mass (where walls meet) ──
        tb(place, 'cove-rock', { part: 'corner' },     rx + 0.5, 4.0, rz - 0.5,  4.0, 8.0, 4.0, mats.rock, true);
        tb(place, 'cove-rock', { part: 'corner-cap' }, rx + 0.8, 8.2, rz - 0.2,  4.5, 1.0, 5.0, mats.rockDark, true);

        // ── Overhang shelf ──
        tb(place, 'cove-rock', { part: 'overhang-e' }, rx + 5, 5.5, rz + 0.5,    3.0, 1.0, 2.5, mats.rockDark, true);
        tb(place, 'cove-rock', { part: 'overhang-n' }, rx + 1.5, 4.5, rz + 5,    2.0, 0.8, 3.0, mats.rock, true);

        // ── Rubble at base ──
        tb(place, 'cove-rock', { part: 'rubble-1' },   rx + 7, 0.4, rz + 1,      1.5, 0.8, 2.0, mats.rock, true);
        tb(place, 'cove-rock', { part: 'rubble-2' },   rx + 2.5, 0.5, rz + 4,    1.2, 1.0, 1.5, mats.rockDark, true);
        tb(place, 'cove-rock', { part: 'rubble-3' },   rx + 2, 0.3, rz + 8,      1.3, 0.6, 1.0, mats.rock, true);

        // ── Outer face detail ──
        tb(place, 'cove-rock', { part: 'outer-fin' },  rx + 1, 2.0, rz - 4.5,    2.5, 4.0, 1.0, mats.rock, true);
        tb(place, 'cove-rock', { part: 'outer-spur' }, rx - 2.5, 0.6, rz + 3,    1.5, 1.2, 2.0, mats.rockDark, true);
        tb(place, 'cove-rock', { part: 'outer-chunk' },rx + 12, 0.5, rz - 3.5,   1.5, 1.0, 2.0, mats.rock, true);

        // ── Barnacle ring at waterline ──
        tb(place, 'cove-rock', { part: 'barnacles-e' },rx + 5, 0.08, rz - 1.5,   12.0, 0.2, 4.0, mats.rockDark, true);
        tb(place, 'cove-rock', { part: 'barnacles-n' },rx - 0.2, 0.08, rz + 5,   3.5, 0.2, 14.0, mats.rockDark, true);
    }

    /* ── Pirate Flag ── */
    function buildFlag(fx, fy, fz, place, mats) {
        // Pole
        var poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
        td(place, 'flag', { part: 'pole' }, fx, fy + 1.5, fz, poleGeo, mats.iron);
        // Flag cloth
        tb(place, 'flag', { part: 'cloth' }, fx + 0.8, fy + 2.5, fz, 1.5, 1.0, 0.05, mats.flagRed, false);
        // Skull emblem (small white box on flag)
        tb(place, 'flag', { part: 'skull' }, fx + 0.8, fy + 2.5, fz + 0.04, 0.5, 0.5, 0.06, mats.sail, false);
    }

    /* ── Gangplank (ramp from dock to ship) ── */
    function buildGangplank(gx, gy, gz, place, mats) {
        // Angled plank connecting dock to ship deck
        var rampMesh = place.addRamp(gx, gy + 0.3, gz, 2, 0.15, 5, mats.dockWood, 0, -0.12, true);
        if (rampMesh) {
            rampMesh.userData = { role: 'gangplank' };
        }
        // Side rails
        tb(place, 'gangplank', { part: 'rail' }, gx - 0.9, gy + 0.7, gz, 0.1, 0.6, 5, mats.dockPost, false);
        tb(place, 'gangplank', { part: 'rail' }, gx + 0.9, gy + 0.7, gz, 0.1, 0.6, 5, mats.dockPost, false);
    }

    /* ── Kraken ── */
    function buildKraken(kx, kz, place, mats) {
        // kx, kz = center of kraken head at water level
        var headR = 3.0;
        // Sink the whole assembly so angled cone bases dip below water
        var sinkY = -1.5;
        // Head dome — center raised so bottom ~5% is submerged below water (y≈0)
        var headY = headR - 0.3 + sinkY;
        var headGeo = new THREE.SphereGeometry(headR, CYLINDER_SEGMENTS, CYLINDER_SEGMENTS);
        td(place, 'kraken', { part: 'head' }, kx, headY, kz, headGeo, mats.krakenBody);

        // Eyes — black X marks painted on the +X face (facing the ship)
        // Paper-thin boxes flush against the sphere surface to look like paint
        var eyeGap = 1.1;
        var eyeY = headY + 0.6;
        var eyeX = kx + headR - 0.05; // right at surface
        var xLen = 0.8;
        var xW = 0.18;
        var xD = 0.01; // paper thin
        // Left eye X (upper-left on face = +Z side)
        tb(place, 'kraken', { part: 'eyeX-L-1' }, eyeX, eyeY, kz - eyeGap, xD, xLen, xW, mats.krakenEye, false);
        tb(place, 'kraken', { part: 'eyeX-L-2' }, eyeX, eyeY, kz - eyeGap, xD, xW, xLen, mats.krakenEye, false);
        // Right eye X (+Z side)
        tb(place, 'kraken', { part: 'eyeX-R-1' }, eyeX, eyeY, kz + eyeGap, xD, xLen, xW, mats.krakenEye, false);
        tb(place, 'kraken', { part: 'eyeX-R-2' }, eyeX, eyeY, kz + eyeGap, xD, xW, xLen, mats.krakenEye, false);

        // ── Tentacles ──
        // 8 single tapered cones emerging from water, radiating outward from head
        // 3 large, 3 medium, 2 small — all bases at water level
        // Each defined by: distance from head center, angle around head, tilt outward, size
        var PI2 = Math.PI * 2;
        var tentacles = [
            // Large (3) — ramp tentacle reaching toward boat, one slightly tilted, one full tilt
            { dist: 8.0, angle: 0,                tilt: 0.55, topR: 0.25, botR: 0.9, height: 7.2, mat: 'krakenBody' },  // ramp toward boat
            { dist: 5.0, angle: PI2 * 3/8,       tilt: 0.20, topR: 0.15, botR: 0.7, height: 5.5, mat: 'krakenBody' },  // mostly upright
            { dist: 5.5, angle: PI2 * 5/8,       tilt: 0.60, topR: 0.15, botR: 0.7, height: 5.0, mat: 'krakenBody' },  // full outward
            // Medium (3) — two more upright, one outward
            { dist: 4.5, angle: PI2 * 1/8 + 0.2, tilt: 0.15, topR: 0.10, botR: 0.5, height: 4.2, mat: 'krakenDark' },  // mostly upright
            { dist: 5.0, angle: PI2 * 4/8 + 0.1, tilt: 0.55, topR: 0.10, botR: 0.5, height: 3.5, mat: 'krakenDark' },  // outward
            { dist: 4.5, angle: PI2 * 7/8 - 0.1, tilt: 0.18, topR: 0.10, botR: 0.5, height: 4.0, mat: 'krakenDark' },  // mostly upright
            // Small (2)
            { dist: 3.8, angle: PI2 * 2/8 + 0.1, tilt: 0.65, topR: 0.06, botR: 0.3, height: 2.5, mat: 'krakenBody' },
            { dist: 4.5, angle: PI2 * 6/8 - 0.2, tilt: 0.60, topR: 0.06, botR: 0.3, height: 2.8, mat: 'krakenBody' }
        ];

        for (var ti = 0; ti < tentacles.length; ti++) {
            var t = tentacles[ti];
            // Position on a circle around the head at water level
            var tx = kx + Math.cos(t.angle) * t.dist;
            var tz = kz + Math.sin(t.angle) * t.dist;

            var coneGeo = new THREE.CylinderGeometry(t.topR, t.botR, t.height, CYLINDER_SEGMENTS);
            // Tilt outward from head: decompose radial tilt into rotX and rotZ
            var rX = t.tilt * Math.sin(t.angle);
            var rZ = -t.tilt * Math.cos(t.angle);
            td(place, 'kraken', { part: 'tentacle-' + ti },
                tx, t.height / 2 - 0.3 + sinkY, tz, coneGeo, mats[t.mat], 0, rX, rZ);
        }
    }

    /* ══════════════════════════════════════════════════════ */
    /* ── MAIN BUILDER                                     ── */
    /* ══════════════════════════════════════════════════════ */

    function buildPirateCoveQuadrant(bounds, place, ctx) {
        var mats = ensureMats();

        var ox = (bounds.minX + bounds.maxX) / 2;
        var oz = (bounds.minZ + bounds.maxZ) / 2;
        var qw = bounds.maxX - bounds.minX;
        var qd = bounds.maxZ - bounds.minZ;

        /* ── 1. Water ── */
        // Water fills the whole biome footprint so it reaches the outer edge.
        buildWater(ox, oz, qw, qd, place, mats);

        /* ── 2. Sandy shore (east side, +X — faces toward desert) ── */
        tb(place, 'shore', { part: 'sand' }, ox + 18, 0.02, oz, 18, 0.08, qd, mats.sand, false);

        /* ── 3. Ship — positioned in the water, west-center ── */
        var shipX = ox - 8;
        var shipZ = oz;
        var hull = buildHull(shipX, shipZ, place, mats);
        var deck = buildDeck(shipX, shipZ, hull, place, mats);
        var cabin = buildCabin(shipX, shipZ, hull, deck, place, mats);

        /* ── 4. Masts ── */
        var deckY = hull.hullH;
        // Foremast (near bow)
        buildMast(shipX, shipZ - 5, deckY, 14, 2, place, mats);
        // Mainmast (center, tallest)
        buildMast(shipX, shipZ + 1, deckY, 17, 3, place, mats);
        // Mizzenmast (near stern, shorter)
        buildMast(shipX, shipZ + 7, deck.pdY, 10, 2, place, mats);

        /* ── 5. Pirate flag on mainmast ── */
        buildFlag(shipX, deckY + 17, shipZ + 1, place, mats);

        /* ── 6. Cannons — 3 per side ── */
        for (var ci = 0; ci < 3; ci++) {
            var cz = shipZ - 4 + ci * 4;
            buildCannon(shipX - hull.hullW / 2 + 0.3, deckY, cz, Math.PI / 2, place, mats);
            buildCannon(shipX + hull.hullW / 2 - 0.3, deckY, cz, -Math.PI / 2, place, mats);
        }

        /* ── 7. Deck props — barrels and crates ── */
        buildBarrel(shipX - 2, deckY, shipZ - 3, place, mats, 0.8);
        buildBarrel(shipX - 2.5, deckY, shipZ - 2.3, place, mats, 0.7);
        buildBarrel(shipX + 2, deckY, shipZ + 3, place, mats, 0.9);
        buildCrate(shipX + 2.5, deckY, shipZ - 1, place, mats, 1.2, 1.0, 1.2);
        buildCrate(shipX + 1.5, deckY, shipZ - 1.5, place, mats, 0.8, 0.8, 0.8);

        /* ── 8. Ship lanterns ── */
        buildLantern(shipX - hull.hullW / 2 + 0.5, deckY, shipZ - 6, place, mats);
        buildLantern(shipX + hull.hullW / 2 - 0.5, deckY, shipZ - 6, place, mats);
        buildLantern(shipX, deck.pdY, shipZ + hull.hullL / 2, place, mats);

        /* ── 9. Dock — extends from shore (east) to ship's port side ── */
        var dockZ = shipZ - 2;
        var dockEndX = shipX + hull.hullW / 2 + 0.5;
        var dockStartX = ox + 16;
        var dockLen = dockStartX - dockEndX;
        var dockCenterX = (dockStartX + dockEndX) / 2;
        var dockInfo = buildDock(dockCenterX, dockZ, dockLen, 4, place, mats);

        /* ── 10. Gangplank — connects dock to ship ── */
        buildGangplank(dockEndX - 1.5, deckY - 0.5, dockZ, place, mats);

        /* ── 11. Dock props ── */
        buildBarrel(dockStartX - 2, dockInfo.dockY, dockZ - 1, place, mats, 1.0);
        buildBarrel(dockStartX - 2.8, dockInfo.dockY, dockZ - 0.5, place, mats, 0.8);
        buildBarrel(dockStartX - 2, dockInfo.dockY, dockZ + 1, place, mats, 0.9);
        buildCrate(dockStartX - 5, dockInfo.dockY, dockZ + 1, place, mats, 1.5, 1.0, 1.5);
        buildCrate(dockStartX - 5.5, dockInfo.dockY + 1.0, dockZ + 1.2, place, mats, 0.9, 0.7, 0.9);
        buildLantern(dockStartX - 1, dockInfo.dockY, dockZ - 1.5, place, mats);
        buildLantern(dockEndX + 2, dockInfo.dockY, dockZ + 1.5, place, mats);

        /* ── 12. Shore details (east side, +X — toward desert) ── */
        // Palm trees
        buildPalmTree(ox + 20, oz - 8, place, mats, 1.0);
        buildPalmTree(ox + 18, oz + 6, place, mats, 0.9);
        buildPalmTree(ox + 22, oz + 2, place, mats, 1.1);
        buildPalmTree(ox + 15, oz - 15, place, mats, 0.8);
        buildPalmTree(ox + 21, oz + 14, place, mats, 1.0);

        // Rock clusters
        buildRocks(ox + 14, oz - 12, place, mats, 1.2);
        buildRocks(ox + 20, oz + 10, place, mats, 1.0);
        buildRocks(ox + 10, oz + 18, place, mats, 0.8);
        buildSeaRockSmallQuarterTurn(ox - 15, oz - 2, place, mats);

        // Shore barrels and crates (pirate stash)
        buildBarrel(ox + 17, 0, oz - 5, place, mats, 1.0);
        buildBarrel(ox + 16.5, 0, oz - 4.2, place, mats, 0.9);
        buildCrate(ox + 15, 0, oz - 6, place, mats, 1.5, 1.2, 1.5);
        buildCrate(ox + 14, 0, oz - 5, place, mats, 1.0, 1.0, 1.0);

        /* ── 13. Sea rocks (west/water side, -X) ── */
        // Original formation — SW corner
        buildSeaRock(ox - 22, oz + 20, place, mats);
        // Smaller outcrop — same side, closer to beach
        buildSeaRockSmall(ox - 10, oz + 16, place, mats);
        // Large cove formation — NW corner, wraps around bow's starboard side
        buildCoveRock(ox - 24, oz - 22, place, mats);
        // Medium formation on the beach side, east edge
        buildSeaRockMedium(ox + 4, oz + 23, place, mats);

        /* ── 15. Kraken — lurking off the port (left/-X) side of the ship ── */
        buildKraken(shipX - 13, shipZ + 5, place, mats);

        /* ── 14. Anchor ── */
        // Visual anchor on the bow
        tb(place, 'anchor', { part: 'shank' }, shipX + 1.5, hull.hullH / 2 - 1, hull.bowZ - 4, 0.15, 2.5, 0.15, mats.iron, false);
        tb(place, 'anchor', { part: 'stock' }, shipX + 1.5, hull.hullH / 2 - 2, hull.bowZ - 4, 1.5, 0.15, 0.15, mats.iron, false);

        /* ── 14. Wheel on poop deck ── */
        var wheelGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.12, CYLINDER_SEGMENTS);
        td(place, 'wheel', null, shipX, deck.pdY + 1.0, deck.pdZ - 1.5, wheelGeo, mats.mastWood, 0, Math.PI / 2, 0);
        // Wheel stand
        tb(place, 'wheel', { part: 'stand' }, shipX, deck.pdY + 0.5, deck.pdZ - 1.5, 0.3, 1.0, 0.3, mats.mastWood, false);

        return {
            structures: 4,
            towers: 0,
            steamColumns: 0,
            towerPeakHeight: 0,
            reactorBuildings: 0,
            ductLength: 0,
            masts: 3,
            cannons: 6,
            palmTrees: 5,
            shipLength: hull.hullL
        };
    }

    /* Register biome */
    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns['pirate-cove'] = buildPirateCoveQuadrant;
})();
