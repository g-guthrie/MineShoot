import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-volcano.js — Mount Mordor Volcanic Biome
 *
 * A massive volcanic mountain with cascading lava channels, lava pools,
 * boulders sitting in lava, glowing fissures, columnar basalt clusters,
 * and a climbable switchback path to a contestable crater-rim summit.
 * Lava materials are cloned per-group and pulse via ctx.addFlicker;
 * the crater vents an animated steam column instead of static smoke.
 *
 * Uses addDecor()/addRamp() for shards, addBlock() for boxes.
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
            // Lava (shared bases — clone before animating!)
            lava:          lib.getLambert({ color: 0xff4500, emissive: 0xff2200, emissiveIntensity: 0.8 }),
            lavaDeep:      lib.getLambert({ color: 0xcc2200, emissive: 0xaa1100, emissiveIntensity: 0.6 }),
            lavaCrust:     lib.getLambert({ color: 0x4a1a0a }),
            lavaGlow:      lib.getLambert({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 1.0 }),
            // Details
            smoke:         lib.getLambert({ color: 0x333333, transparent: true, opacity: 0.35 }),
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
    /* ── ANIMATED LAVA MATERIAL KIT                       ── */
    /* ══════════════════════════════════════════════════════ */

    /* Three flicker groups (crater / channels / pools), each a cloned
     * set of the shared lava materials so animation never touches the
     * cached library instances. */
    function makeLavaKit(mats, ctx) {
        var kit = {
            crater:  { lava: cloneMaterial(mats.lava), glow: cloneMaterial(mats.lavaGlow), deep: cloneMaterial(mats.lavaDeep) },
            channel: { lava: cloneMaterial(mats.lava), glow: cloneMaterial(mats.lavaGlow), deep: cloneMaterial(mats.lavaDeep) },
            pool:    { lava: cloneMaterial(mats.lava), glow: cloneMaterial(mats.lavaGlow), deep: cloneMaterial(mats.lavaDeep) }
        };
        if (ctx && typeof ctx.addFlicker === 'function') {
            // Crater group — fastest, hottest
            ctx.addFlicker({ material: kit.crater.lava,  freq: 1.6, phase: 0.2, baseIntensity: 0.95, amplitude: 0.35, pulseFamily: 'volcano-lava' });
            ctx.addFlicker({ material: kit.crater.glow,  freq: 1.6, phase: 0.7, baseIntensity: 1.1,  amplitude: 0.4,  pulseFamily: 'volcano-lava' });
            ctx.addFlicker({ material: kit.crater.deep,  freq: 1.6, phase: 1.2, baseIntensity: 0.75, amplitude: 0.28, pulseFamily: 'volcano-lava' });
            // Channel group — mid tempo (also drives the ground fissures)
            ctx.addFlicker({ material: kit.channel.lava, freq: 2.1, phase: 1.3, baseIntensity: 0.85, amplitude: 0.3,  pulseFamily: 'volcano-lava' });
            ctx.addFlicker({ material: kit.channel.glow, freq: 2.1, phase: 1.9, baseIntensity: 1.05, amplitude: 0.35, pulseFamily: 'volcano-lava' });
            ctx.addFlicker({ material: kit.channel.deep, freq: 2.1, phase: 2.5, baseIntensity: 0.7,  amplitude: 0.25, pulseFamily: 'volcano-lava' });
            // Pool group — slow simmer
            ctx.addFlicker({ material: kit.pool.lava,    freq: 1.15, phase: 2.4, baseIntensity: 0.8,  amplitude: 0.28, pulseFamily: 'volcano-lava' });
            ctx.addFlicker({ material: kit.pool.glow,    freq: 1.15, phase: 3.0, baseIntensity: 1.0,  amplitude: 0.32, pulseFamily: 'volcano-lava' });
            ctx.addFlicker({ material: kit.pool.deep,    freq: 1.15, phase: 3.6, baseIntensity: 0.7,  amplitude: 0.25, pulseFamily: 'volcano-lava' });
        }
        return kit;
    }

    /* ══════════════════════════════════════════════════════ */
    /* ── ASSET BUILDERS                                   ── */
    /* ══════════════════════════════════════════════════════ */

    /* ── Ground details (world ground plane provides the base at Y=0) ── */
    function buildGround(ox, oz, place, mats) {
        // Ash-covered patches for texture variation (sitting on top of world ground)
        tb(place, 'ground', { part: 'ash-1' }, ox + 12, 0.05, oz - 10, 14, 0.06, 9.6, mats.ashDark, false);
        tb(place, 'ground', { part: 'ash-2' }, ox - 15, 0.05, oz + 14, 10, 0.06, 8, mats.ash, false);
        tb(place, 'ground', { part: 'ash-3' }, ox + 7.6, 0.05, oz + 18, 8, 0.06, 6, mats.ashDark, false);

        // Raised rocky terrain patches (uneven ground)
        tb(place, 'ground', { part: 'ridge-1' }, ox - 18, 0.25, oz - 8, 6, 0.5, 10, mats.basaltLight, true);
        tb(place, 'ground', { part: 'ridge-2' }, ox + 16, 0.35, oz + 8, 8, 0.7, 5, mats.basaltLight, true);
        tb(place, 'ground', { part: 'ridge-3' }, ox - 10, 0.2, oz + 20, 12, 0.4, 4, mats.basaltLight, true);
    }

    /* ── The Volcano (Mount Mordor) ── */
    function buildVolcano(ox, oz, place, mats, kit) {
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
        tb(place, 'volcano', { tier: 2, part: 'jag-e' }, vx + 10.75, 4.0, vz - 2, 4, 2.5, 6, mats.volcanicRock, true);
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

        // ── Irregular rim teeth (jagged silhouette) ──
        tb(place, 'volcano', { part: 'tooth-nw' }, vx - 3.05, 18.7, vz - 2.95, 1.3, 2.3, 1.2, mats.volcanicDark, true);
        tb(place, 'volcano', { part: 'tooth-ne' }, vx + 3.1, 18.35, vz - 3.05, 1.2, 2.0, 1.3, mats.craterRim, true);
        tb(place, 'volcano', { part: 'tooth-sw' }, vx - 2.8, 18.2, vz + 2.6, 1.2, 1.8, 1.2, mats.volcanicDark, true);
        tb(place, 'volcano', { part: 'tooth-se' }, vx + 2.9, 17.95, vz + 3.1, 1.1, 1.5, 1.1, mats.craterRim, true);
        tb(place, 'volcano', { part: 'tooth-n' }, vx - 0.5, 18.55, vz - 3.3, 1.4, 2.1, 1.1, mats.volcanicDark, true);

        // ── Lava pool inside crater (brims slightly above the summit floor) ──
        tb(place, 'volcano', { part: 'crater-lava' }, vx, 17.07, vz, 5, 0.3, 4.5, kit.crater.lava, false);
        // Hot center, proud of the lava surface
        tb(place, 'volcano', { part: 'crater-glow' }, vx, 17.16, vz, 4, 0.2, 3.5, kit.crater.glow, false);

        // ── Lava overflow channel (south-east side, pouring down) ──
        tb(place, 'volcano', { part: 'overflow-1' }, vx + 2.5, 15.0, vz + 3.5, 1.2, 0.2, 2, kit.crater.lava, false);
        tb(place, 'volcano', { part: 'overflow-2' }, vx + 3, 12.5, vz + 5, 1.0, 0.2, 3, kit.crater.lava, false);
        tb(place, 'volcano', { part: 'overflow-3' }, vx + 3.5, 9.5, vz + 7, 0.8, 0.2, 3, kit.crater.deep, false);
        tb(place, 'volcano', { part: 'overflow-4' }, vx + 4, 6.5, vz + 9, 1.0, 0.2, 3, kit.crater.deep, false);
        tb(place, 'volcano', { part: 'overflow-5' }, vx + 4.5, 3.5, vz + 11, 1.2, 0.2, 3, kit.crater.lava, false);

        // Lava cascade banks (dark rock beside the flow)
        tb(place, 'volcano', { part: 'bank-l' }, vx + 1.5, 12.0, vz + 5, 0.8, 1.5, 4, mats.volcanicDark, false);
        tb(place, 'volcano', { part: 'bank-r' }, vx + 4.5, 12.0, vz + 5, 0.6, 1.2, 4, mats.volcanicDark, false);

        return { vx: vx, vz: vz };
    }

    /* ── Summit Switchback Path (ground -> crater rim) ──
     * Five stair legs winding around the tiers. Risers <= 0.8,
     * treads >= 1.4 in the travel direction. Each leg tops out flush
     * with the next tier ledge so the summit is a contestable vantage. */
    function buildSummitPath(vx, vz, place, mats) {
        var m = mats.basaltLight;
        var i;
        // Leg 1: south face, ground (0) -> tier 1 top (3.0), climbing east
        for (i = 0; i < 4; i++) {
            var h1 = 0.75 * (i + 1);
            tb(place, 'summit-path', { leg: 1, step: i }, vx - 9 + (i * 1.5), h1 / 2, vz + 12.9, 1.5, h1, 1.8, m, true);
        }
        // Leg 2: tier-1 south ledge, 3.0 -> tier 2 top (6.0), climbing west
        for (i = 0; i < 4; i++) {
            var h2 = 0.75 * (i + 1);
            tb(place, 'summit-path', { leg: 2, step: i }, vx - 5.5 - (i * 1.5), 3 + (h2 / 2), vz + 10.95, 1.5, h2, 1.9, m, true);
        }
        // Leg 3: tier-2 west ledge, 6.0 -> tier 3 top (10.0), climbing north
        for (i = 0; i < 4; i++) {
            var h3 = 0.8 * (i + 1);
            tb(place, 'summit-path', { leg: 3, step: i }, vx - 9, 6 + (h3 / 2), vz + 5 - (i * 1.5), 1.9, h3, 1.5, m, true);
        }
        tb(place, 'summit-path', { leg: 3, step: 4 }, vx - 8, 8.0, vz - 1, 2.0, 4, 1.5, m, true);
        // Leg 4: tier-3 north ledge, 10.0 -> tier 4 top (14.0), climbing east
        for (i = 0; i < 4; i++) {
            var h4 = 0.8 * (i + 1);
            tb(place, 'summit-path', { leg: 4, step: i }, vx - 1 + (i * 1.5), 10 + (h4 / 2), vz - 5, 1.5, h4, 1.9, m, true);
        }
        tb(place, 'summit-path', { leg: 4, step: 4 }, vx + 5, 12.0, vz - 4.5, 1.5, 4, 2.0, m, true);
        // Leg 5: tier-4 east ledge, 14.0 -> summit top (17.0), climbing south
        for (i = 0; i < 3; i++) {
            var h5 = 0.75 * (i + 1);
            tb(place, 'summit-path', { leg: 5, step: i }, vx + 4.7, 14 + (h5 / 2), vz - 2 + (i * 1.5), 1.9, h5, 1.5, m, true);
        }
        tb(place, 'summit-path', { leg: 5, step: 3 }, vx + 4.45, 15.5, vz + 2.5, 1.9, 3, 1.5, m, true);
        return 22;
    }

    /* ── Lava Channels (rivers flowing from base, cascading tops) ── */
    function buildLavaChannels(ox, oz, vx, vz, place, mats, kit) {
        // ── Channel 1: SE flow (continues from overflow) ──
        tb(place, 'lava-channel', { id: 1 }, vx + 6, 0.245, vz + 14, 1.5, 0.15, 6, kit.channel.lava, false);
        tb(place, 'lava-channel', { id: 1 }, vx + 8, 0.225, vz + 18, 2.0, 0.15, 5, kit.channel.lava, false);
        tb(place, 'lava-channel', { id: 1 }, vx + 10, 0.205, vz + 22, 2.5, 0.15, 4, kit.channel.deep, false);
        // Rock banks
        tb(place, 'lava-bank', null, vx + 4.5, 0.4, vz + 14, 0.8, 0.8, 6, mats.basaltLight, true);
        tb(place, 'lava-bank', null, vx + 7.5, 0.4, vz + 14, 0.6, 0.6, 6, mats.basaltLight, true);

        // ── Channel 2: West flow ──
        tb(place, 'lava-channel', { id: 2 }, vx - 14, 0.245, vz + 2, 5, 0.15, 1.2, kit.channel.lava, false);
        tb(place, 'lava-channel', { id: 2 }, vx - 17.5, 0.225, vz + 1, 5, 0.15, 1.5, kit.channel.deep, false);
        tb(place, 'lava-channel', { id: 2 }, vx - 21, 0.205, vz + 0.5, 4, 0.15, 1.8, kit.channel.lava, false);
        // Banks
        tb(place, 'lava-bank', null, vx - 14, 0.5, vz + 3.5, 5, 1.0, 0.6, mats.basaltLight, true);
        tb(place, 'lava-bank', null, vx - 14, 0.5, vz + 0.6, 5, 0.8, 0.5, mats.basaltLight, true);

        // ── Channel 3: North-east flow ──
        tb(place, 'lava-channel', { id: 3 }, vx + 6, 0.245, vz - 14, 1.8, 0.15, 5, kit.channel.lava, false);
        tb(place, 'lava-channel', { id: 3 }, vx + 9, 0.225, vz - 18, 2.0, 0.15, 4, kit.channel.deep, false);
        tb(place, 'lava-channel', { id: 3 }, vx + 12, 0.205, vz - 21, 3, 0.15, 3, kit.channel.lava, false);
    }

    /* ── Lava Pools (lava top 0.25, hot center proud at 0.31) ── */
    function buildLavaPools(ox, oz, vx, vz, place, mats, kit) {
        // ── Pool 1: Large SE pool (channel 1 terminus) ──
        tb(place, 'lava-pool', { id: 1 }, vx + 12, 0.175, vz + 24, 6, 0.15, 5, kit.pool.lava, false);
        tb(place, 'lava-pool', { id: 1, part: 'hot' }, vx + 12, 0.25, vz + 24, 4, 0.12, 3, kit.pool.glow, false);
        // Rock rim around pool
        tb(place, 'pool-rim', null, vx + 8.5, 0.5, vz + 24, 1.2, 1.0, 4.8, mats.obsidian, true);
        tb(place, 'pool-rim', null, vx + 15.5, 0.5, vz + 24, 1.0, 0.8, 4, mats.obsidian, true);
        tb(place, 'pool-rim', null, vx + 12, 0.4, vz + 27, 5, 0.8, 1.0, mats.obsidian, true);
        // Boulders IN the lava
        tb(place, 'boulder', { part: 'in-lava-1' }, vx + 11, 0.85, vz + 23, 1.5, 1.2, 1.8, mats.volcanicRock, true);
        tb(place, 'boulder', { part: 'in-lava-2' }, vx + 14, 0.65, vz + 25, 1.0, 0.8, 1.2, mats.volcanicDark, true);
        // Cooling crust shelf at the pool mouth (slightly below lava top)
        tb(place, 'lava-crust', { pool: 1 }, vx + 12, 0.13, vz + 21.15, 5, 0.16, 0.8, mats.lavaCrust, false);
        tb(place, 'lava-crust', { pool: 1, part: 'pad' }, vx + 9.7, 0.115, vz + 22.3, 1.1, 0.13, 1.1, mats.lavaCrust, false);

        // ── Pool 2: West pool (channel 2 terminus) ──
        tb(place, 'lava-pool', { id: 2 }, ox - 23.5, 0.175, vz + 0, 4, 0.15, 4, kit.pool.lava, false);
        tb(place, 'lava-pool', { id: 2, part: 'hot' }, ox - 23.5, 0.25, vz + 0, 2.5, 0.12, 2.5, kit.pool.glow, false);
        tb(place, 'pool-rim', null, ox - 23.5, 0.5, vz - 2.5, 4, 1.0, 0.8, mats.obsidian, true);
        tb(place, 'pool-rim', null, ox - 23.5, 0.4, vz + 2.5, 3, 0.7, 0.6, mats.obsidian, true);
        // Boulder in lava
        tb(place, 'boulder', { part: 'in-lava-3' }, ox - 24, 0.75, vz + 0.5, 1.2, 1.0, 1.0, mats.volcanicRock, true);
        // Crust at the channel inlet + a cooled pad
        tb(place, 'lava-crust', { pool: 2 }, ox - 21.6, 0.13, vz + 0, 0.7, 0.16, 3.4, mats.lavaCrust, false);
        tb(place, 'lava-crust', { pool: 2, part: 'pad' }, ox - 25.1, 0.115, vz - 1.9, 1.0, 0.13, 1.0, mats.lavaCrust, false);

        // ── Pool 3: NE pool (channel 3 terminus) ──
        tb(place, 'lava-pool', { id: 3 }, vx + 14, 0.175, vz - 22, 5, 0.15, 4, kit.pool.deep, false);
        tb(place, 'lava-pool', { id: 3, part: 'hot' }, vx + 14, 0.25, vz - 22, 3, 0.12, 2, kit.pool.glow, false);
        tb(place, 'pool-rim', null, vx + 17, 0.5, vz - 22, 1.0, 1.0, 4, mats.obsidian, true);
        tb(place, 'pool-rim', null, vx + 11, 0.4, vz - 22, 1.2, 0.8, 3, mats.obsidian, true);
        tb(place, 'boulder', { part: 'in-lava-4' }, vx + 15, 0.6, vz - 21, 1.3, 0.9, 1.1, mats.volcanicDark, true);
        // Crust shelf on the south lip
        tb(place, 'lava-crust', { pool: 3 }, vx + 14, 0.13, vz - 19.75, 3.4, 0.16, 0.7, mats.lavaCrust, false);
    }

    /* ── Glowing Fissures (cracks radiating from the volcano base) ──
     * Thin emissive strips sharing the channel flicker material so the
     * whole ground network pulses together. Staggered tops 0.04/0.06/0.08. */
    function buildFissure(place, fissureMat, segs) {
        for (var i = 0; i < segs.length; i++) {
            var s = segs[i];
            tb(place, 'fissure', { seg: i }, s[0], 0.01 + (s[4] / 2), s[1], s[2], s[4], s[3], fissureMat, false);
        }
    }

    function buildFissures(vx, vz, place, kit) {
        // East fissure (toward the ruins)
        buildFissure(place, kit.channel.glow, [
            [vx + 14.5, vz + 4.2, 2.8, 0.5, 0.03],
            [vx + 17.0, vz + 4.6, 2.4, 0.45, 0.05],
            [vx + 18.9, vz + 5.1, 1.9, 0.4, 0.07]
        ]);
        // South fissure (toward the basalt columns)
        buildFissure(place, kit.channel.glow, [
            [vx + 1.8, vz + 14.0, 0.5, 2.8, 0.03],
            [vx + 2.25, vz + 16.6, 0.45, 2.4, 0.05],
            [vx + 2.7, vz + 18.9, 0.4, 1.9, 0.07]
        ]);
        // North-west fissure
        buildFissure(place, kit.channel.glow, [
            [vx - 14.0, vz - 13.5, 0.5, 2.6, 0.03],
            [vx - 14.55, vz - 15.8, 0.45, 2.2, 0.05],
            [vx - 15.1, vz - 17.7, 0.4, 1.8, 0.07]
        ]);
        // North-east fissure (feeds toward channel 3)
        buildFissure(place, kit.channel.glow, [
            [vx + 8.2, vz - 13.4, 0.5, 2.6, 0.03],
            [vx + 8.65, vz - 15.7, 0.45, 2.2, 0.05],
            [vx + 9.1, vz - 17.6, 0.4, 1.8, 0.07]
        ]);
        return 12;
    }

    /* ── Columnar Basalt Cluster (stepped hexagon-style pack) ──
     * 2x3 pack of touching square columns, all one material so flush
     * internal faces never shimmer. Staggered tops double as hop-up cover. */
    function buildBasaltColumns(cx, cz, place, mats, heights, baseY) {
        var y0 = baseY || 0;
        var idx = 0;
        var capCount = 0;
        for (var col = 0; col < 2; col++) {
            for (var row = 0; row < 3; row++) {
                var h = heights[idx++];
                var x = cx - 0.65 + (col * 1.3);
                var z = cz - 1.3 + (row * 1.3);
                tb(place, 'basalt-column', { col: col, row: row }, x, y0 + (h / 2), z, 1.3, h, 1.3, mats.basalt, true);
                // Weathered cap on the taller columns (inset, stacked — no flush sides)
                if (h >= 2.0) {
                    tb(place, 'basalt-column', { part: 'cap' }, x, y0 + h + 0.06, z, 0.9, 0.12, 0.9, mats.basaltLight, false);
                    capCount++;
                }
            }
        }
        return 6 + capCount;
    }

    /* ── Obsidian Shards (tilted glassy splinters) ── */
    function buildObsidianShard(place, mats, x, z, h, rotY, tiltX) {
        // Sunk so the tilted base is embedded in the ground; solid like the
        // desert's tilted rocks so shards work as cover instead of ghosts.
        return place.addRamp(x, (h / 2) - 0.15, z, 0.5, h, 0.4, mats.obsidian, rotY, tiltX, true);
    }

    /* ── Volcanic Bombs (ejected boulders with an ember-lit crack) ── */
    function buildVolcanicBomb(bx, bz, place, mats, alongZ) {
        tb(place, 'volcanic-bomb', null, bx, 0.36, bz, 0.9, 0.7, 0.8, mats.volcanicDark, true);
        if (alongZ) {
            tb(place, 'volcanic-bomb', { part: 'crack' }, bx, 0.69, bz, 0.18, 0.12, 1.0, mats.ember, false);
        } else {
            tb(place, 'volcanic-bomb', { part: 'crack' }, bx, 0.69, bz, 1.0, 0.12, 0.18, mats.ember, false);
        }
    }

    /* ── Rock Formations & Boulders ── */
    function buildRockFormation(rx, rz, place, mats, scale) {
        var s = scale || 1.0;
        // Asymmetric cluster of blocks at various heights
        tb(place, 'rock', null, rx, 1.5 * s, rz, 3 * s, 3 * s, 2.5 * s, mats.volcanicRock, true);
        tb(place, 'rock', null, rx + 1.2 * s, 2.5 * s, rz - 0.8 * s, 2 * s, 5 * s, 1.8 * s, mats.volcanicDark, true);
        tb(place, 'rock', null, rx - 0.8 * s, 1.0 * s, rz + 1.2 * s, 2.2 * s, 2 * s, 2 * s, mats.obsidian, true);
        tb(place, 'rock', null, rx + 0.5 * s, 3.5 * s, rz + 0.3 * s, 1.5 * s, 2 * s, 1.2 * s, mats.volcanicRock, true);
        // Spire (bottom nudged 0.03s above the neighbor block's bottom)
        tb(place, 'rock', { part: 'spire' }, rx + 1.5 * s, 4.53 * s, rz - 0.5 * s, 0.8 * s, 4 * s, 0.6 * s, mats.volcanicDark, true);
    }

    function buildBoulder(bx, bz, place, mats, scale) {
        var s = scale || 1.0;
        tb(place, 'boulder', null, bx, 0.8 * s, bz, 2.0 * s, 1.6 * s, 1.8 * s, mats.volcanicRock, true);
        // Cap block offset so neither its top nor -Z face is flush with the base
        tb(place, 'boulder', null, bx + 0.3 * s, 1.16 * s, bz - 0.35 * s, 1.2 * s, 0.8 * s, 1.0 * s, mats.volcanicDark, true);
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

    /* ── Animated Steam Columns (crater + overflow vent) ──
     * Citadel-pattern: per-tile cloned smoke material, rising/fading
     * tiles driven by ctx.addSteamColumn. */
    function buildSteamColumn(place, mats, ctx, opts) {
        var tiles = [];
        for (var col = 0; col < opts.cols; col++) {
            for (var row = 0; row < opts.rows; row++) {
                var steamMat = cloneMaterial(mats.smoke);
                var tile = tb(place, 'steam', { col: col, row: row },
                    opts.x - (((opts.cols - 1) * opts.colSpacing) * 0.5) + (col * opts.colSpacing),
                    opts.baseY + (row * opts.rowSpacing),
                    opts.z - 0.4 + ((col % 3) * 0.27),
                    opts.tile, opts.tileH, opts.tile,
                    steamMat, false);
                if (!tile) continue;
                tiles.push({
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
                tiles: tiles,
                cycle: opts.cycle,
                rise: opts.rise,
                baseOpacity: 0.12,
                swayAmp: 0.26,
                depthAmp: 0.14,
                swayFreq: 0.5
            });
        }
        return tiles.length;
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

        /* ── 0. Animated lava material kit (3 flicker groups) ── */
        var kit = makeLavaKit(mats, ctx);

        /* ── 1. Ground ── */
        buildGround(ox, oz, place, mats);

        /* ── 2. The Volcano ── */
        var volcano = buildVolcano(ox, oz, place, mats, kit);
        var vx = volcano.vx;
        var vz = volcano.vz;

        /* ── 3. Summit switchback path (contestable vantage) ── */
        var pathSteps = buildSummitPath(vx, vz, place, mats);

        /* ── 4. Lava Channels ── */
        buildLavaChannels(ox, oz, vx, vz, place, mats, kit);

        /* ── 5. Lava Pools ── */
        buildLavaPools(ox, oz, vx, vz, place, mats, kit);

        /* ── 6. Glowing fissures radiating from the base ── */
        var fissureCount = buildFissures(vx, vz, place, kit);

        /* ── 7. Rock Formations ── */
        // Large formation — SW corner
        buildRockFormation(ox - 20, oz + 18, place, mats, 1.3);
        // Medium formation — NE corner
        buildRockFormation(ox + 20, oz - 20, place, mats, 1.0);
        // Small formation — NW corner
        buildRockFormation(ox - 18, oz - 20, place, mats, 0.7);
        // Near volcano base — east
        buildRockFormation(ox + 15, oz + 5, place, mats, 0.8);

        /* ── 8. Scattered Boulders ── */
        buildBoulder(ox + 22, oz + 12, place, mats, 1.0);
        buildBoulder(ox - 8, oz + 22, place, mats, 1.2);
        buildBoulder(ox + 18, oz - 10, place, mats, 0.9);
        buildBoulder(ox - 22, oz - 12, place, mats, 0.8);
        buildBoulder(ox + 5.8, oz + 20, place, mats, 1.1);
        buildBoulder(ox - 12, oz - 18, place, mats, 0.7);

        /* ── 9. Spires (cooled lava pillars) ── */
        buildSpire(ox + 10, oz + 14, place, mats, 5);
        buildSpire(ox - 8, oz - 14.3, place, mats, 7);
        buildSpire(ox + 22, oz - 6, place, mats, 4);
        buildSpire(ox - 22, oz + 8, place, mats, 6);

        /* ── 10. Columnar basalt clusters ── */
        var columnCount = 0;
        columnCount += buildBasaltColumns(ox - 3, oz + 15.5, place, mats, [1.6, 2.4, 1.0, 2.9, 1.9, 1.2], 0);
        columnCount += buildBasaltColumns(ox + 18, oz + 22, place, mats, [2.2, 1.4, 1.0, 1.8, 2.7, 1.5], 0);

        /* ── 11. Obsidian shards (tilted splinters) ── */
        buildObsidianShard(place, mats, ox + 13.5, oz - 13, 1.8, 0.7, 0.22);
        buildObsidianShard(place, mats, ox - 16.7, oz + 10.6, 1.6, -0.4, 0.18);
        buildObsidianShard(place, mats, ox - 8.5, oz - 20.5, 2.0, 1.2, 0.25);
        buildObsidianShard(place, mats, ox + 21.3, oz + 4.5, 1.7, 2.1, 0.2);
        buildObsidianShard(place, mats, ox - 12.3, oz + 21.8, 1.5, -1.0, 0.15);

        /* ── 12. Volcanic bombs (ember-cracked ejecta) ── */
        buildVolcanicBomb(ox + 14.5, oz + 10.5, place, mats, false);
        buildVolcanicBomb(ox - 13.5, oz + 4.8, place, mats, true);
        buildVolcanicBomb(ox - 4.5, oz - 18.8, place, mats, false);
        buildVolcanicBomb(ox + 23.2, oz + 15.5, place, mats, true);

        /* ── 13. Dead Trees ── */
        buildDeadTree(ox + 20, oz + 18, place, mats, 3.5);
        buildDeadTree(ox - 16, oz + 22, place, mats, 4);
        buildDeadTree(ox + 24, oz - 14, place, mats, 3);
        buildDeadTree(ox - 20, oz - 16, place, mats, 2.5);
        buildDeadTree(ox + 14, oz - 24, place, mats, 3.5);

        /* ── 14. Steam columns (animated, replaces static smoke) ── */
        var steamTiles = 0;
        // Main crater vent
        steamTiles += buildSteamColumn(place, mats, ctx, {
            x: vx, z: vz, baseY: 18.1,
            cols: 4, rows: 6, colSpacing: 0.85, rowSpacing: 0.78,
            tile: 1.1, tileH: 0.7, cycle: 3.4, rise: 5.2
        });
        // Small vent where the overflow meets the ground
        steamTiles += buildSteamColumn(place, mats, ctx, {
            x: vx + 4.5, z: vz + 11.5, baseY: 4.3,
            cols: 2, rows: 3, colSpacing: 0.7, rowSpacing: 0.66,
            tile: 0.8, tileH: 0.6, cycle: 2.8, rise: 3.4
        });

        /* ── 15. Ember Clusters (near lava) ── */
        buildEmbers(vx + 7, vz + 16, place, mats);
        buildEmbers(vx - 16, vz + 1, place, mats);
        buildEmbers(vx + 13, vz - 20, place, mats);
        buildEmbers(ox + 10, oz + 25.5, place, mats);

        /* ── 16. Ruined Archway (ancient civilization) ── */
        buildRuinedArch(ox + 20, oz - 2, place, mats);

        /* ── 17. Skull Pile ── */
        buildSkullPile(ox + 18, oz + 0.5, place, mats);

        /* ── 18. Spawn exclusions over open lava (non-solid hazards) ── */
        var exclusions = 0;
        if (ctx && typeof ctx.addExclusion === 'function') {
            // Channel 1 (SE) + overflow reach at ground level
            ctx.addExclusion(vx + 6, vz + 14, 4);
            ctx.addExclusion(vx + 8, vz + 18, 3.5);
            ctx.addExclusion(vx + 10, vz + 22, 3);
            ctx.addExclusion(vx + 12, vz + 24, 4);          // pool 1
            // Channel 2 (W)
            ctx.addExclusion(vx - 14, vz + 2, 3.5);
            ctx.addExclusion(vx - 17.5, vz + 1, 3.5);
            ctx.addExclusion(vx - 21, vz + 0.5, 3);
            ctx.addExclusion(ox - 23.5, vz + 0, 3);         // pool 2
            // Channel 3 (NE)
            ctx.addExclusion(vx + 6, vz - 14, 3.5);
            ctx.addExclusion(vx + 9, vz - 18, 3);
            ctx.addExclusion(vx + 12, vz - 21, 2.5);
            ctx.addExclusion(vx + 14, vz - 22, 3.5);        // pool 3
            // Crater lava (summit hazard)
            ctx.addExclusion(vx, vz, 3.5);
            exclusions = 13;
        }

        /* ── 19. Crater glow light (single biome light) ── */
        if (ctx && ctx.scene && THREE && THREE.PointLight) {
            var craterLight = new THREE.PointLight(0xff5a1f, 0.6, 28);
            craterLight.position.set(vx, 20.5, vz);
            craterLight.castShadow = false;
            ctx.scene.add(craterLight);
        }

        return {
            structures: 1,
            volcanoTiers: 5,
            lavaChannels: 3,
            lavaPools: 3,
            rockFormations: 4,
            spires: 4,
            deadTrees: 5,
            summitPathSteps: pathSteps,
            steamTiles: steamTiles,
            fissures: fissureCount,
            basaltColumns: columnCount,
            obsidianShards: 5,
            volcanicBombs: 4,
            rimTeeth: 5,
            spawnExclusions: exclusions
        };
    }

    /* Register biome */
    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns['volcano'] = buildVolcanoQuadrant;
})();
