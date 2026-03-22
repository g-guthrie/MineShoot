import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-nuclear.js - Cooling towers and reactor blocks pushed hard against the east wall.
 */
(function () {
    'use strict';

    var REACTOR_HEIGHT_SCALE = 1.25;
    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            towerWhite: lib.getLambert({ color: 0xf6f7f3 }),
            towerShade: lib.getLambert({ color: 0xe0e3e0 }),
            towerCap: lib.getLambert({ color: 0xeaede8 }),
            buildingDark: lib.getLambert({ color: 0x6f767b }),
            buildingMid: lib.getLambert({ color: 0x858c91 }),
            buildingLight: lib.getLambert({ color: 0x9ca3a8 }),
            trim: lib.getLambert({ color: 0xb1b8bc }),
            duct: lib.getLambert({ color: 0x8f979c }),
            ductDark: lib.getLambert({ color: 0x747c81 }),
            windowDark: lib.getLambert({ color: 0x11190f }),
            steam: lib.getLambert({ color: 0xf8faf6, transparent: true, opacity: 0.09 }),
            glow: new THREE.MeshStandardMaterial({
                color: 0x79ff77,
                emissive: 0x79ff77,
                emissiveIntensity: 0.82,
                roughness: 0.22,
                metalness: 0.02,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            })
        };
        return MATS;
    }

    function setMeta(mesh, role, meta) {
        if (!mesh) return mesh;
        mesh.userData = mesh.userData || {};
        mesh.userData.role = role;
        if (meta && typeof meta === 'object') {
            for (var key in meta) {
                mesh.userData[key] = meta[key];
            }
        }
        return mesh;
    }

    function addTaggedBlock(place, role, meta, x, y, z, w, h, d, material, isSolid) {
        return setMeta(place.addBlock(x, y, z, w, h, d, material, isSolid), role, meta);
    }

    function addTaggedRamp(place, role, meta, x, y, z, w, h, d, material, rotY, tiltX, isSolid) {
        return setMeta(place.addRamp(x, y, z, w, h, d, material, rotY, tiltX, isSolid), role, meta);
    }

    function addTaggedDecor(place, role, meta, x, y, z, geometry, material, rotY, rotX, rotZ) {
        return setMeta(place.addDecor(x, y, z, geometry, material, rotY, rotX, rotZ), role, meta);
    }

    function addGlowStripSegment(place, reactorId, x, y, z, w, h, d, mats, ctx, face, phase) {
        var glowMat = cloneMaterial(mats.glow);
        var glowStrip = addTaggedBlock(
            place,
            'reactor-glow-strip',
            { face: face, reactorId: reactorId },
            x,
            y,
            z,
            Math.max(0.14, w),
            Math.max(0.18, h),
            Math.max(0.14, d),
            glowMat,
            false
        );
        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({
                material: glowMat,
                freq: 0.34,
                phase: Number(phase || 0),
                baseIntensity: 0.62,
                amplitude: 0.08,
                opacityBase: 0.88,
                opacityAmplitude: 0.05,
                pulseFamily: 'nuclear-window'
            });
        }
        return {
            glow: glowStrip
        };
    }

    function buildCoolingTower(eastFaceX, cz, towerId, place, mats, ctx) {
        var baseWidth = 16.6;
        var cx = eastFaceX - (baseWidth * 0.5);
        var steamCols = 10;
        var steamRows = 16;
        var steamWidth = 1.78;
        var steamHeight = 1.02;
        var steamDepth = 1.78;
        var steamColSpacing = 1.12;
        var steamRowSpacing = 0.82;
        var steamStartX = cx - (((steamCols - 1) * steamColSpacing) * 0.5);
        var steamRise = 16.8;
        var tiers = [
            { w: 16.6, h: 4.0, mat: mats.towerWhite },
            { w: 15.9, h: 3.6, mat: mats.towerShade },
            { w: 14.8, h: 3.4, mat: mats.towerWhite },
            { w: 13.7, h: 3.2, mat: mats.towerShade },
            { w: 12.6, h: 3.0, mat: mats.towerWhite },
            { w: 11.7, h: 2.9, mat: mats.towerShade },
            { w: 10.9, h: 2.8, mat: mats.towerWhite },
            { w: 10.4, h: 2.8, mat: mats.towerShade },
            { w: 10.8, h: 2.9, mat: mats.towerWhite },
            { w: 11.6, h: 3.0, mat: mats.towerShade },
            { w: 12.8, h: 3.2, mat: mats.towerWhite },
            { w: 14.1, h: 3.5, mat: mats.towerShade },
            { w: 15.2, h: 3.8, mat: mats.towerCap }
        ];
        var currentBaseY = 0;
        var peakHeight = 0;
        for (var i = 0; i < tiers.length; i++) {
            var tier = tiers[i];
            var centerY = currentBaseY + (tier.h * 0.5);
            addTaggedBlock(
                place,
                'cooling-tower-tier',
                { towerId: towerId, tierIndex: i },
                cx,
                centerY,
                cz,
                tier.w,
                tier.h,
                tier.w,
                tier.mat,
                true
            );
            currentBaseY += tier.h;
            peakHeight = Math.max(peakHeight, centerY + (tier.h * 0.5));
        }

        addTaggedBlock(place, 'cooling-tower-ring', { towerId: towerId }, cx, 0.48, cz, 17.6, 0.96, 17.6, mats.towerShade, true);
        addTaggedBlock(place, 'cooling-tower-cap', { towerId: towerId }, cx, currentBaseY + 0.2, cz, 14.0, 0.4, 14.0, mats.towerCap, true);
        peakHeight = Math.max(peakHeight, currentBaseY + 0.4);

        var steamTiles = [];
        for (var col = 0; col < steamCols; col++) {
            for (var row = 0; row < steamRows; row++) {
                var phase = (col * 0.21) + (row * 0.11);
                var steamMat = cloneMaterial(mats.steam);
                var tile = addTaggedBlock(
                    place,
                    'cooling-tower-steam',
                    { towerId: towerId, column: col, row: row },
                    steamStartX + (col * steamColSpacing),
                    currentBaseY + 1.3 + (row * steamRowSpacing),
                    cz - 2.35 + ((col % 3) * 0.52),
                    steamWidth,
                    steamHeight,
                    steamDepth,
                    steamMat,
                    false
                );
                steamTiles.push({
                    mesh: tile,
                    material: steamMat,
                    baseX: tile.position.x,
                    baseY: tile.position.y,
                    baseZ: tile.position.z,
                    phase: phase
                });
            }
        }

        if (ctx && typeof ctx.addSteamColumn === 'function') {
            ctx.addSteamColumn({
                towerId: towerId,
                tiles: steamTiles,
                cycle: 3.8,
                rise: steamRise,
                baseOpacity: 0.12,
                swayAmp: 0.66,
                depthAmp: 0.38,
                swayFreq: 0.52
            });
        }

        return {
            towerId: towerId,
            centerX: cx,
            centerZ: cz,
            width: baseWidth,
            peakHeight: peakHeight,
            eastFaceX: eastFaceX,
            steamTileCount: steamTiles.length,
            steamRise: steamRise
        };
    }

    function buildReactorBuilding(spec, place, mats) {
        var centerX = Number(spec.x || 0);
        var centerZ = Number(spec.z || 0);
        var width = Number(spec.w || 10);
        var depth = Number(spec.d || 14);
        var height = Number(spec.h || 7);
        var reactorId = String(spec.id || 'reactor');

        addTaggedBlock(place, 'reactor-building-base', { reactorId: reactorId }, centerX, 0.18, centerZ, width + 0.8, 0.36, depth + 1.0, mats.buildingMid, true);
        addTaggedBlock(place, 'reactor-building', { reactorId: reactorId }, centerX, height * 0.5, centerZ, width, height, depth, mats.buildingDark, true);
        addTaggedBlock(place, 'reactor-building-upper', { reactorId: reactorId }, centerX + 0.2, height - 0.95, centerZ - 0.18, width * 0.68, 0.9, depth * 0.74, mats.buildingMid, true);
        addTaggedBlock(place, 'reactor-roof-band', { reactorId: reactorId }, centerX, height + 0.14, centerZ, width * 0.72, 0.14, depth * 0.76, mats.trim, false);

        return {
            id: reactorId,
            centerX: centerX,
            centerZ: centerZ,
            width: width,
            depth: depth,
            height: height,
            westFaceX: centerX - (width * 0.5),
            eastFaceX: centerX + (width * 0.5),
            northZ: centerZ - (depth * 0.5),
            southZ: centerZ + (depth * 0.5),
            roofY: height
        };
    }

    function buildBroadStair(building, bridgeY, ductX, place, mats) {
        /* Fire escape on the west face of the north building.
           Thin metal treads, open underneath, two side stringers. */
        var targetY = bridgeY;
        var stepCount = 8;
        var rise = targetY / stepCount;
        var treadDepth = 1.8;   /* extends west from wall */
        var treadWidth = 1.2;   /* along Z */
        var treadThick = 0.12;  /* thin metal tread */

        var stairX = building.westFaceX - (treadDepth * 0.5);
        var startZ = building.southZ - 0.5;

        for (var i = 0; i < stepCount; i++) {
            var treadY = (i + 1) * rise;
            var stepZ = startZ - (i * treadWidth);
            addTaggedBlock(
                place,
                'reactor-stair-step',
                { reactorId: building.id, stepIndex: i },
                stairX,
                treadY,
                stepZ,
                treadDepth,
                treadThick,
                treadWidth,
                i === stepCount - 1 ? mats.buildingLight : mats.buildingMid,
                true
            );
        }

        /* Two side stringers (angled beams) */
        var topStepZ = startZ - ((stepCount - 1) * treadWidth);
        var totalRun = (stepCount - 1) * treadWidth;
        var stringerLen = Math.sqrt(totalRun * totalRun + targetY * targetY);
        var stringerAngle = Math.atan2(targetY, totalRun);
        var midZ = (startZ + topStepZ) * 0.5;
        var midY = targetY * 0.5;
        var stringerThick = 0.14;
        var stringerHeight = 0.28;
        var sideOffset = (treadDepth * 0.5) - (stringerThick * 0.5);

        for (var s = -1; s <= 1; s += 2) {
            addTaggedRamp(
                place,
                'reactor-stair-stringer',
                { reactorId: building.id },
                stairX + (s * sideOffset),
                midY,
                midZ,
                stringerThick,
                stringerHeight,
                stringerLen,
                mats.ductDark,
                0,
                stringerAngle,
                false
            );
        }

        /* Small landing at top */
        addTaggedBlock(
            place,
            'reactor-stair-landing',
            { reactorId: building.id },
            stairX,
            targetY,
            topStepZ,
            treadDepth + 0.3,
            treadThick,
            treadWidth + 0.3,
            mats.trim,
            true
        );

        return {
            stepCount: stepCount,
            stairWidth: treadWidth,
            topY: targetY,
            landingX: stairX,
            landingZ: topStepZ
        };
    }

    function buildInterBuildingDuct(northBuilding, southBuilding, bridgeY, place, mats) {
        /* Narrow industrial duct spanning the gap between buildings.
           Extends 0.5 units into each building wall so it looks like
           it penetrates the structure. */
        var ductWidth = 1.4;
        var ductThickness = 0.24;
        var railWidth = 0.08;
        var railHeight = 0.5;
        var wallPenetration = 0.5;
        var supportWidth = 0.24;

        /* X center within the overlap of both buildings' widths */
        var overlapMinX = Math.max(northBuilding.westFaceX, southBuilding.westFaceX);
        var overlapMaxX = Math.min(northBuilding.eastFaceX, southBuilding.eastFaceX);
        var ductX = (overlapMinX + overlapMaxX) * 0.5;

        /* Z span: penetrate slightly into each building */
        var northZ = northBuilding.southZ - wallPenetration;
        var southZ = southBuilding.northZ + wallPenetration;
        var totalLength = southZ - northZ;
        var ductMidZ = (northZ + southZ) * 0.5;
        var deckY = bridgeY;

        /* Main duct deck — thin walkway */
        addTaggedBlock(
            place,
            'reactor-duct',
            { part: 'body' },
            ductX,
            deckY,
            ductMidZ,
            ductWidth,
            ductThickness,
            totalLength,
            mats.duct,
            true
        );

        /* Rails along both sides */
        var railOffset = (ductWidth * 0.5) - (railWidth * 0.5);
        var railY = deckY + (ductThickness * 0.5) + (railHeight * 0.5);
        for (var side = -1; side <= 1; side += 2) {
            addTaggedBlock(
                place,
                'reactor-duct',
                { part: side < 0 ? 'left-rail' : 'right-rail' },
                ductX + (side * railOffset),
                railY,
                ductMidZ,
                railWidth,
                railHeight,
                totalLength,
                mats.ductDark,
                false
            );
        }

        /* Two thin support pillars at 30% and 70% along the open gap */
        var gapNorthZ = northBuilding.southZ;
        var gapSouthZ = southBuilding.northZ;
        var gapLength = gapSouthZ - gapNorthZ;
        var pillarTopY = deckY - (ductThickness * 0.5);
        for (var p = 0; p < 2; p++) {
            var t = p === 0 ? 0.3 : 0.7;
            addTaggedBlock(
                place,
                'reactor-duct-support',
                { supportIndex: p },
                ductX,
                pillarTopY * 0.5,
                gapNorthZ + (gapLength * t),
                supportWidth,
                pillarTopY,
                supportWidth,
                mats.ductDark,
                false
            );
        }

        /* Small landing ledge on south building wall at duct height */
        addTaggedBlock(
            place,
            'reactor-duct-platform',
            { part: 'south-landing' },
            ductX,
            deckY,
            southBuilding.northZ + 0.4,
            ductWidth + 0.4,
            ductThickness,
            0.8,
            mats.trim,
            true
        );

        return {
            length: gapLength,
            ductX: ductX,
            deckY: deckY,
            ductWidth: ductWidth
        };
    }

    function buildGlowStrip(building, place, mats, ctx) {
        var backingHeight = 0;
        var glowHeight = 0.96;
        var glowDepth = 0.18;
        var stripY = (building.height - 0.75) - (building.height * 0.05);
        var standOff = 0.01;
        var southFaceZ = building.southZ - (glowDepth * 0.5) + standOff;
        var westX = building.westFaceX + (glowDepth * 0.5) - standOff;
        var eastX = building.eastFaceX - (glowDepth * 0.5) + standOff;
        var mainSpan = Math.max(2.0, building.width - glowDepth);
        var wrapSpan = Math.max(2.4, Math.min(3.1, building.depth * 0.12));
        var wrapZ = building.southZ - (wrapSpan * 0.5) + standOff;
        var phase = 0.85;

        addGlowStripSegment(place, building.id, building.centerX, stripY, southFaceZ, mainSpan, glowHeight, glowDepth, mats, ctx, 'south', phase);
        addGlowStripSegment(place, building.id, westX, stripY, wrapZ, glowDepth, glowHeight, wrapSpan, mats, ctx, 'west', phase);
        addGlowStripSegment(place, building.id, eastX, stripY, wrapZ, glowDepth, glowHeight, wrapSpan, mats, ctx, 'east', phase);

        return {
            y: stripY,
            segments: 3,
            mainFace: 'south',
            wrapFaces: ['west', 'east'],
            mainSpan: mainSpan,
            wrapSpan: wrapSpan,
            backingHeight: backingHeight,
            visibleHeight: glowHeight,
            standOff: standOff,
            bandDepth: glowDepth
        };
    }

    function buildNuclearQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var rawBounds = ctx && ctx.rawBounds ? ctx.rawBounds : bounds;
        var northTowerZ = rawBounds.minZ + 14.0;
        var southTowerZ = rawBounds.maxZ - 14.0;
        var towerNorth = buildCoolingTower(rawBounds.maxX, northTowerZ, 'north', place, mats, ctx);
        var towerSouth = buildCoolingTower(rawBounds.maxX, southTowerZ, 'south', place, mats, ctx);

        if (ctx && typeof ctx.addExclusion === 'function') {
            ctx.addExclusion(towerNorth.centerX, towerNorth.centerZ, 7.2);
            ctx.addExclusion(towerSouth.centerX, towerSouth.centerZ, 7.2);
        }

        var northAnchor = pt(bounds, 0.46, 0.29);
        var southAnchor = pt(bounds, 0.50, 0.74);
        var northBuilding = buildReactorBuilding({
            id: 'north',
            x: northAnchor.x,
            z: northAnchor.z,
            w: 11.8,
            d: 17.6,
            h: 6.2 * REACTOR_HEIGHT_SCALE
        }, place, mats);
        var southBuilding = buildReactorBuilding({
            id: 'south',
            x: southAnchor.x,
            z: southAnchor.z,
            w: 15.4,
            d: 22.9,
            h: 8.3 * REACTOR_HEIGHT_SCALE
        }, place, mats);

        if (ctx && typeof ctx.addExclusion === 'function') {
            ctx.addExclusion(northBuilding.centerX - 1.2, northBuilding.centerZ, 7.5);
            ctx.addExclusion(southBuilding.centerX, southBuilding.centerZ, 8.2);
        }

        var bridgeY = northBuilding.roofY;
        var stairInfo = buildBroadStair(northBuilding, bridgeY, 0, place, mats);
        var glowInfo = buildGlowStrip(southBuilding, place, mats, ctx);

        addTaggedBlock(
            place,
            'reactor-floor-band',
            { edge: 'north' },
            rawBounds.minX + 16.0,
            0.16,
            bounds.minZ + 3.5,
            20.0,
            0.32,
            1.0,
            mats.trim,
            true
        );

        return {
            structures: 4,
            towers: 2,
            steamColumns: 2,
            towerPeakHeight: Math.max(towerNorth.peakHeight, towerSouth.peakHeight),
            towerEastFaceX: Math.max(towerNorth.eastFaceX, towerSouth.eastFaceX),
            towerBaseWidth: towerNorth.width,
            reactorBuildings: 2,
            northBuildingCenterX: northBuilding.centerX,
            northBuildingCenterZ: northBuilding.centerZ,
            northBuildingRoofY: northBuilding.roofY,
            southBuildingCenterX: southBuilding.centerX,
            southBuildingCenterZ: southBuilding.centerZ,
            southBuildingRoofY: southBuilding.roofY,
            buildingGap: southBuilding.northZ - northBuilding.southZ,
            stairBuildingNorth: 1,
            northStairStepCount: stairInfo.stepCount,
            northStairTopY: stairInfo.topY,
            warningSignCount: 0,
            glowStripSegments: glowInfo.segments,
            glowStripY: glowInfo.y,
            glowMainFace: glowInfo.mainFace,
            glowWrapFaces: glowInfo.wrapFaces.slice(),
            glowMainSpan: glowInfo.mainSpan,
            glowWrapSpan: glowInfo.wrapSpan,
            glowBackingHeight: glowInfo.backingHeight,
            glowVisibleHeight: glowInfo.visibleHeight,
            glowStandOff: glowInfo.standOff,
            glowBandDepth: glowInfo.bandDepth,
            glowPulseBase: 0.62,
            glowPulseAmplitude: 0.08,
            steamRise: Math.max(towerNorth.steamRise, towerSouth.steamRise),
            steamTileCount: towerNorth.steamTileCount + towerSouth.steamTileCount,
            ductLength: 0
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.nuclear = buildNuclearQuadrant;
})();
