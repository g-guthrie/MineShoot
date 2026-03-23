import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-nuclear-simpsons.js - Springfield Nuclear Power Plant (Simpsons-inspired).
 *
 * Two hyperboloid cooling towers (CylinderGeometry, 12-segment dodecagonal),
 * purple reactor with 3 red hemisphere domes (SphereGeometry),
 * teal control building, glass office, warehouse, octagonal orange tanks,
 * pylons, perimeter fence, gate, parking lot, trees.
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
            steam: lib.getLambert({ color: 0xf8faf6, transparent: true, opacity: 0.09 })
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

    /* ══════════════════════════════════════════════════════ */
    /* ── ASSET BUILDERS                                   ── */
    /* ══════════════════════════════════════════════════════ */

    /* ── A: Cooling Tower (hyperboloid via stacked cylinders) ── */

    function buildCoolingTower(cx, cz, towerId, place, mats, ctx) {
        // 4-tier stacked cylinders: wide base, narrow waist, flared rim, lip
        var tiers = [
            { radiusTop: 3.0, radiusBot: 4.0, h: 6.0, mat: mats.towerGray },  // base
            { radiusTop: 2.8, radiusBot: 3.0, h: 5.0, mat: mats.towerDark },  // waist
            { radiusTop: 3.5, radiusBot: 2.8, h: 5.0, mat: mats.towerGray },  // rim
        ];
        var currentY = 0;
        var peakHeight = 0;

        for (var i = 0; i < tiers.length; i++) {
            var tier = tiers[i];
            var centerY = currentY + (tier.h * 0.5);
            var geo = new THREE.CylinderGeometry(tier.radiusTop, tier.radiusBot, tier.h, CYLINDER_SEGMENTS);
            td(place, 'cooling-tower-tier', { towerId: towerId, tierIndex: i },
                cx, centerY, cz, geo, tier.mat);
            currentY += tier.h;
            peakHeight = currentY;
        }

        // Lip ring at top
        var lipGeo = new THREE.CylinderGeometry(3.6, 3.5, 0.4, CYLINDER_SEGMENTS);
        td(place, 'cooling-tower-lip', { towerId: towerId },
            cx, currentY + 0.2, cz, lipGeo, mats.towerDark);
        peakHeight += 0.4;

        // Radiation symbol accent on waist (west face) — flat box
        tb(place, 'cooling-tower-symbol', { towerId: towerId },
            cx - 3.05, 8.5, cz, 0.12, 1.5, 1.5, mats.yellowWarn, false);

        // Steam (translucent cylinder above rim)
        var steamMat = cloneMaterial(mats.steam);
        steamMat.opacity = 0.22;
        steamMat.transparent = true;
        var steamGeo = new THREE.CylinderGeometry(2.0, 2.5, 4.0, 8);
        td(place, 'cooling-tower-steam', { towerId: towerId },
            cx, peakHeight + 2.2, cz, steamGeo, steamMat);

        if (ctx && typeof ctx.addExclusion === 'function') {
            ctx.addExclusion(cx, cz, 5.0);
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
            cx, h - 0.05 + 0.15, cz, w + 0.4, 0.3, d + 0.4, mats.purpleDark, false);

        // Red hemisphere domes on top
        var domeRadius = Math.min(2.2, (w * 0.7) / numDomes);
        var domeSpacing = w / (numDomes + 1);
        var domeStartX = cx - (w * 0.5) + domeSpacing;

        for (var di = 0; di < numDomes; di++) {
            var domeX = domeStartX + (di * domeSpacing);

            // Dome base ring (cylinder, sits on roof)
            var ringGeo = new THREE.CylinderGeometry(domeRadius * 1.05, domeRadius * 1.05, 0.3, CYLINDER_SEGMENTS);
            td(place, 'reactor-dome-ring', { reactorId: reactorId, domeIndex: di },
                domeX, h + 0.15, cz, ringGeo, mats.purpleDark);

            // Hemisphere dome (SphereGeometry, upper half only)
            // phiStart=0, phiLength=PI gives upper hemisphere
            var domeGeo = new THREE.SphereGeometry(domeRadius, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
            td(place, 'reactor-dome', { reactorId: reactorId, domeIndex: di },
                domeX, h + 0.3, cz, domeGeo, mats.redDome);
        }

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
        tb(place, 'teal-roof', null, cx, h - 0.05 + 0.15, cz, w + 0.3, 0.3, d + 0.3, mats.tealDark, false);
        // Door (west face, facing map center)
        var westFaceX = cx - (w * 0.5) - 0.06;
        tb(place, 'teal-door', null, westFaceX, 1.1, cz, 0.15, 2.2, 1.2, mats.asphalt, false);
        // Windows (west face, 4 stacked vertically across the wall)
        for (var wi = 0; wi < 4; wi++) {
            var wz = cz - 2.0 + (wi * 1.3);
            tb(place, 'teal-window', null, westFaceX, 3.2, wz, 0.12, 0.8, 0.9, mats.glassBlue, false);
        }
    }

    /* ── D: Office Building (Burns' office, window grid faces west) ── */

    function buildOfficeBuilding(cx, cz, place, mats) {
        var w = 8, h = 7, d = 6;
        tb(place, 'office-body', null, cx, h * 0.5, cz, w, h, d, mats.grayLight, true);
        // Roof
        tb(place, 'office-roof', null, cx, h - 0.05 + 0.15, cz, w + 0.2, 0.3, d + 0.2, mats.grayDark, false);
        // Window grid on WEST face (4 cols x 5 rows)
        var westFaceX = cx - (w * 0.5) - 0.06;
        for (var col = 0; col < 4; col++) {
            for (var row = 0; row < 5; row++) {
                var winZ = cz - 2.0 + (col * 1.4);
                var winY = 1.4 + (row * 1.1);
                tb(place, 'office-window', { col: col, row: row },
                    westFaceX, winY, winZ, 0.15, 0.9, 0.9, mats.glassBlue, false);
            }
        }
        // Entry overhang (west face)
        tb(place, 'office-overhang', null, westFaceX - 0.5, 3.0, cz, 1.5, 0.3, 3.0, mats.grayDark, false);
        // Entry columns (x2)
        tb(place, 'office-column', null, westFaceX - 1.2, 1.5, cz - 1.2, 0.3, 3.0, 0.3, mats.steel, false);
        tb(place, 'office-column', null, westFaceX - 1.2, 1.5, cz + 1.2, 0.3, 3.0, 0.3, mats.steel, false);
    }

    /* ── E: Purple Warehouse ── */

    function buildWarehouse(cx, cz, place, mats) {
        var w = 8, h = 3, d = 5;
        tb(place, 'warehouse-body', null, cx, h * 0.5, cz, w, h, d, mats.purpleWall, true);
        tb(place, 'warehouse-roof', null, cx, h - 0.05 + 0.15, cz, w + 0.2, 0.3, d + 0.2, mats.purpleDark, false);
        // Roll-up door (south face)
        tb(place, 'warehouse-door', null, cx, 1.25, cz + (d * 0.5) + 0.06, 3.0, 2.5, 0.12, mats.grayDark, false);
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
            // Cap (slightly wider cylinder)
            var capGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.2, TANK_SEGMENTS);
            td(place, 'tank-cap', { tankIndex: i },
                tx, 3.1, tz, capGeo, mats.steel);
        }
    }

    /* ── G: Electrical Pylon ── */

    function buildPylon(cx, cz, place, mats) {
        // Two legs
        tb(place, 'pylon-leg', null, cx - 0.5, 5.0, cz, 0.2, 10.0, 0.2, mats.steel, false);
        tb(place, 'pylon-leg', null, cx + 0.5, 5.0, cz, 0.2, 10.0, 0.2, mats.steel, false);
        // Cross beams
        tb(place, 'pylon-beam', null, cx, 4.0, cz, 1.5, 0.2, 0.2, mats.steel, false);
        tb(place, 'pylon-beam', null, cx, 7.0, cz, 1.5, 0.2, 0.2, mats.steel, false);
        // Top arms
        tb(place, 'pylon-arm', null, cx - 1.2, 9.5, cz, 1.8, 0.15, 0.15, mats.steel, false);
        tb(place, 'pylon-arm', null, cx + 1.2, 9.5, cz, 1.8, 0.15, 0.15, mats.steel, false);
        // Insulators (4 hanging)
        for (var side = -1; side <= 1; side += 2) {
            tb(place, 'pylon-insulator', null,
                cx + (side * 1.8), 9.9, cz - 0.15, 0.1, 0.5, 0.1, mats.grayLight, false);
            tb(place, 'pylon-insulator', null,
                cx + (side * 1.8), 9.9, cz + 0.15, 0.1, 0.5, 0.1, mats.grayLight, false);
        }
    }

    /* ── H: Tree ── */

    function buildTree(cx, cz, place, mats, sizeVariant) {
        var s = sizeVariant || 1.0;
        var trunkH = 2.5 + (s * 0.8);
        var canopyH = 2.5 + (s * 0.8);
        var canopyW = 2.2 + (s * 0.6);
        tb(place, 'tree-trunk', null, cx, trunkH * 0.5, cz, 0.5, trunkH, 0.5, mats.brownTrunk, false);
        tb(place, 'tree-canopy', null, cx, trunkH + (canopyH * 0.5), cz, canopyW, canopyH, canopyW,
            s > 0.5 ? mats.greenTree : mats.greenLight, false);
    }

    /* ── I: Perimeter Fence (loop with gate gap) ── */

    function buildFence(minX, maxX, minZ, maxZ, gateZ, gateWidth, place, mats) {
        var fh = 2.0;
        var ft = 0.12;
        var postSpacing = 4.0;
        var postH = 2.3;
        var postW = 0.15;

        // North wall
        var nLen = maxX - minX;
        tb(place, 'fence-segment', null, (minX + maxX) * 0.5, fh * 0.5, minZ, nLen, fh, ft, mats.steel, false);
        // South wall
        tb(place, 'fence-segment', null, (minX + maxX) * 0.5, fh * 0.5, maxZ, nLen, fh, ft, mats.steel, false);
        // East wall
        var eLen = maxZ - minZ;
        tb(place, 'fence-segment', null, maxX, fh * 0.5, (minZ + maxZ) * 0.5, ft, fh, eLen, mats.steel, false);
        // West wall — split for gate gap
        var gateHalfW = gateWidth * 0.5;
        var gateMinZ = gateZ - gateHalfW;
        var gateMaxZ = gateZ + 4.4; // extend gap south to cover booth
        var topSegLen = gateMinZ - minZ;
        if (topSegLen > 1) {
            tb(place, 'fence-segment', null, minX, fh * 0.5, minZ + (topSegLen * 0.5), ft, fh, topSegLen, mats.steel, false);
        }
        var botSegLen = maxZ - gateMaxZ;
        if (botSegLen > 1) {
            tb(place, 'fence-segment', null, minX, fh * 0.5, gateMaxZ + (botSegLen * 0.5), ft, fh, botSegLen, mats.steel, false);
        }

        // Posts along north and south
        for (var px = minX; px <= maxX; px += postSpacing) {
            tb(place, 'fence-post', null, px, postH * 0.5, minZ, postW, postH, postW, mats.grayDark, false);
            tb(place, 'fence-post', null, px, postH * 0.5, maxZ, postW, postH, postW, mats.grayDark, false);
        }
        // Posts along east and west (skip gate)
        for (var pz = minZ; pz <= maxZ; pz += postSpacing) {
            tb(place, 'fence-post', null, maxX, postH * 0.5, pz, postW, postH, postW, mats.grayDark, false);
            if (pz < gateMinZ - 1 || pz > gateMaxZ + 1) {
                tb(place, 'fence-post', null, minX, postH * 0.5, pz, postW, postH, postW, mats.grayDark, false);
            }
        }
    }

    /* ── J: Gate Booth (at fence line, arm inline with fence) ── */

    function buildGate(fenceX, gateZ, place, mats) {
        // Booth sits at the fence line, to one side of the road gap (south side)
        var boothX = fenceX;
        // Arm: one end touches booth north edge, extends north across the gap
        var boothNorthEdge = gateZ + 3.2 - 1.0;
        tb(place, 'gate-arm', null, fenceX, 2.2, boothNorthEdge - 3.4 / 2, 0.15, 0.15, 3.4, mats.yellowWarn, false);
        tb(place, 'gate-booth', null, boothX, 1.25, gateZ + 3.2, 2.0, 2.5, 2.0, mats.grayLight, true);
        tb(place, 'gate-booth-roof', null, boothX, 2.48, gateZ + 3.2, 2.3, 0.2, 2.3, mats.grayDark, false);
        // Window faces west (toward approaching traffic)
        tb(place, 'gate-booth-window', null, boothX - 1.06, 1.6, gateZ + 3.2, 0.12, 0.7, 1.2, mats.glassBlue, false);
    }

    /* ── L: Utility Boxes & Pipes ── */

    function buildUtilityBox(cx, cz, place, mats) {
        tb(place, 'utility-box', null, cx, 0.6, cz, 1.0, 1.2, 0.8, mats.steel, false);
    }

    function buildPipeRun(cx, cz, length, place, mats) {
        tb(place, 'pipe-run', null, cx, 0.4, cz, 0.2, 0.2, length, mats.steel, false);
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
         *  South = maxZ (toward wall-street/urban)
         */

        var ctr = pt(rawBounds, 0.5, 0.5);
        var ox = ctr.x;
        var oz = ctr.z;

        // Fence perimeter (compound ~42x44, centered in cell)
        var fenceMinX = ox - 21;
        var fenceMaxX = ox + 21;
        var fenceMinZ = oz - 22;
        var fenceMaxZ = oz + 20;
        var gateZ = oz;  // gate centered on west wall

        // ── 1. Fence ──────────────────────────────────────
        buildFence(fenceMinX, fenceMaxX, fenceMinZ, fenceMaxZ, gateZ, 4.0, place, mats);
        buildGate(fenceMinX, gateZ, place, mats);

        // ── 2. Roads ──────────────────────────────────────
        // Asphalt driveway: from biome west edge to reactor building, replacing old entry road + west concrete
        var biomeWestX = rawBounds.minX;
        var driveEndX = ox + 4 - 9; // west face of reactor building
        var driveLen = driveEndX - biomeWestX;
        var driveCenterX = biomeWestX + driveLen * 0.5;
        tb(place, 'entry-road', null,
            driveCenterX, 0.04, gateZ, driveLen, 0.08, 4.0, mats.asphalt, false);
        // Internal east-west road (reactor eastward to towers only)
        var iewStartX = driveEndX;
        var iewEndX = ox + 21;
        var iewLen = iewEndX - iewStartX;
        tb(place, 'internal-road-ew', null,
            iewStartX + iewLen * 0.5, 0.05, gateZ, iewLen, 0.08, 3.0, mats.concrete, false);
        // Internal north-south road
        tb(place, 'internal-road-ns', null,
            ox, 0.06, oz, 3.0, 0.08, 36, mats.concrete, false);
        // Parking lot (in front of office, west side)
        tb(place, 'parking-lot', null,
            ox - 14, 0.04, oz + 11, 8, 0.08, 5, mats.asphalt, false);

        // ── 3. Cooling Towers (pushed hard against EAST wall) ──
        var towerEastX = rawBounds.maxX;
        var northTowerZ = oz - 10;
        var southTowerZ = oz + 10;
        var t1 = buildCoolingTower(towerEastX - 5, northTowerZ, 'north', place, mats, ctx);
        var t2 = buildCoolingTower(towerEastX - 5, southTowerZ, 'south', place, mats, ctx);

        // ── 4. Reactor Building (center-east, purple + 3 red domes) ──
        var reactor = buildReactorBuilding(
            ox + 4, oz, 18, 12, 7, 3, 'main', place, mats);

        // ── 5. Teal Building (northwest, Homer's workplace) ──
        buildTealBuilding(ox - 10, oz - 10, place, mats);

        // ── 6. Office Building (southwest, aligned with teal building X) ──
        buildOfficeBuilding(ox - 10, oz + 11, place, mats);

        // ── 7. Purple Warehouse (south of reactor) ──
        buildWarehouse(ox + 6, oz + 12, place, mats);

        // ── 8. Tank Cluster (NE of reactor) ──
        buildTankCluster(ox + 8, oz - 12, place, mats);

        // ── 9. Pylons (4 along south edge, east of center) ──
        for (var pi = 0; pi < 4; pi++) {
            buildPylon(ox + 4 + (pi * 6), oz + 18, place, mats);
        }

        // ── 10. Utility boxes & pipes (scattered industrial filler) ──
        buildUtilityBox(ox - 4, oz - 4, place, mats);
        buildUtilityBox(ox + 10, oz + 4, place, mats);
        buildUtilityBox(ox - 12, oz + 12, place, mats);
        buildUtilityBox(ox + 14, oz - 6, place, mats);
        buildUtilityBox(ox - 6, oz - 16, place, mats);
        buildUtilityBox(ox + 2, oz + 16, place, mats);
        buildPipeRun(ox + 6, oz - 5, 10, place, mats);
        buildPipeRun(ox - 4, oz - 8, 6, place, mats);
        buildPipeRun(ox + 12, oz + 6, 8, place, mats);

        // ── 11. Trees (ring outside fence, ~20 total) ──
        // Snap to grid cell centers (odd numbers: -25, -23, -21, ... 23, 25)
        function snapGrid(v) { return Math.round((v - 1) / 2) * 2 + 1; }

        var treePositions = [];
        // North tree line (4 trees, ~10 unit spacing)
        for (var tn = 0; tn < 4; tn++) {
            treePositions.push({ x: snapGrid(fenceMinX + 4 + (tn * 10)), z: snapGrid(fenceMinZ - 2), s: 0.7 + (tn % 3) * 0.3 });
        }
        // South tree line (4 trees, ~10 unit spacing)
        for (var ts = 0; ts < 4; ts++) {
            treePositions.push({ x: snapGrid(fenceMinX + 4 + (ts * 10)), z: snapGrid(fenceMaxZ + 2), s: 0.6 + (ts % 3) * 0.35 });
        }
        // East tree line (1 tree, skip cooling tower overlap area)
        treePositions.push({ x: snapGrid(fenceMaxX + 2), z: snapGrid(fenceMinZ + 24), s: 0.9 });
        // West tree line (skip gate area)
        for (var tw = 0; tw < 4; tw++) {
            var twz = fenceMinZ + 4 + (tw * 10);
            if (Math.abs(twz - gateZ) < 5) continue;
            treePositions.push({ x: snapGrid(fenceMinX - 2), z: snapGrid(twz), s: 0.6 + (tw % 3) * 0.3 });
        }
        // Corner trees (skip NE — cooling towers)
        treePositions.push({ x: snapGrid(fenceMinX - 3), z: snapGrid(fenceMinZ - 3), s: 1.0 });
        treePositions.push({ x: snapGrid(fenceMinX - 3), z: snapGrid(fenceMaxZ + 3), s: 0.8 });
        treePositions.push({ x: snapGrid(fenceMaxX + 3), z: snapGrid(fenceMaxZ + 3), s: 0.9 });

        for (var ti = 0; ti < treePositions.length; ti++) {
            var tp = treePositions[ti];
            buildTree(tp.x, tp.z, place, mats, tp.s);
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

    /* Register as alternate biome builder (does NOT overwrite current nuclear) */
    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns['nuclear-simpsons'] = buildSimpsonsNuclearQuadrant;
})();
