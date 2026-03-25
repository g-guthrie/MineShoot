function runtimeValue(runtime, name) {
    return runtime && runtime[name] ? runtime[name] : null;
}

export function createRuntimeRegistry(seedRuntime) {
    var runtime = (seedRuntime && typeof seedRuntime === 'object')
        ? seedRuntime
        : (globalThis.__MAYHEM_RUNTIME || {});
    globalThis.__MAYHEM_RUNTIME = runtime;
    return runtime;
}

export function buildLobbyControllerDeps(runtime) {
    runtime = createRuntimeRegistry(runtime);
    return {
        actionFactory: runtimeValue(runtime, 'GameLobbyActions'),
        rendererFactory: runtimeValue(runtime, 'GameLobbyRenderer'),
        storeFactory: runtimeValue(runtime, 'GameMenuState'),
        lobbyApi: runtimeValue(runtime, 'GameLobbyApi'),
        authApi: runtimeValue(runtime, 'GameNetAuth'),
        modalManager: runtimeValue(runtime, 'GameModalManager'),
        sessionFactory: runtimeValue(runtime, 'GameLobbySession'),
        loadoutStateApi: runtimeValue(runtime, 'GameLoadoutState'),
        loadoutRuntimeApi: runtimeValue(runtime, 'GameLoadoutRuntimeSync'),
        loadoutApi: runtimeValue(runtime, 'GameMenuLoadout'),
        privateRoomViewFactory: runtimeValue(runtime, 'GameLobbyPrivateRoomView'),
        runtimeModeUi: runtimeValue(runtime, 'GameRuntimeModeUi'),
        getSessionApi: function () {
            return runtimeValue(runtime, 'GameSession');
        }
    };
}

export function buildGameplayCoordinatorDeps(runtime) {
    runtime = createRuntimeRegistry(runtime);
    var deps = {};
    var names = [
        'GameShared',
        'GameUI',
        'GamePlayer',
        'GameHitscan',
        'GameAudio',
        'GameRuntimeLoader',
        'GameDocs',
        'GameLoadoutState',
        'GameLoadoutRuntimeSync',
        'GameOverhead',
        'GameNet',
        'GameLocalMatch',
        'GameNetFeedbackSync',
        'GameMenuLoadout',
        'GameRuntimeMatchActions',
        'GameRuntimeMatchHost',
        'GamePlayerCombat',
        'GameRuntimeMatchView',
        'GameRuntimeSession',
        'GameRuntimeProfile',
        'GameGameplayRuntimeBootstrap',
        'GameBootstrap',
        'GameWorld',
        'GameGameplayHudSync',
        'GameGameplayControls',
        'GameGameplayRuntimeLoop',
        'GamePresentationRuntimeLoop',
        'GameLoop',
        'GameRuntimeModeUi',
        'GameRuntimeShell',
        'GameNetAuth'
    ];
    for (var i = 0; i < names.length; i++) {
        (function (name) {
            Object.defineProperty(deps, name, {
                configurable: true,
                enumerable: true,
                get: function () {
                    return runtimeValue(runtime, name);
                }
            });
        })(names[i]);
    }
    return deps;
}

export function buildGameNetAssemblyDeps(runtime) {
    runtime = createRuntimeRegistry(runtime);
    return {
        GameShared: runtimeValue(runtime, 'GameShared'),
        GameNetAuth: runtimeValue(runtime, 'GameNetAuth'),
        GameNetEntities: runtimeValue(runtime, 'GameNetEntities'),
        GameNetCommands: runtimeValue(runtime, 'GameNetCommands'),
        GameNetJoinState: runtimeValue(runtime, 'GameNetJoinState'),
        GameNetConnectionTiming: runtimeValue(runtime, 'GameNetConnectionTiming'),
        GameNetRuntimeState: runtimeValue(runtime, 'GameNetRuntimeState'),
        GameNetMessageRouter: runtimeValue(runtime, 'GameNetMessageRouter'),
        GameNetStateView: runtimeValue(runtime, 'GameNetStateView'),
        GameNetRuntimeCore: runtimeValue(runtime, 'GameNetRuntimeCore'),
        GameNetSnapshots: runtimeValue(runtime, 'GameNetSnapshots'),
        GameNetEffects: runtimeValue(runtime, 'GameNetEffects'),
        GameActorVisualFactory: runtimeValue(runtime, 'GameActorVisualFactory')
    };
}

export function buildThrowableProjectileRuntimeDeps(runtime) {
    runtime = createRuntimeRegistry(runtime);
    return {
        getAssetFactory: function () { return runtimeValue(runtime, 'GameAssetFactory'); },
        getWorldApi: function () { return runtimeValue(runtime, 'GameWorld'); },
        getAudioApi: function () { return runtimeValue(runtime, 'GameAudio'); },
        getNetApi: function () { return runtimeValue(runtime, 'GameNet'); },
        getPlayerApi: function () { return runtimeValue(runtime, 'GamePlayer'); },
        getSharedApi: function () { return runtimeValue(runtime, 'GameShared'); },
        getRemoteEntitiesApi: function () {
            var gameNet = runtimeValue(runtime, 'GameNet');
            return gameNet && gameNet.remoteEntities ? gameNet.remoteEntities : null;
        }
    };
}

export function buildPlayerDeps(runtime) {
    runtime = createRuntimeRegistry(runtime);
    return {
        getSharedApi: function () { return runtimeValue(runtime, 'GameShared'); },
        getInputBindingsApi: function () { return runtimeValue(runtime, 'GameInputBindings'); },
        getPlayerStatusFactory: function () { return runtimeValue(runtime, 'GamePlayerStatus'); },
        getPlayerWorldFactory: function () { return runtimeValue(runtime, 'GamePlayerWorld'); },
        getPlayerViewFactory: function () { return runtimeValue(runtime, 'GamePlayerView'); },
        getPlayerCombatApi: function () { return runtimeValue(runtime, 'GamePlayerCombat'); },
        getHitscanApi: function () { return runtimeValue(runtime, 'GameHitscan'); },
        getActorVisualFactory: function () { return runtimeValue(runtime, 'GameActorVisualFactory'); },
        getWorldApi: function () { return runtimeValue(runtime, 'GameWorld'); }
    };
}

export function applyRuntimeAssembly(seedRuntime) {
    var runtime = createRuntimeRegistry(seedRuntime);
    runtime.GameLobbyControllerDeps = buildLobbyControllerDeps(runtime);
    runtime.GameRuntimeCoordinatorDeps = buildGameplayCoordinatorDeps(runtime);
    runtime.GameNetAssemblyDeps = buildGameNetAssemblyDeps(runtime);
    runtime.GameThrowablesProjectileRuntimeDeps = buildThrowableProjectileRuntimeDeps(runtime);
    runtime.GamePlayerDeps = buildPlayerDeps(runtime);
    return runtime;
}

export const gameNetRuntimeScriptUrls = Object.freeze([
    new URL('../net/join-state.js', import.meta.url),
    new URL('../net/connection-timing.js', import.meta.url),
    new URL('../net/runtime-state.js', import.meta.url),
    new URL('../net/commands.js', import.meta.url),
    new URL('../net/message-router.js', import.meta.url),
    new URL('../net/runtime-core.js', import.meta.url),
    new URL('../net/state-view.js', import.meta.url),
    new URL('../net/effects.js', import.meta.url),
    new URL('../net/network.js', import.meta.url)
]);
