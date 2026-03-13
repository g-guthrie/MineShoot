import { ensureThreeGlobal } from './three-runtime.js';

export function createRetryableMemoizedLoader(factory) {
    var cachedPromise = null;
    return function load() {
        if (!cachedPromise) {
            cachedPromise = Promise.resolve()
                .then(function () {
                    return factory();
                })
                .catch(function (err) {
                    cachedPromise = null;
                    throw err;
                });
        }
        return cachedPromise;
    };
}

/**
 * runtime-loader.js - Lazy runtime loaders for docs and gameplay bundles.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeLoader
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameRuntimeLoader = {};
    function loadThreeGlobal() {
        return ensureThreeGlobal();
    }

    GameRuntimeLoader.loadGameplayRuntime = createRetryableMemoizedLoader(function () {
        return loadThreeGlobal()
            .then(function () {
                return import('./gameplay-modules.js');
            })
            .then(function () {
                return runtime.GameMain || null;
            });
    });

    GameRuntimeLoader.isGameplayRuntimeReady = function () {
        return !!(runtime.GameMain && runtime.GameMain.launchModeById);
    };

    GameRuntimeLoader.loadDocsRuntime = createRetryableMemoizedLoader(function () {
        return import('../runtime/docs.js').then(function () {
            if (runtime.GameDocs && runtime.GameDocs.init) {
                runtime.GameDocs.init();
            }
            return runtime.GameDocs || null;
        });
    });

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
