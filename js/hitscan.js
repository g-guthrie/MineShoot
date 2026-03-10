/**
 * hitscan.js - Player weapons and hitscan logic
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameHitscan
 */
(function () {
    'use strict';

    var GameHitscan = {};

    var raycaster = new THREE.Raycaster();
    var losRaycaster = new THREE.Raycaster();
    var screenPoint = new THREE.Vector2(0, 0);
    var plasmaForward = new THREE.Vector3();
    var plasmaMuzzle = new THREE.Vector3();
    var tracerStart = new THREE.Vector3();
    var tracerMissEnd = new THREE.Vector3();
    var tracerMaxCount = 96;
    var tracerPool = [];
    var tracerCursor = 0;
    var tracerScene = null;
    var tracerInstancedMesh = null;
    var tracerPoolReady = false;
    var tracerTmpMatrix = new THREE.Matrix4();
    var tracerTmpPos = new THREE.Vector3();
    var tracerTmpQuat = new THREE.Quaternion();
    var tracerTmpScale = new THREE.Vector3();

    var tracerMeshMid = new THREE.Vector3();
    var tracerMeshUp = new THREE.Vector3(0, 1, 0);
    var tracerZeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    var playerForward = new THREE.Vector3();
    var hitFromPlayer = new THREE.Vector3();

    var PRIMITIVE_HITSCAN_SINGLE = 'hitscan_single';
    var PRIMITIVE_HITSCAN_MULTI = 'hitscan_multi';
    var TRACER_ORIGIN_FORWARD_OFFSET = 0.12;

    var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
    var sharedTuning = shared.gameplayTuning || {};
    var sharedWeaponStats = sharedTuning.weaponStats || {};

    function resolveWeaponAimProfileLocal(weaponStats, adsActive) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        if (shared.resolveWeaponAimProfile) {
            return shared.resolveWeaponAimProfile(weaponStats, adsActive);
        }
        var stats = weaponStats || {};
        var hipfireSpread = Math.max(0, Number(stats.hipfireSpread || 0));
        var hipfireRange = Math.max(0, Number(stats.maxRange || 0));
        if (!adsActive) {
            return { spread: hipfireSpread, maxRange: hipfireRange };
        }
        return {
            spread: Math.max(0, Number(stats.adsSpread != null ? stats.adsSpread : (hipfireSpread * Math.max(0, Number(stats.adsSpreadMultiplier != null ? stats.adsSpreadMultiplier : 1))))),
            maxRange: Math.max(hipfireRange, Number(stats.adsMaxRange != null ? stats.adsMaxRange : (hipfireRange * Math.max(1, Number(stats.adsHitscanRangeMultiplier || 1)))))
        };
    }

    function buildWeaponFromShared(id) {
        var s = sharedWeaponStats[id] || {};
        var hipAim = resolveWeaponAimProfileLocal({
            hipfireSpread: Number(s.hipfireSpread || 0),
            maxRange: Number(s.maxRange || 0),
            adsSpread: s.adsSpread,
            adsMaxRange: s.adsMaxRange,
            adsSpreadMultiplier: s.adsSpreadMultiplier,
            adsHitscanRangeMultiplier: s.adsHitscanRangeMultiplier,
            aimProfile: s.aimProfile,
            infiniteRange: !!s.infiniteRange
        }, false);
        var adsAim = resolveWeaponAimProfileLocal({
            hipfireSpread: Number(s.hipfireSpread || 0),
            maxRange: Number(s.maxRange || 0),
            adsSpread: s.adsSpread,
            adsMaxRange: s.adsMaxRange,
            adsSpreadMultiplier: s.adsSpreadMultiplier,
            adsHitscanRangeMultiplier: s.adsHitscanRangeMultiplier,
            aimProfile: s.aimProfile,
            infiniteRange: !!s.infiniteRange
        }, true);
        return {
            id: id,
            name: s.name || id,
            primitiveType: s.primitiveType || PRIMITIVE_HITSCAN_SINGLE,
            automatic: !!s.automatic,
            cooldown: Number(s.cooldownMs || 0),
            reloadMs: Math.max(0, Number(s.reloadMs || 0)),
            magazineSize: Math.max(0, Number(s.magazineSize || 0)),
            bodyDamage: Number(s.bodyDamage || 0),
            headDamage: Number(s.headDamage || 0),
            pellets: Number(s.pellets || 1),
            hipfireSpread: Number(hipAim.spread || 0),
            adsSpread: Number(adsAim.spread || 0),
            maxRange: hipAim.maxRange === Infinity ? Number.POSITIVE_INFINITY : Number(hipAim.maxRange || 0),
            adsMaxRange: adsAim.maxRange === Infinity ? Number.POSITIVE_INFINITY : Number(adsAim.maxRange || 0),
            adsSpreadMultiplier: Number(hipAim.spread > 0 ? (Number(adsAim.spread || 0) / hipAim.spread) : 0),
            adsHitscanRangeMultiplier: Number(hipAim.maxRange > 0 ? (Number(adsAim.maxRange || hipAim.maxRange) / hipAim.maxRange) : 1),
            hipfireBloomScale: Number(s.hipfireBloomScale != null ? s.hipfireBloomScale : 1),
            adsBloomScale: Number(s.adsBloomScale != null ? s.adsBloomScale : 1)
        };
    }

    function selectableWeaponIds() {
        if (shared.getSelectableWeaponIds) {
            return shared.getSelectableWeaponIds().filter(function (id) {
                return !!sharedWeaponStats[String(id || '')];
            });
        }
        var ids = [];
        for (var id in sharedWeaponStats) {
            if (Object.prototype.hasOwnProperty.call(sharedWeaponStats, id)) ids.push(id);
        }
        return ids;
    }

    function weaponFalloffProfile(weaponId) {
        if (shared.getWeaponFalloffProfile) {
            return shared.getWeaponFalloffProfile(weaponId);
        }
        var profile = sharedTuning.weaponFalloff && sharedTuning.weaponFalloff[String(weaponId || '')];
        return Array.isArray(profile) ? profile.slice() : [];
    }

    var weaponCatalogOrder = selectableWeaponIds();
    var weaponOrder = weaponCatalogOrder.slice();
    var weapons = {};
    for (var wi = 0; wi < weaponCatalogOrder.length; wi++) {
        weapons[weaponCatalogOrder[wi]] = buildWeaponFromShared(weaponCatalogOrder[wi]);
    }

    var weaponFalloffTuning = {};
    for (var fi = 0; fi < weaponCatalogOrder.length; fi++) {
        var fid = weaponCatalogOrder[fi];
        weaponFalloffTuning[fid] = weaponFalloffProfile(fid);
    }

    var currentWeaponId = weaponOrder[0] || 'rifle';
    var lastFireTime = 0;
    var weaponAmmoState = {};
    var RELOADED_FLASH_MS = 900;
    function ensureTracerScene(camera) {
        if (tracerScene) return tracerScene;
        if (camera && camera.parent) {
            tracerScene = camera.parent;
            return tracerScene;
        }
        return null;
    }

    function sharedSeekCore() {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        if (shared.seekCore) return shared.seekCore;
        return null;
    }

    function adsState() {
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState) {
            return globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState();
        }
        return null;
    }

    function isAdsActiveForWeapon(weaponId) {
        var state = adsState();
        return !!(state && state.active && state.weaponId === weaponId);
    }

    function toSeekCandidate(rawTarget) {
        if (!rawTarget || !rawTarget.worldPos) return null;
        return {
            id: rawTarget.targetId || '',
            ownerType: rawTarget.ownerType || 'unknown',
            corePos: rawTarget.worldPos,
            alive: rawTarget.alive !== false,
            rawTarget: rawTarget
        };
    }

    function selectSeekLock(camera, maxRange, boxSizePx, options) {
        if (!camera) return null;
        var seekCore = sharedSeekCore();
        if (!seekCore || !seekCore.selectSeekTarget) return null;
        var lockTargets = (options && Array.isArray(options.targetsList)) ? options.targetsList : (getLockTargets() || []);
        var candidates = [];
        for (var i = 0; i < lockTargets.length; i++) {
            var c = toSeekCandidate(lockTargets[i]);
            if (c) candidates.push(c);
        }
        var origin = camera.position;
        camera.getWorldDirection(plasmaForward);
        var forward = {
            x: plasmaForward.x,
            y: plasmaForward.y,
            z: plasmaForward.z
        };
        return seekCore.selectSeekTarget({
            origin: {
                x: origin.x,
                y: origin.y,
                z: origin.z
            },
            forward: forward,
            candidates: candidates,
            maxRange: maxRange,
            coneHalfAngleDeg: options && typeof options.coneHalfAngleDeg === 'number' ? options.coneHalfAngleDeg : 180,
            ownerTypes: options && options.ownerTypes ? options.ownerTypes : null,
            boxSizePx: boxSizePx,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            projectToNdc: function (worldPos) {
                if (!worldPos || !worldPos.clone || !worldPos.project) return null;
                var projected = worldPos.clone().project(camera);
                return { x: projected.x, y: projected.y, z: projected.z };
            },
            hasWorldLos: function (worldPos) {
                return hasLineOfSight(camera, worldPos, maxRange);
            }
        });
    }

    function fireHitscanPattern(camera, weapon, onHit, onMiss) {
        var pellets = weapon.pellets || 1;
        var anyHit = false;
        var drawTracersForShot = shouldDrawTracerForShot(weapon);
        var shotgunTracerCap = 8;
        for (var i = 0; i < pellets; i++) {
            var shouldTraceThisPellet = drawTracersForShot && (weapon.id !== 'shotgun' || i < shotgunTracerCap);
            var hit = fireSinglePellet(
                camera,
                weapon,
                i,
                onHit,
                shouldTraceThisPellet ? function (traceEnd) {
                    spawnTracer(camera, weapon.id, traceEnd);
                } : null
            );
            anyHit = anyHit || hit;
        }

        if (!anyHit && onMiss) onMiss();
        return true;
    }

    function initTracerPool(camera) {
        if (tracerPoolReady) return true;
        if (!ensureTracerScene(camera)) return false;

        var geo = new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8);
        var mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
            depthTest: false
        });
        tracerInstancedMesh = new THREE.InstancedMesh(geo, mat, tracerMaxCount);
        tracerInstancedMesh.frustumCulled = false;
        tracerInstancedMesh.renderOrder = 40;

        for (var i = 0; i < tracerMaxCount; i++) {
            tracerInstancedMesh.setMatrixAt(i, tracerZeroMatrix);
            tracerPool.push({
                origin: new THREE.Vector3(),
                dir: new THREE.Vector3(),
                head: new THREE.Vector3(),
                tail: new THREE.Vector3(),
                speed: 0,
                segmentLength: 0,
                traveled: 0,
                maxDistance: 0,
                life: 0,
                maxLife: 0.12,
                framesAlive: 0,
                baseColor: null
            });
        }
        tracerInstancedMesh.instanceMatrix.needsUpdate = true;
        tracerScene.add(tracerInstancedMesh);
        tracerPoolReady = true;
        return true;
    }

    function allocTracer(camera) {
        if (!initTracerPool(camera)) return null;
        tracerCursor = (tracerCursor + 1) % tracerMaxCount;
        return tracerCursor;
    }

    function shouldDrawTracerForShot(weapon) {
        if (!weapon || !weapon.id) return false;
        if (weapon.id === 'machinegun') return true;
        return true;
    }


    function tracerLifeForWeapon(weaponId) {
        if (weaponId === 'machinegun') return 0.075;
        if (weaponId === 'shotgun') return 0.1;
        if (weaponId === 'sniper') return 0.12;
        return 0.11;
    }

    function tracerSpeedForWeapon(weaponId) {
        if (weaponId === 'machinegun') return 260;
        if (weaponId === 'shotgun') return 230;
        if (weaponId === 'sniper') return 320;
        return 280;
    }

    function tracerSegmentLengthForWeapon(weaponId) {
        if (weaponId === 'machinegun') return 1.25;
        if (weaponId === 'shotgun') return 1.9;
        if (weaponId === 'sniper') return 2.6;
        return 2.1;
    }

    function spawnTracer(camera, weaponId, endPoint) {
        if (!camera || !endPoint) return;
        var idx = allocTracer(camera);
        if (idx === null) return;
        var tracer = tracerPool[idx];

        resolvePlasmaMuzzle(camera);
        tracerStart.copy(plasmaMuzzle);
        tracer.origin.copy(tracerStart);
        tracer.dir.copy(endPoint).sub(tracerStart);
        var len = tracer.dir.length();
        if (len <= 0.001) return;
        tracer.dir.divideScalar(len);
        tracer.head.copy(tracer.origin);
        tracer.tail.copy(tracer.origin);
        tracer.traveled = 0;
        tracer.maxDistance = len;
        tracer.segmentLength = tracerSegmentLengthForWeapon(weaponId);
        tracer.speed = tracerSpeedForWeapon(weaponId);
        tracer.framesAlive = 0;

        tracer.maxLife = tracerLifeForWeapon(weaponId);
        tracer.life = tracer.maxLife;
    }

    function getCombatHitboxes() {
        var out = [];
        if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.getHitboxArray) {
            var local = globalThis.__MAYHEM_RUNTIME.GameEnemy.getHitboxArray() || [];
            out = out.concat(local);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getHitboxArray) {
            var net = globalThis.__MAYHEM_RUNTIME.GameNet.getHitboxArray() || [];
            out = out.concat(net);
        }
        return out;
    }

    function getCurrentWeaponData() {
        return weapons[currentWeaponId] || weapons.rifle;
    }

    function ensureWeaponAmmoState(weaponId) {
        var weapon = weapons[weaponId];
        if (!weapon) return null;
        if (!weaponAmmoState[weaponId]) {
            weaponAmmoState[weaponId] = {
                ammoInMag: weapon.magazineSize > 0 ? weapon.magazineSize : 0,
                reloadUntil: 0,
                reloadedFlashUntil: 0
            };
        }
        return weaponAmmoState[weaponId];
    }

    function syncWeaponAmmoState(weaponId, now) {
        var weapon = weapons[weaponId];
        var state = ensureWeaponAmmoState(weaponId);
        if (!weapon || !state || weapon.magazineSize <= 0) return state;
        if (state.reloadUntil > 0 && now >= state.reloadUntil) {
            state.reloadUntil = 0;
            state.ammoInMag = weapon.magazineSize;
            state.reloadedFlashUntil = now + RELOADED_FLASH_MS;
        }
        return state;
    }

    function getAmmoInMag(weapon, now) {
        if (!weapon || weapon.magazineSize <= 0) return 0;
        var state = syncWeaponAmmoState(weapon.id, now);
        return Math.max(0, Number(state && state.ammoInMag || 0));
    }

    function reloadRemainingForWeapon(weapon, now) {
        if (!weapon || weapon.magazineSize <= 0) return 0;
        var state = syncWeaponAmmoState(weapon.id, now);
        return Math.max(0, Number(state && state.reloadUntil || 0) - now);
    }

    function isReloadingWeapon(weapon, now) {
        return reloadRemainingForWeapon(weapon, now) > 0;
    }

    function beginReload(weapon, now) {
        if (!weapon || weapon.magazineSize <= 0 || weapon.reloadMs <= 0) return false;
        var state = syncWeaponAmmoState(weapon.id, now);
        if (!state || state.reloadUntil > now) return false;
        state.ammoInMag = 0;
        state.reloadUntil = now + weapon.reloadMs;
        state.reloadedFlashUntil = 0;
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.setAdsEnabled) {
            globalThis.__MAYHEM_RUNTIME.GamePlayer.setAdsEnabled(false);
        }
        return true;
    }

    function consumeAmmoForShot(weapon, now) {
        if (!weapon || weapon.magazineSize <= 0) return;
        var state = syncWeaponAmmoState(weapon.id, now);
        if (!state) return;
        state.ammoInMag = Math.max(0, Number(state.ammoInMag || weapon.magazineSize) - 1);
        state.reloadedFlashUntil = 0;
        if (state.ammoInMag <= 0) {
            beginReload(weapon, now);
        }
    }

    function hudStateForWeapon(weapon, now) {
        var state = syncWeaponAmmoState(weapon.id, now);
        var reloadRemaining = reloadRemainingForWeapon(weapon, now);
        if (reloadRemaining > 0) {
            return {
                status: 'reloading',
                ready: false,
                pct: weapon.reloadMs > 0 ? (1 - (reloadRemaining / weapon.reloadMs)) : 1
            };
        }
        var cooldownRemaining = Math.max(0, weapon.cooldown - (now - lastFireTime));
        if (cooldownRemaining > 0) {
            return {
                status: 'cooldown',
                ready: false,
                pct: weapon.cooldown > 0 ? (1 - (cooldownRemaining / weapon.cooldown)) : 1
            };
        }
        if (state && state.reloadedFlashUntil > now) {
            return {
                status: 'reloaded',
                ready: true,
                pct: 1
            };
        }
        return {
            status: 'ready',
            ready: true,
            pct: 1
        };
    }

    function getEffectiveMaxRange(weapon) {
        var baseRange = Number(weapon && weapon.maxRange || 0);
        if (!weapon || baseRange <= 0) return 0;
        if (!isAdsActiveForWeapon(weapon.id)) return baseRange;
        return Number(weapon.adsMaxRange || baseRange);
    }

    function getDamageForType(weapon, hitType) {
        return hitType === 'head' ? weapon.headDamage : weapon.bodyDamage;
    }

    var sharedDamage = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.damage) || null;

    function applyDistanceFalloff(weapon, damage, distance) {
        if (!weapon || !weapon.id) return damage;
        var bands = weaponFalloffTuning[weapon.id];
        if (sharedDamage && sharedDamage.applyFalloff) return sharedDamage.applyFalloff(damage, distance, bands);
        if (!Array.isArray(bands) || bands.length === 0) return damage;
        for (var i = 0; i < bands.length; i++) {
            var band = bands[i];
            if (!band || typeof band.maxDistance !== 'number' || typeof band.scale !== 'number') continue;
            if (distance <= band.maxDistance) {
                return Math.max(1, Math.round(damage * Math.max(0, band.scale)));
            }
        }
        var tail = bands[bands.length - 1];
        var tailScale = (tail && typeof tail.scale === 'number') ? Math.max(0, tail.scale) : 1;
        return Math.max(1, Math.round(damage * tailScale));
    }

    function getWeaponSpreadMultiplier(weapon) {
        if (!weapon || !weapon.id) return 0;
        if (!isAdsActiveForWeapon(weapon.id)) return 1;
        if (weapon.hipfireSpread <= 0.00001) return 0;
        return Math.max(0, Number((weapon.adsSpread || 0) / weapon.hipfireSpread));
    }

    function getActiveAimSpread(weapon) {
        if (!weapon) return 0;
        var aim = resolveWeaponAimProfileLocal(weapon, isAdsActiveForWeapon(weapon.id));
        return Math.max(0, Number(aim && aim.spread || 0));
    }

    function getBloomDisplayScale(weapon) {
        if (!weapon) return 1;
        var adsActive = isAdsActiveForWeapon(weapon.id);
        var scale = adsActive ? weapon.adsBloomScale : weapon.hipfireBloomScale;
        scale = Number(scale);
        return isFinite(scale) && scale >= 0 ? scale : 1;
    }

    function currentViewAspect() {
        var player = globalThis.__MAYHEM_RUNTIME.GamePlayer;
        var camera = player && player.getCamera ? player.getCamera() : null;
        if (camera && isFinite(Number(camera.aspect)) && Number(camera.aspect) > 0.0001) {
            return Number(camera.aspect);
        }
        return window.innerWidth / Math.max(1, window.innerHeight);
    }

    function getWeaponSpreadMetrics(weapon) {
        if (!weapon) {
            return { radiusPx: 0, radiusXpx: 0, radiusYpx: 0, spread: 0 };
        }

        var spread = getActiveAimSpread(weapon) * getBloomDisplayScale(weapon);
        if (spread <= 0.00001) {
            return { radiusPx: 0, radiusXpx: 0, radiusYpx: 0, spread: 0 };
        }

        var aspect = currentViewAspect();
        var radiusYpx = spread * (window.innerHeight * 0.5);
        var radiusXpx = spread * (window.innerWidth * 0.5) / Math.max(aspect, 0.0001);
        var radiusPx = Math.max(radiusXpx, radiusYpx);

        return {
            radiusPx: radiusPx,
            radiusXpx: radiusXpx,
            radiusYpx: radiusYpx,
            spread: spread
        };
    }

    function getWeaponSpreadRadiusPx(weapon) {
        return getWeaponSpreadMetrics(weapon).radiusPx;
    }

    function getWeaponSpreadNdcOffset(weapon) {
        var radiusPx = getWeaponSpreadRadiusPx(weapon);
        if (!isFinite(radiusPx) || radiusPx <= 0.001) return { x: 0, y: 0 };

        var angle = Math.random() * Math.PI * 2;
        var radius = Math.sqrt(Math.random()) * radiusPx;
        return {
            x: (Math.cos(angle) * radius) / (window.innerWidth * 0.5),
            y: -((Math.sin(angle) * radius) / (window.innerHeight * 0.5))
        };
    }

    function getShotgunReticleSizePx() {
        return getWeaponSpreadRadiusPx(weapons.shotgun || getCurrentWeaponData()) * 2;
    }

    function getBloomCircleSizePx(weapon) {
        if (!weapon || weapon.id === 'shotgun') return 0;
        return getWeaponSpreadRadiusPx(weapon) * 2;
    }

    function getPelletNdcOffset(weapon, pelletIndex) {
        return getWeaponSpreadNdcOffset(weapon);
    }

    function getLockTargets() {
        var out = [];

        if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets) {
            out = out.concat(globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets() || []);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.getLockTargets) {
            out = out.concat(globalThis.__MAYHEM_RUNTIME.GameNet.getLockTargets() || []);
        }

        if (out.length > 0) return out;

        // Fallback to body hitboxes when lock target API is unavailable.
        var hitboxes = getCombatHitboxes();
        for (var i = 0; i < hitboxes.length; i++) {
            var hb = hitboxes[i];
            if (!hb || !hb.userData || hb.userData.type !== 'body') continue;
            out.push({
                targetId: hb.userData.targetId || '',
                ownerType: hb.userData.ownerType || 'unknown',
                worldPos: hb.position.clone(),
                hitbox: hb,
                alive: true
            });
        }

        return out;
    }

    function lockTargetPassesFilter(target, options) {
        if (!target) return false;
        if (!options) return true;

        if (options.ownerType && target.ownerType !== options.ownerType) return false;

        if (Array.isArray(options.ownerTypes) && options.ownerTypes.length > 0) {
            var matchedType = false;
            for (var i = 0; i < options.ownerTypes.length; i++) {
                if (target.ownerType === options.ownerTypes[i]) {
                    matchedType = true;
                    break;
                }
            }
            if (!matchedType) return false;
        }

        if (options.targetIdPrefix) {
            var targetId = String(target.targetId || '');
            if (targetId.indexOf(String(options.targetIdPrefix)) !== 0) return false;
        }

        return true;
    }

    function hasLineOfSight(camera, targetPos, maxRange) {
        if (!camera || !targetPos) return false;
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        var toTarget = plasmaForward.copy(targetPos).sub(camera.position);
        var distance = toTarget.length();
        if (distance <= 0.001 || distance > maxRange) return false;
        toTarget.divideScalar(distance);

        if (!worldMeshes || worldMeshes.length === 0) return true;

        losRaycaster.set(camera.position, toTarget);
        losRaycaster.far = Math.max(0, distance - 0.12);
        return losRaycaster.intersectObjects(worldMeshes, false).length === 0;
    }

    function selectSeekTargetByBox(camera, maxRange, boxSizePx, options) {
        var lockTargets = getLockTargets() || [];
        var filtered = [];
        for (var i = 0; i < lockTargets.length; i++) {
            var t = lockTargets[i];
            if (!t || t.alive === false || !t.worldPos) continue;
            if (!lockTargetPassesFilter(t, options)) continue;
            filtered.push(t);
        }
        var lock = selectSeekLock(camera, maxRange, boxSizePx, {
            coneHalfAngleDeg: 180,
            targetsList: filtered
        });
        return lock && lock.candidate ? lock.candidate.rawTarget : null;
    }

    function selectSeekTargetByRect(camera, maxRange, boxWidthPx, boxHeightPx, options) {
        if (!camera) return null;
        var seekCore = sharedSeekCore();
        if (!seekCore || !seekCore.selectSeekTarget) return null;
        var lockTargets = getLockTargets() || [];
        var filtered = [];
        for (var i = 0; i < lockTargets.length; i++) {
            var t = lockTargets[i];
            if (!t || t.alive === false || !t.worldPos) continue;
            if (!lockTargetPassesFilter(t, options)) continue;
            filtered.push(t);
        }
        var origin = camera.position;
        camera.getWorldDirection(plasmaForward);
        var forward = {
            x: plasmaForward.x,
            y: plasmaForward.y,
            z: plasmaForward.z
        };
        var lock = seekCore.selectSeekTarget({
            origin: { x: origin.x, y: origin.y, z: origin.z },
            forward: forward,
            candidates: filtered.map(toSeekCandidate).filter(Boolean),
            maxRange: maxRange,
            coneHalfAngleDeg: 180,
            boxWidthPx: boxWidthPx,
            boxHeightPx: boxHeightPx,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            projectToNdc: function (worldPos) {
                if (!worldPos || !worldPos.clone || !worldPos.project) return null;
                var projected = worldPos.clone().project(camera);
                return { x: projected.x, y: projected.y, z: projected.z };
            },
            hasWorldLos: function (worldPos) {
                return hasLineOfSight(camera, worldPos, maxRange);
            }
        });
        return lock && lock.candidate ? lock.candidate.rawTarget : null;
    }

    function resolvePlasmaMuzzle(camera) {
        var forward = plasmaForward;
        if (camera && camera.getWorldDirection) {
            camera.getWorldDirection(forward);
        }
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getMuzzleWorldPosition) {
            var p = globalThis.__MAYHEM_RUNTIME.GamePlayer.getMuzzleWorldPosition();
            if (p && typeof p.x === 'number') {
                plasmaMuzzle.copy(p).addScaledVector(forward, TRACER_ORIGIN_FORWARD_OFFSET);
                return plasmaMuzzle;
            }
        }

        plasmaMuzzle.copy(camera.position).addScaledVector(forward, 0.65 + TRACER_ORIGIN_FORWARD_OFFSET);
        return plasmaMuzzle;
    }

    function fireSinglePellet(camera, weapon, pelletIndex, onHit, onTrace) {
        var targetsHitboxes = getCombatHitboxes();
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        var allTargets = targetsHitboxes.concat(worldMeshes);
        var ndcOffset = getPelletNdcOffset(weapon, pelletIndex);
        var effectiveRange = getEffectiveMaxRange(weapon);

        screenPoint.set(ndcOffset.x, ndcOffset.y);
        raycaster.setFromCamera(screenPoint, camera);
        raycaster.far = effectiveRange;

        var intersects = raycaster.intersectObjects(allTargets, false);
        if (intersects.length === 0) {
            if (onTrace) {
                tracerMissEnd.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, effectiveRange);
                onTrace(tracerMissEnd);
            }
            return false;
        }

        var hit = intersects[0];
        if (onTrace) onTrace(hit.point);
        if (targetsHitboxes.indexOf(hit.object) === -1) {
            return false;
        }

        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation && globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition) {
            var playerRot = globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation();
            var playerPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
            playerForward.set(-Math.sin(playerRot.yaw || 0), 0, -Math.cos(playerRot.yaw || 0));
            hitFromPlayer.copy(hit.point).sub(playerPos).setY(0);
            if (hitFromPlayer.lengthSq() > 0.0001) {
                hitFromPlayer.normalize();
                if (playerForward.dot(hitFromPlayer) <= 0.1) {
                    return false;
                }
            }
        }

        var hitType = hit.object.userData.type || 'body';
        var damage = getDamageForType(weapon, hitType);
        damage = applyDistanceFalloff(weapon, damage, hit.distance);

        if (onHit) {
            onHit(hit.object, hit.point, hit.distance, hitType, damage, weapon);
        }

        return true;
    }

    function castCenter(camera, maxRange) {
        var hitboxes = getCombatHitboxes();
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        var allTargets = hitboxes.concat(worldMeshes);
        if (allTargets.length === 0) return null;

        screenPoint.set(0, 0);
        raycaster.setFromCamera(screenPoint, camera);
        raycaster.far = maxRange;

        var hits = raycaster.intersectObjects(allTargets, false);
        if (hits.length === 0) return null;

        for (var i = 0; i < hits.length; i++) {
            var h = hits[i];
            if (hitboxes.indexOf(h.object) !== -1) {
                return {
                    hitbox: h.object,
                    hitType: h.object.userData.type || 'body',
                    targetId: h.object.userData.targetId || '',
                    distance: h.distance,
                    point: h.point
                };
            }
            if (worldMeshes.indexOf(h.object) !== -1) {
                return null;
            }
        }

        return null;
    }

    /**
     * Attempt to fire the current weapon
     * @param {THREE.Camera} camera
     * @param {Function} onHit - callback(hitboxMesh, hitPoint, distance, hitType, damage, weapon)
     * @param {Function} onMiss - callback()
     * @returns {boolean} whether a shot was fired
     */
    GameHitscan.fire = function (camera, onHit, onMiss) {
        var now = performance.now();
        var weapon = getCurrentWeaponData();
        syncWeaponAmmoState(weapon.id, now);
        if (weapon.magazineSize > 0 && getAmmoInMag(weapon, now) <= 0) {
            beginReload(weapon, now);
            return false;
        }
        if (isReloadingWeapon(weapon, now)) {
            return false;
        }
        if (weapon.id === 'sniper' && !isAdsActiveForWeapon('sniper')) {
            return false;
        }

        if (now - lastFireTime < weapon.cooldown) {
            return false;
        }

        lastFireTime = now;
        var fired = fireHitscanPattern(camera, weapon, onHit, onMiss);
        if (fired) {
            consumeAmmoForShot(weapon, now);
        }
        return fired;
    };

    GameHitscan.getCurrentWeapon = function () {
        var weapon = getCurrentWeaponData();
        var now = performance.now();
        var ammoState = syncWeaponAmmoState(weapon.id, now);
        return {
            id: weapon.id,
            name: weapon.name,
            primitiveType: weapon.primitiveType || PRIMITIVE_HITSCAN_SINGLE,
            automatic: weapon.automatic,
            cooldown: weapon.cooldown,
            reloadMs: weapon.reloadMs,
            magazineSize: weapon.magazineSize,
            ammoInMag: weapon.magazineSize > 0 ? getAmmoInMag(weapon, now) : 0,
            reloading: weapon.magazineSize > 0 ? (Number(ammoState && ammoState.reloadUntil || 0) > now) : false,
            reloadRemaining: reloadRemainingForWeapon(weapon, now),
            bodyDamage: weapon.bodyDamage,
            headDamage: weapon.headDamage,
            pellets: weapon.pellets,
            hipfireSpread: weapon.hipfireSpread,
            adsSpread: weapon.adsSpread,
            adsSpreadMultiplier: weapon.adsSpreadMultiplier,
            maxRange: getEffectiveMaxRange(weapon),
            adsMaxRange: Number(weapon.adsMaxRange || weapon.maxRange || 0),
            adsHitscanRangeMultiplier: Number(weapon.adsHitscanRangeMultiplier || 1)
        };
    };

    GameHitscan.getReticleSpec = function (weaponId) {
        var id = weaponId || currentWeaponId;
        if (id !== 'shotgun') return null;

        return {
            type: 'shotgun',
            size: getShotgunReticleSizePx(),
            spreadRadiusPx: getWeaponSpreadRadiusPx(weapons[id]),
            bloomSize: 0,
            adsActive: isAdsActiveForWeapon(id)
        };
    };

    GameHitscan.getWeaponOrder = function () {
        return weaponOrder.slice();
    };

    GameHitscan.setWeapon = function (weaponId) {
        if (!weapons[weaponId]) return null;
        currentWeaponId = weaponId;
        return GameHitscan.getCurrentWeapon();
    };

    GameHitscan.cycleWeapon = function (delta) {
        var idx = weaponOrder.indexOf(currentWeaponId);
        if (idx === -1) idx = 0;

        if (delta > 0) {
            idx = (idx + 1) % weaponOrder.length;
        } else {
            idx = (idx - 1 + weaponOrder.length) % weaponOrder.length;
        }

        currentWeaponId = weaponOrder[idx];
        return GameHitscan.getCurrentWeapon();
    };

    GameHitscan.setWeaponOrder = function (nextOrder) {
        if (!Array.isArray(nextOrder) || nextOrder.length === 0) return weaponOrder.slice();
        var seen = {};
        var validated = [];
        for (var i = 0; i < nextOrder.length; i++) {
            var id = String(nextOrder[i] || '');
            if (!weapons[id] || seen[id]) continue;
            seen[id] = true;
            validated.push(id);
        }
        if (validated.length === 0) return weaponOrder.slice();
        weaponOrder = validated;
        if (weaponOrder.indexOf(currentWeaponId) === -1) {
            currentWeaponId = weaponOrder[0];
        }
        return weaponOrder.slice();
    };

    GameHitscan.equipSlot = function (slotIndex) {
        var idx = Math.max(0, Math.floor(slotIndex || 0));
        if (idx >= weaponOrder.length) return null;
        return GameHitscan.setWeapon(weaponOrder[idx]);
    };

    GameHitscan.getAllWeaponIds = function () {
        return weaponCatalogOrder.slice();
    };

    GameHitscan.getHeadDamage = function () {
        return getCurrentWeaponData().headDamage;
    };

    GameHitscan.getBodyDamage = function () {
        return getCurrentWeaponData().bodyDamage;
    };

    GameHitscan.getCooldown = function () {
        return getCurrentWeaponData().cooldown;
    };

    GameHitscan.canFire = function () {
        var weapon = getCurrentWeaponData();
        var now = performance.now();
        syncWeaponAmmoState(weapon.id, now);
        if (weapon.magazineSize > 0 && getAmmoInMag(weapon, now) <= 0) {
            beginReload(weapon, now);
            return false;
        }
        if (isReloadingWeapon(weapon, now)) {
            return false;
        }
        if (weapon.id === 'sniper' && !isAdsActiveForWeapon('sniper')) {
            return false;
        }
        return (now - lastFireTime) >= weapon.cooldown;
    };

    GameHitscan.cooldownRemaining = function () {
        var weapon = getCurrentWeaponData();
        var elapsed = performance.now() - lastFireTime;
        return Math.max(0, weapon.cooldown - elapsed);
    };

    GameHitscan.peekCenterTarget = function (camera, maxRange) {
        var weapon = getCurrentWeaponData();
        var range = (typeof maxRange === 'number' && maxRange > 0) ? maxRange : getEffectiveMaxRange(weapon);
        return castCenter(camera, range);
    };

    GameHitscan.tick = function (_dt) {
        syncWeaponAmmoState(currentWeaponId, performance.now());
        return null;
    };

    GameHitscan.syncAmmoStateFromNetwork = function (weaponAmmoStateMap) {
        if (!weaponAmmoStateMap || typeof weaponAmmoStateMap !== 'object') return false;
        var now = performance.now();
        for (var weaponId in weaponAmmoStateMap) {
            if (!Object.prototype.hasOwnProperty.call(weaponAmmoStateMap, weaponId)) continue;
            var entry = weaponAmmoStateMap[weaponId];
            var localState = ensureWeaponAmmoState(weaponId);
            var weapon = weapons[weaponId];
            if (!entry || !localState || !weapon) continue;
            localState.ammoInMag = Math.max(0, Number(entry.ammoInMag || 0));
            localState.reloadUntil = entry.reloading
                ? now + Math.max(0, Math.round(Number(entry.reloadRemaining || 0) * 1000))
                : 0;
            localState.reloadedFlashUntil = Math.max(0, Math.round(Number(entry.reloadedFlashRemaining || 0) * 1000)) + now;
        }
        return true;
    };

    GameHitscan.getHudState = function () {
        return hudStateForWeapon(getCurrentWeaponData(), performance.now());
    };

    GameHitscan.isAdsBlocked = function () {
        var weapon = getCurrentWeaponData();
        return isReloadingWeapon(weapon, performance.now());
    };

    GameHitscan.syncPlasmaStateFromNet = function (_state) {};

    GameHitscan.selectLockTargetByBox = function (camera, maxRange, boxSizePx, options) {
        if (!camera) return null;
        var range = (typeof maxRange === 'number' && maxRange > 0) ? maxRange : getCurrentWeaponData().maxRange;
        var size = (typeof boxSizePx === 'number' && boxSizePx > 1) ? boxSizePx : 60;
        var target = selectSeekTargetByBox(camera, range, size, options || null);
        if (!target) return null;
        return {
            targetId: target.targetId || '',
            ownerType: target.ownerType || 'unknown',
            worldPos: target.worldPos && target.worldPos.clone ? target.worldPos.clone() : null,
            hitbox: target.hitbox || null,
            enemyRef: target.enemyRef || null
        };
    };

    GameHitscan.selectLockTargetByRect = function (camera, maxRange, boxWidthPx, boxHeightPx, options) {
        if (!camera) return null;
        var range = (typeof maxRange === 'number' && maxRange > 0) ? maxRange : getCurrentWeaponData().maxRange;
        var width = (typeof boxWidthPx === 'number' && boxWidthPx > 1) ? boxWidthPx : 60;
        var height = (typeof boxHeightPx === 'number' && boxHeightPx > 1) ? boxHeightPx : 180;
        var target = selectSeekTargetByRect(camera, range, width, height, options || null);
        if (!target) return null;
        return {
            targetId: target.targetId || '',
            ownerType: target.ownerType || 'unknown',
            worldPos: target.worldPos && target.worldPos.clone ? target.worldPos.clone() : null,
            hitbox: target.hitbox || null,
            enemyRef: target.enemyRef || null
        };
    };

    GameHitscan.updateTracers = function (dt) {
        if (!dt || !tracerPoolReady || tracerPool.length === 0) return;
        var simDt = Math.min(dt, 1 / 30);
        var matrixDirty = false;
        for (var i = 0; i < tracerPool.length; i++) {
            var t = tracerPool[i];
            if (!t || t.life <= 0) continue;
            t.life -= simDt;
            t.framesAlive++;

            var step = t.speed * simDt;
            t.traveled += step;
            if (t.traveled > t.maxDistance) t.traveled = t.maxDistance;
            t.head.copy(t.origin).addScaledVector(t.dir, t.traveled);
            var tailTravel = Math.max(0, t.traveled - t.segmentLength);
            t.tail.copy(t.origin).addScaledVector(t.dir, tailTravel);
            tracerMeshMid.copy(t.tail).add(t.head).multiplyScalar(0.5);

            var dead = false;
            if (t.life <= 0) {
                t.life = 0;
                dead = true;
            } else if (t.traveled >= t.maxDistance && t.framesAlive > 1) {
                t.life = 0;
                dead = true;
            }

            if (dead) {
                tracerInstancedMesh.setMatrixAt(i, tracerZeroMatrix);
                matrixDirty = true;
                continue;
            }

            tracerTmpPos.copy(tracerMeshMid);
            tracerTmpQuat.setFromUnitVectors(tracerMeshUp, t.dir);
            tracerTmpScale.set(1, Math.max(0.05, t.segmentLength * 0.82), 1);
            tracerTmpMatrix.compose(tracerTmpPos, tracerTmpQuat, tracerTmpScale);
            tracerInstancedMesh.setMatrixAt(i, tracerTmpMatrix);
            matrixDirty = true;
        }
        if (matrixDirty) tracerInstancedMesh.instanceMatrix.needsUpdate = true;
    };

    GameHitscan.getWeaponCatalog = function () {
        var out = [];
        for (var i = 0; i < weaponCatalogOrder.length; i++) {
            var id = weaponCatalogOrder[i];
            var weapon = weapons[id];
            if (!weapon) continue;
            out.push({
                id: weapon.id,
                name: weapon.name,
                primitiveType: weapon.primitiveType || PRIMITIVE_HITSCAN_SINGLE,
                family: String(weapon.primitiveType || '').indexOf('hitscan') === 0 ? 'hitscan' : '',
                automatic: !!weapon.automatic,
                cooldown: weapon.cooldown,
                reloadMs: weapon.reloadMs,
                magazineSize: weapon.magazineSize,
                bodyDamage: weapon.bodyDamage,
                headDamage: weapon.headDamage,
                pellets: weapon.pellets,
                hipfireSpread: weapon.hipfireSpread,
                adsSpread: weapon.adsSpread,
                adsSpreadMultiplier: weapon.adsSpreadMultiplier,
                hipfireBloomScale: Number(weapon.hipfireBloomScale != null ? weapon.hipfireBloomScale : 1),
                adsBloomScale: Number(weapon.adsBloomScale != null ? weapon.adsBloomScale : 1),
                maxRange: weapon.maxRange,
                adsMaxRange: weapon.adsMaxRange
            });
        }
        return out;
    };

    GameHitscan.getSpreadRadiusPx = function (weaponId) {
        var weapon = (typeof weaponId === 'string') ? weapons[weaponId] : weaponId;
        return getWeaponSpreadRadiusPx(weapon);
    };

    GameHitscan.getSpreadMetrics = function (weaponId) {
        var weapon = (typeof weaponId === 'string') ? weapons[weaponId] : weaponId;
        return getWeaponSpreadMetrics(weapon);
    };

    globalThis.__MAYHEM_RUNTIME.GameHitscan = GameHitscan;
})();
