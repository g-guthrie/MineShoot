/**
 * combat-tuning.js - Compatibility combat tuning facade over shared tuning.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameCombatTuning
 */
(function () {
    'use strict';

    var GameCombatTuning = {};

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

    function normalizeFalloffProfile(profile) {
        if (!profile || typeof profile !== 'object') return null;
        var start = Number(profile.start);
        var end = Number(profile.end);
        var minScalar = Number(profile.minScalar);
        if (!isFinite(start) || !isFinite(end) || !isFinite(minScalar)) return null;
        return {
            start: Math.max(0, start),
            end: Math.max(Math.max(0, start), end),
            minScalar: Math.max(0, Math.min(1, minScalar))
        };
    }

    var cachedClassAbilityTuning = null;

    function buildBase() {
        var shared = sharedTuning() || {};
        var throwables = shared.throwables || {};
        var classPresets = shared.classPresets || {};
        var catalog = shared.abilityCatalog || {};
        var choke = catalog.choke || {};
        var hook = catalog.hook || {};
        var missile = catalog.missile || {};
        var deadeye = catalog.deadeye || {};

        return {
            awareness: {
                segments: finiteOr(shared.awareness && shared.awareness.segments, 0),
                radarRange: finiteOr(shared.awareness && shared.awareness.radarRange, 0),
                coreRange: finiteOr(shared.awareness && shared.awareness.coreRange, 0),
                beaconMinRange: finiteOr(shared.awareness && shared.awareness.beaconMinRange, 0),
                beaconMaxCount: finiteOr(shared.awareness && shared.awareness.beaconMaxCount, 0)
            },
            enemy: {
                fireRange: finiteOr(shared.enemy && shared.enemy.fireRange, 0),
                headshotNearRange: finiteOr(shared.enemy && shared.enemy.headshotNearRange, 0),
                headshotMidRange: finiteOr(shared.enemy && shared.enemy.headshotMidRange, 0),
                defaultWallhackRadius: finiteOr(shared.enemy && shared.enemy.defaultWallhackRadius, 0)
            },
            throwables: {
                fragRadius: finiteOr(throwables.frag && throwables.frag.radius, 0),
                plasmaRadius: finiteOr(throwables.plasma && throwables.plasma.radius, 0),
                plasmaCatchRadius: finiteOr(throwables.plasma && throwables.plasma.catchRadius, 0),
                missileRadius: finiteOr(throwables.missile && throwables.missile.radius, 0),
                molotovFireRadius: finiteOr(throwables.molotov && throwables.molotov.fireRadius, 0),
                plasmaAcquireRange: finiteOr(throwables.plasma && throwables.plasma.acquireRange, 0),
                plasmaAcquireHalfAngleDeg: finiteOr(throwables.plasma && throwables.plasma.acquireHalfAngleDeg, 0),
                plasmaStickExplodeDelay: finiteOr(throwables.plasma && throwables.plasma.stickExplodeDelay, 0)
            },
            throwableMechanics: {
                aimRayRange: finiteOr(shared.throwableMechanics && shared.throwableMechanics.aimRayRange, 0),
                fragBounceMaxCount: finiteOr(shared.throwableMechanics && shared.throwableMechanics.fragBounceMaxCount, 0),
                fragBounceVelocityDamping: finiteOr(shared.throwableMechanics && shared.throwableMechanics.fragBounceVelocityDamping, 0),
                fragBounceVerticalDamping: finiteOr(shared.throwableMechanics && shared.throwableMechanics.fragBounceVerticalDamping, 0),
                fragBounceStopSpeedSq: finiteOr(shared.throwableMechanics && shared.throwableMechanics.fragBounceStopSpeedSq, 0),
                predictedTtlMs: finiteOr(shared.throwableMechanics && shared.throwableMechanics.predictedTtlMs, 0),
                throwIntentOriginMaxOffset: finiteOr(shared.throwableMechanics && shared.throwableMechanics.throwIntentOriginMaxOffset, 0),
                throwIntentDirectionMinDot: finiteOr(shared.throwableMechanics && shared.throwableMechanics.throwIntentDirectionMinDot, 0)
            },
            classWallhackRadius: {
                abilities: finiteOr(classPresets.abilities && classPresets.abilities.wallhackRadius, 0)
            },
            classAbilities: {
                chokeLockBoxPx: finiteOr(choke.lockBoxPx, 0),
                chokeRange: finiteOr(choke.range, 0),
                chokeTargetTolerance: finiteOr(choke.targetTolerance, 0),
                chokeDuration: finiteOr(choke.duration, 0),
                chokeLiftHeight: finiteOr(choke.liftHeight, 0),
                chokeTickRate: finiteOr(choke.tickRate, 0),
                chokeDotPerTick: finiteOr(choke.dotPerTick, 0),
                chokeCastDamage: finiteOr(choke.castDamage, 0),
                hookLockBoxPx: finiteOr(hook.lockBoxPx, 0),
                hookReticleRadiusPx: finiteOr(hook.reticleRadiusPx, 0),
                hookRange: finiteOr(hook.range, 0),
                hookCastDamage: finiteOr(hook.castDamage, 0),
                hookStunDuration: finiteOr(hook.stunDuration, 0),
                hookPullDistance: finiteOr(hook.pullDistance, 0),
                hookCatchRadius: finiteOr(hook.catchRadius, 0),
                hookTravelSpeed: finiteOr(hook.travelSpeed, 0),
                hookPullSpeed: finiteOr(hook.pullSpeed, 0),
                missileRange: finiteOr(missile.range, 0),
                missileDamage: finiteOr(missile.damage, 0),
                missileRadius: finiteOr(missile.radius, 0),
                missileTravelSpeed: finiteOr(missile.travelSpeed, 0),
                missileAcquireRange: finiteOr(missile.acquireRange, 0),
                missileCatchRadius: finiteOr(missile.catchRadius, 0),
                missileLockHalfAngleDeg: finiteOr(missile.lockHalfAngleDeg, 0),
                missileHomingBoost: finiteOr(missile.homingBoost, 0),
                missileHomingLerp: finiteOr(missile.homingLerp, 0),
                deadeyeLockBoxPx: finiteOr(deadeye.lockBoxPx, 0),
                deadeyeLockRange: finiteOr(deadeye.range, 0),
                deadeyeDuration: finiteOr(deadeye.duration, 0),
                deadeyeMaxTargets: finiteOr(deadeye.maxTargets, 0),
                deadeyeDamage: finiteOr(deadeye.damage, 0)
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
            return normalizeFalloffProfile(shared.getWeaponFalloffProfile(weaponId));
        }
        var tuning = shared.gameplayTuning || {};
        return normalizeFalloffProfile(tuning.weaponFalloff && tuning.weaponFalloff[String(weaponId || '')]);
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
        if (typeof meters !== 'number') meters = base.classWallhackRadius.abilities || 0;
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
