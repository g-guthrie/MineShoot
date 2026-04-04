/**
 * network-access.js - Runtime-global access and wiring helpers for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetAccess
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create(runtimeNs, deps, options) {
        runtimeNs = runtimeNs || runtime;
        deps = deps || {};
        options = options || {};

        function depGet(name) {
            if (Object.prototype.hasOwnProperty.call(deps, name)) {
                var explicit = deps[name];
                if (explicit != null) return explicit;
            }
            if (runtimeNs && runtimeNs[name] != null) return runtimeNs[name];
            return runtime[name] != null ? runtime[name] : null;
        }

        function readStateValue(state, key, fallback) {
            if (state && typeof state[key] === 'function') {
                var computed = state[key]();
                return computed == null ? fallback : computed;
            }
            if (state && state[key] != null) {
                return state[key];
            }
            return fallback;
        }

        function sharedApi() {
            return depGet('GameShared') || null;
        }

        function protocolConfig() {
            var shared = sharedApi();
            return shared && shared.protocol ? shared.protocol : null;
        }

        function authApi() {
            return depGet('GameNetAuth') || null;
        }

        function runtimeProfile() {
            return depGet('GameRuntimeProfile') || null;
        }

        function playerApi() {
            return depGet('GamePlayer') || null;
        }

        function playerCombatApi() {
            return depGet('GamePlayerCombat') || null;
        }

        function transportApi() {
            return depGet('GameNetTransport') || null;
        }

        function remoteSyncApi() {
            return depGet('GameNetRemoteSync') || null;
        }

        function hitscanApi() {
            return depGet('GameHitscan') || null;
        }

        function socketIdentity() {
            var auth = authApi();
            if (auth && auth.getSocketIdentity) return auth.getSocketIdentity();
            return auth && auth.getUser ? auth.getUser() : null;
        }

        function currentUser() {
            var auth = authApi();
            if (auth && auth.getCurrentUser) return auth.getCurrentUser();
            return socketIdentity();
        }

        function activeWorldMeta() {
            var worldApi = depGet('GameWorld') || null;
            return worldApi && worldApi.getWorldMeta ? worldApi.getWorldMeta() : null;
        }

        function entityPoints() {
            var shared = sharedApi();
            return shared && shared.entityPoints ? shared.entityPoints : {};
        }

        function damagePointY(entityY) {
            var points = entityPoints();
            return points.entityDamagePointY ? points.entityDamagePointY(entityY) : (entityY + 1.06);
        }

        function markerPointY(entityY) {
            var points = entityPoints();
            return points.entityMarkerPointY ? points.entityMarkerPointY(entityY) : (entityY + 2.25);
        }

        function resolveWsPath(state) {
            var protocol = protocolConfig();
            var path = readStateValue(state, 'wsPath', null);
            if (path != null && path !== '') return String(path);
            return protocol && protocol.wsPath ? String(protocol.wsPath) : '/ws';
        }

        function locationRef() {
            if (options.location) return options.location;
            if (typeof window !== 'undefined' && window && window.location) return window.location;
            if (globalThis.location) return globalThis.location;
            return {
                protocol: 'https:',
                host: 'localhost'
            };
        }

        function resolveWsBase(state) {
            var profile = readStateValue(state, 'runtimeProfile', null) || runtimeProfile();
            var wsPath = resolveWsPath(state);
            if (state && state.baseEndpoint != null && state.baseEndpoint !== '') {
                return String(state.baseEndpoint);
            }
            if (profile && profile.resolveWsUrl) {
                return String(profile.resolveWsUrl(wsPath));
            }
            var loc = locationRef();
            var protocol = String(loc && loc.protocol || '') === 'https:' ? 'wss:' : 'ws:';
            return protocol + '//' + String(loc && loc.host || 'localhost') + wsPath;
        }

        function buildWsParams(state) {
            state = state || {};
            var params = new URLSearchParams();
            var auth = authApi();
            var roomId = readStateValue(state, 'roomId', null);
            if (roomId == null) roomId = readStateValue(state, 'getRoomId', 'global');
            params.set('room', String(roomId || 'global'));

            var socketPlayerId = readStateValue(state, 'socketPlayerId', null);
            if (socketPlayerId == null && auth && auth.getSocketPlayerId) {
                socketPlayerId = auth.getSocketPlayerId();
            }
            if (socketPlayerId != null) {
                params.set('pid', String(socketPlayerId || ''));
            }

            var actor = readStateValue(state, 'actorIdentity', null);
            if (!actor) actor = readStateValue(state, 'getActorIdentity', null);
            if (!actor && auth && auth.getPartyIdentity) {
                actor = auth.getPartyIdentity();
            }
            if (actor && actor.id) {
                params.set('actorId', String(actor.id));
                params.set('actorName', String(actor.username || actor.displayName || actor.id));
            }

            var user = readStateValue(state, 'socketIdentity', null);
            if (!user) user = readStateValue(state, 'getSocketIdentity', null);
            if (!user) user = socketIdentity();
            if (user && user.id) {
                params.set('uid', String(user.id));
                params.set('username', String(user.username || user.displayName || user.id));
                params.set('classId', String(user.classId || 'ffa'));
            }

            var extraParams = readStateValue(state, 'params', null);
            if (extraParams && typeof extraParams === 'object') {
                var keys = Object.keys(extraParams);
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    var value = extraParams[key];
                    if (value == null) continue;
                    params.set(key, String(value));
                }
            }

            return params;
        }

        function buildWsEndpoint(state) {
            var endpoint = resolveWsBase(state);
            var params = buildWsParams(state);
            var query = params.toString();
            if (!query) return endpoint;
            return endpoint + (endpoint.indexOf('?') >= 0 ? '&' : '?') + query;
        }

        return {
            depGet: depGet,
            sharedApi: sharedApi,
            protocolConfig: protocolConfig,
            authApi: authApi,
            runtimeProfile: runtimeProfile,
            playerApi: playerApi,
            playerCombatApi: playerCombatApi,
            transportApi: transportApi,
            remoteSyncApi: remoteSyncApi,
            hitscanApi: hitscanApi,
            socketIdentity: socketIdentity,
            currentUser: currentUser,
            activeWorldMeta: activeWorldMeta,
            entityPoints: entityPoints,
            damagePointY: damagePointY,
            markerPointY: markerPointY,
            resolveWsPath: resolveWsPath,
            resolveWsBase: resolveWsBase,
            buildWsParams: buildWsParams,
            buildWsEndpoint: buildWsEndpoint
        };
    }

    runtime.GameNetAccess = {
        create: create
    };
})();
