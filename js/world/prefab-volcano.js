/**
 * prefab-volcano.js — Erupting volcano with lava flows, boulders, and smoke.
 *
 * Built from stacked cones, cylinders, and spheres. No imports, pure primitives.
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
            rockDark:     lib.getLambert({ color: 0x3D2B1F }),  // dark volcanic rock
            rockMid:      lib.getLambert({ color: 0x5C3D2E }),  // mid-tone rock
            rockLight:    lib.getLambert({ color: 0x6B4F3A }),  // lighter rock patches
            lavaHot:      lib.getLambert({ color: 0xFF4400, emissive: 0xFF2200, emissiveIntensity: 0.8 }),
            lavaGlow:     lib.getLambert({ color: 0xFF6600, emissive: 0xFF4400, emissiveIntensity: 0.6 }),
            lavaCool:     lib.getLambert({ color: 0xCC3300, emissive: 0x881100, emissiveIntensity: 0.3 }),
            craterBlack:  lib.getLambert({ color: 0x111111 }),
            smoke:        lib.getLambert({ color: 0x555555, transparent: true, opacity: 0.25 }),
            smokeLight:   lib.getLambert({ color: 0x888888, transparent: true, opacity: 0.15 }),
            ash:          lib.getLambert({ color: 0x2A2A2A }),
            boulder:      lib.getLambert({ color: 0x4A3A2A }),
            boulderDark:  lib.getLambert({ color: 0x332211 })
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

    function buildVolcanoPrefab(place, options) {
        options = options || {};
        var mats = ensureMats();
        var ox = Number(options.x || 0);
        var oz = Number(options.z || 0);

        // ── MAIN CONE: 6 tiers for smoother profile ──
        var tiers = [
            { radBot: 22, radTop: 18, h: 3 },   // broad skirt
            { radBot: 18, radTop: 14, h: 3.5 },  // lower slope
            { radBot: 14, radTop: 10, h: 3.5 },  // mid slope
            { radBot: 10, radTop: 7,  h: 4 },    // upper slope
            { radBot: 7,  radTop: 5,  h: 3.5 },  // steep upper
            { radBot: 5,  radTop: 4.2,h: 2.5 },  // summit cone
        ];
        var tierY = 0;
        var tierMats = [mats.rockMid, mats.rockMid, mats.rockDark, mats.rockDark, mats.rockLight, mats.rockDark];
        for (var ti = 0; ti < tiers.length; ti++) {
            var t = tiers[ti];
            var geo = new THREE.CylinderGeometry(t.radTop, t.radBot, t.h, CYL_SEGS);
            td(place, 'volcano-tier-' + ti, null, ox, tierY + t.h * 0.5, oz, geo, tierMats[ti]);
            tierY += t.h;
        }
        var craterY = tierY; // top of cone

        // ── CRATER ──
        // Rim — flared outward
        var rimH = 1.5;
        var rimGeo = new THREE.CylinderGeometry(5.5, 4.2, rimH, CYL_SEGS);
        td(place, 'volcano-rim', null, ox, craterY + rimH * 0.5, oz, rimGeo, mats.rockLight);

        // Inner rim lip — darker
        var lipGeo = new THREE.CylinderGeometry(4.8, 5.0, 0.6, CYL_SEGS);
        td(place, 'volcano-rim-lip', null, ox, craterY + 0.3, oz, lipGeo, mats.boulder);

        // Crater hole — black void
        var holeGeo = new THREE.CylinderGeometry(4.0, 3.0, 4, CYL_SEGS);
        td(place, 'volcano-crater-hole', null, ox, craterY - 1.5, oz, holeGeo, mats.craterBlack);

        // Lava pool inside crater
        var lavaGeo = new THREE.CylinderGeometry(3.5, 3.5, 1.2, CYL_SEGS);
        td(place, 'volcano-lava-pool', null, ox, craterY - 2.5, oz, lavaGeo, mats.lavaHot);

        // Lava glow haze above pool
        var hazeGeo = new THREE.CylinderGeometry(3.0, 3.5, 1.5, 8);
        td(place, 'volcano-lava-haze', null, ox, craterY - 0.5, oz, hazeGeo, mats.lavaGlow);

        // ── LAVA CHANNELS — 8 flows radiating from crater ──
        var flows = [
            // direction (dx,dz normalized), length, width, segment count
            { dx: -1.0, dz:  0.0, len: 20, w: 2.2, segs: 12 },  // W — main channel
            { dx: -0.7, dz: -0.7, len: 16, w: 1.6, segs: 10 },  // NW
            { dx:  0.0, dz: -1.0, len: 14, w: 1.3, segs: 9 },   // N
            { dx:  0.7, dz: -0.7, len: 12, w: 1.0, segs: 8 },   // NE — short
            { dx:  1.0, dz:  0.0, len: 15, w: 1.4, segs: 10 },  // E
            { dx:  0.7, dz:  0.7, len: 17, w: 1.8, segs: 11 },  // SE — big
            { dx:  0.0, dz:  1.0, len: 13, w: 1.1, segs: 8 },   // S
            { dx: -0.7, dz:  0.7, len: 15, w: 1.5, segs: 10 },  // SW
        ];

        for (var fi = 0; fi < flows.length; fi++) {
            var f = flows[fi];
            for (var si = 0; si < f.segs; si++) {
                var p = si / f.segs; // 0 at crater, 1 at base
                // Y follows the cone slope
                var segY = craterY * (1.0 - p) + 0.2;
                var dist = p * f.len;
                var segX = ox + f.dx * dist;
                var segZ = oz + f.dz * dist;
                // Width narrows toward base, with some variation
                var wiggle = 1.0 + Math.sin(si * 2.3) * 0.15;
                var segW = f.w * (1.0 - p * 0.4) * wiggle;
                var segD = (f.len / f.segs) * 1.4;
                // Hot → warm → cool gradient
                var lavaMat;
                if (p < 0.2) lavaMat = mats.lavaHot;
                else if (p < 0.45) lavaMat = mats.lavaGlow;
                else if (p < 0.7) lavaMat = mats.lavaCool;
                else lavaMat = mats.lavaCool;
                tb(place, 'volcano-lava-flow', { flowIndex: fi },
                    segX, segY, segZ, segW, 0.2, segD, lavaMat, false);
            }
        }

        // ── LAVA POOLS at base of major flows ──
        var pools = [
            { dx: -20, dz: 0, r: 3.5 },    // end of W flow
            { dx: 5, dz: 15, r: 2.8 },      // end of SE flow
            { dx: -11, dz: 11, r: 2.2 },    // end of SW flow
        ];
        for (var pi = 0; pi < pools.length; pi++) {
            var pp = pools[pi];
            var poolGeo = new THREE.CylinderGeometry(pp.r, pp.r + 0.5, 0.3, CYL_SEGS);
            td(place, 'volcano-base-pool', null, ox + pp.dx, 0.15, oz + pp.dz, poolGeo, mats.lavaHot);
            // Glow ring around pool
            var ringGeo = new THREE.CylinderGeometry(pp.r + 0.8, pp.r + 1.2, 0.12, CYL_SEGS);
            td(place, 'volcano-pool-ring', null, ox + pp.dx, 0.06, oz + pp.dz, ringGeo, mats.lavaGlow);
        }

        // ── SMOKE PLUME ──
        var smokeY = craterY + rimH;
        // Thick lower column
        var s1 = new THREE.CylinderGeometry(2.0, 3.5, 5, 8);
        td(place, 'volcano-smoke-1', null, ox, smokeY + 2.5, oz, s1, mats.smoke);
        // Mid billow
        var s2 = new THREE.CylinderGeometry(4.0, 2.0, 6, 8);
        td(place, 'volcano-smoke-2', null, ox - 0.8, smokeY + 8, oz + 0.5, s2, mats.smokeLight);
        // Upper drift (wind offset)
        var s3 = new THREE.CylinderGeometry(5.0, 3.5, 5, 8);
        td(place, 'volcano-smoke-3', null, ox - 2.5, smokeY + 13, oz + 1.0, s3, mats.smokeLight);
        // Topmost wisp
        var s4 = new THREE.CylinderGeometry(4.5, 4.8, 4, 8);
        td(place, 'volcano-smoke-4', null, ox - 4.0, smokeY + 17, oz + 1.5, s4, mats.smokeLight);
        // Ember glow column inside lower smoke
        var emberGeo = new THREE.CylinderGeometry(1.0, 2.0, 4, 6);
        td(place, 'volcano-ember', null, ox, smokeY + 2, oz, emberGeo, mats.lavaGlow);

        // ── ROCKY OUTCROPPINGS on cone sides ──
        var outcrops = [
            { dx: -8, dz: -4, y: 8, w: 3.0, h: 2.5, d: 2.0 },
            { dx: 6, dz: -7, y: 6, w: 2.5, h: 2.0, d: 2.5 },
            { dx: -3, dz: 9, y: 5, w: 2.0, h: 1.8, d: 3.0 },
            { dx: 9, dz: 3, y: 7, w: 2.8, h: 2.2, d: 1.8 },
            { dx: -6, dz: -8, y: 4, w: 1.8, h: 1.5, d: 2.2 },
            { dx: 4, dz: 8, y: 9, w: 2.2, h: 1.6, d: 2.0 },
        ];
        for (var oi = 0; oi < outcrops.length; oi++) {
            var o = outcrops[oi];
            var omat = oi % 2 === 0 ? mats.boulder : mats.boulderDark;
            tb(place, 'volcano-outcrop', null, ox + o.dx, o.y, oz + o.dz, o.w, o.h, o.d, omat, true);
        }

        // ── BOULDERS scattered around base ──
        var boulders = [
            { dx: -18, dz: -8, s: 2.8 }, { dx: -20, dz: 5, s: 2.0 },
            { dx: 16, dz: -12, s: 2.5 }, { dx: 14, dz: 10, s: 1.8 },
            { dx: -9, dz: 17, s: 2.2 },  { dx: 10, dz: -18, s: 1.9 },
            { dx: -22, dz: -1, s: 1.5 }, { dx: 20, dz: 3, s: 2.1 },
            { dx: -6, dz: -20, s: 1.6 }, { dx: 4, dz: 20, s: 1.8 },
            { dx: -15, dz: 14, s: 1.4 }, { dx: 18, dz: -6, s: 1.7 },
            // Smaller rubble ring
            { dx: -12, dz: -3, s: 0.9 }, { dx: 10, dz: -5, s: 0.8 },
            { dx: -5, dz: 11, s: 1.0 },  { dx: 7, dz: 7, s: 0.7 },
            { dx: -11, dz: 8, s: 0.8 },  { dx: 3, dz: -13, s: 0.9 },
        ];
        for (var bi = 0; bi < boulders.length; bi++) {
            var b = boulders[bi];
            var bw = b.s * (1.0 + (bi % 3) * 0.25);
            var bh = b.s * (0.6 + (bi % 2) * 0.4);
            var bd = b.s * (0.85 + ((bi + 1) % 3) * 0.2);
            var bmat = bi % 3 === 0 ? mats.boulderDark : mats.boulder;
            tb(place, 'volcano-boulder', null, ox + b.dx, bh * 0.5, oz + b.dz, bw, bh, bd, bmat, true);
        }

        // ── ASH FIELD ──
        var ashGeo = new THREE.CylinderGeometry(25, 26, 0.08, CYL_SEGS);
        td(place, 'volcano-ash-field', null, ox, 0.04, oz, ashGeo, mats.ash);

        return {
            structures: 1,
            peakHeight: craterY + rimH,
            smokeTop: smokeY + 19
        };
    }

    function build(bounds, place, ctx) {
        var ox = (bounds.minX + bounds.maxX) * 0.5;
        var oz = (bounds.minZ + bounds.maxZ) * 0.5;
        return buildVolcanoPrefab(place, { x: ox, z: oz });
    }

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    runtime.WorldPrefabs = runtime.WorldPrefabs || {};
    runtime.WorldPrefabs.volcano = buildVolcanoPrefab;
    runtime.WorldQuadrants = runtime.WorldQuadrants || {};
    runtime.WorldQuadrants['prefab-volcano'] = build;
})();
