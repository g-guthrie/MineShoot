/**
 * abilities.js - Player ability runtime with mix-and-match loadout
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAbilities
 */
(function () {
    'use strict';

    var GameAbilities = {};

    var DEFAULT_ABILITY_LOADOUT = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.getDefaultAbilityLoadout)
        ? globalThis.__MAYHEM_RUNTIME.GameShared.getDefaultAbilityLoadout()
        : { slot1: 'choke', slot2: 'missile' };
    var abilityLoadout = cloneLoadout(DEFAULT_ABILITY_LOADOUT);
    var cooldownUntilBySlot = { slot1: 0, slot2: 0 };
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
            travelSpeed: 'hookTravelSpeed'
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
        heal: {
            duration: 'healDuration',
            healAmount: 'healAmount'
        },
        deadeye: {
            range: 'deadeyeLockRange',
            duration: 'deadeyeDuration',
            maxTargets: 'deadeyeMaxTargets',
            damage: 'deadeyeDamage'
        }
    };

    var profileDefaults = {
        armorMax: 90,
        wallhackRadius: 90,
        loadoutWeapon: 'rifle'
    };

    function nowMs() {
        return Date.now();
    }

    function abilityBoundary() {
        return globalThis.__MAYHEM_RUNTIME.GameAbilityBoundary || null;
    }

    function cooldownSec(until) {
        return Math.max(0, (Number(until || 0) - nowMs()) / 1000);
    }

    function cloneLoadout(loadout) {
        return {
            slot1: loadout && loadout.slot1 ? loadout.slot1 : DEFAULT_ABILITY_LOADOUT.slot1,
            slot2: loadout && loadout.slot2 ? loadout.slot2 : DEFAULT_ABILITY_LOADOUT.slot2
        };
    }

    function normalizedLoadout(slot1, slot2) {
        var shared = globalThis.__MAYHEM_RUNTIME.GameShared || null;
        if (shared && typeof shared.normalizeAbilityLoadout === 'function') {
            return shared.normalizeAbilityLoadout(slot1, slot2);
        }
        return cloneLoadout({ slot1: slot1, slot2: slot2 });
    }

    function slotKeyForIndex(slotIndex) {
        return Number(slotIndex) === 2 ? 'slot2' : 'slot1';
    }

    function buildLoadoutState() {
        var boundary = abilityBoundary();
        return boundary && boundary.buildLoadoutState
            ? boundary.buildLoadoutState(abilityLoadout)
            : {
                slot1: abilityLoadout.slot1,
                slot2: abilityLoadout.slot2,
                activeAbility: abilityLoadout.slot1
            };
    }

    function getAbilityIdForSlot(slotIndex) {
        return abilityLoadout[slotKeyForIndex(slotIndex)] || '';
    }

    function cooldownUntilForSlot(slotIndex) {
        return cooldownUntilBySlot[slotKeyForIndex(slotIndex)] || 0;
    }

    function setCooldownForSlot(slotIndex, until) {
        cooldownUntilBySlot[slotKeyForIndex(slotIndex)] = Number(until || 0);
    }

    function resetCooldowns() {
        cooldownUntilBySlot.slot1 = 0;
        cooldownUntilBySlot.slot2 = 0;
    }

    function clearTransientStates() {
        var localSim = ensureLocalSim();
        if (localSim && localSim.clearTransientState) localSim.clearTransientState();
    }

    function resetAbilityRuntimeState() {
        resetCooldowns();
        clearTransientStates();
    }

    function getCatalog() {
        var boundary = abilityBoundary();
        return boundary && boundary.getCatalog ? boundary.getCatalog() : {};
    }

    function getAbilityDef(abilityId) {
        var boundary = abilityBoundary();
        return boundary && boundary.getAbilityDef ? boundary.getAbilityDef(abilityId) : null;
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
            cooldownUntilForSlot: cooldownUntilForSlot,
            getAbilityIdForSlot: getAbilityIdForSlot,
            getChokeRectSize: getChokeRectSize,
            getConfigForAbility: getConfigForAbility,
            isDebugMode: function () { return debugMode; },
            setCooldownForSlot: setCooldownForSlot,
            slotKeyForIndex: slotKeyForIndex
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

        var shared = globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.gameplayTuning;
        if (!hasExplicitLoadoutSelection && shared && shared.defaultAbilityLoadout) {
            abilityLoadout = normalizedLoadout(shared.defaultAbilityLoadout.slot1, shared.defaultAbilityLoadout.slot2);
        }
    };

    GameAbilities.getCatalog = function () {
        var boundary = abilityBoundary();
        return boundary && boundary.buildCatalogList ? boundary.buildCatalogList() : [];
    };

    GameAbilities.getLoadout = function () {
        return buildLoadoutState();
    };

    GameAbilities.setLoadoutSlot = function (slotIndex, abilityId) {
        var catalog = getCatalog();
        var id = abilityId && catalog[abilityId] ? abilityId : '';
        if (!id) {
            return GameAbilities.getLoadout();
        }
        var ownKey = slotKeyForIndex(slotIndex);
        var nextSlot1 = ownKey === 'slot1' ? id : abilityLoadout.slot1;
        var nextSlot2 = ownKey === 'slot2' ? id : abilityLoadout.slot2;
        abilityLoadout = normalizedLoadout(nextSlot1, nextSlot2);
        hasExplicitLoadoutSelection = true;
        resetAbilityRuntimeState();
        return buildLoadoutState();
    };

    GameAbilities.setLoadout = function (slot1OrActive, slot2) {
        var catalog = getCatalog();
        var firstId = slot1OrActive && catalog[slot1OrActive] ? slot1OrActive : '';
        var secondId = slot2 && catalog[slot2] ? slot2 : '';
        if (firstId || secondId) {
            abilityLoadout = normalizedLoadout(
                firstId || abilityLoadout.slot1,
                secondId || abilityLoadout.slot2
            );
            hasExplicitLoadoutSelection = true;
        }
        resetAbilityRuntimeState();
        return buildLoadoutState();
    };

    GameAbilities.getHudState = function () {
        var boundary = abilityBoundary();
        var snapshot = localSimSnapshot();
        return boundary && boundary.buildHudState
            ? boundary.buildHudState(abilityLoadout, cooldownUntilBySlot, snapshot ? snapshot.deadeyeState : null, nowMs())
            : { name: 'Abilities', slot1Name: '', slot1Cooldown: 0, slot2Name: '', slot2Cooldown: 0, extra: '' };
    };

    GameAbilities.getNetworkHudState = function (abilityState) {
        var boundary = abilityBoundary();
        return boundary && boundary.buildNetworkHudState
            ? boundary.buildNetworkHudState(abilityLoadout, abilityState)
            : { name: 'Abilities', slot1Name: '', slot1Cooldown: 0, slot2Name: '', slot2Cooldown: 0, extra: '' };
    };

    GameAbilities.setClass = function (_id) {
        return {
            id: 'abilities',
            name: 'Abilities',
            armorMax: profileDefaults.armorMax,
            wallhackRadius: profileDefaults.wallhackRadius,
            loadoutWeapon: profileDefaults.loadoutWeapon
        };
    };

    GameAbilities.getArmorMax = function () {
        return profileDefaults.armorMax;
    };

    GameAbilities.getWallhackRadius = function () {
        return profileDefaults.wallhackRadius;
    };

    GameAbilities.triggerAbility = function (slot, camera, _playerPos, _rotation, onEnemyHit, notifier) {
        var localSim = ensureLocalSim();
        return localSim && localSim.triggerAbility
            ? localSim.triggerAbility(slot, camera, _playerPos, _rotation, onEnemyHit, notifier)
            : { ok: false, message: 'Local ability sim unavailable.' };
    };

    GameAbilities.prepareNetCast = function (slot, camera) {
        var castSlot = Number(slot) === 2 ? 2 : 1;
        var abilityId = getAbilityIdForSlot(castSlot);
        var boundary = abilityBoundary();
        return boundary && boundary.prepareNetCast
            ? boundary.prepareNetCast(castSlot, abilityId, camera, {
                getConfigForAbility: getConfigForAbility
            })
            : { ok: false, slot: castSlot, abilityId: abilityId, message: 'Ability boundary unavailable.' };
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

    GameAbilities.getHealState = function () {
        var snapshot = localSimSnapshot();
        return snapshot ? snapshot.healState : null;
    };

    GameAbilities.clearTransientState = function () {
        clearTransientStates();
    };

    GameAbilities.debugDump = function () {
        var snapshot = localSimSnapshot();
        var deadeyeState = snapshot ? snapshot.deadeyeState : null;
        return {
            debugMode: debugMode,
            slot1: abilityLoadout.slot1,
            slot2: abilityLoadout.slot2,
            cooldownSlot1: cooldownSec(cooldownUntilForSlot(1)),
            cooldownSlot2: cooldownSec(cooldownUntilForSlot(2)),
            deadeye: deadeyeState ? {
                lockCount: deadeyeState.lockCount,
                targetCount: deadeyeState.targets.length
            } : null
        };
    };

    globalThis.__MAYHEM_RUNTIME.GameAbilities = GameAbilities;
})();
