/**
 * intersection-builder.js - World-owned seam/intersection layout primitives.
 * Keeps separators, sockets, and centerpiece builders separate from biome modules.
 */
(function () {
    'use strict';

    var runtime = (globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {});
    var ns = (runtime.WorldIntersections = runtime.WorldIntersections || {});

    function createSeamSpec(overrides) {
        var spec = overrides || {};
        var armWidth = Number(spec.armWidth);
        var height = Number(spec.height);
        if (!(armWidth > 0)) armWidth = 1.06;
        if (!(height > 0)) height = 0.16;
        return {
            armWidth: armWidth,
            halfWidth: armWidth * 0.5,
            height: height
        };
    }

    function addSeamCross(place, cx, cz, span, seamSpec, material) {
        if (!place || typeof place.addBlock !== 'function') return;
        place.addBlock(cx, seamSpec.height * 0.5, cz, seamSpec.armWidth, seamSpec.height, span, material, false);
        place.addBlock(cx, seamSpec.height * 0.5, cz, span, seamSpec.height, seamSpec.armWidth, material, false);
    }

    function buildFourBiomeObelisk(ctx) {
        if (!ctx || !ctx.place || !ctx.materialLibrary) return null;

        var place = ctx.place;
        var matLib = ctx.materialLibrary;
        var centerX = Number(ctx.centerX || 0);
        var centerZ = Number(ctx.centerZ || 0);
        var seamSpec = createSeamSpec(ctx.seamSpec);
        var seamHalf = seamSpec.halfWidth;
        var seamTop = seamSpec.height;

        function addCenterBlock(offsetX, y, offsetZ, w, h, d, material) {
            place.addBlock(centerX + offsetX, y, centerZ + offsetZ, w, h, d, material, true);
        }

        function addCenterRect(minX, maxX, minZ, maxZ, y, h, material) {
            addCenterBlock(
                (minX + maxX) * 0.5,
                y,
                (minZ + maxZ) * 0.5,
                maxX - minX,
                h,
                maxZ - minZ,
                material
            );
        }

        var mats = {
            iceFrost: matLib.getLambert({ color: 0xc8e8f8 }),
            iceAccent: matLib.getLambert({ color: 0x9ad4f0, transparent: true, opacity: 0.75 }),
            snowDrift: matLib.getLambert({ color: 0xdce8f2 }),
            concreteBarrier: matLib.getLambert({ color: 0x6a7078 }),
            concreteLt: matLib.getLambert({ color: 0x8a9098 }),
            chainLink: matLib.getLambert({ color: 0x3a3e44 }),
            sandstone: matLib.getLambert({ color: 0xc49a5c }),
            mesaFrag: matLib.getLambert({ color: 0xb07842 }),
            darkRock: matLib.getLambert({ color: 0x8a6b4a }),
            mossyStone: matLib.getLambert({ color: 0x3d4a32 }),
            jungleStone: matLib.getLambert({ color: 0x4a5040 }),
            jungleVine: matLib.getLambert({ color: 0x1e5a1e }),
            log: matLib.getLambert({ color: 0x5c3d1e })
        };

        // Base ring: each biome reaches the seam edge without entering the shared cross.
        addCenterRect(-4.8, -2.8, -4.8, -2.7, seamTop * 0.5, seamTop, mats.iceFrost);
        addCenterRect(-2.8, -seamHalf, -4.2, -2.2, seamTop * 0.5, seamTop, mats.iceFrost);
        addCenterRect(-4.1, -seamHalf, -2.2, -seamHalf, seamTop * 0.5, seamTop, mats.snowDrift);

        addCenterRect(2.1, 4.8, -4.8, -2.7, seamTop * 0.5, seamTop, mats.concreteBarrier);
        addCenterRect(seamHalf, 2.1, -3.4, -1.8, seamTop * 0.5, seamTop, mats.concreteBarrier);
        addCenterRect(seamHalf, 1.8, -1.8, -seamHalf, seamTop * 0.5, seamTop, mats.concreteLt);

        addCenterRect(-4.8, -2.4, 2.1, 4.8, seamTop * 0.5, seamTop, mats.sandstone);
        addCenterRect(-2.4, -seamHalf, seamHalf, 3.0, seamTop * 0.5, seamTop, mats.sandstone);
        addCenterRect(-3.5, -seamHalf, 3.0, 4.8, seamTop * 0.5, seamTop, mats.mesaFrag);

        addCenterRect(2.0, 4.8, 2.0, 4.9, seamTop * 0.5, seamTop, mats.jungleStone);
        addCenterRect(seamHalf, 2.4, seamHalf, 3.1, seamTop * 0.5, seamTop, mats.mossyStone);
        addCenterRect(2.4, 4.3, seamHalf, 2.0, seamTop * 0.5, seamTop, mats.jungleStone);

        // Inner rise: each slice can fill only its own quarter of the seam volume.
        addCenterRect(-3.1, -0.75, -3.7, -0.75, 0.7, 1.05, mats.iceFrost);
        addCenterRect(-1.85, 0.0, -2.0, 0.0, 1.55, 0.95, mats.iceAccent);
        addCenterRect(-0.95, 0.0, -1.05, 0.0, 2.55, 1.15, mats.iceAccent);
        addCenterBlock(-1.35, 3.9, -1.0, 0.42, 1.45, 0.42, mats.iceAccent);
        addCenterBlock(-0.72, 4.35, -1.42, 0.28, 0.9, 0.28, mats.iceAccent);
        addCenterBlock(-1.0, 3.75, -0.65, 0.8, 0.2, 0.65, mats.snowDrift);

        addCenterRect(0.75, 3.6, -3.1, -0.75, 0.62, 0.9, mats.concreteBarrier);
        addCenterRect(0.0, 2.25, -1.75, 0.0, 1.35, 0.95, mats.concreteBarrier);
        addCenterRect(0.0, 1.15, -1.0, 0.0, 2.3, 1.0, mats.concreteLt);
        addCenterRect(2.2, 3.8, -1.5, -0.72, 1.72, 0.28, mats.concreteLt);
        addCenterRect(0.9, 1.06, -1.62, -0.18, 3.7, 1.55, mats.chainLink);
        addCenterRect(0.9, 1.06, -1.62, -0.18, 4.5, 0.08, mats.chainLink);
        addCenterBlock(2.05, 2.85, -1.15, 0.9, 0.12, 0.12, mats.concreteLt);

        addCenterRect(-3.3, -0.78, 0.78, 3.4, 0.74, 1.15, mats.sandstone);
        addCenterRect(-2.0, 0.0, 0.95, 2.35, 1.75, 1.0, mats.mesaFrag);
        addCenterRect(-0.98, 0.0, 1.1, 1.9, 2.78, 1.15, mats.darkRock);
        addCenterBlock(-2.45, 2.0, 1.05, 0.88, 0.52, 0.78, mats.mesaFrag);
        addCenterBlock(-1.48, 4.05, 1.42, 0.52, 1.12, 0.52, mats.darkRock);
        addCenterBlock(-0.7, 3.32, 0.92, 0.42, 0.18, 0.82, mats.sandstone);

        addCenterRect(0.78, 3.4, 0.78, 3.2, 0.72, 1.2, mats.jungleStone);
        addCenterRect(0.0, 2.2, 0.0, 2.25, 1.62, 1.0, mats.mossyStone);
        addCenterRect(0.0, 1.08, 0.72, 1.9, 2.6, 1.08, mats.mossyStone);
        addCenterBlock(1.36, 3.95, 1.36, 0.5, 1.8, 0.5, mats.log);
        addCenterBlock(2.05, 1.82, 0.98, 1.45, 0.28, 0.68, mats.log);
        addCenterBlock(1.95, 3.25, 1.78, 0.2, 0.92, 0.2, mats.jungleVine);
        addCenterBlock(1.56, 2.95, 2.18, 0.18, 0.75, 0.18, mats.jungleVine);
        addCenterBlock(0.72, 3.0, 0.72, 0.75, 0.2, 0.65, mats.mossyStone);

        return {
            id: 'four_biome_obelisk',
            seamWidth: seamSpec.armWidth,
            seamHeight: seamSpec.height,
            peakHeight: 4.8
        };
    }

    function stampIntersection(ctx) {
        if (!ctx || !ctx.place || !ctx.materialLibrary) return null;
        var seamSpec = createSeamSpec(ctx.seamSpec);
        var seamMaterial = ctx.seamMaterial || ctx.materialLibrary.getLambert({ color: 0x646861 });
        addSeamCross(ctx.place, ctx.centerX, ctx.centerZ, ctx.span, seamSpec, seamMaterial);

        var builder = ctx.builder;
        if (typeof builder !== 'function') builder = ns.builders && ns.builders.fourBiomeObelisk;
        var buildStats = null;
        if (typeof builder === 'function') {
            buildStats = builder({
                centerX: ctx.centerX,
                centerZ: ctx.centerZ,
                seamSpec: seamSpec,
                place: ctx.place,
                materialLibrary: ctx.materialLibrary,
                layout: ctx.layout || null,
                biomeMap: ctx.biomeMap || null
            });
        }

        return {
            seamSpec: seamSpec,
            builderId: buildStats && buildStats.id ? buildStats.id : 'unknown',
            details: buildStats || null
        };
    }

    ns.createSeamSpec = createSeamSpec;
    ns.addSeamCross = addSeamCross;
    ns.builders = ns.builders || {};
    ns.builders.fourBiomeObelisk = buildFourBiomeObelisk;
    ns.stampIntersection = stampIntersection;
})();
