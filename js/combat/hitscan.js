/**
 * hitscan.js - Player weapons and hitscan logic
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameHitscan
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameHitscan = {};

    var weaponRuntime = null;
    var tracerRuntime = null;
    var shotRuntime = null;

    function ensureRuntime() {
        if (weaponRuntime && tracerRuntime && shotRuntime) return;
        var currentRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
        var weaponFactory = currentRuntime.GameHitscanWeaponRuntime || null;
        var tracerFactory = currentRuntime.GameHitscanTracerRuntime || null;
        var shotFactory = currentRuntime.GameHitscanShotRuntime || null;

        if (!weaponFactory || !weaponFactory.create) {
            throw new Error('GameHitscanWeaponRuntime must load before hitscan.js');
        }
        if (!tracerFactory || !tracerFactory.create) {
            throw new Error('GameHitscanTracerRuntime must load before hitscan.js');
        }
        if (!shotFactory || !shotFactory.create) {
            throw new Error('GameHitscanShotRuntime must load before hitscan.js');
        }

        weaponRuntime = weaponFactory.create();
        tracerRuntime = tracerFactory.create();
        shotRuntime = shotFactory.create({
            weaponRuntime: weaponRuntime,
            tracerRuntime: tracerRuntime
        });
    }

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

    GameHitscan.fire = function (camera, onHit, onMiss, shotToken, shotSample) {
        ensureRuntime();
        return shotRuntime.fire(camera, onHit, onMiss, shotToken, timingSnapshot(), shotSample);
    };

    GameHitscan.getCurrentWeapon = function () {
        ensureRuntime();
        return weaponRuntime.getCurrentWeapon(timingSnapshot());
    };

    GameHitscan.getReticleSpec = function (weaponId) {
        ensureRuntime();
        return weaponRuntime.getReticleSpec(weaponId);
    };

    GameHitscan.getReticleTargetPreview = function (camera) {
        ensureRuntime();
        return shotRuntime.getReticleTargetPreview(camera);
    };

    GameHitscan.getWeaponOrder = function () {
        ensureRuntime();
        return weaponRuntime.getWeaponOrder();
    };

    GameHitscan.setWeapon = function (weaponId) {
        ensureRuntime();
        return weaponRuntime.setWeapon(weaponId, timingSnapshot());
    };

    GameHitscan.cycleWeapon = function (delta) {
        ensureRuntime();
        return weaponRuntime.cycleWeapon(delta, timingSnapshot());
    };

    GameHitscan.toggleWeapon = function () {
        ensureRuntime();
        return weaponRuntime.toggleWeapon(timingSnapshot());
    };

    GameHitscan.setWeaponOrder = function (nextOrder) {
        ensureRuntime();
        return weaponRuntime.setWeaponOrder(nextOrder);
    };

    GameHitscan.equipSlot = function (slotIndex) {
        ensureRuntime();
        return weaponRuntime.equipSlot(slotIndex, timingSnapshot());
    };

    GameHitscan.getAllWeaponIds = function () {
        ensureRuntime();
        return weaponRuntime.getAllWeaponIds();
    };

    GameHitscan.getHeadDamage = function () {
        ensureRuntime();
        return weaponRuntime.getHeadDamage();
    };

    GameHitscan.getBodyDamage = function () {
        ensureRuntime();
        return weaponRuntime.getBodyDamage();
    };

    GameHitscan.getCooldown = function () {
        ensureRuntime();
        return weaponRuntime.getCooldown();
    };

    GameHitscan.canFire = function () {
        ensureRuntime();
        return shotRuntime.canFire(timingSnapshot());
    };

    GameHitscan.cooldownRemaining = function () {
        ensureRuntime();
        return weaponRuntime.getCooldownRemaining(timingSnapshot());
    };

    GameHitscan.peekCenterTarget = function (camera, maxRange) {
        ensureRuntime();
        return shotRuntime.peekCenterTarget(camera, maxRange);
    };

    GameHitscan.peekAutoLockTarget = function (camera) {
        ensureRuntime();
        return shotRuntime.peekAutoLockTarget(camera);
    };

    GameHitscan.tick = function (_dt) {
        ensureRuntime();
        return weaponRuntime.tick(timingSnapshot());
    };

    GameHitscan.syncAmmoStateFromNetwork = function (weaponAmmoStateMap) {
        ensureRuntime();
        return weaponRuntime.syncAmmoStateFromNetwork(weaponAmmoStateMap, timingSnapshot());
    };

    GameHitscan.getHudState = function () {
        ensureRuntime();
        return weaponRuntime.getHudState(timingSnapshot());
    };

    GameHitscan.reloadCurrentWeapon = function () {
        ensureRuntime();
        return weaponRuntime.reloadCurrentWeapon(timingSnapshot());
    };

    GameHitscan.isAdsBlocked = function () {
        ensureRuntime();
        return weaponRuntime.isAdsBlocked(timingSnapshot());
    };

    GameHitscan.syncPlasmaStateFromNet = function (_state) {};

    GameHitscan.selectLockTargetByBox = function (camera, maxRange, boxSizePx, options) {
        ensureRuntime();
        return shotRuntime.selectLockTargetByBox(camera, maxRange, boxSizePx, options);
    };

    GameHitscan.selectLockTargetByRect = function (camera, maxRange, boxWidthPx, boxHeightPx, options) {
        ensureRuntime();
        return shotRuntime.selectLockTargetByRect(camera, maxRange, boxWidthPx, boxHeightPx, options);
    };

    GameHitscan.updateTracers = function (dt) {
        ensureRuntime();
        tracerRuntime.updateTracers(dt);
    };

    GameHitscan.getWeaponCatalog = function () {
        ensureRuntime();
        return weaponRuntime.getWeaponCatalog();
    };

    GameHitscan.getSpreadRadiusPx = function (weaponId) {
        ensureRuntime();
        return weaponRuntime.getSpreadRadiusPx(weaponId);
    };

    GameHitscan.getSpreadMetrics = function (weaponId) {
        ensureRuntime();
        return weaponRuntime.getSpreadMetrics(weaponId);
    };

    GameHitscan.shouldPredictNetHit = function (camera, hitboxMesh, shotToken, pelletIndex, shotSample) {
        ensureRuntime();
        return shotRuntime.shouldPredictNetHit(camera, hitboxMesh, shotToken, pelletIndex, shotSample);
    };

    GameHitscan.captureShotSample = function (camera, shotToken) {
        ensureRuntime();
        return shotRuntime.captureShotSample(camera, shotToken);
    };

    GameHitscan.buildNetworkFireIntent = function (shotToken, shotSample) {
        ensureRuntime();
        return shotRuntime.buildNetworkFireIntent(shotToken, shotSample);
    };

    GameHitscan.reset = function () {
        if (tracerRuntime && tracerRuntime.dispose) {
            tracerRuntime.dispose();
        }
        weaponRuntime = null;
        tracerRuntime = null;
        shotRuntime = null;
    };

    runtime.GameHitscan = GameHitscan;
})();
