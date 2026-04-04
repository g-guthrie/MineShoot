/**
 * runtime-coordinator-ui.js - UI and launch-error helpers for GameRuntimeCoordinator.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinatorUi
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var LAUNCH_ERROR_KEY = 'mayhem.launchError';

    function create(options) {
        options = options || {};
        var debugTimer = null;

        function sessionStore() {
            try {
                return window.sessionStorage || null;
            } catch (_err) {
                return null;
            }
        }

        function persistLaunchError(message) {
            var store = sessionStore();
            if (!store) return;
            try {
                store.setItem(LAUNCH_ERROR_KEY, String(message || 'Room join failed.'));
            } catch (_err) {
                // no-op
            }
        }

        function applyBrandingOverrides() {
            document.title = 'PvP by Greer';
            var modeTitle = document.getElementById('mode-screen-title');
            if (modeTitle) modeTitle.textContent = 'PvP by Greer';
            var docsTitle = document.getElementById('docs-title');
            if (docsTitle) {
                docsTitle.textContent = String(docsTitle.textContent || '').replace(/minecraft fps|mayhem/ig, 'PvP by Greer');
            }
        }

        function setTransientDebug(text, ms) {
            var uiApi = options.getGameUiApi ? options.getGameUiApi() : null;
            if (!uiApi || !uiApi.setDebugInfo) return;
            uiApi.setDebugInfo(text || '');
            if (debugTimer) clearTimeout(debugTimer);
            if (!text) {
                debugTimer = null;
                return;
            }
            debugTimer = setTimeout(function () {
                uiApi.setDebugInfo('');
                debugTimer = null;
            }, ms || 1000);
        }

        function setIdleWarning(text) {
            var uiApi = options.getGameUiApi ? options.getGameUiApi() : null;
            if (uiApi && uiApi.setIdleWarning) uiApi.setIdleWarning(text || '');
        }

        function setRuntimeIndicator(mode) {
            var modeUi = options.getRuntimeModeUi ? options.getRuntimeModeUi() : null;
            var actionsApi = options.getMatchActionsApi ? options.getMatchActionsApi() : null;
            if (modeUi && modeUi.setRuntimeIndicator) {
                modeUi.setRuntimeIndicator(mode, {
                    debugActive: !!(actionsApi && actionsApi.isDebugVisualsOn && actionsApi.isDebugVisualsOn())
                });
            }
        }

        function showOverlay() {
            var overlayEl = document.getElementById('overlay');
            if (document && document.body && document.body.setAttribute) {
                document.body.setAttribute('data-overlay-active', 'true');
            }
            if (!overlayEl) return;
            overlayEl.hidden = false;
            overlayEl.style.display = 'flex';
        }

        function hardResetFailedNetworkLaunch(message) {
            var msg = String(message || 'Room join failed.');
            persistLaunchError(msg);
            var dbg = document.getElementById('debug-info');
            if (dbg) dbg.textContent = 'Startup error: ' + msg;
            var runtimeProfileApi = options.getRuntimeProfile ? options.getRuntimeProfile() : null;
            if (runtimeProfileApi && runtimeProfileApi.clearSelectedMode) {
                runtimeProfileApi.clearSelectedMode();
            }
            if (window.location) {
                window.location.href = (window.location && window.location.pathname) ? window.location.pathname : '/';
            }
        }

        return {
            persistLaunchError: persistLaunchError,
            applyBrandingOverrides: applyBrandingOverrides,
            setTransientDebug: setTransientDebug,
            setIdleWarning: setIdleWarning,
            setRuntimeIndicator: setRuntimeIndicator,
            showOverlay: showOverlay,
            hardResetFailedNetworkLaunch: hardResetFailedNetworkLaunch
        };
    }

    runtime.GameRuntimeCoordinatorUi = {
        create: create
    };
})();
