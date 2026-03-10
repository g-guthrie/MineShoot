(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var DEFAULT_HANDLE = [0, 0, 0];
    var DEFAULT_BARREL_TIP = [0, 0, -0.58];

    function gunVisual(definition) {
        var visual = definition || {};
        return {
            classId: 'gun',
            mount: {
                position: visual.gunPos || [0, 0, 0],
                rotation: visual.gunRot || [0, 0, 0]
            },
            parts: {
                body: visual.body || null,
                barrel: visual.barrel || null,
                stock: visual.stock || null,
                grip: visual.grip || null,
                scope: !!visual.scope,
                pump: !!visual.pump,
                coil: !!visual.coil
            },
            anchors: {
                handle: visual.handlePos || DEFAULT_HANDLE,
                barrelTip: visual.barrelTipPos || DEFAULT_BARREL_TIP,
                support: visual.supportPos || [0, -0.01, (visual.barrel && visual.barrel.p ? visual.barrel.p[2] * 0.6 : -0.28)]
            },
            effects: {
                muzzleFlash: {
                    position: visual.barrelTipPos || DEFAULT_BARREL_TIP
                }
            }
        };
    }

    var weaponVisualEntries = {
        rifle: gunVisual({
            gunPos: [0.0, 0.02, 0.08],
            gunRot: [0, 0, 0],
            body:   { p: [0, 0.0, -0.06], s: [1.0, 1.0, 1.0], c: 0x333333 },
            barrel: { p: [0, 0.02, -0.36], s: [1.0, 1.0, 1.0], c: 0x222222 },
            stock:  { p: [0, -0.04, 0.14], s: [1.0, 1.0, 1.0], c: 0x7a512d },
            grip:   { p: [0, -0.1, 0.02], s: [1.0, 1.0, 1.0], c: 0x7a512d },
            handlePos: [0, -0.1, 0.08],
            supportPos: [-0.05, -0.03, -0.34],
            barrelTipPos: [0, 0.02, -0.56]
        }),
        pistol: gunVisual({
            gunPos: [0.0, 0.03, 0.06],
            gunRot: [0.12, 0.05, 0],
            body:   { p: [0, -0.02, -0.06], s: [0.75, 0.85, 0.7], c: 0x3a3a3a },
            barrel: { p: [0, 0.0, -0.24], s: [0.68, 0.68, 0.65], c: 0x2c2c2c },
            stock:  { p: [0, -0.05, 0.09], s: [0.52, 0.85, 0.72], c: 0x6f4d32 },
            grip:   { p: [0, -0.14, -0.01], s: [0.9, 1.1, 1.25], c: 0x6f4d32 },
            handlePos: [0, -0.135, 0.02],
            supportPos: [-0.02, -0.055, -0.1],
            barrelTipPos: [0, 0.005, -0.44]
        }),
        machinegun: gunVisual({
            gunPos: [0.0, 0.02, 0.08],
            gunRot: [0, 0, 0],
            body:   { p: [0, 0.0, -0.08], s: [1.38, 1.05, 1.32], c: 0x2b2b2b },
            barrel: { p: [0, 0.03, -0.52], s: [1.18, 1.0, 1.62], c: 0x191919 },
            stock:  { p: [0, -0.03, 0.19], s: [1.2, 1.05, 1.18], c: 0x565656 },
            grip:   { p: [0, -0.11, 0.01], s: [1.0, 1.08, 1.0], c: 0x565656 },
            handlePos: [0, -0.08, 0.1],
            supportPos: [-0.08, -0.03, -0.32],
            barrelTipPos: [0, 0.02, -0.9]
        }),
        shotgun: gunVisual({
            gunPos: [0.0, 0.02, 0.08],
            gunRot: [0, 0, 0],
            body:   { p: [0, 0.0, -0.1], s: [1.3, 1.06, 1.18], c: 0x6b4220 },
            barrel: { p: [0, 0.02, -0.47], s: [1.95, 1.12, 1.55], c: 0x222222 },
            stock:  { p: [0, -0.03, 0.21], s: [1.2, 1.04, 1.16], c: 0x8a5a2d },
            grip:   { p: [0, -0.1, 0.02], s: [1.02, 1.06, 1.02], c: 0x8a5a2d },
            handlePos: [0, -0.1, 0.08],
            pump: true,
            supportPos: [-0.05, -0.03, -0.44],
            barrelTipPos: [0, 0.02, -0.86]
        }),
        sniper: gunVisual({
            gunPos: [0.0, 0.02, 0.04],
            gunRot: [0, 0, 0],
            body:   { p: [0, -0.01, -0.16], s: [1.26, 0.9, 1.9], c: 0x2f3f2f },
            barrel: { p: [0, 0.02, -0.7], s: [0.8, 0.8, 2.95], c: 0x1c1c1c },
            stock:  { p: [0, -0.02, 0.22], s: [1.16, 1.0, 1.28], c: 0x5d3c1f },
            grip:   { p: [0, -0.11, 0.01], s: [1.0, 1.0, 1.0], c: 0x5d3c1f },
            handlePos: [0, -0.11, 0.11],
            scope: true,
            supportPos: [-0.035, 0.005, -0.42],
            barrelTipPos: [0, 0.02, -1.34]
        })
    };

    runtime.GameWeaponVisuals = {
        get: function (weaponId) {
            var resolvedId = Object.prototype.hasOwnProperty.call(weaponVisualEntries, weaponId) ? weaponId : 'rifle';
            return {
                weaponId: resolvedId,
                visual: weaponVisualEntries[resolvedId]
            };
        }
    };
})();
