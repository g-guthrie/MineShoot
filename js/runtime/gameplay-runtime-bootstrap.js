/**
 * gameplay-runtime-bootstrap.js - Gameplay runtime startup orchestration.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameGameplayRuntimeBootstrap
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameGameplayRuntimeBootstrap = {};

    var MAX_PIXEL_RATIO = 1.75;

    function cappedPixelRatio() {
        return Math.min(MAX_PIXEL_RATIO, Math.max(1, Number(window.devicePixelRatio) || 1));
    }

    function createFallbackRenderContext() {
        var renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(cappedPixelRatio());
        document.body.appendChild(renderer.domElement);
        return {
            renderer: renderer,
            scene: new THREE.Scene(),
            clock: new THREE.Clock()
        };
    }

    function installResizeHandler(renderer) {
        var bootstrapApi = runtime.GameBootstrap || null;
        if (bootstrapApi && bootstrapApi.installResizeHandler) {
            bootstrapApi.installResizeHandler(renderer);
            return;
        }
        window.addEventListener('resize', function () {
            renderer.setPixelRatio(cappedPixelRatio());
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    GameGameplayRuntimeBootstrap.start = function (options) {
        options = options || {};

        var bootstrapApi = runtime.GameBootstrap || null;
        var renderCtx = bootstrapApi && bootstrapApi.createRenderContext
            ? bootstrapApi.createRenderContext()
            : createFallbackRenderContext();

        var renderer = renderCtx.renderer;
        var scene = renderCtx.scene;
        var clock = renderCtx.clock;
        var multiplayerMode = !!(options.activeRuntimeMode && options.activeRuntimeMode.authorityMode === 'networked');

        function finalizeWorldBootstrap(worldMeta) {
            var worldOptions = (worldMeta && worldMeta.worldSeed) ? { worldMeta: worldMeta } : undefined;
            runtime.GameWorld.create(scene, worldOptions);

            runtime.GameUI.init();
            if (runtime.GameDocs && runtime.GameDocs.init) {
                runtime.GameDocs.init();
            }
            runtime.GameOverhead.init();

            if (options.startupDebugNotice) {
                options.setTransientDebug(options.startupDebugNotice, 2100);
            }

            var camera = runtime.GamePlayer.init(scene);
            runtime.GameThrowables.init(scene);

            if (multiplayerMode) {
                if (!runtime.GameNet.isActive || !runtime.GameNet.isActive()) {
                    runtime.GameNet.init(scene);
                }
            } else {
                var enemyCount = runtime.GameWorld.getRecommendedEnemyCount ? runtime.GameWorld.getRecommendedEnemyCount() : 5;
                if (runtime.GameLocalMatch && runtime.GameLocalMatch.init) {
                    runtime.GameLocalMatch.init({
                        gameMode: (options.activeRuntimeMode && options.activeRuntimeMode.gameMode) ? options.activeRuntimeMode.gameMode : 'ffa'
                    });
                }
                runtime.GameEnemy.init(scene, enemyCount);
                runtime.GameUI.updateThrowableInfo(runtime.GameThrowables.getState());
            }

            runtime.GameAbilities.init(scene);
            if (runtime.GameHookVisuals && runtime.GameHookVisuals.init) {
                runtime.GameHookVisuals.init(scene);
            }

            options.applyAbilityProfile('abilities');

            runtime.GamePlayerCombat.init({
                isPlaying: options.isPlaying,
                isMultiplayer: function () { return multiplayerMode; }
            });
            var initArmor = runtime.GameAbilities.getArmorMax ? runtime.GameAbilities.getArmorMax() : 90;
            runtime.GamePlayerCombat.applyArmorProfile(initArmor);
            runtime.GameUI.updateHealth(runtime.GamePlayerCombat.getHP(), runtime.GamePlayerCombat.getMaxHP());
            runtime.GameUI.updateAbilityInfo(runtime.GameAbilities.getHudState());

            options.applyDebugVisuals(false);

            var syncedWeapons = options.syncMenuWeaponSlotsToRuntime();
            if (syncedWeapons && syncedWeapons[0]) {
                options.applyWeapon(runtime.GameHitscan.setWeapon(syncedWeapons[0]));
            } else {
                options.applyWeapon(runtime.GameHitscan.getCurrentWeapon());
            }

            var controlsApi = runtime.GameGameplayControls && runtime.GameGameplayControls.create
                ? runtime.GameGameplayControls.create({
                    applyWeapon: options.applyWeapon,
                    canUseLocalAction: options.canUseLocalAction,
                    getCamera: function () { return camera; },
                    getMultiplayerMode: function () { return multiplayerMode; },
                    handleEnemyHit: options.handleEnemyHit,
                    hasInputCapture: options.hasInputCapture,
                    setTransientDebug: options.setTransientDebug,
                    toggleDebugVisuals: options.toggleDebugVisuals,
                    tryPlayerFire: options.tryPlayerFire
                })
                : null;

            installResizeHandler(renderer);

            return {
                renderer: renderer,
                scene: scene,
                clock: clock,
                camera: camera,
                controlsApi: controlsApi,
                multiplayerMode: multiplayerMode,
                startupDebugNotice: ''
            };
        }

        if (!multiplayerMode) {
            return Promise.resolve(finalizeWorldBootstrap(null));
        }

        runtime.GameNet.init(scene);
        var metaWaitStartedAt = performance.now();
        var metaTimeoutMs = 1400;

        return new Promise(function (resolve) {
            (function waitForWorldMeta() {
                var receivedMeta = runtime.GameNet.getWorldMeta ? runtime.GameNet.getWorldMeta() : null;
                if (receivedMeta && receivedMeta.worldSeed) {
                    resolve(finalizeWorldBootstrap(receivedMeta));
                    return;
                }

                if ((performance.now() - metaWaitStartedAt) >= metaTimeoutMs) {
                    var fallbackMeta = runtime.GameNet.getExpectedWorldMeta();
                    if (fallbackMeta && fallbackMeta.worldSeed) {
                        options.startupDebugNotice = (options.startupDebugNotice ? options.startupDebugNotice + ' ' : '') + 'World metadata timeout; using expected room profile.';
                    }
                    resolve(finalizeWorldBootstrap(fallbackMeta));
                    return;
                }

                setTimeout(waitForWorldMeta, 40);
            })();
        });
    };

    runtime.GameGameplayRuntimeBootstrap = GameGameplayRuntimeBootstrap;
})();
