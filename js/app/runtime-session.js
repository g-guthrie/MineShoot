/**
 * runtime-session.js - Gameplay session, postgame, and focus lifecycle owner.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeSession
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameRuntimeSession = {};

    function ensureMenuSessionEls() {
        return {
            playBtn: document.getElementById('play-btn'),
            backBtn: document.getElementById('back-mode-btn')
        };
    }

    function ensurePostGameEls() {
        return {
            flow: document.getElementById('postgame-flow'),
            celebration: document.getElementById('postgame-celebration'),
            winnerBanner: document.getElementById('postgame-winner-banner'),
            resultBanner: document.getElementById('postgame-result-banner'),
            celebrationNote: document.getElementById('postgame-celebration-note'),
            results: document.getElementById('postgame-results'),
            resultsOutcome: document.getElementById('postgame-results-outcome'),
            resultsWinner: document.getElementById('postgame-results-winner'),
            resultsMode: document.getElementById('postgame-results-mode'),
            resultsLine: document.getElementById('postgame-results-line'),
            resultsObjective: document.getElementById('postgame-results-objective'),
            resultsState: document.getElementById('postgame-results-state'),
            resultsSummary: document.getElementById('postgame-results-summary'),
            continueBtn: document.getElementById('postgame-continue-btn'),
            menuStage: document.getElementById('menu-stage')
        };
    }

    function ensureLaunchHandoffEls() {
        return {
            flow: document.getElementById('launch-handoff'),
            title: document.getElementById('launch-handoff-title'),
            copy: document.getElementById('launch-handoff-copy'),
            enterBtn: document.getElementById('launch-enter-btn'),
            cancelBtn: document.getElementById('launch-cancel-btn'),
            menuStage: document.getElementById('menu-stage')
        };
    }

    function cloneLaunchContext(context) {
        var source = context || {};
        return {
            launchKind: String(source.launchKind || ''),
            gameMode: String(source.gameMode || ''),
            roomId: String(source.roomId || ''),
            roomCode: String(source.roomCode || ''),
            roomPhase: String(source.roomPhase || ''),
            modeId: String(source.modeId || ''),
            requiresNetwork: !!source.requiresNetwork,
            canResume: !!source.canResume,
            error: String(source.error || '')
        };
    }

    function cloneMatchData(value) {
        return value ? JSON.parse(JSON.stringify(value)) : null;
    }

    GameRuntimeSession.create = function (opts) {
        opts = opts || {};

        var overlayEl = document.getElementById('overlay');
        var isPlaying = false;
        var pendingInputCapture = false;
        var launchContext = cloneLaunchContext(null);
        var lastHandledMatchEndAt = 0;
        var listenersBound = false;
        var lastStartRequestAt = 0;
        var postGameState = {
            active: false,
            phase: '',
            matchEndedAt: 0,
            snapshot: null,
            timer: null
        };

        function canResumeGameplay() {
            if (!opts.isRuntimeReady || !opts.isRuntimeReady()) return false;
            if (postGameState.active) return false;
            return opts.canResumeGameplay ? !!opts.canResumeGameplay() : false;
        }

        function emitSessionState() {
            if (!window || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
            window.dispatchEvent(new CustomEvent('mayhem-session-state', {
                detail: {
                    runtimeReady: !!(opts.isRuntimeReady && opts.isRuntimeReady()),
                    inMatch: !!isPlaying,
                    awaitingInputCapture: !!(pendingInputCapture && opts.isRuntimeReady && opts.isRuntimeReady() && !isPlaying),
                    canResume: canResumeGameplay(),
                    activityState: opts.getActivityState ? String(opts.getActivityState() || 'menu') : 'menu',
                    launchContext: cloneLaunchContext(launchContext)
                }
            }));
        }

        function clearPostGameTimer() {
            if (postGameState.timer) {
                clearTimeout(postGameState.timer);
                postGameState.timer = null;
            }
        }

        function setResumeButtonsVisible(show) {
            var els = ensureMenuSessionEls();
            if (els.playBtn) els.playBtn.style.display = show ? 'inline-block' : 'none';
            if (els.backBtn) els.backBtn.style.display = show ? 'inline-block' : 'none';
        }

        function hideLaunchHandoff() {
            var els = ensureLaunchHandoffEls();
            if (els.flow) els.flow.hidden = true;
            if (!postGameState.active && els.menuStage) els.menuStage.hidden = false;
        }

        function showLaunchHandoff(context) {
            var els = ensureLaunchHandoffEls();
            var modeLabel = String(context && context.gameMode || '').toUpperCase();
            if (overlayEl) overlayEl.style.display = 'flex';
            isPlaying = false;
            pendingInputCapture = true;
            if (els.menuStage) els.menuStage.hidden = true;
            if (els.flow) els.flow.hidden = false;
            if (els.title) els.title.textContent = 'ENTER MATCH';
            if (els.copy) {
                els.copy.textContent = modeLabel
                    ? (modeLabel + ' READY. CLICK TO CAPTURE THE MOUSE AND DROP INTO THE ARENA.')
                    : 'CLICK TO CAPTURE THE MOUSE AND DROP INTO THE ARENA.';
            }
            setResumeButtonsVisible(false);
            emitSessionState();
        }

        function showGameplayPrompt() {
            if (overlayEl) overlayEl.style.display = 'flex';
            isPlaying = false;
            pendingInputCapture = false;
            hideLaunchHandoff();
            setResumeButtonsVisible(canResumeGameplay());
            emitSessionState();
        }

        function hidePostGameFlow() {
            var els = ensurePostGameEls();
            clearPostGameTimer();
            postGameState.active = false;
            postGameState.phase = '';
            postGameState.snapshot = null;
            if (els.flow) els.flow.hidden = true;
            if (els.celebration) els.celebration.hidden = true;
            if (els.results) els.results.hidden = true;
            if (els.menuStage) els.menuStage.hidden = false;
            emitSessionState();
        }

        function completePostGameFlow() {
            var snapshot = postGameState.snapshot;
            hidePostGameFlow();
            if (opts.isPrivateRoomSession && opts.isPrivateRoomSession(snapshot)) {
                if (overlayEl) overlayEl.style.display = 'flex';
                isPlaying = false;
                setResumeButtonsVisible(canResumeGameplay());
                return;
            }
            if (opts.returnToMenu) opts.returnToMenu();
        }

        function showPostGameResults() {
            var els = ensurePostGameEls();
            var snapshot = postGameState.snapshot || {};
            var matchState = snapshot.matchState || null;
            var selfState = snapshot.selfState || null;
            var winner = opts.resolveWinnerLabel ? (opts.resolveWinnerLabel(matchState, selfState) || 'PLAYER') : 'PLAYER';
            var won = opts.didSelfWin ? !!opts.didSelfWin(matchState, selfState) : false;
            var kills = Math.max(0, Number(selfState && selfState.kills || 0));
            var deaths = Math.max(0, Number(selfState && selfState.deaths || 0));

            postGameState.phase = 'results';
            clearPostGameTimer();
            if (els.celebration) els.celebration.hidden = true;
            if (els.results) els.results.hidden = false;
            if (els.resultsOutcome) els.resultsOutcome.textContent = won ? 'VICTORY' : 'DEFEAT';
            if (els.resultsWinner) els.resultsWinner.textContent = winner;
            if (els.resultsMode) els.resultsMode.textContent = opts.modeDisplayName ? opts.modeDisplayName(matchState) : 'FREE FOR ALL';
            if (els.resultsLine) els.resultsLine.textContent = kills + ' / ' + deaths;
            if (els.resultsObjective) {
                els.resultsObjective.textContent = opts.objectiveSummary ? opts.objectiveSummary(matchState, selfState) : 'GOAL 0';
            }
            if (els.resultsState) {
                els.resultsState.textContent = matchState && matchState.ended
                    ? ('RESET ' + (opts.formatSecondsRemaining ? opts.formatSecondsRemaining(Number(matchState.resetAt || 0) - Date.now()) : '0.0s'))
                    : 'ROUND COMPLETE';
            }
            if (els.resultsSummary) {
                els.resultsSummary.textContent = opts.resultsSummary ? opts.resultsSummary(matchState, selfState) : 'Summary unavailable.';
            }
            if (els.continueBtn) {
                els.continueBtn.textContent = (opts.isPrivateRoomSession && opts.isPrivateRoomSession(snapshot)) ? 'RETURN TO ROOM' : 'MAIN MENU';
            }
        }

        function beginPostGameFlow(matchContext) {
            var matchState = matchContext ? matchContext.matchState : null;
            if (!matchState || !matchState.ended || !Number(matchState.endedAt || 0)) return;
            if (postGameState.active && postGameState.matchEndedAt === Number(matchState.endedAt || 0)) return;

            var els = ensurePostGameEls();
            var selfState = matchContext ? matchContext.selfState : null;
            var winner = opts.resolveWinnerLabel ? (opts.resolveWinnerLabel(matchState, selfState) || 'PLAYER') : 'PLAYER';
            var won = opts.didSelfWin ? !!opts.didSelfWin(matchState, selfState) : false;

            postGameState.active = true;
            postGameState.phase = 'celebration';
            postGameState.matchEndedAt = Number(matchState.endedAt || 0);
            postGameState.snapshot = {
                matchState: cloneMatchData(matchState),
                selfState: cloneMatchData(selfState),
                respawnState: cloneMatchData(matchContext ? matchContext.respawnState : null),
                privateRoomPhase: matchContext ? String(matchContext.privateRoomPhase || '') : ''
            };

            clearPostGameTimer();
            if (document.pointerLockElement && document.exitPointerLock) {
                document.exitPointerLock();
            }
            if (overlayEl) overlayEl.style.display = 'flex';
            isPlaying = false;
            pendingInputCapture = false;
            hideLaunchHandoff();
            setResumeButtonsVisible(false);
            if (els.menuStage) els.menuStage.hidden = true;
            if (els.flow) els.flow.hidden = false;
            if (els.results) els.results.hidden = true;
            if (els.celebration) els.celebration.hidden = false;
            if (els.winnerBanner) els.winnerBanner.textContent = winner;
            if (els.resultBanner) els.resultBanner.textContent = won ? 'VICTORY' : 'DEFEAT';
            if (els.celebrationNote) {
                els.celebrationNote.textContent = won
                    ? 'YOUR GHOST CREW IS DOING A SICK LITTLE WIN DANCE.'
                    : (winner + ' GETS THE TROPHY. YOUR GHOSTS ARE FORCED TO APPLAUD.');
            }
            postGameState.timer = setTimeout(showPostGameResults, 2600);
            emitSessionState();
        }

        function requestPlayStart(event) {
            var now = performance.now();
            if (now - lastStartRequestAt < 140) return Promise.resolve({ ok: false, entered: false, pendingCapture: true });
            lastStartRequestAt = now;

            if (event) {
                if (typeof event.button === 'number' && event.button !== 0) {
                    return Promise.resolve({ ok: false, entered: false, pendingCapture: true });
                }
                event.preventDefault();
                event.stopPropagation();
            }

            if (!canResumeGameplay()) {
                emitSessionState();
                return Promise.resolve({ ok: false, entered: false, pendingCapture: true });
            }

            var validation = opts.validateLaunch ? opts.validateLaunch() : { ok: true };
            if (!validation.ok) {
                if (opts.setTransientDebug) opts.setTransientDebug(validation.message, 1800);
                emitSessionState();
                return Promise.resolve({ ok: false, entered: false, pendingCapture: true, error: validation.message });
            }

            if (opts.beforeGameplayEntry) opts.beforeGameplayEntry();

            var target = opts.getPointerLockTarget ? opts.getPointerLockTarget() : null;
            if (!target) {
                if (overlayEl) overlayEl.style.display = 'flex';
                isPlaying = false;
                setResumeButtonsVisible(canResumeGameplay());
                pendingInputCapture = true;
                emitSessionState();
                return Promise.resolve({ ok: true, entered: false, pendingCapture: true });
            }

            var requestLock = target.requestPointerLock || target.webkitRequestPointerLock || target.mozRequestPointerLock;
            if (typeof requestLock !== 'function') {
                if (overlayEl) overlayEl.style.display = 'flex';
                isPlaying = false;
                setResumeButtonsVisible(canResumeGameplay());
                if (opts.setTransientDebug) opts.setTransientDebug('Pointer lock is required for gameplay.', 2200);
                pendingInputCapture = true;
                emitSessionState();
                return Promise.resolve({ ok: true, entered: false, pendingCapture: true, error: 'Pointer lock is required for gameplay.' });
            }

            try {
                var maybePromise = requestLock.call(target);
                if (maybePromise && typeof maybePromise.then === 'function' && typeof maybePromise.catch === 'function') {
                    return maybePromise.then(function () {
                        pendingInputCapture = !(document.pointerLockElement === target);
                        emitSessionState();
                        return {
                            ok: true,
                            entered: document.pointerLockElement === target,
                            pendingCapture: !(document.pointerLockElement === target)
                        };
                    }).catch(function () {
                        if (!document.pointerLockElement) {
                            if (overlayEl) overlayEl.style.display = 'flex';
                            isPlaying = false;
                            setResumeButtonsVisible(canResumeGameplay());
                            if (opts.setTransientDebug) opts.setTransientDebug('Pointer lock denied. Click PLAY to retry.', 2200);
                        }
                        pendingInputCapture = true;
                        emitSessionState();
                        return {
                            ok: true,
                            entered: false,
                            pendingCapture: true,
                            error: 'Pointer lock denied.'
                        };
                    });
                }
                pendingInputCapture = !(document.pointerLockElement === target);
                emitSessionState();
                return Promise.resolve({
                    ok: true,
                    entered: document.pointerLockElement === target,
                    pendingCapture: !(document.pointerLockElement === target)
                });
            } catch (err) {
                if (overlayEl) overlayEl.style.display = 'flex';
                isPlaying = false;
                setResumeButtonsVisible(canResumeGameplay());
                if (opts.setTransientDebug) opts.setTransientDebug('Pointer lock failed. Click PLAY to retry.', 2200);
                pendingInputCapture = true;
                emitSessionState();
                return Promise.resolve({
                    ok: true,
                    entered: false,
                    pendingCapture: true,
                    error: 'Pointer lock failed.'
                });
            }
        }

        var api = {
            bindRuntimeControls: function () {
                if (listenersBound) return;
                listenersBound = true;

                var playBtn = document.getElementById('play-btn');
                var backModeBtn = document.getElementById('back-mode-btn');
                var modeButtonsWrap = document.getElementById('mode-buttons');
                var postGameEls = ensurePostGameEls();
                var handoffEls = ensureLaunchHandoffEls();

                runtime.GameSession = api;

                if (playBtn) {
                    playBtn.addEventListener('click', requestPlayStart);
                    playBtn.addEventListener('pointerup', requestPlayStart);
                    playBtn.addEventListener('mousedown', requestPlayStart);
                    playBtn.addEventListener('touchend', requestPlayStart, { passive: false });
                }

                if (backModeBtn) {
                    backModeBtn.addEventListener('click', function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        api.returnToMenu();
                    });
                }

                if (postGameEls.celebration) {
                    postGameEls.celebration.addEventListener('click', function () {
                        if (postGameState.active && postGameState.phase === 'celebration') {
                            showPostGameResults();
                        }
                    });
                }

                if (postGameEls.continueBtn) {
                    postGameEls.continueBtn.addEventListener('click', function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        completePostGameFlow();
                    });
                }

                if (handoffEls.enterBtn) {
                    handoffEls.enterBtn.addEventListener('click', function (event) {
                        api.enterGameplay(event, launchContext);
                    });
                }

                if (handoffEls.cancelBtn) {
                    handoffEls.cancelBtn.addEventListener('click', function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        api.returnToMenu();
                    });
                }

                document.addEventListener('keydown', function (event) {
                    if (!postGameState.active) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (postGameState.phase === 'celebration') {
                            showPostGameResults();
                        } else {
                            completePostGameFlow();
                        }
                    }
                });

                document.addEventListener('pointerlockchange', function () {
                    var target = opts.getPointerLockTarget ? opts.getPointerLockTarget() : null;
                    if (document.pointerLockElement === target) {
                        pendingInputCapture = false;
                        hideLaunchHandoff();
                        if (overlayEl) overlayEl.style.display = 'none';
                        isPlaying = true;
                        setResumeButtonsVisible(false);
                    } else {
                        if (opts.releaseTransientInput) opts.releaseTransientInput();
                        if (overlayEl) overlayEl.style.display = 'flex';
                        isPlaying = false;
                        if (!pendingInputCapture) {
                            hideLaunchHandoff();
                            setResumeButtonsVisible(canResumeGameplay());
                        } else {
                            showLaunchHandoff(launchContext);
                        }
                    }
                    emitSessionState();
                });

                document.addEventListener('pointerlockerror', function () {
                    if (!document.pointerLockElement) {
                        if (opts.releaseTransientInput) opts.releaseTransientInput();
                        if (overlayEl) overlayEl.style.display = 'flex';
                        isPlaying = false;
                        setResumeButtonsVisible(canResumeGameplay());
                        if (opts.setTransientDebug) opts.setTransientDebug('Pointer lock error. Click PLAY to retry.', 2200);
                        pendingInputCapture = true;
                    }
                    emitSessionState();
                });

                if (modeButtonsWrap && modeButtonsWrap.style.display !== 'none') {
                    setResumeButtonsVisible(false);
                }

                emitSessionState();
            },
            isPlaying: function () {
                return !!isPlaying;
            },
            canResumeGameplay: canResumeGameplay,
            setResumeButtonsVisible: setResumeButtonsVisible,
            emitSessionState: emitSessionState,
            prepareLaunch: function (context) {
                launchContext = cloneLaunchContext(context);
                pendingInputCapture = false;
                hideLaunchHandoff();
                if (overlayEl) overlayEl.style.display = 'flex';
                isPlaying = false;
                setResumeButtonsVisible(false);
                emitSessionState();
            },
            enterGameplay: function (event, context) {
                if (context) launchContext = cloneLaunchContext(context);
                return requestPlayStart(event).then(function (result) {
                    if (result && !result.entered) {
                        showLaunchHandoff(launchContext);
                    }
                    return result;
                });
            },
            resumeGameplay: function (event) {
                return requestPlayStart(event);
            },
            showInputCapturePrompt: function (context) {
                if (context) launchContext = cloneLaunchContext(context);
                showLaunchHandoff(launchContext);
            },
            hideInputCapturePrompt: function () {
                pendingInputCapture = false;
                hideLaunchHandoff();
                emitSessionState();
            },
            returnToMenu: function () {
                if (opts.returnToMenu) opts.returnToMenu();
            },
            showGameplayPrompt: showGameplayPrompt,
            syncMatchState: function (matchContext) {
                var matchState = matchContext ? matchContext.matchState : null;
                if (matchState && matchState.ended && Number(matchState.endedAt || 0) > 0) {
                    if (lastHandledMatchEndAt !== Number(matchState.endedAt || 0)) {
                        lastHandledMatchEndAt = Number(matchState.endedAt || 0);
                        beginPostGameFlow(matchContext);
                    }
                    return;
                }
                lastHandledMatchEndAt = 0;
                if (!postGameState.active) {
                    hidePostGameFlow();
                }
            }
        };

        return api;
    };

    runtime.GameRuntimeSession = GameRuntimeSession;
})();
