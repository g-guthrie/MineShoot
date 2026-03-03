/**
 * combat-tuning.js - Canonical combat distance tuning (meters/world-units)
 * Loaded as global: window.GameCombatTuning
 */
(function () {
    'use strict';

    var GameCombatTuning = {};

    var BASE = {
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
            rifle: 120,
            pistol: 92,
            machinegun: 88,
            shotgun: 42,
            sniper: 190,
            seekergun: 24,
            plasma: 24
        },
        shotgunFalloff: {
            fullDamageEnd: 8,
            minDamageStart: 24
        },
        throwables: {
            fragRadius: 5.4,
            seekerRadius: 5.0,
            seekerShotRadius: 4.6,
            molotovFireRadius: 3.2,
            seekerAcquireRange: 22
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
            ninja: 90,
            jedi: 85,
            magician: 100,
            sharpshooter: 115,
            brawler: 75
        },
        classAbilities: {
            ninjaThrowRange: 42,
            ninjaUltimateRadius: 11,
            jediAbilityRange: 13,
            jediUltimateRange: 6.0,
            magicianAimRange: 36,
            magicianAbilityRadius: 4.8,
            magicianUltimateRange: 60,
            sharpshooterUltimateRange: 70,
            brawlerAbilityRange: 4.2,
            brawlerRageRadius: 5.2,
            jediChokeLockBoxPx: 190,
            jediChokeRange: 24,
            jediChokeDuration: 1.55,
            jediChokeLiftHeight: 1.0,
            jediChokeTickRate: 0.25,
            jediChokeDotPerTick: 0,
            jediSaberSpeed: 34,
            jediSaberMaxDistance: 22,
            jediSaberReturnSpeed: 42,
            jediSaberHitRadius: 1.3,
            jediSaberDamage: 175,
            jediSaberHeadDamage: 240,
            ninjaStarCount: 3,
            ninjaStarSpreadDeg: 16,
            ninjaStarSpeed: 44,
            ninjaStarLife: 0.85,
            ninjaStarHitRadius: 1.35,
            ninjaStarBodyDamage: 120,
            ninjaStarHeadDamage: 170,
            shadowDashSteps: 4,
            shadowDashStepDuration: 0.12,
            deadeyeLockBoxPx: 220,
            deadeyeLockRange: 80,
            deadeyeDuration: 4.0,
            deadeyeMaxTargets: 6,
            deadeyeDamage: 260
        }
    };

    function scaleDistance(meters) {
        if (window.GameWorld && window.GameWorld.scaleCombatDistance) {
            return window.GameWorld.scaleCombatDistance(meters);
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

    GameCombatTuning.getShotgunFalloffTuning = function () {
        return {
            fullDamageEnd: scaleDistance(BASE.shotgunFalloff.fullDamageEnd),
            minDamageStart: scaleDistance(BASE.shotgunFalloff.minDamageStart)
        };
    };

    GameCombatTuning.getThrowableDistanceTuning = function () {
        return {
            fragRadius: scaleDistance(BASE.throwables.fragRadius),
            seekerRadius: scaleDistance(BASE.throwables.seekerRadius),
            seekerShotRadius: scaleDistance(BASE.throwables.seekerShotRadius),
            molotovFireRadius: scaleDistance(BASE.throwables.molotovFireRadius),
            seekerAcquireRange: scaleDistance(BASE.throwables.seekerAcquireRange)
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
        var id = classId || 'sharpshooter';
        var meters = BASE.classWallhackRadius[id];
        if (typeof meters !== 'number') meters = BASE.classWallhackRadius.sharpshooter;
        return scaleDistance(meters);
    };

    GameCombatTuning.getClassAbilityTuning = function () {
        return scaledCopy(BASE.classAbilities);
    };

    GameCombatTuning.debugDump = function () {
        return {
            combatScale: (window.GameWorld && window.GameWorld.getCombatScale) ? window.GameWorld.getCombatScale() : 1,
            awareness: GameCombatTuning.getAwarenessTuning(),
            enemy: GameCombatTuning.getEnemyTuning(),
            weaponRanges: {
                rifle: GameCombatTuning.getWeaponRange('rifle'),
                pistol: GameCombatTuning.getWeaponRange('pistol'),
                machinegun: GameCombatTuning.getWeaponRange('machinegun'),
                shotgun: GameCombatTuning.getWeaponRange('shotgun'),
                sniper: GameCombatTuning.getWeaponRange('sniper'),
                seekergun: GameCombatTuning.getWeaponRange('seekergun'),
                plasma: GameCombatTuning.getWeaponRange('plasma')
            },
            shotgunFalloff: GameCombatTuning.getShotgunFalloffTuning(),
            throwables: GameCombatTuning.getThrowableDistanceTuning(),
            classWallhackRadius: {
                ninja: GameCombatTuning.getClassWallhackRadius('ninja'),
                jedi: GameCombatTuning.getClassWallhackRadius('jedi'),
                magician: GameCombatTuning.getClassWallhackRadius('magician'),
                sharpshooter: GameCombatTuning.getClassWallhackRadius('sharpshooter'),
                brawler: GameCombatTuning.getClassWallhackRadius('brawler')
            },
            classAbilities: GameCombatTuning.getClassAbilityTuning()
        };
    };

    window.GameCombatTuning = GameCombatTuning;
})();
