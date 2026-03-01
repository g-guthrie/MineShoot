/**
 * loadout.js - Single authoritative weapon slot state and equip actions
 * Loaded as global: window.GameLoadout
 */
(function () {
    'use strict';

    var GameLoadout = {};
    var PRIM = globalThis.__GAME_PRIMITIVES__ || {};
    var COMBAT_PRIM = PRIM.combat || {};
    var slots = [];
    var initialized = false;
    var pendingWeaponId = '';

    function schema() {
        return globalThis.__GAME_SCHEMA__ || null;
    }

    function getAllWeaponIds() {
        if (window.GameHitscan && window.GameHitscan.getAllWeaponIds) {
            return window.GameHitscan.getAllWeaponIds();
        }
        return (COMBAT_PRIM.weapon_order || ['rifle']).slice();
    }

    function getCurrentClassId() {
        if (!window.GameClasses || !window.GameClasses.getCurrentClass) return 'sharpshooter';
        var current = window.GameClasses.getCurrentClass();
        return (current && current.id) ? current.id : 'sharpshooter';
    }

    function validateLoadoutDto(dto) {
        var validator = schema();
        if (!validator || !validator.validateLoadout) return { ok: true, value: dto };
        return validator.validateLoadout(dto, getAllWeaponIds());
    }

    function sanitizeSlots(next) {
        var candidate = Array.isArray(next) ? next.slice() : [];
        if (candidate.length === 0 && window.GameHitscan && window.GameHitscan.getWeaponOrder) {
            candidate = window.GameHitscan.getWeaponOrder();
        }

        var result = validateLoadoutDto({ slots: candidate });
        if (!result.ok) {
            if (window.__DEV__) {
                console.warn('[loadout] Invalid loadout payload:', result.errors);
            }
            if (window.GameHitscan && window.GameHitscan.getWeaponOrder) {
                return window.GameHitscan.getWeaponOrder();
            }
            return ['rifle'];
        }

        return result.value.slots.slice();
    }

    function applySlots(next) {
        slots = sanitizeSlots(next);
        if (window.GameHitscan && window.GameHitscan.setWeaponOrder) {
            window.GameHitscan.setWeaponOrder(slots);
        }
        if (window.GamePlayer && window.GamePlayer.setLoadout) {
            window.GamePlayer.setLoadout({ slots: slots.slice() });
        }
        return slots.slice();
    }

    function ensureInit() {
        if (initialized) return;
        initialized = true;
        applySlots(slots.length > 0 ? slots : null);
    }

    GameLoadout.init = function () {
        ensureInit();
        return GameLoadout.getSlots();
    };

    GameLoadout.getSlots = function () {
        ensureInit();
        return slots.slice();
    };

    GameLoadout.setSlots = function (nextSlots) {
        ensureInit();
        return {
            slots: applySlots(nextSlots)
        };
    };

    GameLoadout.equipWeapon = function (weaponId) {
        ensureInit();
        weaponId = String(weaponId || '');
        if (!weaponId) return null;

        var classId = getCurrentClassId();
        if (window.GameRules && window.GameRules.canEquip) {
            var gate = window.GameRules.canEquip(classId, weaponId);
            if (!gate.ok) {
                if (window.__DEV__) console.warn('[loadout] equip blocked:', gate.reason);
                return null;
            }
            if (gate.warn && gate.reason && window.__DEV__) {
                console.warn('[loadout] soft policy:', gate.reason);
            }
        }

        if (slots.indexOf(weaponId) === -1) {
            slots.unshift(weaponId);
            applySlots(slots);
        }

        if (!window.GameHitscan || !window.GameHitscan.setWeapon) return null;
        return window.GameHitscan.setWeapon(weaponId);
    };

    GameLoadout.setPendingWeapon = function (weaponId) {
        ensureInit();
        weaponId = String(weaponId || '');
        if (!weaponId) return { ok: false, reason: 'missing_weapon' };

        var classId = getCurrentClassId();
        if (window.GameRules && window.GameRules.canEquip) {
            var gate = window.GameRules.canEquip(classId, weaponId);
            if (!gate.ok) return { ok: false, reason: gate.reason || 'not_allowed' };
        }

        pendingWeaponId = weaponId;
        return { ok: true, weaponId: pendingWeaponId };
    };

    GameLoadout.getPendingWeapon = function () {
        ensureInit();
        return pendingWeaponId || '';
    };

    GameLoadout.clearPendingWeapon = function () {
        pendingWeaponId = '';
    };

    GameLoadout.applyPendingWeaponOnResume = function () {
        ensureInit();
        if (!pendingWeaponId) return null;
        var weapon = GameLoadout.equipWeapon(pendingWeaponId);
        pendingWeaponId = '';
        return weapon;
    };

    GameLoadout.equipSlot = function (slotIndex) {
        ensureInit();
        var idx = Math.max(0, Math.floor(slotIndex || 0));
        if (idx >= slots.length) return null;
        return GameLoadout.equipWeapon(slots[idx]);
    };

    GameLoadout.cycle = function (delta) {
        ensureInit();
        if (!window.GameHitscan || !window.GameHitscan.cycleWeapon) return null;

        var max = Math.max(1, slots.length);
        for (var i = 0; i < max; i++) {
            var weapon = window.GameHitscan.cycleWeapon(delta);
            if (!weapon || !weapon.id) return weapon;

            if (window.GameRules && window.GameRules.canEquip) {
                var gate = window.GameRules.canEquip(getCurrentClassId(), weapon.id);
                if (!gate.ok) continue;
            }
            return weapon;
        }

        return window.GameHitscan.getCurrentWeapon ? window.GameHitscan.getCurrentWeapon() : null;
    };

    window.GameLoadout = GameLoadout;
})();
