/**
 * abilities.js - Player ability runtime with a single equipped ability
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAbilities
 */
(function () {
    'use strict';

    var GameAbilities = {};

    var equippedAbilityId = normalizeAbilityId(defaultAbilityId());
    var cooldownUntil = 0;
    var debugMode = false;
    var hasExplicitLoadoutSelection = false;
    var localSimApi = null;
    var abilityTuningFields = {
        choke: {
            range: 'chokeRange',
            lockBoxPx: 'chokeLockBoxPx',
            targetTolerance: 'chokeTargetTolerance',
            castDamage: 'chokeCastDamage',
            duration: 'chokeDuration'
        },
        hook: {
            range: 'hookRange',
            lockBoxPx: 'hookLockBoxPx',
            reticleRadiusPx: 'hookReticleRadiusPx',
            castDamage: 'hookCastDamage',
            stunDuration: 'hookStunDuration',
            pullDistance: 'hookPullDistance',
            catchRadius: 'hookCatchRadius',
            travelSpeed: 'hookTravelSpeed',
            pullSpeed: 'hookPullSpeed'
        },
        missile: {
            range: 'missileRange',
            damage: 'missileDamage',
            radius: 'missileRadius',
            travelSpeed: 'missileTravelSpeed',
            acquireRange: 'missileAcquireRange',
            catchRadius: 'missileCatchRadius',
            lockHalfAngleDeg: 'missileLockHalfAngleDeg',
            homingBoost: 'missileHomingBoost',
            homingLerp: 'missileHomingLerp'
        },
        deadeye: {
            range: 'deadeyeLockRange',
            duration: 'deadeyeDuration',
            maxTargets: 'deadeyeMaxTargets',
            damage: 'deadeyeDamage'
        }
    };

    function nowMs() {
        return Date.now();
    }

    function sharedApi() {
        return globalThis.__MAYHEM_RUNTIME.GameShared || null;
    }

    function defaultAbilityId() {
        var shared = sharedApi();
        if (shared && typeof shared.getDefaultAbilityId === 'function') {
            return String(shared.getDefaultAbilityId() || '');
        }
        var tuning = shared && shared.gameplayTuning ? shared.gameplayTuning : null;
        return String(tuning && tuning.defaultAbilityId || '');
    }

    function normalizeAbilityId(abilityId) {
        var shared = sharedApi();
        if (shared && typeof shared.normalizeAbilityId === 'function') {
            return String(shared.normalizeAbilityId(abilityId) || defaultAbilityId());
        }
        return String(abilityId || defaultAbilityId() || '');
    }

    function classProfileDefaults() {
        var shared = sharedApi();
        var tuningPreset = (((shared && shared.gameplayTuning) || {}).classPresets || {}).abilities;
        var preset = tuningPreset || (shared && typeof shared.getClassPreset === 'function'
            ? shared.getClassPreset('abilities')
            : null);
        return {
            armorMax: Math.max(0, Number(preset && preset.armorMax || 0)),
            wallhackRadius: Math.max(0, Number(preset && preset.wallhackRadius || 0)),
            loadoutWeapon: String(preset && preset.loadoutWeapon || 'rifle')
        };
    }

    function abilityBoundary() {
        return globalThis.__MAYHEM_RUNTIME.GameAbilityBoundary || null;
    }

    function cooldownSec(until) {
        return Math.max(0, (Number(until || 0) - nowMs()) / 1000);
    }

    function buildLoadoutState() {
        var boundary = abilityBoundary();
        return boundary && boundary.buildLoadoutState
            ? boundary.buildLoadoutState({ abilityId: equippedAbilityId })
            : {
                abilityId: equippedAbilityId,
                activeAbility: equippedAbilityId
            };
    }

    function getAbilityId() {
        return String(equippedAbilityId || '');
    }

    function getCooldownUntil() {
        return Number(cooldownUntil || 0);
    }

    function setCooldownUntil(until) {
        cooldownUntil = Number(until || 0);
    }

    function resetCooldown() {
        cooldownUntil = 0;
    }

    function clearTransientStates() {
        var localSim = ensureLocalSim();
        if (localSim && localSim.clearTransientState) localSim.clearTransientState();
    }

    function resetAbilityRuntimeState() {
        resetCooldown();
        clearTransientStates();
    }

    function getCatalog() {
        var boundary = abilityBoundary();
        return boundary && boundary.getCatalog ? boundary.getCatalog() : {};
    }

    function getConfigForAbility(abilityId) {
        var boundary = abilityBoundary();
        return boundary && boundary.getConfigForAbility
            ? boundary.getConfigForAbility(abilityId, abilityTuningFields)
            : null;
    }

    function getChokeRectSize(camera, cfg) {
        var boundary = abilityBoundary();
        return boundary && boundary.getChokeRectSize
            ? boundary.getChokeRectSize(camera, cfg)
            : { width: 216, height: 180 };
    }

    function ensureLocalSim() {
        if (localSimApi) return localSimApi;
        var helper = globalThis.__MAYHEM_RUNTIME.GameAbilityLocalSim || null;
        if (!helper || !helper.create) return null;
        localSimApi = helper.create({
            cooldownUntil: getCooldownUntil,
            getAbilityId: getAbilityId,
            getChokeRectSize: getChokeRectSize,
            getConfigForAbility: getConfigForAbility,
            isDebugMode: function () { return debugMode; },
            setCooldownUntil: setCooldownUntil
        });
        return localSimApi;
    }

    function localSimSnapshot() {
        var localSim = ensureLocalSim();
        return localSim && localSim.getSnapshot ? localSim.getSnapshot() : null;
    }

    GameAbilities.init = function (_scene) {
        ensureLocalSim();
        resetAbilityRuntimeState();

        if (!hasExplicitLoadoutSelection) {
            equippedAbilityId = normalizeAbilityId(defaultAbilityId());
        }
    };

    GameAbilities.getCatalog = function () {
        var boundary = abilityBoundary();
        return boundary && boundary.buildCatalogList ? boundary.buildCatalogList() : [];
    };

    GameAbilities.getLoadout = function () {
        return buildLoadoutState();
    };

    GameAbilities.getAbilityId = function () {
        return getAbilityId();
    };

    GameAbilities.setLoadout = function (abilityId) {
        var catalog = getCatalog();
        var id = abilityId && catalog[abilityId] ? String(abilityId) : '';
        if (id) {
            equippedAbilityId = normalizeAbilityId(id);
            hasExplicitLoadoutSelection = true;
        }
        resetAbilityRuntimeState();
        return buildLoadoutState();
    };

    GameAbilities.setLoadoutSlot = function (_slotIndex, abilityId) {
        return GameAbilities.setLoadout(abilityId);
    };

    GameAbilities.getHudState = function () {
        var boundary = abilityBoundary();
        var snapshot = localSimSnapshot();
        return boundary && boundary.buildHudState
            ? boundary.buildHudState({ abilityId: equippedAbilityId }, cooldownUntil, snapshot ? snapshot.deadeyeState : null, nowMs())
            : { name: 'Ability', abilityName: '', cooldown: 0, extra: '' };
    };

    GameAbilities.getNetworkHudState = function (abilityState) {
        var boundary = abilityBoundary();
        return boundary && boundary.buildNetworkHudState
            ? boundary.buildNetworkHudState({ abilityId: equippedAbilityId }, abilityState)
            : { name: 'Ability', abilityName: '', cooldown: 0, extra: '' };
    };

    GameAbilities.setClass = function (_id) {
        var profileDefaults = classProfileDefaults();
        return {
            id: 'abilities',
            name: 'Abilities',
            armorMax: profileDefaults.armorMax,
            wallhackRadius: profileDefaults.wallhackRadius,
            loadoutWeapon: profileDefaults.loadoutWeapon
        };
    };

    GameAbilities.getArmorMax = function () {
        return classProfileDefaults().armorMax;
    };

    GameAbilities.getWallhackRadius = function () {
        return classProfileDefaults().wallhackRadius;
    };

    GameAbilities.triggerAbility = function (cameraOrSlot, playerPosOrCamera, rotationOrPlayerPos, onEnemyHitOrRotation, notifierOrOnEnemyHit, maybeNotifier) {
        var camera = cameraOrSlot;
        var playerPos = playerPosOrCamera;
        var rotation = rotationOrPlayerPos;
        var onEnemyHit = onEnemyHitOrRotation;
        var notifier = notifierOrOnEnemyHit;
        if (typeof cameraOrSlot === 'number') {
            camera = playerPosOrCamera;
            playerPos = rotationOrPlayerPos;
            rotation = onEnemyHitOrRotation;
            onEnemyHit = notifierOrOnEnemyHit;
            notifier = maybeNotifier;
        }
        var localSim = ensureLocalSim();
        return localSim && localSim.triggerAbility
            ? localSim.triggerAbility(camera, playerPos, rotation, onEnemyHit, notifier)
            : { ok: false, message: 'Local ability sim unavailable.' };
    };

    GameAbilities.prepareNetCast = function (cameraOrSlot, maybeCamera) {
        var camera = typeof cameraOrSlot === 'number' ? maybeCamera : cameraOrSlot;
        var abilityId = getAbilityId();
        var boundary = abilityBoundary();
        return boundary && boundary.prepareNetCast
            ? boundary.prepareNetCast(abilityId, camera, {
                getConfigForAbility: getConfigForAbility
            })
            : { ok: false, abilityId: abilityId, message: 'Ability boundary unavailable.' };
    };

    GameAbilities.update = function (_dt, camera, _playerPos, _rotation, onEnemyHit, notifier) {
        var localSim = ensureLocalSim();
        if (localSim && localSim.update) {
            localSim.update(camera, onEnemyHit, notifier);
        }
    };

    GameAbilities.setDebugMode = function (enabled) {
        debugMode = !!enabled;
    };

    GameAbilities.isDeadeyeActive = function () {
        var snapshot = localSimSnapshot();
        return !!(snapshot && snapshot.deadeyeActive);
    };

    GameAbilities.getDeadeyeState = function () {
        var boundary = abilityBoundary();
        var snapshot = localSimSnapshot();
        return boundary && boundary.buildDeadeyeUiState
            ? boundary.buildDeadeyeUiState(snapshot ? snapshot.deadeyeState : null, nowMs())
            : null;
    };

    GameAbilities.getChokeRectSize = function (camera) {
        return getChokeRectSize(camera, getConfigForAbility('choke') || null);
    };

    GameAbilities.getHookState = function () {
        var snapshot = localSimSnapshot();
        return snapshot ? snapshot.hookState : null;
    };

    GameAbilities.getChokeState = function () {
        var snapshot = localSimSnapshot();
        return snapshot ? snapshot.chokeState : null;
    };

    GameAbilities.clearTransientState = function () {
        clearTransientStates();
    };

    GameAbilities.debugDump = function () {
        var snapshot = localSimSnapshot();
        var deadeyeState = snapshot ? snapshot.deadeyeState : null;
        return {
            abilityId: equippedAbilityId,
            cooldown: cooldownSec(getCooldownUntil()),
            deadeye: deadeyeState ? {
                lockCount: deadeyeState.lockCount,
                targetCount: deadeyeState.targets.length
            } : null
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameAbilities = GameAbilities;
})();
