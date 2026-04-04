/**
 * runtime-coordinator-access.js - Accessor helpers for GameRuntimeCoordinator.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinatorAccess
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create(runtimeNs, deps, bindings) {
        runtimeNs = runtimeNs || runtime;
        deps = deps || {};
        bindings = bindings || {};

        function depGet(name) {
            if (Object.prototype.hasOwnProperty.call(deps, name)) {
                var explicit = deps[name];
                if (explicit != null) return explicit;
            }
            return globalThis.__MAYHEM_RUNTIME[name];
        }

        function sharedApi() {
            return depGet('GameShared') || runtimeNs.GameShared || null;
        }

        function gameUiApi() {
            return depGet('GameUI') || null;
        }

        function gamePlayerApi() {
            return depGet('GamePlayer') || null;
        }

        function gameHitscanApi() {
            return depGet('GameHitscan') || null;
        }

        function gameAudioApi() {
            return depGet('GameAudio') || null;
        }

        function gameThrowablesApi() {
            return depGet('GameThrowables') || null;
        }

        function gameRuntimeLoaderApi() {
            return depGet('GameRuntimeLoader') || runtimeNs.GameRuntimeLoader || null;
        }

        function gameDocsApi() {
            var loader = gameRuntimeLoaderApi();
            if (loader && loader.getLoadedDocsRuntime) {
                var loadedDocsApi = loader.getLoadedDocsRuntime();
                if (loadedDocsApi) return loadedDocsApi;
            }
            return depGet('GameDocs') || null;
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

        function menuLoadoutApi() {
            return depGet('GameMenuLoadout') || null;
        }

        function sharedMatchRules() {
            var shared = sharedApi();
            return shared && shared.matchRules ? shared.matchRules : null;
        }

        function runtimeProfile() {
            return depGet('GameRuntimeProfile') || null;
        }

        function runtimeModeUi() {
            return depGet('GameRuntimeModeUi') || null;
        }

        function currentSelfCombatApi() {
            return depGet('GamePlayerCombat') || null;
        }

        function currentMatchRuntimeApi() {
            if (bindings.ensureMatchHostApi && bindings.ensureMatchHostApi().isMultiplayerMode()) {
                return gameNetApi();
            }
            return gameLocalMatchApi() || gameNetApi();
        }

        function currentMatchViewApi() {
            var api = currentMatchRuntimeApi();
            if (bindings.ensureMatchHostApi && bindings.ensureMatchHostApi().isMultiplayerMode()) {
                return api && api.view ? api.view : null;
            }
            return api;
        }

        function currentMatchCommandApi() {
            if (!(bindings.ensureMatchHostApi && bindings.ensureMatchHostApi().isMultiplayerMode())) return null;
            var api = currentMatchRuntimeApi();
            return api && api.commands ? api.commands : null;
        }

        function currentMatchRemoteEntitiesApi() {
            if (!(bindings.ensureMatchHostApi && bindings.ensureMatchHostApi().isMultiplayerMode())) return null;
            var api = currentMatchRuntimeApi();
            return api && api.remoteEntities ? api.remoteEntities : null;
        }

        return {
            depGet: depGet,
            sharedApi: sharedApi,
            gameUiApi: gameUiApi,
            gamePlayerApi: gamePlayerApi,
            gameHitscanApi: gameHitscanApi,
            gameAudioApi: gameAudioApi,
            gameThrowablesApi: gameThrowablesApi,
            gameRuntimeLoaderApi: gameRuntimeLoaderApi,
            gameDocsApi: gameDocsApi,
            gameOverheadApi: gameOverheadApi,
            gameNetApi: gameNetApi,
            gameLocalMatchApi: gameLocalMatchApi,
            gameNetFeedbackSyncApi: gameNetFeedbackSyncApi,
            menuLoadoutApi: menuLoadoutApi,
            sharedMatchRules: sharedMatchRules,
            runtimeProfile: runtimeProfile,
            runtimeModeUi: runtimeModeUi,
            currentSelfCombatApi: currentSelfCombatApi,
            currentMatchRuntimeApi: currentMatchRuntimeApi,
            currentMatchViewApi: currentMatchViewApi,
            currentMatchCommandApi: currentMatchCommandApi,
            currentMatchRemoteEntitiesApi: currentMatchRemoteEntitiesApi
        };
    }

    runtime.GameRuntimeCoordinatorAccess = {
        create: create
    };
})();
