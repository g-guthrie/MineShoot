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

    function wsLobbyPath() {
        var cfg = protocol();
        return (cfg && cfg.wsLobbyPath) ? cfg.wsLobbyPath : '/api/ws/lobby';
    }

    function resolveWsUrl(path) {
        var httpUrl = resolveApiUrl(path);
        return httpUrl.replace(/^http/, 'ws');
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

    function createRequestSignal(options) {
        options = options || {};
        var externalSignal = options.signal || null;
        var timeoutMs = Number(options.timeoutMs);
        var scheduleTimeout = (typeof setTimeout === 'function')
            ? setTimeout
            : ((typeof window !== 'undefined' && window && typeof window.setTimeout === 'function') ? window.setTimeout.bind(window) : null);
        var cancelTimeout = (typeof clearTimeout === 'function')
            ? clearTimeout
            : ((typeof window !== 'undefined' && window && typeof window.clearTimeout === 'function') ? window.clearTimeout.bind(window) : null);
        var supportsAbortController = typeof AbortController === 'function';
        var controller = supportsAbortController ? new AbortController() : null;
        var timerHandle = 0;
        var timedOut = false;
        var onExternalAbort = null;

        if (controller && externalSignal && typeof externalSignal.aborted === 'boolean') {
            if (externalSignal.aborted) {
                try { controller.abort(); } catch (_err) {}
            } else if (typeof externalSignal.addEventListener === 'function') {
                onExternalAbort = function () {
                    try { controller.abort(); } catch (_err) {}
                };
                externalSignal.addEventListener('abort', onExternalAbort, { once: true });
            }
        }

        if (controller && scheduleTimeout && Number.isFinite(timeoutMs) && timeoutMs > 0) {
            timerHandle = scheduleTimeout(function () {
                timedOut = true;
                try { controller.abort(); } catch (_err) {}
            }, timeoutMs);
        }

        return {
            signal: controller
                ? controller.signal
                : (externalSignal || null),
            didTimeout: function () {
                return timedOut;
            },
            cleanup: function () {
                if (timerHandle && cancelTimeout) {
                    cancelTimeout(timerHandle);
                    timerHandle = 0;
                }
                if (externalSignal && onExternalAbort && typeof externalSignal.removeEventListener === 'function') {
                    externalSignal.removeEventListener('abort', onExternalAbort);
                    onExternalAbort = null;
                }
            }
        };
    }

    function requestJson(path, options) {
        options = options || {};
        var requestUrl = resolveApiUrl(path);
        var requestControl = createRequestSignal({
            signal: options.signal || null,
            timeoutMs: Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 8000
        });
        return fetch(requestUrl, {
            method: options.method || 'GET',
            headers: options.headers || {},
            credentials: 'include',
            body: options.body,
            signal: requestControl.signal || undefined
        }).then(function (response) {
            return response.json().catch(function () { return null; }).then(function (body) {
                requestControl.cleanup();
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
            requestControl.cleanup();
            if (err && err.isMenuRequestError) throw err;
            var aborted = !!(
                err && (
                    err.name === 'AbortError' ||
                    err.code === 20 ||
                    err.aborted === true
                )
            );
            if (aborted) {
                var abortErr = buildRequestError(
                    requestControl.didTimeout() ? 'Request timed out.' : 'Request aborted.',
                    0,
                    requestUrl,
                    null
                );
                abortErr.aborted = true;
                abortErr.timedOut = requestControl.didTimeout();
                throw abortErr;
            }
            throw buildRequestError(
                (err && err.message) ? err.message : 'Network request failed.',
                err && err.status ? err.status : 0,
                requestUrl,
                null
            );
        });
    }

    GameLobbyApi.resolveApiUrl = resolveApiUrl;
    GameLobbyApi.resolveWsUrl = resolveWsUrl;
    GameLobbyApi.partyPath = partyPath;
    GameLobbyApi.privateRoomPath = privateRoomPath;
    GameLobbyApi.matchmakingPath = matchmakingPath;
    GameLobbyApi.friendsPath = friendsPath;
    GameLobbyApi.wsLobbyPath = wsLobbyPath;
    GameLobbyApi.requestJson = requestJson;

    globalThis.__MAYHEM_RUNTIME.GameLobbyApi = GameLobbyApi;
})();
