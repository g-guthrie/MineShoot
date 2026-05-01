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

export function resolveGameplayRuntimeApi(moduleNs) {
    var moduleApi = moduleNs && moduleNs.gameplayRuntimeApi
        ? moduleNs.gameplayRuntimeApi
        : (moduleNs && moduleNs.default ? moduleNs.default : null);
    return moduleApi && moduleApi.launchModeById ? moduleApi : null;
}

export function resolveDocsRuntimeApi(moduleNs) {
    var moduleApi = null;
    if (moduleNs && typeof moduleNs.getDocsRuntimeApi === 'function') {
        moduleApi = moduleNs.getDocsRuntimeApi();
    } else if (moduleNs && moduleNs.docsRuntimeApi) {
        moduleApi = moduleNs.docsRuntimeApi;
    } else if (moduleNs && moduleNs.default) {
        moduleApi = moduleNs.default;
    }
    return moduleApi && (moduleApi.init || moduleApi.open || moduleApi.toggle) ? moduleApi : null;
}

/**
 * runtime-loader.js - Lazy runtime loaders for docs and gameplay bundles.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeLoader
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameRuntimeLoader = {};
    var loadedGameplayRuntimeApi = null;
    var loadedDocsRuntimeApi = null;
    function loadThreeGlobal() {
        return ensureThreeGlobal();
    }

    GameRuntimeLoader.loadGameplayRuntime = createRetryableMemoizedLoader(function () {
        return loadThreeGlobal()
            .then(function () {
                return import('./gameplay-modules.js');
            })
            .then(function (moduleNs) {
                if (runtime.GameBoxmanRig && runtime.GameBoxmanRig.preload) {
                    return runtime.GameBoxmanRig.preload().then(function () {
                        return moduleNs;
                    });
                }
                return moduleNs;
            })
            .then(function (moduleNs) {
                loadedGameplayRuntimeApi = resolveGameplayRuntimeApi(moduleNs);
                return loadedGameplayRuntimeApi;
            });
    });

    GameRuntimeLoader.isGameplayRuntimeReady = function () {
        return !!(loadedGameplayRuntimeApi && loadedGameplayRuntimeApi.launchModeById);
    };

    GameRuntimeLoader.getLoadedGameplayRuntime = function () {
        return loadedGameplayRuntimeApi || null;
    };

    GameRuntimeLoader.loadDocsRuntime = createRetryableMemoizedLoader(function () {
        return import('../runtime/docs-runtime.js').then(function (moduleNs) {
            loadedDocsRuntimeApi = resolveDocsRuntimeApi(moduleNs);
            if (loadedDocsRuntimeApi && loadedDocsRuntimeApi.init) {
                loadedDocsRuntimeApi.init();
            }
            return loadedDocsRuntimeApi;
        });
    });

    GameRuntimeLoader.getLoadedDocsRuntime = function () {
        return loadedDocsRuntimeApi || null;
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
