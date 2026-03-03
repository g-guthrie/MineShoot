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
            rifle: 120,
            pistol: 92,
            machinegun: 88,
            shotgun: 42,
            sniper: 190,
            seekergun: 24,
            plasma: 24
        },
        shotgunFalloff: {
            fullDamageEnd: 7,
            minDamageStart: 22
        },
        weaponFalloff: {
            rifle: [
                { maxDistance: 20, scale: 1.0 },
                { maxDistance: 45, scale: 0.96 },
                { maxDistance: 80, scale: 0.88 },
                { maxDistance: 120, scale: 0.78 }
            ],
            pistol: [
                { maxDistance: 14, scale: 1.0 },
                { maxDistance: 26, scale: 0.92 },
                { maxDistance: 42, scale: 0.74 },
                { maxDistance: 92, scale: 0.52 }
            ],
            machinegun: [
                { maxDistance: 12, scale: 1.0 },
                { maxDistance: 28, scale: 0.94 },
                { maxDistance: 52, scale: 0.84 },
                { maxDistance: 88, scale: 0.72 }
            ],
            shotgun: [
                { maxDistance: 7, scale: 1.0 },
                { maxDistance: 14, scale: 0.75 },
                { maxDistance: 22, scale: 0.5 },
                { maxDistance: 42, scale: 0.28 }
            ],
            sniper: [
                { maxDistance: 45, scale: 1.0 },
                { maxDistance: 95, scale: 0.96 },
                { maxDistance: 145, scale: 0.9 },
                { maxDistance: 190, scale: 0.85 }
            ],
            seekergun: [
                { maxDistance: 24, scale: 1.0 }
            ],
            plasma: [
                { maxDistance: 24, scale: 1.0 }
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
            ninja: 90,
            jedi: 85,
            magician: 100,
            sharpshooter: 115,
            brawler: 75
        },
        classAbilities: {
            ninjaThrowRange: 42,
            ninjaUltimateRadius: 11,
            jediAbilityRange: 24,
            jediUltimateRange: 22,
            magicianAimRange: 36,
            magicianAbilityRadius: 4.8,
            magicianUltimateRange: 60,
            sharpshooterUltimateRange: 80,
            brawlerAbilityRange: 4.2,
            brawlerRageRadius: 5.2,
            jediChokeLockBoxPx: 190,
            jediChokeRange: 24,
            jediChokeDuration: 1.6,
            jediChokeLiftHeight: 1.0,
            jediChokeTickRate: 0.25,
            jediChokeDotPerTick: 0,
            jediChokeCastDamage: 95,
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
        var abilities = shared.classAbilities || {};
        var ninja = abilities.ninja || {};
        var jedi = abilities.jedi || {};
        var magician = abilities.magician || {};
        var sharpshooter = abilities.sharpshooter || {};
        var brawler = abilities.brawler || {};

        return {
            awareness: shared.awareness || deepCopy(DEFAULTS.awareness),
            enemy: shared.enemy || deepCopy(DEFAULTS.enemy),
            weapons: {
                rifle: Number(weapons.rifle && weapons.rifle.maxRange) || DEFAULTS.weapons.rifle,
                pistol: Number(weapons.pistol && weapons.pistol.maxRange) || DEFAULTS.weapons.pistol,
                machinegun: Number(weapons.machinegun && weapons.machinegun.maxRange) || DEFAULTS.weapons.machinegun,
                shotgun: Number(weapons.shotgun && weapons.shotgun.maxRange) || DEFAULTS.weapons.shotgun,
                sniper: Number(weapons.sniper && weapons.sniper.maxRange) || DEFAULTS.weapons.sniper,
                seekergun: Number(weapons.seekergun && weapons.seekergun.maxRange) || DEFAULTS.weapons.seekergun,
                plasma: Number(weapons.plasma && weapons.plasma.maxRange) || DEFAULTS.weapons.plasma
            },
            shotgunFalloff: shared.shotgunFalloff || deepCopy(DEFAULTS.shotgunFalloff),
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
                ninja: Number(classPresets.ninja && classPresets.ninja.wallhackRadius) || DEFAULTS.classWallhackRadius.ninja,
                jedi: Number(classPresets.jedi && classPresets.jedi.wallhackRadius) || DEFAULTS.classWallhackRadius.jedi,
                magician: Number(classPresets.magician && classPresets.magician.wallhackRadius) || DEFAULTS.classWallhackRadius.magician,
                sharpshooter: Number(classPresets.sharpshooter && classPresets.sharpshooter.wallhackRadius) || DEFAULTS.classWallhackRadius.sharpshooter,
                brawler: Number(classPresets.brawler && classPresets.brawler.wallhackRadius) || DEFAULTS.classWallhackRadius.brawler
            },
            classAbilities: {
                ninjaThrowRange: Number(ninja.stars && ninja.stars.range) || DEFAULTS.classAbilities.ninjaThrowRange,
                ninjaUltimateRadius: DEFAULTS.classAbilities.ninjaUltimateRadius,
                jediAbilityRange: Number(jedi.choke && jedi.choke.range) || DEFAULTS.classAbilities.jediAbilityRange,
                jediUltimateRange: Number(jedi.saberThrow && jedi.saberThrow.range) || DEFAULTS.classAbilities.jediUltimateRange,
                magicianAimRange: Number(magician.fireball && magician.fireball.range) || DEFAULTS.classAbilities.magicianAimRange,
                magicianAbilityRadius: Number(magician.fireball && magician.fireball.radius) || DEFAULTS.classAbilities.magicianAbilityRadius,
                magicianUltimateRange: Number(magician.chainLightning && magician.chainLightning.range) || DEFAULTS.classAbilities.magicianUltimateRange,
                sharpshooterUltimateRange: Number(sharpshooter.deadeye && sharpshooter.deadeye.range) || DEFAULTS.classAbilities.sharpshooterUltimateRange,
                brawlerAbilityRange: Number(brawler.batSwing && brawler.batSwing.range) || DEFAULTS.classAbilities.brawlerAbilityRange,
                brawlerRageRadius: Number(brawler.rage && brawler.rage.radius) || DEFAULTS.classAbilities.brawlerRageRadius,
                jediChokeLockBoxPx: Number(jedi.choke && jedi.choke.lockBoxPx) || DEFAULTS.classAbilities.jediChokeLockBoxPx,
                jediChokeRange: Number(jedi.choke && jedi.choke.range) || DEFAULTS.classAbilities.jediChokeRange,
                jediChokeDuration: Number(jedi.choke && jedi.choke.duration) || DEFAULTS.classAbilities.jediChokeDuration,
                jediChokeLiftHeight: Number(jedi.choke && jedi.choke.liftHeight) || DEFAULTS.classAbilities.jediChokeLiftHeight,
                jediChokeTickRate: Number(jedi.choke && jedi.choke.tickRate) || DEFAULTS.classAbilities.jediChokeTickRate,
                jediChokeDotPerTick: Number(jedi.choke && jedi.choke.dotPerTick) || DEFAULTS.classAbilities.jediChokeDotPerTick,
                jediChokeCastDamage: Number(jedi.choke && jedi.choke.castDamage) || DEFAULTS.classAbilities.jediChokeCastDamage,
                jediSaberSpeed: Number(jedi.saberThrow && jedi.saberThrow.speed) || DEFAULTS.classAbilities.jediSaberSpeed,
                jediSaberMaxDistance: Number(jedi.saberThrow && jedi.saberThrow.maxDistance) || DEFAULTS.classAbilities.jediSaberMaxDistance,
                jediSaberReturnSpeed: Number(jedi.saberThrow && jedi.saberThrow.returnSpeed) || DEFAULTS.classAbilities.jediSaberReturnSpeed,
                jediSaberHitRadius: Number(jedi.saberThrow && jedi.saberThrow.hitRadius) || DEFAULTS.classAbilities.jediSaberHitRadius,
                jediSaberDamage: Number(jedi.saberThrow && jedi.saberThrow.bodyDamage) || DEFAULTS.classAbilities.jediSaberDamage,
                jediSaberHeadDamage: Number(jedi.saberThrow && jedi.saberThrow.headDamage) || DEFAULTS.classAbilities.jediSaberHeadDamage,
                ninjaStarCount: Number(ninja.stars && ninja.stars.count) || DEFAULTS.classAbilities.ninjaStarCount,
                ninjaStarSpreadDeg: DEFAULTS.classAbilities.ninjaStarSpreadDeg,
                ninjaStarSpeed: DEFAULTS.classAbilities.ninjaStarSpeed,
                ninjaStarLife: DEFAULTS.classAbilities.ninjaStarLife,
                ninjaStarHitRadius: DEFAULTS.classAbilities.ninjaStarHitRadius,
                ninjaStarBodyDamage: Number(ninja.stars && ninja.stars.bodyDamage) || DEFAULTS.classAbilities.ninjaStarBodyDamage,
                ninjaStarHeadDamage: Number(ninja.stars && ninja.stars.headDamage) || DEFAULTS.classAbilities.ninjaStarHeadDamage,
                shadowDashSteps: Number(ninja.shadowDash && ninja.shadowDash.steps) || DEFAULTS.classAbilities.shadowDashSteps,
                shadowDashStepDuration: Number(ninja.shadowDash && ninja.shadowDash.stepDuration) || DEFAULTS.classAbilities.shadowDashStepDuration,
                deadeyeLockBoxPx: DEFAULTS.classAbilities.deadeyeLockBoxPx,
                deadeyeLockRange: Number(sharpshooter.deadeye && sharpshooter.deadeye.range) || DEFAULTS.classAbilities.deadeyeLockRange,
                deadeyeDuration: Number(sharpshooter.deadeye && sharpshooter.deadeye.duration) || DEFAULTS.classAbilities.deadeyeDuration,
                deadeyeMaxTargets: Number(sharpshooter.deadeye && sharpshooter.deadeye.maxTargets) || DEFAULTS.classAbilities.deadeyeMaxTargets,
                deadeyeDamage: Number(sharpshooter.deadeye && sharpshooter.deadeye.damage) || DEFAULTS.classAbilities.deadeyeDamage
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

    GameCombatTuning.getShotgunFalloffTuning = function () {
        return {
            fullDamageEnd: scaleDistance(BASE.shotgunFalloff.fullDamageEnd),
            minDamageStart: scaleDistance(BASE.shotgunFalloff.minDamageStart)
        };
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
        var id = classId || 'sharpshooter';
        var meters = BASE.classWallhackRadius[id];
        if (typeof meters !== 'number') meters = BASE.classWallhackRadius.sharpshooter;
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
                seekergun: GameCombatTuning.getWeaponRange('seekergun'),
                plasma: GameCombatTuning.getWeaponRange('plasma')
            },
            shotgunFalloff: GameCombatTuning.getShotgunFalloffTuning(),
            weaponFalloff: {
                rifle: GameCombatTuning.getWeaponFalloffTuning('rifle'),
                pistol: GameCombatTuning.getWeaponFalloffTuning('pistol'),
                machinegun: GameCombatTuning.getWeaponFalloffTuning('machinegun'),
                shotgun: GameCombatTuning.getWeaponFalloffTuning('shotgun'),
                sniper: GameCombatTuning.getWeaponFalloffTuning('sniper'),
                seekergun: GameCombatTuning.getWeaponFalloffTuning('seekergun'),
                plasma: GameCombatTuning.getWeaponFalloffTuning('plasma')
            },
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

    globalThis.__MAYHEM_RUNTIME.GameCombatTuning = GameCombatTuning;
})();
