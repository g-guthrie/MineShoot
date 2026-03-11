(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};

    function ensureRuntimeHost() {
        var appRoot = document.getElementById('demonic-root');
        if (!appRoot) return null;

        var host = document.getElementById('demonic-runtime-host');
        if (!host) {
            host = document.createElement('section');
            host.id = 'demonic-runtime-host';
            host.hidden = true;
            appRoot.appendChild(host);
        }
        return host;
    }

    demonicRuntime.GameBootstrap = {
        ensureRuntimeHost: ensureRuntimeHost,
        showRuntimeHost: function () {
            var host = ensureRuntimeHost();
            if (host) host.hidden = false;
            return host;
        },
        hideRuntimeHost: function () {
            var host = ensureRuntimeHost();
            if (host) host.hidden = true;
            return host;
        },
        clearRuntimeHost: function () {
            var host = ensureRuntimeHost();
            if (host) host.innerHTML = '';
            return host;
        }
    };
})();
