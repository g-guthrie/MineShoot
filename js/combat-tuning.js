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

    function sharedAbilityDefault(abilityId, key, fallback) {
        var shared = runtimeSharedTuning();
        var catalog = shared && shared.abilityCatalog ? shared.abilityCatalog : null;
        var ability = catalog && catalog[abilityId] ? catalog[abilityId] : null;
        var value = Number(ability && ability[key]);
        return Number.isFinite(value) ? value : fallback;
    }

    function sharedClassPresetDefault(classId, key, fallback) {
        var shared = runtimeSharedTuning();
        var presets = shared && shared.classPresets ? shared.classPresets : null;
        var preset = presets && presets[classId] ? presets[classId] : null;
        var value = Number(preset && preset[key]);
        return Number.isFinite(value) ? value : fallback;
    }

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
        throwables: {
            fragRadius: 6.8,
            plasmaRadius: 5.0,
            missileRadius: 2.4,
            molotovFireRadius: 3.8,
            plasmaAcquireRange: 18,
            plasmaAcquireHalfAngleDeg: 35,
            plasmaStickExplodeDelay: 0.65
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
            abilities: sharedClassPresetDefault('abilities', 'wallhackRadius', 90)
        },
        classAbilities: {
            chokeLockBoxPx: sharedAbilityDefault('choke', 'lockBoxPx', 315),
            chokeRange: sharedAbilityDefault('choke', 'range', 24),
            chokeTargetTolerance: sharedAbilityDefault('choke', 'targetTolerance', 1.6),
            chokeDuration: sharedAbilityDefault('choke', 'duration', 0.85),
            chokeLiftHeight: sharedAbilityDefault('choke', 'liftHeight', 1.0),
            chokeTickRate: sharedAbilityDefault('choke', 'tickRate', 0.25),
            chokeDotPerTick: sharedAbilityDefault('choke', 'dotPerTick', 0),
            chokeCastDamage: sharedAbilityDefault('choke', 'castDamage', 0),
            hookLockBoxPx: sharedAbilityDefault('hook', 'lockBoxPx', 170),
            hookReticleRadiusPx: sharedAbilityDefault('hook', 'reticleRadiusPx', 52),
            hookRange: sharedAbilityDefault('hook', 'range', 24),
            hookCastDamage: sharedAbilityDefault('hook', 'castDamage', 35),
            hookStunDuration: sharedAbilityDefault('hook', 'stunDuration', 0.5),
            hookPullDistance: sharedAbilityDefault('hook', 'pullDistance', 3.2),
            hookCatchRadius: sharedAbilityDefault('hook', 'catchRadius', 1.6),
            hookTravelSpeed: sharedAbilityDefault('hook', 'travelSpeed', 24),
            missileRange: sharedAbilityDefault('missile', 'range', 34),
            missileDamage: sharedAbilityDefault('missile', 'damage', 90),
            missileRadius: sharedAbilityDefault('missile', 'radius', 2.4),
            missileTravelSpeed: sharedAbilityDefault('missile', 'travelSpeed', 38),
            missileAcquireRange: sharedAbilityDefault('missile', 'acquireRange', 7.5),
            missileCatchRadius: sharedAbilityDefault('missile', 'catchRadius', 1.25),
            missileLockHalfAngleDeg: sharedAbilityDefault('missile', 'lockHalfAngleDeg', 12),
            missileHomingBoost: sharedAbilityDefault('missile', 'homingBoost', 6),
            missileHomingLerp: sharedAbilityDefault('missile', 'homingLerp', 8.4),
            healDuration: sharedAbilityDefault('heal', 'duration', 0.85),
            healAmount: sharedAbilityDefault('heal', 'healAmount', 150),
            deadeyeLockBoxPx: 220,
            deadeyeLockRange: sharedAbilityDefault('deadeye', 'range', 70),
            deadeyeDuration: sharedAbilityDefault('deadeye', 'duration', 1.5),
            deadeyeMaxTargets: sharedAbilityDefault('deadeye', 'maxTargets', 2),
            deadeyeDamage: sharedAbilityDefault('deadeye', 'damage', 180)
        }
    };

    function deepCopy(data) {
        return JSON.parse(JSON.stringify(data));
    }

    function sharedTuning() {
        return runtimeSharedTuning();
    }

    function buildBase() {
        var shared = sharedTuning();
        if (!shared) return deepCopy(DEFAULTS);

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
            throwables: {
                fragRadius: Number(throwables.frag && throwables.frag.radius) || DEFAULTS.throwables.fragRadius,
                plasmaRadius: Number(throwables.plasma && throwables.plasma.radius) || DEFAULTS.throwables.plasmaRadius,
                missileRadius: Number(throwables.missile && throwables.missile.radius) || DEFAULTS.throwables.missileRadius,
                molotovFireRadius: Number(throwables.molotov && throwables.molotov.fireRadius) || DEFAULTS.throwables.molotovFireRadius,
                plasmaAcquireRange: Number(throwables.plasma && throwables.plasma.acquireRange) || DEFAULTS.throwables.plasmaAcquireRange,
                plasmaAcquireHalfAngleDeg: Number(throwables.plasma && throwables.plasma.acquireHalfAngleDeg) || DEFAULTS.throwables.plasmaAcquireHalfAngleDeg,
                plasmaStickExplodeDelay: Number(throwables.plasma && throwables.plasma.stickExplodeDelay) || DEFAULTS.throwables.plasmaStickExplodeDelay
            },
            throwableMechanics: shared.throwableMechanics || deepCopy(DEFAULTS.throwableMechanics),
            classWallhackRadius: {
                abilities: Number(classPresets.abilities && classPresets.abilities.wallhackRadius) || DEFAULTS.classWallhackRadius.abilities
            },
            classAbilities: {
                chokeLockBoxPx: Number.isFinite(Number(choke.lockBoxPx)) ? Number(choke.lockBoxPx) : DEFAULTS.classAbilities.chokeLockBoxPx,
                chokeRange: Number.isFinite(Number(choke.range)) ? Number(choke.range) : DEFAULTS.classAbilities.chokeRange,
                chokeTargetTolerance: Number.isFinite(Number(choke.targetTolerance)) ? Number(choke.targetTolerance) : DEFAULTS.classAbilities.chokeTargetTolerance,
                chokeDuration: Number.isFinite(Number(choke.duration)) ? Number(choke.duration) : DEFAULTS.classAbilities.chokeDuration,
                chokeLiftHeight: Number.isFinite(Number(choke.liftHeight)) ? Number(choke.liftHeight) : DEFAULTS.classAbilities.chokeLiftHeight,
                chokeTickRate: Number.isFinite(Number(choke.tickRate)) ? Number(choke.tickRate) : DEFAULTS.classAbilities.chokeTickRate,
                chokeDotPerTick: Number.isFinite(Number(choke.dotPerTick)) ? Number(choke.dotPerTick) : DEFAULTS.classAbilities.chokeDotPerTick,
                chokeCastDamage: Number.isFinite(Number(choke.castDamage)) ? Number(choke.castDamage) : DEFAULTS.classAbilities.chokeCastDamage,
                hookLockBoxPx: Number.isFinite(Number(hook.lockBoxPx)) ? Number(hook.lockBoxPx) : DEFAULTS.classAbilities.hookLockBoxPx,
                hookReticleRadiusPx: Number.isFinite(Number(hook.reticleRadiusPx)) ? Number(hook.reticleRadiusPx) : DEFAULTS.classAbilities.hookReticleRadiusPx,
                hookRange: Number.isFinite(Number(hook.range)) ? Number(hook.range) : DEFAULTS.classAbilities.hookRange,
                hookCastDamage: Number.isFinite(Number(hook.castDamage)) ? Number(hook.castDamage) : DEFAULTS.classAbilities.hookCastDamage,
                hookStunDuration: Number.isFinite(Number(hook.stunDuration)) ? Number(hook.stunDuration) : DEFAULTS.classAbilities.hookStunDuration,
                hookPullDistance: Number.isFinite(Number(hook.pullDistance)) ? Number(hook.pullDistance) : DEFAULTS.classAbilities.hookPullDistance,
                hookCatchRadius: Number.isFinite(Number(hook.catchRadius)) ? Number(hook.catchRadius) : DEFAULTS.classAbilities.hookCatchRadius,
                hookTravelSpeed: Number.isFinite(Number(hook.travelSpeed)) ? Number(hook.travelSpeed) : DEFAULTS.classAbilities.hookTravelSpeed,
                missileRange: Number.isFinite(Number((catalog.missile || {}).range)) ? Number((catalog.missile || {}).range) : DEFAULTS.classAbilities.missileRange,
                missileDamage: Number.isFinite(Number((catalog.missile || {}).damage)) ? Number((catalog.missile || {}).damage) : DEFAULTS.classAbilities.missileDamage,
                missileRadius: Number.isFinite(Number((catalog.missile || {}).radius)) ? Number((catalog.missile || {}).radius) : DEFAULTS.classAbilities.missileRadius,
                missileTravelSpeed: Number.isFinite(Number((catalog.missile || {}).travelSpeed)) ? Number((catalog.missile || {}).travelSpeed) : DEFAULTS.classAbilities.missileTravelSpeed,
                missileAcquireRange: Number.isFinite(Number((catalog.missile || {}).acquireRange)) ? Number((catalog.missile || {}).acquireRange) : DEFAULTS.classAbilities.missileAcquireRange,
                missileCatchRadius: Number.isFinite(Number((catalog.missile || {}).catchRadius)) ? Number((catalog.missile || {}).catchRadius) : DEFAULTS.classAbilities.missileCatchRadius,
                missileLockHalfAngleDeg: Number.isFinite(Number((catalog.missile || {}).lockHalfAngleDeg)) ? Number((catalog.missile || {}).lockHalfAngleDeg) : DEFAULTS.classAbilities.missileLockHalfAngleDeg,
                missileHomingBoost: Number.isFinite(Number((catalog.missile || {}).homingBoost)) ? Number((catalog.missile || {}).homingBoost) : DEFAULTS.classAbilities.missileHomingBoost,
                missileHomingLerp: Number.isFinite(Number((catalog.missile || {}).homingLerp)) ? Number((catalog.missile || {}).homingLerp) : DEFAULTS.classAbilities.missileHomingLerp,
                healDuration: Number.isFinite(Number(heal.duration)) ? Number(heal.duration) : DEFAULTS.classAbilities.healDuration,
                healAmount: Number.isFinite(Number(heal.healAmount)) ? Number(heal.healAmount) : DEFAULTS.classAbilities.healAmount,
                deadeyeLockBoxPx: DEFAULTS.classAbilities.deadeyeLockBoxPx,
                deadeyeLockRange: Number.isFinite(Number(deadeye.range)) ? Number(deadeye.range) : DEFAULTS.classAbilities.deadeyeLockRange,
                deadeyeDuration: Number.isFinite(Number(deadeye.duration)) ? Number(deadeye.duration) : DEFAULTS.classAbilities.deadeyeDuration,
                deadeyeMaxTargets: Number.isFinite(Number(deadeye.maxTargets)) ? Number(deadeye.maxTargets) : DEFAULTS.classAbilities.deadeyeMaxTargets,
                deadeyeDamage: Number.isFinite(Number(deadeye.damage)) ? Number(deadeye.damage) : DEFAULTS.classAbilities.deadeyeDamage
            }
        };
    }

    var BASE = buildBase();

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

    GameCombatTuning.getAwarenessTuning = function () {
        return {
            segments: BASE.awareness.segments,
            radarRange: BASE.awareness.radarRange,
            coreRange: BASE.awareness.coreRange,
            beaconMinRange: BASE.awareness.beaconMinRange,
            beaconMaxCount: BASE.awareness.beaconMaxCount
        };
    };

    GameCombatTuning.getEnemyTuning = function () {
        return {
            fireRange: BASE.enemy.fireRange,
            headshotNearRange: BASE.enemy.headshotNearRange,
            headshotMidRange: BASE.enemy.headshotMidRange,
            defaultWallhackRadius: BASE.enemy.defaultWallhackRadius
        };
    };

    GameCombatTuning.getWeaponRange = function (weaponId) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        var stats = shared.getWeaponStats ? shared.getWeaponStats(weaponId) : null;
        return Math.max(0, Number(stats && stats.maxRange || 0));
    };

    GameCombatTuning.getWeaponFalloffTuning = function (weaponId) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        if (shared.getWeaponFalloffProfile) {
            return normalizeFalloffBands(shared.getWeaponFalloffProfile(weaponId));
        }
        return [];
    };

    GameCombatTuning.getThrowableDistanceTuning = function () {
        return {
            fragRadius: BASE.throwables.fragRadius,
            plasmaRadius: BASE.throwables.plasmaRadius,
            missileRadius: BASE.throwables.missileRadius,
            molotovFireRadius: BASE.throwables.molotovFireRadius,
            plasmaAcquireRange: BASE.throwables.plasmaAcquireRange,
            plasmaAcquireHalfAngleDeg: BASE.throwables.plasmaAcquireHalfAngleDeg,
            plasmaStickExplodeDelay: BASE.throwables.plasmaStickExplodeDelay
        };
    };

    GameCombatTuning.getThrowableMechanicsTuning = function () {
        return {
            aimRayRange: BASE.throwableMechanics.aimRayRange,
            fragBounceMaxCount: BASE.throwableMechanics.fragBounceMaxCount,
            fragBounceVelocityDamping: BASE.throwableMechanics.fragBounceVelocityDamping,
            fragBounceVerticalDamping: BASE.throwableMechanics.fragBounceVerticalDamping,
            fragBounceStopSpeedSq: BASE.throwableMechanics.fragBounceStopSpeedSq,
            predictedTtlMs: BASE.throwableMechanics.predictedTtlMs,
            throwIntentOriginMaxOffset: BASE.throwableMechanics.throwIntentOriginMaxOffset,
            throwIntentDirectionMinDot: BASE.throwableMechanics.throwIntentDirectionMinDot
        };
    };

    GameCombatTuning.getClassWallhackRadius = function (classId) {
        var id = classId || 'abilities';
        var meters = BASE.classWallhackRadius[id];
        if (typeof meters !== 'number') meters = BASE.classWallhackRadius.abilities || 90;
        return meters;
    };

    GameCombatTuning.getClassAbilityTuning = function () {
        return copyMap(BASE.classAbilities);
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
