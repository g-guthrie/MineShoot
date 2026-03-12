(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var mayhemRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create(options) {
        options = options || {};
        var shared = mayhemRuntime.GameShared || {};
        var defaults = shared.getDefaultAbilityLoadout ? shared.getDefaultAbilityLoadout() : { slot1: 'choke', slot2: 'missile' };
        var abilityCatalog = shared.getAbilityCatalog ? shared.getAbilityCatalog() : {};
        var targetingApi = demonicRuntime.GameAbilityTargeting || null;
        var stateMachineApi = demonicRuntime.GameAbilityStateMachine || null;
        var loadout = {
            slot1: String(defaults.slot1 || 'choke'),
            slot2: String(defaults.slot2 || 'missile')
        };
        var cooldownRemainingBySlot = {
            slot1: 0,
            slot2: 0
        };
        var lastCast = null;
        var targeting = targetingApi && targetingApi.create ? targetingApi.create(options) : null;
        var stateMachine = stateMachineApi && stateMachineApi.create ? stateMachineApi.create(options) : null;

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
            var id = String(def.id || '');
            var meta = {
                aimPoint: targeting && targeting.buildAimPoint ? targeting.buildAimPoint(Number(def.range || 24)) : null
            };
            if (id === 'deadeye') {
                var maxLocks = Math.max(1, Number(def.maxTargets || 2));
                var lockEveryMs = Math.max(1, Math.round(durationMs / maxLocks));
                meta.lockCount = 0;
                meta.maxLocks = maxLocks;
                meta.lockEveryMs = lockEveryMs;
                meta.nextLockAt = startedAt + lockEveryMs;
                meta.minDot = Number(def.minDot || 0.22);
            } else if (id === 'hook') {
                meta.phase = 'travel';
                meta.catchRadius = Number(def.catchRadius || 2.4);
                meta.reticleRadiusPx = Number(def.reticleRadiusPx || 52);
            } else if (id === 'heal') {
                meta.healAmount = Number(def.healAmount || 150);
            } else if (id === 'missile') {
                meta.phase = 'launch';
            } else if (id === 'choke') {
                meta.targeting = 'rect';
                meta.liftHeight = Number(def.liftHeight || 1.75);
                meta.lockBoxPx = Number(def.lockBoxPx || 180);
                meta.deadeyeMinDot = 0.22;
            }
            return {
                slot: key,
                abilityId: id,
                startedAt: startedAt,
                endsAt: startedAt + durationMs,
                meta: meta
            };
        }

        return {
            update: function (dt) {
                cooldownRemainingBySlot.slot1 = Math.max(0, cooldownRemainingBySlot.slot1 - (dt * 1000));
                cooldownRemainingBySlot.slot2 = Math.max(0, cooldownRemainingBySlot.slot2 - (dt * 1000));
                if (stateMachine && stateMachine.update) stateMachine.update(dt);
                if (stateMachine && stateMachine.getState && stateMachine.patchState) {
                    var stamp = nowMs();
                    ['slot1', 'slot2'].forEach(function (key) {
                        var state = stateMachine.getState(key);
                        if (!state || !state.meta) return;
                        var abilityId = String(state.abilityId || '');
                        if (abilityId === 'deadeye') {
                            var nextLockAt = Number(state.meta.nextLockAt || 0);
                            var lockEveryMs = Math.max(1, Number(state.meta.lockEveryMs || 1));
                            var lockCount = Math.max(0, Number(state.meta.lockCount || 0));
                            var maxLocks = Math.max(1, Number(state.meta.maxLocks || 1));
                            while (lockCount < maxLocks && stamp >= nextLockAt) {
                                lockCount += 1;
                                nextLockAt += lockEveryMs;
                            }
                            stateMachine.patchState(key, {
                                meta: Object.assign({}, state.meta, {
                                    lockCount: lockCount,
                                    nextLockAt: nextLockAt
                                })
                            });
                        } else if (abilityId === 'hook') {
                            var progress = Math.max(0, Math.min(1, (stamp - Number(state.startedAt || stamp)) / Math.max(1, Number(state.endsAt || stamp) - Number(state.startedAt || stamp))));
                            var phase = progress < 0.45 ? 'travel' : (progress < 0.78 ? 'latched' : 'retract');
                            stateMachine.patchState(key, {
                                meta: Object.assign({}, state.meta, { phase: phase })
                            });
                        }
                    });
                }
            },
            trigger: function (slotIndex) {
                var key = slotKey(slotIndex);
                var def = abilityDefForSlot(slotIndex);
                if (!def) return { ok: false, reason: 'missing_ability' };
                if (cooldownRemainingBySlot[key] > 0) return { ok: false, reason: 'cooldown' };
                cooldownRemainingBySlot[key] = Math.max(0, Number(def.cooldownMs || 0));
                var activeState = activeStateFor(def, key);
                if (activeState && stateMachine && stateMachine.activate) {
                    stateMachine.activate(key, activeState.abilityId, activeState.startedAt, activeState.endsAt, activeState.meta);
                }
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
                if (stateMachine && stateMachine.clear) stateMachine.clear(key);
                return true;
            },
            getSnapshot: function () {
                var slot1Def = abilityCatalog[loadout.slot1] || null;
                var slot2Def = abilityCatalog[loadout.slot2] || null;
                var activeStates = stateMachine && stateMachine.getSnapshot
                    ? stateMachine.getSnapshot()
                    : { slot1: null, slot2: null };
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
                            endsAt: Number(activeStates.slot1.endsAt || 0),
                            meta: activeStates.slot1.meta ? JSON.parse(JSON.stringify(activeStates.slot1.meta)) : null
                        } : null,
                        slot2: activeStates.slot2 ? {
                            slot: String(activeStates.slot2.slot || ''),
                            abilityId: String(activeStates.slot2.abilityId || ''),
                            startedAt: Number(activeStates.slot2.startedAt || 0),
                            endsAt: Number(activeStates.slot2.endsAt || 0),
                            meta: activeStates.slot2.meta ? JSON.parse(JSON.stringify(activeStates.slot2.meta)) : null
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
