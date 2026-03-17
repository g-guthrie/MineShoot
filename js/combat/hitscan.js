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
    var SHARED_SPREAD_ASPECT = 16 / 9;
    var TRACER_ORIGIN_FORWARD_OFFSET = 0.12;

    var shared = globalThis.__MAYHEM_RUNTIME.GameShared || {};
    var sharedTuning = shared.gameplayTuning || {};
    var sharedWeaponStats = sharedTuning.weaponStats || {};
    var hitboxBoundsBox = new THREE.Box3();
    var LOCAL_CIRCLE_SCAN_PATTERN = buildLocalCircleScanPattern(4);
    function sharedHitscanAuthority() {
        var sharedRuntime = globalThis.__MAYHEM_RUNTIME.GameShared || {};
        return sharedRuntime.hitscanAuthority || null;
    }

    function buildLocalCircleScanPattern(radiusSteps) {
        var out = [];
        var steps = Math.max(1, Number(radiusSteps || 1));
        for (var gy = -steps; gy <= steps; gy++) {
            for (var gx = -steps; gx <= steps; gx++) {
                var nx = gx / steps;
                var ny = gy / steps;
                var r2 = (nx * nx) + (ny * ny);
                if (r2 > 1.000001) continue;
                out.push({ x: nx, y: ny, r2: r2 });
            }
        }
        out.sort(function (a, b) {
            if (Math.abs(a.r2 - b.r2) > 1e-9) return a.r2 - b.r2;
            if (Math.abs(a.y - b.y) > 1e-9) return a.y - b.y;
            return a.x - b.x;
        });
        return out;
    }

    function cloneAutoLockConfig(raw) {
        if (!raw || raw.enabled === false) return null;
        return {
            enabled: true,
            hipfireConeHalfAngleDeg: Number(raw.hipfireConeHalfAngleDeg || 0),
            adsConeHalfAngleDeg: Number(raw.adsConeHalfAngleDeg || 0),
            minTargetOverlap: Number((raw.minTargetOverlap != null ? raw.minTargetOverlap : raw.minBodyOverlap) || 0),
            headOverlapWeight: Number(raw.headOverlapWeight || 0),
            hipfireHeadshotChanceMax: Number(raw.hipfireHeadshotChanceMax || 0),
            adsHeadshotChanceMax: Number(raw.adsHeadshotChanceMax || 0),
            headshotAlignmentExponent: Number(raw.headshotAlignmentExponent || 0)
        };
    }

    function resolveSharedWeaponAimProfile(weaponStats, adsActive) {
        if (shared.resolveWeaponAimProfile) {
            return shared.resolveWeaponAimProfile(weaponStats, adsActive);
        }
        throw new Error('GameHitscan requires GameShared.resolveWeaponAimProfile before initialization.');
    }

    function buildWeaponFromShared(id) {
        var s = sharedWeaponStats[id] || {};
        var hipAim = resolveSharedWeaponAimProfile(s, false);
        var adsAim = resolveSharedWeaponAimProfile(s, true);
        var presentation = shared.getWeaponPresentation ? shared.getWeaponPresentation(id) : null;
        var tracer = presentation && presentation.tracer ? presentation.tracer : {};
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
            adsFovDeg: Number(s.adsFovDeg || 0),
            maxRange: hipAim.maxRange === Infinity ? Number.POSITIVE_INFINITY : Number(hipAim.maxRange || 0),
            adsMaxRange: adsAim.maxRange === Infinity ? Number.POSITIVE_INFINITY : Number(adsAim.maxRange || 0),
            adsHitscanRangeMultiplier: Number(hipAim.maxRange > 0 ? (Number(adsAim.maxRange || hipAim.maxRange) / hipAim.maxRange) : 1),
            tracerLife: Number(tracer.life || 0),
            tracerSpeed: Number(tracer.speed || 0),
            tracerSegmentLength: Number(tracer.segmentLength || 0),
            hipfireBloomScale: Number(s.hipfireBloomScale != null ? s.hipfireBloomScale : 1),
            adsBloomScale: Number(s.adsBloomScale != null ? s.adsBloomScale : 1),
            autoLock: cloneAutoLockConfig(s.autoLock),
            singleHitFromPellets: !!s.singleHitFromPellets
        };
    }

    function resolveReloadPresentationState(weaponId, reloadMs, reloadRemaining, reloadedFlashRemaining) {
        if (shared.resolveReloadPresentationState) {
            return shared.resolveReloadPresentationState({
                reloadMs: reloadMs,
                reloadRemaining: reloadRemaining,
                reloadedFlashRemaining: reloadedFlashRemaining,
                reload: shared.getWeaponPresentation ? (shared.getWeaponPresentation(weaponId) || {}).reload : null
            }, null);
        }
        var reloading = Number(reloadMs || 0) > 0 && Number(reloadRemaining || 0) > 0;
        var reloadConfig = shared.getWeaponPresentation ? ((shared.getWeaponPresentation(weaponId) || {}).reload || null) : null;
        var raiseEnd = Math.max(0.05, Math.min(0.7, Number(reloadConfig && reloadConfig.raiseEnd || 0.16)));
        var manipulateEnd = Math.max(raiseEnd + 0.05, Math.min(0.95, Number(reloadConfig && reloadConfig.manipulateEnd || 0.68)));
        var reloadPct = reloading ? Math.max(0, Math.min(1, 1 - (Number(reloadRemaining || 0) / Math.max(1, Number(reloadMs || 1))))) : 1;
        var phase = 'ready';
        var phasePct = 1;
        if (reloading) {
            if (reloadPct < raiseEnd) {
                phase = 'raise';
                phasePct = reloadPct / Math.max(0.0001, raiseEnd);
            } else if (reloadPct < manipulateEnd) {
                phase = 'manipulate';
                phasePct = (reloadPct - raiseEnd) / Math.max(0.0001, manipulateEnd - raiseEnd);
            } else {
                phase = 'settle';
                phasePct = (reloadPct - manipulateEnd) / Math.max(0.0001, 1 - manipulateEnd);
            }
        } else if (Number(reloadedFlashRemaining || 0) > 0) {
            phase = 'complete';
        }
        return {
            reloading: reloading,
            reloadPct: reloadPct,
            phase: phase,
            phasePct: Math.max(0, Math.min(1, phasePct))
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

    function combatRuntime() {
        return globalThis.__MAYHEM_RUNTIME.GamePlayerCombat || null;
    }

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

    function activeWeaponId() {
        var combat = combatRuntime();
        if (combat && combat.getEquippedWeaponId) {
            var equipped = String(combat.getEquippedWeaponId() || '');
            if (weapons[equipped]) return equipped;
        }
        return currentWeaponId;
    }

    function activeWeaponOrder() {
        var combat = combatRuntime();
        if (combat && combat.getWeaponLoadout) {
            var loadout = combat.getWeaponLoadout();
            if (loadout && Array.isArray(loadout.slots) && loadout.slots.length) {
                return loadout.slots.slice();
            }
        }
        return weaponOrder.slice();
    }

    function currentWeaponPresentationState(now) {
        var combat = combatRuntime();
        if (combat && combat.getCurrentWeaponState) {
            return combat.getCurrentWeaponState(now);
        }
        return null;
    }

    function weaponPresentationState(weaponId, now) {
        var combat = combatRuntime();
        if (combat && combat.getWeaponState) {
            return combat.getWeaponState(weaponId, now);
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

    function fireHitscanPattern(camera, weapon, onHit, onMiss, shotToken) {
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
                    spawnTracer(camera, weapon, traceEnd);
                } : null,
                shotToken
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


    function tracerLifeForWeapon(weapon) {
        return Math.max(0.01, Number(weapon && weapon.tracerLife || 0.11));
    }

    function tracerSpeedForWeapon(weapon) {
        return Math.max(1, Number(weapon && weapon.tracerSpeed || 280));
    }

    function tracerSegmentLengthForWeapon(weapon) {
        return Math.max(0.05, Number(weapon && weapon.tracerSegmentLength || 2.1));
    }

    function spawnTracer(camera, weapon, endPoint, originOverride) {
        if (!camera || !endPoint) return;
        var idx = allocTracer(camera);
        if (idx === null) return;
        var tracer = tracerPool[idx];

        if (originOverride && typeof originOverride.x === 'number') {
            tracerStart.copy(originOverride);
        } else {
            resolvePlasmaMuzzle(camera);
            tracerStart.copy(plasmaMuzzle);
        }
        tracer.origin.copy(tracerStart);
        tracer.dir.copy(endPoint).sub(tracerStart);
        var len = tracer.dir.length();
        if (len <= 0.001) return;
        tracer.dir.divideScalar(len);
        tracer.head.copy(tracer.origin);
        tracer.tail.copy(tracer.origin);
        tracer.traveled = 0;
        tracer.maxDistance = len;
        tracer.segmentLength = tracerSegmentLengthForWeapon(weapon);
        tracer.speed = tracerSpeedForWeapon(weapon);
        tracer.framesAlive = 0;

        tracer.maxLife = tracerLifeForWeapon(weapon);
        tracer.life = tracer.maxLife;
    }

    function isNetCombatReady() {
        var net = globalThis.__MAYHEM_RUNTIME.GameNet || null;
        if (!net || !net.isActive || !net.isActive()) return false;
        if (net.isConnected) return !!net.isConnected();
        return true;
    }

    function getCombatHitboxes() {
        var out = [];
        var net = globalThis.__MAYHEM_RUNTIME.GameNet || null;
        var netRemote = net && net.remoteEntities ? net.remoteEntities : net;
        if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.getHitboxArray) {
            var local = globalThis.__MAYHEM_RUNTIME.GameEnemy.getHitboxArray() || [];
            out = out.concat(local);
        }
        if (isNetCombatReady() && netRemote && netRemote.getHitboxArray) {
            var netHitboxes = netRemote.getHitboxArray() || [];
            out = out.concat(netHitboxes);
        }
        return out;
    }

    function getCurrentWeaponData() {
        return weapons[activeWeaponId()] || weapons.rifle;
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

    function applyReloadState(weapon, state, now) {
        if (!weapon || !state || weapon.magazineSize <= 0 || weapon.reloadMs <= 0) return false;
        if (Number(state.ammoInMag || 0) >= Math.max(0, Number(weapon.magazineSize || 0))) return false;
        state.ammoInMag = 0;
        state.reloadUntil = now + weapon.reloadMs;
        state.reloadedFlashUntil = 0;
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.setAdsEnabled) {
            globalThis.__MAYHEM_RUNTIME.GamePlayer.setAdsEnabled(false);
        }
        return true;
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
        if (state.reloadUntil <= 0 && Number(state.ammoInMag || 0) <= 0 && weapon.reloadMs > 0) {
            applyReloadState(weapon, state, now);
        }
        return state;
    }

    function getAmmoInMag(weapon, now) {
        if (!weapon || weapon.magazineSize <= 0) return 0;
        var combatState = weaponPresentationState(weapon.id, now);
        if (combatState) return Math.max(0, Number(combatState.ammoInMag || 0));
        var state = syncWeaponAmmoState(weapon.id, now);
        return Math.max(0, Number(state && state.ammoInMag || 0));
    }

    function reloadRemainingForWeapon(weapon, now) {
        if (!weapon || weapon.magazineSize <= 0) return 0;
        var combatState = weaponPresentationState(weapon.id, now);
        if (combatState) return Math.max(0, Number(combatState.reloadRemaining || 0));
        var state = syncWeaponAmmoState(weapon.id, now);
        return Math.max(0, Number(state && state.reloadUntil || 0) - now);
    }

    function isReloadingWeapon(weapon, now) {
        return reloadRemainingForWeapon(weapon, now) > 0;
    }

    function notifyReloadStarted(weapon) {
        if (!weapon || Number(weapon.reloadMs || 0) <= 0) return;
        var playerApi = globalThis.__MAYHEM_RUNTIME.GamePlayer || null;
        if (!playerApi || !playerApi.triggerAction) return;
        playerApi.triggerAction('reload', {
            duration: Math.max(0.12, Number(weapon.reloadMs || 0) / 1000),
            weaponId: weapon.id || ''
        });
    }

    function beginReload(weapon, now) {
        if (!weapon || weapon.magazineSize <= 0 || weapon.reloadMs <= 0) return false;
        var combat = combatRuntime();
        if (combat && combat.beginWeaponReload) {
            var started = !!combat.beginWeaponReload(weapon.id, now);
            if (started) {
                if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.setAdsEnabled) {
                    globalThis.__MAYHEM_RUNTIME.GamePlayer.setAdsEnabled(false);
                }
                notifyReloadStarted(weapon);
            }
            return started;
        }
        var state = syncWeaponAmmoState(weapon.id, now);
        if (!state || state.reloadUntil > now) return false;
        var applied = applyReloadState(weapon, state, now);
        if (applied) notifyReloadStarted(weapon);
        return applied;
    }

    function consumeAmmoForShot(weapon, now) {
        if (!weapon || weapon.magazineSize <= 0) return;
        var wasReloading = isReloadingWeapon(weapon, now);
        var combat = combatRuntime();
        if (combat && combat.recordWeaponFire) {
            var postFireState = combat.recordWeaponFire(weapon.id, now);
            if (!wasReloading && postFireState && postFireState.reloading) {
                notifyReloadStarted(weapon);
            }
            return;
        }
        var state = syncWeaponAmmoState(weapon.id, now);
        if (!state) return;
        state.ammoInMag = Math.max(0, Number(state.ammoInMag || weapon.magazineSize) - 1);
        state.reloadedFlashUntil = 0;
        if (state.ammoInMag <= 0) {
            beginReload(weapon, now);
        }
        if (!wasReloading && Number(state.reloadUntil || 0) > now) {
            notifyReloadStarted(weapon);
        }
    }

    function hudStateForWeapon(weapon, now) {
        var combat = combatRuntime();
        if (combat && combat.getWeaponHudState && activeWeaponId() === String(weapon && weapon.id || '')) {
            return combat.getWeaponHudState(now);
        }
        var state = syncWeaponAmmoState(weapon.id, now);
        var reloadRemaining = reloadRemainingForWeapon(weapon, now);
        var reloadedFlashRemaining = Math.max(0, Number(state && state.reloadedFlashUntil || 0) - now);
        var reloadPresentation = resolveReloadPresentationState(
            weapon.id,
            weapon.reloadMs,
            reloadRemaining,
            reloadedFlashRemaining
        );
        if (reloadPresentation.reloading) {
            return {
                status: 'reloading',
                ready: false,
                pct: reloadPresentation.reloadPct,
                phase: reloadPresentation.phase
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
        if (reloadedFlashRemaining > 0) {
            return {
                status: 'reloaded',
                ready: true,
                pct: 1,
                phase: reloadPresentation.phase
            };
        }
        return {
            status: 'ready',
            ready: true,
            pct: 1,
            phase: 'ready'
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

    function getActiveAimSpread(weapon) {
        if (!weapon) return 0;
        var adsActive = isAdsActiveForWeapon(weapon.id);
        return Math.max(0, Number(adsActive ? weapon.adsSpread : weapon.hipfireSpread || 0));
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

        // HUD/debug circles should match the actual shot solver area, not a display-only multiplier.
        var spread = getActiveAimSpread(weapon);
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

    function shouldUseSyncedMultiplayerSpread(shotToken) {
        return !!(shotToken && isNetCombatReady());
    }

    function syncedSpreadOffsetToNdc(offset) {
        if (!offset) return null;
        var aspect = currentViewAspect();
        return {
            x: Number(offset.x || 0) * (SHARED_SPREAD_ASPECT / Math.max(aspect, 0.0001)),
            y: Number(offset.y || 0)
        };
    }

    function getWeaponSpreadNdcOffset(weapon, pelletIndex, shotToken) {
        if (shouldUseSyncedMultiplayerSpread(shotToken)) {
            var authority = sharedHitscanAuthority();
            if (authority && authority.sampleSpreadOffset) {
                var syncedOffset = authority.sampleSpreadOffset(
                    weapon,
                    isAdsActiveForWeapon(weapon && weapon.id),
                    Number(pelletIndex || 0),
                    String(shotToken || '')
                );
                var ndcOffset = syncedSpreadOffsetToNdc(syncedOffset);
                if (ndcOffset && isFinite(ndcOffset.x) && isFinite(ndcOffset.y)) {
                    return ndcOffset;
                }
            }
        }

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

    function getCircleReticleSizePx(weapon) {
        if (!weapon) return 0;
        if (getAutoLockConfig(weapon)) return getAutoLockReticleSizePx(weapon);
        return getWeaponSpreadRadiusPx(weapon) * 2;
    }

    function getAutoLockConfig(weapon) {
        return weapon && weapon.autoLock && weapon.autoLock.enabled !== false ? weapon.autoLock : null;
    }

    function getViewFovDeg() {
        var player = globalThis.__MAYHEM_RUNTIME.GamePlayer;
        var camera = player && player.getCamera ? player.getCamera() : null;
        var fov = Number(camera && camera.fov);
        return isFinite(fov) && fov > 0.0001 ? fov : 75;
    }

    function getAutoLockConeHalfAngleDeg(weapon) {
        var cfg = getAutoLockConfig(weapon);
        if (!cfg) return 0;
        return isAdsActiveForWeapon(weapon.id)
            ? Math.max(0, Number(cfg.adsConeHalfAngleDeg || cfg.hipfireConeHalfAngleDeg || 0))
            : Math.max(0, Number(cfg.hipfireConeHalfAngleDeg || cfg.adsConeHalfAngleDeg || 0));
    }

    function getAutoLockReticleSizePx(weapon) {
        var halfAngleDeg = getAutoLockConeHalfAngleDeg(weapon);
        if (!(halfAngleDeg > 0)) return 0;
        var viewFovDeg = getViewFovDeg();
        var radiusRatio = Math.tan((halfAngleDeg * Math.PI) / 180) / Math.max(0.0001, Math.tan((viewFovDeg * Math.PI) / 360));
        return Math.max(0, radiusRatio) * window.innerHeight;
    }

    function getBloomCircleSizePx(weapon) {
        if (!weapon || weapon.id === 'shotgun' || weapon.singleHitFromPellets || getAutoLockConfig(weapon)) return 0;
        return getWeaponSpreadRadiusPx(weapon) * 2;
    }

    function usesSharedShotResolution(weapon) {
        return !!(weapon && getAutoLockConfig(weapon));
    }

    function getPelletNdcOffset(weapon, pelletIndex, shotToken) {
        return getWeaponSpreadNdcOffset(weapon, pelletIndex, shotToken);
    }

    function getCircleSampleNdcOffset(weapon, sample) {
        var metrics = getWeaponSpreadMetrics(weapon);
        var radiusXpx = Number(metrics && metrics.radiusXpx || 0);
        var radiusYpx = Number(metrics && metrics.radiusYpx || 0);
        return {
            x: (Number(sample && sample.x || 0) * radiusXpx) / (window.innerWidth * 0.5),
            y: (Number(sample && sample.y || 0) * radiusYpx) / (window.innerHeight * 0.5)
        };
    }

    function getLockTargets() {
        var out = [];
        var net = globalThis.__MAYHEM_RUNTIME.GameNet || null;
        var netView = net && net.view ? net.view : net;

        if (globalThis.__MAYHEM_RUNTIME.GameEnemy && globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets) {
            out = out.concat(globalThis.__MAYHEM_RUNTIME.GameEnemy.getLockTargets() || []);
        }
        if (isNetCombatReady() && netView && netView.getLockTargets) {
            out = out.concat(netView.getLockTargets() || []);
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

    function worldCollisionBoxes() {
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        var out = [];
        for (var i = 0; i < worldMeshes.length; i++) {
            var mesh = worldMeshes[i];
            if (!mesh) continue;
            var box = mesh.userData && mesh.userData.collisionBox ? mesh.userData.collisionBox : null;
            if (!box) {
                mesh.updateMatrixWorld(true);
                box = hitboxBoundsBox.setFromObject(mesh);
            }
            if (!box || !box.min || !box.max) continue;
            out.push({
                min: { x: Number(box.min.x || 0), y: Number(box.min.y || 0), z: Number(box.min.z || 0) },
                max: { x: Number(box.max.x || 0), y: Number(box.max.y || 0), z: Number(box.max.z || 0) }
            });
        }
        return out;
    }

    function plainBoxFromHitbox(hitbox) {
        if (!hitbox) return null;
        hitbox.updateMatrixWorld(true);
        var box = hitboxBoundsBox.setFromObject(hitbox);
        if (!box || !box.min || !box.max) return null;
        return {
            min: { x: Number(box.min.x || 0), y: Number(box.min.y || 0), z: Number(box.min.z || 0) },
            max: { x: Number(box.max.x || 0), y: Number(box.max.y || 0), z: Number(box.max.z || 0) }
        };
    }

    function authorityTargetFromLockTarget(target) {
        if (!target || !target.worldPos) return null;
        var bodyHitbox = target.bodyHitbox || target.hitbox || null;
        var headHitbox = target.headHitbox || (target.enemyRef && target.enemyRef.headHitbox) || null;
        return {
            targetId: target.targetId || '',
            ownerType: target.ownerType || 'unknown',
            x: Number(target.worldPos.x || 0),
            y: Number(target.worldPos.y || 0),
            z: Number(target.worldPos.z || 0),
            worldPos: target.worldPos && target.worldPos.clone ? target.worldPos.clone() : target.worldPos,
            bodyHitbox: bodyHitbox,
            headHitbox: headHitbox,
            hitbox: bodyHitbox || headHitbox || null,
            enemyRef: target.enemyRef || null,
            bodyBox: plainBoxFromHitbox(bodyHitbox),
            headBox: plainBoxFromHitbox(headHitbox)
        };
    }

    function localAimOrigin(camera) {
        var playerApi = globalThis.__MAYHEM_RUNTIME.GamePlayer || null;
        var eyeWorld = playerApi && playerApi.getEyeWorldPosition
            ? playerApi.getEyeWorldPosition()
            : null;
        var sharedPoints = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.entityPoints) || {};
        var eyeOrigin = null;
        if (eyeWorld && isFinite(Number(eyeWorld.x)) && isFinite(Number(eyeWorld.y)) && isFinite(Number(eyeWorld.z))) {
            eyeOrigin = {
                x: Number(eyeWorld.x || 0),
                y: Number(eyeWorld.y || 0),
                z: Number(eyeWorld.z || 0)
            };
        } else if (camera && camera.position) {
            eyeOrigin = {
                x: Number(camera.position.x || 0),
                y: Number(camera.position.y || 0),
                z: Number(camera.position.z || 0)
            };
        }
        if (!eyeOrigin) return null;
        if (!camera || !camera.getWorldDirection) return eyeOrigin;
        var cameraForward = new THREE.Vector3();
        camera.getWorldDirection(cameraForward);
        if (sharedPoints.logicalHitscanOriginFromEye) {
            return sharedPoints.logicalHitscanOriginFromEye(eyeOrigin, cameraForward);
        }
        return {
            x: eyeOrigin.x + (cameraForward.x * 0.35),
            y: eyeOrigin.y + (cameraForward.y * 0.35),
            z: eyeOrigin.z + (cameraForward.z * 0.35)
        };
    }

    function resolveCrosshairAimPoint(camera, maxDistance) {
        if (!camera || !camera.getWorldDirection) return null;
        var targetsHitboxes = getCombatHitboxes();
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        var allTargets = targetsHitboxes.concat(worldMeshes);
        var distance = Math.max(1, Number(maxDistance || 0) || 256);
        screenPoint.set(0, 0);
        raycaster.setFromCamera(screenPoint, camera);
        raycaster.far = distance;
        var intersects = raycaster.intersectObjects(allTargets, false);
        if (intersects.length > 0) {
            return intersects[0].point.clone ? intersects[0].point.clone() : intersects[0].point;
        }
        return raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, distance);
    }

    function localAimForward(camera, aimOrigin, maxDistance) {
        if (!camera || !aimOrigin || !camera.getWorldDirection) return null;
        var cameraForward = plasmaForward.clone ? plasmaForward.clone() : new THREE.Vector3();
        camera.getWorldDirection(cameraForward);
        var targetPoint = resolveCrosshairAimPoint(camera, maxDistance);
        if (!targetPoint) {
            targetPoint = new THREE.Vector3(
                Number(camera.position.x || 0),
                Number(camera.position.y || 0),
                Number(camera.position.z || 0)
            ).addScaledVector(cameraForward, Math.max(1, Number(maxDistance || 0) || 256));
        }
        var aimDir = targetPoint.sub(new THREE.Vector3(
            Number(aimOrigin.x || 0),
            Number(aimOrigin.y || 0),
            Number(aimOrigin.z || 0)
        ));
        if (aimDir.lengthSq() <= 0.000001) {
            return {
                x: cameraForward.x,
                y: cameraForward.y,
                z: cameraForward.z
            };
        }
        aimDir.normalize();
        return {
            x: aimDir.x,
            y: aimDir.y,
            z: aimDir.z
        };
    }

    function buildLocalShotContext(camera, weapon, shotToken) {
        if (!camera || !weapon) return null;
        var lockTargets = getLockTargets() || [];
        var targets = [];
        for (var i = 0; i < lockTargets.length; i++) {
            var target = lockTargets[i];
            if (!target || target.alive === false || !target.worldPos) continue;
            var plain = authorityTargetFromLockTarget(target);
            if (plain) targets.push(plain);
        }
        resolvePlasmaMuzzle(camera);
        camera.getWorldDirection(plasmaForward);
        var aimOrigin = localAimOrigin(camera);
        if (!aimOrigin) return null;
        var aimForward = localAimForward(camera, aimOrigin, getEffectiveMaxRange(weapon));
        if (!aimForward) {
            aimForward = {
                x: plasmaForward.x,
                y: plasmaForward.y,
                z: plasmaForward.z
            };
        }
        return {
            aimOrigin: aimOrigin,
            aimForward: aimForward,
            tracerOrigin: {
                x: plasmaMuzzle.x,
                y: plasmaMuzzle.y,
                z: plasmaMuzzle.z
            },
            weaponStats: weapon,
            falloffBands: weaponFalloffTuning[weapon.id] || [],
            adsActive: isAdsActiveForWeapon(weapon.id),
            viewFovDeg: getViewFovDeg(),
            shotToken: String(shotToken || ''),
            targets: targets,
            worldBoxes: worldCollisionBoxes()
        };
    }

    function resolveAutoLockPreview(camera, weapon) {
        var authority = sharedHitscanAuthority();
        if (!camera || !weapon || !authority || !authority.resolveAutoLockPreview) return null;
        var options = buildLocalShotContext(camera, weapon, 'preview');
        if (!options) return null;
        return authority.resolveAutoLockPreview(options);
    }

    function resolveAutoLockShotFromContext(shotContext) {
        var authority = sharedHitscanAuthority();
        if (!shotContext || !authority || !authority.resolveHitscanShot) return [];
        return authority.resolveHitscanShot(shotContext);
    }

    function resolveAutoLockShot(camera, weapon, shotToken) {
        if (!camera || !weapon) return [];
        return resolveAutoLockShotFromContext(buildLocalShotContext(camera, weapon, shotToken));
    }

    function shouldPredictNetHit(camera, hitboxMesh, shotToken, pelletIndex) {
        if (!camera || !hitboxMesh || !hitboxMesh.userData || hitboxMesh.userData.ownerType !== 'net') return true;
        if (!isNetCombatReady()) return false;
        var authority = sharedHitscanAuthority();
        if (!authority || !authority.resolveHitscanShot) return true;
        var weapon = getCurrentWeaponData();
        if (!weapon) return true;
        var shotContext = buildLocalShotContext(camera, weapon, shotToken);
        if (!shotContext) return false;
        var predicted = authority.resolveHitscanShot(shotContext);
        if (!Array.isArray(predicted) || predicted.length === 0) return false;
        var expectedTargetId = String(hitboxMesh.userData.targetId || '');
        var expectedNetEntityId = String(hitboxMesh.userData.netEntityId || '');
        var expectedPelletIndex = Number.isFinite(Number(pelletIndex)) ? Math.max(0, Math.floor(Number(pelletIndex))) : null;
        for (var i = 0; i < predicted.length; i++) {
            var shot = predicted[i];
            var target = shot && shot.target ? shot.target : null;
            var targetId = String(target && target.targetId || '');
            if (expectedPelletIndex != null) {
                var predictedPelletIndex = Number.isFinite(Number(shot && shot.pelletIndex)) ? Math.max(0, Math.floor(Number(shot.pelletIndex))) : null;
                if (predictedPelletIndex !== expectedPelletIndex) continue;
            }
            if (expectedTargetId && targetId === expectedTargetId) return true;
            if (expectedNetEntityId && targetId === ('net:' + expectedNetEntityId)) return true;
        }
        return false;
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
            preferScreenCenter: true,
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

    function traceSinglePellet(camera, weapon, pelletIndex, shotToken) {
        var targetsHitboxes = getCombatHitboxes();
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        var allTargets = targetsHitboxes.concat(worldMeshes);
        var ndcOffset = getPelletNdcOffset(weapon, pelletIndex, shotToken);
        var pelletScore = (ndcOffset.x * ndcOffset.x) + (ndcOffset.y * ndcOffset.y);
        var effectiveRange = getEffectiveMaxRange(weapon);

        screenPoint.set(ndcOffset.x, ndcOffset.y);
        raycaster.setFromCamera(screenPoint, camera);
        raycaster.far = effectiveRange;

        var intersects = raycaster.intersectObjects(allTargets, false);
        if (intersects.length === 0) {
            tracerMissEnd.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, effectiveRange);
            return {
                hit: false,
                traceEnd: tracerMissEnd.clone(),
                pelletScore: pelletScore
            };
        }

        var hit = intersects[0];
        if (targetsHitboxes.indexOf(hit.object) === -1) {
            return {
                hit: false,
                traceEnd: hit.point.clone ? hit.point.clone() : hit.point,
                pelletScore: pelletScore
            };
        }

        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation && globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition) {
            var playerRot = globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation();
            var playerPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
            playerForward.set(-Math.sin(playerRot.yaw || 0), 0, -Math.cos(playerRot.yaw || 0));
            hitFromPlayer.copy(hit.point).sub(playerPos).setY(0);
            if (hitFromPlayer.lengthSq() > 0.0001) {
                hitFromPlayer.normalize();
                if (playerForward.dot(hitFromPlayer) <= 0.1) {
                    return {
                        hit: false,
                        traceEnd: hit.point.clone ? hit.point.clone() : hit.point,
                        pelletScore: pelletScore
                    };
                }
            }
        }

        var hitType = hit.object.userData.type || 'body';
        var damage = getDamageForType(weapon, hitType);
        damage = applyDistanceFalloff(weapon, damage, hit.distance);

        return {
            hit: true,
            hitbox: hit.object,
            hitPoint: hit.point.clone ? hit.point.clone() : hit.point,
            distance: hit.distance,
            hitType: hitType,
            damage: damage,
            pelletIndex: Number(pelletIndex || 0),
            pelletScore: pelletScore,
            traceEnd: hit.point.clone ? hit.point.clone() : hit.point
        };
    }

    function fireSinglePellet(camera, weapon, pelletIndex, onHit, onTrace, shotToken) {
        var traced = traceSinglePellet(camera, weapon, pelletIndex, shotToken);
        if (!traced) return false;
        if (onTrace && traced.traceEnd) onTrace(traced.traceEnd);
        if (!traced.hit) return false;

        if (onHit) {
            onHit(traced.hitbox, traced.hitPoint, traced.distance, traced.hitType, traced.damage, weapon, traced.pelletIndex);
        }

        return true;
    }

    function fireSingleWinnerPelletPattern(camera, weapon, onHit, onMiss, shotToken) {
        var pellets = Math.max(1, Number(weapon && weapon.pellets || 1));
        var bestHit = null;
        var bestMiss = null;
        for (var i = 0; i < pellets; i++) {
            var traced = traceSinglePellet(camera, weapon, i, shotToken);
            if (!traced) continue;
            if (traced.hit) {
                if (!bestHit || traced.pelletScore < bestHit.pelletScore || (traced.pelletScore === bestHit.pelletScore && traced.distance < bestHit.distance)) {
                    bestHit = traced;
                }
            } else if (!bestMiss || traced.pelletScore < bestMiss.pelletScore) {
                bestMiss = traced;
            }
        }

        if (bestHit) {
            if (bestHit.traceEnd) spawnTracer(camera, weapon, bestHit.traceEnd);
            if (onHit) onHit(bestHit.hitbox, bestHit.hitPoint, bestHit.distance, bestHit.hitType, bestHit.damage, weapon, bestHit.pelletIndex);
            return true;
        }

        if (bestMiss && bestMiss.traceEnd) spawnTracer(camera, weapon, bestMiss.traceEnd);
        if (onMiss) onMiss();
        return true;
    }

    function traceCircleSample(camera, weapon, sample) {
        var targetsHitboxes = getCombatHitboxes();
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        var allTargets = targetsHitboxes.concat(worldMeshes);
        var ndcOffset = getCircleSampleNdcOffset(weapon, sample);
        var effectiveRange = getEffectiveMaxRange(weapon);

        screenPoint.set(ndcOffset.x, ndcOffset.y);
        raycaster.setFromCamera(screenPoint, camera);
        raycaster.far = effectiveRange;

        var intersects = raycaster.intersectObjects(allTargets, false);
        if (intersects.length === 0) {
            tracerMissEnd.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, effectiveRange);
            return {
                hit: false,
                traceEnd: tracerMissEnd.clone(),
                sampleRadiusSq: Number(sample && sample.r2 || 0)
            };
        }

        var hit = intersects[0];
        if (targetsHitboxes.indexOf(hit.object) === -1) {
            return {
                hit: false,
                traceEnd: hit.point.clone ? hit.point.clone() : hit.point,
                sampleRadiusSq: Number(sample && sample.r2 || 0)
            };
        }

        var hitType = hit.object.userData.type || 'body';
        var damage = getDamageForType(weapon, hitType);
        damage = applyDistanceFalloff(weapon, damage, hit.distance);
        return {
            hit: true,
            hitbox: hit.object,
            hitPoint: hit.point.clone ? hit.point.clone() : hit.point,
            distance: hit.distance,
            hitType: hitType,
            damage: damage,
            traceEnd: hit.point.clone ? hit.point.clone() : hit.point,
            sampleRadiusSq: Number(sample && sample.r2 || 0)
        };
    }

    function findBestCircleScanHit(camera, weapon) {
        var bestMiss = null;
        for (var i = 0; i < LOCAL_CIRCLE_SCAN_PATTERN.length; i++) {
            var traced = traceCircleSample(camera, weapon, LOCAL_CIRCLE_SCAN_PATTERN[i]);
            if (!traced) continue;
            if (traced.hit) return traced;
            if (!bestMiss || traced.sampleRadiusSq < bestMiss.sampleRadiusSq) bestMiss = traced;
        }
        return bestMiss;
    }

    function fireCircleScanPattern(camera, weapon, onHit, onMiss) {
        var traced = findBestCircleScanHit(camera, weapon);
        if (!traced) {
            if (onMiss) onMiss();
            return true;
        }
        if (traced.traceEnd) spawnTracer(camera, weapon, traced.traceEnd);
        if (!traced.hit) {
            if (onMiss) onMiss();
            return true;
        }
        if (onHit) onHit(traced.hitbox, traced.hitPoint, traced.distance, traced.hitType, traced.damage, weapon, null);
        return true;
    }

    function autoLockMissPoint(camera, weapon) {
        if (!camera || !weapon) return null;
        var effectiveRange = getEffectiveMaxRange(weapon);
        resolvePlasmaMuzzle(camera);
        camera.getWorldDirection(plasmaForward);
        losRaycaster.set(plasmaMuzzle, plasmaForward);
        losRaycaster.far = effectiveRange;
        var worldMeshes = globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables ? globalThis.__MAYHEM_RUNTIME.GameWorld.getCollidables() : [];
        var hits = losRaycaster.intersectObjects(worldMeshes, false);
        if (hits.length > 0 && hits[0] && hits[0].point) return hits[0].point;
        return plasmaMuzzle.clone().addScaledVector(plasmaForward, effectiveRange);
    }

    function fireAutoLockShot(camera, weapon, onHit, onMiss, shotToken) {
        var shotContext = buildLocalShotContext(camera, weapon, shotToken);
        var shots = resolveAutoLockShotFromContext(shotContext);
        if (!shots || shots.length === 0) {
            var missPoint = autoLockMissPoint(camera, weapon);
            if (missPoint) {
                spawnTracer(
                    camera,
                    weapon,
                    missPoint,
                    shotContext && shotContext.tracerOrigin
                        ? new THREE.Vector3(shotContext.tracerOrigin.x, shotContext.tracerOrigin.y, shotContext.tracerOrigin.z)
                        : null
                );
            }
            if (onMiss) onMiss();
            return true;
        }

        var shot = shots[0];
        var target = shot && shot.target ? shot.target : null;
        var hitbox = target
            ? (shot.hitType === 'head'
                ? (target.headHitbox || target.hitbox || target.bodyHitbox || null)
                : (target.bodyHitbox || target.hitbox || target.headHitbox || null))
            : null;

        if (shot.point) {
            spawnTracer(
                camera,
                weapon,
                new THREE.Vector3(shot.point.x, shot.point.y, shot.point.z),
                shotContext && shotContext.tracerOrigin
                    ? new THREE.Vector3(shotContext.tracerOrigin.x, shotContext.tracerOrigin.y, shotContext.tracerOrigin.z)
                    : null
            );
        }
        if (onHit && hitbox && shot.point) {
            onHit(
                hitbox,
                new THREE.Vector3(shot.point.x, shot.point.y, shot.point.z),
                Number(shot.distance || 0),
                shot.hitType || 'body',
                Number(shot.damage || 0),
                weapon
            );
        } else if (!hitbox && onMiss) {
            onMiss();
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
    GameHitscan.fire = function (camera, onHit, onMiss, shotToken) {
        var now = performance.now();
        var weapon = getCurrentWeaponData();
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

        var combat = combatRuntime();
        if (combat && combat.getCooldownRemaining) {
            if (combat.getCooldownRemaining(now) > 0) return false;
        } else if (now - lastFireTime < weapon.cooldown) {
            return false;
        }

        lastFireTime = now;
        var fired = getAutoLockConfig(weapon)
            ? fireAutoLockShot(camera, weapon, onHit, onMiss, shotToken)
            : (weapon.singleHitFromPellets
                ? fireCircleScanPattern(camera, weapon, onHit, onMiss)
                : fireHitscanPattern(camera, weapon, onHit, onMiss, shotToken));
        if (fired) {
            consumeAmmoForShot(weapon, now);
        }
        return fired;
    };

    GameHitscan.getCurrentWeapon = function () {
        var weapon = getCurrentWeaponData();
        var now = performance.now();
        var combatState = currentWeaponPresentationState(now);
        var ammoState = combatState ? {
            reloadUntil: combatState.reloading ? (now + Math.max(0, Number(combatState.reloadRemaining || 0))) : 0
        } : syncWeaponAmmoState(weapon.id, now);
        var reloadRemaining = reloadRemainingForWeapon(weapon, now);
        var reloadedFlashRemaining = combatState
            ? Math.max(0, Number(combatState.reloadedFlashRemaining || 0))
            : Math.max(0, Number(ammoState && ammoState.reloadedFlashUntil || 0) - now);
        var reloadPresentation = combatState
            ? {
                reloading: !!combatState.reloading,
                reloadPct: Math.max(0, Math.min(1, Number(combatState.reloadPct != null ? combatState.reloadPct : 0))),
                phase: String(combatState.reloadPhase || (combatState.reloading ? 'manipulate' : (reloadedFlashRemaining > 0 ? 'complete' : 'ready'))),
                phasePct: Math.max(0, Math.min(1, Number(combatState.reloadPhasePct != null ? combatState.reloadPhasePct : (combatState.reloading ? 0.5 : 1))))
            }
            : resolveReloadPresentationState(weapon.id, weapon.reloadMs, reloadRemaining, reloadedFlashRemaining);
        return {
            id: weapon.id,
            name: weapon.name,
            primitiveType: weapon.primitiveType || PRIMITIVE_HITSCAN_SINGLE,
            automatic: weapon.automatic,
            cooldown: weapon.cooldown,
            reloadMs: weapon.reloadMs,
            magazineSize: weapon.magazineSize,
            ammoInMag: weapon.magazineSize > 0 ? getAmmoInMag(weapon, now) : 0,
            reloading: weapon.magazineSize > 0 ? !!reloadPresentation.reloading : false,
            reloadRemaining: reloadRemaining,
            reloadedFlashRemaining: reloadedFlashRemaining,
            reloadPct: Number(reloadPresentation.reloadPct || 0),
            reloadPhase: String(reloadPresentation.phase || 'ready'),
            reloadPhasePct: Number(reloadPresentation.phasePct || 0),
            bodyDamage: weapon.bodyDamage,
            headDamage: weapon.headDamage,
            pellets: weapon.pellets,
            hipfireSpread: weapon.hipfireSpread,
            adsSpread: Number(weapon.adsSpread || 0),
            adsFovDeg: Number(weapon.adsFovDeg || 0),
            maxRange: getEffectiveMaxRange(weapon),
            adsMaxRange: Number(weapon.adsMaxRange || weapon.maxRange || 0),
            adsHitscanRangeMultiplier: Number(weapon.adsHitscanRangeMultiplier || 1),
            autoLock: weapon.autoLock ? { enabled: weapon.autoLock.enabled !== false } : null,
            singleHitFromPellets: !!weapon.singleHitFromPellets
        };
    };

    GameHitscan.getReticleSpec = function (weaponId) {
        var id = weaponId || activeWeaponId();
        var weapon = weapons[id];
        if (!weapon) return null;
        if (getAutoLockConfig(weapon) || id === 'shotgun' || (weapon.singleHitFromPellets && id !== 'pistol')) {
            return {
                type: 'circle',
                size: getCircleReticleSizePx(weapon),
                adsActive: isAdsActiveForWeapon(id)
            };
        }
        return null;
    };

    GameHitscan.getWeaponOrder = function () {
        return activeWeaponOrder();
    };

    GameHitscan.setWeapon = function (weaponId) {
        if (!weapons[weaponId]) return null;
        currentWeaponId = weaponId;
        var combat = combatRuntime();
        if (combat && combat.equipWeapon) {
            var state = combat.equipWeapon(weaponId, performance.now());
            if (state && state.id && weapons[state.id]) {
                currentWeaponId = state.id;
            }
        }
        return GameHitscan.getCurrentWeapon();
    };

    GameHitscan.cycleWeapon = function (delta) {
        var order = activeWeaponOrder();
        if (!order.length) return null;
        var idx = order.indexOf(activeWeaponId());
        if (idx === -1) idx = 0;

        if (delta > 0) {
            idx = (idx + 1) % order.length;
        } else {
            idx = (idx - 1 + order.length) % order.length;
        }

        return GameHitscan.setWeapon(order[idx]);
    };

    GameHitscan.toggleWeapon = function () {
        var order = activeWeaponOrder().slice(0, 2);
        if (!order.length) return null;
        if (order.length === 1) {
            if (activeWeaponId() !== order[0]) {
                return GameHitscan.setWeapon(order[0]);
            }
            return GameHitscan.getCurrentWeapon();
        }
        var activeId = activeWeaponId();
        if (activeId === order[0]) return GameHitscan.setWeapon(order[1]);
        if (activeId === order[1]) return GameHitscan.setWeapon(order[0]);
        return GameHitscan.setWeapon(order[0]);
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
        var combat = combatRuntime();
        if (combat && combat.setWeaponLoadout) {
            var loadout = combat.setWeaponLoadout({ slots: validated });
            if (loadout && Array.isArray(loadout.slots) && loadout.slots.length) {
                weaponOrder = loadout.slots.slice();
            }
            if (combat.getEquippedWeaponId && weapons[combat.getEquippedWeaponId()]) {
                currentWeaponId = combat.getEquippedWeaponId();
            }
        }
        if (weaponOrder.indexOf(currentWeaponId) === -1) {
            currentWeaponId = weaponOrder[0];
        }
        return weaponOrder.slice();
    };

    GameHitscan.equipSlot = function (slotIndex) {
        var idx = Math.max(0, Math.floor(slotIndex || 0));
        var order = activeWeaponOrder();
        if (idx >= order.length) return null;
        return GameHitscan.setWeapon(order[idx]);
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
        var combat = combatRuntime();
        if (combat && combat.getCooldownRemaining) {
            return combat.getCooldownRemaining(now) <= 0;
        }
        return (now - lastFireTime) >= weapon.cooldown;
    };

    GameHitscan.cooldownRemaining = function () {
        var combat = combatRuntime();
        if (combat && combat.getCooldownRemaining) {
            return Math.max(0, Number(combat.getCooldownRemaining(performance.now()) || 0));
        }
        var weapon = getCurrentWeaponData();
        var elapsed = performance.now() - lastFireTime;
        return Math.max(0, weapon.cooldown - elapsed);
    };

    GameHitscan.peekCenterTarget = function (camera, maxRange) {
        var weapon = getCurrentWeaponData();
        var range = (typeof maxRange === 'number' && maxRange > 0) ? maxRange : getEffectiveMaxRange(weapon);
        if (weapon && weapon.singleHitFromPellets) {
            var traced = findBestCircleScanHit(camera, weapon);
            if (!traced || !traced.hit) return null;
            return {
                hitbox: traced.hitbox,
                hitType: traced.hitType || 'body',
                targetId: traced.hitbox && traced.hitbox.userData ? traced.hitbox.userData.targetId || '' : '',
                distance: traced.distance,
                point: traced.hitPoint
            };
        }
        return castCenter(camera, range);
    };

    GameHitscan.peekAutoLockTarget = function (camera) {
        var weapon = getCurrentWeaponData();
        if (!getAutoLockConfig(weapon)) return null;
        var preview = resolveAutoLockPreview(camera, weapon);
        if (!preview || preview.kind !== 'lock' || !preview.target) return null;
        return {
            targetId: preview.target.targetId || '',
            ownerType: preview.target.ownerType || 'unknown',
            worldPos: preview.body && preview.body.point
                ? new THREE.Vector3(preview.body.point.x, preview.body.point.y, preview.body.point.z)
                : (preview.target.worldPos && preview.target.worldPos.clone ? preview.target.worldPos.clone() : null),
            hitbox: preview.target.bodyHitbox || preview.target.hitbox || null,
            enemyRef: preview.target.enemyRef || null
        };
    };

    GameHitscan.tick = function (_dt) {
        var combat = combatRuntime();
        if (combat && combat.getCurrentWeaponState) {
            combat.getCurrentWeaponState(performance.now());
            return null;
        }
        syncWeaponAmmoState(currentWeaponId, performance.now());
        return null;
    };

    GameHitscan.syncAmmoStateFromNetwork = function (weaponAmmoStateMap) {
        var combat = combatRuntime();
        if (combat && combat.syncWeaponState) {
            return !!combat.syncWeaponState({
                weaponAmmo: weaponAmmoStateMap,
                weaponLoadout: activeWeaponOrder(),
                weaponId: activeWeaponId()
            }, performance.now());
        }
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

    GameHitscan.reloadCurrentWeapon = function () {
        var weapon = getCurrentWeaponData();
        return beginReload(weapon, performance.now());
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
            bodyHitbox: target.bodyHitbox || target.hitbox || null,
            headHitbox: target.headHitbox || null,
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
            bodyHitbox: target.bodyHitbox || target.hitbox || null,
            headHitbox: target.headHitbox || null,
            enemyRef: target.enemyRef || null
        };
    };

    GameHitscan.updateTracers = function (dt) {
        if (!dt || !tracerPoolReady || tracerPool.length === 0) return;
        var simDt = Math.min(dt, 1 / 15);
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

            var visibleLength = t.head.distanceTo(t.tail);
            tracerTmpPos.copy(tracerMeshMid);
            tracerTmpQuat.setFromUnitVectors(tracerMeshUp, t.dir);
            tracerTmpScale.set(1, Math.max(0.05, visibleLength * 0.82), 1);
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
                adsSpread: Number(weapon.adsSpread || 0),
                adsFovDeg: Number(weapon.adsFovDeg || 0),
                hipfireBloomScale: Number(weapon.hipfireBloomScale != null ? weapon.hipfireBloomScale : 1),
                adsBloomScale: Number(weapon.adsBloomScale != null ? weapon.adsBloomScale : 1),
                maxRange: weapon.maxRange,
                adsMaxRange: weapon.adsMaxRange,
                autoLock: weapon.autoLock ? { enabled: weapon.autoLock.enabled !== false } : null,
                singleHitFromPellets: !!weapon.singleHitFromPellets
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

    GameHitscan.shouldPredictNetHit = shouldPredictNetHit;
    GameHitscan.buildNetworkFireIntent = function (shotToken) {
        var playerApi = globalThis.__MAYHEM_RUNTIME.GamePlayer || null;
        var camera = playerApi && playerApi.getCamera ? playerApi.getCamera() : null;
        var weapon = getCurrentWeaponData();
        if (!camera || !weapon) return null;
        var shotContext = buildLocalShotContext(camera, weapon, shotToken);
        if (!shotContext) return null;
        return {
            weaponId: weapon.id,
            aimOrigin: shotContext.aimOrigin,
            aimForward: shotContext.aimForward,
            adsActive: !!shotContext.adsActive,
            viewFovDeg: Number(shotContext.viewFovDeg || 0)
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameHitscan = GameHitscan;
})();
