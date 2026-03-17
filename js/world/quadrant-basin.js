import { cloneMaterial, pointInBounds as pt } from './biome-utils.js';

/**
 * quadrant-basin.js - Toontown Wall Street occupying the south-center biome slot.
 * Current bounds are the full biome cell footprint: x:[56,110] z:[110,164]
 */
(function () {
    'use strict';

    var MATS = null;

    function ensureMats() {
        if (MATS) return MATS;
        var lib = globalThis.__MAYHEM_RUNTIME.GameMaterialLibrary;
        MATS = {
            stoneLight: lib.getLambert({ color: 0xe5ddcf }),
            stoneMid: lib.getLambert({ color: 0xcbbca0 }),
            stoneDark: lib.getLambert({ color: 0x6b6660 }),
            roof: lib.getLambert({ color: 0x7a5f58 }),
            trim: lib.getLambert({ color: 0xd3ad5f }),
            bronze: lib.getLambert({ color: 0xb17b46 }),
            paper: lib.getLambert({ color: 0xf0e4bf }),
            signRed: lib.getLambert({ color: 0xc84e50 }),
            signBlue: lib.getLambert({ color: 0x4a7da6 }),
            hedge: lib.getLambert({ color: 0x617d56 }),
            pavement: lib.getLambert({ color: 0x3c3f46 }),
            glass: lib.getLambert({ color: 0xeaf8ff, transparent: true, opacity: 0.4 }),
            window: lib.getLambert({ color: 0x7dd7f1, transparent: true, opacity: 0.72 }),
            glow: new THREE.MeshStandardMaterial({ color: 0xffdc7d, emissive: 0xffdc7d, emissiveIntensity: 0.72 })
        };
        return MATS;
    }

    function addWindowRing(place, cx, baseY, cz, w, d, mats, frontScale, sideScale) {
        var frontW = Math.max(1.6, w * (frontScale || 0.62));
        var sideD = Math.max(1.2, d * (sideScale || 0.6));
        var frontZ = cz - (d * 0.5) - 0.12;
        var backZ = cz + (d * 0.5) + 0.12;
        var sideX = (w * 0.5) + 0.12;
        place.addBlock(cx, baseY, frontZ, frontW, 0.54, 0.18, mats.window, false);
        place.addBlock(cx, baseY, backZ, frontW, 0.54, 0.18, mats.window, false);
        place.addBlock(cx - sideX, baseY, cz, 0.18, 0.54, sideD, mats.window, false);
        place.addBlock(cx + sideX, baseY, cz, 0.18, 0.54, sideD, mats.window, false);
    }

    function addWindowStack(place, cx, startY, cz, w, d, levels, stepY, mats, frontScale, sideScale) {
        var count = Math.max(1, Number(levels) || 1);
        var step = Math.max(1.45, Number(stepY) || 2.2);
        for (var i = 0; i < count; i++) {
            addWindowRing(place, cx, startY + (i * step), cz, w, d, mats, frontScale, sideScale);
        }
    }

    function addCornice(place, cx, y, cz, w, d, mats) {
        place.addBlock(cx, y, cz, w + 0.72, 0.34, d + 0.72, mats.stoneMid, true);
        place.addBlock(cx, y + 0.24, cz, w + 0.28, 0.1, d + 0.28, mats.trim, false);
    }

    function addStreetLamp(x, z, place, mats, ctx, phase) {
        place.addBlock(x, 2.6, z, 0.14, 5.2, 0.14, mats.stoneDark, false);
        place.addBlock(x, 5.0, z + 0.38, 0.12, 0.12, 0.76, mats.stoneDark, false);
        var glow = place.addBlock(x, 4.82, z + 0.78, 0.28, 0.15, 0.28, cloneMaterial(mats.glow), false);
        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({ material: glow.material, freq: 2.7, phase: Number(phase || 0) });
        }
    }

    function addClockMedallion(x, y, z, place, mats) {
        var ringGeo = new THREE.CylinderGeometry(1.02, 1.02, 0.16, 18);
        var faceGeo = new THREE.CylinderGeometry(0.78, 0.78, 0.08, 18);
        place.addDecor(x, y, z, ringGeo, mats.trim, 0, Math.PI * 0.5, 0);
        place.addDecor(x, y, z - 0.04, faceGeo, mats.stoneLight, 0, Math.PI * 0.5, 0);
        place.addBlock(x, y, z - 0.12, 0.08, 0.08, 0.76, mats.stoneDark, false);
        place.addBlock(x + 0.22, y + 0.18, z - 0.12, 0.08, 0.08, 0.42, mats.stoneDark, false);
    }

    function addGlowStrip(place, x, y, z, w, d, mats, ctx, color, phase) {
        var mat = cloneMaterial(mats.glow);
        var nextColor = Number(color || 0xffdc7d);
        if (mat.color && typeof mat.color.setHex === 'function') mat.color.setHex(nextColor);
        if (mat.emissive && typeof mat.emissive.setHex === 'function') mat.emissive.setHex(nextColor);
        var glow = place.addBlock(x, y, z, w, 0.14, d, mat, false);
        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({ material: glow.material, freq: 2.1, phase: Number(phase || 0) });
        }
        return glow;
    }

    function addVaultWheel(x, y, z, place, mats) {
        var ringGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.12, 18);
        var coreGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.18, 12);
        place.addDecor(x, y, z, ringGeo, mats.bronze, 0, Math.PI * 0.5, 0);
        place.addDecor(x, y, z - 0.02, coreGeo, mats.stoneDark, 0, Math.PI * 0.5, 0);
        for (var i = 0; i < 6; i++) {
            var angle = (Math.PI * 2 * i) / 6;
            var spokeX = x + (Math.cos(angle) * 0.42);
            var spokeZ = z + (Math.sin(angle) * 0.42);
            place.addBlock((x + spokeX) * 0.5, y, (z + spokeZ) * 0.5, Math.abs(spokeX - x) + 0.08, 0.08, Math.abs(spokeZ - z) + 0.08, mats.bronze, false);
            place.addBlock(x + (Math.cos(angle) * 1.02), y, z + (Math.sin(angle) * 1.02), 0.22, 0.22, 0.22, mats.bronze, false);
        }
    }

    function addCogHalo(x, y, z, radius, place, mats) {
        var r = Math.max(1.5, Number(radius) || 2.0);
        var ringGeo = new THREE.CylinderGeometry(r, r, 0.1, 20);
        place.addDecor(x, y, z, ringGeo, mats.trim, 0, Math.PI * 0.5, 0);
        for (var i = 0; i < 10; i++) {
            var angle = (Math.PI * 2 * i) / 10;
            place.addBlock(x + (Math.cos(angle) * r), y, z + (Math.sin(angle) * r), 0.3, 0.3, 0.3, mats.trim, false);
        }
    }

    function addTickerRibbon(x, y, z, len, place, mats) {
        var span = Math.max(2.4, Number(len) || 3.0);
        place.addRamp(x, y, z, 0.08, 0.08, span, mats.signRed, Math.PI * 0.5, 0.22, false);
        place.addRamp(x + 0.25, y - 0.16, z + 0.22, 0.07, 0.07, span * 0.82, mats.paper, Math.PI * 0.5, -0.2, false);
        place.addRamp(x - 0.18, y - 0.08, z - 0.26, 0.06, 0.06, span * 0.62, mats.signBlue, Math.PI * 0.5, 0.18, false);
    }

    function buildRearWallMask(bounds, centerX, place, mats) {
        var wallZ = bounds.maxZ - 2.1;
        var fullWidth = Math.max(52.0, (bounds.maxX - bounds.minX) - 0.6);
        place.addBlock(centerX, 8.6, wallZ, fullWidth, 17.2, 4.2, mats.stoneDark, true);
        place.addBlock(centerX, 17.0, wallZ - 0.95, fullWidth - 2.0, 16.8, 2.6, mats.stoneDark, true);
        place.addBlock(bounds.minX + 2.2, 10.4, wallZ - 0.4, 4.4, 20.8, 2.9, mats.stoneDark, true);
        place.addBlock(bounds.maxX - 2.2, 10.0, wallZ - 0.2, 4.4, 20.0, 2.9, mats.stoneDark, true);
        addWindowStack(place, centerX, 7.3, wallZ - 2.1, fullWidth - 12.0, 0.2, 4, 2.6, mats, 0.82, 0.1);
        return {
            southFaceZ: wallZ + 2.1
        };
    }

    function buildGrandStair(centerX, terraceZ, place, mats) {
        var steps = [
            { y: 0.42, z: terraceZ - 10.1, w: 16.4, d: 2.6 },
            { y: 1.05, z: terraceZ - 8.0, w: 15.0, d: 2.2 },
            { y: 1.8, z: terraceZ - 6.05, w: 13.8, d: 2.0 },
            { y: 2.58, z: terraceZ - 4.2, w: 12.7, d: 1.85 },
            { y: 3.36, z: terraceZ - 2.38, w: 11.6, d: 1.78 }
        ];
        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            place.addBlock(centerX, step.y, step.z, step.w, 0.84, step.d, mats.stoneLight, true);
        }

        place.addBlock(centerX, 4.12, terraceZ, 12.6, 1.02, 3.4, mats.stoneMid, true);
        place.addBlock(centerX, 4.58, terraceZ - 0.05, 7.1, 0.08, 10.0, mats.signRed, false);
        place.addBlock(centerX - 7.35, 5.0, terraceZ + 0.55, 1.4, 1.25, 1.4, mats.stoneDark, true);
        place.addBlock(centerX + 7.35, 5.0, terraceZ + 0.55, 1.4, 1.25, 1.4, mats.stoneDark, true);
        place.addBlock(centerX - 7.35, 6.15, terraceZ + 0.55, 0.72, 1.1, 0.72, mats.trim, false);
        place.addBlock(centerX + 7.35, 6.15, terraceZ + 0.55, 0.72, 1.1, 0.72, mats.trim, false);
    }

    function buildExchangeFrontage(centerX, facadeZ, bounds, place, mats, ctx) {
        var wingCenterLeft = bounds.minX + 3.0;
        var wingCenterRight = bounds.maxX - 3.0;
        var columnOffsets = [-10.1, -6.0, -2.0, 2.0, 6.0, 10.1];
        var lobbyPilasters = [-7.2, -2.4, 2.4, 7.2];

        place.addBlock(centerX, 6.4, facadeZ + 1.0, 30.2, 2.2, 10.4, mats.stoneMid, true);
        place.addBlock(centerX, 11.2, facadeZ + 1.3, 27.2, 9.0, 6.8, mats.stoneDark, true);
        place.addBlock(centerX, 15.95, facadeZ + 0.5, (bounds.maxX - bounds.minX) - 0.6, 0.92, 2.6, mats.stoneMid, true);

        place.addBlock(wingCenterLeft, 8.8, facadeZ + 1.2, 6.0, 9.6, 7.4, mats.stoneMid, true);
        place.addBlock(wingCenterRight, 8.8, facadeZ + 1.2, 6.0, 9.6, 7.4, mats.stoneMid, true);
        place.addBlock(wingCenterLeft, 14.25, facadeZ + 0.78, 6.6, 1.0, 2.1, mats.stoneMid, true);
        place.addBlock(wingCenterRight, 14.25, facadeZ + 0.78, 6.6, 1.0, 2.1, mats.stoneMid, true);
        place.addBlock(wingCenterLeft, 17.85, facadeZ + 0.88, 5.2, 0.58, 1.3, mats.roof, false);
        place.addBlock(wingCenterRight, 17.85, facadeZ + 0.88, 5.2, 0.58, 1.3, mats.roof, false);
        place.addBlock(wingCenterLeft, 11.0, facadeZ + 1.55, 2.0, 6.4, 4.2, mats.stoneDark, true);
        place.addBlock(wingCenterRight, 11.0, facadeZ + 1.55, 2.0, 6.4, 4.2, mats.stoneDark, true);
        place.addBlock(centerX - 12.25, 9.5, facadeZ + 1.5, 4.3, 7.8, 5.8, mats.stoneDark, true);
        place.addBlock(centerX + 12.25, 9.5, facadeZ + 1.5, 4.3, 7.8, 5.8, mats.stoneDark, true);
        addWindowStack(place, wingCenterLeft, 7.2, facadeZ + 1.2, 6.0, 7.4, 2, 2.15, mats, 0.56, 0.62);
        addWindowStack(place, wingCenterRight, 7.2, facadeZ + 1.2, 6.0, 7.4, 2, 2.15, mats, 0.56, 0.62);

        for (var p = 0; p < lobbyPilasters.length; p++) {
            var pilasterX = centerX + lobbyPilasters[p];
            place.addBlock(pilasterX, 10.95, facadeZ + 1.52, 1.26, 8.4, 4.8, mats.stoneMid, true);
            place.addBlock(pilasterX, 15.28, facadeZ + 1.22, 1.62, 0.34, 4.1, mats.trim, false);
        }

        for (var i = 0; i < columnOffsets.length; i++) {
            var dx = columnOffsets[i];
            place.addBlock(centerX + dx, 10.1, facadeZ - 0.55, 1.26, 12.0, 1.2, mats.stoneLight, true);
            place.addBlock(centerX + dx, 16.22, facadeZ - 0.55, 1.62, 0.6, 1.56, mats.stoneMid, false);
            place.addBlock(centerX + dx, 3.92, facadeZ - 0.55, 1.62, 0.46, 1.56, mats.stoneMid, false);
        }

        place.addBlock(centerX, 7.2, facadeZ + 0.35, 5.4, 8.0, 1.0, mats.stoneDark, false);
        place.addBlock(centerX - 5.0, 8.9, facadeZ + 0.25, 3.2, 4.8, 0.72, mats.window, false);
        place.addBlock(centerX + 5.0, 8.9, facadeZ + 0.25, 3.2, 4.8, 0.72, mats.window, false);
        place.addBlock(centerX, 14.18, facadeZ - 1.62, 15.8, 0.5, 0.22, mats.signBlue, false);
        place.addBlock(centerX, 16.0, facadeZ + 0.12, 28.4, 1.12, 2.42, mats.stoneMid, true);
        place.addBlock(centerX, 17.35, facadeZ + 0.3, 24.8, 0.9, 2.3, mats.stoneLight, true);
        place.addBlock(centerX, 18.45, facadeZ + 0.55, 15.4, 0.85, 1.95, mats.stoneMid, true);
        place.addBlock(centerX, 19.38, facadeZ + 0.78, 10.8, 0.74, 1.58, mats.roof, true);
        place.addBlock(centerX, 20.15, facadeZ + 0.96, 5.9, 0.54, 1.1, mats.roof, true);
        place.addBlock(centerX - 7.6, 18.95, facadeZ + 0.72, 5.1, 0.48, 1.18, mats.roof, false);
        place.addBlock(centerX + 7.6, 18.95, facadeZ + 0.72, 5.1, 0.48, 1.18, mats.roof, false);
        place.addBlock(centerX, 20.86, facadeZ + 1.0, 2.4, 0.36, 0.82, mats.trim, false);
        place.addBlock(centerX, 7.5, facadeZ + 0.95, 3.7, 6.4, 0.82, mats.paper, false);
        place.addBlock(centerX - 3.0, 8.3, facadeZ + 0.72, 0.2, 5.2, 0.2, mats.trim, false);
        place.addBlock(centerX + 3.0, 8.3, facadeZ + 0.72, 0.2, 5.2, 0.2, mats.trim, false);
        place.addBlock(centerX, 14.85, facadeZ + 0.38, 16.8, 0.18, 0.18, mats.trim, false);
        addGlowStrip(place, centerX, 14.55, facadeZ - 1.7, 16.2, 0.18, mats, ctx, 0x7bd7ff, 1.1);
        addGlowStrip(place, centerX, 7.58, facadeZ + 0.96, 3.2, 0.16, mats, ctx, 0xffe49c, 1.8);
        addTickerRibbon(centerX - 8.8, 15.2, facadeZ + 0.95, 3.4, place, mats);
        addTickerRibbon(centerX + 8.8, 15.4, facadeZ + 1.0, 2.9, place, mats);
        addClockMedallion(centerX, 18.62, facadeZ - 0.02, place, mats);
    }

    function buildTowerStack(centerX, towerZ, bounds, place, mats, ctx) {
        place.addBlock(centerX, 9.0, towerZ + 0.2, 24.6, 18.0, 13.2, mats.stoneDark, true);
        place.addBlock(bounds.minX + 4.4, 9.3, towerZ + 0.58, 8.8, 18.6, 11.6, mats.stoneDark, true);
        place.addBlock(bounds.maxX - 4.4, 9.1, towerZ + 0.54, 8.8, 18.2, 11.2, mats.stoneDark, true);
        place.addBlock(centerX - 11.4, 10.2, towerZ + 0.6, 6.1, 20.4, 8.8, mats.stoneDark, true);
        place.addBlock(centerX + 11.4, 10.2, towerZ + 0.6, 6.1, 20.4, 8.8, mats.stoneDark, true);
        place.addBlock(centerX, 10.2, towerZ - 5.42, 15.8, 8.8, 0.92, mats.window, false);
        addWindowStack(place, centerX, 7.05, towerZ + 0.2, 24.6, 13.2, 4, 2.36, mats, 0.68, 0.58);
        addWindowStack(place, bounds.minX + 4.4, 6.95, towerZ + 0.58, 8.8, 11.6, 4, 2.24, mats, 0.58, 0.46);
        addWindowStack(place, bounds.maxX - 4.4, 6.95, towerZ + 0.54, 8.8, 11.2, 4, 2.24, mats, 0.58, 0.46);
        addCornice(place, centerX, 18.1, towerZ + 0.2, 24.6, 13.2, mats);
        addCornice(place, bounds.minX + 4.4, 18.1, towerZ + 0.58, 8.8, 11.6, mats);
        addCornice(place, bounds.maxX - 4.4, 18.0, towerZ + 0.54, 8.8, 11.2, mats);

        place.addBlock(centerX, 24.8, towerZ - 0.08, 12.6, 13.6, 12.6, mats.stoneDark, true);
        addWindowStack(place, centerX, 21.15, towerZ - 0.08, 12.6, 12.6, 4, 2.34, mats, 0.6, 0.56);
        addCornice(place, centerX, 31.86, towerZ - 0.08, 12.6, 12.6, mats);

        place.addBlock(centerX + 0.38, 36.15, towerZ - 0.03, 11.0, 9.4, 11.0, mats.stoneDark, true);
        addWindowStack(place, centerX + 0.38, 32.8, towerZ - 0.03, 11.0, 11.0, 4, 1.96, mats, 0.58, 0.54);
        addCornice(place, centerX + 0.38, 40.98, towerZ - 0.03, 11.0, 11.0, mats);

        place.addBlock(centerX - 0.2, 44.9, towerZ + 0.08, 9.4, 8.4, 9.4, mats.stoneDark, true);
        addWindowStack(place, centerX - 0.2, 41.95, towerZ + 0.08, 9.4, 9.4, 3, 1.95, mats, 0.56, 0.52);
        addCornice(place, centerX - 0.2, 49.2, towerZ + 0.08, 9.4, 9.4, mats);

        place.addBlock(centerX + 0.16, 52.8, towerZ + 0.12, 8.2, 8.2, 8.2, mats.stoneDark, true);
        addWindowStack(place, centerX + 0.16, 50.4, towerZ + 0.12, 8.2, 8.2, 3, 1.85, mats, 0.54, 0.5);

        place.addBlock(centerX + 0.16, 57.18, towerZ + 0.12, 9.4, 0.34, 9.4, mats.trim, false);
        place.addBlock(centerX - 2.74, 56.48, towerZ - 2.74, 0.56, 2.0, 0.56, mats.trim, false);
        place.addBlock(centerX + 3.02, 56.48, towerZ - 2.74, 0.56, 2.0, 0.56, mats.trim, false);
        place.addBlock(centerX - 2.66, 56.48, towerZ + 3.02, 0.56, 2.0, 0.56, mats.trim, false);
        place.addBlock(centerX + 2.92, 56.48, towerZ + 2.62, 0.56, 2.0, 0.56, mats.trim, false);
        addGlowStrip(place, centerX + 0.16, 56.72, towerZ - 0.08, 6.1, 0.18, mats, ctx, 0xffdc7d, 0.3);
        addClockMedallion(centerX + 0.16, 46.7, towerZ - 4.92, place, mats);
        addCogHalo(centerX + 0.16, 57.92, towerZ + 0.12, 2.82, place, mats);
        place.addRamp(centerX + 1.88, 58.25, towerZ + 0.72, 0.28, 4.0, 0.28, mats.trim, 0.22, -0.34, false);
        place.addBlock(centerX + 2.18, 59.15, towerZ + 1.04, 0.82, 0.24, 0.24, mats.trim, false);
        place.addBlock(centerX - 1.78, 57.25, towerZ - 0.76, 0.24, 2.8, 0.24, mats.trim, false);

        var beacon = place.addBlock(centerX, 55.5, towerZ - 4.02, 1.02, 1.02, 0.24, cloneMaterial(mats.glow), false);
        if (ctx && typeof ctx.addFlicker === 'function') {
            ctx.addFlicker({ material: beacon.material, freq: 2.1, phase: 0.85 });
        }

        return {
            peakHeight: 59.27,
            upperShaftWidth: 8.2
        };
    }

    function buildFinanceBlock(spec, place, mats, ctx) {
        var x = spec.x;
        var z = spec.z;
        var w = spec.w;
        var d = spec.d;
        var h = spec.h;
        var alleySide = spec.alleySide > 0 ? 1 : -1;
        var outerDir = -alleySide;
        var gapDepth = 3.8;
        var southDepth = d * 0.42;
        var northDepth = d * 0.36;
        var toeDepth = 4.4;
        var southZ = z + ((gapDepth * 0.5) + (southDepth * 0.5));
        var northZ = z - ((gapDepth * 0.5) + (northDepth * 0.5));
        var toeZ = northZ - ((northDepth * 0.5) + (toeDepth * 0.5) + 1.35);
        var balconyX = x + (alleySide * ((w * 0.5) - 0.78));
        var stairX = x + (alleySide * ((w * 0.5) + 1.02));
        var signX = x + (alleySide * ((w * 0.5) + 0.18));
        var bridgeX = x + (alleySide * (w * 0.24));
        var toeX = x + (outerDir * 0.9);

        place.addBlock(x, h * 0.5, southZ, w, h, southDepth, mats.stoneDark, true);
        addWindowStack(place, x, 4.3, southZ, w, southDepth, 4, 2.48, mats, 0.62, 0.58);
        addCornice(place, x, h + 0.1, southZ, w, southDepth, mats);

        place.addBlock(x, (h * 0.46), northZ, w * 0.96, h * 0.92, northDepth, mats.stoneDark, true);
        addWindowStack(place, x, 4.0, northZ, w * 0.96, northDepth, 3, 2.42, mats, 0.6, 0.5);
        addCornice(place, x, (h * 0.92) + 0.18, northZ, w * 0.96, northDepth, mats);

        place.addBlock(toeX, 3.0, toeZ, w * 0.82, 6.0, toeDepth, mats.stoneDark, true);
        addWindowStack(place, toeX, 2.6, toeZ, w * 0.82, toeDepth, 2, 1.8, mats, 0.54, 0.42);
        addCornice(place, toeX, 6.15, toeZ, w * 0.82, toeDepth, mats);

        place.addBlock(bridgeX, 6.1, z, w * 0.34, 1.4, gapDepth + 0.8, mats.stoneMid, true);
        place.addBlock(bridgeX, 6.92, z, w * 0.28, 0.12, gapDepth + 0.4, mats.trim, false);

        place.addBlock(balconyX, 6.25, southZ - 0.45, 1.4, 1.0, 3.5, mats.stoneLight, true);
        place.addBlock(signX, 9.0, southZ, 0.18, 3.95, southDepth * 0.92, mats.trim, false);
        place.addBlock(toeX, 7.8, toeZ - 2.42, w * 0.56, 0.46, 0.18, spec.signMat || mats.signRed, false);

        for (var i = 0; i < 3; i++) {
            place.addBlock(stairX, 0.44 + (i * 0.68), toeZ - 0.96 + (i * 0.74), 1.15, 0.88, 0.96, mats.stoneMid, true);
        }

        place.addBlock(x + (alleySide * ((w * 0.5) - 0.35)), 2.9, southZ + 2.2, 0.42, 5.8, 0.42, mats.stoneMid, false);
        place.addBlock(x + (alleySide * ((w * 0.5) - 0.42)), 3.0, northZ - 1.6, 0.42, 4.8, 0.42, mats.stoneMid, false);

        if (spec.profile === 'west') {
            place.addBlock(x - 0.64, h + 1.22, southZ - 0.2, w * 0.42, 1.4, southDepth * 0.42, mats.roof, false);
            place.addBlock(x - 1.22, h + 1.98, southZ + 0.36, w * 0.24, 0.44, southDepth * 0.18, mats.signRed, false);
            place.addBlock(x - 2.42, 6.2, northZ - 1.9, 1.38, 1.0, 2.72, mats.stoneLight, false);
            addVaultWheel(x - 2.42, 6.62, northZ - 3.18, place, mats);
            addGlowStrip(place, x - 0.92, 8.82, toeZ - 2.48, w * 0.54, 0.16, mats, ctx, 0xffd26b, 1.6);
            place.addBlock(x + 1.9, 11.4, southZ + 0.82, 2.0, 2.4, 2.8, mats.stoneDark, false);
        } else if (spec.profile === 'east') {
            place.addBlock(x + 0.82, h + 1.1, southZ - 0.1, w * 0.38, 1.2, southDepth * 0.4, mats.roof, false);
            place.addBlock(x + 1.45, h + 1.84, southZ - 0.76, w * 0.22, 0.38, southDepth * 0.18, mats.signBlue, false);
            place.addBlock(x + 2.26, 8.4, northZ - 1.98, 0.48, 4.2, 2.88, mats.stoneLight, false);
            addGlowStrip(place, x + 2.42, 9.0, northZ - 2.12, 0.18, 2.72, mats, ctx, 0x84d8ff, 0.9);
            place.addBlock(x - 1.66, 11.1, southZ + 1.08, 1.72, 2.2, 2.44, mats.stoneLight, false);
            place.addBlock(x - 1.66, 12.32, southZ + 1.08, 1.3, 0.14, 2.02, mats.window, false);
        }

        return {
            peakHeight: Math.max(
                h + 1.98,
                (h * 0.92) + 0.18,
                8.82,
                9.0,
                12.32
            ),
            toeZ: toeZ
        };
    }

    function buildShortOffice(spec, place, mats, ctx) {
        var x = spec.x;
        var z = spec.z;
        var w = spec.w;
        var d = spec.d;
        var h = spec.h;
        place.addBlock(x, h * 0.5, z, w, h, d, mats.stoneDark, true);
        addWindowStack(place, x, 2.7, z, w, d, 3, 1.95, mats, 0.58, 0.52);
        addCornice(place, x, h + 0.1, z, w, d, mats);
        place.addBlock(x, h + 1.0, z - 0.35, w * 0.54, 1.2, 1.0, mats.roof, true);
        place.addBlock(x, h + 1.6, z - 0.75, w * 0.34, 0.44, 0.24, spec.signMat || mats.signBlue, false);
        if (spec.profile === 'west') {
            place.addBlock(x - 0.82, h + 0.62, z + 0.42, 1.56, 0.92, 1.26, mats.roof, false);
            addTickerRibbon(x + 0.2, h + 1.88, z + 0.64, 2.6, place, mats);
        } else if (spec.profile === 'east') {
            place.addBlock(x + 0.94, h + 0.5, z - 0.48, 1.74, 0.82, 1.2, mats.roof, false);
            addGlowStrip(place, x, h + 1.92, z - 0.94, 2.1, 0.16, mats, ctx, 0x84d8ff, 2.6);
        }
    }

    function buildArcadeSupport(x, z, place, mats, ctx) {
        place.addBlock(x, 3.9, z, 8.2, 7.8, 5.8, mats.stoneDark, true);
        addWindowStack(place, x, 3.2, z, 8.2, 5.8, 3, 1.8, mats, 0.58, 0.46);
        addCornice(place, x, 7.95, z, 8.2, 5.8, mats);
        place.addBlock(x + 0.2, 1.35, z + 2.46, 7.0, 1.3, 1.1, mats.stoneMid, true);
        place.addBlock(x + 0.2, 2.18, z + 2.82, 6.2, 0.14, 0.18, mats.signRed, false);
        place.addBlock(x - 2.34, 1.9, z - 1.2, 1.2, 2.4, 1.6, mats.stoneLight, false);
        addTickerRibbon(x + 1.1, 7.86, z + 0.78, 2.8, place, mats);
        addGlowStrip(place, x - 1.2, 6.42, z - 2.36, 2.4, 0.18, mats, ctx, 0xffcf70, 2.2);
    }

    function buildTickerSupport(x, z, place, mats, ctx) {
        place.addBlock(x, 3.2, z, 6.6, 6.4, 4.8, mats.stoneDark, true);
        addWindowStack(place, x, 2.95, z, 6.6, 4.8, 3, 1.62, mats, 0.56, 0.44);
        addCornice(place, x, 6.62, z, 6.6, 4.8, mats);
        place.addBlock(x - 0.18, 4.95, z - 2.54, 4.4, 0.46, 0.16, mats.signBlue, false);
        place.addBlock(x + 1.64, 4.1, z + 1.28, 0.74, 3.4, 0.74, mats.stoneMid, false);
        place.addBlock(x - 1.9, 1.2, z + 1.48, 2.2, 2.0, 1.4, mats.glass, false);
        addGlowStrip(place, x, 6.24, z - 2.7, 4.0, 0.16, mats, ctx, 0x84d8ff, 1.5);
        addTickerRibbon(x - 0.92, 7.18, z + 0.8, 2.3, place, mats);
    }

    function buildTickerKiosk(x, z, place, mats, ctx, phaseOffset) {
        place.addBlock(x, 3.4, z, 6.8, 6.8, 5.0, mats.stoneDark, true);
        addWindowStack(place, x, 3.05, z, 6.8, 5.0, 2, 1.7, mats, 0.58, 0.4);
        addCornice(place, x, 6.95, z, 6.8, 5.0, mats);
        place.addBlock(x, 5.9, z - 2.72, 4.6, 0.46, 0.16, mats.signRed, false);
        place.addBlock(x - 2.2, 4.0, z + 1.7, 0.66, 3.8, 0.66, mats.stoneMid, true);
        place.addBlock(x + 2.2, 4.0, z - 1.7, 0.66, 3.8, 0.66, mats.stoneMid, true);
        addGlowStrip(place, x, 5.95, z - 2.86, 4.2, 0.16, mats, ctx, 0xffcf70, phaseOffset || 0.4);
        addTickerRibbon(x, 7.32, z + 1.42, 2.2, place, mats);
    }

    function buildGlassBusStop(x, z, place, mats) {
        place.addBlock(x, 0.12, z, 6.2, 0.24, 3.8, mats.pavement, true);
        place.addBlock(x, 0.56, z + 0.42, 3.2, 0.32, 0.86, mats.stoneDark, true);
        place.addBlock(x, 2.42, z, 5.4, 0.28, 3.1, mats.stoneDark, true);
        place.addBlock(x - 2.12, 1.18, z - 1.08, 0.18, 2.36, 0.18, mats.stoneMid, true);
        place.addBlock(x + 2.12, 1.18, z - 1.08, 0.18, 2.36, 0.18, mats.stoneMid, true);
        place.addBlock(x - 1.92, 1.18, z + 1.08, 0.18, 2.36, 0.18, mats.stoneMid, true);
        place.addBlock(x + 1.92, 1.18, z + 1.08, 0.18, 2.36, 0.18, mats.stoneMid, true);
        place.addBlock(x, 1.2, z + 1.32, 4.4, 1.96, 0.12, mats.glass, false);
        place.addBlock(x - 2.0, 1.2, z - 0.08, 0.12, 1.96, 2.42, mats.glass, false);
        place.addBlock(x + 2.0, 1.2, z - 0.08, 0.12, 1.96, 2.42, mats.glass, false);
        place.addBlock(x, 1.7, z + 1.26, 3.2, 0.92, 0.08, mats.paper, false);
        place.addBlock(x, 1.68, z + 1.2, 2.7, 0.54, 0.1, mats.signBlue, false);
        place.addBlock(x, 1.08, z - 1.14, 4.1, 0.12, 0.12, mats.trim, false);
        place.addBlock(x - 2.54, 1.58, z - 1.2, 0.18, 3.16, 0.18, mats.stoneDark, false);
        place.addBlock(x - 2.34, 2.82, z - 1.2, 0.82, 0.26, 0.18, mats.signBlue, false);
    }

    function buildPlanter(x, z, w, d, place, mats) {
        place.addBlock(x, 0.56, z, w, 1.12, d, mats.stoneMid, true);
        place.addBlock(x, 0.98, z, w * 0.82, 0.5, d * 0.82, mats.hedge, false);
    }

    function buildAlleyArch(x, z, width, depth, place, mats) {
        place.addBlock(x - (width * 0.5) + 0.42, 2.5, z, 0.84, 5.0, depth, mats.stoneMid, true);
        place.addBlock(x + (width * 0.5) - 0.42, 2.5, z, 0.84, 5.0, depth, mats.stoneMid, true);
        place.addBlock(x, 4.85, z, width, 0.7, depth, mats.stoneMid, true);
        place.addBlock(x, 5.5, z, width * 0.68, 0.22, 0.2, mats.signBlue, false);
    }

    function buildStreetDressings(bounds, centerX, place, mats, ctx) {
        var westPlanter = { pos: pt(bounds, 0.38, 0.46), w: 3.4, d: 1.8 };
        var eastPlanter = { pos: pt(bounds, 0.61, 0.43), w: 2.6, d: 1.5 };
        var statue = pt(bounds, 0.50, 0.54);
        var westPocket = { pos: pt(bounds, 0.30, 0.58), w: 2.8, d: 1.6 };
        var westBuffer = { pos: pt(bounds, 0.24, 0.50), w: 1.8, d: 1.1 };
        var eastPocket = { pos: pt(bounds, 0.70, 0.53), w: 2.0, d: 1.2 };
        var northMedian = { pos: pt(bounds, 0.47, 0.36), w: 2.2, d: 1.1 };
        var centerLipWest = { pos: pt(bounds, 0.46, 0.56), w: 1.8, d: 1.0 };
        var centerLipEast = { pos: pt(bounds, 0.58, 0.60), w: 1.8, d: 1.0 };
        var lampA = pt(bounds, 0.45, 0.47);
        var lampB = pt(bounds, 0.60, 0.45);
        var westArch = { pos: pt(bounds, 0.31, 0.67), width: 3.5, depth: 1.24 };
        var eastArch = { pos: pt(bounds, 0.69, 0.63), width: 2.8, depth: 1.0 };

        buildPlanter(westPlanter.pos.x, westPlanter.pos.z, westPlanter.w, westPlanter.d, place, mats);
        buildPlanter(eastPlanter.pos.x, eastPlanter.pos.z, eastPlanter.w, eastPlanter.d, place, mats);
        buildPlanter(westPocket.pos.x, westPocket.pos.z, westPocket.w, westPocket.d, place, mats);
        buildPlanter(westBuffer.pos.x, westBuffer.pos.z, westBuffer.w, westBuffer.d, place, mats);
        buildPlanter(eastPocket.pos.x, eastPocket.pos.z, eastPocket.w, eastPocket.d, place, mats);
        buildPlanter(northMedian.pos.x, northMedian.pos.z, northMedian.w, northMedian.d, place, mats);
        buildPlanter(centerLipWest.pos.x, centerLipWest.pos.z, centerLipWest.w, centerLipWest.d, place, mats);
        buildPlanter(centerLipEast.pos.x, centerLipEast.pos.z, centerLipEast.w, centerLipEast.d, place, mats);

        place.addBlock(statue.x, 1.0, statue.z, 4.6, 2.0, 1.7, mats.stoneDark, true);
        place.addBlock(statue.x, 2.56, statue.z, 0.56, 3.12, 0.56, mats.trim, false);
        place.addBlock(statue.x, 4.2, statue.z, 2.2, 0.32, 2.2, mats.trim, false);
        place.addBlock(statue.x, 0.12, statue.z, 8.0, 0.24, 1.0, mats.signRed, false);

        place.addBlock(centerX - 9.6, 0.24, statue.z + 0.72, 2.2, 0.48, 1.4, mats.stoneDark, true);
        place.addBlock(centerX + 8.4, 0.24, statue.z - 0.2, 1.5, 0.42, 1.0, mats.stoneDark, true);

        buildAlleyArch(westArch.pos.x, westArch.pos.z, westArch.width, westArch.depth, place, mats);
        buildAlleyArch(eastArch.pos.x, eastArch.pos.z, eastArch.width, eastArch.depth, place, mats);
        place.addBlock(westArch.pos.x + 1.4, 8.3, westArch.pos.z + 0.34, 2.4, 1.0, 3.2, mats.stoneDark, false);
        place.addBlock(eastArch.pos.x - 0.96, 7.9, eastArch.pos.z - 0.14, 1.5, 0.82, 2.1, mats.stoneDark, false);
        addTickerRibbon(westArch.pos.x - 0.06, 9.08, westArch.pos.z + 0.62, 3.5, place, mats);
        addTickerRibbon(eastArch.pos.x + 0.06, 8.64, eastArch.pos.z + 0.36, 2.2, place, mats);
        addStreetLamp(lampA.x, lampA.z, place, mats, ctx, 0.8);
        addStreetLamp(lampB.x, lampB.z, place, mats, ctx, 2.1);

        return {
            centerCoverCount: 7,
            westAlleyCoverCount: 4,
            eastAlleyCoverCount: 2
        };
    }

    function buildBasinQuadrant(bounds, place, ctx) {
        var mats = ensureMats();
        var centerX = (bounds.minX + bounds.maxX) * 0.5;
        var exchange = pt(bounds, 0.50, 0.84);
        var tower = pt(bounds, 0.50, 0.94);
        var westBlock = pt(bounds, 0.25, 0.62);
        var eastBlock = pt(bounds, 0.81, 0.60);
        var westKiosk = pt(bounds, 0.28, 0.36);
        var eastKiosk = pt(bounds, 0.74, 0.34);
        var westOffice = pt(bounds, 0.15, 0.24);
        var eastOffice = pt(bounds, 0.86, 0.24);
        var westSupport = pt(bounds, 0.39, 0.44);
        var eastSupport = pt(bounds, 0.66, 0.41);
        var westBusStop = pt(bounds, 0.30, 0.41);
        var eastBusStop = pt(bounds, 0.69, 0.39);
        var streetBand = pt(bounds, 0.50, 0.39);
        var northSupportCount = 4;

        place.addBlock(centerX, 0.06, streetBand.z, 34.0, 0.12, 9.4, mats.pavement, false);

        var rearWallStats = buildRearWallMask(bounds, centerX, place, mats);
        buildGrandStair(centerX, exchange.z - 0.6, place, mats);
        buildExchangeFrontage(centerX, exchange.z, bounds, place, mats, ctx);
        var towerStats = buildTowerStack(centerX, tower.z, bounds, place, mats, ctx);
        var westBlockStats = buildFinanceBlock({ x: westBlock.x, z: westBlock.z, w: 9.8, d: 16.4, h: 17.4, alleySide: 1, signMat: mats.signRed, profile: 'west' }, place, mats, ctx);
        var eastBlockStats = buildFinanceBlock({ x: eastBlock.x, z: eastBlock.z, w: 7.4, d: 13.2, h: 14.4, alleySide: -1, signMat: mats.signBlue, profile: 'east' }, place, mats, ctx);
        buildTickerKiosk(westKiosk.x, westKiosk.z, place, mats, ctx, 0.4);
        buildTickerKiosk(eastKiosk.x, eastKiosk.z, place, mats, ctx, 1.2);
        buildShortOffice({ x: westOffice.x, z: westOffice.z, w: 7.2, d: 5.8, h: 9.1, signMat: mats.signBlue, profile: 'west' }, place, mats, ctx);
        buildShortOffice({ x: eastOffice.x, z: eastOffice.z, w: 5.8, d: 5.0, h: 7.5, signMat: mats.signRed, profile: 'east' }, place, mats, ctx);
        buildArcadeSupport(westSupport.x, westSupport.z, place, mats, ctx);
        buildTickerSupport(eastSupport.x, eastSupport.z, place, mats, ctx);
        buildGlassBusStop(westBusStop.x, westBusStop.z, place, mats);
        buildGlassBusStop(eastBusStop.x, eastBusStop.z, place, mats);
        var dressingStats = buildStreetDressings(bounds, centerX, place, mats, ctx);

        if (ctx && typeof ctx.addExclusion === 'function') {
            ctx.addExclusion(centerX, tower.z - 1.5, 12.0);
            ctx.addExclusion(westBlock.x, westBlock.z, 5.3);
            ctx.addExclusion(eastBlock.x, eastBlock.z, 5.2);
            ctx.addExclusion(westKiosk.x, westKiosk.z, 3.15);
            ctx.addExclusion(eastKiosk.x, eastKiosk.z, 3.15);
            ctx.addExclusion(westOffice.x, westOffice.z, 2.9);
            ctx.addExclusion(eastOffice.x, eastOffice.z, 2.9);
            ctx.addExclusion(westSupport.x, westSupport.z, 3.4);
            ctx.addExclusion(eastSupport.x, eastSupport.z, 3.0);
            ctx.addExclusion(westBusStop.x, westBusStop.z, 3.2);
            ctx.addExclusion(eastBusStop.x, eastBusStop.z, 3.2);
        }

        return {
            towers: 1,
            heroBuildings: 2,
            financeBlocks: 6,
            alleys: 2,
            cover: 10,
            busStops: 2,
            towerPeakHeight: towerStats.peakHeight,
            upperShaftWidth: towerStats.upperShaftWidth,
            exchangeCenterZ: exchange.z,
            towerCenterZ: tower.z,
            rearWallSouthFaceZ: rearWallStats.southFaceZ,
            westBlockPeakHeight: westBlockStats.peakHeight,
            eastBlockPeakHeight: eastBlockStats.peakHeight,
            northSupportCount: northSupportCount,
            centerCoverCount: dressingStats.centerCoverCount,
            westAlleyCoverCount: dressingStats.westAlleyCoverCount,
            eastAlleyCoverCount: dressingStats.eastAlleyCoverCount
        };
    }

    var ns = (globalThis.__MAYHEM_RUNTIME.WorldQuadrants = globalThis.__MAYHEM_RUNTIME.WorldQuadrants || {});
    ns.basin = buildBasinQuadrant;
})();
