/**
 * runtime-loader.js - Lazy runtime loaders for docs and gameplay bundles.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeLoader
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameRuntimeLoader = {};
    var gameplayPromise = null;
    var docsPromise = null;
    var threeScriptPromise = null;
    var threeScriptUrl = '/vendor/three.min.js';

    function loadThreeGlobal() {
        if (globalThis.THREE) return Promise.resolve(globalThis.THREE);
        if (!threeScriptPromise) {
            threeScriptPromise = new Promise(function (resolve, reject) {
                var existing = document.querySelector('script[data-mayhem-three="true"]');
                if (existing) {
                    existing.addEventListener('load', function () { resolve(globalThis.THREE || null); }, { once: true });
                    existing.addEventListener('error', function () { reject(new Error('Three.js failed to load.')); }, { once: true });
                    return;
                }

                var script = document.createElement('script');
                script.src = threeScriptUrl;
                script.async = true;
                script.dataset.mayhemThree = 'true';
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
                    return import('./gameplay-modules.js');
                })
                .then(function () {
                    return runtime.GameMain || null;
                });
        }
        return gameplayPromise;
    };

    GameRuntimeLoader.isGameplayRuntimeReady = function () {
        return !!(runtime.GameMain && runtime.GameMain.launchModeById);
    };

    GameRuntimeLoader.loadDocsRuntime = function () {
        if (!docsPromise) {
            docsPromise = import('../docs.js').then(function () {
                if (runtime.GameDocs && runtime.GameDocs.init) {
                    runtime.GameDocs.init();
                }
                return runtime.GameDocs || null;
            });
        }
        return docsPromise;
    };

    GameRuntimeLoader.toggleDocs = function (triggerEl) {
        return GameRuntimeLoader.loadDocsRuntime().then(function (docsApi) {
            if (!docsApi) return null;
            if (docsApi.isOpen && docsApi.isOpen()) {
                if (docsApi.close) docsApi.close();
            } else if (docsApi.open) {
                docsApi.open(triggerEl || document.activeElement || null);
            }
            return docsApi;
        });
    };

    runtime.GameRuntimeLoader = GameRuntimeLoader;
})();
