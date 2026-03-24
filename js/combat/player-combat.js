/**
 * player-combat.js - Player combat state (HP, armor, weapon presentation, respawn)
 * Extracted from main.js to isolate player combat concerns.
 */
(function () {
    'use strict';

    var RT = globalThis.__MAYHEM_RUNTIME;

    var playerHP = defaultPlayerHp();
    var playerMaxHP = defaultPlayerHp();
    var playerArmor = defaultPlayerArmor();
    var playerArmorMax = defaultPlayerArmor();
    var playerAlive = true;
    var armorRegenDelay = 0;
    var respawnInvulnTimer = 0;
    var authoritativeSpawnShieldUntil = 0;
    var respawnAtMs = 0;
    var stocksRemaining = 3;
    var maxStocks = 5;
    var bonusLivesEarned = 0;
    var extraLifeProgressPct = 0;
    var eliminated = false;
    var weaponLoadout = ['rifle'];
    var equippedWeaponId = 'rifle';
    var predictedMultiplayerWeaponId = '';
    var predictedMultiplayerWeaponUntil = 0;
    var predictedMultiplayerReloadUntilByWeapon = {};
    var weaponAmmo = {};
    var lastWeaponFireAtMs = 0;

    var DEFAULT_ARMOR_REGEN_DELAY = defaultArmorRegenDelay();
    var ARMOR_REGEN_PER_SEC = defaultArmorRegenPerSec();
    var RELOADED_FLASH_MS = 900;
    // Allow for network jitter plus snapshot cadence before a stale authoritative
    // weapon id snaps the local switch back.
    var MULTIPLAYER_WEAPON_PREDICTION_GRACE_MS = 2500;

    var playerDamagePosScratch = {
        x: 0,
        y: 0,
        z: 0,
        set: function (x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
        }
    };

    var _isPlayingFn = null;
    var _isMultiplayerFn = null;

    function isPlaying() {
        return _isPlayingFn ? _isPlayingFn() : false;
    }

    function isMultiplayer() {
        return _isMultiplayerFn ? _isMultiplayerFn() : false;
    }

    function nowMs() {
        return Date.now();
    }

    function clampNumber(value, fallback, min, max) {
        var num = Number(value);
        if (!isFinite(num)) num = Number(fallback);
        if (!isFinite(num)) num = 0;
        if (typeof min === 'number' && num < min) num = min;
        if (typeof max === 'number' && num > max) num = max;
        return num;
    }

    function weaponTimeMs(now) {
        var stamp = Number(now);
        if (isFinite(stamp) && stamp >= 0) return stamp;
        return nowMs();
    }

    function sharedWeaponApi() {
        return RT.GameShared || {};
    }

    function sharedDamageApi() {
        return (RT.GameShared && RT.GameShared.damage) || null;
    }

    function sharedEntityConstants() {
        return (sharedWeaponApi() && sharedWeaponApi().entityConstants) || {};
    }

    function sharedCombatTimings() {
        var shared = sharedWeaponApi();
        return shared.getCombatTimings ? (shared.getCombatTimings() || {}) : (shared.combatTimings || {});
    }

    function survivabilityTuning() {
        var shared = sharedWeaponApi();
        return shared.getSurvivabilityTuning ? (shared.getSurvivabilityTuning() || {}) : ((shared.gameplayTuning && shared.gameplayTuning.survivability) || {});
    }

    function defaultPlayerHp() {
        return clampNumber(survivabilityTuning().hpMax, sharedEntityConstants().DEFAULT_HP_MAX, 1);
    }

    function defaultPlayerArmor() {
        return clampNumber(survivabilityTuning().armorMax, sharedEntityConstants().DEFAULT_ARMOR_MAX, 0);
    }

    function defaultArmorRegenDelay() {
        var survivability = (sharedWeaponApi() && sharedWeaponApi().survivability) || {};
        return clampNumber(survivabilityTuning().armorRegenDelaySec, survivability.ARMOR_REGEN_DELAY_SEC, 0);
    }

    function defaultArmorRegenPerSec() {
        var survivability = (sharedWeaponApi() && sharedWeaponApi().survivability) || {};
        return clampNumber(survivabilityTuning().armorRegenPerSec, survivability.ARMOR_REGEN_PER_SEC, 0);
    }

    function getAllSelectableWeaponIds() {
        var shared = sharedWeaponApi();
        var ids = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : null;
        if (Array.isArray(ids) && ids.length) {
            return ids.map(function (id) { return String(id || ''); }).filter(Boolean);
        }
        return ['rifle'];
    }

    function defaultWeaponLoadout() {
        var shared = sharedWeaponApi();
        var defaults = shared.getDefaultWeaponLoadout ? shared.getDefaultWeaponLoadout() : null;
        if (Array.isArray(defaults) && defaults.length) return defaults.slice(0, 2);
        return getAllSelectableWeaponIds().slice(0, 2);
    }

    function getWeaponStats(weaponId) {
        var id = String(weaponId || '');
        if (!id) return null;
        var shared = sharedWeaponApi();
        if (shared.getWeaponStats) return shared.getWeaponStats(id);
        return null;
    }

    function getWeaponPresentation(weaponId) {
        var id = String(weaponId || '');
        if (!id) return null;
        var shared = sharedWeaponApi();
        if (shared.getWeaponPresentation) return shared.getWeaponPresentation(id);
        return null;
    }

    function isKnownWeaponId(weaponId) {
        return !!getWeaponStats(weaponId);
    }

    function sanitizeWeaponLoadout(slots) {
        var shared = sharedWeaponApi();
        if (shared.normalizeWeaponLoadout) {
            return shared.normalizeWeaponLoadout(slots, defaultWeaponLoadout());
        }
        var rawSlots = Array.isArray(slots) ? slots : defaultWeaponLoadout();
        var allowedIds = getAllSelectableWeaponIds();
        var allowed = {};
        for (var i = 0; i < allowedIds.length; i++) {
            allowed[String(allowedIds[i] || '')] = true;
        }
        var next = [];
        var seen = {};
        for (i = 0; i < rawSlots.length; i++) {
            var id = String(rawSlots[i] || '');
            if (!id || seen[id] || !allowed[id]) continue;
            seen[id] = true;
            next.push(id);
            if (next.length >= 2) break;
        }
        if (!next.length) {
            var fallback = defaultWeaponLoadout();
            for (i = 0; i < fallback.length; i++) {
                id = String(fallback[i] || '');
                if (!id || seen[id] || !allowed[id]) continue;
                seen[id] = true;
                next.push(id);
                if (next.length >= 2) break;
            }
        }
        if (!next.length) {
            for (i = 0; i < allowedIds.length; i++) {
                id = String(allowedIds[i] || '');
                if (!id || seen[id]) continue;
                next.push(id);
                break;
            }
        }
        if (!next.length) next.push('rifle');
        return next;
    }

    function ensureWeaponAmmoState(weaponId) {
        var id = String(weaponId || '');
        var stats = getWeaponStats(id);
        if (!id || !stats) return null;
        if (!weaponAmmo[id]) {
            weaponAmmo[id] = {
                ammoInMag: Math.max(0, Number(stats.magazineSize || 0)),
                reloadUntil: 0,
                reloadedFlashUntil: 0
            };
        }
        return weaponAmmo[id];
    }

    function syncWeaponAmmoState(weaponId, now) {
        var id = String(weaponId || '');
        var stats = getWeaponStats(id);
        var state = ensureWeaponAmmoState(id);
        var stamp = weaponTimeMs(now);
        if (!id || !stats || !state || Number(stats.magazineSize || 0) <= 0) return state;
        readPredictedMultiplayerReloadUntil(id, stamp);
        if (Number(state.reloadUntil || 0) > 0 && stamp >= Number(state.reloadUntil || 0)) {
            state.reloadUntil = 0;
            state.ammoInMag = Math.max(0, Number(stats.magazineSize || 0));
            state.reloadedFlashUntil = stamp + RELOADED_FLASH_MS;
        }
        return state;
    }

    function reloadRemainingForWeapon(weaponId, now) {
        var state = syncWeaponAmmoState(weaponId, now);
        return Math.max(0, Number(state && state.reloadUntil || 0) - weaponTimeMs(now));
    }

    function syncAmmoStateFromSnapshot(weaponAmmoStateMap, now) {
        if (!weaponAmmoStateMap || typeof weaponAmmoStateMap !== 'object') return false;
        var stamp = weaponTimeMs(now);
        for (var weaponId in weaponAmmoStateMap) {
            if (!Object.prototype.hasOwnProperty.call(weaponAmmoStateMap, weaponId)) continue;
            var entry = weaponAmmoStateMap[weaponId];
            var state = ensureWeaponAmmoState(weaponId);
            var stats = getWeaponStats(weaponId);
            if (!entry || !state || !stats) continue;
            var magazineSize = Math.max(0, Number(stats.magazineSize || 0));
            var snapshotAmmoInMag = Math.max(0, Number(entry.ammoInMag || 0));
            var predictedReloadUntil = readPredictedMultiplayerReloadUntil(weaponId, stamp);
            var awaitingReloadAck = isMultiplayer() &&
                predictedReloadUntil > stamp &&
                !entry.reloading &&
                snapshotAmmoInMag < magazineSize;
            if (awaitingReloadAck) continue;
            state.ammoInMag = Math.max(0, Math.min(magazineSize, Number(entry.ammoInMag || 0)));
            state.reloadUntil = entry.reloading
                ? stamp + Math.max(0, Math.round(Number(entry.reloadRemaining || 0) * 1000))
                : 0;
            state.reloadedFlashUntil = stamp + Math.max(0, Math.round(Number(entry.reloadedFlashRemaining || 0) * 1000));
            if (entry.reloading || state.ammoInMag >= magazineSize) {
                clearPredictedMultiplayerReload(weaponId);
            }
        }
        return true;
    }

    function buildWeaponState(weaponId, now) {
        var id = String(weaponId || '');
        var stats = getWeaponStats(id);
        if (!stats) return null;
        var stamp = weaponTimeMs(now);
        var ammoState = syncWeaponAmmoState(id, stamp);
        var reloadRemaining = reloadRemainingForWeapon(id, stamp);
        var reloadedFlashRemaining = Math.max(0, Number(ammoState && ammoState.reloadedFlashUntil || 0) - stamp);
        var shared = sharedWeaponApi();
        var presentationOwner = globalThis.__MAYHEM_RUNTIME && globalThis.__MAYHEM_RUNTIME.GameWeaponPresentation;
        var presentation = getWeaponPresentation(id);
        var reloadPresentation = presentationOwner && presentationOwner.resolveReloadState
            ? presentationOwner.resolveReloadState({
                reloadMs: Math.max(0, Number(stats.reloadMs || 0)),
                reloadRemaining: reloadRemaining,
                reloadedFlashRemaining: reloadedFlashRemaining
            }, null)
            : (shared.resolveReloadPresentationState
            ? shared.resolveReloadPresentationState({
                reloadMs: Math.max(0, Number(stats.reloadMs || 0)),
                reloadRemaining: reloadRemaining,
                reloadedFlashRemaining: reloadedFlashRemaining,
                reload: presentation && presentation.reload ? presentation.reload : null
            }, null)
            : {
                reloading: Math.max(0, Number(stats.reloadMs || 0)) > 0 && reloadRemaining > 0,
                reloadPct: reloadRemaining > 0
                    ? Math.max(0, Math.min(1, 1 - (reloadRemaining / Math.max(1, Number(stats.reloadMs || 1)))))
                    : 1,
                phase: reloadedFlashRemaining > 0 ? 'complete' : 'ready',
                phasePct: 1
            });
        return {
            id: id,
            name: String(stats.name || id),
            automatic: !!stats.automatic,
            cooldown: Math.max(0, Number(stats.cooldownMs || 0)),
            reloadMs: Math.max(0, Number(stats.reloadMs || 0)),
            magazineSize: Math.max(0, Number(stats.magazineSize || 0)),
            ammoInMag: Math.max(0, Number(ammoState && ammoState.ammoInMag || 0)),
            reloading: !!reloadPresentation.reloading,
            reloadRemaining: reloadRemaining,
            reloadedFlashRemaining: reloadedFlashRemaining,
            reloadPct: Number(reloadPresentation.reloadPct || 0),
            reloadPhase: String(reloadPresentation.phase || 'ready'),
            reloadPhasePct: Number(reloadPresentation.phasePct || 0),
            bodyDamage: Number(stats.bodyDamage || 0),
            headDamage: Number(stats.headDamage || 0),
            pellets: Math.max(1, Number(stats.pellets || 1))
        };
    }

    function buildWeaponHudState(now) {
        var currentWeapon = buildWeaponState(equippedWeaponId, now);
        if (!currentWeapon) {
            return {
                status: 'ready',
                ready: true,
                pct: 1
            };
        }
        if (currentWeapon.reloading) {
            return {
                status: 'reloading',
                ready: false,
                pct: currentWeapon.reloadPct,
                phase: currentWeapon.reloadPhase
            };
        }
        var stamp = weaponTimeMs(now);
        var cooldownRemaining = Math.max(0, Number(currentWeapon.cooldown || 0) - (stamp - lastWeaponFireAtMs));
        if (cooldownRemaining > 0) {
            return {
                status: 'cooldown',
                ready: false,
                pct: currentWeapon.cooldown > 0 ? (1 - (cooldownRemaining / currentWeapon.cooldown)) : 1
            };
        }
        if (currentWeapon.reloadedFlashRemaining > 0) {
            return {
                status: 'reloaded',
                ready: true,
                pct: 1,
                phase: currentWeapon.reloadPhase
            };
        }
        return {
            status: 'ready',
            ready: true,
            pct: 1,
            phase: 'ready'
        };
    }

    function applyWeaponLoadout(nextLoadout, preferredWeaponId) {
        weaponLoadout = sanitizeWeaponLoadout(nextLoadout);
        var preferred = String(preferredWeaponId || '');
        if (preferred && isKnownWeaponId(preferred) && weaponLoadout.indexOf(preferred) !== -1) {
            equippedWeaponId = preferred;
        } else if (weaponLoadout.indexOf(equippedWeaponId) === -1) {
            equippedWeaponId = weaponLoadout[0];
        }
        if (!isKnownWeaponId(equippedWeaponId)) {
            equippedWeaponId = weaponLoadout[0] || 'rifle';
        }
        return {
            slots: weaponLoadout.slice()
        };
    }

    function clearPredictedMultiplayerWeapon() {
        predictedMultiplayerWeaponId = '';
        predictedMultiplayerWeaponUntil = 0;
    }

    function clearPredictedMultiplayerReload(weaponId) {
        var id = String(weaponId || '');
        if (!id) return;
        delete predictedMultiplayerReloadUntilByWeapon[id];
    }

    function readPredictedMultiplayerReloadUntil(weaponId, now) {
        var id = String(weaponId || '');
        if (!id) return 0;
        var stamp = weaponTimeMs(now);
        var predictedUntil = Math.max(0, Number(predictedMultiplayerReloadUntilByWeapon[id] || 0));
        if (predictedUntil > 0 && predictedUntil <= stamp) {
            clearPredictedMultiplayerReload(id);
            return 0;
        }
        return predictedUntil;
    }

    function rememberPredictedMultiplayerReload(weaponId, now, reloadMs) {
        if (!isMultiplayer()) {
            clearPredictedMultiplayerReload(weaponId);
            return;
        }
        var id = String(weaponId || '');
        if (!id) return;
        predictedMultiplayerReloadUntilByWeapon[id] = weaponTimeMs(now) + Math.max(0, Number(reloadMs || 0)) + 250;
    }

    function rememberPredictedMultiplayerWeapon(weaponId) {
        if (!isMultiplayer()) {
            clearPredictedMultiplayerWeapon();
            return;
        }
        predictedMultiplayerWeaponId = String(weaponId || '');
        predictedMultiplayerWeaponUntil = nowMs() + MULTIPLAYER_WEAPON_PREDICTION_GRACE_MS;
    }

    function resolveMultiplayerWeaponPreference(authoritativeWeaponId) {
        var authoritativeId = String(authoritativeWeaponId || '');
        var predictedId = String(predictedMultiplayerWeaponId || '');
        var wallNow = nowMs();

        if (!isMultiplayer()) {
            clearPredictedMultiplayerWeapon();
            return authoritativeId;
        }
        if (!predictedId) return authoritativeId;
        if (!isKnownWeaponId(predictedId) || weaponLoadout.indexOf(predictedId) === -1) {
            clearPredictedMultiplayerWeapon();
            return authoritativeId;
        }
        if (authoritativeId && authoritativeId === predictedId) {
            if (predictedMultiplayerWeaponUntil <= wallNow) {
                clearPredictedMultiplayerWeapon();
            }
            return predictedId;
        }
        if (predictedMultiplayerWeaponUntil > wallNow) {
            return predictedId;
        }
        clearPredictedMultiplayerWeapon();
        return authoritativeId;
    }

    function equipWeapon(weaponId) {
        var id = String(weaponId || '');
        if (!isKnownWeaponId(id) || weaponLoadout.indexOf(id) === -1) return null;
        equippedWeaponId = id;
        rememberPredictedMultiplayerWeapon(id);
        return buildWeaponState(equippedWeaponId);
    }

    function beginWeaponReload(weaponId, now) {
        var id = String(weaponId || '');
        var stats = getWeaponStats(id);
        var stamp = weaponTimeMs(now);
        if (!stats) return false;
        if (Number(stats.magazineSize || 0) <= 0 || Number(stats.reloadMs || 0) <= 0) return false;
        var state = syncWeaponAmmoState(id, stamp);
        if (!state || Number(state.reloadUntil || 0) > stamp) return false;
        if (Number(state.ammoInMag || 0) >= Math.max(0, Number(stats.magazineSize || 0))) return false;
        state.ammoInMag = 0;
        state.reloadUntil = stamp + Math.max(0, Number(stats.reloadMs || 0));
        state.reloadedFlashUntil = 0;
        rememberPredictedMultiplayerReload(id, stamp, stats.reloadMs);
        return true;
    }

    function recordWeaponFire(weaponId, now) {
        var id = String(weaponId || equippedWeaponId || '');
        var stats = getWeaponStats(id);
        var stamp = weaponTimeMs(now);
        lastWeaponFireAtMs = stamp;
        if (!stats || Number(stats.magazineSize || 0) <= 0) {
            return buildWeaponState(id, stamp);
        }
        var state = syncWeaponAmmoState(id, stamp);
        if (!state) return buildWeaponState(id, stamp);
        state.ammoInMag = Math.max(0, Number(state.ammoInMag || stats.magazineSize || 0) - 1);
        state.reloadedFlashUntil = 0;
        if (state.ammoInMag <= 0) {
            beginWeaponReload(id, stamp);
        }
        return buildWeaponState(id, stamp);
    }

    function syncWeaponState(selfState, now) {
        if (!selfState || typeof selfState !== 'object') return getCurrentWeaponState(now);
        var stamp = weaponTimeMs(now);
        var hasLoadout = Array.isArray(selfState.weaponLoadout);
        var authoritativeWeaponId = (selfState.weaponId && isKnownWeaponId(selfState.weaponId))
            ? String(selfState.weaponId || '')
            : '';
        var preferredWeaponId = isMultiplayer()
            ? resolveMultiplayerWeaponPreference(authoritativeWeaponId)
            : authoritativeWeaponId;
        if (hasLoadout) {
            applyWeaponLoadout(selfState.weaponLoadout, preferredWeaponId || equippedWeaponId);
        } else if (preferredWeaponId) {
            equippedWeaponId = preferredWeaponId;
        }
        if (selfState.weaponAmmo && typeof selfState.weaponAmmo === 'object') {
            syncAmmoStateFromSnapshot(selfState.weaponAmmo, stamp);
        }
        if (hasLoadout && weaponLoadout.indexOf(equippedWeaponId) === -1) {
            equippedWeaponId = weaponLoadout[0] || equippedWeaponId || 'rifle';
        }
        return getCurrentWeaponState(stamp);
    }

    function getCurrentWeaponState(now) {
        return buildWeaponState(equippedWeaponId, now);
    }

    function localInvulnerableUntil(now) {
        if (respawnInvulnTimer <= 0) return 0;
        return Number(now || nowMs()) + (respawnInvulnTimer * 1000);
    }

    function effectiveSpawnShieldUntil(now) {
        return Math.max(
            authoritativeSpawnShieldUntil,
            localInvulnerableUntil(now)
        );
    }

    function clearRespawnCountdown() {
        respawnAtMs = 0;
    }

    function setAlive(alive) {
        playerAlive = alive !== false;
        if (playerAlive) clearRespawnCountdown();
    }

    function buildState(now) {
        var stamp = Number(now || nowMs());
        var spawnShieldUntil = effectiveSpawnShieldUntil(stamp);
        var respawnActive = !playerAlive && respawnAtMs > 0;
        return {
            hp: playerHP,
            hpMax: playerMaxHP,
            armor: playerArmor,
            armorMax: playerArmorMax,
            stocksRemaining: stocksRemaining,
            maxStocks: maxStocks,
            bonusLivesEarned: bonusLivesEarned,
            extraLifeProgressPct: extraLifeProgressPct,
            eliminated: eliminated,
            alive: playerAlive,
            invulnerable: spawnShieldUntil > stamp,
            spawnShieldUntil: spawnShieldUntil,
            respawn: respawnActive
                ? {
                    active: true,
                    respawnAt: respawnAtMs,
                    remainingMs: Math.max(0, respawnAtMs - stamp)
                }
                : null
        };
    }

    function init(opts) {
        if (opts) {
            if (typeof opts.isPlaying === 'function') _isPlayingFn = opts.isPlaying;
            if (typeof opts.isMultiplayer === 'function') _isMultiplayerFn = opts.isMultiplayer;
        }
        DEFAULT_ARMOR_REGEN_DELAY = defaultArmorRegenDelay();
        ARMOR_REGEN_PER_SEC = defaultArmorRegenPerSec();
        playerMaxHP = defaultPlayerHp();
        playerArmorMax = defaultPlayerArmor();
        playerHP = playerMaxHP;
        playerArmor = playerArmorMax;
        playerAlive = true;
        armorRegenDelay = 0;
        respawnInvulnTimer = 0;
        authoritativeSpawnShieldUntil = 0;
        respawnAtMs = 0;
        stocksRemaining = 3;
        maxStocks = 5;
        bonusLivesEarned = 0;
        extraLifeProgressPct = 0;
        eliminated = false;
        weaponAmmo = {};
        lastWeaponFireAtMs = 0;
        clearPredictedMultiplayerWeapon();
        predictedMultiplayerReloadUntilByWeapon = {};
        applyWeaponLoadout(defaultWeaponLoadout(), '');
    }

    function consumeDamage(rawDamage, hitType, attackerEnemy) {
        if (effectiveSpawnShieldUntil(nowMs()) > nowMs() || !isPlaying()) return;

        var damage = Math.max(1, Math.round(rawDamage));
        var playerTarget = { hp: playerHP, armor: playerArmor, armorMax: playerArmorMax, armorRegenDelay: armorRegenDelay };
        var sharedDamageMod = sharedDamageApi();
        if (sharedDamageMod && sharedDamageMod.applyDamage) {
            var result = sharedDamageMod.applyDamage(playerTarget, damage);
            playerHP = playerTarget.hp;
            playerArmor = playerTarget.armor;
            armorRegenDelay = playerTarget.armorRegenDelay;
            if (result.hpLost > 0 && RT.GameAudio && RT.GameAudio.play) {
                RT.GameAudio.play('playerHit');
            }
        } else {
            armorRegenDelay = DEFAULT_ARMOR_REGEN_DELAY;
            if (playerArmor > 0) {
                var absorbed = Math.min(playerArmor, damage);
                playerArmor -= absorbed;
                damage -= absorbed;
            }
            if (damage > 0) {
                playerHP -= damage;
                if (RT.GameAudio && RT.GameAudio.play) {
                    RT.GameAudio.play('playerHit');
                }
            }
        }

        if (attackerEnemy && attackerEnemy.group && attackerEnemy.group.position) {
            var playerPos = RT.GamePlayer.getPosition(playerDamagePosScratch);
            var rot = RT.GamePlayer.getRotation();
            RT.GameUI.showDirectionalDamage(
                attackerEnemy.group.position,
                playerPos,
                rot && typeof rot.yaw === 'number' ? rot.yaw : 0,
                rawDamage
            );
        }

        if (RT.GameEvents) {
            RT.GameEvents.emit(RT.GameEvents.PLAYER_DAMAGED, {
                damage: damage,
                hitType: hitType,
                hp: playerHP,
                armor: playerArmor
            });
        }

        if (playerHP <= 0) {
            if (RT.GameAbilities && RT.GameAbilities.clearTransientState) {
                RT.GameAbilities.clearTransientState();
            }
            if (!isMultiplayer() && RT.GameLocalMatch && RT.GameLocalMatch.isActive && RT.GameLocalMatch.isActive()) {
                var localDeath = RT.GameLocalMatch.onSelfKilled ? RT.GameLocalMatch.onSelfKilled(attackerEnemy || null) : null;
                if (localDeath && (localDeath.useManagedRespawn || localDeath.suppressDefaultRespawn)) {
                    setAlive(false);
                    clearRespawnCountdown();
                    return;
                }
            }
            respawn();
            return;
        }
    }

    function respawn() {
        if (RT.GameAbilities && RT.GameAbilities.clearTransientState) {
            RT.GameAbilities.clearTransientState();
        }
        playerHP = playerMaxHP;
        setAlive(true);
        if (!isMultiplayer()) {
            playerArmor = playerArmorMax;
        }
        armorRegenDelay = 0;
        authoritativeSpawnShieldUntil = 0;

        if (!isMultiplayer()) {
            RT.GamePlayer.respawnRandom();
            respawnInvulnTimer = Math.max(0, Number(sharedCombatTimings().PLAYER_SPAWN_SHIELD_MS || 0)) / 1000;
        }

        RT.GameUI.updateDamageEffects(5);
        RT.GameUI.updateAbilityInfo(RT.GameAbilities.getHudState());
    }

    function applyArmorProfile(armorMax) {
        armorMax = Math.max(1, armorMax || defaultPlayerArmor());
        playerArmorMax = armorMax;
        if (playerArmor > playerArmorMax) playerArmor = playerArmorMax;
        if (playerArmor < 0) playerArmor = 0;
    }

    function tickArmorRegen(dt) {
        if (isMultiplayer()) return;
        var regenTarget = { armor: playerArmor, armorMax: playerArmorMax, armorRegenDelay: armorRegenDelay };
        var sharedDamageMod = sharedDamageApi();
        if (sharedDamageMod && sharedDamageMod.tickArmorRegen) {
            sharedDamageMod.tickArmorRegen(regenTarget, dt);
        } else {
            if (regenTarget.armorRegenDelay > 0) {
                regenTarget.armorRegenDelay -= dt;
                if (regenTarget.armorRegenDelay < 0) regenTarget.armorRegenDelay = 0;
            } else if (regenTarget.armor < regenTarget.armorMax) {
                regenTarget.armor += ARMOR_REGEN_PER_SEC * dt;
                if (regenTarget.armor > regenTarget.armorMax) regenTarget.armor = regenTarget.armorMax;
            }
        }
        playerArmor = regenTarget.armor;
        armorRegenDelay = regenTarget.armorRegenDelay;
    }

    function syncAuthoritativeState(selfState) {
        if (!selfState) return;
        playerMaxHP = clampNumber(selfState.hpMax, playerMaxHP, 1);
        playerHP = clampNumber(selfState.hp, playerHP, 0, playerMaxHP);
        playerArmorMax = clampNumber(selfState.armorMax, playerArmorMax, 1);
        playerArmor = clampNumber(selfState.armor, playerArmor, 0, playerArmorMax);
        stocksRemaining = Math.max(0, clampNumber(selfState.stocksRemaining, stocksRemaining, 0));
        maxStocks = Math.max(stocksRemaining, clampNumber(selfState.maxStocks, maxStocks, 1));
        bonusLivesEarned = Math.max(0, clampNumber(selfState.bonusLivesEarned, bonusLivesEarned, 0));
        extraLifeProgressPct = Math.max(0, Math.min(100, clampNumber(selfState.extraLifeProgressPct, extraLifeProgressPct, 0, 100)));
        eliminated = !!selfState.eliminated;
        setAlive(selfState.alive !== false);
        authoritativeSpawnShieldUntil = clampNumber(
            selfState.spawnShieldUntil,
            authoritativeSpawnShieldUntil,
            0
        );
    }

    function syncRespawnState(respawnState) {
        if (playerAlive) {
            clearRespawnCountdown();
            return;
        }
        if (respawnState && respawnState.active) {
            respawnAtMs = clampNumber(respawnState.respawnAt, respawnAtMs, 0);
            return;
        }
        if (respawnAtMs > 0) return;
        clearRespawnCountdown();
    }

    function syncFromNetwork(selfState, options) {
        syncAuthoritativeState(selfState);
        if (!options || options.skipWeaponSync !== true) {
            syncWeaponState(selfState, options && options.weaponNow);
        }
        var respawnState = options && Object.prototype.hasOwnProperty.call(options, 'respawnState')
            ? options.respawnState
            : null;
        syncRespawnState(respawnState);
    }

    function showIncomingFeedback(sourcePos, rawDamage, hitType) {
        if (RT.GameAudio && RT.GameAudio.play) {
            RT.GameAudio.play('playerHit');
        }
        if (sourcePos && RT.GamePlayer && RT.GamePlayer.getPosition && RT.GamePlayer.getRotation) {
            var playerPos = RT.GamePlayer.getPosition(playerDamagePosScratch);
            var rot = RT.GamePlayer.getRotation();
            RT.GameUI.showDirectionalDamage(
                sourcePos,
                playerPos,
                rot && typeof rot.yaw === 'number' ? rot.yaw : 0,
                rawDamage
            );
        }
    }

    RT.GamePlayerCombat = {
        init: init,
        getState: function (now) { return buildState(now); },
        getRespawnState: function (now) { return buildState(now).respawn; },
        getHP: function () { return playerHP; },
        getMaxHP: function () { return playerMaxHP; },
        getArmor: function () { return playerArmor; },
        getArmorMax: function () { return playerArmorMax; },
        getStocksRemaining: function () { return stocksRemaining; },
        getMaxStocks: function () { return maxStocks; },
        getBonusLivesEarned: function () { return bonusLivesEarned; },
        getExtraLifeProgressPct: function () { return extraLifeProgressPct; },
        isEliminated: function () { return eliminated; },
        isAlive: function () { return playerAlive; },
        setHP: function (hp) { playerHP = hp; },
        setMaxHP: function (hp) { playerMaxHP = hp; },
        setArmor: function (armor) { playerArmor = armor; },
        setArmorMax: function (armorMax) { playerArmorMax = armorMax; },
        consumeDamage: consumeDamage,
        respawn: respawn,
        applyArmorProfile: applyArmorProfile,
        showIncomingFeedback: showIncomingFeedback,
        tickArmorRegen: tickArmorRegen,
        syncAuthoritativeState: syncAuthoritativeState,
        syncRespawnState: syncRespawnState,
        syncWeaponState: syncWeaponState,
        getCurrentWeaponState: function (now) { return getCurrentWeaponState(now); },
        getWeaponState: function (weaponId, now) { return buildWeaponState(weaponId, now); },
        getWeaponHudState: function (now) { return buildWeaponHudState(now); },
        getWeaponLoadout: function () { return { slots: weaponLoadout.slice() }; },
        setWeaponLoadout: function (loadoutConfig) {
            var slots = Array.isArray(loadoutConfig)
                ? loadoutConfig
                : (loadoutConfig && Array.isArray(loadoutConfig.slots) ? loadoutConfig.slots : null);
            if (!slots) return { slots: weaponLoadout.slice() };
            return applyWeaponLoadout(slots);
        },
        getEquippedWeaponId: function () { return equippedWeaponId; },
        equipWeapon: equipWeapon,
        equipSlot: function (slotIndex) {
            var idx = Math.max(0, Math.floor(slotIndex || 0));
            if (idx >= weaponLoadout.length) return null;
            return equipWeapon(weaponLoadout[idx]);
        },
        beginWeaponReload: beginWeaponReload,
        recordWeaponFire: recordWeaponFire,
        getCooldownRemaining: function (now) {
            var currentWeapon = getCurrentWeaponState(now);
            if (!currentWeapon) return 0;
            return Math.max(0, Number(currentWeapon.cooldown || 0) - (weaponTimeMs(now) - lastWeaponFireAtMs));
        },
        isWeaponReloading: function (weaponId, now) {
            var state = buildWeaponState(weaponId || equippedWeaponId, now);
            return !!(state && state.reloading);
        },
        isInvulnerable: function () { return effectiveSpawnShieldUntil(nowMs()) > nowMs(); },
        canUseGameplayActions: function (now) {
            var state = buildState(now);
            return !!state.alive && !(state.respawn && state.respawn.active);
        },
        setInvulnTimer: function (t) { respawnInvulnTimer = Math.max(0, t); },
        tickInvulnTimer: function (dt) {
            if (respawnInvulnTimer > 0) {
                respawnInvulnTimer -= dt;
                if (respawnInvulnTimer < 0) respawnInvulnTimer = 0;
            }
        },
        syncFromNetwork: syncFromNetwork
    };
})();
