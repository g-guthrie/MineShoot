(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function nowMs() {
        return Date.now();
    }

    function create() {
        var slotStates = {
            slot1: null,
            slot2: null
        };

        function clearExpired() {
            var stamp = nowMs();
            if (slotStates.slot1 && Number(slotStates.slot1.endsAt || 0) <= stamp) slotStates.slot1 = null;
            if (slotStates.slot2 && Number(slotStates.slot2.endsAt || 0) <= stamp) slotStates.slot2 = null;
        }

        return {
            update: function () {
                clearExpired();
            },
            activate: function (slotKey, abilityId, startedAt, endsAt, meta) {
                slotStates[String(slotKey || 'slot1')] = {
                    slot: String(slotKey || 'slot1'),
                    abilityId: String(abilityId || ''),
                    startedAt: Number(startedAt || nowMs()),
                    endsAt: Number(endsAt || nowMs()),
                    meta: meta || null
                };
            },
            clear: function (slotKey) {
                slotStates[String(slotKey || 'slot1')] = null;
            },
            getSnapshot: function () {
                clearExpired();
                return {
                    slot1: slotStates.slot1 ? {
                        slot: String(slotStates.slot1.slot || ''),
                        abilityId: String(slotStates.slot1.abilityId || ''),
                        startedAt: Number(slotStates.slot1.startedAt || 0),
                        endsAt: Number(slotStates.slot1.endsAt || 0),
                        meta: slotStates.slot1.meta || null
                    } : null,
                    slot2: slotStates.slot2 ? {
                        slot: String(slotStates.slot2.slot || ''),
                        abilityId: String(slotStates.slot2.abilityId || ''),
                        startedAt: Number(slotStates.slot2.startedAt || 0),
                        endsAt: Number(slotStates.slot2.endsAt || 0),
                        meta: slotStates.slot2.meta || null
                    } : null
                };
            }
        };
    }

    demonicRuntime.GameAbilityStateMachine = {
        create: create
    };
})();
