/**
 * runtime-coordinator.js - App-owned gameplay runtime coordinator.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var LAUNCH_ERROR_KEY = 'mayhem.launchError';

    function create(deps) {
        deps = deps || {};
        var debugTimer = null;
        var runtimeShell = null;
        var matchViewApi = null;
        var matchActionsApi = null;
        var matchHostApi = null;

        function depGet(name) {
            if (Object.prototype.hasOwnProperty.call(deps, name)) {
                var explicit = deps[name];
                if (explicit != null) {
                    return explicit;
                }
            }
            return globalThis.__MAYHEM_RUNTIME[name];
        }

        function sharedApi() {
            return depGet('GameShared') || runtime.GameShared || null;
        }

        function gameUiApi() {
            return depGet('GameUI') || null;
        }

        function gamePlayerApi() {
            return depGet('GamePlayer') || null;
        }

        function gameEnemyApi() {
            return depGet('GameEnemy') || null;
        }

        function gameHitscanApi() {
            return depGet('GameHitscan') || null;
        }

        function gameAudioApi() {
            return depGet('GameAudio') || null;
        }

        function gameRuntimeLoaderApi() {
            return depGet('GameRuntimeLoader') || runtime.GameRuntimeLoader || null;
        }

        function gameDocsApi() {
            var loader = gameRuntimeLoaderApi();
            if (loader && loader.getLoadedDocsRuntime) {
                var loadedDocsApi = loader.getLoadedDocsRuntime();
                if (loadedDocsApi) return loadedDocsApi;
            }
            return depGet('GameDocs') || null;
        }

        function gameAbilitiesApi() {
            return depGet('GameAbilities') || null;
        }

        function gameThrowablesApi() {
            return depGet('GameThrowables') || null;
        }

        function gameOverheadApi() {
            return depGet('GameOverhead') || null;
        }

        function gameNetApi() {
            return depGet('GameNet') || null;
        }

        function gameLocalMatchApi() {
            return depGet('GameLocalMatch') || null;
        }

        function gameNetFeedbackSyncApi() {
            return depGet('GameNetFeedbackSync') || null;
        }

        function gameHookVisualsApi() {
            return depGet('GameHookVisuals') || null;
        }

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

        function menuLoadoutApi() {
            return depGet('GameMenuLoadout');
        }

        function applyBrandingOverrides() {
            document.title = 'Mayhem';
            var docsTitle = document.getElementById('docs-title');
            if (docsTitle && /minecraft fps/i.test(docsTitle.textContent || '')) {
                docsTitle.textContent = String(docsTitle.textContent).replace(/minecraft fps/ig, 'MAYHEM');
            }
        }

        function sharedMatchRules() {
            var shared = sharedApi();
            return shared && shared.matchRules ? shared.matchRules : null;
        }

        function isPrivateRoomSession(snapshot) {
            var phase = snapshot && snapshot.privateRoomPhase ? String(snapshot.privateRoomPhase) : '';
            return !!phase || !!(runtimeShell && runtimeShell.getActiveRuntimeMode && runtimeShell.getActiveRuntimeMode() && runtimeShell.getActiveRuntimeMode().roomStrategy === 'private');
        }

        function currentMatchRuntimeApi() {
            if (ensureMatchHostApi().isMultiplayerMode()) return gameNetApi();
            return gameLocalMatchApi() || gameNetApi();
        }

        function currentMatchViewApi() {
            var api = currentMatchRuntimeApi();
            return api && api.view ? api.view : api;
        }

        function currentSelfCombatApi() {
            return depGet('GamePlayerCombat') || null;
        }

        function currentMatchCommandApi() {
            if (!ensureMatchHostApi().isMultiplayerMode()) return null;
            var api = currentMatchRuntimeApi();
            return api && api.commands ? api.commands : api;
        }

        function currentMatchRemoteEntitiesApi() {
            if (!ensureMatchHostApi().isMultiplayerMode()) return null;
            var api = currentMatchRuntimeApi();
            return api && api.remoteEntities ? api.remoteEntities : api;
        }

        function ensureMatchViewApi() {
            if (matchViewApi) return matchViewApi;
            var matchViewFactory = depGet('GameRuntimeMatchView');
            if (!matchViewFactory || !matchViewFactory.create) {
                throw new Error('GameRuntimeMatchView is required before gameplay starts.');
            }
            matchViewApi = matchViewFactory.create({
                getCurrentMatchViewApi: currentMatchViewApi,
                getCurrentSelfCombatApi: currentSelfCombatApi,
                getSharedMatchRules: sharedMatchRules,
                getRuntimeShell: function () { return runtimeShell; },
                getGameSession: function () { return ensureMatchHostApi().getGameSession(); },
                getGameUiApi: gameUiApi,
                isMultiplayerMode: function () { return ensureMatchHostApi().isMultiplayerMode(); },
                isRuntimeInitialized: function () { return ensureMatchHostApi().isRuntimeReady(); }
            });
            return matchViewApi;
        }

        function setTransientDebug(text, ms) {
            var uiApi = gameUiApi();
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
            var uiApi = gameUiApi();
            if (uiApi && uiApi.setIdleWarning) {
                uiApi.setIdleWarning(text || '');
            }
        }
        function ensureMatchActionsApi() {
            if (matchActionsApi) return matchActionsApi;
            var actionFactory = depGet('GameRuntimeMatchActions');
            if (!actionFactory || !actionFactory.create) {
                throw new Error('GameRuntimeMatchActions is required before gameplay starts.');
            }
            matchActionsApi = actionFactory.create({
                getGameUiApi: gameUiApi,
                getGamePlayerApi: gamePlayerApi,
                getGameEnemyApi: gameEnemyApi,
                getGameHitscanApi: gameHitscanApi,
                getGameAudioApi: gameAudioApi,
                getGameDocsApi: gameDocsApi,
                getGameAbilitiesApi: gameAbilitiesApi,
                getGameThrowablesApi: gameThrowablesApi,
                getGameOverheadApi: gameOverheadApi,
                getGameNetApi: gameNetApi,
                getGameNetFeedbackSyncApi: gameNetFeedbackSyncApi,
                getCurrentMatchViewApi: currentMatchViewApi,
                getCurrentSelfCombatApi: currentSelfCombatApi,
                getCurrentMatchCommandApi: currentMatchCommandApi,
                getCurrentMatchRemoteEntitiesApi: currentMatchRemoteEntitiesApi,
                getLoadoutStateApi: function () { return depGet('GameLoadoutState'); },
                getLoadoutRuntimeApi: function () { return depGet('GameLoadoutRuntimeSync'); },
                getCamera: function () { return ensureMatchHostApi().getCamera(); },
                isMultiplayerMode: function () { return ensureMatchHostApi().isMultiplayerMode(); },
                hasInputCapture: function () { return ensureMatchHostApi().hasInputCapture(); },
                setTransientDebug: setTransientDebug,
                onDebugVisualsChanged: function () {
                    setRuntimeIndicator(runtimeShell && runtimeShell.getActiveRuntimeMode ? runtimeShell.getActiveRuntimeMode() : null);
                }
            });
            return matchActionsApi;
        }

        function ensureMatchHostApi() {
            if (matchHostApi) return matchHostApi;
            var hostFactory = depGet('GameRuntimeMatchHost');
            if (!hostFactory || !hostFactory.create) {
                throw new Error('GameRuntimeMatchHost is required before gameplay starts.');
            }
            matchHostApi = hostFactory.create({
                getBootstrapApi: function () { return depGet('GameGameplayRuntimeBootstrap'); },
                getRuntimeSessionFactory: function () { return depGet('GameRuntimeSession'); },
                getGameplayRuntimeLoopFactory: function () { return depGet('GameGameplayRuntimeLoop'); },
                getPresentationRuntimeLoopFactory: function () { return depGet('GamePresentationRuntimeLoop'); },
                getLoopApi: function () { return depGet('GameLoop'); },
                getRuntimeProfileApi: runtimeProfile,
                getGameAudioApi: gameAudioApi,
                getGameDocsApi: gameDocsApi,
                getGameNetApi: gameNetApi,
                getGameLocalMatchApi: gameLocalMatchApi,
                getMatchViewApi: ensureMatchViewApi,
                getRuntimeShell: function () { return runtimeShell; },
                getActionsApi: ensureMatchActionsApi,
                applyBrandingOverrides: applyBrandingOverrides,
                setTransientDebug: setTransientDebug,
                setIdleWarning: setIdleWarning,
                isPrivateRoomSession: isPrivateRoomSession,
                buildBootstrapRuntimeDeps: function () {
                    return {
                        GameBootstrap: depGet('GameBootstrap'),
                        GameWorld: depGet('GameWorld'),
                        GameUI: gameUiApi(),
                        GameDocs: gameDocsApi(),
                        GameOverhead: gameOverheadApi(),
                        GamePlayer: gamePlayerApi(),
                        GameThrowables: gameThrowablesApi(),
                        GameNet: gameNetApi(),
                        GameAbilities: gameAbilitiesApi(),
                        GameHookVisuals: gameHookVisualsApi(),
                        GamePlayerCombat: currentSelfCombatApi(),
                        GameGameplayHudSync: depGet('GameGameplayHudSync'),
                        GameHitscan: gameHitscanApi(),
                        GameGameplayControls: depGet('GameGameplayControls'),
                        GameRuntimeLoader: gameRuntimeLoaderApi(),
                        GameLocalMatch: gameLocalMatchApi(),
                        GameEnemy: gameEnemyApi()
                    };
                }
            });
            return matchHostApi;
        }

        function initGame() {
            return ensureMatchHostApi().startRuntime({
                activeRuntimeMode: runtimeShell && runtimeShell.getActiveRuntimeMode ? runtimeShell.getActiveRuntimeMode() : null,
                startupDebugNotice: runtimeShell && runtimeShell.getStartupDebugNotice ? runtimeShell.getStartupDebugNotice() : ''
            });
        }

        function runtimeProfile() {
            return depGet('GameRuntimeProfile');
        }

        function runtimeModeUi() {
            return depGet('GameRuntimeModeUi');
        }

        function setRuntimeIndicator(mode) {
            var modeUi = runtimeModeUi();
            var actionsApi = matchActionsApi;
            if (modeUi && modeUi.setRuntimeIndicator) {
                modeUi.setRuntimeIndicator(mode, {
                    debugActive: !!(actionsApi && actionsApi.isDebugVisualsOn && actionsApi.isDebugVisualsOn())
                });
            }
        }

        function hardResetFailedNetworkLaunch(message) {
            var msg = String(message || 'Room join failed.');
            persistLaunchError(msg);
            var dbg = document.getElementById('debug-info');
            if (dbg) dbg.textContent = 'Startup error: ' + msg;
            var runtimeProfileApi = runtimeProfile();
            if (runtimeProfileApi && runtimeProfileApi.clearSelectedMode) {
                runtimeProfileApi.clearSelectedMode();
            }
            if (window.location) {
                window.location.href = (window.location && window.location.pathname) ? window.location.pathname : '/';
            }
        }

        function ensureRuntimeShell() {
            if (runtimeShell) return runtimeShell;
            var shellFactory = depGet('GameRuntimeShell');
            if (!shellFactory || !shellFactory.create) {
                throw new Error('GameRuntimeShell is required before gameplay starts.');
            }
            runtimeShell = shellFactory.create({
                getRuntimeProfile: runtimeProfile,
                getRuntimeModeUi: runtimeModeUi,
                getAuthApi: function () { return depGet('GameNetAuth') || null; },
                getNetApi: gameNetApi,
                setRoomId: function (roomId) {
                    var gameNet = gameNetApi();
                    if (gameNet && gameNet.setRoomId) {
                        gameNet.setRoomId(roomId);
                    }
                },
                startRuntime: initGame,
                onNetworkLaunchFailure: function (message, err) {
                    var overlayEl = document.getElementById('overlay');
                    if (overlayEl) overlayEl.style.display = 'flex';
                    console.error('Startup error:', err);
                    hardResetFailedNetworkLaunch(message);
                },
                onLaunchError: function (message, err) {
                    var overlayEl = document.getElementById('overlay');
                    if (overlayEl) overlayEl.style.display = 'flex';
                    var dbg = document.getElementById('debug-info');
                    if (dbg) dbg.textContent = 'Startup error: ' + message;
                    console.error('Startup error:', err);
                },
                isRuntimeReady: function () { return ensureMatchHostApi().isRuntimeReady(); },
                readMatchContext: function () { return ensureMatchViewApi().readMatchContext(); }
            });
            return runtimeShell;
        }

        return {
            launchModeById: function (modeId, options) {
                return ensureRuntimeShell().launchModeById(modeId, options);
            },
            getActivityState: function () {
                var gameSession = ensureMatchHostApi().getGameSession();
                if (gameSession && gameSession.getActivityState) {
                    return gameSession.getActivityState();
                }
                return ensureRuntimeShell().getActivityState();
            }
        };
    }

    runtime.GameRuntimeCoordinator = {
        create: create
    };
})();
