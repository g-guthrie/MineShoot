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
            sendEnterMatch: function () {
                return wsSend({
                    t: opts.enterMatchMessageType || 'enter_match'
                });
            },
            sendFire: function (weaponId, shotToken, shotSample) {
                if (!buildFirePayload) return false;
                var payload = buildFirePayload(opts.fireMessageType || 'fire', weaponId, shotToken, shotSample);
                if (!payload) return false;
                return wsSend(payload);
            },
            sendRoll: function (rollOptions) {
                var state = rollOptions && typeof rollOptions === 'object' ? rollOptions : null;
                if (!state) return false;
                return wsSend({
                    t: opts.rollMessageType || 'roll',
                    movingForward: !!state.movingForward,
                    movingBackward: !!state.movingBackward,
                    movingLeft: !!state.movingLeft,
                    movingRight: !!state.movingRight
                });
            },
            sendReload: function (weaponId) {
                if (!weaponId) return false;
                return wsSend(opts.normalizeReloadPayload
                    ? opts.normalizeReloadPayload(weaponId)
                    : {
                        t: opts.reloadMessageType || 'reload',
                        weaponId: String(weaponId)
                    });
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
            }
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetCommands = {
        create: create
    };
})();
