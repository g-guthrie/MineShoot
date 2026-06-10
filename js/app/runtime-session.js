/**
 * runtime-session.js - Gameplay session, postgame, and focus lifecycle owner.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeSession
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var domUtils = runtime.GameDomUtils || null;
    var GameRuntimeSession = {};
    var IDLE_TIMEOUT_MS = 30000;
    var IDLE_WARNING_WINDOW_MS = 5000;

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
            continueBtn: document.getElementById('postgame-continue-btn'),
            menuStage: document.getElementById('menu-stage')
        };
    }

    function ensureLaunchHandoffEls() {
        return {
            flow: document.getElementById('launch-flow') || document.getElementById('launch-handoff'),
            title: document.getElementById('launch-title') || document.getElementById('launch-handoff-title'),
            copy: document.getElementById('launch-status') || document.getElementById('launch-handoff-copy'),
            note: document.getElementById('launch-note'),
            roomLabel: document.getElementById('launch-room-label'),
            enterBtn: document.getElementById('launch-enter-btn'),
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

        function setOverlayActiveFlag(visible) {
            if (!document || !document.body || !document.body.setAttribute) return;
            document.body.setAttribute('data-overlay-active', visible ? 'true' : 'false');
        }

        function setOverlayVisible(visible) {
            setOverlayActiveFlag(visible);
            if (!overlayEl) return;
            overlayEl.hidden = !visible;
            overlayEl.style.display = visible ? 'flex' : 'none';
        }

        function menuSurfaceEl() {
            return document.getElementById('menu-surface');
        }

        function setMenuContext(contextId) {
            var nextContext = String(contextId || 'menu');
            if (overlayEl && overlayEl.setAttribute) {
                overlayEl.setAttribute('data-menu-context', nextContext);
            }
            var surface = menuSurfaceEl();
            if (surface && surface.setAttribute) {
                surface.setAttribute('data-menu-context', nextContext);
            }
        }

        function setMenuOverlayMode(modeId) {
            var surface = menuSurfaceEl();
            if (!surface) return;
            var nextMode = String(modeId || '');
            if (!nextMode) {
                if (surface.removeAttribute) surface.removeAttribute('data-session-overlay');
                return;
            }
            if (surface.setAttribute) {
                surface.setAttribute('data-session-overlay', nextMode);
            }
        }

        var isPlaying = false;
        var pendingInputCapture = false;
        var phoneShootingBriefingActive = false;
        var escapeResumeReady = false;
        var suppressNextEscapeArm = false;
        var launchContext = cloneLaunchContext(null);
        var lastHandledMatchEndAt = 0;
        var listenersBound = false;
        var boundListeners = [];
        var lastStartRequestAt = 0;
        var lastGameplayActivityAt = 0;
        var idleMonitorHandle = 0;
        var lastIdleWarningSecond = 0;
        var pendingPauseReason = '';
        var pauseState = {
            active: false,
            reason: '',
            triggeredAt: 0
        };
        var postGameState = {
            active: false,
            phase: '',
            matchEndedAt: 0,
            snapshot: null,
            timer: null
        };
        var activityStateOverride = '';

        function setPhoneLandscapeRequirement(required) {
            if (typeof window === 'undefined') return;
            var setter = window.__MAYHEM_SET_PHONE_LANDSCAPE_REQUIREMENT;
            if (typeof setter !== 'function') return;
            setter(required ? 'required' : 'optional');
        }

        function baseActivityState() {
            return opts.getActivityState ? String(opts.getActivityState() || 'menu') : 'menu';
        }

        function currentActivityState() {
            if (activityStateOverride) return activityStateOverride;
            if (!opts.isRuntimeReady || !opts.isRuntimeReady()) return 'menu';
            if (pauseState.active) return 'paused';
            if (pendingInputCapture && !isPlaying) return 'awaiting_input_capture';
            return baseActivityState();
        }

        function clearActivityStateOverride() {
            activityStateOverride = '';
        }

        function setActivityStateOverride(nextState) {
            activityStateOverride = String(nextState || '');
        }

        function normalizeMenuLabel(label) {
            var text = String(label || '').trim();
            var key = text.toUpperCase();
            if (key === 'FFA') return 'Free For All';
            if (key === 'TDM') return 'Team Deathmatch';
            if (key === 'FREE FOR ALL') return 'Free For All';
            if (key === 'TEAM DEATHMATCH' || key === 'TEAM DEATH MATCH') return 'Team Deathmatch';
            return text;
        }

        function isNetworkedRuntime() {
            return !!(opts.isNetworkedRuntime && opts.isNetworkedRuntime());
        }

        function touchGameplayEnabled() {
            return !!(opts.isTouchGameplayEnabled && opts.isTouchGameplayEnabled());
        }

        function clearPhoneShootingBriefing() {
            phoneShootingBriefingActive = false;
        }

        function setMenuButtonsVisible(playVisible, backVisible) {
            var els = ensureMenuSessionEls();
            if (els.playBtn) {
                els.playBtn.style.display = playVisible ? 'inline-block' : 'none';
                els.playBtn.textContent = phoneShootingBriefingActive
                    ? 'I Understand'
                    : (pendingInputCapture ? 'Enter Match' : 'Resume Match');
            }
            if (els.backBtn) {
                els.backBtn.style.display = backVisible ? 'inline-block' : 'none';
                if (pendingInputCapture) {
                    els.backBtn.textContent = 'Return to Menu';
                } else if (pauseState.active || canResumeGameplay()) {
                    els.backBtn.textContent = 'Leave Game';
                } else {
                    els.backBtn.textContent = 'Return to Menu';
                }
            }
        }

        function requestLeaveGame() {
            if (window && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                window.dispatchEvent(new CustomEvent('mayhem-leave-game-request', {
                    detail: {
                        requiresConfirm: !!(pauseState.active || canResumeGameplay()),
                        pendingInputCapture: !!pendingInputCapture
                    }
                }));
            }
        }

        function clearIdleWarning() {
            lastIdleWarningSecond = 0;
            if (opts.setIdleWarning) opts.setIdleWarning('');
        }

        function clearPauseState() {
            pauseState.active = false;
            pauseState.reason = '';
            pauseState.triggeredAt = 0;
            escapeResumeReady = false;
            suppressNextEscapeArm = false;
        }

        function focusElement(target) {
            if (!target || typeof target.focus !== 'function') return false;
            try {
                target.focus();
                return true;
            } catch (_err) {
                return false;
            }
        }

        function escapeModalOpen() {
            return !!(runtime.GameModalManager && runtime.GameModalManager.isOpen && runtime.GameModalManager.isOpen());
        }

        function shouldPauseFromEscape(event) {
            if (!event || event.key !== 'Escape') return false;
            if (event.__mayhemResumeHandled) return false;
            if (event.repeat) return false;
            if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(event.target)) return false;
            if (!document.pointerLockElement) return false;
            if (!isPlaying) return false;
            if (escapeModalOpen()) return false;
            return true;
        }

        function focusResumeControl(preferPlay) {
            var els = ensureMenuSessionEls();
            var preferred = preferPlay ? els.playBtn : els.backBtn;
            var fallback = preferPlay ? els.backBtn : els.playBtn;
            if (focusElement(preferred)) return true;
            return focusElement(fallback);
        }

        function clearIdleMonitor() {
            if (idleMonitorHandle) {
                clearInterval(idleMonitorHandle);
                idleMonitorHandle = 0;
            }
            lastGameplayActivityAt = 0;
            clearIdleWarning();
        }

        function shouldMonitorIdle() {
            if (!isPlaying) return false;
            if (pauseState.active) return false;
            if (postGameState.active) return false;
            if (!isNetworkedRuntime()) return false;
            return baseActivityState() !== 'private_room_lobby';
        }

        function recordGameplayActivity() {
            if (!shouldMonitorIdle()) return;
            lastGameplayActivityAt = Date.now();
            clearIdleWarning();
        }

        function setPauseState(reason) {
            pauseState.active = true;
            pauseState.reason = String(reason || 'pause');
            pauseState.triggeredAt = Date.now();
            pendingInputCapture = false;
            escapeResumeReady = false;
            clearIdleWarning();
            setMenuButtonsVisible(false, true);
        }

        function suspendNetworkSession(reason) {
            if (!isNetworkedRuntime()) return false;
            if (pauseState.active) return true;
            if (opts.suspendNetworkSession && opts.suspendNetworkSession(reason) === false) {
                return false;
            }
            setPauseState(reason);
            if (opts.setTransientDebug) {
                opts.setTransientDebug(
                    reason === 'idle'
                        ? 'Idle timeout reached. Match connection closed.'
                        : 'Pause menu opened. Match connection closed.',
                    2400
                );
            }
            return true;
        }

        function triggerIdlePause() {
            if (!shouldMonitorIdle()) return;
            clearIdleMonitor();
            pendingPauseReason = 'idle';
            if (document.pointerLockElement && document.exitPointerLock) {
                document.exitPointerLock();
            }
            if (!document.pointerLockElement) {
                suspendNetworkSession('idle');
            }
        }

        function checkIdleTimeout() {
            if (!shouldMonitorIdle()) {
                clearIdleMonitor();
                return;
            }
            if (!(lastGameplayActivityAt > 0)) {
                lastGameplayActivityAt = Date.now();
            }
            var remainingMs = IDLE_TIMEOUT_MS - Math.max(0, Date.now() - lastGameplayActivityAt);
            if (remainingMs <= 0) {
                triggerIdlePause();
                return;
            }
            if (remainingMs > IDLE_WARNING_WINDOW_MS) {
                clearIdleWarning();
                return;
            }
            var nextSecond = Math.max(1, Math.ceil(remainingMs / 1000));
            if (nextSecond === lastIdleWarningSecond) return;
            lastIdleWarningSecond = nextSecond;
            if (opts.setIdleWarning) {
                opts.setIdleWarning('Inactive. Returning to pause menu in ' + nextSecond + '...');
            }
        }

        function syncIdleMonitor() {
            if (!shouldMonitorIdle()) {
                clearIdleMonitor();
                return;
            }
            if (!(lastGameplayActivityAt > 0)) {
                lastGameplayActivityAt = Date.now();
            }
            if (idleMonitorHandle) return;
            idleMonitorHandle = setInterval(checkIdleTimeout, 250);
        }

        function canResumeGameplay() {
            if (!opts.isRuntimeReady || !opts.isRuntimeReady()) return false;
            if (postGameState.active) return false;
            if (pauseState.active) return false;
            return opts.canResumeGameplay ? !!opts.canResumeGameplay() : false;
        }

        function shouldResumeFromEscape(event) {
            if (!event || event.key !== 'Escape' || event.type !== 'keydown') return false;
            if (event.__mayhemResumeHandled) return false;
            if (event.repeat) return false;
            if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(event.target)) return false;
            if (document.pointerLockElement) return false;
            if (pendingInputCapture) return false;
            if (!canResumeGameplay()) return false;
            if (escapeModalOpen()) return false;
            if (!escapeResumeReady) return false;
            return true;
        }

        function shouldArmEscapeResume(event) {
            if (!event || event.key !== 'Escape' || event.type !== 'keyup') return false;
            if (suppressNextEscapeArm) {
                suppressNextEscapeArm = false;
                return false;
            }
            if (domUtils && domUtils.isEditableTarget && domUtils.isEditableTarget(event.target)) return false;
            if (document.pointerLockElement) return false;
            if (pendingInputCapture) return false;
            if (!canResumeGameplay()) return false;
            if (escapeModalOpen()) return false;
            return true;
        }

        function emitSessionState() {
            if (!window || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
            window.dispatchEvent(new CustomEvent('mayhem-session-state', {
                detail: {
                    runtimeReady: !!(opts.isRuntimeReady && opts.isRuntimeReady()),
                    inMatch: !!isPlaying,
                    awaitingInputCapture: !!(pendingInputCapture && opts.isRuntimeReady && opts.isRuntimeReady() && !isPlaying),
                    canResume: canResumeGameplay(),
                    activityState: currentActivityState(),
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
            if (pauseState.active) {
                setMenuButtonsVisible(false, true);
                return;
            }
            if (pendingInputCapture) {
                setMenuButtonsVisible(true, true);
                return;
            }
            setMenuButtonsVisible(show, show);
        }

        function hideLaunchHandoff() {
            clearPhoneShootingBriefing();
            var els = ensureLaunchHandoffEls();
            if (els.flow) els.flow.hidden = true;
            if (els.enterBtn) els.enterBtn.hidden = true;
            if (els.roomLabel) els.roomLabel.hidden = true;
            if (!postGameState.active && els.menuStage) els.menuStage.hidden = false;
        }

        function renderLaunchHandoff(context) {
            var els = ensureLaunchHandoffEls();
            var modeLabel = opts.modeDisplayName
                ? normalizeMenuLabel(opts.modeDisplayName({ gameMode: context && context.gameMode }))
                : normalizeMenuLabel(context && context.gameMode);
            var roomLabel = String(context && (context.roomCode || context.roomId) || '').toUpperCase();
            if (phoneShootingBriefingActive) {
                if (els.menuStage) els.menuStage.hidden = true;
                if (els.flow) els.flow.hidden = false;
                if (els.title) els.title.textContent = 'Phone Shooting';
                if (els.copy) els.copy.textContent = 'There is no fire button.';
                if (els.note) {
                    els.note.textContent = 'Swipe your aim across a target to shoot. Move off the hitbox, then re-engage to shoot again.';
                }
                if (els.roomLabel) {
                    els.roomLabel.hidden = true;
                    els.roomLabel.textContent = roomLabel ? ('Room ' + roomLabel) : 'Room ----';
                }
                if (els.enterBtn) {
                    els.enterBtn.hidden = false;
                    els.enterBtn.textContent = 'I Understand';
                }
                setResumeButtonsVisible(true);
                return;
            }
            if (els.menuStage) els.menuStage.hidden = false;
            if (els.flow) els.flow.hidden = true;
            if (els.title) els.title.textContent = 'Enter Match';
            if (els.copy) {
                els.copy.textContent = modeLabel
                    ? (modeLabel + ' ready.')
                    : 'Match ready.';
            }
            if (els.note) {
                els.note.textContent = touchGameplayEnabled()
                    ? 'Phones are landscape-only. Turn your phone sideways, then tap Enter Match.'
                    : 'Click Enter Match to capture the mouse and drop into the arena.';
            }
            if (els.roomLabel) {
                els.roomLabel.hidden = true;
                els.roomLabel.textContent = roomLabel ? ('Room ' + roomLabel) : 'Room ----';
            }
            if (els.enterBtn) {
                els.enterBtn.hidden = true;
                els.enterBtn.textContent = 'Enter Match';
            }
            setResumeButtonsVisible(true);
        }

        function showLaunchHandoff(context) {
            clearActivityStateOverride();
            setPhoneLandscapeRequirement(true);
            setOverlayVisible(true);
            isPlaying = false;
            pendingInputCapture = true;
            phoneShootingBriefingActive = touchGameplayEnabled();
            clearIdleMonitor();
            renderLaunchHandoff(context);
            focusResumeControl(true);
            emitSessionState();
        }

        function showGameplayPrompt() {
            clearActivityStateOverride();
            setPhoneLandscapeRequirement(true);
            if (opts.deactivateTouchGameplayCapture) opts.deactivateTouchGameplayCapture();
            setOverlayVisible(true);
            isPlaying = false;
            pendingInputCapture = false;
            clearIdleMonitor();
            hideLaunchHandoff();
            setResumeButtonsVisible(canResumeGameplay());
            focusResumeControl(canResumeGameplay());
            emitSessionState();
        }

        function restoreResumablePauseState() {
            clearActivityStateOverride();
            setPhoneLandscapeRequirement(true);
            if (opts.deactivateTouchGameplayCapture) opts.deactivateTouchGameplayCapture();
            setOverlayVisible(true);
            isPlaying = false;
            pendingInputCapture = false;
            clearIdleMonitor();
            hideLaunchHandoff();
            setResumeButtonsVisible(true);
            focusResumeControl(true);
        }

        function hidePostGameFlow() {
            var els = ensurePostGameEls();
            clearPostGameTimer();
            postGameState.active = false;
            postGameState.phase = '';
            postGameState.matchEndedAt = 0;
            postGameState.snapshot = null;
            clearIdleMonitor();
            setPhoneLandscapeRequirement(false);
            if (els.flow) els.flow.hidden = true;
            if (els.celebration) els.celebration.hidden = true;
            if (els.results) els.results.hidden = true;
            if (els.menuStage) els.menuStage.hidden = false;
            setMenuOverlayMode('');
            emitSessionState();
        }

        function completePostGameFlow() {
            var snapshot = postGameState.snapshot;
            hidePostGameFlow();
            setMenuContext('menu');
            if (opts.isPrivateRoomSession && opts.isPrivateRoomSession(snapshot)) {
                if (opts.teardownRuntime) opts.teardownRuntime('postgame_private_room');
                setActivityStateOverride('private_room_lobby');
                setOverlayVisible(true);
                isPlaying = false;
                clearIdleMonitor();
                setResumeButtonsVisible(false);
                emitSessionState();
                return;
            }
            if (opts.teardownRuntime) opts.teardownRuntime('postgame_menu');
            if (opts.returnToMenu) opts.returnToMenu();
        }

        function showPostGameResults() {
            var els = ensurePostGameEls();
            var snapshot = postGameState.snapshot || {};
            var matchState = snapshot.matchState || null;
            var selfState = snapshot.selfState || null;
            var winner = opts.resolveWinnerLabel ? (opts.resolveWinnerLabel(matchState, selfState) || 'Player') : 'Player';
            var won = opts.didSelfWin ? !!opts.didSelfWin(matchState, selfState) : false;
            var kills = Math.max(0, Number(selfState && selfState.kills || 0));
            var deaths = Math.max(0, Number(selfState && selfState.deaths || 0));

            postGameState.phase = 'results';
            clearPostGameTimer();
            if (els.celebration) els.celebration.hidden = true;
            if (els.results) els.results.hidden = false;
            if (els.resultsOutcome) els.resultsOutcome.textContent = won ? 'Victory' : 'Defeat';
            if (els.resultsWinner) els.resultsWinner.textContent = winner;
            if (els.resultsMode) els.resultsMode.textContent = opts.modeDisplayName ? normalizeMenuLabel(opts.modeDisplayName(matchState)) : 'Free For All';
            if (els.resultsLine) els.resultsLine.textContent = kills + ' / ' + deaths;
            if (els.resultsObjective) {
                els.resultsObjective.textContent = opts.objectiveSummary ? opts.objectiveSummary(matchState, selfState) : 'Goal 0';
            }
            if (els.continueBtn) {
                els.continueBtn.textContent = (opts.isPrivateRoomSession && opts.isPrivateRoomSession(snapshot)) ? 'Return to Room' : 'Main Menu';
            }
        }

        function beginPostGameFlow(matchContext) {
            var matchState = matchContext ? matchContext.matchState : null;
            if (!matchState || !matchState.ended || !Number(matchState.endedAt || 0)) return;
            if (postGameState.active && postGameState.matchEndedAt === Number(matchState.endedAt || 0)) return;

            var els = ensurePostGameEls();
            var selfState = matchContext ? matchContext.selfState : null;
            var winner = opts.resolveWinnerLabel ? (opts.resolveWinnerLabel(matchState, selfState) || 'Player') : 'Player';
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

            clearIdleMonitor();
            clearPostGameTimer();
            setPhoneLandscapeRequirement(true);
            if (opts.deactivateTouchGameplayCapture) opts.deactivateTouchGameplayCapture();
            if (document.pointerLockElement && document.exitPointerLock) {
                document.exitPointerLock();
            }
            setMenuContext('active-match');
            setMenuOverlayMode('postgame');
            setOverlayVisible(true);
            isPlaying = false;
            pendingInputCapture = false;
            hideLaunchHandoff();
            setResumeButtonsVisible(false);
            if (els.menuStage) els.menuStage.hidden = false;
            if (els.flow) els.flow.hidden = false;
            if (els.results) els.results.hidden = true;
            if (els.celebration) els.celebration.hidden = false;
            if (els.winnerBanner) els.winnerBanner.textContent = winner;
            if (els.resultBanner) els.resultBanner.textContent = won ? 'Victory' : 'Defeat';
            if (els.celebrationNote) {
                els.celebrationNote.textContent = won
                    ? 'Victory saved.'
                    : (winner + ' takes the round.');
            }
            postGameState.timer = setTimeout(showPostGameResults, 2600);
            emitSessionState();
        }

        function requestPlayStart(event) {
            escapeResumeReady = false;
            var now = performance.now();
            var eventType = event && event.type ? String(event.type) : '';
            var resumeFromPause = !isPlaying && !pendingInputCapture && canResumeGameplay();
            var debouncePointerActivation =
                eventType === 'click' ||
                eventType === 'pointerup' ||
                eventType === 'mousedown' ||
                eventType === 'touchend';
            if (debouncePointerActivation) {
                if (now - lastStartRequestAt < 140) {
                    return Promise.resolve({ ok: false, entered: false, pendingCapture: true });
                }
                lastStartRequestAt = now;
            }

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

            if (phoneShootingBriefingActive) {
                phoneShootingBriefingActive = false;
                renderLaunchHandoff(launchContext);
                focusResumeControl(true);
                emitSessionState();
                return Promise.resolve({
                    ok: true,
                    entered: false,
                    pendingCapture: true,
                    acknowledgedPhoneBriefing: true
                });
            }

            var validation = opts.validateLaunch ? opts.validateLaunch() : { ok: true };
            if (!validation.ok) {
                if (opts.setTransientDebug) opts.setTransientDebug(validation.message, 1800);
                emitSessionState();
                return Promise.resolve({ ok: false, entered: false, pendingCapture: true, error: validation.message });
            }

            if (opts.beforeGameplayEntry) opts.beforeGameplayEntry();
            clearActivityStateOverride();
            clearPauseState();
            clearIdleWarning();

            if (touchGameplayEnabled()) {
                var touchEntered = opts.activateTouchGameplayCapture ? !!opts.activateTouchGameplayCapture() : false;
                if (!touchEntered) {
                    setPhoneLandscapeRequirement(true);
                    setOverlayVisible(true);
                    isPlaying = false;
                    pendingInputCapture = false;
                    clearIdleMonitor();
                    hideLaunchHandoff();
                    setResumeButtonsVisible(false);
                    emitSessionState();
                    return Promise.resolve({ ok: true, entered: false, pendingCapture: false, error: 'Landscape required.' });
                }
                setPhoneLandscapeRequirement(true);
                pendingInputCapture = false;
                hideLaunchHandoff();
                setOverlayVisible(false);
                isPlaying = true;
                recordGameplayActivity();
                syncIdleMonitor();
                setResumeButtonsVisible(false);
                emitSessionState();
                return Promise.resolve({ ok: true, entered: true, pendingCapture: false });
            }

            var target = opts.getPointerLockTarget ? opts.getPointerLockTarget() : null;
            if (!target) {
                if (resumeFromPause) {
                    restoreResumablePauseState();
                } else {
                    setOverlayVisible(true);
                    isPlaying = false;
                    pendingInputCapture = true;
                    setResumeButtonsVisible(true);
                }
                emitSessionState();
                return Promise.resolve({ ok: true, entered: false, pendingCapture: !resumeFromPause });
            }

            var requestLock = target.requestPointerLock || target.webkitRequestPointerLock || target.mozRequestPointerLock;
            if (typeof requestLock !== 'function') {
                if (opts.setTransientDebug) opts.setTransientDebug('Pointer lock is required for gameplay.', 2200);
                if (resumeFromPause) {
                    restoreResumablePauseState();
                } else {
                    setOverlayVisible(true);
                    isPlaying = false;
                    pendingInputCapture = true;
                    setResumeButtonsVisible(true);
                }
                emitSessionState();
                return Promise.resolve({
                    ok: true,
                    entered: false,
                    pendingCapture: !resumeFromPause,
                    error: 'Pointer lock is required for gameplay.'
                });
            }

            try {
                var maybePromise = requestLock.call(target);
                if (maybePromise && typeof maybePromise.then === 'function' && typeof maybePromise.catch === 'function') {
                    return maybePromise.then(function () {
                        var entered = document.pointerLockElement === target;
                        if (!entered && resumeFromPause) {
                            restoreResumablePauseState();
                        } else {
                            pendingInputCapture = !entered;
                            if (pendingInputCapture) setResumeButtonsVisible(true);
                        }
                        emitSessionState();
                        return {
                            ok: true,
                            entered: entered,
                            pendingCapture: !entered && !resumeFromPause
                        };
                    }).catch(function () {
                        if (!document.pointerLockElement) {
                            setOverlayVisible(true);
                            isPlaying = false;
                            if (opts.setTransientDebug) opts.setTransientDebug('Pointer lock denied. Click PLAY to retry.', 2200);
                        }
                        if (resumeFromPause) {
                            restoreResumablePauseState();
                        } else {
                            pendingInputCapture = true;
                            setResumeButtonsVisible(true);
                        }
                        emitSessionState();
                        return {
                            ok: true,
                            entered: false,
                            pendingCapture: !resumeFromPause,
                            error: 'Pointer lock denied.'
                        };
                    });
                }
                var enteredSync = document.pointerLockElement === target;
                if (!enteredSync && resumeFromPause) {
                    restoreResumablePauseState();
                } else {
                    pendingInputCapture = !enteredSync;
                    if (pendingInputCapture) setResumeButtonsVisible(true);
                }
                emitSessionState();
                return Promise.resolve({
                    ok: true,
                    entered: enteredSync,
                    pendingCapture: !enteredSync && !resumeFromPause
                });
            } catch (err) {
                if (opts.setTransientDebug) opts.setTransientDebug('Pointer lock failed. Click PLAY to retry.', 2200);
                if (resumeFromPause) {
                    restoreResumablePauseState();
                } else {
                    setOverlayVisible(true);
                    isPlaying = false;
                    pendingInputCapture = true;
                    setResumeButtonsVisible(true);
                }
                emitSessionState();
                return Promise.resolve({
                    ok: true,
                    entered: false,
                    pendingCapture: !resumeFromPause,
                    error: 'Pointer lock failed.'
                });
            }
        }

        function triggerResumeGameplay(event) {
            return requestPlayStart(event);
        }

        function addManagedListener(target, type, fn, listenerOpts) {
            if (!target || typeof target.addEventListener !== 'function') return;
            target.addEventListener(type, fn, listenerOpts);
            boundListeners.push([target, type, fn, listenerOpts]);
        }

        function removeManagedListeners() {
            for (var i = 0; i < boundListeners.length; i++) {
                var entry = boundListeners[i];
                var target = entry[0];
                if (target && typeof target.removeEventListener === 'function') {
                    target.removeEventListener(entry[1], entry[2], entry[3]);
                }
            }
            boundListeners.length = 0;
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
                    addManagedListener(playBtn, 'click', triggerResumeGameplay);
                    addManagedListener(playBtn, 'touchend', triggerResumeGameplay, { passive: false });
                }

                if (backModeBtn) {
                    addManagedListener(backModeBtn, 'click', function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        if (pauseState.active || canResumeGameplay()) {
                            requestLeaveGame();
                            return;
                        }
                        api.returnToMenu();
                    });
                }

                if (postGameEls.celebration) {
                    addManagedListener(postGameEls.celebration, 'click', function () {
                        if (postGameState.active && postGameState.phase === 'celebration') {
                            showPostGameResults();
                        }
                    });
                }

                if (postGameEls.continueBtn) {
                    addManagedListener(postGameEls.continueBtn, 'click', function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        completePostGameFlow();
                    });
                }

                if (handoffEls.enterBtn) {
                    addManagedListener(handoffEls.enterBtn, 'click', function (event) {
                        api.enterGameplay(event, launchContext);
                    });
                }

                addManagedListener(document, 'keydown', function (event) {
                    if (event.key === 'Escape' && !event.repeat) {
                        suppressNextEscapeArm = escapeModalOpen();
                        if (suppressNextEscapeArm) {
                            escapeResumeReady = false;
                        }
                    }
                    if (!postGameState.active) {
                        if (shouldPauseFromEscape(event)) {
                            pendingPauseReason = '';
                            event.preventDefault();
                            event.stopPropagation();
                            if (document.exitPointerLock) {
                                document.exitPointerLock();
                            }
                            return;
                        }
                        if (shouldResumeFromEscape(event)) {
                            event.preventDefault();
                            event.stopPropagation();
                            triggerResumeGameplay(event);
                            return;
                        }
                        recordGameplayActivity();
                        return;
                    }
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (postGameState.phase === 'celebration') {
                            showPostGameResults();
                        } else {
                            completePostGameFlow();
                        }
                    }
                });

                addManagedListener(document, 'mousemove', recordGameplayActivity);
                addManagedListener(document, 'mousedown', recordGameplayActivity);
                addManagedListener(document, 'mouseup', recordGameplayActivity);
                addManagedListener(document, 'wheel', recordGameplayActivity);
                addManagedListener(document, 'touchstart', recordGameplayActivity);
                addManagedListener(document, 'keyup', function (event) {
                    if (!shouldArmEscapeResume(event)) return;
                    escapeResumeReady = true;
                });
                addManagedListener(window, 'focus', recordGameplayActivity);

                addManagedListener(document, 'pointerlockchange', function () {
                    var target = opts.getPointerLockTarget ? opts.getPointerLockTarget() : null;
                    var lostWhilePlaying = !!isPlaying;
                    escapeResumeReady = false;
                    if (document.pointerLockElement === target) {
                        pendingInputCapture = false;
                        clearPauseState();
                        hideLaunchHandoff();
                        setOverlayVisible(false);
                        isPlaying = true;
                        recordGameplayActivity();
                        syncIdleMonitor();
                        setResumeButtonsVisible(false);
                    } else {
                        if (opts.deactivateTouchGameplayCapture) opts.deactivateTouchGameplayCapture();
                        if (opts.releaseTransientInput) opts.releaseTransientInput();
                        setOverlayVisible(true);
                        isPlaying = false;
                        clearIdleMonitor();
                        if (lostWhilePlaying && !postGameState.active && pendingPauseReason === 'idle') {
                            suspendNetworkSession('idle');
                        }
                        pendingPauseReason = '';
                        if (!pendingInputCapture) {
                            hideLaunchHandoff();
                            setResumeButtonsVisible(canResumeGameplay());
                            focusResumeControl(canResumeGameplay());
                        } else {
                            showLaunchHandoff(launchContext);
                        }
                    }
                    emitSessionState();
                });

                addManagedListener(document, 'pointerlockerror', function () {
                    escapeResumeReady = false;
                    if (!document.pointerLockElement) {
                        var resumablePause = !isPlaying && !pendingInputCapture && canResumeGameplay();
                        if (opts.releaseTransientInput) opts.releaseTransientInput();
                        if (opts.setTransientDebug) opts.setTransientDebug('Pointer lock error. Click PLAY to retry.', 2200);
                        if (resumablePause) {
                            restoreResumablePauseState();
                        } else {
                            setOverlayVisible(true);
                            isPlaying = false;
                            clearIdleMonitor();
                            pendingInputCapture = true;
                            setResumeButtonsVisible(true);
                        }
                    }
                    emitSessionState();
                });

                if (modeButtonsWrap && modeButtonsWrap.style.display !== 'none') {
                    setResumeButtonsVisible(false);
                }

                emitSessionState();
            },
            unbindRuntimeControls: function () {
                if (!listenersBound) return;
                listenersBound = false;
                removeManagedListeners();
                clearIdleMonitor();
                clearPostGameTimer();
                if (runtime.GameSession === api) {
                    runtime.GameSession = null;
                }
            },
            destroy: function () {
                api.unbindRuntimeControls();
            },
            isPlaying: function () {
                return !!isPlaying;
            },
            canResumeGameplay: canResumeGameplay,
            setResumeButtonsVisible: setResumeButtonsVisible,
            emitSessionState: emitSessionState,
            prepareLaunch: function (context) {
                launchContext = cloneLaunchContext(context);
                var handoffEls = ensureLaunchHandoffEls();
                var roomLabel = String(launchContext.roomCode || launchContext.roomId || '').toUpperCase();
                hidePostGameFlow();
                setMenuContext('menu');
                lastHandledMatchEndAt = 0;
                clearActivityStateOverride();
                clearPauseState();
                clearIdleMonitor();
                setPhoneLandscapeRequirement(false);
                if (opts.deactivateTouchGameplayCapture) opts.deactivateTouchGameplayCapture();
                pendingInputCapture = false;
                hideLaunchHandoff();
                setOverlayVisible(true);
                isPlaying = false;
                if (handoffEls.flow) handoffEls.flow.hidden = true;
                if (handoffEls.title) handoffEls.title.textContent = 'Connecting';
                if (handoffEls.copy) handoffEls.copy.textContent = 'Loading gameplay runtime...';
                if (handoffEls.note) handoffEls.note.textContent = 'Waiting for authoritative room admission.';
                if (handoffEls.roomLabel) {
                    handoffEls.roomLabel.hidden = true;
                    handoffEls.roomLabel.textContent = roomLabel ? ('Room ' + roomLabel) : 'Room ----';
                }
                setResumeButtonsVisible(false);
                emitSessionState();
            },
            enterGameplay: function (event, context) {
                if (context) launchContext = cloneLaunchContext(context);
                return requestPlayStart(event).then(function (result) {
                    if (result && !result.entered && !result.acknowledgedPhoneBriefing) {
                        showLaunchHandoff(launchContext);
                    }
                    return result;
                });
            },
            resumeGameplay: function (event) {
                return triggerResumeGameplay(event);
            },
            showInputCapturePrompt: function (context) {
                if (context) launchContext = cloneLaunchContext(context);
                showLaunchHandoff(launchContext);
            },
            showLaunchOverlay: function (phase, context) {
                var nextPhase = String(phase || '');
                if (context) launchContext = cloneLaunchContext(context);
                if (nextPhase === 'joined_ready') {
                    showLaunchHandoff(launchContext);
                    return;
                }
                if (nextPhase === 'idle') {
                    showGameplayPrompt();
                    return;
                }
                api.prepareLaunch(launchContext);
            },
            hideInputCapturePrompt: function () {
                pendingInputCapture = false;
                hideLaunchHandoff();
                emitSessionState();
            },
            startGameplayFromMenu: function (event) {
                return api.enterGameplay(event, launchContext);
            },
            returnToMenu: function () {
                clearActivityStateOverride();
                clearPauseState();
                clearIdleMonitor();
                clearPostGameTimer();
                setPhoneLandscapeRequirement(false);
                if (opts.deactivateTouchGameplayCapture) opts.deactivateTouchGameplayCapture();
                hidePostGameFlow();
                setMenuContext('menu');
                // Private room: stay on page and return to room lobby gracefully
                if (opts.isPrivateRoomSession && opts.isPrivateRoomSession(null)) {
                    if (opts.teardownRuntime) opts.teardownRuntime('return_to_room_lobby');
                    setActivityStateOverride('private_room_lobby');
                    setOverlayVisible(true);
                    isPlaying = false;
                    setResumeButtonsVisible(false);
                    emitSessionState();
                    return;
                }
                if (opts.teardownRuntime) opts.teardownRuntime('return_to_menu');
                if (opts.returnToMenu) opts.returnToMenu();
            },
            getActivityState: currentActivityState,
            getPauseState: function () {
                return {
                    active: !!pauseState.active,
                    reason: String(pauseState.reason || ''),
                    triggeredAt: Number(pauseState.triggeredAt || 0)
                };
            },
            showGameplayPrompt: showGameplayPrompt,
            syncMatchState: function (matchContext) {
                var matchState = matchContext ? matchContext.matchState : null;
                if (postGameState.active) {
                    return;
                }
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
