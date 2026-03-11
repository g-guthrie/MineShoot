(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var mayhemRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create() {
        var shared = mayhemRuntime.GameShared || {};
        var defaults = shared.getDefaultAbilityLoadout ? shared.getDefaultAbilityLoadout() : { slot1: 'choke', slot2: 'missile' };
        var abilityCatalog = shared.getAbilityCatalog ? shared.getAbilityCatalog() : {};
        var loadout = {
            slot1: String(defaults.slot1 || 'choke'),
            slot2: String(defaults.slot2 || 'missile')
        };
        var cooldownRemainingBySlot = {
            slot1: 0,
            slot2: 0
        };
        var lastCast = null;

        function slotKey(slotIndex) {
            return Number(slotIndex) === 2 ? 'slot2' : 'slot1';
        }

        function abilityIdForSlot(slotIndex) {
            return loadout[slotKey(slotIndex)] || '';
        }

        function abilityDefForSlot(slotIndex) {
            return abilityCatalog[abilityIdForSlot(slotIndex)] || null;
        }

        return {
            update: function (dt) {
                cooldownRemainingBySlot.slot1 = Math.max(0, cooldownRemainingBySlot.slot1 - (dt * 1000));
                cooldownRemainingBySlot.slot2 = Math.max(0, cooldownRemainingBySlot.slot2 - (dt * 1000));
            },
            trigger: function (slotIndex) {
                var key = slotKey(slotIndex);
                var def = abilityDefForSlot(slotIndex);
                if (!def) return { ok: false, reason: 'missing_ability' };
                if (cooldownRemainingBySlot[key] > 0) return { ok: false, reason: 'cooldown' };
                cooldownRemainingBySlot[key] = Math.max(0, Number(def.cooldownMs || 0));
                lastCast = {
                    slot: key,
                    abilityId: String(def.id || ''),
                    castAt: Date.now()
                };
                return { ok: true, abilityId: String(def.id || '') };
            },
            setLoadoutSlot: function (slotIndex, abilityId) {
                var id = String(abilityId || '');
                if (!abilityCatalog[id]) return false;
                loadout[slotKey(slotIndex)] = id;
                cooldownRemainingBySlot[slotKey(slotIndex)] = 0;
                return true;
            },
            getSnapshot: function () {
                var slot1Def = abilityCatalog[loadout.slot1] || null;
                var slot2Def = abilityCatalog[loadout.slot2] || null;
                return {
                    loadout: {
                        slot1: String(loadout.slot1 || ''),
                        slot2: String(loadout.slot2 || '')
                    },
                    hud: {
                        slot1Name: slot1Def ? String(slot1Def.name || slot1Def.id || '') : '',
                        slot2Name: slot2Def ? String(slot2Def.name || slot2Def.id || '') : '',
                        slot1CooldownMs: Number(cooldownRemainingBySlot.slot1 || 0),
                        slot2CooldownMs: Number(cooldownRemainingBySlot.slot2 || 0)
                    },
                    lastCast: lastCast ? {
                        slot: String(lastCast.slot || ''),
                        abilityId: String(lastCast.abilityId || ''),
                        castAt: Number(lastCast.castAt || 0)
                    } : null
                };
            }
        };
    }

    demonicRuntime.GameAbilityRuntime = {
        create: create
    };
})();
