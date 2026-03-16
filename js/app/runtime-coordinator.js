/**
 * runtime-coordinator.js - App-owned gameplay runtime coordinator.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameRuntimeCoordinator
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var LAUNCH_ERROR_KEY = 'mayhem.launchError';

    function create() {
        var renderer, scene, clock, camera;
        var debugTimer = null;
        var debugVisualsOn = false;
        var multiplayerMode = false;
        var netShotCounter = 0;
        var runtimeInitialized = false;
        var controlsApi = null;
        var gameSession = null;
        var runtimeShell = null;
        var gameplayRuntimeLoop = null;
        var presentationRuntimeLoop = null;

        function depGet(name) {
            return globalThis.__MAYHEM_RUNTIME[name];
        }

        function sessionStore() {
            try {
                return window.sessionStorage || null;
            } catch (_err) {
                return null;
            }
        }

        function persistLaunchError(message) {
            var store = sessionStore();
            if (!store) return;
            try {
                store.setItem(LAUNCH_ERROR_KEY, String(message || 'Room join failed.'));
            } catch (_err) {
                // no-op
            }
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

        function sharedMatchRules() {
            return globalThis.__MAYHEM_RUNTIME &&
                globalThis.__MAYHEM_RUNTIME.GameShared &&
                globalThis.__MAYHEM_RUNTIME.GameShared.matchRules
                ? globalThis.__MAYHEM_RUNTIME.GameShared.matchRules
                : null;
        }

        function isPrivateRoomSession(snapshot) {
            var phase = snapshot && snapshot.privateRoomPhase ? String(snapshot.privateRoomPhase) : '';
            return !!phase || !!(runtimeShell && runtimeShell.getActiveRuntimeMode && runtimeShell.getActiveRuntimeMode() && runtimeShell.getActiveRuntimeMode().roomStrategy === 'private');
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

        function currentMatchRuntimeApi() {
            if (multiplayerMode) return globalThis.__MAYHEM_RUNTIME.GameNet || null;
            return globalThis.__MAYHEM_RUNTIME.GameLocalMatch || globalThis.__MAYHEM_RUNTIME.GameNet || null;
        }

        function currentMatchRuntimeOwner() {
            var api = currentMatchRuntimeApi();
            return api && api.runtime ? api.runtime : api;
        }

        function currentMatchViewApi() {
            var api = currentMatchRuntimeApi();
            return api && api.view ? api.view : api;
        }

        function currentSelfCombatApi() {
            return globalThis.__MAYHEM_RUNTIME.GamePlayerCombat || null;
        }

        function currentMatchCommandApi() {
            if (!multiplayerMode) return null;
            var api = currentMatchRuntimeApi();
            return api && api.commands ? api.commands : api;
        }

        function currentMatchRemoteEntitiesApi() {
            if (!multiplayerMode) return null;
            var api = currentMatchRuntimeApi();
            return api && api.remoteEntities ? api.remoteEntities : api;
        }

        function readMatchContext() {
            var api = currentMatchViewApi();
            var selfCombat = currentSelfCombatApi();
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

        function updateMenuSessionPanel(matchContext) {
            var statsEl = document.getElementById('menu-session-stats');
            var statusEl = document.getElementById('menu-session-status');
            var kdEl = document.getElementById('menu-session-kd');
            if (!statsEl || !statusEl || !kdEl) return;

            var matchState = matchContext ? matchContext.matchState : null;
            var selfState = matchContext ? matchContext.selfState : null;
            var playing = !!(gameSession && gameSession.isPlaying && gameSession.isPlaying());

            if (!runtimeInitialized) {
                statsEl.hidden = true;
                if (gameSession && gameSession.setResumeButtonsVisible) {
                    gameSession.setResumeButtonsVisible(!playing && runtimeInitialized);
                }
                return;
            }

            var pauseState = gameSession && gameSession.getPauseState ? gameSession.getPauseState() : null;
            if (pauseState && pauseState.active) {
                statsEl.hidden = false;
                statusEl.textContent = pauseState.reason === 'idle'
                    ? 'IDLE TIMEOUT :: MATCH DISCONNECTED'
                    : 'PAUSE MENU :: MATCH DISCONNECTED';
                kdEl.textContent = 'CONNECTION CLOSED TO LIMIT CLOUDFLARE TRAFFIC';
                if (gameSession && gameSession.setResumeButtonsVisible) {
                    gameSession.setResumeButtonsVisible(false);
                }
                return;
            }

            var kills = Math.max(0, Number(selfState && selfState.kills || 0));
            var deaths = Math.max(0, Number(selfState && selfState.deaths || 0));
            var lives = Math.max(0, Number(selfState && selfState.lmsLives || 0));
            var charge = Math.max(0, Number(selfState && selfState.lmsCharge || 0));
            var matchRules = sharedMatchRules();

            statsEl.hidden = false;
            kdEl.textContent = matchRules && matchRules.formatMenuMatchStats
                ? matchRules.formatMenuMatchStats(matchState, selfState)
                : (String(matchState && matchState.gameMode || '') === 'lms'
                    ? ('LIVES ' + lives + ' | CHARGE ' + charge)
                    : ('KILLS ' + kills + ' | DEATHS ' + deaths));

            if (matchRules && matchRules.formatMenuMatchStatus) {
                statusEl.textContent = matchRules.formatMenuMatchStatus(matchState, selfState, {
                    nowMs: Date.now,
                    privateRoomPhase: matchContext ? matchContext.privateRoomPhase : '',
                    respawnState: matchContext ? matchContext.respawnState : null,
                    resolveEntityName: resolveMatchEntityName
                });
            } else {
                if (!matchState || !matchState.started) {
                    statusEl.textContent = 'WAITING FOR MATCH START';
                } else if (matchState.ended) {
                    statusEl.textContent = winnerLabel(matchState, selfState) + ' WON | RESET ' + formatSecondsRemaining(Number(matchState.resetAt || 0) - Date.now());
                } else {
                    statusEl.textContent = 'FFA ' + kills + ' / ' + Number(matchState.targetProgress || 0).toFixed(0) + ' | LEAD ' + Number(matchState.leaderProgress || 0).toFixed(0);
                }
            }

            if (gameSession && gameSession.setResumeButtonsVisible) {
                gameSession.setResumeButtonsVisible(!playing && gameSession.canResumeGameplay && gameSession.canResumeGameplay());
            }
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

        function setIdleWarning(text) {
            if (globalThis.__MAYHEM_RUNTIME.GameUI && globalThis.__MAYHEM_RUNTIME.GameUI.setIdleWarning) {
                globalThis.__MAYHEM_RUNTIME.GameUI.setIdleWarning(text || '');
            }
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
            setRuntimeIndicator(runtimeShell && runtimeShell.getActiveRuntimeMode ? runtimeShell.getActiveRuntimeMode() : null);

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

            var remoteApi = currentMatchRemoteEntitiesApi();
            if (remoteApi && remoteApi.setHitboxVisibility) {
                remoteApi.setHitboxVisibility(!!visible);
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
            var netCommands = currentMatchCommandApi();
            if (multiplayerMode && netCommands && netCommands.sendEquipWeapon) {
                netCommands.sendEquipWeapon(weapon.id);
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
            var netView = currentMatchViewApi();
            var netCommands = currentMatchCommandApi();
            var selfCombat = currentSelfCombatApi();
            if (multiplayerMode) {
                if (selfCombat && selfCombat.canUseGameplayActions && !selfCombat.canUseGameplayActions()) return;
                if (!selfCombat && netView) {
                    var selfState = netView.getAuthoritativeSelfState ? netView.getAuthoritativeSelfState() : null;
                    var respawnState = netView.getRespawnState ? netView.getRespawnState() : null;
                    if ((selfState && selfState.alive === false) || (respawnState && respawnState.active)) return;
                }
            }
            if (globalThis.__MAYHEM_RUNTIME.GamePlayer.isSprinting()) return;
            if (globalThis.__MAYHEM_RUNTIME.GameAbilities && globalThis.__MAYHEM_RUNTIME.GameAbilities.isDeadeyeActive()) return;
            netShotCounter = (netShotCounter + 1) % 1000000;
            var shotToken = 's' + Date.now().toString(36) + '-' + netShotCounter.toString(36);
            var fired = globalThis.__MAYHEM_RUNTIME.GameHitscan.fire(
                camera,
                function (hitboxMesh, hitPoint, distance, hitType, damage, weapon, pelletIndex) {
                    if (multiplayerMode && hitboxMesh && hitboxMesh.userData && hitboxMesh.userData.ownerType === 'net') {
                        var netApi = globalThis.__MAYHEM_RUNTIME.GameNet || null;
                        var canPredictNetworkHit = !!(netApi && netApi.isConnected && netApi.isConnected());
                        var shouldPredictNetHit = canPredictNetworkHit && (!(globalThis.__MAYHEM_RUNTIME.GameHitscan &&
                            globalThis.__MAYHEM_RUNTIME.GameHitscan.shouldPredictNetHit) ||
                            globalThis.__MAYHEM_RUNTIME.GameHitscan.shouldPredictNetHit(camera, hitboxMesh, shotToken, pelletIndex));
                        if (shouldPredictNetHit &&
                            globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync &&
                            globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync.emitPredictedLocalDamageFeedback) {
                            globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync.emitPredictedLocalDamageFeedback({
                                weaponId: weapon && weapon.id ? weapon.id : '',
                                hitType: hitType,
                                shotToken: shotToken,
                                pelletIndex: pelletIndex,
                                damage: damage,
                                worldPos: hitPoint,
                                camera: camera,
                                killed: false
                            });
                        }
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
                    netCommands &&
                    netCommands.sendFire
                ) {
                    netCommands.sendFire(activeWeapon.id, shotToken);
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

        function setupGameplaySession() {
            var sessionFactory = depGet('GameRuntimeSession');
            if (!sessionFactory || !sessionFactory.create) {
                throw new Error('GameRuntimeSession is required before gameplay starts.');
            }

            gameSession = sessionFactory.create({
                isRuntimeReady: function () {
                    return !!runtimeInitialized;
                },
                canResumeGameplay: function () {
                    var matchContext = readMatchContext();
                    if (matchContext.privateRoomPhase === 'lobby') return false;
                    return !(matchContext.matchState && matchContext.matchState.ended);
                },
                getActivityState: function () {
                    return ensureRuntimeShell().getActivityState();
                },
                isNetworkedRuntime: function () {
                    return !!multiplayerMode;
                },
                getPointerLockTarget: function () {
                    return renderer ? renderer.domElement : null;
                },
                validateLaunch: validateMenuSelections,
                beforeGameplayEntry: function () {
                    if (globalThis.__MAYHEM_RUNTIME.GameAudio && globalThis.__MAYHEM_RUNTIME.GameAudio.unlock) {
                        globalThis.__MAYHEM_RUNTIME.GameAudio.unlock();
                    }
                    if (globalThis.__MAYHEM_RUNTIME.GameDocs && globalThis.__MAYHEM_RUNTIME.GameDocs.isOpen && globalThis.__MAYHEM_RUNTIME.GameDocs.isOpen()) {
                        globalThis.__MAYHEM_RUNTIME.GameDocs.close();
                    }
                },
                setTransientDebug: setTransientDebug,
                setIdleWarning: setIdleWarning,
                suspendNetworkSession: function () {
                    if (!multiplayerMode) return false;
                    var netApi = currentMatchRuntimeApi();
                    if (!netApi || !netApi.shutdown) return false;
                    if (netApi.isActive && !netApi.isActive()) return true;
                    netApi.shutdown();
                    setIdleWarning('');
                    updateMenuSessionPanel(readMatchContext());
                    return true;
                },
                releaseTransientInput: function () {
                    if (controlsApi && controlsApi.releaseTransientInput) {
                        controlsApi.releaseTransientInput();
                    }
                },
                returnToMenu: function () {
                    if (globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile && globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile.clearSelectedMode) {
                        globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile.clearSelectedMode();
                    }
                    window.location.href = window.location.pathname;
                },
                isPrivateRoomSession: isPrivateRoomSession,
                resolveWinnerLabel: winnerLabel,
                didSelfWin: didSelfWin,
                modeDisplayName: modeDisplayName,
                objectiveSummary: objectiveSummary,
                resultsSummary: resultsSummary,
                formatSecondsRemaining: formatSecondsRemaining
            });
            gameSession.bindRuntimeControls();
        }

        function initGame() {
            applyBrandingOverrides();
            var activeRuntimeMode = runtimeShell && runtimeShell.getActiveRuntimeMode ? runtimeShell.getActiveRuntimeMode() : null;
            var startupDebugNotice = runtimeShell && runtimeShell.getStartupDebugNotice ? runtimeShell.getStartupDebugNotice() : '';
            return depGet('GameGameplayRuntimeBootstrap').start({
                activeRuntimeMode: activeRuntimeMode,
                applyAbilityProfile: applyAbilityProfile,
                applyDebugVisuals: applyDebugVisuals,
                applyWeapon: applyWeapon,
                canUseLocalAction: canUseLocalAction,
                handleEnemyHit: handleEnemyHit,
                hasInputCapture: hasInputCapture,
                isPlaying: function () {
                    return !!(gameSession && gameSession.isPlaying && gameSession.isPlaying());
                },
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
                runtimeInitialized = true;
                setupGameplaySession();
                gameplayRuntimeLoop = depGet('GameGameplayRuntimeLoop').create({
                    controlsApi: controlsApi,
                    getCamera: function () { return camera; },
                    getMultiplayerMode: function () { return multiplayerMode; },
                    getDebugVisualsOn: function () { return debugVisualsOn; },
                    hasInputCapture: hasInputCapture,
                    tryPlayerFire: tryPlayerFire,
                    readMatchContext: readMatchContext,
                    gameSession: gameSession,
                    setTransientDebug: setTransientDebug,
                    syncMatchHud: syncMatchHud,
                    syncReticleWithWeapon: syncReticleWithWeapon
                });
                presentationRuntimeLoop = depGet('GamePresentationRuntimeLoop').create({
                    controlsApi: controlsApi,
                    getCamera: function () { return camera; },
                    getRenderer: function () { return renderer; },
                    getScene: function () { return scene; }
                });
                if (controlsApi && controlsApi.bind) {
                    controlsApi.bind();
                }
                animate();
                if (gameSession && gameSession.emitSessionState) {
                    gameSession.emitSessionState();
                }
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
            var frameState = gameplayRuntimeLoop.step(dt);
            presentationRuntimeLoop.renderFrame(frameState);
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

        function hardResetFailedNetworkLaunch(message) {
            var msg = String(message || 'Room join failed.');
            persistLaunchError(msg);
            var dbg = document.getElementById('debug-info');
            if (dbg) dbg.textContent = 'Startup error: ' + msg;
            var runtimeProfileApi = runtimeProfile();
            if (runtimeProfileApi && runtimeProfileApi.clearSelectedMode) {
                runtimeProfileApi.clearSelectedMode();
            }
            if (window.location) {
                window.location.href = (window.location && window.location.pathname) ? window.location.pathname : '/';
            }
        }

        function ensureRuntimeShell() {
            if (runtimeShell) return runtimeShell;
            var shellFactory = depGet('GameRuntimeShell');
            if (!shellFactory || !shellFactory.create) {
                throw new Error('GameRuntimeShell is required before gameplay starts.');
            }
            runtimeShell = shellFactory.create({
                getRuntimeProfile: runtimeProfile,
                getRuntimeModeUi: runtimeModeUi,
                getAuthApi: function () { return globalThis.__MAYHEM_RUNTIME.GameNetAuth || null; },
                getNetApi: function () { return globalThis.__MAYHEM_RUNTIME.GameNet || null; },
                setRoomId: function (roomId) {
                    var gameNet = globalThis.__MAYHEM_RUNTIME.GameNet || null;
                    var netRuntime = gameNet && gameNet.runtime ? gameNet.runtime : gameNet;
                    if (netRuntime && netRuntime.setRoomId) {
                        netRuntime.setRoomId(roomId);
                        return;
                    }
                    var fallbackRuntime = currentMatchRuntimeOwner();
                    if (fallbackRuntime && fallbackRuntime.setRoomId) {
                        fallbackRuntime.setRoomId(roomId);
                    }
                },
                startRuntime: initGame,
                onNetworkLaunchFailure: function (message, err) {
                    var overlayEl = document.getElementById('overlay');
                    if (overlayEl) overlayEl.style.display = 'flex';
                    console.error('Startup error:', err);
                    hardResetFailedNetworkLaunch(message);
                },
                onLaunchError: function (message, err) {
                    var overlayEl = document.getElementById('overlay');
                    if (overlayEl) overlayEl.style.display = 'flex';
                    var dbg = document.getElementById('debug-info');
                    if (dbg) dbg.textContent = 'Startup error: ' + message;
                    console.error('Startup error:', err);
                },
                isRuntimeReady: function () { return !!runtimeInitialized; },
                readMatchContext: readMatchContext
            });
            return runtimeShell;
        }

        return {
            launchModeById: function (modeId, options) {
                return ensureRuntimeShell().launchModeById(modeId, options);
            },
            getActivityState: function () {
                if (gameSession && gameSession.getActivityState) {
                    return gameSession.getActivityState();
                }
                return ensureRuntimeShell().getActivityState();
            }
        };
    }

    runtime.GameRuntimeCoordinator = {
        create: create
    };
})();
