(function () {
    'use strict';

    var GameRuntimeProfile = {};
    var protocol = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol)
        ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol
        : null;

    var PROD_WORKER_ORIGIN = 'https://mayhem.gguthrie-minecraft-fps.workers.dev';
    var LOCAL_WORKER_ORIGIN = 'http://127.0.0.1:8787';
    var ROOM_STORAGE_PREFIX = 'mayhem.runtime.room.';
    var DEFAULT_MODE_ID = 'cloud_multiplayer';

    var selectedModeId = '';

    var MODE_DEFS = {
        cloud_multiplayer: {
            id: 'cloud_multiplayer',
            label: 'Multiplayer Cloudflare',
            menuTitle: 'MULTIPLAYER CLOUDFLARE',
            menuDesc: 'Shared global room on the deployed Cloudflare worker.',
            backendKind: 'cloudflare-prod',
            backendLabel: 'CLOUDFLARE PROD',
            authorityMode: 'networked',
            authMode: 'guest',
            roomStrategy: 'global',
            roomPrefix: '',
            visible: 'always'
        },
        single_cloudflare: {
            id: 'single_cloudflare',
            label: 'Single Cloudflare',
            menuTitle: 'SINGLE CLOUDFLARE',
            menuDesc: 'Private per-tab room on the deployed Cloudflare worker.',
            backendKind: 'cloudflare-prod',
            backendLabel: 'CLOUDFLARE PROD',
            authorityMode: 'networked',
            authMode: 'guest',
            roomStrategy: 'private',
            roomPrefix: 'cf-solo',
            visible: 'always'
        },
        single_dev_server: {
            id: 'single_dev_server',
            label: 'Solo Dev Server',
            menuTitle: 'SOLO DEV SERVER',
            menuDesc: 'Shared fixed room on the local Wrangler worker.',
            backendKind: 'local-worker',
            backendLabel: 'LOCAL WORKER',
            authorityMode: 'networked',
            authMode: 'guest',
            roomStrategy: 'fixed',
            roomPrefix: '',
            fixedRoomId: 'local-shared',
            visible: 'local-only'
        },
        single_full_sandbox: {
            id: 'single_full_sandbox',
            label: 'Single Full Sandbox',
            menuTitle: 'SINGLE FULL SANDBOX',
            menuDesc: 'Offline experimental sandbox. Not authoritative.',
            backendKind: 'sandbox',
            backendLabel: 'OFFLINE SANDBOX',
            authorityMode: 'offline',
            authMode: 'none',
            roomStrategy: 'none',
            roomPrefix: '',
            visible: 'always'
        }
    };

    function sanitizeRoomId(raw) {
        if (protocol && typeof protocol.sanitizeRoomId === 'function') {
            return protocol.sanitizeRoomId(raw);
        }
        var id = String(raw || '').toLowerCase().trim();
        id = id.replace(/[^a-z0-9-]/g, '');
        if (!id) return 'global';
        if (id.length > 32) id = id.slice(0, 32);
        return id;
    }

    function cloneMode(mode) {
        if (!mode) return null;
        return {
            id: mode.id,
            label: mode.label,
            menuTitle: mode.menuTitle,
            menuDesc: mode.menuDesc,
            backendKind: mode.backendKind,
            backendLabel: mode.backendLabel,
            authorityMode: mode.authorityMode,
            authMode: mode.authMode,
            roomStrategy: mode.roomStrategy,
            roomPrefix: mode.roomPrefix,
            fixedRoomId: mode.fixedRoomId || '',
            apiOrigin: mode.apiOrigin || '',
            backendOrigin: mode.backendOrigin || '',
            roomId: mode.roomId || '',
            visible: mode.visible
        };
    }

    function isAbsoluteUrl(raw) {
        return /^[a-z][a-z0-9+.-]*:\/\//i.test(String(raw || ''));
    }

    function getSearchParams() {
        try {
            return new URLSearchParams(window.location.search || '');
        } catch (err) {
            return null;
        }
    }

    function isLocalHost(hostname) {
        var host = String(hostname || '').toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
    }

    function isLocalEnvironment() {
        if (window.location.protocol === 'file:') return true;
        if (isLocalHost(window.location.hostname)) return true;
        return false;
    }

    function isHttpEnvironment() {
        return window.location.protocol === 'http:' || window.location.protocol === 'https:';
    }

    function backendOriginFor(kind) {
        if (kind === 'cloudflare-prod') return PROD_WORKER_ORIGIN;
        // Keep local authoritative multiplayer pinned to the Wrangler worker.
        // The frontend may be served from a different local port (for example Vite),
        // but the room websocket/API still needs to land on the same worker backend.
        if (kind === 'local-worker') return LOCAL_WORKER_ORIGIN;
        return '';
    }

    function sessionStore() {
        try {
            return window.sessionStorage || null;
        } catch (err) {
            return null;
        }
    }

    function randomRoomSuffix() {
        if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
            return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10).toLowerCase();
        }
        return Math.random().toString(36).slice(2, 12).toLowerCase();
    }

    function storedPrivateRoom(modeId, prefix) {
        var store = sessionStore();
        var key = ROOM_STORAGE_PREFIX + String(modeId || '');
        var existing = store ? sanitizeRoomId(store.getItem(key) || '') : '';
        if (existing) return existing;

        var created = sanitizeRoomId(String(prefix || 'room') + '-' + randomRoomSuffix());
        if (store) {
            try {
                store.setItem(key, created);
            } catch (err) {
                // no-op
            }
        }
        return created;
    }

    function requestedRoomId() {
        var params = getSearchParams();
        if (!params) return '';
        var requested = params.get('room');
        if (requested === null || requested === undefined) return '';
        if (!String(requested).trim()) return '';
        return sanitizeRoomId(requested);
    }

    function requestedModeId() {
        var params = getSearchParams();
        if (!params) return '';

        var explicit = String(params.get('mode') || '').trim().toLowerCase();
        if (explicit) {
            if (explicit === 'multiplayer' || explicit === 'cloud_multiplayer') return 'cloud_multiplayer';
            if (explicit === 'single_cloudflare' || explicit === 'cloud_single') return 'single_cloudflare';
            if (explicit === 'single_dev_server' || explicit === 'dev_server' || explicit === 'singleplayer_server') return 'single_dev_server';
            if (explicit === 'single_full_sandbox' || explicit === 'sandbox' || explicit === 'singleplayer_local') return 'single_full_sandbox';
        }

        if (params.get('net') === '1') return 'cloud_multiplayer';
        if (params.get('offline') === '1' || params.get('local') === '1') return 'single_full_sandbox';
        return '';
    }

    function isModeVisible(modeId) {
        var def = MODE_DEFS[modeId];
        if (!def) return false;
        if (def.visible === 'local-only') return isLocalEnvironment();
        return true;
    }

    function resolveRoomId(def) {
        if (!def || def.roomStrategy === 'none') return '';

        if (def.roomStrategy === 'fixed') {
            return sanitizeRoomId(def.fixedRoomId || 'local-shared');
        }

        var requested = requestedRoomId();
        if (requested) return requested;

        if (def.roomStrategy === 'global') return 'global';
        if (def.roomStrategy === 'private') return storedPrivateRoom(def.id, def.roomPrefix || 'room');
        return '';
    }

    function resolveMode(modeId) {
        var def = MODE_DEFS[modeId];
        if (!def || !isModeVisible(modeId)) return null;

        var backendOrigin = backendOriginFor(def.backendKind);
        return cloneMode({
            id: def.id,
            label: def.label,
            menuTitle: def.menuTitle,
            menuDesc: def.menuDesc,
            backendKind: def.backendKind,
            backendLabel: def.backendLabel,
            authorityMode: def.authorityMode,
            authMode: def.authMode,
            roomStrategy: def.roomStrategy,
            roomPrefix: def.roomPrefix,
            apiOrigin: backendOrigin,
            backendOrigin: backendOrigin,
            roomId: resolveRoomId(def),
            visible: true
        });
    }

    function selectedOrDefaultMode() {
        var resolved = selectedModeId ? resolveMode(selectedModeId) : null;
        if (resolved) return resolved;

        var requested = requestedModeId();
        if (requested) {
            resolved = resolveMode(requested);
            if (resolved) return resolved;
        }

        return resolveMode(DEFAULT_MODE_ID);
    }

    function absolutize(path, base) {
        if (!path) return '';
        if (isAbsoluteUrl(path)) return String(path);
        return new URL(String(path), String(base)).toString();
    }

    GameRuntimeProfile.isLocalEnvironment = isLocalEnvironment;

    GameRuntimeProfile.requestedRoomId = function () {
        return requestedRoomId();
    };

    GameRuntimeProfile.getRequestedModeId = function () {
        return requestedModeId();
    };

    GameRuntimeProfile.getAvailableModes = function () {
        return [
            resolveMode('cloud_multiplayer'),
            resolveMode('single_cloudflare'),
            resolveMode('single_dev_server'),
            resolveMode('single_full_sandbox')
        ].filter(Boolean);
    };

    GameRuntimeProfile.getMode = function (modeId) {
        return resolveMode(modeId);
    };

    GameRuntimeProfile.selectMode = function (modeId) {
        var resolved = resolveMode(modeId);
        if (!resolved) return null;
        selectedModeId = resolved.id;
        return cloneMode(resolved);
    };

    GameRuntimeProfile.clearSelectedMode = function () {
        selectedModeId = '';
    };

    GameRuntimeProfile.getSelectedMode = function () {
        return selectedModeId ? resolveMode(selectedModeId) : null;
    };

    GameRuntimeProfile.resolveApiUrl = function (path) {
        if (!path) return '';
        if (isAbsoluteUrl(path)) return String(path);

        var mode = selectedOrDefaultMode();
        var base = (mode && mode.apiOrigin) ? mode.apiOrigin : (isHttpEnvironment() ? String(window.location.origin || '') : LOCAL_WORKER_ORIGIN);
        return absolutize(path, base);
    };

    GameRuntimeProfile.resolveWsUrl = function (path) {
        if (!path) return '';
        if (/^wss?:\/\//i.test(String(path))) return String(path);

        var mode = selectedOrDefaultMode();
        var base = (mode && mode.backendOrigin) ? mode.backendOrigin : (isHttpEnvironment() ? String(window.location.origin || '') : LOCAL_WORKER_ORIGIN);
        var wsBase = String(base).replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
        return absolutize(path, wsBase);
    };

    globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile = GameRuntimeProfile;
})();
