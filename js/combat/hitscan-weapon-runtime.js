/**
 * hitscan-weapon-runtime.js - Internal weapon/runtime state for hitscan weapons.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameHitscanWeaponRuntime
 */
(function () {
    'use strict';

    function create() {
        var PRIMITIVE_HITSCAN_SINGLE = 'hitscan_single';
        var PRIMITIVE_HITSCAN_MULTI = 'hitscan_multi';
        var SHARED_SPREAD_ASPECT = 16 / 9;
        var RELOADED_FLASH_MS = 900;
        var PISTOL_RETICLE_REFERENCE_DISTANCE_WU = 20;

        var currentWeaponId = 'rifle';
        var weaponOrder = [];
        var weaponCatalogOrder = [];
        var weapons = {};
        var weaponAmmoState = {};
        var weaponFalloffTuning = {};
        var lastLocalFireTime = 0;
        var refreshSnapshot = {
            sharedApi: null,
            gameplayTuning: null,
            getSelectableWeaponIds: null,
            getWeaponStats: null,
            getWeaponPresentation: null,
            getWeaponFalloffProfile: null,
            resolveWeaponAimProfile: null
        };

        function runtime() {
            return globalThis.__MAYHEM_RUNTIME || {};
        }

        function sharedApi() {
            return runtime().GameShared || {};
        }

        function combatRuntime() {
            return runtime().GamePlayerCombat || null;
        }

        function playerApi() {
            return runtime().GamePlayer || null;
        }

        function localNowMs(timing) {
            var stamp = Number(timing && timing.localNow);
            if (isFinite(stamp) && stamp >= 0) return stamp;
            if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
                return Number(performance.now()) || 0;
            }
            return Date.now();
        }

        function wallNowMs(timing) {
            var stamp = Number(timing && timing.wallNow);
            if (isFinite(stamp) && stamp >= 0) return stamp;
            return Date.now();
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

        function rawWeaponStatsMap(shared) {
            var tuning = shared && shared.gameplayTuning ? shared.gameplayTuning : {};
            return tuning.weaponStats || {};
        }

        function resolveSharedWeaponAimProfile(shared, weaponStats, adsActive) {
            if (shared && shared.resolveWeaponAimProfile) {
                return shared.resolveWeaponAimProfile(weaponStats, adsActive);
            }
            var stats = weaponStats || {};
            var aimProfile = stats.aimProfile || {};
            var hipfire = aimProfile.hipfire || {};
            var ads = aimProfile.ads || {};
            var baseHipSpread = Math.max(0, Number(stats.hipfireSpread || 0));
            var baseAdsSpread = Math.max(0, Number(stats.adsSpread != null ? stats.adsSpread : baseHipSpread));
            var baseHipRange = Math.max(0, Number(stats.maxRange || 0));
            var baseAdsRange = Math.max(baseHipRange, Number(stats.adsMaxRange != null ? stats.adsMaxRange : baseHipRange));
            return adsActive
                ? {
                    spread: Math.max(0, Number(ads.spread != null ? ads.spread : baseAdsSpread)),
                    maxRange: stats.infiniteRange ? Infinity : Math.max(baseHipRange, Number(ads.maxRange != null ? ads.maxRange : baseAdsRange))
                }
                : {
                    spread: Math.max(0, Number(hipfire.spread != null ? hipfire.spread : baseHipSpread)),
                    maxRange: stats.infiniteRange ? Infinity : Math.max(0, Number(hipfire.maxRange != null ? hipfire.maxRange : baseHipRange))
                };
        }

        function getWeaponStatsFromShared(shared, weaponId) {
            var id = String(weaponId || '');
            if (!id) return null;
            if (shared && shared.getWeaponStats) return shared.getWeaponStats(id);
            var statsMap = rawWeaponStatsMap(shared || {});
            return statsMap[id] || null;
        }

        function getWeaponPresentation(shared, weaponId) {
            var id = String(weaponId || '');
            if (!id) return null;
            if (shared && shared.getWeaponPresentation) return shared.getWeaponPresentation(id);
            return null;
        }

        function getWeaponFalloffProfile(shared, weaponId) {
            var id = String(weaponId || '');
            if (!id) return [];
            if (shared && shared.getWeaponFalloffProfile) {
                return shared.getWeaponFalloffProfile(id);
            }
            var tuning = shared && shared.gameplayTuning ? shared.gameplayTuning : {};
            var profile = tuning.weaponFalloff && tuning.weaponFalloff[id];
            return Array.isArray(profile) ? profile.slice() : [];
        }

        function selectableWeaponIdsFromShared(shared) {
            if (shared && shared.getSelectableWeaponIds) {
                var selected = shared.getSelectableWeaponIds();
                if (Array.isArray(selected) && selected.length) {
                    return selected.map(function (id) { return String(id || ''); }).filter(Boolean);
                }
            }
            var statsMap = rawWeaponStatsMap(shared || {});
            var ids = [];
            for (var id in statsMap) {
                if (Object.prototype.hasOwnProperty.call(statsMap, id)) ids.push(id);
            }
            if (ids.length) return ids;
            return ['rifle'];
        }

        function buildWeaponFromShared(shared, id) {
            var stats = getWeaponStatsFromShared(shared, id) || {};
            var hipAim = resolveSharedWeaponAimProfile(shared, stats, false);
            var adsAim = resolveSharedWeaponAimProfile(shared, stats, true);
            var presentation = getWeaponPresentation(shared, id);
            var tracer = presentation && presentation.tracer ? presentation.tracer : {};
            return {
                id: id,
                name: stats.name || id,
                primitiveType: stats.primitiveType || PRIMITIVE_HITSCAN_SINGLE,
                automatic: !!stats.automatic,
                cooldown: Number(stats.cooldownMs || 0),
                reloadMs: Math.max(0, Number(stats.reloadMs || 0)),
                magazineSize: Math.max(0, Number(stats.magazineSize || 0)),
                bodyDamage: Number(stats.bodyDamage || 0),
                headDamage: Number(stats.headDamage || 0),
                pellets: Number(stats.pellets || 1),
                hipfireSpread: Number(hipAim.spread || 0),
                adsSpread: Number(adsAim.spread || 0),
                adsFovDeg: Number(stats.adsFovDeg || 0),
                maxRange: hipAim.maxRange === Infinity ? Number.POSITIVE_INFINITY : Number(hipAim.maxRange || 0),
                adsMaxRange: adsAim.maxRange === Infinity ? Number.POSITIVE_INFINITY : Number(adsAim.maxRange || 0),
                adsHitscanRangeMultiplier: Number(hipAim.maxRange > 0 ? (Number(adsAim.maxRange || hipAim.maxRange) / hipAim.maxRange) : 1),
                hipfireCylinderRadiusWu: Number(stats.hipfireCylinderRadiusWu || 0),
                adsCylinderRadiusWu: Number(stats.adsCylinderRadiusWu || 0),
                tracerLife: Number(tracer.life || 0),
                tracerSpeed: Number(tracer.speed || 0),
                tracerSegmentLength: Number(tracer.segmentLength || 0),
                hipfireBloomScale: Number(stats.hipfireBloomScale != null ? stats.hipfireBloomScale : 1),
                adsBloomScale: Number(stats.adsBloomScale != null ? stats.adsBloomScale : 1),
                autoLock: cloneAutoLockConfig(stats.autoLock),
                singleHitFromPellets: !!stats.singleHitFromPellets
            };
        }

        function refreshWeaponCatalogIfNeeded() {
            var shared = sharedApi();
            var tuning = shared.gameplayTuning || null;
            if (
                refreshSnapshot.sharedApi === shared &&
                refreshSnapshot.gameplayTuning === tuning &&
                refreshSnapshot.getSelectableWeaponIds === shared.getSelectableWeaponIds &&
                refreshSnapshot.getWeaponStats === shared.getWeaponStats &&
                refreshSnapshot.getWeaponPresentation === shared.getWeaponPresentation &&
                refreshSnapshot.getWeaponFalloffProfile === shared.getWeaponFalloffProfile &&
                refreshSnapshot.resolveWeaponAimProfile === shared.resolveWeaponAimProfile &&
                weaponCatalogOrder.length > 0
            ) {
                return;
            }

            refreshSnapshot.sharedApi = shared;
            refreshSnapshot.gameplayTuning = tuning;
            refreshSnapshot.getSelectableWeaponIds = shared.getSelectableWeaponIds || null;
            refreshSnapshot.getWeaponStats = shared.getWeaponStats || null;
            refreshSnapshot.getWeaponPresentation = shared.getWeaponPresentation || null;
            refreshSnapshot.getWeaponFalloffProfile = shared.getWeaponFalloffProfile || null;
            refreshSnapshot.resolveWeaponAimProfile = shared.resolveWeaponAimProfile || null;

            var ids = selectableWeaponIdsFromShared(shared);
            var nextWeapons = {};
            var nextFalloff = {};
            for (var i = 0; i < ids.length; i++) {
                var id = ids[i];
                nextWeapons[id] = buildWeaponFromShared(shared, id);
                nextFalloff[id] = getWeaponFalloffProfile(shared, id);
            }

            var nextOrder = [];
            var seen = {};
            for (var oi = 0; oi < weaponOrder.length; oi++) {
                var existingId = String(weaponOrder[oi] || '');
                if (!nextWeapons[existingId] || seen[existingId]) continue;
                seen[existingId] = true;
                nextOrder.push(existingId);
            }
            for (var ni = 0; ni < ids.length; ni++) {
                var nextId = String(ids[ni] || '');
                if (!nextWeapons[nextId] || seen[nextId]) continue;
                seen[nextId] = true;
                nextOrder.push(nextId);
            }

            weaponCatalogOrder = ids.slice();
            weapons = nextWeapons;
            weaponFalloffTuning = nextFalloff;
            weaponOrder = nextOrder.length ? nextOrder : ids.slice();
            if (!weapons[currentWeaponId]) {
                currentWeaponId = weaponOrder[0] || ids[0] || 'rifle';
            }
        }

        function activeWeaponId() {
            refreshWeaponCatalogIfNeeded();
            var combat = combatRuntime();
            if (combat && combat.getEquippedWeaponId) {
                var equipped = String(combat.getEquippedWeaponId() || '');
                if (weapons[equipped]) return equipped;
            }
            return currentWeaponId;
        }

        function activeWeaponOrder() {
            refreshWeaponCatalogIfNeeded();
            var combat = combatRuntime();
            if (combat && combat.getWeaponLoadout) {
                var loadout = combat.getWeaponLoadout();
                if (loadout && Array.isArray(loadout.slots) && loadout.slots.length) {
                    return loadout.slots.filter(function (id) { return !!weapons[String(id || '')]; });
                }
            }
            return weaponOrder.slice();
        }

        function currentWeaponPresentationState(timing) {
            var combat = combatRuntime();
            if (combat && combat.getCurrentWeaponState) {
                return combat.getCurrentWeaponState(wallNowMs(timing));
            }
            return null;
        }

        function weaponPresentationState(weaponId, timing) {
            var combat = combatRuntime();
            if (combat && combat.getWeaponState) {
                return combat.getWeaponState(weaponId, wallNowMs(timing));
            }
            return null;
        }

        function isAdsActiveForWeapon(weaponId) {
            var player = playerApi();
            var state = player && player.getAdsState ? player.getAdsState() : null;
            return !!(state && state.active && state.weaponId === weaponId);
        }

        function resolveReloadPresentationState(weaponId, reloadMs, reloadRemaining, reloadedFlashRemaining, previousState) {
            var shared = sharedApi();
            var presentation = getWeaponPresentation(shared, weaponId);
            if (shared.resolveReloadPresentationState) {
                return shared.resolveReloadPresentationState({
                    reloadMs: reloadMs,
                    reloadRemaining: reloadRemaining,
                    reloadedFlashRemaining: reloadedFlashRemaining,
                    reload: presentation ? presentation.reload : null
                }, previousState || null);
            }
            return {
                reloading: Number(reloadMs || 0) > 0 && Number(reloadRemaining || 0) > 0,
                reloadPct: Number(reloadRemaining || 0) > 0 ? 0 : 1,
                phase: Number(reloadedFlashRemaining || 0) > 0 ? 'complete' : 'ready',
                phasePct: Number(reloadedFlashRemaining || 0) > 0 ? 1 : 1,
                justStarted: false,
                justCompleted: false,
                reloadRemaining: Math.max(0, Number(reloadRemaining || 0)),
                reloadedFlashRemaining: Math.max(0, Number(reloadedFlashRemaining || 0))
            };
        }

        function ensureWeaponAmmoState(weaponId) {
            refreshWeaponCatalogIfNeeded();
            var id = String(weaponId || '');
            var weapon = weapons[id];
            if (!weapon) return null;
            if (!weaponAmmoState[id]) {
                weaponAmmoState[id] = {
                    ammoInMag: weapon.magazineSize > 0 ? weapon.magazineSize : 0,
                    reloadUntil: 0,
                    reloadedFlashUntil: 0
                };
            }
            return weaponAmmoState[id];
        }

        function syncWeaponAmmoState(weaponId, timing) {
            refreshWeaponCatalogIfNeeded();
            var id = String(weaponId || '');
            var weapon = weapons[id];
            var state = ensureWeaponAmmoState(id);
            var stamp = localNowMs(timing);
            if (!weapon || !state || weapon.magazineSize <= 0) return state;
            if (state.reloadUntil > 0 && stamp >= state.reloadUntil) {
                state.reloadUntil = 0;
                state.ammoInMag = weapon.magazineSize;
                state.reloadedFlashUntil = stamp + RELOADED_FLASH_MS;
            }
            if (state.reloadUntil <= 0 && Number(state.ammoInMag || 0) <= 0 && weapon.reloadMs > 0) {
                applyReloadState(weapon, state, timing);
            }
            return state;
        }

        function applyReloadState(weapon, state, timing) {
            if (!weapon || !state || weapon.magazineSize <= 0 || weapon.reloadMs <= 0) return false;
            if (Number(state.ammoInMag || 0) >= Math.max(0, Number(weapon.magazineSize || 0))) return false;
            state.ammoInMag = 0;
            state.reloadUntil = localNowMs(timing) + weapon.reloadMs;
            state.reloadedFlashUntil = 0;
            var player = playerApi();
            if (player && player.setAdsEnabled) {
                player.setAdsEnabled(false);
            }
            return true;
        }

        function getAmmoInMag(weapon, timing) {
            if (!weapon || weapon.magazineSize <= 0) return 0;
            var combatState = weaponPresentationState(weapon.id, timing);
            if (combatState) return Math.max(0, Number(combatState.ammoInMag || 0));
            var state = syncWeaponAmmoState(weapon.id, timing);
            return Math.max(0, Number(state && state.ammoInMag || 0));
        }

        function reloadRemainingForWeapon(weapon, timing) {
            if (!weapon || weapon.magazineSize <= 0) return 0;
            var combatState = weaponPresentationState(weapon.id, timing);
            if (combatState) return Math.max(0, Number(combatState.reloadRemaining || 0));
            var state = syncWeaponAmmoState(weapon.id, timing);
            return Math.max(0, Number(state && state.reloadUntil || 0) - localNowMs(timing));
        }

        function isReloadingWeapon(weapon, timing) {
            return reloadRemainingForWeapon(weapon, timing) > 0;
        }

        function notifyReloadStarted(weapon) {
            if (!weapon || Number(weapon.reloadMs || 0) <= 0) return;
            var player = playerApi();
            if (!player || !player.triggerAction) return;
            player.triggerAction('reload', {
                duration: Math.max(0.12, Number(weapon.reloadMs || 0) / 1000),
                weaponId: weapon.id || ''
            });
        }

        function beginReload(weapon, timing) {
            if (!weapon || weapon.magazineSize <= 0 || weapon.reloadMs <= 0) return false;
            var combat = combatRuntime();
            if (combat && combat.beginWeaponReload) {
                var started = !!combat.beginWeaponReload(weapon.id, wallNowMs(timing));
                if (started) {
                    var player = playerApi();
                    if (player && player.setAdsEnabled) player.setAdsEnabled(false);
                    notifyReloadStarted(weapon);
                }
                return started;
            }
            var state = syncWeaponAmmoState(weapon.id, timing);
            if (!state || state.reloadUntil > localNowMs(timing)) return false;
            var applied = applyReloadState(weapon, state, timing);
            if (applied) notifyReloadStarted(weapon);
            return applied;
        }

        function consumeAmmoForShot(weapon, timing) {
            if (!weapon || weapon.magazineSize <= 0) return;
            var wasReloading = isReloadingWeapon(weapon, timing);
            var combat = combatRuntime();
            if (combat && combat.recordWeaponFire) {
                var postFireState = combat.recordWeaponFire(weapon.id, wallNowMs(timing));
                if (!wasReloading && postFireState && postFireState.reloading) {
                    notifyReloadStarted(weapon);
                }
                return;
            }
            var state = syncWeaponAmmoState(weapon.id, timing);
            if (!state) return;
            state.ammoInMag = Math.max(0, Number(state.ammoInMag || weapon.magazineSize) - 1);
            state.reloadedFlashUntil = 0;
            if (state.ammoInMag <= 0) {
                beginReload(weapon, timing);
            }
            if (!wasReloading && Number(state.reloadUntil || 0) > localNowMs(timing)) {
                notifyReloadStarted(weapon);
            }
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

        function applyDistanceFalloff(weapon, damage, distance) {
            refreshWeaponCatalogIfNeeded();
            if (!weapon || !weapon.id) return damage;
            var sharedDamage = sharedApi().damage || null;
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
            return Math.max(0, Number(isAdsActiveForWeapon(weapon.id) ? weapon.adsSpread : weapon.hipfireSpread || 0));
        }

        function currentViewAspect() {
            var player = playerApi();
            var camera = player && player.getCamera ? player.getCamera() : null;
            if (camera && isFinite(Number(camera.aspect)) && Number(camera.aspect) > 0.0001) {
                return Number(camera.aspect);
            }
            return window.innerWidth / Math.max(1, window.innerHeight);
        }

        function pistolCylinderRadiusWu(weapon) {
            if (!weapon) return 0;
            var key = isAdsActiveForWeapon(weapon.id) ? 'adsCylinderRadiusWu' : 'hipfireCylinderRadiusWu';
            var value = Number(weapon[key] != null ? weapon[key] : 0);
            return isFinite(value) && value > 0 ? value : 0;
        }

        function projectCylinderRadiusToScreenPx(camera, radiusWu, referenceDistance) {
            if (!camera || !(radiusWu > 0) || !(referenceDistance > 0)) return 0;
            var vFov = Number(camera.fov || 75) * Math.PI / 180;
            var projected = radiusWu / Math.max(0.0001, referenceDistance * Math.tan(vFov * 0.5));
            return Math.max(0, projected * (window.innerHeight * 0.5));
        }

        function getSpreadMetrics(weaponId) {
            refreshWeaponCatalogIfNeeded();
            var weapon = typeof weaponId === 'string' ? weapons[weaponId] : weaponId;
            if (!weapon) {
                return { radiusPx: 0, radiusXpx: 0, radiusYpx: 0, spread: 0 };
            }
            if (weapon.id === 'pistol' && weapon.singleHitFromPellets) {
                var player = playerApi();
                var camera = player && player.getCamera ? player.getCamera() : null;
                var cylinderRadiusPx = projectCylinderRadiusToScreenPx(camera, pistolCylinderRadiusWu(weapon), PISTOL_RETICLE_REFERENCE_DISTANCE_WU);
                return {
                    radiusPx: cylinderRadiusPx,
                    radiusXpx: cylinderRadiusPx,
                    radiusYpx: cylinderRadiusPx,
                    spread: pistolCylinderRadiusWu(weapon)
                };
            }

            var spread = getActiveAimSpread(weapon);
            if (spread <= 0.00001) {
                return { radiusPx: 0, radiusXpx: 0, radiusYpx: 0, spread: 0 };
            }

            var aspect = currentViewAspect();
            var radiusYpx = spread * (window.innerHeight * 0.5);
            var radiusXpx = spread * (window.innerWidth * 0.5) / Math.max(aspect, 0.0001);
            return {
                radiusPx: Math.max(radiusXpx, radiusYpx),
                radiusXpx: radiusXpx,
                radiusYpx: radiusYpx,
                spread: spread
            };
        }

        function getSpreadRadiusPx(weaponId) {
            return getSpreadMetrics(weaponId).radiusPx;
        }

        function getViewFovDeg() {
            var player = playerApi();
            var camera = player && player.getCamera ? player.getCamera() : null;
            var fov = Number(camera && camera.fov);
            return isFinite(fov) && fov > 0.0001 ? fov : 75;
        }

        function getAutoLockConfig(weapon) {
            return weapon && weapon.autoLock && weapon.autoLock.enabled !== false ? weapon.autoLock : null;
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

        function shouldUseSyncedMultiplayerSpread(shotToken) {
            var net = runtime().GameNet || null;
            if (!shotToken || !net || !net.isActive || !net.isActive()) return false;
            if (net.isConnected) return !!net.isConnected();
            return true;
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
                var authority = sharedApi().hitscanAuthority || null;
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

            var radiusPx = getSpreadRadiusPx(weapon);
            if (!isFinite(radiusPx) || radiusPx <= 0.001) return { x: 0, y: 0 };

            var angle = Math.random() * Math.PI * 2;
            var radius = Math.sqrt(Math.random()) * radiusPx;
            return {
                x: (Math.cos(angle) * radius) / (window.innerWidth * 0.5),
                y: -((Math.sin(angle) * radius) / (window.innerHeight * 0.5))
            };
        }

        function getCircleSampleNdcOffset(weapon, sample) {
            var metrics = getSpreadMetrics(weapon);
            var radiusXpx = Number(metrics && metrics.radiusXpx || 0);
            var radiusYpx = Number(metrics && metrics.radiusYpx || 0);
            return {
                x: (Number(sample && sample.x || 0) * radiusXpx) / (window.innerWidth * 0.5),
                y: (Number(sample && sample.y || 0) * radiusYpx) / (window.innerHeight * 0.5)
            };
        }

        function getCurrentWeaponData() {
            refreshWeaponCatalogIfNeeded();
            return weapons[activeWeaponId()] || weapons.rifle || null;
        }

        function getCurrentWeapon(timing) {
            refreshWeaponCatalogIfNeeded();
            var weapon = getCurrentWeaponData();
            if (!weapon) return null;
            var combatState = currentWeaponPresentationState(timing);
            var localStamp = localNowMs(timing);
            var ammoState = combatState ? null : syncWeaponAmmoState(weapon.id, timing);
            var reloadRemaining = reloadRemainingForWeapon(weapon, timing);
            var reloadedFlashRemaining = combatState
                ? Math.max(0, Number(combatState.reloadedFlashRemaining || 0))
                : Math.max(0, Number(ammoState && ammoState.reloadedFlashUntil || 0) - localStamp);
            var reloadPresentation = combatState
                ? {
                    reloading: !!combatState.reloading,
                    reloadPct: Math.max(0, Math.min(1, Number(combatState.reloadPct != null ? combatState.reloadPct : 0))),
                    phase: String(combatState.reloadPhase || (combatState.reloading ? 'manipulate' : (reloadedFlashRemaining > 0 ? 'complete' : 'ready'))),
                    phasePct: Math.max(0, Math.min(1, Number(combatState.reloadPhasePct != null ? combatState.reloadPhasePct : (combatState.reloading ? 0.5 : 1))))
                }
                : resolveReloadPresentationState(weapon.id, weapon.reloadMs, reloadRemaining, reloadedFlashRemaining, null);
            return {
                id: weapon.id,
                name: weapon.name,
                primitiveType: weapon.primitiveType || PRIMITIVE_HITSCAN_SINGLE,
                automatic: weapon.automatic,
                cooldown: weapon.cooldown,
                reloadMs: weapon.reloadMs,
                magazineSize: weapon.magazineSize,
                ammoInMag: weapon.magazineSize > 0 ? getAmmoInMag(weapon, timing) : 0,
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
        }

        function buildReticleSpec(weapon) {
            if (!weapon) return null;
            var autoLock = !!getAutoLockConfig(weapon);
            var circleReticle = autoLock || weapon.id === 'shotgun' || (weapon.singleHitFromPellets && weapon.id !== 'pistol');
            return {
                type: circleReticle ? 'circle' : 'crosshair',
                size: circleReticle
                    ? (autoLock ? getAutoLockReticleSizePx(weapon) : (getSpreadRadiusPx(weapon) * 2))
                    : 0,
                adsActive: isAdsActiveForWeapon(weapon.id),
                targetGroup: circleReticle ? 'circle' : 'crosshair',
                targetSource: autoLock ? 'lock' : 'center'
            };
        }

        function getReticleSpec(weaponId) {
            refreshWeaponCatalogIfNeeded();
            var id = weaponId || activeWeaponId();
            return buildReticleSpec(weapons[id]);
        }

        function setWeapon(weaponId, timing) {
            refreshWeaponCatalogIfNeeded();
            if (!weapons[weaponId]) return null;
            if (activeWeaponOrder().indexOf(String(weaponId || '')) === -1) return getCurrentWeapon(timing);
            currentWeaponId = weaponId;
            var combat = combatRuntime();
            if (combat && combat.equipWeapon) {
                var state = combat.equipWeapon(weaponId, wallNowMs(timing));
                if (state && state.id && weapons[state.id]) currentWeaponId = state.id;
            }
            return getCurrentWeapon(timing);
        }

        function cycleWeapon(delta, timing) {
            var order = activeWeaponOrder();
            if (!order.length) return null;
            var idx = order.indexOf(activeWeaponId());
            if (idx === -1) idx = 0;
            idx = delta > 0
                ? ((idx + 1) % order.length)
                : ((idx - 1 + order.length) % order.length);
            return setWeapon(order[idx], timing);
        }

        function toggleWeapon(timing) {
            var order = activeWeaponOrder().slice(0, 2);
            if (!order.length) return null;
            if (order.length === 1) {
                if (activeWeaponId() !== order[0]) return setWeapon(order[0], timing);
                return getCurrentWeapon(timing);
            }
            var activeId = activeWeaponId();
            if (activeId === order[0]) return setWeapon(order[1], timing);
            if (activeId === order[1]) return setWeapon(order[0], timing);
            return setWeapon(order[0], timing);
        }

        function setWeaponOrder(nextOrder) {
            refreshWeaponCatalogIfNeeded();
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
                    weaponOrder = loadout.slots.filter(function (id) { return !!weapons[String(id || '')]; });
                }
                if (combat.getEquippedWeaponId && weapons[combat.getEquippedWeaponId()]) {
                    currentWeaponId = combat.getEquippedWeaponId();
                }
            }
            if (weaponOrder.indexOf(currentWeaponId) === -1) currentWeaponId = weaponOrder[0];
            return weaponOrder.slice();
        }

        function equipSlot(slotIndex, timing) {
            var idx = Math.max(0, Math.floor(slotIndex || 0));
            var order = activeWeaponOrder();
            if (idx >= order.length) return null;
            return setWeapon(order[idx], timing);
        }

        function getCooldownRemaining(timing) {
            var combat = combatRuntime();
            if (combat && combat.getCooldownRemaining) {
                return Math.max(0, Number(combat.getCooldownRemaining(wallNowMs(timing)) || 0));
            }
            var weapon = getCurrentWeaponData();
            if (!weapon) return 0;
            var elapsed = localNowMs(timing) - lastLocalFireTime;
            return Math.max(0, weapon.cooldown - elapsed);
        }

        function markLocalShotFired(timing) {
            lastLocalFireTime = localNowMs(timing);
        }

        function getHudState(timing) {
            var combat = combatRuntime();
            var weapon = getCurrentWeaponData();
            if (!weapon) return { status: 'ready', ready: true, pct: 1, phase: 'ready' };
            if (combat && combat.getWeaponHudState && activeWeaponId() === String(weapon.id || '')) {
                return combat.getWeaponHudState(wallNowMs(timing));
            }
            var state = syncWeaponAmmoState(weapon.id, timing);
            var localStamp = localNowMs(timing);
            var reloadRemaining = reloadRemainingForWeapon(weapon, timing);
            var reloadedFlashRemaining = Math.max(0, Number(state && state.reloadedFlashUntil || 0) - localStamp);
            var reloadPresentation = resolveReloadPresentationState(weapon.id, weapon.reloadMs, reloadRemaining, reloadedFlashRemaining, null);
            if (reloadPresentation.reloading) {
                return {
                    status: 'reloading',
                    ready: false,
                    pct: reloadPresentation.reloadPct,
                    phase: reloadPresentation.phase
                };
            }
            var cooldownRemaining = Math.max(0, weapon.cooldown - (localStamp - lastLocalFireTime));
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

        function syncAmmoStateFromNetwork(weaponAmmoStateMap, timing) {
            refreshWeaponCatalogIfNeeded();
            var combat = combatRuntime();
            if (combat && combat.syncWeaponState) {
                return !!combat.syncWeaponState({
                    weaponAmmo: weaponAmmoStateMap,
                    weaponLoadout: activeWeaponOrder(),
                    weaponId: activeWeaponId()
                }, wallNowMs(timing));
            }
            if (!weaponAmmoStateMap || typeof weaponAmmoStateMap !== 'object') return false;
            var localStamp = localNowMs(timing);
            for (var weaponId in weaponAmmoStateMap) {
                if (!Object.prototype.hasOwnProperty.call(weaponAmmoStateMap, weaponId)) continue;
                var entry = weaponAmmoStateMap[weaponId];
                var localState = ensureWeaponAmmoState(weaponId);
                var weapon = weapons[weaponId];
                if (!entry || !localState || !weapon) continue;
                localState.ammoInMag = Math.max(0, Number(entry.ammoInMag || 0));
                localState.reloadUntil = entry.reloading
                    ? localStamp + Math.max(0, Math.round(Number(entry.reloadRemaining || 0) * 1000))
                    : 0;
                localState.reloadedFlashUntil = Math.max(0, Math.round(Number(entry.reloadedFlashRemaining || 0) * 1000)) + localStamp;
            }
            return true;
        }

        function reloadCurrentWeapon(timing) {
            return beginReload(getCurrentWeaponData(), timing);
        }

        function isAdsBlocked(timing) {
            return isReloadingWeapon(getCurrentWeaponData(), timing);
        }

        function tick(timing) {
            var combat = combatRuntime();
            if (combat && combat.getCurrentWeaponState) {
                combat.getCurrentWeaponState(wallNowMs(timing));
                return null;
            }
            syncWeaponAmmoState(activeWeaponId(), timing);
            return null;
        }

        return {
            getCurrentWeaponData: getCurrentWeaponData,
            getCurrentWeapon: getCurrentWeapon,
            getReticleSpec: getReticleSpec,
            getWeaponOrder: activeWeaponOrder,
            setWeapon: setWeapon,
            cycleWeapon: cycleWeapon,
            toggleWeapon: toggleWeapon,
            setWeaponOrder: setWeaponOrder,
            equipSlot: equipSlot,
            getAllWeaponIds: function () {
                refreshWeaponCatalogIfNeeded();
                return weaponCatalogOrder.slice();
            },
            getHeadDamage: function () {
                var weapon = getCurrentWeaponData();
                return weapon ? weapon.headDamage : 0;
            },
            getBodyDamage: function () {
                var weapon = getCurrentWeaponData();
                return weapon ? weapon.bodyDamage : 0;
            },
            getCooldown: function () {
                var weapon = getCurrentWeaponData();
                return weapon ? weapon.cooldown : 0;
            },
            getCooldownRemaining: getCooldownRemaining,
            getHudState: getHudState,
            reloadCurrentWeapon: reloadCurrentWeapon,
            isAdsBlocked: isAdsBlocked,
            syncAmmoStateFromNetwork: syncAmmoStateFromNetwork,
            tick: tick,
            getWeaponCatalog: function () {
                refreshWeaponCatalogIfNeeded();
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
                        hipfireCylinderRadiusWu: Number(weapon.hipfireCylinderRadiusWu || 0),
                        adsCylinderRadiusWu: Number(weapon.adsCylinderRadiusWu || 0),
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
            },
            getSpreadRadiusPx: getSpreadRadiusPx,
            getSpreadMetrics: getSpreadMetrics,
            isAdsActiveForWeapon: isAdsActiveForWeapon,
            getAutoLockConfig: getAutoLockConfig,
            getAutoLockReticleSizePx: getAutoLockReticleSizePx,
            getWeaponSpreadNdcOffset: getWeaponSpreadNdcOffset,
            getCircleSampleNdcOffset: getCircleSampleNdcOffset,
            getEffectiveMaxRange: getEffectiveMaxRange,
            getDamageForType: getDamageForType,
            applyDistanceFalloff: applyDistanceFalloff,
            getAmmoInMag: getAmmoInMag,
            isReloadingWeapon: isReloadingWeapon,
            beginReload: beginReload,
            consumeAmmoForShot: consumeAmmoForShot,
            markLocalShotFired: markLocalShotFired,
            getViewFovDeg: getViewFovDeg,
            pistolCylinderRadiusWu: pistolCylinderRadiusWu,
            getWeaponFalloffBands: function (weaponId) {
                refreshWeaponCatalogIfNeeded();
                return weaponFalloffTuning[String(weaponId || '')] || [];
            },
            refreshWeaponCatalogIfNeeded: refreshWeaponCatalogIfNeeded
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameHitscanWeaponRuntime = {
        create: create
    };
})();
