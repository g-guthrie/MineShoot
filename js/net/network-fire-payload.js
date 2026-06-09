/**
 * network-fire-payload.js - State-parameterized fire payload helpers for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetFirePayload
 */
(function () {
    'use strict';

    function finitePositiveNumber(value) {
        var num = Number(value);
        return isFinite(num) && num > 0.0001 ? num : 0;
    }

    function normalizeVector3(value) {
        if (!value || typeof value !== 'object') return null;
        var x = Number(value.x || 0);
        var y = Number(value.y || 0);
        var z = Number(value.z || 0);
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return null;
        return { x: x, y: y, z: z };
    }

    function normalizeForwardVector(value) {
        var vector = normalizeVector3(value);
        if (!vector) return null;
        var len = Math.sqrt(
            (vector.x * vector.x) +
            (vector.y * vector.y) +
            (vector.z * vector.z)
        );
        if (!isFinite(len) || len <= 0.000001) return null;
        return {
            x: vector.x / len,
            y: vector.y / len,
            z: vector.z / len
        };
    }

    function normalizeShotToken(shotToken) {
        return shotToken ? String(shotToken) : '';
    }

    function resolveAdsActive(state) {
        var fireIntent = state && state.fireIntent;
        if (fireIntent && fireIntent.adsActive) return true;
        var player = state && state.player;
        if (player && typeof player.getAdsState === 'function') {
            var adsState = player.getAdsState();
            if (adsState && adsState.ready) return true;
        }
        return false;
    }

    function resolveViewFovDeg(state) {
        var fireIntent = state && state.fireIntent;
        var intentFov = finitePositiveNumber(fireIntent && fireIntent.viewFovDeg);
        if (intentFov) return intentFov;
        var player = state && state.player;
        if (player && typeof player.getCamera === 'function') {
            var camera = player.getCamera();
            var cameraFov = finitePositiveNumber(camera && camera.fov);
            if (cameraFov) return cameraFov;
        }
        return 0;
    }

    function resolveAimForward(state) {
        var fireIntent = state && state.fireIntent;
        var intentForward = normalizeForwardVector(fireIntent && fireIntent.aimForward);
        if (intentForward) return intentForward;
        var player = state && state.player;
        if (player && typeof player.getRotation === 'function') {
            var rot = player.getRotation();
            var yaw = Number(rot && rot.yaw || 0);
            var pitch = Number(rot && rot.pitch || 0);
            var x = -Math.sin(yaw) * Math.cos(pitch);
            var y = Math.sin(-pitch);
            var z = -Math.cos(yaw) * Math.cos(pitch);
            return normalizeForwardVector({ x: x, y: y, z: z });
        }
        return null;
    }

    function resolveEyeOrigin(state) {
        var player = state && state.player;
        var fireOrigin = null;
        if (player && typeof player.getEyeWorldPosition === 'function') {
            fireOrigin = player.getEyeWorldPosition();
        }
        if ((!fireOrigin || !normalizeVector3(fireOrigin)) && player && typeof player.getCamera === 'function') {
            var camera = player.getCamera();
            if (camera && camera.position) fireOrigin = camera.position;
        }
        return normalizeVector3(fireOrigin);
    }

    function resolveAimOrigin(state, aimForward) {
        var fireIntent = state && state.fireIntent;
        var intentOrigin = normalizeVector3(fireIntent && fireIntent.aimOrigin);
        if (intentOrigin) return intentOrigin;
        var eyeOrigin = resolveEyeOrigin(state);
        if (!eyeOrigin) return null;
        var sharedApi = state && state.sharedApi;
        var sharedPoints = sharedApi && sharedApi.entityPoints;
        if (sharedPoints && typeof sharedPoints.logicalMuzzleOriginFromEye === 'function' && aimForward) {
            return normalizeVector3(sharedPoints.logicalMuzzleOriginFromEye(eyeOrigin, aimForward)) || eyeOrigin;
        }
        return eyeOrigin;
    }

    function resolvePresentationDelayMs(state) {
        var fireIntent = state && state.fireIntent;
        var delayMs = Number(fireIntent && fireIntent.presentationDelayMs || 0);
        if (!isFinite(delayMs) || delayMs <= 0) return 0;
        var sharedApi = state && state.sharedApi;
        var networkTuning = sharedApi && sharedApi.getNetworkTuning
            ? (sharedApi.getNetworkTuning() || {})
            : ((sharedApi && sharedApi.gameplayTuning && sharedApi.gameplayTuning.network) || {});
        var remoteTuning = networkTuning.remoteInterpolation || {};
        var maxDelayMs = Math.max(1, Number(remoteTuning.maxDelayMs || 180));
        var maxExtraDelayMs = Math.max(0, Number(remoteTuning.lossDelayPaddingMaxMs || 160));
        return Math.min(Math.round(delayMs), maxDelayMs + maxExtraDelayMs);
    }

    function resolveEstimatedServerShotTime(state) {
        var connectionTiming = state && state.connectionTiming;
        var estimatedServerTime = Number(
            connectionTiming && typeof connectionTiming.getEstimatedServerTime === 'function'
                ? connectionTiming.getEstimatedServerTime()
                : 0
        );
        if (!isFinite(estimatedServerTime) || estimatedServerTime <= 0) return 0;
        return Math.max(0, Math.round(estimatedServerTime - resolvePresentationDelayMs(state)));
    }

    function buildPayload(state) {
        state = state || {};
        if (!state.weaponId) return null;
        var payload = {
            t: String(state.msgType || 'fire'),
            weaponId: String(state.weaponId)
        };
        var adsActive = resolveAdsActive(state);
        if (adsActive) payload.adsActive = true;
        var viewFovDeg = resolveViewFovDeg(state);
        if (viewFovDeg) payload.viewFovDeg = viewFovDeg;
        var aimForward = resolveAimForward(state);
        if (aimForward) payload.aimForward = aimForward;
        var aimOrigin = resolveAimOrigin(state, aimForward);
        if (aimOrigin) payload.aimOrigin = aimOrigin;
        var estimatedServerShotTime = resolveEstimatedServerShotTime(state);
        if (estimatedServerShotTime) payload.estimatedServerShotTime = estimatedServerShotTime;
        var shotToken = normalizeShotToken(state.shotToken);
        if (shotToken) payload.shotToken = shotToken;
        return payload;
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetFirePayload = {
        buildPayload: buildPayload,
        normalizeShotToken: normalizeShotToken,
        resolveAdsActive: resolveAdsActive,
        resolveViewFovDeg: resolveViewFovDeg,
        resolveAimForward: resolveAimForward,
        resolveAimOrigin: resolveAimOrigin,
        resolvePresentationDelayMs: resolvePresentationDelayMs,
        resolveEstimatedServerShotTime: resolveEstimatedServerShotTime
    };
})();
