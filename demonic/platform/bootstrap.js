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
            host.innerHTML = '' +
                '<div id="demonic-runtime-status"></div>' +
                '<div id="demonic-runtime-scene"></div>';
            appRoot.appendChild(host);
        }
        return host;
    }

    function ensureChild(host, id) {
        if (!host) return null;
        var child = document.getElementById(id);
        if (!child) {
            child = document.createElement('div');
            child.id = id;
            host.appendChild(child);
        }
        return child;
    }

    demonicRuntime.GameBootstrap = {
        ensureRuntimeHost: ensureRuntimeHost,
        getRuntimeStatusHost: function () {
            return ensureChild(ensureRuntimeHost(), 'demonic-runtime-status');
        },
        getRuntimeSceneHost: function () {
            return ensureChild(ensureRuntimeHost(), 'demonic-runtime-scene');
        },
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
            if (host) {
                var statusHost = ensureChild(host, 'demonic-runtime-status');
                var sceneHost = ensureChild(host, 'demonic-runtime-scene');
                if (statusHost) statusHost.innerHTML = '';
                if (sceneHost) sceneHost.innerHTML = '';
            }
            return host;
        }
    };
})();
