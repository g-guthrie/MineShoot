/**
 * combat-tuning.js - Canonical combat distance tuning (meters/world-units)
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameCombatTuning
 */
(function () {
    'use strict';

    var GameCombatTuning = {};

    var DEFAULTS = {
        awareness: {
            segments: 8,
            radarRange: 35,
            coreRange: 10,
            beaconMinRange: 35,
            beaconMaxCount: 2
        },
        enemy: {
            fireRange: 34,
            headshotNearRange: 12,
            headshotMidRange: 22,
            defaultWallhackRadius: 90
        },
        weapons: {
            rifle: 100,
            pistol: 54,
            machinegun: 40,
            shotgun: 22,
            sniper: 99999,
            seekergun: 28
        },
        weaponFalloff: {
            rifle: [
                { maxDistance: 24, scale: 1.0 },
                { maxDistance: 42, scale: 0.95 },
                { maxDistance: 68, scale: 0.87 },
                { maxDistance: 100, scale: 0.74 }
            ],
            pistol: [
                { maxDistance: 12, scale: 1.0 },
                { maxDistance: 22, scale: 0.84 },
                { maxDistance: 34, scale: 0.60 },
                { maxDistance: 54, scale: 0.40 }
            ],
            machinegun: [
                { maxDistance: 8, scale: 1.0 },
                { maxDistance: 15, scale: 0.76 },
                { maxDistance: 24, scale: 0.50 },
                { maxDistance: 40, scale: 0.28 }
            ],
            shotgun: [
                { maxDistance: 6, scale: 1.0 },
                { maxDistance: 10, scale: 0.70 },
                { maxDistance: 15, scale: 0.40 },
                { maxDistance: 22, scale: 0.15 }
            ],
            sniper: [
                { maxDistance: 99999, scale: 1.0 }
            ],
            seekergun: [
                { maxDistance: 28, scale: 1.0 }
            ]
        },
        throwables: {
            fragRadius: 5.4,
            seekerRadius: 5.0,
            seekerShotRadius: 4.6,
            molotovFireRadius: 3.2,
            seekerAcquireRange: 18,
            seekerAcquireHalfAngleDeg: 35,
            seekerStickExplodeDelay: 0.65
        },
        throwableMechanics: {
            aimRayRange: 100,
            fragBounceMaxCount: 2,
            fragBounceVelocityDamping: 0.4,
            fragBounceVerticalDamping: 0.42,
            fragBounceStopSpeedSq: 2.5,
            predictedTtlMs: 5000,
            throwIntentOriginMaxOffset: 1.2,
            throwIntentDirectionMinDot: -0.2
        },
        classWallhackRadius: {
            default: 90
        }
    };

    function deepCopy(data) {
        return JSON.parse(JSON.stringify(data));
    }

    function sharedTuning() {
        return (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning)
            ? globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning
            : null;
    }

    function buildBase() {
        var shared = sharedTuning();
        if (!shared) return deepCopy(DEFAULTS);

        var weapons = shared.weaponStats || {};
        var throwables = shared.throwables || {};
        var classPresets = shared.classPresets || {};

        return {
            awareness: shared.awareness || deepCopy(DEFAULTS.awareness),
            enemy: shared.enemy || deepCopy(DEFAULTS.enemy),
            weapons: {
                rifle: Number(weapons.rifle && weapons.rifle.maxRange) || DEFAULTS.weapons.rifle,
                pistol: Number(weapons.pistol && weapons.pistol.maxRange) || DEFAULTS.weapons.pistol,
                machinegun: Number(weapons.machinegun && weapons.machinegun.maxRange) || DEFAULTS.weapons.machinegun,
                shotgun: Number(weapons.shotgun && weapons.shotgun.maxRange) || DEFAULTS.weapons.shotgun,
                sniper: Number(weapons.sniper && weapons.sniper.maxRange) || DEFAULTS.weapons.sniper,
                seekergun: Number(weapons.seekergun && weapons.seekergun.maxRange) || DEFAULTS.weapons.seekergun
            },
            weaponFalloff: shared.weaponFalloff || deepCopy(DEFAULTS.weaponFalloff),
            throwables: {
                fragRadius: Number(throwables.frag && throwables.frag.radius) || DEFAULTS.throwables.fragRadius,
                seekerRadius: Number(throwables.seeker && throwables.seeker.radius) || DEFAULTS.throwables.seekerRadius,
                seekerShotRadius: Number(throwables.seekershot && throwables.seekershot.radius) || DEFAULTS.throwables.seekerShotRadius,
                molotovFireRadius: Number(throwables.molotov && throwables.molotov.fireRadius) || DEFAULTS.throwables.molotovFireRadius,
                seekerAcquireRange: Number(throwables.seeker && throwables.seeker.acquireRange) || DEFAULTS.throwables.seekerAcquireRange,
                seekerAcquireHalfAngleDeg: Number(throwables.seeker && throwables.seeker.acquireHalfAngleDeg) || DEFAULTS.throwables.seekerAcquireHalfAngleDeg,
                seekerStickExplodeDelay: Number(throwables.seeker && throwables.seeker.stickExplodeDelay) || DEFAULTS.throwables.seekerStickExplodeDelay
            },
            throwableMechanics: shared.throwableMechanics || deepCopy(DEFAULTS.throwableMechanics),
            classWallhackRadius: {
                default: Number(classPresets.default && classPresets.default.wallhackRadius) || DEFAULTS.classWallhackRadius.default
            }
        };
    }

    var BASE = buildBase();

    function scaleDistance(meters) {
        if (globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.scaleCombatDistance) {
            return globalThis.__MAYHEM_RUNTIME.GameWorld.scaleCombatDistance(meters);
        }
        return meters;
    }

    function scaledCopy(map) {
        var out = {};
        for (var key in map) {
            if (Object.prototype.hasOwnProperty.call(map, key)) {
                out[key] = scaleDistance(map[key]);
            }
        }
        return out;
    }

    function normalizeAndScaleFalloffBands(bands) {
        if (!Array.isArray(bands) || bands.length === 0) return [];
        var out = [];
        for (var i = 0; i < bands.length; i++) {
            var band = bands[i] || {};
            var maxDistance = Number(band.maxDistance);
            var scale = Number(band.scale);
            if (!isFinite(maxDistance) || maxDistance <= 0) continue;
            if (!isFinite(scale)) continue;
            out.push({
                maxDistance: scaleDistance(maxDistance),
                scale: Math.max(0, scale)
            });
        }
        out.sort(function (a, b) { return a.maxDistance - b.maxDistance; });
        return out;
    }

    GameCombatTuning.getAwarenessTuning = function () {
        return {
            segments: BASE.awareness.segments,
            radarRange: scaleDistance(BASE.awareness.radarRange),
            coreRange: scaleDistance(BASE.awareness.coreRange),
            beaconMinRange: scaleDistance(BASE.awareness.beaconMinRange),
            beaconMaxCount: BASE.awareness.beaconMaxCount
        };
    };

    GameCombatTuning.getEnemyTuning = function () {
        return {
            fireRange: scaleDistance(BASE.enemy.fireRange),
            headshotNearRange: scaleDistance(BASE.enemy.headshotNearRange),
            headshotMidRange: scaleDistance(BASE.enemy.headshotMidRange),
            defaultWallhackRadius: scaleDistance(BASE.enemy.defaultWallhackRadius)
        };
    };

    GameCombatTuning.getWeaponRange = function (weaponId) {
        var meters = BASE.weapons[weaponId];
        if (typeof meters !== 'number') return 0;
        return scaleDistance(meters);
    };

    GameCombatTuning.getWeaponFalloffTuning = function (weaponId) {
        var id = String(weaponId || '');
        var sharedMap = BASE.weaponFalloff || {};
        var fallbackMap = DEFAULTS.weaponFalloff || {};
        var profile = sharedMap[id] || fallbackMap[id] || [];
        return normalizeAndScaleFalloffBands(profile);
    };

    GameCombatTuning.getThrowableDistanceTuning = function () {
        return {
            fragRadius: scaleDistance(BASE.throwables.fragRadius),
            seekerRadius: scaleDistance(BASE.throwables.seekerRadius),
            seekerShotRadius: scaleDistance(BASE.throwables.seekerShotRadius),
            molotovFireRadius: scaleDistance(BASE.throwables.molotovFireRadius),
            seekerAcquireRange: scaleDistance(BASE.throwables.seekerAcquireRange),
            seekerAcquireHalfAngleDeg: BASE.throwables.seekerAcquireHalfAngleDeg,
            seekerStickExplodeDelay: BASE.throwables.seekerStickExplodeDelay
        };
    };

    GameCombatTuning.getThrowableMechanicsTuning = function () {
        return {
            aimRayRange: scaleDistance(BASE.throwableMechanics.aimRayRange),
            fragBounceMaxCount: BASE.throwableMechanics.fragBounceMaxCount,
            fragBounceVelocityDamping: BASE.throwableMechanics.fragBounceVelocityDamping,
            fragBounceVerticalDamping: BASE.throwableMechanics.fragBounceVerticalDamping,
            fragBounceStopSpeedSq: BASE.throwableMechanics.fragBounceStopSpeedSq,
            predictedTtlMs: BASE.throwableMechanics.predictedTtlMs,
            throwIntentOriginMaxOffset: scaleDistance(BASE.throwableMechanics.throwIntentOriginMaxOffset),
            throwIntentDirectionMinDot: BASE.throwableMechanics.throwIntentDirectionMinDot
        };
    };

    GameCombatTuning.getClassWallhackRadius = function (classId) {
        var id = classId || 'default';
        var meters = BASE.classWallhackRadius[id];
        if (typeof meters !== 'number') meters = BASE.classWallhackRadius.default || 90;
        return scaleDistance(meters);
    };

    GameCombatTuning.getRawSharedTuning = function () {
        var shared = sharedTuning();
        return shared ? deepCopy(shared) : null;
    };

    GameCombatTuning.debugDump = function () {
        return {
            combatScale: (globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.getCombatScale) ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCombatScale() : 1,
            awareness: GameCombatTuning.getAwarenessTuning(),
            enemy: GameCombatTuning.getEnemyTuning(),
            weaponRanges: {
                rifle: GameCombatTuning.getWeaponRange('rifle'),
                pistol: GameCombatTuning.getWeaponRange('pistol'),
                machinegun: GameCombatTuning.getWeaponRange('machinegun'),
                shotgun: GameCombatTuning.getWeaponRange('shotgun'),
                sniper: GameCombatTuning.getWeaponRange('sniper'),
                seekergun: GameCombatTuning.getWeaponRange('seekergun')
            },
            weaponFalloff: {
                rifle: GameCombatTuning.getWeaponFalloffTuning('rifle'),
                pistol: GameCombatTuning.getWeaponFalloffTuning('pistol'),
                machinegun: GameCombatTuning.getWeaponFalloffTuning('machinegun'),
                shotgun: GameCombatTuning.getWeaponFalloffTuning('shotgun'),
                sniper: GameCombatTuning.getWeaponFalloffTuning('sniper'),
                seekergun: GameCombatTuning.getWeaponFalloffTuning('seekergun')
            },
            throwables: GameCombatTuning.getThrowableDistanceTuning(),
            classWallhackRadius: {
                default: GameCombatTuning.getClassWallhackRadius('default')
            }
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameCombatTuning = GameCombatTuning;
})();
