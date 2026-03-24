/**
 * prefab-fuel-spheres.js — Two large fuel storage spheres on foundation discs.
 *
 * Stripped to essentials: concrete pad, base disc, floating white orb.
 * Can be loaded standalone in the biome preview or imported into a biome.
 */
(function () {
    'use strict';

    var MATS = null;
    var CYL_SEGS = 12;
    var PREFAB_SCALE = 0.7;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            sphereBody:   lib.getLambert({ color: 0xFFFFFF }),
            band:         lib.getLambert({ color: 0xDDDDCC }),
            steel:        lib.getLambert({ color: 0x888899 }),
            grayDark:     lib.getLambert({ color: 0x555555 }),
            concrete:     lib.getLambert({ color: 0xBBBBAA })
        };
        return MATS;
    }

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

    function tboxCollider(place, role, meta, x, y, z, w, h, d, options) {
        if (place && typeof place.addBoxCollider === 'function') {
            return place.addBoxCollider({
                x: x, y: y, z: z, w: w, h: h, d: d,
                collisionGroup: options && options.collisionGroup ? options.collisionGroup : 'fuel-spheres',
                role: role, meta: meta
            });
        }
        return [];
    }

    function buildOneSphere(place, mats, cx, cz, radius, colliderOpts) {
        // Base disc on ground
        var discH = 0.4 * PREFAB_SCALE;
        var discR = radius * 1.2;
        var discGeo = new THREE.CylinderGeometry(discR, discR + (0.2 * PREFAB_SCALE), discH, CYL_SEGS);
        td(place, 'fuel-base-disc', null, cx, discH * 0.5, cz, discGeo, mats.grayDark);
        tboxCollider(place, 'fuel-disc-collider', null,
            cx, discH * 0.5, cz, discR * 2, discH, discR * 2, colliderOpts);

        // Sphere floating above disc
        var sphereY = discH + radius;
        var sphereGeo = new THREE.SphereGeometry(radius, 10, 8);
        td(place, 'fuel-sphere', null, cx, sphereY, cz, sphereGeo, mats.sphereBody);

        // Equator band
        var bandGeo = new THREE.TorusGeometry(radius * 0.98, 0.12 * PREFAB_SCALE, 6, 16);
        td(place, 'fuel-sphere-band', null, cx, sphereY, cz, bandGeo, mats.band, 0, Math.PI * 0.5, 0);

        // Box collider for sphere
        var bs = radius * 1.6;
        tboxCollider(place, 'fuel-sphere-collider', { part: 'sphere' },
            cx, sphereY, cz, bs, bs, bs, colliderOpts);

        return { centerY: sphereY };
    }

    function buildFuelSpheresPrefab(place, options) {
        options = options || {};
        var mats = ensureMats();
        var ox = Number(options.x || 0);
        var oz = Number(options.z || 0);
        var colliderOpts = {
            collisionGroup: String(options.collisionGroup || 'fuel-spheres')
        };

        // Left sphere (smaller)
        var leftR = 4.2 * PREFAB_SCALE;
        var leftCX = ox - (5 * PREFAB_SCALE);
        var left = buildOneSphere(place, mats, leftCX, oz, leftR, colliderOpts);

        // Right sphere (larger)
        var rightR = 5.0 * PREFAB_SCALE;
        var rightCX = ox + (6 * PREFAB_SCALE);
        var right = buildOneSphere(place, mats, rightCX, oz, rightR, colliderOpts);

        // Concrete foundation pad
        var totalW = (rightCX + rightR * 1.5) - (leftCX - leftR * 1.5);
        var totalD = leftR * 2.8;
        var foundationH = 0.1 * PREFAB_SCALE;
        tb(place, 'fuel-foundation', null, ox, foundationH * 0.5, oz, totalW, foundationH, totalD, mats.concrete, true);

        return {
            structures: 2,
            peakHeight: left.centerY + leftR
        };
    }

    function build(bounds, place, ctx) {
        var ox = (bounds.minX + bounds.maxX) * 0.5;
        var oz = (bounds.minZ + bounds.maxZ) * 0.5;
        return buildFuelSpheresPrefab(place, { x: ox, z: oz });
    }

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    runtime.WorldPrefabs = runtime.WorldPrefabs || {};
    runtime.WorldPrefabs.fuelSpheres = buildFuelSpheresPrefab;
    runtime.WorldQuadrants = runtime.WorldQuadrants || {};
    runtime.WorldQuadrants['prefab-fuel-spheres'] = build;
})();
