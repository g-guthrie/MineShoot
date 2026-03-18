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

    function buildBroadStair(building, place, mats) {
        var stepCount = 5;
        var stairTargetY = Math.min(building.roofY * 0.62, 4.0);
        var rise = stairTargetY / stepCount;
        var stepWidth = 1.08;
        var stepDepth = 0.96;
        var startX = building.westFaceX - 0.9;
        var startZ = building.southZ + 0.8;
        var stepDx = 0.28;
        var stepDz = -0.78;
        var landingX = building.westFaceX + 0.46;
        var landingZ = building.centerZ + (building.depth * 0.16);
        for (var i = 0; i < stepCount; i++) {
            addTaggedBlock(
                place,
                'reactor-stair-step',
                { reactorId: building.id, stepIndex: i },
                startX + (i * stepDx),
                (i + 0.5) * rise,
                startZ + (i * stepDz),
                stepWidth,
                rise,
                stepDepth,
                i < stepCount - 1 ? mats.buildingMid : mats.buildingLight,
                true
            );
        }
        addTaggedBlock(
            place,
            'reactor-stair-landing',
            { reactorId: building.id },
            landingX,
            stairTargetY + 0.08,
            landingZ,
            1.28,
            0.2,
            1.28,
            mats.trim,
            true
        );
        addTaggedBlock(
            place,
            'reactor-service-platform',
            { reactorId: building.id },
            landingX + 0.72,
            stairTargetY + 0.22,
            landingZ,
            1.1,
            0.12,
            1.64,
            mats.trim,
            true
        );
        addTaggedBlock(
            place,
            'reactor-stair-support',
            { reactorId: building.id },
            startX + 0.8,
            stairTargetY * 0.52,
            startZ - 0.7,
            0.2,
            stairTargetY * 1.04,
            0.2,
            mats.trim,
            false
        );
        addTaggedBlock(
            place,
            'reactor-stair-support',
            { reactorId: building.id },
            startX + 1.66,
            stairTargetY * 0.66,
            startZ - 2.42,
            0.2,
            stairTargetY * 1.32,
            0.2,
            mats.trim,
            false
        );

        return {
            stepCount: stepCount,
            stairWidth: stepWidth,
            topY: stairTargetY
        };
    }

    function buildInterBuildingDuct(northBuilding, southBuilding, place, mats) {
        var landingWidth = 2.2;
        var landingDepth = 1.1;
        var bridgeThickness = 0.56;
        var wallOverlap = 0.18;
        var trimWidth = 0.14;
        var trimHeight = 0.18;
        var trimLift = 0.18;
        var supportWidth = 0.28;
        var northAttach = {
            x: northBuilding.eastFaceX - 1.2,
            y: northBuilding.roofY - 1.25,
            z: northBuilding.southZ
        };
        var southAttach = {
            x: southBuilding.eastFaceX - 1.6,
            y: southBuilding.roofY - 1.25,
            z: southBuilding.northZ
        };
        var dx = southAttach.x - northAttach.x;
        var dz = southAttach.z - northAttach.z;
        var horizontalLength = Math.sqrt((dx * dx) + (dz * dz));
        if (horizontalLength < 0.001) {
            return {
                length: 0,
                rotY: 0
            };
        }

        var dirX = dx / horizontalLength;
        var dirZ = dz / horizontalLength;
        var sideX = dirZ;
        var sideZ = -dirX;
        var rotY = Math.atan2(dx, dz);
        var landingCenterOffset = (landingDepth * 0.5) - wallOverlap;
        var railOffset = (landingWidth * 0.5) - (trimWidth * 0.5);
        var northLanding = {
            x: northAttach.x + (dirX * landingCenterOffset),
            y: northAttach.y,
            z: northAttach.z + (dirZ * landingCenterOffset)
        };
        var southLanding = {
            x: southAttach.x - (dirX * landingCenterOffset),
            y: southAttach.y,
            z: southAttach.z - (dirZ * landingCenterOffset)
        };
        var spanStart = {
            x: northLanding.x + (dirX * landingDepth * 0.5),
            y: northLanding.y,
            z: northLanding.z + (dirZ * landingDepth * 0.5)
        };
        var spanEnd = {
            x: southLanding.x - (dirX * landingDepth * 0.5),
            y: southLanding.y,
            z: southLanding.z - (dirZ * landingDepth * 0.5)
        };
        var spanDx = spanEnd.x - spanStart.x;
        var spanDz = spanEnd.z - spanStart.z;
        var spanDy = spanEnd.y - spanStart.y;
        var spanHorizontal = Math.sqrt((spanDx * spanDx) + (spanDz * spanDz));
        var spanLength = Math.sqrt((spanHorizontal * spanHorizontal) + (spanDy * spanDy));
        var tiltRatio = spanLength > 0.001 ? Math.max(-1, Math.min(1, spanDy / spanLength)) : 0;
        var tiltX = spanLength > 0.001 ? -Math.asin(tiltRatio) : 0;
        var spanMidX = (spanStart.x + spanEnd.x) * 0.5;
        var spanMidY = (spanStart.y + spanEnd.y) * 0.5;
        var spanMidZ = (spanStart.z + spanEnd.z) * 0.5;
        var undersideOffset = (bridgeThickness * 0.5) * Math.cos(tiltX || 0);

        function addBridgeRails(centerX, centerY, centerZ, depth, tilt, partPrefix) {
            addTaggedRamp(
                place,
                'reactor-duct',
                { part: partPrefix + '-left-rail' },
                centerX + (sideX * railOffset),
                centerY + trimLift,
                centerZ + (sideZ * railOffset),
                trimWidth,
                trimHeight,
                depth,
                mats.ductDark,
                rotY,
                tilt,
                false
            );
            addTaggedRamp(
                place,
                'reactor-duct',
                { part: partPrefix + '-right-rail' },
                centerX - (sideX * railOffset),
                centerY + trimLift,
                centerZ - (sideZ * railOffset),
                trimWidth,
                trimHeight,
                depth,
                mats.ductDark,
                rotY,
                tilt,
                false
            );
        }

        addTaggedRamp(
            place,
            'reactor-duct',
            { part: 'north-landing' },
            northLanding.x,
            northLanding.y,
            northLanding.z,
            landingWidth,
            bridgeThickness,
            landingDepth,
            mats.duct,
            rotY,
            0,
            true
        );
        addBridgeRails(northLanding.x, northLanding.y, northLanding.z, landingDepth * 0.96, 0, 'north-landing');

        addTaggedRamp(
            place,
            'reactor-duct',
            { part: 'body' },
            spanMidX,
            spanMidY,
            spanMidZ,
            landingWidth,
            bridgeThickness,
            spanLength,
            mats.duct,
            rotY,
            tiltX,
            true
        );
        addBridgeRails(spanMidX, spanMidY, spanMidZ, Math.max(0.3, spanLength - 0.12), tiltX, 'body');

        addTaggedRamp(
            place,
            'reactor-duct',
            { part: 'south-landing' },
            southLanding.x,
            southLanding.y,
            southLanding.z,
            landingWidth,
            bridgeThickness,
            landingDepth,
            mats.duct,
            rotY,
            0,
            true
        );
        addBridgeRails(southLanding.x, southLanding.y, southLanding.z, landingDepth * 0.96, 0, 'south-landing');

        for (var i = 0; i < 2; i++) {
            var supportT = i === 0 ? 0.25 : 0.75;
            var supportX = spanStart.x + (spanDx * supportT);
            var supportZ = spanStart.z + (spanDz * supportT);
            var supportCenterlineY = spanStart.y + (spanDy * supportT);
            var supportTopY = Math.max(0.3, supportCenterlineY - undersideOffset);
            addTaggedBlock(
                place,
                'reactor-duct-support',
                { supportIndex: i },
                supportX,
                supportTopY * 0.5,
                supportZ,
                supportWidth,
                supportTopY,
                supportWidth,
                mats.ductDark,
                false
            );
        }

        return {
            length: spanLength,
            rotY: rotY
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

        var stairInfo = buildBroadStair(northBuilding, place, mats);
        var ductInfo = buildInterBuildingDuct(northBuilding, southBuilding, place, mats);
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
            ductLength: ductInfo.length
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.nuclear = buildNuclearQuadrant;
})();
