/**
 * player-loadout.js - Shared weapon/loadout helpers for GamePlayer.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GamePlayerLoadout
 */
(function () {
    'use strict';

    function getSelectableWeaponIds(sharedApi) {
        var shared = sharedApi || {};
        var selected = shared.getSelectableWeaponIds ? shared.getSelectableWeaponIds() : null;
        return Array.isArray(selected) && selected.length ? selected : ['rifle'];
    }

    function getDefaultWeaponLoadout(sharedApi) {
        var shared = sharedApi || {};
        var selected = shared.getDefaultWeaponLoadout ? shared.getDefaultWeaponLoadout() : null;
        if (Array.isArray(selected) && selected.length) return selected.slice(0, 2);
        return getSelectableWeaponIds(shared).slice(0, 2);
    }

    function getWeaponStats(sharedApi, weaponId) {
        var shared = sharedApi || {};
        return shared.getWeaponStats ? shared.getWeaponStats(weaponId) : null;
    }

    function resolveAdsFov(sharedApi, weaponId, defaultAdsFov, sniperScopeFov) {
        var shared = sharedApi || {};
        var weaponStats = getWeaponStats(shared, weaponId);
        if (shared.resolveWeaponAdsFovDeg) {
            return Number(shared.resolveWeaponAdsFovDeg(weaponStats || { id: weaponId })) || defaultAdsFov;
        }
        return weaponId === 'sniper' ? sniperScopeFov : defaultAdsFov;
    }

    function getWeaponPresentation(sharedApi, weaponId) {
        var shared = sharedApi || {};
        return shared.getWeaponPresentation ? shared.getWeaponPresentation(weaponId) : null;
    }

    function normalizeSniperLoadoutOrder(slots, sharedApi) {
        var next = Array.isArray(slots) ? slots.slice(0, 2) : [];
        if (String(next[0] || '') !== 'sniper') return next;
        if (String(next[1] || '') && String(next[1] || '') !== 'sniper') {
            return [String(next[1] || ''), 'sniper'];
        }
        var candidates = getDefaultWeaponLoadout(sharedApi).concat(getSelectableWeaponIds(sharedApi));
        for (var i = 0; i < candidates.length; i++) {
            var id = String(candidates[i] || '');
            if (!id || id === 'sniper') continue;
            return [id, 'sniper'];
        }
        return next;
    }

    function ensureLoadoutSlots(existingSlots, sharedApi) {
        if (Array.isArray(existingSlots) && existingSlots.length) return existingSlots.slice();
        var next = normalizeSniperLoadoutOrder(getSelectableWeaponIds(sharedApi).slice(), sharedApi);
        if (!next.length) next = ['rifle'];
        return next;
    }

    function weaponMoveSpeedMultiplier(sharedApi, weaponId) {
        var stats = getWeaponStats(sharedApi, weaponId);
        return Math.max(0.1, Number(stats && stats.moveSpeedMultiplier || 1));
    }

    function weaponAdsMoveMultiplier(sharedApi, movementTuningApi, weaponId) {
        var stats = getWeaponStats(sharedApi, weaponId);
        var movement = movementTuningApi || {};
        return Math.max(0.1, Number(stats && stats.adsMoveMultiplier || movement.adsMoveMult || 0.4));
    }

    function normalizeRequestedLoadout(loadoutConfig, sharedApi, currentWeaponId, allowedIds) {
        var currentSlots = ensureLoadoutSlots([], sharedApi);
        if (!loadoutConfig || !Array.isArray(loadoutConfig.slots)) {
            return {
                slots: currentSlots,
                nextWeaponId: currentWeaponId || currentSlots[0] || 'rifle',
                changed: false
            };
        }

        var allowed = {};
        var hasAllowed = Array.isArray(allowedIds) && allowedIds.length > 0;
        if (hasAllowed) {
            for (var a = 0; a < allowedIds.length; a++) {
                allowed[String(allowedIds[a] || '')] = true;
            }
        }

        var next = [];
        var seen = {};
        for (var i = 0; i < loadoutConfig.slots.length; i++) {
            var id = String(loadoutConfig.slots[i] || '');
            if (!id || seen[id]) continue;
            if (hasAllowed && !allowed[id]) continue;
            seen[id] = true;
            next.push(id);
        }

        next = normalizeSniperLoadoutOrder(next, sharedApi);
        if (!next.length) {
            return {
                slots: currentSlots,
                nextWeaponId: currentWeaponId || currentSlots[0] || 'rifle',
                changed: false
            };
        }

        return {
            slots: next,
            nextWeaponId: next.indexOf(currentWeaponId) >= 0 ? currentWeaponId : next[0],
            changed: true
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GamePlayerLoadout = {
        getSelectableWeaponIds: getSelectableWeaponIds,
        getDefaultWeaponLoadout: getDefaultWeaponLoadout,
        getWeaponStats: getWeaponStats,
        resolveAdsFov: resolveAdsFov,
        getWeaponPresentation: getWeaponPresentation,
        normalizeSniperLoadoutOrder: normalizeSniperLoadoutOrder,
        ensureLoadoutSlots: ensureLoadoutSlots,
        weaponMoveSpeedMultiplier: weaponMoveSpeedMultiplier,
        weaponAdsMoveMultiplier: weaponAdsMoveMultiplier,
        normalizeRequestedLoadout: normalizeRequestedLoadout
    };
})();
