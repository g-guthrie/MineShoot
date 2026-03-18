import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-nuclear.js - Cooling towers and reactor blocks pushed hard against the east wall.
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            towerWhite: lib.getLambert({ color: 0xf6f7f3 }),
            towerShade: lib.getLambert({ color: 0xe0e3e0 }),
            towerCap: lib.getLambert({ color: 0xeaede8 }),
            buildingDark: lib.getLambert({ color: 0x353c40 }),
            buildingMid: lib.getLambert({ color: 0x474f53 }),
            buildingLight: lib.getLambert({ color: 0x596166 }),
            trim: lib.getLambert({ color: 0x70787d }),
            duct: lib.getLambert({ color: 0x667076 }),
            ductDark: lib.getLambert({ color: 0x485055 }),
            windowDark: lib.getLambert({ color: 0x11190f }),
            steam: lib.getLambert({ color: 0xf8faf6, transparent: true, opacity: 0.09 }),
            glow: new THREE.MeshStandardMaterial({
                color: 0x5bea3d,
                emissive: 0x5bea3d,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.92,
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

    function addGlowStripSegment(place, reactorId, x, y, z, w, h, d, glowH, mats, ctx, face, phase) {
        var glowBacking = addTaggedBlock(
            place,
            'reactor-window-back',
            { face: face, reactorId: reactorId },
            x,
            y,
            z,
            w,
            h,
            d,
            mats.windowDark,
            false
        );
        var glowMat = cloneMaterial(mats.glow);
        var glowStrip = addTaggedBlock(
            place,
            'reactor-glow-strip',
            { face: face, reactorId: reactorId },
            x,
            y,
            z,
            Math.max(0.12, w * 0.58),
            Math.max(0.14, glowH),
            Math.max(0.12, d * 0.58),
            glowMat,
            false
        );
        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({
                material: glowMat,
                freq: 0.42,
                phase: Number(phase || 0),
                baseIntensity: 0.44,
                amplitude: 0.16,
                opacityBase: 0.74,
                opacityAmplitude: 0.16,
                pulseFamily: 'nuclear-window'
            });
        }
        return {
            backing: glowBacking,
            glow: glowStrip
        };
    }

    function buildCoolingTower(eastFaceX, cz, towerId, place, mats, ctx) {
        var baseWidth = 15.8;
        var cx = eastFaceX - (baseWidth * 0.5);
        var tiers = [
            { w: 15.8, h: 4.0, mat: mats.towerWhite },
            { w: 15.2, h: 3.6, mat: mats.towerShade },
            { w: 14.4, h: 3.4, mat: mats.towerWhite },
            { w: 13.5, h: 3.2, mat: mats.towerShade },
            { w: 12.5, h: 3.0, mat: mats.towerWhite },
            { w: 11.7, h: 2.9, mat: mats.towerShade },
            { w: 11.0, h: 2.8, mat: mats.towerWhite },
            { w: 10.6, h: 2.8, mat: mats.towerShade },
            { w: 10.8, h: 2.9, mat: mats.towerWhite },
            { w: 11.3, h: 3.0, mat: mats.towerShade },
            { w: 12.0, h: 3.2, mat: mats.towerWhite },
            { w: 12.9, h: 3.5, mat: mats.towerShade },
            { w: 13.8, h: 3.8, mat: mats.towerCap }
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

        addTaggedBlock(place, 'cooling-tower-ring', { towerId: towerId }, cx, 0.48, cz, 16.8, 0.96, 16.8, mats.towerShade, true);
        addTaggedBlock(place, 'cooling-tower-cap', { towerId: towerId }, cx, currentBaseY + 0.2, cz, 12.8, 0.4, 12.8, mats.towerCap, true);
        peakHeight = Math.max(peakHeight, currentBaseY + 0.4);

        var steamTiles = [];
        for (var col = 0; col < 8; col++) {
            for (var row = 0; row < 13; row++) {
                var phase = (col * 0.21) + (row * 0.11);
                var steamMat = cloneMaterial(mats.steam);
                var tile = addTaggedBlock(
                    place,
                    'cooling-tower-steam',
                    { towerId: towerId, column: col, row: row },
                    cx - 4.9 + (col * 1.34),
                    currentBaseY + 1.5 + (row * 0.88),
                    cz - 2.0 + ((col % 2) * 0.52),
                    1.66,
                    0.96,
                    1.66,
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
                cycle: 3.5,
                rise: 13.2,
                baseOpacity: 0.09,
                swayAmp: 0.52,
                depthAmp: 0.3,
                swayFreq: 0.56
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
            steamRise: 13.2
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
        var startX = northBuilding.centerX + (northBuilding.width * 0.18);
        var startZ = northBuilding.southZ + 0.9;
        var endX = southBuilding.centerX + (southBuilding.width * 0.26);
        var endZ = southBuilding.northZ - 1.2;
        var midX = (startX + endX) * 0.5;
        var midZ = (startZ + endZ) * 0.5;
        var dx = endX - startX;
        var dz = endZ - startZ;
        var runLength = Math.sqrt((dx * dx) + (dz * dz));
        var rotY = Math.atan2(dx, dz);
        var ductY = 5.35;

        addTaggedRamp(place, 'reactor-duct', { part: 'body' }, midX, ductY, midZ, 1.5, 0.82, runLength + 0.4, mats.duct, rotY, 0, false);
        addTaggedRamp(place, 'reactor-duct', { part: 'top-cap' }, midX, ductY + 0.26, midZ, 0.92, 0.12, runLength, mats.ductDark, rotY, 0, false);
        addTaggedBlock(place, 'reactor-duct-support', { reactorId: northBuilding.id }, startX, 4.25, startZ, 0.24, 1.8, 0.24, mats.ductDark, false);
        addTaggedBlock(place, 'reactor-duct-support', { reactorId: southBuilding.id }, endX, 4.35, endZ, 0.24, 1.9, 0.24, mats.ductDark, false);

        return {
            length: runLength,
            rotY: rotY
        };
    }

    function buildGlowStrip(building, place, mats, ctx) {
        var backingHeight = 0.46;
        var glowHeight = 0.26;
        var stripY = building.height - 0.75;
        var standOff = 0.06;
        var southFaceZ = building.southZ + standOff;
        var westX = building.westFaceX - standOff;
        var eastX = building.eastFaceX + standOff;
        var wrapZ = building.southZ - 0.56;
        var mainSpan = building.width * 0.56;
        var wrapSpan = 1.1;
        var phase = 0.85;

        addGlowStripSegment(place, building.id, building.centerX, stripY, southFaceZ, mainSpan, backingHeight, 0.12, glowHeight, mats, ctx, 'south', phase);
        addGlowStripSegment(place, building.id, westX, stripY, wrapZ, 0.12, backingHeight, wrapSpan, glowHeight, mats, ctx, 'west', phase);
        addGlowStripSegment(place, building.id, eastX, stripY, wrapZ, 0.12, backingHeight, wrapSpan, glowHeight, mats, ctx, 'east', phase);

        return {
            y: stripY,
            segments: 3,
            mainFace: 'south',
            wrapFaces: ['west', 'east'],
            mainSpan: mainSpan,
            wrapSpan: wrapSpan,
            backingHeight: backingHeight,
            visibleHeight: glowHeight,
            standOff: standOff
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
            h: 6.2
        }, place, mats);
        var southBuilding = buildReactorBuilding({
            id: 'south',
            x: southAnchor.x,
            z: southAnchor.z,
            w: 15.4,
            d: 22.9,
            h: 8.3
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
            glowPulseBase: 0.44,
            glowPulseAmplitude: 0.16,
            steamRise: Math.max(towerNorth.steamRise, towerSouth.steamRise),
            steamTileCount: towerNorth.steamTileCount + towerSouth.steamTileCount,
            ductLength: ductInfo.length
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.nuclear = buildNuclearQuadrant;
})();
