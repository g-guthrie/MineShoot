/**
 * runtime-match-view.js - Match context reading and menu/HUD display sync.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeMatchView
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create(opts) {
        opts = opts || {};

        function currentMatchViewApi() {
            return opts.getCurrentMatchViewApi ? opts.getCurrentMatchViewApi() : null;
        }

        function currentSelfCombatApi() {
            return opts.getCurrentSelfCombatApi ? opts.getCurrentSelfCombatApi() : null;
        }

        function sharedMatchRules() {
            return opts.getSharedMatchRules ? opts.getSharedMatchRules() : null;
        }

        function runtimeShell() {
            return opts.getRuntimeShell ? opts.getRuntimeShell() : null;
        }

        function gameSession() {
            return opts.getGameSession ? opts.getGameSession() : null;
        }

        function gameUiApi() {
            return opts.getGameUiApi ? opts.getGameUiApi() : null;
        }

        function nowMs() {
            return opts.getNowMs ? opts.getNowMs() : Date.now();
        }

        function emitMenuMatchModel(detail) {
            if (!window || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
            var nextKey = JSON.stringify(detail || null);
            if (emitMenuMatchModel._lastPayloadKey === nextKey) return;
            emitMenuMatchModel._lastPayloadKey = nextKey;
            window.dispatchEvent(new CustomEvent('mayhem-menu-match-model', {
                detail: detail || null
            }));
        }

        function resolveMatchEntityName(entityId) {
            if (!entityId) return '';
            var api = currentMatchViewApi();
            if (api && api.getEntityName) {
                var winnerName = api.getEntityName(entityId);
                if (winnerName) return String(winnerName);
            }
            return '';
        }

        function formatSecondsRemaining(ms) {
            var matchRules = sharedMatchRules();
            if (matchRules && matchRules.formatSecondsRemaining) {
                return matchRules.formatSecondsRemaining(ms);
            }
            return (Math.max(0, Number(ms || 0)) / 1000).toFixed(1) + 's';
        }

        function winnerLabel(matchState, selfState) {
            var matchRules = sharedMatchRules();
            if (matchRules && matchRules.formatWinnerLabel) {
                return matchRules.formatWinnerLabel(matchState, selfState, {
                    resolveEntityName: resolveMatchEntityName
                });
            }
            return '';
        }

        function didSelfWin(matchState, selfState) {
            if (!matchState || !selfState) return false;
            if (String(matchState.gameMode || '') === 'tdm') {
                return String(selfState.teamId || '') === String(matchState.winnerTeam || '');
            }
            return String(matchState.winnerId || '') === String(selfState.id || '');
        }

        function modeDisplayName(matchState) {
            var mode = String(matchState && matchState.gameMode || '').toUpperCase();
            if (mode === 'TDM') return 'TEAM DEATHMATCH';
            return mode || 'FREE FOR ALL';
        }

        function objectiveSummary(matchState, selfState) {
            var mode = String(matchState && matchState.gameMode || '');
            if (mode === 'tdm') {
                var teamId = String(selfState && selfState.teamId || '');
                var teamProgress = Number(matchState && matchState.teamProgress && matchState.teamProgress[teamId] || 0);
                var rules = sharedMatchRules();
                var opposing = rules && rules.getLeadingOpposingTeam
                    ? rules.getLeadingOpposingTeam(matchState, teamId)
                    : { teamId: '', progress: 0 };
                return 'TEAM ' + teamProgress +
                    ' / ' + Number(matchState && matchState.targetProgress || 0) +
                    ' | OPP ' + String(opposing.teamId || '--').toUpperCase() +
                    ' ' + Number(opposing.progress || 0);
            }
            return 'GOAL ' + Number(matchState && matchState.targetProgress || 0);
        }

        function resultsSummary(matchState, selfState) {
            var rules = sharedMatchRules();
            if (rules && rules.formatMatchHudCounter) {
                return rules.formatMatchHudCounter(matchState, selfState);
            }
            return 'Kills: ' + Math.max(0, Number(selfState && selfState.kills || 0));
        }

        function readMatchContext() {
            var api = currentMatchViewApi();
            var selfCombat = currentSelfCombatApi();
            var multiplayerMode = !!(opts.isMultiplayerMode && opts.isMultiplayerMode());
            return {
                api: api,
                matchState: api && api.getMatchState ? api.getMatchState() : null,
                selfState: api
                    ? (api.getAuthoritativeSelfState
                        ? api.getAuthoritativeSelfState()
                        : (api.getSelfState ? api.getSelfState() : null))
                    : null,
                respawnState: selfCombat && selfCombat.getRespawnState ? selfCombat.getRespawnState() : null,
                privateRoomPhase: multiplayerMode && api && api.getPrivateRoomPhase ? api.getPrivateRoomPhase() : ''
            };
        }

        function updateMenuSessionPanel(matchContext) {
            var currentSession = gameSession();
            var matchState = matchContext ? matchContext.matchState : null;
            var selfState = matchContext ? matchContext.selfState : null;
            var playing = !!(currentSession && currentSession.isPlaying && currentSession.isPlaying());

            if (!(opts.isRuntimeInitialized && opts.isRuntimeInitialized())) {
                emitMenuMatchModel(null);
                if (currentSession && currentSession.setResumeButtonsVisible) {
                    currentSession.setResumeButtonsVisible(!playing && !!(opts.isRuntimeInitialized && opts.isRuntimeInitialized()));
                }
                return;
            }

            var pauseState = currentSession && currentSession.getPauseState ? currentSession.getPauseState() : null;
            if (pauseState && pauseState.active) {
                emitMenuMatchModel({
                    ready: true,
                    banner: {
                        kind: 'critical',
                        tone: 'critical',
                        title: pauseState.reason === 'idle' ? 'IDLE TIMEOUT' : 'MATCH DISCONNECTED',
                        detail: 'Connection closed to limit Cloudflare traffic.'
                    },
                    modePill: { label: 'MODE', value: String(matchState && matchState.gameMode || 'match').toUpperCase() || 'MATCH' },
                    contextPill: { label: 'STATE', value: pauseState.reason === 'idle' ? 'DISCONNECTED' : 'PAUSED' },
                    primaryPill: { label: 'STATUS', value: 'DISCONNECTED' },
                    secondaryPill: { label: 'DETAIL', value: 'CLOUDFLARE LIMIT' }
                });
                if (currentSession && currentSession.setResumeButtonsVisible) {
                    currentSession.setResumeButtonsVisible(false);
                }
                return;
            }

            var kills = Math.max(0, Number(selfState && selfState.kills || 0));
            var deaths = Math.max(0, Number(selfState && selfState.deaths || 0));
            var modeId = String(matchState && matchState.gameMode || '').toLowerCase();
            var modeValue = modeId ? modeId.toUpperCase() : 'MATCH';
            var primaryLabel = 'KILLS';
            var primaryValue = String(kills);
            var secondaryLabel = 'DEATHS';
            var secondaryValue = String(deaths);
            var contextLabel = 'STATE';
            var contextValue = !matchState || !matchState.started
                ? 'WAITING'
                : (matchState.ended ? 'RESET ' + formatSecondsRemaining(Number(matchState.resetAt || 0) - nowMs()) : 'LIVE');

            if (matchState && matchState.ended) {
                var winner = winnerLabel(matchState, selfState);
                if (winner) {
                    contextLabel = 'WINNER';
                    contextValue = String(winner || '').toUpperCase();
                } else {
                    contextLabel = 'STATE';
                    contextValue = 'ENDED';
                }
                secondaryLabel = 'RESET';
                secondaryValue = formatSecondsRemaining(Number(matchState.resetAt || 0) - nowMs());
            } else if (matchState && !matchState.ended && matchState.started) {
                if (Number(matchState.targetProgress || 0) > 0) {
                    contextLabel = 'TARGET';
                    contextValue = String(Number(matchState.targetProgress || 0).toFixed(0));
                } else if (matchState.leaderProgress != null) {
                    contextLabel = 'LEAD';
                    contextValue = String(Number(matchState.leaderProgress || 0).toFixed(0));
                }
            }

            emitMenuMatchModel({
                ready: true,
                banner: null,
                modePill: { label: 'MODE', value: modeValue },
                contextPill: { label: contextLabel, value: contextValue },
                primaryPill: { label: primaryLabel, value: primaryValue },
                secondaryPill: { label: secondaryLabel, value: secondaryValue }
            });

            if (currentSession && currentSession.setResumeButtonsVisible) {
                currentSession.setResumeButtonsVisible(!playing && currentSession.canResumeGameplay && currentSession.canResumeGameplay());
            }
        }

        function syncMatchHud(matchContext) {
            var uiApi = gameUiApi();
            if (uiApi && uiApi.updateMatchStatus) {
                uiApi.updateMatchStatus(
                    matchContext ? matchContext.matchState : null,
                    matchContext ? matchContext.selfState : null
                );
            }
            updateMenuSessionPanel(matchContext);
        }

        return {
            readMatchContext: readMatchContext,
            didSelfWin: didSelfWin,
            modeDisplayName: modeDisplayName,
            objectiveSummary: objectiveSummary,
            resultsSummary: resultsSummary,
            formatSecondsRemaining: formatSecondsRemaining,
            winnerLabel: winnerLabel,
            syncMatchHud: syncMatchHud,
            updateMenuSessionPanel: updateMenuSessionPanel
        };
    }

    runtime.GameRuntimeMatchView = {
        create: create
    };
})();
