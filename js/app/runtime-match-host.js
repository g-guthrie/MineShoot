/**
 * runtime-match-host.js - Gameplay runtime host owner.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeMatchHost
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameRuntimeMatchHost = {};

    GameRuntimeMatchHost.create = function (opts) {
        opts = opts || {};

        var renderer = null;
        var scene = null;
        var clock = null;
        var camera = null;
        var multiplayerMode = false;
        var runtimeInitialized = false;
        var controlsApi = null;
        var gameSession = null;
        var gameplayRuntimeLoop = null;
        var presentationRuntimeLoop = null;
        var bootstrapDisposeRuntime = null;
        var animationFrameHandle = 0;
        var animationRunning = false;
        var runtimeRunToken = 0;

        function gameAudioApi() {
            return opts.getGameAudioApi ? opts.getGameAudioApi() : null;
        }

        function gameDocsApi() {
            return opts.getGameDocsApi ? opts.getGameDocsApi() : null;
        }

        function gameNetApi() {
            return opts.getGameNetApi ? opts.getGameNetApi() : null;
        }

        function gameLocalMatchApi() {
            return opts.getGameLocalMatchApi ? opts.getGameLocalMatchApi() : null;
        }

        function runtimeProfileApi() {
            return opts.getRuntimeProfileApi ? opts.getRuntimeProfileApi() : null;
        }

        function currentMatchRuntimeApi() {
            if (multiplayerMode) return gameNetApi();
            return gameLocalMatchApi() || gameNetApi();
        }

        function hasInputCapture() {
            return !!renderer && document.pointerLockElement === renderer.domElement;
        }

        function loopApi() {
            return opts.getLoopApi ? opts.getLoopApi() : null;
        }

        function requestFrame(cb) {
            var api = loopApi();
            if (api && api.requestFrame) {
                return api.requestFrame(cb);
            }
            return requestAnimationFrame(cb);
        }

        function cancelFrame(handle) {
            if (!handle) return;
            var api = loopApi();
            if (api && api.cancelFrame) {
                api.cancelFrame(handle);
                return;
            }
            cancelAnimationFrame(handle);
        }

        function detachCanvas(node) {
            if (!node || !node.parentNode || typeof node.parentNode.removeChild !== 'function') return;
            node.parentNode.removeChild(node);
        }

        function disposeRenderer(rendererRef) {
            if (!rendererRef) return;
            if (rendererRef.dispose) rendererRef.dispose();
            if (rendererRef.forceContextLoss) rendererRef.forceContextLoss();
            if (rendererRef.domElement) detachCanvas(rendererRef.domElement);
        }

        function disposeBootstrapResult(result) {
            if (!result) return;
            if (result.controlsApi && result.controlsApi.unbind) {
                result.controlsApi.unbind();
            }
            if (result.disposeRuntime) {
                result.disposeRuntime();
            }
            disposeRenderer(result.renderer);
        }

        function setupGameplaySession() {
            if (gameSession) return gameSession;
            var sessionFactory = opts.getRuntimeSessionFactory ? opts.getRuntimeSessionFactory() : null;
            var currentMatchView = opts.getMatchViewApi ? opts.getMatchViewApi() : null;
            var actionsApi = opts.getActionsApi ? opts.getActionsApi() : null;
            var runtimeShell = opts.getRuntimeShell ? opts.getRuntimeShell() : null;
            if (!sessionFactory || !sessionFactory.create) {
                throw new Error('GameRuntimeSession is required before gameplay starts.');
            }

            gameSession = sessionFactory.create({
                isRuntimeReady: function () {
                    return !!runtimeInitialized;
                },
                canResumeGameplay: function () {
                    var matchContext = currentMatchView.readMatchContext();
                    if (matchContext.privateRoomPhase === 'lobby') return false;
                    return !(matchContext.matchState && matchContext.matchState.ended);
                },
                getActivityState: function () {
                    return runtimeShell ? runtimeShell.getActivityState() : 'menu';
                },
                isNetworkedRuntime: function () {
                    return !!multiplayerMode;
                },
                getPointerLockTarget: function () {
                    return renderer ? renderer.domElement : null;
                },
                validateLaunch: function () {
                    return actionsApi && actionsApi.validateLoadoutSelections
                        ? actionsApi.validateLoadoutSelections()
                        : { ok: false, message: 'Menu loadout unavailable.' };
                },
                beforeGameplayEntry: function () {
                    var audioApi = gameAudioApi();
                    var docsApi = gameDocsApi();
                    if (audioApi && audioApi.unlock) {
                        audioApi.unlock();
                    }
                    if (docsApi && docsApi.isOpen && docsApi.isOpen()) {
                        docsApi.close();
                    }
                },
                setTransientDebug: function (text, ms) {
                    if (opts.setTransientDebug) opts.setTransientDebug(text, ms);
                },
                setIdleWarning: function (text) {
                    if (opts.setIdleWarning) opts.setIdleWarning(text);
                },
                suspendNetworkSession: function () {
                    if (!multiplayerMode) return false;
                    var netApi = currentMatchRuntimeApi();
                    if (!netApi || !netApi.shutdown) return false;
                    if (netApi.isActive && !netApi.isActive()) return true;
                    netApi.shutdown();
                    if (opts.setIdleWarning) opts.setIdleWarning('');
                    currentMatchView.updateMenuSessionPanel(currentMatchView.readMatchContext());
                    return true;
                },
                releaseTransientInput: function () {
                    if (controlsApi && controlsApi.releaseTransientInput) {
                        controlsApi.releaseTransientInput();
                    }
                },
                teardownRuntime: function (reason) {
                    teardownRuntime(reason || 'session_exit');
                },
                returnToMenu: function () {
                    var profileApi = runtimeProfileApi();
                    if (profileApi && profileApi.clearSelectedMode) {
                        profileApi.clearSelectedMode();
                    }
                    window.location.href = window.location.pathname;
                },
                isPrivateRoomSession: function (snapshot) {
                    return opts.isPrivateRoomSession ? opts.isPrivateRoomSession(snapshot) : false;
                },
                resolveWinnerLabel: currentMatchView.winnerLabel,
                didSelfWin: currentMatchView.didSelfWin,
                modeDisplayName: currentMatchView.modeDisplayName,
                objectiveSummary: currentMatchView.objectiveSummary,
                resultsSummary: currentMatchView.resultsSummary,
                formatSecondsRemaining: currentMatchView.formatSecondsRemaining
            });
            gameSession.bindRuntimeControls();
            return gameSession;
        }

        function teardownRuntime(reason) {
            runtimeRunToken += 1;
            animationRunning = false;
            if (animationFrameHandle) {
                cancelFrame(animationFrameHandle);
                animationFrameHandle = 0;
            }
            if (controlsApi && controlsApi.releaseTransientInput) {
                controlsApi.releaseTransientInput();
            }
            if (renderer && document.pointerLockElement === renderer.domElement && document.exitPointerLock) {
                document.exitPointerLock();
            }
            if (controlsApi && controlsApi.unbind) {
                controlsApi.unbind();
            }
            if (bootstrapDisposeRuntime) {
                bootstrapDisposeRuntime();
            }
            disposeRenderer(renderer);
            renderer = null;
            scene = null;
            clock = null;
            camera = null;
            multiplayerMode = false;
            runtimeInitialized = false;
            controlsApi = null;
            gameplayRuntimeLoop = null;
            presentationRuntimeLoop = null;
            bootstrapDisposeRuntime = null;
            return reason || '';
        }

        function animate(runToken) {
            if (!animationRunning || runToken !== runtimeRunToken || !clock || !gameplayRuntimeLoop || !presentationRuntimeLoop) {
                animationFrameHandle = 0;
                return;
            }
            animationFrameHandle = requestFrame(function () {
                animate(runToken);
            });
            var dt = clock.getDelta();
            if (dt > 0.1) dt = 0.1;
            var frameState = gameplayRuntimeLoop.step(dt);
            presentationRuntimeLoop.renderFrame(frameState);
        }

        function startRuntime(params) {
            params = params || {};
            var bootstrapApi = opts.getBootstrapApi ? opts.getBootstrapApi() : null;
            var actionsApi = opts.getActionsApi ? opts.getActionsApi() : null;
            var currentMatchView = opts.getMatchViewApi ? opts.getMatchViewApi() : null;
            if (opts.applyBrandingOverrides) {
                opts.applyBrandingOverrides();
            }
            if (!bootstrapApi || !bootstrapApi.start) {
                return Promise.reject(new Error('GameGameplayRuntimeBootstrap is required before gameplay starts.'));
            }

            teardownRuntime('restart');
            var runToken = runtimeRunToken + 1;
            runtimeRunToken = runToken;

            return bootstrapApi.start({
                activeRuntimeMode: params.activeRuntimeMode || null,
                applyAbilityProfile: actionsApi.applyAbilityProfile,
                applyDebugVisuals: actionsApi.applyDebugVisuals,
                applyWeapon: actionsApi.applyWeapon,
                canUseLocalAction: actionsApi.canUseLocalAction,
                handleEnemyHit: actionsApi.handleEnemyHit,
                hasInputCapture: hasInputCapture,
                isPlaying: function () {
                    return !!(gameSession && gameSession.isPlaying && gameSession.isPlaying());
                },
                setTransientDebug: function (text, ms) {
                    if (opts.setTransientDebug) opts.setTransientDebug(text, ms);
                },
                startupDebugNotice: params.startupDebugNotice || '',
                syncCommittedLoadoutToRuntime: actionsApi.syncCommittedLoadoutToRuntime,
                toggleDebugVisuals: actionsApi.toggleDebugVisuals,
                tryPlayerFire: actionsApi.tryPlayerFire,
                runtimeDeps: opts.buildBootstrapRuntimeDeps ? opts.buildBootstrapRuntimeDeps() : {}
            }).then(function (result) {
                if (runToken !== runtimeRunToken) {
                    disposeBootstrapResult(result);
                    return;
                }
                renderer = result.renderer;
                scene = result.scene;
                clock = result.clock;
                camera = result.camera;
                controlsApi = result.controlsApi || null;
                bootstrapDisposeRuntime = result.disposeRuntime || null;
                multiplayerMode = !!result.multiplayerMode;
                runtimeInitialized = true;
                setupGameplaySession();
                var gameplayLoopFactory = opts.getGameplayRuntimeLoopFactory ? opts.getGameplayRuntimeLoopFactory() : null;
                var presentationLoopFactory = opts.getPresentationRuntimeLoopFactory ? opts.getPresentationRuntimeLoopFactory() : null;
                gameplayRuntimeLoop = gameplayLoopFactory.create({
                    controlsApi: controlsApi,
                    getCamera: function () { return camera; },
                    getMultiplayerMode: function () { return multiplayerMode; },
                    getDebugVisualsOn: function () { return !!(actionsApi && actionsApi.isDebugVisualsOn && actionsApi.isDebugVisualsOn()); },
                    hasInputCapture: hasInputCapture,
                    tryPlayerFire: actionsApi.tryPlayerFire,
                    readMatchContext: function () { return currentMatchView.readMatchContext(); },
                    gameSession: gameSession,
                    setTransientDebug: function (text, ms) {
                        if (opts.setTransientDebug) opts.setTransientDebug(text, ms);
                    },
                    syncMatchHud: function (matchContext) { currentMatchView.syncMatchHud(matchContext); },
                    syncReticleWithWeapon: actionsApi.syncReticleWithWeapon
                });
                presentationRuntimeLoop = presentationLoopFactory.create({
                    controlsApi: controlsApi,
                    getCamera: function () { return camera; },
                    getRenderer: function () { return renderer; },
                    getScene: function () { return scene; }
                });
                if (controlsApi && controlsApi.bind) {
                    controlsApi.bind();
                }
                animationRunning = true;
                animate(runToken);
                if (gameSession && gameSession.emitSessionState) {
                    gameSession.emitSessionState();
                }
            });
        }

        return {
            startRuntime: startRuntime,
            teardownRuntime: teardownRuntime,
            isRuntimeReady: function () { return !!runtimeInitialized; },
            isMultiplayerMode: function () { return !!multiplayerMode; },
            hasInputCapture: hasInputCapture,
            getGameSession: function () { return gameSession; },
            getRenderer: function () { return renderer; },
            getScene: function () { return scene; },
            getCamera: function () { return camera; },
            getControlsApi: function () { return controlsApi; }
        };
    };

    runtime.GameRuntimeMatchHost = GameRuntimeMatchHost;
})();
