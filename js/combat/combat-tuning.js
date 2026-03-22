/**
 * combat-tuning.js - Compatibility combat tuning facade over shared tuning.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameCombatTuning
 */
(function () {
    'use strict';

    var GameCombatTuning = {};

    var DEFAULTS = {
        awareness: {
            segments: 8,
            radarRange: 56,
            coreRange: 10,
            beaconMinRange: 56,
            beaconMaxCount: 2
        },
        enemy: {
            fireRange: 34,
            headshotNearRange: 12,
            headshotMidRange: 22,
            defaultWallhackRadius: 90
        },
        throwables: {
            fragRadius: 6.8,
            plasmaRadius: 5.0,
            plasmaCatchRadius: 0.5,
            missileRadius: 2.4,
            molotovFireRadius: 3.8,
            plasmaAcquireRange: 0,
            plasmaAcquireHalfAngleDeg: 0,
            plasmaStickExplodeDelay: 2.2
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
            chokeLockBoxPx: 315,
            chokeRange: 26,
            chokeTargetTolerance: 1.35,
            chokeDuration: 1.25,
            chokeLiftHeight: 1.6,
            chokeTickRate: 0.25,
            chokeDotPerTick: 0,
            chokeCastDamage: 0,
            hookLockBoxPx: 150,
            hookReticleRadiusPx: 68,
            hookRange: 22,
            hookCastDamage: 20,
            hookStunDuration: 0.5,
            hookPullDistance: 4.0,
            hookCatchRadius: 1.8,
            hookTravelSpeed: 26,
            hookPullSpeed: 20,
            missileRange: 36,
            missileDamage: 70,
            missileRadius: 2.0,
            missileTravelSpeed: 34,
            missileAcquireRange: 6.0,
            missileCatchRadius: 1.1,
            missileLockHalfAngleDeg: 10,
            missileHomingBoost: 4.5,
            missileHomingLerp: 6.0,
            healDuration: 1.0,
            healAmount: 90,
            deadeyeLockBoxPx: 220,
            deadeyeLockRange: 60,
            deadeyeDuration: 1.6,
            deadeyeMaxTargets: 2,
            deadeyeDamage: 160
        }
    };

    function runtimeSharedTuning() {
        return (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning)
            ? globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning
            : null;
    }

    function deepCopy(data) {
        return JSON.parse(JSON.stringify(data));
    }

    function finiteOr(value, fallback) {
        var num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function sharedTuning() {
        return runtimeSharedTuning();
    }

    function copyMap(map) {
        var out = {};
        for (var key in map) {
            if (Object.prototype.hasOwnProperty.call(map, key)) {
                out[key] = map[key];
            }
        }
        return out;
    }

    function normalizeFalloffBands(bands) {
        if (!Array.isArray(bands) || bands.length === 0) return [];
        var out = [];
        for (var i = 0; i < bands.length; i++) {
            var band = bands[i] || {};
            var maxDistance = Number(band.maxDistance);
            var scale = Number(band.scale);
            if (!isFinite(maxDistance) || maxDistance <= 0) continue;
            if (!isFinite(scale)) continue;
            out.push({
                maxDistance: maxDistance,
                scale: Math.max(0, scale)
            });
        }
        out.sort(function (a, b) { return a.maxDistance - b.maxDistance; });
        return out;
    }

    var cachedClassAbilityTuning = null;

    function buildBase() {
        var shared = sharedTuning();
        if (!shared) return deepCopy(DEFAULTS);

        var throwables = shared.throwables || {};
        var classPresets = shared.classPresets || {};
        var catalog = shared.abilityCatalog || {};
        var choke = catalog.choke || {};
        var hook = catalog.hook || {};
        var missile = catalog.missile || {};
        var deadeye = catalog.deadeye || {};
        var heal = catalog.heal || {};

        return {
            awareness: shared.awareness || deepCopy(DEFAULTS.awareness),
            enemy: shared.enemy || deepCopy(DEFAULTS.enemy),
            throwables: {
                fragRadius: finiteOr(throwables.frag && throwables.frag.radius, DEFAULTS.throwables.fragRadius),
                plasmaRadius: finiteOr(throwables.plasma && throwables.plasma.radius, DEFAULTS.throwables.plasmaRadius),
                plasmaCatchRadius: finiteOr(throwables.plasma && throwables.plasma.catchRadius, DEFAULTS.throwables.plasmaCatchRadius),
                missileRadius: finiteOr(throwables.missile && throwables.missile.radius, DEFAULTS.throwables.missileRadius),
                molotovFireRadius: finiteOr(throwables.molotov && throwables.molotov.fireRadius, DEFAULTS.throwables.molotovFireRadius),
                plasmaAcquireRange: finiteOr(throwables.plasma && throwables.plasma.acquireRange, DEFAULTS.throwables.plasmaAcquireRange),
                plasmaAcquireHalfAngleDeg: finiteOr(throwables.plasma && throwables.plasma.acquireHalfAngleDeg, DEFAULTS.throwables.plasmaAcquireHalfAngleDeg),
                plasmaStickExplodeDelay: finiteOr(throwables.plasma && throwables.plasma.stickExplodeDelay, DEFAULTS.throwables.plasmaStickExplodeDelay)
            },
            throwableMechanics: shared.throwableMechanics || deepCopy(DEFAULTS.throwableMechanics),
            classWallhackRadius: {
                abilities: finiteOr(classPresets.abilities && classPresets.abilities.wallhackRadius, DEFAULTS.classWallhackRadius.abilities)
            },
            classAbilities: {
                chokeLockBoxPx: finiteOr(choke.lockBoxPx, DEFAULTS.classAbilities.chokeLockBoxPx),
                chokeRange: finiteOr(choke.range, DEFAULTS.classAbilities.chokeRange),
                chokeTargetTolerance: finiteOr(choke.targetTolerance, DEFAULTS.classAbilities.chokeTargetTolerance),
                chokeDuration: finiteOr(choke.duration, DEFAULTS.classAbilities.chokeDuration),
                chokeLiftHeight: finiteOr(choke.liftHeight, DEFAULTS.classAbilities.chokeLiftHeight),
                chokeTickRate: finiteOr(choke.tickRate, DEFAULTS.classAbilities.chokeTickRate),
                chokeDotPerTick: finiteOr(choke.dotPerTick, DEFAULTS.classAbilities.chokeDotPerTick),
                chokeCastDamage: finiteOr(choke.castDamage, DEFAULTS.classAbilities.chokeCastDamage),
                hookLockBoxPx: finiteOr(hook.lockBoxPx, DEFAULTS.classAbilities.hookLockBoxPx),
                hookReticleRadiusPx: finiteOr(hook.reticleRadiusPx, DEFAULTS.classAbilities.hookReticleRadiusPx),
                hookRange: finiteOr(hook.range, DEFAULTS.classAbilities.hookRange),
                hookCastDamage: finiteOr(hook.castDamage, DEFAULTS.classAbilities.hookCastDamage),
                hookStunDuration: finiteOr(hook.stunDuration, DEFAULTS.classAbilities.hookStunDuration),
                hookPullDistance: finiteOr(hook.pullDistance, DEFAULTS.classAbilities.hookPullDistance),
                hookCatchRadius: finiteOr(hook.catchRadius, DEFAULTS.classAbilities.hookCatchRadius),
                hookTravelSpeed: finiteOr(hook.travelSpeed, DEFAULTS.classAbilities.hookTravelSpeed),
                hookPullSpeed: finiteOr(hook.pullSpeed, DEFAULTS.classAbilities.hookPullSpeed),
                missileRange: finiteOr(missile.range, DEFAULTS.classAbilities.missileRange),
                missileDamage: finiteOr(missile.damage, DEFAULTS.classAbilities.missileDamage),
                missileRadius: finiteOr(missile.radius, DEFAULTS.classAbilities.missileRadius),
                missileTravelSpeed: finiteOr(missile.travelSpeed, DEFAULTS.classAbilities.missileTravelSpeed),
                missileAcquireRange: finiteOr(missile.acquireRange, DEFAULTS.classAbilities.missileAcquireRange),
                missileCatchRadius: finiteOr(missile.catchRadius, DEFAULTS.classAbilities.missileCatchRadius),
                missileLockHalfAngleDeg: finiteOr(missile.lockHalfAngleDeg, DEFAULTS.classAbilities.missileLockHalfAngleDeg),
                missileHomingBoost: finiteOr(missile.homingBoost, DEFAULTS.classAbilities.missileHomingBoost),
                missileHomingLerp: finiteOr(missile.homingLerp, DEFAULTS.classAbilities.missileHomingLerp),
                healDuration: finiteOr(heal.duration, DEFAULTS.classAbilities.healDuration),
                healAmount: finiteOr(heal.healAmount, DEFAULTS.classAbilities.healAmount),
                deadeyeLockBoxPx: DEFAULTS.classAbilities.deadeyeLockBoxPx,
                deadeyeLockRange: finiteOr(deadeye.range, DEFAULTS.classAbilities.deadeyeLockRange),
                deadeyeDuration: finiteOr(deadeye.duration, DEFAULTS.classAbilities.deadeyeDuration),
                deadeyeMaxTargets: finiteOr(deadeye.maxTargets, DEFAULTS.classAbilities.deadeyeMaxTargets),
                deadeyeDamage: finiteOr(deadeye.damage, DEFAULTS.classAbilities.deadeyeDamage)
            }
        };
    }

    GameCombatTuning.getAwarenessTuning = function () {
        var base = buildBase();
        return {
            segments: base.awareness.segments,
            radarRange: base.awareness.radarRange,
            coreRange: base.awareness.coreRange,
            beaconMinRange: base.awareness.beaconMinRange,
            beaconMaxCount: base.awareness.beaconMaxCount
        };
    };

    GameCombatTuning.getEnemyTuning = function () {
        var base = buildBase();
        return {
            fireRange: base.enemy.fireRange,
            headshotNearRange: base.enemy.headshotNearRange,
            headshotMidRange: base.enemy.headshotMidRange,
            defaultWallhackRadius: base.enemy.defaultWallhackRadius
        };
    };

    GameCombatTuning.getWeaponRange = function (weaponId) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var stats = shared.getWeaponStats
            ? shared.getWeaponStats(weaponId)
            : (((shared.gameplayTuning || {}).weaponStats || {})[String(weaponId || '')] || null);
        return Math.max(0, Number(stats && stats.maxRange || 0));
    };

    GameCombatTuning.getWeaponFalloffTuning = function (weaponId) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        if (shared.getWeaponFalloffProfile) {
            return normalizeFalloffBands(shared.getWeaponFalloffProfile(weaponId));
        }
        var tuning = shared.gameplayTuning || {};
        return normalizeFalloffBands(tuning.weaponFalloff && tuning.weaponFalloff[String(weaponId || '')]);
    };

    GameCombatTuning.getThrowableDistanceTuning = function () {
        var base = buildBase();
        return {
            fragRadius: base.throwables.fragRadius,
            plasmaRadius: base.throwables.plasmaRadius,
            plasmaCatchRadius: base.throwables.plasmaCatchRadius,
            missileRadius: base.throwables.missileRadius,
            molotovFireRadius: base.throwables.molotovFireRadius,
            plasmaAcquireRange: base.throwables.plasmaAcquireRange,
            plasmaAcquireHalfAngleDeg: base.throwables.plasmaAcquireHalfAngleDeg,
            plasmaStickExplodeDelay: base.throwables.plasmaStickExplodeDelay
        };
    };

    GameCombatTuning.getThrowableMechanicsTuning = function () {
        var base = buildBase();
        return {
            aimRayRange: base.throwableMechanics.aimRayRange,
            fragBounceMaxCount: base.throwableMechanics.fragBounceMaxCount,
            fragBounceVelocityDamping: base.throwableMechanics.fragBounceVelocityDamping,
            fragBounceVerticalDamping: base.throwableMechanics.fragBounceVerticalDamping,
            fragBounceStopSpeedSq: base.throwableMechanics.fragBounceStopSpeedSq,
            predictedTtlMs: base.throwableMechanics.predictedTtlMs,
            throwIntentOriginMaxOffset: base.throwableMechanics.throwIntentOriginMaxOffset,
            throwIntentDirectionMinDot: base.throwableMechanics.throwIntentDirectionMinDot
        };
    };

    GameCombatTuning.getClassWallhackRadius = function (classId) {
        var base = buildBase();
        var id = classId || 'abilities';
        var meters = base.classWallhackRadius[id];
        if (typeof meters !== 'number') meters = base.classWallhackRadius.abilities || 90;
        return meters;
    };

    GameCombatTuning.getClassAbilityTuning = function () {
        if (!cachedClassAbilityTuning) {
            cachedClassAbilityTuning = Object.freeze(copyMap(buildBase().classAbilities));
        }
        return cachedClassAbilityTuning;
    };

    GameCombatTuning.getRawSharedTuning = function () {
        var shared = sharedTuning();
        return shared ? deepCopy(shared) : null;
    };

    GameCombatTuning.debugDump = function () {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var weaponIds = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : [];
        var weaponRanges = {};
        var weaponFalloff = {};
        for (var i = 0; i < weaponIds.length; i++) {
            var weaponId = String(weaponIds[i] || '');
            weaponRanges[weaponId] = GameCombatTuning.getWeaponRange(weaponId);
            weaponFalloff[weaponId] = GameCombatTuning.getWeaponFalloffTuning(weaponId);
        }
        return {
            awareness: GameCombatTuning.getAwarenessTuning(),
            enemy: GameCombatTuning.getEnemyTuning(),
            weaponRanges: weaponRanges,
            weaponFalloff: weaponFalloff,
            throwables: GameCombatTuning.getThrowableDistanceTuning(),
            classWallhackRadius: {
                abilities: GameCombatTuning.getClassWallhackRadius('abilities')
            },
            classAbilities: GameCombatTuning.getClassAbilityTuning()
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameCombatTuning = GameCombatTuning;
})();
