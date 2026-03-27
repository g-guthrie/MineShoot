import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-volcano.js — Mount Mordor Volcanic Biome
 *
 * A massive volcanic mountain with lava channels, lava pools,
 * boulders sitting in lava, jagged rock formations, and a dark
 * menacing atmosphere. The volcano dominates the center with
 * lava rivers flowing outward into pools.
 *
 * Uses addDecor() for cylinder/sphere primitives, addBlock() for boxes.
 * All box positions are center-based.
 */
(function () {
    'use strict';

    var MATS = null;
    var CYLINDER_SEGMENTS = 12;
    var THREE = globalThis.THREE;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            // Ground
            basalt:        lib.getLambert({ color: 0x2a2a2a }),
            basaltLight:   lib.getLambert({ color: 0x3a3a3a }),
            obsidian:      lib.getLambert({ color: 0x1a1a1e }),
            ash:           lib.getLambert({ color: 0x555555 }),
            ashDark:       lib.getLambert({ color: 0x3a3a3a }),
            // Volcano rock
            volcanicRock:  lib.getLambert({ color: 0x3d2e2e }),
            volcanicDark:  lib.getLambert({ color: 0x2a1e1e }),
            volcanicLight: lib.getLambert({ color: 0x5a4a3a }),
            craterRim:     lib.getLambert({ color: 0x4a3020 }),
            // Lava
            lava:          lib.getLambert({ color: 0xff4500, emissive: 0xff2200, emissiveIntensity: 0.8 }),
            lavaDeep:      lib.getLambert({ color: 0xcc2200, emissive: 0xaa1100, emissiveIntensity: 0.6 }),
            lavaCrust:     lib.getLambert({ color: 0x4a1a0a }),
            lavaGlow:      lib.getLambert({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 1.0 }),
            // Details
            smoke:         lib.getLambert({ color: 0x333333, transparent: true, opacity: 0.35 }),
            smokeLight:    lib.getLambert({ color: 0x555555, transparent: true, opacity: 0.25 }),
            charred:       lib.getLambert({ color: 0x2a1a0a }),
            ember:         lib.getLambert({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 0.9 }),
            bone:          lib.getLambert({ color: 0x8a8070 }),
            ironDark:      lib.getLambert({ color: 0x3a3a40 })
        };
        return MATS;
    }

    /* ── shorthand helpers ── */
    function tb(place, role, meta, x, y, z, w, h, d, material, isSolid) {
        var mesh = place.addBlock(x, y, z, w, h, d, material, isSolid);
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

    /* ── Ground details (world ground plane provides the base at Y=0) ── */
    function buildGround(ox, oz, place, mats) {
        // Ash-covered patches for texture variation (sitting on top of world ground)
        tb(place, 'ground', { part: 'ash-1' }, ox + 12, 0.05, oz - 10, 14, 0.06, 10, mats.ashDark, false);
        tb(place, 'ground', { part: 'ash-2' }, ox - 15, 0.05, oz + 14, 10, 0.06, 8, mats.ash, false);
        tb(place, 'ground', { part: 'ash-3' }, ox + 8, 0.05, oz + 18, 8, 0.06, 6, mats.ashDark, false);

        // Raised rocky terrain patches (uneven ground)
        tb(place, 'ground', { part: 'ridge-1' }, ox - 18, 0.25, oz - 8, 6, 0.5, 10, mats.basaltLight, true);
        tb(place, 'ground', { part: 'ridge-2' }, ox + 16, 0.35, oz + 8, 8, 0.7, 5, mats.basaltLight, true);
        tb(place, 'ground', { part: 'ridge-3' }, ox - 10, 0.2, oz + 20, 12, 0.4, 4, mats.basaltLight, true);
    }

    /* ── The Volcano (Mount Mordor) ── */
    function buildVolcano(ox, oz, place, mats) {
        // Volcano sits slightly off-center for asymmetry
        var vx = ox - 2;
        var vz = oz - 3;

        // ── Tier 1: Base (widest) ──
        tb(place, 'volcano', { tier: 1 }, vx, 1.5, vz, 26, 3, 24, mats.volcanicDark, true);
        // Asymmetric extensions
        tb(place, 'volcano', { tier: 1, part: 'spur-n' }, vx + 3, 1.0, vz - 13, 8, 2, 4, mats.volcanicDark, true);
        tb(place, 'volcano', { tier: 1, part: 'spur-w' }, vx - 14, 1.2, vz + 2, 4, 2.4, 10, mats.volcanicDark, true);
        tb(place, 'volcano', { tier: 1, part: 'spur-se' }, vx + 10, 0.8, vz + 10, 10, 1.6, 6, mats.volcanicRock, true);

        // ── Tier 2 ──
        tb(place, 'volcano', { tier: 2 }, vx - 1, 4.5, vz + 1, 20, 3, 18, mats.volcanicRock, true);
        tb(place, 'volcano', { tier: 2, part: 'jag-e' }, vx + 11, 4.0, vz - 2, 4, 2.5, 6, mats.volcanicRock, true);
        tb(place, 'volcano', { tier: 2, part: 'jag-w' }, vx - 12, 4.2, vz + 3, 3, 2.8, 5, mats.volcanicDark, true);

        // ── Tier 3 ──
        tb(place, 'volcano', { tier: 3 }, vx, 8.0, vz, 14, 4, 13, mats.volcanicRock, true);
        tb(place, 'volcano', { tier: 3, part: 'jag-n' }, vx + 2, 7.5, vz - 7, 5, 3, 3, mats.volcanicRock, true);

        // ── Tier 4 ──
        tb(place, 'volcano', { tier: 4 }, vx + 1, 12.0, vz + 1, 10, 4, 9, mats.volcanicDark, true);
        tb(place, 'volcano', { tier: 4, part: 'shoulder' }, vx - 4, 11.0, vz - 3, 4, 2.5, 4, mats.volcanicRock, true);

        // ── Tier 5: Summit ──
        tb(place, 'volcano', { tier: 5 }, vx, 15.5, vz, 7, 3, 7, mats.craterRim, true);

        // ── Crater rim (ring of blocks around the top) ──
        // North rim
        tb(place, 'volcano', { part: 'rim-n' }, vx, 17.5, vz - 3, 6, 1.5, 1.5, mats.craterRim, true);
        // South rim
        tb(place, 'volcano', { part: 'rim-s' }, vx, 17.5, vz + 3, 6, 1.5, 1.5, mats.craterRim, true);
        // West rim (taller — asymmetric)
        tb(place, 'volcano', { part: 'rim-w' }, vx - 3, 18.0, vz, 1.5, 2.5, 5, mats.craterRim, true);
        // East rim (shorter, broken)
        tb(place, 'volcano', { part: 'rim-e' }, vx + 3, 17.2, vz - 1, 1.5, 1.0, 3, mats.craterRim, true);
        tb(place, 'volcano', { part: 'rim-e2' }, vx + 3.2, 17.0, vz + 2, 1.2, 0.8, 2, mats.volcanicDark, true);

        // ── Lava pool inside crater ──
        tb(place, 'volcano', { part: 'crater-lava' }, vx, 16.5, vz, 5, 0.3, 4.5, mats.lava, false);
        // Deeper glow layer
        tb(place, 'volcano', { part: 'crater-glow' }, vx, 16.2, vz, 4, 0.2, 3.5, mats.lavaGlow, false);

        // ── Lava overflow channel (south-east side, pouring down) ──
        tb(place, 'volcano', { part: 'overflow-1' }, vx + 2.5, 15.0, vz + 3.5, 1.2, 0.2, 2, mats.lava, false);
        tb(place, 'volcano', { part: 'overflow-2' }, vx + 3, 12.5, vz + 5, 1.0, 0.2, 3, mats.lava, false);
        tb(place, 'volcano', { part: 'overflow-3' }, vx + 3.5, 9.5, vz + 7, 0.8, 0.2, 3, mats.lavaDeep, false);
        tb(place, 'volcano', { part: 'overflow-4' }, vx + 4, 6.5, vz + 9, 1.0, 0.2, 3, mats.lavaDeep, false);
        tb(place, 'volcano', { part: 'overflow-5' }, vx + 4.5, 3.5, vz + 11, 1.2, 0.2, 3, mats.lava, false);

        // Lava cascade banks (dark rock beside the flow)
        tb(place, 'volcano', { part: 'bank-l' }, vx + 1.5, 12.0, vz + 5, 0.8, 1.5, 4, mats.volcanicDark, false);
        tb(place, 'volcano', { part: 'bank-r' }, vx + 4.5, 12.0, vz + 5, 0.6, 1.2, 4, mats.volcanicDark, false);

        return { vx: vx, vz: vz };
    }

    /* ── Lava Channels (rivers flowing from base) ── */
    function buildLavaChannels(ox, oz, vx, vz, place, mats) {
        // ── Channel 1: SE flow (continues from overflow) ──
        tb(place, 'lava-channel', { id: 1 }, vx + 6, 0.25, vz + 14, 1.5, 0.15, 6, mats.lava, false);
        tb(place, 'lava-channel', { id: 1 }, vx + 8, 0.25, vz + 18, 2.0, 0.15, 5, mats.lava, false);
        tb(place, 'lava-channel', { id: 1 }, vx + 10, 0.25, vz + 22, 2.5, 0.15, 4, mats.lavaDeep, false);
        // Rock banks
        tb(place, 'lava-bank', null, vx + 4.5, 0.4, vz + 14, 0.8, 0.8, 6, mats.basaltLight, true);
        tb(place, 'lava-bank', null, vx + 7.5, 0.4, vz + 14, 0.6, 0.6, 6, mats.basaltLight, true);

        // ── Channel 2: West flow ──
        tb(place, 'lava-channel', { id: 2 }, vx - 14, 0.25, vz + 2, 5, 0.15, 1.2, mats.lava, false);
        tb(place, 'lava-channel', { id: 2 }, vx - 19, 0.25, vz + 1, 6, 0.15, 1.5, mats.lavaDeep, false);
        tb(place, 'lava-channel', { id: 2 }, vx - 24, 0.25, vz + 0, 5, 0.15, 1.8, mats.lava, false);
        // Banks
        tb(place, 'lava-bank', null, vx - 14, 0.5, vz + 3.5, 5, 1.0, 0.6, mats.basaltLight, true);
        tb(place, 'lava-bank', null, vx - 14, 0.5, vz + 0.5, 5, 0.8, 0.5, mats.basaltLight, true);

        // ── Channel 3: North-east flow ──
        tb(place, 'lava-channel', { id: 3 }, vx + 6, 0.25, vz - 14, 1.8, 0.15, 5, mats.lava, false);
        tb(place, 'lava-channel', { id: 3 }, vx + 9, 0.25, vz - 18, 2.0, 0.15, 4, mats.lavaDeep, false);
        tb(place, 'lava-channel', { id: 3 }, vx + 12, 0.25, vz - 21, 3, 0.15, 3, mats.lava, false);
    }

    /* ── Lava Pools ── */
    function buildLavaPools(ox, oz, vx, vz, place, mats) {
        // ── Pool 1: Large SE pool (channel 1 terminus) ──
        tb(place, 'lava-pool', { id: 1 }, vx + 12, 0.2, vz + 24, 6, 0.15, 5, mats.lava, false);
        tb(place, 'lava-pool', { id: 1, part: 'deep' }, vx + 12, 0.1, vz + 24, 4, 0.1, 3, mats.lavaGlow, false);
        // Rock rim around pool
        tb(place, 'pool-rim', null, vx + 8.5, 0.5, vz + 24, 1.2, 1.0, 5, mats.obsidian, true);
        tb(place, 'pool-rim', null, vx + 15.5, 0.5, vz + 24, 1.0, 0.8, 4, mats.obsidian, true);
        tb(place, 'pool-rim', null, vx + 12, 0.4, vz + 27, 5, 0.8, 1.0, mats.obsidian, true);
        // Boulder IN the lava
        tb(place, 'boulder', { part: 'in-lava-1' }, vx + 11, 0.8, vz + 23, 1.5, 1.2, 1.8, mats.volcanicRock, true);
        tb(place, 'boulder', { part: 'in-lava-2' }, vx + 14, 0.6, vz + 25, 1.0, 0.8, 1.2, mats.volcanicDark, true);

        // ── Pool 2: West pool (channel 2 terminus) ──
        tb(place, 'lava-pool', { id: 2 }, ox - 25, 0.2, vz + 0, 4, 0.15, 4, mats.lava, false);
        tb(place, 'lava-pool', { id: 2, part: 'deep' }, ox - 25, 0.1, vz + 0, 2.5, 0.1, 2.5, mats.lavaGlow, false);
        tb(place, 'pool-rim', null, ox - 25, 0.5, vz - 2.5, 4, 1.0, 0.8, mats.obsidian, true);
        tb(place, 'pool-rim', null, ox - 25, 0.4, vz + 2.5, 3, 0.7, 0.6, mats.obsidian, true);
        // Boulder in lava
        tb(place, 'boulder', { part: 'in-lava-3' }, ox - 24, 0.7, vz + 0.5, 1.2, 1.0, 1.0, mats.volcanicRock, true);

        // ── Pool 3: NE pool (channel 3 terminus) ──
        tb(place, 'lava-pool', { id: 3 }, vx + 14, 0.2, vz - 22, 5, 0.15, 4, mats.lavaDeep, false);
        tb(place, 'lava-pool', { id: 3, part: 'glow' }, vx + 14, 0.1, vz - 22, 3, 0.1, 2, mats.lavaGlow, false);
        tb(place, 'pool-rim', null, vx + 17, 0.5, vz - 22, 1.0, 1.0, 4, mats.obsidian, true);
        tb(place, 'pool-rim', null, vx + 11, 0.4, vz - 22, 1.2, 0.8, 3, mats.obsidian, true);
        tb(place, 'boulder', { part: 'in-lava-4' }, vx + 15, 0.6, vz - 21, 1.3, 0.9, 1.1, mats.volcanicDark, true);
    }

    /* ── Rock Formations & Boulders ── */
    function buildRockFormation(rx, rz, place, mats, scale) {
        var s = scale || 1.0;
        // Asymmetric cluster of blocks at various heights
        tb(place, 'rock', null, rx, 1.5 * s, rz, 3 * s, 3 * s, 2.5 * s, mats.volcanicRock, true);
        tb(place, 'rock', null, rx + 1.2 * s, 2.5 * s, rz - 0.8 * s, 2 * s, 5 * s, 1.8 * s, mats.volcanicDark, true);
        tb(place, 'rock', null, rx - 0.8 * s, 1.0 * s, rz + 1.2 * s, 2.2 * s, 2 * s, 2 * s, mats.obsidian, true);
        tb(place, 'rock', null, rx + 0.5 * s, 3.5 * s, rz + 0.3 * s, 1.5 * s, 2 * s, 1.2 * s, mats.volcanicRock, true);
        // Spire
        tb(place, 'rock', { part: 'spire' }, rx + 1.5 * s, 4.5 * s, rz - 0.5 * s, 0.8 * s, 4 * s, 0.6 * s, mats.volcanicDark, true);
    }

    function buildBoulder(bx, bz, place, mats, scale) {
        var s = scale || 1.0;
        tb(place, 'boulder', null, bx, 0.8 * s, bz, 2.0 * s, 1.6 * s, 1.8 * s, mats.volcanicRock, true);
        tb(place, 'boulder', null, bx + 0.3 * s, 1.2 * s, bz - 0.4 * s, 1.2 * s, 0.8 * s, 1.0 * s, mats.volcanicDark, true);
    }

    function buildSpire(sx, sz, place, mats, height) {
        var h = height || 6;
        tb(place, 'spire', null, sx, h / 2, sz, 1.5, h, 1.2, mats.volcanicDark, true);
        tb(place, 'spire', { part: 'cap' }, sx + 0.2, h + 0.5, sz - 0.1, 0.8, 1.5, 0.6, mats.obsidian, true);
        // Lava crust at base
        tb(place, 'spire', { part: 'crust' }, sx, 0.15, sz, 2.5, 0.15, 2.0, mats.lavaCrust, false);
    }

    /* ── Dead Trees ── */
    function buildDeadTree(tx, tz, place, mats, height) {
        var h = height || 4;
        // Charred trunk
        tb(place, 'dead-tree', { part: 'trunk' }, tx, h / 2, tz, 0.3, h, 0.3, mats.charred, false);
        // Broken branch stubs
        tb(place, 'dead-tree', { part: 'branch-1' }, tx + 0.6, h * 0.7, tz, 1.0, 0.2, 0.2, mats.charred, false);
        tb(place, 'dead-tree', { part: 'branch-2' }, tx - 0.3, h * 0.5, tz + 0.3, 0.7, 0.15, 0.15, mats.charred, false);
    }

    /* ── Smoke Column ── */
    function buildSmoke(sx, sz, baseY, place, mats) {
        // Stack of translucent blocks getting wider as they rise
        tb(place, 'smoke', null, sx, baseY + 1, sz, 1.5, 2, 1.5, mats.smoke, false);
        tb(place, 'smoke', null, sx + 0.3, baseY + 3.5, sz - 0.2, 2.5, 2.5, 2.5, mats.smoke, false);
        tb(place, 'smoke', null, sx - 0.5, baseY + 6, sz + 0.5, 3.5, 2.5, 3, mats.smokeLight, false);
        tb(place, 'smoke', null, sx + 0.2, baseY + 8.5, sz - 0.3, 4.5, 2, 4, mats.smokeLight, false);
    }

    /* ── Ember Cluster ── */
    function buildEmbers(ex, ez, place, mats) {
        tb(place, 'ember', null, ex, 0.6, ez, 0.3, 0.3, 0.3, mats.ember, false);
        tb(place, 'ember', null, ex + 0.8, 0.4, ez - 0.5, 0.2, 0.2, 0.2, mats.ember, false);
        tb(place, 'ember', null, ex - 0.4, 0.5, ez + 0.6, 0.25, 0.25, 0.25, mats.lavaGlow, false);
    }

    /* ── Ruined Archway (ancient stone) ── */
    function buildRuinedArch(ax, az, place, mats) {
        // Two pillars
        tb(place, 'ruin', { part: 'pillar-l' }, ax - 2, 2.5, az, 1.2, 5, 1.2, mats.volcanicLight, true);
        tb(place, 'ruin', { part: 'pillar-r' }, ax + 2, 3.0, az, 1.0, 6, 1.0, mats.volcanicLight, true);
        // Crumbled lintel (tilted)
        tb(place, 'ruin', { part: 'lintel' }, ax, 5.5, az, 5.5, 0.8, 1.3, mats.volcanicLight, false);
        // Fallen block
        tb(place, 'ruin', { part: 'rubble-1' }, ax - 1.5, 0.4, az + 1.5, 1.5, 0.8, 1.2, mats.volcanicLight, true);
        tb(place, 'ruin', { part: 'rubble-2' }, ax + 2.5, 0.3, az - 1, 1.0, 0.6, 0.8, mats.volcanicLight, true);
    }

    /* ── Skull Pile (volcanic trophy) ── */
    function buildSkullPile(px, pz, place, mats) {
        tb(place, 'skulls', null, px, 0.3, pz, 1.5, 0.6, 1.2, mats.bone, false);
        tb(place, 'skulls', null, px + 0.2, 0.7, pz - 0.1, 0.8, 0.4, 0.6, mats.bone, false);
        // Sword stuck in pile
        tb(place, 'skulls', { part: 'sword' }, px + 0.5, 1.2, pz, 0.1, 1.5, 0.3, mats.ironDark, false);
    }

    /* ══════════════════════════════════════════════════════ */
    /* ── MAIN BUILDER                                     ── */
    /* ══════════════════════════════════════════════════════ */

    function buildVolcanoQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var ox = (bounds.minX + bounds.maxX) / 2;
        var oz = (bounds.minZ + bounds.maxZ) / 2;

        /* ── 1. Ground ── */
        buildGround(ox, oz, place, mats);

        /* ── 2. The Volcano ── */
        var volcano = buildVolcano(ox, oz, place, mats);
        var vx = volcano.vx;
        var vz = volcano.vz;

        /* ── 3. Lava Channels ── */
        buildLavaChannels(ox, oz, vx, vz, place, mats);

        /* ── 4. Lava Pools ── */
        buildLavaPools(ox, oz, vx, vz, place, mats);

        /* ── 5. Rock Formations ── */
        // Large formation — SW corner
        buildRockFormation(ox - 20, oz + 18, place, mats, 1.3);
        // Medium formation — NE corner
        buildRockFormation(ox + 20, oz - 20, place, mats, 1.0);
        // Small formation — NW corner
        buildRockFormation(ox - 18, oz - 20, place, mats, 0.7);
        // Near volcano base — east
        buildRockFormation(ox + 15, oz + 5, place, mats, 0.8);

        /* ── 6. Scattered Boulders ── */
        buildBoulder(ox + 22, oz + 12, place, mats, 1.0);
        buildBoulder(ox - 8, oz + 22, place, mats, 1.2);
        buildBoulder(ox + 18, oz - 10, place, mats, 0.9);
        buildBoulder(ox - 22, oz - 12, place, mats, 0.8);
        buildBoulder(ox + 6, oz + 20, place, mats, 1.1);
        buildBoulder(ox - 12, oz - 18, place, mats, 0.7);

        /* ── 7. Spires (cooled lava pillars) ── */
        buildSpire(ox + 10, oz + 14, place, mats, 5);
        buildSpire(ox - 8, oz - 14, place, mats, 7);
        buildSpire(ox + 22, oz - 6, place, mats, 4);
        buildSpire(ox - 22, oz + 8, place, mats, 6);

        /* ── 8. Dead Trees ── */
        buildDeadTree(ox + 20, oz + 18, place, mats, 3.5);
        buildDeadTree(ox - 16, oz + 22, place, mats, 4);
        buildDeadTree(ox + 24, oz - 14, place, mats, 3);
        buildDeadTree(ox - 20, oz - 16, place, mats, 2.5);
        buildDeadTree(ox + 14, oz - 24, place, mats, 3.5);

        /* ── 9. Smoke from crater ── */
        buildSmoke(vx, vz, 17.5, place, mats);
        // Secondary smaller smoke from overflow
        tb(place, 'smoke', null, vx + 4, 4.0, vz + 10, 1.5, 2, 1.5, mats.smoke, false);

        /* ── 10. Ember Clusters (near lava) ── */
        buildEmbers(vx + 7, vz + 16, place, mats);
        buildEmbers(vx - 16, vz + 1, place, mats);
        buildEmbers(vx + 13, vz - 20, place, mats);
        buildEmbers(ox + 11, oz + 24, place, mats);

        /* ── 11. Ruined Archway (ancient civilization) ── */
        buildRuinedArch(ox + 20, oz - 2, place, mats);

        /* ── 12. Skull Pile ── */
        buildSkullPile(ox + 18, oz + 0.5, place, mats);

        return {
            structures: 1,
            volcanoTiers: 5,
            lavaChannels: 3,
            lavaPools: 3,
            rockFormations: 4,
            spires: 4,
            deadTrees: 5
        };
    }

    /* Register biome */
    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns['volcano'] = buildVolcanoQuadrant;
})();
