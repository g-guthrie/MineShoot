/**
 * runtime-utils.js - Shared low-level runtime helpers.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeUtils
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    if (runtime.GameRuntimeUtils && runtime.GameRuntimeUtils.sanitizeRoomId) return;

    function protocolConfig() {
        return (runtime.GameShared && runtime.GameShared.protocol)
            ? runtime.GameShared.protocol
            : null;
    }

    function sanitizeRoomId(raw, fallbackId) {
        var protocol = protocolConfig();
        if (protocol && typeof protocol.sanitizeRoomId === 'function') {
            return protocol.sanitizeRoomId(raw);
        }
        var fallback = String(fallbackId == null ? 'global' : fallbackId).toLowerCase().trim();
        var id = String(raw || '').toLowerCase().trim();
        id = id.replace(/[^a-z0-9-]/g, '');
        if (!id) return fallback || 'global';
        if (id.length > 32) id = id.slice(0, 32);
        return id;
    }

    function randomToken(prefix) {
        if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
            return String(prefix || '') + globalThis.crypto.randomUUID().replace(/-/g, '');
        }
        return String(prefix || '') + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    runtime.GameRuntimeUtils = {
        protocolConfig: protocolConfig,
        sanitizeRoomId: sanitizeRoomId,
        randomToken: randomToken
    };
})();
