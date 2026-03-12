/**
 * mode-flow.js - Mode/query helpers and menu boot orchestration.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameModeFlow
 */
(function () {
    'use strict';

    var GameModeFlow = {};
    var protocol = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol)
        ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol
        : null;

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

    function runtimeProfile() {
        return globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile || null;
    }

    GameModeFlow.isLocalDevMode = function () {
        var runtime = runtimeProfile();
        if (runtime && runtime.isLocalEnvironment) return runtime.isLocalEnvironment();
        var host = (window.location.hostname || '').toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
        try {
            var params = new URLSearchParams(window.location.search || '');
            if (params.get('net') === '1') return false;
        } catch (err) {
            // no-op
        }
        return window.location.protocol === 'file:';
    };

    GameModeFlow.wantsGuestNetMode = function () {
        var runtime = runtimeProfile();
        if (runtime && runtime.getRequestedModeId) return !!runtime.getRequestedModeId();
        try {
            var params = new URLSearchParams(window.location.search || '');
            return params.get('net') === '1';
        } catch (err) {
            return false;
        }
    };

    GameModeFlow.requestedRoomId = function () {
        var runtime = runtimeProfile();
        if (runtime && runtime.requestedRoomId) return runtime.requestedRoomId();
        try {
            var params = new URLSearchParams(window.location.search || '');
            var requested = params.get('room');
            if (requested === null || requested === undefined) return '';
            if (!String(requested).trim()) return '';
            return sanitizeRoomId(requested);
        } catch (err) {
            return '';
        }
    };

    globalThis.__MAYHEM_RUNTIME.GameModeFlow = GameModeFlow;
})();
