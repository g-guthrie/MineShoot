/**
 * throwables.js - Frag/plasma/molotov/knife logic with regen inventory
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameThrowables
 */
(function () {
    'use strict';

    var GameThrowables = {};

    var sceneRef = null;
    var netFireZoneMap = {};
    var debugInstantCooldowns = false;
    var debugTelemetry = {
        lastIntent: null,
        lastAckClientThrowId: '',
        lastRejectClientThrowId: '',
        lastReconcileClientThrowId: '',
        predictedCount: 0
    };
    var EMPTY_THROWABLE_DISTANCE_TUNING = {
        fragRadius: 0,
        plasmaRadius: 0,
        plasmaCatchRadius: 0,
        missileRadius: 0,
        molotovFireRadius: 0,
        plasmaAcquireRange: 0,
        plasmaAcquireHalfAngleDeg: 0,
        plasmaStickExplodeDelay: 0
    };
    var EMPTY_THROWABLE_MECHANICS_TUNING = {
        aimRayRange: 0,
        fragBounceMaxCount: 0,
        fragBounceVelocityDamping: 0,
        fragBounceVerticalDamping: 0,
        fragBounceStopSpeedSq: 0,
        predictedTtlMs: 0,
        throwIntentOriginMaxOffset: 0,
        throwIntentDirectionMinDot: 0
    };
    var FALLBACK_THROWABLE_ORDER = ['frag', 'plasma', 'molotov', 'knife'];
    var throwableDistanceTuning = EMPTY_THROWABLE_DISTANCE_TUNING;
    var throwableMechanicsTuning = EMPTY_THROWABLE_MECHANICS_TUNING;
    var throwableOrder = FALLBACK_THROWABLE_ORDER.slice();
    var defs = {};
    var configSnapshot = {
        sharedTuning: null,
        combatTuningApi: null,
        getDistance: null,
        getMechanics: null
    };
    var selectedThrowableId = '';

    function runtime() {
        return globalThis.__MAYHEM_RUNTIME || {};
    }

    function sharedApi() {
        return runtime().GameShared || {};
    }

    function defaultThrowableId() {
        var shared = sharedApi();
        if (shared && typeof shared.getDefaultThrowableId === 'function') {
            return String(shared.getDefaultThrowableId() || '');
        }
        return '';
    }

    function normalizeSelectedThrowableId(throwableId) {
        var shared = sharedApi();
        if (shared && typeof shared.normalizeThrowableId === 'function') {
            return String(shared.normalizeThrowableId(throwableId || '') || defaultThrowableId());
        }
        return String(throwableId || defaultThrowableId() || '');
    }

    function copyOwn(source) {
        var out = {};
        var input = source && typeof source === 'object' ? source : {};
        for (var key in input) {
            if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
            out[key] = input[key];
        }
        return out;
    }

    function sharedDistanceTuning(sharedTuning) {
        var throwables = (sharedTuning && sharedTuning.throwables) || {};
        return {
            fragRadius: Number((throwables.frag && throwables.frag.radius) || 0),
            plasmaRadius: Number((throwables.plasma && throwables.plasma.radius) || 0),
            plasmaCatchRadius: Number((throwables.plasma && throwables.plasma.catchRadius) || 0),
            missileRadius: Number((throwables.missile && throwables.missile.radius) || 0),
            molotovFireRadius: Number((throwables.molotov && throwables.molotov.fireRadius) || 0),
            plasmaAcquireRange: Number((throwables.plasma && throwables.plasma.acquireRange) || 0),
            plasmaAcquireHalfAngleDeg: Number((throwables.plasma && throwables.plasma.acquireHalfAngleDeg) || 0),
            plasmaStickExplodeDelay: Number((throwables.plasma && throwables.plasma.stickExplodeDelay) || 0)
        };
    }

    function fallbackDefs() {
        var out = {};
        for (var i = 0; i < FALLBACK_THROWABLE_ORDER.length; i++) {
            var id = FALLBACK_THROWABLE_ORDER[i];
            out[id] = {
                id: id,
                label: id.toUpperCase(),
                previewType: 'none',
                regen: 0
            };
        }
        return out;
    }

    function buildDefsFromShared(sharedThrowables, distanceTuning) {
        var out = {};
        var ids = ['frag', 'plasma', 'missile', 'molotov', 'knife'];
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            var src = sharedThrowables[id];
            if (!src) continue;
            var def = {};
            for (var k in src) {
                if (Object.prototype.hasOwnProperty.call(src, k)) def[k] = src[k];
            }
            if (id === 'frag') def.radius = distanceTuning.fragRadius;
            if (id === 'plasma') {
                def.radius = distanceTuning.plasmaRadius;
                def.catchRadius = distanceTuning.plasmaCatchRadius || def.catchRadius || 0;
                def.acquireHalfAngleDeg = distanceTuning.plasmaAcquireHalfAngleDeg || def.acquireHalfAngleDeg || 0;
                def.stickExplodeDelay = distanceTuning.plasmaStickExplodeDelay || def.stickExplodeDelay || 0;
                def.trackDuration = Number.isFinite(Number(def.trackDuration)) ? Number(def.trackDuration) : 0;
                def.trackLerp = Number.isFinite(Number(def.trackLerp)) ? Number(def.trackLerp) : 0;
            }
            if (id === 'missile') def.radius = distanceTuning.missileRadius;
            if (id === 'molotov') def.fireRadius = distanceTuning.molotovFireRadius;
            out[id] = def;
        }
        return out;
    }

    function refreshThrowableConfig(force) {
        var rt = runtime();
        var tuningApi = rt.GameCombatTuning || null;
        var sharedTuning = (rt.GameShared && rt.GameShared.gameplayTuning) || null;
        if (
            !force &&
            configSnapshot.sharedTuning === sharedTuning &&
            configSnapshot.combatTuningApi === tuningApi &&
            configSnapshot.getDistance === (tuningApi && tuningApi.getThrowableDistanceTuning) &&
            configSnapshot.getMechanics === (tuningApi && tuningApi.getThrowableMechanicsTuning)
        ) {
            return;
        }
        configSnapshot.sharedTuning = sharedTuning;
        configSnapshot.combatTuningApi = tuningApi;
        configSnapshot.getDistance = tuningApi && tuningApi.getThrowableDistanceTuning;
        configSnapshot.getMechanics = tuningApi && tuningApi.getThrowableMechanicsTuning;

        throwableDistanceTuning = (tuningApi && tuningApi.getThrowableDistanceTuning)
            ? (tuningApi.getThrowableDistanceTuning() || sharedDistanceTuning(sharedTuning))
            : sharedDistanceTuning(sharedTuning);
        throwableMechanicsTuning = (tuningApi && tuningApi.getThrowableMechanicsTuning)
            ? (tuningApi.getThrowableMechanicsTuning() || copyOwn(sharedTuning && sharedTuning.throwableMechanics))
            : copyOwn(sharedTuning && sharedTuning.throwableMechanics);
        if (!Object.keys(throwableMechanicsTuning).length) {
            throwableMechanicsTuning = EMPTY_THROWABLE_MECHANICS_TUNING;
        }
        if (!Object.keys(throwableDistanceTuning).length) {
            throwableDistanceTuning = EMPTY_THROWABLE_DISTANCE_TUNING;
        }
        var sharedThrowables = (sharedTuning && sharedTuning.throwables) || {};
        throwableOrder = (sharedThrowables.order && sharedThrowables.order.slice()) || FALLBACK_THROWABLE_ORDER.slice();
        defs = buildDefsFromShared(sharedThrowables, throwableDistanceTuning);
        if (!Object.keys(defs).length) defs = fallbackDefs();
        if (!defs[selectedThrowableId]) {
            var nextSelectedThrowableId = normalizeSelectedThrowableId(selectedThrowableId || '');
            selectedThrowableId = defs[nextSelectedThrowableId]
                ? nextSelectedThrowableId
                : String(throwableOrder[0] || '');
        }
    }

    refreshThrowableConfig(true);

    var inventory = {};

    function inventoryLabelForType(type) {
        refreshThrowableConfig();
        var id = String(type || '');
        var def = defs[id];
        if (def && def.label) return String(def.label);
        return id.toUpperCase();
    }

    function regenSecondsForType(type) {
        refreshThrowableConfig();
        var def = defs[String(type || '')];
        return Math.max(0, Number(def && def.regen || 0));
    }

    function plasmaFuseDelay(def) {
        var seconds = Number(def && (def.stickExplodeDelay != null ? def.stickExplodeDelay : def.fuse));
        return Math.max(0.2, isFinite(seconds) ? seconds : 0.2);
    }

    function plasmaMaxLife(def) {
        var maxLife = Number(def && def.maxLife);
        if (isFinite(maxLife) && maxLife > 0) return maxLife;
        return plasmaFuseDelay(def);
    }

    function explosiveMinDamage(def) {
        var value = Number(def && def.minBlastDamage);
        if (!isFinite(value)) value = 0;
        return Math.max(0, Math.round(value));
    }

    function resetInventory() {
        refreshThrowableConfig();
        inventory = {};
        for (var i = 0; i < throwableOrder.length; i++) {
            var id = throwableOrder[i];
            inventory[id] = {
                charges: 1,
                maxCharges: 1,
                cooldownRemaining: 0
            };
        }
    }

    function getWorldTargets() {
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        var hitboxes = globalThis.__MAYHEM_RUNTIME.GameEnemy.getHitboxArray ? globalThis.__MAYHEM_RUNTIME.GameEnemy.getHitboxArray() : [];
        return {
            worldMeshes: worldMeshes || [],
            hitboxes: hitboxes || []
        };
    }

    function getThrowableState() {
        refreshThrowableConfig();
        var out = {};
        for (var i = 0; i < throwableOrder.length; i++) {
            var id = throwableOrder[i];
            var inv = inventory[id];
            if (!inv) continue;
            out[id] = {
                id: id,
                label: inventoryLabelForType(id),
                charges: Math.max(0, Number(inv.charges || 0)),
                maxCharges: Math.max(1, Number(inv.maxCharges || 1)),
                cooldownRemaining: Math.max(0, Number(inv.cooldownRemaining || 0))
            };
        }
        return out;
    }

    function consumeCharge(type) {
        var inv = inventory[type];
        if (!inv || inv.charges <= 0) return false;
        inv.charges--;
        if (debugInstantCooldowns) {
            inv.charges = inv.maxCharges;
            inv.cooldownRemaining = 0;
        } else if (inv.charges < inv.maxCharges && inv.cooldownRemaining <= 0) {
            inv.cooldownRemaining = regenSecondsForType(type);
        }
        return true;
    }

    function regenCharges(dt) {
        refreshThrowableConfig();
        for (var i = 0; i < throwableOrder.length; i++) {
            var id = throwableOrder[i];
            var inv = inventory[id];
            if (!inv || inv.charges >= inv.maxCharges) continue;

            inv.cooldownRemaining -= dt;
            if (inv.cooldownRemaining <= 0) {
                inv.charges++;
                if (inv.charges < inv.maxCharges) {
                    inv.cooldownRemaining += regenSecondsForType(id);
                } else {
                    inv.cooldownRemaining = 0;
                }
            }
        }
    }

    function refillExplosives() {
        var ids = ['frag', 'plasma', 'molotov'];
        for (var i = 0; i < ids.length; i++) {
            var inv = inventory[ids[i]];
            if (!inv) continue;
            inv.charges = inv.maxCharges;
            inv.cooldownRemaining = 0;
        }
    }

    function removeNetFireZoneById(id) {
        var zone = netFireZoneMap[id];
        if (!zone) return;
        if (zone.mesh && zone.mesh.parent) zone.mesh.parent.remove(zone.mesh);
        delete netFireZoneMap[id];
    }

    function effectPaletteForProjectileType(type) {
        if (type === 'missile') {
            return {
                flash: 0xffb15c,
                explosion: 0xff9a2f
            };
        }
        if (type === 'plasma' || type === 'plasma_stream') {
            return {
                flash: 0x66ddff,
                explosion: 0x59d7ff
            };
        }
        if (type === 'molotov') {
            return {
                flash: 0xff7a33,
                explosion: 0xff6622
            };
        }
        return {
            flash: 0xffffff,
            explosion: 0xffaa22
        };
    }

    var trajectoryApi = null;
    var fireZoneApi = null;
    var projectileFactory = globalThis.__MAYHEM_RUNTIME.GameThrowablesProjectileRuntime || null;
    if (!projectileFactory || !projectileFactory.create) {
        throw new Error('GameThrowablesProjectileRuntime must load before throwables.js');
    }
    var projectileApi = projectileFactory.create({
        getScene: function () { return sceneRef; },
        getDefs: function () { refreshThrowableConfig(); return defs; },
        getMechanicsTuning: function () { refreshThrowableConfig(); return throwableMechanicsTuning; },
        getDistanceTuning: function () { refreshThrowableConfig(); return throwableDistanceTuning; },
        getWorldTargets: getWorldTargets,
        buildThrowIntent: function (camera, options) {
            return trajectoryApi ? trajectoryApi.buildThrowIntent(camera, options) : null;
        },
        buildThrowVelocity: function (def, intent, useExplicitDirection) {
            return trajectoryApi ? trajectoryApi.buildThrowVelocity(def, intent, useExplicitDirection) : null;
        },
        reportHit: reportHit,
        effectPaletteForProjectileType: effectPaletteForProjectileType,
        explosiveMinDamage: explosiveMinDamage,
        plasmaMaxLife: plasmaMaxLife,
        plasmaFuseDelay: plasmaFuseDelay,
        refillExplosives: refillExplosives,
        createFireZone: function (position) {
            if (fireZoneApi) fireZoneApi.createFireZone(position);
        }
    });

    var trajectoryFactory = globalThis.__MAYHEM_RUNTIME.GameThrowablesTrajectory || null;
    if (!trajectoryFactory || !trajectoryFactory.create) {
        throw new Error('GameThrowablesTrajectory must load before throwables.js');
    }
    trajectoryApi = trajectoryFactory.create({
        getDefs: function () { refreshThrowableConfig(); return defs; },
        getScene: function () { return sceneRef; },
        getMechanicsTuning: function () { refreshThrowableConfig(); return throwableMechanicsTuning; },
        getDistanceTuning: function () { refreshThrowableConfig(); return throwableDistanceTuning; },
        getWorldTargets: getWorldTargets,
        segmentCollision: projectileApi.segmentCollision,
        plasmaMaxLife: plasmaMaxLife,
        onIntentBuilt: function (intent) {
            debugTelemetry.lastIntent = {
                origin: { x: intent.origin.x, y: intent.origin.y, z: intent.origin.z },
                direction: { x: intent.direction.x, y: intent.direction.y, z: intent.direction.z },
                aimPoint: intent.aimPoint ? { x: intent.aimPoint.x, y: intent.aimPoint.y, z: intent.aimPoint.z } : null
            };
        }
    });

    var fireZoneFactory = globalThis.__MAYHEM_RUNTIME.GameThrowablesFireZones || null;
    if (!fireZoneFactory || !fireZoneFactory.create) {
        throw new Error('GameThrowablesFireZones must load before throwables.js');
    }
    fireZoneApi = fireZoneFactory.create({
        getDefs: function () { refreshThrowableConfig(); return defs; },
        getScene: function () { return sceneRef; },
        effectPaletteForProjectileType: effectPaletteForProjectileType,
        spawnExplosionBurst: projectileApi.spawnExplosionBurst,
        reportHit: reportHit
    });

    function buildThrowIntent(camera, options) {
        return trajectoryApi.buildThrowIntent(camera, options);
    }

    function updateTrajectoryPreview(type, intent) {
        return trajectoryApi.updateTrajectoryPreview(type, intent);
    }

    function clearTrajectoryPreview() {
        trajectoryApi.clearTrajectoryPreview();
    }

    function reportHit(onEnemyHit, hitPoint, damage, hitType, result, source, special) {
        if (!onEnemyHit || !result) return;
        var targetId = '';
        if (result.enemy && Number.isFinite(Number(result.enemy.index))) {
            targetId = 'enemy:' + String(result.enemy.index);
        }
        onEnemyHit({
            hitPoint: hitPoint.clone(),
            damage: damage,
            hitType: hitType,
            result: result,
            targetId: targetId,
            source: source,
            special: special || null
        });
    }


    GameThrowables.init = function (scene) {
        refreshThrowableConfig(true);
        trajectoryApi.reset();
        projectileApi.reset();
        fireZoneApi.reset();
        sceneRef = scene;
        netFireZoneMap = {};
        debugTelemetry.lastIntent = null;
        debugTelemetry.lastAckClientThrowId = '';
        debugTelemetry.lastRejectClientThrowId = '';
        debugTelemetry.lastReconcileClientThrowId = '';
        debugTelemetry.predictedCount = 0;
        resetInventory();
    };

    GameThrowables.shutdown = function () {
        trajectoryApi.reset();
        projectileApi.reset();
        fireZoneApi.reset();
        sceneRef = null;
        netFireZoneMap = {};
        debugTelemetry.lastIntent = null;
        debugTelemetry.lastAckClientThrowId = '';
        debugTelemetry.lastRejectClientThrowId = '';
        debugTelemetry.lastReconcileClientThrowId = '';
        debugTelemetry.predictedCount = 0;
        resetInventory();
    };

    GameThrowables.getTypes = function () {
        refreshThrowableConfig();
        return throwableOrder.slice();
    };

    GameThrowables.getCatalog = function () {
        refreshThrowableConfig();
        var out = [];
        for (var i = 0; i < throwableOrder.length; i++) {
            var id = throwableOrder[i];
            var def = defs[id];
            if (!def) continue;
            out.push({
                id: def.id,
                label: def.label,
                speed: def.speed,
                upward: def.upward,
                gravity: def.gravity,
                fuse: def.fuse,
                maxLife: def.maxLife,
                radius: def.radius,
                catchRadius: def.catchRadius,
                damage: def.damage,
                stickExplodeDelay: def.stickExplodeDelay,
                fireRadius: def.fireRadius,
                fireDuration: def.fireDuration,
                fireTickDamage: def.fireTickDamage,
                fireTickRate: def.fireTickRate,
                life: def.life,
                bodyDamage: def.bodyDamage,
                headDamage: def.headDamage,
                regen: def.regen
            });
        }
        return out;
    };

    GameThrowables.getState = function () {
        return getThrowableState();
    };

    GameThrowables.getMissileTuning = function () {
        refreshThrowableConfig();
        var def = defs.missile;
        if (!def) return null;
        return {
            speed: def.speed,
            gravity: def.gravity,
            fuse: def.fuse,
            homingBoost: def.homingBoost || 0,
            homingLerp: def.homingLerp || 0,
            lockHalfAngleDeg: def.lockHalfAngleDeg || 0
        };
    };

    GameThrowables.getPlasmaDebugState = function (camera) {
        return trajectoryApi.getPlasmaDebugState(camera);
    };

    GameThrowables.getDebugState = function (camera) {
        refreshThrowableConfig();
        var selectedId = String(selectedThrowableId || '');
        var def = defs[selectedId] || null;
        var inv = inventory[selectedId] || null;
        var previewType = GameThrowables.getPreviewType(selectedId);
        return {
            selectedThrowableId: selectedId,
            label: def && def.label ? String(def.label) : selectedId.toUpperCase(),
            previewType: previewType,
            charges: inv ? Math.max(0, Number(inv.charges || 0)) : 0,
            cooldownRemaining: inv ? Math.max(0, Number(inv.cooldownRemaining || 0)) : 0,
            telemetry: GameThrowables.getDebugTelemetry(),
            plasma: selectedId === 'plasma' ? GameThrowables.getPlasmaDebugState(camera) : null
        };
    };

    /**
     * Throw a specific type if charge is available
     * @param {string} type - frag|plasma|molotov|knife
     * @param {THREE.Camera} camera
     * @returns {Object} { ok, reason, state }
     */
    GameThrowables.buildThrowIntent = function (camera, options) {
        var intent = buildThrowIntent(camera, options);
        if (!intent) return null;
        return {
            origin: { x: intent.origin.x, y: intent.origin.y, z: intent.origin.z },
            direction: { x: intent.direction.x, y: intent.direction.y, z: intent.direction.z },
            aimPoint: intent.aimPoint ? { x: intent.aimPoint.x, y: intent.aimPoint.y, z: intent.aimPoint.z } : null
        };
    };

    function intentToVectors(intent) {
        if (!intent || !intent.origin || !intent.direction) return null;
        var origin = new THREE.Vector3(
            Number(intent.origin.x || 0),
            Number(intent.origin.y || 0),
            Number(intent.origin.z || 0)
        );
        var direction = new THREE.Vector3(
            Number(intent.direction.x || 0),
            Number(intent.direction.y || 0),
            Number(intent.direction.z || 0)
        );
        if (!isFinite(direction.x) || !isFinite(direction.y) || !isFinite(direction.z) || direction.lengthSq() < 0.00001) return null;
        return {
            origin: origin,
            direction: direction.normalize()
        };
    }

    GameThrowables.updateTrajectoryPreview = function (type, camera, intentPayload) {
        refreshThrowableConfig();
        if (!type || !defs[type] || !camera) {
            clearTrajectoryPreview();
            return null;
        }

        var intent = intentToVectors(intentPayload);
        if (!intent) {
            intent = buildThrowIntent(camera);
        }
        return updateTrajectoryPreview(type, intent);
    };

    GameThrowables.clearTrajectoryPreview = function () {
        clearTrajectoryPreview();
    };

    GameThrowables.getTrajectoryPreviewTuning = function () {
        return trajectoryApi.getTrajectoryPreviewTuning();
    };

    GameThrowables.throw = function (type, camera, intentPayload) {
        refreshThrowableConfig();
        if (!defs[type]) {
            return { ok: false, reason: 'unknown', state: getThrowableState() };
        }
        if (!consumeCharge(type)) {
            return { ok: false, reason: 'cooldown', state: getThrowableState() };
        }

        var intent = intentToVectors(intentPayload);
        var spawned = projectileApi.spawnProjectile(type, camera, intent ? { intent: intent } : undefined);
        if (!spawned) {
            inventory[type].charges++;
            return { ok: false, reason: 'spawn_failed', state: getThrowableState() };
        }

        return { ok: true, reason: '', state: getThrowableState() };
    };

    GameThrowables.buildClientThrowId = function () {
        return projectileApi.buildClientThrowId();
    };

    var authoritativeSyncApi = (globalThis.__MAYHEM_RUNTIME.GameThrowablesAuthoritativeSync && globalThis.__MAYHEM_RUNTIME.GameThrowablesAuthoritativeSync.create)
        ? globalThis.__MAYHEM_RUNTIME.GameThrowablesAuthoritativeSync.create({
            getDefs: function () { refreshThrowableConfig(); return defs; },
            getScene: function () { return sceneRef; },
            getInventory: function () { return inventory; },
            getThrowableOrder: function () { refreshThrowableConfig(); return throwableOrder; },
            getPredictedByClientId: projectileApi.getPredictedByClientId,
            getNetProjectileMap: projectileApi.getNetProjectileMap,
            getNetFireZoneMap: function () { return netFireZoneMap; },
            getProjectiles: projectileApi.getProjectiles,
            getDebugTelemetry: function () { return debugTelemetry; },
            createThrowableMesh: projectileApi.createThrowableMesh,
            buildFireZoneMesh: fireZoneApi.buildFireZoneMesh,
            orientProjectileVisual: projectileApi.orientProjectileVisual,
            updateFireZoneVisual: fireZoneApi.updateFireZoneVisual,
            effectPaletteForProjectileType: effectPaletteForProjectileType,
            spawnFlash: projectileApi.spawnFlash,
            spawnExplosionBurst: projectileApi.spawnExplosionBurst,
            removeProjectile: projectileApi.removeProjectile,
            removePredictedProjectileByClientThrowId: projectileApi.removePredictedProjectileByClientThrowId,
            removePredictedProjectileByAuthoritativeId: projectileApi.removePredictedProjectileByAuthoritativeId,
            removeNetProjectileVisual: projectileApi.removeNetProjectileVisual,
            removeNetProjectileById: projectileApi.removeNetProjectileById,
            removeNetFireZoneById: removeNetFireZoneById
        })
        : null;

    GameThrowables.throwPredicted = function (type, camera, clientThrowId, intentPayload) {
        var intent = intentToVectors(intentPayload);
        return projectileApi.throwPredicted(type, camera, clientThrowId, intent || null);
    };

    GameThrowables.confirmPredictedThrow = function (clientThrowId, ack) {
        return authoritativeSyncApi
            ? authoritativeSyncApi.confirmPredictedThrow(clientThrowId, ack)
            : false;
    };

    GameThrowables.rejectPredictedThrow = function (clientThrowId) {
        return authoritativeSyncApi
            ? authoritativeSyncApi.rejectPredictedThrow(clientThrowId)
            : false;
    };

    GameThrowables.setNetworkInventoryState = function (state) {
        if (!authoritativeSyncApi) return;
        authoritativeSyncApi.setNetworkInventoryState(state);
    };

    GameThrowables.syncAuthoritativeState = function (payload, selfId) {
        if (!authoritativeSyncApi) return;
        authoritativeSyncApi.syncAuthoritativeState(payload, selfId);
    };

    GameThrowables.applyNetworkEvent = function (event) {
        if (!authoritativeSyncApi) return;
        authoritativeSyncApi.applyNetworkEvent(event);
    };

    GameThrowables.fireAbilityMissile = function (camera, options) {
        return projectileApi.fireAbilityMissile(camera, options);
    };

    /**
     * Update projectiles, aoe zones, and inventory regen
     * @param {number} dt
     * @param {Function} onEnemyHit - callback({hitPoint, damage, hitType, result, source, special})
     */
    GameThrowables.update = function (dt, onEnemyHit) {
        regenCharges(dt);
        projectileApi.update(dt, onEnemyHit);
        fireZoneApi.update(dt, onEnemyHit);
        debugTelemetry.predictedCount = projectileApi.getPredictedCount();
    };

    GameThrowables.setDebugMode = function (enabled) {
        refreshThrowableConfig();
        debugInstantCooldowns = !!enabled;
        trajectoryApi.setDebugPreviewVolumesEnabled(!!enabled);
        if (debugInstantCooldowns) {
            for (var i = 0; i < throwableOrder.length; i++) {
                var inv = inventory[throwableOrder[i]];
                if (inv) {
                    inv.charges = inv.maxCharges;
                    inv.cooldownRemaining = 0;
                }
            }
        }
    };

    GameThrowables.getDebugTelemetry = function () {
        return {
            lastIntent: debugTelemetry.lastIntent ? {
                origin: debugTelemetry.lastIntent.origin,
                direction: debugTelemetry.lastIntent.direction,
                aimPoint: debugTelemetry.lastIntent.aimPoint
            } : null,
            lastAckClientThrowId: debugTelemetry.lastAckClientThrowId,
            lastRejectClientThrowId: debugTelemetry.lastRejectClientThrowId,
            lastReconcileClientThrowId: debugTelemetry.lastReconcileClientThrowId,
            predictedCount: debugTelemetry.predictedCount
        };
    };

    GameThrowables.getSelectedThrowable = function () {
        refreshThrowableConfig();
        return selectedThrowableId;
    };

    GameThrowables.setSelectedThrowable = function (id) {
        refreshThrowableConfig();
        var nextId = normalizeSelectedThrowableId(id);
        if (defs[nextId] && throwableOrder.indexOf(nextId) !== -1) {
            selectedThrowableId = nextId;
            return true;
        }
        return false;
    };

    GameThrowables.getPreviewType = function (type) {
        refreshThrowableConfig();
        var def = defs[type];
        return (def && def.previewType) ? def.previewType : 'none';
    };

    GameThrowables.getThrowableDef = function (type) {
        refreshThrowableConfig();
        return defs[type] || null;
    };

    GameThrowables.checkPlasmaLockInCone = function (camera) {
        refreshThrowableConfig();
        if (!camera || !globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies) return false;
        var enemies = globalThis.__MAYHEM_RUNTIME.GameEnemy.getEnemies();
        if (!enemies || !enemies.length) return false;

        var origin = camera.position;
        var forward = new THREE.Vector3();
        camera.getWorldDirection(forward);

        var plasmaDef = defs['plasma'];
        var halfAngleDeg = Math.max(0, Number(plasmaDef && plasmaDef.acquireHalfAngleDeg || 0));
        var cosLimit = Math.cos(halfAngleDeg * Math.PI / 180);
        var maxRange = Math.max(0, Number(throwableDistanceTuning.plasmaAcquireRange || 0));

        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];
            if (!enemy || !enemy.alive || !enemy.group || !enemy.group.position) continue;
            var toEnemy = enemy.group.position.clone().sub(origin);
            toEnemy.y += 1.5;
            var dist = toEnemy.length();
            if (dist <= 0.001 || dist > maxRange) continue;
            toEnemy.divideScalar(dist);
            if (forward.dot(toEnemy) >= cosLimit) return true;
        }
        return false;
    };

    globalThis.__MAYHEM_RUNTIME.GameThrowables = GameThrowables;
})();
