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

    function installResizeHandler(renderer, bootstrapApi) {
        if (bootstrapApi && bootstrapApi.installResizeHandler) {
            return bootstrapApi.installResizeHandler(renderer);
        }
        window.addEventListener('resize', function () {
            renderer.setPixelRatio(cappedPixelRatio());
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    GameGameplayRuntimeBootstrap.start = function (options) {
        options = options || {};
        var runtimeDeps = options.runtimeDeps || {};

        function depGet(name) {
            if (Object.prototype.hasOwnProperty.call(runtimeDeps, name)) {
                return runtimeDeps[name];
            }
            return runtime[name] || null;
        }

        var bootstrapApi = depGet('GameBootstrap');
        var renderCtx = bootstrapApi && bootstrapApi.createRenderContext
            ? bootstrapApi.createRenderContext()
            : createFallbackRenderContext();

        var renderer = renderCtx.renderer;
        var scene = renderCtx.scene;
        var clock = renderCtx.clock;
        var multiplayerMode = !!(options.activeRuntimeMode && options.activeRuntimeMode.authorityMode === 'networked');
        var net = depGet('GameNet');
        var netRuntime = net && net.runtime ? net.runtime : net;
        var netView = net && net.view ? net.view : net;
        var netRuntimeInitStarted = false;
        var removeResizeHandler = null;

        function ensureNetRuntimeInit() {
            if (!netRuntime || !netRuntime.init || netRuntimeInitStarted) return;
            if (netRuntime.isActive && netRuntime.isActive()) {
                netRuntimeInitStarted = true;
                return;
            }
            netRuntime.init(scene);
            netRuntimeInitStarted = true;
        }

        function finalizeWorldBootstrap(worldMeta) {
            var runtimeLoader = depGet('GameRuntimeLoader');
            var gameWorld = depGet('GameWorld');
            var gameUi = depGet('GameUI');
            var gameDocs = runtimeLoader && runtimeLoader.getLoadedDocsRuntime
                ? runtimeLoader.getLoadedDocsRuntime()
                : depGet('GameDocs');
            var gameOverhead = depGet('GameOverhead');
            var gamePlayer = depGet('GamePlayer');
            var gameThrowables = depGet('GameThrowables');
            var gameLocalMatch = depGet('GameLocalMatch');
            var gameEnemy = depGet('GameEnemy');
            var gameAbilities = depGet('GameAbilities');
            var gameHookVisuals = depGet('GameHookVisuals');
            var gamePlayerCombat = depGet('GamePlayerCombat');
            var gameplayHudSync = depGet('GameGameplayHudSync');
            var gameHitscan = depGet('GameHitscan');
            var gameplayControls = depGet('GameGameplayControls');
            var gameAudio = depGet('GameAudio');
            var worldOptions = (worldMeta && worldMeta.worldSeed) ? { worldMeta: worldMeta } : undefined;
            gameWorld.create(scene, worldOptions);

            gameUi.init();
            if (gameDocs && gameDocs.init) {
                gameDocs.init();
            }
            gameOverhead.init();

            if (options.startupDebugNotice) {
                options.setTransientDebug(options.startupDebugNotice, 2100);
            }

            var camera = gamePlayer.init(scene);
            gameThrowables.init(scene);

            if (multiplayerMode) {
                ensureNetRuntimeInit();
            } else {
                var enemyCount = gameWorld.getRecommendedEnemyCount
                    ? gameWorld.getRecommendedEnemyCount()
                    : 5;
                if (gameLocalMatch && gameLocalMatch.init) {
                    gameLocalMatch.init({
                        gameMode: (options.activeRuntimeMode && options.activeRuntimeMode.gameMode)
                            ? options.activeRuntimeMode.gameMode
                            : 'ffa'
                    });
                }
                if (gameEnemy && gameEnemy.init) {
                    gameEnemy.init(scene, enemyCount);
                }
                if (gameUi && gameUi.updateThrowableInfo && gameThrowables.getState) {
                    gameUi.updateThrowableInfo(gameThrowables.getState());
                }
            }

            gameAbilities.init(scene);
            if (gameHookVisuals && gameHookVisuals.init) {
                gameHookVisuals.init(scene);
            }

            options.applyAbilityProfile('abilities');

            gamePlayerCombat.init({
                isPlaying: options.isPlaying,
                isMultiplayer: function () { return multiplayerMode; }
            });
            var initArmor = gameAbilities.getArmorMax ? gameAbilities.getArmorMax() : 90;
            gamePlayerCombat.applyArmorProfile(initArmor);
            if (gameplayHudSync && gameplayHudSync.syncSelfCombatHud) {
                gameplayHudSync.syncSelfCombatHud();
            }
            gameUi.updateAbilityInfo(gameAbilities.getHudState());

            options.applyDebugVisuals(false);

            var syncedWeapons = options.syncCommittedLoadoutToRuntime();
            if (syncedWeapons && syncedWeapons[0]) {
                options.applyWeapon(gameHitscan.setWeapon(syncedWeapons[0]));
            } else {
                options.applyWeapon(gameHitscan.getCurrentWeapon());
            }

            var controlsApi = gameplayControls && gameplayControls.create
                ? gameplayControls.create({
                    applyWeapon: options.applyWeapon,
                    canUseLocalAction: options.canUseLocalAction,
                    getCamera: function () { return camera; },
                    getDocsApi: function () {
                        return runtimeLoader && runtimeLoader.getLoadedDocsRuntime
                            ? runtimeLoader.getLoadedDocsRuntime()
                            : null;
                    },
                    getMultiplayerMode: function () { return multiplayerMode; },
                    handleEnemyHit: options.handleEnemyHit,
                    hasInputCapture: options.hasInputCapture,
                    setTransientDebug: options.setTransientDebug,
                    toggleDebugVisuals: options.toggleDebugVisuals,
                    tryPlayerFire: options.tryPlayerFire
                })
                : null;

            removeResizeHandler = installResizeHandler(renderer, depGet('GameBootstrap')) || null;

            function disposeRuntime() {
                if (removeResizeHandler) {
                    removeResizeHandler();
                    removeResizeHandler = null;
                }
                if (gameAbilities && gameAbilities.clearTransientState) {
                    gameAbilities.clearTransientState();
                }
                if (gameAudio && gameAudio.stopAll) {
                    gameAudio.stopAll();
                }
                if (gameHookVisuals && gameHookVisuals.dispose) {
                    gameHookVisuals.dispose();
                }
                if (multiplayerMode) {
                    if (netRuntime && netRuntime.shutdown) {
                        netRuntime.shutdown();
                    }
                } else if (gameLocalMatch && gameLocalMatch.shutdown) {
                    gameLocalMatch.shutdown();
                }
                if (gameThrowables && gameThrowables.shutdown) {
                    gameThrowables.shutdown();
                }
                if (gameEnemy && gameEnemy.dispose) {
                    gameEnemy.dispose();
                }
                if (gamePlayer && gamePlayer.destroy) {
                    gamePlayer.destroy();
                }
                if (gameOverhead && gameOverhead.reset) {
                    gameOverhead.reset();
                }
                if (gameUi && gameUi.resetGameplayHud) {
                    gameUi.resetGameplayHud();
                }
                if (gameHitscan && gameHitscan.reset) {
                    gameHitscan.reset();
                }
                if (gameWorld && gameWorld.dispose) {
                    gameWorld.dispose();
                }
            }

            return {
                renderer: renderer,
                scene: scene,
                clock: clock,
                camera: camera,
                controlsApi: controlsApi,
                multiplayerMode: multiplayerMode,
                startupDebugNotice: '',
                disposeRuntime: disposeRuntime
            };
        }

        if (!multiplayerMode) {
            return Promise.resolve(finalizeWorldBootstrap(null));
        }

        ensureNetRuntimeInit();
        var metaWaitStartedAt = performance.now();
        var metaTimeoutMs = 1400;
        var isCancelled = options.isCancelled || function () { return false; };

        return new Promise(function (resolve) {
            (function waitForWorldMeta() {
                if (isCancelled()) {
                    resolve(finalizeWorldBootstrap(null));
                    return;
                }

                var receivedMeta = netView && netView.getWorldMeta ? netView.getWorldMeta() : null;
                if (receivedMeta && receivedMeta.worldSeed) {
                    resolve(finalizeWorldBootstrap(receivedMeta));
                    return;
                }

                if ((performance.now() - metaWaitStartedAt) >= metaTimeoutMs) {
                    var fallbackMeta = netView && netView.getExpectedWorldMeta ? netView.getExpectedWorldMeta() : null;
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
