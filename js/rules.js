/**
 * rules.js - Shared gameplay policy contracts (class weapon policy, defaults)
 * Loaded as global: window.GameRules
 */
(function () {
    'use strict';

    var GameRules = {};

    var POLICY_MODES = {
        SOFT: 'soft',
        HYBRID: 'hybrid',
        HARD: 'hard'
    };

    var policyMode = POLICY_MODES.SOFT;

    var CLASS_RULES = {
        ninja: {
            defaultWeapon: 'pistol',
            recommendedLoadout: ['pistol', 'shotgun', 'rifle']
        },
        jedi: {
            defaultWeapon: 'shotgun',
            recommendedLoadout: ['shotgun', 'rifle', 'machinegun']
        },
        magician: {
            defaultWeapon: 'rifle',
            recommendedLoadout: ['rifle', 'plasma'],
            spellKitPlaceholders: ['spell_staff_basic', 'spell_firebolt', 'spell_ice_shard', 'spell_arc_chain']
        },
        sharpshooter: {
            defaultWeapon: 'sniper',
            recommendedLoadout: ['sniper', 'rifle', 'pistol']
        },
        brawler: {
            defaultWeapon: 'machinegun',
            recommendedLoadout: ['machinegun', 'shotgun', 'pistol']
        }
    };

    function getAllowedWeapons(classId) {
        // Prepared for hard-restriction phase. Soft mode does not deny.
        var byClass = {
            ninja: ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'plasma'],
            jedi: ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'plasma'],
            magician: ['spell_staff_basic', 'spell_firebolt', 'spell_ice_shard', 'spell_arc_chain'],
            sharpshooter: ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'plasma'],
            brawler: ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper', 'plasma']
        };
        return (byClass[classId] || byClass.sharpshooter).slice();
    }

    function getRule(classId) {
        return CLASS_RULES[classId] || CLASS_RULES.sharpshooter;
    }

    function asSet(list) {
        var out = {};
        for (var i = 0; i < list.length; i++) out[list[i]] = true;
        return out;
    }

    GameRules.getClassPolicyMode = function () {
        return policyMode;
    };

    GameRules.setClassPolicyMode = function (mode) {
        if (mode !== POLICY_MODES.SOFT && mode !== POLICY_MODES.HYBRID && mode !== POLICY_MODES.HARD) {
            return policyMode;
        }
        policyMode = mode;
        return policyMode;
    };

    GameRules.getClassDefaultWeapon = function (classId) {
        return getRule(classId).defaultWeapon || 'rifle';
    };

    GameRules.getClassRecommendedLoadout = function (classId) {
        return getRule(classId).recommendedLoadout.slice();
    };

    GameRules.getClassEntitlement = function (classId) {
        var rule = getRule(classId);
        return {
            classId: classId || 'sharpshooter',
            defaultWeapon: rule.defaultWeapon,
            recommendedLoadout: rule.recommendedLoadout.slice(),
            allowedWeapons: getAllowedWeapons(classId),
            spellKitPlaceholders: (rule.spellKitPlaceholders || []).slice()
        };
    };

    GameRules.canEquip = function (classId, weaponId) {
        classId = classId || 'sharpshooter';
        weaponId = String(weaponId || '');

        var entitlement = GameRules.getClassEntitlement(classId);
        var recommendedSet = asSet(entitlement.recommendedLoadout);
        var allowedSet = asSet(entitlement.allowedWeapons);

        if (policyMode === POLICY_MODES.SOFT) {
            return {
                ok: true,
                mode: policyMode,
                warn: !recommendedSet[weaponId],
                reason: recommendedSet[weaponId]
                    ? ''
                    : ('Weapon "' + weaponId + '" is outside recommended loadout for class "' + classId + '".')
            };
        }

        if (policyMode === POLICY_MODES.HYBRID) {
            if (classId === 'magician' && !allowedSet[weaponId]) {
                return {
                    ok: false,
                    mode: policyMode,
                    warn: false,
                    reason: 'Magician hybrid mode only allows spell kit weapons.'
                };
            }
            return {
                ok: true,
                mode: policyMode,
                warn: !recommendedSet[weaponId],
                reason: recommendedSet[weaponId]
                    ? ''
                    : ('Weapon "' + weaponId + '" is outside recommended loadout for class "' + classId + '".')
            };
        }

        // Hard mode: strict class entitlement.
        if (!allowedSet[weaponId]) {
            return {
                ok: false,
                mode: policyMode,
                warn: false,
                reason: 'Weapon "' + weaponId + '" is not allowed for class "' + classId + '".'
            };
        }

        return {
            ok: true,
            mode: policyMode,
            warn: !recommendedSet[weaponId],
            reason: recommendedSet[weaponId]
                ? ''
                : ('Weapon "' + weaponId + '" is allowed but not recommended for class "' + classId + '".')
        };
    };

    window.GameRules = GameRules;
})();
