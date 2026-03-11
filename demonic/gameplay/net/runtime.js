(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var mayhemRuntime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create(context) {
        context = context || {};
        var mode = context.mode || null;
        var profile = mayhemRuntime.GameRuntimeProfile || null;
        var roomId = String(context.context && context.context.roomId || mode && mode.roomId || '');
        var authorityMode = String(mode && mode.authorityMode || 'offline');
        var backendKind = String(mode && mode.backendKind || '');
        var apiBase = profile && profile.resolveApiUrl ? profile.resolveApiUrl('/api') : '';
        var wsBase = profile && profile.resolveWsUrl ? profile.resolveWsUrl('/api/room') : '';

        return {
            update: function (_dt) {},
            getSnapshot: function () {
                return {
                    authorityMode: authorityMode,
                    backendKind: backendKind,
                    roomId: roomId,
                    authoritative: authorityMode === 'networked',
                    apiBase: String(apiBase || ''),
                    wsBase: String(wsBase || ''),
                    status: authorityMode === 'networked'
                        ? 'authoritative cloudflare lane'
                        : 'local fallback lane'
                };
            }
        };
    }

    demonicRuntime.GameNetRuntime = {
        create: create
    };
})();
