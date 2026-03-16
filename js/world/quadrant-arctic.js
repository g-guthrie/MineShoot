import { pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-arctic.js - Arctic / ice biome quadrant builder.
 * Plug-and-play: call buildArcticQuadrant(bounds, place, ctx) to populate any quadrant.
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            rock:      lib.getLambert({ color: 0x6b8299 }),
            darkRock:  lib.getLambert({ color: 0x556677 }),
            snow:      lib.getLambert({ color: 0xe8f4ff }),
            snowDrift: lib.getLambert({ color: 0xdce8f2 }),
            ice:       lib.getLambert({ color: 0x9ad4f0, transparent: true, opacity: 0.85 }),
            iceDeep:   lib.getLambert({ color: 0x6ab8e0, transparent: true, opacity: 0.75 }),
            frost:     lib.getLambert({ color: 0xc8e8f8 }),
            crevasse:  lib.getLambert({ color: 0x1a2a3a }),
            aurora1:   lib.getBasic({ color: 0x44cc88, transparent: true, opacity: 0.06, side: THREE.DoubleSide }),
            aurora2:   lib.getBasic({ color: 0x4488cc, transparent: true, opacity: 0.05, side: THREE.DoubleSide }),
            frozenFall:lib.getLambert({ color: 0x88ccee, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
        };
        return MATS;
    }

    function edgeLerp(min, max, t) {
        return min + ((max - min) * Number(t || 0));
    }

    function sideBasis(side) {
        if (side === 'north') return { alongX: 1, alongZ: 0, inwardX: 0, inwardZ: 1 };
        if (side === 'south') return { alongX: 1, alongZ: 0, inwardX: 0, inwardZ: -1 };
        if (side === 'east') return { alongX: 0, alongZ: 1, inwardX: -1, inwardZ: 0 };
        return { alongX: 0, alongZ: 1, inwardX: 1, inwardZ: 0 };
    }

    function buildMountain(cx, cz, place, mats) {
        var tiers = [
            { dx: 0.0, dz: 0.0, w: 28.0, h: 3.0, d: 24.0, mat: mats.rock },
            { dx: -0.7, dz: 0.8, w: 24.2, h: 2.8, d: 20.4, mat: mats.rock },
            { dx: -0.6, dz: 1.3, w: 20.4, h: 2.6, d: 17.2, mat: mats.frost },
            { dx: 0.1, dz: 1.0, w: 16.4, h: 2.4, d: 14.0, mat: mats.snow },
            { dx: 0.8, dz: 0.6, w: 12.8, h: 2.2, d: 10.8, mat: mats.snow },
            { dx: 1.0, dz: 0.2, w: 9.4, h: 2.0, d: 8.0, mat: mats.frost }
        ];
        var routeShelves = [
            { x: cx + 7.8, y: 4.1, z: cz + 6.0, w: 6.8, h: 1.0, d: 4.6, mat: mats.snow },
            { x: cx + 5.9, y: 6.5, z: cz + 3.2, w: 6.2, h: 0.9, d: 4.2, mat: mats.snow },
            { x: cx + 3.5, y: 8.9, z: cz + 0.8, w: 5.8, h: 0.9, d: 4.0, mat: mats.frost },
            { x: cx + 1.1, y: 11.3, z: cz - 1.2, w: 5.2, h: 0.9, d: 4.0, mat: mats.snow },
            { x: cx + 0.8, y: 13.9, z: cz - 0.2, w: 4.8, h: 0.9, d: 3.8, mat: mats.snow }
        ];
        var topLevels = [
            { x: cx + 0.9, y: 15.8, z: cz - 0.2, w: 6.4, h: 1.2, d: 5.2, mat: mats.snow },
            { x: cx + 1.2, y: 17.9, z: cz - 0.2, w: 5.4, h: 1.2, d: 4.6, mat: mats.frost }
        ];
        var summit = { x: cx + 1.3, y: 20.0, z: cz - 0.2, w: 4.6, h: 1.0, d: 3.8 };
        var minRouteShelfDepth = Infinity;
        var minRouteShelfWidth = Infinity;
        var currentBaseY = 0;
        var peakHeight = 0;

        function markPeak(centerY, height) {
            peakHeight = Math.max(peakHeight, centerY + (height * 0.5));
        }

        function recordRouteShelf(width, depth) {
            minRouteShelfWidth = Math.min(minRouteShelfWidth, Number(width || 0));
            minRouteShelfDepth = Math.min(minRouteShelfDepth, Number(depth || 0));
        }

        for (var t = 0; t < tiers.length; t++) {
            var tier = tiers[t];
            var centerY = currentBaseY + (tier.h * 0.5);
            place.addBlock(cx + tier.dx, centerY, cz + tier.dz, tier.w, tier.h, tier.d, tier.mat, true);
            currentBaseY += tier.h;
            markPeak(centerY, tier.h);
        }

        // Broad route shelves keep the climb readable and give players room to stand.
        for (var s = 0; s < routeShelves.length; s++) {
            var shelf = routeShelves[s];
            place.addBlock(shelf.x, shelf.y, shelf.z, shelf.w, shelf.h, shelf.d, shelf.mat, true);
            recordRouteShelf(shelf.w, shelf.d);
        }
        place.addRamp(cx + 6.8, 2.8, cz + 8.6, 7.4, 1.2, 4.8, mats.rock, Math.PI * 0.70, -0.16, true);
        place.addRamp(cx + 5.0, 5.1, cz + 5.0, 6.2, 1.0, 4.2, mats.frost, Math.PI * 0.76, -0.15, true);
        place.addRamp(cx + 2.8, 7.4, cz + 2.5, 5.6, 0.9, 3.8, mats.frost, Math.PI * 0.80, -0.14, true);
        place.addRamp(cx + 0.8, 9.8, cz + 0.6, 5.0, 0.9, 3.6, mats.snow, Math.PI * 0.82, -0.14, true);
        place.addRamp(cx + 0.7, 12.4, cz + 0.8, 4.8, 0.8, 3.4, mats.snow, Math.PI * 0.66, -0.12, true);

        for (var tl = 0; tl < topLevels.length; tl++) {
            var topLevel = topLevels[tl];
            place.addBlock(topLevel.x, topLevel.y, topLevel.z, topLevel.w, topLevel.h, topLevel.d, topLevel.mat, true);
            markPeak(topLevel.y, topLevel.h);
        }

        place.addBlock(summit.x, summit.y, summit.z, summit.w, summit.h, summit.d, mats.snow, true);
        markPeak(summit.y, summit.h);

        // Summit texture stays broad instead of turning into a needle.
        place.addBlock(cx + 1.8, 20.1, cz - 0.4, 1.4, 0.4, 1.1, mats.ice, false);
        place.addBlock(cx + 0.6, 20.0, cz + 0.3, 1.1, 0.3, 0.9, mats.frost, false);

        // Crevasse slashes.
        place.addBlock(cx + 6.4, 3.4, cz + 0.9, 0.35, 2.8, 5.0, mats.crevasse, false);
        place.addBlock(cx - 5.6, 4.4, cz - 1.2, 4.2, 1.7, 0.35, mats.crevasse, false);
        place.addBlock(cx + 2.6, 6.1, cz - 4.2, 3.0, 1.1, 0.3, mats.crevasse, false);

        // Frozen waterfall shortened to match the lower eastern face.
        place.addBlock(cx + 9.4, 6.8, cz + 0.2, 1.1, 9.2, 2.0, mats.ice, false);
        var fallGeo = new THREE.PlaneGeometry(3.8, 10.6);
        place.addDecor(cx + 9.6, 6.9, cz + 0.3, fallGeo, mats.frozenFall, 0, 0, 0);

        return {
            peakHeight: peakHeight,
            baseWidth: tiers[0].w,
            baseDepth: tiers[0].d,
            terraceCount: tiers.length,
            summitWidth: summit.w,
            summitDepth: summit.d,
            minRouteShelfWidth: minRouteShelfWidth,
            minRouteShelfDepth: minRouteShelfDepth
        };
    }

    function addIceSpire(x, z, h, place, mats, ctx, options) {
        var height = Math.max(2.0, h);
        // Tapered: 3 stacked segments of decreasing width
        var baseW = Math.max(0.9, Number((options && options.baseW) || 1.1));
        var seg1H = height * 0.45;
        var seg2H = height * 0.32;
        var seg3H = height * 0.23;

        place.addBlock(x, seg1H * 0.5, z, baseW, seg1H, baseW, mats.iceDeep, true);
        place.addBlock(x, seg1H + seg2H * 0.5, z, baseW * 0.7, seg2H, baseW * 0.7, mats.ice, false);
        var topMesh = place.addBlock(x, seg1H + seg2H + seg3H * 0.5, z, baseW * 0.4, seg3H, baseW * 0.4, mats.frost, false);

        // Shimmer on the top segment
        ctx.addIceShimmer({ material: mats.ice, baseOpacity: 0.85, phase: x * 1.7 + z * 2.3 });

        return topMesh;
    }

    function buildBorderIciclePack(bounds, pack, place, mats, ctx) {
        var basis = sideBasis(pack.side);
        var blockW = (pack.side === 'north' || pack.side === 'south') ? 4.8 : 2.6;
        var blockD = (pack.side === 'north' || pack.side === 'south') ? 2.6 : 4.8;
        var primaryBaseW = 1.2;
        var centerX = (pack.side === 'east')
            ? bounds.maxX - (blockW * 0.5)
            : (pack.side === 'west')
                ? bounds.minX + (blockW * 0.5)
                : edgeLerp(bounds.minX, bounds.maxX, pack.t);
        var centerZ = (pack.side === 'south')
            ? bounds.maxZ - (blockD * 0.5)
            : (pack.side === 'north')
                ? bounds.minZ + (blockD * 0.5)
                : edgeLerp(bounds.minZ, bounds.maxZ, pack.t);
        var primaryX = (pack.side === 'east')
            ? bounds.maxX - (primaryBaseW * 0.5)
            : (pack.side === 'west')
                ? bounds.minX + (primaryBaseW * 0.5)
                : centerX;
        var primaryZ = (pack.side === 'south')
            ? bounds.maxZ - (primaryBaseW * 0.5)
            : (pack.side === 'north')
                ? bounds.minZ + (primaryBaseW * 0.5)
                : centerZ;
        var companions = Array.isArray(pack.companions) ? pack.companions : [];

        place.addBlock(centerX, 0.18, centerZ, blockW, 0.36, blockD, mats.iceDeep, false);
        place.addBlock(
            centerX + (basis.inwardX * 0.18),
            0.3,
            centerZ + (basis.inwardZ * 0.18),
            blockW * 0.72,
            0.12,
            blockD * 0.58,
            mats.frost,
            false
        );

        addIceSpire(primaryX, primaryZ, pack.primaryH, place, mats, ctx, { baseW: primaryBaseW });
        for (var i = 0; i < companions.length; i++) {
            var companion = companions[i];
            addIceSpire(
                primaryX + (basis.alongX * Number(companion.along || 0)) + (basis.inwardX * Number(companion.inset || 0)),
                primaryZ + (basis.alongZ * Number(companion.along || 0)) + (basis.inwardZ * Number(companion.inset || 0)),
                companion.h,
                place,
                mats,
                ctx
            );
        }

        return 1 + companions.length;
    }

    function addGlacierPatch(cx, cz, width, depth, spires, place, mats, ctx) {
        var safeWidth = Math.max(2.2, Number(width || 0));
        var safeDepth = Math.max(1.8, Number(depth || 0));
        var items = Array.isArray(spires) ? spires : [];
        place.addBlock(cx, 0.16, cz, safeWidth, 0.32, safeDepth, mats.iceDeep, false);
        place.addBlock(cx + (safeWidth * 0.04), 0.28, cz - (safeDepth * 0.05), safeWidth * 0.66, 0.12, safeDepth * 0.6, mats.frost, false);

        for (var i = 0; i < items.length; i++) {
            var spire = items[i];
            addIceSpire(cx + Number(spire.dx || 0), cz + Number(spire.dz || 0), spire.h, place, mats, ctx);
        }

        return items.length;
    }

    function addIceBoulder(x, z, place, mats) {
        place.addBlock(x, 0.7, z, 2.2, 1.4, 1.8, mats.rock, true);
        place.addBlock(x + 0.2, 1.5, z - 0.1, 1.4, 0.6, 1.2, mats.frost, false);
        // Snow cap on top
        place.addBlock(x, 1.92, z, 1.8, 0.2, 1.5, mats.snow, false);
    }

    function addFrozenPool(x, z, place, mats) {
        place.addBlock(x, -0.08, z, 5.0, 0.16, 4.0, mats.ice, false);
        // Frost ring around the pool edge
        place.addBlock(x, 0.04, z, 5.6, 0.04, 4.6, mats.frost, false);
    }

    function addSnowDrift(x, z, w, d, place, mats) {
        place.addBlock(x, 0.12, z, w, 0.24, d, mats.snowDrift, false);
        place.addBlock(x + w * 0.12, 0.22, z - d * 0.1, w * 0.6, 0.14, d * 0.5, mats.snow, false);
    }

    function buildIceArch(cx, cz, place, mats, ctx) {
        // Two tapered spires with a connecting ice bridge
        addIceSpire(cx - 2.5, cz, 4.2, place, mats, ctx);
        addIceSpire(cx + 2.5, cz, 3.8, place, mats, ctx);
        // Horizontal ice bridge connecting the tops
        place.addBlock(cx, 3.5, cz, 5.5, 0.5, 0.8, mats.ice, false);
        place.addBlock(cx, 3.82, cz, 4.0, 0.2, 0.5, mats.frost, false);
        return 2;
    }

    function buildIceShelf(cx, cz, place, mats, ctx) {
        place.addBlock(cx, 0.35, cz, 5.8, 0.7, 3.0, mats.frost, true);
        place.addBlock(cx + 0.4, 0.74, cz - 0.1, 4.6, 0.16, 2.1, mats.ice, false);

        addIceSpire(cx - 1.9, cz + 0.8, 2.8, place, mats, ctx);
        addIceSpire(cx + 2.1, cz - 0.6, 2.4, place, mats, ctx);
        place.addBlock(cx + 2.8, 0.24, cz + 0.9, 0.7, 0.48, 0.6, mats.darkRock, false);
        return 2;
    }

    function buildIceOverhang(cx, cz, place, mats, ctx) {
        addIceSpire(cx - 3.8, cz + 0.4, 5.0, place, mats, ctx);
        addIceSpire(cx + 3.2, cz - 0.3, 4.6, place, mats, ctx);
        place.addBlock(cx - 0.2, 4.4, cz, 8.8, 0.7, 1.3, mats.iceDeep, true);
        place.addBlock(cx + 0.8, 5.0, cz - 0.2, 5.0, 0.4, 1.0, mats.frost, false);
        place.addRamp(cx + 2.0, 2.0, cz + 1.6, 3.0, 0.9, 4.2, mats.frost, 0.92, -0.2, true);
        place.addBlock(cx - 1.8, 0.4, cz - 1.4, 2.6, 0.8, 1.7, mats.darkRock, true);
        place.addBlock(cx + 3.1, 0.28, cz + 1.2, 0.8, 0.56, 0.7, mats.darkRock, false);
        return 2;
    }

    function buildArcticQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var rawBounds = (ctx && ctx.rawBounds) ? ctx.rawBounds : bounds;
        var center = pt(bounds, 0.46, 0.46);
        var crystalCount = 0;
        var groundSpireCount = 0;
        var edgeTouchSides = { north: 0, east: 0, south: 0, west: 0 };
        var borderPackLabels = [];

        var mountain = buildMountain(center.x, center.z, place, mats);
        ctx.addExclusion(center.x, center.z, 14.2);

        var overhangPt = pt(bounds, 0.76, 0.28);
        crystalCount += buildIceOverhang(overhangPt.x, overhangPt.z, place, mats, ctx);
        ctx.addExclusion(overhangPt.x, overhangPt.z, 5.2);

        var borderPacks = [
            {
                label: 'north-west-pack',
                side: 'north',
                t: 0.16,
                primaryH: 4.8,
                companions: [
                    { along: -1.3, inset: 1.5, h: 3.4 },
                    { along: 1.5, inset: 2.5, h: 2.9 }
                ]
            },
            {
                label: 'north-east-pack',
                side: 'north',
                t: 0.82,
                primaryH: 4.4,
                companions: [
                    { along: -1.5, inset: 1.6, h: 3.2 },
                    { along: 1.2, inset: 2.4, h: 2.8 }
                ]
            },
            {
                label: 'east-north-pack',
                side: 'east',
                t: 0.24,
                primaryH: 4.9,
                companions: [
                    { along: -1.4, inset: 1.5, h: 3.6 },
                    { along: 1.4, inset: 2.3, h: 3.0 }
                ]
            },
            {
                label: 'east-south-pack',
                side: 'east',
                t: 0.78,
                primaryH: 4.5,
                companions: [
                    { along: -1.3, inset: 1.5, h: 3.2 },
                    { along: 1.6, inset: 2.5, h: 2.9 }
                ]
            },
            {
                label: 'south-east-pack',
                side: 'south',
                t: 0.84,
                primaryH: 4.7,
                companions: [
                    { along: -1.4, inset: 1.4, h: 3.5 },
                    { along: 1.2, inset: 2.3, h: 3.0 }
                ]
            },
            {
                label: 'south-west-pack',
                side: 'south',
                t: 0.18,
                primaryH: 4.3,
                companions: [
                    { along: -1.2, inset: 1.4, h: 3.1 },
                    { along: 1.5, inset: 2.4, h: 2.8 }
                ]
            },
            {
                label: 'west-south-pack',
                side: 'west',
                t: 0.74,
                primaryH: 4.6,
                companions: [
                    { along: -1.3, inset: 1.5, h: 3.4 },
                    { along: 1.4, inset: 2.2, h: 3.0 }
                ]
            },
            {
                label: 'west-north-pack',
                side: 'west',
                t: 0.26,
                primaryH: 5.0,
                companions: [
                    { along: -1.4, inset: 1.5, h: 3.6 },
                    { along: 1.2, inset: 2.3, h: 3.2 }
                ]
            }
        ];

        for (var bp = 0; bp < borderPacks.length; bp++) {
            var pack = borderPacks[bp];
            var packCount = buildBorderIciclePack(rawBounds, pack, place, mats, ctx);
            crystalCount += packCount;
            groundSpireCount += packCount;
            edgeTouchSides[pack.side] += 1;
            borderPackLabels.push(pack.label);
        }

        var interiorSpireGroups = [
            {
                label: 'inner-west-cluster',
                u: 0.34, v: 0.32, w: 3.6, d: 2.4,
                spires: [
                    { dx: -1.0, dz: 0.5, h: 3.2 },
                    { dx: 1.0, dz: -0.6, h: 2.8 }
                ]
            },
            {
                label: 'inner-east-cluster',
                u: 0.66, v: 0.34, w: 3.4, d: 2.4,
                spires: [
                    { dx: -0.8, dz: 0.4, h: 3.0 },
                    { dx: 0.9, dz: -0.7, h: 2.7 }
                ]
            },
            {
                label: 'inner-south-cluster',
                u: 0.54, v: 0.72, w: 3.8, d: 2.6,
                spires: [
                    { dx: -1.1, dz: -0.4, h: 3.1 },
                    { dx: 1.0, dz: 0.6, h: 2.9 }
                ]
            }
        ];
        for (var ig = 0; ig < interiorSpireGroups.length; ig++) {
            var group = interiorSpireGroups[ig];
            var groupPt = pt(bounds, group.u, group.v);
            var groupCount = addGlacierPatch(groupPt.x, groupPt.z, group.w, group.d, group.spires, place, mats, ctx);
            crystalCount += groupCount;
            groundSpireCount += groupCount;
        }

        // Ice arch on the southern side to create a lower secondary landmark.
        var archPt = pt(bounds, 0.34, 0.72);
        crystalCount += buildIceArch(archPt.x, archPt.z, place, mats, ctx);
        ctx.addExclusion(archPt.x, archPt.z, 4.0);

        // Snow-capped boulders
        var boulders = [
            { u: 0.28, v: 0.36 },
            { u: 0.74, v: 0.58 },
            { u: 0.42, v: 0.80 },
            { u: 0.62, v: 0.18 },
            { u: 0.56, v: 0.68 }
        ];
        for (var b = 0; b < boulders.length; b++) {
            var bp = pt(bounds, boulders[b].u, boulders[b].v);
            addIceBoulder(bp.x, bp.z, place, mats);
        }

        // Frozen pool with frost ring
        var poolPt = pt(bounds, 0.70, 0.78);
        addFrozenPool(poolPt.x, poolPt.z, place, mats);

        // Wind-carved ice shelf gives the biome a lower landmark, not just tall forms.
        var shelfPt = pt(bounds, 0.26, 0.28);
        crystalCount += buildIceShelf(shelfPt.x, shelfPt.z, place, mats, ctx);
        ctx.addExclusion(shelfPt.x, shelfPt.z, 4.2);

        // Snow drifts and shelves create grouped approach paths.
        var drifts = [
            { u: 0.08, v: 0.10, w: 3.2, d: 1.8 },
            { u: 0.42, v: 0.08, w: 3.8, d: 2.0 },
            { u: 0.92, v: 0.18, w: 3.0, d: 1.8 },
            { u: 0.10, v: 0.54, w: 3.2, d: 2.8 },
            { u: 0.90, v: 0.46, w: 4.4, d: 2.6 },
            { u: 0.18, v: 0.92, w: 3.4, d: 2.0 },
            { u: 0.56, v: 0.94, w: 4.8, d: 2.2 },
            { u: 0.94, v: 0.78, w: 3.2, d: 1.9 }
        ];
        for (var d = 0; d < drifts.length; d++) {
            var dp = pt(rawBounds, drifts[d].u, drifts[d].v);
            addSnowDrift(dp.x, dp.z, drifts[d].w, drifts[d].d, place, mats);
        }

        // Aurora planes (high above, very transparent, suggesting northern lights)
        var auroraGeo1 = new THREE.PlaneGeometry(30, 6);
        place.addDecor(center.x - 5, 22, center.z - 8, auroraGeo1, mats.aurora1, 0.3, -0.8, 0.1);

        var auroraGeo2 = new THREE.PlaneGeometry(25, 5);
        place.addDecor(center.x + 8, 25, center.z + 5, auroraGeo2, mats.aurora2, -0.2, -0.6, -0.15);

        // Small scattered ice fragments near clusters
        var fragments = [
            { u: 0.03, v: 0.08, w: 0.46, h: 0.18, d: 0.32 },
            { u: 0.30, v: 0.03, w: 0.48, h: 0.18, d: 0.34 },
            { u: 0.78, v: 0.02, w: 0.46, h: 0.18, d: 0.32 },
            { u: 0.98, v: 0.20, w: 0.46, h: 0.18, d: 0.32 },
            { u: 0.97, v: 0.68, w: 0.50, h: 0.2, d: 0.34 },
            { u: 0.82, v: 0.98, w: 0.48, h: 0.18, d: 0.34 },
            { u: 0.22, v: 0.97, w: 0.50, h: 0.2, d: 0.36 },
            { u: 0.02, v: 0.78, w: 0.46, h: 0.18, d: 0.32 },
            { u: 0.28, v: 0.18, w: 0.55, h: 0.2, d: 0.4 },
            { u: 0.72, v: 0.18, w: 0.52, h: 0.2, d: 0.36 },
            { u: 0.22, v: 0.84, w: 0.54, h: 0.22, d: 0.4 },
            { u: 0.76, v: 0.84, w: 0.48, h: 0.2, d: 0.34 }
        ];
        for (var fi = 0; fi < fragments.length; fi++) {
            var fr = fragments[fi];
            var frp = pt(rawBounds, fr.u, fr.v);
            place.addBlock(frp.x, fr.h * 0.5, frp.z, fr.w, fr.h, fr.d, mats.ice, false);
        }

        return {
            crystals: crystalCount,
            drifts: drifts.length,
            foothillCrystals: fragments.length,
            foothillDrifts: 0,
            groundSpires: groundSpireCount,
            glacierPatches: borderPacks.length,
            interiorSpireGroups: interiorSpireGroups.length,
            peakHeight: mountain.peakHeight,
            terraceCount: mountain.terraceCount,
            mountainBaseWidth: mountain.baseWidth,
            mountainBaseDepth: mountain.baseDepth,
            summitWidth: mountain.summitWidth,
            summitDepth: mountain.summitDepth,
            minRouteShelfWidth: mountain.minRouteShelfWidth,
            minRouteShelfDepth: mountain.minRouteShelfDepth,
            edgeTouchSides: edgeTouchSides,
            borderPackLabels: borderPackLabels
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.arctic = buildArcticQuadrant;
})();
