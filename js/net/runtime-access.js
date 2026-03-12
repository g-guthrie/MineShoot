/**
 * runtime-access.js - Narrow runtime-global access for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetRuntimeAccess
 */
(function () {
    'use strict';

    function create() {
        function runtime() {
            return globalThis.__MAYHEM_RUNTIME || {};
        }

        function shared() {
            return runtime().GameShared || {};
        }

        function runtimeProfile() {
            return runtime().GameRuntimeProfile || null;
        }

        function getWorldApi() {
            return runtime().GameWorld || null;
        }

        function getSocketIdentity(authApi) {
            if (authApi && authApi.getSocketIdentity) return authApi.getSocketIdentity();
            return authApi && authApi.getUser ? authApi.getUser() : null;
        }

        function buildWsEndpoint(opts) {
            opts = opts || {};
            var profile = runtimeProfile();
            var endpoint = (profile && profile.resolveWsUrl)
                ? profile.resolveWsUrl(opts.wsPath)
                : ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + opts.wsPath);
            var authApi = opts.authApi || null;
            var params = new URLSearchParams();
            params.set('room', String(opts.roomId || 'global'));
            if (authApi && authApi.getSocketPlayerId) {
                params.set('pid', String(authApi.getSocketPlayerId() || ''));
            }
            var actor = authApi && authApi.getPartyIdentity ? authApi.getPartyIdentity() : null;
            if (actor && actor.id) {
                params.set('actorId', String(actor.id));
                params.set('actorName', String(actor.username || actor.id));
            }
            var user = getSocketIdentity(authApi);
            if (user && user.id) {
                params.set('uid', String(user.id));
                params.set('username', String(user.username || user.id));
                params.set('classId', String(user.classId || 'abilities'));
            }
            return endpoint + '?' + params.toString();
        }

        function getActiveWorldMeta() {
            var worldApi = getWorldApi();
            return worldApi && worldApi.getWorldMeta ? worldApi.getWorldMeta() : null;
        }

        function damagePointY(entityY) {
            var points = shared().entityPoints || {};
            return points.entityDamagePointY ? points.entityDamagePointY(entityY) : (entityY + 1.06);
        }

        function markerPointY(entityY) {
            var points = shared().entityPoints || {};
            return points.entityMarkerPointY ? points.entityMarkerPointY(entityY) : (entityY + 2.25);
        }

        return {
            runtimeProfile: runtimeProfile,
            getSocketIdentity: getSocketIdentity,
            buildWsEndpoint: buildWsEndpoint,
            getActiveWorldMeta: getActiveWorldMeta,
            damagePointY: damagePointY,
            markerPointY: markerPointY
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetRuntimeAccess = {
        create: create
    };
})();
