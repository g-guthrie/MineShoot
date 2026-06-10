import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-nuclear-simpsons.js - Springfield Nuclear Power Plant (Simpsons-inspired).
 *
 * Two hyperboloid cooling towers (CylinderGeometry, 12-segment dodecagonal),
 * purple reactor with 3 red hemisphere domes (SphereGeometry),
 * teal control building, glass office, warehouse, octagonal orange tanks,
 * pylons, perimeter fence, gate, trees.
 *
 * Uses addDecor() for cylinder/sphere primitives, addBlock() for boxes.
 * All box positions are center-based. Z-fight prevention: roofs embed 0.05
 * into walls, windows protrude 0.06.
 */
(function () {
    'use strict';

    var MATS = null;
    var CYLINDER_SEGMENTS = 12;   // dodecagonal — low-poly Minecraft feel
    var TANK_SEGMENTS = 8;        // octagonal tanks

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            // Cooling towers
            towerGray:     lib.getLambert({ color: 0xAAAAAA }),
            towerDark:     lib.getLambert({ color: 0x777777 }),
            towerCap:      lib.getLambert({ color: 0x999999 }),
            // Reactor / warehouse
            purpleWall:    lib.getLambert({ color: 0x8B6FAE }),
            purpleDark:    lib.getLambert({ color: 0x6B4F8E }),
            redDome:       lib.getLambert({ color: 0xCC3333 }),
            // Teal building
            tealWall:      lib.getLambert({ color: 0x3A8A8A }),
            tealDark:      lib.getLambert({ color: 0x2A6A6A }),
            // Office / general
            grayLight:     lib.getLambert({ color: 0xCCCCCC }),
            grayDark:      lib.getLambert({ color: 0x777777 }),
            glassBlue:     lib.getLambert({ color: 0x88BBDD }),
            // Tanks
            orangeTank:    lib.getLambert({ color: 0xDD8833 }),
            // Infrastructure
            steel:         lib.getLambert({ color: 0x888899 }),
            yellowWarn:    lib.getLambert({ color: 0xFFD700 }),
            // Ground
            asphalt:       lib.getLambert({ color: 0x333333 }),
            concrete:      lib.getLambert({ color: 0xBBBBAA }),
            // Trees
            greenTree:     lib.getLambert({ color: 0x2D6B2D }),
            greenLight:    lib.getLambert({ color: 0x3D8B3D }),
            brownTrunk:    lib.getLambert({ color: 0x6B4226 }),
            // Steam
            steam: lib.getLambert({ color: 0xf8faf6, transparent: true, opacity: 0.09 }),
            nuclearGlow: lib.getLambert({ color: 0x44FF44, emissive: 0x22AA22 })
        };
        return MATS;
    }

    /* ── shorthand: tagged block (BoxGeometry via addBlock) ── */
    function tb(place, role, meta, x, y, z, w, h, d, material, isSolid) {
        var mesh = place.addBlock(x, y, z, w, h, d, material, isSolid);
        if (mesh) {
            mesh.userData = mesh.userData || {};
            mesh.userData.role = role;
            if (meta) {
                for (var k in meta) { mesh.userData[k] = meta[k]; }
            }
        }
        return mesh;
    }

    /* ── shorthand: tagged decor (custom geometry via addDecor) ── */
    function td(place, role, meta, x, y, z, geometry, material, rotY, rotX, rotZ) {
        var mesh = place.addDecor(x, y, z, geometry, material, rotY || 0, rotX || 0, rotZ || 0);
        if (mesh) {
            mesh.userData = mesh.userData || {};
            mesh.userData.role = role;
            if (meta) {
                for (var k in meta) { mesh.userData[k] = meta[k]; }
            }
        }
        return mesh;
    }

    function tcyl(place, role, meta, x, y, z, radiusTop, radiusBottom, height, options) {
        return place.addCylinderCollider({
            x: x,
            y: y,
            z: z,
            radiusTop: radiusTop,
            radiusBottom: radiusBottom,
            height: height,
            radialSlices: options && options.radialSlices,
            heightSlices: options && options.heightSlices,
            collisionGroup: options && options.collisionGroup ? options.collisionGroup : 'nuclear-round',
            role: role,
            meta: meta
        });
    }

    function tdomeCollider(place, role, meta, x, baseY, z, radius, options) {
        return place.addDomeCollider({
            x: x,
            baseY: baseY,
            z: z,
            radius: radius,
            radialSlices: options && options.radialSlices,
            heightSlices: options && options.heightSlices,
            collisionGroup: options && options.collisionGroup ? options.collisionGroup : 'nuclear-round',
            role: role,
            meta: meta
        });
    }

    /* ══════════════════════════════════════════════════════ */
    /* ── ASSET BUILDERS                                   ── */
    /* ══════════════════════════════════════════════════════ */

    /* ── A: Cooling Tower (hyperboloid via stacked cylinders) ── */

    function buildCoolingTower(cx, cz, towerId, place, mats, ctx) {
        var s = 1.25;

        // Foundation disc — flat concrete pad
        var foundGeo = new THREE.CylinderGeometry(5.5 * s, 5.5 * s, 0.4 * s, CYLINDER_SEGMENTS);
        td(place, 'cooling-tower-foundation', { towerId: towerId },
            cx, 0.2 * s, cz, foundGeo, mats.concrete);
        tcyl(place, 'cooling-tower-collider', { towerId: towerId, part: 'foundation' },
            cx, 0.2 * s, cz, 5.5 * s, 5.5 * s, 0.4 * s, { radialSlices: 7 });

        // Stacked tiers: big fat bottom, narrow waist, subtle asymmetric top flare
        var tiers = [
            { radiusTop: 4.2 * s, radiusBot: 5.2 * s, h: 4.0 * s, mat: mats.towerGray },   // wide base
            { radiusTop: 3.4 * s, radiusBot: 4.2 * s, h: 4.0 * s, mat: mats.towerGray },   // upper base
            { radiusTop: 2.8 * s, radiusBot: 3.4 * s, h: 3.5 * s, mat: mats.towerDark },   // waist
            { radiusTop: 3.0 * s, radiusBot: 2.8 * s, h: 3.0 * s, mat: mats.towerGray },   // mild flare
            { radiusTop: 3.2 * s, radiusBot: 3.0 * s, h: 2.5 * s, mat: mats.towerGray },   // slight top widen
        ];
        var currentY = 0.4 * s; // start above foundation
        var peakHeight = currentY;

        for (var i = 0; i < tiers.length; i++) {
            var tier = tiers[i];
            var centerY = currentY + (tier.h * 0.5);
            var geo = new THREE.CylinderGeometry(tier.radiusTop, tier.radiusBot, tier.h, CYLINDER_SEGMENTS);
            td(place, 'cooling-tower-tier', { towerId: towerId, tierIndex: i },
                cx, centerY, cz, geo, tier.mat);
            tcyl(place, 'cooling-tower-collider', { towerId: towerId, tierIndex: i, part: 'tier' },
                cx, centerY, cz, tier.radiusTop, tier.radiusBot, tier.h, { radialSlices: 7, heightSlices: 3 });
            currentY += tier.h;
            peakHeight = currentY;
        }

        // Lip ring at top
        var lipGeo = new THREE.CylinderGeometry(3.4 * s, 3.2 * s, 0.4 * s, CYLINDER_SEGMENTS);
        td(place, 'cooling-tower-lip', { towerId: towerId },
            cx, currentY + 0.2 * s, cz, lipGeo, mats.towerDark);
        tcyl(place, 'cooling-tower-collider', { towerId: towerId, part: 'lip' },
            cx, currentY + 0.2 * s, cz, 3.4 * s, 3.2 * s, 0.4 * s, { radialSlices: 7 });
        peakHeight += 0.4 * s;

        // Radiation symbol accent on waist (west face)
        var symbolY = (0.4 * s) + (4.0 * s) + (4.0 * s) + (3.5 * s) * 0.5; // midpoint of waist tier
        tb(place, 'cooling-tower-symbol', { towerId: towerId },
            cx - 3.5 * s, symbolY, cz, 0.12, 1.5 * s, 1.5 * s, mats.yellowWarn, false);

        // Steam
        var steamMat = cloneMaterial(mats.steam);
        steamMat.opacity = 0.22;
        steamMat.transparent = true;
        var steamGeo = new THREE.CylinderGeometry(2.0 * s, 2.5 * s, 4.0 * s, 8);
        td(place, 'cooling-tower-steam', { towerId: towerId },
            cx, peakHeight + 2.2 * s, cz, steamGeo, steamMat);

        if (ctx && typeof ctx.addExclusion === 'function') {
            ctx.addExclusion(cx, cz, 6.0 * s);
        }

        return { towerId: towerId, centerX: cx, centerZ: cz, peakHeight: peakHeight };
    }

    /* ── B: Reactor Building (purple walls + red hemisphere domes) ── */

    function buildReactorBuilding(cx, cz, w, d, h, numDomes, reactorId, place, mats) {
        // Main body (purple box)
        tb(place, 'reactor-body', { reactorId: reactorId },
            cx, h * 0.5, cz, w, h, d, mats.purpleWall, true);
        // Roof slab (embedded 0.05 into wall top)
        tb(place, 'reactor-roof', { reactorId: reactorId },
            cx, h - 0.05 + 0.15, cz, w + 0.4, 0.3, d + 0.4, mats.purpleDark, true);

        // Red hemisphere domes on top
        var domeRadius = Math.min(2.2, (w * 0.7) / numDomes);
        var domeSpacing = w / (numDomes + 1);
        var domeStartX = cx - (w * 0.5) + domeSpacing;

        for (var di = 0; di < numDomes; di++) {
            var domeX = domeStartX + (di * domeSpacing);

            // Dome base ring (cylinder, sits on roof)
            var ringGeo = new THREE.CylinderGeometry(domeRadius * 1.05, domeRadius * 1.05, 0.3, CYLINDER_SEGMENTS);
            td(place, 'reactor-dome-ring', { reactorId: reactorId, domeIndex: di },
                domeX, h + 0.15, cz, ringGeo, mats.asphalt);
            tcyl(place, 'reactor-dome-collider', { reactorId: reactorId, domeIndex: di, part: 'ring' },
                domeX, h + 0.15, cz, domeRadius * 1.05, domeRadius * 1.05, 0.3, { radialSlices: 5 });

            // Hemisphere dome (SphereGeometry, upper half only)
            // phiStart=0, phiLength=PI gives upper hemisphere
            var domeGeo = new THREE.SphereGeometry(domeRadius, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
            td(place, 'reactor-dome', { reactorId: reactorId, domeIndex: di },
                domeX, h + 0.3, cz, domeGeo, mats.redDome);
            tdomeCollider(place, 'reactor-dome-collider', { reactorId: reactorId, domeIndex: di, part: 'dome' },
                domeX, h + 0.3, cz, domeRadius, { radialSlices: 5, heightSlices: 4 });
        }

        // Glowing green window strip — west face + wraps 5 units onto north & south
        var winH = 1.36;  // window height (narrowed again 15%)
        var winY = h * 0.80; // vertical center of window band (15% higher)
        var halfW = w * 0.5;
        var halfD = d * 0.5;
        var wrapLen = 5;   // how far it wraps around corners

        var ft = 0.06; // frame bar thickness
        var fo = 0.025; // frame offset from wall (behind glow)
        var go = 0.035; // glow offset from wall (in front of frame)
        var glowW = d + 0.1; // slight overlap past corners — hidden behind wrap pieces, no gap
        var nWrapX = cx - halfW + (wrapLen * 0.5);
        var wrapW = wrapLen + 0.04; // north/south wrap width (along X)

        // ── West face ──
        // Green glow (full width of building)
        tb(place, 'reactor-glow-west', { reactorId: reactorId },
            cx - halfW - go, winY, cz, 0.01, winH, glowW, mats.nuclearGlow, false);
        // Frame: top and bottom only, NO bars at corners — clean wrap transition
        // Trim bars to stop just inside the building corners (leave room for wrap)
        var westBarLen = glowW - 0.1;
        tb(place, 'reactor-frame-w-top', null, cx - halfW - fo, winY + winH * 0.5, cz, 0.01, ft, westBarLen, mats.asphalt, false);
        tb(place, 'reactor-frame-w-bottom', null, cx - halfW - fo, winY - winH * 0.5, cz, 0.01, ft, westBarLen, mats.asphalt, false);

        // ── North face wrap ──
        tb(place, 'reactor-glow-north', { reactorId: reactorId },
            nWrapX, winY, cz - halfD - go, wrapW, winH, 0.01, mats.nuclearGlow, false);
        // Top, bottom, and right-end bar only (no left bar — that's the corner)
        tb(place, 'reactor-frame-n-top', null, nWrapX, winY + winH * 0.5, cz - halfD - fo, wrapW, ft, 0.01, mats.asphalt, false);
        tb(place, 'reactor-frame-n-bottom', null, nWrapX, winY - winH * 0.5, cz - halfD - fo, wrapW, ft, 0.01, mats.asphalt, false);
        tb(place, 'reactor-frame-n-rgt', null, nWrapX + wrapW * 0.5, winY, cz - halfD - fo, ft, winH, 0.01, mats.asphalt, false);

        // ── South face wrap ──
        tb(place, 'reactor-glow-south', { reactorId: reactorId },
            nWrapX, winY, cz + halfD + go, wrapW, winH, 0.01, mats.nuclearGlow, false);
        tb(place, 'reactor-frame-s-top', null, nWrapX, winY + winH * 0.5, cz + halfD + fo, wrapW, ft, 0.01, mats.asphalt, false);
        tb(place, 'reactor-frame-s-bottom', null, nWrapX, winY - winH * 0.5, cz + halfD + fo, wrapW, ft, 0.01, mats.asphalt, false);
        tb(place, 'reactor-frame-s-rgt', null, nWrapX + wrapW * 0.5, winY, cz + halfD + fo, ft, winH, 0.01, mats.asphalt, false);

        return {
            id: reactorId, centerX: cx, centerZ: cz,
            width: w, depth: d, height: h,
            roofY: h
        };
    }

    /* ── C: Teal Building (Homer's workplace) ── */

    function buildTealBuilding(cx, cz, place, mats) {
        var w = 6, h = 5, d = 6;
        tb(place, 'teal-body', null, cx, h * 0.5, cz, w, h, d, mats.tealWall, true);
        // Roof
        tb(place, 'teal-roof', null, cx, h - 0.05 + 0.15, cz, w + 0.3, 0.3, d + 0.3, mats.tealDark, true);
        var westFaceX = cx - (w * 0.5) - 0.06;
        // Windows (west face, 4 stacked vertically across the wall)
        for (var wi = 0; wi < 4; wi++) {
            var wz = cz - 2.0 + (wi * 1.3);
            tb(place, 'teal-window', null, westFaceX, 3.2, wz, 0.12, 0.8, 0.9, mats.glassBlue, false);
        }
    }

    /* ── C2: Containment Domes (pair of industrial rounded structures) ── */

    function buildContainmentDomes(cx, cz, place, mats) {
        // Two domes side by side (north-south), sitting on cylindrical bases
        var spacing = 4.5;
        for (var di = 0; di < 2; di++) {
            var dz = cz + (di === 0 ? -spacing * 0.5 : spacing * 0.5);
            // Cylindrical base
            var baseGeo = new THREE.CylinderGeometry(2.2, 2.4, 2.5, CYLINDER_SEGMENTS);
            td(place, 'containment-base', { domeIndex: di },
                cx, 1.25, dz, baseGeo, mats.purpleDark);
            tcyl(place, 'containment-collider', { domeIndex: di, part: 'base' },
                cx, 1.25, dz, 2.2, 2.4, 2.5, { radialSlices: 5, heightSlices: 3 });
            // Half-sphere dome on top
            var domeGeo = new THREE.SphereGeometry(2.3, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
            td(place, 'containment-dome', { domeIndex: di },
                cx, 2.5, dz, domeGeo, mats.orangeTank);
            tdomeCollider(place, 'containment-collider', { domeIndex: di, part: 'dome' },
                cx, 2.5, dz, 2.3, { radialSlices: 5, heightSlices: 4 });
            // Dark ring where dome meets base
            var ringGeo = new THREE.CylinderGeometry(2.35, 2.35, 0.15, CYLINDER_SEGMENTS);
            td(place, 'containment-ring', { domeIndex: di },
                cx, 2.5, dz, ringGeo, mats.asphalt);
            tcyl(place, 'containment-collider', { domeIndex: di, part: 'ring' },
                cx, 2.5, dz, 2.35, 2.35, 0.15, { radialSlices: 5 });
        }
    }

    /* ── D: Office Building (Burns' office, window grid faces west) ── */

    function buildOfficeBuilding(cx, cz, place, mats) {
        var w = 8, h = 3, d = 6;
        tb(place, 'office-body', null, cx, h * 0.5, cz, w, h, d, mats.grayLight, true);
        // Roof
        tb(place, 'office-roof', null, cx, h - 0.05 + 0.15, cz, w + 0.2, 0.3, d + 0.2, mats.grayDark, true);
        // Window grid on WEST face (4 cols x 1 row)
        var westFaceX = cx - (w * 0.5) - 0.06;
        for (var col = 0; col < 4; col++) {
            for (var row = 0; row < 1; row++) {
                var winZ = cz - 2.0 + (col * 1.4);
                var winY = 1.4 + (row * 1.1);
                tb(place, 'office-window', { col: col, row: row },
                    westFaceX, winY, winZ, 0.15, 0.9, 0.9, mats.glassBlue, false);
            }
        }
        // Twin chimneys on roof (one taller than the other)
        var roofY = h + 0.15;
        var chimney1H = 4.0;
        var chimney2H = 2.8;
        var chim1Geo = new THREE.CylinderGeometry(0.35, 0.45, chimney1H, 8);
        td(place, 'office-chimney-tall', null, cx + 1.5, roofY + chimney1H * 0.5, cz - 1.5, chim1Geo, mats.brownTrunk);
        tcyl(place, 'office-chimney-collider', { part: 'stack', size: 'tall' },
            cx + 1.5, roofY + chimney1H * 0.5, cz - 1.5, 0.35, 0.45, chimney1H, { radialSlices: 5, heightSlices: 2 });
        var cap1Geo = new THREE.CylinderGeometry(0.55, 0.4, 0.35, 8);
        td(place, 'office-chimney-tall-cap', null, cx + 1.5, roofY + chimney1H + 0.17, cz - 1.5, cap1Geo, mats.grayDark);
        tcyl(place, 'office-chimney-collider', { part: 'cap', size: 'tall' },
            cx + 1.5, roofY + chimney1H + 0.17, cz - 1.5, 0.55, 0.4, 0.35, { radialSlices: 5 });

        var chim2Geo = new THREE.CylinderGeometry(0.35, 0.45, chimney2H, 8);
        td(place, 'office-chimney-short', null, cx + 1.5, roofY + chimney2H * 0.5, cz + 0.5, chim2Geo, mats.brownTrunk);
        tcyl(place, 'office-chimney-collider', { part: 'stack', size: 'short' },
            cx + 1.5, roofY + chimney2H * 0.5, cz + 0.5, 0.35, 0.45, chimney2H, { radialSlices: 5, heightSlices: 2 });
        var cap2Geo = new THREE.CylinderGeometry(0.55, 0.4, 0.35, 8);
        td(place, 'office-chimney-short-cap', null, cx + 1.5, roofY + chimney2H + 0.17, cz + 0.5, cap2Geo, mats.grayDark);
        tcyl(place, 'office-chimney-collider', { part: 'cap', size: 'short' },
            cx + 1.5, roofY + chimney2H + 0.17, cz + 0.5, 0.55, 0.4, 0.35, { radialSlices: 5 });
        // Steam wisps
        var sMat = cloneMaterial(mats.steam); sMat.opacity = 0.18; sMat.transparent = true;
        var s1Geo = new THREE.CylinderGeometry(0.3, 0.5, 1.5, 6);
        td(place, 'office-chimney-steam', null, cx + 1.5, roofY + chimney1H + 1.1, cz - 1.5, s1Geo, sMat);
        var s2Geo = new THREE.CylinderGeometry(0.25, 0.4, 1.2, 6);
        td(place, 'office-chimney-steam', null, cx + 1.5, roofY + chimney2H + 0.9, cz + 0.5, s2Geo, sMat);
    }

    /* ── E: Purple Warehouse ── */

    function buildWarehouse(cx, cz, place, mats) {
        var w = 8, h = 3, d = 5;
        tb(place, 'warehouse-body', null, cx, h * 0.5, cz, w, h, d, mats.purpleWall, true);
        tb(place, 'warehouse-roof', null, cx, h - 0.05 + 0.15, cz, w + 0.2, 0.3, d + 0.2, mats.purpleDark, true);
        // Roll-up door (south face)
        tb(place, 'warehouse-door', null, cx, 1.25, cz + (d * 0.5) + 0.06, 3.0, 2.5, 0.12, mats.grayDark, true);
    }

    /* ── F: Storage Tank Cluster (3 octagonal cylinders) ── */

    function buildTankCluster(cx, cz, place, mats) {
        var offsets = [
            { x: 0, z: 0 },
            { x: 2.5, z: 0 },
            { x: 1.25, z: 2.2 }
        ];
        for (var i = 0; i < offsets.length; i++) {
            var tx = cx + offsets[i].x;
            var tz = cz + offsets[i].z;
            // Tank body (CylinderGeometry, 8 segments = octagonal)
            var tankGeo = new THREE.CylinderGeometry(1.0, 1.0, 3.0, TANK_SEGMENTS);
            td(place, 'tank-body', { tankIndex: i },
                tx, 1.5, tz, tankGeo, mats.orangeTank);
            tcyl(place, 'tank-collider', { tankIndex: i, part: 'body' },
                tx, 1.5, tz, 1.0, 1.0, 3.0, { radialSlices: 5 });
            // Cap (slightly wider cylinder)
            var capGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.2, TANK_SEGMENTS);
            td(place, 'tank-cap', { tankIndex: i },
                tx, 3.1, tz, capGeo, mats.steel);
            tcyl(place, 'tank-collider', { tankIndex: i, part: 'cap' },
                tx, 3.1, tz, 1.1, 1.1, 0.2, { radialSlices: 5 });
        }
    }

    /* ── G: Electrical Pylon ── */

    function buildPylon(cx, cz, place, mats) {
        // Two legs spread along Z (so arms face each other along the line)
        tb(place, 'pylon-leg', null, cx, 5.0, cz - 0.5, 0.2, 10.0, 0.2, mats.steel, true);
        tb(place, 'pylon-leg', null, cx, 5.0, cz + 0.5, 0.2, 10.0, 0.2, mats.steel, true);
        // Cross beams along Z
        tb(place, 'pylon-beam', null, cx, 4.0, cz, 0.2, 0.2, 1.5, mats.steel, true);
        tb(place, 'pylon-beam', null, cx, 7.0, cz, 0.2, 0.2, 1.5, mats.steel, true);
        // Top arms extend along Z
        tb(place, 'pylon-arm', null, cx, 9.5, cz - 1.2, 0.15, 0.15, 1.8, mats.steel, true);
        tb(place, 'pylon-arm', null, cx, 9.5, cz + 1.2, 0.15, 0.15, 1.8, mats.steel, true);
        // Insulators (4 hanging off arm ends)
        for (var side = -1; side <= 1; side += 2) {
            tb(place, 'pylon-insulator', null,
                cx - 0.15, 9.9, cz + (side * 1.8), 0.1, 0.5, 0.1, mats.grayLight, true);
            tb(place, 'pylon-insulator', null,
                cx + 0.15, 9.9, cz + (side * 1.8), 0.1, 0.5, 0.1, mats.grayLight, true);
        }
    }

    /* ── H: Tree ── */

    function buildTree(cx, cz, place, mats, sizeVariant, pointy) {
        var s = sizeVariant || 1.0;
        var trunkH = 2.5 + (s * 0.8);
        var canopyH = 2.5 + (s * 0.8);
        var canopyW = 2.2 + (s * 0.6);
        tb(place, 'tree-trunk', null, cx, trunkH * 0.5, cz, 0.5, trunkH, 0.5, mats.brownTrunk, true);
        tb(place, 'tree-canopy', null, cx, trunkH + (canopyH * 0.5), cz, canopyW, canopyH, canopyW,
            s > 0.5 ? mats.greenTree : mats.greenLight, true);
        if (pointy) {
            var coneGeo = typeof THREE.ConeGeometry === 'function'
                ? new THREE.ConeGeometry(canopyW * 0.5, canopyH * 0.7, 6)
                : new THREE.CylinderGeometry(0, canopyW * 0.5, canopyH * 0.7, 6);
            td(place, 'tree-point', null, cx, trunkH + canopyH + canopyH * 0.35, cz, coneGeo, mats.greenTree);
            tdomeCollider(place, 'tree-point-collider', null,
                cx, trunkH + canopyH, cz, canopyW * 0.5, { radialSlices: 5, heightSlices: 3 });
        }
    }

    /* ── I: Perimeter Fence (loop with gate gap) ── */

    function resolveGateRange(specOrCenter, gateWidth, sideClearance) {
        if (typeof specOrCenter === 'object' && specOrCenter) {
            if (typeof specOrCenter.min === 'number' && typeof specOrCenter.max === 'number') {
                return { min: specOrCenter.min, max: specOrCenter.max };
            }
            gateWidth = specOrCenter.width;
            sideClearance = specOrCenter.sideClearance;
            specOrCenter = specOrCenter.center;
        }
        var gateHalfW = gateWidth * 0.5;
        return {
            min: specOrCenter - gateHalfW - sideClearance,
            max: specOrCenter + gateHalfW + sideClearance
        };
    }

    function buildFence(minX, maxX, minZ, maxZ, gateSpecs, place, mats) {
        var fh = 2.0;
        var ft = 0.12;
        var postSpacing = 4.0;
        var postH = 2.3;
        var postW = 0.15;
        var westGate = gateSpecs.west ? resolveGateRange(gateSpecs.west) : null;
        var northGate = gateSpecs.north ? resolveGateRange(gateSpecs.north) : null;
        var southGate = gateSpecs.south ? resolveGateRange(gateSpecs.south) : null;

        // North wall
        if (northGate) {
            var northLeftLen = northGate.min - minX;
            if (northLeftLen > 1) {
                tb(place, 'fence-segment', null, minX + (northLeftLen * 0.5), fh * 0.5, minZ, northLeftLen, fh, ft, mats.steel, true);
            }
            var northRightLen = maxX - northGate.max;
            if (northRightLen > 1) {
                tb(place, 'fence-segment', null, northGate.max + (northRightLen * 0.5), fh * 0.5, minZ, northRightLen, fh, ft, mats.steel, true);
            }
        } else {
            var nLen = maxX - minX;
            tb(place, 'fence-segment', null, (minX + maxX) * 0.5, fh * 0.5, minZ, nLen, fh, ft, mats.steel, true);
        }
        // South wall
        if (southGate) {
            var southLeftLen = southGate.min - minX;
            if (southLeftLen > 1) {
                tb(place, 'fence-segment', null, minX + (southLeftLen * 0.5), fh * 0.5, maxZ, southLeftLen, fh, ft, mats.steel, true);
            }
            var southRightLen = maxX - southGate.max;
            if (southRightLen > 1) {
                tb(place, 'fence-segment', null, southGate.max + (southRightLen * 0.5), fh * 0.5, maxZ, southRightLen, fh, ft, mats.steel, true);
            }
        } else {
            var sLen = maxX - minX;
            tb(place, 'fence-segment', null, (minX + maxX) * 0.5, fh * 0.5, maxZ, sLen, fh, ft, mats.steel, true);
        }
        // East wall
        var eLen = maxZ - minZ;
        tb(place, 'fence-segment', null, maxX, fh * 0.5, (minZ + maxZ) * 0.5, ft, fh, eLen, mats.steel, true);
        // West wall — split for gate gap
        if (westGate) {
            var topSegLen = westGate.min - minZ;
            if (topSegLen > 1) {
                tb(place, 'fence-segment', null, minX, fh * 0.5, minZ + (topSegLen * 0.5), ft, fh, topSegLen, mats.steel, true);
            }
            var botSegLen = maxZ - westGate.max;
            if (botSegLen > 1) {
                tb(place, 'fence-segment', null, minX, fh * 0.5, westGate.max + (botSegLen * 0.5), ft, fh, botSegLen, mats.steel, true);
            }
        } else {
            var wLen = maxZ - minZ;
            tb(place, 'fence-segment', null, minX, fh * 0.5, (minZ + maxZ) * 0.5, ft, fh, wLen, mats.steel, true);
        }

        // Posts along north and south
        for (var px = minX; px <= maxX; px += postSpacing) {
            if (!northGate || px < northGate.min - 1 || px > northGate.max + 1) {
                tb(place, 'fence-post', null, px, postH * 0.5, minZ, postW, postH, postW, mats.grayDark, true);
            }
            if (!southGate || px < southGate.min - 1 || px > southGate.max + 1) {
                tb(place, 'fence-post', null, px, postH * 0.5, maxZ, postW, postH, postW, mats.grayDark, true);
            }
        }
        // Posts along east and west (skip gate)
        for (var pz = minZ; pz <= maxZ; pz += postSpacing) {
            tb(place, 'fence-post', null, maxX, postH * 0.5, pz, postW, postH, postW, mats.grayDark, true);
            if (!westGate || pz < westGate.min - 1 || pz > westGate.max + 1) {
                tb(place, 'fence-post', null, minX, postH * 0.5, pz, postW, postH, postW, mats.grayDark, true);
            }
        }
    }

    /* ── J: Gate Booth (at fence line, arm inline with fence) ── */

    function buildGateBooth(side, a, b, place, mats) {
        var meta = { side: side };
        if (side === 'west') {
            var boothX = a;
            var boothZ = b;
            tb(place, 'gate-booth', meta, boothX, 1.25, boothZ, 2.0, 2.5, 2.0, mats.grayLight, true);
            tb(place, 'gate-booth-roof', meta, boothX, 2.48, boothZ, 2.3, 0.2, 2.3, mats.grayDark, true);
            tb(place, 'gate-booth-window', meta, boothX - 1.06, 1.6, boothZ, 0.12, 0.7, 1.2, mats.glassBlue, false);
            return;
        }
        var boothCenterX = a;
        var boothCenterZ = b;
        tb(place, 'gate-booth', meta, boothCenterX, 1.25, boothCenterZ, 2.0, 2.5, 2.0, mats.grayLight, true);
        tb(place, 'gate-booth-roof', meta, boothCenterX, 2.48, boothCenterZ, 2.3, 0.2, 2.3, mats.grayDark, true);
        var windowZ = side === 'north' ? boothCenterZ - 1.06 : boothCenterZ + 1.06;
        tb(place, 'gate-booth-window', meta, boothCenterX, 1.6, windowZ, 1.2, 0.7, 0.12, mats.glassBlue, false);
    }

    function buildGate(side, fenceCoord, gateSpec, place, mats) {
        var gateRange = resolveGateRange(gateSpec, gateSpec.width, gateSpec.sideClearance);
        var boothHalfDepth = 1.0;
        if (side === 'west') {
            buildGateBooth(side, fenceCoord, gateRange.min + boothHalfDepth, place, mats);
            buildGateBooth(side, fenceCoord, gateRange.max - boothHalfDepth, place, mats);
            return;
        }
        buildGateBooth(side, gateRange.min + boothHalfDepth, fenceCoord, place, mats);
        buildGateBooth(side, gateRange.max - boothHalfDepth, fenceCoord, place, mats);
    }

    /* ── L: Utility Boxes & Pipes ── */

    function buildUtilityBox(cx, cz, place, mats) {
        tb(place, 'utility-box', null, cx, 0.6, cz, 1.0, 1.2, 0.8, mats.steel, true);
    }

    function buildPipeRun(cx, cz, length, place, mats) {
        tb(place, 'pipe-run', null, cx, 0.4, cz, 0.2, 0.2, length, mats.steel, true);
    }

    function buildReactorTankPrefabAt(cx, cz, place) {
        var runtime = globalThis.__MAYHEM_RUNTIME || {};
        var prefabs = runtime.WorldPrefabs || {};
        var builder = prefabs.reactorTank;
        if (typeof builder !== 'function') return null;
        return builder(place, {
            x: cx,
            z: cz,
            collisionGroup: 'reactor-tank'
        });
    }

    function buildFuelSpheresPrefabAt(cx, cz, place) {
        var runtime = globalThis.__MAYHEM_RUNTIME || {};
        var prefabs = runtime.WorldPrefabs || {};
        var builder = prefabs.fuelSpheres;
        if (typeof builder !== 'function') return null;
        return builder(place, {
            x: cx,
            z: cz,
            collisionGroup: 'fuel-spheres'
        });
    }

    /* ══════════════════════════════════════════════════════ */
    /* ── MAIN BUILDER                                    ── */
    /* ══════════════════════════════════════════════════════ */

    function buildSimpsonsNuclearQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var rawBounds = ctx && ctx.rawBounds ? ctx.rawBounds : bounds;

        /*  Layout reference (top-down, matches Simpsons reference image):
         *
         *  WEST EDGE (minX)                              EAST EDGE (maxX)
         *  <- citadel / map center          world boundary wall ->
         *  <- players approach from here    towers pushed here ->
         *
         *  Gate on WEST wall. Towers hard against EAST wall.
         *  North = minZ (toward radar/arctic)
         *  South = maxZ (toward volcano)
         */

        var ctr = pt(rawBounds, 0.5, 0.5);
        var ox = ctr.x;
        var oz = ctr.z;

        // Fence perimeter (expanded 3 units in all directions)
        var fenceMinX = ox - 24;
        var fenceMaxX = ox + 24;
        var fenceMinZ = oz - 25;
        var fenceMaxZ = oz + 23;
        var gateZ = oz;  // west gate centered on west wall
        var fenceMidX = ox;
        var northGateCenterX = fenceMidX - 5;

        // ── 1. Fence ──────────────────────────────────────
        var gateWidth = 4.0;
        var gateSideClearance = 8.0; // remove two fence spans north and south of the road
        var northGateMinX = northGateCenterX - (gateWidth * 0.5) - gateSideClearance + 2;
        var northGateMaxX = northGateCenterX + (gateWidth * 0.5) + gateSideClearance - 1;
        var fenceGates = {
            west: { center: gateZ, width: gateWidth, sideClearance: gateSideClearance },
            north: { min: northGateMinX, max: northGateMaxX, width: gateWidth, sideClearance: gateSideClearance },
            south: { center: fenceMidX, width: gateWidth, sideClearance: gateSideClearance }
        };

        // ── 2. Roads ──────────────────────────────────────
        // Asphalt driveway: from biome west edge to reactor building, replacing old entry road + west concrete
        var biomeWestX = rawBounds.minX;
        var driveEndX = ox + 4 - 9; // west face of reactor building
        var driveLen = driveEndX - biomeWestX;
        var driveCenterX = biomeWestX + driveLen * 0.5;
        tb(place, 'entry-road', null,
            driveCenterX, 0.04, gateZ, driveLen, 0.08, gateWidth, mats.asphalt, false);
        // Internal east-west road (reactor eastward to towers only)
        // Start 0.05 east of the reactor west wall so the road's -X face is not
        // coplanar with the purple wall face (z-fight guard).
        var iewStartX = driveEndX + 0.05;
        var iewEndX = ox + 21;
        var iewLen = iewEndX - iewStartX;
        tb(place, 'internal-road-ew', null,
            iewStartX + iewLen * 0.5, 0.05, gateZ, iewLen, 0.08, 3.0, mats.concrete, false);
        // Internal north-south road
        tb(place, 'internal-road-ns', null,
            ox, 0.06, oz - 0.5, 3.0, 0.08, 35, mats.concrete, false);
        // ── 3. Cooling Towers (pushed hard against EAST wall) ──
        var towerEastX = rawBounds.maxX;
        var northTowerZ = oz - 10;
        var southTowerZ = oz + 10;
        var t1 = buildCoolingTower(towerEastX - 6, northTowerZ, 'north', place, mats, ctx);
        var t2 = buildCoolingTower(towerEastX - 6, southTowerZ, 'south', place, mats, ctx);

        // ── 4. Reactor Building (center-east, purple + 3 red domes) ──
        var reactor = buildReactorBuilding(
            ox + 4, oz, 18, 12, 7, 3, 'main', place, mats);

        // ── 5. Teal Building (NW corner, Homer's workplace) ──
        buildTealBuilding(ox - 18, oz - 18, place, mats);

        // ── 5b. Containment Domes (where teal building used to be) ──
        buildContainmentDomes(ox - 10, oz - 10, place, mats);

        // ── 5c. Pipe runs from domes to reactor (elbow joints, 1 unit off ground) ──
        var pipeY = 1.0;
        var pipeR = 0.3;
        var reactorWestX = ox + 4 - 9; // reactor west wall
        var domeX = ox - 10;
        var elbowX = reactorWestX + 3; // elbow inside/behind reactor west wall
        // North dome pipe
        var nDomeZ = oz - 12.25;
        var reactorConnZ = oz - 5; // connect to reactor north side
        // East run from dome to elbow
        var nRunLen = elbowX - domeX;
        tb(place, 'pipe-n-east', null, domeX + nRunLen * 0.5, pipeY, nDomeZ, nRunLen, pipeR, pipeR, mats.steel, true);
        // Elbow joint
        tb(place, 'pipe-n-elbow', null, elbowX, pipeY, nDomeZ, 0.5, 0.5, 0.5, mats.grayDark, true);
        // South run from elbow to reactor
        var nSouthLen = Math.abs(reactorConnZ - nDomeZ);
        tb(place, 'pipe-n-south', null, elbowX, pipeY, (nDomeZ + reactorConnZ) * 0.5, pipeR, pipeR, nSouthLen, mats.steel, true);

        // South dome pipe
        var sDomeZ = oz - 7.75;
        var reactorConnZ2 = oz - 2; // connect to reactor mid-west
        // East run from dome to elbow
        var sRunLen = elbowX - domeX;
        tb(place, 'pipe-s-east', null, domeX + sRunLen * 0.5, pipeY, sDomeZ, sRunLen, pipeR, pipeR, mats.steel, true);
        // Elbow joint
        tb(place, 'pipe-s-elbow', null, elbowX, pipeY, sDomeZ, 0.5, 0.5, 0.5, mats.grayDark, true);
        // South run from elbow to reactor
        var sSouthLen = Math.abs(reactorConnZ2 - sDomeZ);
        tb(place, 'pipe-s-south', null, elbowX, pipeY, (sDomeZ + reactorConnZ2) * 0.5, pipeR, pipeR, sSouthLen, mats.steel, true);

        // ── 5c2. Dual pipes from the teal building and AC unit to reactor north wall ──
        var tealPipeY = 2.0;
        var tealBuildingCenterX = ox - 18;
        var tealBuildingSouthZ = oz - 18 + 3.0;
        var tealBuildingEastFaceX = tealBuildingCenterX + 3.0;
        var tealAcCenterX = ox - 18;
        var tealAcWestFaceX = tealAcCenterX - 1.0;
        var tealWallPipeZ = tealBuildingSouthZ - 0.2; // inner pipe hits the building wall
        var tealAcPipeZ = tealBuildingSouthZ + 0.2;   // outer pipe tracks to the AC
        var reactorNorthZ = oz - 6; // reactor north wall
        var wallSouthLen = Math.abs(reactorNorthZ - tealWallPipeZ);
        var acSouthLen = Math.abs(reactorNorthZ - tealAcPipeZ);
        var wallEastLen = Math.abs(elbowX - tealBuildingEastFaceX);
        var acEastLen = Math.abs(elbowX - tealAcWestFaceX);
        // Pipe A is the shorter inner line and ends at the building wall.
        tb(place, 'teal-pipe-a-south', null, elbowX, tealPipeY, (tealWallPipeZ + reactorNorthZ) * 0.5, pipeR, pipeR, wallSouthLen, mats.steel, true);
        tb(place, 'teal-pipe-a-elbow', null, elbowX, tealPipeY, tealWallPipeZ, 0.5, 0.5, 0.5, mats.grayDark, true);
        tb(place, 'teal-pipe-a-east', null, tealBuildingEastFaceX + (wallEastLen * 0.5), tealPipeY, tealWallPipeZ, wallEastLen, pipeR, pipeR, mats.steel, true);
        // Pipe B is the longer outer line and continues along the building to the AC.
        tb(place, 'teal-pipe-b-south', null, elbowX, tealPipeY, (tealAcPipeZ + reactorNorthZ) * 0.5, pipeR, pipeR, acSouthLen, mats.steel, true);
        tb(place, 'teal-pipe-b-elbow', null, elbowX, tealPipeY, tealAcPipeZ, 0.5, 0.5, 0.5, mats.grayDark, true);
        tb(place, 'teal-pipe-b-east', null, tealAcWestFaceX + (acEastLen * 0.5), tealPipeY, tealAcPipeZ, acEastLen, pipeR, pipeR, mats.steel, true);

        // ── 5d. Chimney/Smokestack (on teal building roof) ──
        var tealX = ox - 18, tealZ = oz - 18, tealRoofY = 5.3;
        var chimneyH = 6;
        var chimneyGeo = new THREE.CylinderGeometry(0.4, 0.6, chimneyH, 8);
        td(place, 'chimney-stack', null, tealX + 1.5, tealRoofY + chimneyH * 0.5, tealZ + 1.5, chimneyGeo, mats.brownTrunk);
        tcyl(place, 'chimney-collider', { part: 'stack' },
            tealX + 1.5, tealRoofY + chimneyH * 0.5, tealZ + 1.5, 0.4, 0.6, chimneyH, { radialSlices: 5, heightSlices: 2 });
        var capGeo = new THREE.CylinderGeometry(0.7, 0.5, 0.5, 8);
        td(place, 'chimney-cap', null, tealX + 1.5, tealRoofY + chimneyH + 0.25, tealZ + 1.5, capGeo, mats.grayDark);
        tcyl(place, 'chimney-collider', { part: 'cap' },
            tealX + 1.5, tealRoofY + chimneyH + 0.25, tealZ + 1.5, 0.7, 0.5, 0.5, { radialSlices: 5 });
        // Steam wisp
        var tealSteamMat = cloneMaterial(mats.steam); tealSteamMat.opacity = 0.18; tealSteamMat.transparent = true;
        var tealSteamGeo = new THREE.CylinderGeometry(0.4, 0.65, 2.0, 6);
        td(place, 'chimney-steam', null, tealX + 1.5, tealRoofY + chimneyH + 1.5, tealZ + 1.5, tealSteamGeo, tealSteamMat);

        // ── 6. Office Building (southwest, aligned with teal building X) ──
        buildOfficeBuilding(ox - 16, oz + 17, place, mats);

        // ── 6b. Fuel spheres (shifted 8 world units south from the reworked swap spot) ──
        buildFuelSpheresPrefabAt(ox + 1, oz + 15, place);

        // ── 7. Reactor Tank Prefab (replaces the smaller purple warehouse by the big factory) ──
        var reactorTank = buildReactorTankPrefabAt(ox - 14, oz + 7, place);
        if (!reactorTank) {
            buildWarehouse(ox - 14, oz + 7, place, mats);
        }

        // ── 8. Tank Cluster (NE of reactor) ──
        buildTankCluster(ox + 8, oz - 12, place, mats);

        // ── 9. Utility boxes & pipes (scattered industrial filler) ──
        buildUtilityBox(ox - 4, oz - 4, place, mats);
        buildUtilityBox(ox + 10, oz + 4, place, mats);

        // AC unit sits flush to the teal building south wall and acts as the visible pipe landing point.
        tb(place, 'ac-unit', null, ox - 18, 1.25, oz - 18 + 3 + 0.75, 2.0, 2.5, 1.5, mats.steel, true);

        // ── 10. Trees (ring outside fence, ~20 total) ──
        // Snap to grid cell centers (odd numbers: -25, -23, -21, ... 23, 25)
        function snapGrid(v) { return Math.round((v - 1) / 2) * 2 + 1; }

        var treePositions = [];
        // North tree line (4 trees, ~10 unit spacing)
        for (var tn = 0; tn < 4; tn++) {
            if (tn === 0) continue;
            var northTreeX = snapGrid(fenceMinX + 4 + (tn * 10));
            if (tn === 1) northTreeX -= 8;
            if (tn === 2) northTreeX += 10;
            if (tn === 3) northTreeX += 7;
            // z held at fenceMinZ - 0.5 (not snapped): the snapped row sat on the
            // north interior seam and the widest canopy bled into the radar cell.
            treePositions.push({ x: northTreeX, z: fenceMinZ, s: 0.7 + (tn % 3) * 0.3 });
        }
        // South tree line (4 trees, ~10 unit spacing, one pointy)
        for (var ts = 0; ts < 4; ts++) {
            if (ts === 2) continue;
            var southTreeX = snapGrid(fenceMinX + 4 + (ts * 10));
            if (ts === 1) southTreeX -= 3;
            if (ts === 3) southTreeX += 3;
            // z held at fenceMaxZ + 2.5 (not snapped): the snapped row's canopies
            // crossed the southern interior seam (z=110) into the volcano cell.
            treePositions.push({ x: southTreeX, z: fenceMaxZ + 2.0, s: 0.6 + (ts % 3) * 0.35, pointy: false });
        }
        // East tree line (5 trees, natural wall, skip cooling tower zones)
        // Towers at roughly oz-10 and oz+10, radius ~7 each with scale
        var eastTreeX = snapGrid(fenceMaxX + 2);
        var eastZs = [oz - 23, oz - 15, oz, oz + 15, oz + 23];
        for (var te = 0; te < eastZs.length; te++) {
            treePositions.push({ x: eastTreeX, z: snapGrid(eastZs[te]), s: 0.8 + (te % 3) * 0.2 });
        }
        // West tree line (skip gate area)
        for (var tw = 0; tw < 4; tw++) {
            var twz = fenceMinZ + 4 + (tw * 10);
            if (Math.abs(twz - gateZ) < 5) continue;
            if (tw === 3) continue;
            if (tw === 1) continue;
            if (tw === 0) continue;
            var westTreeX = snapGrid(fenceMinX - 2);
            var westTreeZ = snapGrid(twz);
            treePositions.push({ x: westTreeX, z: westTreeZ, s: 0.6 + (tw % 3) * 0.3 });
        }
        // Corner tree (skip NE — cooling towers). Pulled inside the cell: the old
        // snapped spot put the trunk past the east WORLD edge and the canopy across
        // the southern interior seam. Sits west of the east tree line, same row as
        // the south line.
        treePositions.push({ x: snapGrid(fenceMaxX - 2), z: fenceMaxZ + 2.0, s: 0.9 });

        for (var ti = 0; ti < treePositions.length; ti++) {
            var tp = treePositions[ti];
            buildTree(tp.x, tp.z, place, mats, tp.s, tp.pointy);
        }

        return {
            structures: 6,
            towers: 2,
            steamColumns: 2,
            towerPeakHeight: Math.max(t1.peakHeight, t2.peakHeight),
            reactorBuildings: 1,
            ductLength: 0
        };
    }

    /* Register as the live nuclear biome and keep the alternate key for debugging. */
    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.nuclear = buildSimpsonsNuclearQuadrant;
    ns['nuclear-simpsons'] = buildSimpsonsNuclearQuadrant;
})();
