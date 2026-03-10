/**
 * lobby-api.js - Shared menu/lobby HTTP helpers.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameLobbyApi
 */
(function () {
    'use strict';

    var GameLobbyApi = {};

    function runtimeProfile() {
        return globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile || null;
    }

    function resolveApiUrl(path) {
        var runtime = runtimeProfile();
        if (runtime && runtime.resolveApiUrl) return runtime.resolveApiUrl(path);
        return path;
    }

    function protocol() {
        return (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol)
            ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol
            : null;
    }

    function partyPath() {
        var cfg = protocol();
        return (cfg && cfg.partyPath) ? cfg.partyPath : '/api/party';
    }

    function privateRoomPath() {
        var cfg = protocol();
        return (cfg && cfg.privateRoomPath) ? cfg.privateRoomPath : '/api/private-room';
    }

    function matchmakingPath() {
        var cfg = protocol();
        return (cfg && cfg.matchmakingPath) ? cfg.matchmakingPath : '/api/matchmaking';
    }

    function friendsPath() {
        var cfg = protocol();
        return (cfg && cfg.friendsPath) ? cfg.friendsPath : '/api/friends';
    }

    function buildRequestError(message, status, url, body) {
        var err = new Error(message || 'Request failed.');
        err.status = Number(status) || 0;
        err.url = String(url || '');
        err.body = body || null;
        err.isMenuRequestError = true;
        return err;
    }

    function readableUrl(url) {
        try {
            var parsed = new URL(String(url || ''), window.location.origin);
            return parsed.pathname + parsed.search;
        } catch (_err) {
            return String(url || '');
        }
    }

    function requestJson(path, options) {
        options = options || {};
        var requestUrl = resolveApiUrl(path);
        return fetch(requestUrl, {
            method: options.method || 'GET',
            headers: options.headers || {},
            credentials: 'include',
            body: options.body
        }).then(function (response) {
            return response.json().catch(function () { return null; }).then(function (body) {
                if (!response.ok || !body || !body.ok) {
                    throw buildRequestError(
                        (body && body.error) || ('HTTP ' + String(response.status) + ' at ' + readableUrl(response.url || requestUrl)),
                        response.status,
                        response.url || requestUrl,
                        body
                    );
                }
                return body;
            });
        }).catch(function (err) {
            if (err && err.isMenuRequestError) throw err;
            throw buildRequestError(
                (err && err.message) ? err.message : 'Network request failed.',
                err && err.status ? err.status : 0,
                requestUrl,
                null
            );
        });
    }

    GameLobbyApi.resolveApiUrl = resolveApiUrl;
    GameLobbyApi.partyPath = partyPath;
    GameLobbyApi.privateRoomPath = privateRoomPath;
    GameLobbyApi.matchmakingPath = matchmakingPath;
    GameLobbyApi.friendsPath = friendsPath;
    GameLobbyApi.requestJson = requestJson;

    globalThis.__MAYHEM_RUNTIME.GameLobbyApi = GameLobbyApi;
})();
