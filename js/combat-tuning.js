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
            rifle: 118,
            pistol: 52,
            machinegun: 48,
            shotgun: 24,
            sniper: 160,
            seekergun: 28
        },
        weaponFalloff: {
            rifle: [
                { maxDistance: 24, scale: 1.0 },
                { maxDistance: 50, scale: 0.96 },
                { maxDistance: 86, scale: 0.88 },
                { maxDistance: 118, scale: 0.78 }
            ],
            pistol: [
                { maxDistance: 14, scale: 1.0 },
                { maxDistance: 24, scale: 0.88 },
                { maxDistance: 36, scale: 0.64 },
                { maxDistance: 52, scale: 0.4 }
            ],
            machinegun: [
                { maxDistance: 10, scale: 1.0 },
                { maxDistance: 18, scale: 0.82 },
                { maxDistance: 30, scale: 0.62 },
                { maxDistance: 48, scale: 0.42 }
            ],
            shotgun: [
                { maxDistance: 6, scale: 1.0 },
                { maxDistance: 11, scale: 0.68 },
                { maxDistance: 17, scale: 0.38 },
                { maxDistance: 24, scale: 0.12 }
            ],
            sniper: [
                { maxDistance: 55, scale: 1.0 },
                { maxDistance: 105, scale: 1.0 },
                { maxDistance: 135, scale: 0.94 },
                { maxDistance: 160, scale: 0.86 }
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
            abilities: 90
        },
        classAbilities: {
            chokeLockBoxPx: 190,
            chokeRange: 24,
            chokeDuration: 1.6,
            chokeLiftHeight: 1.0,
            chokeTickRate: 0.25,
            chokeDotPerTick: 0,
            chokeCastDamage: 95,
            hookLockBoxPx: 170,
            hookReticleRadiusPx: 52,
            hookRange: 26,
            hookCastDamage: 50,
            hookStunDuration: 0.7,
            hookPullDistance: 3.2,
            hookCatchRadius: 1.8,
            hookTravelSpeed: 26,
            healDuration: 0.85,
            healAmount: 100,
            deadeyeLockBoxPx: 220,
            deadeyeLockRange: 80,
            deadeyeDuration: 2.0,
            deadeyeMaxTargets: 3,
            deadeyeDamage: 260
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
        var catalog = shared.abilityCatalog || {};
        var choke = catalog.choke || {};
        var hook = catalog.hook || {};
        var deadeye = catalog.deadeye || {};
        var heal = catalog.heal || {};

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
                abilities: Number(classPresets.abilities && classPresets.abilities.wallhackRadius) || DEFAULTS.classWallhackRadius.abilities
            },
            classAbilities: {
                chokeLockBoxPx: Number(choke.lockBoxPx) || DEFAULTS.classAbilities.chokeLockBoxPx,
                chokeRange: Number(choke.range) || DEFAULTS.classAbilities.chokeRange,
                chokeDuration: Number(choke.duration) || DEFAULTS.classAbilities.chokeDuration,
                chokeLiftHeight: Number(choke.liftHeight) || DEFAULTS.classAbilities.chokeLiftHeight,
                chokeTickRate: Number(choke.tickRate) || DEFAULTS.classAbilities.chokeTickRate,
                chokeDotPerTick: Number(choke.dotPerTick) || DEFAULTS.classAbilities.chokeDotPerTick,
                chokeCastDamage: Number(choke.castDamage) || DEFAULTS.classAbilities.chokeCastDamage,
                hookLockBoxPx: Number(hook.lockBoxPx) || DEFAULTS.classAbilities.hookLockBoxPx,
                hookReticleRadiusPx: Number(hook.reticleRadiusPx) || DEFAULTS.classAbilities.hookReticleRadiusPx,
                hookRange: Number(hook.range) || DEFAULTS.classAbilities.hookRange,
                hookCastDamage: Number(hook.castDamage) || DEFAULTS.classAbilities.hookCastDamage,
                hookStunDuration: Number(hook.stunDuration) || DEFAULTS.classAbilities.hookStunDuration,
                hookPullDistance: Number(hook.pullDistance) || DEFAULTS.classAbilities.hookPullDistance,
                hookCatchRadius: Number(hook.catchRadius) || DEFAULTS.classAbilities.hookCatchRadius,
                hookTravelSpeed: Number(hook.travelSpeed) || DEFAULTS.classAbilities.hookTravelSpeed,
                healDuration: Number(heal.duration) || DEFAULTS.classAbilities.healDuration,
                healAmount: Number(heal.healAmount) || DEFAULTS.classAbilities.healAmount,
                deadeyeLockBoxPx: DEFAULTS.classAbilities.deadeyeLockBoxPx,
                deadeyeLockRange: Number(deadeye.range) || DEFAULTS.classAbilities.deadeyeLockRange,
                deadeyeDuration: Number(deadeye.duration) || DEFAULTS.classAbilities.deadeyeDuration,
                deadeyeMaxTargets: Number(deadeye.maxTargets) || DEFAULTS.classAbilities.deadeyeMaxTargets,
                deadeyeDamage: Number(deadeye.damage) || DEFAULTS.classAbilities.deadeyeDamage
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
        var id = classId || 'abilities';
        var meters = BASE.classWallhackRadius[id];
        if (typeof meters !== 'number') meters = BASE.classWallhackRadius.abilities || 90;
        return scaleDistance(meters);
    };

    GameCombatTuning.getClassAbilityTuning = function () {
        return scaledCopy(BASE.classAbilities);
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
                abilities: GameCombatTuning.getClassWallhackRadius('abilities')
            },
            classAbilities: GameCombatTuning.getClassAbilityTuning()
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameCombatTuning = GameCombatTuning;
})();
