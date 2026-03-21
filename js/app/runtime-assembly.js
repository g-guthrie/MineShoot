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
    return {
        GameShared: runtimeValue(runtime, 'GameShared'),
        GameUI: runtimeValue(runtime, 'GameUI'),
        GamePlayer: runtimeValue(runtime, 'GamePlayer'),
        GameEnemy: runtimeValue(runtime, 'GameEnemy'),
        GameHitscan: runtimeValue(runtime, 'GameHitscan'),
        GameAudio: runtimeValue(runtime, 'GameAudio'),
        GameRuntimeLoader: runtimeValue(runtime, 'GameRuntimeLoader'),
        GameDocs: runtimeValue(runtime, 'GameDocs'),
        GameAbilities: runtimeValue(runtime, 'GameAbilities'),
        GameThrowables: runtimeValue(runtime, 'GameThrowables'),
        GameOverhead: runtimeValue(runtime, 'GameOverhead'),
        GameNet: runtimeValue(runtime, 'GameNet'),
        GameLocalMatch: runtimeValue(runtime, 'GameLocalMatch'),
        GameNetFeedbackSync: runtimeValue(runtime, 'GameNetFeedbackSync'),
        GameHookVisuals: runtimeValue(runtime, 'GameHookVisuals'),
        GameMenuLoadout: runtimeValue(runtime, 'GameMenuLoadout'),
        GameRuntimeMatchActions: runtimeValue(runtime, 'GameRuntimeMatchActions'),
        GameRuntimeMatchHost: runtimeValue(runtime, 'GameRuntimeMatchHost'),
        GamePlayerCombat: runtimeValue(runtime, 'GamePlayerCombat'),
        GameRuntimeMatchView: runtimeValue(runtime, 'GameRuntimeMatchView'),
        GameRuntimeSession: runtimeValue(runtime, 'GameRuntimeSession'),
        GameRuntimeProfile: runtimeValue(runtime, 'GameRuntimeProfile'),
        GameGameplayRuntimeBootstrap: runtimeValue(runtime, 'GameGameplayRuntimeBootstrap'),
        GameBootstrap: runtimeValue(runtime, 'GameBootstrap'),
        GameWorld: runtimeValue(runtime, 'GameWorld'),
        GameGameplayHudSync: runtimeValue(runtime, 'GameGameplayHudSync'),
        GameGameplayControls: runtimeValue(runtime, 'GameGameplayControls'),
        GameGameplayRuntimeLoop: runtimeValue(runtime, 'GameGameplayRuntimeLoop'),
        GamePresentationRuntimeLoop: runtimeValue(runtime, 'GamePresentationRuntimeLoop'),
        GameLoop: runtimeValue(runtime, 'GameLoop'),
        GameRuntimeModeUi: runtimeValue(runtime, 'GameRuntimeModeUi'),
        GameRuntimeShell: runtimeValue(runtime, 'GameRuntimeShell'),
        GameNetAuth: runtimeValue(runtime, 'GameNetAuth')
    };
}

export function buildGameNetAssemblyDeps(runtime) {
    runtime = createRuntimeRegistry(runtime);
    return {
        GameShared: runtimeValue(runtime, 'GameShared'),
        GameNetAuth: runtimeValue(runtime, 'GameNetAuth'),
        GameNetEntities: runtimeValue(runtime, 'GameNetEntities'),
        GameNetCommands: runtimeValue(runtime, 'GameNetCommands'),
        GameNetRuntimeAccess: runtimeValue(runtime, 'GameNetRuntimeAccess'),
        GameNetJoinState: runtimeValue(runtime, 'GameNetJoinState'),
        GameNetConnectionTiming: runtimeValue(runtime, 'GameNetConnectionTiming'),
        GameNetRuntimeState: runtimeValue(runtime, 'GameNetRuntimeState'),
        GameNetMessageRouter: runtimeValue(runtime, 'GameNetMessageRouter'),
        GameNetStateView: runtimeValue(runtime, 'GameNetStateView'),
        GameNetRuntimeCore: runtimeValue(runtime, 'GameNetRuntimeCore'),
        GameNetSnapshots: runtimeValue(runtime, 'GameNetSnapshots'),
        GameNetEffects: runtimeValue(runtime, 'GameNetEffects'),
        GameNetFacade: runtimeValue(runtime, 'GameNetFacade'),
        GameAbilityFx: runtimeValue(runtime, 'GameAbilityFx'),
        GameActorVisualFactory: runtimeValue(runtime, 'GameActorVisualFactory'),
        GameCombatTuning: runtimeValue(runtime, 'GameCombatTuning')
    };
}

export function buildThrowableProjectileRuntimeDeps(runtime) {
    runtime = createRuntimeRegistry(runtime);
    return {
        getAssetFactory: function () { return runtimeValue(runtime, 'GameAssetFactory'); },
        getWorldApi: function () { return runtimeValue(runtime, 'GameWorld'); },
        getEnemyApi: function () { return runtimeValue(runtime, 'GameEnemy'); },
        getAudioApi: function () { return runtimeValue(runtime, 'GameAudio'); },
        getNetApi: function () { return runtimeValue(runtime, 'GameNet'); },
        getPlayerApi: function () { return runtimeValue(runtime, 'GamePlayer'); },
        getSharedApi: function () { return runtimeValue(runtime, 'GameShared'); },
        getRemoteEntitiesApi: function () { return runtimeValue(runtime, 'GameNetEntities'); }
    };
}

export function buildPlayerDeps(runtime) {
    runtime = createRuntimeRegistry(runtime);
    return {
        getSharedApi: function () { return runtimeValue(runtime, 'GameShared'); },
        getInputBindingsApi: function () { return runtimeValue(runtime, 'GameInputBindings'); },
        getPlayerStatusFactory: function () { return runtimeValue(runtime, 'GamePlayerStatus'); },
        getAbilityFxApi: function () { return runtimeValue(runtime, 'GameAbilityFx'); },
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
    new URL('../net/runtime-access.js', import.meta.url),
    new URL('../net/message-router.js', import.meta.url),
    new URL('../net/runtime-core.js', import.meta.url),
    new URL('../net/state-view.js', import.meta.url),
    new URL('../net/effects.js', import.meta.url),
    new URL('../net/facade.js', import.meta.url),
    new URL('../net/network.js', import.meta.url)
]);
