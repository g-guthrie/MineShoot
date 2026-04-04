/**
 * network-loadout.js - Loadout, self-entry, and notice helpers for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetNetworkLoadout
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameNetNetworkLoadout = {};

    function normalizeLoadoutPair(slots) {
        if (!Array.isArray(slots)) return [];
        var out = [];
        var seen = {};
        for (var i = 0; i < slots.length && out.length < 2; i++) {
            var id = String(slots[i] || '');
            if (!id || seen[id]) continue;
            seen[id] = true;
            out.push(id);
        }
        return out;
    }

    GameNetNetworkLoadout.normalizeLoadoutPair = normalizeLoadoutPair;

    GameNetNetworkLoadout.create = function (opts) {
        opts = opts || {};

        function netState() {
            return opts.getNetState ? opts.getNetState() : null;
        }

        function protocol() {
            return opts.getProtocol ? opts.getProtocol() : null;
        }

        function connectionTiming() {
            return opts.getConnectionTiming ? opts.getConnectionTiming() : null;
        }

        function seedCommittedWeaponLoadoutPending() {
            var state = netState();
            var loadoutState = runtime.GameLoadoutState || null;
            if (!loadoutState || !loadoutState.getCommittedLoadout || !state || !state.setPendingWeaponLoadout) return;
            var committed = loadoutState.getCommittedLoadout();
            var slots = committed && Array.isArray(committed.weaponSlots)
                ? committed.weaponSlots.slice(0, 2)
                : [];
            if (!slots[0] || !slots[1]) return;

            var netProtocol = protocol();
            if (netProtocol && typeof netProtocol.normalizeWeaponLoadoutPayload === 'function') {
                state.setPendingWeaponLoadout(netProtocol.normalizeWeaponLoadoutPayload(slots[0], slots[1]));
                return;
            }

            state.setPendingWeaponLoadout({
                slot1: String(slots[0] || ''),
                slot2: String(slots[1] || '')
            });
        }

        function pendingSelfWeaponLoadout(entity) {
            var state = netState();
            var pending = state && state.getPendingWeaponLoadout ? state.getPendingWeaponLoadout() : null;
            if (!pending || !entity || !state || entity.id !== state.getSelfId()) return entity;

            var pendingSlots = normalizeLoadoutPair([pending.slot1, pending.slot2]);
            if (!pendingSlots.length) return entity;

            var authoritativeSlots = normalizeLoadoutPair(entity.weaponLoadout);
            var authoritativeWeaponId = String(entity.weaponId || '');
            var loadoutMatches = authoritativeSlots.length === pendingSlots.length;
            if (loadoutMatches) {
                for (var i = 0; i < pendingSlots.length; i++) {
                    if (authoritativeSlots[i] !== pendingSlots[i]) {
                        loadoutMatches = false;
                        break;
                    }
                }
            }
            var preferredWeaponId = String(pendingSlots[0] || '');
            if (loadoutMatches && authoritativeWeaponId === preferredWeaponId) {
                state.setPendingWeaponLoadout(null);
                return entity;
            }

            var nextEntity = Object.assign({}, entity);
            nextEntity.weaponLoadout = pendingSlots.slice();
            if (preferredWeaponId) {
                nextEntity.weaponId = preferredWeaponId;
            }
            return nextEntity;
        }

        function translateSelfEntryState(entity) {
            var state = netState();
            if (!entity || !state || entity.id !== state.getSelfId()) return entity;
            var entryUntil = Number(entity.matchEntryUntil || 0);
            if (!(entryUntil > 0)) return entity;

            var nextEntryUntil = entryUntil;
            var timing = connectionTiming();
            if (timing && typeof timing.toLocalClockTime === 'function') {
                nextEntryUntil = Number(timing.toLocalClockTime(entryUntil) || entryUntil);
            }

            var nextEntity = Object.assign({}, entity);
            nextEntity.matchEntryUntil = nextEntryUntil;
            return nextEntity;
        }

        function pushNotice(text) {
            var state = netState();
            if (!state || typeof state.pushNotice !== 'function') return;
            state.pushNotice(text);
        }

        function consumeNotice() {
            var state = netState();
            return state && typeof state.consumeNotice === 'function'
                ? state.consumeNotice()
                : '';
        }

        return {
            seedCommittedWeaponLoadoutPending: seedCommittedWeaponLoadoutPending,
            normalizeLoadoutPair: normalizeLoadoutPair,
            pendingSelfWeaponLoadout: pendingSelfWeaponLoadout,
            translateSelfEntryState: translateSelfEntryState,
            pushNotice: pushNotice,
            consumeNotice: consumeNotice
        };
    };

    runtime.GameNetNetworkLoadout = GameNetNetworkLoadout;
})();
