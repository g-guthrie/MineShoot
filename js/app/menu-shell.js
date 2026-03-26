/**
 * menu-shell.js - Menu-only bootstrap and lazy runtime bridge.
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var domUtils = runtime.GameDomUtils || null;
    var menuBootReleased = false;

    function releaseMenuBoot() {
        if (menuBootReleased) return;
        menuBootReleased = true;
        if (document.body) {
            document.body.classList.remove('menu-booting');
        }
    }

    function scheduleMenuBootRelease() {
        function releaseAfterPaint() {
            if (typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(function () {
                    window.requestAnimationFrame(releaseMenuBoot);
                });
                return;
            }
            releaseMenuBoot();
        }

        var fallbackTimer = window.setTimeout(releaseAfterPaint, 700);
        if (!document.fonts || !document.fonts.ready || typeof document.fonts.ready.then !== 'function') {
            return;
        }
        document.fonts.ready
            .then(function () {
                window.clearTimeout(fallbackTimer);
                releaseAfterPaint();
            })
            .catch(function () {
                window.clearTimeout(fallbackTimer);
                releaseAfterPaint();
            });
    }

    function applyBrandingOverrides() {
        document.title = 'PvP';
        var modeTitle = document.getElementById('mode-screen-title');
        if (modeTitle) {
            modeTitle.textContent = 'PvP';
        }
        var docsTitle = document.getElementById('docs-title');
        if (docsTitle) {
            docsTitle.textContent = String(docsTitle.textContent || '').replace(/minecraft fps|mayhem/ig, 'PvP');
        }
    }

    function setRuntimeIndicator(mode) {
        var helper = runtime.GameRuntimeModeUi || null;
        if (helper && helper.setRuntimeIndicator) {
            helper.setRuntimeIndicator(mode, { debugActive: false });
        }
    }

    function runtimeLoaderApi() {
        return runtime.GameRuntimeLoader || null;
    }

    function gameplayRuntimeApi() {
        var loader = runtimeLoaderApi();
        if (loader && loader.getLoadedGameplayRuntime) {
            var loadedApi = loader.getLoadedGameplayRuntime();
            if (loadedApi) return loadedApi;
        }
        return null;
    }

    function currentGameplayActivityState() {
        var gameplayApi = gameplayRuntimeApi();
        if (gameplayApi && gameplayApi.getActivityState) {
            return gameplayApi.getActivityState();
        }
        return 'menu';
    }

    function bindDocsControls() {
        var pauseOpenBtnEl = document.getElementById('open-manual-btn');
        var hudOpenBtnEl = document.getElementById('hud-manual-btn');

        function openDocs(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!runtime.GameRuntimeLoader || !runtime.GameRuntimeLoader.toggleDocs) return;
            runtime.GameRuntimeLoader.toggleDocs(event && event.currentTarget ? event.currentTarget : null);
        }

        if (pauseOpenBtnEl && !pauseOpenBtnEl.__docsBound) {
            pauseOpenBtnEl.__docsBound = true;
            pauseOpenBtnEl.addEventListener('click', openDocs);
        }

        if (hudOpenBtnEl && !hudOpenBtnEl.__docsBound) {
            hudOpenBtnEl.__docsBound = true;
            hudOpenBtnEl.addEventListener('click', openDocs);
        }

        if (!window.__mayhemDocsKeyBound) {
            window.__mayhemDocsKeyBound = true;
            document.addEventListener('keydown', function (event) {
                var inputBindings = runtime.GameInputBindings || null;
                if (inputBindings && inputBindings.matches) {
                    if (!inputBindings.matches('open_manual', event)) return;
                } else if (event.code !== 'KeyI') {
                    return;
                }
                if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(event.target)) return;
                openDocs(event);
            });
        }
    }

    function prepareMenuUi() {
        applyBrandingOverrides();
        setRuntimeIndicator(null);
        if (runtime.GameMenuLoadout && runtime.GameMenuLoadout.init) {
            runtime.GameMenuLoadout.init();
        }
        if (runtime.GameInputBindingsUi && runtime.GameInputBindingsUi.init) {
            runtime.GameInputBindingsUi.init();
        }
        if (runtime.GameNetAuth && runtime.GameNetAuth.initMenuAuth) {
            runtime.GameNetAuth.initMenuAuth();
        }
        bindDocsControls();
    }

    function launchModeById(modeId, options) {
        options = options || {};
        var gameplayApi = gameplayRuntimeApi();
        if (gameplayApi && gameplayApi.launchModeById) {
            return gameplayApi.launchModeById(modeId, options);
        }
        var loader = runtimeLoaderApi();
        if (!loader || !loader.loadGameplayRuntime) {
            return Promise.resolve({ ok: false, error: 'Gameplay runtime loader unavailable.' });
        }
        return loader.loadGameplayRuntime().then(function (loadedGameplayApi) {
            if (!loadedGameplayApi || !loadedGameplayApi.launchModeById) {
                return { ok: false, error: 'Gameplay launcher unavailable.' };
            }
            return loadedGameplayApi.launchModeById(modeId, options);
        }).catch(function (err) {
            return {
                ok: false,
                error: (err && err.message) ? err.message : 'Gameplay runtime failed to load.'
            };
        });
    }

    function boot() {
        scheduleMenuBootRelease();

        if (runtime.GameLobbyController && runtime.GameLobbyController.init) {
            runtime.GameLobbyController.init({
                deps: runtime.GameLobbyControllerDeps || null,
                prepareMenu: prepareMenuUi,
                setRuntimeIndicator: setRuntimeIndicator,
                launchModeById: launchModeById,
                getActivityState: currentGameplayActivityState
            });
            return;
        }

        prepareMenuUi();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
