/**
 * runtime-coordinator.js - App-owned gameplay runtime coordinator.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create(deps) {
        deps = deps || {};
        var runtimeShell = null;
        var matchViewApi = null;
        var matchActionsApi = null;
        var matchHostApi = null;
        var accessFactory = runtime.GameRuntimeCoordinatorAccess;
        var access = accessFactory && accessFactory.create
            ? accessFactory.create(runtime, deps, {
                ensureMatchHostApi: function () { return ensureMatchHostApi(); }
            })
            : null;
        var uiFactory = runtime.GameRuntimeCoordinatorUi;
        var uiBridge = uiFactory && uiFactory.create
            ? uiFactory.create({
                getGameUiApi: gameUiApi,
                getRuntimeModeUi: runtimeModeUi,
                getRuntimeProfile: runtimeProfile,
                getMatchActionsApi: function () { return matchActionsApi; }
            })
            : null;

        function depGet(name) {
            if (access && access.depGet) return access.depGet(name);
            if (Object.prototype.hasOwnProperty.call(deps, name)) {
                var explicit = deps[name];
                if (explicit != null) return explicit;
            }
            return globalThis.__MAYHEM_RUNTIME[name];
        }

        function sharedApi() { return access && access.sharedApi ? access.sharedApi() : (depGet('GameShared') || runtime.GameShared || null); }
        function gameUiApi() { return access && access.gameUiApi ? access.gameUiApi() : (depGet('GameUI') || null); }
        function gamePlayerApi() { return access && access.gamePlayerApi ? access.gamePlayerApi() : (depGet('GamePlayer') || null); }
        function gameHitscanApi() { return access && access.gameHitscanApi ? access.gameHitscanApi() : (depGet('GameHitscan') || null); }
        function gameAudioApi() { return access && access.gameAudioApi ? access.gameAudioApi() : (depGet('GameAudio') || null); }
        function gameThrowablesApi() { return access && access.gameThrowablesApi ? access.gameThrowablesApi() : (depGet('GameThrowables') || null); }
        function gameRuntimeLoaderApi() { return access && access.gameRuntimeLoaderApi ? access.gameRuntimeLoaderApi() : (depGet('GameRuntimeLoader') || runtime.GameRuntimeLoader || null); }
        function gameDocsApi() { return access && access.gameDocsApi ? access.gameDocsApi() : (depGet('GameDocs') || null); }
        function gameOverheadApi() { return access && access.gameOverheadApi ? access.gameOverheadApi() : (depGet('GameOverhead') || null); }
        function gameNetApi() { return access && access.gameNetApi ? access.gameNetApi() : (depGet('GameNet') || null); }
        function gameLocalMatchApi() { return access && access.gameLocalMatchApi ? access.gameLocalMatchApi() : (depGet('GameLocalMatch') || null); }
        function gameNetFeedbackSyncApi() { return access && access.gameNetFeedbackSyncApi ? access.gameNetFeedbackSyncApi() : (depGet('GameNetFeedbackSync') || null); }
        function menuLoadoutApi() { return access && access.menuLoadoutApi ? access.menuLoadoutApi() : depGet('GameMenuLoadout'); }
        function sharedMatchRules() { return access && access.sharedMatchRules ? access.sharedMatchRules() : null; }

        function applyBrandingOverrides() {
            if (uiBridge && uiBridge.applyBrandingOverrides) {
                uiBridge.applyBrandingOverrides();
            }
        }

        function isPrivateRoomSession(snapshot) {
            var phase = snapshot && snapshot.privateRoomPhase ? String(snapshot.privateRoomPhase) : '';
            return !!phase || !!(runtimeShell && runtimeShell.getActiveRuntimeMode && runtimeShell.getActiveRuntimeMode() && runtimeShell.getActiveRuntimeMode().roomStrategy === 'private');
        }

        function currentMatchRuntimeApi() {
            return access && access.currentMatchRuntimeApi ? access.currentMatchRuntimeApi() : (ensureMatchHostApi().isMultiplayerMode() ? gameNetApi() : (gameLocalMatchApi() || gameNetApi()));
        }

        function currentMatchViewApi() {
            return access && access.currentMatchViewApi ? access.currentMatchViewApi() : currentMatchRuntimeApi();
        }

        function currentSelfCombatApi() {
            return access && access.currentSelfCombatApi ? access.currentSelfCombatApi() : (depGet('GamePlayerCombat') || null);
        }

        function currentMatchCommandApi() {
            return access && access.currentMatchCommandApi ? access.currentMatchCommandApi() : null;
        }

        function currentMatchRemoteEntitiesApi() {
            return access && access.currentMatchRemoteEntitiesApi ? access.currentMatchRemoteEntitiesApi() : null;
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
            runtime.__activeMatchViewApi = matchViewApi;
            return matchViewApi;
        }

        function setTransientDebug(text, ms) {
            if (uiBridge && uiBridge.setTransientDebug) {
                uiBridge.setTransientDebug(text, ms);
            }
        }

        function setIdleWarning(text) {
            if (uiBridge && uiBridge.setIdleWarning) uiBridge.setIdleWarning(text);
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
                getGameHitscanApi: gameHitscanApi,
                getGameAudioApi: gameAudioApi,
                getGameThrowablesApi: gameThrowablesApi,
                getGameDocsApi: gameDocsApi,
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
                getScene: function () { return ensureMatchHostApi().getScene(); },
                isMultiplayerMode: function () { return ensureMatchHostApi().isMultiplayerMode(); },
                hasInputCapture: function () { return ensureMatchHostApi().hasInputCapture(); },
                setTransientDebug: setTransientDebug,
                onDebugVisualsChanged: function () {
                    setRuntimeIndicator(runtimeShell && runtimeShell.getActiveRuntimeMode ? runtimeShell.getActiveRuntimeMode() : null);
                }
            });
            runtime.__activeMatchActionsApi = matchActionsApi;
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
                        GameNet: gameNetApi(),
                        GamePlayerCombat: currentSelfCombatApi(),
                        GameGameplayHudSync: depGet('GameGameplayHudSync'),
                        GameHitscan: gameHitscanApi(),
                        GameGameplayControls: depGet('GameGameplayControls'),
                        GameRuntimeLoader: gameRuntimeLoaderApi(),
                        GameLocalMatch: gameLocalMatchApi()
                    };
                }
            });
            runtime.__activeMatchHostApi = matchHostApi;
            return matchHostApi;
        }

        function initGame() {
            return ensureMatchHostApi().startRuntime({
                activeRuntimeMode: runtimeShell && runtimeShell.getActiveRuntimeMode ? runtimeShell.getActiveRuntimeMode() : null,
                startupDebugNotice: runtimeShell && runtimeShell.getStartupDebugNotice ? runtimeShell.getStartupDebugNotice() : ''
            });
        }

        function runtimeProfile() {
            return access && access.runtimeProfile ? access.runtimeProfile() : depGet('GameRuntimeProfile');
        }

        function runtimeModeUi() {
            return access && access.runtimeModeUi ? access.runtimeModeUi() : depGet('GameRuntimeModeUi');
        }

        function setRuntimeIndicator(mode) {
            if (uiBridge && uiBridge.setRuntimeIndicator) uiBridge.setRuntimeIndicator(mode);
        }

        function hardResetFailedNetworkLaunch(message) {
            if (uiBridge && uiBridge.hardResetFailedNetworkLaunch) {
                uiBridge.hardResetFailedNetworkLaunch(message);
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
                    if (uiBridge && uiBridge.showOverlay) uiBridge.showOverlay();
                    console.error('Startup error:', err);
                    hardResetFailedNetworkLaunch(message);
                },
                onLaunchError: function (message, err) {
                    if (uiBridge && uiBridge.showOverlay) uiBridge.showOverlay();
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
