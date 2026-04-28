import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-wall-street.js - Cold toon-finance district occupying the south-center biome slot.
 * Current bounds are the full biome cell footprint: x:[56,110] z:[110,164]
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            asphalt: lib.getLambert({ color: 0x202428 }),
            asphaltDark: lib.getLambert({ color: 0x12161a }),
            lane: lib.getLambert({ color: 0x2f383e }),
            curb: lib.getLambert({ color: 0x6f7a82 }),
            concreteDark: lib.getLambert({ color: 0x384047 }),
            concreteMid: lib.getLambert({ color: 0x758088 }),
            concreteLight: lib.getLambert({ color: 0xc7d0d4 }),
            column: lib.getLambert({ color: 0xdfe5e7 }),
            glass: lib.getLambert({ color: 0x17454a, transparent: true, opacity: 0.7 }),
            glassDark: lib.getLambert({ color: 0x0b262b, transparent: true, opacity: 0.78 }),
            brass: lib.getLambert({ color: 0x9a7b3e }),
            blackSign: lib.getLambert({ color: 0x0b1114 }),
            tickerGreen: lib.getLambert({ color: 0x30d158 }),
            sellRed: lib.getLambert({ color: 0xb73535 }),
            paper: lib.getLambert({ color: 0xd7dde0 }),
            shadow: lib.getLambert({ color: 0x151a1f }),
            glowGreen: new THREE.MeshStandardMaterial({ color: 0x35ff84, emissive: 0x35ff84, emissiveIntensity: 0.78 }),
            glowRed: new THREE.MeshStandardMaterial({ color: 0xff4a48, emissive: 0xff4a48, emissiveIntensity: 0.62 }),
            glowAmber: new THREE.MeshStandardMaterial({ color: 0xcda34a, emissive: 0xcda34a, emissiveIntensity: 0.44 })
        };
        return MATS;
    }

    function addGlowBlock(place, x, y, z, w, h, d, material, ctx, phase) {
        var glow = place.addBlock(x, y, z, w, h, d, cloneMaterial(material), false);
        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({ material: glow.material, freq: 2.2, phase: Number(phase || 0) });
        }
        return glow;
    }

    function addWindowBand(place, x, y, z, w, d, mats, frontScale, sideScale) {
        var frontW = Math.max(1.4, w * (frontScale || 0.62));
        var sideD = Math.max(1.1, d * (sideScale || 0.48));
        var frontZ = z - (d * 0.5) - 0.08;
        var backZ = z + (d * 0.5) - 0.08;
        var sideX = (w * 0.5) + 0.08;
        place.addBlock(x, y, frontZ, frontW, 0.52, 0.14, mats.glass, false);
        place.addBlock(x, y, backZ, frontW, 0.52, 0.14, mats.glassDark, false);
        place.addBlock(x - sideX, y, z, 0.14, 0.52, sideD, mats.glassDark, false);
        place.addBlock(x + sideX, y, z, 0.14, 0.52, sideD, mats.glassDark, false);
    }

    function addWindowStack(place, x, startY, z, w, d, count, stepY, mats, frontScale, sideScale) {
        for (var i = 0; i < count; i++) {
            addWindowBand(place, x, startY + (i * stepY), z, w, d, mats, frontScale, sideScale);
        }
    }

    function addCornice(place, x, y, z, w, d, mats) {
        place.addBlock(x, y, z, w + 0.7, 0.34, d + 0.7, mats.concreteMid, true);
        place.addBlock(x, y + 0.25, z - (d * 0.5) - 0.08, w + 0.28, 0.12, 0.12, mats.brass, false);
        place.addBlock(x, y + 0.25, z + (d * 0.5) + 0.08, w + 0.28, 0.12, 0.12, mats.brass, false);
        place.addBlock(x - (w * 0.5) - 0.08, y + 0.25, z, 0.12, 0.12, d + 0.28, mats.brass, false);
        place.addBlock(x + (w * 0.5) + 0.08, y + 0.25, z, 0.12, 0.12, d + 0.28, mats.brass, false);
    }

    function addTickerBoard(place, x, y, z, w, d, mats, ctx, phase, colorMode) {
        var glowMat = colorMode === 'red' ? mats.glowRed : mats.glowGreen;
        var stripeMat = colorMode === 'red' ? mats.sellRed : mats.tickerGreen;
        place.addBlock(x, y, z, w, 1.08, d, mats.blackSign, false);
        addGlowBlock(place, x, y + 0.18, z - (d * 0.5) - 0.04, w * 0.82, 0.14, 0.12, glowMat, ctx, phase);
        place.addBlock(x - (w * 0.22), y - 0.18, z - (d * 0.5) - 0.05, w * 0.24, 0.12, 0.1, stripeMat, false);
        place.addBlock(x + (w * 0.22), y - 0.18, z - (d * 0.5) - 0.05, w * 0.24, 0.12, 0.1, mats.paper, false);
    }

    function addVaultDoor(place, x, y, z, mats) {
        var ringGeo = new THREE.CylinderGeometry(1.12, 1.12, 0.16, 20);
        var coreGeo = new THREE.CylinderGeometry(0.76, 0.76, 0.18, 20);
        place.addDecor(x, y, z, ringGeo, mats.brass, 0, Math.PI * 0.5, 0);
        place.addDecor(x, y, z - 0.04, coreGeo, mats.concreteDark, 0, Math.PI * 0.5, 0);
        place.addBlock(x, y, z - 0.12, 0.1, 0.1, 1.18, mats.brass, false);
        place.addBlock(x, y, z - 0.12, 1.18, 0.1, 0.1, mats.brass, false);
    }

    function addColdClock(place, x, y, z, mats) {
        var rimGeo = new THREE.CylinderGeometry(0.98, 0.98, 0.12, 20);
        var faceGeo = new THREE.CylinderGeometry(0.76, 0.76, 0.08, 20);
        place.addDecor(x, y, z, rimGeo, mats.brass, 0, Math.PI * 0.5, 0);
        place.addDecor(x, y, z - 0.04, faceGeo, mats.paper, 0, Math.PI * 0.5, 0);
        place.addBlock(x, y, z - 0.13, 0.08, 0.08, 0.68, mats.shadow, false);
        place.addBlock(x + 0.2, y + 0.16, z - 0.13, 0.08, 0.08, 0.38, mats.shadow, false);
    }

    function addStreetLamp(place, x, z, mats, ctx, phase) {
        place.addBlock(x, 2.35, z, 0.14, 4.7, 0.14, mats.shadow, false);
        place.addBlock(x, 4.5, z + 0.34, 0.12, 0.12, 0.68, mats.shadow, false);
        addGlowBlock(place, x, 4.36, z + 0.72, 0.24, 0.14, 0.24, mats.glowGreen, ctx, phase);
    }

    function buildCorporatePaving(bounds, centerX, exchangeZ, place, mats, ctx) {
        var spanX = (bounds.maxX - bounds.minX) - 1.2;
        var spanZ = (bounds.maxZ - bounds.minZ) - 1.2;
        var plazaZ = (bounds.minZ + bounds.maxZ) * 0.5;
        var centerStreetZ = (bounds.minZ + exchangeZ - 2.0) * 0.5;
        var centerStreetDepth = Math.max(31.0, (exchangeZ - bounds.minZ) - 3.0);
        var westLane = pt(bounds, 0.27, 0.5);
        var eastLane = pt(bounds, 0.73, 0.5);
        var northBandZ = bounds.minZ + 0.55;
        var southBandZ = bounds.maxZ - 0.55;
        var westBandX = bounds.minX + 0.55;
        var eastBandX = bounds.maxX - 0.55;

        place.addBlock(centerX, 0.04, plazaZ, spanX, 0.08, spanZ, mats.asphalt, false);
        place.addBlock(centerX, 0.085, centerStreetZ, 12.4, 0.09, centerStreetDepth, mats.lane, false);
        place.addBlock(westLane.x, 0.09, westLane.z, 4.4, 0.1, 25.0, mats.asphaltDark, false);
        place.addBlock(eastLane.x, 0.09, eastLane.z, 4.4, 0.1, 25.0, mats.asphaltDark, false);

        place.addBlock(centerX, 0.12, northBandZ, spanX, 0.24, 0.5, mats.curb, false);
        place.addBlock(centerX, 0.12, southBandZ, 18.0, 0.24, 0.5, mats.curb, false);
        place.addBlock(westBandX, 0.12, plazaZ, 0.5, 0.24, spanZ, mats.curb, false);
        place.addBlock(eastBandX, 0.12, plazaZ, 0.5, 0.24, spanZ, mats.curb, false);

        addGlowBlock(place, centerX - 4.1, 0.17, centerStreetZ, 0.12, 0.06, centerStreetDepth - 3.0, mats.glowGreen, ctx, 0.2);
        addGlowBlock(place, centerX + 4.1, 0.17, centerStreetZ, 0.12, 0.06, centerStreetDepth - 3.0, mats.glowGreen, ctx, 0.8);

        return {
            alleyStripCount: 2
        };
    }

    function buildRearWallMask(bounds, centerX, place, mats) {
        var wallZ = bounds.maxZ - 1.9;
        var spanX = (bounds.maxX - bounds.minX) - 0.5;
        place.addBlock(centerX, 9.8, wallZ, spanX, 19.6, 3.8, mats.concreteDark, true);
        place.addBlock(centerX, 21.5, wallZ - 0.3, spanX - 8.0, 15.4, 2.3, mats.shadow, true);
        place.addBlock(bounds.minX + 2.15, 11.4, wallZ - 0.25, 4.3, 22.8, 2.7, mats.concreteMid, true);
        place.addBlock(bounds.maxX - 2.15, 11.4, wallZ - 0.25, 4.3, 22.8, 2.7, mats.concreteMid, true);
        addWindowStack(place, centerX, 9.0, wallZ - 2.0, spanX - 12.0, 0.4, 4, 2.8, mats, 0.72, 0.1);
        return {
            southFaceZ: wallZ + 1.9
        };
    }

    function buildGrandStair(centerX, exchangeZ, place, mats) {
        var steps = [
            { y: 0.42, z: exchangeZ - 9.7, w: 16.2, d: 2.4 },
            { y: 1.05, z: exchangeZ - 7.72, w: 15.0, d: 2.1 },
            { y: 1.76, z: exchangeZ - 5.82, w: 13.8, d: 1.9 },
            { y: 2.52, z: exchangeZ - 4.08, w: 12.6, d: 1.75 },
            { y: 3.34, z: exchangeZ - 2.42, w: 11.4, d: 1.62 }
        ];
        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            place.addBlock(centerX, step.y, step.z, step.w, 0.84, step.d, mats.concreteMid, true);
        }
        place.addBlock(centerX, 4.08, exchangeZ - 0.62, 12.4, 0.92, 3.2, mats.concreteLight, true);
        place.addBlock(centerX - 7.2, 4.82, exchangeZ - 0.72, 0.9, 1.5, 4.2, mats.concreteDark, true);
        place.addBlock(centerX + 7.2, 4.82, exchangeZ - 0.72, 0.9, 1.5, 4.2, mats.concreteDark, true);
        place.addBlock(centerX - 7.2, 5.62, exchangeZ - 0.72, 0.7, 0.22, 3.7, mats.brass, false);
        place.addBlock(centerX + 7.2, 5.62, exchangeZ - 0.72, 0.7, 0.22, 3.7, mats.brass, false);
    }

    function buildExchangeFrontage(centerX, facadeZ, bounds, place, mats, ctx) {
        var columnOffsets = [-10.8, -7.0, -3.3, 0, 3.3, 7.0, 10.8];
        var wingLeft = bounds.minX + 5.8;
        var wingRight = bounds.maxX - 5.8;

        place.addBlock(centerX, 6.3, facadeZ + 0.7, 31.2, 2.4, 8.8, mats.concreteDark, true);
        place.addBlock(centerX, 11.8, facadeZ + 0.55, 27.4, 9.2, 6.2, mats.concreteMid, true);
        place.addBlock(centerX, 7.4, facadeZ - 2.45, 7.4, 6.8, 0.82, mats.shadow, false);
        place.addBlock(centerX, 8.0, facadeZ - 2.55, 5.4, 5.6, 0.26, mats.glassDark, false);

        for (var i = 0; i < columnOffsets.length; i++) {
            var dx = columnOffsets[i];
            place.addBlock(centerX + dx, 10.4, facadeZ - 2.28, 1.18, 11.8, 1.12, mats.column, true);
            place.addBlock(centerX + dx, 16.52, facadeZ - 2.28, 1.58, 0.5, 1.5, mats.concreteLight, false);
            place.addBlock(centerX + dx, 4.28, facadeZ - 2.28, 1.58, 0.48, 1.5, mats.concreteLight, false);
        }

        place.addBlock(centerX, 16.1, facadeZ - 1.08, 29.0, 1.0, 2.2, mats.concreteLight, true);
        place.addBlock(centerX, 17.45, facadeZ - 0.82, 24.0, 0.88, 2.0, mats.concreteMid, true);
        place.addBlock(centerX, 18.55, facadeZ - 0.5, 18.0, 0.84, 1.72, mats.concreteLight, true);
        place.addBlock(centerX, 19.58, facadeZ - 0.24, 11.6, 0.78, 1.42, mats.concreteMid, true);
        place.addBlock(centerX, 20.46, facadeZ - 0.04, 5.4, 0.56, 1.1, mats.brass, false);
        addColdClock(place, centerX, 18.72, facadeZ - 2.74, mats);

        place.addBlock(wingLeft, 8.2, facadeZ + 0.4, 7.8, 9.8, 6.8, mats.concreteDark, true);
        place.addBlock(wingRight, 8.2, facadeZ + 0.4, 7.8, 9.8, 6.8, mats.concreteDark, true);
        addWindowStack(place, wingLeft, 5.7, facadeZ + 0.4, 7.8, 6.8, 3, 2.05, mats, 0.58, 0.46);
        addWindowStack(place, wingRight, 5.7, facadeZ + 0.4, 7.8, 6.8, 3, 2.05, mats, 0.58, 0.46);
        addCornice(place, wingLeft, 13.4, facadeZ + 0.4, 7.8, 6.8, mats);
        addCornice(place, wingRight, 13.4, facadeZ + 0.4, 7.8, 6.8, mats);

        addTickerBoard(place, centerX, 14.55, facadeZ - 2.98, 16.4, 0.18, mats, ctx, 1.2, 'green');
        addTickerBoard(place, centerX - 10.9, 11.8, facadeZ - 2.62, 4.5, 0.14, mats, ctx, 2.0, 'red');
        addTickerBoard(place, centerX + 10.9, 11.8, facadeZ - 2.62, 4.5, 0.14, mats, ctx, 2.6, 'green');

        return {
            institutionalColumns: columnOffsets.length
        };
    }

    function buildTowerStack(centerX, towerZ, place, mats, ctx) {
        place.addBlock(centerX, 10.2, towerZ, 22.0, 20.4, 10.0, mats.shadow, true);
        addWindowStack(place, centerX, 5.4, towerZ, 22.0, 10.0, 6, 2.25, mats, 0.58, 0.46);
        addCornice(place, centerX, 20.7, towerZ, 22.0, 10.0, mats);

        place.addBlock(centerX - 0.35, 31.6, towerZ - 0.15, 10.8, 21.0, 9.2, mats.concreteDark, true);
        addWindowStack(place, centerX - 0.35, 23.8, towerZ - 0.15, 10.8, 9.2, 7, 2.2, mats, 0.52, 0.44);
        addCornice(place, centerX - 0.35, 42.3, towerZ - 0.15, 10.8, 9.2, mats);

        place.addBlock(centerX + 0.42, 49.0, towerZ + 0.15, 8.2, 13.0, 7.7, mats.concreteMid, true);
        addWindowStack(place, centerX + 0.42, 44.4, towerZ + 0.15, 8.2, 7.7, 4, 2.05, mats, 0.5, 0.4);
        addCornice(place, centerX + 0.42, 55.7, towerZ + 0.15, 8.2, 7.7, mats);

        place.addBlock(centerX, 59.95, towerZ, 5.8, 7.9, 5.6, mats.concreteDark, true);
        addGlowBlock(place, centerX, 57.2, towerZ - 2.92, 4.4, 0.22, 0.14, mats.glowGreen, ctx, 0.55);
        place.addBlock(centerX, 64.15, towerZ, 6.6, 0.5, 6.4, mats.brass, false);
        place.addBlock(centerX - 1.8, 64.92, towerZ - 1.8, 0.5, 1.8, 0.5, mats.brass, false);
        place.addBlock(centerX + 1.8, 64.92, towerZ - 1.8, 0.5, 1.8, 0.5, mats.brass, false);
        place.addBlock(centerX - 1.8, 64.92, towerZ + 1.8, 0.5, 1.8, 0.5, mats.brass, false);
        place.addBlock(centerX + 1.8, 64.92, towerZ + 1.8, 0.5, 1.8, 0.5, mats.brass, false);
        place.addBlock(centerX, 67.2, towerZ, 0.34, 5.6, 0.34, mats.brass, false);
        addGlowBlock(place, centerX, 68.6, towerZ - 0.45, 1.4, 0.2, 0.2, mats.glowAmber, ctx, 1.1);

        return {
            peakHeight: 70.0,
            upperShaftWidth: 5.8
        };
    }

    function buildSideBlock(spec, place, mats, ctx) {
        var x = spec.x;
        var z = spec.z;
        var w = spec.w;
        var d = spec.d;
        var h = spec.h;
        var signSide = spec.signSide > 0 ? 1 : -1;
        var facadeZ = z - (d * 0.5) - 0.1;
        var alleyX = x + (signSide * ((w * 0.5) + 0.18));

        place.addBlock(x, h * 0.5, z, w, h, d, mats.concreteDark, true);
        addWindowStack(place, x, 3.6, z, w, d, 5, 2.22, mats, 0.56, 0.48);
        addCornice(place, x, h + 0.12, z, w, d, mats);
        place.addBlock(x + (signSide * 1.0), h + 1.0, z - 0.7, w * 0.42, 1.25, 1.1, mats.shadow, false);
        addTickerBoard(place, x, Math.min(h - 2.0, 10.6), facadeZ, w * 0.58, 0.16, mats, ctx, spec.phase || 0, spec.red ? 'red' : 'green');

        place.addBlock(alleyX, 4.15, z + 0.8, 0.42, 8.3, d * 0.72, mats.column, true);
        place.addBlock(alleyX, 8.48, z + 0.8, 0.55, 0.24, d * 0.62, mats.brass, false);

        if (spec.vault) {
            addVaultDoor(place, x + (signSide * 1.6), 5.8, facadeZ - 0.05, mats);
        }

        return {
            peakHeight: h + 1.65
        };
    }

    function buildAlleyArch(place, x, z, width, mats) {
        place.addBlock(x - (width * 0.5) + 0.38, 2.55, z, 0.76, 5.1, 2.4, mats.concreteMid, true);
        place.addBlock(x + (width * 0.5) - 0.38, 2.55, z, 0.76, 5.1, 2.4, mats.concreteMid, true);
        place.addBlock(x, 5.22, z, width, 0.72, 2.4, mats.concreteMid, true);
        place.addBlock(x, 5.72, z - 1.24, width * 0.64, 0.2, 0.14, mats.brass, false);
    }

    function buildLowCover(place, x, z, w, d, mats) {
        place.addBlock(x, 0.7, z, w, 1.4, d, mats.concreteDark, true);
        place.addBlock(x, 1.44, z, w * 0.8, 0.18, d * 0.8, mats.brass, false);
    }

    function buildCanyonCover(bounds, place, mats, ctx) {
        var covers = [
            { u: 0.24, v: 0.24, w: 2.2, d: 1.4 },
            { u: 0.32, v: 0.38, w: 1.6, d: 2.3 },
            { u: 0.24, v: 0.62, w: 2.2, d: 1.5 },
            { u: 0.32, v: 0.75, w: 1.7, d: 2.2 },
            { u: 0.76, v: 0.24, w: 2.2, d: 1.4 },
            { u: 0.68, v: 0.38, w: 1.6, d: 2.3 },
            { u: 0.76, v: 0.62, w: 2.2, d: 1.5 },
            { u: 0.68, v: 0.75, w: 1.7, d: 2.2 }
        ];
        for (var i = 0; i < covers.length; i++) {
            var pos = pt(bounds, covers[i].u, covers[i].v);
            buildLowCover(place, pos.x, pos.z, covers[i].w, covers[i].d, mats);
        }

        var lampA = pt(bounds, 0.36, 0.44);
        var lampB = pt(bounds, 0.64, 0.44);
        addStreetLamp(place, lampA.x, lampA.z, mats, ctx, 0.4);
        addStreetLamp(place, lampB.x, lampB.z, mats, ctx, 1.4);

        return {
            coverCount: covers.length
        };
    }

    function buildWallStreetQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var centerX = (bounds.minX + bounds.maxX) * 0.5;
        var exchange = pt(bounds, 0.50, 0.84);
        var tower = pt(bounds, 0.50, 0.90);
        var westBlock = pt(bounds, 0.16, 0.51);
        var eastBlock = pt(bounds, 0.84, 0.51);
        var westSouth = pt(bounds, 0.19, 0.73);
        var eastSouth = pt(bounds, 0.81, 0.73);
        var westArch = pt(bounds, 0.30, 0.65);
        var eastArch = pt(bounds, 0.70, 0.65);

        var pavingStats = buildCorporatePaving(bounds, centerX, exchange.z, place, mats, ctx);
        var rearWallStats = buildRearWallMask(bounds, centerX, place, mats);
        buildGrandStair(centerX, exchange.z, place, mats);
        var facadeStats = buildExchangeFrontage(centerX, exchange.z, bounds, place, mats, ctx);
        var towerStats = buildTowerStack(centerX, tower.z, place, mats, ctx);
        var westStats = buildSideBlock({ x: westBlock.x, z: westBlock.z, w: 9.8, d: 17.2, h: 18.2, signSide: 1, phase: 0.2, vault: true }, place, mats, ctx);
        var eastStats = buildSideBlock({ x: eastBlock.x, z: eastBlock.z, w: 9.2, d: 15.6, h: 15.8, signSide: -1, phase: 0.8, red: true }, place, mats, ctx);
        var westSouthStats = buildSideBlock({ x: westSouth.x, z: westSouth.z, w: 8.2, d: 10.6, h: 14.2, signSide: 1, phase: 1.8, red: true }, place, mats, ctx);
        var eastSouthStats = buildSideBlock({ x: eastSouth.x, z: eastSouth.z, w: 8.2, d: 10.6, h: 14.8, signSide: -1, phase: 2.2, vault: true }, place, mats, ctx);
        buildAlleyArch(place, westArch.x, westArch.z, 5.8, mats);
        buildAlleyArch(place, eastArch.x, eastArch.z, 5.8, mats);
        var coverStats = buildCanyonCover(bounds, place, mats, ctx);

        if (ctx && typeof ctx.addExclusion === 'function') {
            ctx.addExclusion(centerX, tower.z - 2.0, 12.5);
            ctx.addExclusion(westBlock.x, westBlock.z, 5.8);
            ctx.addExclusion(eastBlock.x, eastBlock.z, 5.6);
            ctx.addExclusion(westSouth.x, westSouth.z, 4.4);
            ctx.addExclusion(eastSouth.x, eastSouth.z, 4.4);
            ctx.addExclusion(westArch.x, westArch.z, 3.0);
            ctx.addExclusion(eastArch.x, eastArch.z, 3.0);
        }

        return {
            towers: 1,
            heroBuildings: 2,
            financeBlocks: 4,
            alleys: 2,
            alleyStrips: pavingStats.alleyStripCount,
            cover: coverStats.coverCount,
            busStops: 0,
            planters: 0,
            tickerBoards: 7,
            vaultDoors: 2,
            institutionalColumns: facadeStats.institutionalColumns,
            towerPeakHeight: towerStats.peakHeight,
            upperShaftWidth: towerStats.upperShaftWidth,
            exchangeCenterZ: exchange.z,
            towerCenterZ: tower.z,
            westBlockCenterZ: westBlock.z,
            eastBlockCenterZ: eastBlock.z,
            westSouthCenterZ: westSouth.z,
            eastSouthCenterZ: eastSouth.z,
            rearWallSouthFaceZ: rearWallStats.southFaceZ,
            westBlockPeakHeight: westStats.peakHeight,
            eastBlockPeakHeight: eastStats.peakHeight,
            westSouthPeakHeight: westSouthStats.peakHeight,
            eastSouthPeakHeight: eastSouthStats.peakHeight,
            centerCoverCount: 0,
            westAlleyCoverCount: 4,
            eastAlleyCoverCount: 4
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns['wall-street'] = buildWallStreetQuadrant;
})();
