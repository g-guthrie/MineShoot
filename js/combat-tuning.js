/**
 * combat-tuning.js - Canonical combat distance tuning (meters/world-units)
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
