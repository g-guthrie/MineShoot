import { cloneMaterial } from './biome-utils.js';

/**
 * prefab-reactor-tank.js — Teal cylindrical reactor tank on a purple base.
 *
 * Inspired by the Simpsons power plant auxiliary building:
 * Purple/lavender rectangular base, large teal cylinder on top,
 * smaller teal cylinder cap, pipe stubs on sides, and a dark
 * cylindrical collar at the base of the tank.
 *
 * Can be loaded standalone in the biome preview or imported into a biome.
 */
(function () {
    'use strict';

    var MATS = null;
    var CYL_SEGS = 12;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            purpleBase:   lib.getLambert({ color: 0x9B7FBE }),
            purpleDark:   lib.getLambert({ color: 0x6B4F8E }),
            tealTank:     lib.getLambert({ color: 0x3A9A9A }),
            tealDark:     lib.getLambert({ color: 0x2A7A7A }),
            steel:        lib.getLambert({ color: 0x888899 }),
            grayDark:     lib.getLambert({ color: 0x666666 }),
            asphalt:      lib.getLambert({ color: 0x333333 }),
            concrete:     lib.getLambert({ color: 0xBBBBAA })
        };
        return MATS;
    }

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

    function tboxCollider(place, role, meta, x, y, z, w, h, d, options) {
        if (place && typeof place.addBoxCollider === 'function') {
            return place.addBoxCollider({
                x: x,
                y: y,
                z: z,
                w: w,
                h: h,
                d: d,
                collisionGroup: options && options.collisionGroup ? options.collisionGroup : 'reactor-tank',
                role: role,
                meta: meta
            });
        }
        return [];
    }

    function tcyl(place, role, meta, x, y, z, radiusTop, radiusBottom, height, options) {
        if (place && typeof place.addCylinderCollider === 'function') {
            return place.addCylinderCollider({
                x: x,
                y: y,
                z: z,
                radiusTop: radiusTop,
                radiusBottom: radiusBottom,
                height: height,
                radialSlices: options && options.radialSlices,
                heightSlices: options && options.heightSlices,
                collisionGroup: options && options.collisionGroup ? options.collisionGroup : 'reactor-tank',
                role: role,
                meta: meta
            });
        }
        return tboxCollider(place, role, meta, x, y, z, radiusTop * 2, height, radiusTop * 2, options);
    }

    function tdomeCollider(place, role, meta, x, baseY, z, radius, options) {
        if (place && typeof place.addDomeCollider === 'function') {
            return place.addDomeCollider({
                x: x,
                baseY: baseY,
                z: z,
                radius: radius,
                radialSlices: options && options.radialSlices,
                heightSlices: options && options.heightSlices,
                collisionGroup: options && options.collisionGroup ? options.collisionGroup : 'reactor-tank',
                role: role,
                meta: meta
            });
        }
        return tboxCollider(place, role, meta, x, baseY + (radius * 0.5), z, radius * 2, radius, radius * 2, options);
    }

    function buildDropPipe(place, mats, pipeTopY, pipeRoofY, px, pz, dirX, dirZ, opts) {
        var pipeR = 0.18;
        var stubOut = 0.48;
        var dropH = pipeTopY - pipeRoofY;
        var hGeo = new THREE.CylinderGeometry(pipeR, pipeR, stubOut, 6);
        var hx = px + dirX * stubOut * 0.5;
        var hz = pz + dirZ * stubOut * 0.5;
        if (dirX !== 0) {
            td(place, 'tank-pipe-h', null, hx, pipeTopY, hz, hGeo, mats.steel, 0, 0, Math.PI * 0.5);
        } else {
            td(place, 'tank-pipe-h', null, hx, pipeTopY, hz, hGeo, mats.steel, 0, Math.PI * 0.5, 0);
        }
        tboxCollider(place, 'tank-pipe-collider', {
            directionX: dirX,
            directionZ: dirZ,
            part: 'horizontal'
        }, hx, pipeTopY, hz, Math.abs(dirX) > 0 ? stubOut : (pipeR * 2.2), pipeR * 2.2, Math.abs(dirZ) > 0 ? stubOut : (pipeR * 2.2), opts);

        var elbowX = px + dirX * stubOut;
        var elbowZ = pz + dirZ * stubOut;
        var elbowGeo = new THREE.SphereGeometry(pipeR + 0.02, 6, 6);
        td(place, 'tank-pipe-elbow', null, elbowX, pipeTopY, elbowZ, elbowGeo, mats.steel);
        tboxCollider(place, 'tank-pipe-collider', {
            directionX: dirX,
            directionZ: dirZ,
            part: 'elbow'
        }, elbowX, pipeTopY, elbowZ, pipeR * 2.4, pipeR * 2.4, pipeR * 2.4, opts);

        var vGeo = new THREE.CylinderGeometry(pipeR, pipeR, dropH, 6);
        td(place, 'tank-pipe-v', null, elbowX, pipeTopY - dropH * 0.5, elbowZ, vGeo, mats.steel);
        tboxCollider(place, 'tank-pipe-collider', {
            directionX: dirX,
            directionZ: dirZ,
            part: 'vertical'
        }, elbowX, pipeTopY - dropH * 0.5, elbowZ, pipeR * 2.2, dropH, pipeR * 2.2, opts);
    }

    function buildReactorTankPrefab(place, options) {
        options = options || {};
        var mats = ensureMats();
        var ox = Number(options.x || 0);
        var oz = Number(options.z || 0);
        var colliderOptions = {
            collisionGroup: String(options.collisionGroup || 'reactor-tank')
        };

        // ── Purple rectangular base ──
        var baseW = 10;
        var baseH = 2;
        var baseD = 8;
        tb(place, 'tank-base', null, ox, baseH * 0.5, oz, baseW, baseH, baseD, mats.purpleBase, true);
        // Base roof slab
        tb(place, 'tank-base-roof', null, ox, baseH + 0.05, oz, baseW + 0.2, 0.15, baseD + 0.2, mats.purpleDark, true);

        // ── Main teal tank cylinder ──
        var tankR = 2.8;
        var tankH = 5;
        var tankY = baseH + tankH * 0.5;
        var tankGeo = new THREE.CylinderGeometry(tankR, tankR, tankH, CYL_SEGS);
        td(place, 'tank-main', null, ox, tankY, oz, tankGeo, mats.tealTank);
        tcyl(place, 'tank-main-collider', { part: 'main' }, ox, tankY, oz, tankR, tankR, tankH, Object.assign({ radialSlices: 7 }, colliderOptions));

        // ── Dark collar ring at tank base ──
        var collarGeo = new THREE.CylinderGeometry(tankR + 0.15, tankR + 0.15, 0.4, CYL_SEGS);
        td(place, 'tank-collar', null, ox, baseH + 0.2, oz, collarGeo, mats.grayDark);
        tcyl(place, 'tank-main-collider', { part: 'collar' }, ox, baseH + 0.2, oz, tankR + 0.15, tankR + 0.15, 0.4, Object.assign({ radialSlices: 7 }, colliderOptions));

        // ── Upper collar ring ──
        var upperCollarGeo = new THREE.CylinderGeometry(tankR + 0.1, tankR + 0.1, 0.3, CYL_SEGS);
        td(place, 'tank-upper-collar', null, ox, baseH + tankH - 0.1, oz, upperCollarGeo, mats.tealDark);
        tcyl(place, 'tank-main-collider', { part: 'upper-collar' }, ox, baseH + tankH - 0.1, oz, tankR + 0.1, tankR + 0.1, 0.3, Object.assign({ radialSlices: 7 }, colliderOptions));

        // ── Small top cylinder (cap/vent) ──
        var capR = 1.2;
        var capH = 2.0;
        var capY = baseH + tankH + capH * 0.5;
        var capGeo = new THREE.CylinderGeometry(capR, capR, capH, CYL_SEGS);
        td(place, 'tank-cap', null, ox, capY, oz, capGeo, mats.tealDark);
        tcyl(place, 'tank-main-collider', { part: 'cap' }, ox, capY, oz, capR, capR, capH, Object.assign({ radialSlices: 5 }, colliderOptions));

        // ── Top dome on cap ──
        var domeGeo = new THREE.SphereGeometry(capR, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
        td(place, 'tank-cap-dome', null, ox, baseH + tankH + capH, oz, domeGeo, mats.grayDark);
        tdomeCollider(place, 'tank-main-collider', { part: 'cap-dome' }, ox, baseH + tankH + capH, oz, capR, Object.assign({ radialSlices: 5, heightSlices: 4 }, colliderOptions));

        // ── Pipes: exit near top of tank, elbow down to purple roof ──
        var pipeTopY = baseH + tankH * 0.85; // near top of cylinder
        var pipeRoofY = baseH + 0.15;        // land on purple roof

        // 4 pipes at cardinal directions
        buildDropPipe(place, mats, pipeTopY, pipeRoofY, ox - tankR, oz, -1, 0, colliderOptions);  // West
        buildDropPipe(place, mats, pipeTopY, pipeRoofY, ox + tankR, oz, 1, 0, colliderOptions);   // East
        buildDropPipe(place, mats, pipeTopY, pipeRoofY, ox, oz - tankR, 0, -1, colliderOptions);  // North
        buildDropPipe(place, mats, pipeTopY, pipeRoofY, ox, oz + tankR, 0, 1, colliderOptions);   // South

        // ── Concrete foundation pad ──
        tb(place, 'tank-foundation', null, ox, 0.05, oz, baseW + 2, 0.1, baseD + 2, mats.concrete, true);

        return { structures: 1, tankPeakHeight: baseH + tankH + capH + capR };
    }

    function build(bounds, place, ctx) {
        var ox = (bounds.minX + bounds.maxX) * 0.5;
        var oz = (bounds.minZ + bounds.maxZ) * 0.5;
        return buildReactorTankPrefab(place, {
            x: ox,
            z: oz
        });
    }

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    runtime.WorldPrefabs = runtime.WorldPrefabs || {};
    runtime.WorldPrefabs.reactorTank = buildReactorTankPrefab;
    runtime.WorldQuadrants = runtime.WorldQuadrants || {};
    runtime.WorldQuadrants['prefab-reactor-tank'] = build;
})();
