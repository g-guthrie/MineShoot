/**
 * commands.js - Outbound network command owner for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetCommands
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};
        var buildFirePayload = typeof opts.buildFirePayload === 'function'
            ? opts.buildFirePayload
            : null;

        function wsSend(msg) {
            if (!msg || !opts.wsSend) return false;
            return opts.wsSend(msg);
        }

        return {
            sendFire: function (weaponId, shotToken) {
                if (!buildFirePayload) return false;
                var payload = buildFirePayload(opts.fireMessageType || 'fire', weaponId, shotToken);
                if (!payload) return false;
                return wsSend(payload);
            },
            sendEquipWeapon: function (weaponId) {
                if (!weaponId) return false;
                return wsSend({
                    t: opts.equipWeaponMessageType || 'equip_weapon',
                    weaponId: String(weaponId)
                });
            },
            sendWeaponLoadout: function (slot1, slot2) {
                if (opts.setPendingWeaponLoadout && opts.normalizeWeaponLoadoutPayload) {
                    opts.setPendingWeaponLoadout(opts.normalizeWeaponLoadoutPayload(slot1, slot2));
                }
                return opts.flushPendingWeaponLoadout ? opts.flushPendingWeaponLoadout() : false;
            },
            sendThrow: function (throwableId, clientThrowId, throwIntent) {
                return wsSend(opts.normalizeThrowPayload
                    ? opts.normalizeThrowPayload(throwableId, clientThrowId, throwIntent)
                    : null);
            },
            sendAbilityLoadout: function (slot1, slot2) {
                return wsSend(opts.normalizeAbilityLoadoutPayload
                    ? opts.normalizeAbilityLoadoutPayload(slot1, slot2)
                    : null);
            },
            sendAbilityCast: function (slot, castData) {
                return wsSend(opts.normalizeClassCastPayload
                    ? opts.normalizeClassCastPayload(slot, castData)
                    : null);
            }
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetCommands = {
        create: create
    };
})();
