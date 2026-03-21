/**
 * hitscan.js - Player weapons and hitscan logic
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameHitscan
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameHitscan = {};

    var weaponFactory = runtime.GameHitscanWeaponRuntime || null;
    var tracerFactory = runtime.GameHitscanTracerRuntime || null;
    var shotFactory = runtime.GameHitscanShotRuntime || null;

    if (!weaponFactory || !weaponFactory.create) {
        throw new Error('GameHitscanWeaponRuntime must load before hitscan.js');
    }
    if (!tracerFactory || !tracerFactory.create) {
        throw new Error('GameHitscanTracerRuntime must load before hitscan.js');
    }
    if (!shotFactory || !shotFactory.create) {
        throw new Error('GameHitscanShotRuntime must load before hitscan.js');
    }

    var weaponRuntime = weaponFactory.create();
    var tracerRuntime = tracerFactory.create();
    var shotRuntime = shotFactory.create({
        weaponRuntime: weaponRuntime,
        tracerRuntime: tracerRuntime
    });

    function timingSnapshot() {
        var localNow = 0;
        if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
            localNow = Number(performance.now()) || 0;
        } else {
            localNow = Date.now();
        }
        return {
            wallNow: Date.now(),
            localNow: localNow
        };
    }

    GameHitscan.fire = function (camera, onHit, onMiss, shotToken) {
        return shotRuntime.fire(camera, onHit, onMiss, shotToken, timingSnapshot());
    };

    GameHitscan.getCurrentWeapon = function () {
        return weaponRuntime.getCurrentWeapon(timingSnapshot());
    };

    GameHitscan.getReticleSpec = function (weaponId) {
        return weaponRuntime.getReticleSpec(weaponId);
    };

    GameHitscan.getWeaponOrder = function () {
        return weaponRuntime.getWeaponOrder();
    };

    GameHitscan.setWeapon = function (weaponId) {
        return weaponRuntime.setWeapon(weaponId, timingSnapshot());
    };

    GameHitscan.cycleWeapon = function (delta) {
        return weaponRuntime.cycleWeapon(delta, timingSnapshot());
    };

    GameHitscan.toggleWeapon = function () {
        return weaponRuntime.toggleWeapon(timingSnapshot());
    };

    GameHitscan.setWeaponOrder = function (nextOrder) {
        return weaponRuntime.setWeaponOrder(nextOrder);
    };

    GameHitscan.equipSlot = function (slotIndex) {
        return weaponRuntime.equipSlot(slotIndex, timingSnapshot());
    };

    GameHitscan.getAllWeaponIds = function () {
        return weaponRuntime.getAllWeaponIds();
    };

    GameHitscan.getHeadDamage = function () {
        return weaponRuntime.getHeadDamage();
    };

    GameHitscan.getBodyDamage = function () {
        return weaponRuntime.getBodyDamage();
    };

    GameHitscan.getCooldown = function () {
        return weaponRuntime.getCooldown();
    };

    GameHitscan.canFire = function () {
        return shotRuntime.canFire(timingSnapshot());
    };

    GameHitscan.cooldownRemaining = function () {
        return weaponRuntime.getCooldownRemaining(timingSnapshot());
    };

    GameHitscan.peekCenterTarget = function (camera, maxRange) {
        return shotRuntime.peekCenterTarget(camera, maxRange);
    };

    GameHitscan.peekAutoLockTarget = function (camera) {
        return shotRuntime.peekAutoLockTarget(camera);
    };

    GameHitscan.tick = function (_dt) {
        return weaponRuntime.tick(timingSnapshot());
    };

    GameHitscan.syncAmmoStateFromNetwork = function (weaponAmmoStateMap) {
        return weaponRuntime.syncAmmoStateFromNetwork(weaponAmmoStateMap, timingSnapshot());
    };

    GameHitscan.getHudState = function () {
        return weaponRuntime.getHudState(timingSnapshot());
    };

    GameHitscan.reloadCurrentWeapon = function () {
        return weaponRuntime.reloadCurrentWeapon(timingSnapshot());
    };

    GameHitscan.isAdsBlocked = function () {
        return weaponRuntime.isAdsBlocked(timingSnapshot());
    };

    GameHitscan.syncPlasmaStateFromNet = function (_state) {};

    GameHitscan.selectLockTargetByBox = function (camera, maxRange, boxSizePx, options) {
        return shotRuntime.selectLockTargetByBox(camera, maxRange, boxSizePx, options);
    };

    GameHitscan.selectLockTargetByRect = function (camera, maxRange, boxWidthPx, boxHeightPx, options) {
        return shotRuntime.selectLockTargetByRect(camera, maxRange, boxWidthPx, boxHeightPx, options);
    };

    GameHitscan.updateTracers = function (dt) {
        tracerRuntime.updateTracers(dt);
    };

    GameHitscan.getWeaponCatalog = function () {
        return weaponRuntime.getWeaponCatalog();
    };

    GameHitscan.getSpreadRadiusPx = function (weaponId) {
        return weaponRuntime.getSpreadRadiusPx(weaponId);
    };

    GameHitscan.getSpreadMetrics = function (weaponId) {
        return weaponRuntime.getSpreadMetrics(weaponId);
    };

    GameHitscan.shouldPredictNetHit = function (camera, hitboxMesh, shotToken, pelletIndex) {
        return shotRuntime.shouldPredictNetHit(camera, hitboxMesh, shotToken, pelletIndex);
    };

    GameHitscan.buildNetworkFireIntent = function (shotToken) {
        return shotRuntime.buildNetworkFireIntent(shotToken);
    };

    runtime.GameHitscan = GameHitscan;
})();
