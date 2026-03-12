/**
 * commands.js - Outbound network command owner for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetCommands
 */
(function () {
    'use strict';

    function buildFirePayload(msgType, weaponId, shotToken, playerApi, remotePresentationClock) {
        if (!weaponId) return null;
        var payload = {
            t: msgType,
            weaponId: String(weaponId)
        };

        if (playerApi && playerApi.getAdsState) {
            var adsState = playerApi.getAdsState();
            if (adsState && adsState.active) payload.adsActive = true;
        }

        if (playerApi && playerApi.getCamera) {
            var camera = playerApi.getCamera();
            var cameraFov = Number(camera && camera.fov);
            if (isFinite(cameraFov) && cameraFov > 0.0001) payload.viewFovDeg = cameraFov;
        }

        if (playerApi && playerApi.getRotation) {
            var rot = playerApi.getRotation();
            var yaw = Number(rot && rot.yaw || 0);
            var pitch = Number(rot && rot.pitch || 0);
            var x = -Math.sin(yaw) * Math.cos(pitch);
            var y = Math.sin(-pitch);
            var z = -Math.cos(yaw) * Math.cos(pitch);
            var len = Math.sqrt((x * x) + (y * y) + (z * z)) || 1;
            if (isFinite(len) && len > 0.000001) {
                payload.aimForward = {
                    x: x / len,
                    y: y / len,
                    z: z / len
                };
            }
        }

        var fireOrigin = null;
        if (playerApi && playerApi.getEyeWorldPosition) {
            fireOrigin = playerApi.getEyeWorldPosition();
        }
        if ((!fireOrigin || !isFinite(Number(fireOrigin.x)) || !isFinite(Number(fireOrigin.y)) || !isFinite(Number(fireOrigin.z))) && playerApi && playerApi.getCamera) {
            var fireCamera = playerApi.getCamera();
            if (fireCamera && fireCamera.position) {
                fireOrigin = fireCamera.position;
            }
        }
        if (fireOrigin && isFinite(Number(fireOrigin.x)) && isFinite(Number(fireOrigin.y)) && isFinite(Number(fireOrigin.z))) {
            payload.aimOrigin = {
                x: Number(fireOrigin.x || 0),
                y: Number(fireOrigin.y || 0),
                z: Number(fireOrigin.z || 0)
            };
        }
        if (!payload.aimOrigin && playerApi && playerApi.getCamera) {
            var fallbackCamera = playerApi.getCamera();
            if (fallbackCamera && isFinite(Number(fallbackCamera.position && fallbackCamera.position.x)) && isFinite(Number(fallbackCamera.position && fallbackCamera.position.y)) && isFinite(Number(fallbackCamera.position && fallbackCamera.position.z))) {
                payload.aimOrigin = {
                    x: Number(fallbackCamera.position.x || 0),
                    y: Number(fallbackCamera.position.y || 0),
                    z: Number(fallbackCamera.position.z || 0)
                };
            }
        }

        var renderServerTime = Number(remotePresentationClock && remotePresentationClock.renderServerTimeMs);
        if (isFinite(renderServerTime) && renderServerTime > 0.0001) {
            payload.renderServerTime = Math.round(renderServerTime);
        }

        if (shotToken) payload.shotToken = String(shotToken);
        return payload;
    }

    function create(opts) {
        opts = opts || {};

        function wsSend(msg) {
            if (!msg || !opts.wsSend) return false;
            return opts.wsSend(msg);
        }

        function getPlayerApi() {
            return opts.getPlayerApi ? opts.getPlayerApi() : null;
        }

        function getRemotePresentationClock() {
            return opts.getRemotePresentationClock ? opts.getRemotePresentationClock() : null;
        }

        return {
            sendFire: function (weaponId, shotToken) {
                var payload = buildFirePayload(
                    opts.fireMessageType || 'fire',
                    weaponId,
                    shotToken,
                    getPlayerApi(),
                    getRemotePresentationClock()
                );
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
