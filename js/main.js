/**
 * main.js - Game orchestration for single-player and Cloudflare multiplayer modes
 */
(function () {
    'use strict';

    var renderer, scene, clock, camera;
    var overlay;

    var isPlaying = false;

    var debugTimer = null;

    var debugVisualsOn = false;

    var DEFAULT_ENEMY_COUNT = 5;
    var currentAimTargetId = '';
    var multiplayerMode = false;
    var forcedRoomId = 'global';
    var activeRuntimeMode = null;
    var startupDebugNotice = '';
    var autoStartNoLock = false;
    var netShotCounter = 0;
    var runtimeInitialized = false;
    var controlsApi = null;
    var lastHandledMatchEndAt = 0;
    var postGameState = {
        active: false,
        phase: '',
        matchEndedAt: 0,
        snapshot: null,
        timer: null
    };

    function depGet(name) {
        return globalThis.__MAYHEM_RUNTIME[name];
    }

    function menuLoadoutApi() {
        return depGet('GameMenuLoadout');
    }

    function applyBrandingOverrides() {
        document.title = 'Mayhem';
        var overlayTitle = document.querySelector('#overlay h1');
        if (overlayTitle) overlayTitle.textContent = 'MAYHEM';
        var docsTitle = document.getElementById('docs-title');
        if (docsTitle && /minecraft fps/i.test(docsTitle.textContent || '')) {
            docsTitle.textContent = String(docsTitle.textContent).replace(/minecraft fps/ig, 'MAYHEM');
        }
    }

    function ensureMenuSessionEls() {
        return {
            stats: document.getElementById('menu-session-stats'),
            status: document.getElementById('menu-session-status'),
            kd: document.getElementById('menu-session-kd'),
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

    function cloneMatchData(value) {
        return value ? JSON.parse(JSON.stringify(value)) : null;
    }

    function clearPostGameTimer() {
        if (postGameState.timer) {
            clearTimeout(postGameState.timer);
            postGameState.timer = null;
        }
    }

    function isPrivateRoomSession(snapshot) {
        var phase = snapshot && snapshot.privateRoomPhase ? String(snapshot.privateRoomPhase) : '';
        return !!phase || !!(activeRuntimeMode && activeRuntimeMode.roomStrategy === 'private');
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
        if (mode === 'LMS') return 'LAST MAN STANDING';
        return mode || 'FREE FOR ALL';
    }

    function objectiveSummary(matchState, selfState) {
        var mode = String(matchState && matchState.gameMode || '');
        if (mode === 'tdm') {
            var teamId = String(selfState && selfState.teamId || '');
            var teamProgress = Number(matchState && matchState.teamProgress && matchState.teamProgress[teamId] || 0);
            return 'TEAM ' + teamProgress + ' / ' + Number(matchState && matchState.targetProgress || 0);
        }
        if (mode === 'lms') {
            return 'LEFT ' + Math.max(0, Number(matchState && matchState.lms && matchState.lms.remainingPlayers || 0));
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
    }

    function completePostGameFlow() {
        var snapshot = postGameState.snapshot;
        hidePostGameFlow();
        if (isPrivateRoomSession(snapshot)) {
            if (overlay) overlay.style.display = 'flex';
            isPlaying = false;
            setResumeButtonsVisible(canResumeGameplay());
            return;
        }
        if (globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile && globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile.clearSelectedMode) {
            globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile.clearSelectedMode();
        }
        window.location.href = window.location.pathname;
    }

    function showPostGameResults() {
        var els = ensurePostGameEls();
        var snapshot = postGameState.snapshot || {};
        var matchState = snapshot.matchState || null;
        var selfState = snapshot.selfState || null;
        var winner = winnerLabel(matchState, selfState) || 'PLAYER';
        var won = didSelfWin(matchState, selfState);
        var kills = Math.max(0, Number(selfState && selfState.kills || 0));
        var deaths = Math.max(0, Number(selfState && selfState.deaths || 0));

        postGameState.phase = 'results';
        clearPostGameTimer();
        if (els.celebration) els.celebration.hidden = true;
        if (els.results) els.results.hidden = false;
        if (els.resultsOutcome) els.resultsOutcome.textContent = won ? 'VICTORY' : 'DEFEAT';
        if (els.resultsWinner) els.resultsWinner.textContent = winner;
        if (els.resultsMode) els.resultsMode.textContent = modeDisplayName(matchState);
        if (els.resultsLine) els.resultsLine.textContent = kills + ' / ' + deaths;
        if (els.resultsObjective) els.resultsObjective.textContent = objectiveSummary(matchState, selfState);
        if (els.resultsState) els.resultsState.textContent = matchState && matchState.ended
            ? ('RESET ' + formatSecondsRemaining(Number(matchState.resetAt || 0) - Date.now()))
            : 'ROUND COMPLETE';
        if (els.resultsSummary) els.resultsSummary.textContent = resultsSummary(matchState, selfState);
        if (els.continueBtn) {
            els.continueBtn.textContent = isPrivateRoomSession(snapshot) ? 'RETURN TO ROOM' : 'MAIN MENU';
        }
    }

    function beginPostGameFlow(matchContext) {
        var matchState = matchContext ? matchContext.matchState : null;
        if (!matchState || !matchState.ended || !Number(matchState.endedAt || 0)) return;
        if (postGameState.active && postGameState.matchEndedAt === Number(matchState.endedAt || 0)) return;

        var els = ensurePostGameEls();
        var selfState = matchContext ? matchContext.selfState : null;
        var winner = winnerLabel(matchState, selfState) || 'PLAYER';
        var won = didSelfWin(matchState, selfState);

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
        if (overlay) overlay.style.display = 'flex';
        isPlaying = false;
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
    }

    function canResumeGameplay() {
        if (!runtimeInitialized) return false;
        if (postGameState.active) return false;
        if (!multiplayerMode) return true;
        var matchContext = readMatchContext();
        if (matchContext.privateRoomPhase === 'lobby') return false;
        return !(matchContext.matchState && matchContext.matchState.ended);
    }

    function setResumeButtonsVisible(show) {
        var els = ensureMenuSessionEls();
        if (els.playBtn) els.playBtn.style.display = show ? 'inline-block' : 'none';
        if (els.backBtn) els.backBtn.style.display = show ? 'inline-block' : 'none';
    }

    function showGameplayPrompt() {
        if (overlay) overlay.style.display = 'flex';
        isPlaying = false;
        setResumeButtonsVisible(canResumeGameplay());
    }

    function sharedMatchRules() {
        return globalThis.__MAYHEM_RUNTIME &&
            globalThis.__MAYHEM_RUNTIME.GameShared &&
            globalThis.__MAYHEM_RUNTIME.GameShared.matchRules
            ? globalThis.__MAYHEM_RUNTIME.GameShared.matchRules
            : null;
    }

    function currentMatchRuntimeApi() {
        if (multiplayerMode) return globalThis.__MAYHEM_RUNTIME.GameNet || null;
        return globalThis.__MAYHEM_RUNTIME.GameLocalMatch || null;
    }

    function readMatchContext() {
        var api = currentMatchRuntimeApi();
        return {
            api: api,
            matchState: api && api.getMatchState ? api.getMatchState() : null,
            selfState: api && api.getSelfState ? api.getSelfState() : null,
            respawnState: multiplayerMode && api && api.getRespawnState ? api.getRespawnState() : null,
            privateRoomPhase: multiplayerMode && api && api.getPrivateRoomPhase ? api.getPrivateRoomPhase() : ''
        };
    }

    function resolveMatchEntityName(entityId) {
        if (!entityId) return '';
        var api = currentMatchRuntimeApi();
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

    function updateMenuSessionPanel(matchContext) {
        var els = ensureMenuSessionEls();
        if (!els.stats || !els.status || !els.kd) return;

        var matchState = matchContext ? matchContext.matchState : null;
        var selfState = matchContext ? matchContext.selfState : null;

        if (!runtimeInitialized || !multiplayerMode) {
            els.stats.hidden = true;
            setResumeButtonsVisible(!isPlaying && runtimeInitialized);
            return;
        }

        var kills = Math.max(0, Number(selfState && selfState.kills || 0));
        var deaths = Math.max(0, Number(selfState && selfState.deaths || 0));
        var lives = Math.max(0, Number(selfState && selfState.lmsLives || 0));
        var charge = Math.max(0, Number(selfState && selfState.lmsCharge || 0));
        var matchRules = sharedMatchRules();

        els.stats.hidden = false;
        els.kd.textContent = matchRules && matchRules.formatMenuMatchStats
            ? matchRules.formatMenuMatchStats(matchState, selfState)
            : (String(matchState && matchState.gameMode || '') === 'lms'
                ? ('LIVES ' + lives + ' | CHARGE ' + charge)
                : ('KILLS ' + kills + ' | DEATHS ' + deaths));

        if (matchRules && matchRules.formatMenuMatchStatus) {
            els.status.textContent = matchRules.formatMenuMatchStatus(matchState, selfState, {
                nowMs: Date.now,
                privateRoomPhase: matchContext ? matchContext.privateRoomPhase : '',
                respawnState: matchContext ? matchContext.respawnState : null,
                resolveEntityName: resolveMatchEntityName
            });
        } else {
            if (!matchState || !matchState.started) {
                els.status.textContent = 'WAITING FOR MATCH START';
            } else if (matchState.ended) {
                els.status.textContent = winnerLabel(matchState, selfState) + ' WON | RESET ' + formatSecondsRemaining(Number(matchState.resetAt || 0) - Date.now());
            } else {
                els.status.textContent = 'FFA ' + kills + ' / ' + Number(matchState.targetProgress || 0).toFixed(0) + ' | LEAD ' + Number(matchState.leaderProgress || 0).toFixed(0);
            }
        }

        setResumeButtonsVisible(!isPlaying && canResumeGameplay());
    }

    function syncMatchHud(matchContext) {
        if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateMatchStatus) {
            globalThis.__MAYHEM_RUNTIME.GameUI.updateMatchStatus(
                matchContext ? matchContext.matchState : null,
                matchContext ? matchContext.selfState : null
            );
        }
        updateMenuSessionPanel(matchContext);
    }

    function handleMatchEndState(matchContext) {
        var matchState = matchContext ? matchContext.matchState : null;
        var selfState = matchContext ? matchContext.selfState : null;
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

    function setTransientDebug(text, ms) {
        globalThis.__MAYHEM_RUNTIME.GameUI.setDebugInfo(text || '');
        if (debugTimer) clearTimeout(debugTimer);
        if (!text) {
            debugTimer = null;
            return;
        }
        debugTimer = setTimeout(function () {
            globalThis.__MAYHEM_RUNTIME.GameUI.setDebugInfo('');
            debugTimer = null;
        }, ms || 1000);
    }

    function isLocalActionLocked() {
        return !!(globalThis.__MAYHEM_RUNTIME.GamePlayer &&
            globalThis.__MAYHEM_RUNTIME.GamePlayer.isActionLocked &&
            globalThis.__MAYHEM_RUNTIME.GamePlayer.isActionLocked());
    }

    function canUseLocalAction(actionType) {
        var player = globalThis.__MAYHEM_RUNTIME.GamePlayer;
        if (!player) return !isLocalActionLocked();
        if (actionType === 'weapon' && player.canUseWeapon) return !!player.canUseWeapon();
        if (actionType === 'throwable' && player.canUseThrowable) return !!player.canUseThrowable();
        if (actionType === 'ability' && player.canUseAbility) return !!player.canUseAbility();
        return !isLocalActionLocked();
    }

    function hasInputCapture() {
        return !!renderer && document.pointerLockElement === renderer.domElement;
    }

    function applyDebugVisuals(visible) {
        debugVisualsOn = !!visible;
        setRuntimeIndicator(activeRuntimeMode);

        if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.setDebugVisuals) {
            globalThis.__MAYHEM_RUNTIME.GameUI.setDebugVisuals(!!visible);
        }

        if (globalThis.__MAYHEM_RUNTIME.GameEnemy) {
            if (globalThis.__MAYHEM_RUNTIME.GameEnemy.setHitboxVisibility) {
                globalThis.__MAYHEM_RUNTIME.GameEnemy.setHitboxVisibility(!!visible);
            } else if (globalThis.__MAYHEM_RUNTIME.GameEnemy.isHitboxVisible && globalThis.__MAYHEM_RUNTIME.GameEnemy.toggleHitboxVisibility) {
                if (globalThis.__MAYHEM_RUNTIME.GameEnemy.isHitboxVisible() !== !!visible) {
                    globalThis.__MAYHEM_RUNTIME.GameEnemy.toggleHitboxVisibility();
                }
            }
        }

        if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setHitboxVisibility) {
            globalThis.__MAYHEM_RUNTIME.GameNet.setHitboxVisibility(!!visible);
        }

        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.setHitboxVisibility) {
            globalThis.__MAYHEM_RUNTIME.GamePlayer.setHitboxVisibility(!!visible);
        }

        if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.setDebugMode) {
            globalThis.__MAYHEM_RUNTIME.GameAbilities.setDebugMode(!!visible);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameThrowables && globalThis.__MAYHEM_RUNTIME.GameThrowables.setDebugMode) {
            globalThis.__MAYHEM_RUNTIME.GameThrowables.setDebugMode(!!visible);
        }
    }

    function syncReticleWithWeapon(weapon) {
        if (!weapon) return;
        var adsState = null;
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer && globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState) {
            adsState = globalThis.__MAYHEM_RUNTIME.GamePlayer.getAdsState();
        }
        globalThis.__MAYHEM_RUNTIME.GameUI.updateReticle(
            weapon,
            globalThis.__MAYHEM_RUNTIME.GameHitscan.getReticleSpec(weapon.id),
            adsState
        );
    }

    function applyWeapon(weapon) {
        if (!weapon) return;
        globalThis.__MAYHEM_RUNTIME.GameUI.updateWeaponInfo(weapon);
        globalThis.__MAYHEM_RUNTIME.GamePlayer.setWeaponModel(weapon.id);
        syncReticleWithWeapon(weapon);
        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.sendEquipWeapon) {
            globalThis.__MAYHEM_RUNTIME.GameNet.sendEquipWeapon(weapon.id);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.refresh) {
            globalThis.__MAYHEM_RUNTIME.GameDocs.refresh();
        }
        setTransientDebug('Weapon: ' + weapon.name, 950);
    }

    function syncMenuWeaponSlotsToRuntime() {
        var menuLoadout = menuLoadoutApi();
        if (!menuLoadout || !menuLoadout.syncToRuntime || !menuLoadout.getWeaponSlots) {
            return [];
        }
        menuLoadout.syncToRuntime(multiplayerMode);
        return menuLoadout.getWeaponSlots().slice(0, 2);
    }

    function validateMenuSelections() {
        var menuLoadout = menuLoadoutApi();
        if (!menuLoadout || !menuLoadout.validateSelections) {
            return { ok: false, message: 'Menu loadout unavailable.' };
        }
        return menuLoadout.validateSelections();
    }

    function applyAbilityProfile(profileId) {
        if (!globalThis.__MAYHEM_RUNTIME.GameAbilities) return null;
        var selected = globalThis.__MAYHEM_RUNTIME.GameAbilities.setClass(profileId);
        if (!selected) return null;

        var currentMenuWeapons = menuLoadoutApi() && menuLoadoutApi().getWeaponSlots
            ? menuLoadoutApi().getWeaponSlots()
            : [];
        if (selected.loadoutWeapon || (currentMenuWeapons && currentMenuWeapons.length > 0)) {
            var preferredWeapon = (currentMenuWeapons && currentMenuWeapons.length > 0)
                ? currentMenuWeapons[0]
                : selected.loadoutWeapon;
            applyWeapon(globalThis.__MAYHEM_RUNTIME.GameHitscan.setWeapon(preferredWeapon));
        }

        globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.applyArmorProfile(selected.armorMax || globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getArmorMax());
        globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(globalThis.__MAYHEM_RUNTIME.GameAbilities.getHudState());
        if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.refresh) {
            globalThis.__MAYHEM_RUNTIME.GameDocs.refresh();
        }

        return selected;
    }

    function handleEnemyHit(hitPoint, damage, hitType, result) {
        if (!result) return;
        var currentWeapon = globalThis.__MAYHEM_RUNTIME.GameHitscan && globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon
            ? globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon()
            : null;
        var isShotgun = !!(currentWeapon && currentWeapon.id === 'shotgun');
        var damageNumberSpread = isShotgun ? { spreadX: 152, spreadY: 72 } : undefined;
        if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
            globalThis.__MAYHEM_RUNTIME.GameAudio.play('bulletImpact', {
                killed: !!result.killed,
                hitType: hitType,
                weapon: currentWeapon && currentWeapon.id ? currentWeapon.id : ''
            });
        }
        if (result.killed) {
            globalThis.__MAYHEM_RUNTIME.GameUI.showKillMarker();
            globalThis.__MAYHEM_RUNTIME.GameUI.showDamageNumber(hitPoint, damage, true, camera, hitType, damageNumberSpread);
        } else {
            globalThis.__MAYHEM_RUNTIME.GameUI.showHitMarker();
            globalThis.__MAYHEM_RUNTIME.GameUI.showDamageNumber(hitPoint, damage, false, camera, hitType, damageNumberSpread);
        }
    }

    function tryPlayerFire() {
        if (!canUseLocalAction('weapon')) return;
        if (multiplayerMode && globalThis.__MAYHEM_RUNTIME.GameNet) {
            var selfState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState ? globalThis.__MAYHEM_RUNTIME.GameNet.getSelfState() : null;
            var respawnState = globalThis.__MAYHEM_RUNTIME.GameNet.getRespawnState ? globalThis.__MAYHEM_RUNTIME.GameNet.getRespawnState() : null;
            if ((selfState && selfState.alive === false) || (respawnState && respawnState.active)) return;
        }
        if (globalThis.__MAYHEM_RUNTIME.GamePlayer.isSprinting()) return;
        if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.isDeadeyeActive()) return;
        netShotCounter = (netShotCounter + 1) % 1000000;
        var shotToken = 's' + Date.now().toString(36) + '-' + netShotCounter.toString(36);
        var fired = globalThis.__MAYHEM_RUNTIME.GameHitscan.fire(
            camera,
            function (hitboxMesh, hitPoint, distance, hitType, damage, weapon) {
                if (multiplayerMode && hitboxMesh && hitboxMesh.userData && hitboxMesh.userData.ownerType === 'net') {
                    return;
                }

                if (!globalThis.__MAYHEM_RUNTIME.GameEnemy || !globalThis.__MAYHEM_RUNTIME.GameEnemy.damage) return;
                var result = globalThis.__MAYHEM_RUNTIME.GameEnemy.damage(hitboxMesh, damage);
                handleEnemyHit(hitPoint, damage, hitType, result);
            },
            function () {},
            shotToken
        );

        if (fired) {
            var activeWeapon = globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon ? globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon() : null;
            if (
                multiplayerMode &&
                activeWeapon &&
                globalThis.__MAYHEM_RUNTIME.GameNet &&
                globalThis.__MAYHEM_RUNTIME.GameNet.sendFire
            ) {
                globalThis.__MAYHEM_RUNTIME.GameNet.sendFire(activeWeapon.id, shotToken);
            }

            globalThis.__MAYHEM_RUNTIME.GamePlayer.triggerAction('fire');
            if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.play) {
                var w = globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon();
                if (document.hasFocus()) {
                    globalThis.__MAYHEM_RUNTIME.GameAudio.play('fire', { weapon: w && w.id ? w.id : 'rifle' });
                }
            }
        }
    }

    function setupPointerLock() {
        overlay = document.getElementById('overlay');
        var playBtn = document.getElementById('play-btn');
        var backModeBtn = document.getElementById('back-mode-btn');
        var modeButtonsWrap = document.getElementById('mode-buttons');
        var postGameEls = ensurePostGameEls();
        var lastStartRequest = 0;

        function showResumeControl(show) {
            if (!playBtn) return;
            setResumeButtonsVisible(!!show && canResumeGameplay());
        }

        function requestPlayStart(e) {
            var now = performance.now();
            if (now - lastStartRequest < 140) return;
            lastStartRequest = now;
            if (e) {
                if (typeof e.button === 'number' && e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
            }
            if (!canResumeGameplay()) return;
            var validation = validateMenuSelections();
            if (!validation.ok) {
                setTransientDebug(validation.message, 1800);
                return;
            }
            if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.unlock) {
                globalThis.__MAYHEM_RUNTIME.GameAudio.unlock();
            }
            if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.isOpen && globalThis.__MAYHEM_RUNTIME.GameDocs.isOpen()) {
                globalThis.__MAYHEM_RUNTIME.GameDocs.close();
            }

            var target = renderer && renderer.domElement;
            if (!target) {
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
                showResumeControl(true);
                return;
            }
            var requestLock = target.requestPointerLock || target.webkitRequestPointerLock || target.mozRequestPointerLock;
            if (typeof requestLock !== 'function') {
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
                showResumeControl(true);
                setTransientDebug('Pointer lock is required for gameplay.', 2200);
                return;
            }
            try {
                var maybePromise = requestLock.call(target);
                if (maybePromise && typeof maybePromise.then === 'function' && typeof maybePromise.catch === 'function') {
                    maybePromise.catch(function () {
                        if (!document.pointerLockElement) {
                            if (overlay) overlay.style.display = 'flex';
                            isPlaying = false;
                            showResumeControl(true);
                            setTransientDebug('Pointer lock denied. Click PLAY to retry.', 2200);
                        }
                    });
                }
            } catch (err) {
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
                showResumeControl(true);
                setTransientDebug('Pointer lock failed. Click PLAY to retry.', 2200);
            }
        }

        globalThis.__MAYHEM_RUNTIME.GameSession = globalThis.__MAYHEM_RUNTIME.GameSession || {};
        globalThis.__MAYHEM_RUNTIME.GameSession.startGameplayFromMenu = function (event) {
            return requestPlayStart(event);
        };
        globalThis.__MAYHEM_RUNTIME.GameSession.showGameplayPrompt = function () {
            showGameplayPrompt();
        };

        if (playBtn) {
            playBtn.addEventListener('click', requestPlayStart);
            playBtn.addEventListener('pointerup', requestPlayStart);
            playBtn.addEventListener('mousedown', requestPlayStart);
            playBtn.addEventListener('touchend', requestPlayStart, { passive: false });
        }

        if (backModeBtn) {
            backModeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile && globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile.clearSelectedMode) {
                    globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile.clearSelectedMode();
                }
                window.location.href = window.location.pathname;
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
            postGameEls.continueBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                completePostGameFlow();
            });
        }

        document.addEventListener('keydown', function (e) {
            if (!postGameState.active) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (postGameState.phase === 'celebration') {
                    showPostGameResults();
                } else {
                    completePostGameFlow();
                }
            }
        });

        document.addEventListener('pointerlockchange', function () {
            if (document.pointerLockElement === renderer.domElement) {
                if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.close) {
                    globalThis.__MAYHEM_RUNTIME.GameDocs.close();
                }
                if (overlay) overlay.style.display = 'none';
                isPlaying = true;
                setResumeButtonsVisible(false);
            } else {
                if (controlsApi && controlsApi.releaseTransientInput) {
                    controlsApi.releaseTransientInput();
                }
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
                setResumeButtonsVisible(canResumeGameplay());
            }
        });

        document.addEventListener('pointerlockerror', function () {
            if (!document.pointerLockElement) {
                if (controlsApi && controlsApi.releaseTransientInput) {
                    controlsApi.releaseTransientInput();
                }
                if (overlay) overlay.style.display = 'flex';
                isPlaying = false;
                showResumeControl(true);
                setTransientDebug('Pointer lock error. Click PLAY to retry.', 2200);
            }
        });

        if (modeButtonsWrap && modeButtonsWrap.style.display !== 'none') {
            showResumeControl(false);
        }

        if (autoStartNoLock) {
            autoStartNoLock = false;
            requestPlayStart();
        }
    }

    function initGame() {
        applyBrandingOverrides();
        return depGet('GameGameplayRuntimeBootstrap').start({
            activeRuntimeMode: activeRuntimeMode,
            applyAbilityProfile: applyAbilityProfile,
            applyDebugVisuals: applyDebugVisuals,
            applyWeapon: applyWeapon,
            canUseLocalAction: canUseLocalAction,
            handleEnemyHit: handleEnemyHit,
            hasInputCapture: hasInputCapture,
            isPlaying: function () { return isPlaying; },
            setTransientDebug: setTransientDebug,
            startupDebugNotice: startupDebugNotice,
            syncMenuWeaponSlotsToRuntime: syncMenuWeaponSlotsToRuntime,
            toggleDebugVisuals: function () {
                applyDebugVisuals(!debugVisualsOn);
                return debugVisualsOn;
            },
            tryPlayerFire: tryPlayerFire
        }).then(function (result) {
            renderer = result.renderer;
            scene = result.scene;
            clock = result.clock;
            camera = result.camera;
            controlsApi = result.controlsApi || null;
            multiplayerMode = !!result.multiplayerMode;
            startupDebugNotice = result.startupDebugNotice || '';
            runtimeInitialized = true;
            setupPointerLock();
            showGameplayPrompt();
            if (controlsApi && controlsApi.bind) {
                controlsApi.bind();
            }
            animate();
        });
    }

    function animate() {
        var loopApi = depGet('GameLoop');
        if (loopApi && loopApi.requestFrame) {
            loopApi.requestFrame(animate);
        } else {
            requestAnimationFrame(animate);
        }

        var dt = clock.getDelta();
        if (dt > 0.1) dt = 0.1;

        if (globalThis.__MAYHEM_RUNTIME.GameWorld && globalThis.__MAYHEM_RUNTIME.GameWorld.update) {
            globalThis.__MAYHEM_RUNTIME.GameWorld.update(dt);
        }

        globalThis.__MAYHEM_RUNTIME.GamePlayer.update(dt);

        var currentWeapon = globalThis.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon();
        if (currentWeapon) {
            syncReticleWithWeapon(currentWeapon);
            if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateWeaponInfo) {
                globalThis.__MAYHEM_RUNTIME.GameUI.updateWeaponInfo(currentWeapon);
            }
        }
        if (controlsApi && controlsApi.isTriggerHeld && controlsApi.isTriggerHeld() && hasInputCapture() && currentWeapon && currentWeapon.automatic && !globalThis.__MAYHEM_RUNTIME.GamePlayer.isSprinting()) {
            tryPlayerFire();
        }

        if (globalThis.__MAYHEM_RUNTIME.GameHitscan.tick) {
            globalThis.__MAYHEM_RUNTIME.GameHitscan.tick(dt);
        }
        if (globalThis.__MAYHEM_RUNTIME.GameHitscan.updateTracers) {
            globalThis.__MAYHEM_RUNTIME.GameHitscan.updateTracers(dt);
        }
        globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.tickInvulnTimer(dt);
        globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.tickArmorRegen(dt);

        var playerPos = globalThis.__MAYHEM_RUNTIME.GamePlayer.getPosition();
        var playerRot = globalThis.__MAYHEM_RUNTIME.GamePlayer.getRotation();
        if (controlsApi && controlsApi.updateArmedThrowablePreview) {
            controlsApi.updateArmedThrowablePreview();
        }

        if (multiplayerMode) {
            globalThis.__MAYHEM_RUNTIME.GameNet.update(dt, playerPos, playerRot);
            var matchContext = readMatchContext();
            var selfState = matchContext.selfState;
            if (selfState) {
                if (globalThis.__MAYHEM_RUNTIME.GameNetSelfSync && globalThis.__MAYHEM_RUNTIME.GameNetSelfSync.syncPlayerState) {
                    globalThis.__MAYHEM_RUNTIME.GameNetSelfSync.syncPlayerState(selfState, dt);
                }
            }

            if (globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState) {
                var abilityState = globalThis.__MAYHEM_RUNTIME.GameNet.getSelfAbilityState();
                if (abilityState && globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.getNetworkHudState) {
                    globalThis.__MAYHEM_RUNTIME.GameUI.updateAbilityInfo(
                        globalThis.__MAYHEM_RUNTIME.GameAbilities.getNetworkHudState(abilityState)
                    );
                }
            }

            handleMatchEndState(matchContext);

            var notice = globalThis.__MAYHEM_RUNTIME.GameNet.consumeNotice();
            if (notice) setTransientDebug(notice, 900);

            if (globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync && globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync.syncGameplayFeedback) {
                globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync.syncGameplayFeedback({
                    dt: dt,
                    selfState: selfState,
                    camera: camera,
                    setTransientDebug: setTransientDebug
                });
            }
            syncMatchHud(matchContext);
        } else {
            if (globalThis.__MAYHEM_RUNTIME.GameLocalMatch && globalThis.__MAYHEM_RUNTIME.GameLocalMatch.tick) {
                globalThis.__MAYHEM_RUNTIME.GameLocalMatch.tick(dt);
            }
            globalThis.__MAYHEM_RUNTIME.GameAbilities.update(
                dt,
                camera,
                playerPos,
                playerRot,
                function (hitData) {
                    if (!hitData || !hitData.result) return;
                    handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
                },
                setTransientDebug
            );

            globalThis.__MAYHEM_RUNTIME.GameEnemy.update(dt, playerPos, camera, function (damage, hitType, attackerEnemy) {
                globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.consumeDamage(damage, hitType, attackerEnemy);
            });

            globalThis.__MAYHEM_RUNTIME.GameThrowables.update(dt, function (hitData) {
                if (!hitData || !hitData.result) return;
                handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
            });

            globalThis.__MAYHEM_RUNTIME.GameUI.updateThrowableInfo(globalThis.__MAYHEM_RUNTIME.GameThrowables.getState());
            globalThis.__MAYHEM_RUNTIME.GameUI.updateHealth(globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getHP(), globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getMaxHP());
            globalThis.__MAYHEM_RUNTIME.GameUI.updateArmor(globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getArmor(), globalThis.__MAYHEM_RUNTIME.GamePlayerCombat.getArmorMax());
            var localMatchContext = readMatchContext();
            handleMatchEndState(localMatchContext);
            syncMatchHud(localMatchContext);
        }

        if ((!controlsApi || !controlsApi.hasArmedThrowablePreview || !controlsApi.hasArmedThrowablePreview()) &&
            globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.updateTrackingReticle) {
            globalThis.__MAYHEM_RUNTIME.GameUI.updateTrackingReticle(false, false);
        }

        currentAimTargetId = '';
        var centerTarget = globalThis.__MAYHEM_RUNTIME.GameHitscan.peekCenterTarget(camera);
        var areaTarget = (currentWeapon && currentWeapon.autoLock && globalThis.__MAYHEM_RUNTIME.GameHitscan.peekAutoLockTarget)
            ? globalThis.__MAYHEM_RUNTIME.GameHitscan.peekAutoLockTarget(camera)
            : null;
        if (currentWeapon && currentWeapon.autoLock) {
            if (areaTarget && areaTarget.targetId) currentAimTargetId = areaTarget.targetId;
        } else if (centerTarget && centerTarget.targetId) {
            currentAimTargetId = centerTarget.targetId;
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.setHitscanTargetState) {
            globalThis.__MAYHEM_RUNTIME.GameUI.setHitscanTargetState(!!(
                currentWeapon &&
                currentWeapon.id !== 'shotgun' &&
                !currentWeapon.autoLock &&
                !currentWeapon.singleHitFromPellets &&
                centerTarget &&
                centerTarget.hitbox
            ));
        }
        if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.setShotgunTargetState) {
            globalThis.__MAYHEM_RUNTIME.GameUI.setShotgunTargetState(!!(
                currentWeapon &&
                (((currentWeapon.id === 'shotgun' || currentWeapon.singleHitFromPellets) && centerTarget && centerTarget.hitbox) ||
                    (currentWeapon.autoLock && areaTarget && areaTarget.hitbox))
            ));
        }

        globalThis.__MAYHEM_RUNTIME.GameOverhead.update(camera, playerPos, currentAimTargetId);
        if (globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatRadar || globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatBeacons) {
            var awarenessState = globalThis.__MAYHEM_RUNTIME.GameAwareness.buildState(playerPos, playerRot ? playerRot.yaw : 0);
            if (globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatRadar) {
                globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatRadar(awarenessState);
            }
            if (globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatBeacons) {
                globalThis.__MAYHEM_RUNTIME.GameUI.updateCombatBeacons(awarenessState.beacons);
            }
        }

        if (depGet('GameGameplayHudSync') && depGet('GameGameplayHudSync').update) {
            depGet('GameGameplayHudSync').update({
                camera: camera,
                dt: dt,
                multiplayerMode: multiplayerMode,
                debugVisualsOn: debugVisualsOn
            });
        }
        if (depGet('GameHookVisuals') && depGet('GameHookVisuals').render) {
            depGet('GameHookVisuals').render(multiplayerMode);
        }
        camera.layers.set(0);
        renderer.render(scene, camera);
    }

    function runtimeProfile() {
        return depGet('GameRuntimeProfile');
    }

    function runtimeModeUi() {
        return depGet('GameRuntimeModeUi');
    }

    function setRuntimeIndicator(mode) {
        var modeUi = runtimeModeUi();
        if (modeUi && modeUi.setRuntimeIndicator) {
            modeUi.setRuntimeIndicator(mode, { debugActive: debugVisualsOn });
        }
    }

    function launchModeById(modeId, options) {
        options = options || {};
        var runtime = runtimeProfile();
        var authApi = globalThis.__MAYHEM_RUNTIME.GameNetAuth || null;
        var selectedMode = runtime && runtime.selectMode
            ? runtime.selectMode(modeId)
            : (runtime && runtime.getMode ? runtime.getMode(modeId) : null);
        if (!selectedMode) {
            return { ok: false, error: 'Unknown runtime mode.' };
        }

        if (options.roomId) {
            selectedMode.roomId = String(options.roomId);
        }
        if (options.gameMode) {
            selectedMode.gameMode = String(options.gameMode);
        }

        activeRuntimeMode = selectedMode;

        if (selectedMode.authorityMode === 'networked') {
            forcedRoomId = selectedMode.roomId || 'global';
            if (authApi && authApi.setAuthVisible) {
                authApi.setAuthVisible(false);
            }
            if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId) {
                globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId(forcedRoomId);
            }
            startupDebugNotice = options.notice || (runtimeModeUi() && runtimeModeUi().startupNoticeForMode
                ? runtimeModeUi().startupNoticeForMode(selectedMode)
                : '');
        } else {
            forcedRoomId = 'global';
            if (globalThis.__MAYHEM_RUNTIME.GameNet && globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId) {
                globalThis.__MAYHEM_RUNTIME.GameNet.setRoomId('global');
            }
            startupDebugNotice = options.notice || (runtimeModeUi() && runtimeModeUi().startupNoticeForMode
                ? runtimeModeUi().startupNoticeForMode(selectedMode)
                : '');
        }
        return Promise.resolve()
        .then(function () {
            return initGame();
        })
        .then(function () {
            return {
                ok: true,
                mode: selectedMode
            };
        })
        .catch(function (err) {
            var msg = (err && err.message) ? err.message : String(err || 'Unknown startup error');
            var overlayEl = document.getElementById('overlay');
            if (overlayEl) overlayEl.style.display = 'flex';
            var dbg = document.getElementById('debug-info');
            if (dbg) dbg.textContent = 'Startup error: ' + msg;
            console.error('Startup error:', err);
            activeRuntimeMode = null;
            autoStartNoLock = false;
            startupDebugNotice = '';
            forcedRoomId = 'global';
            if (runtime && runtime.clearSelectedMode) {
                runtime.clearSelectedMode();
            }
            return { ok: false, error: msg };
        });
    }

    function getActivityState() {
        if (!activeRuntimeMode || !runtimeInitialized) return 'menu';
        var matchContext = readMatchContext();
        if (multiplayerMode && matchContext.privateRoomPhase === 'lobby') {
            return 'private_room_lobby';
        }
        return 'in_match';
    }

    globalThis.__MAYHEM_RUNTIME.GameMain = {
        launchModeById: launchModeById,
        getActivityState: getActivityState
    };
})();
