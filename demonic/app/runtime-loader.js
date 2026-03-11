(function () {
    'use strict';

    var demonicRuntime = globalThis.__DEMONIC_RUNTIME = globalThis.__DEMONIC_RUNTIME || {};
    var GameRuntimeLoader = {};
    var gameplayPromise = null;
    var threeScriptPromise = null;
    var threeScriptUrl = new URL(/* @vite-ignore */ '../../public/vendor/three.min.js', import.meta.url).toString();

    function loadThreeGlobal() {
        if (globalThis.THREE) return Promise.resolve(globalThis.THREE);
        if (!threeScriptPromise) {
            threeScriptPromise = new Promise(function (resolve, reject) {
                var existing = document.querySelector('script[data-demonic-three="true"]');
                if (existing) {
                    existing.addEventListener('load', function () { resolve(globalThis.THREE || null); }, { once: true });
                    existing.addEventListener('error', function () { reject(new Error('Three.js failed to load.')); }, { once: true });
                    return;
                }

                var script = document.createElement('script');
                script.src = threeScriptUrl;
                script.async = true;
                script.dataset.demonicThree = 'true';
                script.addEventListener('load', function () {
                    if (!globalThis.THREE) {
                        reject(new Error('Three.js did not initialize.'));
                        return;
                    }
                    resolve(globalThis.THREE);
                }, { once: true });
                script.addEventListener('error', function () {
                    reject(new Error('Three.js failed to load.'));
                }, { once: true });
                document.head.appendChild(script);
            });
        }
        return threeScriptPromise;
    }

    GameRuntimeLoader.loadGameplayRuntime = function () {
        if (!gameplayPromise) {
            gameplayPromise = loadThreeGlobal()
                .then(function () {
                    return import('../runtime/modules.js');
                })
                .then(function () {
                    return demonicRuntime.GameMain || null;
                });
        }
        return gameplayPromise;
    };

    GameRuntimeLoader.isGameplayRuntimeReady = function () {
        return !!(demonicRuntime.GameMain && demonicRuntime.GameMain.launchModeById);
    };

    demonicRuntime.GameRuntimeLoader = GameRuntimeLoader;
})();
