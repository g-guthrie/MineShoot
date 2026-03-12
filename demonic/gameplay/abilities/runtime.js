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
        var activeStates = {
            slot1: null,
            slot2: null
        };

        function nowMs() {
            return Date.now();
        }

        function slotKey(slotIndex) {
            return Number(slotIndex) === 2 ? 'slot2' : 'slot1';
        }

        function abilityIdForSlot(slotIndex) {
            return loadout[slotKey(slotIndex)] || '';
        }

        function abilityDefForSlot(slotIndex) {
            return abilityCatalog[abilityIdForSlot(slotIndex)] || null;
        }

        function defaultDurationMsForAbility(def) {
            var id = String(def && def.id || '');
            if (Number(def && def.duration || 0) > 0) {
                return Math.round(Number(def.duration || 0) * 1000);
            }
            if (id === 'choke') return 2000;
            if (id === 'hook') return 550;
            if (id === 'heal') return 850;
            if (id === 'missile') return 260;
            if (id === 'deadeye') return 1500;
            return 0;
        }

        function activeStateFor(def, key) {
            var durationMs = Math.max(0, defaultDurationMsForAbility(def));
            if (durationMs <= 0) return null;
            var startedAt = nowMs();
            return {
                slot: key,
                abilityId: String(def.id || ''),
                startedAt: startedAt,
                endsAt: startedAt + durationMs
            };
        }

        return {
            update: function (dt) {
                cooldownRemainingBySlot.slot1 = Math.max(0, cooldownRemainingBySlot.slot1 - (dt * 1000));
                cooldownRemainingBySlot.slot2 = Math.max(0, cooldownRemainingBySlot.slot2 - (dt * 1000));
                if (activeStates.slot1 && activeStates.slot1.endsAt <= nowMs()) activeStates.slot1 = null;
                if (activeStates.slot2 && activeStates.slot2.endsAt <= nowMs()) activeStates.slot2 = null;
            },
            trigger: function (slotIndex) {
                var key = slotKey(slotIndex);
                var def = abilityDefForSlot(slotIndex);
                if (!def) return { ok: false, reason: 'missing_ability' };
                if (cooldownRemainingBySlot[key] > 0) return { ok: false, reason: 'cooldown' };
                cooldownRemainingBySlot[key] = Math.max(0, Number(def.cooldownMs || 0));
                activeStates[key] = activeStateFor(def, key);
                lastCast = {
                    slot: key,
                    abilityId: String(def.id || ''),
                    castAt: nowMs()
                };
                return { ok: true, abilityId: String(def.id || '') };
            },
            setLoadoutSlot: function (slotIndex, abilityId) {
                var id = String(abilityId || '');
                if (!abilityCatalog[id]) return false;
                var key = slotKey(slotIndex);
                loadout[key] = id;
                cooldownRemainingBySlot[key] = 0;
                activeStates[key] = null;
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
                        slot2CooldownMs: Number(cooldownRemainingBySlot.slot2 || 0),
                        slot1Active: !!activeStates.slot1,
                        slot2Active: !!activeStates.slot2
                    },
                    activeStates: {
                        slot1: activeStates.slot1 ? {
                            slot: String(activeStates.slot1.slot || ''),
                            abilityId: String(activeStates.slot1.abilityId || ''),
                            startedAt: Number(activeStates.slot1.startedAt || 0),
                            endsAt: Number(activeStates.slot1.endsAt || 0)
                        } : null,
                        slot2: activeStates.slot2 ? {
                            slot: String(activeStates.slot2.slot || ''),
                            abilityId: String(activeStates.slot2.abilityId || ''),
                            startedAt: Number(activeStates.slot2.startedAt || 0),
                            endsAt: Number(activeStates.slot2.endsAt || 0)
                        } : null
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
