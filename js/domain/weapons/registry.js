(function () {
    'use strict';

    var GameWeaponRegistry = {};
    var DEFAULT_HANDLE = [0, 0, 0];
    var DEFAULT_BARREL_TIP = [0, 0, -0.58];
    var WEAPON_ORDER = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'seekergun'];

    function sharedTuning() {
        return (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning) ? globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning : null;
    }

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

    function buildVisualEntry(family, definition) {
        return {
            family: family,
            visual: gunVisual(definition)
        };
    }

    var weaponVisualEntries = {
        rifle: buildVisualEntry('hitscan', {
            gunPos: [0.0, 0.02, 0.08],
            gunRot: [0, 0, 0],
            body:   { p: [0, 0.0, -0.06], s: [1.0, 1.0, 1.0], c: 0x333333 },
            barrel: { p: [0, 0.02, -0.36], s: [1.0, 1.0, 1.0], c: 0x222222 },
            stock:  { p: [0, -0.04, 0.14], s: [1.0, 1.0, 1.0], c: 0x7a512d },
            grip:   { p: [0, -0.1, 0.02], s: [1.0, 1.0, 1.0], c: 0x7a512d },
            handlePos: [0, -0.1, 0.08],
            barrelTipPos: [0, 0.02, -0.56]
        }),
        pistol: buildVisualEntry('hitscan', {
            gunPos: [0.0, 0.03, 0.06],
            gunRot: [0.12, 0.05, 0],
            body:   { p: [0, -0.02, -0.06], s: [0.75, 0.85, 0.7], c: 0x3a3a3a },
            barrel: { p: [0, 0.0, -0.24], s: [0.68, 0.68, 0.65], c: 0x2c2c2c },
            stock:  { p: [0, -0.05, 0.09], s: [0.52, 0.85, 0.72], c: 0x6f4d32 },
            grip:   { p: [0, -0.14, -0.01], s: [0.9, 1.1, 1.25], c: 0x6f4d32 },
            handlePos: [0, -0.14, 0.01],
            barrelTipPos: [0, 0.0, -0.33]
        }),
        machinegun: buildVisualEntry('hitscan', {
            gunPos: [0.0, 0.02, 0.08],
            gunRot: [0, 0, 0],
            body:   { p: [0, 0.0, -0.08], s: [1.38, 1.05, 1.32], c: 0x2b2b2b },
            barrel: { p: [0, 0.03, -0.52], s: [1.18, 1.0, 1.62], c: 0x191919 },
            stock:  { p: [0, -0.03, 0.19], s: [1.2, 1.05, 1.18], c: 0x565656 },
            grip:   { p: [0, -0.11, 0.01], s: [1.0, 1.08, 1.0], c: 0x565656 },
            handlePos: [0, -0.11, 0.1],
            coil: true,
            barrelTipPos: [0, 0.03, -0.82]
        }),
        shotgun: buildVisualEntry('hitscan', {
            gunPos: [0.0, 0.02, 0.06],
            gunRot: [0, 0, 0],
            body:   { p: [0, 0.0, -0.1], s: [1.3, 1.06, 1.18], c: 0x6b4220 },
            barrel: { p: [0, 0.02, -0.47], s: [1.95, 1.12, 1.55], c: 0x222222 },
            stock:  { p: [0, -0.03, 0.21], s: [1.2, 1.04, 1.16], c: 0x8a5a2d },
            grip:   { p: [0, -0.1, 0.02], s: [1.02, 1.06, 1.02], c: 0x8a5a2d },
            handlePos: [0, -0.1, 0.08],
            pump: true,
            barrelTipPos: [0, 0.02, -0.86]
        }),
        sniper: buildVisualEntry('hitscan', {
            gunPos: [0.0, 0.02, 0.04],
            gunRot: [0, 0, 0],
            body:   { p: [0, -0.01, -0.16], s: [1.26, 0.9, 1.9], c: 0x2f3f2f },
            barrel: { p: [0, 0.02, -0.7], s: [0.8, 0.8, 2.95], c: 0x1c1c1c },
            stock:  { p: [0, -0.02, 0.22], s: [1.16, 1.0, 1.28], c: 0x5d3c1f },
            grip:   { p: [0, -0.11, 0.01], s: [1.0, 1.0, 1.0], c: 0x5d3c1f },
            handlePos: [0, -0.11, 0.11],
            scope: true,
            barrelTipPos: [0, 0.02, -1.34]
        }),
        seekergun: buildVisualEntry('seekerProjectile', {
            gunPos: [0.0, 0.03, 0.06],
            gunRot: [0.02, 0.02, 0],
            body:   { p: [0, 0.0, -0.06], s: [1.08, 1.04, 1.08], c: 0x254b57 },
            barrel: { p: [0, 0.02, -0.44], s: [0.88, 0.9, 1.18], c: 0x70d6ee },
            stock:  { p: [0, -0.03, 0.14], s: [1.0, 1.0, 1.0], c: 0x314f5d },
            grip:   { p: [0, -0.11, 0.01], s: [1.0, 1.0, 1.0], c: 0x314f5d },
            handlePos: [0, -0.11, 0.06],
            scope: true,
            coil: true,
            barrelTipPos: [0, 0.04, -0.72]
        })
    };

    function buildEntry(weaponId) {
        var tuning = sharedTuning();
        var stats = tuning && tuning.weaponStats ? tuning.weaponStats : {};
        var base = weaponVisualEntries[weaponId];
        if (!base) return null;
        return {
            family: base.family,
            stats: stats[weaponId] || null,
            visual: base.visual
        };
    }

    GameWeaponRegistry.get = function (weaponId) {
        return buildEntry(weaponId);
    };

    GameWeaponRegistry.getAll = function () {
        var out = {};
        for (var i = 0; i < WEAPON_ORDER.length; i++) {
            var weaponId = WEAPON_ORDER[i];
            out[weaponId] = buildEntry(weaponId);
        }
        return out;
    };

    globalThis.__MAYHEM_RUNTIME.GameWeaponRegistry = GameWeaponRegistry;
})();
